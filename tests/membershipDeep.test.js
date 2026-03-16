/**
 * Deep coverage tests for membershipService.web.js + membershipHelpers.js —
 * edge cases in plan filtering, savings calculations, date formatting,
 * and benefit/badge defaults.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Membership Helpers Deep Tests ──────────────────────────────────

const {
  formatPlanPrice,
  getPlanSavings,
  getBenefitsList,
  getMembershipCTA,
  formatRenewalDate,
} = await import('../src/public/membershipHelpers.js');

describe('membershipHelpers deep coverage', () => {

  describe('formatPlanPrice — edge cases', () => {
    it('returns empty for undefined price', () => {
      expect(formatPlanPrice(undefined, 'monthly')).toBe('');
    });

    it('returns empty for price with no value', () => {
      expect(formatPlanPrice({ currency: 'USD' }, 'monthly')).toBe('');
    });

    it('returns empty for price with empty string value', () => {
      expect(formatPlanPrice({ value: '' }, 'monthly')).toBe('');
    });

    it('defaults to /mo suffix for unknown period', () => {
      expect(formatPlanPrice({ value: '5.00' }, 'weekly')).toBe('$5.00/mo');
    });

    it('defaults to /mo suffix for null period', () => {
      expect(formatPlanPrice({ value: '5.00' }, null)).toBe('$5.00/mo');
    });

    it('handles zero price value', () => {
      expect(formatPlanPrice({ value: '0' }, 'monthly')).toBe('$0/mo');
    });

    it('preserves price format from value string', () => {
      expect(formatPlanPrice({ value: '9.9' }, 'monthly')).toBe('$9.9/mo');
    });
  });

  describe('getPlanSavings — edge cases', () => {
    it('returns zero when annual is more expensive than monthly * 12', () => {
      const savings = getPlanSavings(10, 130);
      expect(savings.amount).toBe(0);
      expect(savings.percent).toBe(0);
    });

    it('handles negative monthly price', () => {
      const savings = getPlanSavings(-5, 50);
      expect(savings.amount).toBe(0);
      expect(savings.percent).toBe(0);
    });

    it('calculates savings with decimal prices', () => {
      const savings = getPlanSavings(4.99, 49.99);
      expect(savings.amount).toBeGreaterThan(0);
      expect(savings.percent).toBeGreaterThan(0);
    });

    it('returns zero for very small monthly price', () => {
      const savings = getPlanSavings(0.01, 0.12);
      expect(savings.amount).toBe(0);
      expect(savings.percent).toBe(0);
    });

    it('handles Infinity monthly price', () => {
      const savings = getPlanSavings(Infinity, 100);
      // Infinity * 12 = Infinity, Infinity - 100 = Infinity
      // Math.round(Infinity/Infinity * 100) = NaN
      expect(savings.amount).toBe(Infinity);
    });

    it('rounds amount to 2 decimal places', () => {
      const savings = getPlanSavings(9.99, 99.00);
      const str = savings.amount.toString();
      const parts = str.split('.');
      if (parts[1]) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('getBenefitsList — immutability', () => {
    it('returns fresh array each call', () => {
      const a = getBenefitsList();
      const b = getBenefitsList();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    it('modifying returned array does not affect next call', () => {
      const list = getBenefitsList();
      list.push('Hacked benefit');
      const list2 = getBenefitsList();
      expect(list2).not.toContain('Hacked benefit');
    });

    it('all items are non-empty strings', () => {
      for (const benefit of getBenefitsList()) {
        expect(typeof benefit).toBe('string');
        expect(benefit.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getMembershipCTA — edge cases', () => {
    it('returns signup for falsy value (null)', () => {
      expect(getMembershipCTA(null).action).toBe('signup');
    });

    it('returns signup for falsy value (0)', () => {
      expect(getMembershipCTA(0).action).toBe('signup');
    });

    it('returns signup for falsy value (undefined)', () => {
      expect(getMembershipCTA(undefined).action).toBe('signup');
    });

    it('returns manage for truthy non-boolean (string)', () => {
      expect(getMembershipCTA('yes').action).toBe('manage');
    });
  });

  describe('formatRenewalDate — edge cases', () => {
    it('returns empty for empty string', () => {
      expect(formatRenewalDate('')).toBe('');
    });

    it('returns empty for undefined', () => {
      expect(formatRenewalDate(undefined)).toBe('');
    });

    it('formats date without time component', () => {
      const result = formatRenewalDate('2026-12-25');
      expect(result).toMatch(/Dec.*2[45].*2026/);
    });

    it('handles epoch timestamp string gracefully', () => {
      // UTC midnight renders as Dec 31 1999 in US timezones
      const result = formatRenewalDate('2000-01-01T00:00:00Z');
      expect(result).toMatch(/(Dec.*1999|Jan.*2000)/);
    });

    it('returns empty for date-like but invalid string', () => {
      expect(formatRenewalDate('2026-13-45')).toBe('');
    });
  });
});

// ── Membership Service Deep Tests ──────────────────────────────────

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

function setMockMember(m) { mockMember = m; }
function setMockOrders(o) { mockOrders.length = 0; mockOrders.push(...o); }
function setMockPlans(p) { mockPlans.length = 0; mockPlans.push(...p); }
function resetMocks() { mockMember = null; mockOrders.length = 0; mockPlans.length = 0; }

const {
  getMembershipStatus,
  getMembershipPlans,
  getMemberBenefits,
  isCFPlusMember,
  getMemberBadge,
  PLAN_SLUGS,
} = await import('../src/backend/membershipService.web.js');

describe('membershipService deep coverage', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  describe('getMembershipStatus — default values', () => {
    it('uses CF+ as default planName when order has no planName', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planSlug: 'cf-plus-monthly', status: 'ACTIVE' },
      ]);

      const status = await getMembershipStatus();
      expect(status.active).toBe(true);
      expect(status.planName).toBe('CF+');
    });

    it('returns null dates when order has no dates', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planSlug: 'cf-plus-annual', status: 'ACTIVE', planName: 'CF+ Annual' },
      ]);

      const status = await getMembershipStatus();
      expect(status.startDate).toBeNull();
      expect(status.endDate).toBeNull();
    });

    it('includes orderId in status response', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-99', planSlug: 'cf-plus-monthly', status: 'ACTIVE', planName: 'CF+ Monthly' },
      ]);

      const status = await getMembershipStatus();
      expect(status.orderId).toBe('order-99');
    });
  });

  describe('getMembershipPlans — filtering', () => {
    it('handles empty plans array from API', async () => {
      const { plans } = await import('wix-pricing-plans.v2');
      plans.listPublicPlans.mockResolvedValueOnce({ plans: [] });
      const result = await getMembershipPlans();
      expect(result).toEqual([]);
    });

    it('handles API returning undefined plans', async () => {
      const { plans } = await import('wix-pricing-plans.v2');
      plans.listPublicPlans.mockResolvedValueOnce({});
      const result = await getMembershipPlans();
      expect(result).toEqual([]);
    });

    it('does not include plans with null slug', async () => {
      setMockPlans([
        { _id: 'plan-1', slug: null, name: 'No Slug Plan', active: true },
      ]);
      const result = await getMembershipPlans();
      expect(result).toHaveLength(0);
    });
  });

  describe('getActiveOrder — order selection priority', () => {
    it('returns first matching active CF+ order', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planSlug: 'cf-plus-monthly', status: 'ACTIVE', planName: 'CF+ Monthly' },
        { _id: 'order-2', planSlug: 'cf-plus-annual', status: 'ACTIVE', planName: 'CF+ Annual' },
      ]);

      const status = await getMembershipStatus();
      expect(status.planName).toBe('CF+ Monthly'); // First match wins
    });

    it('skips CANCELLED orders to find ACTIVE', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planSlug: 'cf-plus-monthly', status: 'CANCELLED', planName: 'CF+ Monthly' },
        { _id: 'order-2', planSlug: 'cf-plus-annual', status: 'ACTIVE', planName: 'CF+ Annual' },
      ]);

      const status = await getMembershipStatus();
      expect(status.active).toBe(true);
      expect(status.planName).toBe('CF+ Annual');
    });

    it('handles orders with missing status field', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planSlug: 'cf-plus-monthly', planName: 'CF+ Monthly' },
      ]);

      const status = await getMembershipStatus();
      expect(status.active).toBe(false); // undefined !== 'ACTIVE'
    });
  });

  describe('getMemberBadge — defaults', () => {
    it('uses CF+ as default planName in badge', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planSlug: 'cf-plus-monthly', status: 'ACTIVE' },
      ]);

      const badge = await getMemberBadge();
      expect(badge.planName).toBe('CF+');
    });

    it('badge color is a valid hex color', async () => {
      setMockMember({ _id: 'member-1' });
      setMockOrders([
        { _id: 'order-1', planSlug: 'cf-plus-monthly', status: 'ACTIVE', planName: 'CF+' },
      ]);

      const badge = await getMemberBadge();
      expect(badge.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('getMemberBenefits — non-member defaults', () => {
    it('non-member benefits include all expected keys', async () => {
      const benefits = await getMemberBenefits();
      expect(benefits).toHaveProperty('freeShipping');
      expect(benefits).toHaveProperty('discountPercent');
      expect(benefits).toHaveProperty('earlyAccess');
      expect(benefits).toHaveProperty('prioritySupport');
      expect(benefits).toHaveProperty('badge');
    });

    it('non-member gets no priority support', async () => {
      const benefits = await getMemberBenefits();
      expect(benefits.prioritySupport).toBe(false);
    });
  });

  describe('PLAN_SLUGS — format', () => {
    it('slugs use lowercase with hyphens', () => {
      expect(PLAN_SLUGS.MONTHLY).toMatch(/^[a-z0-9-]+$/);
      expect(PLAN_SLUGS.ANNUAL).toMatch(/^[a-z0-9-]+$/);
    });

    it('both slugs start with cf-plus', () => {
      expect(PLAN_SLUGS.MONTHLY).toMatch(/^cf-plus-/);
      expect(PLAN_SLUGS.ANNUAL).toMatch(/^cf-plus-/);
    });
  });
});
