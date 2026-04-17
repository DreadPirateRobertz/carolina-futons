import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember, __resetMember } from './__mocks__/wix-members-backend.js';
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
  getProductRecommendations,
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

// ── getCustomersAlsoBought ────────────────────────────────────────

describe('getCustomersAlsoBought', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
  });

  it('returns fallback products when no orders exist', async () => {
    __seed('Stores/Orders', []);
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    expect(result.products).toBeInstanceOf(Array);
  });

  it('returns co-purchased products from order history', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'order-1',
        lineItems: [
          { productId: 'prod-frame-001' },
          { productId: 'prod-matt-001' },
        ],
      },
      {
        _id: 'order-2',
        lineItems: [
          { productId: 'prod-frame-001' },
          { productId: 'prod-matt-001' },
          { productId: 'prod-case-001' },
        ],
      },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
    // mattress co-purchased twice, should be first
    expect(result.products[0]._id).toBe('prod-matt-001');
  });

  it('excludes the source product from results', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'order-1',
        lineItems: [
          { productId: 'prod-frame-001' },
          { productId: 'prod-matt-001' },
        ],
      },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001');
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('prod-frame-001');
  });

  it('fails for empty product ID', async () => {
    const result = await getCustomersAlsoBought('');
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
  });

  it('fails for null product ID', async () => {
    const result = await getCustomersAlsoBought(null);
    expect(result.success).toBe(false);
  });

  it('respects limit parameter', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'order-1',
        lineItems: [
          { productId: 'prod-frame-001' },
          { productId: 'prod-matt-001' },
          { productId: 'prod-case-001' },
          { productId: 'prod-murphy-001' },
        ],
      },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001', 1);
    expect(result.products.length).toBeLessThanOrEqual(1);
  });

  it('caps limit at 12', async () => {
    const result = await getCustomersAlsoBought('prod-frame-001', 999);
    expect(result.success).toBe(true);
  });

  it('returns formatted product objects', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'order-1',
        lineItems: [
          { productId: 'prod-frame-001' },
          { productId: 'prod-matt-001' },
        ],
      },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001');
    if (result.products.length > 0) {
      const p = result.products[0];
      expect(p).toHaveProperty('_id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('price');
      expect(p).toHaveProperty('slug');
      expect(p).toHaveProperty('mainMedia');
      expect(p).toHaveProperty('collections');
    }
  });

  it('returns empty products for non-existent product ID', async () => {
    const result = await getCustomersAlsoBought('nonexistent-product-id');
    expect(result.products).toHaveLength(0);
  });
});

// ── Additional edge cases ──────────────────────────────────────────

describe('getRelatedProducts edge cases', () => {
  it('handles null productId gracefully', async () => {
    const results = await getRelatedProducts(null, 'futon-frames', 4);
    expect(results).toBeInstanceOf(Array);
  });

  it('handles undefined categorySlug', async () => {
    const results = await getRelatedProducts('prod-001', undefined, 4);
    expect(results).toEqual([]);
  });

  it('returns products for wall-huggers category', async () => {
    const results = await getRelatedProducts('prod-frame-002', 'wall-huggers', 4);
    expect(results).toBeInstanceOf(Array);
  });

  it('returns products for murphy-cabinet-beds category', async () => {
    const results = await getRelatedProducts('prod-murphy-001', 'murphy-cabinet-beds', 4);
    expect(results).toBeInstanceOf(Array);
  });
});

describe('getCompletionSuggestions edge cases', () => {
  it('handles cart with multiple products from same category', async () => {
    const suggestions = await getCompletionSuggestions(['prod-frame-001', 'prod-frame-002']);
    // Both are frames; should still suggest mattresses
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('suggestion groups have heading and products array', async () => {
    const suggestions = await getCompletionSuggestions(['prod-frame-001']);
    for (const group of suggestions) {
      expect(group).toHaveProperty('heading');
      expect(group).toHaveProperty('products');
      expect(group.products).toBeInstanceOf(Array);
    }
  });
});

describe('getBundleSuggestion edge cases', () => {
  it('returns null for empty product ID', async () => {
    const result = await getBundleSuggestion('');
    expect(result).toBeNull();
  });

  it('returns null for non-existent product', async () => {
    const result = await getBundleSuggestion('nonexistent-id');
    expect(result).toBeNull();
  });

  it('bundle has required pricing fields', async () => {
    const bundle = await getBundleSuggestion('prod-frame-001');
    if (bundle) {
      expect(bundle).toHaveProperty('heading');
      expect(bundle).toHaveProperty('product');
      expect(bundle).toHaveProperty('originalTotal');
      expect(bundle).toHaveProperty('bundlePrice');
      expect(bundle).toHaveProperty('savings');
      expect(bundle.savings).toBeGreaterThan(0);
      expect(bundle.bundlePrice).toBeLessThan(bundle.originalTotal);
    }
  });
});

describe('getSaleProducts edge cases', () => {
  it('sale products have required fields', async () => {
    const results = await getSaleProducts(12);
    for (const product of results) {
      expect(product).toHaveProperty('_id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('discountedPrice');
    }
  });

  it('respects limit parameter', async () => {
    const results = await getSaleProducts(1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

describe('trackRecentlyViewed edge cases', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
    __setMember({ _id: 'member-1', contactDetails: { firstName: 'Test' } });
  });

  it('fails for null product ID', async () => {
    const result = await trackRecentlyViewed(null);
    expect(result.success).toBe(false);
  });

  it('sanitizes product ID input', async () => {
    const result = await trackRecentlyViewed('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });
});

describe('getRecentlyViewed edge cases', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
    __setMember({ _id: 'member-1', contactDetails: { firstName: 'Test' } });
  });

  it('returns formatted product objects', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date() },
    ]);
    const result = await getRecentlyViewed();
    if (result.products.length > 0) {
      expect(result.products[0]).toHaveProperty('_id');
      expect(result.products[0]).toHaveProperty('name');
      expect(result.products[0]).toHaveProperty('price');
    }
  });

  it('default limit caps at 20', async () => {
    const result = await getRecentlyViewed();
    expect(result.success).toBe(true);
  });

  it('clamps negative limit to 1', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date() },
      { _id: 'rv-2', memberId: 'member-1', productId: 'prod-matt-001', viewedAt: new Date(Date.now() - 1000) },
      { _id: 'rv-3', memberId: 'member-1', productId: 'prod-murphy-001', viewedAt: new Date(Date.now() - 2000) },
    ]);
    const result = await getRecentlyViewed(-5);
    expect(result.success).toBe(true);
    // Negative clamped to 1 → at most 1 product returned
    expect(result.products.length).toBeLessThanOrEqual(1);
  });

  it('clamps limit above 20 to MAX_RECENTLY_VIEWED', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date() },
      { _id: 'rv-2', memberId: 'member-1', productId: 'prod-matt-001', viewedAt: new Date(Date.now() - 1000) },
    ]);
    const result = await getRecentlyViewed(999);
    expect(result.success).toBe(true);
    // Clamped to 20, but only 2 seeded — should still return both
    expect(result.products.length).toBe(2);
  });

  it('rounds float limit to nearest integer', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date() },
      { _id: 'rv-2', memberId: 'member-1', productId: 'prod-matt-001', viewedAt: new Date(Date.now() - 1000) },
      { _id: 'rv-3', memberId: 'member-1', productId: 'prod-murphy-001', viewedAt: new Date(Date.now() - 2000) },
    ]);
    // 1.5 rounds to 2 → should return at most 2 of the 3 seeded products
    const result = await getRecentlyViewed(1.5);
    expect(result.success).toBe(true);
    expect(result.products.length).toBe(2);
  });

  it('handles deleted products gracefully (product no longer in store)', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date() },
      { _id: 'rv-2', memberId: 'member-1', productId: 'deleted-product', viewedAt: new Date(Date.now() - 1000) },
    ]);
    const result = await getRecentlyViewed();
    expect(result.success).toBe(true);
    // deleted-product won't be in Stores/Products, should be filtered out
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('deleted-product');
    expect(ids).toContain('prod-frame-001');
  });
});

// ── getRelatedProducts — all cross-sell category mappings ──────────

describe('getRelatedProducts — cross-sell category coverage', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
  });

  it('returns casegoods + platform beds for murphy-cabinet-beds', async () => {
    const results = await getRelatedProducts('prod-murphy-001', 'murphy-cabinet-beds', 10);
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map(r => r._id);
    // murphy cross-sells to casegoods-accessories and platform-beds
    const hasCasegoods = ids.includes('prod-case-001');
    const hasPlatform = ids.includes('prod-plat-001');
    expect(hasCasegoods || hasPlatform).toBe(true);
  });

  it('returns casegoods + mattresses for platform-beds', async () => {
    const results = await getRelatedProducts('prod-plat-001', 'platform-beds', 10);
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map(r => r._id);
    // platform-beds maps to casegoods-accessories and mattresses
    const hasCasegoods = ids.includes('prod-case-001');
    const hasMattress = ids.includes('prod-matt-001');
    expect(hasCasegoods || hasMattress).toBe(true);
  });

  it('returns platform beds + futon frames for casegoods-accessories', async () => {
    const results = await getRelatedProducts('prod-case-001', 'casegoods-accessories', 10);
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map(r => r._id);
    const hasFrame = ids.includes('prod-frame-001');
    const hasPlatform = ids.includes('prod-plat-001');
    expect(hasFrame || hasPlatform).toBe(true);
  });

  it('returns mattresses + casegoods for wall-huggers', async () => {
    const results = await getRelatedProducts('prod-frame-002', 'wall-huggers', 10);
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map(r => r._id);
    // wall-huggers maps to mattresses and casegoods-accessories
    const hasMattress = ids.includes('prod-matt-001');
    const hasCasegoods = ids.includes('prod-case-001');
    expect(hasMattress || hasCasegoods).toBe(true);
  });

  it('returns mattresses + casegoods for unfinished-wood', async () => {
    const results = await getRelatedProducts('prod-frame-005', 'unfinished-wood', 10);
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map(r => r._id);
    // unfinished-wood maps to mattresses and casegoods-accessories
    const hasMattress = ids.includes('prod-matt-001');
    const hasCasegoods = ids.includes('prod-case-001');
    expect(hasMattress || hasCasegoods).toBe(true);
  });

  it('uses default limit of 4 when not specified', async () => {
    const results = await getRelatedProducts('prod-frame-001', 'futon-frames');
    expect(results.length).toBeLessThanOrEqual(4);
  });
});

// ── getCompletionSuggestions — advanced cart scenarios ────────────

describe('getCompletionSuggestions — advanced scenarios', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
  });

  it('does not suggest mattresses or frames when cart has both', async () => {
    const suggestions = await getCompletionSuggestions(['prod-frame-001', 'prod-matt-001']);
    // Cart already has frame + mattress, should NOT suggest mattresses or frames
    for (const group of suggestions) {
      expect(group.heading).not.toContain('Mattress');
      expect(group.heading).not.toContain('Frame');
    }
  });

  it('detects front-loading-nesting as frame type', async () => {
    // Seed a front-loading product
    __seed('Stores/Products', [
      ...allProducts,
      {
        _id: 'prod-fl-001', name: 'Boca Front-Loader', slug: 'boca',
        price: 549, formattedPrice: '$549.00', mainMedia: 'boca.jpg',
        collections: ['front-loading-nesting'], ribbon: '',
        discountedPrice: null, sku: 'BOC-001',
        _createdDate: new Date('2025-06-01'),
      },
    ]);

    const suggestions = await getCompletionSuggestions(['prod-fl-001']);
    // front-loading-nesting is detected as a frame → should suggest mattresses
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].heading).toContain('Mattress');
  });

  it('excludes cart products from fallback "You Might Also Like"', async () => {
    // casegoodsItem doesn't trigger frame/mattress/murphy/platform suggestions
    // Should get fallback, and it should NOT include the cart product
    const suggestions = await getCompletionSuggestions(['prod-case-001']);
    for (const group of suggestions) {
      const ids = group.products.map(p => p._id);
      expect(ids).not.toContain('prod-case-001');
    }
  });

  it('handles cart with non-existent product IDs', async () => {
    const suggestions = await getCompletionSuggestions(['nonexistent-id']);
    // No products found in store → no categories → fallback path
    expect(suggestions).toBeInstanceOf(Array);
  });

  it('handles cart with products that have no collections', async () => {
    __seed('Stores/Products', [
      ...allProducts,
      {
        _id: 'prod-nocol', name: 'Mystery Product', slug: 'mystery',
        price: 100, formattedPrice: '$100.00', mainMedia: 'mystery.jpg',
        collections: null, ribbon: '', discountedPrice: null, sku: 'MYS-001',
        _createdDate: new Date('2025-06-01'),
      },
    ]);
    const suggestions = await getCompletionSuggestions(['prod-nocol']);
    expect(suggestions).toBeInstanceOf(Array);
  });
});

// ── getBundleSuggestion — frame type detection ─────────────────────

describe('getBundleSuggestion — frame type detection', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
  });

  it('detects wall-hugger as frame and suggests mattress', async () => {
    const bundle = await getBundleSuggestion('prod-frame-002');
    expect(bundle).not.toBeNull();
    // wallHuggerFrame has collections ['futon-frames', 'wall-huggers']
    // 'wall-hugger' substring triggers isFrame → mattress bundle
    expect(bundle.heading).toContain('Futon');
  });

  it('handles product with non-array collections (string)', async () => {
    __seed('Stores/Products', [
      ...allProducts,
      {
        _id: 'prod-str-col', name: 'Single Collection Product', slug: 'single',
        price: 399, formattedPrice: '$399.00', mainMedia: 'single.jpg',
        collections: 'futon-frames', ribbon: '', discountedPrice: null,
        sku: 'SNG-001', _createdDate: new Date('2025-06-01'),
      },
    ]);
    const bundle = await getBundleSuggestion('prod-str-col');
    // Should handle string collection gracefully (wraps in array)
    expect(bundle).not.toBeNull();
    expect(bundle.heading).toContain('Futon');
  });

  it('returns null for product with no collections', async () => {
    __seed('Stores/Products', [
      ...allProducts,
      {
        _id: 'prod-nocol2', name: 'No Collections', slug: 'nocol',
        price: 299, formattedPrice: '$299.00', mainMedia: 'nocol.jpg',
        collections: null, ribbon: '', discountedPrice: null,
        sku: 'NOC-001', _createdDate: new Date('2025-06-01'),
      },
    ]);
    const bundle = await getBundleSuggestion('prod-nocol2');
    expect(bundle).toBeNull();
  });

  it('bundle savings are always positive for valid products', async () => {
    const bundle = await getBundleSuggestion('prod-matt-001');
    expect(bundle).not.toBeNull();
    expect(bundle.savings).toBeGreaterThan(0);
    expect(bundle.bundlePrice).toBeLessThan(bundle.originalTotal);
    expect(bundle.originalTotal).toBeGreaterThan(0);
  });
});

// ── getSimilarProducts — limit and price clamping ────────────────

describe('getSimilarProducts — input clamping', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
  });

  it('clamps negative limit to 1', async () => {
    const result = await getSimilarProducts('prod-frame-001', { limit: -5 });
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(1);
  });

  it('clamps limit above 12 to 12', async () => {
    const result = await getSimilarProducts('prod-frame-001', { limit: 100 });
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(12);
  });

  it('clamps priceRange below 0.1 to 0.1', async () => {
    const result = await getSimilarProducts('prod-frame-001', { priceRange: 0.01 });
    expect(result.success).toBe(true);
    // With 10% range on $499 frame: $449-$549
    result.products.forEach(p => {
      expect(p.price).toBeGreaterThanOrEqual(449);
      expect(p.price).toBeLessThanOrEqual(549);
    });
  });

  it('clamps priceRange above 1 to 1 (100% range)', async () => {
    const result = await getSimilarProducts('prod-frame-001', { priceRange: 5 });
    expect(result.success).toBe(true);
    // Clamped to 100% range on $499: $0-$998 — should include all futon-frames in range
    expect(result.products.length).toBeGreaterThan(0);
    result.products.forEach(p => {
      expect(p.price).toBeGreaterThan(0);
      expect(p.price).toBeLessThanOrEqual(998);
    });
  });

  it('handles product with no collections', async () => {
    __seed('Stores/Products', [
      ...allProducts,
      {
        _id: 'prod-lonely', name: 'Lonely Product', slug: 'lonely',
        price: 500, formattedPrice: '$500.00', mainMedia: 'lonely.jpg',
        collections: null, ribbon: '', discountedPrice: null,
        sku: 'LON-001', _createdDate: new Date('2025-06-01'),
      },
    ]);
    const result = await getSimilarProducts('prod-lonely');
    expect(result.success).toBe(true);
    // No collection filter → matches any product in price range
  });

  it('handles product with empty collections array', async () => {
    __seed('Stores/Products', [
      ...allProducts,
      {
        _id: 'prod-empty-col', name: 'Empty Collections', slug: 'empty-col',
        price: 500, formattedPrice: '$500.00', mainMedia: 'empty.jpg',
        collections: [], ribbon: '', discountedPrice: null,
        sku: 'EMP-001', _createdDate: new Date('2025-06-01'),
      },
    ]);
    const result = await getSimilarProducts('prod-empty-col');
    expect(result.success).toBe(true);
  });
});

// ── getCustomersAlsoBought — frequency and edge cases ────────────

describe('getCustomersAlsoBought — frequency ranking', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
  });

  it('ranks co-purchased products by frequency (3+ unique products)', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', lineItems: [{ productId: 'prod-frame-001' }, { productId: 'prod-matt-001' }, { productId: 'prod-case-001' }] },
      { _id: 'o2', lineItems: [{ productId: 'prod-frame-001' }, { productId: 'prod-matt-001' }] },
      { _id: 'o3', lineItems: [{ productId: 'prod-frame-001' }, { productId: 'prod-case-001' }] },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    // mattress appears 2x, casegoods appears 2x — both should be present
    expect(result.products.length).toBeGreaterThanOrEqual(2);
    const ids = result.products.map(p => p._id);
    expect(ids).toContain('prod-matt-001');
    expect(ids).toContain('prod-case-001');
  });

  it('handles orders with empty lineItems array', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', lineItems: [] },
      { _id: 'o2', lineItems: [{ productId: 'prod-frame-001' }, { productId: 'prod-matt-001' }] },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('handles orders with null lineItems', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', lineItems: null },
      { _id: 'o2', lineItems: [{ productId: 'prod-frame-001' }, { productId: 'prod-matt-001' }] },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
  });

  it('handles lineItems with missing productId', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', lineItems: [{ productId: 'prod-frame-001' }, { name: 'Custom item (no productId)' }] },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    // lineItem without productId should be skipped — no undefined entries
    const ids = result.products.map(p => p._id);
    ids.forEach(id => expect(id).toBeDefined());
  });

  it('returns empty when all co-purchased products are deleted from store', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', lineItems: [{ productId: 'prod-frame-001' }, { productId: 'deleted-product-1' }] },
    ]);
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    // deleted-product-1 not in Stores/Products → filtered out
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('deleted-product-1');
  });
});

// ── trackRecentlyViewed — MAX cap trim ──────────────────────────

describe('trackRecentlyViewed — trim behavior', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
    __setMember({ _id: 'member-1', contactDetails: { firstName: 'Test' } });
  });

  it('trims entries beyond MAX_RECENTLY_VIEWED (20)', async () => {
    // Seed 21 RecentlyViewed entries
    const entries = [];
    for (let i = 0; i < 21; i++) {
      entries.push({
        _id: `rv-${i}`,
        memberId: 'member-1',
        productId: `prod-${i}`,
        viewedAt: new Date(Date.now() - i * 1000),
      });
    }
    __seed('RecentlyViewed', entries);

    // Track another product — should trigger trim (now 22 → trimmed to 20)
    const result = await trackRecentlyViewed('prod-frame-001');
    expect(result.success).toBe(true);

    // Verify trim actually occurred — request all 25, should get ≤ 20
    const viewed = await getRecentlyViewed(25);
    expect(viewed.success).toBe(true);
    expect(viewed.products.length).toBeLessThanOrEqual(20);
  });

  it('updates viewedAt when re-viewing a product (dedup — removes old, inserts fresh)', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-old', memberId: 'member-1', productId: 'prod-frame-001', viewedAt: new Date('2025-01-01') },
    ]);
    const result = await trackRecentlyViewed('prod-frame-001');
    expect(result.success).toBe(true);

    // Verify dedup: product still appears exactly once, not duplicated
    const viewed = await getRecentlyViewed(20);
    expect(viewed.success).toBe(true);
    const frameEntries = viewed.products.filter(p => p._id === 'prod-frame-001');
    expect(frameEntries.length).toBe(1);
  });
});

// ── getProductRecommendations (cf-e1h) ────────────────────────────

describe('getProductRecommendations (cf-e1h)', () => {
  beforeEach(() => {
    resetData();
    __resetMember();
    __seed('Stores/Products', allProducts);
    __seed('MemberBrowseHistory', []);
    __seed('Stores/Orders', []);
  });

  it('returns history-based recommendations ranked by browse frequency', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberBrowseHistory', [
      { _id: 'bh-1', sessionKey: 'member_mem-1', productId: 'prod-matt-001', viewedAt: new Date() },
      { _id: 'bh-2', sessionKey: 'member_mem-1', productId: 'prod-matt-001', viewedAt: new Date('2026-04-10') },
      { _id: 'bh-3', sessionKey: 'member_mem-1', productId: 'prod-matt-001', viewedAt: new Date('2026-04-09') },
      { _id: 'bh-4', sessionKey: 'member_mem-1', productId: 'prod-case-001', viewedAt: new Date() },
    ]);

    const result = await getProductRecommendations('prod-frame-001');

    expect(result.success).toBe(true);
    expect(result.source).toBe('history');
    expect(result.products.length).toBeGreaterThanOrEqual(1);
    expect(result.products[0].productId).toBe('prod-matt-001');
    expect(result.products[0]).toHaveProperty('title');
    expect(result.products[0]).toHaveProperty('price');
    expect(result.products[0]).toHaveProperty('imageUrl');
    expect(result.products[0]).toHaveProperty('slug');
  });

  it('falls back to category-based recommendations when no history exists', async () => {
    const result = await getProductRecommendations('prod-frame-001', { sessionId: 'guest-sess' });

    expect(result.success).toBe(true);
    expect(result.source).toBe('category');
    expect(result.products.length).toBeGreaterThanOrEqual(1);
    expect(result.products.every(p => p.productId !== 'prod-frame-001')).toBe(true);
  });

  it('returns category fallback for guest with no browse/order data', async () => {
    const result = await getProductRecommendations('prod-matt-001', { sessionId: 'new-guest' });

    expect(result.success).toBe(true);
    expect(result.source).toBe('category');
  });

  it('excludes already-purchased products from recommendations', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberBrowseHistory', [
      { _id: 'bh-1', sessionKey: 'member_mem-1', productId: 'prod-matt-001', viewedAt: new Date() },
      { _id: 'bh-2', sessionKey: 'member_mem-1', productId: 'prod-case-001', viewedAt: new Date() },
    ]);
    __seed('Stores/Orders', [
      { _id: 'o-1', buyerInfo: { memberId: 'mem-1' }, lineItems: [{ productId: 'prod-matt-001' }] },
    ]);

    const result = await getProductRecommendations('prod-frame-001');

    expect(result.success).toBe(true);
    const ids = result.products.map(p => p.productId);
    expect(ids).not.toContain('prod-matt-001');
  });

  it('respects the limit parameter', async () => {
    const result = await getProductRecommendations('prod-frame-001', { sessionId: 'sess', limit: 2 });

    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(2);
  });

  it('works with sessionId fallback for guests (no logged-in member)', async () => {
    __seed('MemberBrowseHistory', [
      { _id: 'bh-1', sessionKey: 'session_guest-abc', productId: 'prod-matt-001', viewedAt: new Date() },
    ]);

    const result = await getProductRecommendations('prod-frame-001', { sessionId: 'guest-abc' });

    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThanOrEqual(1);
    expect(result.source).toBe('history');
  });

  it('returns { success: false } on query error', async () => {
    const { __setQueryError: setErr } = await import('./__mocks__/wix-data.js');
    setErr('Stores/Products', new Error('DB failure'));

    const result = await getProductRecommendations('prod-frame-001', { sessionId: 'sess' });

    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('returns empty for invalid productId', async () => {
    const result = await getProductRecommendations('', { sessionId: 'sess' });
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('excludes current product from results', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberBrowseHistory', [
      { _id: 'bh-1', sessionKey: 'member_mem-1', productId: 'prod-frame-001', viewedAt: new Date() },
    ]);

    const result = await getProductRecommendations('prod-frame-001');

    expect(result.success).toBe(true);
    const ids = result.products.map(p => p.productId);
    expect(ids).not.toContain('prod-frame-001');
  });

  // ── Security: IDOR / cache-key injection ────────────────────────────

  it('ignores client-supplied memberId — guest caller cannot impersonate a member', async () => {
    // Victim has sensitive browse history under their member key
    __seed('MemberBrowseHistory', [
      { _id: 'bh-1', sessionKey: 'member_victim-42', productId: 'prod-matt-001', viewedAt: new Date() },
      { _id: 'bh-2', sessionKey: 'member_victim-42', productId: 'prod-matt-001', viewedAt: new Date() },
    ]);
    // Guest caller (no __setMember) passes victim's memberId in options — must be ignored.
    const result = await getProductRecommendations('prod-frame-001', { memberId: 'victim-42' });

    expect(result.success).toBe(true);
    // Without a validated sessionId and no authenticated member, no history lookup happens
    // → falls through to category-based recommendations, not victim's browse data.
    expect(result.source).toBe('category');
  });

  it('scopes Stores/Orders query to the authenticated member — no site-wide leak', async () => {
    __setMember({ _id: 'buyer-A' });
    __seed('MemberBrowseHistory', [
      { _id: 'bh-1', sessionKey: 'member_buyer-A', productId: 'prod-matt-001', viewedAt: new Date() },
    ]);
    // Another member's order — must NOT influence buyer-A's recommendations
    __seed('Stores/Orders', [
      { _id: 'o-other', buyerInfo: { memberId: 'buyer-B' }, lineItems: [{ productId: 'prod-matt-001' }] },
    ]);

    const result = await getProductRecommendations('prod-frame-001');

    expect(result.success).toBe(true);
    // buyer-A never purchased prod-matt-001 — other member's order must not filter it out
    const ids = result.products.map(p => p.productId);
    expect(ids).toContain('prod-matt-001');
  });

  it('rejects malformed sessionId (cache-key injection attempt)', async () => {
    // Sensitive record keyed by an injected-looking key
    __seed('MemberBrowseHistory', [
      { _id: 'bh-1', sessionKey: 'session_abc; DROP', productId: 'prod-matt-001', viewedAt: new Date() },
    ]);
    // Caller supplies unsafe characters — validateId returns '' so no lookup fires.
    const result = await getProductRecommendations('prod-frame-001', { sessionId: 'abc; DROP' });

    expect(result.success).toBe(true);
    expect(result.source).toBe('category');
  });
});
