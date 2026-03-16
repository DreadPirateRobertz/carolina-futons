import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Infrastructure ──────────────────────────────────────────

const mockOrders = [];
const mockPlans = [];
let mockMember = null;

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-pricing-plans.v2', () => ({
  orders: {
    listOrders: vi.fn(() => Promise.resolve({ orders: mockOrders })),
  },
  plans: {
    listPublicPlans: vi.fn(() => Promise.resolve({ plans: mockPlans })),
  },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(mockMember)),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => String(s).trim(),
  validateId: (id) => (/^[a-f0-9-]+$/i.test(id) ? id : null),
}));

function setMockMember(member) { mockMember = member; }
function setMockOrders(orders) { mockOrders.length = 0; mockOrders.push(...orders); }
function setMockPlans(plans) { mockPlans.length = 0; mockPlans.push(...plans); }
function resetMocks() { mockMember = null; mockOrders.length = 0; mockPlans.length = 0; }

const {
  getMembershipStatus,
  getMembershipPlans,
  getMemberBenefits,
  isCFPlusMember,
  getMemberBadge,
  CF_PLUS_BENEFITS,
  PLAN_SLUGS,
} = await import('../src/backend/membershipService.web.js');

// ── Edge Case Tests ──────────────────────────────────────────────

describe('membershipService edge cases — CF-k6a0', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  // ── getMembershipPlans edge cases ──────────────────────────────

  describe('getMembershipPlans edge cases', () => {
    it('returns empty when plans response has no plans key', async () => {
      const { plans } = await import('wix-pricing-plans.v2');
      plans.listPublicPlans.mockResolvedValueOnce({});
      const result = await getMembershipPlans();
      expect(result).toEqual([]);
    });

    it('returns empty when plans response is null-ish', async () => {
      const { plans } = await import('wix-pricing-plans.v2');
      plans.listPublicPlans.mockResolvedValueOnce({ plans: null });
      const result = await getMembershipPlans();
      expect(result).toEqual([]);
    });

    it('filters correctly with only annual plan active', async () => {
      setMockPlans([
        { _id: 'p-m', slug: 'cf-plus-monthly', name: 'Monthly', active: false },
        { _id: 'p-a', slug: 'cf-plus-annual', name: 'Annual', active: true },
      ]);
      const result = await getMembershipPlans();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('cf-plus-annual');
    });
  });

  // ── getMembershipStatus edge cases ─────────────────────────────

  describe('getMembershipStatus edge cases', () => {
    it('handles missing planName gracefully', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'ACTIVE', planSlug: 'cf-plus-monthly', startDate: '2026-01-01', endDate: '2026-12-31' },
      ]);
      const status = await getMembershipStatus();
      expect(status.active).toBe(true);
      expect(status.planName).toBe('CF+'); // fallback
    });

    it('handles missing dates gracefully', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'ACTIVE', planSlug: 'cf-plus-monthly', planName: 'Monthly' },
      ]);
      const status = await getMembershipStatus();
      expect(status.startDate).toBeNull();
      expect(status.endDate).toBeNull();
    });

    it('returns orderId in status', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'order-abc', status: 'ACTIVE', planSlug: 'cf-plus-annual', planName: 'Annual' },
      ]);
      const status = await getMembershipStatus();
      expect(status.orderId).toBe('order-abc');
    });

    it('ignores PAUSED orders', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'PAUSED', planSlug: 'cf-plus-monthly', planName: 'Monthly' },
      ]);
      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });

    it('ignores CANCELLED orders', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'CANCELLED', planSlug: 'cf-plus-monthly' },
      ]);
      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });

    it('handles orders response with no orders key', async () => {
      setMockMember({ _id: 'm-1' });
      const { orders } = await import('wix-pricing-plans.v2');
      orders.listOrders.mockResolvedValueOnce({});
      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });
  });

  // ── isCFPlusMember edge cases ──────────────────────────────────

  describe('isCFPlusMember edge cases', () => {
    it('returns false when member has non-CF+ active order only', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'ACTIVE', planSlug: 'warranty-plan' },
      ]);
      expect(await isCFPlusMember()).toBe(false);
    });

    it('returns true with annual plan', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'ACTIVE', planSlug: 'cf-plus-annual' },
      ]);
      expect(await isCFPlusMember()).toBe(true);
    });
  });

  // ── getMemberBenefits edge cases ───────────────────────────────

  describe('getMemberBenefits edge cases', () => {
    it('returns correct discount percentage', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'ACTIVE', planSlug: 'cf-plus-monthly' },
      ]);
      const benefits = await getMemberBenefits();
      expect(benefits.discountPercent).toBe(CF_PLUS_BENEFITS.discountPercent);
    });

    it('returns prioritySupport for non-members as false', async () => {
      const benefits = await getMemberBenefits();
      expect(benefits.prioritySupport).toBe(false);
    });
  });

  // ── getMemberBadge edge cases ──────────────────────────────────

  describe('getMemberBadge edge cases', () => {
    it('returns correct badge for monthly plan', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'ACTIVE', planSlug: 'cf-plus-monthly', planName: 'CF+ Monthly' },
      ]);
      const badge = await getMemberBadge();
      expect(badge.label).toBe('CF+');
      expect(badge.planName).toBe('CF+ Monthly');
    });

    it('falls back planName to CF+ when missing', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'ACTIVE', planSlug: 'cf-plus-annual' },
      ]);
      const badge = await getMemberBadge();
      expect(badge.planName).toBe('CF+');
    });

    it('returns null for member with only expired orders', async () => {
      setMockMember({ _id: 'm-1' });
      setMockOrders([
        { _id: 'o-1', status: 'ENDED', planSlug: 'cf-plus-monthly' },
        { _id: 'o-2', status: 'CANCELLED', planSlug: 'cf-plus-annual' },
      ]);
      const badge = await getMemberBadge();
      expect(badge).toBeNull();
    });
  });

  // ── Constants validation ───────────────────────────────────────

  describe('constants', () => {
    it('PLAN_SLUGS has exactly 2 plans', () => {
      expect(Object.keys(PLAN_SLUGS)).toHaveLength(2);
    });

    it('CF_PLUS_BENEFITS has all required keys', () => {
      expect(CF_PLUS_BENEFITS).toHaveProperty('freeShippingThreshold');
      expect(CF_PLUS_BENEFITS).toHaveProperty('discountPercent');
      expect(CF_PLUS_BENEFITS).toHaveProperty('earlyAccess');
      expect(CF_PLUS_BENEFITS).toHaveProperty('prioritySupport');
    });
  });
});
