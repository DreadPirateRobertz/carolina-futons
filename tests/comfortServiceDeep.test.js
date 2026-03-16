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
    ascending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
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
  mod = await import('../src/backend/comfortService.web.js');
});

describe('getComfortLevels', () => {
  it('returns empty for no data', async () => {
    __seed('ComfortLevels', []);
    const r = await mod.getComfortLevels();
    expect(r).toEqual([]);
  });

  it('returns mapped comfort levels', async () => {
    __seed('ComfortLevels', [
      { slug: 'plush', name: 'Plush', tagline: 'Soft', description: 'Very soft', illustration: 'img.png', illustrationAlt: 'Plush', sortOrder: 1 },
      { slug: 'firm', name: 'Firm', tagline: 'Solid', description: 'Very firm', illustration: 'img2.png', illustrationAlt: 'Firm', sortOrder: 2 },
    ]);
    const r = await mod.getComfortLevels();
    expect(r).toHaveLength(2);
    expect(r[0].slug).toBe('plush');
    expect(r[1].name).toBe('Firm');
  });
});

describe('getProductComfort', () => {
  it('returns null for no productId', async () => {
    const r = await mod.getProductComfort(null);
    expect(r).toBeNull();
  });

  it('returns null for unmapped product', async () => {
    __seed('ProductComfort', []);
    const r = await mod.getProductComfort('p1');
    expect(r).toBeNull();
  });

  it('returns comfort level for mapped product', async () => {
    __seed('ProductComfort', [{ productId: 'p1', comfortLevelId: 'cl1' }]);
    __seed('ComfortLevels', [{ _id: 'cl1', slug: 'medium', name: 'Medium', tagline: 'Balanced', description: 'Mid feel', illustration: 'med.png', illustrationAlt: 'Medium' }]);
    const r = await mod.getProductComfort('p1');
    expect(r).not.toBeNull();
    expect(r.slug).toBe('medium');
    expect(r.name).toBe('Medium');
  });
});

describe('getComfortProducts', () => {
  it('returns empty for null slug', async () => {
    const r = await mod.getComfortProducts(null);
    expect(r).toEqual([]);
  });

  it('returns empty for unknown slug', async () => {
    __seed('ComfortLevels', []);
    const r = await mod.getComfortProducts('ultra-soft');
    expect(r).toEqual([]);
  });

  it('returns product IDs for comfort slug', async () => {
    __seed('ComfortLevels', [{ _id: 'cl1', slug: 'plush' }]);
    __seed('ProductComfort', [
      { comfortLevelId: 'cl1', productId: 'p1', sortOrder: 1 },
      { comfortLevelId: 'cl1', productId: 'p2', sortOrder: 2 },
    ]);
    const r = await mod.getComfortProducts('plush');
    expect(r).toEqual(['p1', 'p2']);
  });
});
