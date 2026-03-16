/**
 * membershipServiceDeep.test.js — Edge-case and integration tests for CF+ membership
 * via Wix Pricing Plans. Covers response shapes, fallback defaults, API edge cases,
 * and multi-order filtering.
 */
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
    getMember: vi.fn(() => {
      if (mockMember === null) return Promise.reject(new Error('No member'));
      return Promise.resolve(mockMember);
    }),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => String(s).trim(),
  validateId: (id) => (/^[a-f0-9-]+$/i.test(id) ? id : null),
}));

// ── Helpers ─────────────────────────────────────────────────────

function setMockMember(member) { mockMember = member; }
function setMockOrders(list) { mockOrders.length = 0; mockOrders.push(...list); }
function setMockPlans(list) { mockPlans.length = 0; mockPlans.push(...list); }
function resetMocks() { mockMember = null; mockOrders.length = 0; mockPlans.length = 0; }

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

beforeEach(() => {
  resetMocks();
  vi.clearAllMocks();
});

// ── getMembershipStatus response shape ─────────────────────────

describe('getMembershipStatus — response shape', () => {
  it('active status includes orderId, startDate, endDate', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([{
      _id: 'ord-1', planSlug: 'cf-plus-monthly', status: 'ACTIVE',
      planName: 'CF+ Monthly', startDate: '2026-01-01', endDate: '2026-01-31',
    }]);

    const status = await getMembershipStatus();
    expect(status).toEqual({
      active: true,
      planName: 'CF+ Monthly',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      orderId: 'ord-1',
    });
  });

  it('falls back to "CF+" when order has no planName', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([{
      _id: 'ord-1', planSlug: 'cf-plus-annual', status: 'ACTIVE',
      // planName intentionally missing
    }]);

    const status = await getMembershipStatus();
    expect(status.planName).toBe('CF+');
  });

  it('startDate and endDate are null when order omits them', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([{
      _id: 'ord-1', planSlug: 'cf-plus-monthly', status: 'ACTIVE', planName: 'CF+ Monthly',
      // startDate and endDate intentionally missing
    }]);

    const status = await getMembershipStatus();
    expect(status.startDate).toBeNull();
    expect(status.endDate).toBeNull();
  });

  it('inactive status has no extra fields', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([]);

    const status = await getMembershipStatus();
    expect(Object.keys(status)).toEqual(['active']);
    expect(status.active).toBe(false);
  });
});

// ── getMemberBadge edge cases ──────────────────────────────────

describe('getMemberBadge — edge cases', () => {
  it('falls back to "CF+" when order has no planName', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([{
      _id: 'ord-1', planSlug: 'cf-plus-monthly', status: 'ACTIVE',
      // no planName
    }]);

    const badge = await getMemberBadge();
    expect(badge).not.toBeNull();
    expect(badge.planName).toBe('CF+');
    expect(badge.label).toBe('CF+');
    expect(badge.color).toBe('#1a5276');
  });

  it('returns null for member with only ended orders', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([
      { _id: 'ord-1', planSlug: 'cf-plus-monthly', status: 'ENDED' },
      { _id: 'ord-2', planSlug: 'cf-plus-annual', status: 'CANCELLED' },
    ]);

    const badge = await getMemberBadge();
    expect(badge).toBeNull();
  });
});

// ── getActiveOrder — API edge cases ────────────────────────────

describe('getActiveOrder — API edge cases', () => {
  it('handles listOrders returning undefined orders array', async () => {
    setMockMember({ _id: 'm-1' });
    const { orders } = await import('wix-pricing-plans.v2');
    orders.listOrders.mockResolvedValueOnce({});  // no orders key

    const status = await getMembershipStatus();
    expect(status.active).toBe(false);
  });

  it('handles listOrders returning null orders array', async () => {
    setMockMember({ _id: 'm-1' });
    const { orders } = await import('wix-pricing-plans.v2');
    orders.listOrders.mockResolvedValueOnce({ orders: null });

    const status = await getMembershipStatus();
    expect(status.active).toBe(false);
  });

  it('handles listPublicPlans returning undefined plans array', async () => {
    const { plans } = await import('wix-pricing-plans.v2');
    plans.listPublicPlans.mockResolvedValueOnce({});  // no plans key

    const result = await getMembershipPlans();
    expect(result).toEqual([]);
  });

  it('handles listPublicPlans returning null plans array', async () => {
    const { plans } = await import('wix-pricing-plans.v2');
    plans.listPublicPlans.mockResolvedValueOnce({ plans: null });

    const result = await getMembershipPlans();
    expect(result).toEqual([]);
  });
});

// ── Multi-order filtering ──────────────────────────────────────

describe('multi-order filtering', () => {
  it('picks first active CF+ order when multiple exist', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([
      { _id: 'ord-monthly', planSlug: 'cf-plus-monthly', status: 'ACTIVE', planName: 'CF+ Monthly' },
      { _id: 'ord-annual', planSlug: 'cf-plus-annual', status: 'ACTIVE', planName: 'CF+ Annual' },
    ]);

    const status = await getMembershipStatus();
    expect(status.active).toBe(true);
    expect(status.orderId).toBe('ord-monthly');  // first match
  });

  it('skips PAUSED orders, finds active', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([
      { _id: 'ord-1', planSlug: 'cf-plus-monthly', status: 'PAUSED', planName: 'CF+ Monthly' },
      { _id: 'ord-2', planSlug: 'cf-plus-annual', status: 'ACTIVE', planName: 'CF+ Annual' },
    ]);

    const status = await getMembershipStatus();
    expect(status.active).toBe(true);
    expect(status.planName).toBe('CF+ Annual');
  });

  it('no active CF+ order among mixed statuses → inactive', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([
      { _id: 'ord-1', planSlug: 'cf-plus-monthly', status: 'ENDED' },
      { _id: 'ord-2', planSlug: 'cf-plus-annual', status: 'CANCELLED' },
      { _id: 'ord-3', planSlug: 'other-plan', status: 'ACTIVE' },
    ]);

    const status = await getMembershipStatus();
    expect(status.active).toBe(false);
  });
});

// ── getMemberBenefits — non-member response completeness ───────

describe('getMemberBenefits — response completeness', () => {
  it('non-member response includes all 5 benefit keys', async () => {
    const benefits = await getMemberBenefits();
    expect(benefits).toEqual({
      freeShipping: false,
      discountPercent: 0,
      earlyAccess: false,
      prioritySupport: false,
      badge: null,
    });
  });

  it('active member response includes all 5 benefit keys', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([{ _id: 'ord-1', planSlug: 'cf-plus-monthly', status: 'ACTIVE' }]);

    const benefits = await getMemberBenefits();
    expect(Object.keys(benefits).sort()).toEqual(
      ['badge', 'discountPercent', 'earlyAccess', 'freeShipping', 'prioritySupport']
    );
    expect(benefits.prioritySupport).toBe(true);
    expect(benefits.badge).toBe('CF+');
  });
});

// ── isCFPlusMember — edge cases ────────────────────────────────

describe('isCFPlusMember — edge cases', () => {
  it('returns false when getMember throws', async () => {
    // mockMember = null causes getMember to reject
    expect(await isCFPlusMember()).toBe(false);
  });

  it('returns false for member with PAUSED CF+ order', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([{ _id: 'ord-1', planSlug: 'cf-plus-monthly', status: 'PAUSED' }]);
    expect(await isCFPlusMember()).toBe(false);
  });

  it('returns true for annual plan', async () => {
    setMockMember({ _id: 'm-1' });
    setMockOrders([{ _id: 'ord-1', planSlug: 'cf-plus-annual', status: 'ACTIVE' }]);
    expect(await isCFPlusMember()).toBe(true);
  });
});

// ── PLAN_SLUGS / CF_PLUS_BENEFITS immutability ─────────────────

describe('exported constants', () => {
  it('PLAN_SLUGS has exactly MONTHLY and ANNUAL', () => {
    expect(Object.keys(PLAN_SLUGS).sort()).toEqual(['ANNUAL', 'MONTHLY']);
  });

  it('CF_PLUS_BENEFITS has exactly 4 benefit keys', () => {
    expect(Object.keys(CF_PLUS_BENEFITS).sort()).toEqual(
      ['discountPercent', 'earlyAccess', 'freeShippingThreshold', 'prioritySupport']
    );
  });
});
