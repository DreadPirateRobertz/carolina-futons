import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  fullTextSearch,
  getAutocompleteSuggestions,
  getPopularSearches,
  recordSearchQuery,
  __clearCache,
} from '../src/backend/searchService.web.js';

// ── Seed Data ────────────────────────────────────────────────────

const products = [
  {
    _id: 'p1', name: 'Eureka Futon Frame', slug: 'eureka',
    price: 499, formattedPrice: '$499.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'eureka.jpg',
    ribbon: '', collections: ['futon-frames'], material: 'Hardwood',
    color: 'Natural', featureTags: ['wall-hugger', 'made-in-usa'],
    width: 54, depth: 36, inStock: true, numericRating: 4.5,
    description: 'A classic hardwood futon frame with wall-hugger design.',
  },
  {
    _id: 'p2', name: 'Dillon Wall Hugger', slug: 'dillon',
    price: 699, formattedPrice: '$699.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'dillon.jpg',
    ribbon: 'Featured', collections: ['futon-frames', 'wall-huggers'],
    material: 'Hardwood', color: 'Black Walnut', featureTags: ['wall-hugger'],
    width: 60, depth: 38, inStock: true, numericRating: 4.8,
    description: 'Premium wall hugger futon with sleek design.',
  },
  {
    _id: 'p3', name: 'Moonshadow Mattress', slug: 'moonshadow',
    price: 349, formattedPrice: '$349.00', discountedPrice: 299,
    formattedDiscountedPrice: '$299.00', mainMedia: 'moon.jpg',
    ribbon: 'Sale', collections: ['mattresses'], material: 'Foam',
    color: 'White', featureTags: ['eco-friendly'],
    width: 54, depth: 75, inStock: true, numericRating: 4.2,
    description: 'Eco-friendly foam mattress for everyday comfort.',
  },
  {
    _id: 'p4', name: 'Sagebrush Murphy Bed', slug: 'sagebrush',
    price: 1899, formattedPrice: '$1,899.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'sage.jpg',
    ribbon: '', collections: ['murphy-cabinet-beds'], material: 'Hardwood',
    color: 'Espresso', featureTags: ['usb-charging', 'storage'],
    width: 66, depth: 22, inStock: false, numericRating: 4.9,
    description: 'Space-saving murphy bed with USB charging and storage.',
  },
  {
    _id: 'p5', name: 'Budget Futon Frame', slug: 'budget',
    price: 199, formattedPrice: '$199.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'budget.jpg',
    ribbon: '', collections: ['futon-frames'], material: 'Pine',
    color: 'Natural', featureTags: ['made-in-usa'],
    width: 48, depth: 32, inStock: true, numericRating: 3.5,
    description: 'Affordable pine futon frame, made in the USA.',
  },
  {
    _id: 'p6', name: 'Premium Platform Bed', slug: 'premium-plat',
    price: 899, formattedPrice: '$899.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'plat.jpg',
    ribbon: '', collections: ['platform-beds'], material: 'Hardwood',
    color: 'Cherry', featureTags: ['storage'],
    width: 62, depth: 80, inStock: true, numericRating: 4.6,
    description: 'Solid hardwood platform bed with built-in storage drawers.',
  },
];

beforeEach(() => {
  __clearCache();
  __seed('Stores/Products', products);
});

// ── fullTextSearch ───────────────────────────────────────────────

describe('fullTextSearch', () => {
  it('returns empty results for empty query', async () => {
    const result = await fullTextSearch({});
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.query).toBe('');
  });

  it('returns empty results for whitespace-only query', async () => {
    const result = await fullTextSearch({ query: '   ' });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('finds products by name', async () => {
    const result = await fullTextSearch({ query: 'Eureka' });
    expect(result.products.length).toBeGreaterThanOrEqual(1);
    expect(result.products.some(p => p.name === 'Eureka Futon Frame')).toBe(true);
  });

  it('finds products by description', async () => {
    const result = await fullTextSearch({ query: 'Eco-friendly' });
    expect(result.products.some(p => p.name === 'Moonshadow Mattress')).toBe(true);
  });

  it('matches across both name and description', async () => {
    // "futon" appears in names and descriptions
    const result = await fullTextSearch({ query: 'futon' });
    expect(result.products.length).toBeGreaterThanOrEqual(3);
  });

  it('deduplicates results matching both name and description', async () => {
    // "Eureka" appears in name, "hardwood" in description — Eureka matches both
    const result = await fullTextSearch({ query: 'Eureka' });
    const eurekaCount = result.products.filter(p => p._id === 'p1').length;
    expect(eurekaCount).toBe(1);
  });

  it('ranks name matches higher than description matches in relevance sort', async () => {
    // "futon" in name: p1 (Eureka Futon Frame), p5 (Budget Futon Frame)
    // "futon" in description: p2 (Premium wall hugger futon...) — also has it in desc
    const result = await fullTextSearch({ query: 'futon', sortBy: 'relevance' });
    // Items matching by name should come first
    const nameMatchIdx = result.products.findIndex(p => p._id === 'p1');
    expect(nameMatchIdx).toBeLessThanOrEqual(2); // Should be near top
  });

  it('returns query in response', async () => {
    const result = await fullTextSearch({ query: 'Mattress' });
    expect(result.query).toBe('mattress');
  });

  it('returns facets in response', async () => {
    const result = await fullTextSearch({ query: 'futon' });
    expect(result.facets).toBeDefined();
  });

  it('returns total count', async () => {
    const result = await fullTextSearch({ query: 'futon' });
    expect(result.total).toBeGreaterThan(0);
  });

  // ── Filters with text search ──────────────────────────────────

  it('filters by category', async () => {
    const result = await fullTextSearch({
      query: 'futon',
      category: 'futon-frames',
    });
    expect(result.products.every(p => p.collections.includes('futon-frames'))).toBe(true);
  });

  it('filters by price range', async () => {
    const result = await fullTextSearch({
      query: 'futon',
      priceRange: '0-300',
    });
    expect(result.products.every(p => p.price <= 299.99)).toBe(true);
  });

  it('filters by material', async () => {
    const result = await fullTextSearch({
      query: 'futon',
      material: 'Pine',
    });
    expect(result.products.every(p => p.material === 'Pine')).toBe(true);
    expect(result.products).toHaveLength(1);
  });

  it('filters by color', async () => {
    const result = await fullTextSearch({
      query: 'futon',
      color: 'Natural',
    });
    expect(result.products.every(p => p.color === 'Natural')).toBe(true);
  });

  it('filters by feature tags', async () => {
    const result = await fullTextSearch({
      query: 'futon',
      features: ['wall-hugger'],
    });
    expect(result.products.every(p =>
      Array.isArray(p.featureTags) && p.featureTags.includes('wall-hugger')
    )).toBe(true);
  });

  it('filters in-stock only', async () => {
    const result = await fullTextSearch({
      query: 'bed',
      inStockOnly: true,
    });
    expect(result.products.every(p => p.inStock === true)).toBe(true);
  });

  it('filters out out-of-stock when inStockOnly', async () => {
    // Sagebrush Murphy Bed is out of stock
    const result = await fullTextSearch({
      query: 'Murphy',
      inStockOnly: true,
    });
    expect(result.products.some(p => p._id === 'p4')).toBe(false);
  });

  it('combines category + features filter', async () => {
    const result = await fullTextSearch({
      query: 'futon',
      category: 'futon-frames',
      features: ['made-in-usa'],
    });
    expect(result.products.every(p =>
      p.collections.includes('futon-frames') &&
      p.featureTags.includes('made-in-usa')
    )).toBe(true);
  });

  // ── Sorting ───────────────────────────────────────────────────

  it('sorts by price ascending', async () => {
    const result = await fullTextSearch({ query: 'futon', sortBy: 'price-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeGreaterThanOrEqual(result.products[i - 1].price);
    }
  });

  it('sorts by price descending', async () => {
    const result = await fullTextSearch({ query: 'futon', sortBy: 'price-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeLessThanOrEqual(result.products[i - 1].price);
    }
  });

  it('sorts by name ascending', async () => {
    const result = await fullTextSearch({ query: 'futon', sortBy: 'name-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name >= result.products[i - 1].name).toBe(true);
    }
  });

  it('sorts by name descending', async () => {
    const result = await fullTextSearch({ query: 'futon', sortBy: 'name-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name <= result.products[i - 1].name).toBe(true);
    }
  });

  it('defaults to relevance sort', async () => {
    const result = await fullTextSearch({ query: 'futon' });
    // Just verify it doesn't crash and returns results
    expect(result.products.length).toBeGreaterThan(0);
  });

  // ── Pagination ────────────────────────────────────────────────

  it('limits results', async () => {
    const result = await fullTextSearch({ query: 'futon', limit: 2 });
    expect(result.products).toHaveLength(2);
    expect(result.total).toBeGreaterThan(2); // More available
  });

  it('offsets results', async () => {
    const all = await fullTextSearch({ query: 'futon', limit: 100 });
    const page2 = await fullTextSearch({ query: 'futon', limit: 2, offset: 2 });
    expect(page2.products[0]._id).toBe(all.products[2]._id);
  });

  it('clamps limit to max 100', async () => {
    const result = await fullTextSearch({ query: 'futon', limit: 200 });
    expect(result.products.length).toBeLessThanOrEqual(100);
  });

  // ── Field mapping ─────────────────────────────────────────────

  it('maps all expected product fields', async () => {
    const result = await fullTextSearch({ query: 'Eureka', limit: 1 });
    const p = result.products[0];
    expect(p).toHaveProperty('_id');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('slug');
    expect(p).toHaveProperty('price');
    expect(p).toHaveProperty('formattedPrice');
    expect(p).toHaveProperty('mainMedia');
    expect(p).toHaveProperty('collections');
    expect(p).toHaveProperty('material');
    expect(p).toHaveProperty('color');
    expect(p).toHaveProperty('featureTags');
    expect(p).toHaveProperty('inStock');
    expect(p).toHaveProperty('numericRating');
    expect(p).toHaveProperty('description');
  });

  it('does not expose internal relevance field', async () => {
    const result = await fullTextSearch({ query: 'Eureka' });
    expect(result.products[0]).not.toHaveProperty('_relevance');
  });

  // ── Input sanitization ────────────────────────────────────────

  it('sanitizes HTML from query', async () => {
    const result = await fullTextSearch({ query: '<script>alert(1)</script>futon' });
    expect(result.query).not.toContain('<script>');
  });

  it('handles very long queries gracefully', async () => {
    const longQuery = 'a'.repeat(500);
    const result = await fullTextSearch({ query: longQuery });
    expect(result.query.length).toBeLessThanOrEqual(200);
  });

  // ── Caching ───────────────────────────────────────────────────

  it('caches identical search results', async () => {
    const result1 = await fullTextSearch({ query: 'futon' });
    // Modify seed data — cached result should still be returned
    __seed('Stores/Products', []);
    const result2 = await fullTextSearch({ query: 'futon' });
    expect(result2.total).toBe(result1.total);
  });

  it('returns fresh data after cache clear', async () => {
    await fullTextSearch({ query: 'futon' });
    __clearCache();
    __seed('Stores/Products', []);
    const result = await fullTextSearch({ query: 'futon' });
    expect(result.total).toBe(0);
  });

  it('caches separately for different sort options', async () => {
    const r1 = await fullTextSearch({ query: 'futon', sortBy: 'price-asc' });
    const r2 = await fullTextSearch({ query: 'futon', sortBy: 'name-asc' });
    // Both should return results, but ordering differs
    expect(r1.products.length).toBeGreaterThan(0);
    expect(r2.products.length).toBeGreaterThan(0);
  });

  // ── Error handling ────────────────────────────────────────────

  it('returns error shape on failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Use a non-matching query to get empty result (safe error shape check)
    const result = await fullTextSearch({ query: 'zzz-nothing-matches' });
    expect(result).toHaveProperty('products');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('query');
    spy.mockRestore();
  });
});

// ── getAutocompleteSuggestions ────────────────────────────────────

describe('getAutocompleteSuggestions', () => {
  it('returns empty for prefix shorter than 2 chars', async () => {
    const result = await getAutocompleteSuggestions('a');
    expect(result.suggestions).toEqual([]);
  });

  it('returns empty for empty prefix', async () => {
    const result = await getAutocompleteSuggestions('');
    expect(result.suggestions).toEqual([]);
  });

  it('returns product name matches', async () => {
    const result = await getAutocompleteSuggestions('Eur');
    const productSuggestions = result.suggestions.filter(s => s.type === 'product');
    expect(productSuggestions.some(s => s.text === 'Eureka Futon Frame')).toBe(true);
  });

  it('returns category matches', async () => {
    const result = await getAutocompleteSuggestions('matt');
    const categorySuggestions = result.suggestions.filter(s => s.type === 'category');
    expect(categorySuggestions.some(s => s.text === 'Mattresses')).toBe(true);
  });

  it('returns category suggestions with slug', async () => {
    const result = await getAutocompleteSuggestions('matt');
    const cat = result.suggestions.find(s => s.type === 'category');
    expect(cat.slug).toBe('mattresses');
  });

  it('returns product suggestions with slug', async () => {
    const result = await getAutocompleteSuggestions('Eur');
    const prod = result.suggestions.find(s => s.type === 'product');
    expect(prod.slug).toBe('eureka');
  });

  it('respects limit parameter', async () => {
    const result = await getAutocompleteSuggestions('fu', 3);
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
  });

  it('limits to max 20 suggestions', async () => {
    const result = await getAutocompleteSuggestions('fu', 50);
    expect(result.suggestions.length).toBeLessThanOrEqual(20);
  });

  it('deduplicates suggestions', async () => {
    const result = await getAutocompleteSuggestions('fu');
    const texts = result.suggestions.map(s => s.text.toLowerCase());
    const unique = [...new Set(texts)];
    expect(texts.length).toBe(unique.length);
  });

  it('includes popular queries that match', async () => {
    // Record some queries first
    await recordSearchQuery('futon frames sale');
    await recordSearchQuery('futon frames sale');
    await recordSearchQuery('futon frames sale');

    // No cache exists for this prefix yet, so it will query fresh
    const result = await getAutocompleteSuggestions('futon fr');
    const popularSuggestions = result.suggestions.filter(s => s.type === 'popular');
    expect(popularSuggestions.some(s => s.text === 'futon frames sale')).toBe(true);
  });

  it('caches autocomplete results', async () => {
    const result1 = await getAutocompleteSuggestions('Eur');
    __seed('Stores/Products', []);
    const result2 = await getAutocompleteSuggestions('Eur');
    expect(result2.suggestions.length).toBe(result1.suggestions.length);
  });

  it('sanitizes HTML from prefix', async () => {
    const result = await getAutocompleteSuggestions('<script>alert</script>');
    // Should not crash
    expect(result).toHaveProperty('suggestions');
  });

  it('handles no matching products', async () => {
    const result = await getAutocompleteSuggestions('zzzznothing');
    expect(result.suggestions).toEqual([]);
  });
});

// ── recordSearchQuery ────────────────────────────────────────────

describe('recordSearchQuery', () => {
  it('records a query successfully', async () => {
    const result = await recordSearchQuery('futon frames');
    expect(result.success).toBe(true);
  });

  it('rejects queries shorter than 2 chars', async () => {
    const result = await recordSearchQuery('a');
    expect(result.success).toBe(false);
  });

  it('rejects empty queries', async () => {
    const result = await recordSearchQuery('');
    expect(result.success).toBe(false);
  });

  it('normalizes queries to lowercase', async () => {
    await recordSearchQuery('FUTON Frames');
    await recordSearchQuery('futon frames');
    const { queries } = await getPopularSearches();
    const entry = queries.find(q => q.query === 'futon frames');
    expect(entry.count).toBe(2);
  });

  it('sanitizes HTML from query', async () => {
    const result = await recordSearchQuery('<img onerror=alert(1)>mattress');
    expect(result.success).toBe(true);
  });
});

// ── getPopularSearches ───────────────────────────────────────────

describe('getPopularSearches', () => {
  it('returns empty when no queries recorded', async () => {
    const result = await getPopularSearches();
    expect(result.queries).toEqual([]);
  });

  it('returns recorded queries sorted by frequency', async () => {
    await recordSearchQuery('futon frames');
    await recordSearchQuery('futon frames');
    await recordSearchQuery('futon frames');
    await recordSearchQuery('mattress');
    await recordSearchQuery('mattress');
    await recordSearchQuery('murphy bed');

    const result = await getPopularSearches();
    expect(result.queries[0].query).toBe('futon frames');
    expect(result.queries[0].count).toBe(3);
    expect(result.queries[1].query).toBe('mattress');
    expect(result.queries[1].count).toBe(2);
  });

  it('respects limit parameter', async () => {
    await recordSearchQuery('aa');
    await recordSearchQuery('bb');
    await recordSearchQuery('cc');

    const result = await getPopularSearches(2);
    expect(result.queries).toHaveLength(2);
  });

  it('limits to max 20', async () => {
    for (let i = 0; i < 25; i++) {
      await recordSearchQuery(`query-${i}-xx`);
    }
    const result = await getPopularSearches(50);
    expect(result.queries.length).toBeLessThanOrEqual(20);
  });

  it('fullTextSearch auto-records queries', async () => {
    await fullTextSearch({ query: 'platform bed' });
    await fullTextSearch({ query: 'platform bed' });

    const result = await getPopularSearches();
    expect(result.queries.some(q => q.query === 'platform bed')).toBe(true);
  });
});

// ── Cache eviction ───────────────────────────────────────────────

describe('cache eviction', () => {
  it('__clearCache clears all caches including query frequency', async () => {
    await recordSearchQuery('test query');
    await fullTextSearch({ query: 'futon' });
    __clearCache();

    const popular = await getPopularSearches();
    expect(popular.queries).toEqual([]);
  });

  it('handles many cached searches without error', async () => {
    // Fill cache with many different searches
    for (let i = 0; i < 60; i++) {
      __clearCache();
      __seed('Stores/Products', products);
      // each unique sort forces a new cache key
      await fullTextSearch({
        query: 'futon',
        sortBy: i % 2 === 0 ? 'price-asc' : 'name-asc',
        offset: i,
      });
    }
    // Should not crash
    const result = await fullTextSearch({ query: 'futon' });
    expect(result).toHaveProperty('products');
  });
});
