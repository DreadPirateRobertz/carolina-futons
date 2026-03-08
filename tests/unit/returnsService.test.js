import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wix-data
const mockItems = [];
let mockTotalCount = 0;

const mockQuery = {
  eq: vi.fn().mockReturnThis(),
  ne: vi.fn().mockReturnThis(),
  ge: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn(async () => ({ items: mockItems, totalCount: mockTotalCount })),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQuery })),
    get: vi.fn(async (collection, id) => mockItems.find(i => i._id === id)),
    insert: vi.fn(async (collection, record) => ({ ...record, _id: 'return-001', _createdDate: new Date() })),
    update: vi.fn(async (collection, record) => record),
  },
}));

// Mock wix-members-backend
const mockMember = {
  _id: 'member-001',
  loginEmail: 'jane@example.com',
  contactDetails: { firstName: 'Jane', lastName: 'Smith' },
};

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => mockMember),
    getRoles: vi.fn(async () => [{ title: 'Admin', _id: 'admin' }]),
  },
}));

// Mock wix-web-module
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (perm, fn) => fn,
}));

// Mock sanitize
vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (typeof id !== 'string') return '';
    const cleaned = id.trim().slice(0, 50);
    return /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : '';
  },
}));

import {
  getReturnEligibleOrders,
  submitReturnRequest,
  getMyReturns,
  getReturnByRma,
  getReturnReasons,
  updateReturnStatus,
} from '../../src/backend/returnsService.web.js';

// ── Test Data ─────────────────────────────────────────────────────────

const recentOrder = {
  _id: 'order-001',
  number: 10042,
  _createdDate: new Date(), // Today, within return window
  paymentStatus: 'PAID',
  fulfillmentStatus: 'FULFILLED',
  buyerInfo: { id: 'member-001', email: 'jane@example.com' },
  billingInfo: { firstName: 'Jane', lastName: 'Smith' },
  totals: { subtotal: 899, shipping: 99, total: 998 },
  lineItems: [
    { _id: 'li-001', productId: 'prod-001', name: 'Eureka Futon Frame', quantity: 1, price: 899, sku: 'EUR-FRM-001' },
  ],
};

const oldOrder = {
  _id: 'order-002',
  number: 10035,
  _createdDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
  paymentStatus: 'PAID',
  buyerInfo: { id: 'member-001' },
  totals: { total: 500 },
  lineItems: [{ _id: 'li-002', name: 'Basic Frame', quantity: 1, price: 500 }],
};

const existingReturn = {
  _id: 'return-existing',
  orderId: 'order-003',
  memberId: 'member-001',
  rmaNumber: 'RMA-TEST-1234',
  orderNumber: '10040',
  type: 'return',
  reason: 'wrong_size',
  reasonLabel: 'Wrong size',
  details: 'Too large for the room.',
  status: 'approved',
  items: JSON.stringify([{ lineItemId: 'li-003', quantity: 1 }]),
  _createdDate: new Date('2026-02-10'),
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('returnsService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockItems.length = 0;
    mockTotalCount = 0;
    // Reset query mock to default behavior (returns mockItems)
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementation(() => ({ ...mockQuery }));
    wixData.get.mockImplementation(async (collection, id) => mockItems.find(i => i._id === id));
  });

  describe('getReturnEligibleOrders', () => {
    it('returns eligible orders within return window', async () => {
      mockItems.push(recentOrder);
      mockTotalCount = 1;

      // Mock the second query (existing returns) to return empty
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation((collection) => {
        if (collection === 'Returns') {
          return { ...mockQuery, find: vi.fn(async () => ({ items: [], totalCount: 0 })) };
        }
        return { ...mockQuery };
      });

      const result = await getReturnEligibleOrders();
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].number).toBe(10042);
      expect(result.orders[0].date).toBeTruthy();
    });

    it('excludes orders with existing return requests', async () => {
      mockItems.push(recentOrder);
      mockTotalCount = 1;

      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation((collection) => {
        if (collection === 'Returns') {
          return {
            ...mockQuery,
            find: vi.fn(async () => ({
              items: [{ orderId: 'order-001', memberId: 'member-001' }],
              totalCount: 1,
            })),
          };
        }
        return { ...mockQuery };
      });

      const result = await getReturnEligibleOrders();
      expect(result.orders).toHaveLength(0);
    });

    it('returns empty for unauthenticated user', async () => {
      const members = await import('wix-members-backend');
      members.currentMember.getMember.mockResolvedValueOnce(null);

      const result = await getReturnEligibleOrders();
      expect(result.orders).toEqual([]);
    });

    it('formats order with line items', async () => {
      mockItems.push(recentOrder);
      mockTotalCount = 1;

      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation((collection) => {
        if (collection === 'Returns') {
          return { ...mockQuery, find: vi.fn(async () => ({ items: [], totalCount: 0 })) };
        }
        return { ...mockQuery };
      });

      const result = await getReturnEligibleOrders();
      const order = result.orders[0];
      expect(order.lineItems).toHaveLength(1);
      expect(order.lineItems[0].name).toBe('Eureka Futon Frame');
      expect(order.total).toBe(998);
    });
  });

  describe('submitReturnRequest', () => {
    beforeEach(async () => {
      // Default: no existing returns
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({ items: [], totalCount: 0 })),
      }));
      wixData.get.mockResolvedValue(recentOrder);
    });

    it('submits a valid return request', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
        details: 'The frame is too large for my room.',
      });

      expect(result.success).toBe(true);
      expect(result.rmaNumber).toMatch(/^RMA-/);
    });

    it('saves correct record to CMS', async () => {
      const wixData = (await import('wix-data')).default;

      await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'defective',
        details: 'Cracked leg on assembly.',
        type: 'exchange',
      });

      const insertCall = wixData.insert.mock.calls[0];
      expect(insertCall[0]).toBe('Returns');
      const record = insertCall[1];
      expect(record.orderId).toBe('order-001');
      expect(record.memberId).toBe('member-001');
      expect(record.reason).toBe('defective');
      expect(record.type).toBe('exchange');
      expect(record.status).toBe('requested');
      expect(record.memberEmail).toBe('jane@example.com');
      expect(record.memberName).toBe('Jane Smith');
    });

    it('generates unique RMA numbers', async () => {
      const result1 = await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'changed_mind',
      });

      const result2 = await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'changed_mind',
      });

      expect(result1.rmaNumber).not.toBe(result2.rmaNumber);
    });

    it('rejects invalid order ID', async () => {
      const result = await submitReturnRequest({
        orderId: '',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid order');
    });

    it('rejects invalid reason', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'i_hate_it',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('valid return reason');
    });

    it('rejects empty items array', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-001',
        items: [],
        reason: 'wrong_size',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least one item');
    });

    it('rejects when no items provided', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-001',
        reason: 'wrong_size',
      });

      expect(result.success).toBe(false);
    });

    it('rejects order not belonging to member', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce({
        ...recentOrder,
        buyerInfo: { id: 'other-member' },
      });

      const result = await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects order outside return window', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce(oldOrder);

      const result = await submitReturnRequest({
        orderId: 'order-002',
        items: [{ lineItemId: 'li-002', quantity: 1 }],
        reason: 'changed_mind',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('30 days');
    });

    it('rejects duplicate return request', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({
          items: [{ orderId: 'order-001', memberId: 'member-001' }],
          totalCount: 1,
        })),
      }));

      const result = await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('filters invalid line items', async () => {
      const wixData = (await import('wix-data')).default;

      await submitReturnRequest({
        orderId: 'order-001',
        items: [
          { lineItemId: 'li-001', quantity: 1 },      // valid
          { lineItemId: 'li-nonexistent', quantity: 1 }, // not in order
        ],
        reason: 'wrong_size',
      });

      const insertCall = wixData.insert.mock.calls[0];
      if (insertCall) {
        const items = JSON.parse(insertCall[1].items);
        // Only li-001 should be included (li-nonexistent not in order)
        expect(items).toHaveLength(1);
        expect(items[0].lineItemId).toBe('li-001');
      }
    });

    it('defaults type to return', async () => {
      const wixData = (await import('wix-data')).default;

      await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });

      const record = wixData.insert.mock.calls[0]?.[1];
      expect(record.type).toBe('return');
    });

    it('sanitizes HTML from details', async () => {
      const wixData = (await import('wix-data')).default;

      await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'defective',
        details: '<script>alert("xss")</script>Cracked leg',
      });

      const record = wixData.insert.mock.calls[0]?.[1];
      expect(record.details).not.toContain('<script>');
      expect(record.details).toContain('Cracked leg');
    });

    it('rejects unauthenticated user', async () => {
      const members = await import('wix-members-backend');
      members.currentMember.getMember.mockResolvedValueOnce(null);

      const result = await submitReturnRequest({
        orderId: 'order-001',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('log in');
    });
  });

  describe('getMyReturns', () => {
    it('returns formatted returns for current member', async () => {
      mockItems.push(existingReturn);
      mockTotalCount = 1;

      const result = await getMyReturns();
      expect(result.returns).toHaveLength(1);
      expect(result.returns[0].rmaNumber).toBe('RMA-TEST-1234');
      expect(result.returns[0].status).toBe('approved');
      expect(result.returns[0].reason).toBe('Wrong size');
      expect(result.returns[0].date).toBeTruthy();
    });

    it('returns empty for unauthenticated user', async () => {
      const members = await import('wix-members-backend');
      members.currentMember.getMember.mockResolvedValueOnce(null);

      const result = await getMyReturns();
      expect(result.returns).toEqual([]);
    });

    it('parses items JSON correctly', async () => {
      mockItems.push(existingReturn);
      mockTotalCount = 1;

      const result = await getMyReturns();
      expect(result.returns[0].items).toHaveLength(1);
      expect(result.returns[0].items[0].lineItemId).toBe('li-003');
    });

    it('strips internal fields from response', async () => {
      mockItems.push(existingReturn);
      mockTotalCount = 1;

      const result = await getMyReturns();
      const ret = result.returns[0];
      expect(ret.memberId).toBeUndefined();
      expect(ret.memberEmail).toBeUndefined();
      expect(ret.adminNotes).toBeUndefined();
    });
  });

  describe('getReturnByRma', () => {
    it('returns return request by RMA number', async () => {
      mockItems.push(existingReturn);

      const result = await getReturnByRma('RMA-TEST-1234');
      expect(result.returnRequest).toBeTruthy();
      expect(result.returnRequest.rmaNumber).toBe('RMA-TEST-1234');
    });

    it('returns null for invalid RMA', async () => {
      const result = await getReturnByRma('');
      expect(result.returnRequest).toBeNull();
    });

    it('returns null for non-existent RMA', async () => {
      // Empty mockItems means find returns nothing
      const result = await getReturnByRma('RMA-NOTFOUND');
      expect(result.returnRequest).toBeNull();
    });

    it('returns null for unauthenticated user', async () => {
      const members = await import('wix-members-backend');
      members.currentMember.getMember.mockResolvedValueOnce(null);

      const result = await getReturnByRma('RMA-TEST-1234');
      expect(result.returnRequest).toBeNull();
    });
  });

  describe('getReturnReasons', () => {
    it('returns all valid reasons', () => {
      const result = getReturnReasons();
      expect(result.reasons.length).toBe(8);
    });

    it('each reason has value and label', () => {
      const result = getReturnReasons();
      for (const reason of result.reasons) {
        expect(reason.value).toBeTruthy();
        expect(reason.label).toBeTruthy();
      }
    });

    it('includes common return reasons', () => {
      const result = getReturnReasons();
      const values = result.reasons.map(r => r.value);
      expect(values).toContain('wrong_size');
      expect(values).toContain('defective');
      expect(values).toContain('damaged_in_shipping');
      expect(values).toContain('changed_mind');
    });
  });

  describe('updateReturnStatus', () => {
    beforeEach(() => {
      mockItems.push(existingReturn);
    });

    it('updates status on valid return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce(existingReturn);

      const result = await updateReturnStatus('return-existing', 'shipped', 'Label printed');
      expect(result.success).toBe(true);
      expect(wixData.update).toHaveBeenCalled();
    });

    it('rejects invalid status', async () => {
      const result = await updateReturnStatus('return-existing', 'invalid_status');
      expect(result.success).toBe(false);
    });

    it('rejects invalid return ID', async () => {
      const result = await updateReturnStatus('', 'approved');
      expect(result.success).toBe(false);
    });

    it('rejects non-existent return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce(null);

      const result = await updateReturnStatus('return-nonexistent', 'approved');
      expect(result.success).toBe(false);
    });

    it('saves admin notes when provided', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce({ ...existingReturn });

      await updateReturnStatus('return-existing', 'refunded', 'Refund processed $899');

      const updateCall = wixData.update.mock.calls[0];
      expect(updateCall[1].adminNotes).toBe('Refund processed $899');
      expect(updateCall[1].status).toBe('refunded');
    });
  });
});
