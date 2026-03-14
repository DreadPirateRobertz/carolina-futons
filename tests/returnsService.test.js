import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';

vi.mock('backend/ups-shipping.web', () => ({
  createShipment: vi.fn(async () => ({
    success: true,
    trackingNumber: '1Z999AA10123456784',
    labels: [{ trackingNumber: '1Z999AA10123456784', labelBase64: 'base64labeldata', labelFormat: 'PDF' }],
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
  _checkRateLimit,
  RATE_LIMIT_MAX,
} from '../src/backend/returnsService.web.js';

// ── Test Data ──────────────────────────────────────────────────────

const MEMBER = {
  _id: 'member-1',
  loginEmail: 'test@example.com',
  contactDetails: { firstName: 'John', lastName: 'Doe' },
};

function recentOrder(overrides = {}) {
  return {
    _id: 'order-1',
    number: '10042',
    _createdDate: new Date(),
    paymentStatus: 'PAID',
    buyerInfo: { id: 'member-1', email: 'test@example.com' },
    billingInfo: {
      firstName: 'John',
      lastName: 'Doe',
      contactDetails: { firstName: 'John', lastName: 'Doe', phone: '8285551234' },
      address: { addressLine1: '100 Main St', city: 'Charlotte', subdivision: 'NC', postalCode: '28202' },
    },
    shippingInfo: {
      shipmentDetails: {
        address: {
          fullName: 'John Doe',
          addressLine1: '100 Main St',
          city: 'Charlotte',
          subdivision: 'NC',
          postalCode: '28202',
          phone: '8285551234',
        },
      },
    },
    totals: { total: 499.99 },
    lineItems: [
      { _id: 'li-1', productId: 'prod-1', name: 'Futon Frame', quantity: 1, price: 299.99, sku: 'FF-001' },
      { _id: 'li-2', productId: 'prod-2', name: 'Futon Mattress', quantity: 2, price: 100.00, sku: 'FM-001' },
    ],
    ...overrides,
  };
}

function oldOrder(overrides = {}) {
  const old = new Date();
  old.setDate(old.getDate() - 45);
  return recentOrder({ _id: 'order-old', _createdDate: old, number: '10001', ...overrides });
}

function returnRecord(overrides = {}) {
  return {
    _id: 'return-1',
    orderId: 'order-1',
    orderNumber: '10042',
    memberId: 'member-1',
    memberEmail: 'test@example.com',
    memberName: 'John Doe',
    items: JSON.stringify([{ lineItemId: 'li-1', quantity: 1 }]),
    reason: 'defective',
    reasonLabel: 'Product defect',
    details: 'Broken leg',
    type: 'return',
    status: 'requested',
    rmaNumber: 'RMA-TEST-ABCD',
    adminNotes: '',
    _createdDate: new Date().toISOString(),
    ...overrides,
  };
}

// ── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
  resetMember();
  _rateLimitMap.clear();
  __setMember(MEMBER);
});

// ── getReturnReasons ───────────────────────────────────────────────

describe('getReturnReasons', () => {
  it('returns all 8 valid reasons with value and label', () => {
    const { reasons } = getReturnReasons();
    expect(reasons).toHaveLength(8);
    reasons.forEach(r => {
      expect(r).toHaveProperty('value');
      expect(r).toHaveProperty('label');
      expect(typeof r.value).toBe('string');
      expect(typeof r.label).toBe('string');
    });
  });

  it('includes expected reason values', () => {
    const { reasons } = getReturnReasons();
    const values = reasons.map(r => r.value);
    expect(values).toContain('defective');
    expect(values).toContain('wrong_size');
    expect(values).toContain('changed_mind');
    expect(values).toContain('other');
  });
});

// ── getReturnEligibleOrders ────────────────────────────────────────

describe('getReturnEligibleOrders', () => {
  it('returns recent paid orders for the current member', async () => {
    __seed('Stores/Orders', [recentOrder()]);
    const { orders } = await getReturnEligibleOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]._id).toBe('order-1');
    expect(orders[0]).toHaveProperty('number');
    expect(orders[0]).toHaveProperty('lineItems');
  });

  it('excludes orders outside the 30-day return window', async () => {
    __seed('Stores/Orders', [oldOrder()]);
    const { orders } = await getReturnEligibleOrders();
    expect(orders).toHaveLength(0);
  });

  it('excludes orders that already have a return request', async () => {
    __seed('Stores/Orders', [recentOrder()]);
    __seed('Returns', [returnRecord()]);
    const { orders } = await getReturnEligibleOrders();
    expect(orders).toHaveLength(0);
  });

  it('returns empty array when no member is logged in', async () => {
    __setMember(null);
    const { orders } = await getReturnEligibleOrders();
    expect(orders).toEqual([]);
  });

  it('formats order with expected fields', async () => {
    __seed('Stores/Orders', [recentOrder()]);
    const { orders } = await getReturnEligibleOrders();
    const o = orders[0];
    expect(o).toHaveProperty('_id');
    expect(o).toHaveProperty('number');
    expect(o).toHaveProperty('date');
    expect(o).toHaveProperty('total');
    expect(o).toHaveProperty('lineItems');
    expect(o.lineItems[0]).toHaveProperty('name');
    expect(o.lineItems[0]).toHaveProperty('quantity');
  });
});

// ── submitReturnRequest ────────────────────────────────────────────

describe('submitReturnRequest', () => {
  const validData = {
    orderId: 'order-1',
    items: [{ lineItemId: 'li-1', quantity: 1 }],
    reason: 'defective',
    details: 'Broken leg on frame',
  };

  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('creates a return request and returns an RMA number', async () => {
    const result = await submitReturnRequest(validData);
    expect(result.success).toBe(true);
    expect(result.rmaNumber).toMatch(/^RMA-/);
  });

  it('rejects when not logged in', async () => {
    __setMember(null);
    const result = await submitReturnRequest(validData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('log in');
  });

  it('rejects invalid orderId', async () => {
    const result = await submitReturnRequest({ ...validData, orderId: '<script>' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid order');
  });

  it('rejects invalid reason', async () => {
    const result = await submitReturnRequest({ ...validData, reason: 'bored' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('valid return reason');
  });

  it('rejects empty items array', async () => {
    const result = await submitReturnRequest({ ...validData, items: [] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least one item');
  });

  it('rejects non-array items', async () => {
    const result = await submitReturnRequest({ ...validData, items: 'not-an-array' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least one item');
  });

  it('rejects when order does not belong to current member', async () => {
    __seed('Stores/Orders', [recentOrder({ buyerInfo: { id: 'other-member' } })]);
    const result = await submitReturnRequest(validData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order not found');
  });

  it('rejects orders outside the return window', async () => {
    __seed('Stores/Orders', [oldOrder({ _id: 'order-1', buyerInfo: { id: 'member-1' } })]);
    const result = await submitReturnRequest(validData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('30 days');
  });

  it('rejects duplicate return requests', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await submitReturnRequest(validData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('rejects items with invalid lineItemId', async () => {
    const result = await submitReturnRequest({
      ...validData,
      items: [{ lineItemId: '<bad>', quantity: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid items');
  });

  it('rejects when return quantity exceeds ordered quantity', async () => {
    const result = await submitReturnRequest({
      ...validData,
      items: [{ lineItemId: 'li-1', quantity: 5 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds ordered quantity');
  });

  it('defaults type to "return" when not exchange', async () => {
    const result = await submitReturnRequest(validData);
    expect(result.success).toBe(true);
  });

  it('accepts type "exchange"', async () => {
    const result = await submitReturnRequest({ ...validData, type: 'exchange' });
    expect(result.success).toBe(true);
  });

  it('sanitizes details field', async () => {
    const result = await submitReturnRequest({
      ...validData,
      details: '<script>alert("xss")</script>Broken',
    });
    expect(result.success).toBe(true);
  });
});

// ── getMyReturns ───────────────────────────────────────────────────

describe('getMyReturns', () => {
  it('returns formatted return records for the current member', async () => {
    __seed('Returns', [returnRecord()]);
    const { returns } = await getMyReturns();
    expect(returns).toHaveLength(1);
    expect(returns[0].rmaNumber).toBe('RMA-TEST-ABCD');
    expect(returns[0]).toHaveProperty('status');
    expect(returns[0]).toHaveProperty('reason');
    expect(returns[0]).toHaveProperty('items');
  });

  it('returns empty array when not logged in', async () => {
    __setMember(null);
    const { returns } = await getMyReturns();
    expect(returns).toEqual([]);
  });

  it('does not return other members returns', async () => {
    __seed('Returns', [returnRecord({ memberId: 'other-member' })]);
    const { returns } = await getMyReturns();
    expect(returns).toHaveLength(0);
  });
});

// ── getReturnByRma ─────────────────────────────────────────────────

describe('getReturnByRma', () => {
  it('returns the return record matching the RMA', async () => {
    __seed('Returns', [returnRecord()]);
    const { returnRequest } = await getReturnByRma('RMA-TEST-ABCD');
    expect(returnRequest).not.toBeNull();
    expect(returnRequest.rmaNumber).toBe('RMA-TEST-ABCD');
  });

  it('returns null for non-existent RMA', async () => {
    const { returnRequest } = await getReturnByRma('RMA-NOPE');
    expect(returnRequest).toBeNull();
  });

  it('returns null for empty RMA', async () => {
    const { returnRequest } = await getReturnByRma('');
    expect(returnRequest).toBeNull();
  });

  it('returns null when not logged in', async () => {
    __setMember(null);
    __seed('Returns', [returnRecord()]);
    const { returnRequest } = await getReturnByRma('RMA-TEST-ABCD');
    expect(returnRequest).toBeNull();
  });

  it('does not return another members return', async () => {
    __seed('Returns', [returnRecord({ memberId: 'other-member' })]);
    const { returnRequest } = await getReturnByRma('RMA-TEST-ABCD');
    expect(returnRequest).toBeNull();
  });
});

// ── updateReturnStatus ─────────────────────────────────────────────

describe('updateReturnStatus', () => {
  beforeEach(() => {
    __seed('Returns', [returnRecord()]);
  });

  it('updates status to approved', async () => {
    const result = await updateReturnStatus('return-1', 'approved');
    expect(result.success).toBe(true);
  });

  it('updates status with admin notes', async () => {
    const result = await updateReturnStatus('return-1', 'denied', 'Not eligible');
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', async () => {
    const result = await updateReturnStatus('return-1', 'invalid-status');
    expect(result.success).toBe(false);
  });

  it('rejects invalid return ID', async () => {
    const result = await updateReturnStatus('<bad>', 'approved');
    expect(result.success).toBe(false);
  });

  it('rejects non-existent return', async () => {
    const result = await updateReturnStatus('nonexistent-id', 'approved');
    expect(result.success).toBe(false);
  });

  it('accepts all valid statuses', async () => {
    const statuses = ['requested', 'approved', 'shipped', 'received', 'refunded', 'denied'];
    for (const status of statuses) {
      __seed('Returns', [returnRecord()]);
      const result = await updateReturnStatus('return-1', status);
      expect(result.success).toBe(true);
    }
  });
});

// ── lookupReturn ───────────────────────────────────────────────────

describe('lookupReturn', () => {
  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('finds returns for a valid order number + email', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await lookupReturn('10042', 'test@example.com');
    expect(result.success).toBe(true);
    expect(result.returns).toHaveLength(1);
    expect(result.order).toHaveProperty('_id', 'order-1');
  });

  it('returns empty returns array when order has no returns', async () => {
    const result = await lookupReturn('10042', 'test@example.com');
    expect(result.success).toBe(true);
    expect(result.returns).toEqual([]);
    expect(result.order).toBeDefined();
  });

  it('rejects missing order number', async () => {
    const result = await lookupReturn('', 'test@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order number is required');
  });

  it('rejects missing email', async () => {
    const result = await lookupReturn('10042', '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects invalid email format', async () => {
    const result = await lookupReturn('10042', 'not-an-email');
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('returns generic error for non-existent order (prevents enumeration)', async () => {
    const result = await lookupReturn('99999', 'test@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order not found');
  });

  it('returns generic error for email mismatch (prevents enumeration)', async () => {
    const result = await lookupReturn('10042', 'wrong@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order not found');
  });

  it('rate limits after max attempts', async () => {
    const email = 'ratelimit-lookup@example.com';
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      _checkRateLimit(email);
    }
    const result = await lookupReturn('10042', email);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many attempts');
  });

  it('strips special characters from order number', async () => {
    const result = await lookupReturn('10042!@#$', 'test@example.com');
    expect(result.success).toBe(true);
  });
});

// ── submitGuestReturn ──────────────────────────────────────────────

describe('submitGuestReturn', () => {
  const validGuestData = {
    orderNumber: '10042',
    email: 'test@example.com',
    items: [{ lineItemId: 'li-1', quantity: 1 }],
    reason: 'damaged_in_shipping',
    details: 'Box was crushed',
  };

  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('submits a guest return and returns an RMA number', async () => {
    const result = await submitGuestReturn(validGuestData);
    expect(result.success).toBe(true);
    expect(result.rmaNumber).toMatch(/^RMA-/);
  });

  it('rejects missing order number', async () => {
    const result = await submitGuestReturn({ ...validGuestData, orderNumber: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order number is required');
  });

  it('rejects missing email', async () => {
    const result = await submitGuestReturn({ ...validGuestData, email: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects invalid email', async () => {
    const result = await submitGuestReturn({ ...validGuestData, email: 'bad' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects invalid reason', async () => {
    const result = await submitGuestReturn({ ...validGuestData, reason: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('valid return reason');
  });

  it('rejects empty items array', async () => {
    const result = await submitGuestReturn({ ...validGuestData, items: [] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least one item');
  });

  it('rejects when order not found', async () => {
    const result = await submitGuestReturn({ ...validGuestData, orderNumber: '99999' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order not found');
  });

  it('rejects when email does not match order', async () => {
    const result = await submitGuestReturn({ ...validGuestData, email: 'wrong@example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order not found');
  });

  it('rejects orders outside the return window', async () => {
    __seed('Stores/Orders', [oldOrder({ buyerInfo: { id: 'member-1', email: 'test@example.com' } })]);
    const result = await submitGuestReturn({ ...validGuestData, orderNumber: '10001' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('30 days');
  });

  it('rejects duplicate guest return', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await submitGuestReturn(validGuestData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('rejects invalid line item IDs', async () => {
    const result = await submitGuestReturn({
      ...validGuestData,
      items: [{ lineItemId: '!@#$', quantity: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid items');
  });

  it('rejects when return quantity exceeds ordered quantity', async () => {
    const result = await submitGuestReturn({
      ...validGuestData,
      items: [{ lineItemId: 'li-1', quantity: 10 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds ordered quantity');
  });

  it('accepts type "exchange"', async () => {
    const result = await submitGuestReturn({ ...validGuestData, type: 'exchange' });
    expect(result.success).toBe(true);
  });

  it('rate limits after max attempts', async () => {
    const email = 'ratelimit-guest@example.com';
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      _checkRateLimit(email);
    }
    const result = await submitGuestReturn({ ...validGuestData, email });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many attempts');
  });
});

// ── generateReturnLabel ────────────────────────────────────────────

describe('generateReturnLabel', () => {
  it('generates a return label for an approved return', async () => {
    __seed('Returns', [returnRecord({ status: 'approved' })]);
    __seed('Stores/Orders', [recentOrder()]);
    const result = await generateReturnLabel('return-1');
    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('1Z999AA10123456784');
    expect(result.labelBase64).toBe('base64labeldata');
  });

  it('rejects invalid return ID', async () => {
    const result = await generateReturnLabel('<bad>');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid return ID');
  });

  it('rejects non-existent return', async () => {
    const result = await generateReturnLabel('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Return not found');
  });

  it('rejects return that is not approved', async () => {
    __seed('Returns', [returnRecord({ status: 'requested' })]);
    const result = await generateReturnLabel('return-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be approved');
  });

  it('rejects when original order is not found', async () => {
    __seed('Returns', [returnRecord({ status: 'approved' })]);
    const result = await generateReturnLabel('return-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Original order not found');
  });

  it('handles UPS shipment creation failure', async () => {
    __seed('Returns', [returnRecord({ status: 'approved' })]);
    __seed('Stores/Orders', [recentOrder()]);
    const ups = await import('backend/ups-shipping.web');
    ups.createShipment.mockResolvedValueOnce({ success: false, error: 'UPS down' });
    const result = await generateReturnLabel('return-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('UPS down');
  });
});

// ── getMyReturnLabel ───────────────────────────────────────────────

describe('getMyReturnLabel', () => {
  it('returns label data for an approved return with label', async () => {
    __seed('Returns', [returnRecord({
      status: 'approved',
      returnTrackingNumber: '1ZTRACK',
      returnLabelBase64: 'labeldata',
    })]);
    const result = await getMyReturnLabel('RMA-TEST-ABCD');
    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('1ZTRACK');
    expect(result.labelBase64).toBe('labeldata');
  });

  it('rejects when not logged in', async () => {
    __setMember(null);
    const result = await getMyReturnLabel('RMA-TEST-ABCD');
    expect(result.success).toBe(false);
    expect(result.error).toContain('log in');
  });

  it('rejects empty RMA number', async () => {
    const result = await getMyReturnLabel('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('RMA number is required');
  });

  it('rejects non-existent return', async () => {
    const result = await getMyReturnLabel('RMA-NOPE');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Return not found');
  });

  it('rejects return not in approved/shipped status', async () => {
    __seed('Returns', [returnRecord({ status: 'requested' })]);
    const result = await getMyReturnLabel('RMA-TEST-ABCD');
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be approved');
  });

  it('allows shipped status', async () => {
    __seed('Returns', [returnRecord({
      status: 'shipped',
      returnTrackingNumber: '1ZTRACK',
      returnLabelBase64: 'labeldata',
    })]);
    const result = await getMyReturnLabel('RMA-TEST-ABCD');
    expect(result.success).toBe(true);
  });

  it('rejects when label has not been generated', async () => {
    __seed('Returns', [returnRecord({ status: 'approved' })]);
    const result = await getMyReturnLabel('RMA-TEST-ABCD');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not yet been generated');
  });
});

// ── trackReturnShipment ────────────────────────────────────────────

describe('trackReturnShipment', () => {
  it('tracks a return shipment with tracking number', async () => {
    __seed('Returns', [returnRecord({ returnTrackingNumber: '1ZTRACK' })]);
    const result = await trackReturnShipment('RMA-TEST-ABCD');
    expect(result.success).toBe(true);
    expect(result.tracking).not.toBeNull();
    expect(result.tracking.trackingNumber).toBe('1ZTRACK');
  });

  it('rejects empty RMA number', async () => {
    const result = await trackReturnShipment('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('RMA number is required');
  });

  it('rejects non-existent return', async () => {
    const result = await trackReturnShipment('RMA-NOPE');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Return not found');
  });

  it('returns null tracking when no tracking number exists', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await trackReturnShipment('RMA-TEST-ABCD');
    expect(result.success).toBe(true);
    expect(result.tracking).toBeNull();
    expect(result.message).toContain('not been generated');
  });

  it('returns null tracking when UPS tracking fails', async () => {
    __seed('Returns', [returnRecord({ returnTrackingNumber: '1ZTRACK' })]);
    const ups = await import('backend/ups-shipping.web');
    ups.trackShipment.mockResolvedValueOnce({ success: false });
    const result = await trackReturnShipment('RMA-TEST-ABCD');
    expect(result.success).toBe(true);
    expect(result.tracking).toBeNull();
  });
});

// ── getAdminReturns ────────────────────────────────────────────────

describe('getAdminReturns', () => {
  it('returns all return records', async () => {
    __seed('Returns', [returnRecord(), returnRecord({ _id: 'return-2', rmaNumber: 'RMA-2' })]);
    const result = await getAdminReturns();
    expect(result.success).toBe(true);
    expect(result.returns).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('filters by status', async () => {
    __seed('Returns', [
      returnRecord({ status: 'requested' }),
      returnRecord({ _id: 'return-2', status: 'approved', rmaNumber: 'RMA-2' }),
    ]);
    const result = await getAdminReturns({ status: 'approved' });
    expect(result.success).toBe(true);
    expect(result.returns).toHaveLength(1);
    expect(result.returns[0].status).toBe('approved');
  });

  it('respects limit parameter', async () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      returnRecord({ _id: `return-${i}`, rmaNumber: `RMA-${i}` })
    );
    __seed('Returns', many);
    const result = await getAdminReturns({ limit: 2 });
    expect(result.returns).toHaveLength(2);
  });

  it('caps limit at 100', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await getAdminReturns({ limit: 500 });
    expect(result.success).toBe(true);
  });

  it('returns empty array with no data', async () => {
    const result = await getAdminReturns();
    expect(result.success).toBe(true);
    expect(result.returns).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('formats admin return with expected fields', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await getAdminReturns();
    const r = result.returns[0];
    expect(r).toHaveProperty('_id');
    expect(r).toHaveProperty('rmaNumber');
    expect(r).toHaveProperty('memberEmail');
    expect(r).toHaveProperty('memberName');
    expect(r).toHaveProperty('adminNotes');
    expect(r).toHaveProperty('status');
  });
});

// ── getReturnStats ─────────────────────────────────────────────────

describe('getReturnStats', () => {
  it('returns counts for each status', async () => {
    __seed('Returns', [
      returnRecord({ status: 'requested' }),
      returnRecord({ _id: 'r2', status: 'requested', rmaNumber: 'RMA-2' }),
      returnRecord({ _id: 'r3', status: 'approved', rmaNumber: 'RMA-3' }),
    ]);
    const result = await getReturnStats();
    expect(result.success).toBe(true);
    expect(result.stats.requested).toBe(2);
    expect(result.stats.approved).toBe(1);
    expect(result.stats.denied).toBe(0);
    expect(result.stats.total).toBe(3);
  });

  it('returns all zeroes when no returns exist', async () => {
    const result = await getReturnStats();
    expect(result.success).toBe(true);
    expect(result.stats.total).toBe(0);
    expect(result.stats.requested).toBe(0);
  });
});

// ── processRefund ──────────────────────────────────────────────────

describe('processRefund', () => {
  beforeEach(() => {
    __seed('Returns', [returnRecord({ status: 'received' })]);
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('processes a valid refund', async () => {
    const result = await processRefund('return-1', 299.99, 'Refund for frame');
    expect(result.success).toBe(true);
  });

  it('rejects invalid return ID', async () => {
    const result = await processRefund('<bad>', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid return ID');
  });

  it('rejects non-number refund amount', async () => {
    const result = await processRefund('return-1', 'fifty');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid refund amount');
  });

  it('rejects zero refund amount', async () => {
    const result = await processRefund('return-1', 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid refund amount');
  });

  it('rejects negative refund amount', async () => {
    const result = await processRefund('return-1', -50);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid refund amount');
  });

  it('rejects non-existent return', async () => {
    const result = await processRefund('nonexistent', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Return not found');
  });

  it('rejects already-refunded return', async () => {
    __seed('Returns', [returnRecord({ status: 'refunded' })]);
    const result = await processRefund('return-1', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already processed');
  });

  it('rejects denied return', async () => {
    __seed('Returns', [returnRecord({ status: 'denied' })]);
    const result = await processRefund('return-1', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('denied');
  });

  it('rejects refund exceeding order total', async () => {
    const result = await processRefund('return-1', 1000.00);
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds order total');
  });

  it('rejects when original order not found', async () => {
    resetData();
    __seed('Returns', [returnRecord({ status: 'received' })]);
    const result = await processRefund('return-1', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Original order not found');
  });
});

// ── _checkRateLimit ────────────────────────────────────────────────

describe('_checkRateLimit', () => {
  it('allows requests under the limit', () => {
    expect(_checkRateLimit('user@test.com')).toBe(true);
    expect(_checkRateLimit('user@test.com')).toBe(true);
  });

  it('blocks after max attempts', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      _checkRateLimit('flood@test.com');
    }
    expect(_checkRateLimit('flood@test.com')).toBe(false);
  });

  it('tracks separate identifiers independently', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      _checkRateLimit('a@test.com');
    }
    expect(_checkRateLimit('a@test.com')).toBe(false);
    expect(_checkRateLimit('b@test.com')).toBe(true);
  });

  it('uses "unknown" key for falsy identifier', () => {
    expect(_checkRateLimit(null)).toBe(true);
    expect(_checkRateLimit(undefined)).toBe(true);
    expect(_checkRateLimit('')).toBe(true);
  });

  it('getReturnReasons is a pure function independent of DB state', async () => {
    const result = getReturnReasons();
    expect(result).toBeTruthy();
    expect(result.reasons).toBeInstanceOf(Array);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
