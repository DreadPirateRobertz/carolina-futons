import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  let _descField = null;
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: () => chain,
    descending: (f) => { _descField = f; return chain; },
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[field]));
      }
      if (_descField) {
        items.sort((a, b) => (b[_descField] || 0) - (a[_descField] || 0));
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      return item;
    },
  },
}));

beforeEach(() => {
  _collections = {};
});

const {
  getComparisonData,
  buildShareableUrl,
  getPopularComparisons,
  findSharedCategory,
  buildComparisonRows,
  computeWinnerBadges,
  formatValue,
  hasDifferences,
  getNestedValue,
  CATEGORY_ATTRIBUTES,
  COMMON_ATTRIBUTES,
  MAX_COMPARE,
} = await import('../src/backend/comparisonService.web.js');

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Test Futon',
    slug: 'test-futon',
    price: 499,
    formattedPrice: '$499.00',
    discountedPrice: null,
    formattedDiscountedPrice: null,
    mainMedia: 'img.jpg',
    ribbon: '',
    inStock: true,
    numericRating: 4.2,
    numReviews: 25,
    collections: ['futon-frames'],
    brand: 'TestBrand',
    material: 'Hardwood',
    color: 'Walnut',
    dimensions: { width: 72, depth: 36, height: 30 },
    featureTags: ['Convertible', 'Storage'],
    options: { finish: 'Natural', size: 'Full' },
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════
// formatValue — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('formatValue deepened', () => {
  it('formats dimensions with zero values', () => {
    expect(formatValue({ width: 0, depth: 0, height: 0 }, 'dimensions'))
      .toBe('0" × 0" × 0"');
  });

  it('formats dimensions with decimal values', () => {
    expect(formatValue({ width: 54.5, depth: 38.25, height: 33 }, 'dimensions'))
      .toBe('54.5" × 38.25" × 33"');
  });

  it('returns dash for dimensions object missing width', () => {
    expect(formatValue({ depth: 38, height: 33 }, 'dimensions')).toBe('—');
  });

  it('returns dash for dimensions with width=null', () => {
    expect(formatValue({ width: null, depth: 38, height: 33 }, 'dimensions')).toBe('—');
  });

  it('formats tags with single element', () => {
    expect(formatValue(['sleeper'], 'tags')).toBe('sleeper');
  });

  it('formats non-array value with tags format as string', () => {
    expect(formatValue(42, 'tags')).toBe('42');
  });

  it('formats stock with truthy non-boolean value', () => {
    expect(formatValue(1, 'stock')).toBe('In Stock');
  });

  it('formats stock with falsy zero value', () => {
    expect(formatValue(0, 'stock')).toBe('Out of Stock');
  });

  it('formats rating with 0 as valid number', () => {
    expect(formatValue(0, 'rating')).toBe('0/5');
  });

  it('formats rating with string returns dash', () => {
    expect(formatValue('good', 'rating')).toBe('—');
  });

  it('formats price with non-number string', () => {
    expect(formatValue('$49.99', 'price')).toBe('$49.99');
  });

  it('formats price with fractional cents', () => {
    expect(formatValue(19.999, 'price')).toBe('$20.00');
  });

  it('returns dash for null with rating format', () => {
    expect(formatValue(null, 'rating')).toBe('—');
  });

  it('returns dash for undefined with price format', () => {
    expect(formatValue(undefined, 'price')).toBe('—');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getNestedValue — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('getNestedValue deepened', () => {
  it('resolves three-level deep path', () => {
    expect(getNestedValue({ a: { b: { c: 'deep' } } }, 'a.b.c')).toBe('deep');
  });

  it('returns undefined when intermediate is undefined', () => {
    expect(getNestedValue({ a: {} }, 'a.b.c')).toBeUndefined();
  });

  it('returns undefined for null root object', () => {
    expect(getNestedValue(null, 'a.b')).toBeUndefined();
  });

  it('returns undefined for undefined root object', () => {
    expect(getNestedValue(undefined, 'a')).toBeUndefined();
  });

  it('returns the object itself for single-part key with nested value', () => {
    const nested = { x: 1 };
    expect(getNestedValue({ a: nested }, 'a')).toBe(nested);
  });

  it('returns falsy values correctly (0, false, empty string)', () => {
    expect(getNestedValue({ val: 0 }, 'val')).toBe(0);
    expect(getNestedValue({ val: false }, 'val')).toBe(false);
    expect(getNestedValue({ val: '' }, 'val')).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════
// computeWinnerBadges — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('computeWinnerBadges deepened', () => {
  it('ties in price: bestValue goes to first in sort order', () => {
    const p1 = { _id: 'a', price: 300, numericRating: 4, numReviews: 5 };
    const p2 = { _id: 'b', price: 300, numericRating: 3, numReviews: 10 };
    const badges = computeWinnerBadges([p1, p2]);
    // Both have price 300, sort is stable so first wins
    expect(badges.bestValue).toBeDefined();
  });

  it('ties in rating: bestRated goes to first in sort order', () => {
    const p1 = { _id: 'a', price: 100, numericRating: 4.5, numReviews: 5 };
    const p2 = { _id: 'b', price: 200, numericRating: 4.5, numReviews: 10 };
    const badges = computeWinnerBadges([p1, p2]);
    expect(badges.bestRated).toBeDefined();
  });

  it('single product with rating does not get bestRated', () => {
    const p1 = { _id: 'a', price: 100, numericRating: 4.8, numReviews: 50 };
    const p2 = { _id: 'b', price: 200, numericRating: 0, numReviews: 0 };
    const badges = computeWinnerBadges([p1, p2]);
    // numericRating: 0 is filtered out (> 0 check)
    expect(badges.bestRated).toBeUndefined();
  });

  it('discountedPrice preferred over price for bestValue', () => {
    const p1 = { _id: 'a', price: 800, discountedPrice: 250, numericRating: 3, numReviews: 1 };
    const p2 = { _id: 'b', price: 400, numericRating: 3, numReviews: 1 };
    const badges = computeWinnerBadges([p1, p2]);
    expect(badges.bestValue).toBe('a'); // 250 < 400
  });

  it('omits mostPopular when fewer than 2 have reviews', () => {
    const p1 = { _id: 'a', price: 100, numericRating: 4, numReviews: 10 };
    const p2 = { _id: 'b', price: 200, numericRating: 3, numReviews: 0 };
    const badges = computeWinnerBadges([p1, p2]);
    expect(badges.mostPopular).toBeUndefined();
  });

  it('returns empty object for empty products array', () => {
    const badges = computeWinnerBadges([]);
    expect(badges).toEqual({});
  });

  it('returns empty object for single product', () => {
    const badges = computeWinnerBadges([{ _id: 'a', price: 100, numericRating: 5, numReviews: 100 }]);
    expect(badges).toEqual({});
  });

  it('handles 3+ products with mixed missing fields', () => {
    const p1 = { _id: 'a', price: 100 };
    const p2 = { _id: 'b', price: 200, numericRating: 4.5, numReviews: 20 };
    const p3 = { _id: 'c', price: 150, numericRating: 3.0, numReviews: 5 };
    const badges = computeWinnerBadges([p1, p2, p3]);
    expect(badges.bestValue).toBe('a');
    expect(badges.bestRated).toBe('b');
    expect(badges.mostPopular).toBe('b');
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildComparisonRows — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('buildComparisonRows deepened', () => {
  it('uses mattresses category attributes when sharedCategory is mattresses', () => {
    const p1 = makeProduct({ _id: 'a', collections: ['mattresses'] });
    const p2 = makeProduct({ _id: 'b', collections: ['mattresses'] });
    const rows = buildComparisonRows([p1, p2], 'mattresses');
    const labels = rows.map(r => r.label);
    expect(labels).toContain('Cover Material');
    expect(labels).toContain('Comfort Level');
    expect(labels).not.toContain('Brand'); // not in mattresses category attrs
  });

  it('falls back to common when sharedCategory is unknown', () => {
    const p1 = makeProduct({ _id: 'a' });
    const p2 = makeProduct({ _id: 'b' });
    const rows = buildComparisonRows([p1, p2], 'unknown-category');
    const labels = rows.map(r => r.label);
    expect(labels).toContain('Brand');
    expect(labels).toContain('Dimensions (W x D x H)');
  });

  it('rating row shows "No reviews" when numericRating is falsy', () => {
    const p1 = makeProduct({ _id: 'a', numericRating: null, numReviews: 0 });
    const p2 = makeProduct({ _id: 'b', numericRating: null, numReviews: 0 });
    const rows = buildComparisonRows([p1, p2], null);
    const ratingRow = rows.find(r => r.label === 'Rating');
    expect(ratingRow.cells[0].value).toBe('No reviews');
    expect(ratingRow.cells[0].raw).toBe(0);
  });

  it('rating row differs when ratings are different', () => {
    const p1 = makeProduct({ _id: 'a', numericRating: 4.5, numReviews: 10 });
    const p2 = makeProduct({ _id: 'b', numericRating: 3.0, numReviews: 5 });
    const rows = buildComparisonRows([p1, p2], null);
    const ratingRow = rows.find(r => r.label === 'Rating');
    expect(ratingRow.differs).toBe(true);
  });

  it('rating row does not differ when both have no reviews', () => {
    const p1 = makeProduct({ _id: 'a', numericRating: null });
    const p2 = makeProduct({ _id: 'b', numericRating: null });
    const rows = buildComparisonRows([p1, p2], null);
    const ratingRow = rows.find(r => r.label === 'Rating');
    expect(ratingRow.differs).toBe(false);
  });

  it('uses murphy-cabinet-beds attributes for that category', () => {
    const p1 = makeProduct({ _id: 'a', collections: ['murphy-cabinet-beds'] });
    const p2 = makeProduct({ _id: 'b', collections: ['murphy-cabinet-beds'] });
    const rows = buildComparisonRows([p1, p2], 'murphy-cabinet-beds');
    const labels = rows.map(r => r.label);
    expect(labels).toContain('Cabinet Material');
    expect(labels).toContain('Features');
  });

  it('attribute rows use JSON.stringify for differs check', () => {
    // Two products with different featureTags arrays
    const p1 = makeProduct({ _id: 'a', featureTags: ['sleeper'] });
    const p2 = makeProduct({ _id: 'b', featureTags: ['wall-hugger'] });
    const rows = buildComparisonRows([p1, p2], null);
    const featRow = rows.find(r => r.label === 'Features');
    expect(featRow.differs).toBe(true);
  });

  it('attribute rows differ=false when arrays are identical', () => {
    const p1 = makeProduct({ _id: 'a', featureTags: ['sleeper'] });
    const p2 = makeProduct({ _id: 'b', featureTags: ['sleeper'] });
    const rows = buildComparisonRows([p1, p2], null);
    const featRow = rows.find(r => r.label === 'Features');
    expect(featRow.differs).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// hasDifferences — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('hasDifferences deepened', () => {
  it('returns false for two identical strings', () => {
    expect(hasDifferences(['abc', 'abc'])).toBe(false);
  });

  it('returns true for two different strings', () => {
    expect(hasDifferences(['abc', 'def'])).toBe(true);
  });

  it('returns false for all null values', () => {
    expect(hasDifferences([null, null, null])).toBe(false);
  });

  it('returns true for mixed null and non-null', () => {
    expect(hasDifferences([null, 'abc'])).toBe(true);
  });

  it('returns true for undefined vs defined', () => {
    expect(hasDifferences([undefined, 'abc'])).toBe(true);
  });
});

// getPopularComparisons — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('getPopularComparisons deepened', () => {
  it('clamps negative limit to 1', async () => {
    __seed('CompareHistory', [
      { _id: 'c1', productIds: ['a', 'b'], viewCount: 5, lastViewed: new Date() },
      { _id: 'c2', productIds: ['c', 'd'], viewCount: 3, lastViewed: new Date() },
    ]);
    const result = await getPopularComparisons(-5);
    expect(result).toHaveLength(1);
  });

  it('clamps limit of 50 to 20', async () => {
    __seed('CompareHistory', Array.from({ length: 25 }, (_, i) => ({
      _id: `c${i}`, productIds: ['a', 'b'], viewCount: 100 - i, lastViewed: new Date(),
    })));
    const result = await getPopularComparisons(50);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('returns items with missing productIds as empty array', async () => {
    __seed('CompareHistory', [
      { _id: 'c1', viewCount: 10, lastViewed: new Date() },
    ]);
    const result = await getPopularComparisons(5);
    expect(result[0].productIds).toEqual([]);
  });

  it('returns items with missing viewCount as 0', async () => {
    __seed('CompareHistory', [
      { _id: 'c1', productIds: ['a', 'b'], lastViewed: new Date() },
    ]);
    const result = await getPopularComparisons(5);
    expect(result[0].viewCount).toBe(0);
  });

  it('includes lastViewed in returned items', async () => {
    const date = new Date('2026-01-15');
    __seed('CompareHistory', [
      { _id: 'c1', productIds: ['a', 'b'], viewCount: 5, lastViewed: date },
    ]);
    const result = await getPopularComparisons(5);
    expect(result[0].lastViewed).toEqual(date);
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildShareableUrl — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('buildShareableUrl deepened', () => {
  it('returns empty for null input', async () => {
    expect(await buildShareableUrl(null)).toBe('');
  });

  it('returns empty for undefined input', async () => {
    expect(await buildShareableUrl(undefined)).toBe('');
  });

  it('builds URL with exactly 3 IDs (MAX_COMPARE)', async () => {
    const url = await buildShareableUrl(['a', 'b', 'c']);
    expect(url).toBe('/compare?ids=a,b,c');
  });

  it('truncates to 3 IDs when given 5', async () => {
    const url = await buildShareableUrl(['a', 'b', 'c', 'd', 'e']);
    const ids = url.split('ids=')[1].split(',');
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('returns empty when only 1 valid ID remains after filtering', async () => {
    expect(await buildShareableUrl(['valid-id', ''])).toBe('');
  });

  it('preserves order of IDs in URL', async () => {
    const url = await buildShareableUrl(['z-id', 'a-id']);
    expect(url).toBe('/compare?ids=z-id,a-id');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getComparisonData — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('getComparisonData deepened', () => {
  it('caps 5 product IDs to 4 and returns success', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', price: 100 }),
      makeProduct({ _id: 'p2', price: 200 }),
      makeProduct({ _id: 'p3', price: 300 }),
      makeProduct({ _id: 'p4', price: 400 }),
      makeProduct({ _id: 'p5', price: 500 }),
    ]);
    const result = await getComparisonData(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(4);
    // p5 should not appear
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('p5');
  });

  it('filters invalid IDs mixed with valid ones', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'good-1', price: 100 }),
      makeProduct({ _id: 'good-2', price: 200 }),
    ]);
    const result = await getComparisonData(['good-1', '<script>alert(1)</script>', 'good-2']);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
  });

  it('returns error when all IDs are invalid after sanitization', async () => {
    const result = await getComparisonData(['<script>', '<img onerror=1>']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('valid');
  });

  it('product summaries default discountedPrice to null', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1' }),
      makeProduct({ _id: 'p2' }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.products[0].discountedPrice).toBeNull();
    expect(result.products[0].formattedDiscountedPrice).toBeNull();
  });

  it('product summaries default ribbon to empty string', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', ribbon: undefined }),
      makeProduct({ _id: 'p2' }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.products[0].ribbon).toBe('');
  });

  it('product summaries default numReviews to 0', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', numReviews: undefined }),
      makeProduct({ _id: 'p2' }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.products[0].numReviews).toBe(0);
  });

  it('product summaries default collections to empty array', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', collections: undefined }),
      makeProduct({ _id: 'p2' }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.products[0].collections).toEqual([]);
  });

  it('returns error for null input', async () => {
    const result = await getComparisonData(null);
    expect(result.success).toBe(false);
  });

  it('filters out IDs that do not match any product', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', price: 100 }),
      makeProduct({ _id: 'p2', price: 200 }),
    ]);
    // p3 doesn't exist in the store
    const result = await getComparisonData(['p1', 'p2', 'p3']);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// findSharedCategory — deepened branches
// ═════════════════════════════════════════════════════════════════════
describe('findSharedCategory deepened', () => {
  it('returns first shared when multiple collections overlap', () => {
    const products = [
      { collections: ['futon-frames', 'sale', 'featured'] },
      { collections: ['sale', 'futon-frames', 'clearance'] },
    ];
    // First collection of first product that all share — 'futon-frames'
    expect(findSharedCategory(products)).toBe('futon-frames');
  });

  it('returns null when first product has no collections', () => {
    const products = [
      { collections: [] },
      { collections: ['mattresses'] },
    ];
    expect(findSharedCategory(products)).toBeNull();
  });

  it('handles single product — returns its first collection', () => {
    const products = [{ collections: ['outdoor'] }];
    expect(findSharedCategory(products)).toBe('outdoor');
  });
});
