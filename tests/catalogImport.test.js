import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  importProducts,
  validateImportData,
  getImportHistory,
  getImportDetails,
  getCatalogStats,
} from '../src/backend/catalogImport.web.js';

beforeEach(() => {
  resetData();
});

function makeProduct(overrides = {}) {
  return { name: 'Test Futon Frame', price: 299.99, category: 'futon-frames', ...overrides };
}

// ── importProducts ──────────────────────────────────────────────────

describe('importProducts', () => {
  it('imports valid products', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [
      makeProduct({ sku: 'FF-001' }),
      makeProduct({ name: 'Platform Bed', price: 499, category: 'platform-beds', sku: 'PB-001' }),
    ];

    const result = await importProducts(items);
    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(2);
    expect(result.data.totalItems).toBe(2);
    expect(result.data.importId).toMatch(/^imp-/);
    // 2 product inserts + 1 import record
    expect(inserts.filter(i => i.col === 'Products')).toHaveLength(2);
    expect(inserts.filter(i => i.col === 'CatalogImports')).toHaveLength(1);
  });

  it('rejects empty items array', async () => {
    const result = await importProducts([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty');
  });

  it('rejects non-array input', async () => {
    const result = await importProducts('not an array');
    expect(result.success).toBe(false);
  });

  it('rejects null input', async () => {
    const result = await importProducts(null);
    expect(result.success).toBe(false);
  });

  it('enforces 500-item cap', async () => {
    const items = Array.from({ length: 501 }, (_, i) => makeProduct({ sku: `SKU-${i}` }));
    const result = await importProducts(items);
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('allows exactly 500 items', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);
    const items = Array.from({ length: 500 }, (_, i) => makeProduct({ sku: `SKU-${i}` }));
    const result = await importProducts(items);
    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(500);
  });

  it('returns dry run preview without inserting', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push(col); });
    __seed('Products', []);

    const items = [makeProduct(), makeProduct({ name: 'Another', price: 199, category: 'mattresses' })];
    const result = await importProducts(items, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.totalItems).toBe(2);
    expect(result.data.validItems).toBe(2);
    expect(inserts).toHaveLength(0);
  });

  it('dry run reports errors without inserting', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push(col); });

    const items = [
      makeProduct(),
      { name: '', price: -1, category: 'invalid' },
    ];
    const result = await importProducts(items, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.validItems).toBe(1);
    expect(result.data.errorCount).toBeGreaterThan(0);
    expect(inserts).toHaveLength(0);
  });

  it('fails validation and records failed import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [{ name: '', price: -5, category: 'bogus' }];
    const result = await importProducts(items);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation');
    expect(result.data.errors.length).toBeGreaterThan(0);
    // Should record in CatalogImports
    const importRecord = inserts.find(i => i.col === 'CatalogImports');
    expect(importRecord).toBeDefined();
    expect(importRecord.item.status).toBe('failed');
  });

  it('upserts existing product by SKU', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('Products', [
      { _id: 'existing-1', name: 'Old Name', price: 100, category: 'futon-frames', sku: 'FF-001' },
    ]);
    __seed('CatalogImports', []);

    const items = [makeProduct({ name: 'New Name', price: 350, sku: 'FF-001' })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(1);
    expect(updated).not.toBeNull();
    expect(updated.name).toBe('New Name');
    expect(updated.price).toBe(350);
  });

  it('inserts new product when SKU not found', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ sku: 'NEW-001' })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.sku).toBe('NEW-001');
  });

  it('inserts product without SKU (no upsert lookup)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ sku: undefined })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(1);
  });

  it('sanitizes HTML in product names', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ name: '<script>alert("xss")</script>Futon Frame' })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.name).not.toContain('<script>');
    expect(productInsert.item.name).toContain('Futon Frame');
  });

  it('rejects product with missing name', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [{ price: 100, category: 'futon-frames' }];
    const result = await importProducts(items);
    expect(result.success).toBe(false);
    expect(result.data.errors.some(e => e.field === 'name')).toBe(true);
  });

  it('rejects product with negative price', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ price: -50 })];
    const result = await importProducts(items);
    expect(result.success).toBe(false);
    expect(result.data.errors.some(e => e.field === 'price')).toBe(true);
  });

  it('rejects product with invalid category', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ category: 'not-a-category' })];
    const result = await importProducts(items);
    expect(result.success).toBe(false);
    expect(result.data.errors.some(e => e.field === 'category')).toBe(true);
  });

  it('accepts null price for contact-for-availability products', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ price: null })];
    const result = await importProducts(items);
    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(1);
  });

  it('accepts wall-hugger-frames category', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ category: 'wall-hugger-frames' })];
    const result = await importProducts(items);
    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(1);
  });

  it('rejects product with negative weight', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ weight: -10 })];
    const result = await importProducts(items);
    expect(result.success).toBe(false);
  });

  it('defaults inStock to true', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct()];
    await importProducts(items);

    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.inStock).toBe(true);
  });

  it('preserves slug field on import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ slug: 'monterey' })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.slug).toBe('monterey');
  });

  it('preserves url field on import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ url: 'https://www.carolinafutons.com/product-page/monterey' })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.url).toBe('https://www.carolinafutons.com/product-page/monterey');
  });

  it('preserves images array on import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const images = ['https://static.wixstatic.com/media/img1.jpg', 'https://static.wixstatic.com/media/img2.jpg'];
    const items = [makeProduct({ images })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.images).toEqual(images);
  });

  it('defaults images to empty array when not provided', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct()];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.images).toEqual([]);
  });

  it('validates images must be array if provided', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ images: 'not-an-array' })];
    const result = await importProducts(items);
    expect(result.success).toBe(false);
    expect(result.data.errors.some(e => e.field === 'images')).toBe(true);
  });

  it('preserves variants array on import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const variants = [
      { label: 'Full / Cherry', sku: null, price: null },
      { label: 'Queen / Walnut', sku: 'Q-WAL', price: 599 },
    ];
    const items = [makeProduct({ variants })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.variants).toEqual(variants);
  });

  it('defaults variants to empty array when not provided', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct()];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.variants).toEqual([]);
  });

  it('validates variants must be array if provided', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ variants: 'not-an-array' })];
    const result = await importProducts(items);
    expect(result.success).toBe(false);
    expect(result.data.errors.some(e => e.field === 'variants')).toBe(true);
  });

  it('validates variant items must have label', async () => {
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ variants: [{ sku: 'X', price: 100 }] })];
    const result = await importProducts(items);
    expect(result.success).toBe(false);
    expect(result.data.errors.some(e => e.field === 'variants')).toBe(true);
  });

  it('preserves dimensions object on import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const dimensions = { width: 80, depth: 36, height: 32, weight: 85 };
    const items = [makeProduct({ dimensions })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.dimensions).toEqual(dimensions);
  });

  it('defaults dimensions to null when not provided', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct()];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.dimensions).toBeNull();
  });

  it('preserves manufacturer field on import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ manufacturer: 'Night & Day Furniture' })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.manufacturer).toBe('Night & Day Furniture');
  });

  it('preserves swatches array on import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const swatches = ['Cherry', 'Chocolate', 'Dark Chocolate'];
    const items = [makeProduct({ swatches })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.swatches).toEqual(swatches);
  });

  it('preserves sizes array on import', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const sizes = ['Full', 'Queen', 'King'];
    const items = [makeProduct({ sizes })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.sizes).toEqual(sizes);
  });

  it('preserves bundleCompatible and availability flags', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ bundleCompatible: true, availability: 'OutOfStock' })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.bundleCompatible).toBe(true);
    expect(productInsert.item.availability).toBe('OutOfStock');
  });

  it('preserves contactForPrice flag', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const items = [makeProduct({ price: null, contactForPrice: true })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    const productInsert = inserts.find(i => i.col === 'Products');
    expect(productInsert.item.contactForPrice).toBe(true);
  });

  it('imports full catalog-MASTER format product with all fields', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    const fullProduct = {
      name: 'Monterey Futon Frame',
      slug: 'monterey',
      sku: 'CF-FRAME-MONTEREY',
      category: 'futon-frames',
      url: 'https://www.carolinafutons.com/product-page/monterey',
      price: 549,
      description: 'The Monterey features mission-style arms.',
      images: ['https://static.wixstatic.com/media/img1.jpg'],
      variants: [{ label: 'Full / Cherry', sku: null, price: null }],
      dimensions: { width: 80, depth: 36, height: 32, weight: 85 },
      manufacturer: 'Night & Day Furniture',
      inStock: true,
      bundleCompatible: true,
      availability: 'OutOfStock',
      swatches: ['Cherry', 'Chocolate'],
      sizes: ['Full', 'Queen'],
      contactForPrice: false,
    };
    const result = await importProducts([fullProduct]);

    expect(result.success).toBe(true);
    expect(result.data.successCount).toBe(1);
    const p = inserts.find(i => i.col === 'Products').item;
    expect(p.slug).toBe('monterey');
    expect(p.url).toBe('https://www.carolinafutons.com/product-page/monterey');
    expect(p.images).toHaveLength(1);
    expect(p.variants).toHaveLength(1);
    expect(p.dimensions.width).toBe(80);
    expect(p.manufacturer).toBe('Night & Day Furniture');
    expect(p.swatches).toEqual(['Cherry', 'Chocolate']);
    expect(p.sizes).toEqual(['Full', 'Queen']);
    expect(p.bundleCompatible).toBe(true);
    expect(p.availability).toBe('OutOfStock');
    expect(p.contactForPrice).toBe(false);
  });

  it('upsert preserves new fields when updating by SKU', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('Products', [
      { _id: 'existing-1', name: 'Old Name', price: 100, category: 'futon-frames', sku: 'FF-001' },
    ]);
    __seed('CatalogImports', []);

    const items = [makeProduct({
      sku: 'FF-001',
      slug: 'updated-slug',
      images: ['https://img.com/new.jpg'],
      variants: [{ label: 'Queen / Cherry', sku: null, price: null }],
      manufacturer: 'KD Frames',
    })];
    const result = await importProducts(items);

    expect(result.success).toBe(true);
    expect(updated.slug).toBe('updated-slug');
    expect(updated.images).toEqual(['https://img.com/new.jpg']);
    expect(updated.variants).toHaveLength(1);
    expect(updated.manufacturer).toBe('KD Frames');
  });

  it('records completed import in CatalogImports', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('Products', []);
    __seed('CatalogImports', []);

    await importProducts([makeProduct()]);

    const importRecord = inserts.find(i => i.col === 'CatalogImports');
    expect(importRecord.item.status).toBe('completed');
    expect(importRecord.item.successCount).toBe(1);
    expect(importRecord.item.completedAt).toBeInstanceOf(Date);
  });
});

// ── validateImportData ──────────────────────────────────────────────

describe('validateImportData', () => {
  it('returns stats for valid items', async () => {
    const items = [
      makeProduct({ category: 'futon-frames' }),
      makeProduct({ category: 'futon-frames' }),
      makeProduct({ category: 'mattresses', name: 'Mattress', price: 199 }),
    ];
    const result = await validateImportData(items);

    expect(result.success).toBe(true);
    expect(result.data.totalItems).toBe(3);
    expect(result.data.validItems).toBe(3);
    expect(result.data.errorCount).toBe(0);
  });

  it('returns category counts', async () => {
    const items = [
      makeProduct({ category: 'futon-frames' }),
      makeProduct({ category: 'futon-frames' }),
      makeProduct({ category: 'mattresses', name: 'M1', price: 100 }),
    ];
    const result = await validateImportData(items);

    expect(result.data.categoryCounts['futon-frames']).toBe(2);
    expect(result.data.categoryCounts['mattresses']).toBe(1);
  });

  it('tracks missing fields', async () => {
    const items = [
      { price: 100, category: 'futon-frames' },          // missing name
      { name: 'Test', category: 'mattresses' },            // missing price
      { name: 'Test2', price: 50 },                        // missing category
    ];
    const result = await validateImportData(items);

    expect(result.data.missingFields.name).toBe(1);
    expect(result.data.missingFields.price).toBe(1);
    expect(result.data.missingFields.category).toBe(1);
  });

  it('rejects empty array', async () => {
    const result = await validateImportData([]);
    expect(result.success).toBe(false);
  });

  it('rejects non-array input', async () => {
    const result = await validateImportData('string');
    expect(result.success).toBe(false);
  });

  it('enforces 500-item cap', async () => {
    const items = Array.from({ length: 501 }, () => makeProduct());
    const result = await validateImportData(items);
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('counts invalid rows correctly', async () => {
    const items = [
      makeProduct(),
      { name: '', price: -1, category: 'bad' },
      makeProduct({ category: 'mattresses', name: 'Valid', price: 100 }),
    ];
    const result = await validateImportData(items);

    expect(result.data.validItems).toBe(2);
    expect(result.data.errorCount).toBeGreaterThan(0);
  });
});

// ── getImportHistory ────────────────────────────────────────────────

describe('getImportHistory', () => {
  it('returns paginated import history', async () => {
    __seed('CatalogImports', [
      { _id: 'i-1', importId: 'imp-1', status: 'completed', totalItems: 10, successCount: 10, errorCount: 0, _createdDate: new Date() },
      { _id: 'i-2', importId: 'imp-2', status: 'failed', totalItems: 5, successCount: 0, errorCount: 3, _createdDate: new Date() },
    ]);

    const result = await getImportHistory();
    expect(result.success).toBe(true);
    expect(result.data.imports).toHaveLength(2);
    expect(result.data.imports[0].importId).toBeDefined();
    expect(result.data.imports[0].status).toBeDefined();
  });

  it('respects page and pageSize', async () => {
    __seed('CatalogImports', []);
    const result = await getImportHistory({ page: 2, pageSize: 5 });
    expect(result.data.page).toBe(2);
    expect(result.data.pageSize).toBe(5);
  });

  it('clamps pageSize to max 50', async () => {
    __seed('CatalogImports', []);
    const result = await getImportHistory({ pageSize: 100 });
    expect(result.data.pageSize).toBe(50);
  });

  it('returns empty when no imports', async () => {
    __seed('CatalogImports', []);
    const result = await getImportHistory();
    expect(result.data.imports).toHaveLength(0);
  });
});

// ── getImportDetails ────────────────────────────────────────────────

describe('getImportDetails', () => {
  it('returns details for a specific import', async () => {
    __seed('CatalogImports', [{
      _id: 'i-1', importId: 'imp-123', status: 'completed',
      totalItems: 10, successCount: 8, errorCount: 2,
      errors: JSON.stringify([{ row: 3, field: 'price', error: 'negative' }]),
      importedBy: 'admin', dryRun: false,
      completedAt: new Date(), _createdDate: new Date(),
    }]);

    const result = await getImportDetails('imp-123');
    expect(result.success).toBe(true);
    expect(result.data.importId).toBe('imp-123');
    expect(result.data.status).toBe('completed');
    expect(result.data.successCount).toBe(8);
    expect(result.data.errors).toHaveLength(1);
    expect(result.data.errors[0].field).toBe('price');
  });

  it('returns not found for missing import', async () => {
    __seed('CatalogImports', []);
    const result = await getImportDetails('imp-nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects empty import ID', async () => {
    const result = await getImportDetails('');
    expect(result.success).toBe(false);
  });

  it('rejects null import ID', async () => {
    const result = await getImportDetails(null);
    expect(result.success).toBe(false);
  });

  it('handles malformed errors JSON gracefully', async () => {
    __seed('CatalogImports', [{
      _id: 'i-1', importId: 'imp-bad', status: 'failed',
      totalItems: 1, successCount: 0, errorCount: 1,
      errors: 'not-valid-json',
      _createdDate: new Date(),
    }]);

    const result = await getImportDetails('imp-bad');
    expect(result.success).toBe(true);
    expect(result.data.errors).toEqual([]);
  });
});

// ── getCatalogStats ─────────────────────────────────────────────────

describe('getCatalogStats', () => {
  it('returns catalog statistics', async () => {
    __seed('Products', [
      { _id: 'p-1', category: 'futon-frames', price: 300, inStock: true },
      { _id: 'p-2', category: 'futon-frames', price: 400, inStock: true },
      { _id: 'p-3', category: 'mattresses', price: 200, inStock: false },
    ]);

    const result = await getCatalogStats();
    expect(result.success).toBe(true);
    expect(result.data.totalProducts).toBe(3);
    expect(result.data.categoryCounts['futon-frames']).toBe(2);
    expect(result.data.categoryCounts['mattresses']).toBe(1);
    expect(result.data.inStockCount).toBe(2);
    expect(result.data.outOfStockCount).toBe(1);
    expect(result.data.averagePrice).toBe(300);
  });

  it('returns zero averagePrice for empty catalog', async () => {
    __seed('Products', []);
    const result = await getCatalogStats();
    expect(result.success).toBe(true);
    expect(result.data.totalProducts).toBe(0);
    expect(result.data.averagePrice).toBe(0);
    expect(result.data.inStockCount).toBe(0);
  });

  it('counts uncategorized products', async () => {
    __seed('Products', [
      { _id: 'p-1', price: 100, inStock: true },
    ]);

    const result = await getCatalogStats();
    expect(result.data.categoryCounts['uncategorized']).toBe(1);
  });

  it('defaults inStock to true when not specified', async () => {
    __seed('Products', [
      { _id: 'p-1', category: 'futon-frames', price: 100 },
    ]);

    const result = await getCatalogStats();
    expect(result.data.inStockCount).toBe(1);
    expect(result.data.outOfStockCount).toBe(0);
  });
});
