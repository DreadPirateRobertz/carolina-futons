import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  previewCatalogLoad,
  loadCatalogMaster,
  getCatalogLoadStatus,
} from '../src/backend/loadCatalogMaster.web.js';

beforeEach(() => {
  resetData();
});

function makeProduct(overrides = {}) {
  return {
    name: 'Monterey Futon Frame',
    slug: 'monterey',
    sku: 'CF-FRAME-MONTEREY',
    category: 'futon-frames',
    url: 'https://www.carolinafutons.com/product-page/monterey',
    price: 549,
    description: 'The Monterey features mission-style arms.',
    images: ['https://static.wixstatic.com/media/img1.jpg'],
    variants: [{ label: 'Queen / Cherry', sku: null, price: null }],
    dimensions: { width: 80, depth: 35, height: 32, weight: 75 },
    manufacturer: 'Night & Day Furniture',
    inStock: true,
    bundleCompatible: true,
    availability: 'InStock',
    swatches: ['Cherry', 'Dark Chocolate'],
    sizes: ['Full', 'Queen'],
    ...overrides,
  };
}

function makeCatalog(products, overrides = {}) {
  return {
    catalogVersion: '1.0.0',
    totalProducts: products.length,
    products,
    ...overrides,
  };
}

// ── previewCatalogLoad ───────────────────────────────────────────────

describe('previewCatalogLoad', () => {
  it('previews valid catalog', async () => {
    const catalog = makeCatalog([
      makeProduct(),
      makeProduct({ name: 'Sunrise', slug: 'sunrise', sku: 'CF-FRAME-SUNRISE', price: 779 }),
    ]);
    const result = await previewCatalogLoad(catalog);
    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.totalProducts).toBe(2);
    expect(result.data.validProducts).toBe(2);
    expect(result.data.invalidProducts).toBe(0);
    expect(result.data.categoryCounts['futon-frames']).toBe(2);
  });

  it('reports invalid products', async () => {
    const catalog = makeCatalog([
      makeProduct(),
      makeProduct({ name: '', sku: '' }),
    ]);
    const result = await previewCatalogLoad(catalog);
    expect(result.success).toBe(true);
    expect(result.data.validProducts).toBe(1);
    expect(result.data.invalidProducts).toBe(1);
    expect(result.data.errorCount).toBeGreaterThan(0);
  });

  it('includes catalog version', async () => {
    const catalog = makeCatalog([makeProduct()], { catalogVersion: '2.0.0' });
    const result = await previewCatalogLoad(catalog);
    expect(result.data.catalogVersion).toBe('2.0.0');
  });

  it('rejects null input', async () => {
    const result = await previewCatalogLoad(null);
    expect(result.success).toBe(false);
  });

  it('rejects missing products array', async () => {
    const result = await previewCatalogLoad({ catalogVersion: '1.0.0' });
    expect(result.success).toBe(false);
  });

  it('reports category distribution', async () => {
    const catalog = makeCatalog([
      makeProduct({ category: 'futon-frames' }),
      makeProduct({ name: 'Bed', slug: 'bed', sku: 'PB-1', category: 'platform-beds' }),
      makeProduct({ name: 'Matt', slug: 'matt', sku: 'MT-1', category: 'mattresses' }),
    ]);
    const result = await previewCatalogLoad(catalog);
    expect(result.data.categoryCounts['futon-frames']).toBe(1);
    expect(result.data.categoryCounts['platform-beds']).toBe(1);
    expect(result.data.categoryCounts['mattresses']).toBe(1);
  });

  it('validates new categories', async () => {
    const catalog = makeCatalog([
      makeProduct({ category: 'outdoor-furniture', sku: 'OF-1', slug: 'outdoor' }),
      makeProduct({ category: 'pillows-702', sku: 'PL-1', slug: 'pillow', name: 'Pillow' }),
      makeProduct({ category: 'log-frames', sku: 'LF-1', slug: 'log', name: 'Log Frame' }),
    ]);
    const result = await previewCatalogLoad(catalog);
    expect(result.data.validProducts).toBe(3);
    expect(result.data.errorCount).toBe(0);
  });
});

// ── loadCatalogMaster ────────────────────────────────────────────────

describe('loadCatalogMaster', () => {
  it('loads valid catalog into CMS', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const catalog = makeCatalog([
      makeProduct(),
      makeProduct({ name: 'Sunrise', slug: 'sunrise', sku: 'CF-FRAME-SUNRISE', price: 779 }),
    ]);

    const result = await loadCatalogMaster(catalog);
    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(2);
    expect(result.data.totalProducts).toBe(2);
    expect(result.data.importId).toMatch(/^cml-/);
    expect(inserts.filter(i => i.col === 'Products')).toHaveLength(2);
    expect(inserts.filter(i => i.col === 'CatalogImports')).toHaveLength(1);
  });

  it('upserts existing products by SKU', async () => {
    const updates = [];
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('Products', [
      { _id: 'existing-1', sku: 'CF-FRAME-MONTEREY', name: 'Old Name', price: 399 },
    ]);
    __seed('CatalogImports', []);

    const catalog = makeCatalog([makeProduct()]);
    const result = await loadCatalogMaster(catalog);
    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(1);
    expect(updates.filter(u => u.col === 'Products')).toHaveLength(1);
    expect(updates[0].item.name).toBe('Monterey Futon Frame');
    expect(updates[0].item.price).toBe(549);
  });

  it('fails on validation errors without skipInvalid', async () => {
    __seed('CatalogImports', []);
    const catalog = makeCatalog([
      makeProduct(),
      makeProduct({ name: '', sku: '' }), // invalid
    ]);

    const result = await loadCatalogMaster(catalog);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation');
    expect(result.data.errorCount).toBeGreaterThan(0);
  });

  it('skips invalid products with skipInvalid option', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const catalog = makeCatalog([
      makeProduct(),
      makeProduct({ name: '', sku: '', slug: '' }), // invalid
    ]);

    const result = await loadCatalogMaster(catalog, { skipInvalid: true });
    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(1);
    expect(result.data.skippedCount).toBe(1);
  });

  it('rejects null catalog', async () => {
    const result = await loadCatalogMaster(null);
    expect(result.success).toBe(false);
  });

  it('rejects catalog without products array', async () => {
    const result = await loadCatalogMaster({ catalogVersion: '1.0.0' });
    expect(result.success).toBe(false);
  });

  it('transforms product fields correctly', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const catalog = makeCatalog([makeProduct()]);
    await loadCatalogMaster(catalog);

    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert).toBeDefined();
    const p = productInsert.item;
    expect(p.name).toBe('Monterey Futon Frame');
    expect(p.slug).toBe('monterey');
    expect(p.sku).toBe('CF-FRAME-MONTEREY');
    expect(p.category).toBe('futon-frames');
    expect(p.price).toBe(549);
    expect(p.manufacturer).toBe('Night & Day Furniture');
    expect(p.bundleCompatible).toBe(true);
    expect(p.inStock).toBe(true);
    expect(p.availability).toBe('InStock');
    expect(JSON.parse(p.images)).toHaveLength(1);
    expect(JSON.parse(p.variants)).toHaveLength(1);
    expect(JSON.parse(p.swatches)).toEqual(['Cherry', 'Dark Chocolate']);
    expect(JSON.parse(p.sizes)).toEqual(['Full', 'Queen']);
    const dims = JSON.parse(p.dimensions);
    expect(dims.width).toBe(80);
    expect(dims.weight).toBe(75);
  });

  it('handles missing optional fields gracefully', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const catalog = makeCatalog([makeProduct({
      description: undefined,
      variants: undefined,
      dimensions: undefined,
      manufacturer: undefined,
      swatches: undefined,
      sizes: undefined,
    })]);
    const result = await loadCatalogMaster(catalog);
    expect(result.success).toBe(true);
    const p = inserts.find(i => i.col === 'Products').item;
    expect(p.description).toBe('');
    expect(JSON.parse(p.variants)).toEqual([]);
    expect(JSON.parse(p.dimensions)).toEqual({ width: 0, depth: 0, height: 0, weight: 0 });
    expect(p.manufacturer).toBe('');
    expect(JSON.parse(p.swatches)).toEqual([]);
    expect(JSON.parse(p.sizes)).toEqual([]);
  });

  it('records import in CatalogImports collection', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const catalog = makeCatalog([makeProduct()]);
    await loadCatalogMaster(catalog);

    const importRecord = inserts.find(i => i.col === 'CatalogImports');
    expect(importRecord).toBeDefined();
    expect(importRecord.item.status).toBe('completed');
    expect(importRecord.item.importedBy).toBe('catalog-master-loader');
    expect(importRecord.item.successCount).toBe(1);
  });

  it('records failed import on validation error', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CatalogImports', []);

    const catalog = makeCatalog([makeProduct({ price: -5, name: '' })]);
    const result = await loadCatalogMaster(catalog);
    expect(result.success).toBe(false);
    const importRecord = inserts.find(i => i.col === 'CatalogImports');
    expect(importRecord).toBeDefined();
    expect(importRecord.item.status).toBe('failed');
  });
});

// ── getCatalogLoadStatus ─────────────────────────────────────────────

describe('getCatalogLoadStatus', () => {
  it('returns status for valid import ID', async () => {
    __seed('CatalogImports', [{
      importId: 'cml-12345-abc',
      status: 'completed',
      totalItems: 88,
      successCount: 88,
      errorCount: 0,
      skippedCount: 0,
      errors: '[]',
      completedAt: new Date(),
    }]);

    const result = await getCatalogLoadStatus('cml-12345-abc');
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('completed');
    expect(result.data.successCount).toBe(88);
    expect(result.data.totalItems).toBe(88);
  });

  it('returns error for unknown import ID', async () => {
    __seed('CatalogImports', []);
    const result = await getCatalogLoadStatus('cml-unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects null import ID', async () => {
    const result = await getCatalogLoadStatus(null);
    expect(result.success).toBe(false);
  });

  it('rejects non-string import ID', async () => {
    const result = await getCatalogLoadStatus(123);
    expect(result.success).toBe(false);
  });

  it('parses stored errors JSON', async () => {
    __seed('CatalogImports', [{
      importId: 'cml-err-test',
      status: 'failed',
      totalItems: 5,
      successCount: 0,
      errorCount: 2,
      errors: JSON.stringify([{ row: 0, field: 'name', error: 'Name is required' }]),
      completedAt: new Date(),
    }]);

    const result = await getCatalogLoadStatus('cml-err-test');
    expect(result.success).toBe(true);
    expect(result.data.errors).toHaveLength(1);
    expect(result.data.errors[0].field).toBe('name');
  });

  it('handles malformed errors JSON gracefully', async () => {
    __seed('CatalogImports', [{
      importId: 'cml-bad-json',
      status: 'completed',
      totalItems: 1,
      successCount: 1,
      errorCount: 0,
      errors: 'not valid json',
      completedAt: new Date(),
    }]);

    const result = await getCatalogLoadStatus('cml-bad-json');
    expect(result.success).toBe(true);
    expect(result.data.errors).toEqual([]);
  });
});

// ── Validation edge cases ────────────────────────────────────────────

describe('validateMasterProduct edge cases', () => {
  it('rejects product with invalid category', async () => {
    const catalog = makeCatalog([makeProduct({ category: 'invalid-cat' })]);
    const result = await previewCatalogLoad(catalog);
    expect(result.data.invalidProducts).toBe(1);
    expect(result.data.errors[0].field).toBe('category');
  });

  it('rejects product with negative price', async () => {
    const catalog = makeCatalog([makeProduct({ price: -10 })]);
    const result = await previewCatalogLoad(catalog);
    expect(result.data.invalidProducts).toBe(1);
    expect(result.data.errors[0].field).toBe('price');
  });

  it('rejects product with missing slug', async () => {
    const catalog = makeCatalog([makeProduct({ slug: '' })]);
    const result = await previewCatalogLoad(catalog);
    expect(result.data.invalidProducts).toBe(1);
  });

  it('rejects non-object product', async () => {
    const catalog = makeCatalog([null]);
    const result = await previewCatalogLoad(catalog);
    expect(result.data.invalidProducts).toBe(1);
    expect(result.data.errors[0].field).toBe('_self');
  });

  it('rejects product with non-array images', async () => {
    const catalog = makeCatalog([makeProduct({ images: 'not-array' })]);
    const result = await previewCatalogLoad(catalog);
    expect(result.data.invalidProducts).toBe(1);
  });
});
