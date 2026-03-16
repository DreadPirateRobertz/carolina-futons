/**
 * orderLifecycleCoverage.test.js — CF-672y
 * Fills remaining coverage gaps in deliveryScheduling, cartRecovery,
 * reviewsService, and returnsService backend modules.
 * Focuses on: catch blocks, internal helper edge paths, error-throwing mocks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import wixData, { __seed, __reset as resetData, __onInsert, __onUpdate } from 'wix-data';
import { __setMember, __reset as resetMembers } from 'wix-members-backend';

// ═══════════════════════════════════════════════════════════════════════
// deliveryScheduling — catch blocks & timingSafeEqual edge
// ═══════════════════════════════════════════════════════════════════════

import {
  getAvailableDeliverySlots,
  scheduleDelivery,
  getMyDeliverySchedule,
  getAvailableAppointmentSlots,
  bookAppointment,
  cancelAppointment,
  getUpcomingAppointments,
} from '../src/backend/deliveryScheduling.web.js';

function nextDay(weekday, offsetWeeks = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const diff = ((weekday - d.getDay()) + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return d.toISOString().split('T')[0];
}
const futureWed = () => nextDay(3);

beforeEach(() => {
  resetData();
  resetMembers();
});

describe('deliveryScheduling — error catch paths', () => {
  it('getAvailableDeliverySlots returns [] on query error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getAvailableDeliverySlots('standard');
    expect(result).toEqual([]);
    vi.restoreAllMocks();
  });

  it('scheduleDelivery returns failure on unexpected error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await scheduleDelivery({
      orderId: 'o1', date: futureWed(), timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to schedule');
    vi.restoreAllMocks();
  });

  it('getMyDeliverySchedule returns [] on error', async () => {
    __setMember({ _id: 'm1', loginEmail: 'a@b.com' });
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getMyDeliverySchedule();
    expect(result).toEqual([]);
    vi.restoreAllMocks();
  });

  it('getAvailableAppointmentSlots returns [] on error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getAvailableAppointmentSlots('browse');
    expect(result).toEqual([]);
    vi.restoreAllMocks();
  });

  it('bookAppointment returns failure on unexpected error', async () => {
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(new Error('DB down'));
    const result = await bookAppointment({
      date: futureWed(),
      timeSlot: '10:00',
      visitType: 'browse',
      customerName: 'Test User',
      customerEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to book');
    vi.restoreAllMocks();
  });

  it('cancelAppointment returns failure on unexpected error', async () => {
    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB down'));
    const result = await cancelAppointment('apt-1', 'validtoken12345678901234');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to cancel');
    vi.restoreAllMocks();
  });

  it('getUpcomingAppointments returns [] on error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getUpcomingAppointments();
    expect(result).toEqual([]);
    vi.restoreAllMocks();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// cartRecovery — catch blocks, parseLineItems non-array, event error
// ═══════════════════════════════════════════════════════════════════════

import {
  getAbandonedCartStats,
  getRecoverableCarts,
  markRecoveryEmailSent,
  wixEcom_onAbandonedCheckoutCreated,
  wixEcom_onAbandonedCheckoutRecovered,
} from '../src/backend/cartRecovery.web.js';

describe('cartRecovery — error catch paths', () => {
  it('getAbandonedCartStats returns zeros on query error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getAbandonedCartStats();
    expect(result.totalAbandoned).toBe(0);
    expect(result.totalRecovered).toBe(0);
    expect(result.recoveryRate).toBe(0);
    expect(result.recentCarts).toEqual([]);
    vi.restoreAllMocks();
  });

  it('getRecoverableCarts returns [] on query error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getRecoverableCarts();
    expect(result).toEqual([]);
    vi.restoreAllMocks();
  });

  it('markRecoveryEmailSent returns failure on get error', async () => {
    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB down'));
    const result = await markRecoveryEmailSent('some-id');
    expect(result.success).toBe(false);
    vi.restoreAllMocks();
  });

  it('parseLineItems returns [] for non-array non-string input (number)', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-num',
      checkoutId: 'ck-num',
      buyerEmail: 'num@test.com',
      buyerName: 'Num',
      cartTotal: 100,
      lineItems: 42,
      abandonedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);
    const result = await getRecoverableCarts();
    expect(result).toHaveLength(1);
    expect(result[0].lineItems).toEqual([]);
  });

  it('parseLineItems validates item structure', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-struct',
      checkoutId: 'ck-struct',
      buyerEmail: 'struct@test.com',
      buyerName: 'Struct',
      cartTotal: 100,
      lineItems: JSON.stringify([
        { productId: 'p1', name: 'Valid', quantity: 1, price: 100 },
        null,
        42,
        'string-item',
        { productId: 'p2', name: 'Also Valid', quantity: 2, price: 50 },
      ]),
      abandonedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);
    const result = await getRecoverableCarts();
    expect(result).toHaveLength(1);
    // null, 42, and 'string-item' filtered out (not objects)
    expect(result[0].lineItems.length).toBe(2);
    expect(result[0].lineItems[0].name).toBe('Valid');
    expect(result[0].lineItems[1].name).toBe('Also Valid');
  });

  it('onAbandonedCheckoutCreated handles missing buyerInfo gracefully', async () => {
    __seed('AbandonedCarts', []);
    let insertedItem = null;
    __onInsert((col, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-nobuyerinfo',
        // No buyerInfo, no payNow
        lineItems: [],
      },
    });
    await new Promise(r => setTimeout(r, 50));
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.buyerEmail).toBe('');
    expect(insertedItem.buyerName).toBe('');
    expect(insertedItem.cartTotal).toBe(0);
  });

  it('onAbandonedCheckoutCreated uses event directly when no entity wrapper', async () => {
    __seed('AbandonedCarts', []);
    let insertedItem = null;
    __onInsert((col, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      _id: 'ck-direct-event',
      buyerInfo: { email: 'direct@test.com', firstName: 'Direct' },
      payNow: { total: { amount: 250 } },
      lineItems: [],
    });
    await new Promise(r => setTimeout(r, 50));
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.buyerEmail).toContain('direct');
  });

  it('onAbandonedCheckoutRecovered does nothing for empty checkoutId', async () => {
    let updateCount = 0;
    __onUpdate(() => { updateCount++; });
    wixEcom_onAbandonedCheckoutRecovered({ entity: { _id: '' } });
    await new Promise(r => setTimeout(r, 50));
    expect(updateCount).toBe(0);
  });

  it('markRecoveryEmailSent returns false for non-existent cart', async () => {
    __seed('AbandonedCarts', []);
    const result = await markRecoveryEmailSent('nonexistent-id');
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// reviewsService — catch blocks & category summary edge paths
// ═══════════════════════════════════════════════════════════════════════

import {
  getProductReviews,
  getAggregateRating,
  submitReview,
  markHelpful,
  flagReview,
  getPendingReviews,
  moderateReview,
  getReviewStats,
  addOwnerResponse,
  getCategoryReviewSummaries,
} from '../src/backend/reviewsService.web.js';

describe('reviewsService — error catch paths', () => {
  beforeEach(() => {
    __setMember({
      _id: 'member-err',
      contactDetails: { firstName: 'Test', lastName: 'User' },
    });
  });

  it('submitReview returns error on DB insert failure', async () => {
    __seed('Reviews', []);
    __seed('Stores/Orders', []);
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(new Error('DB down'));
    const result = await submitReview({
      productId: 'prod-001',
      rating: 5,
      body: 'A perfectly valid review body text here.',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to submit');
    vi.restoreAllMocks();
  });

  it('markHelpful returns failure on DB error', async () => {
    __seed('Reviews', [
      { _id: 'rev-err', productId: 'p1', status: 'approved', helpful: 5 },
    ]);
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('DB down'));
    const result = await markHelpful('rev-err');
    expect(result.success).toBe(false);
    vi.restoreAllMocks();
  });

  it('flagReview returns failure on DB error', async () => {
    __seed('Reviews', [
      { _id: 'rev-flag', productId: 'p1', status: 'approved' },
    ]);
    __seed('ReviewFlags', []);
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(new Error('DB down'));
    const result = await flagReview('rev-flag', 'spam');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to flag');
    vi.restoreAllMocks();
  });

  it('getPendingReviews returns failure on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getPendingReviews();
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
    expect(result.total).toBe(0);
    vi.restoreAllMocks();
  });

  it('moderateReview returns failure on DB error', async () => {
    __seed('Reviews', [
      { _id: 'rev-mod', productId: 'p1', status: 'pending' },
    ]);
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('DB down'));
    const result = await moderateReview('rev-mod', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to moderate');
    vi.restoreAllMocks();
  });

  it('getReviewStats returns failure on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getReviewStats(30);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch');
    vi.restoreAllMocks();
  });

  it('addOwnerResponse returns failure on DB error', async () => {
    __seed('Reviews', [
      { _id: 'rev-owner', productId: 'p1', status: 'approved' },
    ]);
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('DB down'));
    const result = await addOwnerResponse('rev-owner', 'Thank you for your review!');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to add');
    vi.restoreAllMocks();
  });

  it('getCategoryReviewSummaries returns {} on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getCategoryReviewSummaries(['prod-001']);
    expect(result).toEqual({});
    vi.restoreAllMocks();
  });

  it('getCategoryReviewSummaries skips reviews with unrecognized productIds', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod-001', rating: 5, status: 'approved' },
      { _id: 'r2', productId: 'prod-unknown', rating: 3, status: 'approved' },
    ]);
    const result = await getCategoryReviewSummaries(['prod-001']);
    // prod-unknown review should be skipped via `if (!summaries[pid]) continue`
    expect(result['prod-001'].total).toBe(1);
    expect(result['prod-001'].average).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// returnsService — catch blocks, format helpers, guest return names
// ═══════════════════════════════════════════════════════════════════════

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

describe('returnsService — error catch paths', () => {
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
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
  });

  it('getMyReturns returns [] on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getMyReturns();
    expect(result.returns).toEqual([]);
    vi.restoreAllMocks();
  });

  it('getReturnByRma returns null on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getReturnByRma('RMA-COV-ABCD');
    expect(result.returnRequest).toBeNull();
    vi.restoreAllMocks();
  });

  it('updateReturnStatus returns false on DB error', async () => {
    __seed('Returns', [returnRecord()]);
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('DB down'));
    const result = await updateReturnStatus('return-cov', 'approved');
    expect(result.success).toBe(false);
    vi.restoreAllMocks();
  });

  it('lookupReturn returns error on DB failure', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await lookupReturn('30001', 'cov@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to look up');
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
  });

  it('generateReturnLabel returns error on DB failure', async () => {
    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB down'));
    const result = await generateReturnLabel('return-cov');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to generate');
    vi.restoreAllMocks();
  });

  it('getMyReturnLabel returns error on DB failure', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getMyReturnLabel('RMA-COV-ABCD');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to retrieve');
    vi.restoreAllMocks();
  });

  it('trackReturnShipment returns error on DB failure', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await trackReturnShipment('RMA-COV-ABCD');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to track');
    vi.restoreAllMocks();
  });

  it('getAdminReturns returns failure on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getAdminReturns();
    expect(result.success).toBe(false);
    expect(result.returns).toEqual([]);
    expect(result.total).toBe(0);
    vi.restoreAllMocks();
  });

  it('getReturnStats returns failure on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getReturnStats();
    expect(result.success).toBe(false);
    expect(result.stats).toEqual({});
    vi.restoreAllMocks();
  });

  it('processRefund returns error on DB failure', async () => {
    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB down'));
    const result = await processRefund('return-cov', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to process');
    vi.restoreAllMocks();
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
