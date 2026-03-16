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
    createOfflineOrder: vi.fn((planId, memberId) =>
      Promise.resolve({ order: { _id: 'order-1', planId, status: 'ACTIVE' } })
    ),
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

// ── Helpers ─────────────────────────────────────────────────────

function setMockMember(member) { mockMember = member; }
function setMockOrders(orders) { mockOrders.length = 0; mockOrders.push(...orders); }
function setMockPlans(plans) { mockPlans.length = 0; mockPlans.push(...plans); }

function resetMocks() {
  mockMember = null;
  mockOrders.length = 0;
  mockPlans.length = 0;
}

// ── Import SUT ──────────────────────────────────────────────────

const {
  getMembershipStatus,
  getMembershipPlans,
  getMemberBenefits,
  isCFPlusMember,
  getMemberBadge,
  CF_PLUS_BENEFITS,
  PLAN_SLUGS,
} = await import('../src/backend/membershipService.web.js');

// ── Tests ───────────────────────────────────────────────────────

describe('membershipService — CF-k6a0', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  // ── Constants ─────────────────────────────────────────────────

  describe('CF_PLUS_BENEFITS', () => {
    it('defines free shipping override', () => {
      expect(CF_PLUS_BENEFITS.freeShippingThreshold).toBe(0);
    });

    it('defines member discount percentage', () => {
      expect(CF_PLUS_BENEFITS.discountPercent).toBe(10);
    });

    it('grants early access', () => {
      expect(CF_PLUS_BENEFITS.earlyAccess).toBe(true);
    });

    it('grants priority support', () => {
      expect(CF_PLUS_BENEFITS.prioritySupport).toBe(true);
    });
  });

  describe('PLAN_SLUGS', () => {
    it('defines monthly and annual plan slugs', () => {
      expect(PLAN_SLUGS.MONTHLY).toBe('cf-plus-monthly');
      expect(PLAN_SLUGS.ANNUAL).toBe('cf-plus-annual');
    });
  });

  // ── getMembershipPlans ────────────────────────────────────────

  describe('getMembershipPlans', () => {
    it('returns available CF+ plans', async () => {
      setMockPlans([
        { _id: 'plan-m', slug: 'cf-plus-monthly', name: 'CF+ Monthly', pricing: { price: { value: '9.99', currency: 'USD' } }, active: true },
        { _id: 'plan-a', slug: 'cf-plus-annual', name: 'CF+ Annual', pricing: { price: { value: '99.00', currency: 'USD' } }, active: true },
        { _id: 'plan-x', slug: 'other-plan', name: 'Other', pricing: { price: { value: '5.00', currency: 'USD' } }, active: true },
      ]);

      const plans = await getMembershipPlans();
      expect(plans).toHaveLength(2);
      expect(plans[0].slug).toBe('cf-plus-monthly');
      expect(plans[1].slug).toBe('cf-plus-annual');
    });

    it('returns empty array when no CF+ plans exist', async () => {
      setMockPlans([
        { _id: 'plan-x', slug: 'other-plan', name: 'Other', pricing: { price: { value: '5.00' } }, active: true },
      ]);

      const plans = await getMembershipPlans();
      expect(plans).toHaveLength(0);
    });

    it('excludes inactive plans', async () => {
      setMockPlans([
        { _id: 'plan-m', slug: 'cf-plus-monthly', name: 'CF+ Monthly', pricing: { price: { value: '9.99' } }, active: false },
      ]);

      const plans = await getMembershipPlans();
      expect(plans).toHaveLength(0);
    });

    it('handles API errors gracefully', async () => {
      const { plans } = await import('wix-pricing-plans.v2');
      plans.listPublicPlans.mockRejectedValueOnce(new Error('API down'));
      const result = await getMembershipPlans();
      expect(result).toEqual([]);
    });
  });

  // ── getMembershipStatus ───────────────────────────────────────

  describe('getMembershipStatus', () => {
    it('returns active status for member with active CF+ order', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-m', planSlug: 'cf-plus-monthly', status: 'ACTIVE', planName: 'CF+ Monthly',
          startDate: '2026-01-01', endDate: '2026-12-31' },
      ]);

      const status = await getMembershipStatus();
      expect(status.active).toBe(true);
      expect(status.planName).toBe('CF+ Monthly');
    });

    it('returns inactive when no active orders', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-m', planSlug: 'cf-plus-monthly', status: 'ENDED', planName: 'CF+ Monthly' },
      ]);

      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });

    it('returns inactive when not logged in', async () => {
      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });

    it('returns inactive when no orders exist', async () => {
      setMockMember({ _id: 'member-1' });
      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });

    it('handles API errors gracefully', async () => {
      setMockMember({ _id: 'member-1' });
      const { orders } = await import('wix-pricing-plans.v2');
      orders.listOrders.mockRejectedValueOnce(new Error('fail'));
      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });

    it('returns inactive when getMember throws (transient auth error)', async () => {
      const { currentMember } = await import('wix-members-backend');
      currentMember.getMember.mockRejectedValueOnce(new Error('auth timeout'));
      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });
  });

  // ── getActiveOrder filtering ─────────────────────────────────

  describe('plan slug filtering', () => {
    it('ignores active orders on non-CF+ plans', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-x', planSlug: 'other-plan', status: 'ACTIVE', planName: 'Other Plan' },
      ]);

      const status = await getMembershipStatus();
      expect(status.active).toBe(false);
    });

    it('finds CF+ order among mixed plan orders', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-x', planSlug: 'other-plan', status: 'ACTIVE', planName: 'Other' },
        { _id: 'order-2', planId: 'plan-a', planSlug: 'cf-plus-annual', status: 'ACTIVE', planName: 'CF+ Annual' },
      ]);

      const status = await getMembershipStatus();
      expect(status.active).toBe(true);
      expect(status.planName).toBe('CF+ Annual');
    });

    it('passes buyerMemberId to listOrders', async () => {
      setMockMember({ _id: 'member-42' });
      setMockOrders([]);

      const { orders } = await import('wix-pricing-plans.v2');
      await getMembershipStatus();
      expect(orders.listOrders).toHaveBeenCalledWith({ buyerMemberId: 'member-42' });
    });
  });

  // ── isCFPlusMember ────────────────────────────────────────────

  describe('isCFPlusMember', () => {
    it('returns true for active member', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-m', planSlug: 'cf-plus-monthly', status: 'ACTIVE', planName: 'CF+ Monthly' },
      ]);

      expect(await isCFPlusMember()).toBe(true);
    });

    it('returns false for non-member', async () => {
      expect(await isCFPlusMember()).toBe(false);
    });

    it('returns false for expired member', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-m', planSlug: 'cf-plus-monthly', status: 'ENDED', planName: 'CF+ Monthly' },
      ]);

      expect(await isCFPlusMember()).toBe(false);
    });
  });

  // ── getMemberBenefits ─────────────────────────────────────────

  describe('getMemberBenefits', () => {
    it('returns CF+ benefits for active members', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-m', planSlug: 'cf-plus-monthly', status: 'ACTIVE', planName: 'CF+ Monthly' },
      ]);

      const benefits = await getMemberBenefits();
      expect(benefits.freeShipping).toBe(true);
      expect(benefits.discountPercent).toBe(10);
      expect(benefits.earlyAccess).toBe(true);
      expect(benefits.prioritySupport).toBe(true);
      expect(benefits.badge).toBe('CF+');
    });

    it('returns no benefits for non-members', async () => {
      const benefits = await getMemberBenefits();
      expect(benefits.freeShipping).toBe(false);
      expect(benefits.discountPercent).toBe(0);
      expect(benefits.earlyAccess).toBe(false);
      expect(benefits.badge).toBeNull();
    });

    it('returns no benefits for expired members', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-m', planSlug: 'cf-plus-monthly', status: 'ENDED' },
      ]);

      const benefits = await getMemberBenefits();
      expect(benefits.freeShipping).toBe(false);
      expect(benefits.discountPercent).toBe(0);
    });
  });

  // ── getMemberBadge ────────────────────────────────────────────

  describe('getMemberBadge', () => {
    it('returns CF+ badge for active members', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planId: 'plan-m', planSlug: 'cf-plus-annual', status: 'ACTIVE', planName: 'CF+ Annual' },
      ]);

      const badge = await getMemberBadge();
      expect(badge.label).toBe('CF+');
      expect(badge.color).toBe('#1a5276');
      expect(badge.planName).toBe('CF+ Annual');
    });

    it('returns null badge for non-members', async () => {
      const badge = await getMemberBadge();
      expect(badge).toBeNull();
    });
  });
});
