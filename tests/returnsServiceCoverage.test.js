/**
 * returnsServiceCoverage.test.js — CF-672y
 * Fills remaining coverage gaps in returnsService backend module.
 * Focuses on: catch blocks, format helpers, address fallbacks, buildMemberName edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wixData, { __seed, __reset as resetData, __onInsert } from 'wix-data';
import { __setMember, __reset as resetMembers } from 'wix-members-backend';

vi.mock('backend/ups-shipping.web', () => ({
  createShipment: vi.fn(async () => ({
    success: true,
    trackingNumber: '1Z999AA10123456784',
    labels: [{ trackingNumber: '1Z999AA10123456784', labelBase64: 'base64data', labelFormat: 'PDF' }],
  })),
  trackShipment: vi.fn(async () => ({
    success: true,
    trackingNumber: '1Z999AA10123456784',
    status: 'In Transit',
    statusCode: 'IT',
    estimatedDelivery: '20260305',
    activities: [],
  })),
}));

import {
  getReturnEligibleOrders,
  submitReturnRequest,
  getMyReturns,
  getReturnByRma,
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

const MEMBER = {
  _id: 'member-cov',
  loginEmail: 'cov@example.com',
  contactDetails: { firstName: 'Cov', lastName: 'Test' },
};

function recentOrder(overrides = {}) {
  return {
    _id: 'order-cov',
    number: '30001',
    _createdDate: new Date(),
    paymentStatus: 'PAID',
    buyerInfo: { id: 'member-cov', email: 'cov@example.com' },
    billingInfo: {
      firstName: 'Cov', lastName: 'Test',
      contactDetails: { firstName: 'Cov', lastName: 'Test', phone: '5551234' },
      address: { addressLine1: '1 Test Ave', city: 'Asheville', subdivision: 'NC', postalCode: '28801' },
    },
    shippingInfo: {
      shipmentDetails: {
        address: {
          fullName: 'Cov Test', addressLine1: '1 Test Ave',
          city: 'Asheville', subdivision: 'NC', postalCode: '28801', phone: '5551234',
        },
      },
    },
    totals: { total: 499.99 },
    lineItems: [
      { _id: 'li-cov-1', productId: 'p1', name: 'Frame', quantity: 2, price: 249.99, sku: 'FR-1' },
    ],
    ...overrides,
  };
}

function returnRecord(overrides = {}) {
  return {
    _id: 'return-cov',
    orderId: 'order-cov',
    orderNumber: '30001',
    memberId: 'member-cov',
    memberEmail: 'cov@example.com',
    memberName: 'Cov Test',
    items: JSON.stringify([{ lineItemId: 'li-cov-1', quantity: 1 }]),
    reason: 'defective',
    reasonLabel: 'Product defect',
    details: 'Broken',
    type: 'return',
    status: 'requested',
    rmaNumber: 'RMA-COV-ABCD',
    adminNotes: '',
    _createdDate: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  resetData();
  resetMembers();
});

describe('returnsService — error catch paths', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  beforeEach(() => {
    _rateLimitMap.clear();
    __setMember(MEMBER);
  });

  it('getReturnEligibleOrders returns error on DB failure', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getReturnEligibleOrders();
    expect(result.orders).toEqual([]);
    expect(result.error).toContain('Unable to load');
  });

  it('submitReturnRequest returns error on DB insert failure', async () => {
    __seed('Stores/Orders', [recentOrder()]);
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(new Error('DB down'));
    const result = await submitReturnRequest({
      orderId: 'order-cov',
      items: [{ lineItemId: 'li-cov-1', quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to submit');
  });

  it('getMyReturns returns [] on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getMyReturns();
    expect(result.returns).toEqual([]);
  });

  it('getReturnByRma returns null on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getReturnByRma('RMA-COV-ABCD');
    expect(result.returnRequest).toBeNull();
  });

  it('updateReturnStatus returns false on DB error', async () => {
    __seed('Returns', [returnRecord()]);
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('DB down'));
    const result = await updateReturnStatus('return-cov', 'approved');
    expect(result.success).toBe(false);
  });

  it('lookupReturn returns error on DB failure', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await lookupReturn('30001', 'cov@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to look up');
  });

  it('submitGuestReturn returns error on DB failure', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await submitGuestReturn({
      orderNumber: '30001',
      email: 'cov@example.com',
      items: [{ lineItemId: 'li-cov-1', quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to submit');
  });

  it('generateReturnLabel returns error on DB failure', async () => {
    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB down'));
    const result = await generateReturnLabel('return-cov');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to generate');
  });

  it('getMyReturnLabel returns error on DB failure', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getMyReturnLabel('RMA-COV-ABCD');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to retrieve');
  });

  it('trackReturnShipment returns error on DB failure', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await trackReturnShipment('RMA-COV-ABCD');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to track');
  });

  it('getAdminReturns returns failure on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getAdminReturns();
    expect(result.success).toBe(false);
    expect(result.returns).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('getReturnStats returns failure on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getReturnStats();
    expect(result.success).toBe(false);
    expect(result.stats).toEqual({});
  });

  it('processRefund returns error on DB failure', async () => {
    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB down'));
    const result = await processRefund('return-cov', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to process');
  });
});

describe('returnsService — formatReturn & formatAdminReturn edge paths', () => {
  beforeEach(() => {
    __setMember(MEMBER);
    _rateLimitMap.clear();
  });

  it('formatReturn handles missing _createdDate gracefully', async () => {
    __seed('Returns', [returnRecord({ _createdDate: null })]);
    const { returns } = await getMyReturns();
    expect(returns).toHaveLength(1);
    expect(returns[0].date).toBe('');
  });

  it('formatReturn handles missing items (null) gracefully', async () => {
    __seed('Returns', [returnRecord({ items: null })]);
    const { returns } = await getMyReturns();
    expect(returns).toHaveLength(1);
    expect(returns[0].items).toEqual([]);
  });

  it('formatReturn handles malformed JSON items gracefully', async () => {
    __seed('Returns', [returnRecord({ items: 'not-json{{' })]);
    const { returns } = await getMyReturns();
    expect(returns).toHaveLength(1);
    expect(returns[0].items).toEqual([]);
  });

  it('formatReturn shows returnTrackingNumber when present', async () => {
    __seed('Returns', [returnRecord({ returnTrackingNumber: '1ZTRACK123' })]);
    const { returns } = await getMyReturns();
    expect(returns[0].returnTrackingNumber).toBe('1ZTRACK123');
  });

  it('formatReturn shows null returnTrackingNumber when missing', async () => {
    __seed('Returns', [returnRecord()]);
    const { returns } = await getMyReturns();
    expect(returns[0].returnTrackingNumber).toBeNull();
  });

  it('formatAdminReturn includes all expected fields', async () => {
    __seed('Returns', [returnRecord({
      refundAmount: 199.99,
      adminNotes: 'Approved quickly',
      returnTrackingNumber: '1ZTRACK',
    })]);
    const result = await getAdminReturns();
    const r = result.returns[0];
    expect(r).toHaveProperty('orderId');
    expect(r).toHaveProperty('memberId');
    expect(r).toHaveProperty('memberEmail');
    expect(r).toHaveProperty('memberName');
    expect(r).toHaveProperty('adminNotes', 'Approved quickly');
    expect(r).toHaveProperty('refundAmount', 199.99);
    expect(r).toHaveProperty('returnTrackingNumber', '1ZTRACK');
  });

  it('formatAdminReturn defaults refundAmount to null', async () => {
    __seed('Returns', [returnRecord()]);
    const result = await getAdminReturns();
    expect(result.returns[0].refundAmount).toBeNull();
  });

  it('formatOrderForReturn handles missing lineItem fields', async () => {
    __seed('Stores/Orders', [recentOrder({
      lineItems: [
        { productId: 'p1', name: 'Frame', quantity: 1, price: 100 },
      ],
    })]);
    const { orders } = await getReturnEligibleOrders();
    expect(orders).toHaveLength(1);
    const li = orders[0].lineItems[0];
    expect(li.sku).toBe('');
    expect(li.image).toBe('');
  });

  it('formatOrderForReturn handles missing totals', async () => {
    __seed('Stores/Orders', [recentOrder({ totals: undefined })]);
    const { orders } = await getReturnEligibleOrders();
    expect(orders[0].total).toBe(0);
  });
});

describe('returnsService — generateReturnLabel address fallbacks', () => {
  beforeEach(() => {
    __setMember(MEMBER);
    _rateLimitMap.clear();
  });

  it('uses billing address when shipping address is missing', async () => {
    __seed('Returns', [returnRecord({ status: 'approved' })]);
    __seed('Stores/Orders', [recentOrder({
      shippingInfo: { shipmentDetails: { address: {} } },
    })]);
    const result = await generateReturnLabel('return-cov');
    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBeTruthy();
  });

  it('uses contactDetails for customer name when fullName is missing', async () => {
    __seed('Returns', [returnRecord({ status: 'approved' })]);
    __seed('Stores/Orders', [recentOrder({
      shippingInfo: { shipmentDetails: { address: {} } },
    })]);
    const result = await generateReturnLabel('return-cov');
    expect(result.success).toBe(true);
  });
});

describe('returnsService — buildMemberName edge cases', () => {
  it('builds "Customer" when member has no contactDetails', async () => {
    __setMember({ _id: 'member-no-contact', loginEmail: 'no@example.com' });
    __seed('Stores/Orders', [recentOrder({ buyerInfo: { id: 'member-no-contact' } })]);
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    const result = await submitReturnRequest({
      orderId: 'order-cov',
      items: [{ lineItemId: 'li-cov-1', quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(true);
    expect(inserted.memberName).toBe('Customer');
  });

  it('builds first name only when no last name', async () => {
    __setMember({ _id: 'member-first', loginEmail: 'first@example.com', contactDetails: { firstName: 'Bob' } });
    __seed('Stores/Orders', [recentOrder({ buyerInfo: { id: 'member-first' } })]);
    let inserted;
    __onInsert((col, rec) => { inserted = rec; });
    const result = await submitReturnRequest({
      orderId: 'order-cov',
      items: [{ lineItemId: 'li-cov-1', quantity: 1 }],
      reason: 'changed_mind',
    });
    expect(result.success).toBe(true);
    expect(inserted.memberName).toBe('Bob');
  });
});
