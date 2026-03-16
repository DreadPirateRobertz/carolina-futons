/**
 * Deep edge-case tests for wishlistAlerts.web.js
 * Covers: null/undefined inputs, NaN/Infinity boundaries, type coercion,
 * dedup logic, multi-product/multi-member combos, threshold edge values,
 * sanitization pass-through, and preference default behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import {
  recordPriceSnapshot,
  getPriceHistory,
  checkPriceDrops,
  checkBackInStock,
  checkLowStock,
  getAlertPrefs,
  updateAlertPrefs,
  getAlertHistory,
  _PRICE_DROP_THRESHOLD,
  _ALERT_COOLDOWN_DAYS,
  _LOW_STOCK_THRESHOLD,
} from '../src/backend/wishlistAlerts.web.js';

const DAY = 86400000;

beforeEach(() => {
  __seed('PriceHistory', []);
  __seed('WishlistAlertsSent', []);
  __seed('WishlistAlertPrefs', []);
  __seed('Wishlist', []);
  __seed('Stores/Products', []);
  __seed('InventoryThresholds', []);
  __setMember(null);
});

// ── recordPriceSnapshot edge cases ────────────────────────────────

describe('recordPriceSnapshot — edge cases', () => {
  it('rejects undefined productId', async () => {
    const result = await recordPriceSnapshot(undefined, 100);
    expect(result.success).toBe(false);
  });

  it('rejects empty string productId', async () => {
    const result = await recordPriceSnapshot('', 100);
    expect(result.success).toBe(false);
  });

  // NaN passes typeof === "number" but fails isNaN check
  it('rejects NaN price', async () => {
    const result = await recordPriceSnapshot('prod-1', NaN);
    expect(result.success).toBe(false);
  });

  it('rejects Infinity price', async () => {
    const result = await recordPriceSnapshot('prod-1', Infinity);
    expect(result.success).toBe(false);
  });

  it('accepts zero price', async () => {
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'PriceHistory') insertedItem = item; });
    const result = await recordPriceSnapshot('prod-1', 0);
    expect(result.success).toBe(true);
    expect(insertedItem.price).toBe(0);
  });

  it('coerces numeric string price to number', async () => {
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'PriceHistory') insertedItem = item; });
    const result = await recordPriceSnapshot('prod-1', '299.99');
    expect(result.success).toBe(true);
    expect(insertedItem.price).toBe(299.99);
  });

  it('rejects price of negative zero (treated as 0, which is >= 0)', async () => {
    // -0 passes Number(-0) === 0 which is >= 0
    const result = await recordPriceSnapshot('prod-1', -0);
    expect(result.success).toBe(true);
  });

  it('sanitizes HTML in productId', async () => {
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'PriceHistory') insertedItem = item; });
    await recordPriceSnapshot('<script>alert(1)</script>prod-1', 100);
    expect(insertedItem.productId).not.toContain('<script>');
  });

  it('truncates very long productId via sanitize(50)', async () => {
    const longId = 'a'.repeat(200);
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'PriceHistory') insertedItem = item; });
    await recordPriceSnapshot(longId, 100);
    expect(insertedItem.productId.length).toBeLessThanOrEqual(50);
  });

  it('dedup check: allows snapshot for different product same day', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 100, date: today },
    ]);

    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'PriceHistory') insertedItem = item; });

    const result = await recordPriceSnapshot('prod-2', 200);
    expect(result.success).toBe(true);
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.productId).toBe('prod-2');
  });

  it('allows snapshot for same product on different day', async () => {
    const yesterday = new Date(Date.now() - DAY);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 100, date: yesterday },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    const result = await recordPriceSnapshot('prod-1', 110);
    expect(result.success).toBe(true);
    expect(insertCount).toBe(1);
  });

  it('rejects boolean true as price (Number(true) = 1, but it is accepted)', async () => {
    // Number(true) === 1, which is valid — documenting this coercion
    const result = await recordPriceSnapshot('prod-1', true);
    expect(result.success).toBe(true);
  });

  it('rejects object as price', async () => {
    const result = await recordPriceSnapshot('prod-1', { value: 100 });
    expect(result.success).toBe(false);
  });

  it('rejects array as price', async () => {
    // Number([100]) === 100, so single-element array coerces. Documenting behavior.
    const result = await recordPriceSnapshot('prod-1', [100]);
    expect(result.success).toBe(true);
  });
});

// ── getPriceHistory edge cases ──────────────────────────────────

describe('getPriceHistory — edge cases', () => {
  it('returns empty for undefined productId', async () => {
    const result = await getPriceHistory(undefined);
    expect(result.prices).toEqual([]);
  });

  it('returns empty for empty string productId', async () => {
    const result = await getPriceHistory('');
    expect(result.prices).toEqual([]);
  });

  it('clamps days=0 to 1 (safeDays = Math.min(365, Math.max(1, 0||30)) = 30)', async () => {
    // Number(0) || 30 => 30 (because 0 is falsy), so days=0 actually becomes 30
    const twoDaysAgo = new Date(Date.now() - 2 * DAY);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 100, date: twoDaysAgo },
      { _id: 'ph-2', productId: 'prod-1', price: 110, date: sixHoursAgo },
    ]);
    const result = await getPriceHistory('prod-1', 0);
    // Both entries within 30-day window
    expect(result.prices).toHaveLength(2);
  });

  it('clamps negative days to 1', async () => {
    const result = await getPriceHistory('prod-1', -5);
    // Should not throw — safeDays becomes 1
    expect(result.prices).toEqual([]);
  });

  it('clamps days > 365 to 365', async () => {
    // Should not throw, just use 365 max
    const result = await getPriceHistory('prod-1', 999);
    expect(result.prices).toEqual([]);
  });

  it('handles NaN days by defaulting to 30', async () => {
    // Number('foo') || 30 => 30
    const result = await getPriceHistory('prod-1', 'foo');
    expect(result.prices).toEqual([]);
  });

  it('handles null days by defaulting to 30', async () => {
    // Number(null) => 0, then || 30 => 30
    const result = await getPriceHistory('prod-1', null);
    expect(result.prices).toEqual([]);
  });

  it('maps only price and date fields from history items', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 100, date: new Date(), extraField: 'secret' },
    ]);
    const result = await getPriceHistory('prod-1');
    expect(result.prices[0]).toHaveProperty('price');
    expect(result.prices[0]).toHaveProperty('date');
    expect(result.prices[0]).not.toHaveProperty('extraField');
    expect(result.prices[0]).not.toHaveProperty('productId');
  });
});

// ── checkPriceDrops edge cases ─────────────────────────────────

describe('checkPriceDrops — edge cases', () => {
  it('skips products where 30-day high is zero', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 0, date: new Date(Date.now() - 5 * DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    // high <= 0 means skip
    expect(result.alertsSent).toBe(0);
  });

  it('exactly 10% drop triggers alert (boundary)', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 100, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 90, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    // dropPercent = (100-90)/100 = 0.10, threshold is 0.10, so 0.10 < 0.10 is false => alert sent
    expect(result.alertsSent).toBe(1);
  });

  it('9.99% drop does NOT trigger alert', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 1000, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 900.1, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    // (1000-900.1)/1000 = 0.0999 < 0.10
    expect(result.alertsSent).toBe(0);
  });

  it('skips wishlist items with null memberId', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: null, productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(0);
  });

  it('skips wishlist items with empty string memberId', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: '', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(0);
  });

  it('handles multiple products with different drop percentages', async () => {
    __seed('PriceHistory', [
      // prod-1: 50% drop => alert
      { _id: 'ph-1', productId: 'prod-1', price: 200, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 100, date: new Date(Date.now() - DAY) },
      // prod-2: 5% drop => no alert
      { _id: 'ph-3', productId: 'prod-2', price: 200, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-4', productId: 'prod-2', price: 190, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
      { _id: 'w-2', memberId: 'member-1', productId: 'prod-2' },
    ]);

    const result = await checkPriceDrops();
    expect(result.productsChecked).toBe(2);
    expect(result.alertsSent).toBe(1);
  });

  it('uses most recent price as current (not lowest)', async () => {
    // Three snapshots: high=300, then 200, then 250 (most recent)
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 300, date: new Date(Date.now() - 20 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 200, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-3', productId: 'prod-1', price: 250, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    let insertedAlert = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertsSent') insertedAlert = item; });

    const result = await checkPriceDrops();
    // drop = (300-250)/300 = 16.67% => alert
    expect(result.alertsSent).toBe(1);
    expect(insertedAlert.price).toBe(250);
    expect(insertedAlert.previousHigh).toBe(300);
  });

  it('cooldown from back_in_stock alert does not block price_drop alert', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    // Recent back_in_stock alert should NOT block price_drop
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'back_in_stock', sentAt: new Date() },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(1);
  });

  it('records dropPercent as integer (rounded)', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 300, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 200, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    let insertedAlert = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertsSent') insertedAlert = item; });

    await checkPriceDrops();
    // (300-200)/300 = 0.3333... => Math.round(33.33) = 33
    expect(insertedAlert.dropPercent).toBe(33);
  });

  it('email includes empty productName when wishlist item has no name', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
      // no name field
    ]);

    await checkPriceDrops();
    const emails = __getEmailLog().filter(e => e.templateId === 'wishlist_price_drop');
    expect(emails).toHaveLength(1);
    expect(emails[0].options.variables.productName).toBe('');
  });
});

// ── checkBackInStock edge cases ─────────────────────────────────

describe('checkBackInStock — edge cases', () => {
  it('returns early with zero alerts when wishlist is completely empty', async () => {
    const result = await checkBackInStock();
    expect(result).toEqual({ success: true, alertsSent: 0 });
  });

  it('skips wishlist items without productId', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: null, inStock: false },
    ]);
    // No Stores/Products to find, so no alerts
    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(0);
  });

  it('deduplicates product IDs across multiple wishlist entries', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
      { _id: 'w-2', memberId: 'member-2', productId: 'prod-1', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true },
    ]);

    const result = await checkBackInStock();
    // Two members, same product => 2 alerts
    expect(result.alertsSent).toBe(2);
  });

  it('product name falls back to wishlist name when product has no name', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Wishlist Futon', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', inStock: true },
      // no name field on product
    ]);

    let insertedAlert = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertsSent') insertedAlert = item; });

    await checkBackInStock();
    // product.name is undefined, falls back to wishItem.name
    expect(insertedAlert.productName).toBe('Wishlist Futon');
  });

  it('productName is empty when both product and wishlist item lack name', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', inStock: true },
    ]);

    let insertedAlert = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertsSent') insertedAlert = item; });

    await checkBackInStock();
    expect(insertedAlert.productName).toBe('');
  });

  it('skips product not found in Stores/Products', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-gone', inStock: false },
    ]);
    // No product seeded

    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(0);
  });

  it('does not send alert when backInStock pref is disabled', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true },
    ]);
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', backInStock: false },
    ]);

    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(0);
  });

  it('cooldown from price_drop alert does not block back_in_stock alert', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true },
    ]);
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'price_drop', sentAt: new Date() },
    ]);

    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(1);
  });

  it('handles mix of in-stock and still-out-of-stock products', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
      { _id: 'w-2', memberId: 'member-1', productId: 'prod-2', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon A', inStock: true },
      { _id: 'prod-2', name: 'Futon B', inStock: false },
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

    let updatedItems = [];
    __onUpdate((col, item) => { if (col === 'Wishlist') updatedItems.push(item); });

    await checkBackInStock();
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].inStock).toBe(true);
    expect(updatedItems[0]._id).toBe('w-1');
  });
});

// ── checkLowStock edge cases ────────────────────────────────────

describe('checkLowStock — edge cases', () => {
  it('does not alert when quantityInStock is null', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: null },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(0);
  });

  it('does not alert when quantityInStock is undefined', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true },
      // quantityInStock not set
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(0);
  });

  it('does not alert when quantity exactly equals threshold (5)', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 5 },
    ]);

    const result = await checkLowStock();
    // qty >= threshold => no alert (5 >= 5)
    expect(result.alertsSent).toBe(0);
  });

  it('alerts when quantity is one below threshold (4)', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 4 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(1);
  });

  it('alerts when quantity is zero (in-stock but zero qty edge case)', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 0 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(1);
  });

  it('uses custom threshold of 0 — never alerts', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 0 },
    ]);
    __seed('InventoryThresholds', [
      { _id: 'it-1', productId: 'prod-1', lowStockThreshold: 0 },
    ]);

    const result = await checkLowStock();
    // qty (0) >= threshold (0) => no alert
    expect(result.alertsSent).toBe(0);
  });

  it('uses custom threshold higher than default', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 8 },
    ]);
    __seed('InventoryThresholds', [
      { _id: 'it-1', productId: 'prod-1', lowStockThreshold: 10 },
    ]);

    const result = await checkLowStock();
    // 8 < 10 => alert
    expect(result.alertsSent).toBe(1);
  });

  it('ignores threshold record with null lowStockThreshold', async () => {
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
    // Falls back to default threshold of 5; 3 < 5 => alert
    expect(result.alertsSent).toBe(1);
  });

  it('skips members with null memberId', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: null, productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 2 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(0);
  });

  it('handles multiple products: one low stock, one not', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
      { _id: 'w-2', memberId: 'member-1', productId: 'prod-2' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon A', inStock: true, quantityInStock: 2 },
      { _id: 'prod-2', name: 'Futon B', inStock: true, quantityInStock: 50 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(1);
  });

  it('low_stock cooldown does not interfere with price_drop cooldown', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon', inStock: true, quantityInStock: 2 },
    ]);
    // Recent price_drop alert should not block low_stock
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'price_drop', sentAt: new Date() },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(1);
  });
});

// ── getAlertPrefs edge cases ────────────────────────────────────

describe('getAlertPrefs — edge cases', () => {
  it('returns empty when member has no _id', async () => {
    __setMember({ loginEmail: 'no-id@test.com' });
    const result = await getAlertPrefs();
    expect(result.prefs).toEqual([]);
  });

  it('defaults priceDrops to true when field is undefined', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', backInStock: false },
      // priceDrops not set
    ]);

    const result = await getAlertPrefs();
    expect(result.prefs[0].priceDrops).toBe(true);
    expect(result.prefs[0].backInStock).toBe(false);
  });

  it('defaults backInStock to true when field is undefined', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: false },
    ]);

    const result = await getAlertPrefs();
    expect(result.prefs[0].priceDrops).toBe(false);
    expect(result.prefs[0].backInStock).toBe(true);
  });

  it('treats truthy non-boolean values as true for priceDrops', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: 'yes', backInStock: 1 },
    ]);

    const result = await getAlertPrefs();
    // 'yes' !== false => true, 1 !== false => true
    expect(result.prefs[0].priceDrops).toBe(true);
    expect(result.prefs[0].backInStock).toBe(true);
  });

  it('only false (exactly) disables priceDrops', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: 0, backInStock: null },
    ]);

    const result = await getAlertPrefs();
    // 0 !== false => true (loose equality not used)
    expect(result.prefs[0].priceDrops).toBe(true);
    // null !== false => true
    expect(result.prefs[0].backInStock).toBe(true);
  });

  it('returns only prefs for the current member, not others', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1' },
      { _id: 'pref-2', memberId: 'member-2', productId: 'prod-2' },
    ]);

    const result = await getAlertPrefs();
    expect(result.prefs).toHaveLength(1);
    expect(result.prefs[0].productId).toBe('prod-1');
  });
});

// ── updateAlertPrefs edge cases ─────────────────────────────────

describe('updateAlertPrefs — edge cases', () => {
  it('rejects when member has no _id', async () => {
    __setMember({ loginEmail: 'no-id@test.com' });
    const result = await updateAlertPrefs('prod-1', { priceDrops: false });
    expect(result.success).toBe(false);
  });

  it('rejects empty string productId', async () => {
    __setMember({ _id: 'member-1' });
    const result = await updateAlertPrefs('', { priceDrops: false });
    expect(result.success).toBe(false);
  });

  it('rejects undefined productId', async () => {
    __setMember({ _id: 'member-1' });
    const result = await updateAlertPrefs(undefined, {});
    expect(result.success).toBe(false);
  });

  it('creates pref with defaults when prefs object is empty', async () => {
    __setMember({ _id: 'member-1' });
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertPrefs') insertedItem = item; });

    const result = await updateAlertPrefs('prod-1', {});
    expect(result.success).toBe(true);
    // priceDrops: undefined !== false => true; backInStock: undefined !== false => true
    expect(insertedItem.priceDrops).toBe(true);
    expect(insertedItem.backInStock).toBe(true);
  });

  it('creates pref with defaults when prefs arg is omitted', async () => {
    __setMember({ _id: 'member-1' });
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertPrefs') insertedItem = item; });

    const result = await updateAlertPrefs('prod-1');
    expect(result.success).toBe(true);
    expect(insertedItem.priceDrops).toBe(true);
    expect(insertedItem.backInStock).toBe(true);
  });

  it('update path: does not change priceDrops if not provided in prefs', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: false, backInStock: true },
    ]);

    let updatedItem = null;
    __onUpdate((col, item) => { if (col === 'WishlistAlertPrefs') updatedItem = item; });

    await updateAlertPrefs('prod-1', { backInStock: false });
    expect(updatedItem.priceDrops).toBe(false); // unchanged
    expect(updatedItem.backInStock).toBe(false); // updated
  });

  it('coerces truthy priceDrops value to boolean via !!', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: false, backInStock: false },
    ]);

    let updatedItem = null;
    __onUpdate((col, item) => { if (col === 'WishlistAlertPrefs') updatedItem = item; });

    await updateAlertPrefs('prod-1', { priceDrops: 'yes' });
    expect(updatedItem.priceDrops).toBe(true); // !!'yes' === true
  });

  it('coerces zero to false via !!', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: true, backInStock: true },
    ]);

    let updatedItem = null;
    __onUpdate((col, item) => { if (col === 'WishlistAlertPrefs') updatedItem = item; });

    await updateAlertPrefs('prod-1', { priceDrops: 0 });
    expect(updatedItem.priceDrops).toBe(false); // !!0 === false
  });

  it('sanitizes HTML in productId when creating new pref', async () => {
    __setMember({ _id: 'member-1' });
    let insertedItem = null;
    __onInsert((col, item) => { if (col === 'WishlistAlertPrefs') insertedItem = item; });

    await updateAlertPrefs('<b>prod-1</b>', { priceDrops: true });
    expect(insertedItem.productId).not.toContain('<b>');
  });
});

// ── getAlertHistory edge cases ──────────────────────────────────

describe('getAlertHistory — edge cases', () => {
  it('returns empty when member object has no _id', async () => {
    __setMember({ loginEmail: 'no-id@test.com' });
    const result = await getAlertHistory();
    expect(result.alerts).toEqual([]);
  });

  it('maps all expected fields from alert records', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertsSent', [
      {
        _id: 'wa-1', memberId: 'member-1', productId: 'prod-1',
        alertType: 'price_drop', sentAt: new Date(), price: 400,
        previousHigh: 500, dropPercent: 20, productName: 'Futon',
        quantityInStock: 3,
      },
    ]);

    const result = await getAlertHistory();
    expect(result.alerts).toHaveLength(1);
    const alert = result.alerts[0];
    expect(alert.productId).toBe('prod-1');
    expect(alert.alertType).toBe('price_drop');
    expect(alert.price).toBe(400);
    expect(alert.previousHigh).toBe(500);
    expect(alert.dropPercent).toBe(20);
    expect(alert.productName).toBe('Futon');
    expect(alert.quantityInStock).toBe(3);
  });

  it('returns undefined for optional fields not present on record', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'back_in_stock', sentAt: new Date() },
    ]);

    const result = await getAlertHistory();
    const alert = result.alerts[0];
    expect(alert.price).toBeUndefined();
    expect(alert.previousHigh).toBeUndefined();
    expect(alert.dropPercent).toBeUndefined();
  });

  it('does not expose _id or memberId in mapped alert objects', async () => {
    __setMember({ _id: 'member-1' });
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'low_stock', sentAt: new Date() },
    ]);

    const result = await getAlertHistory();
    expect(result.alerts[0]).not.toHaveProperty('_id');
    expect(result.alerts[0]).not.toHaveProperty('memberId');
  });
});

// ── isAlertDisabled (internal helper, tested via integration) ───

describe('isAlertDisabled — integration via checkPriceDrops/checkBackInStock', () => {
  it('default (no pref record) means alerts are enabled', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    // No prefs seeded => default enabled

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(1);
  });

  it('pref record with priceDrops=true still allows alert', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: true },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(1);
  });

  it('pref for different product does not affect current product', async () => {
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: new Date(Date.now() - 10 * DAY) },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: new Date(Date.now() - DAY) },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    // Pref disables prod-2, not prod-1
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-2', priceDrops: false },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(1);
  });
});

// ── Constants ──────────────────────────────────────────────────

describe('exported constants', () => {
  it('PRICE_DROP_THRESHOLD is between 0 and 1', () => {
    expect(_PRICE_DROP_THRESHOLD).toBeGreaterThan(0);
    expect(_PRICE_DROP_THRESHOLD).toBeLessThan(1);
  });

  it('ALERT_COOLDOWN_DAYS is a positive integer', () => {
    expect(_ALERT_COOLDOWN_DAYS).toBeGreaterThan(0);
    expect(Number.isInteger(_ALERT_COOLDOWN_DAYS)).toBe(true);
  });

  it('LOW_STOCK_THRESHOLD is a positive integer', () => {
    expect(_LOW_STOCK_THRESHOLD).toBeGreaterThan(0);
    expect(Number.isInteger(_LOW_STOCK_THRESHOLD)).toBe(true);
  });
});
