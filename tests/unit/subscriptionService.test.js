import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setMember, __reset as __resetMembers } from '../__mocks__/wix-members-backend.js';
import {
  createSubscription,
  getMySubscriptions,
  getSubscriptionDetails,
  updateFrequency,
  pauseSubscription,
  resumeSubscription,
  skipNextDelivery,
  cancelSubscription,
  getSubscriptionPlans,
  getSubscriberDiscount,
} from '../../src/backend/subscriptionService.web.js';

const VALID_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly'];

const MEMBER = { _id: 'member-001', loginEmail: 'alice@test.com', profile: { nickname: 'Alice' } };

function makeSub(overrides = {}) {
  return {
    _id: 'sub-001',
    memberId: 'member-001',
    productId: 'prod-sheet-001',
    productName: 'Organic Cotton Sheet Set',
    frequency: 'monthly',
    quantity: 1,
    nextShipDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    status: 'active',
    discount: 10,
    createdDate: new Date().toISOString(),
    pausedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    skippedDates: [],
    ...overrides,
  };
}

// ── getSubscriptionPlans ──────────────────────────────────────────────

describe('getSubscriptionPlans', () => {
  it('returns all available frequency options', async () => {
    const plans = await getSubscriptionPlans();
    expect(plans).toBeInstanceOf(Array);
    expect(plans.length).toBeGreaterThanOrEqual(4);
    const frequencies = plans.map(p => p.frequency);
    for (const f of VALID_FREQUENCIES) {
      expect(frequencies).toContain(f);
    }
  });

  it('each plan has frequency, label, intervalDays, and discount', async () => {
    const plans = await getSubscriptionPlans();
    for (const plan of plans) {
      expect(plan).toHaveProperty('frequency');
      expect(plan).toHaveProperty('label');
      expect(plan).toHaveProperty('intervalDays');
      expect(plan).toHaveProperty('discount');
      expect(typeof plan.intervalDays).toBe('number');
      expect(plan.intervalDays).toBeGreaterThan(0);
    }
  });
});

// ── createSubscription ────────────────────────────────────────────────

describe('createSubscription', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
    __seed('Subscriptions', []);
  });

  it('creates a subscription with valid data', async () => {
    const result = await createSubscription({
      productId: 'prod-sheet-001',
      productName: 'Organic Cotton Sheet Set',
      frequency: 'monthly',
      quantity: 1,
    });
    expect(result.success).toBe(true);
    expect(result.subscription).toBeDefined();
    expect(result.subscription.memberId).toBe('member-001');
    expect(result.subscription.frequency).toBe('monthly');
    expect(result.subscription.status).toBe('active');
    expect(result.subscription.discount).toBe(10);
    expect(result.subscription.nextShipDate).toBeDefined();
  });

  it('rejects when not logged in', async () => {
    __setMember(null);
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: 1,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('logged in');
  });

  it('rejects missing productId', async () => {
    const result = await createSubscription({
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: 1,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Product ID');
  });

  it('rejects missing frequency', async () => {
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      quantity: 1,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('frequency');
  });

  it('rejects invalid frequency', async () => {
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'daily',
      quantity: 1,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('frequency');
  });

  it('rejects zero quantity', async () => {
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: 0,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('quantity');
  });

  it('rejects negative quantity', async () => {
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: -3,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('quantity');
  });

  it('rejects NaN quantity', async () => {
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('sanitizes productName to prevent XSS', async () => {
    const result = await createSubscription({
      productId: 'prod-001',
      productName: '<script>alert("xss")</script>Sheet Set',
      frequency: 'monthly',
      quantity: 1,
    });
    expect(result.success).toBe(true);
    expect(result.subscription.productName).not.toContain('<script>');
  });

  it('rejects invalid productId format', async () => {
    const result = await createSubscription({
      productId: '<script>alert(1)</script>',
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: 1,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Product ID');
  });

  it('prevents duplicate active subscription for same product', async () => {
    __seed('Subscriptions', [makeSub({ productId: 'prod-001' })]);
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: 1,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('already');
  });

  it('allows subscription for same product if previous is cancelled', async () => {
    __seed('Subscriptions', [makeSub({ productId: 'prod-001', status: 'cancelled' })]);
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: 1,
    });
    expect(result.success).toBe(true);
  });

  it('defaults quantity to 1 when not provided', async () => {
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'monthly',
    });
    expect(result.success).toBe(true);
    expect(result.subscription.quantity).toBe(1);
  });

  it('caps quantity at 10', async () => {
    const result = await createSubscription({
      productId: 'prod-001',
      productName: 'Sheets',
      frequency: 'monthly',
      quantity: 50,
    });
    expect(result.success).toBe(true);
    expect(result.subscription.quantity).toBe(10);
  });
});

// ── getMySubscriptions ────────────────────────────────────────────────

describe('getMySubscriptions', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
  });

  it('returns empty array when no subscriptions', async () => {
    __seed('Subscriptions', []);
    const result = await getMySubscriptions();
    expect(result.success).toBe(true);
    expect(result.subscriptions).toEqual([]);
  });

  it('returns only current member subscriptions', async () => {
    __seed('Subscriptions', [
      makeSub({ _id: 'sub-1', memberId: 'member-001' }),
      makeSub({ _id: 'sub-2', memberId: 'member-002' }),
      makeSub({ _id: 'sub-3', memberId: 'member-001' }),
    ]);
    const result = await getMySubscriptions();
    expect(result.success).toBe(true);
    expect(result.subscriptions).toHaveLength(2);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getMySubscriptions();
    expect(result.success).toBe(false);
    expect(result.message).toContain('logged in');
  });

  it('includes active and paused subscriptions', async () => {
    __seed('Subscriptions', [
      makeSub({ _id: 'sub-1', status: 'active' }),
      makeSub({ _id: 'sub-2', status: 'paused' }),
      makeSub({ _id: 'sub-3', status: 'cancelled' }),
    ]);
    const result = await getMySubscriptions();
    expect(result.success).toBe(true);
    expect(result.subscriptions).toHaveLength(3);
  });
});

// ── getSubscriptionDetails ────────────────────────────────────────────

describe('getSubscriptionDetails', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
    __seed('Subscriptions', [makeSub()]);
  });

  it('returns subscription details for owner', async () => {
    const result = await getSubscriptionDetails('sub-001');
    expect(result.success).toBe(true);
    expect(result.subscription.productName).toBe('Organic Cotton Sheet Set');
  });

  it('rejects null subscription ID', async () => {
    const result = await getSubscriptionDetails(null);
    expect(result.success).toBe(false);
  });

  it('returns not found for nonexistent subscription', async () => {
    const result = await getSubscriptionDetails('sub-nonexistent');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('rejects access to another member subscription', async () => {
    __seed('Subscriptions', [makeSub({ memberId: 'member-other' })]);
    const result = await getSubscriptionDetails('sub-001');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getSubscriptionDetails('sub-001');
    expect(result.success).toBe(false);
  });
});

// ── updateFrequency ───────────────────────────────────────────────────

describe('updateFrequency', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
    __seed('Subscriptions', [makeSub()]);
  });

  it('updates frequency successfully', async () => {
    const result = await updateFrequency('sub-001', 'weekly');
    expect(result.success).toBe(true);
    expect(result.subscription.frequency).toBe('weekly');
    expect(result.subscription.nextShipDate).toBeDefined();
  });

  it('rejects invalid frequency', async () => {
    const result = await updateFrequency('sub-001', 'daily');
    expect(result.success).toBe(false);
    expect(result.message).toContain('frequency');
  });

  it('rejects null frequency', async () => {
    const result = await updateFrequency('sub-001', null);
    expect(result.success).toBe(false);
  });

  it('rejects update on cancelled subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'cancelled' })]);
    const result = await updateFrequency('sub-001', 'weekly');
    expect(result.success).toBe(false);
    expect(result.message).toContain('cancelled');
  });

  it('rejects update on nonexistent subscription', async () => {
    const result = await updateFrequency('sub-999', 'weekly');
    expect(result.success).toBe(false);
  });

  it('rejects access to another member subscription', async () => {
    __seed('Subscriptions', [makeSub({ memberId: 'member-other' })]);
    const result = await updateFrequency('sub-001', 'weekly');
    expect(result.success).toBe(false);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await updateFrequency('sub-001', 'weekly');
    expect(result.success).toBe(false);
  });

  it('recalculates nextShipDate based on new frequency', async () => {
    const result = await updateFrequency('sub-001', 'quarterly');
    expect(result.success).toBe(true);
    const nextShip = new Date(result.subscription.nextShipDate);
    const now = new Date();
    const diffDays = (nextShip - now) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(80);
    expect(diffDays).toBeLessThan(100);
  });
});

// ── pauseSubscription ─────────────────────────────────────────────────

describe('pauseSubscription', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
    __seed('Subscriptions', [makeSub()]);
  });

  it('pauses an active subscription', async () => {
    const result = await pauseSubscription('sub-001');
    expect(result.success).toBe(true);
    expect(result.subscription.status).toBe('paused');
    expect(result.subscription.pausedAt).toBeDefined();
  });

  it('rejects pausing already paused subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'paused', pausedAt: new Date().toISOString() })]);
    const result = await pauseSubscription('sub-001');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already paused');
  });

  it('rejects pausing cancelled subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'cancelled' })]);
    const result = await pauseSubscription('sub-001');
    expect(result.success).toBe(false);
  });

  it('rejects null subscription ID', async () => {
    const result = await pauseSubscription(null);
    expect(result.success).toBe(false);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await pauseSubscription('sub-001');
    expect(result.success).toBe(false);
  });

  it('rejects access to another member subscription', async () => {
    __seed('Subscriptions', [makeSub({ memberId: 'member-other' })]);
    const result = await pauseSubscription('sub-001');
    expect(result.success).toBe(false);
  });
});

// ── resumeSubscription ────────────────────────────────────────────────

describe('resumeSubscription', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
    __seed('Subscriptions', [makeSub({ status: 'paused', pausedAt: new Date().toISOString() })]);
  });

  it('resumes a paused subscription', async () => {
    const result = await resumeSubscription('sub-001');
    expect(result.success).toBe(true);
    expect(result.subscription.status).toBe('active');
    expect(result.subscription.pausedAt).toBeNull();
    expect(result.subscription.nextShipDate).toBeDefined();
  });

  it('rejects resuming active subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'active' })]);
    const result = await resumeSubscription('sub-001');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not paused');
  });

  it('rejects resuming cancelled subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'cancelled' })]);
    const result = await resumeSubscription('sub-001');
    expect(result.success).toBe(false);
  });

  it('rejects null subscription ID', async () => {
    const result = await resumeSubscription(null);
    expect(result.success).toBe(false);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await resumeSubscription('sub-001');
    expect(result.success).toBe(false);
  });
});

// ── skipNextDelivery ──────────────────────────────────────────────────

describe('skipNextDelivery', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
    __seed('Subscriptions', [makeSub()]);
  });

  it('skips next delivery and advances ship date', async () => {
    const result = await skipNextDelivery('sub-001');
    expect(result.success).toBe(true);
    expect(result.subscription.skippedDates).toHaveLength(1);
    expect(result.subscription.nextShipDate).toBeDefined();
  });

  it('rejects skip on paused subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'paused' })]);
    const result = await skipNextDelivery('sub-001');
    expect(result.success).toBe(false);
    expect(result.message).toContain('active');
  });

  it('rejects skip on cancelled subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'cancelled' })]);
    const result = await skipNextDelivery('sub-001');
    expect(result.success).toBe(false);
  });

  it('limits consecutive skips to 3', async () => {
    __seed('Subscriptions', [makeSub({
      skippedDates: ['2026-01-01', '2026-02-01', '2026-03-01'],
    })]);
    const result = await skipNextDelivery('sub-001');
    expect(result.success).toBe(false);
    expect(result.message).toContain('skip');
  });

  it('rejects null subscription ID', async () => {
    const result = await skipNextDelivery(null);
    expect(result.success).toBe(false);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await skipNextDelivery('sub-001');
    expect(result.success).toBe(false);
  });

  it('rejects access to another member subscription', async () => {
    __seed('Subscriptions', [makeSub({ memberId: 'member-other' })]);
    const result = await skipNextDelivery('sub-001');
    expect(result.success).toBe(false);
  });
});

// ── cancelSubscription ────────────────────────────────────────────────

describe('cancelSubscription', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
    __seed('Subscriptions', [makeSub()]);
  });

  it('cancels an active subscription with reason', async () => {
    const result = await cancelSubscription('sub-001', 'Too expensive');
    expect(result.success).toBe(true);
    expect(result.subscription.status).toBe('cancelled');
    expect(result.subscription.cancelledAt).toBeDefined();
    expect(result.subscription.cancellationReason).toBe('Too expensive');
  });

  it('cancels a paused subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'paused' })]);
    const result = await cancelSubscription('sub-001', 'No longer need');
    expect(result.success).toBe(true);
    expect(result.subscription.status).toBe('cancelled');
  });

  it('rejects cancelling already cancelled subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'cancelled' })]);
    const result = await cancelSubscription('sub-001', 'test');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already cancelled');
  });

  it('allows cancel without reason', async () => {
    const result = await cancelSubscription('sub-001');
    expect(result.success).toBe(true);
    expect(result.subscription.cancellationReason).toBeFalsy();
  });

  it('sanitizes cancellation reason', async () => {
    const result = await cancelSubscription('sub-001', '<script>alert(1)</script>Too costly');
    expect(result.success).toBe(true);
    expect(result.subscription.cancellationReason).not.toContain('<script>');
  });

  it('rejects null subscription ID', async () => {
    const result = await cancelSubscription(null);
    expect(result.success).toBe(false);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await cancelSubscription('sub-001');
    expect(result.success).toBe(false);
  });

  it('rejects access to another member subscription', async () => {
    __seed('Subscriptions', [makeSub({ memberId: 'member-other' })]);
    const result = await cancelSubscription('sub-001', 'test');
    expect(result.success).toBe(false);
  });
});

// ── getSubscriberDiscount ─────────────────────────────────────────────

describe('getSubscriberDiscount', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
    __setMember(MEMBER);
  });

  it('returns 10% discount for 1 active subscription', async () => {
    __seed('Subscriptions', [makeSub({ status: 'active' })]);
    const result = await getSubscriberDiscount();
    expect(result.success).toBe(true);
    expect(result.discount).toBe(10);
    expect(result.activeCount).toBe(1);
  });

  it('returns 15% discount for 3+ active subscriptions', async () => {
    __seed('Subscriptions', [
      makeSub({ _id: 'sub-1', status: 'active', productId: 'p1' }),
      makeSub({ _id: 'sub-2', status: 'active', productId: 'p2' }),
      makeSub({ _id: 'sub-3', status: 'active', productId: 'p3' }),
    ]);
    const result = await getSubscriberDiscount();
    expect(result.success).toBe(true);
    expect(result.discount).toBe(15);
    expect(result.activeCount).toBe(3);
  });

  it('returns 0% discount with no active subscriptions', async () => {
    __seed('Subscriptions', []);
    const result = await getSubscriberDiscount();
    expect(result.success).toBe(true);
    expect(result.discount).toBe(0);
    expect(result.activeCount).toBe(0);
  });

  it('excludes cancelled and paused from discount count', async () => {
    __seed('Subscriptions', [
      makeSub({ _id: 'sub-1', status: 'active', productId: 'p1' }),
      makeSub({ _id: 'sub-2', status: 'cancelled', productId: 'p2' }),
      makeSub({ _id: 'sub-3', status: 'paused', productId: 'p3' }),
    ]);
    const result = await getSubscriberDiscount();
    expect(result.success).toBe(true);
    expect(result.discount).toBe(10);
    expect(result.activeCount).toBe(1);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getSubscriberDiscount();
    expect(result.success).toBe(false);
  });
});
