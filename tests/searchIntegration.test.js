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
    inStock: true, numericRating: 4.7, description: 'Solid hardwood futon frame with wall-hugger design.',
  },
  {
    _id: 'cf-002', name: 'Phoenix Futon Frame', slug: 'phoenix-futon',
    price: 699, formattedPrice: '$699.00', discountedPrice: 599,
    formattedDiscountedPrice: '$599.00', mainMedia: 'phoenix.jpg',
    ribbon: 'Sale', collections: ['futon-frames', 'wall-huggers'],
    material: 'Hardwood', color: 'Espresso', featureTags: ['wall-hugger', 'usb-charging'],
    brand: 'Night & Day', width: 60, depth: 38, height: 34,
    inStock: true, numericRating: 4.9, description: 'Premium wall-hugger with USB ports.',
  },
  {
    _id: 'cf-003', name: 'Moonshadow Futon Mattress', slug: 'moonshadow-mattress',
    price: 349, formattedPrice: '$349.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'moon.jpg',
    ribbon: '', collections: ['mattresses'], material: 'Foam',
    color: 'White', featureTags: ['eco-friendly', 'organic'],
    brand: 'Gold Bond', width: 54, depth: 75, height: 8,
    inStock: true, numericRating: 4.2, description: 'Eco-friendly foam mattress.',
  },
  {
    _id: 'cf-004', name: 'Sagebrush Murphy Cabinet Bed', slug: 'sagebrush-murphy',
    price: 1899, formattedPrice: '$1,899.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'sage.jpg',
    ribbon: 'Featured', collections: ['murphy-cabinet-beds'],
    material: 'Hardwood', color: 'Espresso', featureTags: ['usb-charging', 'storage'],
    brand: 'Arason', width: 66, depth: 22, height: 42,
    inStock: true, numericRating: 4.9, description: 'Space-saving murphy bed with USB charging.',
  },
  {
    _id: 'cf-005', name: 'Budget Pine Futon Frame', slug: 'budget-pine',
    price: 199, formattedPrice: '$199.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'budget.jpg',
    ribbon: '', collections: ['futon-frames'], material: 'Softwood',
    color: 'Natural Oak', featureTags: [],
    brand: 'Carolina Futons', width: 54, depth: 36, height: 30,
    inStock: false, numericRating: 3.8, description: 'Affordable pine futon frame.',
  },
  {
    _id: 'cf-006', name: 'Platform Bed Walnut', slug: 'platform-walnut',
    price: 899, formattedPrice: '$899.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'platform.jpg',
    ribbon: '', collections: ['platform-beds'], material: 'Hardwood',
    color: 'Black Walnut', featureTags: ['made-in-usa'],
    brand: 'Night & Day', width: 60, depth: 80, height: 14,
    inStock: true, numericRating: 4.6, description: 'Low-profile walnut platform bed.',
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

// ── Integration: fullTextSearch ───────────────────────────────────
// Note: wix-data mock's contains() is case-sensitive, so queries must
// match the case used in seed data (e.g., "Futon" not "futon").

describe('Search Integration: fullTextSearch', () => {
  it('returns products matching query in name', async () => {
    // "Futon" matches Seattle, Phoenix, Moonshadow, Budget in name
    const result = await fullTextSearch({ query: 'Futon' });
    expect(result.products.length).toBeGreaterThanOrEqual(3);
    result.products.forEach((p) => {
      expect(
        p.name.includes('Futon') || (p.description || '').includes('Futon')
      ).toBe(true);
    });
  });

  it('returns products matching query in description', async () => {
    // "USB" appears in Phoenix and Sagebrush descriptions
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
    // Search for "hardwood" in description, filter by Hardwood material
    const result = await fullTextSearch({ query: 'hardwood', material: 'Hardwood' });
    expect(result.products.length).toBeGreaterThan(0);
    result.products.forEach((p) => {
      expect(p.material).toBe('Hardwood');
    });
  });

  it('with color filter returns matching products', async () => {
    // "Premium" in Phoenix description + Espresso color filter
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
});

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
});

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
});

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
});

describe('Search Integration: categorySearch → Category Page', () => {
  it('returns items in collection', async () => {
    const result = await categorySearch({ category: 'futon-frames' });
    // categorySearch returns { items, totalCount, hasMore }
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

  it('inStockOnly excludes out-of-stock items', async () => {
    const result = await categorySearch({
      category: 'futon-frames',
      inStockOnly: true,
    });
    result.items.forEach((p) => {
      expect(p.inStock).toBe(true);
    });
    // Budget Pine is out of stock
    expect(result.items.some((p) => p._id === 'cf-005')).toBe(false);
  });

  it('getFilteredProductCount returns correct count', async () => {
    const result = await getFilteredProductCount({ category: 'futon-frames' });
    expect(result.count).toBe(3);
  });

  it('getFacetMetadata builds filter options with materials', async () => {
    const facets = await getFacetMetadata('futon-frames');
    expect(facets).toHaveProperty('materials');
    expect(Array.isArray(facets.materials)).toBe(true);
    expect(facets.materials.length).toBeGreaterThan(0);
  });

  it('suggestFilterRelaxation returns suggestions for impossible combination', async () => {
    const suggestion = await suggestFilterRelaxation({
      category: 'mattresses',
      materials: ['Hardwood'],
      colors: ['Black Walnut'],
    });
    expect(suggestion).toHaveProperty('suggestions');
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

  it('pagination with skip + limit', async () => {
    const page1 = await categorySearch({ limit: 2, skip: 0 });
    const page2 = await categorySearch({ limit: 2, skip: 2 });

    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBe(2);
    const ids1 = new Set(page1.items.map((p) => p._id));
    page2.items.forEach((p) => {
      expect(ids1.has(p._id)).toBe(false);
    });
  });

  it('hasMore indicates additional pages exist', async () => {
    const result = await categorySearch({ limit: 2, skip: 0 });
    // 6 total products, limit 2 → hasMore should be true
    expect(result.hasMore).toBe(true);
  });

  it('totalCount reflects full set regardless of limit', async () => {
    const result = await categorySearch({ limit: 2, skip: 0 });
    expect(result.totalCount).toBe(6);
  });
});

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

    // searchService returns .total, categorySearch returns .totalCount
    expect(search.total).toBe(cat.totalCount);
  });

  it('caches are independent between services', async () => {
    await getFilterValues('futon-frames');
    await getFacetMetadata('futon-frames');

    // Clear only searchService cache
    __clearCache();

    // categorySearch cache should still work
    const facets = await getFacetMetadata('futon-frames');
    expect(facets).toHaveProperty('materials');
    expect(facets.materials.length).toBeGreaterThan(0);
  });
});
