import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

let mockMember = null;
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(mockMember)),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => String(s).trim(),
}));

const {
  getMembershipPlans,
  checkMembershipStatus,
  getMemberBenefits,
  activateMembership,
  cancelMembership,
  applyMemberDiscount,
} = await import('../src/backend/premiumMembership.web.js');

describe('premiumMembership edge cases', () => {
  beforeEach(() => {
    mockMember = null;
    __seed('PremiumMemberships', []);
    vi.clearAllMocks();
  });

  // ── getMembershipPlans ─────────────────────────────────────────

  describe('getMembershipPlans', () => {
    it('returns both plans with correct structure', async () => {
      const result = await getMembershipPlans();
      expect(result.success).toBe(true);
      expect(result.plans).toHaveLength(2);

      const monthly = result.plans.find(p => p.type === 'monthly');
      expect(monthly.id).toBe('cf-plus-monthly');
      expect(monthly.price).toBe(14.99);
      expect(monthly.benefits.length).toBeGreaterThanOrEqual(4);

      const annual = result.plans.find(p => p.type === 'annual');
      expect(annual.id).toBe('cf-plus-annual');
      expect(annual.price).toBe(119.99);
    });

    it('returns defensive copies of benefits arrays', async () => {
      const result1 = await getMembershipPlans();
      const result2 = await getMembershipPlans();
      result1.plans[0].benefits.push('hacked');
      expect(result2.plans[0].benefits).not.toContain('hacked');
    });
  });

  // ── checkMembershipStatus ──────────────────────────────────────

  describe('checkMembershipStatus', () => {
    it('returns not authenticated when member is null', async () => {
      mockMember = null;
      const result = await checkMembershipStatus();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/authenticated/i);
    });

    it('returns not authenticated when member has no _id', async () => {
      mockMember = { name: 'Test' };
      const result = await checkMembershipStatus();
      expect(result.success).toBe(false);
    });

    it('auto-expires membership when endDate is past', async () => {
      mockMember = { _id: 'm-1' };
      const updates = [];
      __onUpdate((col, item) => { if (col === 'PremiumMemberships') updates.push(item); });

      __seed('PremiumMemberships', [{
        _id: 'pm-1', memberId: 'm-1', planType: 'monthly', status: 'active',
        startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31'),
      }]);

      const result = await checkMembershipStatus();
      expect(result.success).toBe(true);
      expect(result.isActive).toBe(false);
      expect(updates).toHaveLength(1);
      expect(updates[0].status).toBe('expired');
    });

    it('returns active when endDate is in the future', async () => {
      mockMember = { _id: 'm-1' };
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      __seed('PremiumMemberships', [{
        _id: 'pm-1', memberId: 'm-1', planType: 'annual', status: 'active',
        startDate: new Date(), endDate: futureDate,
      }]);

      const result = await checkMembershipStatus();
      expect(result.isActive).toBe(true);
      expect(result.planType).toBe('annual');
    });

    it('returns inactive when only cancelled memberships exist', async () => {
      mockMember = { _id: 'm-1' };
      __seed('PremiumMemberships', [{
        _id: 'pm-1', memberId: 'm-1', planType: 'monthly', status: 'cancelled',
      }]);

      const result = await checkMembershipStatus();
      expect(result.isActive).toBe(false);
    });

    it('handles getMember throwing', async () => {
      const { currentMember } = await import('wix-members-backend');
      currentMember.getMember.mockRejectedValueOnce(new Error('auth fail'));
      const result = await checkMembershipStatus();
      expect(result.success).toBe(false);
    });
  });

  // ── activateMembership ─────────────────────────────────────────

  describe('activateMembership', () => {
    it('rejects non-string memberId', async () => {
      const result = await activateMembership(123, 'monthly');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Member ID/);
    });

    it('rejects empty memberId', async () => {
      const result = await activateMembership('', 'monthly');
      expect(result.success).toBe(false);
    });

    it('rejects null memberId', async () => {
      const result = await activateMembership(null, 'monthly');
      expect(result.success).toBe(false);
    });

    it('rejects invalid plan type', async () => {
      const result = await activateMembership('m-1', 'weekly');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/plan type/i);
    });

    it('cancels existing active membership before creating new', async () => {
      const updates = [];
      __onUpdate((col, item) => { if (col === 'PremiumMemberships') updates.push(item); });

      __seed('PremiumMemberships', [{
        _id: 'pm-old', memberId: 'm-1', planType: 'monthly', status: 'active',
        startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000),
      }]);

      const result = await activateMembership('m-1', 'annual');
      expect(result.success).toBe(true);
      expect(result.planType).toBe('annual');
      expect(updates).toHaveLength(1);
      expect(updates[0].status).toBe('cancelled');
      expect(updates[0].cancelledAt).toBeInstanceOf(Date);
    });

    it('creates membership with correct endDate for monthly', async () => {
      const result = await activateMembership('m-1', 'monthly');
      expect(result.success).toBe(true);
      const diff = result.endDate.getTime() - Date.now();
      // Should be ~30 days (within 5 sec tolerance)
      expect(diff).toBeGreaterThan(29 * 86400000);
      expect(diff).toBeLessThan(31 * 86400000);
    });

    it('creates membership with correct endDate for annual', async () => {
      const result = await activateMembership('m-1', 'annual');
      expect(result.success).toBe(true);
      const diff = result.endDate.getTime() - Date.now();
      expect(diff).toBeGreaterThan(364 * 86400000);
      expect(diff).toBeLessThan(366 * 86400000);
    });

    it('returns membershipId on success', async () => {
      const result = await activateMembership('m-1', 'monthly');
      expect(result.membershipId).toBeDefined();
    });
  });

  // ── cancelMembership ───────────────────────────────────────────

  describe('cancelMembership', () => {
    it('rejects non-string memberId', async () => {
      const result = await cancelMembership(42);
      expect(result.success).toBe(false);
    });

    it('returns error when no active membership exists', async () => {
      const result = await cancelMembership('m-1');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no active/i);
    });

    it('sets cancelledAt timestamp', async () => {
      const updates = [];
      __onUpdate((col, item) => { if (col === 'PremiumMemberships') updates.push(item); });

      __seed('PremiumMemberships', [{
        _id: 'pm-1', memberId: 'm-1', planType: 'monthly', status: 'active',
      }]);

      const result = await cancelMembership('m-1');
      expect(result.success).toBe(true);
      expect(updates[0].cancelledAt).toBeInstanceOf(Date);
      expect(updates[0].status).toBe('cancelled');
    });
  });

  // ── applyMemberDiscount ────────────────────────────────────────

  describe('applyMemberDiscount', () => {
    it('rejects negative order total', async () => {
      mockMember = { _id: 'm-1' };
      const result = await applyMemberDiscount(-50);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid/i);
    });

    it('rejects NaN order total', async () => {
      mockMember = { _id: 'm-1' };
      const result = await applyMemberDiscount('not-a-number');
      expect(result.success).toBe(false);
    });

    it('rejects Infinity order total', async () => {
      mockMember = { _id: 'm-1' };
      const result = await applyMemberDiscount(Infinity);
      expect(result.success).toBe(false);
    });

    it('handles zero order total for active member', async () => {
      mockMember = { _id: 'm-1' };
      __seed('PremiumMemberships', [{
        _id: 'pm-1', memberId: 'm-1', planType: 'monthly', status: 'active',
        endDate: new Date(Date.now() + 30 * 86400000),
      }]);

      const result = await applyMemberDiscount(0);
      expect(result.success).toBe(true);
      expect(result.discountAmount).toBe(0);
      expect(result.finalTotal).toBe(0);
      expect(result.freeShipping).toBe(true);
    });

    it('applies 10% discount correctly', async () => {
      mockMember = { _id: 'm-1' };
      __seed('PremiumMemberships', [{
        _id: 'pm-1', memberId: 'm-1', planType: 'monthly', status: 'active',
        endDate: new Date(Date.now() + 30 * 86400000),
      }]);

      const result = await applyMemberDiscount(100);
      expect(result.discountAmount).toBe(10);
      expect(result.finalTotal).toBe(90);
      expect(result.discountPercent).toBe(10);
    });

    it('rounds discount to 2 decimal places', async () => {
      mockMember = { _id: 'm-1' };
      __seed('PremiumMemberships', [{
        _id: 'pm-1', memberId: 'm-1', planType: 'monthly', status: 'active',
        endDate: new Date(Date.now() + 30 * 86400000),
      }]);

      const result = await applyMemberDiscount(33.33);
      // 33.33 * 10% = 3.333 -> rounded to 3.33
      expect(result.discountAmount).toBe(3.33);
      expect(result.finalTotal).toBe(30);
    });

    it('returns no discount for non-member', async () => {
      mockMember = { _id: 'm-1' };
      const result = await applyMemberDiscount(100);
      expect(result.discountAmount).toBe(0);
      expect(result.freeShipping).toBe(false);
      expect(result.finalTotal).toBe(100);
    });

    it('coerces string order total to number', async () => {
      mockMember = { _id: 'm-1' };
      const result = await applyMemberDiscount('200');
      expect(result.success).toBe(true);
      expect(result.finalTotal).toBe(200); // no discount, no membership
    });
  });

  // ── getMemberBenefits ──────────────────────────────────────────

  describe('getMemberBenefits', () => {
    it('returns not authenticated for unauthenticated user', async () => {
      mockMember = null;
      const result = await getMemberBenefits();
      expect(result.success).toBe(false);
    });

    it('returns full benefits for active member', async () => {
      mockMember = { _id: 'm-1' };
      __seed('PremiumMemberships', [{
        _id: 'pm-1', memberId: 'm-1', status: 'active',
        endDate: new Date(Date.now() + 86400000),
      }]);

      const result = await getMemberBenefits();
      expect(result.freeShipping).toBe(true);
      expect(result.discountPercent).toBe(10);
      expect(result.earlyAccess).toBe(true);
    });
  });
});
