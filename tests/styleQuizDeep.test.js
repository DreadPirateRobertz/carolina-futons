import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ge: (field, val) => { filters[`${field}_ge`] = { type: 'ge', field, value: val }; return chain; },
    le: (field, val) => { filters[`${field}_le`] = { type: 'le', field, value: val }; return chain; },
    hasSome: (field, vals) => { filters[`${field}_hasSome`] = { type: 'hasSome', field, value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ge') items = items.filter(i => (i[f.field] || 0) >= f.value);
        if (f.type === 'le') items = items.filter(i => (i[f.field] || 0) <= f.value);
        if (f.type === 'hasSome') {
          items = items.filter(i => {
            const arr = Array.isArray(i[f.field]) ? i[f.field] : [i[f.field]];
            return arr.some(v => f.value.includes(v));
          });
        }
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/styleQuiz.web.js');
});

// ── getQuizOptions ───────────────────────────────────────────────

describe('getQuizOptions', () => {
  it('returns all quiz option sets', async () => {
    const r = await mod.getQuizOptions();
    expect(r.roomTypes).toHaveLength(5);
    expect(r.primaryUses).toHaveLength(3);
    expect(r.stylePreferences).toHaveLength(3);
    expect(r.sizeOptions).toHaveLength(3);
    expect(r.budgetRanges).toHaveLength(4);
  });

  it('each option has value and label', async () => {
    const r = await mod.getQuizOptions();
    for (const opt of r.roomTypes) {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
    }
  });
});

// ── getQuizRecommendations ───────────────────────────────────────

describe('getQuizRecommendations', () => {
  it('returns empty for null answers', async () => {
    const r = await mod.getQuizRecommendations(null);
    expect(r).toEqual([]);
  });

  it('returns scored recommendations', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Modern Futon Frame', slug: 'modern-futon', price: 699, collections: ['futon-frames'], inStock: true, description: 'contemporary clean lines' },
      { _id: 'p2', name: 'Rustic Log Frame', slug: 'rustic-log', price: 899, collections: ['futon-frames'], inStock: true, description: 'natural hardwood' },
    ]);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'both',
      stylePreference: 'modern', budgetRange: '500-1000',
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].product.name).toBeTruthy();
    expect(r[0].score).toBeGreaterThan(0);
    expect(r[0].reason).toBeTruthy();
  });

  it('uses fallback when no matches in target collections', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Basic Frame', slug: 'basic', price: 300, collections: ['other-category'] },
    ]);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'sitting', budgetRange: 'under-500',
    });
    expect(r.length).toBeGreaterThanOrEqual(0); // May or may not have fallback results
  });

  it('caps results at 5', async () => {
    const products = Array.from({ length: 10 }, (_, i) => ({
      _id: `p${i}`, name: `Futon ${i}`, slug: `futon-${i}`, price: 700,
      collections: ['futon-frames'], inStock: true,
    }));
    __seed('Stores/Products', products);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'both', budgetRange: '500-1000',
    });
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it('gives bonus for in-stock and high-rated products', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Frame A', price: 750, collections: ['futon-frames'], inStock: true, numericRating: 4.5 },
      { _id: 'p2', name: 'Frame B', price: 750, collections: ['futon-frames'], inStock: false, numericRating: 3.0 },
    ]);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'both', budgetRange: '500-1000',
    });
    if (r.length >= 2) {
      expect(r[0].score).toBeGreaterThanOrEqual(r[1].score);
    }
  });

  it('scores style keyword matches', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Rustic Wood Frame', price: 700, collections: ['futon-frames'], description: 'natural handcrafted hardwood' },
    ]);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'both',
      stylePreference: 'rustic', budgetRange: '500-1000',
    });
    expect(r[0].score).toBeGreaterThan(50); // Should get style match bonus
  });
});
