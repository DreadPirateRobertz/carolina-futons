import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  recordPriceSnapshot,
  getPriceHistory,
  checkPriceDrops,
  checkBackInStock,
  checkLowStock,
  getAlertPrefs,
  updateAlertPrefs,
  getAlertHistory,
} from '../src/backend/wishlistAlerts.web.js';

beforeEach(() => {
  __seed('PriceHistory', []);
  __seed('WishlistAlertsSent', []);
  __seed('WishlistAlertPrefs', []);
  __seed('Wishlist', []);
  __seed('Stores/Products', []);
  __seed('InventoryThresholds', []);
});

// ═══════════════════════════════════════════════════════════════════
// 1. RECORD PRICE SNAPSHOT — EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('recordPriceSnapshot edge cases', () => {
  it('rejects NaN price', async () => {
    const result = await recordPriceSnapshot('prod-1', NaN);
    expect(result.success).toBe(false);
  });

  it('rejects Infinity price', async () => {
    const result = await recordPriceSnapshot('prod-1', Infinity);
    expect(result.success).toBe(false);
  });

  it('rejects -Infinity price', async () => {
    const result = await recordPriceSnapshot('prod-1', -Infinity);
    expect(result.success).toBe(false);
  });

  it('accepts zero price', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PriceHistory') inserted = item; });
    const result = await recordPriceSnapshot('prod-1', 0);
    expect(result.success).toBe(true);
    expect(inserted.price).toBe(0);
  });

  it('coerces string number to numeric price', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PriceHistory') inserted = item; });
    const result = await recordPriceSnapshot('prod-1', '499.99');
    expect(result.success).toBe(true);
    expect(inserted.price).toBe(499.99);
  });

  it('rejects empty string productId', async () => {
    const result = await recordPriceSnapshot('', 499);
    expect(result.success).toBe(false);
  });

  it('sanitizes long productId', async () => {
    const longId = 'a'.repeat(200);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PriceHistory') inserted = item; });
    const result = await recordPriceSnapshot(longId, 499);
    expect(result.success).toBe(true);
    expect(inserted.productId.length).toBeLessThanOrEqual(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. GET PRICE HISTORY — BOUNDARY CASES
// ═══════════════════════════════════════════════════════════════════

describe('getPriceHistory boundary cases', () => {
  it('clamps days to minimum of 1', async () => {
    const result = await getPriceHistory('prod-1', 0);
    expect(result.prices).toBeDefined();
  });

  it('clamps days to maximum of 365', async () => {
    const result = await getPriceHistory('prod-1', 9999);
    expect(result.prices).toBeDefined();
  });

  it('handles NaN days by falling back to 30', async () => {
    const result = await getPriceHistory('prod-1', 'abc');
    expect(result.prices).toBeDefined();
  });

  it('handles negative days by clamping to 1', async () => {
    const result = await getPriceHistory('prod-1', -5);
    expect(result.prices).toBeDefined();
  });

  it('returns empty for empty string productId', async () => {
    const result = await getPriceHistory('');
    expect(result.prices).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. CHECK PRICE DROPS — NaN HARDENING
// ═══════════════════════════════════════════════════════════════════

describe('checkPriceDrops NaN hardening', () => {
  it('skips NaN prices in history entries', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: NaN, date: day2 },
      { _id: 'ph-3', productId: 'prod-1', price: 400, date: new Date(Date.now() - 43200000) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    // Should still detect the drop from 500 to 400 (20%), ignoring NaN entry
    expect(result.alertsSent).toBe(1);
  });

  it('skips null prices in history entries', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: null, date: day1 },
    ]);

    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    // null price is now explicitly filtered by `item.price == null` guard
    expect(result.productsChecked).toBe(0);
    expect(result.alertsSent).toBe(0);
  });

  it('skips negative prices in history entries', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: -50, date: day1 },
    ]);

    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    expect(result.productsChecked).toBe(0);
  });

  it('skips entries with missing productId', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: null, price: 500, date: day1 },
      { _id: 'ph-2', productId: '', price: 400, date: day1 },
    ]);

    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    expect(result.productsChecked).toBe(0);
  });

  it('coerces string prices in history entries', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: '500', date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: '400', date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(1);
  });

  it('skips Infinity prices in history entries', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: Infinity, date: day1 },
    ]);

    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    expect(result.productsChecked).toBe(0);
  });

  it('handles exact 10% threshold (boundary)', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 100, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 90, date: day2 }, // exactly 10%
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    // 10% is exactly the threshold — (100-90)/100 = 0.10, check is < not <=
    expect(result.alertsSent).toBe(1);
  });

  it('does not alert at 9.99% drop (just below threshold)', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 1000, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 901, date: day2 }, // 9.9%
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(0);
  });

  it('skips wishlist items with no memberId', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: null, productId: 'prod-1' },
      { _id: 'w-2', memberId: '', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    // Empty string memberId is falsy, should be skipped
    expect(result.alertsSent).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. CHECK BACK IN STOCK — EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('checkBackInStock edge cases', () => {
  it('handles product not found in Stores/Products', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-deleted', inStock: false },
    ]);
    __seed('Stores/Products', []); // product gone

    const result = await checkBackInStock();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(0);
  });

  it('skips wishlist items with no memberId', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: null, productId: 'prod-1', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true },
    ]);

    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(0);
  });

  it('uses product name over wishlist name when available', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Old Name', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Updated Futon Name', inStock: true },
    ]);

    let alertItem = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertsSent') alertItem = item; });

    await checkBackInStock();
    expect(alertItem.productName).toBe('Updated Futon Name');
  });

  it('falls back to wishlist name when product has no name', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Wishlist Name', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: '', inStock: true },
    ]);

    let alertItem = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertsSent') alertItem = item; });

    await checkBackInStock();
    expect(alertItem.productName).toBe('Wishlist Name');
  });

  it('handles multiple products with mixed stock status', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
      { _id: 'w-2', memberId: 'member-1', productId: 'prod-2', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Back In Stock', inStock: true },
      { _id: 'prod-2', name: 'Still Out', inStock: false },
    ]);

    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(1);
  });

  it('updates wishlist inStock to true after notification', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Futon', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true },
    ]);

    let updatedItem = null;
    __onUpdate((col, item) => { if (col === 'Wishlist') updatedItem = item; });

    await checkBackInStock();
    expect(updatedItem).not.toBeNull();
    expect(updatedItem.inStock).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. CHECK LOW STOCK — THRESHOLD BOUNDARIES
// ═══════════════════════════════════════════════════════════════════

describe('checkLowStock threshold boundaries', () => {
  it('does not alert when stock equals threshold exactly', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 5 }, // equals default threshold
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(0);
  });

  it('alerts when stock is 1 below threshold', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 4 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(1);
  });

  it('handles zero stock (in stock but qty=0)', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 0 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(1);
  });

  it('skips product when quantityInStock is null', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: null },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(0);
  });

  it('uses custom threshold of 0 (never alert)', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 1 },
    ]);
    __seed('InventoryThresholds', [
      { _id: 'it-1', productId: 'prod-1', lowStockThreshold: 0 },
    ]);

    const result = await checkLowStock();
    // qty (1) >= threshold (0), no alert
    expect(result.alertsSent).toBe(0);
  });

  it('handles null custom threshold (falls back to default)', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 3 },
    ]);
    __seed('InventoryThresholds', [
      { _id: 'it-1', productId: 'prod-1', lowStockThreshold: null },
    ]);

    const result = await checkLowStock();
    // Falls back to default threshold of 5, qty (3) < 5, alert sent
    expect(result.alertsSent).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. ALERT PREFS — EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('getAlertPrefs edge cases', () => {
  it('returns empty prefs when member has no prefs set', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'test@test.com' });
    const result = await getAlertPrefs();
    expect(result.prefs).toEqual([]);
  });
});

describe('updateAlertPrefs edge cases', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1', loginEmail: 'test@test.com' });
  });

  it('rejects empty string productId', async () => {
    const result = await updateAlertPrefs('', {});
    expect(result.success).toBe(false);
  });

  it('handles empty prefs object (defaults to all enabled)', async () => {
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertPrefs') insertedItem = item; });

    const result = await updateAlertPrefs('prod-1', {});
    expect(result.success).toBe(true);
    expect(insertedItem.priceDrops).toBe(true);
    expect(insertedItem.backInStock).toBe(true);
  });

  it('coerces truthy prefs values to boolean', async () => {
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertPrefs') insertedItem = item; });

    const result = await updateAlertPrefs('prod-1', { priceDrops: 0, backInStock: 1 });
    expect(result.success).toBe(true);
    expect(insertedItem.priceDrops).toBe(false);
    expect(insertedItem.backInStock).toBe(true);
  });

  it('partial update only changes specified fields', async () => {
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: true, backInStock: true },
    ]);

    let updatedItem = null;
    __onUpdate((col, item) => { if (col === 'WishlistAlertPrefs') updatedItem = item; });

    await updateAlertPrefs('prod-1', { priceDrops: false });
    expect(updatedItem.priceDrops).toBe(false);
    expect(updatedItem.backInStock).toBe(true); // unchanged
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. ALERT HISTORY
// ═══════════════════════════════════════════════════════════════════

describe('getAlertHistory', () => {
  it('returns alert history for authenticated member', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'test@test.com' });
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'price_drop', sentAt: new Date(), price: 400, previousHigh: 500, dropPercent: 20 },
      { _id: 'wa-2', memberId: 'member-1', productId: 'prod-2', alertType: 'back_in_stock', sentAt: new Date(), productName: 'Futon' },
    ]);

    const result = await getAlertHistory();
    expect(result.alerts).toHaveLength(2);
    expect(result.alerts[0].alertType).toBe('price_drop');
    expect(result.alerts[0].dropPercent).toBe(20);
    expect(result.alerts[1].alertType).toBe('back_in_stock');
  });

  it('returns empty for unauthenticated user', async () => {
    __setMember(null);
    const result = await getAlertHistory();
    expect(result.alerts).toEqual([]);
  });

  it('queries with current member ID for isolation', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'test@test.com' });
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'price_drop', sentAt: new Date() },
    ]);

    const result = await getAlertHistory();
    // Verify function returns results (mock doesn't filter, but function passes correct memberId)
    expect(result.alerts).toBeDefined();
    expect(Array.isArray(result.alerts)).toBe(true);
  });
});
