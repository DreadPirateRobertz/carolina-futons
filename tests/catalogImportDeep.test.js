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
    if (!id || typeof id !== 'string') return '';
    return id.replace(/[^a-zA-Z0-9_-]/g, '');
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
    skip: (n) => { filters._skip = n; return chain; },
    limit: (n) => { filters._limit = n; return chain; },
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

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/catalogImport.web.js');
});

describe('importProducts', () => {
  it('rejects empty array', async () => {
    const r = await mod.importProducts([]);
    expect(r.success).toBe(false);
  });

  it('rejects non-array', async () => {
    const r = await mod.importProducts('not array');
    expect(r.success).toBe(false);
  });

  it('rejects over max size', async () => {
    const items = Array.from({ length: 501 }, () => ({ name: 'X', price: 10, category: 'mattresses' }));
    const r = await mod.importProducts(items);
    expect(r.success).toBe(false);
    expect(r.error).toContain('500');
  });

  it('validates and rejects invalid items', async () => {
    __seed('CatalogImports', []);
    const r = await mod.importProducts([{ name: '', price: -1, category: 'bad' }]);
    expect(r.success).toBe(false);
    expect(r.data.errors.length).toBeGreaterThan(0);
  });

  it('imports valid products', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);
    const r = await mod.importProducts([
      { name: 'Futon Frame', price: 499, category: 'futon-frames', sku: 'FF-001' },
    ]);
    expect(r.success).toBe(true);
    expect(r.data.successCount).toBe(1);
    expect(_collections['Products']).toHaveLength(1);
  });

  it('dry run does not insert', async () => {
    __seed('Products', []);
    const r = await mod.importProducts(
      [{ name: 'Futon Frame', price: 499, category: 'futon-frames' }],
      { dryRun: true },
    );
    expect(r.success).toBe(true);
    expect(r.data.dryRun).toBe(true);
    expect((_collections['Products'] || [])).toHaveLength(0);
  });

  it('upserts by SKU', async () => {
    __seed('Products', [{ _id: 'existing1', sku: 'FF-001', name: 'Old Name', price: 400, category: 'futon-frames' }]);
    __seed('CatalogImports', []);
    const r = await mod.importProducts([
      { name: 'New Name', price: 499, category: 'futon-frames', sku: 'FF-001' },
    ]);
    expect(r.success).toBe(true);
    expect(r.data.successCount).toBe(1);
  });
});

describe('validateImportData', () => {
  it('rejects empty array', async () => {
    const r = await mod.validateImportData([]);
    expect(r.success).toBe(false);
  });

  it('validates and reports stats', async () => {
    const r = await mod.validateImportData([
      { name: 'Futon', price: 499, category: 'futon-frames' },
      { name: '', price: -1, category: 'bad' },
    ]);
    expect(r.success).toBe(true);
    expect(r.data.totalItems).toBe(2);
    expect(r.data.validItems).toBe(1);
    expect(r.data.categoryCounts['futon-frames']).toBe(1);
  });
});

describe('getImportHistory', () => {
  it('returns paginated history', async () => {
    __seed('CatalogImports', [
      { _id: 'i1', importId: 'imp-1', status: 'completed', totalItems: 5, successCount: 5, errorCount: 0, importedBy: 'admin', completedAt: new Date() },
    ]);
    const r = await mod.getImportHistory({ page: 1, pageSize: 10 });
    expect(r.success).toBe(true);
    expect(r.data.imports).toHaveLength(1);
    expect(r.data.imports[0].status).toBe('completed');
  });
});

describe('getImportDetails', () => {
  it('rejects null importId', async () => {
    const r = await mod.getImportDetails(null);
    expect(r.success).toBe(false);
  });

  it('returns import details', async () => {
    __seed('CatalogImports', [
      { _id: 'i1', importId: 'imp-abc', status: 'completed', totalItems: 5, successCount: 5, errorCount: 0, errors: '[]' },
    ]);
    const r = await mod.getImportDetails('imp-abc');
    expect(r.success).toBe(true);
    expect(r.data.status).toBe('completed');
  });

  it('returns not found for unknown', async () => {
    __seed('CatalogImports', []);
    const r = await mod.getImportDetails('imp-unknown');
    expect(r.success).toBe(false);
  });
});

describe('getCatalogStats', () => {
  it('returns stats', async () => {
    __seed('Products', [
      { _id: 'p1', category: 'futon-frames', price: 499, inStock: true },
      { _id: 'p2', category: 'mattresses', price: 299, inStock: false },
    ]);
    const r = await mod.getCatalogStats();
    expect(r.success).toBe(true);
    expect(r.data.totalProducts).toBe(2);
    expect(r.data.inStockCount).toBe(1);
    expect(r.data.outOfStockCount).toBe(1);
    expect(r.data.categoryCounts['futon-frames']).toBe(1);
    expect(r.data.averagePrice).toBe(399);
  });
});
