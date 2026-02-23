import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wix-data
const mockItems = [];
let mockTotalCount = 0;
let mockCountResult = 0;

const mockQuery = {
  eq: vi.fn().mockReturnThis(),
  ne: vi.fn().mockReturnThis(),
  ge: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn(async () => ({ items: mockItems, totalCount: mockTotalCount })),
  count: vi.fn(async () => mockCountResult),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQuery })),
    get: vi.fn(async (collection, id) => mockItems.find(i => i._id === id)),
    insert: vi.fn(async (collection, record) => ({ ...record, _id: 'return-new', _createdDate: new Date() })),
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
  validateEmail: (email) => {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
}));

// Mock UPS shipping
vi.mock('backend/ups-shipping.web', () => ({
  createShipment: vi.fn(async () => ({
    success: true,
    trackingNumber: '1Z999AA10123456784',
    labels: [{ trackingNumber: '1Z999AA10123456784', labelBase64: 'base64pdf', labelFormat: 'PDF' }],
    totalCharge: 12.50,
  })),
  trackShipment: vi.fn(async () => ({
    success: true,
    trackingNumber: '1Z999AA10123456784',
    status: 'In Transit',
    statusCode: 'IT',
    estimatedDelivery: '20260305',
    activities: [
      { status: 'In Transit', location: 'Charlotte, NC', date: '20260225', time: '1430' },
      { status: 'Picked Up', location: 'Hendersonville, NC', date: '20260224', time: '0930' },
    ],
  })),
}));

import {
  lookupReturn,
  submitGuestReturn,
  generateReturnLabel,
  trackReturnShipment,
  getAdminReturns,
  getReturnStats,
  processRefund,
} from '../src/backend/returnsService.web.js';

// ── Test Data ─────────────────────────────────────────────────────────

const recentOrder = {
  _id: 'order-001',
  number: '10042',
  _createdDate: new Date(),
  paymentStatus: 'PAID',
  fulfillmentStatus: 'FULFILLED',
  buyerInfo: { id: 'member-001', email: 'jane@example.com' },
  billingInfo: { firstName: 'Jane', lastName: 'Smith' },
  shippingInfo: {
    shipmentDetails: {
      address: {
        addressLine1: '100 Main St',
        city: 'Asheville',
        subdivision: 'NC',
        postalCode: '28801',
      },
    },
  },
  totals: { subtotal: 899, shipping: 99, total: 998 },
  lineItems: [
    { _id: 'li-001', productId: 'prod-001', name: 'Eureka Futon Frame', quantity: 1, price: 899, sku: 'EUR-FRM-001' },
  ],
};

const oldOrder = {
  _id: 'order-old',
  number: '10035',
  _createdDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
  paymentStatus: 'PAID',
  buyerInfo: { id: 'member-001', email: 'jane@example.com' },
  billingInfo: { firstName: 'Jane', lastName: 'Smith' },
  totals: { total: 500 },
  lineItems: [{ _id: 'li-002', name: 'Basic Frame', quantity: 1, price: 500 }],
};

const existingReturn = {
  _id: 'return-001',
  orderId: 'order-001',
  memberId: 'member-001',
  memberEmail: 'jane@example.com',
  memberName: 'Jane Smith',
  rmaNumber: 'RMA-TEST-ABCD',
  orderNumber: '10042',
  type: 'return',
  reason: 'wrong_size',
  reasonLabel: 'Wrong size',
  details: 'Too large.',
  status: 'approved',
  items: JSON.stringify([{ lineItemId: 'li-001', quantity: 1 }]),
  adminNotes: '',
  returnTrackingNumber: null,
  _createdDate: new Date('2026-02-20'),
};

const returnWithTracking = {
  ...existingReturn,
  _id: 'return-tracked',
  rmaNumber: 'RMA-TRACK-1234',
  returnTrackingNumber: '1Z999AA10123456784',
  status: 'shipped',
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('returnsService — extended', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockItems.length = 0;
    mockTotalCount = 0;
    mockCountResult = 0;
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementation(() => ({ ...mockQuery }));
    wixData.get.mockImplementation(async (collection, id) => mockItems.find(i => i._id === id));
  });

  // ── lookupReturn ────────────────────────────────────────────────

  describe('lookupReturn', () => {
    it('finds returns for a valid order + email', async () => {
      const wixData = (await import('wix-data')).default;
      let queryCallCount = 0;
      wixData.query.mockImplementation((collection) => {
        queryCallCount++;
        if (collection === 'Stores/Orders') {
          return { ...mockQuery, find: vi.fn(async () => ({ items: [recentOrder], totalCount: 1 })) };
        }
        if (collection === 'Returns') {
          return { ...mockQuery, find: vi.fn(async () => ({ items: [existingReturn], totalCount: 1 })) };
        }
        return { ...mockQuery };
      });

      const result = await lookupReturn('10042', 'jane@example.com');
      expect(result.success).toBe(true);
      expect(result.returns).toHaveLength(1);
      expect(result.returns[0].rmaNumber).toBe('RMA-TEST-ABCD');
    });

    it('returns order info when no returns exist', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation((collection) => {
        if (collection === 'Stores/Orders') {
          return { ...mockQuery, find: vi.fn(async () => ({ items: [recentOrder], totalCount: 1 })) };
        }
        return { ...mockQuery, find: vi.fn(async () => ({ items: [], totalCount: 0 })) };
      });

      const result = await lookupReturn('10042', 'jane@example.com');
      expect(result.success).toBe(true);
      expect(result.returns).toHaveLength(0);
      expect(result.order).toBeTruthy();
      expect(result.order.number).toBe('10042');
    });

    it('rejects empty order number', async () => {
      const result = await lookupReturn('', 'jane@example.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Order number');
    });

    it('rejects invalid email', async () => {
      const result = await lookupReturn('10042', 'notanemail');
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    it('rejects empty email', async () => {
      const result = await lookupReturn('10042', '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    it('returns error when order not found', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({ items: [], totalCount: 0 })),
      }));

      const result = await lookupReturn('99999', 'jane@example.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects when email does not match buyer', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({ items: [recentOrder], totalCount: 1 })),
      }));

      const result = await lookupReturn('10042', 'wrong@example.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ── submitGuestReturn ───────────────────────────────────────────

  describe('submitGuestReturn', () => {
    beforeEach(async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation((collection) => {
        if (collection === 'Stores/Orders') {
          return { ...mockQuery, find: vi.fn(async () => ({ items: [recentOrder], totalCount: 1 })) };
        }
        // Default: no existing returns
        return { ...mockQuery, find: vi.fn(async () => ({ items: [], totalCount: 0 })) };
      });
    });

    it('submits a valid guest return', async () => {
      const result = await submitGuestReturn({
        orderNumber: '10042',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
        details: 'Too big for the space.',
      });

      expect(result.success).toBe(true);
      expect(result.rmaNumber).toMatch(/^RMA-/);
    });

    it('saves correct record to CMS', async () => {
      const wixData = (await import('wix-data')).default;

      await submitGuestReturn({
        orderNumber: '10042',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'defective',
        type: 'exchange',
      });

      const insertCall = wixData.insert.mock.calls[0];
      expect(insertCall[0]).toBe('Returns');
      const record = insertCall[1];
      expect(record.orderId).toBe('order-001');
      expect(record.orderNumber).toBe('10042');
      expect(record.memberEmail).toBe('jane@example.com');
      expect(record.reason).toBe('defective');
      expect(record.type).toBe('exchange');
      expect(record.status).toBe('requested');
    });

    it('rejects missing order number', async () => {
      const result = await submitGuestReturn({
        orderNumber: '',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Order number');
    });

    it('rejects invalid email', async () => {
      const result = await submitGuestReturn({
        orderNumber: '10042',
        email: 'bad',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    it('rejects invalid reason', async () => {
      const result = await submitGuestReturn({
        orderNumber: '10042',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'invalid_reason',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('valid return reason');
    });

    it('rejects empty items array', async () => {
      const result = await submitGuestReturn({
        orderNumber: '10042',
        email: 'jane@example.com',
        items: [],
        reason: 'wrong_size',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least one item');
    });

    it('rejects when email does not match order', async () => {
      const result = await submitGuestReturn({
        orderNumber: '10042',
        email: 'wrong@example.com',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects order outside return window', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation((collection) => {
        if (collection === 'Stores/Orders') {
          return { ...mockQuery, find: vi.fn(async () => ({ items: [oldOrder], totalCount: 1 })) };
        }
        return { ...mockQuery, find: vi.fn(async () => ({ items: [], totalCount: 0 })) };
      });

      const result = await submitGuestReturn({
        orderNumber: '10035',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-002', quantity: 1 }],
        reason: 'changed_mind',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('30 days');
    });

    it('rejects duplicate return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation((collection) => {
        if (collection === 'Stores/Orders') {
          return { ...mockQuery, find: vi.fn(async () => ({ items: [recentOrder], totalCount: 1 })) };
        }
        return { ...mockQuery, find: vi.fn(async () => ({ items: [existingReturn], totalCount: 1 })) };
      });

      const result = await submitGuestReturn({
        orderNumber: '10042',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('defaults type to return', async () => {
      const wixData = (await import('wix-data')).default;
      await submitGuestReturn({
        orderNumber: '10042',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'wrong_size',
      });

      const record = wixData.insert.mock.calls[0]?.[1];
      expect(record.type).toBe('return');
    });

    it('sanitizes HTML from details', async () => {
      const wixData = (await import('wix-data')).default;
      await submitGuestReturn({
        orderNumber: '10042',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-001', quantity: 1 }],
        reason: 'defective',
        details: '<script>xss</script>Leg broken',
      });

      const record = wixData.insert.mock.calls[0]?.[1];
      expect(record.details).not.toContain('<script>');
      expect(record.details).toContain('Leg broken');
    });
  });

  // ── generateReturnLabel ─────────────────────────────────────────

  describe('generateReturnLabel', () => {
    it('generates a label for approved return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockImplementation(async (collection, id) => {
        if (collection === 'Returns') return { ...existingReturn };
        if (collection === 'Stores/Orders') return recentOrder;
        return null;
      });

      const result = await generateReturnLabel('return-001');
      expect(result.success).toBe(true);
      expect(result.trackingNumber).toBe('1Z999AA10123456784');
      expect(result.labelBase64).toBe('base64pdf');
    });

    it('updates return record with tracking number', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockImplementation(async (collection, id) => {
        if (collection === 'Returns') return { ...existingReturn };
        if (collection === 'Stores/Orders') return recentOrder;
        return null;
      });

      await generateReturnLabel('return-001');

      const updateCall = wixData.update.mock.calls[0];
      expect(updateCall[1].returnTrackingNumber).toBe('1Z999AA10123456784');
    });

    it('rejects invalid return ID', async () => {
      const result = await generateReturnLabel('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('rejects non-existent return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValue(null);

      const result = await generateReturnLabel('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects return not in approved status', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValue({ ...existingReturn, status: 'requested' });

      const result = await generateReturnLabel('return-001');
      expect(result.success).toBe(false);
      expect(result.error).toContain('approved');
    });

    it('handles UPS API failure', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockImplementation(async (collection, id) => {
        if (collection === 'Returns') return { ...existingReturn };
        if (collection === 'Stores/Orders') return recentOrder;
        return null;
      });

      const ups = await import('backend/ups-shipping.web');
      ups.createShipment.mockResolvedValueOnce({ success: false, error: 'UPS unavailable' });

      const result = await generateReturnLabel('return-001');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // ── trackReturnShipment ─────────────────────────────────────────

  describe('trackReturnShipment', () => {
    it('returns tracking info for shipped return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({ items: [returnWithTracking], totalCount: 1 })),
      }));

      const result = await trackReturnShipment('RMA-TRACK-1234');
      expect(result.success).toBe(true);
      expect(result.tracking).toBeTruthy();
      expect(result.tracking.trackingNumber).toBe('1Z999AA10123456784');
      expect(result.tracking.activities).toHaveLength(2);
    });

    it('returns null tracking when no label generated', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({ items: [existingReturn], totalCount: 1 })),
      }));

      const result = await trackReturnShipment('RMA-TEST-ABCD');
      expect(result.success).toBe(true);
      expect(result.tracking).toBeNull();
      expect(result.message).toContain('not been generated');
    });

    it('rejects empty RMA', async () => {
      const result = await trackReturnShipment('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('RMA');
    });

    it('returns error for non-existent RMA', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({ items: [], totalCount: 0 })),
      }));

      const result = await trackReturnShipment('RMA-NONEXISTENT');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('handles UPS tracking failure gracefully', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({ items: [returnWithTracking], totalCount: 1 })),
      }));

      const ups = await import('backend/ups-shipping.web');
      ups.trackShipment.mockResolvedValueOnce({ success: false, error: 'UPS down' });

      const result = await trackReturnShipment('RMA-TRACK-1234');
      expect(result.success).toBe(true);
      expect(result.tracking).toBeNull();
    });
  });

  // ── getAdminReturns ─────────────────────────────────────────────

  describe('getAdminReturns', () => {
    it('returns all returns for admin', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({
          items: [existingReturn, returnWithTracking],
          totalCount: 2,
        })),
      }));

      const result = await getAdminReturns();
      expect(result.success).toBe(true);
      expect(result.returns).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by status', async () => {
      const wixData = (await import('wix-data')).default;
      const eqMock = vi.fn().mockReturnThis();
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        eq: eqMock,
        find: vi.fn(async () => ({
          items: [existingReturn],
          totalCount: 1,
        })),
      }));

      await getAdminReturns({ status: 'approved' });
      expect(eqMock).toHaveBeenCalledWith('status', 'approved');
    });

    it('admin returns include member details', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn(async () => ({
          items: [existingReturn],
          totalCount: 1,
        })),
      }));

      const result = await getAdminReturns();
      const ret = result.returns[0];
      expect(ret.memberEmail).toBe('jane@example.com');
      expect(ret.memberName).toBe('Jane Smith');
      expect(ret.adminNotes).toBeDefined();
    });

    it('caps limit at 100', async () => {
      const wixData = (await import('wix-data')).default;
      const limitMock = vi.fn().mockReturnThis();
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        limit: limitMock,
        find: vi.fn(async () => ({ items: [], totalCount: 0 })),
      }));

      await getAdminReturns({ limit: 500 });
      expect(limitMock).toHaveBeenCalledWith(100);
    });

    it('defaults limit to 50', async () => {
      const wixData = (await import('wix-data')).default;
      const limitMock = vi.fn().mockReturnThis();
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        limit: limitMock,
        find: vi.fn(async () => ({ items: [], totalCount: 0 })),
      }));

      await getAdminReturns();
      expect(limitMock).toHaveBeenCalledWith(50);
    });
  });

  // ── getReturnStats ──────────────────────────────────────────────

  describe('getReturnStats', () => {
    it('returns counts for all statuses', async () => {
      const wixData = (await import('wix-data')).default;
      let countValue = 3;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        count: vi.fn(async () => countValue),
      }));

      const result = await getReturnStats();
      expect(result.success).toBe(true);
      expect(result.stats.requested).toBe(3);
      expect(result.stats.approved).toBe(3);
      expect(result.stats.shipped).toBe(3);
      expect(result.stats.received).toBe(3);
      expect(result.stats.refunded).toBe(3);
      expect(result.stats.denied).toBe(3);
      expect(result.stats.total).toBe(18);
    });

    it('handles count errors gracefully', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        count: vi.fn(async () => { throw new Error('DB error'); }),
      }));

      const result = await getReturnStats();
      expect(result.success).toBe(false);
    });
  });

  // ── processRefund ───────────────────────────────────────────────

  describe('processRefund', () => {
    it('processes refund for a valid return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValue({ ...existingReturn, status: 'received' });

      const result = await processRefund('return-001', 899, 'Full refund');
      expect(result.success).toBe(true);

      const updateCall = wixData.update.mock.calls[0];
      expect(updateCall[1].status).toBe('refunded');
      expect(updateCall[1].refundAmount).toBe(899);
      expect(updateCall[1].adminNotes).toBe('Full refund');
    });

    it('rejects invalid return ID', async () => {
      const result = await processRefund('', 899);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('rejects non-existent return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValue(null);

      const result = await processRefund('nonexistent', 899);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects zero refund amount', async () => {
      const result = await processRefund('return-001', 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('refund amount');
    });

    it('rejects negative refund amount', async () => {
      const result = await processRefund('return-001', -50);
      expect(result.success).toBe(false);
      expect(result.error).toContain('refund amount');
    });

    it('rejects non-number refund amount', async () => {
      const result = await processRefund('return-001', 'not-a-number');
      expect(result.success).toBe(false);
    });

    it('rejects already-refunded return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValue({ ...existingReturn, status: 'refunded' });

      const result = await processRefund('return-001', 899);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
    });

    it('rejects denied return', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValue({ ...existingReturn, status: 'denied' });

      const result = await processRefund('return-001', 899);
      expect(result.success).toBe(false);
      expect(result.error).toContain('denied');
    });
  });
});
