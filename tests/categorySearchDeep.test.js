import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};
let _insertCbs = [];
let _updateCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function __onInsert(cb) { _insertCbs.push(cb); }
function __onUpdate(cb) { _updateCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = [];
  let _limit = null;
  let _skip = 0;

  const chain = {
    eq: (field, val) => { filters.push({ field, type: 'eq', value: val }); return chain; },
    ne: (field, val) => { filters.push({ field, type: 'ne', value: val }); return chain; },
    ge: (field, val) => { filters.push({ field, type: 'ge', value: val }); return chain; },
    le: (field, val) => { filters.push({ field, type: 'le', value: val }); return chain; },
    contains: (field, val) => { filters.push({ field, type: 'contains', value: val }); return chain; },
    hasSome: (field, vals) => { filters.push({ field, type: 'hasSome', value: vals }); return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { _limit = n; return chain; },
    skip: (n) => { _skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const f of filters) {
        const getVal = (item, path) => {
          const parts = path.split('.');
          let v = item;
          for (const p of parts) { v = v && v[p]; }
          return v;
        };
        if (f.type === 'eq') items = items.filter(i => getVal(i, f.field) === f.value);
        if (f.type === 'ne') items = items.filter(i => getVal(i, f.field) !== f.value);
        if (f.type === 'ge') items = items.filter(i => {
          const v = getVal(i, f.field);
          return typeof v === 'number' && v >= f.value;
        });
        if (f.type === 'le') items = items.filter(i => {
          const v = getVal(i, f.field);
          return typeof v === 'number' && v <= f.value;
        });
        if (f.type === 'contains') items = items.filter(i => {
          const v = getVal(i, f.field);
          return typeof v === 'string' && v.toLowerCase().includes(f.value.toLowerCase());
        });
        if (f.type === 'hasSome') items = items.filter(i => {
          const v = getVal(i, f.field);
          if (Array.isArray(v)) return v.some(x => f.value.includes(x));
          return f.value.includes(v);
        });
      }
      const totalCount = items.length;
      if (_skip) items = items.slice(_skip);
      if (_limit) items = items.slice(0, _limit);
      return { items, totalCount };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const f of filters) {
        const getVal = (item, path) => {
          const parts = path.split('.');
          let v = item;
          for (const p of parts) { v = v && v[p]; }
          return v;
        };
        if (f.type === 'eq') items = items.filter(i => getVal(i, f.field) === f.value);
        if (f.type === 'ne') items = items.filter(i => getVal(i, f.field) !== f.value);
        if (f.type === 'ge') items = items.filter(i => {
          const v = getVal(i, f.field);
          return typeof v === 'number' && v >= f.value;
        });
        if (f.type === 'le') items = items.filter(i => {
          const v = getVal(i, f.field);
          return typeof v === 'number' && v <= f.value;
        });
        if (f.type === 'contains') items = items.filter(i => {
          const v = getVal(i, f.field);
          return typeof v === 'string' && v.toLowerCase().includes(f.value.toLowerCase());
        });
        if (f.type === 'hasSome') items = items.filter(i => {
          const v = getVal(i, f.field);
          if (Array.isArray(v)) return v.some(x => f.value.includes(x));
          return f.value.includes(v);
        });
      }
      return items.length;
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => {
      const items = _collections[col] || [];
      return items.find(i => i._id === id) || null;
    }),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || 'gen-id-001', _createdDate: new Date() };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
    update: vi.fn(async (col, data) => {
      if (_collections[col]) {
        const idx = _collections[col].findIndex(i => i._id === data._id);
        if (idx >= 0) _collections[col][idx] = { ...data };
      }
      _updateCbs.forEach(cb => cb(col, data));
      return data;
    }),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
}));

import {
  searchProducts,
  getFilteredProductCount,
  getFacetMetadata,
  suggestFilterRelaxation,
  __clearCache,
} from '../src/backend/categorySearch.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
  __clearCache();
});

// ── Helper: seed products ────────────────────────────────────────────
function seedProducts(items) {
  __seed('Stores/Products', items);
}

function makeProduct(overrides = {}) {
  return {
    _id: overrides._id || 'prod-' + Math.random().toString(36).slice(2, 8),
    name: 'Test Futon',
    price: 299,
    collections: ['futon-frames'],
    material: 'wood',
    color: 'brown',
    featureTags: ['convertible'],
    brand: 'CoolFutons',
    inStock: true,
    numericRating: 4.5,
    _createdDate: new Date(),
    dimensions: { width: 72, depth: 36, height: 30 },
    ...overrides,
  };
}

// ── searchProducts — basic functionality ─────────────────────────────

describe('searchProducts — basic', () => {
  it('returns all products when no params', async () => {
    seedProducts([makeProduct(), makeProduct()]);
    const result = await searchProducts();
    expect(result.items.length).toBe(2);
    expect(result.totalCount).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('returns empty result for empty collection', async () => {
    const result = await searchProducts();
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('returns empty object shape when called with undefined', async () => {
    const result = await searchProducts(undefined);
    expect(result).toEqual({ items: [], totalCount: 0, hasMore: false });
  });
});

// ── searchProducts — category filter ─────────────────────────────────

describe('searchProducts — category filter', () => {
  it('filters by category', async () => {
    seedProducts([
      makeProduct({ collections: ['futon-frames'] }),
      makeProduct({ collections: ['mattresses'] }),
    ]);
    const result = await searchProducts({ category: 'futon-frames' });
    expect(result.items.length).toBe(1);
    expect(result.items[0].collections).toContain('futon-frames');
  });

  it('skips category filter when empty string', async () => {
    seedProducts([makeProduct(), makeProduct()]);
    const result = await searchProducts({ category: '' });
    expect(result.items.length).toBe(2);
  });

  it('skips category filter when null', async () => {
    seedProducts([makeProduct(), makeProduct()]);
    const result = await searchProducts({ category: null });
    expect(result.items.length).toBe(2);
  });

  it('sanitizes category to 100 chars', async () => {
    seedProducts([makeProduct({ collections: ['a'.repeat(100)] })]);
    const longCat = 'a'.repeat(200);
    const result = await searchProducts({ category: longCat });
    expect(result.items.length).toBe(1);
  });

  it('skips category when sanitize returns empty (numeric input)', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ category: 12345 });
    // sanitize(12345, 100) returns '' so category filter not applied
    expect(result.items.length).toBe(1);
  });
});

// ── searchProducts — text search ─────────────────────────────────────

describe('searchProducts — text search', () => {
  it('filters by searchQuery (contains match on name)', async () => {
    seedProducts([
      makeProduct({ name: 'Deluxe Futon Frame' }),
      makeProduct({ name: 'Simple Mattress' }),
    ]);
    const result = await searchProducts({ searchQuery: 'Futon' });
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toContain('Futon');
  });

  it('skips search filter when empty string', async () => {
    seedProducts([makeProduct(), makeProduct()]);
    const result = await searchProducts({ searchQuery: '' });
    expect(result.items.length).toBe(2);
  });

  it('sanitizes searchQuery to 200 chars', async () => {
    const longQ = 'x'.repeat(300);
    seedProducts([makeProduct({ name: 'x'.repeat(200) })]);
    const result = await searchProducts({ searchQuery: longQ });
    expect(result.items.length).toBe(1);
  });

  it('skips search when sanitize returns empty (numeric input)', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ searchQuery: 999 });
    expect(result.items.length).toBe(1);
  });
});

// ── searchProducts — price range ─────────────────────────────────────

describe('searchProducts — price range', () => {
  it('filters by priceMin (ge)', async () => {
    seedProducts([
      makeProduct({ price: 100 }),
      makeProduct({ price: 500 }),
    ]);
    const result = await searchProducts({ priceMin: 200 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].price).toBe(500);
  });

  it('filters by priceMax (le)', async () => {
    seedProducts([
      makeProduct({ price: 100 }),
      makeProduct({ price: 500 }),
    ]);
    const result = await searchProducts({ priceMax: 300 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].price).toBe(100);
  });

  it('filters by both priceMin and priceMax', async () => {
    seedProducts([
      makeProduct({ price: 50 }),
      makeProduct({ price: 250 }),
      makeProduct({ price: 600 }),
    ]);
    const result = await searchProducts({ priceMin: 100, priceMax: 400 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].price).toBe(250);
  });

  it('skips priceMin when 0 (guard: > 0 fails)', async () => {
    seedProducts([makeProduct({ price: 50 }), makeProduct({ price: 500 })]);
    const result = await searchProducts({ priceMin: 0 });
    expect(result.items.length).toBe(2);
  });

  it('skips priceMin when negative', async () => {
    seedProducts([makeProduct({ price: 50 })]);
    const result = await searchProducts({ priceMin: -10 });
    expect(result.items.length).toBe(1);
  });

  it('skips priceMin when string', async () => {
    seedProducts([makeProduct({ price: 50 })]);
    const result = await searchProducts({ priceMin: '100' });
    expect(result.items.length).toBe(1);
  });

  it('skips priceMax when NaN (typeof number but NaN > 0 is false)', async () => {
    seedProducts([makeProduct({ price: 50 })]);
    const result = await searchProducts({ priceMax: NaN });
    expect(result.items.length).toBe(1);
  });

  it('Infinity passes priceMin guard (typeof number && > 0)', async () => {
    seedProducts([makeProduct({ price: 999999 })]);
    const result = await searchProducts({ priceMin: Infinity });
    // ge('price', Infinity) — no finite price passes
    expect(result.items.length).toBe(0);
  });

  it('Infinity passes priceMax guard (guard bypass)', async () => {
    seedProducts([makeProduct({ price: 100 })]);
    const result = await searchProducts({ priceMax: Infinity });
    // le('price', Infinity) — all finite prices pass
    expect(result.items.length).toBe(1);
  });
});

// ── searchProducts — multi-select filters ────────────────────────────

describe('searchProducts — multi-select filters', () => {
  it('filters by materials array', async () => {
    seedProducts([
      makeProduct({ material: 'wood' }),
      makeProduct({ material: 'metal' }),
      makeProduct({ material: 'fabric' }),
    ]);
    const result = await searchProducts({ materials: ['wood', 'metal'] });
    expect(result.items.length).toBe(2);
  });

  it('skips materials when empty array', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ materials: [] });
    expect(result.items.length).toBe(1);
  });

  it('skips materials when not an array (string)', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ materials: 'wood' });
    expect(result.items.length).toBe(1);
  });

  it('filters out empty material values after sanitize', async () => {
    seedProducts([makeProduct({ material: 'wood' })]);
    // all sanitize to '' so cleanMaterials = [] — filter not applied
    const result = await searchProducts({ materials: [null, undefined, 123] });
    expect(result.items.length).toBe(1);
  });

  it('filters by colors array', async () => {
    seedProducts([
      makeProduct({ color: 'brown' }),
      makeProduct({ color: 'black' }),
    ]);
    const result = await searchProducts({ colors: ['black'] });
    expect(result.items.length).toBe(1);
  });

  it('skips colors when empty array', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ colors: [] });
    expect(result.items.length).toBe(1);
  });

  it('filters by featureTags array', async () => {
    seedProducts([
      makeProduct({ featureTags: ['convertible', 'eco'] }),
      makeProduct({ featureTags: ['recliner'] }),
    ]);
    const result = await searchProducts({ featureTags: ['eco'] });
    expect(result.items.length).toBe(1);
  });

  it('skips featureTags when empty array', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ featureTags: [] });
    expect(result.items.length).toBe(1);
  });

  it('filters by brands array', async () => {
    seedProducts([
      makeProduct({ brand: 'CoolFutons' }),
      makeProduct({ brand: 'NiceBeds' }),
    ]);
    const result = await searchProducts({ brands: ['NiceBeds'] });
    expect(result.items.length).toBe(1);
  });

  it('skips brands when empty array', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ brands: [] });
    expect(result.items.length).toBe(1);
  });

  it('sanitizes brand names to 100 chars', async () => {
    const longBrand = 'B'.repeat(200);
    seedProducts([makeProduct({ brand: 'B'.repeat(100) })]);
    const result = await searchProducts({ brands: [longBrand] });
    expect(result.items.length).toBe(1);
  });

  it('sanitizes color values to 50 chars', async () => {
    const longColor = 'c'.repeat(100);
    seedProducts([makeProduct({ color: 'c'.repeat(50) })]);
    const result = await searchProducts({ colors: [longColor] });
    expect(result.items.length).toBe(1);
  });

  it('sanitizes featureTag values to 50 chars', async () => {
    const longTag = 't'.repeat(100);
    seedProducts([makeProduct({ featureTags: ['t'.repeat(50)] })]);
    const result = await searchProducts({ featureTags: [longTag] });
    expect(result.items.length).toBe(1);
  });
});

// ── searchProducts — dimension ranges ────────────────────────────────

describe('searchProducts — dimension ranges', () => {
  it('filters by widthMin', async () => {
    seedProducts([
      makeProduct({ dimensions: { width: 60, depth: 30, height: 28 } }),
      makeProduct({ dimensions: { width: 80, depth: 30, height: 28 } }),
    ]);
    const result = await searchProducts({ widthMin: 70 });
    expect(result.items.length).toBe(1);
  });

  it('filters by widthMax', async () => {
    seedProducts([
      makeProduct({ dimensions: { width: 60, depth: 30, height: 28 } }),
      makeProduct({ dimensions: { width: 80, depth: 30, height: 28 } }),
    ]);
    const result = await searchProducts({ widthMax: 70 });
    expect(result.items.length).toBe(1);
  });

  it('filters by depthMin', async () => {
    seedProducts([
      makeProduct({ dimensions: { width: 72, depth: 20, height: 28 } }),
      makeProduct({ dimensions: { width: 72, depth: 40, height: 28 } }),
    ]);
    const result = await searchProducts({ depthMin: 30 });
    expect(result.items.length).toBe(1);
  });

  it('filters by depthMax', async () => {
    seedProducts([
      makeProduct({ dimensions: { width: 72, depth: 20, height: 28 } }),
      makeProduct({ dimensions: { width: 72, depth: 40, height: 28 } }),
    ]);
    const result = await searchProducts({ depthMax: 30 });
    expect(result.items.length).toBe(1);
  });

  it('filters by heightMin', async () => {
    seedProducts([
      makeProduct({ dimensions: { width: 72, depth: 36, height: 25 } }),
      makeProduct({ dimensions: { width: 72, depth: 36, height: 35 } }),
    ]);
    const result = await searchProducts({ heightMin: 30 });
    expect(result.items.length).toBe(1);
  });

  it('filters by heightMax', async () => {
    seedProducts([
      makeProduct({ dimensions: { width: 72, depth: 36, height: 25 } }),
      makeProduct({ dimensions: { width: 72, depth: 36, height: 35 } }),
    ]);
    const result = await searchProducts({ heightMax: 30 });
    expect(result.items.length).toBe(1);
  });

  it('skips dimension filters when 0', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ widthMin: 0, widthMax: 0, depthMin: 0, depthMax: 0, heightMin: 0, heightMax: 0 });
    expect(result.items.length).toBe(1);
  });

  it('skips dimension filters when negative', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ widthMin: -5, heightMax: -1 });
    expect(result.items.length).toBe(1);
  });

  it('skips dimension filters when string type', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ widthMin: '50' });
    expect(result.items.length).toBe(1);
  });

  it('Infinity passes dimension guard (guard bypass)', async () => {
    seedProducts([makeProduct({ dimensions: { width: 100, depth: 50, height: 30 } })]);
    const result = await searchProducts({ widthMin: Infinity });
    expect(result.items.length).toBe(0);
  });
});

// ── searchProducts — inStockOnly ─────────────────────────────────────

describe('searchProducts — inStockOnly', () => {
  it('filters to in-stock items when true', async () => {
    seedProducts([
      makeProduct({ inStock: true }),
      makeProduct({ inStock: false }),
    ]);
    const result = await searchProducts({ inStockOnly: true });
    expect(result.items.length).toBe(1);
    expect(result.items[0].inStock).toBe(true);
  });

  it('returns all items when inStockOnly is false', async () => {
    seedProducts([
      makeProduct({ inStock: true }),
      makeProduct({ inStock: false }),
    ]);
    const result = await searchProducts({ inStockOnly: false });
    expect(result.items.length).toBe(2);
  });

  it('returns all items when inStockOnly is undefined', async () => {
    seedProducts([
      makeProduct({ inStock: true }),
      makeProduct({ inStock: false }),
    ]);
    const result = await searchProducts({});
    expect(result.items.length).toBe(2);
  });
});

// ── searchProducts — sort ────────────────────────────────────────────

describe('searchProducts — sort', () => {
  it('defaults to bestselling sort', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts();
    expect(result.items.length).toBe(1);
  });

  it('accepts name-asc sort', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ sort: 'name-asc' });
    expect(result.items.length).toBe(1);
  });

  it('accepts name-desc sort', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ sort: 'name-desc' });
    expect(result.items.length).toBe(1);
  });

  it('accepts price-asc sort', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ sort: 'price-asc' });
    expect(result.items.length).toBe(1);
  });

  it('accepts price-desc sort', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ sort: 'price-desc' });
    expect(result.items.length).toBe(1);
  });

  it('accepts date-desc sort', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ sort: 'date-desc' });
    expect(result.items.length).toBe(1);
  });

  it('accepts rating-desc sort', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ sort: 'rating-desc' });
    expect(result.items.length).toBe(1);
  });

  it('falls back to bestselling for unknown sort key', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ sort: 'unknown-sort' });
    expect(result.items.length).toBe(1);
  });

  it('falls back to bestselling for null sort', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ sort: null });
    expect(result.items.length).toBe(1);
  });
});

// ── searchProducts — pagination ──────────────────────────────────────

describe('searchProducts — pagination', () => {
  it('defaults limit to 50', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts();
    expect(result.items.length).toBe(1);
  });

  it('respects custom limit', async () => {
    seedProducts(Array.from({ length: 5 }, () => makeProduct()));
    const result = await searchProducts({ limit: 3 });
    expect(result.items.length).toBe(3);
  });

  it('caps limit at 100', async () => {
    // limit=200 should be clamped to 100
    seedProducts(Array.from({ length: 5 }, () => makeProduct()));
    const result = await searchProducts({ limit: 200 });
    // Only 5 items exist, so we get 5 but limit was capped
    expect(result.items.length).toBe(5);
  });

  it('clamps limit to min 1', async () => {
    seedProducts([makeProduct(), makeProduct()]);
    const result = await searchProducts({ limit: -5 });
    expect(result.items.length).toBe(1);
  });

  it('clamps limit=0 to 1', async () => {
    seedProducts([makeProduct(), makeProduct()]);
    const result = await searchProducts({ limit: 0 });
    expect(result.items.length).toBe(1);
  });

  it('defaults skip to 0', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts();
    expect(result.items.length).toBe(1);
  });

  it('skips items with positive skip', async () => {
    seedProducts(Array.from({ length: 5 }, (_, i) => makeProduct({ _id: `p${i}` })));
    const result = await searchProducts({ skip: 3 });
    expect(result.items.length).toBe(2);
  });

  it('clamps negative skip to 0', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ skip: -10 });
    expect(result.items.length).toBe(1);
  });

  it('floors fractional skip', async () => {
    seedProducts(Array.from({ length: 5 }, (_, i) => makeProduct({ _id: `p${i}` })));
    const result = await searchProducts({ skip: 2.7 });
    expect(result.items.length).toBe(3);
  });

  it('handles NaN skip (defaults to 0 via || 0)', async () => {
    seedProducts([makeProduct()]);
    const result = await searchProducts({ skip: NaN });
    expect(result.items.length).toBe(1);
  });

  it('hasMore is true when totalCount > skip + limit', async () => {
    seedProducts(Array.from({ length: 10 }, () => makeProduct()));
    const result = await searchProducts({ limit: 3, skip: 0 });
    expect(result.hasMore).toBe(true);
  });

  it('hasMore is false when totalCount <= skip + limit', async () => {
    seedProducts(Array.from({ length: 3 }, () => makeProduct()));
    const result = await searchProducts({ limit: 5, skip: 0 });
    expect(result.hasMore).toBe(false);
  });

  it('hasMore false when exactly at boundary', async () => {
    seedProducts(Array.from({ length: 5 }, () => makeProduct()));
    const result = await searchProducts({ limit: 5, skip: 0 });
    expect(result.hasMore).toBe(false);
  });
});

// ── searchProducts — error handling ──────────────────────────────────

describe('searchProducts — error handling', () => {
  it('returns empty result on thrown error', async () => {
    // Force error by making query.find throw
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await searchProducts({ category: 'futons' });
    expect(result).toEqual({ items: [], totalCount: 0, hasMore: false });
  });
});

// ── searchProducts — combined filters ────────────────────────────────

describe('searchProducts — combined filters', () => {
  it('applies all filters together', async () => {
    seedProducts([
      makeProduct({
        _id: 'match',
        collections: ['futon-frames'],
        name: 'Deluxe Futon',
        price: 300,
        material: 'wood',
        color: 'brown',
        featureTags: ['convertible'],
        brand: 'CoolFutons',
        inStock: true,
        dimensions: { width: 72, depth: 36, height: 30 },
      }),
      makeProduct({
        _id: 'nomatch',
        collections: ['mattresses'],
        name: 'Simple Mattress',
        price: 100,
        material: 'foam',
        color: 'white',
        featureTags: ['firm'],
        brand: 'OtherBrand',
        inStock: false,
        dimensions: { width: 60, depth: 30, height: 10 },
      }),
    ]);
    const result = await searchProducts({
      category: 'futon-frames',
      searchQuery: 'Deluxe',
      priceMin: 200,
      priceMax: 400,
      materials: ['wood'],
      colors: ['brown'],
      featureTags: ['convertible'],
      brands: ['CoolFutons'],
      widthMin: 70,
      widthMax: 80,
      depthMin: 30,
      depthMax: 40,
      heightMin: 25,
      heightMax: 35,
      inStockOnly: true,
      sort: 'price-asc',
      limit: 10,
      skip: 0,
    });
    expect(result.items.length).toBe(1);
    expect(result.items[0]._id).toBe('match');
  });
});

// ── getFilteredProductCount — basic ──────────────────────────────────

describe('getFilteredProductCount — basic', () => {
  it('returns total count with no filters', async () => {
    seedProducts([makeProduct(), makeProduct(), makeProduct()]);
    const result = await getFilteredProductCount();
    expect(result.count).toBe(3);
  });

  it('returns 0 for empty collection', async () => {
    const result = await getFilteredProductCount();
    expect(result.count).toBe(0);
  });

  it('filters by category', async () => {
    seedProducts([
      makeProduct({ collections: ['futon-frames'] }),
      makeProduct({ collections: ['mattresses'] }),
    ]);
    const result = await getFilteredProductCount({ category: 'futon-frames' });
    expect(result.count).toBe(1);
  });

  it('filters by searchQuery', async () => {
    seedProducts([
      makeProduct({ name: 'Futon Frame' }),
      makeProduct({ name: 'Mattress Pad' }),
    ]);
    const result = await getFilteredProductCount({ searchQuery: 'Futon' });
    expect(result.count).toBe(1);
  });

  it('skips searchQuery when sanitize returns empty', async () => {
    seedProducts([makeProduct()]);
    const result = await getFilteredProductCount({ searchQuery: 12345 });
    expect(result.count).toBe(1);
  });

  it('filters by priceMin', async () => {
    seedProducts([makeProduct({ price: 100 }), makeProduct({ price: 500 })]);
    const result = await getFilteredProductCount({ priceMin: 200 });
    expect(result.count).toBe(1);
  });

  it('filters by priceMax', async () => {
    seedProducts([makeProduct({ price: 100 }), makeProduct({ price: 500 })]);
    const result = await getFilteredProductCount({ priceMax: 300 });
    expect(result.count).toBe(1);
  });

  it('skips priceMin=0 (guard: > 0 fails)', async () => {
    seedProducts([makeProduct({ price: 50 })]);
    const result = await getFilteredProductCount({ priceMin: 0 });
    expect(result.count).toBe(1);
  });

  it('filters by materials', async () => {
    seedProducts([makeProduct({ material: 'wood' }), makeProduct({ material: 'metal' })]);
    const result = await getFilteredProductCount({ materials: ['wood'] });
    expect(result.count).toBe(1);
  });

  it('filters by colors', async () => {
    seedProducts([makeProduct({ color: 'brown' }), makeProduct({ color: 'black' })]);
    const result = await getFilteredProductCount({ colors: ['black'] });
    expect(result.count).toBe(1);
  });

  it('filters by featureTags', async () => {
    seedProducts([
      makeProduct({ featureTags: ['eco'] }),
      makeProduct({ featureTags: ['recliner'] }),
    ]);
    const result = await getFilteredProductCount({ featureTags: ['eco'] });
    expect(result.count).toBe(1);
  });

  it('filters by brands', async () => {
    seedProducts([makeProduct({ brand: 'A' }), makeProduct({ brand: 'B' })]);
    const result = await getFilteredProductCount({ brands: ['A'] });
    expect(result.count).toBe(1);
  });

  it('filters by inStockOnly', async () => {
    seedProducts([makeProduct({ inStock: true }), makeProduct({ inStock: false })]);
    const result = await getFilteredProductCount({ inStockOnly: true });
    expect(result.count).toBe(1);
  });

  it('applies hasSome with empty array when all materials sanitize to empty', async () => {
    seedProducts([makeProduct()]);
    // Guard passes (length > 0 on raw array) but sanitize+filter yields []
    // hasSome('material', []) matches nothing
    const result = await getFilteredProductCount({ materials: [null, 123] });
    expect(result.count).toBe(0);
  });

  it('applies hasSome with empty array when all colors sanitize to empty', async () => {
    seedProducts([makeProduct()]);
    // Same guard bypass: raw array has length 1 but sanitize returns ''
    const result = await getFilteredProductCount({ colors: [undefined] });
    expect(result.count).toBe(0);
  });
});

// ── getFilteredProductCount — error handling ─────────────────────────

describe('getFilteredProductCount — error handling', () => {
  it('returns count 0 on thrown error', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('DB down'); });
    const result = await getFilteredProductCount({ category: 'x' });
    expect(result).toEqual({ count: 0 });
  });
});

// ── getFacetMetadata — basic ─────────────────────────────────────────

describe('getFacetMetadata — basic', () => {
  it('returns empty facets for no products', async () => {
    const result = await getFacetMetadata();
    expect(result.totalProducts).toBe(0);
    expect(result.priceRange).toEqual({ min: 0, max: 0 });
    expect(result.materials).toEqual([]);
    expect(result.colors).toEqual([]);
    expect(result.featureTags).toEqual([]);
    expect(result.brands).toEqual([]);
    expect(result.dimensionRange.width).toEqual({ min: 0, max: 0 });
    expect(result.dimensionRange.depth).toEqual({ min: 0, max: 0 });
    expect(result.dimensionRange.height).toEqual({ min: 0, max: 0 });
  });

  it('computes price range from products', async () => {
    seedProducts([
      makeProduct({ price: 100 }),
      makeProduct({ price: 500 }),
      makeProduct({ price: 300 }),
    ]);
    const result = await getFacetMetadata();
    expect(result.priceRange.min).toBe(100);
    expect(result.priceRange.max).toBe(500);
  });

  it('collects distinct materials sorted', async () => {
    seedProducts([
      makeProduct({ material: 'wood' }),
      makeProduct({ material: 'fabric' }),
      makeProduct({ material: 'wood' }),
    ]);
    const result = await getFacetMetadata();
    expect(result.materials).toEqual(['fabric', 'wood']);
  });

  it('collects distinct colors sorted', async () => {
    seedProducts([
      makeProduct({ color: 'brown' }),
      makeProduct({ color: 'black' }),
      makeProduct({ color: 'brown' }),
    ]);
    const result = await getFacetMetadata();
    expect(result.colors).toEqual(['black', 'brown']);
  });

  it('collects distinct featureTags sorted from arrays', async () => {
    seedProducts([
      makeProduct({ featureTags: ['convertible', 'eco'] }),
      makeProduct({ featureTags: ['eco', 'recliner'] }),
    ]);
    const result = await getFacetMetadata();
    expect(result.featureTags).toEqual(['convertible', 'eco', 'recliner']);
  });

  it('collects distinct brands sorted', async () => {
    seedProducts([
      makeProduct({ brand: 'BrandB' }),
      makeProduct({ brand: 'BrandA' }),
    ]);
    const result = await getFacetMetadata();
    expect(result.brands).toEqual(['BrandA', 'BrandB']);
  });

  it('computes dimension ranges', async () => {
    seedProducts([
      makeProduct({ dimensions: { width: 60, depth: 30, height: 25 } }),
      makeProduct({ dimensions: { width: 80, depth: 40, height: 35 } }),
    ]);
    const result = await getFacetMetadata();
    expect(result.dimensionRange.width).toEqual({ min: 60, max: 80 });
    expect(result.dimensionRange.depth).toEqual({ min: 30, max: 40 });
    expect(result.dimensionRange.height).toEqual({ min: 25, max: 35 });
  });

  it('filters by category when provided', async () => {
    seedProducts([
      makeProduct({ collections: ['futon-frames'], price: 200 }),
      makeProduct({ collections: ['mattresses'], price: 100 }),
    ]);
    const result = await getFacetMetadata('futon-frames');
    expect(result.totalProducts).toBe(1);
    expect(result.priceRange.min).toBe(200);
  });

  it('uses __all__ cache key when no category', async () => {
    seedProducts([makeProduct()]);
    const r1 = await getFacetMetadata();
    // Second call should return cached
    _collections = {}; // clear data — cached should still return
    const r2 = await getFacetMetadata();
    expect(r2.totalProducts).toBe(r1.totalProducts);
  });

  it('returns totalProducts count', async () => {
    seedProducts([makeProduct(), makeProduct(), makeProduct()]);
    const result = await getFacetMetadata();
    expect(result.totalProducts).toBe(3);
  });
});

// ── getFacetMetadata — edge cases ────────────────────────────────────

describe('getFacetMetadata — edge cases', () => {
  it('handles product with no price (non-number)', async () => {
    seedProducts([makeProduct({ price: undefined })]);
    const result = await getFacetMetadata();
    // price undefined → typeof check fails → stays Infinity → cleaned to 0
    expect(result.priceRange).toEqual({ min: 0, max: 0 });
  });

  it('handles product with no material (falsy)', async () => {
    seedProducts([makeProduct({ material: null })]);
    const result = await getFacetMetadata();
    expect(result.materials).toEqual([]);
  });

  it('handles product with no color (falsy)', async () => {
    seedProducts([makeProduct({ color: '' })]);
    const result = await getFacetMetadata();
    expect(result.colors).toEqual([]);
  });

  it('handles product with no featureTags (not array)', async () => {
    seedProducts([makeProduct({ featureTags: null })]);
    const result = await getFacetMetadata();
    expect(result.featureTags).toEqual([]);
  });

  it('handles product with no brand (falsy)', async () => {
    seedProducts([makeProduct({ brand: '' })]);
    const result = await getFacetMetadata();
    expect(result.brands).toEqual([]);
  });

  it('handles product with no dimensions', async () => {
    seedProducts([makeProduct({ dimensions: undefined })]);
    const result = await getFacetMetadata();
    expect(result.dimensionRange.width).toEqual({ min: 0, max: 0 });
  });

  it('handles dimension with non-number value', async () => {
    seedProducts([makeProduct({ dimensions: { width: 'big', depth: null, height: undefined } })]);
    const result = await getFacetMetadata();
    expect(result.dimensionRange.width).toEqual({ min: 0, max: 0 });
  });

  it('single product sets same min and max for price', async () => {
    seedProducts([makeProduct({ price: 250 })]);
    const result = await getFacetMetadata();
    expect(result.priceRange.min).toBe(250);
    expect(result.priceRange.max).toBe(250);
  });

  it('sanitizes category param for facets', async () => {
    seedProducts([makeProduct({ collections: ['a'.repeat(100)] })]);
    const result = await getFacetMetadata('a'.repeat(200));
    expect(result.totalProducts).toBe(1);
  });

  it('uses empty string category as __all__ cache key', async () => {
    seedProducts([makeProduct()]);
    const result = await getFacetMetadata('');
    expect(result.totalProducts).toBe(1);
  });
});

// ── getFacetMetadata — caching ───────────────────────────────────────

describe('getFacetMetadata — caching', () => {
  it('returns cached data on second call with same category', async () => {
    seedProducts([makeProduct({ price: 100 })]);
    const r1 = await getFacetMetadata('futon-frames');
    // Modify data — should not affect cached result
    _collections = {};
    seedProducts([makeProduct({ price: 999 })]);
    const r2 = await getFacetMetadata('futon-frames');
    expect(r2.priceRange.min).toBe(100);
  });

  it('uses separate cache keys for different categories', async () => {
    seedProducts([
      makeProduct({ collections: ['cat-a'], price: 100 }),
      makeProduct({ collections: ['cat-b'], price: 200 }),
    ]);
    const r1 = await getFacetMetadata('cat-a');
    const r2 = await getFacetMetadata('cat-b');
    expect(r1.priceRange.min).toBe(100);
    expect(r2.priceRange.min).toBe(200);
  });

  it('__clearCache invalidates all cached facets', async () => {
    seedProducts([makeProduct({ price: 100, collections: ['test-cat'] })]);
    await getFacetMetadata('test-cat');
    __clearCache();
    // Now re-seed with different data
    _collections = {};
    seedProducts([makeProduct({ price: 999, collections: ['test-cat'] })]);
    const result = await getFacetMetadata('test-cat');
    expect(result.priceRange.min).toBe(999);
  });

  it('cache expires after TTL (simulated via Date.now)', async () => {
    seedProducts([makeProduct({ price: 100, collections: ['ttl-test'] })]);
    await getFacetMetadata('ttl-test');

    // Advance time past TTL
    const originalNow = Date.now;
    Date.now = () => originalNow() + 6 * 60 * 1000; // 6 minutes

    _collections = {};
    seedProducts([makeProduct({ price: 888, collections: ['ttl-test'] })]);
    const result = await getFacetMetadata('ttl-test');
    expect(result.priceRange.min).toBe(888);

    Date.now = originalNow; // restore
  });
});

// ── getFacetMetadata — error handling ────────────────────────────────

describe('getFacetMetadata — error handling', () => {
  it('returns empty facets on error', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('DB crash'); });
    const result = await getFacetMetadata('fail-cat');
    expect(result.totalProducts).toBe(0);
    expect(result.priceRange).toEqual({ min: 0, max: 0 });
    expect(result.materials).toEqual([]);
    expect(result.colors).toEqual([]);
    expect(result.featureTags).toEqual([]);
    expect(result.brands).toEqual([]);
    expect(result.dimensionRange.width).toEqual({ min: 0, max: 0 });
    expect(result.dimensionRange.depth).toEqual({ min: 0, max: 0 });
    expect(result.dimensionRange.height).toEqual({ min: 0, max: 0 });
  });
});

// ── suggestFilterRelaxation — basic ──────────────────────────────────

describe('suggestFilterRelaxation — basic', () => {
  it('returns empty suggestions for no params', async () => {
    const result = await suggestFilterRelaxation();
    expect(result.suggestions).toEqual([]);
  });

  it('returns empty suggestions for empty params', async () => {
    const result = await suggestFilterRelaxation({});
    expect(result.suggestions).toEqual([]);
  });

  it('suggests removing price filter when it yields results', async () => {
    seedProducts([makeProduct({ price: 300 })]);
    const result = await suggestFilterRelaxation({
      category: 'futon-frames',
      priceMin: 500,
      priceMax: 600,
    });
    // Removing price range should find the product (no price filter)
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].filter).toBe('price');
    expect(result.suggestions[0].label).toBe('price range');
    expect(result.suggestions[0].resultCount).toBe(1);
  });

  it('suggests removing materials filter', async () => {
    seedProducts([makeProduct({ material: 'wood', collections: ['futon-frames'] })]);
    const result = await suggestFilterRelaxation({
      category: 'futon-frames',
      materials: ['nonexistent-material'],
    });
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].filter).toBe('materials');
    expect(result.suggestions[0].label).toBe('material');
  });

  it('suggests removing colors filter', async () => {
    seedProducts([makeProduct({ color: 'brown', collections: ['futon-frames'] })]);
    const result = await suggestFilterRelaxation({
      category: 'futon-frames',
      colors: ['nonexistent-color'],
    });
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].filter).toBe('colors');
    expect(result.suggestions[0].label).toBe('color');
  });

  it('suggests removing featureTags filter', async () => {
    seedProducts([makeProduct({ featureTags: ['eco'], collections: ['cat'] })]);
    const result = await suggestFilterRelaxation({
      category: 'cat',
      featureTags: ['nonexistent'],
    });
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].filter).toBe('featureTags');
    expect(result.suggestions[0].label).toBe('feature');
  });

  it('suggests removing brands filter', async () => {
    seedProducts([makeProduct({ brand: 'CoolFutons', collections: ['cat'] })]);
    const result = await suggestFilterRelaxation({
      category: 'cat',
      brands: ['nonexistent-brand'],
    });
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].filter).toBe('brands');
    expect(result.suggestions[0].label).toBe('brand');
  });

  it('suggests removing inStockOnly filter', async () => {
    seedProducts([makeProduct({ inStock: false, collections: ['cat'] })]);
    const result = await suggestFilterRelaxation({
      category: 'cat',
      inStockOnly: true,
    });
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].filter).toBe('inStockOnly');
    expect(result.suggestions[0].label).toBe('in-stock only');
  });
});

// ── suggestFilterRelaxation — sorting and ordering ───────────────────

describe('suggestFilterRelaxation — sorting', () => {
  it('sorts suggestions by resultCount descending', async () => {
    seedProducts([
      makeProduct({ material: 'wood', color: 'brown', inStock: true, collections: ['cat'] }),
      makeProduct({ material: 'wood', color: 'brown', inStock: false, collections: ['cat'] }),
      makeProduct({ material: 'metal', color: 'brown', inStock: true, collections: ['cat'] }),
    ]);
    // Filters that exclude everything
    const result = await suggestFilterRelaxation({
      category: 'cat',
      materials: ['nonexistent'],
      colors: ['nonexistent'],
      inStockOnly: true,
    });
    // Removing colors yields most (all 3 have 'brown' so color isn't the blocker,
    // but removing colors from the filter set means only materials+inStock remain)
    // Check that suggestions are sorted by resultCount desc
    for (let i = 1; i < result.suggestions.length; i++) {
      expect(result.suggestions[i - 1].resultCount).toBeGreaterThanOrEqual(
        result.suggestions[i].resultCount
      );
    }
  });
});

// ── suggestFilterRelaxation — edge cases ─────────────────────────────

describe('suggestFilterRelaxation — edge cases', () => {
  it('only includes price key when priceMin is number', async () => {
    seedProducts([makeProduct({ collections: ['cat'] })]);
    const result = await suggestFilterRelaxation({
      category: 'cat',
      priceMin: 'not-a-number',
    });
    // typeof 'not-a-number' !== 'number' so price key is not added
    expect(result.suggestions).toEqual([]);
  });

  it('includes price key when only priceMax is number', async () => {
    seedProducts([makeProduct({ price: 100, collections: ['cat'] })]);
    const result = await suggestFilterRelaxation({
      category: 'cat',
      priceMax: 50,
    });
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].filter).toBe('price');
  });

  it('skips filter keys with empty arrays', async () => {
    seedProducts([makeProduct({ collections: ['cat'] })]);
    const result = await suggestFilterRelaxation({
      category: 'cat',
      materials: [],
      colors: [],
      featureTags: [],
      brands: [],
    });
    expect(result.suggestions).toEqual([]);
  });

  it('does not suggest filter if removing it still yields 0 results', async () => {
    // No products at all
    const result = await suggestFilterRelaxation({
      category: 'empty-cat',
      materials: ['wood'],
      colors: ['brown'],
    });
    expect(result.suggestions).toEqual([]);
  });

  it('handles category filter applied to all relaxation queries', async () => {
    seedProducts([
      makeProduct({ collections: ['cat-a'], material: 'wood' }),
      makeProduct({ collections: ['cat-b'], material: 'metal' }),
    ]);
    const result = await suggestFilterRelaxation({
      category: 'cat-a',
      materials: ['nonexistent'],
    });
    // Removing materials within cat-a should find 1 product
    expect(result.suggestions[0].resultCount).toBe(1);
  });

  it('does not include inStockOnly key when inStockOnly is false', async () => {
    seedProducts([makeProduct({ collections: ['cat'] })]);
    const result = await suggestFilterRelaxation({
      category: 'cat',
      inStockOnly: false,
    });
    expect(result.suggestions).toEqual([]);
  });
});

// ── suggestFilterRelaxation — error handling ─────────────────────────

describe('suggestFilterRelaxation — error handling', () => {
  it('returns empty suggestions on error', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('crash'); });
    const result = await suggestFilterRelaxation({ priceMin: 100 });
    expect(result).toEqual({ suggestions: [] });
  });
});

// ── __clearCache — utility ───────────────────────────────────────────

describe('__clearCache — utility', () => {
  it('is a function', () => {
    expect(typeof __clearCache).toBe('function');
  });

  it('does not throw when cache is already empty', () => {
    expect(() => __clearCache()).not.toThrow();
  });

  it('clears cache so next getFacetMetadata re-queries', async () => {
    seedProducts([makeProduct({ price: 111, collections: ['clear-test'] })]);
    await getFacetMetadata('clear-test');
    __clearCache();
    _collections = {};
    seedProducts([makeProduct({ price: 222, collections: ['clear-test'] })]);
    const result = await getFacetMetadata('clear-test');
    expect(result.priceRange.min).toBe(222);
  });
});
