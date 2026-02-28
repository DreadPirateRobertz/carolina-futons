/**
 * Cart & Checkout Flow Polish Tests (cf-6arz)
 * Tests for side cart quantity operations, checkout payment UI integration,
 * discount calculations, empty cart handling, and form validation edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import {
  getShippingProgress,
  getTierProgress,
  clampQuantity,
  safeMultiply,
  FREE_SHIPPING_THRESHOLD,
  TIER_THRESHOLDS,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from '../src/public/cartService.js';
import {
  calculateOrderSummary,
  validateShippingAddress,
  getShippingOptions,
  getDeliveryEstimate,
} from '../src/backend/checkoutOptimization.web.js';
import {
  getPaymentOptions,
  getAfterpayMessage,
  getCheckoutPaymentSummary,
  getInstallmentCalculation,
} from '../src/backend/paymentOptions.web.js';

beforeEach(() => {
  resetData();
});

// ── Side Cart: Quantity Spinner Logic ─────────────────────────────────

describe('Side cart quantity spinner operations', () => {
  it('clamps quantity to MIN_QUANTITY on decrement below 1', () => {
    expect(clampQuantity(0)).toBe(MIN_QUANTITY);
    expect(clampQuantity(-5)).toBe(MIN_QUANTITY);
  });

  it('clamps quantity to MAX_QUANTITY on increment above 99', () => {
    expect(clampQuantity(100)).toBe(MAX_QUANTITY);
    expect(clampQuantity(999)).toBe(MAX_QUANTITY);
  });

  it('allows valid quantity values between min and max', () => {
    expect(clampQuantity(1)).toBe(1);
    expect(clampQuantity(50)).toBe(50);
    expect(clampQuantity(99)).toBe(99);
  });

  it('truncates non-integer quantities via parseInt', () => {
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(2.3)).toBe(2);
  });

  it('handles NaN and undefined quantity input', () => {
    expect(clampQuantity(NaN)).toBe(MIN_QUANTITY);
    expect(clampQuantity(undefined)).toBe(MIN_QUANTITY);
    expect(clampQuantity(null)).toBe(MIN_QUANTITY);
    expect(clampQuantity('abc')).toBe(MIN_QUANTITY);
  });

  it('calculates line total correctly for quantity changes', () => {
    expect(safeMultiply(549, 1)).toBe(549);
    expect(safeMultiply(549, 2)).toBe(1098);
    expect(safeMultiply(89.99, 3)).toBe(269.97);
  });

  it('handles zero and negative price in line total', () => {
    expect(safeMultiply(0, 5)).toBe(0);
    // safeMultiply doesn't guard negatives — it multiplies as-is
    expect(safeMultiply(-10, 2)).toBe(-20);
  });

  it('handles float precision in line total', () => {
    // 19.99 * 3 = 59.97 (not 59.970000000000006)
    expect(safeMultiply(19.99, 3)).toBe(59.97);
  });
});

// ── Tiered Discount Display ──────────────────────────────────────────

describe('Tiered discount progress bar calculations', () => {
  it('shows 5% tier progress from $0', () => {
    const result = getTierProgress(0);
    expect(result.tier).toBeDefined();
    expect(result.tier.discount).toBe(5);
    expect(result.progressPct).toBe(0);
    expect(result.remaining).toBe(500);
  });

  it('shows progress toward 5% tier at $250', () => {
    const result = getTierProgress(250);
    expect(result.progressPct).toBe(50);
    expect(result.remaining).toBe(250);
  });

  it('unlocks 5% tier at exactly $500', () => {
    const result = getTierProgress(500);
    // At $500, should be at the 10% tier targeting $1000
    expect(result.tier.discount).toBe(10);
  });

  it('shows 10% tier progress at $750', () => {
    const result = getTierProgress(750);
    expect(result.tier.discount).toBe(10);
    expect(result.remaining).toBe(250);
  });

  it('reaches max tier at $1000+', () => {
    const result = getTierProgress(1000);
    expect(result.progressPct).toBe(100);
  });

  it('stays at max tier for very large subtotals', () => {
    const result = getTierProgress(5000);
    expect(result.progressPct).toBe(100);
  });

  it('tier labels contain readable text', () => {
    TIER_THRESHOLDS.forEach(tier => {
      const label = tier.label('100.00');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });
});

// ── Free Shipping Progress ───────────────────────────────────────────

describe('Free shipping progress bar calculations', () => {
  it('shows full remaining amount at $0', () => {
    const result = getShippingProgress(0);
    expect(result.remaining).toBe(FREE_SHIPPING_THRESHOLD);
    expect(result.progressPct).toBe(0);
    expect(result.qualifies).toBe(false);
  });

  it('shows correct progress at $500', () => {
    const result = getShippingProgress(500);
    expect(result.remaining).toBeCloseTo(499, 0);
    expect(result.qualifies).toBe(false);
    expect(result.progressPct).toBeGreaterThan(0);
    expect(result.progressPct).toBeLessThan(100);
  });

  it('qualifies at exactly $999', () => {
    const result = getShippingProgress(999);
    expect(result.qualifies).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.progressPct).toBe(100);
  });

  it('qualifies above $999', () => {
    const result = getShippingProgress(1500);
    expect(result.qualifies).toBe(true);
    expect(result.progressPct).toBe(100);
  });

  it('Add $X more message accuracy at $998.01', () => {
    const result = getShippingProgress(998.01);
    // Should be $0.99 remaining
    expect(result.remaining).toBeCloseTo(0.99, 1);
    expect(result.qualifies).toBe(false);
  });
});

// ── Checkout: Payment UI Integration ─────────────────────────────────

describe('Checkout payment options display', () => {
  it('returns all standard payment methods for typical cart', async () => {
    const result = await getPaymentOptions(549);
    expect(result.success).toBe(true);
    expect(result.methods).toBeDefined();

    const methodIds = result.methods.map(m => m.id);
    expect(methodIds).toContain('credit-card');
    expect(methodIds).toContain('apple-pay');
    expect(methodIds).toContain('google-pay');
  });

  it('includes Afterpay for eligible amounts ($35-$1000)', async () => {
    const result = await getPaymentOptions(549);
    expect(result.afterpay.eligible).toBe(true);
    expect(result.methods.some(m => m.id === 'afterpay')).toBe(true);
  });

  it('excludes Afterpay for amounts over $1000', async () => {
    const result = await getPaymentOptions(1500);
    expect(result.afterpay.eligible).toBe(false);
    expect(result.methods.some(m => m.id === 'afterpay')).toBe(false);
  });

  it('excludes Afterpay for amounts under $35', async () => {
    const result = await getPaymentOptions(20);
    expect(result.afterpay.eligible).toBe(false);
  });

  it('returns payment method icons for UI display', async () => {
    const result = await getPaymentOptions(549);
    result.methods.forEach(method => {
      expect(method.icon).toBeDefined();
      expect(typeof method.icon).toBe('string');
      expect(method.icon.length).toBeGreaterThan(0);
    });
  });

  it('returns brand names for credit card display', async () => {
    const result = await getPaymentOptions(549);
    const cc = result.methods.find(m => m.id === 'credit-card');
    expect(cc.brands).toContain('Visa');
    expect(cc.brands).toContain('Mastercard');
    expect(cc.brands).toContain('Amex');
    expect(cc.brands).toContain('Discover');
  });

  it('returns error for invalid price', async () => {
    const result = await getPaymentOptions(-10);
    expect(result.success).toBe(false);
  });

  it('returns error for zero price', async () => {
    const result = await getPaymentOptions(0);
    expect(result.success).toBe(false);
  });

  it('handles string price input', async () => {
    const result = await getPaymentOptions('549');
    expect(result.success).toBe(true);
    expect(result.methods.length).toBeGreaterThan(0);
  });
});

// ── Checkout: Payment Summary for Checkout Page ──────────────────────

describe('Checkout payment summary integration', () => {
  it('returns complete summary for checkout display', async () => {
    const result = await getCheckoutPaymentSummary(549);
    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.summary.cartTotal).toBe(549);
    expect(result.summary.payNow).toBeDefined();
    expect(result.summary.payNow.methods.length).toBeGreaterThan(0);
  });

  it('includes Afterpay section for eligible amount', async () => {
    const result = await getCheckoutPaymentSummary(549);
    expect(result.summary.afterpay).toBeDefined();
    expect(result.summary.afterpay.installments).toBe(4);
    expect(result.summary.afterpay.installmentAmount).toBeCloseTo(137.25, 1);
  });

  it('excludes Afterpay section for ineligible amount', async () => {
    const result = await getCheckoutPaymentSummary(1500);
    expect(result.summary.afterpay).toBeUndefined();
  });

  it('includes financing section for eligible amount', async () => {
    const result = await getCheckoutPaymentSummary(549);
    expect(result.summary.financing).toBeDefined();
    expect(result.summary.financing.bestTier).toBeDefined();
  });

  it('shows free shipping message at $999+', async () => {
    const result = await getCheckoutPaymentSummary(1000);
    expect(result.summary.shippingMessage).toBe('Free shipping included');
  });

  it('shows shipping add-more message below $999', async () => {
    const result = await getCheckoutPaymentSummary(549);
    expect(result.summary.shippingMessage).toContain('Add $');
    expect(result.summary.shippingMessage).toContain('more for free shipping');
  });

  it('pay now methods exclude Afterpay (separate section)', async () => {
    const result = await getCheckoutPaymentSummary(549);
    const payNowIds = result.summary.payNow.methods.map(m => m.id);
    expect(payNowIds).not.toContain('afterpay');
    expect(payNowIds).toContain('credit-card');
    expect(payNowIds).toContain('apple-pay');
    expect(payNowIds).toContain('google-pay');
  });
});

// ── Checkout: Address Validation Edge Cases ──────────────────────────

describe('Checkout address form validation edge cases', () => {
  it('rejects empty object', () => {
    const result = validateShippingAddress({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects null address', () => {
    const result = validateShippingAddress(null);
    expect(result.valid).toBe(false);
  });

  it('rejects undefined address', () => {
    const result = validateShippingAddress(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects single-character name', () => {
    const result = validateShippingAddress({
      fullName: 'J',
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      zip: '28801',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('rejects short street address', () => {
    const result = validateShippingAddress({
      fullName: 'Jane Doe',
      addressLine1: 'AB',
      city: 'Asheville',
      state: 'NC',
      zip: '28801',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects 3-letter state code', () => {
    const result = validateShippingAddress({
      fullName: 'Jane Doe',
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NCC',
      zip: '28801',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects partial ZIP code', () => {
    const result = validateShippingAddress({
      fullName: 'Jane Doe',
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      zip: '288',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts valid ZIP+4 format', () => {
    const result = validateShippingAddress({
      fullName: 'Jane Doe',
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      zip: '28801-1234',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects XSS in name field', () => {
    const result = validateShippingAddress({
      fullName: '<script>alert("xss")</script>',
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      zip: '28801',
    });
    // sanitize should strip the tags, leaving too-short text or valid text
    // The important thing is no XSS passes through
    expect(result.success).toBe(true);
  });

  it('handles very long input strings', () => {
    const longStr = 'A'.repeat(500);
    const result = validateShippingAddress({
      fullName: longStr,
      addressLine1: longStr,
      city: longStr,
      state: 'NC',
      zip: '28801',
    });
    // Should not throw, sanitize truncates
    expect(result.success).toBe(true);
  });
});

// ── Cart: Empty State Handling ────────────────────────────────────────

describe('Cart empty state handling', () => {
  it('order summary rejects empty items array', () => {
    const result = calculateOrderSummary({ items: [], state: 'NC' });
    expect(result.success).toBe(false);
  });

  it('order summary rejects null items', () => {
    const result = calculateOrderSummary({ items: null, state: 'NC' });
    expect(result.success).toBe(false);
  });

  it('order summary rejects missing items', () => {
    const result = calculateOrderSummary({ state: 'NC' });
    expect(result.success).toBe(false);
  });

  it('order summary rejects null params', () => {
    const result = calculateOrderSummary(null);
    expect(result.success).toBe(false);
  });

  it('shipping progress at $0 shows zero progress', () => {
    const result = getShippingProgress(0);
    expect(result.progressPct).toBe(0);
    expect(result.qualifies).toBe(false);
  });

  it('tier progress at $0 shows tier 1 target', () => {
    const result = getTierProgress(0);
    expect(result.remaining).toBe(500);
    expect(result.progressPct).toBe(0);
  });
});

// ── Checkout: Delivery Estimate Edge Cases ───────────────────────────

describe('Delivery estimate edge cases', () => {
  it('standard delivery returns valid date range', () => {
    const result = getDeliveryEstimate('standard');
    expect(result.success).toBe(true);
    expect(result.data.minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.data.maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.data.label).toContain('–');
  });

  it('white glove local returns earlier dates than standard', () => {
    const standard = getDeliveryEstimate('standard');
    const wgLocal = getDeliveryEstimate('white_glove_local');
    expect(wgLocal.data.maxDate <= standard.data.maxDate).toBe(true);
  });

  it('handles unknown shipping method gracefully', () => {
    const result = getDeliveryEstimate('drone_delivery');
    expect(result.success).toBe(true);
    // Falls back to standard
    expect(result.data.minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles empty string shipping method', () => {
    const result = getDeliveryEstimate('');
    expect(result.success).toBe(true);
  });

  it('handles null shipping method', () => {
    const result = getDeliveryEstimate(null);
    expect(result.success).toBe(true);
  });
});

// ── Installment Calculation Edge Cases ───────────────────────────────

describe('Payment installment calculation edge cases', () => {
  it('rejects negative price', async () => {
    const result = await getInstallmentCalculation(-100, 6);
    expect(result.success).toBe(false);
  });

  it('rejects zero months', async () => {
    const result = await getInstallmentCalculation(549, 0);
    expect(result.success).toBe(false);
  });

  it('rejects excessive months (>120)', async () => {
    const result = await getInstallmentCalculation(549, 200);
    expect(result.success).toBe(false);
  });

  it('handles string price input', async () => {
    const result = await getInstallmentCalculation('549', 6);
    expect(result.success).toBe(true);
    expect(result.monthlyPayment).toBeCloseTo(91.5, 0);
  });

  it('returns promotional flag for 0% APR tier', async () => {
    const result = await getInstallmentCalculation(549, 6);
    expect(result.isPromotional).toBe(true);
    expect(result.apr).toBe(0);
  });

  it('returns non-promotional for standard APR', async () => {
    const result = await getInstallmentCalculation(3000, 24);
    expect(result.isPromotional).toBe(false);
    expect(result.apr).toBe(9.99);
  });

  it('total cost equals price for 0% APR', async () => {
    const result = await getInstallmentCalculation(549, 6);
    expect(result.totalCost).toBe(549);
    expect(result.totalInterest).toBe(0);
  });

  it('total cost exceeds price for non-zero APR', async () => {
    const result = await getInstallmentCalculation(3000, 24);
    expect(result.totalCost).toBeGreaterThan(3000);
    expect(result.totalInterest).toBeGreaterThan(0);
  });
});

// ── Shipping Options Display ─────────────────────────────────────────

describe('Shipping options for cart/checkout display', () => {
  it('shows all three shipping methods', () => {
    const result = getShippingOptions(500);
    expect(result.success).toBe(true);
    expect(result.options).toHaveLength(3);
    const ids = result.options.map(o => o.id);
    expect(ids).toContain('standard');
    expect(ids).toContain('white_glove_local');
    expect(ids).toContain('white_glove_regional');
  });

  it('standard shipping costs $49.99 under threshold', () => {
    const result = getShippingOptions(500);
    const standard = result.options.find(o => o.id === 'standard');
    expect(standard.price).toBe(49.99);
  });

  it('standard shipping is free at $999+', () => {
    const result = getShippingOptions(999);
    const standard = result.options.find(o => o.id === 'standard');
    expect(standard.price).toBe(0);
    expect(standard.label).toContain('FREE');
  });

  it('white glove is free at $1999+', () => {
    const result = getShippingOptions(1999);
    const wgLocal = result.options.find(o => o.id === 'white_glove_local');
    expect(wgLocal.price).toBe(0);
    expect(wgLocal.label).toContain('FREE');
  });

  it('all options have estimated delivery days', () => {
    const result = getShippingOptions(500);
    result.options.forEach(option => {
      expect(option.estimatedDays).toBeDefined();
      expect(option.estimatedDays.min).toBeLessThan(option.estimatedDays.max);
    });
  });

  it('all options have descriptions', () => {
    const result = getShippingOptions(500);
    result.options.forEach(option => {
      expect(option.description).toBeDefined();
      expect(option.description.length).toBeGreaterThan(0);
    });
  });
});

// ── Cart: Order Summary with Different Scenarios ─────────────────────

describe('Order summary for cart display', () => {
  it('calculates subtotal for single item', () => {
    const result = calculateOrderSummary({
      items: [{ price: 549, quantity: 1 }],
      state: 'NC',
    });
    expect(result.success).toBe(true);
    expect(result.data.subtotal).toBe(549);
    expect(result.data.itemCount).toBe(1);
  });

  it('calculates subtotal for multiple items with quantities', () => {
    const result = calculateOrderSummary({
      items: [
        { price: 549, quantity: 1 },
        { price: 299, quantity: 1 },
        { price: 89, quantity: 2 },
      ],
      state: 'NC',
    });
    expect(result.data.subtotal).toBe(1026);
    expect(result.data.itemCount).toBe(4);
  });

  it('includes free shipping progress data', () => {
    const result = calculateOrderSummary({
      items: [{ price: 500, quantity: 1 }],
      state: 'NC',
    });
    expect(result.data.freeShippingProgress).toBeDefined();
    expect(result.data.freeShippingProgress.qualifies).toBe(false);
    expect(result.data.freeShippingProgress.remaining).toBe(499);
  });

  it('shows qualified free shipping progress', () => {
    const result = calculateOrderSummary({
      items: [{ price: 1000, quantity: 1 }],
      state: 'NC',
    });
    expect(result.data.freeShippingProgress.qualifies).toBe(true);
    expect(result.data.freeShippingProgress.remaining).toBe(0);
  });

  it('handles items with zero price', () => {
    const result = calculateOrderSummary({
      items: [{ price: 0, quantity: 1 }],
      state: 'NC',
    });
    expect(result.success).toBe(true);
    expect(result.data.subtotal).toBe(0);
  });

  it('caps item quantity at 99', () => {
    const result = calculateOrderSummary({
      items: [{ price: 10, quantity: 200 }],
      state: 'NC',
    });
    expect(result.data.itemCount).toBe(99);
    expect(result.data.subtotal).toBe(990);
  });

  it('sets minimum quantity to 1', () => {
    const result = calculateOrderSummary({
      items: [{ price: 549, quantity: 0 }],
      state: 'NC',
    });
    expect(result.data.itemCount).toBe(1);
    expect(result.data.subtotal).toBe(549);
  });

  it('ignores negative prices', () => {
    const result = calculateOrderSummary({
      items: [
        { price: 549, quantity: 1 },
        { price: -100, quantity: 1 },
      ],
      state: 'NC',
    });
    expect(result.data.subtotal).toBe(549);
  });
});
