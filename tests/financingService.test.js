import { describe, it, expect, vi } from 'vitest';

// Mock wix-web-module
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (perm, fn) => fn,
}));

import {
  calculateMonthlyPayment,
  getFinancingOptions,
  getLowestMonthlyDisplay,
} from '../src/backend/financingService.web.js';

describe('financingService', () => {
  describe('calculateMonthlyPayment', () => {
    it('calculates 0% APR correctly', () => {
      const result = calculateMonthlyPayment(1200, 12, 0);
      expect(result.monthly).toBe(100);
      expect(result.total).toBe(1200);
      expect(result.interest).toBe(0);
      expect(result.term).toBe(12);
      expect(result.apr).toBe(0);
    });

    it('calculates pay-in-4 correctly', () => {
      const result = calculateMonthlyPayment(400, 4, 0);
      expect(result.monthly).toBe(100);
      expect(result.total).toBe(400);
      expect(result.interest).toBe(0);
    });

    it('calculates non-zero APR correctly', () => {
      const result = calculateMonthlyPayment(1000, 24, 9.99);
      // At 9.99% APR over 24 months, monthly should be ~$46.14
      expect(result.monthly).toBeGreaterThan(46);
      expect(result.monthly).toBeLessThan(47);
      expect(result.interest).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(1000);
    });

    it('calculates 36-month term with interest', () => {
      const result = calculateMonthlyPayment(2000, 36, 14.99);
      expect(result.monthly).toBeGreaterThan(69);
      expect(result.monthly).toBeLessThan(70);
      expect(result.interest).toBeGreaterThan(400);
      expect(result.total).toBeCloseTo(result.monthly * 36, 2);
    });

    it('returns zeros for zero price', () => {
      const result = calculateMonthlyPayment(0, 12, 0);
      expect(result.monthly).toBe(0);
      expect(result.total).toBe(0);
    });

    it('returns zeros for negative price', () => {
      const result = calculateMonthlyPayment(-500, 12, 0);
      expect(result.monthly).toBe(0);
    });

    it('returns zeros for NaN price', () => {
      const result = calculateMonthlyPayment(NaN, 12, 0);
      expect(result.monthly).toBe(0);
    });

    it('clamps term to minimum 1', () => {
      const result = calculateMonthlyPayment(100, 0, 0);
      expect(result.term).toBe(1);
      expect(result.monthly).toBe(100);
    });

    it('clamps negative term to 1', () => {
      const result = calculateMonthlyPayment(100, -5, 0);
      expect(result.term).toBe(1);
    });

    it('clamps negative APR to 0', () => {
      const result = calculateMonthlyPayment(1000, 12, -5);
      expect(result.apr).toBe(0);
      expect(result.interest).toBe(0);
    });

    it('handles non-evenly-divisible amounts', () => {
      const result = calculateMonthlyPayment(999, 4, 0);
      expect(result.monthly).toBe(249.75);
    });

    it('rounds to cents', () => {
      const result = calculateMonthlyPayment(100, 3, 0);
      // 100/3 = 33.333... → rounds to 33.33
      expect(result.monthly).toBe(33.33);
      expect(String(result.monthly).split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });

    it('handles Infinity price', () => {
      const result = calculateMonthlyPayment(Infinity, 12, 0);
      expect(result.monthly).toBe(0);
    });

    it('handles string inputs by converting', () => {
      const result = calculateMonthlyPayment('600', '6', '0');
      expect(result.monthly).toBe(100);
    });
  });

  describe('getFinancingOptions', () => {
    it('returns available plans for $500 item', () => {
      const plans = getFinancingOptions(500);
      expect(plans.length).toBeGreaterThanOrEqual(3);
      // Should include Pay in 4, 6 months, 12 months
      expect(plans.some(p => p.term === 4)).toBe(true);
      expect(plans.some(p => p.term === 6)).toBe(true);
      expect(plans.some(p => p.term === 12)).toBe(true);
    });

    it('returns plans for $1500 item including 36 months', () => {
      const plans = getFinancingOptions(1500);
      expect(plans.some(p => p.term === 36)).toBe(true);
    });

    it('excludes plans below minimum price', () => {
      const plans = getFinancingOptions(100);
      // $100 shouldn't have 12-month or 24-month plans (minPrice 500)
      expect(plans.every(p => p.term <= 6)).toBe(true);
    });

    it('returns empty for price below $50', () => {
      const plans = getFinancingOptions(25);
      expect(plans).toEqual([]);
    });

    it('returns empty for zero price', () => {
      const plans = getFinancingOptions(0);
      expect(plans).toEqual([]);
    });

    it('returns empty for negative price', () => {
      const plans = getFinancingOptions(-100);
      expect(plans).toEqual([]);
    });

    it('returns empty for NaN', () => {
      const plans = getFinancingOptions(NaN);
      expect(plans).toEqual([]);
    });

    it('includes monthly, total, and interest in each plan', () => {
      const plans = getFinancingOptions(1000);
      for (const plan of plans) {
        expect(plan.monthly).toBeGreaterThan(0);
        expect(plan.total).toBeGreaterThan(0);
        expect(plan.label).toBeTruthy();
        expect(plan.description).toBeTruthy();
        expect(typeof plan.interest).toBe('number');
      }
    });

    it('0% plans have zero interest', () => {
      const plans = getFinancingOptions(1000);
      const zeroPlans = plans.filter(p => p.apr === 0);
      expect(zeroPlans.length).toBeGreaterThan(0);
      for (const plan of zeroPlans) {
        expect(plan.interest).toBe(0);
      }
    });

    it('plans are ordered by term length', () => {
      const plans = getFinancingOptions(1000);
      for (let i = 1; i < plans.length; i++) {
        expect(plans[i].term).toBeGreaterThanOrEqual(plans[i - 1].term);
      }
    });
  });

  describe('getLowestMonthlyDisplay', () => {
    it('returns "As low as" text for eligible prices', () => {
      const text = getLowestMonthlyDisplay(1200);
      expect(text).toMatch(/^As low as \$\d+\/mo$/);
    });

    it('returns correct monthly for $600 (12 months 0%)', () => {
      const text = getLowestMonthlyDisplay(600);
      // $600 / 12 months = $50/mo
      expect(text).toBe('As low as $50/mo');
    });

    it('returns correct monthly for $200 (6 months max 0%)', () => {
      const text = getLowestMonthlyDisplay(200);
      // $200 / 6 months = $34/mo (ceil)
      expect(text).toBe('As low as $34/mo');
    });

    it('picks longest 0% term for lowest monthly', () => {
      const text = getLowestMonthlyDisplay(1000);
      // Should use 12-month 0% plan: $1000/12 = $84/mo
      expect(text).toBe('As low as $84/mo');
    });

    it('returns null for price below minimum', () => {
      expect(getLowestMonthlyDisplay(25)).toBeNull();
    });

    it('returns null for zero price', () => {
      expect(getLowestMonthlyDisplay(0)).toBeNull();
    });

    it('returns null for negative price', () => {
      expect(getLowestMonthlyDisplay(-500)).toBeNull();
    });

    it('returns null for NaN', () => {
      expect(getLowestMonthlyDisplay(NaN)).toBeNull();
    });

    it('uses ceil for non-even division', () => {
      // $499 < 500 minPrice for 12mo, so longest 0% term is 6mo
      // $499 / 6 = 83.17 → ceil to $84
      const text = getLowestMonthlyDisplay(499);
      expect(text).toBe('As low as $84/mo');
    });
  });
});
