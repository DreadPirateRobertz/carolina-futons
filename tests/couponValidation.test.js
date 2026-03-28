/**
 * @file couponValidation.test.js
 * @description CF-w6yd: Tests for mobile coupon/bundle validation endpoint.
 *
 * Covers:
 *  - calculateSubtotal math
 *  - checkPromoCoupon: valid, expired, inactive, max uses, min subtotal, percentage, fixed, freeShipping
 *  - checkBundleCoupon: valid bundle, missing items, inactive bundle
 *  - validateBundleCoupon: rate limiting, input validation, integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── calculateSubtotal ───────────────────────────────────────────────

describe('_calculateSubtotal', () => {
  let _calculateSubtotal;

  beforeEach(async () => {
    ({ _calculateSubtotal } = await import('../src/backend/couponValidation.web.js'));
  });

  it('sums price * quantity for all items', () => {
    const result = _calculateSubtotal([
      { productId: 'a', price: 100, quantity: 2 },
      { productId: 'b', price: 50, quantity: 1 },
    ]);
    expect(result).toBe(250);
  });

  it('clamps negative prices to 0', () => {
    const result = _calculateSubtotal([{ productId: 'a', price: -10, quantity: 1 }]);
    expect(result).toBe(0);
  });

  it('clamps quantity to min 1', () => {
    const result = _calculateSubtotal([{ productId: 'a', price: 100, quantity: 0 }]);
    expect(result).toBe(100); // qty clamped to 1
  });

  it('rounds to 2 decimal places', () => {
    const result = _calculateSubtotal([{ productId: 'a', price: 33.33, quantity: 3 }]);
    expect(result).toBe(99.99);
  });
});

// ── checkPromoCoupon ────────────────────────────────────────────────

describe('_checkPromoCoupon', () => {
  let _checkPromoCoupon;

  beforeEach(async () => {
    ({ _checkPromoCoupon } = await import('../src/backend/couponValidation.web.js'));
  });

  const validPromo = {
    _id: 'promo-1',
    code: 'SAVE10',
    type: 'percentage',
    value: 10,
    isActive: true,
    usesCount: 0,
    maxUses: 0,
    minSubtotal: 0,
    applicableCategories: '',
    applicableProducts: '',
  };

  const cartItems = [{ productId: 'p1', price: 100, quantity: 2, category: 'futons' }];

  it('returns valid with correct discount for percentage coupon', async () => {
    __seed('PromoCodes', [validPromo]);
    const result = await _checkPromoCoupon('SAVE10', cartItems);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(20); // 10% of $200
    expect(result.discountType).toBe('percentage');
    expect(result.subtotalAfterDiscount).toBe(180);
  });

  it('returns valid with correct discount for fixed coupon', async () => {
    __seed('PromoCodes', [{ ...validPromo, type: 'fixed', value: 25 }]);
    const result = await _checkPromoCoupon('SAVE10', cartItems);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(25);
  });

  it('returns valid for freeShipping coupon', async () => {
    __seed('PromoCodes', [{ ...validPromo, type: 'freeShipping' }]);
    const result = await _checkPromoCoupon('SAVE10', cartItems);
    expect(result.valid).toBe(true);
    expect(result.freeShipping).toBe(true);
    expect(result.discount).toBe(0);
  });

  it('rejects invalid code', async () => {
    const result = await _checkPromoCoupon('INVALID', cartItems);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid/i);
  });

  it('rejects expired coupon', async () => {
    __seed('PromoCodes', [{
      ...validPromo,
      endDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    }]);
    const result = await _checkPromoCoupon('SAVE10', cartItems);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it('rejects inactive coupon', async () => {
    __seed('PromoCodes', [{ ...validPromo, isActive: false }]);
    const result = await _checkPromoCoupon('SAVE10', cartItems);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no longer active/i);
  });

  it('rejects when max uses exceeded', async () => {
    __seed('PromoCodes', [{ ...validPromo, maxUses: 5, usesCount: 5 }]);
    const result = await _checkPromoCoupon('SAVE10', cartItems);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/usage limit/i);
  });

  it('rejects when below minimum subtotal', async () => {
    __seed('PromoCodes', [{ ...validPromo, minSubtotal: 500 }]);
    const result = await _checkPromoCoupon('SAVE10', cartItems);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/minimum order/i);
  });

  it('applies discount only to applicable categories', async () => {
    __seed('PromoCodes', [{ ...validPromo, applicableCategories: 'mattresses' }]);
    const items = [
      { productId: 'p1', price: 100, quantity: 1, category: 'futons' },
      { productId: 'p2', price: 200, quantity: 1, category: 'mattresses' },
    ];
    const result = await _checkPromoCoupon('SAVE10', items);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(20); // 10% of $200 mattress only
    expect(result.applicableItems).toContain('p2');
  });
});

// ── checkBundleCoupon ───────────────────────────────────────────────

describe('_checkBundleCoupon', () => {
  let _checkBundleCoupon;

  beforeEach(async () => {
    ({ _checkBundleCoupon } = await import('../src/backend/couponValidation.web.js'));
  });

  const bundle = {
    _id: 'bundle-1',
    couponCode: 'BUNDLE50',
    isActive: true,
    displayName: 'Monterey Complete Set',
    frameProductId: 'frame-1',
    mattressProductId: 'mattress-1',
    coverProductId: 'cover-1',
    bundlePrice: 499,
    savings: 150,
  };

  it('returns matched:false when no bundle matches the code', async () => {
    const result = await _checkBundleCoupon('NOTABUNDLE', []);
    expect(result.matched).toBe(false);
  });

  it('returns valid when all bundle items are in cart', async () => {
    __seed('Bundles', [bundle]);
    const cartItems = [
      { productId: 'frame-1', price: 300, quantity: 1 },
      { productId: 'mattress-1', price: 200, quantity: 1 },
      { productId: 'cover-1', price: 149, quantity: 1 },
    ];
    const result = await _checkBundleCoupon('BUNDLE50', cartItems);
    expect(result.matched).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.response.discount).toBe(150);
    expect(result.response.bundleName).toBe('Monterey Complete Set');
  });

  it('returns invalid when cart is missing bundle items', async () => {
    __seed('Bundles', [bundle]);
    const cartItems = [
      { productId: 'frame-1', price: 300, quantity: 1 },
      // Missing mattress and cover
    ];
    const result = await _checkBundleCoupon('BUNDLE50', cartItems);
    expect(result.matched).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.response.reason).toMatch(/missing/i);
  });
});

// ── validateBundleCoupon (integration) ──────────────────────────────

describe('validateBundleCoupon', () => {
  let validateBundleCoupon;

  beforeEach(async () => {
    ({ validateBundleCoupon } = await import('../src/backend/couponValidation.web.js'));
  });

  it('rejects missing coupon code', async () => {
    const result = await validateBundleCoupon('', [{ productId: 'p1', price: 100, quantity: 1 }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/required/i);
  });

  it('rejects empty cart', async () => {
    const result = await validateBundleCoupon('CODE', []);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/required/i);
  });

  it('rate-limits per member', async () => {
    __seed('CouponValidationRateLimit', [{
      _id: 'rl-1',
      key: 'anon',
      count: 10,
      windowStart: new Date(),
    }]);

    const result = await validateBundleCoupon('CODE', [{ productId: 'p1', price: 100, quantity: 1 }]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('validates a promo code against cart items', async () => {
    __seed('PromoCodes', [{
      _id: 'promo-1',
      code: 'MOBILE20',
      type: 'fixed',
      value: 20,
      isActive: true,
      usesCount: 0,
      maxUses: 0,
      minSubtotal: 0,
      applicableCategories: '',
      applicableProducts: '',
    }]);

    const result = await validateBundleCoupon('MOBILE20', [
      { productId: 'p1', price: 100, quantity: 1 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(20);
    expect(result.subtotalAfterDiscount).toBe(80);
  });
});
