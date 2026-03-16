import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _swatches = [];

vi.mock('wix-data', () => {
  function buildQuery() {
    let items = [..._swatches];
    let _limit = 50;
    const chain = {
      or: () => chain,
      contains: () => chain,
      eq: (field, val) => { items = items.filter(i => i[field] === val); return chain; },
      ascending: () => chain,
      limit: (n) => { _limit = n; return chain; },
      find: async () => ({ items: items.slice(0, _limit) }),
      distinct: async (field) => ({ items: [...new Set(items.map(i => i[field]))] }),
      count: async () => items.length,
    };
    return chain;
  }
  return {
    default: {
      query: () => buildQuery(),
    },
  };
});

let mod;
beforeEach(async () => {
  _swatches = [];
  vi.resetModules();
  mod = await import('../src/backend/swatchService.web.js');
});

describe('getProductSwatches', () => {
  it('returns empty for no swatches', async () => {
    const r = await mod.getProductSwatches('p1');
    expect(r).toEqual([]);
  });

  it('returns mapped swatch fields', async () => {
    _swatches = [{
      _id: 's1', swatchId: 'sw1', swatchName: 'Navy', swatchImage: 'img.jpg',
      colorFamily: 'Blue', colorHex: '#001f3f', material: 'Cotton',
      careInstructions: 'Machine wash', availableForProducts: 'all',
    }];
    const r = await mod.getProductSwatches('p1');
    expect(r).toHaveLength(1);
    expect(r[0].swatchName).toBe('Navy');
    expect(r[0].colorHex).toBe('#001f3f');
  });
});

describe('getAllSwatchFamilies', () => {
  it('returns distinct color families', async () => {
    _swatches = [
      { colorFamily: 'Blue' },
      { colorFamily: 'Red' },
      { colorFamily: 'Blue' },
    ];
    const r = await mod.getAllSwatchFamilies();
    expect(r).toContain('Blue');
    expect(r).toContain('Red');
  });
});

describe('getSwatchCount', () => {
  it('returns count', async () => {
    _swatches = [{ availableForProducts: 'all' }, { availableForProducts: 'all' }];
    const r = await mod.getSwatchCount('p1');
    expect(r).toBe(2);
  });
});

describe('getSwatchPreviewColors', () => {
  it('returns color hex and name', async () => {
    _swatches = [
      { colorHex: '#001f3f', swatchName: 'Navy', sortOrder: 1, availableForProducts: 'all' },
      { colorHex: '#ff0000', swatchName: 'Red', sortOrder: 2, availableForProducts: 'all' },
    ];
    const r = await mod.getSwatchPreviewColors('p1', 4);
    expect(r).toHaveLength(2);
    expect(r[0].colorHex).toBe('#001f3f');
    expect(r[1].swatchName).toBe('Red');
  });
});
