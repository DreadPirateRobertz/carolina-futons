import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};
let _insertCbs = [];
let _updateCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}
function __onInsert(cb) { _insertCbs.push(cb); }
function __onUpdate(cb) { _updateCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    le: (field, val) => { filters[field] = { type: 'le', value: val }; return chain; },
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field.startsWith('_')) continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'le') items = items.filter(i => i[field] <= f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => (_collections[col] || []).find(i => i._id === id) || null),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || 'a1b2c3d4-0000-0000-0000-000000000099' };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
    update: vi.fn(async (col, data) => {
      if (_collections[col]) {
        const idx = _collections[col].findIndex(i => i._id === data._id);
        if (idx >= 0) _collections[col][idx] = { ...data };
      }
      _updateCbs.forEach(cb => cb(col, data));
      return data;
    }),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
}));

import {
  validatePromoCode,
  applyPromoCode,
  getActiveFlashSales,
  getActiveBOGODeals,
  calculateBOGOSavings,
  createFlashSale,
  createPromoCode,
} from '../src/backend/promotionsEngine.web.js';

const NOW = new Date();
const PAST = new Date(NOW.getTime() - 86400000);
const FUTURE = new Date(NOW.getTime() + 86400000);
const FAR_FUTURE = new Date(NOW.getTime() + 86400000 * 30);

function makePromo(overrides = {}) {
  return {
    _id: 'a1-0000-0000-0000-000000000001',
    code: 'SAVE10',
    type: 'percentage',
    value: 10,
    isActive: true,
    startDate: PAST,
    endDate: FUTURE,
    minSubtotal: 0,
    maxUses: 0,
    usesCount: 0,
    applicableCategories: '',
    applicableProducts: '',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
});

// ── validatePromoCode — deep edge cases ─────────────────────────────

describe('validatePromoCode — deep edge cases', () => {
  it('rejects null code', async () => {
    const result = await validatePromoCode(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Promo code is required');
  });

  it('rejects numeric code (not string)', async () => {
    const result = await validatePromoCode(12345);
    expect(result.success).toBe(false);
  });

  it('rejects empty string code', async () => {
    const result = await validatePromoCode('');
    expect(result.success).toBe(false);
  });

  it('uppercases code for lookup', async () => {
    __seed('PromoCodes', [makePromo({ code: 'SAVE10' })]);
    const result = await validatePromoCode('save10');
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.promo.code).toBe('SAVE10');
  });

  it('returns invalid for non-existent code', async () => {
    const result = await validatePromoCode('BOGUS');
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid');
  });

  it('rejects inactive code', async () => {
    __seed('PromoCodes', [makePromo({ isActive: false })]);
    const result = await validatePromoCode('SAVE10');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('no longer active');
  });

  it('rejects code not yet active (future start date)', async () => {
    __seed('PromoCodes', [makePromo({ startDate: FUTURE })]);
    const result = await validatePromoCode('SAVE10');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not yet active');
  });

  it('rejects expired code', async () => {
    __seed('PromoCodes', [makePromo({ endDate: PAST })]);
    const result = await validatePromoCode('SAVE10');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('rejects code at usage limit', async () => {
    __seed('PromoCodes', [makePromo({ maxUses: 5, usesCount: 5 })]);
    const result = await validatePromoCode('SAVE10');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('usage limit');
  });

  it('allows code with unlimited uses (maxUses=0)', async () => {
    __seed('PromoCodes', [makePromo({ maxUses: 0, usesCount: 1000 })]);
    const result = await validatePromoCode('SAVE10');
    expect(result.valid).toBe(true);
  });

  it('allows code with uses below limit', async () => {
    __seed('PromoCodes', [makePromo({ maxUses: 10, usesCount: 5 })]);
    const result = await validatePromoCode('SAVE10');
    expect(result.valid).toBe(true);
  });

  it('returns promo details on success', async () => {
    __seed('PromoCodes', [makePromo({ minSubtotal: 50, applicableCategories: 'futons,beds' })]);
    const result = await validatePromoCode('SAVE10');
    expect(result.promo.type).toBe('percentage');
    expect(result.promo.value).toBe(10);
    expect(result.promo.minSubtotal).toBe(50);
    expect(result.promo.applicableCategories).toBe('futons,beds');
  });
});

// ── applyPromoCode — deep edge cases ────────────────────────────────

describe('applyPromoCode — deep edge cases', () => {
  it('rejects empty cart', async () => {
    const result = await applyPromoCode('SAVE10', []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cart items');
  });

  it('rejects null cart', async () => {
    const result = await applyPromoCode('SAVE10', null);
    expect(result.success).toBe(false);
  });

  it('rejects non-array cart', async () => {
    const result = await applyPromoCode('SAVE10', 'not-array');
    expect(result.success).toBe(false);
  });

  it('calculates percentage discount correctly', async () => {
    __seed('PromoCodes', [makePromo({ type: 'percentage', value: 20 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 100, quantity: 2 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(40); // 200 * 20%
    expect(result.subtotalAfterDiscount).toBe(160);
  });

  it('calculates fixed discount correctly', async () => {
    __seed('PromoCodes', [makePromo({ type: 'fixed', value: 25 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 100, quantity: 1 },
    ]);
    expect(result.discount).toBe(25);
    expect(result.subtotalAfterDiscount).toBe(75);
  });

  it('caps fixed discount at subtotal (no negative total)', async () => {
    __seed('PromoCodes', [makePromo({ type: 'fixed', value: 500 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 50, quantity: 1 },
    ]);
    expect(result.discount).toBe(50);
    expect(result.subtotalAfterDiscount).toBe(0);
  });

  it('free shipping returns discount=0 and freeShipping=true', async () => {
    __seed('PromoCodes', [makePromo({ type: 'freeShipping', value: 0 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 100, quantity: 1 },
    ]);
    expect(result.discount).toBe(0);
    expect(result.freeShipping).toBe(true);
    expect(result.discountType).toBe('freeShipping');
    expect(result.subtotalAfterDiscount).toBe(100);
  });

  it('enforces minSubtotal', async () => {
    __seed('PromoCodes', [makePromo({ minSubtotal: 100 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 50, quantity: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Minimum order');
  });

  it('limits cart items to 50', async () => {
    __seed('PromoCodes', [makePromo({ type: 'percentage', value: 10 })]);
    const items = Array.from({ length: 60 }, (_, i) => ({ _id: `p${i}`, price: 1, quantity: 1 }));
    const result = await applyPromoCode('SAVE10', items);
    // Only first 50 items should count: subtotal = 50
    expect(result.discount).toBe(5); // 50 * 10%
  });

  it('handles zero price items', async () => {
    __seed('PromoCodes', [makePromo({ type: 'percentage', value: 10 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 0, quantity: 5 },
    ]);
    expect(result.discount).toBe(0);
  });

  it('handles negative price (clamps to 0)', async () => {
    __seed('PromoCodes', [makePromo({ type: 'percentage', value: 10 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: -50, quantity: 1 },
    ]);
    // Math.max(0, -50) = 0
    expect(result.discount).toBe(0);
  });

  it('clamps quantity to 1-99', async () => {
    __seed('PromoCodes', [makePromo({ type: 'percentage', value: 10 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 100, quantity: 200 },
    ]);
    // qty clamped to 99: subtotal = 100*99 = 9900, discount = 990
    expect(result.discount).toBe(990);
  });

  it('defaults NaN quantity to 1', async () => {
    __seed('PromoCodes', [makePromo({ type: 'percentage', value: 10 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 100, quantity: NaN },
    ]);
    // Number(NaN) || 1 = 1, Math.max(1, 1) = 1
    expect(result.discount).toBe(10); // 100 * 10%
  });

  it('applies category restriction correctly', async () => {
    __seed('PromoCodes', [makePromo({ type: 'percentage', value: 50, applicableCategories: 'futons' })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 100, quantity: 1, category: 'futons' },
      { _id: 'p2', price: 200, quantity: 1, category: 'beds' },
    ]);
    // Only futons eligible: 100 * 50% = 50
    expect(result.discount).toBe(50);
    // Subtotal is 300, after discount = 250
    expect(result.subtotalAfterDiscount).toBe(250);
  });

  it('applies product restriction correctly', async () => {
    __seed('PromoCodes', [makePromo({ type: 'fixed', value: 30, applicableProducts: 'p1' })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 100, quantity: 1 },
      { _id: 'p2', price: 200, quantity: 1 },
    ]);
    // Fixed discount is min(subtotal, 30) = 30
    expect(result.discount).toBe(30);
  });

  it('percentage 100 means full discount on eligible items', async () => {
    __seed('PromoCodes', [makePromo({ type: 'percentage', value: 100 })]);
    const result = await applyPromoCode('SAVE10', [
      { _id: 'p1', price: 75, quantity: 2 },
    ]);
    expect(result.discount).toBe(150);
    expect(result.subtotalAfterDiscount).toBe(0);
  });

  it('increments usage count on apply', async () => {
    __seed('PromoCodes', [makePromo({ usesCount: 3 })]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'PromoCodes') updated = data; });

    await applyPromoCode('SAVE10', [{ _id: 'p1', price: 100, quantity: 1 }]);
    expect(updated.usesCount).toBe(4);
  });
});

// ── getActiveFlashSales — deep edge cases ───────────────────────────

describe('getActiveFlashSales — deep edge cases', () => {
  it('returns empty for no sales', async () => {
    const result = await getActiveFlashSales();
    expect(result.success).toBe(true);
    expect(result.sales).toEqual([]);
  });

  it('filters out inactive sales', async () => {
    __seed('FlashSales', [
      { _id: 'fs1', title: 'Active', isActive: true, startTime: PAST, endTime: FUTURE, discountPercent: 20 },
      { _id: 'fs2', title: 'Inactive', isActive: false, startTime: PAST, endTime: FUTURE, discountPercent: 30 },
    ]);
    const result = await getActiveFlashSales();
    // isActive=false is filtered by query.eq('isActive', true)
    expect(result.sales.length).toBe(1);
    expect(result.sales[0].title).toBe('Active');
  });

  it('filters out expired sales (endTime in past)', async () => {
    __seed('FlashSales', [{
      _id: 'fs1', title: 'Expired', isActive: true,
      startTime: new Date(NOW.getTime() - 86400000 * 2),
      endTime: PAST,
      discountPercent: 20,
    }]);
    const result = await getActiveFlashSales();
    expect(result.sales.length).toBe(0);
  });

  it('includes remainingMs in response', async () => {
    __seed('FlashSales', [{
      _id: 'fs1', title: 'Running', isActive: true,
      startTime: PAST, endTime: FUTURE, discountPercent: 20,
    }]);
    const result = await getActiveFlashSales();
    expect(result.sales[0].remainingMs).toBeGreaterThan(0);
  });

  it('defaults maxQuantity to 0 and productIds to empty', async () => {
    __seed('FlashSales', [{
      _id: 'fs1', title: 'Basic', isActive: true,
      startTime: PAST, endTime: FUTURE, discountPercent: 10,
    }]);
    const result = await getActiveFlashSales();
    expect(result.sales[0].maxQuantity).toBe(0);
    expect(result.sales[0].productIds).toBe('');
  });
});

// ── calculateBOGOSavings — deep edge cases ──────────────────────────

describe('calculateBOGOSavings — deep edge cases', () => {
  it('returns 0 savings for empty cart', async () => {
    const result = await calculateBOGOSavings([]);
    expect(result.totalSavings).toBe(0);
    expect(result.appliedDeals).toEqual([]);
  });

  it('returns 0 savings for null cart', async () => {
    const result = await calculateBOGOSavings(null);
    expect(result.totalSavings).toBe(0);
  });

  it('returns 0 when no active BOGO deals', async () => {
    const result = await calculateBOGOSavings([
      { _id: 'p1', price: 100, quantity: 2, category: 'futons' },
    ]);
    expect(result.totalSavings).toBe(0);
  });

  it('applies BOGO buy 2 get 1 free correctly', async () => {
    __seed('BOGODeals', [{
      _id: 'bogo1', title: 'Buy 2 Get 1 Free', isActive: true,
      buyCategory: 'futons', buyQuantity: 2,
      getCategory: 'futons', getQuantity: 1,
      getDiscountPercent: 100,
      startDate: PAST, endDate: FUTURE,
    }]);
    const result = await calculateBOGOSavings([
      { _id: 'p1', price: 100, quantity: 3, category: 'futons' },
    ]);
    // 3 futons, buy 2 → 1 application, get 1 free
    // Cheapest first sorting: all same price $100
    // Savings: 100 * 1 * 100% = $100
    expect(result.totalSavings).toBe(100);
    expect(result.appliedDeals.length).toBe(1);
  });

  it('applies multiple deal applications', async () => {
    __seed('BOGODeals', [{
      _id: 'bogo1', title: 'Buy 1 Get 1 Half Off', isActive: true,
      buyCategory: 'pillows', buyQuantity: 1,
      getCategory: 'pillows', getQuantity: 1,
      getDiscountPercent: 50,
      startDate: PAST, endDate: FUTURE,
    }]);
    const result = await calculateBOGOSavings([
      { _id: 'p1', price: 40, quantity: 4, category: 'pillows' },
    ]);
    // 4 pillows, buy 1 → 4 applications, get 4 at 50% off
    // But only 4 items total, remaining free = 4*1=4, but qty of p1 is 4
    // min(4, 4) = 4 items at 50% off: 40 * 4 * 50% = $80
    expect(result.totalSavings).toBe(80);
  });

  it('skips deal when not enough buy items', async () => {
    __seed('BOGODeals', [{
      _id: 'bogo1', title: 'Buy 3 Get 1', isActive: true,
      buyCategory: 'futons', buyQuantity: 3,
      getCategory: 'futons', getQuantity: 1,
      getDiscountPercent: 100,
      startDate: PAST, endDate: FUTURE,
    }]);
    const result = await calculateBOGOSavings([
      { _id: 'p1', price: 100, quantity: 2, category: 'futons' },
    ]);
    // Only 2 futons, need 3 → deal doesn't apply
    expect(result.totalSavings).toBe(0);
  });

  it('applies cheapest-first discount for fairness', async () => {
    __seed('BOGODeals', [{
      _id: 'bogo1', title: 'Buy 1 Get 1 Free', isActive: true,
      buyCategory: 'futons', buyQuantity: 1,
      getCategory: 'futons', getQuantity: 1,
      getDiscountPercent: 100,
      startDate: PAST, endDate: FUTURE,
    }]);
    const result = await calculateBOGOSavings([
      { _id: 'p1', price: 200, quantity: 1, category: 'futons' },
      { _id: 'p2', price: 50, quantity: 1, category: 'futons' },
    ]);
    // 2 futons, buyQty=1 → floor(2/1)=2 applications, get 2 free
    // Sorted cheapest first: [50, 200]. Both items free.
    // Savings: 50 + 200 = $250
    expect(result.totalSavings).toBe(250);
  });

  it('filters out expired BOGO deals', async () => {
    __seed('BOGODeals', [{
      _id: 'bogo1', title: 'Expired', isActive: true,
      buyCategory: 'futons', buyQuantity: 1,
      getCategory: 'futons', getQuantity: 1,
      getDiscountPercent: 100,
      startDate: new Date(NOW.getTime() - 86400000 * 2),
      endDate: PAST,
    }]);
    const result = await calculateBOGOSavings([
      { _id: 'p1', price: 100, quantity: 2, category: 'futons' },
    ]);
    expect(result.totalSavings).toBe(0);
  });

  it('handles cross-category BOGO', async () => {
    __seed('BOGODeals', [{
      _id: 'bogo1', title: 'Buy Futon Get Pillow Free', isActive: true,
      buyCategory: 'futons', buyQuantity: 1,
      getCategory: 'pillows', getQuantity: 1,
      getDiscountPercent: 100,
      startDate: PAST, endDate: FUTURE,
    }]);
    const result = await calculateBOGOSavings([
      { _id: 'p1', price: 500, quantity: 1, category: 'futons' },
      { _id: 'p2', price: 30, quantity: 1, category: 'pillows' },
    ]);
    expect(result.totalSavings).toBe(30);
  });
});

// ── createFlashSale — deep edge cases ───────────────────────────────

describe('createFlashSale — deep edge cases', () => {
  it('rejects null params', async () => {
    const result = await createFlashSale(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Parameters');
  });

  it('rejects missing title', async () => {
    const result = await createFlashSale({ discountPercent: 20, durationHours: 4 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Title');
  });

  it('rejects 0% discount', async () => {
    const result = await createFlashSale({ title: 'Sale', discountPercent: 0, durationHours: 4 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('between 1 and 100');
  });

  it('rejects >100% discount', async () => {
    const result = await createFlashSale({ title: 'Sale', discountPercent: 150, durationHours: 4 });
    expect(result.success).toBe(false);
  });

  it('rejects 0 duration', async () => {
    const result = await createFlashSale({ title: 'Sale', discountPercent: 20, durationHours: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Duration');
  });

  it('creates sale with correct endTime', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'FlashSales') inserted = item; });

    const result = await createFlashSale({ title: 'Quick Sale', discountPercent: 30, durationHours: 6 });
    expect(result.success).toBe(true);
    expect(inserted.isActive).toBe(true);
    expect(inserted.discountPercent).toBe(30);
    const diffMs = new Date(inserted.endTime).getTime() - new Date(inserted.startTime).getTime();
    expect(Math.round(diffMs / 3600000)).toBe(6);
  });

  it('defaults maxQuantity to 0 for NaN', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'FlashSales') inserted = item; });

    await createFlashSale({ title: 'S', discountPercent: 10, durationHours: 1, maxQuantity: NaN });
    expect(inserted.maxQuantity).toBe(0);
  });
});

// ── createPromoCode — deep edge cases ───────────────────────────────

describe('createPromoCode — deep edge cases', () => {
  it('rejects null params', async () => {
    const result = await createPromoCode(null);
    expect(result.success).toBe(false);
  });

  it('rejects empty code', async () => {
    const result = await createPromoCode({ code: '', type: 'percentage', value: 10, durationDays: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Promo code is required');
  });

  it('rejects invalid type', async () => {
    const result = await createPromoCode({ code: 'TEST', type: 'bogus', value: 10, durationDays: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid type');
  });

  it('rejects 0% percentage discount', async () => {
    const result = await createPromoCode({ code: 'TEST', type: 'percentage', value: 0, durationDays: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('between 1 and 100');
  });

  it('rejects >100% percentage discount', async () => {
    const result = await createPromoCode({ code: 'TEST', type: 'percentage', value: 150, durationDays: 7 });
    expect(result.success).toBe(false);
  });

  it('rejects negative fixed discount', async () => {
    const result = await createPromoCode({ code: 'TEST', type: 'fixed', value: -10, durationDays: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('negative');
  });

  it('allows 0 fixed discount (free shipping use case)', async () => {
    const result = await createPromoCode({ code: 'TEST', type: 'fixed', value: 0, durationDays: 7 });
    expect(result.success).toBe(true);
  });

  it('rejects 0 durationDays', async () => {
    const result = await createPromoCode({ code: 'TEST', type: 'percentage', value: 10, durationDays: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Duration');
  });

  it('rejects duplicate code', async () => {
    __seed('PromoCodes', [makePromo({ code: 'EXISTING' })]);
    const result = await createPromoCode({ code: 'existing', type: 'percentage', value: 10, durationDays: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('uppercases code on create', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PromoCodes') inserted = item; });

    await createPromoCode({ code: 'lowercase', type: 'percentage', value: 10, durationDays: 7 });
    expect(inserted.code).toBe('LOWERCASE');
  });

  it('sets value to 0 for freeShipping type', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PromoCodes') inserted = item; });

    await createPromoCode({ code: 'FREESHIP', type: 'freeShipping', value: 999, durationDays: 7 });
    expect(inserted.value).toBe(0);
  });

  it('initializes usesCount to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PromoCodes') inserted = item; });

    await createPromoCode({ code: 'NEW', type: 'percentage', value: 15, durationDays: 30 });
    expect(inserted.usesCount).toBe(0);
    expect(inserted.isActive).toBe(true);
  });

  it('calculates endDate from durationDays', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PromoCodes') inserted = item; });

    await createPromoCode({ code: 'TEST7', type: 'percentage', value: 10, durationDays: 7 });
    const diffMs = new Date(inserted.endDate).getTime() - new Date(inserted.startDate).getTime();
    const diffDays = Math.round(diffMs / 86400000);
    expect(diffDays).toBe(7);
  });
});
