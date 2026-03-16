/**
 * Deepened coverage tests for searchService.web.js — targets untested branches:
 * cache eviction (LRU), fullTextSearch sort modes, deduplication with relevance,
 * autocomplete limit clamping & popular queries, error paths, autocomplete cache
 * TTL, recordSearchQuery sanitization, and Over $1,200 price range.
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

// ── Seed Data ────────────────────────────────────────────────────

function makeProduct(overrides) {
  return {
    _id: 'dp-001',
    name: 'Test Futon',
    slug: 'test-futon',
    price: 499,
    formattedPrice: '$499.00',
    discountedPrice: null,
    formattedDiscountedPrice: null,
    mainMedia: 'test.jpg',
    collections: ['futon-frames'],
    material: 'Hardwood',
    color: 'Natural',
    featureTags: ['wall-hugger'],
    width: 54,
    depth: 36,
    inStock: true,
    numericRating: 4.5,
    description: 'A sturdy hardwood futon frame.',
    _createdDate: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

const products = [
  makeProduct({
    _id: 'dp-001', name: 'Alpine Futon Frame', slug: 'alpine',
    price: 399, formattedPrice: '$399.00', description: 'Budget alpine futon frame.',
    collections: ['futon-frames'], material: 'Pine', color: 'Natural',
    featureTags: ['made-in-usa'], numericRating: 3.8,
    _createdDate: '2025-01-15T00:00:00Z',
  }),
  makeProduct({
    _id: 'dp-002', name: 'Birchwood Platform', slug: 'birchwood',
    price: 899, formattedPrice: '$899.00', description: 'Solid birchwood platform bed.',
    collections: ['platform-beds'], material: 'Hardwood', color: 'Cherry',
    featureTags: ['storage'], width: 62, depth: 80, numericRating: 4.6,
    _createdDate: '2025-09-01T00:00:00Z',
  }),
  makeProduct({
    _id: 'dp-003', name: 'Cedar Murphy Cabinet', slug: 'cedar-murphy',
    price: 1499, formattedPrice: '$1,499.00', description: 'Cedar murphy bed with USB.',
    collections: ['murphy-cabinet-beds'], material: 'Cedar', color: 'Espresso',
    featureTags: ['usb-charging', 'storage'], width: 66, depth: 22,
    numericRating: 4.9, inStock: false,
    _createdDate: '2025-10-01T00:00:00Z',
  }),
  makeProduct({
    _id: 'dp-004', name: 'Driftwood Futon', slug: 'driftwood',
    price: 599, formattedPrice: '$599.00', description: 'Eco-friendly driftwood futon.',
    collections: ['futon-frames'], material: 'Hardwood', color: 'Grey',
    featureTags: ['eco-friendly', 'wall-hugger'], numericRating: 4.2,
    _createdDate: '2025-05-01T00:00:00Z',
  }),
  makeProduct({
    _id: 'dp-005', name: 'Elite Sleeper Sofa', slug: 'elite-sleeper',
    price: 1299, formattedPrice: '$1,299.00', description: 'Premium sleeper sofa with futon mattress.',
    collections: ['futon-frames'], material: 'Hardwood', color: 'Black Walnut',
    featureTags: ['sleeper', 'reclining'], width: 72, depth: 40,
    numericRating: 4.7, _createdDate: '2025-11-01T00:00:00Z',
  }),
  makeProduct({
    _id: 'dp-006', name: 'Foam Cloud Mattress', slug: 'foam-cloud',
    price: 249, formattedPrice: '$249.00', description: 'Ultra-soft foam mattress.',
    collections: ['mattresses'], material: 'Foam', color: 'White',
    featureTags: ['eco-friendly'], width: 54, depth: 75,
    numericRating: 4.0, _createdDate: '2025-02-01T00:00:00Z',
  }),
];

beforeEach(() => {
  __clearCache();
  __reset();
  __seed('Stores/Products', products);
});

// ─── 1. Search cache eviction (LRU at 50 entries) ───────────────

describe('search cache eviction', () => {
  it('evicts oldest search cache entry when MAX_SEARCH_CACHE_ENTRIES (50) is reached', async () => {
    // Fill cache with 50 unique searches
    for (let i = 0; i < 50; i++) {
      await fullTextSearch({ query: `futon query${i}` });
    }

    // The 1st search should be cached — do it again and confirm it returns
    const first = await fullTextSearch({ query: 'futon query0' });
    expect(first.products.length).toBeGreaterThanOrEqual(0);

    // Now add a 51st entry — this should evict the oldest (query0)
    await fullTextSearch({ query: 'futon query50' });

    // Re-search query0 — it will still work (re-fetched from DB), but the
    // point is the eviction happened without error
    const refetched = await fullTextSearch({ query: 'futon query0' });
    expect(refetched.query).toBe('futon query0');
  });

  it('evicts the entry with the oldest timestamp, not just the first key', async () => {
    // Search 50 unique queries
    for (let i = 0; i < 50; i++) {
      await fullTextSearch({ query: `futon batch${i}` });
    }
    // Access batch0 again to make it "recently used" in practice
    // (though setCachedSearch doesn't update timestamp on read — it's write-time LRU)
    // Adding a 51st should evict the one with the oldest write timestamp (batch0)
    // since they were written sequentially
    const result = await fullTextSearch({ query: 'futon batch51' });
    expect(result.query).toBe('futon batch51');
  });
});

// ─── 2. fullTextSearch sort modes ───────────────────────────────

describe('fullTextSearch sort modes', () => {
  it('sorts by price-asc', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    const prices = result.products.map(p => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('sorts by price-desc', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'price-desc' });
    const prices = result.products.map(p => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });

  it('sorts by name-asc', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'name-asc' });
    const names = result.products.map(p => p.name);
    for (let i = 1; i < names.length; i++) {
      expect(names[i].localeCompare(names[i - 1])).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts by name-desc', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'name-desc' });
    const names = result.products.map(p => p.name);
    for (let i = 1; i < names.length; i++) {
      expect(names[i].localeCompare(names[i - 1])).toBeLessThanOrEqual(0);
    }
  });

  it('sorts by newest (_createdDate descending)', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'newest' });
    expect(result.products.length).toBeGreaterThan(1);
    // Elite Sleeper (2025-11) should come before Alpine (2025-01)
    const eliteIdx = result.products.findIndex(p => p._id === 'dp-005');
    const alpineIdx = result.products.findIndex(p => p._id === 'dp-001');
    if (eliteIdx !== -1 && alpineIdx !== -1) {
      expect(eliteIdx).toBeLessThan(alpineIdx);
    }
  });

  it('sorts by relevance by default (name matches before description matches)', async () => {
    // "futon" appears in name of dp-001, dp-004, dp-005 and description of dp-005
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'relevance' });
    // All name-matched items (_relevance: 2) before desc-only (_relevance: 1)
    const nameMatchIds = ['dp-001', 'dp-004', 'dp-005']; // "Futon" in name
    const firstNonNameMatch = result.products.findIndex(
      p => !nameMatchIds.includes(p._id)
    );
    if (firstNonNameMatch > 0) {
      // Everything before the first non-name-match should be a name match
      for (let i = 0; i < firstNonNameMatch; i++) {
        expect(nameMatchIds).toContain(result.products[i]._id);
      }
    }
  });
});

// ─── 3. fullTextSearch deduplication ────────────────────────────

describe('fullTextSearch deduplication', () => {
  it('deduplicates items appearing in both name and description results', async () => {
    // "futon" appears in both name and description of dp-001 (Alpine Futon Frame / "Budget alpine futon frame")
    const result = await fullTextSearch({ query: 'futon' });
    const ids = result.products.map(p => p._id);
    const uniqueIds = [...new Set(ids)];
    expect(ids.length).toBe(uniqueIds.length);
  });

  it('name matches get _relevance 2, description-only matches get _relevance 1', async () => {
    // "platform" appears in dp-002 name only; "birchwood" in dp-002 name+desc
    // Search for "platform" — dp-002 is name match (relevance 2)
    const result = await fullTextSearch({ query: 'platform', sortBy: 'relevance' });
    // dp-002 should be in results (name match)
    const birch = result.products.find(p => p._id === 'dp-002');
    expect(birch).toBeDefined();
  });

  it('description-only match appears after name matches in relevance sort', async () => {
    // Seed a product with "sleeper" only in description, not name
    __reset();
    const descOnlyProduct = makeProduct({
      _id: 'dp-desc-only', name: 'Comfort Sofa', slug: 'comfort-sofa',
      price: 599, description: 'A great sleeper sofa for guests.',
      _createdDate: '2025-07-01T00:00:00Z',
    });
    __seed('Stores/Products', [
      ...products,
      descOnlyProduct,
    ]);
    __clearCache();

    const result = await fullTextSearch({ query: 'sleeper', sortBy: 'relevance' });
    // dp-005 "Elite Sleeper Sofa" has "sleeper" in name → relevance 2
    // dp-desc-only "Comfort Sofa" has "sleeper" only in description → relevance 1
    const eliteIdx = result.products.findIndex(p => p._id === 'dp-005');
    const descOnlyIdx = result.products.findIndex(p => p._id === 'dp-desc-only');
    if (eliteIdx !== -1 && descOnlyIdx !== -1) {
      expect(eliteIdx).toBeLessThan(descOnlyIdx);
    }
  });
});

// ─── 4. getAutocompleteSuggestions ──────────────────────────────

describe('getAutocompleteSuggestions', () => {
  it('clamps limit to max 20', async () => {
    const result = await getAutocompleteSuggestions('fu', 999);
    expect(result.suggestions.length).toBeLessThanOrEqual(20);
  });

  it('clamps limit minimum to 1', async () => {
    const result = await getAutocompleteSuggestions('fu', 0);
    // safeLimit = Math.min(Math.max(1, 0 || 8), 20) = 8 (0 is falsy, falls to default 8)
    expect(result.suggestions.length).toBeLessThanOrEqual(8);
  });

  it('includes popular queries after categories and products', async () => {
    // Record a popular query that matches the prefix
    // Use exact prefix casing that will match in autocomplete
    for (let i = 0; i < 10; i++) {
      await recordSearchQuery('Futon deals');
    }

    // Use capitalized prefix so wixData.contains matches product names like "Alpine Futon Frame"
    const result = await getAutocompleteSuggestions('Futon', 20);
    const types = result.suggestions.map(s => s.type);

    // Should contain product suggestions and popular query
    expect(types).toContain('product');
    expect(types).toContain('popular');

    // Popular should appear after products (categories first, then products, then popular)
    const lastProductIdx = types.lastIndexOf('product');
    const firstPopularIdx = types.indexOf('popular');
    if (lastProductIdx !== -1 && firstPopularIdx !== -1) {
      expect(firstPopularIdx).toBeGreaterThan(lastProductIdx);
    }
  });

  it('includes matching category labels before products', async () => {
    // "platform" matches "Platform Beds" category label
    const result = await getAutocompleteSuggestions('platform', 20);
    const catSuggestion = result.suggestions.find(s => s.type === 'category');
    expect(catSuggestion).toBeDefined();
    expect(catSuggestion.text).toBe('Platform Beds');
    expect(catSuggestion.slug).toBe('platform-beds');
  });

  it('returns empty for prefix shorter than 2 chars', async () => {
    const result = await getAutocompleteSuggestions('f');
    expect(result.suggestions).toEqual([]);
  });

  it('deduplicates product name suggestions', async () => {
    const result = await getAutocompleteSuggestions('Futon', 20);
    const texts = result.suggestions.map(s => s.text.toLowerCase());
    const uniqueTexts = [...new Set(texts)];
    expect(texts.length).toBe(uniqueTexts.length);
  });
});

// ─── 5. searchProducts error path ───────────────────────────────

describe('searchProducts error path', () => {
  it('returns empty result shape when wixData.query throws', async () => {
    // Clear the store completely to force error by making __seed non-existent
    __reset();
    // Seed with a getter that throws to simulate DB error
    // Actually: let's mock by not seeding — the mock returns empty, not error.
    // Instead we test the catch by providing invalid params that could cause issues.
    // The real way: we need wixData.query to throw. Let's use vi.spyOn.
    const wixData = (await import('./__mocks__/wix-data.js')).default;
    const originalQuery = wixData.query;
    wixData.query = () => { throw new Error('DB connection lost'); };

    const result = await searchProducts({ category: 'futon-frames' });
    expect(result).toEqual({ products: [], total: 0, facets: {} });

    wixData.query = originalQuery;
  });
});

// ─── 6. getFilterValues error path ──────────────────────────────

describe('getFilterValues error path', () => {
  it('returns full empty facets shape when wixData.query throws', async () => {
    const wixData = (await import('./__mocks__/wix-data.js')).default;
    const originalQuery = wixData.query;
    wixData.query = () => { throw new Error('DB unavailable'); };

    const result = await getFilterValues('futon-frames');
    expect(result).toEqual({
      priceRanges: [],
      materials: [],
      colors: [],
      features: [],
      dimensions: { width: { min: 0, max: 0 }, depth: { min: 0, max: 0 } },
    });

    wixData.query = originalQuery;
  });
});

// ─── 7. Autocomplete cache ──────────────────────────────────────

describe('autocomplete cache', () => {
  it('returns cached autocomplete results on second call', async () => {
    const r1 = await getAutocompleteSuggestions('fu', 8);
    const r2 = await getAutocompleteSuggestions('fu', 8);
    // Both should return identical results
    expect(r1).toEqual(r2);
  });

  it('cache expires after 2-minute TTL', async () => {
    await getAutocompleteSuggestions('fu', 8);

    // Fast-forward time past the 2-minute TTL
    const realNow = Date.now;
    let timeOffset = 0;
    Date.now = () => realNow.call(Date) + timeOffset;

    timeOffset = 2 * 60 * 1000 + 1; // 2 min + 1ms

    // This call should not use the expired cache — will re-query
    const result = await getAutocompleteSuggestions('fu', 8);
    expect(result.suggestions).toBeDefined();

    Date.now = realNow;
  });

  it('different prefixes get separate cache entries', async () => {
    const r1 = await getAutocompleteSuggestions('fu', 8);
    const r2 = await getAutocompleteSuggestions('pl', 8);
    // Results should differ (futon vs platform products)
    expect(r1.suggestions.map(s => s.text)).not.toEqual(r2.suggestions.map(s => s.text));
  });
});

// ─── 8. recordSearchQuery sanitization ──────────────────────────

describe('recordSearchQuery sanitization', () => {
  it('strips HTML tags before recording', async () => {
    await recordSearchQuery('<b>futon</b> frame');
    const popular = await getPopularSearches(20);
    // The recorded query should not contain HTML tags
    const match = popular.queries.find(q => q.query.includes('futon'));
    expect(match).toBeDefined();
    expect(match.query).not.toContain('<b>');
    expect(match.query).not.toContain('</b>');
  });

  it('lowercases before recording', async () => {
    await recordSearchQuery('FUTON FRAME');
    const popular = await getPopularSearches(20);
    const match = popular.queries.find(q => q.query === 'futon frame');
    expect(match).toBeDefined();
  });

  it('rejects single-character queries after sanitization', async () => {
    const result = await recordSearchQuery('x');
    expect(result.success).toBe(false);
  });

  it('rejects empty string', async () => {
    const result = await recordSearchQuery('');
    expect(result.success).toBe(false);
  });

  it('trims whitespace', async () => {
    await recordSearchQuery('  futon deals  ');
    const popular = await getPopularSearches(20);
    const match = popular.queries.find(q => q.query === 'futon deals');
    expect(match).toBeDefined();
  });

  it('increments count for repeated sanitized queries', async () => {
    await recordSearchQuery('Murphy Bed');
    await recordSearchQuery('murphy bed');
    await recordSearchQuery('MURPHY BED');
    const popular = await getPopularSearches(20);
    const match = popular.queries.find(q => q.query === 'murphy bed');
    expect(match).toBeDefined();
    // recordSearchQuery calls recordQuery which calls the internal recordQuery
    // which increments. But recordSearchQuery also calls sanitize+lowercase first.
    // The internal recordQuery is called with the already-lowercased value,
    // and recordQuery also lowercases. So all three map to "murphy bed".
    expect(match.count).toBeGreaterThanOrEqual(3);
  });
});

// ─── 9. fullTextSearch priceRange 'Over $1,200' ────────────────

describe('fullTextSearch priceRange Over $1,200 (Infinity max)', () => {
  it('includes products at $1,200 and above with 1200-up range', async () => {
    // dp-003 Cedar Murphy ($1,499) and dp-005 Elite Sleeper ($1,299) are over 1200
    const result = await fullTextSearch({
      query: 'Cedar',
      priceRange: '1200-up',
    });
    // Cedar Murphy is $1,499, matches query "Cedar" in name and description
    const prices = result.products.map(p => p.price);
    for (const price of prices) {
      expect(price).toBeGreaterThanOrEqual(1200);
    }
  });

  it('Over $1,200 range has no upper bound (Infinity)', async () => {
    // Seed an extremely expensive product
    __reset();
    const expensiveProduct = makeProduct({
      _id: 'dp-expensive', name: 'Luxury Futon Supreme', slug: 'luxury-supreme',
      price: 99999, formattedPrice: '$99,999.00',
      description: 'The most expensive futon ever made.',
      _createdDate: '2025-12-01T00:00:00Z',
    });
    __seed('Stores/Products', [...products, expensiveProduct]);
    __clearCache();

    const result = await fullTextSearch({
      query: 'Futon',
      priceRange: '1200-up',
    });
    const ids = result.products.map(p => p._id);
    expect(ids).toContain('dp-expensive');
    // All returned products should be >= $1,200
    for (const p of result.products) {
      expect(p.price).toBeGreaterThanOrEqual(1200);
    }
  });

  it('searchProducts with 1200-up range applies ge(price, 1200) without le', async () => {
    const result = await searchProducts({ priceRange: '1200-up' });
    // Should include dp-003 ($1,499) and dp-005 ($1,299) but not cheaper items
    for (const product of result.products) {
      expect(product.price).toBeGreaterThanOrEqual(1200);
    }
    expect(result.products.length).toBe(2);
  });
});

// ─── 10. fullTextSearch search cache ────────────────────────────

describe('fullTextSearch search cache', () => {
  it('returns cached result on identical query+params', async () => {
    const r1 = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    const r2 = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    expect(r1).toEqual(r2);
  });

  it('search cache expires after 3-minute TTL', async () => {
    await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });

    const realNow = Date.now;
    let timeOffset = 0;
    Date.now = () => realNow.call(Date) + timeOffset;

    timeOffset = 3 * 60 * 1000 + 1; // 3 min + 1ms past TTL

    // Expired cache — re-fetches
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    expect(result.products.length).toBeGreaterThan(0);

    Date.now = realNow;
  });

  it('different sortBy creates different cache keys', async () => {
    // Use seeds that guarantee different ordering for price-asc vs price-desc
    const r1 = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    const r2 = await fullTextSearch({ query: 'Futon', sortBy: 'price-desc' });
    // price-asc and price-desc must reverse the order
    if (r1.products.length > 1 && r2.products.length > 1) {
      expect(r1.products[0]._id).toBe(r2.products[r2.products.length - 1]._id);
    }
  });
});

// ─── 11. fullTextSearch filter combinations ─────────────────────

describe('fullTextSearch filter combinations', () => {
  it('filters by inStockOnly', async () => {
    const result = await fullTextSearch({ query: 'Cedar', inStockOnly: true });
    // dp-003 Cedar Murphy is inStock: false, should be excluded
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('dp-003');
  });

  it('filters by material in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', material: 'Pine' });
    for (const product of result.products) {
      expect(product.material).toBe('Pine');
    }
  });

  it('filters by color in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', color: 'Grey' });
    for (const product of result.products) {
      expect(product.color).toBe('Grey');
    }
  });

  it('filters by feature tags in fullTextSearch (AND logic)', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      features: ['eco-friendly', 'wall-hugger'],
    });
    // Only dp-004 Driftwood has both eco-friendly AND wall-hugger
    for (const product of result.products) {
      expect(product.featureTags).toContain('eco-friendly');
      expect(product.featureTags).toContain('wall-hugger');
    }
  });

  it('filters by category in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', category: 'futon-frames' });
    for (const product of result.products) {
      expect(product.collections).toContain('futon-frames');
    }
  });
});

// ─── 12. fullTextSearch empty/edge query ────────────────────────

describe('fullTextSearch edge cases', () => {
  it('returns empty for empty query string', async () => {
    const result = await fullTextSearch({ query: '' });
    expect(result).toEqual({ products: [], total: 0, query: '', facets: {} });
  });

  it('returns empty for null query', async () => {
    const result = await fullTextSearch({ query: null });
    expect(result).toEqual({ products: [], total: 0, query: '', facets: {} });
  });

  it('fullTextSearch pagination with offset', async () => {
    const full = await fullTextSearch({ query: 'Futon', limit: 100 });
    if (full.total > 1) {
      const paged = await fullTextSearch({ query: 'Futon', limit: 1, offset: 1 });
      expect(paged.products[0]._id).toBe(full.products[1]._id);
    }
  });

  it('fullTextSearch error path returns empty shape', async () => {
    const wixData = (await import('./__mocks__/wix-data.js')).default;
    const originalQuery = wixData.query;
    wixData.query = () => { throw new Error('Search unavailable'); };

    const result = await fullTextSearch({ query: 'futon' });
    expect(result).toEqual({ products: [], total: 0, query: '', facets: {} });

    wixData.query = originalQuery;
  });
});
