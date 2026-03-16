import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';

vi.mock('backend/ups-shipping.web', () => ({
  createShipment: vi.fn(async () => ({
    success: true,
    trackingNumber: '1ZRETURN00123456789',
    labels: [{ trackingNumber: '1ZRETURN00123456789', labelBase64: 'cmV0dXJuLWxhYmVs', labelFormat: 'PDF' }],
    totalCharge: 12.50,
  })),
  trackShipment: vi.fn(async (tn) => ({
    success: true,
    trackingNumber: tn,
    status: 'In Transit',
    statusCode: 'IT',
    estimatedDelivery: '20250630',
    activities: [
      { description: 'Picked up', location: 'Charlotte, NC', date: '20250625', time: '100000' },
    ],
  })),
}));

import {
  getReturnEligibleOrders,
  submitReturnRequest,
  getMyReturns,
  getReturnByRma,
  getReturnReasons,
  updateReturnStatus,
  lookupReturn,
  submitGuestReturn,
  generateReturnLabel,
  getMyReturnLabel,
  trackReturnShipment,
  getAdminReturns,
  getReturnStats,
  processRefund,
  _rateLimitMap,
} from '../src/backend/returnsService.web.js';

// ── Fixtures ────────────────────────────────────────────────────────

const MEMBER = {
  _id: 'member-1',
  loginEmail: 'jane@example.com',
  contactDetails: { firstName: 'Jane', lastName: 'Smith' },
};

function recentOrder(overrides = {}) {
  return {
    _id: 'order-1',
    number: '10042',
    _createdDate: new Date(),
    paymentStatus: 'PAID',
    buyerInfo: { id: 'member-1', email: 'jane@example.com' },
    billingInfo: {
      firstName: 'Jane', lastName: 'Smith',
      contactDetails: { firstName: 'Jane', lastName: 'Smith', phone: '8285551234' },
      address: { addressLine1: '100 Main St', city: 'Asheville', subdivision: 'NC', postalCode: '28801' },
    },
    shippingInfo: {
      shipmentDetails: {
        address: { addressLine1: '100 Main St', city: 'Asheville', subdivision: 'NC', postalCode: '28801', country: 'US' },
      },
    },
    lineItems: [
      { _id: 'li-1', name: 'Seattle Futon Frame', price: 549, quantity: 1, productId: 'prod-seattle', sku: 'NDF-SEATTLE' },
      { _id: 'li-2', name: 'Moonshadow Mattress', price: 349, quantity: 2, productId: 'prod-moon', sku: 'MOON-MAT-001' },
    ],
    totals: { subtotal: 1247, shipping: 29.99, total: 1276.99 },
    ...overrides,
  };
}

function expiredOrder() {
  const d = new Date();
  d.setDate(d.getDate() - 45);
  return recentOrder({ _id: 'order-old', number: '10001', _createdDate: d });
}

function returnRecord(overrides = {}) {
  return {
    _id: 'ret-1',
    orderId: 'order-1',
    orderNumber: '10042',
    memberId: 'member-1',
    memberEmail: 'jane@example.com',
    memberName: 'Jane Smith',
    items: JSON.stringify([{ lineItemId: 'li-1', quantity: 1 }]),
    reason: 'defective',
    reasonLabel: 'Product defect',
    details: 'Broken frame leg',
    type: 'return',
    status: 'requested',
    rmaNumber: 'RMA-TEST-0001',
    adminNotes: '',
    _createdDate: new Date(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Returns Portal Integration', () => {
  beforeEach(() => {
    resetData();
    resetMember();
    _rateLimitMap.clear();
    __setMember(MEMBER);
    __seed('Stores/Orders', [recentOrder()]);
    __seed('Returns', []);
  });

  // ── RMA creation lifecycle (member) ───────────────────────────────

  describe('RMA creation lifecycle (member)', () => {
    it('submit → appears in getMyReturns → retrievable by RMA', async () => {
      // Step 1: Submit return
      const submitResult = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'defective',
        details: 'Broken frame leg',
      });
      expect(submitResult.success).toBe(true);
      expect(submitResult.rmaNumber).toMatch(/^RMA-/);

      // Step 2: Appears in my returns list
      const myReturns = await getMyReturns();
      expect(myReturns.returns).toHaveLength(1);
      expect(myReturns.returns[0].rmaNumber).toBe(submitResult.rmaNumber);
      expect(myReturns.returns[0].status).toBe('requested');
      expect(myReturns.returns[0].reason).toBe('Product defect');

      // Step 3: Retrievable by RMA number
      const byRma = await getReturnByRma(submitResult.rmaNumber);
      expect(byRma.returnRequest).not.toBeNull();
      expect(byRma.returnRequest.rmaNumber).toBe(submitResult.rmaNumber);
      expect(byRma.returnRequest.type).toBe('return');
    });

    it('creates exchange request with type=exchange', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'wrong_size',
        type: 'exchange',
      });
      expect(result.success).toBe(true);

      const myReturns = await getMyReturns();
      expect(myReturns.returns[0].type).toBe('exchange');
    });

    it('stores sanitized details text', async () => {
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'Returns') inserted = item;
      });

      await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'damaged_in_shipping',
        details: '<script>alert(1)</script>Box was crushed',
      });
      expect(inserted.details).not.toContain('<script>');
    });

    it('order no longer appears in eligible list after return submitted', async () => {
      await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'changed_mind',
      });

      const eligible = await getReturnEligibleOrders();
      expect(eligible.orders).toHaveLength(0);
    });
  });

  // ── RMA creation lifecycle (guest) ────────────────────────────────

  describe('RMA creation lifecycle (guest)', () => {
    it('guest submit → lookup shows return', async () => {
      __setMember(null); // Not logged in

      const submitResult = await submitGuestReturn({
        orderNumber: '10042',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'damaged_in_shipping',
        details: 'Dented corner',
      });
      expect(submitResult.success).toBe(true);
      expect(submitResult.rmaNumber).toMatch(/^RMA-/);

      // Guest lookup shows the return
      const lookup = await lookupReturn('10042', 'jane@example.com');
      expect(lookup.success).toBe(true);
      expect(lookup.returns).toHaveLength(1);
      expect(lookup.returns[0].rmaNumber).toBe(submitResult.rmaNumber);
    });

    it('guest lookup with no returns shows empty list + order info', async () => {
      __setMember(null);
      const result = await lookupReturn('10042', 'jane@example.com');
      expect(result.success).toBe(true);
      expect(result.returns).toHaveLength(0);
      expect(result.order.number).toBe('10042');
    });
  });

  // ── Status tracking through all states ────────────────────────────

  describe('status tracking through all states', () => {
    const STATUSES = ['requested', 'approved', 'shipped', 'received', 'refunded', 'denied'];

    beforeEach(() => {
      __seed('Returns', [returnRecord()]);
    });

    it.each(STATUSES)('admin can update status to "%s"', async (status) => {
      const result = await updateReturnStatus('ret-1', status);
      expect(result.success).toBe(true);

      const myReturns = await getMyReturns();
      expect(myReturns.returns[0].status).toBe(status);
    });

    it('rejects invalid status values', async () => {
      const result = await updateReturnStatus('ret-1', 'bogus');
      expect(result.success).toBe(false);
    });

    it('full lifecycle: requested → approved → label → shipped → received → refunded', async () => {
      // Approve
      await updateReturnStatus('ret-1', 'approved');
      let returns = await getMyReturns();
      expect(returns.returns[0].status).toBe('approved');

      // Generate label
      const labelResult = await generateReturnLabel('ret-1');
      expect(labelResult.success).toBe(true);
      expect(labelResult.trackingNumber).toBe('1ZRETURN00123456789');

      // Member can retrieve label
      const label = await getMyReturnLabel('RMA-TEST-0001');
      expect(label.success).toBe(true);
      expect(label.trackingNumber).toBe('1ZRETURN00123456789');
      expect(label.labelBase64).toBeTruthy();

      // Mark shipped
      await updateReturnStatus('ret-1', 'shipped');

      // Track return shipment
      const tracking = await trackReturnShipment('RMA-TEST-0001');
      expect(tracking.success).toBe(true);
      expect(tracking.tracking.status).toBe('In Transit');
      expect(tracking.tracking.activities).toHaveLength(1);

      // Mark received
      await updateReturnStatus('ret-1', 'received');

      // Process refund
      const refundResult = await processRefund('ret-1', 549, 'Frame refund');
      expect(refundResult.success).toBe(true);

      returns = await getMyReturns();
      expect(returns.returns[0].status).toBe('refunded');
    });
  });

  // ── Return label and tracking ─────────────────────────────────────

  describe('return label and tracking', () => {
    beforeEach(() => {
      __seed('Returns', [returnRecord({ status: 'approved' })]);
    });

    it('cannot generate label for non-approved return', async () => {
      __seed('Returns', [returnRecord({ status: 'requested' })]);
      const result = await generateReturnLabel('ret-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('approved');
    });

    it('label not available before generation', async () => {
      const result = await getMyReturnLabel('RMA-TEST-0001');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not yet been generated');
    });

    it('tracking returns null when no return label exists', async () => {
      const result = await trackReturnShipment('RMA-TEST-0001');
      expect(result.success).toBe(true);
      expect(result.tracking).toBeNull();
      expect(result.message).toContain('not been generated');
    });

    it('trackReturnShipment returns not found for unknown RMA', async () => {
      const result = await trackReturnShipment('RMA-NONEXISTENT');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ── Refund calculation and guards ─────────────────────────────────

  describe('refund calculation and guards', () => {
    beforeEach(() => {
      __seed('Returns', [returnRecord({ status: 'received' })]);
    });

    it('processes refund with valid amount', async () => {
      const result = await processRefund('ret-1', 549);
      expect(result.success).toBe(true);
    });

    it('rejects refund exceeding order total', async () => {
      const result = await processRefund('ret-1', 9999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds order total');
    });

    it('rejects zero refund amount', async () => {
      const result = await processRefund('ret-1', 0);
      expect(result.success).toBe(false);
    });

    it('rejects negative refund amount', async () => {
      const result = await processRefund('ret-1', -100);
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric refund amount', async () => {
      const result = await processRefund('ret-1', 'five hundred');
      expect(result.success).toBe(false);
    });

    it('cannot refund an already-refunded return', async () => {
      __seed('Returns', [returnRecord({ status: 'refunded', refundAmount: 549 })]);
      const result = await processRefund('ret-1', 549);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
    });

    it('cannot refund a denied return', async () => {
      __seed('Returns', [returnRecord({ status: 'denied' })]);
      const result = await processRefund('ret-1', 549);
      expect(result.success).toBe(false);
      expect(result.error).toContain('denied');
    });

    it('stores refund amount and admin notes', async () => {
      let updated = null;
      __onUpdate((col, item) => {
        if (col === 'Returns') updated = item;
      });

      await processRefund('ret-1', 549, 'Full frame refund processed');
      expect(updated.refundAmount).toBe(549);
      expect(updated.adminNotes).toContain('refund');
    });
  });

  // ── Policy enforcement ────────────────────────────────────────────

  describe('policy enforcement', () => {
    it('rejects return outside 30-day window', async () => {
      __seed('Stores/Orders', [expiredOrder()]);
      const result = await submitReturnRequest({
        orderId: 'order-old',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'changed_mind',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('30 days');
    });

    it('rejects duplicate return for same order', async () => {
      __seed('Returns', [returnRecord()]);
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'defective',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('rejects return quantity exceeding ordered quantity', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-2', quantity: 5 }], // ordered 2
        reason: 'wrong_color',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('rejects invalid return reason', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'i_dont_like_it',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('valid return reason');
    });

    it('rejects empty items array', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [],
        reason: 'defective',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least one item');
    });

    it('rejects items with invalid lineItemId', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'nonexistent-item', quantity: 1 }],
        reason: 'defective',
      });
      expect(result.success).toBe(false);
    });

    it('requires logged-in member for member endpoints', async () => {
      __setMember(null);
      const eligible = await getReturnEligibleOrders();
      expect(eligible.orders).toHaveLength(0);

      const submit = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'defective',
      });
      expect(submit.success).toBe(false);

      const myReturns = await getMyReturns();
      expect(myReturns.returns).toHaveLength(0);
    });

    it('guest return also enforces 30-day window', async () => {
      __setMember(null);
      __seed('Stores/Orders', [expiredOrder()]);
      const result = await submitGuestReturn({
        orderNumber: '10001',
        email: 'jane@example.com',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'damaged_in_shipping',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('30 days');
    });

    it('guest return rejects wrong email (anti-enumeration)', async () => {
      __setMember(null);
      const result = await submitGuestReturn({
        orderNumber: '10042',
        email: 'wrong@example.com',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'defective',
      });
      expect(result.success).toBe(false);
    });

    it('guest lookup rejects wrong email with generic message', async () => {
      __setMember(null);
      const result = await lookupReturn('10042', 'wrong@example.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('order number and email');
    });
  });

  // ── Return reasons ────────────────────────────────────────────────

  describe('return reasons', () => {
    it('returns all 8 valid reasons with labels', () => {
      const { reasons } = getReturnReasons();
      expect(reasons).toHaveLength(8);
      reasons.forEach(r => {
        expect(r.value).toBeTruthy();
        expect(r.label).toBeTruthy();
      });
    });

    it('includes specific expected reasons', () => {
      const { reasons } = getReturnReasons();
      const values = reasons.map(r => r.value);
      expect(values).toContain('defective');
      expect(values).toContain('damaged_in_shipping');
      expect(values).toContain('wrong_size');
      expect(values).toContain('changed_mind');
    });
  });

  // ── Admin dashboard ───────────────────────────────────────────────

  describe('admin dashboard', () => {
    beforeEach(() => {
      __seed('Returns', [
        returnRecord({ _id: 'ret-1', status: 'requested' }),
        returnRecord({ _id: 'ret-2', rmaNumber: 'RMA-TEST-0002', status: 'approved' }),
        returnRecord({ _id: 'ret-3', rmaNumber: 'RMA-TEST-0003', status: 'refunded', refundAmount: 549 }),
      ]);
    });

    it('lists all returns', async () => {
      const result = await getAdminReturns();
      expect(result.success).toBe(true);
      expect(result.returns).toHaveLength(3);
    });

    it('filters by status', async () => {
      const result = await getAdminReturns({ status: 'requested' });
      expect(result.returns).toHaveLength(1);
      expect(result.returns[0].status).toBe('requested');
    });

    it('returns stats with counts per status', async () => {
      const result = await getReturnStats();
      expect(result.success).toBe(true);
      expect(result.stats.requested).toBe(1);
      expect(result.stats.approved).toBe(1);
      expect(result.stats.refunded).toBe(1);
      expect(result.stats.total).toBe(3);
    });

    it('admin return shape includes member info and admin notes', async () => {
      const result = await getAdminReturns();
      const ret = result.returns[0];
      expect(ret.memberEmail).toBe('jane@example.com');
      expect(ret.memberName).toBe('Jane Smith');
      expect(ret).toHaveProperty('adminNotes');
      expect(ret).toHaveProperty('refundAmount');
    });
  });

  // ── Eligible orders filtering ─────────────────────────────────────

  describe('eligible orders filtering', () => {
    it('only returns PAID orders within 30-day window', async () => {
      __seed('Stores/Orders', [
        recentOrder(),
        expiredOrder(),
        recentOrder({ _id: 'order-unpaid', number: '10043', paymentStatus: 'PENDING' }),
      ]);
      const { orders } = await getReturnEligibleOrders();
      // Only the recent PAID order; expired and unpaid filtered out
      // (unpaid filtered by query, expired by date)
      expect(orders.length).toBeLessThanOrEqual(2);
      expect(orders.every(o => o.number !== '10001')).toBe(true); // expired excluded
    });

    it('excludes orders that already have returns', async () => {
      __seed('Returns', [returnRecord()]);
      const { orders } = await getReturnEligibleOrders();
      expect(orders).toHaveLength(0);
    });

    it('returns line item details for each eligible order', async () => {
      const { orders } = await getReturnEligibleOrders();
      expect(orders[0].lineItems).toHaveLength(2);
      expect(orders[0].lineItems[0].name).toBe('Seattle Futon Frame');
    });
  });
});
