import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { __seed, __onUpdate } from '../__mocks__/wix-data.js';
import { allProducts, analyticsRecords, futonFrame, futonMattress, sampleOrder } from '../fixtures/products.js';

// ── Gap 1: view_item_list (Category Page) ─────────────────────────────

import {
  buildViewItemListEvent,
} from '../../src/backend/analyticsHelpers.web.js';

import {
  fireViewItemList,
  fireSearch,
  fireViewCart,
  initScrollDepthTracking,
} from '../../src/public/ga4Tracking.js';

describe('buildViewItemListEvent (Gap 1: Category impressions)', () => {
  it('returns GA4 payload with item_list_name', async () => {
    const items = [futonFrame, futonMattress];
    const event = await buildViewItemListEvent(items, 'futon-frames');
    expect(event.item_list_name).toBe('futon-frames');
    expect(event.items).toHaveLength(2);
  });

  it('maps each product to GA4 item format', async () => {
    const items = [futonFrame];
    const event = await buildViewItemListEvent(items, 'mattresses');
    const item = event.items[0];
    expect(item.item_id).toBe('prod-frame-001');
    expect(item.item_name).toBe('Eureka Futon Frame');
    expect(item.price).toBe(499);
    expect(item.item_category).toBe('futon-frames');
    expect(item.index).toBe(0);
  });

  it('includes item index position', async () => {
    const items = [futonFrame, futonMattress];
    const event = await buildViewItemListEvent(items, 'test');
    expect(event.items[0].index).toBe(0);
    expect(event.items[1].index).toBe(1);
  });

  it('returns empty items for null input', async () => {
    const event = await buildViewItemListEvent(null, 'test');
    expect(event.items).toEqual([]);
    expect(event.item_list_name).toBe('test');
  });

  it('returns empty items for empty array', async () => {
    const event = await buildViewItemListEvent([], 'test');
    expect(event.items).toEqual([]);
  });

  it('defaults item_list_name to empty string when not provided', async () => {
    const event = await buildViewItemListEvent([futonFrame], null);
    expect(event.item_list_name).toBe('');
  });

  it('uses first collection as item_category', async () => {
    const event = await buildViewItemListEvent([futonFrame], 'test');
    expect(event.items[0].item_category).toBe('futon-frames');
  });

  it('handles product with no collections', async () => {
    const noCollections = { _id: 'p1', name: 'Test', price: 10 };
    const event = await buildViewItemListEvent([noCollections], 'test');
    expect(event.items[0].item_category).toBe('');
  });

  it('sanitizes product names', async () => {
    const longName = { _id: 'p1', name: 'X'.repeat(500), price: 10 };
    const event = await buildViewItemListEvent([longName], 'test');
    expect(event.items[0].item_name.length).toBeLessThanOrEqual(200);
  });
});

describe('fireViewItemList (Gap 1: GA4 client-side)', () => {
  it('does not throw with valid items and list name', async () => {
    await expect(fireViewItemList([futonFrame], 'futon-frames')).resolves.not.toThrow();
  });

  it('does not throw with empty array', async () => {
    await expect(fireViewItemList([], 'test')).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireViewItemList(null, null)).resolves.not.toThrow();
  });
});

// ── Gap 2: Search tracking ────────────────────────────────────────────

import {
  buildSearchEvent,
} from '../../src/backend/analyticsHelpers.web.js';

describe('buildSearchEvent (Gap 2: Search tracking)', () => {
  it('returns GA4 payload with search_term', async () => {
    const event = await buildSearchEvent('futon frames', 12);
    expect(event.search_term).toBe('futon frames');
    expect(event.results_count).toBe(12);
  });

  it('sanitizes search term', async () => {
    const event = await buildSearchEvent('X'.repeat(500), 0);
    expect(event.search_term.length).toBeLessThanOrEqual(200);
  });

  it('handles null query', async () => {
    const event = await buildSearchEvent(null, 0);
    expect(event.search_term).toBe('');
    expect(event.results_count).toBe(0);
  });

  it('handles zero results', async () => {
    const event = await buildSearchEvent('nonexistent', 0);
    expect(event.results_count).toBe(0);
  });

  it('handles undefined result count', async () => {
    const event = await buildSearchEvent('test', undefined);
    expect(event.results_count).toBe(0);
  });
});

describe('fireSearch (Gap 2: GA4 client-side)', () => {
  it('does not throw with valid query', async () => {
    await expect(fireSearch('futon', 5)).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireSearch(null, null)).resolves.not.toThrow();
  });

  it('does not throw with empty string', async () => {
    await expect(fireSearch('', 0)).resolves.not.toThrow();
  });
});

// ── Gap 3: purchaseCount increment ────────────────────────────────────

import {
  trackPurchase,
} from '../../src/backend/analyticsHelpers.web.js';

describe('trackPurchase (Gap 3: purchaseCount increment)', () => {
  beforeEach(() => {
    __seed('Stores/Products', allProducts);
    __seed('ProductAnalytics', [...analyticsRecords]);
  });

  it('increments purchaseCount for tracked product', async () => {
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackPurchase('prod-frame-001');

    expect(updated).toBeDefined();
    expect(updated.purchaseCount).toBe(13); // was 12
  });

  it('does not insert a new record for untracked product', async () => {
    let inserted = false;
    const { __onInsert } = await import('../__mocks__/wix-data.js');
    __onInsert(() => { inserted = true; });

    await trackPurchase('prod-nonexistent');
    expect(inserted).toBe(false);
  });

  it('does not throw on null productId', async () => {
    await expect(trackPurchase(null)).resolves.not.toThrow();
  });

  it('handles product with zero purchaseCount', async () => {
    __seed('ProductAnalytics', [
      { _id: 'ana-zero', productId: 'prod-zero', purchaseCount: 0, viewCount: 5, addToCartCount: 1 },
    ]);
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackPurchase('prod-zero');
    expect(updated.purchaseCount).toBe(1);
  });

  it('handles product with missing purchaseCount field', async () => {
    __seed('ProductAnalytics', [
      { _id: 'ana-missing', productId: 'prod-missing', viewCount: 5 },
    ]);
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackPurchase('prod-missing');
    expect(updated.purchaseCount).toBe(1);
  });

  it('sanitizes productId', async () => {
    // Should not throw even with very long ID
    await expect(trackPurchase('x'.repeat(200))).resolves.not.toThrow();
  });
});

// ── Gap 4: Cart→Checkout funnel (view_cart event) ─────────────────────

import {
  buildViewCartEvent,
} from '../../src/backend/analyticsHelpers.web.js';

describe('buildViewCartEvent (Gap 4: Cart funnel tracking)', () => {
  const cartItems = [
    { _id: 'prod-frame-001', name: 'Eureka Futon Frame', price: 499, quantity: 1 },
    { _id: 'prod-matt-001', name: 'Moonshadow Mattress', price: 349, quantity: 2 },
  ];

  it('returns GA4 payload with items and value', async () => {
    const event = await buildViewCartEvent(cartItems, 1197);
    expect(event.currency).toBe('USD');
    expect(event.value).toBe(1197);
    expect(event.items).toHaveLength(2);
  });

  it('maps cart items to GA4 format', async () => {
    const event = await buildViewCartEvent(cartItems, 1197);
    const item = event.items[0];
    expect(item.item_id).toBe('prod-frame-001');
    expect(item.item_name).toBe('Eureka Futon Frame');
    expect(item.price).toBe(499);
    expect(item.quantity).toBe(1);
  });

  it('handles null cart items', async () => {
    const event = await buildViewCartEvent(null, 0);
    expect(event.items).toEqual([]);
    expect(event.value).toBe(0);
  });

  it('handles empty cart', async () => {
    const event = await buildViewCartEvent([], 0);
    expect(event.items).toEqual([]);
  });

  it('handles null cart total', async () => {
    const event = await buildViewCartEvent(cartItems, null);
    expect(event.value).toBe(0);
  });

  it('defaults quantity to 1 when missing', async () => {
    const items = [{ _id: 'p1', name: 'Test', price: 100 }];
    const event = await buildViewCartEvent(items, 100);
    expect(event.items[0].quantity).toBe(1);
  });

  it('uses productId fallback for item_id', async () => {
    const items = [{ productId: 'pid-1', name: 'Test', price: 50, quantity: 1 }];
    const event = await buildViewCartEvent(items, 50);
    expect(event.items[0].item_id).toBe('pid-1');
  });

  it('sanitizes item names', async () => {
    const items = [{ _id: 'p1', name: 'Z'.repeat(500), price: 10, quantity: 1 }];
    const event = await buildViewCartEvent(items, 10);
    expect(event.items[0].item_name.length).toBeLessThanOrEqual(200);
  });
});

describe('fireViewCart (Gap 4: GA4 client-side)', () => {
  it('does not throw with valid cart', async () => {
    const items = [{ _id: 'p1', name: 'Test', price: 100, quantity: 1 }];
    await expect(fireViewCart(items, 100)).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireViewCart(null, null)).resolves.not.toThrow();
  });

  it('does not throw with empty array', async () => {
    await expect(fireViewCart([], 0)).resolves.not.toThrow();
  });
});

// ── Gap 5: Scroll depth tracking ──────────────────────────────────────

describe('initScrollDepthTracking (Gap 5: Scroll depth)', () => {
  it('exports initScrollDepthTracking as a function', () => {
    expect(typeof initScrollDepthTracking).toBe('function');
  });

  it('does not throw when called', () => {
    expect(() => initScrollDepthTracking()).not.toThrow();
  });

  it('returns a cleanup function', () => {
    const cleanup = initScrollDepthTracking();
    expect(typeof cleanup).toBe('function');
  });

  it('cleanup does not throw', () => {
    const cleanup = initScrollDepthTracking();
    expect(() => cleanup()).not.toThrow();
  });
});
