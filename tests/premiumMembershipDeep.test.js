/**
 * premiumMembershipDeep.test.js — Edge case coverage for CF+ Premium membership.
 * Targets: floating-point precision, expiry auto-update, activation dedup,
 * cancellation edge cases, discount boundary conditions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';

vi.mock('wix-data', () => import('./__mocks__/wix-data.js'));
vi.mock('wix-members-backend', () => import('./__mocks__/wix-members-backend.js'));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => String(val || '').slice(0, max),
  validateEmail: (e) => /^[^@]+@[^@]+\.[^@]+$/.test(e),
  validateId: (id) => !!id,
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

const {
  getMembershipPlans,
  checkMembershipStatus,
  getMemberBenefits,
  activateMembership,
  cancelMembership,
  applyMemberDiscount,
} = await import('../src/backend/premiumMembership.web.js');

beforeEach(() => {
  resetData();
  resetMembers();
  __setMember({ _id: 'member-1', loginEmail: 'alice@test.com', contactDetails: { firstName: 'Alice' } });
  __seed('PremiumMemberships', []);
});

// ── applyMemberDiscount — floating-point precision ────────────────

describe('applyMemberDiscount — floating-point edge cases', () => {
  beforeEach(() => {
    // Give member an active subscription
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }]);
  });

  it('$0.33 order — discount does not exceed total', async () => {
    const result = await applyMemberDiscount(0.33);
    expect(result.success).toBe(true);
    expect(result.discountAmount).toBeLessThanOrEqual(0.33);
    expect(result.finalTotal).toBeGreaterThanOrEqual(0);
  });

  it('$3.33 order — finalTotal + discountAmount equals original total', async () => {
    const result = await applyMemberDiscount(3.33);
    expect(result.success).toBe(true);
    // Allow for rounding: sum should be within 1 cent of original
    expect(Math.abs(result.finalTotal + result.discountAmount - 3.33)).toBeLessThanOrEqual(0.01);
  });

  it('$7.77 order — 10% discount rounds to 2 decimal places', async () => {
    const result = await applyMemberDiscount(7.77);
    expect(result.success).toBe(true);
    // 7.77 * 0.10 = 0.777 → rounded to 0.78
    expect(result.discountAmount).toBe(0.78);
    expect(result.finalTotal).toBe(6.99);
  });

  it('$12.34 order — precise rounding', async () => {
    const result = await applyMemberDiscount(12.34);
    expect(result.success).toBe(true);
    // 12.34 * 0.10 = 1.234 → rounded to 1.23
    expect(result.discountAmount).toBe(1.23);
    expect(result.finalTotal).toBe(11.11);
  });

  it('$0.01 order — minimum possible total', async () => {
    const result = await applyMemberDiscount(0.01);
    expect(result.success).toBe(true);
    // 0.01 * 0.10 = 0.001 → rounds to 0.00
    expect(result.discountAmount).toBe(0);
    expect(result.finalTotal).toBe(0.01);
  });

  it('$10,000,000 order — large total stays accurate', async () => {
    const result = await applyMemberDiscount(10000000);
    expect(result.success).toBe(true);
    expect(result.discountAmount).toBe(1000000);
    expect(result.finalTotal).toBe(9000000);
  });

  it('rejects negative order total', async () => {
    const result = await applyMemberDiscount(-50);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects Infinity', async () => {
    const result = await applyMemberDiscount(Infinity);
    expect(result.success).toBe(false);
  });

  it('rejects string that parses to NaN', async () => {
    const result = await applyMemberDiscount('not-a-number');
    expect(result.success).toBe(false);
  });

  it('handles string that parses to valid number', async () => {
    const result = await applyMemberDiscount('100.50');
    expect(result.success).toBe(true);
    expect(result.discountAmount).toBe(10.05);
    expect(result.finalTotal).toBe(90.45);
  });
});

// ── getActiveMembership — auto-expiry ─────────────────────────────

describe('checkMembershipStatus — auto-expiry behavior', () => {
  it('auto-expires membership when endDate is in the past', async () => {
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, ...item }));

    __seed('PremiumMemberships', [{
      _id: 'pm-expired',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'), // Past date
    }]);

    const result = await checkMembershipStatus();
    expect(result.success).toBe(true);
    expect(result.isActive).toBe(false);

    // Verify the record was updated to 'expired'
    const expiredUpdate = updates.find(u => u.collection === 'PremiumMemberships');
    expect(expiredUpdate).toBeDefined();
    expect(expiredUpdate.status).toBe('expired');
  });

  it('does NOT auto-expire when endDate is in the future', async () => {
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, ...item }));

    __seed('PremiumMemberships', [{
      _id: 'pm-active',
      memberId: 'member-1',
      planType: 'annual',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    }]);

    const result = await checkMembershipStatus();
    expect(result.success).toBe(true);
    expect(result.isActive).toBe(true);

    // No update should have happened
    const pmUpdates = updates.filter(u => u.collection === 'PremiumMemberships');
    expect(pmUpdates.length).toBe(0);
  });

  it('handles membership with null endDate (no expiry)', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-noend',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: null,
    }]);

    const result = await checkMembershipStatus();
    expect(result.success).toBe(true);
    expect(result.isActive).toBe(true);
  });
});

// ── activateMembership — dedup and edge cases ─────────────────────

describe('activateMembership — edge cases', () => {
  it('cancels multiple existing active memberships before creating new', async () => {
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, ...item }));

    // Seed 2 active memberships (shouldn't happen, but DB corruption possible)
    __seed('PremiumMemberships', [
      {
        _id: 'pm-old-1',
        memberId: 'member-1',
        planType: 'monthly',
        status: 'active',
        startDate: new Date('2025-06-01'),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        _id: 'pm-old-2',
        memberId: 'member-1',
        planType: 'annual',
        status: 'active',
        startDate: new Date('2025-01-01'),
        endDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      },
    ]);

    const result = await activateMembership('member-1', 'monthly');
    expect(result.success).toBe(true);

    // Both old memberships should be cancelled
    const cancellations = updates.filter(u =>
      u.collection === 'PremiumMemberships' && u.status === 'cancelled'
    );
    expect(cancellations.length).toBe(2);
    expect(cancellations.map(c => c._id).sort()).toEqual(['pm-old-1', 'pm-old-2']);
  });

  it('stores sanitized memberId (not raw input) in the record', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, ...item }));

    // sanitize(val, 50) returns String(val).slice(0, 50) — verify stored value is a string
    const result = await activateMembership('member-valid-123', 'monthly');
    expect(result.success).toBe(true);

    const inserted = inserts.find(i => i.collection === 'PremiumMemberships');
    expect(typeof inserted.memberId).toBe('string');
    expect(inserted.memberId).toBe('member-valid-123');
  });

  it('memberId longer than 50 chars is truncated', async () => {
    const longId = 'a'.repeat(100);
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, ...item }));

    const result = await activateMembership(longId, 'annual');
    expect(result.success).toBe(true);

    const inserted = inserts.find(i => i.collection === 'PremiumMemberships');
    expect(inserted.memberId.length).toBeLessThanOrEqual(50);
  });

  it('monthly plan sets endDate ~30 days from now', async () => {
    const result = await activateMembership('member-1', 'monthly');
    expect(result.success).toBe(true);
    const diff = result.endDate.getTime() - Date.now();
    const diffDays = diff / (24 * 60 * 60 * 1000);
    // Should be ~30 days (within 1 day tolerance for test timing)
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThanOrEqual(30);
  });

  it('annual plan sets endDate ~365 days from now', async () => {
    const result = await activateMembership('member-1', 'annual');
    expect(result.success).toBe(true);
    const diff = result.endDate.getTime() - Date.now();
    const diffDays = diff / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(364);
    expect(diffDays).toBeLessThanOrEqual(365);
  });

  it('rejects null memberId', async () => {
    const result = await activateMembership(null, 'monthly');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Member ID');
  });

  it('rejects numeric memberId', async () => {
    const result = await activateMembership(12345, 'monthly');
    expect(result.success).toBe(false);
  });

  it('rejects undefined planType', async () => {
    const result = await activateMembership('member-1', undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('plan type');
  });

  it('rejects planType not in VALID_PLAN_TYPES', async () => {
    const result = await activateMembership('member-1', 'weekly');
    expect(result.success).toBe(false);
    expect(result.error).toContain('plan type');
  });
});

// ── cancelMembership — edge cases ─────────────────────────────────

describe('cancelMembership — edge cases', () => {
  it('cannot cancel an expired membership', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-exp',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'expired',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
    }]);

    const result = await cancelMembership('member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No active membership');
  });

  it('cannot cancel an already-cancelled membership', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-canc',
      memberId: 'member-1',
      planType: 'annual',
      status: 'cancelled',
      startDate: new Date('2025-01-01'),
      cancelledAt: new Date('2025-06-01'),
    }]);

    const result = await cancelMembership('member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No active membership');
  });

  it('sets cancelledAt timestamp on cancellation', async () => {
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, ...item }));

    __seed('PremiumMemberships', [{
      _id: 'pm-active',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }]);

    const result = await cancelMembership('member-1');
    expect(result.success).toBe(true);

    const cancelled = updates.find(u => u.collection === 'PremiumMemberships');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
  });

  it('rejects null memberId', async () => {
    const result = await cancelMembership(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Member ID');
  });

  it('cancels correct membership when member has both active and expired', async () => {
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, ...item }));

    __seed('PremiumMemberships', [
      {
        _id: 'pm-expired',
        memberId: 'member-1',
        planType: 'monthly',
        status: 'expired',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      },
      {
        _id: 'pm-active',
        memberId: 'member-1',
        planType: 'annual',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    ]);

    const result = await cancelMembership('member-1');
    expect(result.success).toBe(true);

    // Only the active one should be cancelled
    const cancelled = updates.filter(u => u.collection === 'PremiumMemberships');
    expect(cancelled.length).toBe(1);
    expect(cancelled[0]._id).toBe('pm-active');
  });
});

// ── getMemberBenefits — non-member response completeness ──────────

describe('getMemberBenefits — response shape', () => {
  it('non-member response includes all expected keys', async () => {
    const result = await getMemberBenefits();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('freeShipping', false);
    expect(result).toHaveProperty('discountPercent', 0);
    expect(result).toHaveProperty('earlyAccess', false);
  });

  it('active member response includes all benefit keys', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }]);

    const result = await getMemberBenefits();
    expect(result.success).toBe(true);
    expect(result.freeShipping).toBe(true);
    expect(result.discountPercent).toBe(10);
    expect(result.earlyAccess).toBe(true);
  });

  it('returns failure when not authenticated', async () => {
    resetMembers();
    __setMember(null);
    const result = await getMemberBenefits();
    expect(result.success).toBe(false);
  });
});

// ── getMembershipPlans — plan data integrity ──────────────────────

describe('getMembershipPlans — data integrity', () => {
  it('plan benefits are copies, not references to internal array', async () => {
    const result1 = await getMembershipPlans();
    const result2 = await getMembershipPlans();

    // Mutating benefits array from first call should not affect second call
    result1.plans[0].benefits.push('hacked benefit');
    const result3 = await getMembershipPlans();
    expect(result3.plans[0].benefits).not.toContain('hacked benefit');
  });

  it('annual plan saves $60/year vs monthly', async () => {
    const result = await getMembershipPlans();
    const monthly = result.plans.find(p => p.type === 'monthly');
    const annual = result.plans.find(p => p.type === 'annual');
    const monthlyAnnualCost = monthly.price * 12;
    const savings = monthlyAnnualCost - annual.price;
    expect(savings).toBeCloseTo(60, 0);
  });
});
