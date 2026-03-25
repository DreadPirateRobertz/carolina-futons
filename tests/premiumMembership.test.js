/**
 * premiumMembership.test.js — TDD tests for CF+ Premium membership system.
 * CF-k6a0: Subscription-based membership with free shipping, exclusive discounts,
 * early access, and welcome email automation.
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
  getPremiumUpsellData,
} = await import('../src/backend/premiumMembership.web.js');

beforeEach(() => {
  resetData();
  resetMembers();
  __setMember({ _id: 'member-1', loginEmail: 'alice@test.com', contactDetails: { firstName: 'Alice' } });
  __seed('PremiumMemberships', []);
});

// ── getMembershipPlans ──────────────────────────────────────────────

describe('getMembershipPlans', () => {
  it('returns monthly and annual plans', async () => {
    const result = await getMembershipPlans();
    expect(result.success).toBe(true);
    expect(result.plans).toHaveLength(2);

    const monthly = result.plans.find(p => p.type === 'monthly');
    const annual = result.plans.find(p => p.type === 'annual');
    expect(monthly).toBeDefined();
    expect(annual).toBeDefined();
  });

  it('monthly plan has correct pricing', async () => {
    const result = await getMembershipPlans();
    const monthly = result.plans.find(p => p.type === 'monthly');
    expect(monthly.price).toBeGreaterThan(0);
    expect(typeof monthly.price).toBe('number');
    expect(monthly.label).toBeTruthy();
  });

  it('annual plan is cheaper per month than monthly', async () => {
    const result = await getMembershipPlans();
    const monthly = result.plans.find(p => p.type === 'monthly');
    const annual = result.plans.find(p => p.type === 'annual');
    const annualPerMonth = annual.price / 12;
    expect(annualPerMonth).toBeLessThan(monthly.price);
  });

  it('each plan lists benefits', async () => {
    const result = await getMembershipPlans();
    for (const plan of result.plans) {
      expect(plan.benefits).toBeDefined();
      expect(Array.isArray(plan.benefits)).toBe(true);
      expect(plan.benefits.length).toBeGreaterThan(0);
    }
  });
});

// ── checkMembershipStatus ───────────────────────────────────────────

describe('checkMembershipStatus', () => {
  it('returns inactive when no membership exists', async () => {
    const result = await checkMembershipStatus();
    expect(result.success).toBe(true);
    expect(result.isActive).toBe(false);
  });

  it('returns active for member with active subscription', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000 * 29),
    }]);

    const result = await checkMembershipStatus();
    expect(result.success).toBe(true);
    expect(result.isActive).toBe(true);
    expect(result.planType).toBe('monthly');
  });

  it('returns inactive for cancelled membership', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'cancelled',
      startDate: new Date(Date.now() - 86400000 * 30),
      endDate: new Date(Date.now() - 86400000),
    }]);

    const result = await checkMembershipStatus();
    expect(result.isActive).toBe(false);
  });

  it('returns inactive for expired membership', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'annual',
      status: 'active',
      startDate: new Date(Date.now() - 86400000 * 400),
      endDate: new Date(Date.now() - 86400000),
    }]);

    const result = await checkMembershipStatus();
    expect(result.isActive).toBe(false);
  });

  it('returns failure when not authenticated', async () => {
    __setMember(null);
    const result = await checkMembershipStatus();
    expect(result.success).toBe(false);
  });

  it('includes endDate for active membership', async () => {
    const endDate = new Date(Date.now() + 86400000 * 29);
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate,
    }]);

    const result = await checkMembershipStatus();
    expect(result.endDate).toBeDefined();
  });
});

// ── getMemberBenefits ───────────────────────────────────────────────

describe('getMemberBenefits', () => {
  it('returns no benefits for non-member', async () => {
    const result = await getMemberBenefits();
    expect(result.success).toBe(true);
    expect(result.freeShipping).toBe(false);
    expect(result.discountPercent).toBe(0);
    expect(result.earlyAccess).toBe(false);
  });

  it('returns free shipping for active CF+ member', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
    }]);

    const result = await getMemberBenefits();
    expect(result.freeShipping).toBe(true);
  });

  it('returns discount for active CF+ member', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'annual',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 365),
    }]);

    const result = await getMemberBenefits();
    expect(result.discountPercent).toBeGreaterThan(0);
  });

  it('returns early access for active CF+ member', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
    }]);

    const result = await getMemberBenefits();
    expect(result.earlyAccess).toBe(true);
  });

  it('returns no benefits for expired membership', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(Date.now() - 86400000 * 60),
      endDate: new Date(Date.now() - 86400000),
    }]);

    const result = await getMemberBenefits();
    expect(result.freeShipping).toBe(false);
    expect(result.discountPercent).toBe(0);
    expect(result.earlyAccess).toBe(false);
  });

  it('returns failure when not authenticated', async () => {
    __setMember(null);
    const result = await getMemberBenefits();
    expect(result.success).toBe(false);
  });
});

// ── activateMembership ──────────────────────────────────────────────

describe('activateMembership', () => {
  it('creates monthly membership record', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    const result = await activateMembership('member-1', 'monthly');
    expect(result.success).toBe(true);

    const pmInsert = inserted.find(i => i.col === 'PremiumMemberships');
    expect(pmInsert).toBeDefined();
    expect(pmInsert.item.memberId).toBe('member-1');
    expect(pmInsert.item.planType).toBe('monthly');
    expect(pmInsert.item.status).toBe('active');
  });

  it('creates annual membership record', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    const result = await activateMembership('member-1', 'annual');
    expect(result.success).toBe(true);

    const pmInsert = inserted.find(i => i.col === 'PremiumMemberships');
    expect(pmInsert.item.planType).toBe('annual');
  });

  it('sets correct endDate for monthly plan (30 days)', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await activateMembership('member-1', 'monthly');

    const pmInsert = inserted.find(i => i.col === 'PremiumMemberships');
    const endDate = new Date(pmInsert.item.endDate);
    const startDate = new Date(pmInsert.item.startDate);
    const daysDiff = Math.round((endDate - startDate) / 86400000);
    expect(daysDiff).toBe(30);
  });

  it('sets correct endDate for annual plan (365 days)', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await activateMembership('member-1', 'annual');

    const pmInsert = inserted.find(i => i.col === 'PremiumMemberships');
    const endDate = new Date(pmInsert.item.endDate);
    const startDate = new Date(pmInsert.item.startDate);
    const daysDiff = Math.round((endDate - startDate) / 86400000);
    expect(daysDiff).toBe(365);
  });

  it('rejects invalid plan type', async () => {
    const result = await activateMembership('member-1', 'weekly');
    expect(result.success).toBe(false);
  });

  it('rejects empty member ID', async () => {
    const result = await activateMembership('', 'monthly');
    expect(result.success).toBe(false);
  });

  it('deactivates existing membership before creating new one', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-old',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(Date.now() - 86400000 * 15),
      endDate: new Date(Date.now() + 86400000 * 15),
    }]);

    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    const result = await activateMembership('member-1', 'annual');
    expect(result.success).toBe(true);

    // Old membership should be cancelled
    const oldUpdate = updated.find(i => i.col === 'PremiumMemberships' && i.item._id === 'pm-old');
    expect(oldUpdate).toBeDefined();
    expect(oldUpdate.item.status).toBe('cancelled');

    // New membership should be created
    const newInsert = inserted.find(i => i.col === 'PremiumMemberships');
    expect(newInsert).toBeDefined();
    expect(newInsert.item.planType).toBe('annual');
  });
});

// ── cancelMembership ────────────────────────────────────────────────

describe('cancelMembership', () => {
  it('cancels an active membership', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000 * 29),
    }]);

    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    const result = await cancelMembership('member-1');
    expect(result.success).toBe(true);

    const pmUpdate = updated.find(i => i.col === 'PremiumMemberships');
    expect(pmUpdate).toBeDefined();
    expect(pmUpdate.item.status).toBe('cancelled');
    expect(pmUpdate.item.cancelledAt).toBeDefined();
  });

  it('returns failure if no active membership found', async () => {
    const result = await cancelMembership('member-1');
    expect(result.success).toBe(false);
  });

  it('rejects empty member ID', async () => {
    const result = await cancelMembership('');
    expect(result.success).toBe(false);
  });

  it('does not cancel already cancelled membership', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'cancelled',
      startDate: new Date(Date.now() - 86400000 * 30),
      endDate: new Date(Date.now() - 86400000),
    }]);

    const result = await cancelMembership('member-1');
    expect(result.success).toBe(false);
  });
});

// ── applyMemberDiscount ─────────────────────────────────────────────

describe('applyMemberDiscount', () => {
  it('returns zero discount for non-member', async () => {
    const result = await applyMemberDiscount(500);
    expect(result.success).toBe(true);
    expect(result.discountAmount).toBe(0);
    expect(result.freeShipping).toBe(false);
    expect(result.finalTotal).toBe(500);
  });

  it('applies member discount to order total', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
    }]);

    const result = await applyMemberDiscount(500);
    expect(result.success).toBe(true);
    expect(result.discountAmount).toBeGreaterThan(0);
    expect(result.finalTotal).toBeLessThan(500);
    expect(result.freeShipping).toBe(true);
  });

  it('discount amount is correct percentage of order total', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
    }]);

    const result = await applyMemberDiscount(1000);
    // Discount should be exactly discountPercent of order total
    expect(result.finalTotal).toBe(1000 - result.discountAmount);
    expect(result.discountAmount).toBe(Math.round(1000 * result.discountPercent / 100 * 100) / 100);
  });

  it('rejects invalid order total', async () => {
    const result = await applyMemberDiscount(-100);
    expect(result.success).toBe(false);
  });

  it('rejects NaN order total', async () => {
    const result = await applyMemberDiscount('not-a-number');
    expect(result.success).toBe(false);
  });

  it('handles zero order total', async () => {
    __seed('PremiumMemberships', [{
      _id: 'pm-1',
      memberId: 'member-1',
      planType: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
    }]);

    const result = await applyMemberDiscount(0);
    expect(result.success).toBe(true);
    expect(result.discountAmount).toBe(0);
    expect(result.finalTotal).toBe(0);
  });

  it('returns failure when not authenticated', async () => {
    __setMember(null);
    const result = await applyMemberDiscount(500);
    expect(result.success).toBe(false);
  });
});

// ── CF-ortb: getPremiumUpsellData ──────────────────────────────────────────

describe('getPremiumUpsellData', () => {
  it('returns eligible: true for Mountain Guide tier', async () => {
    __seed('MemberPoints', [{ _id: 'mp-u1', memberId: 'member-1', tier: 'Mountain Guide', totalPoints: 600 }]);
    const result = await getPremiumUpsellData();
    expect(result.eligible).toBe(true);
    expect(result.tier).toBe('Mountain Guide');
  });

  it('returns eligible: true for Summit Master tier', async () => {
    __seed('MemberPoints', [{ _id: 'mp-u2', memberId: 'member-1', tier: 'Summit Master', totalPoints: 2500 }]);
    const result = await getPremiumUpsellData();
    expect(result.eligible).toBe(true);
  });

  it('returns eligible: true for Blue Ridge Legend tier', async () => {
    __seed('MemberPoints', [{ _id: 'mp-u3', memberId: 'member-1', tier: 'Blue Ridge Legend', totalPoints: 6000 }]);
    const result = await getPremiumUpsellData();
    expect(result.eligible).toBe(true);
  });

  it('returns eligible: false for Trail Blazer tier', async () => {
    __seed('MemberPoints', [{ _id: 'mp-u4', memberId: 'member-1', tier: 'Trail Blazer', totalPoints: 100 }]);
    const result = await getPremiumUpsellData();
    expect(result.eligible).toBe(false);
    expect(result.tier).toBe('Trail Blazer');
  });

  it('returns eligible: false when already a CF+ member', async () => {
    __seed('MemberPoints', [{ _id: 'mp-u5', memberId: 'member-1', tier: 'Summit Master', totalPoints: 2500 }]);
    __seed('PremiumMemberships', [{
      _id: 'pm-u1', memberId: 'member-1', status: 'active',
      planType: 'monthly', startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000),
    }]);
    const result = await getPremiumUpsellData();
    expect(result.eligible).toBe(false);
    expect(result.alreadyMember).toBe(true);
  });

  it('returns plans array with correct structure', async () => {
    __seed('MemberPoints', [{ _id: 'mp-u6', memberId: 'member-1', tier: 'Mountain Guide', totalPoints: 600 }]);
    const result = await getPremiumUpsellData();
    expect(result.plans).toHaveLength(2);
    expect(result.plans[0]).toHaveProperty('id');
    expect(result.plans[0]).toHaveProperty('price');
    expect(result.plans[0]).toHaveProperty('type');
  });

  it('returns benefits array', async () => {
    __seed('MemberPoints', [{ _id: 'mp-u7', memberId: 'member-1', tier: 'Mountain Guide', totalPoints: 600 }]);
    const result = await getPremiumUpsellData();
    expect(result.benefits.length).toBeGreaterThan(0);
    expect(result.benefits[0]).toContain('Free shipping');
  });

  it('returns null for unauthenticated user', async () => {
    __setMember(null);
    const result = await getPremiumUpsellData();
    expect(result).toBeNull();
  });

  it('defaults to Trail Blazer when no MemberPoints record', async () => {
    const result = await getPremiumUpsellData();
    expect(result.tier).toBe('Trail Blazer');
    expect(result.eligible).toBe(false);
  });
});
