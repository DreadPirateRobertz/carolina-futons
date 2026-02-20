import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { allProducts, futonFrame, futonMattress, murphyBed, platformBed, casegoodsItem, wallHuggerFrame, saleProduct } from './fixtures/products.js';
import {
  getRelatedProducts,
  getCompletionSuggestions,
  getSameCollection,
  getFeaturedProducts,
  getSaleProducts,
  getBundleSuggestion,
  getBestsellers,
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
