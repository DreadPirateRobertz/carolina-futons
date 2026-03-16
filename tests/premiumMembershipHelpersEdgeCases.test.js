import { describe, it, expect } from 'vitest';

const {
  formatPlanPrice,
  getPlanSavings,
  formatMemberBadge,
  getMembershipStatusLabel,
  formatRenewalDate,
  calculateAnnualSavings,
  getBenefitsList,
  isPremiumMember,
} = await import('../src/public/premiumMembershipHelpers.js');

describe('premiumMembershipHelpers edge cases', () => {

  // ── formatPlanPrice ────────────────────────────────────────────

  describe('formatPlanPrice', () => {
    it('formats zero price', () => {
      expect(formatPlanPrice(0, 'monthly')).toBe('$0.00/mo');
    });

    it('formats null price as $0.00', () => {
      expect(formatPlanPrice(null, 'annual')).toBe('$0.00/yr');
    });

    it('formats undefined price as $0.00', () => {
      expect(formatPlanPrice(undefined, 'monthly')).toBe('$0.00/mo');
    });

    it('formats string price via Number coercion', () => {
      expect(formatPlanPrice('14.99', 'monthly')).toBe('$14.99/mo');
    });

    it('returns no suffix for unknown plan type', () => {
      expect(formatPlanPrice(9.99, 'weekly')).toBe('$9.99');
    });

    it('formats large price', () => {
      expect(formatPlanPrice(1999.99, 'annual')).toBe('$1999.99/yr');
    });
  });

  // ── getPlanSavings ─────────────────────────────────────────────

  describe('getPlanSavings', () => {
    it('returns 0 when annual is more expensive', () => {
      expect(getPlanSavings(10, 200)).toBe(0);
    });

    it('returns 0 for null inputs', () => {
      expect(getPlanSavings(null, null)).toBe(0);
    });

    it('handles string inputs via Number coercion', () => {
      const savings = getPlanSavings('14.99', '119.99');
      expect(savings).toBeCloseTo(59.89, 2);
    });

    it('calculates correctly for exact monthly * 12 == annual', () => {
      expect(getPlanSavings(10, 120)).toBe(0);
    });

    it('clamps negative savings to 0', () => {
      // annual costs more than 12 * monthly
      expect(getPlanSavings(5, 100)).toBe(0);
    });
  });

  // ── formatMemberBadge ──────────────────────────────────────────

  describe('formatMemberBadge', () => {
    it('returns hidden badge for false', () => {
      const badge = formatMemberBadge(false);
      expect(badge.visible).toBe(false);
      expect(badge.text).toBe('');
    });

    it('returns hidden badge for null', () => {
      const badge = formatMemberBadge(null);
      expect(badge.visible).toBe(false);
    });

    it('returns visible badge for true', () => {
      const badge = formatMemberBadge(true);
      expect(badge.visible).toBe(true);
      expect(badge.text).toBe('CF+ Member');
      expect(badge).toHaveProperty('color');
    });
  });

  // ── getMembershipStatusLabel ────────────────────────────────────

  describe('getMembershipStatusLabel', () => {
    it('returns Active for active', () => {
      expect(getMembershipStatusLabel('active')).toBe('Active');
    });

    it('returns Cancelled for cancelled', () => {
      expect(getMembershipStatusLabel('cancelled')).toBe('Cancelled');
    });

    it('returns Expired for expired', () => {
      expect(getMembershipStatusLabel('expired')).toBe('Expired');
    });

    it('returns Unknown for null', () => {
      expect(getMembershipStatusLabel(null)).toBe('Unknown');
    });

    it('returns Unknown for empty string', () => {
      expect(getMembershipStatusLabel('')).toBe('Unknown');
    });

    it('returns Unknown for unrecognized status', () => {
      expect(getMembershipStatusLabel('paused')).toBe('Unknown');
    });
  });

  // ── formatRenewalDate ──────────────────────────────────────────

  describe('formatRenewalDate', () => {
    it('formats Date object', () => {
      const result = formatRenewalDate(new Date('2026-06-15T12:00:00Z'));
      expect(result).toMatch(/June 15, 2026/);
    });

    it('formats ISO string', () => {
      const result = formatRenewalDate('2026-12-25T00:00:00Z');
      expect(result).toMatch(/December 25, 2026/);
    });

    it('returns empty for null', () => {
      expect(formatRenewalDate(null)).toBe('');
    });

    it('returns empty for undefined', () => {
      expect(formatRenewalDate(undefined)).toBe('');
    });

    it('returns empty for invalid date string', () => {
      expect(formatRenewalDate('not-a-date')).toBe('');
    });

    it('returns empty for empty string', () => {
      expect(formatRenewalDate('')).toBe('');
    });
  });

  // ── calculateAnnualSavings ─────────────────────────────────────

  describe('calculateAnnualSavings', () => {
    it('calculates 10% of $1000', () => {
      expect(calculateAnnualSavings(1000, 10)).toBe(100);
    });

    it('rounds to 2 decimal places', () => {
      expect(calculateAnnualSavings(333, 10)).toBe(33.3);
    });

    it('returns 0 for null spend', () => {
      expect(calculateAnnualSavings(null, 10)).toBe(0);
    });

    it('returns 0 for null percent', () => {
      expect(calculateAnnualSavings(1000, null)).toBe(0);
    });

    it('returns 0 for zero spend', () => {
      expect(calculateAnnualSavings(0, 10)).toBe(0);
    });

    it('handles string inputs', () => {
      expect(calculateAnnualSavings('500', '10')).toBe(50);
    });
  });

  // ── getBenefitsList ────────────────────────────────────────────

  describe('getBenefitsList', () => {
    it('returns at least 4 benefits', () => {
      expect(getBenefitsList().length).toBeGreaterThanOrEqual(4);
    });

    it('includes shipping benefit', () => {
      expect(getBenefitsList().some(b => b.toLowerCase().includes('shipping'))).toBe(true);
    });

    it('includes discount benefit', () => {
      expect(getBenefitsList().some(b => b.includes('10%'))).toBe(true);
    });
  });

  // ── isPremiumMember ────────────────────────────────────────────

  describe('isPremiumMember', () => {
    it('returns true for active success result', () => {
      expect(isPremiumMember({ success: true, isActive: true })).toBe(true);
    });

    it('returns false for inactive success result', () => {
      expect(isPremiumMember({ success: true, isActive: false })).toBe(false);
    });

    it('returns false for failed result', () => {
      expect(isPremiumMember({ success: false, isActive: true })).toBe(false);
    });

    it('returns false for null', () => {
      expect(isPremiumMember(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isPremiumMember(undefined)).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isPremiumMember({})).toBe(false);
    });
  });
});
