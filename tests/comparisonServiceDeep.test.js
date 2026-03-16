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
    ascending: (f) => { return chain; },
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
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
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

const mod = await import('../src/backend/comparisonService.web.js');
const {
  getComparisonData,
  buildShareableUrl,
  trackComparison,
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
} = mod;

// ─── Test helpers ──────────────────────────────────────────────────
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
// Constants
// ═════════════════════════════════════════════════════════════════════
describe('constants', () => {
  it('MAX_COMPARE is 4', () => {
    expect(MAX_COMPARE).toBe(4);
  });

  it('CATEGORY_ATTRIBUTES has expected categories', () => {
    expect(Object.keys(CATEGORY_ATTRIBUTES)).toContain('futon-frames');
    expect(Object.keys(CATEGORY_ATTRIBUTES)).toContain('mattresses');
    expect(Object.keys(CATEGORY_ATTRIBUTES)).toContain('murphy-cabinet-beds');
  });

  it('COMMON_ATTRIBUTES has brand and dimensions', () => {
    const labels = COMMON_ATTRIBUTES.map(a => a.label);
    expect(labels).toContain('Brand');
    expect(labels).toContain('Dimensions (W x D x H)');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getNestedValue
// ═════════════════════════════════════════════════════════════════════
describe('getNestedValue', () => {
  it('resolves top-level key', () => {
    expect(getNestedValue({ brand: 'Test' }, 'brand')).toBe('Test');
  });

  it('resolves nested key path', () => {
    expect(getNestedValue({ options: { size: 'Full' } }, 'options.size')).toBe('Full');
  });

  it('returns undefined for missing path', () => {
    expect(getNestedValue({ a: 1 }, 'b.c')).toBeUndefined();
  });

  it('returns undefined when intermediate is null', () => {
    expect(getNestedValue({ options: null }, 'options.size')).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// formatValue
// ═════════════════════════════════════════════════════════════════════
describe('formatValue', () => {
  it('returns dash for null/undefined', () => {
    expect(formatValue(null, 'text')).toBe('—');
    expect(formatValue(undefined, 'text')).toBe('—');
  });

  it('formats text as string', () => {
    expect(formatValue('Walnut', 'text')).toBe('Walnut');
    expect(formatValue(42, 'text')).toBe('42');
  });

  it('formats tags array', () => {
    expect(formatValue(['A', 'B'], 'tags')).toBe('A, B');
  });

  it('formats empty tags array as dash', () => {
    expect(formatValue([], 'tags')).toBe('—');
  });

  it('formats non-array tags as string', () => {
    expect(formatValue('solo', 'tags')).toBe('solo');
  });

  it('formats dimensions object', () => {
    expect(formatValue({ width: 72, depth: 36, height: 30 }, 'dimensions')).toBe('72" × 36" × 30"');
  });

  it('returns dash for invalid dimensions', () => {
    expect(formatValue('big', 'dimensions')).toBe('—');
    expect(formatValue({}, 'dimensions')).toBe('—');
  });

  it('formats stock boolean', () => {
    expect(formatValue(true, 'stock')).toBe('In Stock');
    expect(formatValue(false, 'stock')).toBe('Out of Stock');
  });

  it('formats price number', () => {
    expect(formatValue(499.5, 'price')).toBe('$499.50');
  });

  it('formats rating number', () => {
    expect(formatValue(4.2, 'rating')).toBe('4.2/5');
  });

  it('returns dash for non-number rating', () => {
    expect(formatValue('N/A', 'rating')).toBe('—');
  });

  it('falls back to String for unknown format', () => {
    expect(formatValue(42, 'unknown')).toBe('42');
  });
});

// ═════════════════════════════════════════════════════════════════════
// hasDifferences
// ═════════════════════════════════════════════════════════════════════
describe('hasDifferences', () => {
  it('returns false for single value', () => {
    expect(hasDifferences([1])).toBe(false);
  });

  it('returns false when all same', () => {
    expect(hasDifferences([5, 5, 5])).toBe(false);
  });

  it('returns true when values differ', () => {
    expect(hasDifferences([5, 10])).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(hasDifferences([])).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// findSharedCategory
// ═════════════════════════════════════════════════════════════════════
describe('findSharedCategory', () => {
  it('returns shared collection', () => {
    const products = [
      { collections: ['futon-frames', 'sale'] },
      { collections: ['futon-frames'] },
    ];
    expect(findSharedCategory(products)).toBe('futon-frames');
  });

  it('returns null when no overlap', () => {
    const products = [
      { collections: ['futon-frames'] },
      { collections: ['mattresses'] },
    ];
    expect(findSharedCategory(products)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(findSharedCategory([])).toBeNull();
  });

  it('handles missing collections gracefully', () => {
    const products = [{ collections: ['futon-frames'] }, {}];
    expect(findSharedCategory(products)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// computeWinnerBadges
// ═════════════════════════════════════════════════════════════════════
describe('computeWinnerBadges', () => {
  it('picks bestValue as lowest price', () => {
    const products = [
      { _id: 'a', price: 500, numericRating: 4, numReviews: 10 },
      { _id: 'b', price: 300, numericRating: 3, numReviews: 5 },
    ];
    expect(computeWinnerBadges(products).bestValue).toBe('b');
  });

  it('uses discountedPrice over price for bestValue', () => {
    const products = [
      { _id: 'a', price: 500, discountedPrice: 200, numericRating: 3, numReviews: 1 },
      { _id: 'b', price: 300, numericRating: 3, numReviews: 1 },
    ];
    expect(computeWinnerBadges(products).bestValue).toBe('a');
  });

  it('picks bestRated as highest rating', () => {
    const products = [
      { _id: 'a', price: 100, numericRating: 3.5, numReviews: 10 },
      { _id: 'b', price: 200, numericRating: 4.8, numReviews: 5 },
    ];
    expect(computeWinnerBadges(products).bestRated).toBe('b');
  });

  it('picks mostPopular as highest numReviews', () => {
    const products = [
      { _id: 'a', price: 100, numericRating: 4, numReviews: 100 },
      { _id: 'b', price: 100, numericRating: 4, numReviews: 50 },
    ];
    expect(computeWinnerBadges(products).mostPopular).toBe('a');
  });

  it('omits bestRated when fewer than 2 have ratings', () => {
    const products = [
      { _id: 'a', price: 100, numReviews: 10 },
      { _id: 'b', price: 200, numReviews: 5 },
    ];
    expect(computeWinnerBadges(products).bestRated).toBeUndefined();
  });

  it('omits bestValue when fewer than 2 have numeric prices', () => {
    const products = [
      { _id: 'a', price: 'free' },
      { _id: 'b', price: 'free' },
    ];
    expect(computeWinnerBadges(products).bestValue).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildComparisonRows
// ═════════════════════════════════════════════════════════════════════
describe('buildComparisonRows', () => {
  it('always starts with Price and Rating rows', () => {
    const p1 = makeProduct({ _id: 'a', price: 400, formattedPrice: '$400.00' });
    const p2 = makeProduct({ _id: 'b', price: 500, formattedPrice: '$500.00' });
    const rows = buildComparisonRows([p1, p2], 'futon-frames');
    expect(rows[0].label).toBe('Price');
    expect(rows[1].label).toBe('Rating');
  });

  it('uses category attributes when sharedCategory matches', () => {
    const p1 = makeProduct({ _id: 'a' });
    const p2 = makeProduct({ _id: 'b' });
    const rows = buildComparisonRows([p1, p2], 'futon-frames');
    const labels = rows.map(r => r.label);
    expect(labels).toContain('Frame Material');
    expect(labels).toContain('Finish');
  });

  it('falls back to COMMON_ATTRIBUTES when no shared category', () => {
    const p1 = makeProduct({ _id: 'a' });
    const p2 = makeProduct({ _id: 'b' });
    const rows = buildComparisonRows([p1, p2], null);
    const labels = rows.map(r => r.label);
    expect(labels).toContain('Brand');
    expect(labels).toContain('Dimensions (W x D x H)');
  });

  it('marks differs=true when prices differ', () => {
    const p1 = makeProduct({ _id: 'a', price: 400 });
    const p2 = makeProduct({ _id: 'b', price: 600 });
    const rows = buildComparisonRows([p1, p2], null);
    expect(rows[0].differs).toBe(true);
  });

  it('marks differs=false when prices are same', () => {
    const p1 = makeProduct({ _id: 'a', price: 400 });
    const p2 = makeProduct({ _id: 'b', price: 400 });
    const rows = buildComparisonRows([p1, p2], null);
    expect(rows[0].differs).toBe(false);
  });

  it('uses formattedDiscountedPrice when available', () => {
    const p1 = makeProduct({ _id: 'a', formattedDiscountedPrice: '$350.00', discountedPrice: 350 });
    const p2 = makeProduct({ _id: 'b' });
    const rows = buildComparisonRows([p1, p2], null);
    expect(rows[0].cells[0].value).toBe('$350.00');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getComparisonData
// ═════════════════════════════════════════════════════════════════════
describe('getComparisonData', () => {
  it('returns comparison data for valid products', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', name: 'Futon A', price: 400 }),
      makeProduct({ _id: 'p2', name: 'Futon B', price: 600 }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.badges).toBeDefined();
  });

  it('preserves requested order of products', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', name: 'First' }),
      makeProduct({ _id: 'p2', name: 'Second' }),
    ]);
    const result = await getComparisonData(['p2', 'p1']);
    expect(result.products[0].name).toBe('Second');
    expect(result.products[1].name).toBe('First');
  });

  it('rejects fewer than 2 IDs', async () => {
    const result = await getComparisonData(['p1']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2 products');
  });

  it('rejects non-array input', async () => {
    const result = await getComparisonData('p1');
    expect(result.success).toBe(false);
  });

  it('rejects when all IDs are invalid', async () => {
    const result = await getComparisonData(['', null]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('valid');
  });

  it('caps at MAX_COMPARE products', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1' }),
      makeProduct({ _id: 'p2' }),
      makeProduct({ _id: 'p3' }),
      makeProduct({ _id: 'p4' }),
      makeProduct({ _id: 'p5' }),
    ]);
    const result = await getComparisonData(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(result.products.length).toBeLessThanOrEqual(4);
  });

  it('returns error when fewer than 2 products found', async () => {
    __seed('Stores/Products', [makeProduct({ _id: 'p1' })]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('enough products');
  });

  it('includes product summaries with expected fields', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', ribbon: 'SALE', numericRating: 4.5, numReviews: 10 }),
      makeProduct({ _id: 'p2' }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    const s = result.products[0];
    expect(s).toHaveProperty('_id', 'p1');
    expect(s).toHaveProperty('name');
    expect(s).toHaveProperty('slug');
    expect(s).toHaveProperty('price');
    expect(s).toHaveProperty('ribbon', 'SALE');
    expect(s).toHaveProperty('numericRating', 4.5);
    expect(s).toHaveProperty('numReviews', 10);
  });

  it('defaults inStock to true when not explicitly false', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', inStock: undefined }),
      makeProduct({ _id: 'p2' }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.products[0].inStock).toBe(true);
  });

  it('returns sharedCategory when products share a collection', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', collections: ['mattresses'] }),
      makeProduct({ _id: 'p2', collections: ['mattresses'] }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.sharedCategory).toBe('mattresses');
  });

  it('returns null sharedCategory when products differ', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', collections: ['futon-frames'] }),
      makeProduct({ _id: 'p2', collections: ['mattresses'] }),
    ]);
    const result = await getComparisonData(['p1', 'p2']);
    expect(result.sharedCategory).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildShareableUrl
// ═════════════════════════════════════════════════════════════════════
describe('buildShareableUrl', () => {
  it('builds URL with valid IDs', async () => {
    const url = await buildShareableUrl(['abc', 'def']);
    expect(url).toBe('/compare?ids=abc,def');
  });

  it('returns empty for fewer than 2 IDs', async () => {
    expect(await buildShareableUrl(['abc'])).toBe('');
  });

  it('returns empty for non-array', async () => {
    expect(await buildShareableUrl('abc')).toBe('');
  });

  it('filters out invalid IDs', async () => {
    expect(await buildShareableUrl(['abc', '', 'def'])).toBe('/compare?ids=abc,def');
  });

  it('returns empty when all IDs invalid', async () => {
    expect(await buildShareableUrl(['', null])).toBe('');
  });

  it('caps at MAX_COMPARE IDs', async () => {
    const url = await buildShareableUrl(['a', 'b', 'c', 'd', 'e']);
    const ids = url.split('ids=')[1].split(',');
    expect(ids.length).toBeLessThanOrEqual(4);
  });
});

// ═════════════════════════════════════════════════════════════════════
// trackComparison
// ═════════════════════════════════════════════════════════════════════
describe('trackComparison', () => {
  it('creates new record for first-time comparison', async () => {
    __seed('CompareHistory', []);
    const result = await trackComparison(['id-a', 'id-b']);
    expect(result).toBe(true);
    expect(_collections.CompareHistory).toHaveLength(1);
    expect(_collections.CompareHistory[0].viewCount).toBe(1);
  });

  it('sorts IDs for dedup (A,B same as B,A)', async () => {
    __seed('CompareHistory', []);
    await trackComparison(['id-b', 'id-a']);
    expect(_collections.CompareHistory[0].comparisonKey).toBe('id-a|id-b');
  });

  it('increments viewCount for existing comparison', async () => {
    __seed('CompareHistory', [{
      _id: 'ch1',
      comparisonKey: 'id-a|id-b',
      productIds: ['id-a', 'id-b'],
      viewCount: 3,
      lastViewed: new Date('2025-01-01'),
    }]);
    const result = await trackComparison(['id-b', 'id-a']);
    expect(result).toBe(true);
    const record = _collections.CompareHistory.find(r => r._id === 'ch1');
    expect(record.viewCount).toBe(4);
  });

  it('returns false for fewer than 2 IDs', async () => {
    expect(await trackComparison(['id-a'])).toBe(false);
  });

  it('returns false for non-array', async () => {
    expect(await trackComparison('id-a')).toBe(false);
  });

  it('returns false when all IDs invalid', async () => {
    expect(await trackComparison(['', null])).toBe(false);
  });

  it('stores productCount in new records', async () => {
    __seed('CompareHistory', []);
    await trackComparison(['id-a', 'id-b', 'id-c']);
    expect(_collections.CompareHistory[0].productCount).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getPopularComparisons
// ═════════════════════════════════════════════════════════════════════
describe('getPopularComparisons', () => {
  it('returns comparisons sorted by viewCount descending', async () => {
    __seed('CompareHistory', [
      { _id: 'c1', productIds: ['a', 'b'], viewCount: 5, lastViewed: new Date() },
      { _id: 'c2', productIds: ['c', 'd'], viewCount: 20, lastViewed: new Date() },
      { _id: 'c3', productIds: ['e', 'f'], viewCount: 10, lastViewed: new Date() },
    ]);
    const result = await getPopularComparisons(3);
    expect(result).toHaveLength(3);
    expect(result[0].viewCount).toBe(20);
    expect(result[1].viewCount).toBe(10);
    expect(result[2].viewCount).toBe(5);
  });

  it('respects limit parameter', async () => {
    __seed('CompareHistory', [
      { _id: 'c1', productIds: ['a', 'b'], viewCount: 5, lastViewed: new Date() },
      { _id: 'c2', productIds: ['c', 'd'], viewCount: 20, lastViewed: new Date() },
    ]);
    const result = await getPopularComparisons(1);
    expect(result).toHaveLength(1);
  });

  it('defaults to 5 when no limit given', async () => {
    __seed('CompareHistory', Array.from({ length: 10 }, (_, i) => ({
      _id: `c${i}`, productIds: ['a', 'b'], viewCount: i, lastViewed: new Date(),
    })));
    const result = await getPopularComparisons();
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('caps limit at 20', async () => {
    __seed('CompareHistory', Array.from({ length: 25 }, (_, i) => ({
      _id: `c${i}`, productIds: ['a', 'b'], viewCount: i, lastViewed: new Date(),
    })));
    const result = await getPopularComparisons(100);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('returns empty array on error', async () => {
    __seed('CompareHistory', []);
    const result = await getPopularComparisons(5);
    expect(result).toEqual([]);
  });

  it('returns productIds and viewCount in each item', async () => {
    __seed('CompareHistory', [
      { _id: 'c1', productIds: ['x', 'y'], viewCount: 7, lastViewed: new Date() },
    ]);
    const result = await getPopularComparisons(5);
    expect(result[0]).toHaveProperty('productIds');
    expect(result[0]).toHaveProperty('viewCount', 7);
    expect(result[0]).toHaveProperty('lastViewed');
  });

  it('clamps limit minimum to 1', async () => {
    __seed('CompareHistory', [
      { _id: 'c1', productIds: ['a', 'b'], viewCount: 5, lastViewed: new Date() },
    ]);
    const result = await getPopularComparisons(0);
    expect(result).toHaveLength(1);
  });
});
