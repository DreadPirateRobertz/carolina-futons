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
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === item._id);
      if (idx >= 0) col[idx] = { ...item };
      return item;
    },
  },
}));

const validProduct = {
  name: 'Full Futon Frame',
  slug: 'full-futon-frame',
  sku: 'FF-001',
  price: 399.99,
  category: 'futon-frames',
  images: ['img1.jpg', 'img2.jpg'],
  description: 'A quality futon frame',
  manufacturer: 'Night & Day',
  inStock: true,
  variants: [{ label: 'Natural', sku: 'FF-001-NAT', price: 399.99 }],
  dimensions: { width: 82, depth: 38, height: 30, weight: 75 },
  swatches: [{ color: 'Natural', hex: '#DEB887' }],
  sizes: ['Full'],
};

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/loadCatalogMaster.web.js');
});

// ── previewCatalogLoad ─────────────────────────────────────────────

describe('previewCatalogLoad', () => {
  it('rejects null catalog', async () => {
    const r = await mod.previewCatalogLoad(null);
    expect(r.success).toBe(false);
  });

  it('rejects catalog without products array', async () => {
    const r = await mod.previewCatalogLoad({ products: 'not-array' });
    expect(r.success).toBe(false);
  });

  it('previews valid catalog', async () => {
    const r = await mod.previewCatalogLoad({ products: [validProduct], catalogVersion: '1.0' });
    expect(r.success).toBe(true);
    expect(r.data.dryRun).toBe(true);
    expect(r.data.totalProducts).toBe(1);
    expect(r.data.validProducts).toBe(1);
    expect(r.data.invalidProducts).toBe(0);
    expect(r.data.catalogVersion).toBe('1.0');
  });

  it('detects invalid products', async () => {
    const r = await mod.previewCatalogLoad({
      products: [validProduct, { name: '' }],
    });
    expect(r.data.validProducts).toBe(1);
    expect(r.data.invalidProducts).toBe(1);
    expect(r.data.errorCount).toBeGreaterThan(0);
  });

  it('validates missing name', async () => {
    const r = await mod.previewCatalogLoad({
      products: [{ ...validProduct, name: '' }],
    });
    expect(r.data.errors.some(e => e.field === 'name')).toBe(true);
  });

  it('validates missing slug', async () => {
    const r = await mod.previewCatalogLoad({
      products: [{ ...validProduct, slug: '' }],
    });
    expect(r.data.errors.some(e => e.field === 'slug')).toBe(true);
  });

  it('validates missing sku', async () => {
    const r = await mod.previewCatalogLoad({
      products: [{ ...validProduct, sku: '' }],
    });
    expect(r.data.errors.some(e => e.field === 'sku')).toBe(true);
  });

  it('validates invalid category', async () => {
    const r = await mod.previewCatalogLoad({
      products: [{ ...validProduct, category: 'invalid-cat' }],
    });
    expect(r.data.errors.some(e => e.field === 'category')).toBe(true);
  });

  it('validates negative price', async () => {
    const r = await mod.previewCatalogLoad({
      products: [{ ...validProduct, price: -10 }],
    });
    expect(r.data.errors.some(e => e.field === 'price')).toBe(true);
  });

  it('accepts null price', async () => {
    const r = await mod.previewCatalogLoad({
      products: [{ ...validProduct, price: null }],
    });
    expect(r.data.validProducts).toBe(1);
  });

  it('validates images must be array', async () => {
    const r = await mod.previewCatalogLoad({
      products: [{ ...validProduct, images: 'not-array' }],
    });
    expect(r.data.errors.some(e => e.field === 'images')).toBe(true);
  });

  it('returns category counts', async () => {
    const r = await mod.previewCatalogLoad({
      products: [
        validProduct,
        { ...validProduct, sku: 'FF-002', category: 'mattresses' },
      ],
    });
    expect(r.data.categoryCounts['futon-frames']).toBe(1);
    expect(r.data.categoryCounts['mattresses']).toBe(1);
  });

  it('caps errors at 100', async () => {
    const products = Array.from({ length: 150 }, () => ({ invalid: true }));
    const r = await mod.previewCatalogLoad({ products });
    expect(r.data.errors.length).toBeLessThanOrEqual(100);
  });
});

// ── loadCatalogMaster ──────────────────────────────────────────────

describe('loadCatalogMaster', () => {
  it('rejects null catalog', async () => {
    const r = await mod.loadCatalogMaster(null);
    expect(r.success).toBe(false);
  });

  it('fails on validation errors by default', async () => {
    const r = await mod.loadCatalogMaster({ products: [{ invalid: true }] });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Validation failed');
    expect(r.data.importId).toBeTruthy();
  });

  it('records failed import to CatalogImports', async () => {
    await mod.loadCatalogMaster({ products: [{ invalid: true }] });
    expect(_collections['CatalogImports']).toHaveLength(1);
    expect(_collections['CatalogImports'][0].status).toBe('failed');
  });

  it('loads valid products', async () => {
    const r = await mod.loadCatalogMaster({ products: [validProduct] });
    expect(r.success).toBe(true);
    expect(r.data.successCount).toBe(1);
    expect(r.data.skippedCount).toBe(0);
    expect(_collections['Products']).toHaveLength(1);
    expect(_collections['Products'][0].name).toBe('Full Futon Frame');
  });

  it('skips invalid products with skipInvalid', async () => {
    const r = await mod.loadCatalogMaster(
      { products: [validProduct, { name: '' }] },
      { skipInvalid: true },
    );
    expect(r.success).toBe(true);
    expect(r.data.successCount).toBe(1);
    expect(r.data.skippedCount).toBe(1);
  });

  it('upserts by SKU', async () => {
    __seed('Products', [{ _id: 'existing', sku: 'FF-001', name: 'Old Name' }]);
    const r = await mod.loadCatalogMaster({ products: [validProduct] });
    expect(r.success).toBe(true);
    expect(_collections['Products']).toHaveLength(1);
    expect(_collections['Products'][0].name).toBe('Full Futon Frame');
  });

  it('transforms variants to JSON', async () => {
    await mod.loadCatalogMaster({ products: [validProduct] });
    const variants = JSON.parse(_collections['Products'][0].variants);
    expect(variants).toHaveLength(1);
    expect(variants[0].label).toBe('Natural');
  });

  it('transforms dimensions to JSON', async () => {
    await mod.loadCatalogMaster({ products: [validProduct] });
    const dims = JSON.parse(_collections['Products'][0].dimensions);
    expect(dims.width).toBe(82);
    expect(dims.depth).toBe(38);
  });

  it('caps images at 20', async () => {
    const manyImages = Array.from({ length: 25 }, (_, i) => `img${i}.jpg`);
    await mod.loadCatalogMaster({ products: [{ ...validProduct, images: manyImages }] });
    const images = JSON.parse(_collections['Products'][0].images);
    expect(images).toHaveLength(20);
  });

  it('caps variants at 50', async () => {
    const manyVariants = Array.from({ length: 60 }, (_, i) => ({ label: `V${i}` }));
    await mod.loadCatalogMaster({ products: [{ ...validProduct, variants: manyVariants }] });
    const variants = JSON.parse(_collections['Products'][0].variants);
    expect(variants).toHaveLength(50);
  });

  it('records successful import', async () => {
    await mod.loadCatalogMaster({ products: [validProduct] });
    expect(_collections['CatalogImports']).toHaveLength(1);
    expect(_collections['CatalogImports'][0].status).toBe('completed');
  });

  it('defaults missing dimensions to zeros', async () => {
    const noDims = { ...validProduct, dimensions: undefined };
    await mod.loadCatalogMaster({ products: [noDims] });
    const dims = JSON.parse(_collections['Products'][0].dimensions);
    expect(dims.width).toBe(0);
    expect(dims.depth).toBe(0);
  });
});

// ── getCatalogLoadStatus ───────────────────────────────────────────

describe('getCatalogLoadStatus', () => {
  it('rejects invalid import ID', async () => {
    const r = await mod.getCatalogLoadStatus(null);
    expect(r.success).toBe(false);
  });

  it('returns not found for missing import', async () => {
    __seed('CatalogImports', []);
    const r = await mod.getCatalogLoadStatus('cml-missing');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('returns import status', async () => {
    __seed('CatalogImports', [{
      _id: 'ci1', importId: 'cml-123', status: 'completed',
      totalItems: 10, successCount: 9, errorCount: 1, skippedCount: 1,
      errors: '[]', completedAt: new Date(),
    }]);
    const r = await mod.getCatalogLoadStatus('cml-123');
    expect(r.success).toBe(true);
    expect(r.data.status).toBe('completed');
    expect(r.data.successCount).toBe(9);
    expect(r.data.skippedCount).toBe(1);
  });
});
