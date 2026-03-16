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
  mod = await import('../src/backend/imageAudit.web.js');
});

// ── auditCatalogImages ───────────────────────────────────────────

describe('auditCatalogImages', () => {
  it('rejects non-array', () => {
    const r = mod.auditCatalogImages('not-array');
    expect(r.success).toBe(false);
  });

  it('returns empty report for empty array', () => {
    const r = mod.auditCatalogImages([]);
    expect(r.success).toBe(true);
    expect(r.totalProducts).toBe(0);
    expect(r.totalImages).toBe(0);
  });

  it('flags products with no images', () => {
    const r = mod.auditCatalogImages([{ name: 'Futon A', slug: 'futon-a', images: [] }]);
    expect(r.coverage.noImages).toBe(1);
    expect(r.flaggedProducts).toHaveLength(1);
    expect(r.flaggedProducts[0].issue).toBe('NO_IMAGES');
  });

  it('flags single-image products', () => {
    const r = mod.auditCatalogImages([{ name: 'Futon', images: ['https://static.wixstatic.com/media/img1.jpg'] }]);
    expect(r.coverage.oneImage).toBe(1);
    expect(r.flaggedProducts[0].issue).toBe('SINGLE_IMAGE');
  });

  it('flags below-minimum products', () => {
    const r = mod.auditCatalogImages([{ name: 'Futon', images: ['url1', 'url2'] }]);
    expect(r.coverage.belowMinimum).toBe(1);
    expect(r.flaggedProducts[0].issue).toBe('BELOW_MINIMUM');
  });

  it('counts adequate and ideal products', () => {
    const r = mod.auditCatalogImages([
      { name: 'A', images: ['u1', 'u2', 'u3'] },
      { name: 'B', images: ['u1', 'u2', 'u3', 'u4', 'u5'] },
    ]);
    expect(r.coverage.adequate).toBe(1);
    expect(r.coverage.ideal).toBe(1);
  });

  it('classifies URL types', () => {
    const r = mod.auditCatalogImages([{
      name: 'Test', images: [
        'https://static.wixstatic.com/media/img.jpg',
        'wix:image://v1/abc/img.jpg',
        'https://external.com/img.jpg',
      ],
    }]);
    expect(r.urlTypes.wixstatic).toBe(1);
    expect(r.urlTypes['wix-image']).toBe(1);
    expect(r.urlTypes.external).toBe(1);
  });

  it('detects duplicate URLs', () => {
    const r = mod.auditCatalogImages([
      { name: 'A', images: ['https://cdn.com/img1.jpg'] },
      { name: 'B', images: ['https://cdn.com/img1.jpg'] },
    ]);
    expect(r.duplicateUrls).toHaveLength(1);
  });

  it('computes category breakdown', () => {
    const r = mod.auditCatalogImages([
      { name: 'A', category: 'futons', images: ['u1', 'u2', 'u3'] },
      { name: 'B', category: 'futons', images: ['u1'] },
      { name: 'C', category: 'covers', images: ['u1', 'u2'] },
    ]);
    expect(r.categoryBreakdown.futons.products).toBe(2);
    expect(r.categoryBreakdown.futons.totalImages).toBe(4);
    expect(r.categoryBreakdown.futons.avgImages).toBe(2);
  });
});

// ── auditLiveProducts ────────────────────────────────────────────

describe('auditLiveProducts', () => {
  it('returns results for live products', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Futon A', slug: 'futon-a', mainMedia: 'https://cdn.com/img.jpg', mediaItems: [] },
      { _id: 'p2', name: 'Futon B', slug: 'futon-b', mainMedia: null, mediaItems: [] },
    ]);
    const r = await mod.auditLiveProducts();
    expect(r.success).toBe(true);
    expect(r.totalProducts).toBe(2);
    expect(r.totalWithNoImages).toBe(1);
    expect(r.flagged.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for no products', async () => {
    __seed('Stores/Products', []);
    const r = await mod.auditLiveProducts();
    expect(r.success).toBe(true);
    expect(r.totalProducts).toBe(0);
  });
});

// ── getImagePipelineStatus ───────────────────────────────────────

describe('getImagePipelineStatus', () => {
  it('rejects non-array', () => {
    const r = mod.getImagePipelineStatus('bad');
    expect(r.success).toBe(false);
  });

  it('reports ready when all have wixstatic images', () => {
    const r = mod.getImagePipelineStatus([
      { images: ['https://static.wixstatic.com/media/img1.jpg'] },
      { images: ['https://static.wixstatic.com/media/img2.jpg'] },
    ]);
    expect(r.success).toBe(true);
    expect(r.readyForImport).toBe(true);
    expect(r.allImagesOnWixCdn).toBe(true);
    expect(r.productsWithoutImages).toBe(0);
  });

  it('reports not ready for external images', () => {
    const r = mod.getImagePipelineStatus([
      { images: ['https://external.com/img.jpg'] },
    ]);
    expect(r.allImagesOnWixCdn).toBe(false);
    expect(r.readyForImport).toBe(false);
  });

  it('reports not ready for missing images', () => {
    const r = mod.getImagePipelineStatus([{ images: [] }]);
    expect(r.productsWithoutImages).toBe(1);
    expect(r.readyForImport).toBe(false);
  });
});
