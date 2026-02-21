import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { allProducts, analyticsRecords, futonFrame, sampleOrder } from './fixtures/products.js';
import {
  trackProductView,
  trackAddToCart,
  getMostViewedProducts,
  getTrendingProducts,
  buildViewContentEvent,
  buildAddToCartEvent,
  buildCheckoutEvent,
  buildPurchaseEvent,
  buildWishlistEvent,
} from '../src/backend/analyticsHelpers.web.js';

beforeEach(() => {
  __seed('Stores/Products', allProducts);
  __seed('ProductAnalytics', analyticsRecords);
});

// ── trackProductView ────────────────────────────────────────────────

describe('trackProductView', () => {
  it('increments view count for existing product', async () => {
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackProductView('prod-frame-001', 'Eureka Futon Frame', 'futon-frames');

    expect(updated).toBeDefined();
    expect(updated.viewCount).toBe(151); // was 150
  });

  it('updates lastViewed timestamp on existing record', async () => {
    const before = Date.now();
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackProductView('prod-frame-001', 'Eureka Futon Frame', 'futon-frames');

    expect(new Date(updated.lastViewed).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('creates new analytics record for new product', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = item; });

    await trackProductView('prod-new-001', 'New Product', 'other');

    expect(inserted).toBeDefined();
    expect(inserted.productId).toBe('prod-new-001');
    expect(inserted.productName).toBe('New Product');
    expect(inserted.category).toBe('other');
    expect(inserted.viewCount).toBe(1);
    expect(inserted.addToCartCount).toBe(0);
    expect(inserted.purchaseCount).toBe(0);
  });

  it('inserts into ProductAnalytics collection', async () => {
    let insertedCol;
    __onInsert((col) => { insertedCol = col; });

    await trackProductView('prod-new-002', 'Another New', 'beds');
    expect(insertedCol).toBe('ProductAnalytics');
  });

  it('sanitizes productId, productName, and category', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = item; });

    const longId = 'x'.repeat(200);
    const longName = 'n'.repeat(500);
    const longCat = 'c'.repeat(300);

    await trackProductView(longId, longName, longCat);

    expect(inserted.productId.length).toBeLessThanOrEqual(50);
    expect(inserted.productName.length).toBeLessThanOrEqual(200);
    expect(inserted.category.length).toBeLessThanOrEqual(100);
  });

  it('does not throw on null inputs (non-critical)', async () => {
    await expect(trackProductView(null, null, null)).resolves.not.toThrow();
  });

  it('does not throw on empty string inputs', async () => {
    await expect(trackProductView('', '', '')).resolves.not.toThrow();
  });

  it('initializes viewCount to 1 for fresh record', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = item; });

    await trackProductView('prod-plat-001', 'Lexington Platform Bed', 'platform-beds');
    expect(inserted.viewCount).toBe(1);
  });
});

// ── trackAddToCart ──────────────────────────────────────────────────

describe('trackAddToCart', () => {
  it('increments addToCartCount for tracked product', async () => {
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackAddToCart('prod-frame-001');

    expect(updated).toBeDefined();
    expect(updated.addToCartCount).toBe(31); // was 30
  });

  it('does not insert a new record for untracked product', async () => {
    let inserted = false;
    __onInsert(() => { inserted = true; });

    await trackAddToCart('prod-nonexistent');
    expect(inserted).toBe(false);
  });

  it('does not throw on null productId', async () => {
    await expect(trackAddToCart(null)).resolves.not.toThrow();
  });

  it('updates the ProductAnalytics collection', async () => {
    let updatedCol;
    __onUpdate((col) => { updatedCol = col; });

    await trackAddToCart('prod-matt-001');
    expect(updatedCol).toBe('ProductAnalytics');
  });

  it('handles product with zero addToCartCount', async () => {
    __seed('ProductAnalytics', [
      { _id: 'ana-zero', productId: 'prod-zero', addToCartCount: 0, viewCount: 5 },
    ]);
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackAddToCart('prod-zero');
    expect(updated.addToCartCount).toBe(1);
  });

  it('handles product with missing addToCartCount field', async () => {
    __seed('ProductAnalytics', [
      { _id: 'ana-missing', productId: 'prod-missing', viewCount: 5 },
    ]);
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackAddToCart('prod-missing');
    expect(updated.addToCartCount).toBe(1);
  });
});

// ── getMostViewedProducts ──────────────────────────────────────────

describe('getMostViewedProducts', () => {
  it('returns products sorted by viewCount descending', async () => {
    const results = await getMostViewedProducts(8);
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].viewCount).toBeGreaterThanOrEqual(results[i].viewCount);
    }
  });

  it('respects limit parameter', async () => {
    const results = await getMostViewedProducts(1);
    expect(results).toHaveLength(1);
  });

  it('uses default limit of 8', async () => {
    const results = await getMostViewedProducts();
    // Should not throw and should return results
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('returns correct product fields', async () => {
    const results = await getMostViewedProducts(8);
    const first = results[0];
    expect(first).toHaveProperty('_id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('price');
    expect(first).toHaveProperty('formattedPrice');
    expect(first).toHaveProperty('mainMedia');
    expect(first).toHaveProperty('viewCount');
  });

  it('does not leak internal fields from product data', async () => {
    const results = await getMostViewedProducts(8);
    const first = results[0];
    expect(first).not.toHaveProperty('sku');
    expect(first).not.toHaveProperty('description');
    expect(first).not.toHaveProperty('collections');
    expect(first).not.toHaveProperty('options');
    expect(first).not.toHaveProperty('reviews');
    expect(first).not.toHaveProperty('discount');
  });

  it('returns empty when no analytics exist', async () => {
    __seed('ProductAnalytics', []);
    const results = await getMostViewedProducts(8);
    expect(results).toEqual([]);
  });

  it('skips analytics entries whose products no longer exist', async () => {
    __seed('ProductAnalytics', [
      { _id: 'ana-gone', productId: 'prod-deleted-999', viewCount: 500, lastViewed: new Date() },
      ...analyticsRecords,
    ]);
    const results = await getMostViewedProducts(8);
    // prod-deleted-999 has highest views but doesn't exist in Stores/Products
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-deleted-999');
    expect(results.length).toBe(3); // only the 3 real products
  });

  it('includes viewCount from analytics in returned objects', async () => {
    const results = await getMostViewedProducts(1);
    expect(results[0].viewCount).toBe(150); // highest: prod-frame-001
  });

  it('merges correct viewCount to each product', async () => {
    const results = await getMostViewedProducts(8);
    const frame = results.find(r => r._id === 'prod-frame-001');
    const mattress = results.find(r => r._id === 'prod-matt-001');
    expect(frame.viewCount).toBe(150);
    expect(mattress.viewCount).toBe(120);
  });
});

// ── getTrendingProducts ────────────────────────────────────────────

describe('getTrendingProducts', () => {
  it('returns products viewed within the last 7 days', async () => {
    const results = await getTrendingProducts(6);
    expect(results.length).toBeGreaterThan(0);
  });

  it('excludes products last viewed over 7 days ago', async () => {
    const results = await getTrendingProducts(6);
    const ids = results.map(r => r._id);
    // ana-003 (prod-murphy-001) has lastViewed 14 days ago
    expect(ids).not.toContain('prod-murphy-001');
  });

  it('returns empty when no recent views', async () => {
    const oldDate = new Date(Date.now() - 30 * 86400000);
    __seed('ProductAnalytics', [
      { ...analyticsRecords[0], lastViewed: oldDate },
    ]);
    const results = await getTrendingProducts(6);
    expect(results).toEqual([]);
  });

  it('respects limit parameter', async () => {
    const results = await getTrendingProducts(1);
    expect(results).toHaveLength(1);
  });

  it('uses default limit of 6', async () => {
    const results = await getTrendingProducts();
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(6);
  });

  it('returns correct fields (no viewCount)', async () => {
    const results = await getTrendingProducts(6);
    const first = results[0];
    expect(first).toHaveProperty('_id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('formattedPrice');
    expect(first).toHaveProperty('mainMedia');
    // Trending does NOT include viewCount or price
    expect(first).not.toHaveProperty('viewCount');
    expect(first).not.toHaveProperty('price');
  });

  it('does not leak internal fields', async () => {
    const results = await getTrendingProducts(6);
    const first = results[0];
    expect(first).not.toHaveProperty('sku');
    expect(first).not.toHaveProperty('description');
    expect(first).not.toHaveProperty('collections');
  });

  it('skips analytics entries whose products no longer exist', async () => {
    __seed('ProductAnalytics', [
      { _id: 'ana-gone', productId: 'prod-gone-999', viewCount: 999, lastViewed: new Date() },
      analyticsRecords[0],
    ]);
    const results = await getTrendingProducts(6);
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-gone-999');
  });
});

// ── buildViewContentEvent ──────────────────────────────────────────

describe('buildViewContentEvent', () => {
  it('returns GA4 payload for a product', async () => {
    const event = await buildViewContentEvent(futonFrame);
    expect(event.content_name).toBe('Eureka Futon Frame');
    expect(event.content_ids).toEqual(['prod-frame-001']);
    expect(event.content_type).toBe('product');
    expect(event.value).toBe(499);
    expect(event.currency).toBe('USD');
  });

  it('returns empty object for null product', async () => {
    const event = await buildViewContentEvent(null);
    expect(event).toEqual({});
  });

  it('returns empty object for undefined product', async () => {
    const event = await buildViewContentEvent(undefined);
    expect(event).toEqual({});
  });

  it('uses first collection as content_category', async () => {
    const event = await buildViewContentEvent(futonFrame);
    expect(event.content_category).toBe('futon-frames');
  });

  it('handles product with no collections', async () => {
    const event = await buildViewContentEvent({ _id: 'p1', name: 'Test', price: 10 });
    expect(event.content_category).toBe('');
  });

  it('handles product with empty collections array', async () => {
    const event = await buildViewContentEvent({ _id: 'p1', name: 'Test', price: 10, collections: [] });
    expect(event.content_category).toBe(''); // [][0] is undefined, || '' gives ''
  });

  it('sanitizes product name', async () => {
    const longName = 'X'.repeat(500);
    const event = await buildViewContentEvent({ _id: 'p1', name: longName, price: 10 });
    expect(event.content_name.length).toBeLessThanOrEqual(200);
  });

  it('defaults missing fields gracefully', async () => {
    const event = await buildViewContentEvent({});
    expect(event.content_name).toBe('');
    expect(event.content_ids).toEqual(['']);
    expect(event.value).toBe(0);
    expect(event.currency).toBe('USD');
  });
});

// ── buildAddToCartEvent ────────────────────────────────────────────

describe('buildAddToCartEvent', () => {
  it('returns GA4 payload with value = price * quantity', async () => {
    const event = await buildAddToCartEvent(futonFrame, 2);
    expect(event.value).toBe(998); // 499 * 2
    expect(event.num_items).toBe(2);
  });

  it('uses default quantity of 1', async () => {
    const event = await buildAddToCartEvent(futonFrame);
    expect(event.value).toBe(499);
    expect(event.num_items).toBe(1);
  });

  it('returns empty object for null product', async () => {
    const event = await buildAddToCartEvent(null, 1);
    expect(event).toEqual({});
  });

  it('includes correct content fields', async () => {
    const event = await buildAddToCartEvent(futonFrame, 1);
    expect(event.content_name).toBe('Eureka Futon Frame');
    expect(event.content_ids).toEqual(['prod-frame-001']);
    expect(event.content_type).toBe('product');
    expect(event.currency).toBe('USD');
  });

  it('sanitizes product name', async () => {
    const event = await buildAddToCartEvent({ _id: 'p1', name: 'A'.repeat(500), price: 10 }, 1);
    expect(event.content_name.length).toBeLessThanOrEqual(200);
  });

  it('handles zero price', async () => {
    const event = await buildAddToCartEvent({ _id: 'p1', name: 'Free', price: 0 }, 3);
    expect(event.value).toBe(0);
  });

  it('handles missing price', async () => {
    const event = await buildAddToCartEvent({ _id: 'p1', name: 'No Price' }, 2);
    expect(event.value).toBe(0);
  });
});

// ── buildCheckoutEvent ─────────────────────────────────────────────

describe('buildCheckoutEvent', () => {
  const cartItems = [
    { productId: 'prod-frame-001', quantity: 1 },
    { productId: 'prod-matt-001', quantity: 2 },
  ];

  it('returns payload with all product IDs', async () => {
    const event = await buildCheckoutEvent(cartItems, 1197);
    expect(event.content_ids).toEqual(['prod-frame-001', 'prod-matt-001']);
  });

  it('includes cart total as value', async () => {
    const event = await buildCheckoutEvent(cartItems, 1197);
    expect(event.value).toBe(1197);
    expect(event.currency).toBe('USD');
  });

  it('sums item quantities for num_items', async () => {
    const event = await buildCheckoutEvent(cartItems, 1197);
    expect(event.num_items).toBe(3); // 1 + 2
  });

  it('handles null cartItems', async () => {
    const event = await buildCheckoutEvent(null, 0);
    expect(event.content_ids).toEqual([]);
    expect(event.num_items).toBe(0);
  });

  it('handles empty cartItems array', async () => {
    const event = await buildCheckoutEvent([], 0);
    expect(event.content_ids).toEqual([]);
    expect(event.num_items).toBe(0);
  });

  it('handles null cartTotal', async () => {
    const event = await buildCheckoutEvent(cartItems, null);
    expect(event.value).toBe(0);
  });

  it('falls back to _id when productId is missing', async () => {
    const items = [{ _id: 'alt-id-001', quantity: 1 }];
    const event = await buildCheckoutEvent(items, 100);
    expect(event.content_ids).toEqual(['alt-id-001']);
  });

  it('defaults quantity to 1 when missing', async () => {
    const items = [{ productId: 'p1' }, { productId: 'p2' }];
    const event = await buildCheckoutEvent(items, 200);
    expect(event.num_items).toBe(2);
  });

  it('sets content_type to product', async () => {
    const event = await buildCheckoutEvent(cartItems, 100);
    expect(event.content_type).toBe('product');
  });
});

// ── buildPurchaseEvent ─────────────────────────────────────────────

describe('buildPurchaseEvent', () => {
  it('returns GA4 payload for a completed order', async () => {
    const event = await buildPurchaseEvent(sampleOrder);
    expect(event.order_id).toBe('order-001');
    expect(event.value).toBe(877.99);
    expect(event.currency).toBe('USD');
    expect(event.content_type).toBe('product');
  });

  it('extracts line item IDs using catalogItemId or sku', async () => {
    const order = {
      _id: 'ord-1',
      lineItems: [
        { catalogItemId: 'cat-001', quantity: 1 },
        { sku: 'SKU-002', quantity: 2 },
      ],
      totals: { total: 500 },
    };
    const event = await buildPurchaseEvent(order);
    expect(event.content_ids).toEqual(['cat-001', 'SKU-002']);
  });

  it('sums item quantities', async () => {
    const event = await buildPurchaseEvent(sampleOrder);
    expect(event.num_items).toBe(2); // 1 + 1
  });

  it('returns empty object for null order', async () => {
    const event = await buildPurchaseEvent(null);
    expect(event).toEqual({});
  });

  it('returns empty object for undefined order', async () => {
    const event = await buildPurchaseEvent(undefined);
    expect(event).toEqual({});
  });

  it('handles order with no lineItems', async () => {
    const event = await buildPurchaseEvent({ _id: 'ord-2', totals: { total: 100 } });
    expect(event.content_ids).toEqual([]);
    expect(event.num_items).toBe(0);
  });

  it('handles order with missing totals', async () => {
    const event = await buildPurchaseEvent({ _id: 'ord-3', lineItems: [] });
    expect(event.value).toBe(0);
  });

  it('defaults quantity to 1 per line item when missing', async () => {
    const order = {
      _id: 'ord-4',
      lineItems: [{ catalogItemId: 'a' }, { catalogItemId: 'b' }, { catalogItemId: 'c' }],
      totals: { total: 300 },
    };
    const event = await buildPurchaseEvent(order);
    expect(event.num_items).toBe(3);
  });
});

// ── buildWishlistEvent ─────────────────────────────────────────────

describe('buildWishlistEvent', () => {
  it('returns GA4 payload for a product', async () => {
    const event = await buildWishlistEvent(futonFrame);
    expect(event.content_name).toBe('Eureka Futon Frame');
    expect(event.content_ids).toEqual(['prod-frame-001']);
    expect(event.content_type).toBe('product');
    expect(event.value).toBe(499);
    expect(event.currency).toBe('USD');
  });

  it('returns empty object for null product', async () => {
    const event = await buildWishlistEvent(null);
    expect(event).toEqual({});
  });

  it('sanitizes product name', async () => {
    const event = await buildWishlistEvent({ _id: 'p1', name: 'Z'.repeat(500), price: 10 });
    expect(event.content_name.length).toBeLessThanOrEqual(200);
  });

  it('handles missing price', async () => {
    const event = await buildWishlistEvent({ _id: 'p1', name: 'No Price' });
    expect(event.value).toBe(0);
  });

  it('handles missing _id', async () => {
    const event = await buildWishlistEvent({ name: 'No ID', price: 50 });
    expect(event.content_ids).toEqual(['']);
  });

  it('does not include content_category (unlike ViewContent)', async () => {
    const event = await buildWishlistEvent(futonFrame);
    expect(event).not.toHaveProperty('content_category');
  });
});
