import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (perm, fn) => fn,
}));

import {
  getFinancingWidget,
  calculateForTerm,
  getAfterpayBreakdown,
  getCartFinancing,
} from '../src/backend/financingCalc.web.js';

// ── getFinancingWidget ──────────────────────────────────────────────

describe('getFinancingWidget', () => {
  it('returns error for invalid price', async () => {
    const result = await getFinancingWidget(0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid price required');
  });

  it('returns error for negative price', async () => {
    const result = await getFinancingWidget(-100);
    expect(result.success).toBe(false);
  });

  it('returns error for NaN', async () => {
    const result = await getFinancingWidget('not-a-number');
    expect(result.success).toBe(false);
  });

  it('returns error for Infinity', async () => {
    const result = await getFinancingWidget(Infinity);
    expect(result.success).toBe(false);
  });

  it('returns full widget data for $800 product', async () => {
    const result = await getFinancingWidget(800);
    expect(result.success).toBe(true);
    expect(result.price).toBe(800);
    expect(result.eligible).toBe(true);
    expect(result.minimumAmount).toBe(200);

    // Should have terms: 6mo (0%), 12mo (0%), 18mo (4.99%), 24mo (9.99%)
    expect(result.terms.length).toBe(4);
    expect(result.terms[0].months).toBe(6);
    expect(result.terms[1].months).toBe(12);
    expect(result.terms[2].months).toBe(18);
    expect(result.terms[3].months).toBe(24);

    // Afterpay eligible ($35-$1000)
    expect(result.afterpay.eligible).toBe(true);
    expect(result.afterpay.installmentAmount).toBe(200);

    // Lowest monthly text
    expect(result.lowestMonthly).toMatch(/^As low as \$\d+\/mo$/);

    // Widget data
    expect(result.widgetData.showWidget).toBe(true);
    expect(result.widgetData.sections.length).toBeGreaterThan(0);
  });

  it('handles string price', async () => {
    const result = await getFinancingWidget('599.99');
    expect(result.success).toBe(true);
    expect(result.price).toBe(599.99);
  });

  it('excludes terms below minimum price', async () => {
    const result = await getFinancingWidget(300);
    // $300: 6mo eligible (min $200), 12mo NOT (min $500), 18mo NOT (min $750), 24mo NOT (min $500)
    expect(result.terms.length).toBe(1);
    expect(result.terms[0].months).toBe(6);
  });

  it('excludes Afterpay above $1000', async () => {
    const result = await getFinancingWidget(1500);
    expect(result.afterpay.eligible).toBe(false);
    expect(result.afterpay.reason).toContain('Maximum order');
  });

  it('excludes Afterpay below $35', async () => {
    // Also below $200 financing min, but let's test a case above financing but low
    const result = await getFinancingWidget(20);
    expect(result.afterpay.eligible).toBe(false);
    expect(result.afterpay.reason).toContain('Minimum order');
  });

  it('returns not eligible below all minimums', async () => {
    const result = await getFinancingWidget(30);
    expect(result.eligible).toBe(false);
    expect(result.terms.length).toBe(0);
    expect(result.afterpay.eligible).toBe(false);
  });

  it('returns eligible via Afterpay only for $50 item', async () => {
    const result = await getFinancingWidget(50);
    expect(result.eligible).toBe(true);
    expect(result.terms.length).toBe(0); // Below $200 financing min
    expect(result.afterpay.eligible).toBe(true);
  });

  it('widget data has belowMinimum message for low price', async () => {
    const result = await getFinancingWidget(100);
    expect(result.widgetData.belowMinimum).toBe(true);
    expect(result.widgetData.belowMinimumMessage).toContain('$200');
  });

  it('widget data shows afterpay section first', async () => {
    const result = await getFinancingWidget(500);
    expect(result.widgetData.sections[0].type).toBe('afterpay');
  });

  it('widget data includes financing sections', async () => {
    const result = await getFinancingWidget(800);
    const financingSections = result.widgetData.sections.filter(s => s.type === 'financing');
    expect(financingSections.length).toBe(4);
  });
});

// ── calculateForTerm ────────────────────────────────────────────────

describe('calculateForTerm', () => {
  it('returns error for invalid price', async () => {
    const result = await calculateForTerm(0, 12);
    expect(result.success).toBe(false);
  });

  it('returns error for invalid term', async () => {
    const result = await calculateForTerm(500, 0);
    expect(result.success).toBe(false);
  });

  it('returns error for negative term', async () => {
    const result = await calculateForTerm(500, -6);
    expect(result.success).toBe(false);
  });

  it('calculates 0% APR for $600 over 6 months', async () => {
    const result = await calculateForTerm(600, 6);
    expect(result.success).toBe(true);
    expect(result.monthly).toBe(100);
    expect(result.total).toBe(600);
    expect(result.interest).toBe(0);
    expect(result.apr).toBe(0);
    expect(result.isZeroInterest).toBe(true);
    expect(result.label).toBe('6 Months');
  });

  it('calculates 0% APR for $1000 over 12 months', async () => {
    const result = await calculateForTerm(1000, 12);
    expect(result.success).toBe(true);
    expect(result.monthly).toBeCloseTo(83.33, 1);
    expect(result.interest).toBe(0);
    expect(result.isZeroInterest).toBe(true);
  });

  it('calculates 4.99% APR for $1000 over 18 months', async () => {
    const result = await calculateForTerm(1000, 18);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(4.99);
    expect(result.monthly).toBeGreaterThan(55);
    expect(result.monthly).toBeLessThan(60);
    expect(result.interest).toBeGreaterThan(0);
    expect(result.isZeroInterest).toBe(false);
    expect(result.label).toBe('18 Months');
  });

  it('calculates 9.99% APR for $800 over 24 months', async () => {
    const result = await calculateForTerm(800, 24);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(9.99);
    expect(result.monthly).toBeGreaterThan(36);
    expect(result.monthly).toBeLessThan(38);
    expect(result.interest).toBeGreaterThan(0);
    expect(result.isZeroInterest).toBe(false);
  });

  it('rejects non-plan term instead of using fallback APR', async () => {
    const result = await calculateForTerm(500, 3);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('handles string inputs', async () => {
    const result = await calculateForTerm('800', '12');
    expect(result.success).toBe(true);
    expect(result.monthly).toBeGreaterThan(0);
  });

  it('total equals monthly * months for 0% APR', async () => {
    const result = await calculateForTerm(600, 6);
    expect(result.total).toBeCloseTo(result.monthly * result.months, 2);
  });

  it('total equals price + interest', async () => {
    const result = await calculateForTerm(1000, 24);
    expect(result.total).toBeCloseTo(result.monthly * result.months, 2);
    expect(result.interest).toBeCloseTo(result.total - 1000, 2);
  });
});

// ── getAfterpayBreakdown ────────────────────────────────────────────

describe('getAfterpayBreakdown', () => {
  it('returns error for invalid price', async () => {
    const result = await getAfterpayBreakdown(0);
    expect(result.success).toBe(false);
  });

  it('returns eligible breakdown for $200', async () => {
    const result = await getAfterpayBreakdown(200);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.installments).toBe(4);
    expect(result.installmentAmount).toBe(50);
    expect(result.total).toBe(200);
    expect(result.message).toContain('4 interest-free payments');
    expect(result.message).toContain('$50.00');
  });

  it('includes payment schedule', async () => {
    const result = await getAfterpayBreakdown(400);
    expect(result.schedule).toHaveLength(4);
    expect(result.schedule[0].label).toBe('Today');
    expect(result.schedule[0].amount).toBe(100);
    expect(result.schedule[1].label).toBe('In 2 weeks');
    expect(result.schedule[2].label).toBe('In 4 weeks');
    expect(result.schedule[3].label).toBe('In 6 weeks');
  });

  it('last payment absorbs rounding difference', async () => {
    const result = await getAfterpayBreakdown(99.99);
    // 99.99 / 4 = 24.9975, rounds to 25.00
    // Last payment: 99.99 - 25.00*3 = 24.99
    const scheduleTotal = result.schedule.reduce((sum, s) => sum + s.amount, 0);
    expect(scheduleTotal).toBeCloseTo(99.99, 2);
  });

  it('returns ineligible below $35', async () => {
    const result = await getAfterpayBreakdown(20);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Minimum order $35');
  });

  it('returns ineligible above $1000', async () => {
    const result = await getAfterpayBreakdown(1500);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Maximum order $1000');
  });

  it('handles exact boundary $35', async () => {
    const result = await getAfterpayBreakdown(35);
    expect(result.eligible).toBe(true);
    expect(result.installmentAmount).toBe(8.75);
  });

  it('handles exact boundary $1000', async () => {
    const result = await getAfterpayBreakdown(1000);
    expect(result.eligible).toBe(true);
    expect(result.installmentAmount).toBe(250);
  });

  it('handles string price', async () => {
    const result = await getAfterpayBreakdown('500');
    expect(result.success).toBe(true);
    expect(result.installmentAmount).toBe(125);
  });
});

// ── getCartFinancing ────────────────────────────────────────────────

describe('getCartFinancing', () => {
  it('returns error for invalid total', async () => {
    const result = await getCartFinancing(0);
    expect(result.success).toBe(false);
  });

  it('returns error for negative total', async () => {
    const result = await getCartFinancing(-500);
    expect(result.success).toBe(false);
  });

  it('returns full financing for $800 cart', async () => {
    const result = await getCartFinancing(800);
    expect(result.success).toBe(true);
    expect(result.cartTotal).toBe(800);

    // Financing terms
    expect(result.financing.eligible).toBe(true);
    expect(result.financing.terms.length).toBeGreaterThan(0);
    expect(result.financing.lowestMonthly).toMatch(/^As low as \$\d+\/mo$/);

    // Afterpay
    expect(result.afterpay.eligible).toBe(true);
    expect(result.afterpay.installmentAmount).toBe(200);

    // No threshold message (above $200)
    expect(result.thresholdMessage).toBeNull();
  });

  it('shows threshold message below $200', async () => {
    const result = await getCartFinancing(150);
    expect(result.thresholdMessage).toContain('$50.00 more to unlock financing');
  });

  it('no threshold message at $200', async () => {
    const result = await getCartFinancing(200);
    expect(result.thresholdMessage).toBeNull();
  });

  it('excludes Afterpay above $1000', async () => {
    const result = await getCartFinancing(1500);
    expect(result.afterpay.eligible).toBe(false);
  });

  it('handles string total', async () => {
    const result = await getCartFinancing('600');
    expect(result.success).toBe(true);
    expect(result.cartTotal).toBe(600);
  });

  it('returns financing not eligible below $200', async () => {
    const result = await getCartFinancing(100);
    expect(result.financing.eligible).toBe(false);
    expect(result.financing.terms.length).toBe(0);
  });

  it('lowest monthly considers Afterpay', async () => {
    // For $100 (above $35 Afterpay min), $100/4 = $25
    // No financing terms (below $200), so Afterpay is lowest
    const result = await getCartFinancing(100);
    expect(result.afterpay.eligible).toBe(true);
    // lowestMonthly should reflect Afterpay installment
    expect(result.financing.lowestMonthly).toMatch(/\$25\/mo/);
  });
});

// ── Edge Cases & Integration ────────────────────────────────────────

describe('edge cases', () => {
  it('very large price still works', async () => {
    const result = await getFinancingWidget(9999);
    expect(result.success).toBe(true);
    expect(result.terms.length).toBeGreaterThan(0);
  });

  it('price above max ($10000+) returns no terms', async () => {
    const result = await getFinancingWidget(15000);
    expect(result.success).toBe(true);
    expect(result.terms.length).toBe(0);
    expect(result.afterpay.eligible).toBe(false);
  });

  it('widget defaultSection is 0 when sections exist', async () => {
    const result = await getFinancingWidget(500);
    expect(result.widgetData.defaultSection).toBe(0);
  });

  it('widget defaultSection is null when no sections', async () => {
    const result = await getFinancingWidget(20);
    expect(result.widgetData.defaultSection).toBeNull();
  });

  it('18-month term has non-zero interest', async () => {
    const result = await calculateForTerm(1000, 18);
    expect(result.interest).toBeGreaterThan(0);
    expect(result.apr).toBe(4.99);
  });

  it('all zero-interest terms have zero interest', async () => {
    const r6 = await calculateForTerm(600, 6);
    const r12 = await calculateForTerm(600, 12);
    expect(r6.interest).toBe(0);
    expect(r12.interest).toBe(0);
  });

  it('monthly payments decrease with longer terms at 0% APR', async () => {
    const r6 = await calculateForTerm(600, 6);
    const r12 = await calculateForTerm(600, 12);
    expect(r12.monthly).toBeLessThan(r6.monthly);
  });

  it('interest-bearing terms have total > price', async () => {
    const r18 = await calculateForTerm(1000, 18);
    const r24 = await calculateForTerm(1000, 24);
    expect(r18.total).toBeGreaterThan(1000);
    expect(r24.total).toBeGreaterThan(1000);
  });
});
