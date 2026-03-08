import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import {
  recordPriceSnapshot,
  getPriceHistory,
  checkPriceDrops,
  checkBackInStock,
  checkLowStock,
  getAlertPrefs,
  updateAlertPrefs,
  _PRICE_DROP_THRESHOLD,
  _ALERT_COOLDOWN_DAYS,
  _LOW_STOCK_THRESHOLD,
} from '../../src/backend/wishlistAlerts.web.js';

beforeEach(() => {
  __seed('PriceHistory', []);
  __seed('WishlistAlertsSent', []);
  __seed('WishlistAlertPrefs', []);
  __seed('Wishlist', []);
  __seed('Stores/Products', []);
  __seed('InventoryThresholds', []);
});

// ── recordPriceSnapshot ────────────────────────────────────────────

describe('recordPriceSnapshot', () => {
  it('records a price snapshot', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'PriceHistory') insertedItem = item;
    });

    const result = await recordPriceSnapshot('prod-1', 499);
    expect(result.success).toBe(true);
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.productId).toBe('prod-1');
    expect(insertedItem.price).toBe(499);
  });

  it('rejects missing productId', async () => {
    const result = await recordPriceSnapshot(null, 499);
    expect(result.success).toBe(false);
  });

  it('rejects negative prices', async () => {
    const result = await recordPriceSnapshot('prod-1', -10);
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric prices', async () => {
    const result = await recordPriceSnapshot('prod-1', 'free');
    expect(result.success).toBe(false);
  });

  it('deduplicates same-day snapshots', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 499, date: today },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    const result = await recordPriceSnapshot('prod-1', 449);
    expect(result.success).toBe(true);
    expect(insertCount).toBe(0);
  });
});

// ── getPriceHistory ─────────────────────────────────────────────────

describe('getPriceHistory', () => {
  it('returns price history sorted by date', async () => {
    const day1 = new Date(Date.now() - 2 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 499, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 449, date: day2 },
    ]);

    const result = await getPriceHistory('prod-1');
    expect(result.prices).toHaveLength(2);
    expect(result.prices[0].price).toBe(499);
    expect(result.prices[1].price).toBe(449);
  });

  it('returns empty for missing productId', async () => {
    const result = await getPriceHistory(null);
    expect(result.prices).toEqual([]);
  });

  it('returns empty when no history exists', async () => {
    const result = await getPriceHistory('nonexistent');
    expect(result.prices).toEqual([]);
  });
});

// ── checkPriceDrops ─────────────────────────────────────────────────

describe('checkPriceDrops', () => {
  it('detects >=10% price drop and sends alert', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 }, // 20% drop
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    let insertedAlerts = [];
    __onInsert((collection, item) => {
      if (collection === 'WishlistAlertsSent') insertedAlerts.push(item);
    });

    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(1);
    expect(result.productsChecked).toBe(1);
    expect(insertedAlerts[0].alertType).toBe('price_drop');
    expect(insertedAlerts[0].price).toBe(400);
    expect(insertedAlerts[0].previousHigh).toBe(500);
    expect(insertedAlerts[0].dropPercent).toBe(20);
  });

  it('skips products with <10% drop', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 470, date: day2 }, // 6% drop
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(0);
  });

  it('respects 7-day cooldown window', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    // Already sent alert 3 days ago (within cooldown)
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'price_drop', sentAt: new Date(Date.now() - 3 * 86400000) },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(0);
  });

  it('sends alert if last alert was outside cooldown window', async () => {
    const day1 = new Date(Date.now() - 15 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    // Alert sent 10 days ago (outside cooldown)
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'price_drop', sentAt: new Date(Date.now() - 10 * 86400000) },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(1);
  });

  it('respects disabled notification preferences', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: false, backInStock: true },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(0);
  });

  it('sends to multiple members with same product wishlisted', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
      { _id: 'w-2', memberId: 'member-2', productId: 'prod-1' },
    ]);

    const result = await checkPriceDrops();
    expect(result.alertsSent).toBe(2);
  });

  it('returns zero when no price history', async () => {
    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(0);
    expect(result.productsChecked).toBe(0);
  });
});

// ── checkBackInStock ────────────────────────────────────────────────

describe('checkBackInStock', () => {
  it('sends alert when out-of-stock product is back in stock', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Futon', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true },
    ]);

    let insertedAlerts = [];
    __onInsert((collection, item) => {
      if (collection === 'WishlistAlertsSent') insertedAlerts.push(item);
    });

    const result = await checkBackInStock();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(1);
    expect(insertedAlerts[0].alertType).toBe('back_in_stock');
    expect(insertedAlerts[0].productName).toBe('Futon Frame');
  });

  it('does not alert if product is still out of stock', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: false },
    ]);

    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(0);
  });

  it('does not alert if already notified within cooldown', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true },
    ]);
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'back_in_stock', sentAt: new Date() },
    ]);

    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(0);
  });

  it('updates wishlist item inStock status after alert', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Futon', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true },
    ]);

    let updatedWishItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'Wishlist') updatedWishItem = item;
    });

    await checkBackInStock();
    expect(updatedWishItem).not.toBeNull();
    expect(updatedWishItem.inStock).toBe(true);
  });

  it('respects disabled notification preferences', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true },
    ]);
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: true, backInStock: false },
    ]);

    const result = await checkBackInStock();
    expect(result.alertsSent).toBe(0);
  });

  it('returns zero when no out-of-stock wishlist items', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', inStock: true },
    ]);

    const result = await checkBackInStock();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(0);
  });
});

// ── Notification Preferences ────────────────────────────────────────

describe('getAlertPrefs', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
  });

  it('returns preferences for a member', async () => {
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: true, backInStock: false },
      { _id: 'pref-2', memberId: 'member-1', productId: 'prod-2', priceDrops: false, backInStock: true },
    ]);

    const result = await getAlertPrefs();
    expect(result.prefs).toHaveLength(2);
    expect(result.prefs[0].priceDrops).toBe(true);
    expect(result.prefs[0].backInStock).toBe(false);
    expect(result.prefs[1].priceDrops).toBe(false);
    expect(result.prefs[1].backInStock).toBe(true);
  });

  it('returns empty for unauthenticated user', async () => {
    __setMember(null);
    const result = await getAlertPrefs();
    expect(result.prefs).toEqual([]);
  });

  it('defaults to enabled when no explicit pref set', async () => {
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    const result = await getAlertPrefs();
    expect(result.prefs[0].priceDrops).toBe(true);
    expect(result.prefs[0].backInStock).toBe(true);
  });
});

describe('updateAlertPrefs', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
  });

  it('creates new pref record', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'WishlistAlertPrefs') insertedItem = item;
    });

    const result = await updateAlertPrefs('prod-1', { priceDrops: false });
    expect(result.success).toBe(true);
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.priceDrops).toBe(false);
    expect(insertedItem.backInStock).toBe(true); // default
  });

  it('updates existing pref record', async () => {
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: true, backInStock: true },
    ]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'WishlistAlertPrefs') updatedItem = item;
    });

    const result = await updateAlertPrefs('prod-1', { backInStock: false });
    expect(result.success).toBe(true);
    expect(updatedItem).not.toBeNull();
    expect(updatedItem.backInStock).toBe(false);
    expect(updatedItem.priceDrops).toBe(true); // unchanged
  });

  it('rejects unauthenticated user', async () => {
    __setMember(null);
    const result = await updateAlertPrefs('prod-1', {});
    expect(result.success).toBe(false);
  });

  it('rejects missing productId', async () => {
    const result = await updateAlertPrefs(null, {});
    expect(result.success).toBe(false);
  });
});

// ── checkLowStock ─────────────────────────────────────────────────

describe('checkLowStock', () => {
  it('sends alert when wishlisted product stock falls below threshold', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true, quantityInStock: 3 },
    ]);

    let insertedAlerts = [];
    __onInsert((collection, item) => {
      if (collection === 'WishlistAlertsSent') insertedAlerts.push(item);
    });

    const result = await checkLowStock();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(1);
    expect(insertedAlerts[0].alertType).toBe('low_stock');
    expect(insertedAlerts[0].quantityInStock).toBe(3);
  });

  it('does not alert when stock is above threshold', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true, quantityInStock: 20 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(0);
  });

  it('does not alert for out-of-stock products', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: false, quantityInStock: 0 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(0);
  });

  it('respects cooldown window', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true, quantityInStock: 3 },
    ]);
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'low_stock', sentAt: new Date() },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(0);
  });

  it('sends alert if last low-stock alert was outside cooldown', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true, quantityInStock: 3 },
    ]);
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'low_stock', sentAt: new Date(Date.now() - 10 * 86400000) },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(1);
  });

  it('sends to multiple members with same product', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
      { _id: 'w-2', memberId: 'member-2', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true, quantityInStock: 2 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(2);
  });

  it('returns zero when no wishlisted products', async () => {
    const result = await checkLowStock();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(0);
  });

  it('uses custom threshold from InventoryThresholds collection', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Futon Frame', inStock: true, quantityInStock: 8 },
    ]);
    __seed('InventoryThresholds', [
      { _id: 'it-1', productId: 'prod-1', lowStockThreshold: 10 },
    ]);

    const result = await checkLowStock();
    expect(result.alertsSent).toBe(1);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('constants', () => {
  it('price drop threshold is 10%', () => {
    expect(_PRICE_DROP_THRESHOLD).toBe(0.10);
  });

  it('alert cooldown is 7 days', () => {
    expect(_ALERT_COOLDOWN_DAYS).toBe(7);
  });

  it('low stock threshold default is 5', () => {
    expect(_LOW_STOCK_THRESHOLD).toBe(5);
  });
});
