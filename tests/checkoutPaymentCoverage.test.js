/**
 * Tests for checkoutOptimization.web.js and paymentOptions.web.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __onInsert } from 'wix-data';

// ── checkoutOptimization ──────────────────────────────────────────────
import {
  calculateOrderSummary,
  validateShippingAddress,
  getShippingOptions,
  getDeliveryEstimate,
  trackCheckoutStep,
  getAbandonmentRate,
  getExpressCheckoutSummary,
} from 'backend/checkoutOptimization.web';

// ── paymentOptions ────────────────────────────────────────────────────
import {
  getPaymentOptions,
  getAfterpayMessage,
  getBatchPaymentBadges,
  getCheckoutPaymentSummary,
  getInstallmentCalculation,
} from 'backend/paymentOptions.web';

beforeEach(() => {
  resetData();
});

// ═══════════════════════════════════════════════════════════════════════
// checkoutOptimization.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('checkout — calculateOrderSummary', () => {
  it('rejects missing params', () => {
    expect(calculateOrderSummary(null).success).toBe(false);
  });

  it('rejects empty items array', () => {
    expect(calculateOrderSummary({ items: [] }).success).toBe(false);
  });

  it('rejects non-array items', () => {
    expect(calculateOrderSummary({ items: 'not-array' }).success).toBe(false);
  });

  it('calculates basic order with one item', () => {
    const result = calculateOrderSummary({ items: [{ price: 100, quantity: 2 }] });
    expect(result.success).toBe(true);
    expect(result.data.subtotal).toBe(200);
    expect(result.data.itemCount).toBe(2);
    expect(result.data.tax).toBeGreaterThan(0);
    expect(result.data.total).toBeGreaterThan(200);
  });

  it('applies NC tax rate for NC state', () => {
    const result = calculateOrderSummary({ items: [{ price: 100, quantity: 1 }], state: 'NC' });
    expect(result.data.taxRate).toBe(0.0675);
    expect(result.data.tax).toBe(6.75);
  });

  it('applies SC tax rate', () => {
    const result = calculateOrderSummary({ items: [{ price: 100, quantity: 1 }], state: 'sc' });
    expect(result.data.taxRate).toBe(0.06);
  });

  it('applies default tax rate for unknown state', () => {
    const result = calculateOrderSummary({ items: [{ price: 100, quantity: 1 }], state: 'XX' });
    expect(result.data.taxRate).toBe(0.065);
  });

  it('applies default tax rate when no state provided', () => {
    const result = calculateOrderSummary({ items: [{ price: 100, quantity: 1 }] });
    expect(result.data.taxRate).toBe(0.065);
  });

  it('skips items with negative price', () => {
    const result = calculateOrderSummary({
      items: [{ price: 100, quantity: 1 }, { price: -50, quantity: 1 }],
    });
    expect(result.data.subtotal).toBe(100);
    expect(result.data.itemCount).toBe(1);
  });

  it('defaults quantity to 1 if missing', () => {
    const result = calculateOrderSummary({ items: [{ price: 50 }] });
    expect(result.data.itemCount).toBe(1);
    expect(result.data.subtotal).toBe(50);
  });

  it('clamps quantity to 1-99 range', () => {
    const r1 = calculateOrderSummary({ items: [{ price: 10, quantity: 0 }] });
    expect(r1.data.itemCount).toBe(1);
    const r2 = calculateOrderSummary({ items: [{ price: 10, quantity: 150 }] });
    expect(r2.data.itemCount).toBe(99);
  });

  it('limits to 50 items max', () => {
    const items = Array.from({ length: 60 }, () => ({ price: 1, quantity: 1 }));
    const result = calculateOrderSummary({ items });
    expect(result.data.itemCount).toBe(50);
  });

  it('calculates standard shipping', () => {
    const result = calculateOrderSummary({ items: [{ price: 500, quantity: 1 }] });
    expect(result.data.shipping.method).toBe('standard');
    expect(result.data.shipping.amount).toBe(49.99);
  });

  it('calculates white glove local shipping', () => {
    const result = calculateOrderSummary({ items: [{ price: 500, quantity: 1 }], shippingMethod: 'white_glove_local' });
    expect(result.data.shipping.method).toBe('white_glove_local');
    expect(result.data.shipping.amount).toBe(149);
  });

  it('calculates white glove regional shipping', () => {
    const result = calculateOrderSummary({ items: [{ price: 500, quantity: 1 }], shippingMethod: 'white_glove_regional' });
    expect(result.data.shipping.amount).toBe(249);
  });

  it('shows free shipping progress when not qualifying', () => {
    const result = calculateOrderSummary({ items: [{ price: 100, quantity: 1 }] });
    expect(result.data.freeShippingProgress.qualifies).toBe(false);
    expect(result.data.freeShippingProgress.remaining).toBeGreaterThan(0);
    expect(result.data.freeShippingProgress.percentage).toBeLessThan(100);
  });

  it('savings is 0 when not qualifying for free shipping', () => {
    const result = calculateOrderSummary({ items: [{ price: 100, quantity: 1 }] });
    expect(result.data.savings).toBe(0);
  });

  it('rounds monetary values to 2 decimal places', () => {
    const result = calculateOrderSummary({ items: [{ price: 33.33, quantity: 3 }], state: 'NC' });
    const str = result.data.subtotal.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

describe('checkout — validateShippingAddress', () => {
  it('rejects null address', () => {
    const result = validateShippingAddress(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Address is required.');
  });

  it('rejects non-object address', () => {
    const result = validateShippingAddress('string');
    expect(result.valid).toBe(false);
  });

  it('validates complete address', () => {
    const result = validateShippingAddress({
      fullName: 'John Smith',
      addressLine1: '123 Main St',
      city: 'Hendersonville',
      state: 'NC',
      zip: '28792',
    });
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('requires full name at least 2 chars', () => {
    const result = validateShippingAddress({
      fullName: 'J',
      addressLine1: '123 Main St',
      city: 'City',
      state: 'NC',
      zip: '28792',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('Full name'));
  });

  it('requires address line at least 3 chars', () => {
    const result = validateShippingAddress({
      fullName: 'John',
      addressLine1: 'AB',
      city: 'City',
      state: 'NC',
      zip: '28792',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('Street address'));
  });

  it('requires 2-letter state code', () => {
    const result = validateShippingAddress({
      fullName: 'John',
      addressLine1: '123 Main',
      city: 'City',
      state: 'North Carolina',
      zip: '28792',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('state'));
  });

  it('accepts ZIP+4 format', () => {
    const result = validateShippingAddress({
      fullName: 'John Smith',
      addressLine1: '123 Main St',
      city: 'City',
      state: 'NC',
      zip: '28792-1234',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid ZIP format', () => {
    const result = validateShippingAddress({
      fullName: 'John Smith',
      addressLine1: '123 Main St',
      city: 'City',
      state: 'NC',
      zip: 'ABCDE',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('ZIP'));
  });

  it('collects multiple errors', () => {
    const result = validateShippingAddress({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('checkout — getShippingOptions', () => {
  it('returns three options', () => {
    const result = getShippingOptions(500);
    expect(result.success).toBe(true);
    expect(result.options).toHaveLength(3);
    expect(result.options[0].id).toBe('standard');
    expect(result.options[1].id).toBe('white_glove_local');
    expect(result.options[2].id).toBe('white_glove_regional');
  });

  it('shows standard shipping price for low subtotal', () => {
    const result = getShippingOptions(100);
    expect(result.options[0].price).toBe(49.99);
    expect(result.options[1].price).toBe(149);
    expect(result.options[2].price).toBe(249);
  });

  it('handles zero subtotal', () => {
    const result = getShippingOptions(0);
    expect(result.options[0].price).toBe(49.99);
  });

  it('handles NaN subtotal', () => {
    const result = getShippingOptions('invalid');
    expect(result.success).toBe(true);
    expect(result.options[0].price).toBe(49.99);
  });

  it('each option has estimated days', () => {
    const result = getShippingOptions(500);
    for (const opt of result.options) {
      expect(opt.estimatedDays.min).toBeDefined();
      expect(opt.estimatedDays.max).toBeDefined();
      expect(opt.estimatedDays.min).toBeLessThanOrEqual(opt.estimatedDays.max);
    }
  });
});

describe('checkout — getDeliveryEstimate', () => {
  it('returns date range for standard shipping', () => {
    const result = getDeliveryEstimate('standard');
    expect(result.success).toBe(true);
    expect(result.data.minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.data.maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.data.label).toContain('–');
  });

  it('returns date range for white glove local', () => {
    const result = getDeliveryEstimate('white_glove_local');
    expect(result.success).toBe(true);
  });

  it('defaults to standard for unknown method', () => {
    const result = getDeliveryEstimate('unknown_method');
    const standard = getDeliveryEstimate('standard');
    expect(result.data.minDate).toBe(standard.data.minDate);
  });

  it('defaults to standard when no method provided', () => {
    const result = getDeliveryEstimate();
    expect(result.success).toBe(true);
  });

  it('min date is before max date', () => {
    const result = getDeliveryEstimate('standard');
    expect(new Date(result.data.minDate).getTime()).toBeLessThan(new Date(result.data.maxDate).getTime());
  });
});

describe('checkout — trackCheckoutStep', () => {
  it('rejects null data', async () => {
    const result = await trackCheckoutStep(null);
    expect(result.success).toBe(false);
  });

  it('rejects missing sessionId', async () => {
    const result = await trackCheckoutStep({ step: 'start' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Session ID');
  });

  it('rejects invalid step name', async () => {
    const result = await trackCheckoutStep({ sessionId: 'sess-1', step: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid step');
  });

  it('tracks valid start step', async () => {
    let inserted = null;
    __onInsert((c, item) => { if (c === 'CheckoutAnalytics') inserted = item; });
    const result = await trackCheckoutStep({ sessionId: 'sess-1', step: 'start', cartTotal: 250, itemCount: 3 });
    expect(result.success).toBe(true);
    expect(inserted.sessionId).toBe('sess-1');
    expect(inserted.step).toBe('start');
    expect(inserted.cartTotal).toBe(250);
    expect(inserted.itemCount).toBe(3);
    expect(inserted.timestamp).toBeInstanceOf(Date);
  });

  it('tracks abandon step', async () => {
    const result = await trackCheckoutStep({ sessionId: 'sess-2', step: 'abandon' });
    expect(result.success).toBe(true);
  });

  it('serializes metadata to JSON', async () => {
    let inserted = null;
    __onInsert((c, item) => { if (c === 'CheckoutAnalytics') inserted = item; });
    await trackCheckoutStep({ sessionId: 'sess-3', step: 'payment', metadata: { method: 'card' } });
    expect(inserted.metadata).toBe('{"method":"card"}');
  });

  it('defaults cartTotal to 0 for negative value', async () => {
    let inserted = null;
    __onInsert((c, item) => { if (c === 'CheckoutAnalytics') inserted = item; });
    await trackCheckoutStep({ sessionId: 'sess-4', step: 'start', cartTotal: -50 });
    expect(inserted.cartTotal).toBe(0);
  });
});

describe('checkout — getAbandonmentRate', () => {
  it('returns 0% when no data', async () => {
    const result = await getAbandonmentRate();
    expect(result.success).toBe(true);
    expect(result.data.totalStarts).toBe(0);
    expect(result.data.totalCompletes).toBe(0);
    expect(result.data.abandonRate).toBe(0);
  });

  it('calculates correct abandonment rate', async () => {
    const now = new Date();
    __seed('CheckoutAnalytics', [
      { step: 'start', timestamp: now },
      { step: 'start', timestamp: now },
      { step: 'start', timestamp: now },
      { step: 'complete', timestamp: now },
    ]);
    const result = await getAbandonmentRate(7);
    expect(result.success).toBe(true);
    expect(result.data.totalStarts).toBe(3);
    expect(result.data.totalCompletes).toBe(1);
    expect(result.data.abandonRate).toBeCloseTo(66.67, 1);
  });

  it('clamps days to 1-90', async () => {
    // Note: Number(0) || 7 = 7 (0 is falsy), so 0 defaults to 7
    const result = await getAbandonmentRate(0);
    expect(result.data.period).toBe('7 days');
    const result2 = await getAbandonmentRate(200);
    expect(result2.data.period).toBe('90 days');
  });

  it('defaults to 7 days', async () => {
    const result = await getAbandonmentRate();
    expect(result.data.period).toBe('7 days');
  });
});

describe('checkout — getExpressCheckoutSummary', () => {
  it('rejects missing items', () => {
    const result = getExpressCheckoutSummary({ address: { state: 'NC' } });
    expect(result.success).toBe(false);
  });

  it('rejects missing address', () => {
    const result = getExpressCheckoutSummary({ items: [{ price: 100 }] });
    expect(result.success).toBe(false);
  });

  it('rejects address without state', () => {
    const result = getExpressCheckoutSummary({ items: [{ price: 100 }], address: { fullName: 'Test' } });
    expect(result.success).toBe(false);
  });

  it('returns express summary with sanitized address', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 500, quantity: 1 }],
      address: {
        fullName: 'John Smith',
        addressLine1: '123 Main St',
        city: 'Hendersonville',
        state: 'NC',
        zip: '28792',
      },
    });
    expect(result.success).toBe(true);
    expect(result.data.subtotal).toBe(500);
    expect(result.data.expressReady).toBe(true);
    expect(result.data.shippingAddress.fullName).toBe('John Smith');
    expect(result.data.shippingAddress.state).toBe('NC');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// paymentOptions.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('payment — getPaymentOptions', () => {
  it('rejects zero price', async () => {
    const result = await getPaymentOptions(0);
    expect(result.success).toBe(false);
  });

  it('rejects negative price', async () => {
    const result = await getPaymentOptions(-50);
    expect(result.success).toBe(false);
  });

  it('rejects NaN price', async () => {
    const result = await getPaymentOptions('invalid');
    expect(result.success).toBe(false);
  });

  it('accepts string price', async () => {
    const result = await getPaymentOptions('100');
    expect(result.success).toBe(true);
    expect(result.price).toBe(100);
  });

  it('returns afterpay info for eligible price', async () => {
    const result = await getPaymentOptions(100);
    expect(result.afterpay.eligible).toBe(true);
    expect(result.afterpay.installmentAmount).toBe(25);
    expect(result.afterpay.installments).toBe(4);
  });

  it('afterpay ineligible below $35', async () => {
    const result = await getPaymentOptions(20);
    expect(result.afterpay.eligible).toBe(false);
    expect(result.afterpay.reason).toContain('Minimum');
  });

  it('afterpay ineligible above $1000', async () => {
    const result = await getPaymentOptions(1500);
    expect(result.afterpay.eligible).toBe(false);
    expect(result.afterpay.reason).toContain('Maximum');
  });

  it('returns financing info for eligible price', async () => {
    const result = await getPaymentOptions(500);
    expect(result.financing.eligible).toBe(true);
    expect(result.financing.tiers.length).toBeGreaterThan(0);
    expect(result.financing.bestTier).toBeDefined();
  });

  it('financing ineligible below $300', async () => {
    const result = await getPaymentOptions(100);
    expect(result.financing.eligible).toBe(false);
  });

  it('returns payment methods including afterpay for eligible price', async () => {
    const result = await getPaymentOptions(100);
    const methodIds = result.methods.map(m => m.id);
    expect(methodIds).toContain('credit-card');
    expect(methodIds).toContain('apple-pay');
    expect(methodIds).toContain('google-pay');
    expect(methodIds).toContain('afterpay');
  });

  it('excludes afterpay from methods when ineligible', async () => {
    const result = await getPaymentOptions(20);
    const methodIds = result.methods.map(m => m.id);
    expect(methodIds).not.toContain('afterpay');
  });

  it('returns secure checkout badge', async () => {
    const result = await getPaymentOptions(100);
    const types = result.badges.map(b => b.type);
    expect(types).toContain('secure');
  });

  it('includes afterpay badge when eligible', async () => {
    const result = await getPaymentOptions(100);
    const apBadge = result.badges.find(b => b.type === 'afterpay');
    expect(apBadge).toBeDefined();
    expect(apBadge.label).toBe('Pay in 4 with Afterpay');
  });

  it('includes financing badge for $500+', async () => {
    const result = await getPaymentOptions(500);
    const fBadge = result.badges.find(b => b.type === 'financing');
    expect(fBadge).toBeDefined();
  });

  it('financing bestTier prefers 0% APR', async () => {
    const result = await getPaymentOptions(500);
    expect(result.financing.bestTier.apr).toBe(0);
  });

  it('financing uses longest term at same APR', async () => {
    const result = await getPaymentOptions(1200);
    // $1200 qualifies for 6mo 0%, 12mo 0% → best = 12mo
    expect(result.financing.bestTier.months).toBe(12);
  });

  it('financing bestTier picks longest non-zero when no 0% available', async () => {
    // $5000 qualifies for 24mo 9.99%, 36mo 9.99% → best = 36mo
    const result = await getPaymentOptions(5000);
    expect(result.financing.bestTier.months).toBe(36);
  });

  it('financing monthly payment for non-zero APR tier', async () => {
    const result = await getPaymentOptions(5000);
    const tier36 = result.financing.tiers.find(t => t.months === 36);
    expect(tier36).toBeDefined();
    expect(tier36.monthlyPayment).toBeGreaterThan(5000 / 36); // interest adds
  });
});

describe('payment — getAfterpayMessage', () => {
  it('rejects invalid price', async () => {
    const result = await getAfterpayMessage(0);
    expect(result.success).toBe(false);
  });

  it('returns eligible message', async () => {
    const result = await getAfterpayMessage(200);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.message).toContain('$50.00');
    expect(result.installments).toBe(4);
  });

  it('returns ineligible for price above max', async () => {
    const result = await getAfterpayMessage(2000);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
  });
});

describe('payment — getBatchPaymentBadges', () => {
  it('returns empty badges for empty array', async () => {
    const result = await getBatchPaymentBadges([]);
    expect(result.success).toBe(true);
    expect(Object.keys(result.badges)).toHaveLength(0);
  });

  it('returns empty badges for undefined', async () => {
    const result = await getBatchPaymentBadges();
    expect(result.success).toBe(true);
  });

  it('generates badges for eligible products', async () => {
    const result = await getBatchPaymentBadges([
      { _id: 'p1', price: 100 },
      { _id: 'p2', price: 500 },
      { _id: 'p3', price: 10 },
    ]);
    expect(result.success).toBe(true);
    // p1 ($100) — afterpay eligible
    expect(result.badges['p1']).toBeDefined();
    expect(result.badges['p1'].some(b => b.type === 'afterpay')).toBe(true);
    // p2 ($500) — financing eligible
    expect(result.badges['p2']).toBeDefined();
    expect(result.badges['p2'].some(b => b.type === 'financing')).toBe(true);
    // p3 ($10) — nothing eligible
    expect(result.badges['p3']).toBeUndefined();
  });

  it('uses productId over _id', async () => {
    const result = await getBatchPaymentBadges([{ productId: 'custom-id', price: 100 }]);
    expect(result.badges['custom-id']).toBeDefined();
  });

  it('skips products with invalid price', async () => {
    const result = await getBatchPaymentBadges([{ _id: 'bad', price: 'invalid' }]);
    expect(Object.keys(result.badges)).toHaveLength(0);
  });

  it('limits to 50 products', async () => {
    const products = Array.from({ length: 60 }, (_, i) => ({ _id: `p${i}`, price: 100 }));
    const result = await getBatchPaymentBadges(products);
    expect(Object.keys(result.badges).length).toBeLessThanOrEqual(50);
  });
});

describe('payment — getCheckoutPaymentSummary', () => {
  it('rejects invalid total', async () => {
    const result = await getCheckoutPaymentSummary(0);
    expect(result.success).toBe(false);
  });

  it('returns summary with payNow section', async () => {
    const result = await getCheckoutPaymentSummary(500);
    expect(result.success).toBe(true);
    expect(result.summary.cartTotal).toBe(500);
    expect(result.summary.payNow.methods.length).toBeGreaterThan(0);
    expect(result.summary.payNow.message).toContain('$500.00');
  });

  it('includes afterpay when eligible', async () => {
    const result = await getCheckoutPaymentSummary(200);
    expect(result.summary.afterpay).toBeDefined();
    expect(result.summary.afterpay.installments).toBe(4);
    expect(result.summary.afterpay.totalCost).toBe(200);
  });

  it('excludes afterpay when ineligible', async () => {
    const result = await getCheckoutPaymentSummary(2000);
    expect(result.summary.afterpay).toBeUndefined();
  });

  it('includes financing when eligible', async () => {
    const result = await getCheckoutPaymentSummary(500);
    expect(result.summary.financing).toBeDefined();
    expect(result.summary.financing.tiers.length).toBeGreaterThan(0);
  });

  it('excludes afterpay from payNow methods', async () => {
    const result = await getCheckoutPaymentSummary(200);
    const payNowIds = result.summary.payNow.methods.map(m => m.id);
    expect(payNowIds).not.toContain('afterpay');
  });

  it('no shipping message (threshold unreachable)', async () => {
    // FREE_SHIPPING_THRESHOLD is 999999, which is >= 100000, so the if block is skipped
    const result = await getCheckoutPaymentSummary(500);
    expect(result.summary.shippingMessage).toBeUndefined();
  });
});

describe('payment — getInstallmentCalculation', () => {
  it('rejects invalid price', async () => {
    const result = await getInstallmentCalculation(0, 12);
    expect(result.success).toBe(false);
  });

  it('rejects invalid months', async () => {
    const result = await getInstallmentCalculation(500, 0);
    expect(result.success).toBe(false);
  });

  it('rejects months > 120', async () => {
    const result = await getInstallmentCalculation(500, 121);
    expect(result.success).toBe(false);
  });

  it('calculates 0% APR promotional tier', async () => {
    const result = await getInstallmentCalculation(500, 6);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(0);
    expect(result.monthlyPayment).toBeCloseTo(83.33, 1);
    expect(result.totalInterest).toBe(0);
    expect(result.isPromotional).toBe(true);
    expect(result.tierLabel).toContain('6 months');
  });

  it('calculates 0% APR for 12 months', async () => {
    const result = await getInstallmentCalculation(1200, 12);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(0);
    expect(result.monthlyPayment).toBe(100);
    expect(result.isPromotional).toBe(true);
  });

  it('calculates non-promotional tier with interest', async () => {
    const result = await getInstallmentCalculation(2500, 24);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(9.99);
    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.totalCost).toBeGreaterThan(2500);
    expect(result.isPromotional).toBe(false);
  });

  it('falls back to default rate for non-matching tier', async () => {
    const result = await getInstallmentCalculation(500, 48);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(9.99);
    expect(result.isPromotional).toBe(false);
    expect(result.tierLabel).toBeUndefined();
  });

  it('accepts string inputs', async () => {
    const result = await getInstallmentCalculation('1000', '12');
    expect(result.success).toBe(true);
    expect(result.price).toBe(1000);
    expect(result.months).toBe(12);
  });
});
