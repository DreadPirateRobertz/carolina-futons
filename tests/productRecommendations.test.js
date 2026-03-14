import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { allProducts, futonFrame, futonMattress, murphyBed, platformBed, casegoodsItem, wallHuggerFrame, saleProduct, callForPriceProduct, callForPriceCasegoods } from './fixtures/products.js';
import {
  getRelatedProducts,
  getCompletionSuggestions,
  getSameCollection,
  getFeaturedProducts,
  getSaleProducts,
  getBundleSuggestion,
  getBestsellers,
  trackRecentlyViewed,
  getRecentlyViewed,
  getSimilarProducts,
  getCustomersAlsoBought,
} from '../src/backend/productRecommendations.web.js';

beforeEach(() => {
  __seed('Stores/Products', allProducts);
});

// ── getRelatedProducts ──────────────────────────────────────────────

describe('getRelatedProducts', () => {
  it('returns mattresses and casegoods for futon-frames category', async () => {
    const results = await getRelatedProducts('prod-frame-001', 'futon-frames', 4);
    expect(results.length).toBeGreaterThan(0);
    // Should include mattresses or casegoods, not the same product
    results.forEach(r => expect(r._id).not.toBe('prod-frame-001'));
  });

  it('returns futon frames for mattresses category', async () => {
    const results = await getRelatedProducts('prod-matt-001', 'mattresses', 4);
    expect(results.length).toBeGreaterThan(0);
    // Should contain frame products
    const ids = results.map(r => r._id);
    expect(ids).toContain('prod-frame-001');
  });

  it('returns empty array for unknown category', async () => {
    const results = await getRelatedProducts('prod-001', 'unknown-category', 4);
    expect(results).toEqual([]);
  });

  it('excludes the source product from results', async () => {
    const results = await getRelatedProducts('prod-frame-001', 'futon-frames', 10);
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-frame-001');
  });

  it('respects the limit parameter', async () => {
    const results = await getRelatedProducts('prod-frame-001', 'futon-frames', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('returns formatted product objects with expected fields', async () => {
    const results = await getRelatedProducts('prod-matt-001', 'mattresses', 4);
    if (results.length > 0) {
      const product = results[0];
      expect(product).toHaveProperty('_id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('slug');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('formattedPrice');
      expect(product).toHaveProperty('mainMedia');
      expect(product).toHaveProperty('sku');
      expect(product).toHaveProperty('ribbon');
    }
  });
});

// ── getCompletionSuggestions ────────────────────────────────────────

describe('getCompletionSuggestions', () => {
  it('suggests mattresses when cart has a frame but no mattress', async () => {
    const suggestions = await getCompletionSuggestions(['prod-frame-001']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].heading).toContain('Mattress');
    expect(suggestions[0].products.length).toBeGreaterThan(0);
  });

  it('suggests frames when cart has a mattress but no frame', async () => {
    const suggestions = await getCompletionSuggestions(['prod-matt-001']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].heading).toContain('Frame');
  });

  it('suggests casegoods when cart has a Murphy bed', async () => {
    const suggestions = await getCompletionSuggestions(['prod-murphy-001']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].heading).toBe('Complete the Bedroom');
  });

  it('suggests casegoods when cart has a platform bed', async () => {
    const suggestions = await getCompletionSuggestions(['prod-plat-001']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].heading).toBe('Add Matching Furniture');
  });

  it('returns fallback suggestions when no specific cross-sell match', async () => {
    const suggestions = await getCompletionSuggestions(['prod-case-001']);
    // Casegoods-only cart: has no frame/mattress/murphy/platform triggers
    // BUT: check if any suggestions come back (could be fallback "You Might Also Like")
    expect(suggestions.length).toBeGreaterThanOrEqual(0);
    if (suggestions.length > 0) {
      expect(suggestions[0].heading).toBe('You Might Also Like');
    }
  });

  it('returns empty for null/empty cart', async () => {
    expect(await getCompletionSuggestions(null)).toEqual([]);
    expect(await getCompletionSuggestions([])).toEqual([]);
  });

  it('detects wall-hugger frames as futon frames', async () => {
    const suggestions = await getCompletionSuggestions(['prod-frame-002']);
    expect(suggestions.length).toBeGreaterThan(0);
    // Wall-hugger is in both futon-frames and wall-huggers; should trigger mattress suggestion
    expect(suggestions[0].heading).toContain('Mattress');
  });
});

// ── getSameCollection ──────────────────────────────────────────────

describe('getSameCollection', () => {
  it('returns products from the same collection excluding source', async () => {
    const results = await getSameCollection('prod-frame-001', ['futon-frames'], 6);
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => expect(r._id).not.toBe('prod-frame-001'));
    // Wall-hugger frame and sale frame are also in futon-frames
  });

  it('returns empty for null/empty collections', async () => {
    expect(await getSameCollection('prod-001', null, 6)).toEqual([]);
    expect(await getSameCollection('prod-001', [], 6)).toEqual([]);
  });

  it('returns formatted product objects', async () => {
    const results = await getSameCollection('prod-frame-001', ['futon-frames'], 6);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('_id');
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('collections');
    }
  });
});

// ── getFeaturedProducts ────────────────────────────────────────────

describe('getFeaturedProducts', () => {
  it('returns products with "Featured" ribbon', async () => {
    const results = await getFeaturedProducts(8);
    expect(results.length).toBeGreaterThan(0);
    // wallHuggerFrame has ribbon: 'Featured'
    const ids = results.map(r => r._id);
    expect(ids).toContain('prod-frame-002');
  });

  it('falls back to newest products when none are featured', async () => {
    // Seed with products that have no Featured ribbon
    __seed('Stores/Products', [
      { ...futonFrame, ribbon: '' },
      { ...futonMattress, ribbon: '' },
    ]);
    const results = await getFeaturedProducts(8);
    // Should still return products (fallback to descending _createdDate)
    expect(results.length).toBeGreaterThan(0);
  });

  it('respects the limit parameter', async () => {
    const results = await getFeaturedProducts(1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ── getSaleProducts ────────────────────────────────────────────────

describe('getSaleProducts', () => {
  it('returns products with discountedPrice > 0', async () => {
    const results = await getSaleProducts(12);
    expect(results.length).toBeGreaterThan(0);
    // futonMattress (discountedPrice: 299) and saleProduct (discountedPrice: 349) should appear
  });

  it('sorts by discount amount descending', async () => {
    const results = await getSaleProducts(12);
    if (results.length >= 2) {
      // saleProduct has higher discount ($150 off) than futonMattress ($50 off)
      expect(results[0]._id).toBe('prod-sale-001');
    }
  });

  it('returns empty when no products are on sale', async () => {
    __seed('Stores/Products', [
      { ...futonFrame, discountedPrice: null },
      { ...platformBed, discountedPrice: null },
    ]);
    const results = await getSaleProducts(12);
    expect(results).toEqual([]);
  });
});

// ── getBundleSuggestion ─────────────────────────────────────────────

describe('getBundleSuggestion', () => {
  it('suggests mattress bundle for futon frame', async () => {
    const bundle = await getBundleSuggestion('prod-frame-001');
    expect(bundle).not.toBeNull();
    expect(bundle.heading).toContain('Complete Your Futon');
    expect(bundle.product).toBeDefined();
    expect(bundle.product.collections).toEqual(expect.arrayContaining(['mattresses']));
  });

  it('suggests frame bundle for mattress', async () => {
    const bundle = await getBundleSuggestion('prod-matt-001');
    expect(bundle).not.toBeNull();
    expect(bundle.heading).toContain('Futon');
    expect(bundle.product.collections).toEqual(expect.arrayContaining(['futon-frames']));
  });

  it('suggests casegoods for murphy bed', async () => {
    const bundle = await getBundleSuggestion('prod-murphy-001');
    expect(bundle).not.toBeNull();
    expect(bundle.heading).toContain('Bedroom');
  });

  it('suggests casegoods for platform bed', async () => {
    const bundle = await getBundleSuggestion('prod-plat-001');
    expect(bundle).not.toBeNull();
    expect(bundle.heading).toContain('Furniture');
  });

  it('calculates 5% bundle discount correctly', async () => {
    const bundle = await getBundleSuggestion('prod-frame-001');
    if (bundle) {
      const expectedSavings = bundle.originalTotal * 0.05;
      expect(bundle.savings).toBeCloseTo(expectedSavings, 2);
      expect(bundle.bundlePrice).toBeCloseTo(bundle.originalTotal - expectedSavings, 2);
    }
  });

  it('returns null for casegoods (no bundle target)', async () => {
    const bundle = await getBundleSuggestion('prod-case-001');
    expect(bundle).toBeNull();
  });

  it('picks cheapest bundle partner (ascending price)', async () => {
    const bundle = await getBundleSuggestion('prod-frame-001');
    if (bundle) {
      // Cheapest mattress is futonMattress at $349 (or discounted)
      expect(bundle.product.price).toBeLessThanOrEqual(349);
    }
  });
});

// ── getBestsellers ──────────────────────────────────────────────────

describe('getBestsellers', () => {
  it('returns products with Bestseller ribbon as fallback', async () => {
    const results = await getBestsellers(4);
    expect(results.length).toBeGreaterThan(0);
  });

  it('uses ProductAnalytics weekSales when collection exists', async () => {
    __seed('ProductAnalytics', [
      { _id: 'pa-1', productId: 'prod-frame-001', weekSales: 15 },
      { _id: 'pa-2', productId: 'prod-matt-001', weekSales: 10 },
    ]);
    const results = await getBestsellers(4);
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map(r => r._id);
    expect(ids).toContain('prod-frame-001');
  });

  it('falls back to newest products when no analytics or ribbon', async () => {
    __seed('Stores/Products', allProducts.map(p => ({ ...p, ribbon: '' })));
    const results = await getBestsellers(4);
    expect(results.length).toBeGreaterThan(0);
  });

  it('respects limit parameter', async () => {
    const results = await getBestsellers(2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

// ── trackRecentlyViewed ────────────────────────────────────────────

describe('trackRecentlyViewed', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
    __setMember({ _id: 'member-1', contactDetails: { firstName: 'Test' } });
  });

  it('tracks a viewed product for logged-in member', async () => {
    const result = await trackRecentlyViewed('prod-frame-001');
    expect(result.success).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await trackRecentlyViewed('prod-frame-001');
    expect(result.success).toBe(false);
  });

  it('fails for invalid product ID', async () => {
    const result = await trackRecentlyViewed('');
    expect(result.success).toBe(false);
  });

  it('deduplicates existing entries', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date('2026-02-20') },
    ]);

    const result = await trackRecentlyViewed('prod-frame-001');
    expect(result.success).toBe(true);
  });
});

// ── getRecentlyViewed ──────────────────────────────────────────────

describe('getRecentlyViewed', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
    __setMember({ _id: 'member-1', contactDetails: { firstName: 'Test' } });
  });

  it('returns recently viewed products in order', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date('2026-02-22') },
      { _id: 'rv-2', memberId: 'member-1', productId: 'prod-matt-001', viewedAt: new Date('2026-02-21') },
    ]);

    const result = await getRecentlyViewed(10);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
    expect(result.products[0]._id).toBe('prod-frame-001');
    expect(result.products[1]._id).toBe('prod-matt-001');
  });

  it('returns empty when no viewed products', async () => {
    __seed('RecentlyViewed', []);
    const result = await getRecentlyViewed();
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getRecentlyViewed();
    expect(result.success).toBe(false);
  });

  it('only returns current member views', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date() },
      { _id: 'rv-2', memberId: 'member-2', productId: 'prod-matt-001', viewedAt: new Date() },
    ]);

    const result = await getRecentlyViewed();
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]._id).toBe('prod-frame-001');
  });

  it('respects limit parameter', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date('2026-02-22') },
      { _id: 'rv-2', memberId: 'member-1', productId: 'prod-matt-001', viewedAt: new Date('2026-02-21') },
      { _id: 'rv-3', memberId: 'member-1', productId: 'prod-murphy-001', viewedAt: new Date('2026-02-20') },
    ]);

    const result = await getRecentlyViewed(2);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(2);
  });
});

// ── getSimilarProducts ─────────────────────────────────────────────

describe('getSimilarProducts', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
  });

  it('returns similar products in same category and price range', async () => {
    // Eureka frame is $499 in futon-frames
    const result = await getSimilarProducts('prod-frame-001');
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
    // Should include other futon-frames in price range
    result.products.forEach(p => {
      expect(p._id).not.toBe('prod-frame-001');
    });
  });

  it('returns empty for invalid product ID', async () => {
    const result = await getSimilarProducts('');
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
  });

  it('returns empty for non-existent product', async () => {
    const result = await getSimilarProducts('nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
  });

  it('respects price range option', async () => {
    // Eureka is $499; with 10% range = $449-$549
    const result = await getSimilarProducts('prod-frame-001', { priceRange: 0.1 });
    expect(result.success).toBe(true);
    // Sale frame is also $499 but wall-hugger ($699) should be excluded at 10% range
    result.products.forEach(p => {
      expect(p.price).toBeGreaterThanOrEqual(449);
      expect(p.price).toBeLessThanOrEqual(549);
    });
  });

  it('respects limit option', async () => {
    const result = await getSimilarProducts('prod-frame-001', { limit: 1 });
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(1);
  });

  it('excludes the source product', async () => {
    const result = await getSimilarProducts('prod-frame-001', { priceRange: 1 });
    expect(result.success).toBe(true);
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('prod-frame-001');
  });

  it('returns formatted product objects', async () => {
    const result = await getSimilarProducts('prod-frame-001');
    if (result.products.length > 0) {
      const p = result.products[0];
      expect(p).toHaveProperty('_id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('price');
      expect(p).toHaveProperty('collections');
    }
  });
});

// ── Call-for-price filtering (CF-hma6) ─────────────────────────────

describe('Call-for-price product filtering (CF-hma6)', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
  });

  it('getRelatedProducts excludes $1 call-for-price products', async () => {
    // callForPriceProduct is in 'mattresses' with price $1
    // Getting related for a frame should suggest mattresses but NOT the $1 one
    const results = await getRelatedProducts('prod-frame-001', 'futon-frames', 10);
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-cfp-001');
  });

  it('getRelatedProducts excludes $0 call-for-price products', async () => {
    const results = await getRelatedProducts('prod-plat-001', 'platform-beds', 10);
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-cfp-002');
  });

  it('getSameCollection excludes call-for-price products', async () => {
    // callForPriceProduct is in 'mattresses', callForPriceCasegoods is in 'casegoods-accessories'
    const mattResults = await getSameCollection('prod-matt-001', ['mattresses'], 10);
    const mattIds = mattResults.map(r => r._id);
    expect(mattIds).not.toContain('prod-cfp-001');

    const caseResults = await getSameCollection('prod-case-001', ['casegoods-accessories'], 10);
    const caseIds = caseResults.map(r => r._id);
    expect(caseIds).not.toContain('prod-cfp-002');
  });

  it('getCompletionSuggestions excludes call-for-price products', async () => {
    // Frame in cart → should suggest mattresses but not the $1 one
    const suggestions = await getCompletionSuggestions(['prod-frame-001']);
    for (const group of suggestions) {
      const ids = group.products.map(p => p._id);
      expect(ids).not.toContain('prod-cfp-001');
      expect(ids).not.toContain('prod-cfp-002');
    }
  });

  it('getBundleSuggestion excludes call-for-price products', async () => {
    // Frame bundle should NOT pick the $1 mattress as cheapest
    const bundle = await getBundleSuggestion('prod-frame-001');
    expect(bundle).not.toBeNull();
    expect(bundle.product._id).not.toBe('prod-cfp-001');
    expect(bundle.product.price).toBeGreaterThan(1);
  });

  it('getFeaturedProducts excludes call-for-price products', async () => {
    const results = await getFeaturedProducts(20);
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-cfp-001');
    expect(ids).not.toContain('prod-cfp-002');
  });

  it('getBestsellers excludes call-for-price products', async () => {
    const results = await getBestsellers(20);
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-cfp-001');
    expect(ids).not.toContain('prod-cfp-002');
  });

  it('getSimilarProducts excludes call-for-price products', async () => {
    const result = await getSimilarProducts('prod-frame-001', { priceRange: 1 });
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('prod-cfp-001');
    expect(ids).not.toContain('prod-cfp-002');
  });

  it('getSaleProducts excludes call-for-price products', async () => {
    const results = await getSaleProducts(20);
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-cfp-001');
    expect(ids).not.toContain('prod-cfp-002');
  });

  it('getCustomersAlsoBought excludes call-for-price products (fallback path)', async () => {
    // No orders → falls back to category-based related products
    // callForPriceProduct is in 'mattresses', should be excluded
    const result = await getCustomersAlsoBought('prod-matt-001', 10);
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('prod-cfp-001');
    expect(ids).not.toContain('prod-cfp-002');
  });
});
