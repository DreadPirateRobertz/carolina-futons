import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/financingCalc.web.js');
});

// ── getFinancingWidget ────────────────────────────────────────────

describe('getFinancingWidget', () => {
  it('rejects null price', async () => {
    const r = await mod.getFinancingWidget(null);
    expect(r.success).toBe(false);
  });

  it('rejects zero price', async () => {
    const r = await mod.getFinancingWidget(0);
    expect(r.success).toBe(false);
  });

  it('rejects negative price', async () => {
    const r = await mod.getFinancingWidget(-100);
    expect(r.success).toBe(false);
  });

  it('rejects NaN', async () => {
    const r = await mod.getFinancingWidget(NaN);
    expect(r.success).toBe(false);
  });

  it('parses string price', async () => {
    const r = await mod.getFinancingWidget('500');
    expect(r.success).toBe(true);
    expect(r.price).toBe(500);
  });

  it('returns eligible=true when financing available ($500)', async () => {
    const r = await mod.getFinancingWidget(500);
    expect(r.eligible).toBe(true);
    expect(r.terms.length).toBeGreaterThan(0);
  });

  it('returns eligible=true for Afterpay-only range ($50)', async () => {
    const r = await mod.getFinancingWidget(50);
    expect(r.eligible).toBe(true);
    expect(r.afterpay.eligible).toBe(true);
    expect(r.terms).toHaveLength(0); // below $200 financing min
  });

  it('returns eligible=false for very small amount ($10)', async () => {
    const r = await mod.getFinancingWidget(10);
    expect(r.eligible).toBe(false);
  });

  it('terms include 0% APR for 6 months at $500', async () => {
    const r = await mod.getFinancingWidget(500);
    const sixMonth = r.terms.find(t => t.months === 6);
    expect(sixMonth).toBeTruthy();
    expect(sixMonth.apr).toBe(0);
    expect(sixMonth.isZeroInterest).toBe(true);
    expect(sixMonth.monthly).toBeCloseTo(83.33, 1);
  });

  it('terms include 12-month 0% APR at $500', async () => {
    const r = await mod.getFinancingWidget(500);
    const twelveMo = r.terms.find(t => t.months === 12);
    expect(twelveMo).toBeTruthy();
    expect(twelveMo.apr).toBe(0);
  });

  it('afterpay calculates 4 installments', async () => {
    const r = await mod.getFinancingWidget(200);
    expect(r.afterpay.eligible).toBe(true);
    expect(r.afterpay.installments).toBe(4);
    expect(r.afterpay.installmentAmount).toBe(50);
    expect(r.afterpay.schedule).toHaveLength(4);
    expect(r.afterpay.schedule[0].label).toBe('Today');
  });

  it('afterpay last payment accounts for rounding', async () => {
    const r = await mod.getFinancingWidget(99.99);
    expect(r.afterpay.eligible).toBe(true);
    // First 3 payments: floor(99.99/4) ≈ 25.00, last = 99.99 - 3*25.00 = 24.99
    const lastPayment = r.afterpay.schedule[3].amount;
    const firstThree = r.afterpay.schedule.slice(0, 3).reduce((s, p) => s + p.amount, 0);
    expect(firstThree + lastPayment).toBeCloseTo(99.99, 2);
  });

  it('lowestMonthly shows text', async () => {
    const r = await mod.getFinancingWidget(500);
    expect(r.lowestMonthly).toContain('As low as');
    expect(r.lowestMonthly).toContain('/mo');
  });

  it('widgetData.showWidget is true when eligible', async () => {
    const r = await mod.getFinancingWidget(500);
    expect(r.widgetData.showWidget).toBe(true);
    expect(r.widgetData.sections.length).toBeGreaterThan(0);
  });

  it('widgetData.showWidget is false when not eligible', async () => {
    const r = await mod.getFinancingWidget(10);
    expect(r.widgetData.showWidget).toBe(false);
  });

  it('widgetData includes belowMinimum message for small prices', async () => {
    const r = await mod.getFinancingWidget(50);
    expect(r.widgetData.belowMinimum).toBe(true);
    expect(r.widgetData.belowMinimumMessage).toContain('$200');
  });
});

// ── calculateForTerm ──────────────────────────────────────────────

describe('calculateForTerm', () => {
  it('rejects invalid price', async () => {
    const r = await mod.calculateForTerm(NaN, 6);
    expect(r.success).toBe(false);
  });

  it('rejects invalid months', async () => {
    const r = await mod.calculateForTerm(500, 0);
    expect(r.success).toBe(false);
  });

  it('rejects unavailable plan (price too low for 12mo)', async () => {
    const r = await mod.calculateForTerm(300, 12);
    // 12mo requires minPrice 500
    expect(r.success).toBe(false);
    expect(r.error).toContain('No financing plan');
  });

  it('calculates 0% APR correctly (6 months, $600)', async () => {
    const r = await mod.calculateForTerm(600, 6);
    expect(r.success).toBe(true);
    expect(r.apr).toBe(0);
    expect(r.monthly).toBe(100);
    expect(r.interest).toBe(0);
    expect(r.isZeroInterest).toBe(true);
  });

  it('calculates with APR correctly (24 months, $1000)', async () => {
    const r = await mod.calculateForTerm(1000, 24);
    expect(r.success).toBe(true);
    expect(r.apr).toBe(9.99);
    expect(r.monthly).toBeGreaterThan(0);
    expect(r.interest).toBeGreaterThan(0);
    expect(r.isZeroInterest).toBe(false);
    expect(r.total).toBeGreaterThan(1000);
  });

  it('returns label and description', async () => {
    const r = await mod.calculateForTerm(500, 6);
    expect(r.label).toBe('6 Months');
    expect(r.description).toContain('0% APR');
  });
});

// ── getAfterpayBreakdown ──────────────────────────────────────────

describe('getAfterpayBreakdown', () => {
  it('rejects invalid price', async () => {
    const r = await mod.getAfterpayBreakdown(null);
    expect(r.success).toBe(false);
  });

  it('returns eligible for $100', async () => {
    const r = await mod.getAfterpayBreakdown(100);
    expect(r.success).toBe(true);
    expect(r.eligible).toBe(true);
    expect(r.installmentAmount).toBe(25);
  });

  it('returns ineligible below $35', async () => {
    const r = await mod.getAfterpayBreakdown(20);
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('Minimum');
  });

  it('returns ineligible above $1000', async () => {
    const r = await mod.getAfterpayBreakdown(1500);
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('Maximum');
  });

  it('message contains Afterpay', async () => {
    const r = await mod.getAfterpayBreakdown(200);
    expect(r.message).toContain('Afterpay');
  });
});

// ── getCartFinancing ──────────────────────────────────────────────

describe('getCartFinancing', () => {
  it('rejects invalid total', async () => {
    const r = await mod.getCartFinancing('');
    expect(r.success).toBe(false);
  });

  it('returns financing for $500 cart', async () => {
    const r = await mod.getCartFinancing(500);
    expect(r.success).toBe(true);
    expect(r.cartTotal).toBe(500);
    expect(r.financing.eligible).toBe(true);
    expect(r.afterpay.eligible).toBe(true);
    expect(r.thresholdMessage).toBeNull();
  });

  it('returns threshold message below $200', async () => {
    const r = await mod.getCartFinancing(150);
    expect(r.thresholdMessage).toContain('Add $50.00');
    expect(r.thresholdMessage).toContain('unlock financing');
  });

  it('no threshold message at $200', async () => {
    const r = await mod.getCartFinancing(200);
    expect(r.thresholdMessage).toBeNull();
  });

  it('lowestMonthly shows text when eligible', async () => {
    const r = await mod.getCartFinancing(500);
    expect(r.financing.lowestMonthly).toContain('As low as');
  });
});
