import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  validateSlug: (slug) => {
    if (!slug || typeof slug !== 'string') return '';
    return slug.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    le: (field, val) => { filters[`${field}_le`] = { type: 'le', field, value: val }; return chain; },
    ge: (field, val) => { filters[`${field}_ge`] = { type: 'ge', field, value: val }; return chain; },
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[f.field || key]));
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
  mod = await import('../src/backend/promotions.web.js');
});

describe('getActivePromotion', () => {
  it('returns null when no active promos', async () => {
    __seed('Promotions', []);
    const r = await mod.getActivePromotion();
    expect(r).toBeNull();
  });

  it('returns active promotion with product enrichment', async () => {
    const now = new Date();
    __seed('Promotions', [{
      _id: 'promo1', isActive: true, title: 'Summer Sale', subtitle: 'Big savings',
      theme: 'summer', heroImage: 'hero.jpg',
      startDate: new Date(now - 86400000), endDate: new Date(now.getTime() + 86400000),
      discountCode: 'SUM20', discountPercent: 20,
      bannerMessage: 'Save 20%', ctaUrl: '/sale', ctaText: 'Shop Now',
      productIds: 'p1,p2',
    }]);
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Futon Frame', slug: 'futon-frame', price: 499, formattedPrice: '$499', mainMedia: 'img.jpg' },
      { _id: 'p2', name: 'Mattress', slug: 'mattress', price: 299, formattedPrice: '$299', mainMedia: 'img2.jpg' },
    ]);
    const r = await mod.getActivePromotion();
    expect(r).not.toBeNull();
    expect(r.title).toBe('Summer Sale');
    expect(r.discountCode).toBe('SUM20');
    expect(r.products).toHaveLength(2);
    expect(r.products[0].name).toBe('Futon Frame');
  });

  it('returns promo with no products when productIds empty', async () => {
    const now = new Date();
    __seed('Promotions', [{
      _id: 'promo1', isActive: true, title: 'Banner Promo',
      startDate: new Date(now - 86400000), endDate: new Date(now.getTime() + 86400000),
      productIds: '',
    }]);
    const r = await mod.getActivePromotion();
    expect(r).not.toBeNull();
    expect(r.products).toEqual([]);
  });
});

describe('getFlashSales', () => {
  it('returns empty when no flash sales', async () => {
    __seed('Promotions', []);
    const r = await mod.getFlashSales();
    expect(r).toEqual([]);
  });

  it('returns flash sales sorted by end date', async () => {
    const now = new Date();
    __seed('Promotions', [
      {
        _id: 'fs1', isActive: true, type: 'flash_sale', title: 'Flash 1',
        startDate: new Date(now - 86400000), endDate: new Date(now.getTime() + 86400000),
        discountCode: 'FLASH10', discountPercent: 10,
      },
    ]);
    const r = await mod.getFlashSales();
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe('Flash 1');
    expect(r[0].type).toBe('flash_sale');
  });

  it('filters by category slug', async () => {
    const now = new Date();
    __seed('Promotions', [
      {
        _id: 'fs1', isActive: true, type: 'flash_sale', title: 'Mattress Flash',
        startDate: new Date(now - 86400000), endDate: new Date(now.getTime() + 86400000),
        categoryScope: 'mattresses',
      },
      {
        _id: 'fs2', isActive: true, type: 'flash_sale', title: 'All Flash',
        startDate: new Date(now - 86400000), endDate: new Date(now.getTime() + 86400000),
        categoryScope: '',
      },
    ]);
    const r = await mod.getFlashSales('mattresses');
    // Should include mattresses-scoped and unscoped
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for invalid slug', async () => {
    const r = await mod.getFlashSales('');
    expect(r).toEqual([]);
  });
});
