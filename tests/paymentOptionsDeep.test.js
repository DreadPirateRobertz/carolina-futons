import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: {
    sandLight: '#f5f0e8',
    espresso: '#3e2723',
    success: '#4caf50',
    mountainBlueLight: '#90caf9',
  },
}));

vi.mock('wix-data', () => ({
  default: { query: () => ({ find: async () => ({ items: [] }) }) },
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/paymentOptions.web.js');
});

// ── getPaymentOptions ─────────────────────────────────────────────

describe('getPaymentOptions', () => {
  it('rejects invalid price', async () => {
    const r = await mod.getPaymentOptions(NaN);
    expect(r.success).toBe(false);
  });

  it('rejects zero price', async () => {
    const r = await mod.getPaymentOptions(0);
    expect(r.success).toBe(false);
  });

  it('rejects negative price', async () => {
    const r = await mod.getPaymentOptions(-100);
    expect(r.success).toBe(false);
  });

  it('returns options for valid price', async () => {
    const r = await mod.getPaymentOptions(500);
    expect(r.success).toBe(true);
    expect(r.price).toBe(500);
    expect(r.afterpay).toBeTruthy();
    expect(r.financing).toBeTruthy();
    expect(r.methods).toBeTruthy();
    expect(r.badges).toBeTruthy();
  });

  it('parses string price', async () => {
    const r = await mod.getPaymentOptions('250');
    expect(r.success).toBe(true);
    expect(r.price).toBe(250);
  });

  it('afterpay eligible for $35-1000', async () => {
    const r = await mod.getPaymentOptions(100);
    expect(r.afterpay.eligible).toBe(true);
    expect(r.afterpay.installmentAmount).toBe(25);
    expect(r.afterpay.installments).toBe(4);
  });

  it('afterpay ineligible below $35', async () => {
    const r = await mod.getPaymentOptions(20);
    expect(r.afterpay.eligible).toBe(false);
    expect(r.afterpay.reason).toContain('Minimum');
  });

  it('afterpay ineligible above $1000', async () => {
    const r = await mod.getPaymentOptions(1500);
    expect(r.afterpay.eligible).toBe(false);
    expect(r.afterpay.reason).toContain('Maximum');
  });

  it('financing eligible at $300+', async () => {
    const r = await mod.getPaymentOptions(500);
    expect(r.financing.eligible).toBe(true);
    expect(r.financing.tiers.length).toBeGreaterThan(0);
  });

  it('financing ineligible below $300', async () => {
    const r = await mod.getPaymentOptions(100);
    expect(r.financing.eligible).toBe(false);
  });

  it('methods include credit card, apple pay, google pay always', async () => {
    const r = await mod.getPaymentOptions(100);
    const ids = r.methods.map(m => m.id);
    expect(ids).toContain('credit-card');
    expect(ids).toContain('apple-pay');
    expect(ids).toContain('google-pay');
  });

  it('afterpay method included when eligible', async () => {
    const r = await mod.getPaymentOptions(500);
    const ids = r.methods.map(m => m.id);
    expect(ids).toContain('afterpay');
  });

  it('afterpay method excluded when ineligible', async () => {
    const r = await mod.getPaymentOptions(20);
    const ids = r.methods.map(m => m.id);
    expect(ids).not.toContain('afterpay');
  });
});

// ── getAfterpayMessage ────────────────────────────────────────────

describe('getAfterpayMessage', () => {
  it('rejects invalid price', async () => {
    const r = await mod.getAfterpayMessage('abc');
    expect(r.success).toBe(false);
  });

  it('returns message for eligible price', async () => {
    const r = await mod.getAfterpayMessage(200);
    expect(r.success).toBe(true);
    expect(r.eligible).toBe(true);
    expect(r.installmentAmount).toBe(50);
    expect(r.message).toContain('interest-free');
  });
});

// ── getBatchPaymentBadges ─────────────────────────────────────────

describe('getBatchPaymentBadges', () => {
  it('returns empty for empty array', async () => {
    const r = await mod.getBatchPaymentBadges([]);
    expect(r.success).toBe(true);
    expect(r.badges).toEqual({});
  });

  it('returns badges for eligible products', async () => {
    const r = await mod.getBatchPaymentBadges([
      { productId: 'p1', price: 500 },
      { productId: 'p2', price: 20 },
    ]);
    expect(r.badges['p1']).toBeTruthy();
    expect(r.badges['p1'].length).toBeGreaterThan(0);
    expect(r.badges['p2']).toBeUndefined(); // below afterpay min and financing min
  });

  it('caps at 50 products', async () => {
    const products = Array.from({ length: 60 }, (_, i) => ({ productId: `p${i}`, price: 500 }));
    const r = await mod.getBatchPaymentBadges(products);
    expect(Object.keys(r.badges).length).toBeLessThanOrEqual(50);
  });

  it('skips products without valid price', async () => {
    const r = await mod.getBatchPaymentBadges([{ productId: 'p1', price: NaN }]);
    expect(r.badges).toEqual({});
  });
});

// ── getCheckoutPaymentSummary ─────────────────────────────────────

describe('getCheckoutPaymentSummary', () => {
  it('rejects invalid total', async () => {
    const r = await mod.getCheckoutPaymentSummary(0);
    expect(r.success).toBe(false);
  });

  it('returns summary for valid total', async () => {
    const r = await mod.getCheckoutPaymentSummary(500);
    expect(r.success).toBe(true);
    expect(r.summary.cartTotal).toBe(500);
    expect(r.summary.payNow).toBeTruthy();
    expect(r.summary.payNow.message).toContain('500.00');
  });

  it('includes afterpay when eligible', async () => {
    const r = await mod.getCheckoutPaymentSummary(500);
    expect(r.summary.afterpay).toBeTruthy();
    expect(r.summary.afterpay.installmentAmount).toBe(125);
  });

  it('excludes afterpay when ineligible', async () => {
    const r = await mod.getCheckoutPaymentSummary(1500);
    expect(r.summary.afterpay).toBeUndefined();
  });

  it('includes financing when eligible', async () => {
    const r = await mod.getCheckoutPaymentSummary(500);
    expect(r.summary.financing).toBeTruthy();
  });

  it('payNow methods exclude afterpay', async () => {
    const r = await mod.getCheckoutPaymentSummary(500);
    const ids = r.summary.payNow.methods.map(m => m.id);
    expect(ids).not.toContain('afterpay');
  });
});

// ── getInstallmentCalculation ─────────────────────────────────────

describe('getInstallmentCalculation', () => {
  it('rejects invalid price', async () => {
    const r = await mod.getInstallmentCalculation(NaN, 6);
    expect(r.success).toBe(false);
  });

  it('rejects invalid months', async () => {
    const r = await mod.getInstallmentCalculation(500, 0);
    expect(r.success).toBe(false);
  });

  it('rejects months > 120', async () => {
    const r = await mod.getInstallmentCalculation(500, 200);
    expect(r.success).toBe(false);
  });

  it('calculates 0% APR promotional tier (6 months, $500)', async () => {
    const r = await mod.getInstallmentCalculation(500, 6);
    expect(r.success).toBe(true);
    expect(r.apr).toBe(0);
    expect(r.monthlyPayment).toBeCloseTo(83.33, 1);
    expect(r.totalInterest).toBe(0);
    expect(r.isPromotional).toBe(true);
  });

  it('calculates with APR for non-promotional tier', async () => {
    const r = await mod.getInstallmentCalculation(3000, 24);
    expect(r.success).toBe(true);
    expect(r.apr).toBe(9.99);
    expect(r.monthlyPayment).toBeGreaterThan(0);
    expect(r.totalInterest).toBeGreaterThan(0);
    expect(r.isPromotional).toBe(false);
  });

  it('uses default 9.99% for non-matching tier', async () => {
    const r = await mod.getInstallmentCalculation(100, 3); // below financing min
    expect(r.success).toBe(true);
    expect(r.apr).toBe(9.99);
    expect(r.isPromotional).toBe(false);
  });

  it('includes tier label for promotional', async () => {
    const r = await mod.getInstallmentCalculation(500, 6);
    expect(r.tierLabel).toContain('interest-free');
  });

  it('parses string inputs', async () => {
    const r = await mod.getInstallmentCalculation('500', '6');
    expect(r.success).toBe(true);
    expect(r.price).toBe(500);
    expect(r.months).toBe(6);
  });
});
