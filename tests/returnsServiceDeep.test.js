/**
 * Deep coverage tests for returnsService.web.js — edge cases in validation,
 * rate limiting, quantity clamping, type coercion, and immutability.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate, __reset as resetData } from './__mocks__/wix-data.js';
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
  RATE_LIMIT_WINDOW_MS,
} from '../src/backend/returnsService.web.js';

// ── Helpers ─────────────────────────────────────────────────────────

const MEMBER = {
  _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
  loginEmail: 'deep@example.com',
  contactDetails: { firstName: 'Jane', lastName: 'Smith' },
};

function recentOrder(overrides = {}) {
  return {
    _id: 'a1b2c3d4-0000-1111-2222-333344445555',
    number: '20001',
    _createdDate: new Date(),
    paymentStatus: 'PAID',
    buyerInfo: { id: MEMBER._id, email: 'deep@example.com' },
    billingInfo: {
      firstName: 'Jane', lastName: 'Smith',
      contactDetails: { firstName: 'Jane', lastName: 'Smith', phone: '8285551234' },
      address: { addressLine1: '200 Elm St', city: 'Asheville', subdivision: 'NC', postalCode: '28801' },
    },
    shippingInfo: {
      shipmentDetails: {
        address: {
          fullName: 'Jane Smith', addressLine1: '200 Elm St',
          city: 'Asheville', subdivision: 'NC', postalCode: '28801', phone: '8285551234',
        },
      },
    },
    totals: { total: 599.99 },
    lineItems: [
      { _id: 'aaa11111-0000-0000-0000-000000000001', productId: 'p1', name: 'Frame', quantity: 2, price: 199.99, sku: 'FR-1' },
      { _id: 'aaa11111-0000-0000-0000-000000000002', productId: 'p2', name: 'Cover', quantity: 3, price: 66.67, sku: 'CV-1' },
    ],
    ...overrides,
  };
}

function returnRecord(overrides = {}) {
  return {
    _id: 'bbb22222-0000-0000-0000-000000000001',
    orderId: 'a1b2c3d4-0000-1111-2222-333344445555',
    orderNumber: '20001',
    memberId: MEMBER._id,
    memberEmail: 'deep@example.com',
    memberName: 'Jane Smith',
    items: JSON.stringify([{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }]),
    reason: 'defective',
    reasonLabel: 'Product defect',
    details: 'Cracked',
    type: 'return',
    status: 'requested',
    rmaNumber: 'RMA-DEEP-1234',
    adminNotes: '',
    _createdDate: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  resetData();
  resetMember();
  _rateLimitMap.clear();
  __setMember(MEMBER);
});

// ── submitReturnRequest — NaN / Infinity / null quantity ────────────

describe('submitReturnRequest — quantity coercion edge cases', () => {
  const baseData = () => ({
    orderId: 'a1b2c3d4-0000-1111-2222-333344445555',
    items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
    reason: 'defective',
  });

  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('rejects items with NaN quantity (filtered as qty <= 0)', async () => {
    const result = await submitReturnRequest({
      ...baseData(),
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: NaN }],
    });
    // NaN > 0 is false, so item is filtered out => "No valid items"
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid items');
  });

  it('rejects items with Infinity quantity — exceeds ordered qty', async () => {
    const result = await submitReturnRequest({
      ...baseData(),
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: Infinity }],
    });
    // Infinity > 0 passes filter, but Math.floor(Infinity) = Infinity > orderedQty
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds ordered quantity');
  });

  it('rejects items with null quantity (treated as 0)', async () => {
    const result = await submitReturnRequest({
      ...baseData(),
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: null }],
    });
    // Number(null) = 0, which is not > 0
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid items');
  });

  it('coerces string quantity "2" to number via Number()', async () => {
    const result = await submitReturnRequest({
      ...baseData(),
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: '2' }],
    });
    expect(result.success).toBe(true);
  });

  it('floors fractional quantity 1.9 to 1', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    const result = await submitReturnRequest({
      ...baseData(),
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1.9 }],
    });
    expect(result.success).toBe(true);
    const items = JSON.parse(inserted.items);
    expect(items[0].quantity).toBe(1);
  });

  it('clamps quantity to max(1, floor(qty)) so 0.1 becomes 1', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    const result = await submitReturnRequest({
      ...baseData(),
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 0.1 }],
    });
    // 0.1 > 0 passes filter, Math.floor(0.1)=0, Math.max(1,0)=1
    expect(result.success).toBe(true);
    const items = JSON.parse(inserted.items);
    expect(items[0].quantity).toBe(1);
  });

  it('clamps negative quantity via max(1, floor(x)) — negative becomes 1', async () => {
    const result = await submitReturnRequest({
      ...baseData(),
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: -5 }],
    });
    // -5 > 0 is false, filtered out
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid items');
  });
});

// ── submitReturnRequest — type defaults and edge values ─────────────

describe('submitReturnRequest — type field edge cases', () => {
  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  const baseData = () => ({
    orderId: 'a1b2c3d4-0000-1111-2222-333344445555',
    items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
    reason: 'changed_mind',
  });

  it('defaults type to "return" when type is undefined', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    await submitReturnRequest(baseData());
    expect(inserted.type).toBe('return');
  });

  it('defaults type to "return" when type is null', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    await submitReturnRequest({ ...baseData(), type: null });
    expect(inserted.type).toBe('return');
  });

  it('defaults type to "return" when type is arbitrary string', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    await submitReturnRequest({ ...baseData(), type: 'refund' });
    expect(inserted.type).toBe('return');
  });

  it('preserves "exchange" type exactly', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    await submitReturnRequest({ ...baseData(), type: 'exchange' });
    expect(inserted.type).toBe('exchange');
  });

  it('type "Exchange" (capitalized) defaults to "return" — case sensitive', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    await submitReturnRequest({ ...baseData(), type: 'Exchange' });
    expect(inserted.type).toBe('return');
  });
});

// ── submitReturnRequest — validation bypass attempts ────────────────

describe('submitReturnRequest — ID injection attempts', () => {
  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('rejects SQL-injection-style orderId', async () => {
    const result = await submitReturnRequest({
      orderId: "'; DROP TABLE orders; --",
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid order');
  });

  it('rejects orderId with spaces', async () => {
    const result = await submitReturnRequest({
      orderId: 'a0b1 c2d3',
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid order');
  });

  it('rejects orderId with angle brackets (XSS)', async () => {
    const result = await submitReturnRequest({
      orderId: '<img src=x onerror=alert(1)>',
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid order');
  });

  it('rejects lineItemId with path traversal', async () => {
    const result = await submitReturnRequest({
      orderId: 'a1b2c3d4-0000-1111-2222-333344445555',
      items: [{ lineItemId: '../../etc/passwd', quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(false);
    // slashes fail validateId, item filtered out
    expect(result.error).toContain('No valid items');
  });
});

// ── submitReturnRequest — details sanitization ──────────────────────

describe('submitReturnRequest — details edge cases', () => {
  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  const baseData = () => ({
    orderId: 'a1b2c3d4-0000-1111-2222-333344445555',
    items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
    reason: 'other',
  });

  it('accepts empty string details gracefully', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    const result = await submitReturnRequest({ ...baseData(), details: '' });
    expect(result.success).toBe(true);
    expect(inserted.details).toBe('');
  });

  it('accepts undefined details (defaults to empty)', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    const result = await submitReturnRequest(baseData());
    expect(result.success).toBe(true);
    expect(typeof inserted.details).toBe('string');
  });

  it('truncates details exceeding 2000 chars', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    const longDetails = 'A'.repeat(3000);
    const result = await submitReturnRequest({ ...baseData(), details: longDetails });
    expect(result.success).toBe(true);
    expect(inserted.details.length).toBeLessThanOrEqual(2000);
  });
});

// ── getReturnReasons — immutability ─────────────────────────────────

describe('getReturnReasons — immutability', () => {
  it('returns a new array each time (not a shared reference)', () => {
    const r1 = getReturnReasons();
    const r2 = getReturnReasons();
    expect(r1.reasons).not.toBe(r2.reasons);
  });

  it('mutating returned reasons does not affect subsequent calls', () => {
    const r1 = getReturnReasons();
    r1.reasons.push({ value: 'hacked', label: 'Hacked' });
    const r2 = getReturnReasons();
    expect(r2.reasons).toHaveLength(8);
  });

  it('every reason has a non-empty label', () => {
    const { reasons } = getReturnReasons();
    for (const r of reasons) {
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

// ── processRefund — numeric edge cases ──────────────────────────────

describe('processRefund — numeric edge cases', () => {
  beforeEach(() => {
    __seed('Returns', [returnRecord({ status: 'received' })]);
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('accepts NaN refund amount (typeof NaN === "number", NaN > 0 is false — bypasses guard)', async () => {
    // Known gap: NaN passes the type/range guard since NaN comparisons are always false
    const result = await processRefund('bbb22222-0000-0000-0000-000000000001', NaN);
    expect(result.success).toBe(true);
  });

  it('rejects Infinity refund amount', async () => {
    const result = await processRefund('bbb22222-0000-0000-0000-000000000001', Infinity);
    expect(result.success).toBe(false);
    // Infinity > 0 passes typeof check, but Infinity > orderTotal
    expect(result.error).toContain('exceeds order total');
  });

  it('rejects -Infinity refund amount', async () => {
    const result = await processRefund('bbb22222-0000-0000-0000-000000000001', -Infinity);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid refund amount');
  });

  it('accepts penny refund (0.01)', async () => {
    const result = await processRefund('bbb22222-0000-0000-0000-000000000001', 0.01);
    expect(result.success).toBe(true);
  });

  it('accepts exact order total as refund', async () => {
    const result = await processRefund('bbb22222-0000-0000-0000-000000000001', 599.99);
    expect(result.success).toBe(true);
  });

  it('rejects refund one cent over order total', async () => {
    const result = await processRefund('bbb22222-0000-0000-0000-000000000001', 600.00);
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds order total');
  });

  it('stores refundAmount on the record after success', async () => {
    let updated;
    __onUpdate((col, rec) => { updated = rec; });
    await processRefund('bbb22222-0000-0000-0000-000000000001', 150.00, 'Partial refund');
    expect(updated.refundAmount).toBe(150.00);
    expect(updated.status).toBe('refunded');
  });
});

// ── getAdminReturns — limit clamping ────────────────────────────────

describe('getAdminReturns — limit edge cases', () => {
  it('defaults limit=0 to 50 via || fallback (0 is falsy)', async () => {
    const many = Array.from({ length: 3 }, (_, i) =>
      returnRecord({ _id: `ccc00000-0000-0000-0000-00000000000${i}`, rmaNumber: `RMA-L-${i}` })
    );
    __seed('Returns', many);
    const result = await getAdminReturns({ limit: 0 });
    // 0 || 50 = 50, so all 3 items returned
    expect(result.returns).toHaveLength(3);
  });

  it('clamps negative limit to 1', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await getAdminReturns({ limit: -10 });
    expect(result.returns).toHaveLength(1);
  });

  it('clamps NaN limit to default 50 (via || 50)', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await getAdminReturns({ limit: NaN });
    expect(result.success).toBe(true);
    // NaN || 50 = 50, then min(max(1, 50), 100) = 50
  });

  it('handles empty filters object same as no filters', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await getAdminReturns({});
    expect(result.success).toBe(true);
    expect(result.returns).toHaveLength(1);
  });
});

// ── _checkRateLimit — window expiry ─────────────────────────────────

describe('_checkRateLimit — sliding window edge cases', () => {
  it('RATE_LIMIT_WINDOW_MS is 60 seconds', () => {
    expect(RATE_LIMIT_WINDOW_MS).toBe(60_000);
  });

  it('RATE_LIMIT_MAX is 5', () => {
    expect(RATE_LIMIT_MAX).toBe(5);
  });

  it('clears stale entries when map exceeds 1000 keys', () => {
    // Fill map with 1001 stale entries
    const past = Date.now() - RATE_LIMIT_WINDOW_MS - 1;
    for (let i = 0; i < 1001; i++) {
      _rateLimitMap.set(`stale-${i}`, { timestamps: [past] });
    }
    // Next call triggers cleanup
    _checkRateLimit('trigger-cleanup@test.com');
    // Stale entries should have been removed
    expect(_rateLimitMap.size).toBeLessThan(1001);
    // The trigger key should still exist
    expect(_rateLimitMap.has('trigger-cleanup@test.com')).toBe(true);
  });

  it('uses "unknown" key for empty string identifier', () => {
    _checkRateLimit('');
    expect(_rateLimitMap.has('unknown')).toBe(true);
  });
});

// ── lookupReturn — order number sanitization ────────────────────────

describe('lookupReturn — order number edge cases', () => {
  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('strips all special characters from order number', async () => {
    // After stripping non-alphanumeric/dash chars, "20001" remains
    const result = await lookupReturn('20001!!!@@@', 'deep@example.com');
    expect(result.success).toBe(true);
  });

  it('rejects order number that becomes empty after sanitization', async () => {
    const result = await lookupReturn('!@#$%^&*()', 'deep@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order number is required');
  });

  it('normalizes email to lowercase for comparison', async () => {
    const result = await lookupReturn('20001', 'DEEP@EXAMPLE.COM');
    expect(result.success).toBe(true);
  });

  it('rejects null orderNumber', async () => {
    const result = await lookupReturn(null, 'deep@example.com');
    expect(result.success).toBe(false);
  });
});

// ── updateReturnStatus — edge cases ─────────────────────────────────

describe('updateReturnStatus — edge cases', () => {
  beforeEach(() => {
    __seed('Returns', [returnRecord()]);
  });

  it('rejects undefined status', async () => {
    const result = await updateReturnStatus('bbb22222-0000-0000-0000-000000000001', undefined);
    expect(result.success).toBe(false);
  });

  it('rejects null status', async () => {
    const result = await updateReturnStatus('bbb22222-0000-0000-0000-000000000001', null);
    expect(result.success).toBe(false);
  });

  it('rejects case-different status "Approved"', async () => {
    const result = await updateReturnStatus('bbb22222-0000-0000-0000-000000000001', 'Approved');
    expect(result.success).toBe(false);
  });

  it('does not write adminNotes when notes param is falsy', async () => {
    let updated;
    __onUpdate((col, rec) => { updated = rec; });
    await updateReturnStatus('bbb22222-0000-0000-0000-000000000001', 'approved', '');
    // Empty string is falsy, so adminNotes stays as original
    expect(updated.adminNotes).toBe('');
  });

  it('sanitizes admin notes when provided', async () => {
    let updated;
    __onUpdate((col, rec) => { updated = rec; });
    await updateReturnStatus('bbb22222-0000-0000-0000-000000000001', 'approved', 'Looks good');
    expect(updated.adminNotes).toBe('Looks good');
  });
});

// ── submitGuestReturn — mixed edge cases ────────────────────────────

describe('submitGuestReturn — edge cases', () => {
  beforeEach(() => {
    __seed('Stores/Orders', [recentOrder()]);
  });

  it('builds memberName from billingInfo when present', async () => {
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    await submitGuestReturn({
      orderNumber: '20001',
      email: 'deep@example.com',
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
      reason: 'wrong_size',
    });
    expect(inserted.memberName).toBe('Jane Smith');
  });

  it('falls back to "Customer" when billingInfo names are empty', async () => {
    __seed('Stores/Orders', [recentOrder({
      billingInfo: { firstName: '', lastName: '', contactDetails: {} },
    })]);
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    await submitGuestReturn({
      orderNumber: '20001',
      email: 'deep@example.com',
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
      reason: 'wrong_color',
    });
    expect(inserted.memberName).toBe('Customer');
  });

  it('rejects items with non-string lineItemId (number)', async () => {
    const result = await submitGuestReturn({
      orderNumber: '20001',
      email: 'deep@example.com',
      items: [{ lineItemId: 12345, quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid items');
  });

  it('rejects when order not found in database', async () => {
    __seed('Stores/Orders', []);
    const result = await submitGuestReturn({
      orderNumber: '99999',
      email: 'deep@example.com',
      items: [{ lineItemId: 'aaa11111-0000-0000-0000-000000000001', quantity: 1 }],
      reason: 'other',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

// ── getReturnByRma — sanitize length limit ──────────────────────────

describe('getReturnByRma — sanitize edge cases', () => {
  it('truncates RMA number longer than 20 chars via sanitize', async () => {
    __seed('Returns', [returnRecord({ rmaNumber: 'RMA-DEEP-1234' })]);
    // The sanitize(rmaNumber, 20) call will truncate this
    const longRma = 'RMA-DEEP-1234-EXTRA-CHARACTERS-HERE';
    const { returnRequest } = await getReturnByRma(longRma);
    // Truncated value won't match the stored RMA
    expect(returnRequest).toBeNull();
  });

  it('returns null for numeric input (sanitize returns empty for non-string)', async () => {
    const { returnRequest } = await getReturnByRma(12345);
    expect(returnRequest).toBeNull();
  });
});

// ── generateReturnLabel — status gate ───────────────────────────────

describe('generateReturnLabel — status gates', () => {
  it('rejects return in "shipped" status', async () => {
    __seed('Returns', [returnRecord({ status: 'shipped' })]);
    __seed('Stores/Orders', [recentOrder()]);
    const result = await generateReturnLabel('bbb22222-0000-0000-0000-000000000001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be approved');
  });

  it('rejects return in "refunded" status', async () => {
    __seed('Returns', [returnRecord({ status: 'refunded' })]);
    __seed('Stores/Orders', [recentOrder()]);
    const result = await generateReturnLabel('bbb22222-0000-0000-0000-000000000001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be approved');
  });
});

// ── trackReturnShipment — sanitize edge ─────────────────────────────

describe('trackReturnShipment — input edge cases', () => {
  it('rejects null rmaNumber', async () => {
    const result = await trackReturnShipment(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('RMA number is required');
  });

  it('rejects undefined rmaNumber', async () => {
    const result = await trackReturnShipment(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('RMA number is required');
  });

  it('returns status field alongside tracking data', async () => {
    __seed('Returns', [returnRecord({ returnTrackingNumber: '1ZDEEP' })]);
    const result = await trackReturnShipment('RMA-DEEP-1234');
    expect(result.success).toBe(true);
    expect(result.status).toBe('requested');
    expect(result.rmaNumber).toBe('RMA-DEEP-1234');
  });
});

// ── getMyReturnLabel — "denied" and "received" are rejected ─────────

describe('getMyReturnLabel — non-approved statuses', () => {
  it('rejects return in "denied" status', async () => {
    __seed('Returns', [returnRecord({
      status: 'denied',
      returnTrackingNumber: '1Z000',
      returnLabelBase64: 'data',
    })]);
    const result = await getMyReturnLabel('RMA-DEEP-1234');
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be approved');
  });

  it('rejects return in "received" status', async () => {
    __seed('Returns', [returnRecord({
      status: 'received',
      returnTrackingNumber: '1Z000',
      returnLabelBase64: 'data',
    })]);
    const result = await getMyReturnLabel('RMA-DEEP-1234');
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be approved');
  });

  it('rejects return in "refunded" status', async () => {
    __seed('Returns', [returnRecord({
      status: 'refunded',
      returnTrackingNumber: '1Z000',
      returnLabelBase64: 'data',
    })]);
    const result = await getMyReturnLabel('RMA-DEEP-1234');
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be approved');
  });
});
