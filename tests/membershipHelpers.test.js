import { describe, it, expect } from 'vitest';

const {
  formatPlanPrice,
  getPlanSavings,
  getBenefitsList,
  getMembershipCTA,
  formatRenewalDate,
} = await import('../src/public/membershipHelpers.js');

describe('membershipHelpers — CF-k6a0', () => {

  describe('formatPlanPrice', () => {
    it('formats monthly price', () => {
      expect(formatPlanPrice({ value: '9.99', currency: 'USD' }, 'monthly')).toBe('$9.99/mo');
    });

    it('formats annual price', () => {
      expect(formatPlanPrice({ value: '99.00', currency: 'USD' }, 'annual')).toBe('$99.00/yr');
    });

    it('handles missing currency gracefully', () => {
      expect(formatPlanPrice({ value: '9.99' }, 'monthly')).toBe('$9.99/mo');
    });

    it('returns empty string for null price', () => {
      expect(formatPlanPrice(null, 'monthly')).toBe('');
    });
  });

  describe('getPlanSavings', () => {
    it('calculates annual savings vs monthly', () => {
      const savings = getPlanSavings(9.99, 99.00);
      expect(savings.amount).toBeCloseTo(20.88, 2);
      expect(savings.percent).toBeCloseTo(17, 0);
    });

    it('returns zero savings when annual equals monthly * 12', () => {
      const savings = getPlanSavings(10, 120);
      expect(savings.amount).toBe(0);
      expect(savings.percent).toBe(0);
    });

    it('handles zero monthly price', () => {
      const savings = getPlanSavings(0, 0);
      expect(savings.amount).toBe(0);
    });
  });

  describe('getBenefitsList', () => {
    it('returns list of CF+ benefit descriptions', () => {
      const list = getBenefitsList();
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.some(b => b.includes('shipping'))).toBe(true);
      expect(list.some(b => b.includes('discount') || b.includes('10%'))).toBe(true);
      expect(list.some(b => b.toLowerCase().includes('early access'))).toBe(true);
      expect(list.some(b => b.toLowerCase().includes('support'))).toBe(true);
    });
  });

  describe('getMembershipCTA', () => {
    it('returns upgrade CTA for non-members', () => {
      const cta = getMembershipCTA(false);
      expect(cta.text).toMatch(/join|upgrade/i);
      expect(cta.action).toBe('signup');
    });

    it('returns manage CTA for active members', () => {
      const cta = getMembershipCTA(true);
      expect(cta.text).toMatch(/manage|view/i);
      expect(cta.action).toBe('manage');
    });
  });

  describe('formatRenewalDate', () => {
    it('formats ISO date to readable string', () => {
      const result = formatRenewalDate('2026-04-15T12:00:00.000Z');
      expect(result).toMatch(/Apr.*1[45].*2026/);
    });

    it('returns empty string for null', () => {
      expect(formatRenewalDate(null)).toBe('');
    });

    it('returns empty string for invalid date', () => {
      expect(formatRenewalDate('not-a-date')).toBe('');
    });
  });
});
