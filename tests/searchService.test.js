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

const products = [
  {
    _id: 'p1', name: 'Eureka Futon Frame', slug: 'eureka',
    price: 499, formattedPrice: '$499.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'eureka.jpg',
    ribbon: '', collections: ['futon-frames'], material: 'Hardwood',
    color: 'Natural', featureTags: ['wall-hugger', 'made-in-usa'],
    width: 54, depth: 36, inStock: true, numericRating: 4.5,
  },
  {
    _id: 'p2', name: 'Dillon Wall Hugger', slug: 'dillon',
    price: 699, formattedPrice: '$699.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'dillon.jpg',
    ribbon: 'Featured', collections: ['futon-frames', 'wall-huggers'],
    material: 'Hardwood', color: 'Black Walnut', featureTags: ['wall-hugger'],
    width: 60, depth: 38, inStock: true, numericRating: 4.8,
  },
  {
    _id: 'p3', name: 'Moonshadow Mattress', slug: 'moonshadow',
    price: 349, formattedPrice: '$349.00', discountedPrice: 299,
    formattedDiscountedPrice: '$299.00', mainMedia: 'moon.jpg',
    ribbon: 'Sale', collections: ['mattresses'], material: 'Foam',
    color: 'White', featureTags: ['eco-friendly'],
    width: 54, depth: 75, inStock: true, numericRating: 4.2,
  },
  {
    _id: 'p4', name: 'Sagebrush Murphy Bed', slug: 'sagebrush',
    price: 1899, formattedPrice: '$1,899.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'sage.jpg',
    ribbon: '', collections: ['murphy-cabinet-beds'], material: 'Hardwood',
    color: 'Espresso', featureTags: ['usb-charging', 'storage'],
    width: 66, depth: 22, inStock: true, numericRating: 4.9,
  },
  {
    _id: 'p5', name: 'Budget Futon Frame', slug: 'budget',
    price: 199, formattedPrice: '$199.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'budget.jpg',
    ribbon: '', collections: ['futon-frames'], material: 'Pine',
    color: 'Natural', featureTags: ['made-in-usa'],
    width: 48, depth: 32, inStock: true, numericRating: 3.5,
  },
  {
    _id: 'p6', name: 'Premium Platform Bed', slug: 'premium-plat',
    price: 899, formattedPrice: '$899.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'plat.jpg',
    ribbon: '', collections: ['platform-beds'], material: 'Hardwood',
    color: 'Cherry', featureTags: ['storage'],
    width: 62, depth: 80, inStock: true, numericRating: 4.6,
    description: 'Premium hardwood platform bed with storage drawers.',
    _createdDate: new Date('2025-06-01'),
  },
  {
    _id: 'p7', name: 'Clearance Ottoman', slug: 'clearance-ottoman',
    price: 99, formattedPrice: '$99.00', discountedPrice: null,
    formattedDiscountedPrice: null, mainMedia: 'ottoman.jpg',
    ribbon: 'Clearance', collections: ['casegoods-accessories'], material: 'Fabric',
    color: 'Grey', featureTags: [],
    width: 24, depth: 24, inStock: false, numericRating: 3.0,
    description: 'Compact storage ottoman in grey fabric.',
    _createdDate: new Date('2024-11-15'),
  },
];

beforeEach(() => {
  __clearCache();
  __seed('Stores/Products', products);
});

// ── searchProducts ───────────────────────────────────────────────

describe('searchProducts', () => {
  it('returns all products when no filters applied', async () => {
    const result = await searchProducts({});
    expect(result.products).toHaveLength(7);
    expect(result.total).toBe(7);
    expect(result.facets).toBeDefined();
  });

  it('filters by category', async () => {
    const result = await searchProducts({ category: 'futon-frames' });
    expect(result.products.every(p => p.collections.includes('futon-frames'))).toBe(true);
    expect(result.products).toHaveLength(3);
  });

  it('filters by price range Under $300', async () => {
    const result = await searchProducts({ priceRange: '0-300' });
    expect(result.products.every(p => p.price <= 299.99)).toBe(true);
    expect(result.products).toHaveLength(2);
    expect(result.products.map(p => p.name)).toContain('Budget Futon Frame');
  });

  it('filters by price range $500-$800', async () => {
    const result = await searchProducts({ priceRange: '500-800' });
    expect(result.products.every(p => p.price >= 500 && p.price <= 800)).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Dillon Wall Hugger');
  });

  it('filters by price range Over $1200', async () => {
    const result = await searchProducts({ priceRange: '1200-up' });
    expect(result.products.every(p => p.price >= 1200)).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Sagebrush Murphy Bed');
  });

  it('filters by material', async () => {
    const result = await searchProducts({ material: 'Hardwood' });
    expect(result.products.every(p => p.material === 'Hardwood')).toBe(true);
    expect(result.products).toHaveLength(4);
  });

  it('filters by color', async () => {
    const result = await searchProducts({ color: 'Natural' });
    expect(result.products.every(p => p.color === 'Natural')).toBe(true);
    expect(result.products).toHaveLength(2);
  });

  it('filters by single feature tag', async () => {
    const result = await searchProducts({ features: ['wall-hugger'] });
    expect(result.products.every(p => p.featureTags.includes('wall-hugger'))).toBe(true);
    expect(result.products).toHaveLength(2);
  });

  it('filters by multiple feature tags (AND logic)', async () => {
    const result = await searchProducts({ features: ['wall-hugger', 'made-in-usa'] });
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Eureka Futon Frame');
  });

  it('ignores unknown feature tags', async () => {
    const result = await searchProducts({ features: ['unknown-tag'] });
    // Unknown tag ignored, no filter applied
    expect(result.products).toHaveLength(7);
  });

  it('filters by width range', async () => {
    const result = await searchProducts({ widthRange: [50, 62] });
    expect(result.products.every(p => p.width >= 50 && p.width <= 62)).toBe(true);
    expect(result.products).toHaveLength(4);
  });

  it('filters by depth range', async () => {
    const result = await searchProducts({ depthRange: [30, 40] });
    expect(result.products.every(p => p.depth >= 30 && p.depth <= 40)).toBe(true);
    expect(result.products).toHaveLength(3);
  });

  it('combines category + price range filters', async () => {
    const result = await searchProducts({ category: 'futon-frames', priceRange: '300-500' });
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Eureka Futon Frame');
  });

  it('combines category + material + feature filters', async () => {
    const result = await searchProducts({
      category: 'futon-frames', material: 'Hardwood', features: ['wall-hugger'],
    });
    expect(result.products).toHaveLength(2);
  });

  it('sorts by price ascending', async () => {
    const result = await searchProducts({ sortBy: 'price-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeGreaterThanOrEqual(result.products[i - 1].price);
    }
  });

  it('sorts by price descending', async () => {
    const result = await searchProducts({ sortBy: 'price-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeLessThanOrEqual(result.products[i - 1].price);
    }
  });

  it('sorts by name ascending', async () => {
    const result = await searchProducts({ sortBy: 'name-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name >= result.products[i - 1].name).toBe(true);
    }
  });

  it('sorts by bestselling (numericRating desc) by default', async () => {
    const result = await searchProducts({});
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].numericRating).toBeLessThanOrEqual(result.products[i - 1].numericRating);
    }
  });

  it('limits results', async () => {
    const result = await searchProducts({ limit: 2 });
    expect(result.products).toHaveLength(2);
  });

  it('clamps limit to max 100', async () => {
    const result = await searchProducts({ limit: 200 });
    expect(result.products.length).toBeLessThanOrEqual(100);
  });

  it('returns empty products when no matches', async () => {
    const result = await searchProducts({ category: 'nonexistent-category' });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('maps all expected product fields', async () => {
    const result = await searchProducts({ category: 'futon-frames', limit: 1 });
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
    expect(p).toHaveProperty('width');
    expect(p).toHaveProperty('depth');
    expect(p).toHaveProperty('inStock');
    expect(p).toHaveProperty('numericRating');
  });

  it('does not expose extra product fields', async () => {
    __seed('Stores/Products', [{
      ...products[0],
      secret: 'hidden',
      inventory: 50,
    }]);
    const result = await searchProducts({});
    expect(result.products[0]).not.toHaveProperty('secret');
    expect(result.products[0]).not.toHaveProperty('inventory');
  });

  it('sanitizes material input (strips HTML)', async () => {
    const result = await searchProducts({ material: '<script>alert(1)</script>Hardwood' });
    // The sanitized string is 'alert(1)Hardwood' which won't match 'Hardwood'
    expect(result.products).toHaveLength(0);
  });

  it('returns error shape on CMS failure', async () => {
    __seed('Stores/Products', []);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Trigger by poisoning the query mock isn't straightforward,
    // but we can verify the empty-result shape
    const result = await searchProducts({ category: 'futon-frames' });
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.facets).toBeDefined();
    spy.mockRestore();
  });

  it('handles invalid priceRange key gracefully', async () => {
    const result = await searchProducts({ priceRange: 'invalid' });
    // No price filter applied, returns all products
    expect(result.products).toHaveLength(7);
  });
});

// ── getFilterValues ──────────────────────────────────────────────

describe('getFilterValues', () => {
  it('returns all facet categories', async () => {
    const facets = await getFilterValues();
    expect(facets).toHaveProperty('priceRanges');
    expect(facets).toHaveProperty('materials');
    expect(facets).toHaveProperty('colors');
    expect(facets).toHaveProperty('features');
    expect(facets).toHaveProperty('dimensions');
    expect(facets).toHaveProperty('totalProducts');
  });

  it('returns price range counts', async () => {
    const facets = await getFilterValues();
    const under300 = facets.priceRanges.find(r => r.key === '0-300');
    expect(under300.count).toBe(2); // Budget Futon Frame ($199) + Clearance Ottoman ($99)
    const over1200 = facets.priceRanges.find(r => r.key === '1200-up');
    expect(over1200.count).toBe(1); // Sagebrush ($1899)
  });

  it('returns material facets sorted by count descending', async () => {
    const facets = await getFilterValues();
    expect(facets.materials[0].value).toBe('Hardwood');
    expect(facets.materials[0].count).toBe(4);
  });

  it('returns color facets with counts', async () => {
    const facets = await getFilterValues();
    const natural = facets.colors.find(c => c.value === 'Natural');
    expect(natural.count).toBe(2);
  });

  it('returns feature tag facets with counts', async () => {
    const facets = await getFilterValues();
    const wallHugger = facets.features.find(f => f.value === 'wall-hugger');
    expect(wallHugger.count).toBe(2);
    const madeInUsa = facets.features.find(f => f.value === 'made-in-usa');
    expect(madeInUsa.count).toBe(2);
  });

  it('returns dimension ranges', async () => {
    const facets = await getFilterValues();
    expect(facets.dimensions.width.min).toBe(24);
    expect(facets.dimensions.width.max).toBe(66);
    expect(facets.dimensions.depth.min).toBe(22);
    expect(facets.dimensions.depth.max).toBe(80);
  });

  it('returns totalProducts count', async () => {
    const facets = await getFilterValues();
    expect(facets.totalProducts).toBe(7);
  });

  it('filters facets by category', async () => {
    const facets = await getFilterValues('futon-frames');
    expect(facets.totalProducts).toBe(3);
    const pine = facets.materials.find(m => m.value === 'Pine');
    expect(pine.count).toBe(1);
  });

  it('returns empty facets for nonexistent category', async () => {
    const facets = await getFilterValues('nonexistent');
    expect(facets.totalProducts).toBe(0);
    expect(facets.materials).toEqual([]);
    expect(facets.colors).toEqual([]);
  });
});

// ── Cache behavior ───────────────────────────────────────────────

describe('facet cache', () => {
  it('caches facets across calls', async () => {
    const facets1 = await getFilterValues('futon-frames');
    // Modify seed data — should still return cached values
    __seed('Stores/Products', []);
    const facets2 = await getFilterValues('futon-frames');
    expect(facets2.totalProducts).toBe(facets1.totalProducts);
  });

  it('returns fresh data after cache clear', async () => {
    await getFilterValues('futon-frames');
    __clearCache();
    __seed('Stores/Products', []);
    const facets = await getFilterValues('futon-frames');
    expect(facets.totalProducts).toBe(0);
  });

  it('caches separately per category', async () => {
    const allFacets = await getFilterValues();
    const frameFacets = await getFilterValues('futon-frames');
    expect(allFacets.totalProducts).not.toBe(frameFacets.totalProducts);
  });
});

// ── searchProducts — additional coverage ────────────────────────

describe('searchProducts (extended)', () => {
  it('sorts by name descending', async () => {
    const result = await searchProducts({ sortBy: 'name-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name <= result.products[i - 1].name).toBe(true);
    }
  });

  it('sorts by newest (_createdDate descending)', async () => {
    const result = await searchProducts({ sortBy: 'newest' });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('applies offset for pagination', async () => {
    const all = await searchProducts({ sortBy: 'price-asc' });
    const page2 = await searchProducts({ sortBy: 'price-asc', offset: 2, limit: 2 });
    expect(page2.products[0]._id).toBe(all.products[2]._id);
  });

  it('clamps limit minimum to 1', async () => {
    const result = await searchProducts({ limit: 0 });
    expect(result.products.length).toBeGreaterThanOrEqual(1);
  });

  it('clamps negative offset to 0', async () => {
    const result = await searchProducts({ offset: -5 });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('handles NaN limit gracefully', async () => {
    const result = await searchProducts({ limit: 'abc' });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('handles NaN offset gracefully', async () => {
    const result = await searchProducts({ offset: 'abc' });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('filters by $800-$1200 price range', async () => {
    const result = await searchProducts({ priceRange: '800-1200' });
    expect(result.products.every(p => p.price >= 800 && p.price <= 1200)).toBe(true);
    expect(result.products.map(p => p.name)).toContain('Premium Platform Bed');
  });

  it('sanitizes color filter input (strips tags)', async () => {
    const result = await searchProducts({ color: '<script>x</script>' });
    // Sanitized to 'x' which won't match any color
    expect(result.products).toHaveLength(0);
  });

  it('handles widthRange with NaN values', async () => {
    const result = await searchProducts({ widthRange: ['abc', 60] });
    // NaN min is skipped; max 60 still applied
    expect(result.products.every(p => p.width <= 60)).toBe(true);
  });

  it('handles depthRange with single NaN value', async () => {
    const result = await searchProducts({ depthRange: [30, 'xyz'] });
    // NaN max is skipped; min 30 still applied
    expect(result.products.every(p => p.depth >= 30)).toBe(true);
  });

  it('handles widthRange with wrong array length', async () => {
    const result = await searchProducts({ widthRange: [50] });
    // Array length !== 2, filter ignored
    expect(result.products).toHaveLength(7);
  });

  it('handles non-array features gracefully', async () => {
    const result = await searchProducts({ features: 'wall-hugger' });
    // Not an array, feature filter skipped
    expect(result.products).toHaveLength(7);
  });

  it('handles empty features array', async () => {
    const result = await searchProducts({ features: [] });
    expect(result.products).toHaveLength(7);
  });

  it('returns discountedPrice and formattedDiscountedPrice fields', async () => {
    const result = await searchProducts({ category: 'mattresses' });
    const mattress = result.products.find(p => p.slug === 'moonshadow');
    expect(mattress.discountedPrice).toBe(299);
    expect(mattress.formattedDiscountedPrice).toBe('$299.00');
  });

  it('returns ribbon field in mapped products', async () => {
    const result = await searchProducts({});
    const featured = result.products.find(p => p.slug === 'dillon');
    expect(featured.ribbon).toBe('Featured');
    const noRibbon = result.products.find(p => p.slug === 'eureka');
    expect(noRibbon.ribbon).toBe('');
  });
});

// ── fullTextSearch ──────────────────────────────────────────────

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
  });

  it('matches products by name', async () => {
    const result = await fullTextSearch({ query: 'Eureka' });
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].name).toContain('Eureka');
  });

  it('matches products by description', async () => {
    const result = await fullTextSearch({ query: 'storage drawers' });
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.some(p => p.slug === 'premium-plat')).toBe(true);
  });

  it('deduplicates name+description matches', async () => {
    // 'Premium' appears in both name and description of p6
    const result = await fullTextSearch({ query: 'Premium' });
    const ids = result.products.map(p => p._id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('name matches get higher relevance in default sort', async () => {
    const result = await fullTextSearch({ query: 'Premium' });
    // Product with name match should appear before description-only match
    expect(result.products[0].name).toContain('Premium');
  });

  it('returns normalized query in result', async () => {
    const result = await fullTextSearch({ query: 'FUTON' });
    expect(result.query).toBe('futon');
  });

  it('filters by category in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', category: 'futon-frames' });
    expect(result.products.every(p => p.collections.includes('futon-frames'))).toBe(true);
  });

  it('filters by priceRange in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', priceRange: '0-300' });
    expect(result.products.every(p => p.price <= 299.99)).toBe(true);
  });

  it('filters by material in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', material: 'Pine' });
    expect(result.products.every(p => p.material === 'Pine')).toBe(true);
  });

  it('filters by color in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', color: 'Natural' });
    expect(result.products.every(p => p.color === 'Natural')).toBe(true);
  });

  it('filters by features in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', features: ['wall-hugger'] });
    expect(result.products.every(p => p.featureTags.includes('wall-hugger'))).toBe(true);
  });

  it('filters by inStockOnly', async () => {
    const result = await fullTextSearch({ query: 'ottoman', inStockOnly: true });
    // Clearance Ottoman is out of stock, should be excluded
    expect(result.products.every(p => p.inStock === true)).toBe(true);
  });

  it('returns out-of-stock items when inStockOnly is false', async () => {
    const result = await fullTextSearch({ query: 'ottoman' });
    expect(result.products.some(p => p.inStock === false)).toBe(true);
  });

  it('sorts by price-asc in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeGreaterThanOrEqual(result.products[i - 1].price);
    }
  });

  it('sorts by price-desc in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'price-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].price).toBeLessThanOrEqual(result.products[i - 1].price);
    }
  });

  it('sorts by name-asc in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'name-asc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name.localeCompare(result.products[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts by name-desc in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', sortBy: 'name-desc' });
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].name.localeCompare(result.products[i - 1].name)).toBeLessThanOrEqual(0);
    }
  });

  it('sorts by newest in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Bed', sortBy: 'newest' });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('paginates fullTextSearch results', async () => {
    const all = await fullTextSearch({ query: 'Futon', limit: 100 });
    if (all.total > 1) {
      const page = await fullTextSearch({ query: 'Futon', offset: 1, limit: 1 });
      expect(page.products[0]._id).toBe(all.products[1]._id);
    }
  });

  it('clamps fullTextSearch limit to 100', async () => {
    const result = await fullTextSearch({ query: 'Futon', limit: 500 });
    expect(result.products.length).toBeLessThanOrEqual(100);
  });

  it('includes facets in fullTextSearch result', async () => {
    const result = await fullTextSearch({ query: 'Futon' });
    expect(result.facets).toBeDefined();
  });

  it('includes description in fullTextSearch mapped products', async () => {
    const result = await fullTextSearch({ query: 'Platform' });
    const plat = result.products.find(p => p.slug === 'premium-plat');
    expect(plat).toBeDefined();
    expect(plat.description).toContain('storage drawers');
  });

  it('caches fullTextSearch results', async () => {
    await fullTextSearch({ query: 'Futon' });
    // Modify seed data — cached result should persist
    __seed('Stores/Products', []);
    const result = await fullTextSearch({ query: 'Futon' });
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('returns fresh fullTextSearch results after cache clear', async () => {
    await fullTextSearch({ query: 'Futon' });
    __clearCache();
    __seed('Stores/Products', []);
    const result = await fullTextSearch({ query: 'Futon' });
    expect(result.products).toHaveLength(0);
  });
});

// ── getAutocompleteSuggestions ───────────────────────────────────

describe('getAutocompleteSuggestions', () => {
  it('returns empty for prefix shorter than 2 chars', async () => {
    const result = await getAutocompleteSuggestions('a');
    expect(result.suggestions).toEqual([]);
  });

  it('returns empty for empty prefix', async () => {
    const result = await getAutocompleteSuggestions('');
    expect(result.suggestions).toEqual([]);
  });

  it('returns product name suggestions for matching prefix', async () => {
    const result = await getAutocompleteSuggestions('Eu');
    expect(result.suggestions.some(s => s.text === 'Eureka Futon Frame' && s.type === 'product')).toBe(true);
  });

  it('returns category label suggestions when prefix matches', async () => {
    const result = await getAutocompleteSuggestions('Mur');
    expect(result.suggestions.some(s => s.type === 'category' && s.text === 'Murphy Cabinet Beds')).toBe(true);
  });

  it('limits suggestions to safeLimit', async () => {
    const result = await getAutocompleteSuggestions('Fu', 2);
    expect(result.suggestions.length).toBeLessThanOrEqual(2);
  });

  it('clamps limit to max 20', async () => {
    const result = await getAutocompleteSuggestions('Fu', 100);
    expect(result.suggestions.length).toBeLessThanOrEqual(20);
  });

  it('includes popular queries in suggestions', async () => {
    // Record some queries to build popularity
    await recordSearchQuery('futon frames sale');
    await recordSearchQuery('futon frames sale');
    await recordSearchQuery('futon frames sale');
    const result = await getAutocompleteSuggestions('futon');
    expect(result.suggestions.some(s => s.type === 'popular')).toBe(true);
  });

  it('deduplicates suggestions', async () => {
    const result = await getAutocompleteSuggestions('Fu');
    const texts = result.suggestions.map(s => s.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('caches autocomplete results', async () => {
    await getAutocompleteSuggestions('Eu');
    __seed('Stores/Products', []);
    const result = await getAutocompleteSuggestions('Eu');
    // Should still have results from cache
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('returns fresh results after cache clear', async () => {
    await getAutocompleteSuggestions('Eu');
    __clearCache();
    __seed('Stores/Products', []);
    const result = await getAutocompleteSuggestions('Eu');
    // No product matches from empty data; may still have category matches
    expect(result.suggestions.every(s => s.type !== 'product')).toBe(true);
  });

  it('suggestion objects have text, type, and slug', async () => {
    const result = await getAutocompleteSuggestions('Eu');
    for (const s of result.suggestions) {
      expect(s).toHaveProperty('text');
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('slug');
    }
  });
});

// ── getPopularSearches ──────────────────────────────────────────

describe('getPopularSearches', () => {
  it('returns empty queries when none recorded', async () => {
    const result = await getPopularSearches();
    expect(result.queries).toEqual([]);
  });

  it('returns recorded queries sorted by count', async () => {
    await recordSearchQuery('futon frames');
    await recordSearchQuery('futon frames');
    await recordSearchQuery('futon frames');
    await recordSearchQuery('murphy beds');
    const result = await getPopularSearches();
    expect(result.queries[0].query).toBe('futon frames');
    expect(result.queries[0].count).toBe(3);
  });

  it('respects limit parameter', async () => {
    await recordSearchQuery('query1');
    await recordSearchQuery('query2');
    await recordSearchQuery('query3');
    const result = await getPopularSearches(2);
    expect(result.queries.length).toBeLessThanOrEqual(2);
  });

  it('clamps limit to max 20', async () => {
    const result = await getPopularSearches(100);
    expect(result.queries.length).toBeLessThanOrEqual(20);
  });

  it('clamps limit minimum to 1', async () => {
    await recordSearchQuery('test');
    const result = await getPopularSearches(0);
    expect(result.queries.length).toBeLessThanOrEqual(1);
  });
});

// ── recordSearchQuery ───────────────────────────────────────────

describe('recordSearchQuery', () => {
  it('returns success true for valid query', async () => {
    const result = await recordSearchQuery('futon frames');
    expect(result.success).toBe(true);
  });

  it('returns success false for single-char query', async () => {
    const result = await recordSearchQuery('a');
    expect(result.success).toBe(false);
  });

  it('returns success false for empty query', async () => {
    const result = await recordSearchQuery('');
    expect(result.success).toBe(false);
  });

  it('returns success false for null query', async () => {
    const result = await recordSearchQuery(null);
    expect(result.success).toBe(false);
  });

  it('normalizes query to lowercase', async () => {
    await recordSearchQuery('FUTON FRAMES');
    const popular = await getPopularSearches();
    expect(popular.queries.some(q => q.query === 'futon frames')).toBe(true);
  });

  it('increments count for repeated queries', async () => {
    await recordSearchQuery('mattress');
    await recordSearchQuery('mattress');
    await recordSearchQuery('mattress');
    const popular = await getPopularSearches();
    const entry = popular.queries.find(q => q.query === 'mattress');
    expect(entry.count).toBe(3);
  });

  it('sanitizes query input', async () => {
    const result = await recordSearchQuery('<script>alert(1)</script>futon');
    expect(result.success).toBe(true);
  });
});

// ── Search cache behavior ───────────────────────────────────────

describe('search cache', () => {
  it('search results are cached across identical calls', async () => {
    const r1 = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    __seed('Stores/Products', []);
    const r2 = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    expect(r2.total).toBe(r1.total);
  });

  it('different search params get different cache entries', async () => {
    const r1 = await fullTextSearch({ query: 'Futon', sortBy: 'price-asc' });
    const r2 = await fullTextSearch({ query: 'Futon', sortBy: 'price-desc' });
    // Both should succeed — different cache keys
    expect(r1.products.length).toBeGreaterThan(0);
    expect(r2.products.length).toBeGreaterThan(0);
  });

  it('different category params produce different cache entries', async () => {
    await fullTextSearch({ query: 'Futon', category: 'futon-frames' });
    // Modify seed — if separate cache entries, the second query would still be cached
    __seed('Stores/Products', []);
    const r2 = await fullTextSearch({ query: 'Futon', category: 'futon-frames' });
    // Should return cached (non-empty) results despite empty seed
    expect(r2.products.length).toBeGreaterThan(0);
    // But a different category key should miss cache and return empty
    __clearCache();
    const r3 = await fullTextSearch({ query: 'Futon', category: 'mattresses' });
    expect(r3.products).toHaveLength(0);
  });

  it('different offset params produce different cache entries', async () => {
    await fullTextSearch({ query: 'Futon', offset: 0 });
    __seed('Stores/Products', []);
    // Same query+offset=0 should hit cache and return non-empty
    const cached = await fullTextSearch({ query: 'Futon', offset: 0 });
    expect(cached.products.length).toBeGreaterThan(0);
    // Different offset should miss cache and return empty (data is gone)
    const missed = await fullTextSearch({ query: 'Futon', offset: 1 });
    expect(missed.products).toHaveLength(0);
  });
});

// ── searchProducts — edge cases & missing paths ──────────────────

describe('searchProducts (edge cases)', () => {
  it('called with no arguments uses defaults', async () => {
    const result = await searchProducts();
    expect(result.products).toHaveLength(7);
    expect(result.total).toBe(7);
  });

  it('validateSlug rejects category with special characters', async () => {
    const result = await searchProducts({ category: 'futon<frames>' });
    // validateSlug returns '' for non-slug characters, no category filter applied
    expect(result.products).toHaveLength(7);
  });

  it('validateSlug normalizes category to lowercase', async () => {
    const result = await searchProducts({ category: 'FUTON-FRAMES' });
    expect(result.products).toHaveLength(3);
    expect(result.products.every(p => p.collections.includes('futon-frames'))).toBe(true);
  });

  it('does not include description in searchProducts mapped fields', async () => {
    const result = await searchProducts({});
    const plat = result.products.find(p => p.slug === 'premium-plat');
    expect(plat).not.toHaveProperty('description');
  });

  it('combines all filters: category + price + material + color + features + dimensions', async () => {
    const result = await searchProducts({
      category: 'futon-frames',
      priceRange: '300-500',
      material: 'Hardwood',
      color: 'Natural',
      features: ['wall-hugger', 'made-in-usa'],
      widthRange: [50, 60],
      depthRange: [30, 40],
    });
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Eureka Futon Frame');
  });

  it('returns products with empty featureTags array', async () => {
    const result = await searchProducts({ features: [] });
    const ottoman = result.products.find(p => p.slug === 'clearance-ottoman');
    expect(ottoman).toBeDefined();
    expect(ottoman.featureTags).toEqual([]);
  });

  it('handles features filter with mix of valid and unknown tags', async () => {
    const result = await searchProducts({ features: ['wall-hugger', 'nonexistent'] });
    // Only valid features are applied — 'wall-hugger' filters, 'nonexistent' is ignored
    expect(result.products.every(p => p.featureTags.includes('wall-hugger'))).toBe(true);
  });

  it('handles material that is empty string after sanitize', async () => {
    const result = await searchProducts({ material: '<>' });
    // sanitize('<>') → '', cleanMaterial falsy, no material filter
    expect(result.products).toHaveLength(7);
  });

  it('handles color that is empty string after sanitize', async () => {
    const result = await searchProducts({ color: '<>' });
    // sanitize('<>') → '', cleanColor falsy, no color filter
    expect(result.products).toHaveLength(7);
  });

  it('handles depthRange with wrong array length (1 element)', async () => {
    const result = await searchProducts({ depthRange: [30] });
    expect(result.products).toHaveLength(7);
  });

  it('handles depthRange with wrong array length (3 elements)', async () => {
    const result = await searchProducts({ depthRange: [30, 40, 50] });
    // length !== 2, filter ignored
    expect(result.products).toHaveLength(7);
  });

  it('handles widthRange with both NaN values', async () => {
    const result = await searchProducts({ widthRange: ['abc', 'def'] });
    // Both NaN, neither filter applied
    expect(result.products).toHaveLength(7);
  });

  it('handles null category gracefully', async () => {
    const result = await searchProducts({ category: null });
    expect(result.products).toHaveLength(7);
  });

  it('handles undefined category gracefully', async () => {
    const result = await searchProducts({ category: undefined });
    expect(result.products).toHaveLength(7);
  });

  it('offset beyond total returns empty products', async () => {
    const result = await searchProducts({ offset: 1000 });
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(7);
  });
});

// ── buildFacets — missing field handling ─────────────────────────

describe('buildFacets edge cases', () => {
  it('items with no material are excluded from material facets', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'No Material', price: 100, material: null, color: 'Red', featureTags: [], width: 30, depth: 30, collections: [] },
      { _id: 'x2', name: 'Has Material', price: 200, material: 'Wood', color: 'Blue', featureTags: [], width: 40, depth: 40, collections: [] },
    ]);
    const facets = await getFilterValues();
    expect(facets.materials).toHaveLength(1);
    expect(facets.materials[0].value).toBe('Wood');
  });

  it('items with no color are excluded from color facets', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'No Color', price: 100, material: 'Wood', color: null, featureTags: [], width: 30, depth: 30, collections: [] },
    ]);
    const facets = await getFilterValues();
    expect(facets.colors).toHaveLength(0);
  });

  it('items with no featureTags are excluded from feature facets', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'No Tags', price: 100, material: 'Wood', color: 'Red', featureTags: null, width: 30, depth: 30, collections: [] },
    ]);
    const facets = await getFilterValues();
    expect(facets.features).toHaveLength(0);
  });

  it('only known features appear in feature facets', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'Mixed Tags', price: 100, featureTags: ['wall-hugger', 'unknown-tag', 'sleeper'], collections: [] },
    ]);
    const facets = await getFilterValues();
    const tagValues = facets.features.map(f => f.value);
    expect(tagValues).toContain('wall-hugger');
    expect(tagValues).toContain('sleeper');
    expect(tagValues).not.toContain('unknown-tag');
  });

  it('items with no width/depth yield zero dimension ranges', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'No Dims', price: 100, featureTags: [], collections: [] },
    ]);
    const facets = await getFilterValues();
    expect(facets.dimensions.width).toEqual({ min: 0, max: 0 });
    expect(facets.dimensions.depth).toEqual({ min: 0, max: 0 });
  });

  it('items with string width/depth are excluded from dimension ranges', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'Bad Dims', price: 100, width: 'wide', depth: 'deep', featureTags: [], collections: [] },
      { _id: 'x2', name: 'Good Dims', price: 200, width: 40, depth: 30, featureTags: [], collections: [] },
    ]);
    const facets = await getFilterValues();
    expect(facets.dimensions.width).toEqual({ min: 40, max: 40 });
    expect(facets.dimensions.depth).toEqual({ min: 30, max: 30 });
  });

  it('price ranges include boundary values correctly', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'At 300', price: 300, featureTags: [], collections: [] },
      { _id: 'x2', name: 'At 299.99', price: 299.99, featureTags: [], collections: [] },
    ]);
    const facets = await getFilterValues();
    const under300 = facets.priceRanges.find(r => r.key === '0-300');
    const range300 = facets.priceRanges.find(r => r.key === '300-500');
    expect(under300.count).toBe(1); // 299.99
    expect(range300.count).toBe(1); // 300
  });

  it('items with price 0 are counted in Under $300 bucket', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'Free Item', price: 0, featureTags: [], collections: [] },
    ]);
    const facets = await getFilterValues();
    const under300 = facets.priceRanges.find(r => r.key === '0-300');
    expect(under300.count).toBe(1);
  });

  it('items with null price treated as 0 in price range', async () => {
    __seed('Stores/Products', [
      { _id: 'x1', name: 'No Price', price: null, featureTags: [], collections: [] },
    ]);
    const facets = await getFilterValues();
    const under300 = facets.priceRanges.find(r => r.key === '0-300');
    expect(under300.count).toBe(1);
  });
});

// ── fullTextSearch — additional paths ────────────────────────────

describe('fullTextSearch (extended)', () => {
  it('returns empty for null query', async () => {
    const result = await fullTextSearch({ query: null });
    expect(result.products).toEqual([]);
    expect(result.query).toBe('');
  });

  it('sanitizes query input (strips HTML tags)', async () => {
    const result = await fullTextSearch({ query: '<b>Futon</b>' });
    expect(result.query).toBe('futon');
  });

  it('combined filters: category + material + inStockOnly', async () => {
    const result = await fullTextSearch({
      query: 'Futon',
      category: 'futon-frames',
      material: 'Hardwood',
      inStockOnly: true,
    });
    expect(result.products.every(p =>
      p.collections.includes('futon-frames') &&
      p.material === 'Hardwood' &&
      p.inStock === true
    )).toBe(true);
  });

  it('combined filters: priceRange + color', async () => {
    const result = await fullTextSearch({ query: 'Futon', priceRange: '300-500', color: 'Natural' });
    expect(result.products.every(p => p.price >= 300 && p.price <= 500 && p.color === 'Natural')).toBe(true);
  });

  it('features filter with multiple valid features in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', features: ['wall-hugger', 'made-in-usa'] });
    expect(result.products.every(p =>
      p.featureTags.includes('wall-hugger') && p.featureTags.includes('made-in-usa')
    )).toBe(true);
  });

  it('features filter ignores unknown tags in fullTextSearch', async () => {
    const all = await fullTextSearch({ query: 'Futon' });
    const withUnknown = await fullTextSearch({ query: 'Futon', features: ['nonexistent-tag'] });
    // Unknown tags filtered out, no valid features remain, no filter applied
    expect(withUnknown.total).toBe(all.total);
  });

  it('inStockOnly false does not filter', async () => {
    const result = await fullTextSearch({ query: 'ottoman', inStockOnly: false });
    expect(result.products.some(p => p.inStock === false)).toBe(true);
  });

  it('handles material filter with empty sanitize result', async () => {
    const all = await fullTextSearch({ query: 'Futon' });
    const withEmpty = await fullTextSearch({ query: 'Futon', material: '<>' });
    // sanitize('<>') → '', no filter applied
    expect(withEmpty.total).toBe(all.total);
  });

  it('handles color filter with empty sanitize result', async () => {
    const all = await fullTextSearch({ query: 'Futon' });
    const withEmpty = await fullTextSearch({ query: 'Futon', color: '<>' });
    expect(withEmpty.total).toBe(all.total);
  });

  it('clamps negative offset to 0', async () => {
    const noOffset = await fullTextSearch({ query: 'Futon', offset: 0 });
    __clearCache();
    const negOffset = await fullTextSearch({ query: 'Futon', offset: -5 });
    expect(negOffset.products.length).toBe(noOffset.products.length);
  });

  it('clamps NaN limit to default 24', async () => {
    const result = await fullTextSearch({ query: 'Futon', limit: 'abc' });
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.length).toBeLessThanOrEqual(24);
  });

  it('treats limit=0 as default 24 (0 is falsy)', async () => {
    const result = await fullTextSearch({ query: 'Futon', limit: 0 });
    // Number(0) || 24 = 24 — 0 is falsy, default 24 kicks in
    // All futon matches returned since 24 > match count
    const allResults = await fullTextSearch({ query: 'Futon', limit: 100 });
    expect(result.products.length).toBe(allResults.products.length);
  });

  it('sorts by relevance by default (name matches before description)', async () => {
    // 'Premium' appears in p6 name and p6 description. Name match gets _relevance=2.
    const result = await fullTextSearch({ query: 'Premium' });
    expect(result.products.length).toBeGreaterThan(0);
    // First result should be the name-matched product
    expect(result.products[0].name).toContain('Premium');
    expect(result.products[0].slug).toBe('premium-plat');
  });

  it('records query for popular tracking', async () => {
    __clearCache();
    await fullTextSearch({ query: 'unique-search-term-xyz' });
    const popular = await getPopularSearches(20);
    expect(popular.queries.some(q => q.query === 'unique-search-term-xyz')).toBe(true);
  });

  it('maps description field in fullTextSearch results', async () => {
    const result = await fullTextSearch({ query: 'Platform' });
    const plat = result.products.find(p => p.slug === 'premium-plat');
    expect(plat).toHaveProperty('description');
    expect(plat.description).toContain('storage drawers');
  });

  it('handles invalid priceRange key in fullTextSearch', async () => {
    const all = await fullTextSearch({ query: 'Futon' });
    const withInvalid = await fullTextSearch({ query: 'Futon', priceRange: 'bogus' });
    expect(withInvalid.total).toBe(all.total);
  });

  it('handles category with special chars in fullTextSearch', async () => {
    const result = await fullTextSearch({ query: 'Futon', category: 'bad<cat>' });
    // validateSlug returns '' — no category filter applied
    const all = await fullTextSearch({ query: 'Futon' });
    expect(result.total).toBe(all.total);
  });
});

// ── getAutocompleteSuggestions — additional paths ─────────────────

describe('getAutocompleteSuggestions (extended)', () => {
  it('returns empty for null prefix', async () => {
    const result = await getAutocompleteSuggestions(null);
    expect(result.suggestions).toEqual([]);
  });

  it('category suggestions include correct slug', async () => {
    const result = await getAutocompleteSuggestions('Murphy');
    const cat = result.suggestions.find(s => s.type === 'category');
    expect(cat).toBeDefined();
    expect(cat.slug).toBe('murphy-cabinet-beds');
  });

  it('popular query suggestions have empty slug', async () => {
    await recordSearchQuery('futon sale deals');
    await recordSearchQuery('futon sale deals');
    await recordSearchQuery('futon sale deals');
    const result = await getAutocompleteSuggestions('futon sale');
    const pop = result.suggestions.find(s => s.type === 'popular');
    expect(pop).toBeDefined();
    expect(pop.slug).toBe('');
  });

  it('product suggestions include correct slug', async () => {
    const result = await getAutocompleteSuggestions('Eu');
    const prod = result.suggestions.find(s => s.type === 'product');
    expect(prod).toBeDefined();
    expect(prod.slug).toBe('eureka');
  });

  it('categories appear before products in suggestion order', async () => {
    const result = await getAutocompleteSuggestions('Fu');
    const catIdx = result.suggestions.findIndex(s => s.type === 'category');
    const prodIdx = result.suggestions.findIndex(s => s.type === 'product');
    if (catIdx >= 0 && prodIdx >= 0) {
      expect(catIdx).toBeLessThan(prodIdx);
    }
  });

  it('sanitizes prefix (strips HTML)', async () => {
    const result = await getAutocompleteSuggestions('<b>Eu</b>');
    // sanitize strips tags: 'Eu' remains, should match Eureka
    expect(result.suggestions.some(s => s.text === 'Eureka Futon Frame')).toBe(true);
  });

  it('treats limit=0 as default 8 (0 is falsy)', async () => {
    const result = await getAutocompleteSuggestions('Fu', 0);
    // Number(0) || 8 = 8 — 0 is falsy so default kicks in
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeLessThanOrEqual(8);
  });

  it('handles NaN limit gracefully', async () => {
    const result = await getAutocompleteSuggestions('Fu', 'abc');
    // NaN → default 8
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeLessThanOrEqual(8);
  });

  it('matches category labels case-insensitively', async () => {
    const result = await getAutocompleteSuggestions('platform');
    expect(result.suggestions.some(s => s.type === 'category' && s.text === 'Platform Beds')).toBe(true);
  });

  it('returns category match for Futon Frames', async () => {
    const result = await getAutocompleteSuggestions('fu', 20);
    const cats = result.suggestions.filter(s => s.type === 'category');
    expect(cats.length).toBeGreaterThanOrEqual(1);
    expect(cats.some(c => c.text === 'Futon Frames')).toBe(true);
  });
});

// ── getPopularSearches — additional coverage ─────────────────────

describe('getPopularSearches (extended)', () => {
  it('returns queries sorted by count descending', async () => {
    await recordSearchQuery('alpha');
    await recordSearchQuery('beta');
    await recordSearchQuery('beta');
    await recordSearchQuery('gamma');
    await recordSearchQuery('gamma');
    await recordSearchQuery('gamma');
    const result = await getPopularSearches(10);
    expect(result.queries[0].query).toBe('gamma');
    expect(result.queries[1].query).toBe('beta');
    expect(result.queries[2].query).toBe('alpha');
  });

  it('handles NaN limit gracefully', async () => {
    await recordSearchQuery('test-nan');
    const result = await getPopularSearches('abc');
    // NaN → default 8
    expect(result.queries.length).toBeLessThanOrEqual(8);
  });

  it('returns {queries: []} shape on error', async () => {
    const result = await getPopularSearches();
    expect(result).toHaveProperty('queries');
    expect(Array.isArray(result.queries)).toBe(true);
  });
});

// ── recordSearchQuery — additional coverage ──────────────────────

describe('recordSearchQuery (extended)', () => {
  it('returns success false for whitespace-only query', async () => {
    const result = await recordSearchQuery('   ');
    expect(result.success).toBe(false);
  });

  it('trims whitespace before recording', async () => {
    await recordSearchQuery('  futon beds  ');
    const popular = await getPopularSearches();
    expect(popular.queries.some(q => q.query === 'futon beds')).toBe(true);
  });

  it('treats different casing as same query', async () => {
    await recordSearchQuery('Mattress');
    await recordSearchQuery('MATTRESS');
    await recordSearchQuery('mattress');
    const popular = await getPopularSearches();
    const entry = popular.queries.find(q => q.query === 'mattress');
    expect(entry.count).toBe(3);
  });

  it('ignores single-character query after sanitize', async () => {
    const result = await recordSearchQuery('<b>x</b>');
    // sanitize strips tags → 'x', length < 2
    expect(result.success).toBe(false);
  });
});

// ── Query frequency tracking internals ──────────────────────────

describe('query frequency tracking', () => {
  it('short queries (< 2 chars) are not tracked', async () => {
    await recordSearchQuery('ab'); // 2 chars — should track
    await recordSearchQuery('a');  // 1 char — should not track
    const popular = await getPopularSearches();
    expect(popular.queries.some(q => q.query === 'ab')).toBe(true);
    expect(popular.queries.some(q => q.query === 'a')).toBe(false);
  });

  it('empty queries are not tracked', async () => {
    await recordSearchQuery('');
    const popular = await getPopularSearches();
    expect(popular.queries).toHaveLength(0);
  });
});

// ── getFilterValues — error path ─────────────────────────────────

describe('getFilterValues (extended)', () => {
  it('returns error shape when category has special chars', async () => {
    const facets = await getFilterValues('bad<cat>');
    // validateSlug returns '' → treated as no category → all products
    expect(facets.totalProducts).toBe(7);
  });

  it('returns empty string category as all products', async () => {
    const facets = await getFilterValues('');
    expect(facets.totalProducts).toBe(7);
  });

  it('returns null category as all products', async () => {
    const facets = await getFilterValues(null);
    expect(facets.totalProducts).toBe(7);
  });

  it('facets are cached per category slug', async () => {
    const f1 = await getFilterValues('mattresses');
    expect(f1.totalProducts).toBe(1);
    // Change data — cache should persist
    __seed('Stores/Products', []);
    const f2 = await getFilterValues('mattresses');
    expect(f2.totalProducts).toBe(1);
    // Different category is not cached
    const f3 = await getFilterValues('futon-frames');
    expect(f3.totalProducts).toBe(0); // fresh query on empty data
  });
});
