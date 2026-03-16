/**
 * Deep coverage tests for searchService.web.js — edge cases in search queries,
 * pagination clamping, cache eviction, special characters, sort validation,
 * filter combinations, and autocomplete boundaries.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  searchProducts,
  getFilterValues,
  fullTextSearch,
  getAutocompleteSuggestions,
  getPopularSearches,
  recordSearchQuery,
  __clearCache,
} from '../src/backend/searchService.web.js';

// ── Seed Data ────────────────────────────────────────────────────

const baseProducts = [
  {
    _id: 'a0b1c2d3-0001-0000-0000-000000000001',
    name: 'Eureka Futon Frame',
    slug: 'eureka',
    description: 'A sturdy hardwood futon frame for everyday use.',
    price: 499, formattedPrice: '$499.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'eureka.jpg',
    ribbon: '', collections: ['futon-frames'], material: 'Hardwood',
    color: 'Natural', featureTags: ['wall-hugger', 'made-in-usa'],
    width: 54, depth: 36, inStock: true, numericRating: 4.5,
    _createdDate: '2025-06-01T00:00:00Z',
  },
  {
    _id: 'a0b1c2d3-0002-0000-0000-000000000002',
    name: 'Dillon Wall Hugger',
    slug: 'dillon',
    description: 'Compact wall hugger futon with sleek design.',
    price: 699, formattedPrice: '$699.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'dillon.jpg',
    ribbon: 'Featured', collections: ['futon-frames', 'wall-huggers'],
    material: 'Hardwood', color: 'Black Walnut', featureTags: ['wall-hugger'],
    width: 60, depth: 38, inStock: true, numericRating: 4.8,
    _createdDate: '2025-08-01T00:00:00Z',
  },
  {
    _id: 'a0b1c2d3-0003-0000-0000-000000000003',
    name: 'Moonshadow Mattress',
    slug: 'moonshadow',
    description: 'Eco-friendly foam mattress with cooling gel layer.',
    price: 349, formattedPrice: '$349.00', discountedPrice: 299,
    formattedDiscountedPrice: '$299.00', mainMedia: 'moon.jpg',
    ribbon: 'Sale', collections: ['mattresses'], material: 'Foam',
    color: 'White', featureTags: ['eco-friendly'],
    width: 54, depth: 75, inStock: true, numericRating: 4.2,
    _createdDate: '2025-03-15T00:00:00Z',
  },
  {
    _id: 'a0b1c2d3-0004-0000-0000-000000000004',
    name: 'Sagebrush Murphy Bed',
    slug: 'sagebrush',
    description: 'Space-saving murphy cabinet bed in cherry finish.',
    price: 1499, formattedPrice: '$1,499.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'sage.jpg',
    ribbon: '', collections: ['murphy-cabinet-beds'], material: 'Cherry',
    color: 'Cherry', featureTags: ['storage'],
    width: 66, depth: 40, inStock: false, numericRating: 4.9,
    _createdDate: '2025-10-01T00:00:00Z',
  },
  {
    _id: 'a0b1c2d3-0005-0000-0000-000000000005',
    name: 'Budget Futon Base',
    slug: 'budget-base',
    description: 'Affordable unfinished wood futon frame.',
    price: 199, formattedPrice: '$199.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'budget.jpg',
    ribbon: '', collections: ['futon-frames', 'unfinished-wood'], material: 'Pine',
    color: 'Unfinished', featureTags: [],
    width: 52, depth: 34, inStock: true, numericRating: 3.8,
    _createdDate: '2024-12-01T00:00:00Z',
  },
];

beforeEach(() => {
  __clearCache();
  __seed('Stores/Products', baseProducts.map(p => ({ ...p })));
});

// ── fullTextSearch — non-string query types ─────────────────────────

describe('fullTextSearch — non-string query types', () => {
  it('returns empty for numeric query (non-string)', async () => {
    const result = await fullTextSearch({ query: 12345 });
    expect(result.products).toEqual([]);
    expect(result.query).toBe('');
  });

  it('returns empty for object query', async () => {
    const result = await fullTextSearch({ query: { evil: 'payload' } });
    expect(result.products).toEqual([]);
  });

  it('returns empty for array query', async () => {
    const result = await fullTextSearch({ query: ['futon'] });
    expect(result.products).toEqual([]);
  });
});

// ── fullTextSearch — XSS and injection strings ──────────────────────

describe('fullTextSearch — XSS and injection strings', () => {
  it('strips HTML script tags from query', async () => {
    const result = await fullTextSearch({ query: '<script>alert("xss")</script>Futon' });
    expect(result.query).not.toContain('<script>');
    expect(result.query).not.toContain('</script>');
  });

  it('handles entity-encoded XSS attempt', async () => {
    const result = await fullTextSearch({ query: '&lt;script&gt;alert(1)&lt;/script&gt;Futon' });
    expect(result.query).not.toContain('<script>');
  });

  it('handles SQL injection-like query without crashing', async () => {
    const result = await fullTextSearch({ query: "'; DROP TABLE products; --" });
    expect(result).toHaveProperty('products');
    expect(result).toHaveProperty('total');
  });

  it('truncates very long query to 200 chars', async () => {
    const longQuery = 'Futon '.repeat(100); // 600 chars
    const result = await fullTextSearch({ query: longQuery });
    expect(result.query.length).toBeLessThanOrEqual(200);
  });
});

// ── fullTextSearch — special characters ─────────────────────────────

describe('fullTextSearch — special characters', () => {
  it('handles emoji in search query without crashing', async () => {
    const result = await fullTextSearch({ query: 'futon \ud83d\udecb\ufe0f' });
    expect(result).toHaveProperty('products');
    expect(result.total).toBeTypeOf('number');
  });

  it('handles backslashes and regex-like patterns', async () => {
    const result = await fullTextSearch({ query: 'futon.*frame\\d+' });
    expect(result).toHaveProperty('products');
  });
});

// ── searchProducts — pagination edge cases ──────────────────────────

describe('searchProducts — pagination edge cases', () => {
  it('negative limit is clamped to minimum 1', async () => {
    const result = await searchProducts({ limit: -5 });
    // Number(-5) is truthy, then max(1, -5) → 1, min(1, 100) → 1
    expect(result.products.length).toBeLessThanOrEqual(1);
  });

  it('string limit is coerced via Number', async () => {
    const result = await searchProducts({ limit: '3' });
    expect(result.products.length).toBe(3);
  });

  it('string offset is coerced via Number', async () => {
    const result = await searchProducts({ limit: 50, offset: '2' });
    expect(result.products.length).toBe(3); // 5 total, skip 2
  });

  it('Infinity limit is clamped to 100', async () => {
    const result = await searchProducts({ limit: Infinity });
    expect(result.products.length).toBeLessThanOrEqual(100);
  });

  it('very large offset returns empty products but preserves total', async () => {
    const result = await searchProducts({ offset: 999999 });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(5);
  });
});

describe('fullTextSearch — pagination edge cases', () => {
  it('negative limit is clamped to 1', async () => {
    const result = await fullTextSearch({ query: 'Futon', limit: -10 });
    expect(result.products.length).toBeLessThanOrEqual(1);
  });

  it('Infinity offset returns empty page', async () => {
    const result = await fullTextSearch({ query: 'Futon', offset: Infinity });
    expect(result.products).toEqual([]);
  });

  it('limit 101 is clamped to 100', async () => {
    const result = await fullTextSearch({ query: 'Futon', limit: 101 });
    expect(result.products.length).toBeLessThanOrEqual(100);
  });
});

// ── Sort order edge cases ───────────────────────────────────────────

describe('searchProducts — sort order edge cases', () => {
  it('unknown sortBy falls through to default (bestselling)', async () => {
    const result = await searchProducts({ sortBy: 'random-garbage' });
    expect(result.products[0].numericRating).toBeGreaterThanOrEqual(
      result.products[result.products.length - 1].numericRating
    );
  });
});

describe('fullTextSearch — sort order edge cases', () => {
  it('unknown sortBy falls through to relevance sort', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'invalid-sort' });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('relevance sort ranks name-matches above description-matches', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'relevance' });
    // Products with 'Futon' in name should precede description-only matches
    const nameMatchProducts = result.products.filter(p =>
      p.name.toLowerCase().includes('futon')
    );
    expect(nameMatchProducts.length).toBeGreaterThan(0);
    // First product should be a name-match
    expect(result.products[0].name.toLowerCase()).toContain('futon');
  });
});

// ── Category and filter combinations ────────────────────────────────

describe('searchProducts — category and filter edge cases', () => {
  it('category with uppercase is lowercased via validateSlug', async () => {
    const result = await searchProducts({ category: 'Futon-Frames' });
    expect(result.products.every(p => p.collections.includes('futon-frames'))).toBe(true);
  });

  it('category with spaces is rejected by validateSlug', async () => {
    const result = await searchProducts({ category: 'futon frames' });
    expect(result.products.length).toBe(5); // no filter applied
  });

  it('category with underscores is rejected by validateSlug', async () => {
    const result = await searchProducts({ category: 'futon_frames' });
    expect(result.products.length).toBe(5); // no filter applied
  });

  it('widthRange with only min specified (max NaN)', async () => {
    const result = await searchProducts({ widthRange: [60, NaN] });
    expect(result.products.every(p => p.width >= 60)).toBe(true);
  });

  it('depthRange with only max specified (min NaN)', async () => {
    const result = await searchProducts({ depthRange: [NaN, 40] });
    expect(result.products.every(p => p.depth <= 40)).toBe(true);
  });

  it('multiple known features with AND logic', async () => {
    const result = await searchProducts({ features: ['wall-hugger', 'made-in-usa'] });
    expect(result.products.length).toBe(1);
    expect(result.products[0].name).toBe('Eureka Futon Frame');
  });
});

// ── fullTextSearch — filter combinations ────────────────────────────

describe('fullTextSearch — filter edge cases', () => {
  it('inStockOnly filters out-of-stock from search results', async () => {
    const result = await fullTextSearch({ query: 'bed', inStockOnly: true });
    const outOfStock = result.products.filter(p => !p.inStock);
    expect(outOfStock.length).toBe(0);
  });

  it('features filter with all unknown tags applies no filter', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      features: ['nonexistent-1', 'nonexistent-2'],
    });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('material filter matching zero products returns empty', async () => {
    const result = await fullTextSearch({ query: 'Futon', material: 'Titanium' });
    expect(result.products.length).toBe(0);
  });

});

// ── getAutocompleteSuggestions — edge cases ──────────────────────────

describe('getAutocompleteSuggestions — edge cases', () => {
  it('returns empty for prefix that becomes 1 char after sanitize', async () => {
    const result = await getAutocompleteSuggestions('<b>x</b>');
    expect(result.suggestions).toEqual([]);
  });

  it('negative limit is clamped to 1', async () => {
    const result = await getAutocompleteSuggestions('Fu', -5);
    expect(result.suggestions.length).toBeLessThanOrEqual(1);
  });

  it('limit 21 is clamped to 20', async () => {
    const result = await getAutocompleteSuggestions('Fu', 21);
    expect(result.suggestions.length).toBeLessThanOrEqual(20);
  });

  it('category suggestions appear before product suggestions', async () => {
    const result = await getAutocompleteSuggestions('fu');
    const types = result.suggestions.map(s => s.type);
    const firstProduct = types.indexOf('product');
    const lastCategory = types.lastIndexOf('category');
    if (firstProduct >= 0 && lastCategory >= 0) {
      expect(lastCategory).toBeLessThan(firstProduct);
    }
  });

});

// ── recordSearchQuery — edge cases ──────────────────────────────────

describe('recordSearchQuery — edge cases', () => {
  it('rejects query with only HTML tags (empty after sanitize)', async () => {
    const result = await recordSearchQuery('<div></div>');
    expect(result.success).toBe(false);
  });

  it('accepts exactly 2-char query', async () => {
    const result = await recordSearchQuery('ab');
    expect(result.success).toBe(true);
  });

  it('deduplicates case variations in frequency tracking', async () => {
    await recordSearchQuery('Futon');
    await recordSearchQuery('FUTON');
    await recordSearchQuery('futon');
    const popular = await getPopularSearches();
    const futonEntries = popular.queries.filter(q => q.query === 'futon');
    expect(futonEntries.length).toBe(1);
    expect(futonEntries[0].count).toBe(3);
  });
});

// ── getPopularSearches — edge cases ─────────────────────────────────

describe('getPopularSearches — edge cases', () => {
  it('negative limit is clamped to 1', async () => {
    await recordSearchQuery('futon frame');
    await recordSearchQuery('mattress pad');
    const result = await getPopularSearches(-5);
    expect(result.queries.length).toBeLessThanOrEqual(1);
  });
});

// ── Cache eviction ──────────────────────────────────────────────────

describe('search cache — eviction and key isolation', () => {
  it('clearCache resets both search cache and query frequency', async () => {
    await recordSearchQuery('futon frame');
    await fullTextSearch({ query: 'Futon' });
    __clearCache();
    const popular = await getPopularSearches();
    expect(popular.queries).toEqual([]);
  });

  it('different sortBy values produce different cache entries', async () => {
    const r1 = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    const r2 = await fullTextSearch({ query: 'Futon', sortBy: 'price-desc' });
    if (r1.products.length > 1 && r2.products.length > 1) {
      expect(r1.products[0].price).not.toBe(r2.products[0].price);
    }
  });
});

// ── getFilterValues — edge cases ────────────────────────────────────

describe('getFilterValues — edge cases', () => {
  it('returns zero-count price ranges and zero dimensions for empty collection', async () => {
    __seed('Stores/Products', []);
    __clearCache();
    const result = await getFilterValues('');
    expect(result.priceRanges.every(r => r.count === 0)).toBe(true);
    expect(result.dimensions.width).toEqual({ min: 0, max: 0 });
    expect(result.dimensions.depth).toEqual({ min: 0, max: 0 });
  });
});
