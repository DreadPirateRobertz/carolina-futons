import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (perm, fn) => fn,
}));

const mockQueryChain = {
  eq: vi.fn().mockReturnThis(),
  hasSome: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQueryChain })),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
}));

import {
  getPaymentOptions,
  getAfterpayMessage,
  getBatchPaymentBadges,
  getCheckoutPaymentSummary,
  getInstallmentCalculation,
} from '../src/backend/paymentOptions.web.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getPaymentOptions ───────────────────────────────────────────────

describe('getPaymentOptions', () => {
  it('returns error for invalid price', async () => {
    const result = await getPaymentOptions(0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid price required');
  });

  it('returns error for negative price', async () => {
    const result = await getPaymentOptions(-100);
    expect(result.success).toBe(false);
  });

  it('returns error for NaN price', async () => {
    const result = await getPaymentOptions('not-a-number');
    expect(result.success).toBe(false);
  });

  it('returns full payment options for $500 product', async () => {
    const result = await getPaymentOptions(500);
    expect(result.success).toBe(true);
    expect(result.price).toBe(500);

    // Afterpay should be eligible ($35-$1000)
    expect(result.afterpay.eligible).toBe(true);
    expect(result.afterpay.installmentAmount).toBe(125);
    expect(result.afterpay.installments).toBe(4);

    // Financing should be eligible ($300-$999 = 6mo 0% APR)
    expect(result.financing.eligible).toBe(true);

    // Payment methods should include afterpay
    expect(result.methods.some(m => m.id === 'afterpay')).toBe(true);
    expect(result.methods.some(m => m.id === 'credit-card')).toBe(true);
    expect(result.methods.some(m => m.id === 'apple-pay')).toBe(true);
    expect(result.methods.some(m => m.id === 'google-pay')).toBe(true);

    // Badges should include secure checkout
    expect(result.badges.some(b => b.type === 'secure')).toBe(true);
  });

  it('handles string price', async () => {
    const result = await getPaymentOptions('299.99');
    expect(result.success).toBe(true);
    expect(result.price).toBe(299.99);
  });

  it('excludes Afterpay for low price ($20)', async () => {
    const result = await getPaymentOptions(20);
    expect(result.success).toBe(true);
    expect(result.afterpay.eligible).toBe(false);
    expect(result.methods.some(m => m.id === 'afterpay')).toBe(false);
  });

  it('excludes Afterpay for high price ($1500)', async () => {
    const result = await getPaymentOptions(1500);
    expect(result.success).toBe(true);
    expect(result.afterpay.eligible).toBe(false);
  });

  it('excludes free shipping badge at $999 (free shipping disabled)', async () => {
    const result = await getPaymentOptions(999);
    expect(result.badges.some(b => b.type === 'free-shipping')).toBe(false);
  });

  it('excludes free shipping badge below $999', async () => {
    const result = await getPaymentOptions(998);
    expect(result.badges.some(b => b.type === 'free-shipping')).toBe(false);
  });

  it('returns Afterpay eligible at exact $35 boundary', async () => {
    const result = await getPaymentOptions(35);
    expect(result.afterpay.eligible).toBe(true);
    expect(result.afterpay.installmentAmount).toBe(8.75);
  });

  it('returns Afterpay eligible at exact $1000 boundary', async () => {
    const result = await getPaymentOptions(1000);
    expect(result.afterpay.eligible).toBe(true);
    expect(result.afterpay.installmentAmount).toBe(250);
  });

  it('returns Afterpay ineligible at $34.99', async () => {
    const result = await getPaymentOptions(34.99);
    expect(result.afterpay.eligible).toBe(false);
  });

  it('returns Afterpay ineligible at $1000.01', async () => {
    const result = await getPaymentOptions(1000.01);
    expect(result.afterpay.eligible).toBe(false);
  });

  it('includes afterpay in methods for eligible price', async () => {
    const result = await getPaymentOptions(500);
    const afterpayMethod = result.methods.find(m => m.id === 'afterpay');
    expect(afterpayMethod).toBeDefined();
    expect(afterpayMethod.brands).toContain('Afterpay');
  });

  it('includes credit card brands', async () => {
    const result = await getPaymentOptions(100);
    const cc = result.methods.find(m => m.id === 'credit-card');
    expect(cc.brands).toEqual(['Visa', 'Mastercard', 'Amex', 'Discover']);
  });

  it('always includes secure checkout badge', async () => {
    const result = await getPaymentOptions(50);
    const secure = result.badges.find(b => b.type === 'secure');
    expect(secure).toBeDefined();
    expect(secure.label).toBe('Secure Checkout');
  });

  it('includes afterpay badge for eligible price', async () => {
    const result = await getPaymentOptions(200);
    const badge = result.badges.find(b => b.type === 'afterpay');
    expect(badge).toBeDefined();
    expect(badge.label).toBe('Pay in 4 with Afterpay');
  });

  it('includes financing badge for $500', async () => {
    const result = await getPaymentOptions(500);
    const badge = result.badges.find(b => b.type === 'financing');
    expect(badge).toBeDefined();
    expect(badge.label).toBe('As low as $84/mo'); // Math.ceil(83.33) = 84 for $500/6mo 0% APR
  });

  it('returns financing ineligible below $300', async () => {
    const result = await getPaymentOptions(200);
    expect(result.financing.eligible).toBe(false);
  });

  it('returns financing eligible at $300', async () => {
    const result = await getPaymentOptions(300);
    expect(result.financing.eligible).toBe(true);
  });

  it('returns error for null price', async () => {
    const result = await getPaymentOptions(null);
    expect(result.success).toBe(false);
  });

  it('returns error for undefined price', async () => {
    const result = await getPaymentOptions(undefined);
    expect(result.success).toBe(false);
  });
});

// ── getAfterpayMessage ──────────────────────────────────────────────

describe('getAfterpayMessage', () => {
  it('returns error for invalid price', async () => {
    const result = await getAfterpayMessage(0);
    expect(result.success).toBe(false);
  });

  it('returns eligible message for $200 product', async () => {
    const result = await getAfterpayMessage(200);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.installmentAmount).toBe(50);
    expect(result.message).toContain('4 interest-free payments');
    expect(result.message).toContain('$50.00');
  });

  it('returns ineligible for $25 product', async () => {
    const result = await getAfterpayMessage(25);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Minimum order $35');
  });

  it('returns ineligible for $1200 product', async () => {
    const result = await getAfterpayMessage(1200);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Maximum order $1000');
  });

  it('rounds installments correctly for $99.99', async () => {
    const result = await getAfterpayMessage(99.99);
    expect(result.installmentAmount).toBe(25.0); // 99.99/4 = 24.9975, rounded to 25.00
  });

  it('returns eligible at exact $35 boundary', async () => {
    const result = await getAfterpayMessage(35);
    expect(result.eligible).toBe(true);
    expect(result.installments).toBe(4);
  });

  it('returns eligible at exact $1000 boundary', async () => {
    const result = await getAfterpayMessage(1000);
    expect(result.eligible).toBe(true);
    expect(result.totalCost).toBe(1000);
  });

  it('returns totalCost equal to original price (no fees)', async () => {
    const result = await getAfterpayMessage(400);
    expect(result.totalCost).toBe(400);
  });

  it('handles string price', async () => {
    const result = await getAfterpayMessage('500');
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.installmentAmount).toBe(125);
  });

  it('returns error for null', async () => {
    const result = await getAfterpayMessage(null);
    expect(result.success).toBe(false);
  });
});

// ── getBatchPaymentBadges ───────────────────────────────────────────

describe('getBatchPaymentBadges', () => {
  it('returns empty for empty array', async () => {
    const result = await getBatchPaymentBadges([]);
    expect(result.success).toBe(true);
    expect(result.badges).toEqual({});
  });

  it('returns empty for non-array', async () => {
    const result = await getBatchPaymentBadges(null);
    expect(result.success).toBe(true);
    expect(result.badges).toEqual({});
  });

  it('returns afterpay badges for eligible products', async () => {
    const result = await getBatchPaymentBadges([
      { productId: 'prod-1', price: 500 },
      { productId: 'prod-2', price: 20 },
    ]);
    expect(result.success).toBe(true);
    expect(result.badges['prod-1']).toBeTruthy();
    expect(result.badges['prod-1'].some(b => b.type === 'afterpay')).toBe(true);
    expect(result.badges['prod-2']).toBeUndefined(); // $20 below minimum
  });

  it('includes financing badges', async () => {
    const result = await getBatchPaymentBadges([
      { productId: 'prod-1', price: 800 },
    ]);
    expect(result.badges['prod-1'].some(b => b.type === 'financing')).toBe(true);
  });

  it('limits to 50 products', async () => {
    const products = Array.from({ length: 60 }, (_, i) => ({ productId: `prod-${i}`, price: 500 }));
    const result = await getBatchPaymentBadges(products);
    expect(Object.keys(result.badges).length).toBeLessThanOrEqual(50);
  });

  it('skips products with invalid data', async () => {
    const result = await getBatchPaymentBadges([
      { productId: '', price: 500 },
      { productId: 'prod-1', price: 'invalid' },
    ]);
    expect(Object.keys(result.badges).length).toBe(0);
  });

  it('uses _id as fallback when productId missing', async () => {
    const result = await getBatchPaymentBadges([
      { _id: 'fallback-id', price: 500 },
    ]);
    expect(result.badges['fallback-id']).toBeTruthy();
  });

  it('badge includes color and textColor', async () => {
    const result = await getBatchPaymentBadges([
      { productId: 'p1', price: 500 },
    ]);
    const badge = result.badges['p1'][0];
    expect(badge.color).toBeDefined();
    expect(badge.textColor).toBeDefined();
  });

  it('returns no badges for products below all thresholds', async () => {
    const result = await getBatchPaymentBadges([
      { productId: 'p1', price: 10 },
    ]);
    expect(result.badges['p1']).toBeUndefined();
  });

  it('skips negative priced products', async () => {
    const result = await getBatchPaymentBadges([
      { productId: 'neg', price: -50 },
    ]);
    expect(result.badges['neg']).toBeUndefined();
  });

  it('handles undefined input', async () => {
    const result = await getBatchPaymentBadges(undefined);
    expect(result.success).toBe(true);
    expect(result.badges).toEqual({});
  });
});

// ── getCheckoutPaymentSummary ───────────────────────────────────────

describe('getCheckoutPaymentSummary', () => {
  it('returns error for invalid total', async () => {
    const result = await getCheckoutPaymentSummary(0);
    expect(result.success).toBe(false);
  });

  it('returns full summary for $750 cart', async () => {
    const result = await getCheckoutPaymentSummary(750);
    expect(result.success).toBe(true);
    expect(result.summary.cartTotal).toBe(750);

    // Pay now methods
    expect(result.summary.payNow.methods.length).toBeGreaterThan(0);
    expect(result.summary.payNow.methods.every(m => m.id !== 'afterpay')).toBe(true);

    // Afterpay
    expect(result.summary.afterpay).toBeTruthy();
    expect(result.summary.afterpay.installmentAmount).toBe(187.5);

    // Financing
    expect(result.summary.financing).toBeTruthy();

    // Shipping message not set when free shipping is disabled
    expect(result.summary.shippingMessage).toBeUndefined();
  });

  it('does NOT set shipping message for $1000 cart (free shipping disabled)', async () => {
    const result = await getCheckoutPaymentSummary(1000);
    expect(result.summary.shippingMessage).toBeUndefined();
  });

  it('excludes afterpay for $1500 cart', async () => {
    const result = await getCheckoutPaymentSummary(1500);
    expect(result.summary.afterpay).toBeUndefined();
  });

  it('handles string total', async () => {
    const result = await getCheckoutPaymentSummary('500');
    expect(result.success).toBe(true);
    expect(result.summary.cartTotal).toBe(500);
  });

  it('payNow message includes formatted dollar amount', async () => {
    const result = await getCheckoutPaymentSummary(500);
    expect(result.summary.payNow.message).toBe('Pay $500.00 now');
  });

  it('afterpay section includes all required fields', async () => {
    const result = await getCheckoutPaymentSummary(500);
    expect(result.summary.afterpay.installmentAmount).toBe(125);
    expect(result.summary.afterpay.installments).toBe(4);
    expect(result.summary.afterpay.totalCost).toBe(500);
    expect(result.summary.afterpay.message).toBeDefined();
  });

  it('financing section includes tiers and bestTier', async () => {
    const result = await getCheckoutPaymentSummary(500);
    expect(result.summary.financing.tiers.length).toBeGreaterThan(0);
    expect(result.summary.financing.bestTier).toBeDefined();
    expect(result.summary.financing.message).toBeDefined();
  });

  it('excludes financing for $200 cart', async () => {
    const result = await getCheckoutPaymentSummary(200);
    expect(result.summary.financing).toBeUndefined();
  });

  it('returns error for null', async () => {
    const result = await getCheckoutPaymentSummary(null);
    expect(result.success).toBe(false);
  });

  it('returns error for negative total', async () => {
    const result = await getCheckoutPaymentSummary(-100);
    expect(result.success).toBe(false);
  });
});

// ── getInstallmentCalculation ───────────────────────────────────────

describe('getInstallmentCalculation', () => {
  it('returns error for invalid price', async () => {
    const result = await getInstallmentCalculation(0, 12);
    expect(result.success).toBe(false);
  });

  it('returns error for invalid months', async () => {
    const result = await getInstallmentCalculation(500, 0);
    expect(result.success).toBe(false);
  });

  it('calculates 0% APR for $500 over 6 months', async () => {
    const result = await getInstallmentCalculation(500, 6);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(0);
    expect(result.monthlyPayment).toBeCloseTo(83.33, 1);
    expect(result.totalInterest).toBe(0);
    expect(result.isPromotional).toBe(true);
  });

  it('calculates 0% APR for $1500 over 12 months', async () => {
    const result = await getInstallmentCalculation(1500, 12);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(0);
    expect(result.monthlyPayment).toBe(125);
    expect(result.totalInterest).toBe(0);
    expect(result.isPromotional).toBe(true);
  });

  it('calculates 9.99% APR for $3000 over 24 months', async () => {
    const result = await getInstallmentCalculation(3000, 24);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(9.99);
    expect(result.monthlyPayment).toBeGreaterThan(125);
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.isPromotional).toBe(false);
    expect(result.tierLabel).toContain('24 months');
  });

  it('uses default rate for non-tier amounts', async () => {
    const result = await getInstallmentCalculation(200, 3);
    expect(result.success).toBe(true);
    expect(result.isPromotional).toBe(false);
    expect(result.apr).toBe(9.99);
  });

  it('handles string inputs', async () => {
    const result = await getInstallmentCalculation('1000', '12');
    expect(result.success).toBe(true);
    expect(result.price).toBe(1000);
    expect(result.months).toBe(12);
  });

  it('rejects Infinity price', async () => {
    const result = await getInstallmentCalculation(Infinity, 12);
    expect(result.success).toBe(false);
  });

  it('rejects Infinity months', async () => {
    const result = await getInstallmentCalculation(500, Infinity);
    expect(result.success).toBe(false);
  });

  it('rejects "Infinity" string price', async () => {
    const result = await getInstallmentCalculation('Infinity', 12);
    expect(result.success).toBe(false);
  });

  it('caps months at 120 to prevent Math.pow overflow', async () => {
    const result = await getInstallmentCalculation(500, 9999);
    expect(result.success).toBe(false);
  });

  it('rejects negative months', async () => {
    const result = await getInstallmentCalculation(500, -6);
    expect(result.success).toBe(false);
  });

  it('calculates 36-month tier for $7000', async () => {
    const result = await getInstallmentCalculation(7000, 36);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(9.99);
    expect(result.isPromotional).toBe(false);
    expect(result.tierLabel).toContain('36 months');
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  it('0% APR tier has zero total interest', async () => {
    const result = await getInstallmentCalculation(600, 6);
    expect(result.totalInterest).toBe(0);
    expect(result.totalCost).toBe(600);
  });

  it('non-tier calculation includes totalCost > price', async () => {
    const result = await getInstallmentCalculation(100, 12);
    expect(result.totalCost).toBeGreaterThan(100);
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  it('returns error for months > 120', async () => {
    const result = await getInstallmentCalculation(500, 121);
    expect(result.success).toBe(false);
    expect(result.error).toContain('1-120');
  });

  it('accepts exactly 120 months', async () => {
    const result = await getInstallmentCalculation(500, 120);
    expect(result.success).toBe(true);
    expect(result.months).toBe(120);
  });

  it('returns error for NaN months string', async () => {
    const result = await getInstallmentCalculation(500, 'abc');
    expect(result.success).toBe(false);
  });

  it('returns error for negative price', async () => {
    const result = await getInstallmentCalculation(-500, 12);
    expect(result.success).toBe(false);
  });
});

// ── Payment options edge cases ──────────────────────────────────────

describe('Payment options — Infinity/overflow protection', () => {
  it('rejects Infinity price in getPaymentOptions', async () => {
    const result = await getPaymentOptions(Infinity);
    expect(result.success).toBe(false);
  });

  it('rejects "Infinity" string in getPaymentOptions', async () => {
    const result = await getPaymentOptions('Infinity');
    expect(result.success).toBe(false);
  });

  it('rejects Infinity in getAfterpayMessage', async () => {
    const result = await getAfterpayMessage(Infinity);
    expect(result.success).toBe(false);
  });

  it('rejects Infinity in getCheckoutPaymentSummary', async () => {
    const result = await getCheckoutPaymentSummary(Infinity);
    expect(result.success).toBe(false);
  });

  it('rejects -Infinity price', async () => {
    const result = await getPaymentOptions(-Infinity);
    expect(result.success).toBe(false);
  });

  it('skips Infinity-priced products in batch badges', async () => {
    const result = await getBatchPaymentBadges([
      { productId: 'inf-prod', price: Infinity },
      { productId: 'good-prod', price: 500 },
    ]);
    expect(result.badges['inf-prod']).toBeUndefined();
    expect(result.badges['good-prod']).toBeTruthy();
  });
});
