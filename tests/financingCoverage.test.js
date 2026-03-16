/**
 * Tests for financingService.web.js and financingCalc.web.js
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── financingService ──────────────────────────────────────────────────
import {
  calculateMonthlyPayment,
  getFinancingOptions,
  getLowestMonthlyDisplay,
} from 'backend/financingService.web';

// ── financingCalc ─────────────────────────────────────────────────────
import {
  getFinancingWidget,
  calculateForTerm,
  getAfterpayBreakdown,
  getCartFinancing,
} from 'backend/financingCalc.web';

// ═══════════════════════════════════════════════════════════════════════
// financingService.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('financingService — calculateMonthlyPayment', () => {
  it('returns zeros for invalid price', () => {
    const result = calculateMonthlyPayment(0, 12);
    expect(result.monthly).toBe(0);
    expect(result.total).toBe(0);
    expect(result.interest).toBe(0);
  });

  it('returns zeros for negative price', () => {
    const result = calculateMonthlyPayment(-100, 12);
    expect(result.monthly).toBe(0);
  });

  it('returns zeros for NaN price', () => {
    const result = calculateMonthlyPayment('invalid', 12);
    expect(result.monthly).toBe(0);
  });

  it('calculates 0% APR correctly', () => {
    const result = calculateMonthlyPayment(1200, 12);
    expect(result.monthly).toBe(100);
    expect(result.total).toBe(1200);
    expect(result.interest).toBe(0);
    expect(result.term).toBe(12);
    expect(result.apr).toBe(0);
  });

  it('calculates with APR correctly', () => {
    const result = calculateMonthlyPayment(1000, 12, 9.99);
    expect(result.monthly).toBeGreaterThan(83); // more than 1000/12
    expect(result.total).toBeGreaterThan(1000);
    expect(result.interest).toBeGreaterThan(0);
    expect(result.apr).toBe(9.99);
  });

  it('floors term to integer', () => {
    const result = calculateMonthlyPayment(100, 6.7);
    expect(result.term).toBe(6);
  });

  it('clamps term minimum to 1', () => {
    const result = calculateMonthlyPayment(100, 0);
    expect(result.term).toBe(1);
    expect(result.monthly).toBe(100);
  });

  it('clamps negative APR to 0', () => {
    const result = calculateMonthlyPayment(100, 12, -5);
    expect(result.apr).toBe(0);
    expect(result.interest).toBe(0);
  });

  it('handles NaN term', () => {
    const result = calculateMonthlyPayment(100, 'invalid');
    expect(result.term).toBe(1);
  });

  it('handles NaN APR', () => {
    const result = calculateMonthlyPayment(100, 12, 'invalid');
    expect(result.apr).toBe(0);
  });

  it('rounds to cents', () => {
    const result = calculateMonthlyPayment(100, 3);
    expect(result.monthly).toBe(33.33);
  });
});

describe('financingService — getFinancingOptions', () => {
  it('returns empty for price below minimum', () => {
    const result = getFinancingOptions(30);
    expect(result).toEqual([]);
  });

  it('returns empty for NaN', () => {
    expect(getFinancingOptions('invalid')).toEqual([]);
  });

  it('returns Pay in 4 for $50', () => {
    const result = getFinancingOptions(50);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].term).toBe(4);
    expect(result[0].label).toBe('Pay in 4');
    expect(result[0].apr).toBe(0);
    expect(result[0].monthly).toBeCloseTo(12.5, 1);
  });

  it('returns multiple options for $500', () => {
    const result = getFinancingOptions(500);
    expect(result.length).toBeGreaterThanOrEqual(3);
    const terms = result.map(r => r.term);
    expect(terms).toContain(4);
    expect(terms).toContain(12);
    expect(terms).toContain(24);
  });

  it('returns 36-month for $1000+', () => {
    const result = getFinancingOptions(1500);
    const t36 = result.find(r => r.term === 36);
    expect(t36).toBeDefined();
    expect(t36.apr).toBe(14.99);
    expect(t36.interest).toBeGreaterThan(0);
  });

  it('excludes plans above maxPrice', () => {
    const result = getFinancingOptions(15000);
    expect(result).toEqual([]);
  });

  it('calculates interest correctly for non-zero APR', () => {
    const result = getFinancingOptions(1000);
    const t24 = result.find(r => r.term === 24);
    expect(t24.total).toBeGreaterThan(1000);
    expect(t24.interest).toBeCloseTo(t24.total - 1000, 0);
  });
});

describe('financingService — getLowestMonthlyDisplay', () => {
  it('returns null below minimum', () => {
    expect(getLowestMonthlyDisplay(30)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(getLowestMonthlyDisplay('invalid')).toBeNull();
  });

  it('returns display text for eligible price', () => {
    const result = getLowestMonthlyDisplay(500);
    expect(result).toMatch(/^As low as \$\d+\/mo$/);
  });

  it('uses longest 0% term for lowest monthly', () => {
    // $500 eligible for: 4-month 0%, 12-month 0%. Longest = 12.
    // 500/12 = 41.67 → ceil = 42
    const result = getLowestMonthlyDisplay(500);
    expect(result).toBe('As low as $42/mo');
  });

  it('returns null if no 0% plans match', () => {
    // Price too high for 0% plans — all 0% plans have maxPrice ≤ 10000
    // but minPrice varies. $49 is below all plans.
    const result = getLowestMonthlyDisplay(49);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// financingCalc.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('financingCalc — getFinancingWidget', () => {
  it('rejects invalid price', async () => {
    const result = await getFinancingWidget(0);
    expect(result.success).toBe(false);
  });

  it('rejects null', async () => {
    const result = await getFinancingWidget(null);
    expect(result.success).toBe(false);
  });

  it('rejects empty string', async () => {
    const result = await getFinancingWidget('');
    expect(result.success).toBe(false);
  });

  it('returns ineligible for very low price', async () => {
    const result = await getFinancingWidget(10);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.widgetData.showWidget).toBe(false);
    expect(result.widgetData.belowMinimum).toBe(true);
  });

  it('returns eligible for Afterpay-only price ($50)', async () => {
    const result = await getFinancingWidget(50);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.afterpay.eligible).toBe(true);
    expect(result.terms).toHaveLength(0); // No financing terms at $50
    expect(result.widgetData.showWidget).toBe(true);
  });

  it('returns both terms and afterpay for $500', async () => {
    const result = await getFinancingWidget(500);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.afterpay.eligible).toBe(true);
    expect(result.terms.length).toBeGreaterThan(0);
  });

  it('returns lowest monthly text', async () => {
    const result = await getFinancingWidget(500);
    expect(result.lowestMonthly).toMatch(/^As low as \$\d+\/mo$/);
  });

  it('shows minimum amount', async () => {
    const result = await getFinancingWidget(500);
    expect(result.minimumAmount).toBe(200);
  });

  it('widget sections include afterpay and financing', async () => {
    const result = await getFinancingWidget(500);
    const types = result.widgetData.sections.map(s => s.type);
    expect(types).toContain('afterpay');
    expect(types).toContain('financing');
  });

  it('afterpay schedule has 4 payments', async () => {
    const result = await getFinancingWidget(200);
    expect(result.afterpay.schedule).toHaveLength(4);
    expect(result.afterpay.schedule[0].label).toBe('Today');
    expect(result.afterpay.schedule[3].label).toBe('In 6 weeks');
  });

  it('last afterpay payment handles rounding remainder', async () => {
    const result = await getFinancingWidget(99); // 99/4 = 24.75
    const schedule = result.afterpay.schedule;
    const totalFromSchedule = schedule.reduce((s, p) => s + p.amount, 0);
    expect(totalFromSchedule).toBeCloseTo(99, 1);
  });

  it('above $1000 — afterpay ineligible, terms only', async () => {
    const result = await getFinancingWidget(1500);
    expect(result.afterpay.eligible).toBe(false);
    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.eligible).toBe(true);
  });

  it('widget belowMinimum flag works', async () => {
    const result = await getFinancingWidget(50);
    expect(result.widgetData.belowMinimum).toBe(true);
    expect(result.widgetData.belowMinimumMessage).toContain('$200');
  });

  it('accepts string price', async () => {
    const result = await getFinancingWidget('500');
    expect(result.success).toBe(true);
    expect(result.price).toBe(500);
  });
});

describe('financingCalc — calculateForTerm', () => {
  it('rejects invalid price', async () => {
    const result = await calculateForTerm(0, 12);
    expect(result.success).toBe(false);
  });

  it('rejects invalid term', async () => {
    const result = await calculateForTerm(500, 0);
    expect(result.success).toBe(false);
  });

  it('rejects null term', async () => {
    const result = await calculateForTerm(500, null);
    expect(result.success).toBe(false);
  });

  it('returns error for unavailable plan', async () => {
    const result = await calculateForTerm(100, 6); // $100 below minPrice $200 for 6-month plan
    expect(result.success).toBe(false);
    expect(result.error).toContain('No financing plan');
  });

  it('calculates 6-month 0% APR', async () => {
    const result = await calculateForTerm(600, 6);
    expect(result.success).toBe(true);
    expect(result.monthly).toBe(100);
    expect(result.total).toBe(600);
    expect(result.interest).toBe(0);
    expect(result.apr).toBe(0);
    expect(result.isZeroInterest).toBe(true);
    expect(result.label).toBe('6 Months');
  });

  it('calculates 24-month with APR', async () => {
    const result = await calculateForTerm(1000, 24);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(9.99);
    expect(result.monthly).toBeGreaterThan(1000 / 24);
    expect(result.interest).toBeGreaterThan(0);
    expect(result.isZeroInterest).toBe(false);
  });

  it('calculates 18-month plan', async () => {
    const result = await calculateForTerm(1000, 18);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(4.99);
    expect(result.months).toBe(18);
  });

  it('floors months to integer', async () => {
    const result = await calculateForTerm(600, 6.9);
    expect(result.success).toBe(true);
    expect(result.months).toBe(6);
  });
});

describe('financingCalc — getAfterpayBreakdown', () => {
  it('rejects invalid price', async () => {
    const result = await getAfterpayBreakdown(0);
    expect(result.success).toBe(false);
  });

  it('returns eligible breakdown', async () => {
    const result = await getAfterpayBreakdown(200);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.installmentAmount).toBe(50);
    expect(result.installments).toBe(4);
    expect(result.message).toContain('$50.00');
  });

  it('returns ineligible below $35', async () => {
    const result = await getAfterpayBreakdown(20);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Minimum');
  });

  it('returns ineligible above $1000', async () => {
    const result = await getAfterpayBreakdown(2000);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Maximum');
  });

  it('boundary: $35 is eligible', async () => {
    const result = await getAfterpayBreakdown(35);
    expect(result.eligible).toBe(true);
  });

  it('boundary: $1000 is eligible', async () => {
    const result = await getAfterpayBreakdown(1000);
    expect(result.eligible).toBe(true);
    expect(result.installmentAmount).toBe(250);
  });
});

describe('financingCalc — getCartFinancing', () => {
  it('rejects invalid cart total', async () => {
    const result = await getCartFinancing(0);
    expect(result.success).toBe(false);
  });

  it('rejects null', async () => {
    const result = await getCartFinancing(null);
    expect(result.success).toBe(false);
  });

  it('returns threshold message below $200', async () => {
    const result = await getCartFinancing(100);
    expect(result.success).toBe(true);
    expect(result.thresholdMessage).toContain('$100.00');
    expect(result.thresholdMessage).toContain('unlock financing');
  });

  it('no threshold message at $200+', async () => {
    const result = await getCartFinancing(200);
    expect(result.thresholdMessage).toBeNull();
  });

  it('returns cart total in response', async () => {
    const result = await getCartFinancing(500);
    expect(result.cartTotal).toBe(500);
  });

  it('returns financing terms for eligible cart', async () => {
    const result = await getCartFinancing(500);
    expect(result.financing.eligible).toBe(true);
    expect(result.financing.terms.length).toBeGreaterThan(0);
    expect(result.financing.lowestMonthly).toBeDefined();
  });

  it('returns afterpay for eligible cart', async () => {
    const result = await getCartFinancing(200);
    expect(result.afterpay.eligible).toBe(true);
  });

  it('returns afterpay ineligible above $1000', async () => {
    const result = await getCartFinancing(1500);
    expect(result.afterpay.eligible).toBe(false);
  });

  it('accepts string input', async () => {
    const result = await getCartFinancing('500');
    expect(result.success).toBe(true);
    expect(result.cartTotal).toBe(500);
  });
});
