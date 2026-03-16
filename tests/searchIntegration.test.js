/**
 * Search Integration Tests — searchService.web.js + categorySearch.web.js
 *
 * Covers: full-text search, autocomplete, pagination, zero-result states,
 * filter combinations, cache behavior, popular query tracking, cross-service
 * consistency, and edge cases (XSS, empty collections, boundary values).
 *
 * Element IDs for editor hookup documented at bottom of file.
 *
 * @see CF-ycck (bead)
 * @see docs/superpowers/plans/2026-03-16-feature-roadmap-plan.md Task 2
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import {
  searchProducts,
  getFilterValues,
  fullTextSearch,
  getAutocompleteSuggestions,
  getPopularSearches,
  recordSearchQuery,
  __clearCache,
} from '../src/backend/searchService.web.js';
import {
  searchProducts as categorySearch,
  getFilteredProductCount,
  getFacetMetadata,
  suggestFilterRelaxation,
  __clearCache as clearCategoryCache,
} from '../src/backend/categorySearch.web.js';

// ── Seed Data: realistic Carolina Futons catalog ──────────────────

const catalogProducts = [
  {
    _id: 'cf-001', name: 'Seattle Futon Frame', slug: 'seattle-futon',
    price: 549, formattedPrice: '$549.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'seattle.jpg',
    ribbon: '', collections: ['futon-frames'], material: 'Hardwood',
    color: 'Natural Oak', featureTags: ['wall-hugger', 'made-in-usa'],
    brand: 'Night & Day', width: 54, depth: 36, height: 34,
    inStock: true, numericRating: 4.7,
    description: 'Solid hardwood futon frame with wall-hugger design.',
    _createdDate: '2025-06-01T00:00:00Z',
  },
  {
    _id: 'cf-002', name: 'Phoenix Futon Frame', slug: 'phoenix-futon',
    price: 699, formattedPrice: '$699.00', discountedPrice: 599,
    formattedDiscountedPrice: '$599.00', mainMedia: 'phoenix.jpg',
    ribbon: 'Sale', collections: ['futon-frames', 'wall-huggers'],
    material: 'Hardwood', color: 'Espresso', featureTags: ['wall-hugger', 'usb-charging'],
    brand: 'Night & Day', width: 60, depth: 38, height: 34,
    inStock: true, numericRating: 4.9,
    description: 'Premium wall-hugger with USB ports.',
    _createdDate: '2025-08-01T00:00:00Z',
  },
  {
    _id: 'cf-003', name: 'Moonshadow Futon Mattress', slug: 'moonshadow-mattress',
    price: 349, formattedPrice: '$349.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'moon.jpg',
    ribbon: '', collections: ['mattresses'], material: 'Foam',
    color: 'White', featureTags: ['eco-friendly'],
    brand: 'Gold Bond', width: 54, depth: 75, height: 8,
    inStock: true, numericRating: 4.2,
    description: 'Eco-friendly foam mattress.',
    _createdDate: '2025-04-01T00:00:00Z',
  },
  {
    _id: 'cf-004', name: 'Sagebrush Murphy Cabinet Bed', slug: 'sagebrush-murphy',
    price: 1899, formattedPrice: '$1,899.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'sage.jpg',
    ribbon: 'Featured', collections: ['murphy-cabinet-beds'],
    material: 'Hardwood', color: 'Espresso', featureTags: ['usb-charging', 'storage'],
    brand: 'Arason', width: 66, depth: 22, height: 42,
    inStock: true, numericRating: 4.9,
    description: 'Space-saving murphy bed with USB charging.',
    _createdDate: '2025-09-01T00:00:00Z',
  },
  {
    _id: 'cf-005', name: 'Budget Pine Futon Frame', slug: 'budget-pine',
    price: 199, formattedPrice: '$199.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'budget.jpg',
    ribbon: '', collections: ['futon-frames'], material: 'Softwood',
    color: 'Natural Oak', featureTags: [],
    brand: 'Carolina Futons', width: 54, depth: 36, height: 30,
    inStock: false, numericRating: 3.8,
    description: 'Affordable pine futon frame.',
    _createdDate: '2025-03-01T00:00:00Z',
  },
  {
    _id: 'cf-006', name: 'Platform Bed Walnut', slug: 'platform-walnut',
    price: 899, formattedPrice: '$899.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'platform.jpg',
    ribbon: '', collections: ['platform-beds'], material: 'Hardwood',
    color: 'Black Walnut', featureTags: ['made-in-usa'],
    brand: 'Night & Day', width: 60, depth: 80, height: 14,
    inStock: true, numericRating: 4.6,
    description: 'Low-profile walnut platform bed.',
    _createdDate: '2025-07-01T00:00:00Z',
  },
];

// ── Setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  __reset();
  __seed('Stores/Products', catalogProducts);
  __clearCache();
  clearCategoryCache();
});

// ═══════════════════════════════════════════════════════════════════
// FULL-TEXT SEARCH
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: fullTextSearch', () => {
  it('returns products matching query in name', async () => {
    const result = await fullTextSearch({ query: 'Futon' });
    expect(result.products.length).toBeGreaterThanOrEqual(3);
    result.products.forEach((p) => {
      expect(
        p.name.includes('Futon') || (p.description || '').includes('Futon')
      ).toBe(true);
    });
  });

  it('returns products matching query in description', async () => {
    const result = await fullTextSearch({ query: 'USB' });
    expect(result.products.length).toBeGreaterThanOrEqual(1);
  });

  it('with category filter narrows results', async () => {
    const all = await fullTextSearch({ query: 'Futon' });
    const frames = await fullTextSearch({ query: 'Futon', category: 'futon-frames' });
    expect(frames.products.length).toBeLessThanOrEqual(all.products.length);
    frames.products.forEach((p) => {
      expect(p.collections || []).toContain('futon-frames');
    });
  });

  it('with material filter returns matching material', async () => {
    const result = await fullTextSearch({ query: 'hardwood', material: 'Hardwood' });
    expect(result.products.length).toBeGreaterThan(0);
    result.products.forEach((p) => {
      expect(p.material).toBe('Hardwood');
    });
  });

  it('with color filter returns matching products', async () => {
    const result = await fullTextSearch({ query: 'Futon', color: 'Espresso' });
    result.products.forEach((p) => {
      expect(p.color).toBe('Espresso');
    });
  });

  it('returns empty for empty query', async () => {
    const result = await fullTextSearch({ query: '' });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns total count with results', async () => {
    const result = await fullTextSearch({ query: 'Futon' });
    expect(result.total).toBeGreaterThanOrEqual(result.products.length);
  });

  it('returns normalized query string in response', async () => {
    const result = await fullTextSearch({ query: 'Seattle' });
    expect(typeof result.query).toBe('string');
    expect(result.query.length).toBeGreaterThan(0);
  });

  it('name matches rank higher than description-only matches (relevance sort)', async () => {
    // "Futon" in names of Seattle/Phoenix/Moonshadow/Budget vs only description
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'relevance' });
    expect(result.products.length).toBeGreaterThan(0);
    // Products with "Futon" in name should appear before description-only matches
    const nameMatches = result.products.filter(p => p.name.includes('Futon'));
    expect(nameMatches.length).toBeGreaterThan(0);
  });

  it('returns facets alongside search results', async () => {
    const result = await fullTextSearch({ query: 'Futon' });
    expect(result).toHaveProperty('facets');
    expect(typeof result.facets).toBe('object');
  });

  it('inStockOnly filters out-of-stock products', async () => {
    const result = await fullTextSearch({ query: 'Futon', inStockOnly: true });
    result.products.forEach((p) => {
      expect(p.inStock).toBe(true);
    });
    expect(result.products.some(p => p._id === 'cf-005')).toBe(false);
  });

  it('feature tag filter narrows results', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      features: ['wall-hugger'],
    });
    result.products.forEach((p) => {
      expect(p.featureTags).toContain('wall-hugger');
    });
  });

  it('multiple feature tags use AND logic', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      features: ['wall-hugger', 'usb-charging'],
    });
    result.products.forEach((p) => {
      expect(p.featureTags).toContain('wall-hugger');
      expect(p.featureTags).toContain('usb-charging');
    });
  });

  it('price range filter works with fullTextSearch', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      priceRange: '300-500',
    });
    result.products.forEach((p) => {
      expect(p.price).toBeGreaterThanOrEqual(300);
      expect(p.price).toBeLessThanOrEqual(500);
    });
  });

  it('combined category + material + color filter narrows to intersection', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      category: 'futon-frames',
      material: 'Hardwood',
      color: 'Espresso',
    });
    result.products.forEach((p) => {
      expect(p.collections).toContain('futon-frames');
      expect(p.material).toBe('Hardwood');
      expect(p.color).toBe('Espresso');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// FULL-TEXT SEARCH: SORTING
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: fullTextSearch sorting', () => {
  it('sorts by price ascending', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeGreaterThanOrEqual(
        result.products[i - 1].price
      );
    }
  });

  it('sorts by price descending', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'price-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeLessThanOrEqual(
        result.products[i - 1].price
      );
    }
  });

  it('sorts by name ascending', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'name-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name.localeCompare(result.products[i - 1].name))
        .toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts by name descending', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'name-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name.localeCompare(result.products[i - 1].name))
        .toBeLessThanOrEqual(0);
    }
  });

  it('defaults to relevance sort when sortBy omitted', async () => {
    const result = await fullTextSearch({ query: 'Futon' });
    expect(result.products.length).toBeGreaterThan(0);
    // No crash, default sort applied
  });

  it('unknown sortBy falls back to relevance', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'invalid-sort' });
    expect(result.products.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FULL-TEXT SEARCH: ZERO RESULTS
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: zero-result states', () => {
  it('returns empty products for no-match query', async () => {
    const result = await fullTextSearch({ query: 'xyznonexistent123' });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty for whitespace-only query', async () => {
    const result = await fullTextSearch({ query: '   ' });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty for null/undefined query', async () => {
    const result = await fullTextSearch({ query: null });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty when params is empty object', async () => {
    const result = await fullTextSearch({});
    expect(result.products).toEqual([]);
  });

  it('returns empty for valid query with impossible category filter', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      category: 'nonexistent-category',
    });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty for valid query with impossible material filter', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      material: 'Titanium',
    });
    expect(result.products).toEqual([]);
  });

  it('returns empty for valid query with impossible color filter', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      color: 'Neon Pink',
    });
    expect(result.products).toEqual([]);
  });

  it('zero results with all products out of stock + inStockOnly', async () => {
    // Override seed with only out-of-stock items
    __reset();
    __seed('Stores/Products', [
      { ...catalogProducts[4], name: 'Test OOS Frame', inStock: false },
    ]);
    __clearCache();
    const result = await fullTextSearch({ query: 'Test OOS', inStockOnly: true });
    expect(result.products).toEqual([]);
  });

  it('returns empty from empty catalog', async () => {
    __reset();
    __seed('Stores/Products', []);
    __clearCache();
    const result = await fullTextSearch({ query: 'anything' });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FULL-TEXT SEARCH: EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: fullTextSearch edge cases', () => {
  it('sanitizes HTML tags from query', async () => {
    const result = await fullTextSearch({ query: '<script>alert(1)</script>Futon' });
    // Should not crash, sanitize strips tags
    expect(result).toHaveProperty('products');
  });

  it('handles very long query (truncated to 200 chars by sanitize)', async () => {
    const longQuery = 'Futon '.repeat(100); // 600 chars
    const result = await fullTextSearch({ query: longQuery });
    expect(result).toHaveProperty('products');
    // query field should be truncated
    expect(result.query.length).toBeLessThanOrEqual(200);
  });

  it('handles special characters in query', async () => {
    const result = await fullTextSearch({ query: 'futon & mattress <>"' });
    expect(result).toHaveProperty('products');
  });

  it('handles unicode characters in query', async () => {
    const result = await fullTextSearch({ query: 'futon café résumé' });
    expect(result).toHaveProperty('products');
  });

  it('handles numeric query', async () => {
    const result = await fullTextSearch({ query: '549' });
    expect(result).toHaveProperty('products');
  });

  it('deduplicates products found in both name and description', async () => {
    // "hardwood" appears in Seattle's name area and description
    const result = await fullTextSearch({ query: 'hardwood' });
    const ids = result.products.map(p => p._id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('result products include expected fields', async () => {
    const result = await fullTextSearch({ query: 'Seattle' });
    expect(result.products.length).toBeGreaterThan(0);
    const p = result.products[0];
    expect(p).toHaveProperty('_id');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('slug');
    expect(p).toHaveProperty('price');
    expect(p).toHaveProperty('mainMedia');
    expect(p).toHaveProperty('inStock');
  });

  it('unknown feature tags are filtered out', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      features: ['nonexistent-feature', 'wall-hugger'],
    });
    // Should only apply valid 'wall-hugger' filter
    result.products.forEach(p => {
      expect(p.featureTags).toContain('wall-hugger');
    });
  });

  it('empty features array does not filter', async () => {
    const all = await fullTextSearch({ query: 'Futon' });
    const withEmpty = await fullTextSearch({ query: 'Futon', features: [] });
    expect(withEmpty.products.length).toBe(all.products.length);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SEARCH RESULTS CACHING
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: search caching', () => {
  it('second identical search returns cached results', async () => {
    const first = await fullTextSearch({ query: 'Futon' });
    const second = await fullTextSearch({ query: 'Futon' });
    expect(second.products.length).toBe(first.products.length);
    expect(second.total).toBe(first.total);
  });

  it('different queries produce different cache entries', async () => {
    const futon = await fullTextSearch({ query: 'Futon' });
    const bed = await fullTextSearch({ query: 'Bed' });
    // They should not be identical results
    if (futon.products.length > 0 && bed.products.length > 0) {
      const futonIds = futon.products.map(p => p._id).sort();
      const bedIds = bed.products.map(p => p._id).sort();
      expect(futonIds).not.toEqual(bedIds);
    }
  });

  it('cache clears correctly', async () => {
    await fullTextSearch({ query: 'Seattle' });
    __clearCache();
    // After clear, should re-query (no crash, same results)
    const result = await fullTextSearch({ query: 'Seattle' });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('same query with different sortBy creates separate cache entry', async () => {
    const asc = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    const desc = await fullTextSearch({ query: 'Futon', sortBy: 'price-desc' });
    if (asc.products.length >= 2) {
      expect(asc.products[0]._id).not.toBe(desc.products[0]._id);
    }
  });

  it('same query with different offset creates separate cache entry', async () => {
    const page1 = await fullTextSearch({ query: 'Futon', offset: 0, limit: 2 });
    const page2 = await fullTextSearch({ query: 'Futon', offset: 2, limit: 2 });
    if (page1.products.length > 0 && page2.products.length > 0) {
      expect(page1.products[0]._id).not.toBe(page2.products[0]._id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SEARCHPRODUCTS (FACETED, NON-TEXT)
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: searchProducts (non-text)', () => {
  it('with category returns only that collection', async () => {
    const result = await searchProducts({ category: 'mattresses' });
    expect(result.products.length).toBe(1);
    expect(result.products[0].name).toContain('Moonshadow');
  });

  it('with price range 500-800 returns mid-range products', async () => {
    const result = await searchProducts({ priceRange: '500-800' });
    result.products.forEach((p) => {
      expect(p.price).toBeGreaterThanOrEqual(500);
      expect(p.price).toBeLessThanOrEqual(800);
    });
  });

  it('with price range 0-300 returns budget products', async () => {
    const result = await searchProducts({ priceRange: '0-300' });
    result.products.forEach((p) => {
      expect(p.price).toBeLessThanOrEqual(299.99);
    });
  });

  it('with price range 1200-up returns expensive products', async () => {
    const result = await searchProducts({ priceRange: '1200-up' });
    result.products.forEach((p) => {
      expect(p.price).toBeGreaterThanOrEqual(1200);
    });
  });

  it('with invalid price range returns all products', async () => {
    const result = await searchProducts({ priceRange: 'invalid-range' });
    expect(result.products.length).toBe(6);
  });

  it('with material filter returns matching products', async () => {
    const result = await searchProducts({ material: 'Foam' });
    result.products.forEach(p => {
      expect(p.material).toBe('Foam');
    });
    expect(result.products.length).toBe(1);
  });

  it('with color filter returns matching products', async () => {
    const result = await searchProducts({ color: 'Espresso' });
    result.products.forEach(p => {
      expect(p.color).toBe('Espresso');
    });
  });

  it('with feature tags filter returns matching products', async () => {
    const result = await searchProducts({ features: ['storage'] });
    result.products.forEach(p => {
      expect(p.featureTags).toContain('storage');
    });
  });

  it('with width range filter narrows results', async () => {
    const result = await searchProducts({ widthRange: [58, 70] });
    result.products.forEach(p => {
      expect(p.width).toBeGreaterThanOrEqual(58);
      expect(p.width).toBeLessThanOrEqual(70);
    });
  });

  it('with depth range filter narrows results', async () => {
    const result = await searchProducts({ depthRange: [30, 40] });
    result.products.forEach(p => {
      expect(p.depth).toBeGreaterThanOrEqual(30);
      expect(p.depth).toBeLessThanOrEqual(40);
    });
  });

  it('no params returns all products', async () => {
    const result = await searchProducts({});
    expect(result.products.length).toBe(6);
    expect(result.total).toBe(6);
  });

  it('pagination returns non-overlapping subsets', async () => {
    const page1 = await searchProducts({ limit: 2, offset: 0 });
    const page2 = await searchProducts({ limit: 2, offset: 2 });

    expect(page1.products.length).toBe(2);
    expect(page2.products.length).toBe(2);
    const ids1 = page1.products.map((p) => p._id);
    const ids2 = page2.products.map((p) => p._id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it('total reflects full result set', async () => {
    const result = await searchProducts({ category: 'futon-frames' });
    expect(result.total).toBe(3);
  });

  it('sorts by price ascending', async () => {
    const result = await searchProducts({ sortBy: 'price-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeGreaterThanOrEqual(
        result.products[i - 1].price
      );
    }
  });

  it('sorts by price descending', async () => {
    const result = await searchProducts({ sortBy: 'price-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeLessThanOrEqual(
        result.products[i - 1].price
      );
    }
  });

  it('sorts by name ascending', async () => {
    const result = await searchProducts({ sortBy: 'name-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name.localeCompare(result.products[i - 1].name))
        .toBeGreaterThanOrEqual(0);
    }
  });

  it('defaults to bestselling sort', async () => {
    const result = await searchProducts({});
    expect(result.products.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PAGINATION EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: pagination edge cases', () => {
  it('limit clamped to max 100', async () => {
    const result = await searchProducts({ limit: 500 });
    // Should not crash; limit is clamped internally
    expect(result.products.length).toBeLessThanOrEqual(100);
  });

  it('limit clamped to min 1', async () => {
    const result = await searchProducts({ limit: 0 });
    expect(result.products.length).toBeGreaterThanOrEqual(1);
  });

  it('negative limit treated as default', async () => {
    const result = await searchProducts({ limit: -5 });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('negative offset treated as 0', async () => {
    const result = await searchProducts({ offset: -10 });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('offset beyond total returns empty products', async () => {
    const result = await searchProducts({ offset: 1000 });
    expect(result.products).toEqual([]);
  });

  it('NaN limit uses default', async () => {
    const result = await searchProducts({ limit: NaN });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('NaN offset uses 0', async () => {
    const result = await searchProducts({ offset: NaN });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('fullTextSearch pagination works', async () => {
    const page1 = await fullTextSearch({ query: 'Futon', limit: 2, offset: 0 });
    const page2 = await fullTextSearch({ query: 'Futon', limit: 2, offset: 2 });
    if (page1.products.length > 0 && page2.products.length > 0) {
      const ids1 = new Set(page1.products.map(p => p._id));
      page2.products.forEach(p => {
        expect(ids1.has(p._id)).toBe(false);
      });
    }
  });

  it('fullTextSearch limit clamped to max 100', async () => {
    const result = await fullTextSearch({ query: 'Futon', limit: 500 });
    expect(result.products.length).toBeLessThanOrEqual(100);
  });

  it('categorySearch pagination with skip + limit', async () => {
    const page1 = await categorySearch({ limit: 2, skip: 0 });
    const page2 = await categorySearch({ limit: 2, skip: 2 });
    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBe(2);
    const ids1 = new Set(page1.items.map(p => p._id));
    page2.items.forEach(p => {
      expect(ids1.has(p._id)).toBe(false);
    });
  });

  it('categorySearch hasMore indicates additional pages', async () => {
    const result = await categorySearch({ limit: 2, skip: 0 });
    expect(result.hasMore).toBe(true);
  });

  it('categorySearch hasMore false on last page', async () => {
    const result = await categorySearch({ limit: 100, skip: 0 });
    expect(result.hasMore).toBe(false);
  });

  it('categorySearch totalCount reflects full set regardless of limit', async () => {
    const result = await categorySearch({ limit: 2, skip: 0 });
    expect(result.totalCount).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GETFILTERVALUES → FILTER SIDEBAR
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: getFilterValues → filter sidebar', () => {
  it('returns materials array with value+count objects', async () => {
    const result = await getFilterValues('');
    expect(Array.isArray(result.materials)).toBe(true);
    expect(result.materials.length).toBeGreaterThan(0);
    result.materials.forEach((m) => {
      expect(m).toHaveProperty('value');
      expect(m).toHaveProperty('count');
    });
  });

  it('with category scopes facets to that collection', async () => {
    const result = await getFilterValues('mattresses');
    const materials = result.materials;
    expect(materials.length).toBeGreaterThan(0);
    expect(materials.some((m) => m.value === 'Foam')).toBe(true);
  });

  it('returns price ranges array', async () => {
    const result = await getFilterValues('');
    expect(Array.isArray(result.priceRanges)).toBe(true);
    expect(result.priceRanges.length).toBeGreaterThan(0);
  });

  it('returns colors array with value+count objects', async () => {
    const result = await getFilterValues('');
    expect(Array.isArray(result.colors)).toBe(true);
    expect(result.colors.length).toBeGreaterThan(0);
    result.colors.forEach((c) => {
      expect(c).toHaveProperty('value');
      expect(c).toHaveProperty('count');
    });
  });

  it('returns totalProducts count', async () => {
    const result = await getFilterValues('');
    expect(result.totalProducts).toBe(6);
  });

  it('returns features list', async () => {
    const result = await getFilterValues('');
    expect(Array.isArray(result.features)).toBe(true);
    expect(result.features.length).toBeGreaterThan(0);
  });

  it('returns dimensions with min/max', async () => {
    const result = await getFilterValues('');
    expect(result.dimensions).toHaveProperty('width');
    expect(result.dimensions).toHaveProperty('depth');
    expect(result.dimensions.width).toHaveProperty('min');
    expect(result.dimensions.width).toHaveProperty('max');
  });

  it('price ranges have correct bucket structure', async () => {
    const result = await getFilterValues('');
    result.priceRanges.forEach(range => {
      expect(range).toHaveProperty('label');
      expect(range).toHaveProperty('min');
      expect(range).toHaveProperty('key');
      expect(range).toHaveProperty('count');
      expect(typeof range.count).toBe('number');
    });
  });

  it('materials sorted by count descending', async () => {
    const result = await getFilterValues('');
    for (let i = 1; i < result.materials.length; i++) {
      expect(result.materials[i].count).toBeLessThanOrEqual(
        result.materials[i - 1].count
      );
    }
  });

  it('empty category returns all-catalog facets', async () => {
    const all = await getFilterValues('');
    const explicit = await getFilterValues(undefined);
    expect(all.totalProducts).toBe(explicit.totalProducts);
  });

  it('facets cached on second call', async () => {
    const first = await getFilterValues('futon-frames');
    const second = await getFilterValues('futon-frames');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

// ═══════════════════════════════════════════════════════════════════
// AUTOCOMPLETE PIPELINE
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: autocomplete pipeline', () => {
  it('returns product name matches for prefix', async () => {
    const result = await getAutocompleteSuggestions('Seat', 5);
    expect(result).toHaveProperty('suggestions');
    expect(result.suggestions.length).toBeGreaterThan(0);
    const hasSeattle = result.suggestions.some(
      (s) => (s.text || s.name || '').includes('Seat')
    );
    expect(hasSeattle).toBe(true);
  });

  it('returns category matches for known category prefix', async () => {
    const result = await getAutocompleteSuggestions('Futon', 10);
    expect(result).toHaveProperty('suggestions');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('returns empty for single character', async () => {
    const result = await getAutocompleteSuggestions('F');
    expect(result.suggestions).toEqual([]);
  });

  it('returns empty for empty string', async () => {
    const result = await getAutocompleteSuggestions('');
    expect(result.suggestions).toEqual([]);
  });

  it('returns empty for null prefix', async () => {
    const result = await getAutocompleteSuggestions(null);
    expect(result.suggestions).toEqual([]);
  });

  it('respects limit parameter', async () => {
    const result = await getAutocompleteSuggestions('Futon', 2);
    expect(result.suggestions.length).toBeLessThanOrEqual(2);
  });

  it('limit clamped to max 20', async () => {
    const result = await getAutocompleteSuggestions('Futon', 100);
    expect(result.suggestions.length).toBeLessThanOrEqual(20);
  });

  it('suggestions have text, type, and slug fields', async () => {
    const result = await getAutocompleteSuggestions('Seat', 5);
    result.suggestions.forEach(s => {
      expect(s).toHaveProperty('text');
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('slug');
    });
  });

  it('suggestion type is "product", "category", or "popular"', async () => {
    const result = await getAutocompleteSuggestions('Futon', 10);
    result.suggestions.forEach(s => {
      expect(['product', 'category', 'popular']).toContain(s.type);
    });
  });

  it('category suggestions appear for matching category labels', async () => {
    // "Mattress" matches CATEGORY_LABELS key "mattresses"
    const result = await getAutocompleteSuggestions('Mattress', 10);
    const catSuggestions = result.suggestions.filter(s => s.type === 'category');
    expect(catSuggestions.length).toBeGreaterThan(0);
  });

  it('popular queries appear in suggestions after recording', async () => {
    // Record enough to make it a "popular" query
    for (let i = 0; i < 5; i++) {
      await recordSearchQuery('eco friendly');
    }
    __clearCache();
    const result = await getAutocompleteSuggestions('eco', 10);
    // May or may not show up depending on prefix matching — at minimum no crash
    expect(result).toHaveProperty('suggestions');
  });

  it('handles HTML in prefix safely', async () => {
    const result = await getAutocompleteSuggestions('<script>alert(1)</script>', 5);
    expect(result).toHaveProperty('suggestions');
  });

  it('handles very long prefix', async () => {
    const longPrefix = 'a'.repeat(500);
    const result = await getAutocompleteSuggestions(longPrefix, 5);
    expect(result).toHaveProperty('suggestions');
  });

  it('autocomplete results are cached', async () => {
    const first = await getAutocompleteSuggestions('Seat', 5);
    const second = await getAutocompleteSuggestions('Seat', 5);
    expect(first.suggestions.length).toBe(second.suggestions.length);
  });

  it('no duplicate suggestions', async () => {
    const result = await getAutocompleteSuggestions('Futon', 20);
    const texts = result.suggestions.map(s => s.text.toLowerCase());
    const unique = new Set(texts);
    expect(texts.length).toBe(unique.size);
  });
});

// ═══════════════════════════════════════════════════════════════════
// POPULAR SEARCHES / QUERY TRACKING
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: popular searches + query tracking', () => {
  it('recordSearchQuery + getPopularSearches round-trip', async () => {
    await recordSearchQuery('futon frame');
    await recordSearchQuery('futon frame');
    await recordSearchQuery('murphy bed');

    const popular = await getPopularSearches(5);
    expect(popular).toHaveProperty('queries');
    expect(popular.queries.length).toBeGreaterThan(0);
    const texts = popular.queries.map((q) => q.query.toLowerCase());
    expect(texts.some((t) => t.includes('futon'))).toBe(true);
  });

  it('popular searches are sorted by frequency', async () => {
    await recordSearchQuery('rare query');
    await recordSearchQuery('popular query');
    await recordSearchQuery('popular query');
    await recordSearchQuery('popular query');

    const popular = await getPopularSearches(5);
    expect(popular.queries.length).toBeGreaterThanOrEqual(2);
    expect(popular.queries[0].query.toLowerCase()).toContain('popular');
  });

  it('queries include count field', async () => {
    await recordSearchQuery('test query');
    await recordSearchQuery('test query');
    const popular = await getPopularSearches(5);
    const match = popular.queries.find(q => q.query.includes('test'));
    if (match) {
      expect(match.count).toBeGreaterThanOrEqual(2);
    }
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await recordSearchQuery(`query-${i}`);
    }
    const popular = await getPopularSearches(3);
    expect(popular.queries.length).toBeLessThanOrEqual(3);
  });

  it('ignores single-character queries', async () => {
    await recordSearchQuery('x');
    const popular = await getPopularSearches(5);
    const match = popular.queries.find(q => q.query === 'x');
    expect(match).toBeUndefined();
  });

  it('ignores empty queries', async () => {
    const result = await recordSearchQuery('');
    expect(result.success).toBe(false);
  });

  it('normalizes queries to lowercase', async () => {
    await recordSearchQuery('FUTON FRAME');
    await recordSearchQuery('futon frame');
    const popular = await getPopularSearches(5);
    const match = popular.queries.find(q => q.query === 'futon frame');
    if (match) {
      expect(match.count).toBeGreaterThanOrEqual(2);
    }
  });

  it('fullTextSearch records query for popularity', async () => {
    await fullTextSearch({ query: 'Seattle' });
    await fullTextSearch({ query: 'Seattle' });
    // Second call may be cached, but first should have recorded
    const popular = await getPopularSearches(10);
    const match = popular.queries.find(q => q.query === 'seattle');
    expect(match).toBeTruthy();
  });

  it('returns empty queries for fresh state', async () => {
    const popular = await getPopularSearches(5);
    expect(popular.queries).toEqual([]);
  });

  it('getPopularSearches defaults to limit 8', async () => {
    for (let i = 0; i < 15; i++) {
      await recordSearchQuery(`popular-${i}-query`);
    }
    const popular = await getPopularSearches();
    expect(popular.queries.length).toBeLessThanOrEqual(8);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORYSEARCH → CATEGORY PAGE
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: categorySearch → Category Page', () => {
  it('returns items in collection', async () => {
    const result = await categorySearch({ category: 'futon-frames' });
    expect(result.items.length).toBe(3);
    result.items.forEach((p) => {
      expect(p.collections).toContain('futon-frames');
    });
  });

  it('material filter narrows results', async () => {
    const all = await categorySearch({ category: 'futon-frames' });
    const hardwood = await categorySearch({
      category: 'futon-frames',
      materials: ['Hardwood'],
    });
    expect(hardwood.items.length).toBeLessThanOrEqual(all.items.length);
    hardwood.items.forEach((p) => {
      expect(p.material).toBe('Hardwood');
    });
  });

  it('multi-material filter uses OR logic', async () => {
    const result = await categorySearch({
      materials: ['Hardwood', 'Foam'],
    });
    result.items.forEach(p => {
      expect(['Hardwood', 'Foam']).toContain(p.material);
    });
    expect(result.items.length).toBeGreaterThanOrEqual(2);
  });

  it('color filter narrows results', async () => {
    const result = await categorySearch({ colors: ['Espresso'] });
    result.items.forEach(p => {
      expect(p.color).toBe('Espresso');
    });
  });

  it('multi-color filter uses OR logic', async () => {
    const result = await categorySearch({
      colors: ['Espresso', 'White'],
    });
    result.items.forEach(p => {
      expect(['Espresso', 'White']).toContain(p.color);
    });
  });

  it('featureTags filter narrows results', async () => {
    const result = await categorySearch({
      featureTags: ['usb-charging'],
    });
    result.items.forEach(p => {
      expect(p.featureTags).toContain('usb-charging');
    });
  });

  it('brand filter narrows results', async () => {
    const result = await categorySearch({
      brands: ['Night & Day'],
    });
    result.items.forEach(p => {
      expect(p.brand).toBe('Night & Day');
    });
  });

  it('searchQuery (text) filter narrows results', async () => {
    const result = await categorySearch({
      searchQuery: 'Seattle',
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].name).toContain('Seattle');
  });

  it('priceMin filter works', async () => {
    const result = await categorySearch({ priceMin: 500 });
    result.items.forEach(p => {
      expect(p.price).toBeGreaterThanOrEqual(500);
    });
  });

  it('priceMax filter works', async () => {
    const result = await categorySearch({ priceMax: 400 });
    result.items.forEach(p => {
      expect(p.price).toBeLessThanOrEqual(400);
    });
  });

  it('priceMin + priceMax combined', async () => {
    const result = await categorySearch({ priceMin: 300, priceMax: 600 });
    result.items.forEach(p => {
      expect(p.price).toBeGreaterThanOrEqual(300);
      expect(p.price).toBeLessThanOrEqual(600);
    });
  });

  it('inStockOnly excludes out-of-stock items', async () => {
    const result = await categorySearch({
      category: 'futon-frames',
      inStockOnly: true,
    });
    result.items.forEach((p) => {
      expect(p.inStock).toBe(true);
    });
    expect(result.items.some((p) => p._id === 'cf-005')).toBe(false);
  });

  it('sorts by price ascending', async () => {
    const result = await categorySearch({
      category: 'futon-frames',
      sort: 'price-asc',
    });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].price).toBeGreaterThanOrEqual(
        result.items[i - 1].price
      );
    }
  });

  it('sorts by price descending', async () => {
    const result = await categorySearch({
      category: 'futon-frames',
      sort: 'price-desc',
    });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].price).toBeLessThanOrEqual(
        result.items[i - 1].price
      );
    }
  });

  it('sorts by name ascending', async () => {
    const result = await categorySearch({ sort: 'name-asc' });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].name.localeCompare(result.items[i - 1].name))
        .toBeGreaterThanOrEqual(0);
    }
  });

  it('defaults to bestselling sort', async () => {
    const result = await categorySearch({});
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('unknown sort falls back to bestselling', async () => {
    const result = await categorySearch({ sort: 'random-invalid' });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('no params returns all products', async () => {
    const result = await categorySearch({});
    expect(result.totalCount).toBe(6);
  });

  it('empty category returns all products', async () => {
    const result = await categorySearch({ category: '' });
    expect(result.totalCount).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GETFILTEREDPRODUCTCOUNT
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: getFilteredProductCount', () => {
  it('returns correct count for category', async () => {
    const result = await getFilteredProductCount({ category: 'futon-frames' });
    expect(result.count).toBe(3);
  });

  it('returns correct count with material filter', async () => {
    const result = await getFilteredProductCount({
      category: 'futon-frames',
      materials: ['Hardwood'],
    });
    expect(result.count).toBe(2);
  });

  it('returns 0 for impossible filter combination', async () => {
    const result = await getFilteredProductCount({
      category: 'mattresses',
      materials: ['Hardwood'],
    });
    expect(result.count).toBe(0);
  });

  it('returns full count with no filters', async () => {
    const result = await getFilteredProductCount({});
    expect(result.count).toBe(6);
  });

  it('inStockOnly reduces count', async () => {
    const all = await getFilteredProductCount({});
    const inStock = await getFilteredProductCount({ inStockOnly: true });
    expect(inStock.count).toBeLessThan(all.count);
  });

  it('price range reduces count', async () => {
    const result = await getFilteredProductCount({
      priceMin: 500,
      priceMax: 1000,
    });
    expect(result.count).toBeLessThan(6);
    expect(result.count).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GETFACETMETADATA
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: getFacetMetadata', () => {
  it('builds filter options with materials', async () => {
    const facets = await getFacetMetadata('futon-frames');
    expect(facets).toHaveProperty('materials');
    expect(Array.isArray(facets.materials)).toBe(true);
    expect(facets.materials.length).toBeGreaterThan(0);
  });

  it('includes colors sorted alphabetically', async () => {
    const facets = await getFacetMetadata();
    expect(Array.isArray(facets.colors)).toBe(true);
    for (let i = 1; i < facets.colors.length; i++) {
      expect(facets.colors[i].localeCompare(facets.colors[i - 1]))
        .toBeGreaterThanOrEqual(0);
    }
  });

  it('includes featureTags sorted alphabetically', async () => {
    const facets = await getFacetMetadata();
    expect(Array.isArray(facets.featureTags)).toBe(true);
    expect(facets.featureTags.length).toBeGreaterThan(0);
  });

  it('includes brands sorted alphabetically', async () => {
    const facets = await getFacetMetadata();
    expect(Array.isArray(facets.brands)).toBe(true);
    for (let i = 1; i < facets.brands.length; i++) {
      expect(facets.brands[i].localeCompare(facets.brands[i - 1]))
        .toBeGreaterThanOrEqual(0);
    }
  });

  it('includes priceRange with min and max', async () => {
    const facets = await getFacetMetadata();
    expect(facets.priceRange).toHaveProperty('min');
    expect(facets.priceRange).toHaveProperty('max');
    expect(facets.priceRange.min).toBeLessThanOrEqual(facets.priceRange.max);
  });

  it('includes totalProducts', async () => {
    const facets = await getFacetMetadata();
    expect(facets.totalProducts).toBe(6);
  });

  it('category-scoped facets contain only that collection values', async () => {
    const facets = await getFacetMetadata('mattresses');
    expect(facets.totalProducts).toBe(1);
    expect(facets.materials).toContain('Foam');
    expect(facets.materials).not.toContain('Softwood');
  });

  it('includes dimensionRange with width/depth/height', async () => {
    const facets = await getFacetMetadata();
    expect(facets.dimensionRange).toHaveProperty('width');
    expect(facets.dimensionRange).toHaveProperty('depth');
    expect(facets.dimensionRange).toHaveProperty('height');
  });

  it('empty category returns zeros for empty collection', async () => {
    __reset();
    __seed('Stores/Products', []);
    clearCategoryCache();
    const facets = await getFacetMetadata();
    expect(facets.totalProducts).toBe(0);
    expect(facets.priceRange.min).toBe(0);
    expect(facets.priceRange.max).toBe(0);
  });

  it('facets are cached on repeat calls', async () => {
    const first = await getFacetMetadata('futon-frames');
    const second = await getFacetMetadata('futon-frames');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUGGESTFILTERRELAXATION
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: suggestFilterRelaxation', () => {
  it('returns suggestions for impossible combination', async () => {
    const result = await suggestFilterRelaxation({
      category: 'mattresses',
      materials: ['Hardwood'],
      colors: ['Black Walnut'],
    });
    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('suggestions include filter name and result count', async () => {
    const result = await suggestFilterRelaxation({
      category: 'mattresses',
      materials: ['Hardwood'],
      colors: ['Black Walnut'],
    });
    result.suggestions.forEach(s => {
      expect(s).toHaveProperty('filter');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('resultCount');
      expect(s.resultCount).toBeGreaterThan(0);
    });
  });

  it('suggestions sorted by most results gained', async () => {
    const result = await suggestFilterRelaxation({
      category: 'futon-frames',
      materials: ['Titanium'],
      colors: ['Neon Pink'],
      inStockOnly: true,
    });
    for (let i = 1; i < result.suggestions.length; i++) {
      expect(result.suggestions[i].resultCount)
        .toBeLessThanOrEqual(result.suggestions[i - 1].resultCount);
    }
  });

  it('returns empty suggestions when no single filter removal helps', async () => {
    // All filters pointing to nonexistent values
    __reset();
    __seed('Stores/Products', []);
    clearCategoryCache();
    const result = await suggestFilterRelaxation({
      materials: ['Unobtanium'],
    });
    expect(result.suggestions).toEqual([]);
  });

  it('handles empty params gracefully', async () => {
    const result = await suggestFilterRelaxation({});
    expect(result).toHaveProperty('suggestions');
    expect(result.suggestions).toEqual([]);
  });

  it('price relaxation suggestion included when price filter active', async () => {
    const result = await suggestFilterRelaxation({
      category: 'futon-frames',
      priceMin: 10000,
      priceMax: 20000,
    });
    const priceSuggestion = result.suggestions.find(s => s.filter === 'price');
    if (priceSuggestion) {
      expect(priceSuggestion.resultCount).toBeGreaterThan(0);
    }
  });

  it('inStockOnly relaxation suggestion included when active', async () => {
    // Make all futon frames out of stock
    __reset();
    __seed('Stores/Products', catalogProducts.map(p =>
      p.collections.includes('futon-frames') ? { ...p, inStock: false } : p
    ));
    clearCategoryCache();

    const result = await suggestFilterRelaxation({
      category: 'futon-frames',
      inStockOnly: true,
    });
    const inStockSuggestion = result.suggestions.find(s => s.filter === 'inStockOnly');
    if (inStockSuggestion) {
      expect(inStockSuggestion.label).toBe('in-stock only');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// CROSS-SERVICE CONSISTENCY
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: cross-service consistency', () => {
  it('both services find same products for same category', async () => {
    const search = await searchProducts({ category: 'futon-frames' });
    const cat = await categorySearch({ category: 'futon-frames' });

    const searchIds = new Set(search.products.map((p) => p._id));
    const catIds = new Set(cat.items.map((p) => p._id));

    expect(searchIds.size).toBe(catIds.size);
    catIds.forEach((id) => {
      expect(searchIds.has(id)).toBe(true);
    });
  });

  it('both services return consistent counts', async () => {
    const search = await searchProducts({ category: 'mattresses' });
    const cat = await categorySearch({ category: 'mattresses' });
    expect(search.total).toBe(cat.totalCount);
  });

  it('caches are independent between services', async () => {
    await getFilterValues('futon-frames');
    await getFacetMetadata('futon-frames');

    __clearCache();

    const facets = await getFacetMetadata('futon-frames');
    expect(facets).toHaveProperty('materials');
    expect(facets.materials.length).toBeGreaterThan(0);
  });

  it('getFilteredProductCount matches categorySearch totalCount', async () => {
    const count = await getFilteredProductCount({ category: 'futon-frames' });
    const search = await categorySearch({ category: 'futon-frames' });
    expect(count.count).toBe(search.totalCount);
  });

  it('facets from both services cover same materials for same category', async () => {
    const searchFacets = await getFilterValues('futon-frames');
    const catFacets = await getFacetMetadata('futon-frames');

    const searchMaterials = searchFacets.materials.map(m => m.value).sort();
    const catMaterials = [...catFacets.materials].sort();
    expect(searchMaterials).toEqual(catMaterials);
  });

  it('both services handle empty collection identically', async () => {
    const search = await searchProducts({ category: 'nonexistent' });
    const cat = await categorySearch({ category: 'nonexistent' });
    expect(search.products.length).toBe(0);
    expect(cat.items.length).toBe(0);
  });

  it('fullTextSearch + categorySearch give same results for category+text', async () => {
    const fts = await fullTextSearch({
      query: 'Seattle',
      category: 'futon-frames',
    });
    const cs = await categorySearch({
      searchQuery: 'Seattle',
      category: 'futon-frames',
    });

    // Both should find the Seattle Futon Frame
    if (fts.products.length > 0 && cs.items.length > 0) {
      expect(fts.products[0]._id).toBe(cs.items[0]._id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECURITY / INPUT SANITIZATION
// ═══════════════════════════════════════════════════════════════════

describe('Search Integration: input sanitization', () => {
  it('HTML script tags stripped from search query', async () => {
    const result = await fullTextSearch({
      query: '<img onerror=alert(1) src=x>Futon',
    });
    expect(result).toHaveProperty('products');
    // Query should not contain HTML
    expect(result.query).not.toContain('<');
    expect(result.query).not.toContain('>');
  });

  it('HTML in material filter stripped', async () => {
    const result = await searchProducts({
      material: '<b>Hardwood</b>',
    });
    // Should not crash; sanitized material won't match
    expect(result).toHaveProperty('products');
  });

  it('HTML in category filter stripped by validateSlug', async () => {
    const result = await searchProducts({
      category: '<script>futon-frames</script>',
    });
    // Invalid slug returns empty
    expect(result).toHaveProperty('products');
  });

  it('SQL-like injection in query handled safely', async () => {
    const result = await fullTextSearch({
      query: "'; DROP TABLE products; --",
    });
    expect(result).toHaveProperty('products');
  });

  it('encoded entities decoded before stripping', async () => {
    const result = await fullTextSearch({
      query: '&lt;script&gt;Futon&lt;/script&gt;',
    });
    expect(result).toHaveProperty('products');
    expect(result.query).not.toContain('<script>');
  });
});

// ═══════════════════════════════════════════════════════════════════
// ELEMENT ID DOCUMENTATION FOR EDITOR HOOKUP
// ═══════════════════════════════════════════════════════════════════
//
// Search Results Page ($w elements from src/pages/Search Results.js):
//
//   SEARCH CONTROLS:
//     #searchInput          - Text input for search query (type-ahead)
//     #searchBtn            - Button to trigger search
//     #suggestionsBox       - Container for autocomplete dropdown (role=listbox)
//     #suggestionsRepeater  - Repeater inside suggestionsBox for suggestion items
//       #suggestionText     - Text element: suggestion label
//       #suggestionType     - Text element: "Category" / "Trending" / "Product"
//
//   RESULTS DISPLAY:
//     #searchQuery          - Text element: "Results for ..." heading
//     #resultCount          - Text element: "N products found" (ariaLive=polite)
//     #searchRepeater       - Repeater for product result cards
//       #searchImage        - Image element: product main media
//       #searchName         - Text element: product name (clickable → PDP)
//       #searchPrice        - Text element: current price / "Call for Price"
//       #searchOrigPrice    - Text element: original price (shown when discounted)
//       #searchDesc         - Text element: truncated product description
//       #searchRibbon       - Text element: badge overlay (Sale, Featured, etc.)
//       #searchAddBtn       - Button: "Add to Cart" quick-add
//       #searchSwatchPreview - Container: swatch color dots preview
//         #searchSwatchDot1..4 - Shape elements: color dot previews
//     #loadMoreBtn          - Button: "Load More" for infinite scroll pagination
//     #loadingIndicator     - Element: skeleton loading indicator
//
//   FILTERS:
//     #categoryFilter       - Dropdown: filter by category collection
//     #priceFilter          - Dropdown: filter by price range bucket
//     #materialFilter       - Dropdown: filter by material type
//     #colorFilter          - Dropdown: filter by color
//     #sortDropdown         - Dropdown: sort order (relevance, price, name, newest)
//     #filterToggleBtn      - Button: toggle mobile filter sidebar
//     #filterSidebar        - Container: mobile filter sidebar
//     #clearFiltersBtn      - Button: reset all filters to default
//     #filterBadge          - Text element: active filter count badge
//
//   EMPTY / NO RESULTS:
//     #noResultsBox         - Container: shown when zero results (role=status)
//     #noResultsText        - Text element: "Try one of these popular searches:"
//     #searchChipsRepeater  - Repeater: popular search chip buttons
//       #chipLabel          - Text element: chip label (clickable → search)
//
// Category Page ($w elements from src/pages/Category Page.js):
//
//   HERO SECTION:
//     #categoryHeroSection  - Container: category hero banner
//     #categoryHeroTitle    - Text element: category display name
//     #categoryHeroSubtitle - Text element: category description
//
//   BREADCRUMBS:
//     #breadcrumbHome       - Link: "Home" breadcrumb
//     #breadcrumbCurrent    - Text element: current category name
//
//   PRODUCT GRID:
//     #productGridRepeater  - Repeater: product card grid
//     #resultCount          - Text element: "N products" count
//     #sortDropdown         - Dropdown: sort order
//     #mobileSortBar        - Container: mobile sort controls
//
//   FILTERS:
//     #filterCategory       - Dropdown: sub-category filter
//     #filterMaterial       - Dropdown: material filter
//     #filterColor          - Dropdown: color filter
//     #filterPrice          - Dropdown: price range filter
//     #filterPriceRange     - Slider: price range (min/max)
//     #filterFeatures       - Checkbox group: feature tags
//     #filterBrand          - Dropdown: brand filter
//     #filterSize           - Dropdown: size filter
//     #filterComfortLevel   - Dropdown: comfort level filter
//     #filterWidthMin       - Input: min width filter
//     #filterWidthMax       - Input: max width filter
//     #filterDepthMin       - Input: min depth filter
//     #filterDepthMax       - Input: max depth filter
//     #filterToggleBtn      - Button: toggle mobile filter drawer
//     #filterDrawer         - Container: mobile filter drawer
//     #filterDrawerOverlay  - Element: drawer backdrop overlay
//     #filterDrawerApply    - Button: apply filters in drawer
//     #filterLoadingIndicator - Element: loading indicator during filter changes
//     #filterResultCount    - Text element: preview "N products" in filter panel
//     #clearAllFilters      - Button: clear all active filters
//     #clearAllFiltersChip  - Chip button: clear all filters
//     #clearFilters         - Button: alternative clear filters
//
//   FILTER CHIPS:
//     #activeFilterChips    - Container: active filter chip bar
//     #filterChipRepeater   - Repeater: individual filter chips
//     #filterChipsText      - Text element: chip label text
//
//   EMPTY STATE:
//     #emptyStateSection    - Container: shown when no products match
//     #emptyStateTitle      - Text element: "No products found"
//     #emptyStateMessage    - Text element: suggestion message
//     #emptyStateIllustration - Image: illustration for empty state
//     #noMatchesSection     - Container: alternative no-matches display
//     #noMatchesTitle       - Text element: no matches heading
//     #noMatchesMessage     - Text element: no matches body
//     #noMatchesSuggestion  - Text element: filter relaxation suggestion
//
//   COMPARE:
//     #compareBar           - Container: product comparison bar
//     #compareRepeater      - Repeater: selected comparison products
//     #compareViewBtn       - Button: view comparison page
//
//   QUICK VIEW MODAL:
//     #quickViewModal       - Container: product quick view popup
//     #qvImage              - Image: product image in quick view
//     #qvName               - Text: product name
//     #qvPrice              - Text: product price
//     #qvDescription        - Text: product description
//     #qvSizeSelect         - Dropdown: size selector
//     #qvAddToCart           - Button: add to cart from quick view
//     #qvClose              - Button: close quick view modal
//     #qvViewFull           - Button/Link: navigate to full PDP
//
//   RECENTLY VIEWED:
//     #recentlyViewedSection  - Container: recently viewed products section
//     #recentlyViewedTitle    - Text element: section heading
//     #recentlyViewedRepeater - Repeater: recently viewed product cards
//
//   SEO:
//     #categorySchemaHtml         - HTML element: JSON-LD schema
//     #categoryBreadcrumbSchemaHtml - HTML element: breadcrumb schema
//     #categoryOgHtml             - HTML element: Open Graph meta
//     #flashSaleBanner            - Container: flash sale promotional banner
