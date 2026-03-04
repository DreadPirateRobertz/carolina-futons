import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  validatePromoCode,
  applyPromoCode,
  getActiveFlashSales,
  getActiveBOGODeals,
  calculateBOGOSavings,
  createFlashSale,
  createPromoCode,
} from '../src/backend/promotionsEngine.web.js';

beforeEach(() => {
  __reset();
});

// ── validatePromoCode ─────────────────────────────────────────────

describe('validatePromoCode', () => {
  it('returns valid result for active, unexpired promo code', async () => {
    __seed('PromoCodes', [{
      _id: 'p1',
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      minSubtotal: 0,
      maxUses: 100,
      usesCount: 5,
    }]);

    const result = await validatePromoCode('SAVE10');
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.promo.type).toBe('percentage');
    expect(result.promo.value).toBe(10);
  });

  it('returns invalid for nonexistent code', async () => {
    __seed('PromoCodes', []);
    const result = await validatePromoCode('NOEXIST');
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid promo code');
  });

  it('returns invalid for inactive code', async () => {
    __seed('PromoCodes', [{
      _id: 'p2', code: 'INACTIVE', type: 'percentage', value: 10,
      isActive: false, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0,
    }]);

    const result = await validatePromoCode('INACTIVE');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('This promo code is no longer active');
  });

  it('returns invalid for expired code', async () => {
    __seed('PromoCodes', [{
      _id: 'p3', code: 'EXPIRED', type: 'percentage', value: 10,
      isActive: true, startDate: new Date(Date.now() - 172800000),
      endDate: new Date(Date.now() - 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0,
    }]);

    const result = await validatePromoCode('EXPIRED');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('This promo code has expired');
  });

  it('returns invalid for code not yet started', async () => {
    __seed('PromoCodes', [{
      _id: 'p4', code: 'FUTURE', type: 'percentage', value: 10,
      isActive: true, startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000), minSubtotal: 0,
      maxUses: 100, usesCount: 0,
    }]);

    const result = await validatePromoCode('FUTURE');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('This promo code is not yet active');
  });

  it('returns invalid when max uses reached', async () => {
    __seed('PromoCodes', [{
      _id: 'p5', code: 'MAXED', type: 'percentage', value: 10,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 10, usesCount: 10,
    }]);

    const result = await validatePromoCode('MAXED');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('This promo code has reached its usage limit');
  });

  it('case-insensitive code matching', async () => {
    __seed('PromoCodes', [{
      _id: 'p6', code: 'SAVE10', type: 'percentage', value: 10,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0,
    }]);

    const result = await validatePromoCode('save10');
    expect(result.valid).toBe(true);
  });

  it('rejects empty code', async () => {
    const result = await validatePromoCode('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Promo code is required');
  });

  it('rejects null code', async () => {
    const result = await validatePromoCode(null);
    expect(result.success).toBe(false);
  });

  it('strips HTML from code input', async () => {
    __seed('PromoCodes', [{
      _id: 'p7', code: 'SAVE10', type: 'percentage', value: 10,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0,
    }]);

    const result = await validatePromoCode('<script>alert("xss")</script>SAVE10');
    // Sanitized to "alert("xss")SAVE10" which won't match
    expect(result.valid).toBe(false);
  });

  it('allows unlimited uses when maxUses is 0', async () => {
    __seed('PromoCodes', [{
      _id: 'p8', code: 'UNLIMITED', type: 'percentage', value: 5,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 0, usesCount: 9999,
    }]);

    const result = await validatePromoCode('UNLIMITED');
    expect(result.valid).toBe(true);
  });
});

// ── applyPromoCode ─────────────────────────────────────────────────

describe('applyPromoCode', () => {
  const cartItems = [
    { _id: 'item1', name: 'Futon Frame', price: 499, quantity: 1, category: 'frames' },
    { _id: 'item2', name: 'Mattress', price: 299, quantity: 2, category: 'mattresses' },
  ];

  it('applies percentage discount to full cart', async () => {
    __seed('PromoCodes', [{
      _id: 'p1', code: 'SAVE10', type: 'percentage', value: 10,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0, applicableCategories: '',
      applicableProducts: '',
    }]);

    const result = await applyPromoCode('SAVE10', cartItems);
    expect(result.success).toBe(true);
    // subtotal: 499 + (299*2) = 1097, 10% off = 109.70
    expect(result.discount).toBe(109.7);
    expect(result.discountType).toBe('percentage');
    expect(result.subtotalAfterDiscount).toBe(987.3);
  });

  it('applies fixed amount discount', async () => {
    __seed('PromoCodes', [{
      _id: 'p2', code: 'FLAT50', type: 'fixed', value: 50,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0, applicableCategories: '',
      applicableProducts: '',
    }]);

    const result = await applyPromoCode('FLAT50', cartItems);
    expect(result.success).toBe(true);
    expect(result.discount).toBe(50);
    expect(result.subtotalAfterDiscount).toBe(1047);
  });

  it('applies free shipping discount', async () => {
    __seed('PromoCodes', [{
      _id: 'p3', code: 'FREESHIP', type: 'freeShipping', value: 0,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0, applicableCategories: '',
      applicableProducts: '',
    }]);

    const result = await applyPromoCode('FREESHIP', cartItems);
    expect(result.success).toBe(true);
    expect(result.discount).toBe(0);
    expect(result.freeShipping).toBe(true);
  });

  it('rejects when subtotal is below minimum', async () => {
    __seed('PromoCodes', [{
      _id: 'p4', code: 'BIG', type: 'percentage', value: 15,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 2000,
      maxUses: 100, usesCount: 0, applicableCategories: '',
      applicableProducts: '',
    }]);

    const result = await applyPromoCode('BIG', [{ _id: 'x', price: 100, quantity: 1 }]);
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/minimum/i);
  });

  it('caps fixed discount at subtotal (no negative total)', async () => {
    __seed('PromoCodes', [{
      _id: 'p5', code: 'HUGE', type: 'fixed', value: 5000,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0, applicableCategories: '',
      applicableProducts: '',
    }]);

    const result = await applyPromoCode('HUGE', [{ _id: 'x', price: 50, quantity: 1 }]);
    expect(result.success).toBe(true);
    expect(result.discount).toBe(50);
    expect(result.subtotalAfterDiscount).toBe(0);
  });

  it('applies category-specific discount only to matching items', async () => {
    __seed('PromoCodes', [{
      _id: 'p6', code: 'FRAMES15', type: 'percentage', value: 15,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0, applicableCategories: 'frames',
      applicableProducts: '',
    }]);

    const result = await applyPromoCode('FRAMES15', cartItems);
    expect(result.success).toBe(true);
    // Only frame (499) gets 15% off = 74.85
    expect(result.discount).toBe(74.85);
  });

  it('increments usage count on successful apply', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = { col, item }; });

    __seed('PromoCodes', [{
      _id: 'p7', code: 'TRACK', type: 'fixed', value: 10,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 5, applicableCategories: '',
      applicableProducts: '',
    }]);

    await applyPromoCode('TRACK', cartItems);
    expect(updated).not.toBeNull();
    expect(updated.col).toBe('PromoCodes');
    expect(updated.item.usesCount).toBe(6);
  });

  it('rejects empty cart', async () => {
    const result = await applyPromoCode('ANY', []);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cart/i);
  });

  it('rejects null cart', async () => {
    const result = await applyPromoCode('ANY', null);
    expect(result.success).toBe(false);
  });

  it('caps percentage at 100', async () => {
    __seed('PromoCodes', [{
      _id: 'p8', code: 'ALL', type: 'percentage', value: 150,
      isActive: true, startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000), minSubtotal: 0,
      maxUses: 100, usesCount: 0, applicableCategories: '',
      applicableProducts: '',
    }]);

    const result = await applyPromoCode('ALL', cartItems);
    expect(result.discount).toBeLessThanOrEqual(1097);
    expect(result.subtotalAfterDiscount).toBe(0);
  });
});

// ── getActiveFlashSales ────────────────────────────────────────────

describe('getActiveFlashSales', () => {
  it('returns currently active flash sales', async () => {
    const now = Date.now();
    __seed('FlashSales', [{
      _id: 'fs1', title: 'Weekend Deal', discountPercent: 25,
      isActive: true, startTime: new Date(now - 3600000),
      endTime: new Date(now + 3600000), maxQuantity: 50,
      productIds: 'prod1,prod2',
    }]);

    const result = await getActiveFlashSales();
    expect(result.success).toBe(true);
    expect(result.sales).toHaveLength(1);
    expect(result.sales[0].title).toBe('Weekend Deal');
    expect(result.sales[0].discountPercent).toBe(25);
  });

  it('excludes expired flash sales', async () => {
    __seed('FlashSales', [{
      _id: 'fs2', title: 'Past Deal', discountPercent: 30,
      isActive: true, startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 3600000), maxQuantity: 50,
      productIds: 'prod1',
    }]);

    const result = await getActiveFlashSales();
    expect(result.sales).toHaveLength(0);
  });

  it('excludes inactive flash sales', async () => {
    __seed('FlashSales', [{
      _id: 'fs3', title: 'Draft Sale', discountPercent: 20,
      isActive: false, startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000), maxQuantity: 50,
      productIds: 'prod1',
    }]);

    const result = await getActiveFlashSales();
    expect(result.sales).toHaveLength(0);
  });

  it('returns remaining time for active sales', async () => {
    const endTime = new Date(Date.now() + 7200000); // 2 hours from now
    __seed('FlashSales', [{
      _id: 'fs4', title: 'Timed', discountPercent: 15,
      isActive: true, startTime: new Date(Date.now() - 3600000),
      endTime, maxQuantity: 50, productIds: 'prod1',
    }]);

    const result = await getActiveFlashSales();
    expect(result.sales[0].remainingMs).toBeGreaterThan(0);
    expect(result.sales[0].remainingMs).toBeLessThanOrEqual(7200000);
  });

  it('returns empty array on error', async () => {
    // No seed — collection doesn't error but returns empty
    const result = await getActiveFlashSales();
    expect(result.success).toBe(true);
    expect(result.sales).toEqual([]);
  });
});

// ── getActiveBOGODeals ─────────────────────────────────────────────

describe('getActiveBOGODeals', () => {
  it('returns active BOGO deals', async () => {
    __seed('BOGODeals', [{
      _id: 'b1', title: 'Buy Frame Get Cover Free',
      buyCategory: 'frames', buyQuantity: 1,
      getCategory: 'covers', getQuantity: 1,
      getDiscountPercent: 100,
      isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    }]);

    const result = await getActiveBOGODeals();
    expect(result.success).toBe(true);
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0].title).toBe('Buy Frame Get Cover Free');
    expect(result.deals[0].getDiscountPercent).toBe(100);
  });

  it('excludes expired deals', async () => {
    __seed('BOGODeals', [{
      _id: 'b2', title: 'Old Deal',
      buyCategory: 'frames', buyQuantity: 1,
      getCategory: 'covers', getQuantity: 1,
      getDiscountPercent: 100, isActive: true,
      startDate: new Date(Date.now() - 172800000),
      endDate: new Date(Date.now() - 86400000),
    }]);

    const result = await getActiveBOGODeals();
    expect(result.deals).toHaveLength(0);
  });

  it('excludes inactive deals', async () => {
    __seed('BOGODeals', [{
      _id: 'b3', title: 'Inactive',
      buyCategory: 'frames', buyQuantity: 1,
      getCategory: 'covers', getQuantity: 1,
      getDiscountPercent: 50, isActive: false,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    }]);

    const result = await getActiveBOGODeals();
    expect(result.deals).toHaveLength(0);
  });
});

// ── calculateBOGOSavings ────────────────────────────────────────────

describe('calculateBOGOSavings', () => {
  it('calculates free item savings for matching BOGO', async () => {
    __seed('BOGODeals', [{
      _id: 'b1', title: 'Buy Frame Get Cover Free',
      buyCategory: 'frames', buyQuantity: 1,
      getCategory: 'covers', getQuantity: 1,
      getDiscountPercent: 100, isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    }]);

    const cart = [
      { _id: 'i1', name: 'Frame', price: 499, quantity: 1, category: 'frames' },
      { _id: 'i2', name: 'Cover', price: 89, quantity: 1, category: 'covers' },
    ];

    const result = await calculateBOGOSavings(cart);
    expect(result.success).toBe(true);
    expect(result.totalSavings).toBe(89);
    expect(result.appliedDeals).toHaveLength(1);
    expect(result.appliedDeals[0].savings).toBe(89);
  });

  it('calculates partial discount BOGO (50% off)', async () => {
    __seed('BOGODeals', [{
      _id: 'b2', title: 'Buy Frame Get Mattress 50% Off',
      buyCategory: 'frames', buyQuantity: 1,
      getCategory: 'mattresses', getQuantity: 1,
      getDiscountPercent: 50, isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    }]);

    const cart = [
      { _id: 'i1', name: 'Frame', price: 499, quantity: 1, category: 'frames' },
      { _id: 'i2', name: 'Mattress', price: 299, quantity: 1, category: 'mattresses' },
    ];

    const result = await calculateBOGOSavings(cart);
    expect(result.totalSavings).toBe(149.5);
  });

  it('returns zero savings when cart does not qualify', async () => {
    __seed('BOGODeals', [{
      _id: 'b3', title: 'Buy Frame Get Cover Free',
      buyCategory: 'frames', buyQuantity: 1,
      getCategory: 'covers', getQuantity: 1,
      getDiscountPercent: 100, isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    }]);

    const cart = [
      { _id: 'i1', name: 'Mattress', price: 299, quantity: 1, category: 'mattresses' },
    ];

    const result = await calculateBOGOSavings(cart);
    expect(result.totalSavings).toBe(0);
    expect(result.appliedDeals).toHaveLength(0);
  });

  it('handles multiple BOGO deals simultaneously', async () => {
    __seed('BOGODeals', [
      {
        _id: 'b4a', title: 'Buy Frame Get Cover Free',
        buyCategory: 'frames', buyQuantity: 1,
        getCategory: 'covers', getQuantity: 1,
        getDiscountPercent: 100, isActive: true,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
      },
      {
        _id: 'b4b', title: 'Buy Frame Get Pillow Free',
        buyCategory: 'frames', buyQuantity: 1,
        getCategory: 'pillows', getQuantity: 1,
        getDiscountPercent: 100, isActive: true,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
      },
    ]);

    const cart = [
      { _id: 'i1', name: 'Frame', price: 499, quantity: 1, category: 'frames' },
      { _id: 'i2', name: 'Cover', price: 89, quantity: 1, category: 'covers' },
      { _id: 'i3', name: 'Pillow', price: 39, quantity: 1, category: 'pillows' },
    ];

    const result = await calculateBOGOSavings(cart);
    expect(result.totalSavings).toBe(128); // 89 + 39
    expect(result.appliedDeals).toHaveLength(2);
  });

  it('returns empty result for empty cart', async () => {
    const result = await calculateBOGOSavings([]);
    expect(result.success).toBe(true);
    expect(result.totalSavings).toBe(0);
  });

  it('returns empty result for null cart', async () => {
    const result = await calculateBOGOSavings(null);
    expect(result.success).toBe(true);
    expect(result.totalSavings).toBe(0);
  });

  it('applies BOGO per qualifying quantity', async () => {
    __seed('BOGODeals', [{
      _id: 'b5', title: 'Buy 2 Pillows Get 1 Free',
      buyCategory: 'pillows', buyQuantity: 2,
      getCategory: 'pillows', getQuantity: 1,
      getDiscountPercent: 100, isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    }]);

    const cart = [
      { _id: 'i1', name: 'Pillow', price: 39, quantity: 3, category: 'pillows' },
    ];

    const result = await calculateBOGOSavings(cart);
    // Buy 2 get 1 free: 3 pillows → 1 free pillow
    expect(result.totalSavings).toBe(39);
  });
});

// ── createFlashSale ────────────────────────────────────────────────

describe('createFlashSale', () => {
  it('creates a flash sale with valid params', async () => {
    const result = await createFlashSale({
      title: 'Spring Sale',
      discountPercent: 20,
      durationHours: 24,
      productIds: 'prod1,prod2',
      maxQuantity: 50,
    });

    expect(result.success).toBe(true);
    expect(result.sale.title).toBe('Spring Sale');
    expect(result.sale.isActive).toBe(true);
  });

  it('rejects missing title', async () => {
    const result = await createFlashSale({
      discountPercent: 20,
      durationHours: 24,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/title/i);
  });

  it('rejects invalid discount percent', async () => {
    const result = await createFlashSale({
      title: 'Bad', discountPercent: 0, durationHours: 24,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/discount/i);
  });

  it('rejects discount over 100', async () => {
    const result = await createFlashSale({
      title: 'Over', discountPercent: 150, durationHours: 24,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/discount/i);
  });

  it('rejects zero/negative duration', async () => {
    const result = await createFlashSale({
      title: 'Zero', discountPercent: 10, durationHours: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/duration/i);
  });

  it('sanitizes title input', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = { col, item }; });

    await createFlashSale({
      title: '<script>alert("xss")</script>Clean Sale',
      discountPercent: 10,
      durationHours: 12,
    });

    expect(inserted.item.title).not.toContain('<script>');
  });

  it('defaults maxQuantity to 0 (unlimited)', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = { col, item }; });

    await createFlashSale({
      title: 'No Limit', discountPercent: 10, durationHours: 12,
    });

    expect(inserted.item.maxQuantity).toBe(0);
  });
});

// ── createPromoCode ─────────────────────────────────────────────────

describe('createPromoCode', () => {
  it('creates a percentage promo code', async () => {
    const result = await createPromoCode({
      code: 'SUMMER20',
      type: 'percentage',
      value: 20,
      durationDays: 30,
    });

    expect(result.success).toBe(true);
    expect(result.promo.code).toBe('SUMMER20');
    expect(result.promo.type).toBe('percentage');
  });

  it('creates a fixed amount promo code', async () => {
    const result = await createPromoCode({
      code: 'FLAT25',
      type: 'fixed',
      value: 25,
      durationDays: 14,
    });

    expect(result.success).toBe(true);
    expect(result.promo.type).toBe('fixed');
    expect(result.promo.value).toBe(25);
  });

  it('creates a free shipping promo code', async () => {
    const result = await createPromoCode({
      code: 'SHIPFREE',
      type: 'freeShipping',
      durationDays: 7,
    });

    expect(result.success).toBe(true);
    expect(result.promo.type).toBe('freeShipping');
  });

  it('rejects missing code', async () => {
    const result = await createPromoCode({ type: 'percentage', value: 10, durationDays: 7 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', async () => {
    const result = await createPromoCode({ code: 'BAD', type: 'bogus', value: 10, durationDays: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/type/i);
  });

  it('rejects percentage over 100', async () => {
    const result = await createPromoCode({
      code: 'OVER', type: 'percentage', value: 110, durationDays: 7,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/100/);
  });

  it('rejects negative value', async () => {
    const result = await createPromoCode({
      code: 'NEG', type: 'fixed', value: -10, durationDays: 7,
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate code', async () => {
    __seed('PromoCodes', [{
      _id: 'existing', code: 'DUPE', type: 'percentage', value: 10,
      isActive: true, startDate: new Date(), endDate: new Date(),
      minSubtotal: 0, maxUses: 100, usesCount: 0,
    }]);

    const result = await createPromoCode({
      code: 'DUPE', type: 'percentage', value: 10, durationDays: 7,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });

  it('sanitizes code input', async () => {
    const result = await createPromoCode({
      code: '<b>CLEAN</b>',
      type: 'percentage', value: 10, durationDays: 7,
    });
    expect(result.success).toBe(true);
    expect(result.promo.code).not.toContain('<b>');
  });

  it('uppercases code', async () => {
    const result = await createPromoCode({
      code: 'lowercase',
      type: 'percentage', value: 10, durationDays: 7,
    });
    expect(result.promo.code).toBe('LOWERCASE');
  });

  it('sets category and product restrictions', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = { col, item }; });

    await createPromoCode({
      code: 'FRAMES',
      type: 'percentage', value: 15, durationDays: 7,
      applicableCategories: 'frames,covers',
      applicableProducts: 'prod1',
    });

    expect(inserted.item.applicableCategories).toBe('frames,covers');
    expect(inserted.item.applicableProducts).toBe('prod1');
  });
});
