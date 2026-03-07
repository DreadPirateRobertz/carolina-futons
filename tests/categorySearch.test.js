import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  allProducts,
  futonFrame,
  wallHuggerFrame,
  futonMattress,
  murphyBed,
  platformBed,
  casegoodsItem,
  saleProduct,
  metalFrame,
  outdoorFrame,
} from './fixtures/products.js';
import {
  searchProducts,
  getFilteredProductCount,
  getFacetMetadata,
  suggestFilterRelaxation,
  __clearCache,
} from '../src/backend/categorySearch.web.js';

beforeEach(() => {
  __seed('Stores/Products', allProducts);
  __clearCache();
});

// ── searchProducts ──────────────────────────────────────────────────

describe('searchProducts', () => {
  it('returns all products with no filters', async () => {
    const result = await searchProducts({});
    expect(result.items).toHaveLength(allProducts.length);
    expect(result.totalCount).toBe(allProducts.length);
  });

  it('filters by category', async () => {
    const result = await searchProducts({ category: 'futon-frames' });
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach(item => {
      expect(item.collections).toContain('futon-frames');
    });
  });

  it('filters by category wall-huggers', async () => {
    const result = await searchProducts({ category: 'wall-huggers' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]._id).toBe(wallHuggerFrame._id);
  });

  it('filters by search query matching product name', async () => {
    const result = await searchProducts({ searchQuery: 'Eureka' });
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach(item => {
      expect(item.name).toContain('Eureka');
    });
  });

  it('returns empty for non-matching search query', async () => {
    const result = await searchProducts({ searchQuery: 'Nonexistent Product XYZ' });
    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('filters by price range', async () => {
    const result = await searchProducts({ priceMin: 300, priceMax: 600 });
    result.items.forEach(item => {
      expect(item.price).toBeGreaterThanOrEqual(300);
      expect(item.price).toBeLessThanOrEqual(600);
    });
  });

  it('filters by priceMin only', async () => {
    const result = await searchProducts({ priceMin: 800 });
    result.items.forEach(item => {
      expect(item.price).toBeGreaterThanOrEqual(800);
    });
  });

  it('filters by priceMax only', async () => {
    const result = await searchProducts({ priceMax: 300 });
    result.items.forEach(item => {
      expect(item.price).toBeLessThanOrEqual(300);
    });
  });

  it('filters by single material', async () => {
    const result = await searchProducts({ materials: ['metal'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]._id).toBe(metalFrame._id);
  });

  it('filters by multiple materials', async () => {
    const result = await searchProducts({ materials: ['metal', 'fabric'] });
    expect(result.items).toHaveLength(3);
    const ids = result.items.map(i => i._id);
    expect(ids).toContain(metalFrame._id);
    expect(ids).toContain(futonMattress._id);
  });

  it('filters by single color', async () => {
    const result = await searchProducts({ colors: ['walnut'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]._id).toBe(wallHuggerFrame._id);
  });

  it('filters by multiple colors', async () => {
    const result = await searchProducts({ colors: ['natural', 'black'] });
    const ids = result.items.map(i => i._id);
    expect(ids).toContain(futonFrame._id);
    expect(ids).toContain(casegoodsItem._id);
    expect(ids).toContain(saleProduct._id);
    expect(ids).toContain(metalFrame._id);
  });

  it('filters by feature tags', async () => {
    const result = await searchProducts({ featureTags: ['wall-hugger'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]._id).toBe(wallHuggerFrame._id);
  });

  it('filters by outdoor feature tag', async () => {
    const result = await searchProducts({ featureTags: ['outdoor'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]._id).toBe(outdoorFrame._id);
  });

  it('filters by sleeper feature tag returns multiple', async () => {
    const result = await searchProducts({ featureTags: ['sleeper'] });
    expect(result.items.length).toBeGreaterThan(1);
    result.items.forEach(item => {
      expect(item.featureTags).toContain('sleeper');
    });
  });

  it('filters by brands', async () => {
    const result = await searchProducts({ brands: ['Strata'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]._id).toBe(wallHuggerFrame._id);
  });

  it('filters by multiple brands', async () => {
    const result = await searchProducts({ brands: ['Strata', 'KD Frames'] });
    expect(result.items).toHaveLength(3);
  });

  it('filters by width range', async () => {
    const result = await searchProducts({ widthMin: 60, widthMax: 70 });
    const ids = result.items.map(i => i._id);
    expect(ids).toContain(murphyBed._id);
    expect(ids).toContain(platformBed._id);
  });

  it('filters by depth range', async () => {
    const result = await searchProducts({ depthMin: 70 });
    const ids = result.items.map(i => i._id);
    expect(ids).toContain(futonMattress._id);
    expect(ids).toContain(platformBed._id);
  });

  it('filters by height range', async () => {
    const result = await searchProducts({ heightMax: 15 });
    const ids = result.items.map(i => i._id);
    expect(ids).toContain(futonMattress._id);
    expect(ids).toContain(platformBed._id);
  });

  it('filters by inStockOnly', async () => {
    const result = await searchProducts({ inStockOnly: true });
    result.items.forEach(item => {
      expect(item.inStock).toBe(true);
    });
    // outdoorFrame is out of stock, should not appear
    const ids = result.items.map(i => i._id);
    expect(ids).not.toContain(outdoorFrame._id);
  });

  it('combines category + price + material filters', async () => {
    const result = await searchProducts({
      category: 'futon-frames',
      priceMin: 200,
      priceMax: 500,
      materials: ['hardwood'],
    });
    result.items.forEach(item => {
      expect(item.collections).toContain('futon-frames');
      expect(item.price).toBeGreaterThanOrEqual(200);
      expect(item.price).toBeLessThanOrEqual(500);
      expect(item.material).toBe('hardwood');
    });
  });

  it('combines category + feature tag + brand', async () => {
    const result = await searchProducts({
      category: 'futon-frames',
      featureTags: ['sleeper'],
      brands: ['Night & Day'],
    });
    result.items.forEach(item => {
      expect(item.collections).toContain('futon-frames');
      expect(item.featureTags).toContain('sleeper');
      expect(item.brand).toBe('Night & Day');
    });
  });

  it('sorts by price ascending', async () => {
    const result = await searchProducts({ sort: 'price-asc' });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].price).toBeGreaterThanOrEqual(result.items[i - 1].price);
    }
  });

  it('sorts by price descending', async () => {
    const result = await searchProducts({ sort: 'price-desc' });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].price).toBeLessThanOrEqual(result.items[i - 1].price);
    }
  });

  it('sorts by name ascending', async () => {
    const result = await searchProducts({ sort: 'name-asc' });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].name >= result.items[i - 1].name).toBe(true);
    }
  });

  it('sorts by newest first', async () => {
    const result = await searchProducts({ sort: 'date-desc' });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i]._createdDate <= result.items[i - 1]._createdDate).toBe(true);
    }
  });

  it('defaults to bestselling sort', async () => {
    const result = await searchProducts({});
    // bestselling = numericRating desc, items with rating should come first
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('uses bestselling for invalid sort value', async () => {
    const result = await searchProducts({ sort: 'invalid-sort' });
    expect(result.items.length).toBe(allProducts.length);
  });

  it('respects limit parameter', async () => {
    const result = await searchProducts({ limit: 3 });
    expect(result.items).toHaveLength(3);
  });

  it('caps limit at 100', async () => {
    const result = await searchProducts({ limit: 999 });
    // Should not crash; limit gets capped to 100
    expect(result.items.length).toBeLessThanOrEqual(100);
  });

  it('sets hasMore to false when all results fit in limit', async () => {
    const result = await searchProducts({ limit: 100 });
    expect(result.hasMore).toBe(false);
  });

  it('applies skip to paginate results', async () => {
    const page1 = await searchProducts({ limit: 2, skip: 0 });
    const page2 = await searchProducts({ limit: 2, skip: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    // Pages should not overlap
    const page1Ids = page1.items.map(i => i._id);
    const page2Ids = page2.items.map(i => i._id);
    page2Ids.forEach(id => {
      expect(page1Ids).not.toContain(id);
    });
  });

  it('skip returns correct totalCount for all items', async () => {
    const result = await searchProducts({ limit: 2, skip: 2 });
    expect(result.totalCount).toBe(allProducts.length);
  });

  it('hasMore is true when skip + limit < totalCount', async () => {
    const result = await searchProducts({ limit: 2, skip: 0 });
    expect(result.hasMore).toBe(true);
  });

  it('handles negative skip gracefully', async () => {
    const result = await searchProducts({ limit: 2, skip: -5 });
    expect(result.items).toHaveLength(2);
  });

  it('sanitizes search query with HTML', async () => {
    const result = await searchProducts({ searchQuery: '<script>alert("xss")</script>Eureka' });
    // Should not throw and should strip HTML tags
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('sanitizes category with HTML', async () => {
    const result = await searchProducts({ category: '<img onerror=alert(1)>futon-frames' });
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('handles empty materials array', async () => {
    const result = await searchProducts({ materials: [] });
    expect(result.items).toHaveLength(allProducts.length);
  });

  it('handles empty colors array', async () => {
    const result = await searchProducts({ colors: [] });
    expect(result.items).toHaveLength(allProducts.length);
  });

  it('handles empty featureTags array', async () => {
    const result = await searchProducts({ featureTags: [] });
    expect(result.items).toHaveLength(allProducts.length);
  });

  it('handles empty brands array', async () => {
    const result = await searchProducts({ brands: [] });
    expect(result.items).toHaveLength(allProducts.length);
  });

  it('handles zero priceMin gracefully', async () => {
    const result = await searchProducts({ priceMin: 0 });
    expect(result.items).toHaveLength(allProducts.length);
  });

  it('handles null params gracefully', async () => {
    const result = await searchProducts(null);
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('handles undefined params gracefully', async () => {
    const result = await searchProducts(undefined);
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('returns correct structure', async () => {
    const result = await searchProducts({});
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('totalCount');
    expect(result).toHaveProperty('hasMore');
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.totalCount).toBe('number');
    expect(typeof result.hasMore).toBe('boolean');
  });
});

// ── getFilteredProductCount ─────────────────────────────────────────

describe('getFilteredProductCount', () => {
  it('returns total count with no filters', async () => {
    const result = await getFilteredProductCount({});
    expect(result.count).toBe(allProducts.length);
  });

  it('returns count filtered by category', async () => {
    const result = await getFilteredProductCount({ category: 'mattresses' });
    expect(result.count).toBe(1);
  });

  it('returns count filtered by price range', async () => {
    const result = await getFilteredProductCount({ priceMin: 500, priceMax: 1000 });
    expect(result.count).toBeGreaterThan(0);
  });

  it('returns count filtered by materials', async () => {
    const result = await getFilteredProductCount({ materials: ['metal'] });
    expect(result.count).toBe(1);
  });

  it('returns count filtered by brands', async () => {
    const result = await getFilteredProductCount({ brands: ['Night & Day'] });
    expect(result.count).toBeGreaterThan(0);
  });

  it('returns count filtered by inStockOnly', async () => {
    const all = await getFilteredProductCount({});
    const inStock = await getFilteredProductCount({ inStockOnly: true });
    expect(inStock.count).toBeLessThan(all.count);
  });

  it('returns zero for impossible filter combo', async () => {
    const result = await getFilteredProductCount({
      category: 'mattresses',
      materials: ['metal'],
    });
    expect(result.count).toBe(0);
  });

  it('returns count with search query', async () => {
    const result = await getFilteredProductCount({ searchQuery: 'Murphy' });
    expect(result.count).toBe(1);
  });

  it('handles null params', async () => {
    const result = await getFilteredProductCount(null);
    expect(typeof result.count).toBe('number');
  });
});

// ── getFacetMetadata ────────────────────────────────────────────────

describe('getFacetMetadata', () => {
  it('returns facets for all products when no category', async () => {
    const facets = await getFacetMetadata('');
    expect(facets.totalProducts).toBe(allProducts.length);
    expect(facets.materials.length).toBeGreaterThan(0);
    expect(facets.colors.length).toBeGreaterThan(0);
    expect(facets.brands.length).toBeGreaterThan(0);
  });

  it('returns facets for a specific category', async () => {
    const facets = await getFacetMetadata('mattresses');
    expect(facets.totalProducts).toBe(1);
    expect(facets.materials).toContain('fabric');
    expect(facets.colors).toContain('white');
  });

  it('returns correct price range', async () => {
    const facets = await getFacetMetadata('');
    expect(facets.priceRange.min).toBe(199);
    expect(facets.priceRange.max).toBe(1899);
  });

  it('returns correct price range for category', async () => {
    const facets = await getFacetMetadata('futon-frames');
    // futon-frames: 499, 699, 499, 299, 849, 249
    expect(facets.priceRange.min).toBe(249);
    expect(facets.priceRange.max).toBe(849);
  });

  it('returns all unique materials', async () => {
    const facets = await getFacetMetadata('');
    expect(facets.materials).toContain('hardwood');
    expect(facets.materials).toContain('metal');
    expect(facets.materials).toContain('fabric');
  });

  it('returns materials sorted alphabetically', async () => {
    const facets = await getFacetMetadata('');
    for (let i = 1; i < facets.materials.length; i++) {
      expect(facets.materials[i] >= facets.materials[i - 1]).toBe(true);
    }
  });

  it('returns all unique colors', async () => {
    const facets = await getFacetMetadata('');
    expect(facets.colors).toContain('natural');
    expect(facets.colors).toContain('walnut');
    expect(facets.colors).toContain('black');
    expect(facets.colors).toContain('espresso');
  });

  it('returns colors sorted alphabetically', async () => {
    const facets = await getFacetMetadata('');
    for (let i = 1; i < facets.colors.length; i++) {
      expect(facets.colors[i] >= facets.colors[i - 1]).toBe(true);
    }
  });

  it('returns all unique feature tags', async () => {
    const facets = await getFacetMetadata('');
    expect(facets.featureTags).toContain('sleeper');
    expect(facets.featureTags).toContain('wall-hugger');
    expect(facets.featureTags).toContain('outdoor');
  });

  it('returns feature tags sorted alphabetically', async () => {
    const facets = await getFacetMetadata('');
    for (let i = 1; i < facets.featureTags.length; i++) {
      expect(facets.featureTags[i] >= facets.featureTags[i - 1]).toBe(true);
    }
  });

  it('returns all unique brands', async () => {
    const facets = await getFacetMetadata('');
    expect(facets.brands).toContain('Night & Day');
    expect(facets.brands).toContain('Strata');
    expect(facets.brands).toContain('Otis');
    expect(facets.brands).toContain('KD Frames');
  });

  it('returns dimension ranges', async () => {
    const facets = await getFacetMetadata('');
    expect(facets.dimensionRange.width.min).toBeGreaterThan(0);
    expect(facets.dimensionRange.width.max).toBeGreaterThan(facets.dimensionRange.width.min);
    expect(facets.dimensionRange.depth.min).toBeGreaterThan(0);
    expect(facets.dimensionRange.height.min).toBeGreaterThan(0);
  });

  it('returns width range across all products', async () => {
    const facets = await getFacetMetadata('');
    expect(facets.dimensionRange.width.min).toBe(20); // casegoodsItem
    expect(facets.dimensionRange.width.max).toBe(64); // murphyBed
  });

  it('caches results for same category', async () => {
    const first = await getFacetMetadata('futon-frames');
    const second = await getFacetMetadata('futon-frames');
    expect(first).toEqual(second);
  });

  it('returns different results for different categories', async () => {
    const frames = await getFacetMetadata('futon-frames');
    const mattresses = await getFacetMetadata('mattresses');
    expect(frames.totalProducts).not.toBe(mattresses.totalProducts);
  });

  it('cache can be cleared', async () => {
    await getFacetMetadata('futon-frames');
    __clearCache();
    // After clear, should re-fetch (but same data since mock is static)
    const result = await getFacetMetadata('futon-frames');
    expect(result.totalProducts).toBeGreaterThan(0);
  });

  it('returns zero ranges for empty category', async () => {
    const facets = await getFacetMetadata('nonexistent-category');
    expect(facets.totalProducts).toBe(0);
    expect(facets.priceRange.min).toBe(0);
    expect(facets.priceRange.max).toBe(0);
    expect(facets.materials).toHaveLength(0);
    expect(facets.dimensionRange.width.min).toBe(0);
  });

  it('handles null category', async () => {
    const facets = await getFacetMetadata(null);
    expect(facets.totalProducts).toBe(allProducts.length);
  });

  it('sanitizes category input', async () => {
    const facets = await getFacetMetadata('<script>alert(1)</script>');
    expect(facets).toBeDefined();
    expect(typeof facets.totalProducts).toBe('number');
  });

  it('returns correct structure', async () => {
    const facets = await getFacetMetadata('');
    expect(facets).toHaveProperty('totalProducts');
    expect(facets).toHaveProperty('priceRange');
    expect(facets).toHaveProperty('materials');
    expect(facets).toHaveProperty('colors');
    expect(facets).toHaveProperty('featureTags');
    expect(facets).toHaveProperty('brands');
    expect(facets).toHaveProperty('dimensionRange');
    expect(facets.priceRange).toHaveProperty('min');
    expect(facets.priceRange).toHaveProperty('max');
    expect(facets.dimensionRange).toHaveProperty('width');
    expect(facets.dimensionRange).toHaveProperty('depth');
    expect(facets.dimensionRange).toHaveProperty('height');
  });
});

// ── suggestFilterRelaxation ─────────────────────────────────────────

describe('suggestFilterRelaxation', () => {
  it('suggests removing material filter when no results', async () => {
    const result = await suggestFilterRelaxation({
      category: 'mattresses',
      materials: ['metal'],
    });
    expect(result.suggestions.length).toBeGreaterThan(0);
    const materialSuggestion = result.suggestions.find(s => s.filter === 'materials');
    expect(materialSuggestion).toBeDefined();
    expect(materialSuggestion.resultCount).toBeGreaterThan(0);
  });

  it('suggests removing price filter', async () => {
    const result = await suggestFilterRelaxation({
      category: 'futon-frames',
      priceMin: 5000,
      priceMax: 10000,
      materials: ['hardwood'],
    });
    const priceSuggestion = result.suggestions.find(s => s.filter === 'price');
    expect(priceSuggestion).toBeDefined();
  });

  it('suggests removing in-stock filter', async () => {
    // outdoorFrame is out of stock — filtering outdoor + inStock gives 0
    const result = await suggestFilterRelaxation({
      featureTags: ['outdoor'],
      inStockOnly: true,
    });
    const stockSuggestion = result.suggestions.find(s => s.filter === 'inStockOnly');
    expect(stockSuggestion).toBeDefined();
    expect(stockSuggestion.label).toBe('in-stock only');
  });

  it('sorts suggestions by result count descending', async () => {
    const result = await suggestFilterRelaxation({
      category: 'futon-frames',
      priceMin: 5000,
      materials: ['metal'],
      brands: ['Strata'],
    });
    for (let i = 1; i < result.suggestions.length; i++) {
      expect(result.suggestions[i].resultCount)
        .toBeLessThanOrEqual(result.suggestions[i - 1].resultCount);
    }
  });

  it('returns empty suggestions when no filters applied', async () => {
    const result = await suggestFilterRelaxation({ category: 'futon-frames' });
    expect(result.suggestions).toHaveLength(0);
  });

  it('returns correct label for each filter type', async () => {
    const result = await suggestFilterRelaxation({
      priceMin: 99999,
      materials: ['titanium'],
      colors: ['rainbow'],
      featureTags: ['flying'],
      brands: ['FakeCompany'],
      inStockOnly: true,
    });
    const labels = result.suggestions.map(s => s.label);
    // Not all may have suggestions, but any present should have correct labels
    result.suggestions.forEach(s => {
      expect(['price range', 'material', 'color', 'feature', 'brand', 'in-stock only'])
        .toContain(s.label);
    });
  });

  it('handles null params', async () => {
    const result = await suggestFilterRelaxation(null);
    expect(result.suggestions).toHaveLength(0);
  });

  it('returns suggestion structure with filter, label, resultCount', async () => {
    const result = await suggestFilterRelaxation({
      category: 'mattresses',
      materials: ['metal'],
    });
    if (result.suggestions.length > 0) {
      const s = result.suggestions[0];
      expect(s).toHaveProperty('filter');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('resultCount');
      expect(typeof s.resultCount).toBe('number');
    }
  });
});
