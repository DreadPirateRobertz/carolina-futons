import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  validatePromoCode, applyPromoCode, getActiveFlashSales,
  getActiveBOGODeals, calculateBOGOSavings, createFlashSale, createPromoCode,
} from '../src/backend/promotionsEngine.web.js';

beforeEach(() => {
  __reset();
});

// ── Helpers ───────────────────────────────────────────────────────

const DAY = 86400000;
const HOUR = 3600000;

function activePromo(overrides = {}) {
  return {
    _id: 'promo1',
    code: 'TEST20',
    type: 'percentage',
    value: 20,
    isActive: true,
    startDate: new Date(Date.now() - DAY),
    endDate: new Date(Date.now() + DAY),
    minSubtotal: 0,
    maxUses: 0,
    usesCount: 0,
    applicableCategories: '',
    applicableProducts: '',
    ...overrides,
  };
}

function cartItem(overrides = {}) {
  return { _id: 'item1', name: 'Futon', price: 100, quantity: 1, category: 'futons', ...overrides };
}

// ── applyPromoCode: category/product restrictions ─────────────────

describe('applyPromoCode — category/product restrictions', () => {
  it('discounts only items matching applicableCategories', async () => {
    __seed('PromoCodes', [activePromo({ applicableCategories: 'futons' })]);
    const cart = [
      cartItem({ _id: 'a', price: 100, category: 'futons' }),
      cartItem({ _id: 'b', price: 200, category: 'pillows' }),
    ];
    const r = await applyPromoCode('TEST20', cart);
    expect(r.valid).toBe(true);
    // 20% of 100 (futons only) = 20
    expect(r.discount).toBe(20);
    expect(r.subtotalAfterDiscount).toBe(280);
  });

  it('discounts only items matching applicableProducts', async () => {
    __seed('PromoCodes', [activePromo({ applicableProducts: 'prod-A' })]);
    const cart = [
      cartItem({ _id: 'prod-A', price: 50, category: 'futons' }),
      cartItem({ _id: 'prod-B', price: 150, category: 'futons' }),
    ];
    const r = await applyPromoCode('TEST20', cart);
    expect(r.discount).toBe(10); // 20% of 50
    expect(r.subtotalAfterDiscount).toBe(190);
  });

  it('item matching product but not category still qualifies', async () => {
    __seed('PromoCodes', [activePromo({
      applicableCategories: 'pillows',
      applicableProducts: 'prod-A',
    })]);
    const cart = [
      cartItem({ _id: 'prod-A', price: 80, category: 'futons' }),
    ];
    const r = await applyPromoCode('TEST20', cart);
    // prod-A matches product list even though category is futons not pillows
    expect(r.discount).toBe(16); // 20% of 80
  });

  it('item matching category but not product still qualifies', async () => {
    __seed('PromoCodes', [activePromo({
      applicableCategories: 'futons',
      applicableProducts: 'prod-X',
    })]);
    const cart = [
      cartItem({ _id: 'prod-A', price: 60, category: 'futons' }),
    ];
    const r = await applyPromoCode('TEST20', cart);
    expect(r.discount).toBe(12); // 20% of 60
  });

  it('mixed eligible/ineligible items — only eligible subtotal discounted', async () => {
    __seed('PromoCodes', [activePromo({
      applicableCategories: 'futons',
      applicableProducts: 'acc-1',
    })]);
    const cart = [
      cartItem({ _id: 'f1', price: 200, quantity: 2, category: 'futons' }),
      cartItem({ _id: 'acc-1', price: 30, quantity: 1, category: 'accessories' }),
      cartItem({ _id: 'p1', price: 50, quantity: 1, category: 'pillows' }),
    ];
    const r = await applyPromoCode('TEST20', cart);
    // eligible: futons 200*2=400 + acc-1 30 = 430
    // 20% of 430 = 86
    expect(r.discount).toBe(86);
    // subtotal = 400+30+50 = 480
    expect(r.subtotalAfterDiscount).toBe(394);
  });
});

// ── applyPromoCode: freeShipping type ─────────────────────────────

describe('applyPromoCode — freeShipping', () => {
  it('returns discount:0 and freeShipping:true', async () => {
    __seed('PromoCodes', [activePromo({ type: 'freeShipping', value: 0 })]);
    const r = await applyPromoCode('TEST20', [cartItem()]);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(0);
    expect(r.freeShipping).toBe(true);
    expect(r.discountType).toBe('freeShipping');
    expect(r.subtotalAfterDiscount).toBe(100);
  });

  it('increments usage count on freeShipping apply', async () => {
    __seed('PromoCodes', [activePromo({ type: 'freeShipping', value: 0 })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'PromoCodes') updated = item; });
    await applyPromoCode('TEST20', [cartItem()]);
    expect(updated).not.toBeNull();
    expect(updated.usesCount).toBe(1);
  });
});

// ── applyPromoCode: fixed discount ────────────────────────────────

describe('applyPromoCode — fixed discount', () => {
  it('applies fixed dollar amount', async () => {
    __seed('PromoCodes', [activePromo({ type: 'fixed', value: 15 })]);
    const r = await applyPromoCode('TEST20', [cartItem({ price: 100 })]);
    expect(r.discount).toBe(15);
    expect(r.subtotalAfterDiscount).toBe(85);
  });

  it('caps fixed discount at subtotal (cannot go negative)', async () => {
    __seed('PromoCodes', [activePromo({ type: 'fixed', value: 500 })]);
    const r = await applyPromoCode('TEST20', [cartItem({ price: 50 })]);
    expect(r.discount).toBe(50);
    expect(r.subtotalAfterDiscount).toBe(0);
  });
});

// ── applyPromoCode: minSubtotal ───────────────────────────────────

describe('applyPromoCode — minSubtotal', () => {
  it('rejects when subtotal below minimum', async () => {
    __seed('PromoCodes', [activePromo({ minSubtotal: 200 })]);
    const r = await applyPromoCode('TEST20', [cartItem({ price: 50 })]);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('$200');
    expect(r.reason).toContain('Minimum');
  });

  it('accepts when subtotal meets minimum exactly', async () => {
    __seed('PromoCodes', [activePromo({ minSubtotal: 100 })]);
    const r = await applyPromoCode('TEST20', [cartItem({ price: 100 })]);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(20);
  });
});

// ── applyPromoCode: empty cart ────────────────────────────────────

describe('applyPromoCode — empty cart', () => {
  it('returns error for empty cartItems array', async () => {
    __seed('PromoCodes', [activePromo()]);
    const r = await applyPromoCode('TEST20', []);
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('returns error for null cartItems', async () => {
    const r = await applyPromoCode('TEST20', null);
    expect(r.success).toBe(false);
  });
});

// ── calculateBOGOSavings ──────────────────────────────────────────

function activeDeal(overrides = {}) {
  return {
    _id: 'deal1',
    title: 'Buy 2 Futons Get 1 Pillow Free',
    buyCategory: 'futons',
    buyQuantity: 2,
    getCategory: 'pillows',
    getQuantity: 1,
    getDiscountPercent: 100,
    isActive: true,
    startDate: new Date(Date.now() - DAY),
    endDate: new Date(Date.now() + DAY),
    ...overrides,
  };
}

describe('calculateBOGOSavings — multiple deals', () => {
  it('applies two different BOGO deals to same cart', async () => {
    __seed('BOGODeals', [
      activeDeal({ _id: 'deal1', buyCategory: 'futons', buyQuantity: 2, getCategory: 'pillows', getQuantity: 1, getDiscountPercent: 100 }),
      activeDeal({ _id: 'deal2', buyCategory: 'frames', buyQuantity: 1, getCategory: 'covers', getQuantity: 1, getDiscountPercent: 50, title: 'Frame+Cover' }),
    ]);
    const cart = [
      cartItem({ _id: 'f1', price: 300, quantity: 2, category: 'futons' }),
      cartItem({ _id: 'p1', price: 40, quantity: 1, category: 'pillows' }),
      cartItem({ _id: 'fr1', price: 200, quantity: 1, category: 'frames' }),
      cartItem({ _id: 'c1', price: 60, quantity: 1, category: 'covers' }),
    ];
    const r = await calculateBOGOSavings(cart);
    expect(r.success).toBe(true);
    expect(r.appliedDeals).toHaveLength(2);
    // deal1: 1 pillow @ $40 * 100% = $40
    // deal2: 1 cover @ $60 * 50% = $30
    expect(r.totalSavings).toBe(70);
  });
});

describe('calculateBOGOSavings — cheapest-first sorting', () => {
  it('discounts cheapest get-items first', async () => {
    __seed('BOGODeals', [activeDeal({
      buyQuantity: 2, getQuantity: 1, getDiscountPercent: 100,
    })]);
    const cart = [
      cartItem({ _id: 'f1', price: 300, quantity: 2, category: 'futons' }),
      cartItem({ _id: 'p1', price: 80, quantity: 1, category: 'pillows' }),
      cartItem({ _id: 'p2', price: 20, quantity: 1, category: 'pillows' }),
    ];
    const r = await calculateBOGOSavings(cart);
    // sorted cheapest first: p2($20) then p1($80). getQuantity=1, so only 1 free
    // cheapest = $20 free
    expect(r.totalSavings).toBe(20);
  });
});

describe('calculateBOGOSavings — not enough buy items', () => {
  it('returns no savings when buyQuantity exceeds cart items', async () => {
    __seed('BOGODeals', [activeDeal({ buyQuantity: 5 })]);
    const cart = [
      cartItem({ _id: 'f1', price: 300, quantity: 2, category: 'futons' }),
      cartItem({ _id: 'p1', price: 40, quantity: 1, category: 'pillows' }),
    ];
    const r = await calculateBOGOSavings(cart);
    expect(r.totalSavings).toBe(0);
    expect(r.appliedDeals).toHaveLength(0);
  });
});

describe('calculateBOGOSavings — no matching get items', () => {
  it('returns no savings when getCategory has no matching items', async () => {
    __seed('BOGODeals', [activeDeal({ getCategory: 'mattresses' })]);
    const cart = [
      cartItem({ _id: 'f1', price: 300, quantity: 2, category: 'futons' }),
      cartItem({ _id: 'p1', price: 40, quantity: 1, category: 'pillows' }),
    ];
    const r = await calculateBOGOSavings(cart);
    expect(r.totalSavings).toBe(0);
    expect(r.appliedDeals).toHaveLength(0);
  });
});

// ── createPromoCode ───────────────────────────────────────────────

describe('createPromoCode — duplicate check', () => {
  it('returns error when code already exists', async () => {
    __seed('PromoCodes', [activePromo({ code: 'DUPE10' })]);
    const r = await createPromoCode({
      code: 'dupe10', type: 'percentage', value: 10, durationDays: 30,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain('already exists');
  });
});

describe('createPromoCode — freeShipping value override', () => {
  it('sets value to 0 regardless of params.value for freeShipping type', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PromoCodes') inserted = item; });
    const r = await createPromoCode({
      code: 'FREESHIP', type: 'freeShipping', value: 999, durationDays: 7,
    });
    expect(r.success).toBe(true);
    expect(inserted.value).toBe(0);
  });
});

describe('createPromoCode — validation', () => {
  it('rejects percentage > 100', async () => {
    const r = await createPromoCode({
      code: 'OVER', type: 'percentage', value: 150, durationDays: 7,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain('between 1 and 100');
  });

  it('rejects percentage <= 0', async () => {
    const r = await createPromoCode({
      code: 'ZERO', type: 'percentage', value: 0, durationDays: 7,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain('between 1 and 100');
  });

  it('rejects negative percentage', async () => {
    const r = await createPromoCode({
      code: 'NEG', type: 'percentage', value: -10, durationDays: 7,
    });
    expect(r.success).toBe(false);
  });

  it('rejects negative fixed discount', async () => {
    const r = await createPromoCode({
      code: 'NEGFIX', type: 'fixed', value: -5, durationDays: 7,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain('negative');
  });

  it('accepts fixed discount of 0', async () => {
    const r = await createPromoCode({
      code: 'ZEROFIX', type: 'fixed', value: 0, durationDays: 7,
    });
    expect(r.success).toBe(true);
  });
});

// ── createFlashSale — validation ──────────────────────────────────

describe('createFlashSale — validation', () => {
  it('rejects missing title', async () => {
    const r = await createFlashSale({ discountPercent: 20, durationHours: 4 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Title');
  });

  it('rejects discountPercent of 0', async () => {
    const r = await createFlashSale({ title: 'Sale', discountPercent: 0, durationHours: 4 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('between 1 and 100');
  });

  it('rejects discountPercent > 100', async () => {
    const r = await createFlashSale({ title: 'Sale', discountPercent: 101, durationHours: 4 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('between 1 and 100');
  });

  it('rejects durationHours <= 0', async () => {
    const r = await createFlashSale({ title: 'Sale', discountPercent: 20, durationHours: 0 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('greater than 0');
  });

  it('rejects negative durationHours', async () => {
    const r = await createFlashSale({ title: 'Sale', discountPercent: 20, durationHours: -2 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('greater than 0');
  });

  it('creates sale with valid params', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'FlashSales') inserted = item; });
    const r = await createFlashSale({ title: 'Flash!', discountPercent: 30, durationHours: 6 });
    expect(r.success).toBe(true);
    expect(r.sale).toBeTruthy();
    expect(inserted.discountPercent).toBe(30);
    expect(inserted.isActive).toBe(true);
  });
});

// ── getActiveFlashSales — expired filtering ───────────────────────

describe('getActiveFlashSales — expired filtering', () => {
  it('filters out expired sales', async () => {
    __seed('FlashSales', [
      {
        _id: 'active1', title: 'Active', discountPercent: 20, isActive: true,
        startTime: new Date(Date.now() - HOUR), endTime: new Date(Date.now() + HOUR),
        maxQuantity: 0, productIds: '',
      },
      {
        _id: 'expired1', title: 'Expired', discountPercent: 30, isActive: true,
        startTime: new Date(Date.now() - 2 * HOUR), endTime: new Date(Date.now() - HOUR),
        maxQuantity: 0, productIds: '',
      },
    ]);
    const r = await getActiveFlashSales();
    expect(r.success).toBe(true);
    expect(r.sales).toHaveLength(1);
    expect(r.sales[0]._id).toBe('active1');
  });

  it('returns empty when all sales expired', async () => {
    __seed('FlashSales', [{
      _id: 'old', title: 'Old', discountPercent: 50, isActive: true,
      startTime: new Date(Date.now() - 2 * DAY), endTime: new Date(Date.now() - DAY),
      maxQuantity: 0, productIds: '',
    }]);
    const r = await getActiveFlashSales();
    expect(r.sales).toHaveLength(0);
  });
});

// ── getActiveBOGODeals — expired filtering ────────────────────────

describe('getActiveBOGODeals — expired filtering', () => {
  it('filters out expired deals', async () => {
    __seed('BOGODeals', [
      activeDeal({ _id: 'live', endDate: new Date(Date.now() + DAY) }),
      activeDeal({ _id: 'dead', endDate: new Date(Date.now() - DAY) }),
    ]);
    const r = await getActiveBOGODeals();
    expect(r.success).toBe(true);
    expect(r.deals).toHaveLength(1);
    expect(r.deals[0]._id).toBe('live');
  });

  it('returns empty when no active deals', async () => {
    __seed('BOGODeals', [
      activeDeal({ _id: 'old', endDate: new Date(Date.now() - HOUR) }),
    ]);
    const r = await getActiveBOGODeals();
    expect(r.deals).toHaveLength(0);
  });
});

// ── round2 precision (tested through applyPromoCode) ──────────────

describe('round2 precision via applyPromoCode', () => {
  it('avoids floating point artifacts on percentage discount', async () => {
    // 33.33% of $99.99 = 33.326667 → should round to 33.33
    __seed('PromoCodes', [activePromo({ value: 33.33 })]);
    const r = await applyPromoCode('TEST20', [cartItem({ price: 99.99 })]);
    expect(r.discount).toBe(33.33);
    // Verify no floating artifacts (e.g. 33.330000000000004)
    expect(String(r.discount)).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(String(r.subtotalAfterDiscount)).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  it('rounds correctly on subtotal with many items', async () => {
    __seed('PromoCodes', [activePromo({ type: 'percentage', value: 10 })]);
    // 3 items at $33.33 each, qty 1 → subtotal $99.99
    // 10% = $9.999 → round to $10.00
    const cart = [
      cartItem({ _id: 'a', price: 33.33 }),
      cartItem({ _id: 'b', price: 33.33 }),
      cartItem({ _id: 'c', price: 33.33 }),
    ];
    const r = await applyPromoCode('TEST20', cart);
    expect(r.discount).toBe(10);
    expect(r.subtotalAfterDiscount).toBe(89.99);
  });

  it('fixed discount subtotalAfterDiscount has no floating artifacts', async () => {
    __seed('PromoCodes', [activePromo({ type: 'fixed', value: 10.01 })]);
    const r = await applyPromoCode('TEST20', [cartItem({ price: 33.33 })]);
    expect(r.discount).toBe(10.01);
    expect(r.subtotalAfterDiscount).toBe(23.32);
  });
});
