import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/mediaHelpers', () => ({
  getImageUrl: (media) => {
    if (!media) return '';
    if (typeof media === 'string') return media;
    return media.src || media.url || '';
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
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit' || key === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
      }
      const skip = filters._skip || 0;
      const limit = filters._limit || items.length;
      items = items.slice(skip, skip + limit);
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
  mod = await import('../src/backend/googleMerchantFeed.web.js');
});

const sampleProduct = {
  _id: 'p1', name: 'Classic Futon Frame', slug: 'classic-futon-frame',
  description: 'A great <b>futon</b> frame', price: 499, inStock: true,
  visible: true, mainMedia: 'https://cdn.example.com/futon.jpg',
  collections: ['futon-frames'], sku: 'FF-001',
};

// ── generateFeed ─────────────────────────────────────────────────

describe('generateFeed', () => {
  it('returns null for error', async () => {
    // With empty collections, should still generate valid XML
    __seed('Stores/Products', []);
    const r = await mod.generateFeed();
    expect(r).toContain('<?xml');
    expect(r).toContain('Google Shopping Feed');
  });

  it('generates XML feed with products', async () => {
    __seed('Stores/Products', [sampleProduct]);
    const r = await mod.generateFeed();
    expect(r).toContain('<?xml');
    expect(r).toContain('<g:title>Classic Futon Frame</g:title>');
    expect(r).toContain('<g:price>499.00 USD</g:price>');
    expect(r).toContain('<g:availability>in_stock</g:availability>');
    expect(r).toContain('<g:brand>Night &amp; Day Furniture</g:brand>');
    expect(r).toContain('<g:mpn>FF-001</g:mpn>');
    expect(r).toContain('<g:condition>new</g:condition>');
  });

  it('strips HTML from description', async () => {
    __seed('Stores/Products', [sampleProduct]);
    const r = await mod.generateFeed();
    expect(r).not.toContain('<b>');
    expect(r).toContain('A great futon frame');
  });

  it('includes sale price when discounted', async () => {
    __seed('Stores/Products', [{ ...sampleProduct, discountedPrice: 399 }]);
    const r = await mod.generateFeed();
    expect(r).toContain('<g:sale_price>399.00 USD</g:sale_price>');
  });

  it('handles out-of-stock products', async () => {
    __seed('Stores/Products', [{ ...sampleProduct, inStock: false }]);
    const r = await mod.generateFeed();
    expect(r).toContain('<g:availability>out_of_stock</g:availability>');
  });

  it('maps futon-frames to correct Google category', async () => {
    __seed('Stores/Products', [sampleProduct]);
    const r = await mod.generateFeed();
    expect(r).toContain('<g:google_product_category>2720</g:google_product_category>');
    expect(r).toContain('<g:product_type>Furniture &gt; Futon Frames</g:product_type>');
  });

  it('maps murphy beds correctly', async () => {
    __seed('Stores/Products', [{ ...sampleProduct, collections: ['murphy-cabinet-beds'] }]);
    const r = await mod.generateFeed();
    expect(r).toContain('<g:google_product_category>451</g:google_product_category>');
    expect(r).toContain('Murphy Cabinet Beds');
  });

  it('escapes XML special characters', async () => {
    __seed('Stores/Products', [{ ...sampleProduct, name: 'Futon & Frame "Special"' }]);
    const r = await mod.generateFeed();
    expect(r).toContain('&amp;');
    expect(r).toContain('&quot;');
  });
});

// ── getFeedData ──────────────────────────────────────────────────

describe('getFeedData', () => {
  it('returns empty for no products', async () => {
    __seed('Stores/Products', []);
    const r = await mod.getFeedData();
    expect(r).toEqual([]);
  });

  it('returns JSON feed data', async () => {
    __seed('Stores/Products', [sampleProduct]);
    const r = await mod.getFeedData();
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('p1');
    expect(r[0].title).toBe('Classic Futon Frame');
    expect(r[0].price).toBe(499);
    expect(r[0].availability).toBe('in_stock');
    expect(r[0].brand).toBe('Night & Day Furniture');
    expect(r[0].condition).toBe('new');
    expect(r[0].identifierExists).toBe(false);
  });

  it('detects wall-hugger brand', async () => {
    __seed('Stores/Products', [{ ...sampleProduct, collections: ['wall-hugger-frames'] }]);
    const r = await mod.getFeedData();
    expect(r[0].brand).toBe('Strata Furniture');
  });

  it('detects unfinished wood brand', async () => {
    __seed('Stores/Products', [{ ...sampleProduct, collections: ['unfinished-wood'] }]);
    const r = await mod.getFeedData();
    expect(r[0].brand).toBe('KD Frames');
  });
});
