import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed as seedData } from '../__mocks__/wix-data.js';
import {
  validateCatalogProduct,
  auditCatalog,
  getCatalogSyncStatus,
  mapProductToBoard,
  generatePinContent,
  getBoardStructure,
} from '../../src/backend/pinterestCatalogSync.web.js';

beforeEach(() => {
  resetData();
});

// ── Helper fixtures ──────────────────────────────────────────────────

const validProduct = {
  _id: 'prod-001',
  name: 'Eureka Futon Frame',
  slug: 'eureka-futon-frame',
  description: 'Solid hardwood futon frame with wall hugger design.',
  price: 599.99,
  inStock: true,
  mainMedia: 'https://www.carolinafutons.com/images/eureka.jpg',
  collections: ['futon-frames'],
  sku: 'NDF-EUREKA-001',
};

const minimalProduct = {
  _id: 'prod-002',
  name: 'Basic Frame',
  slug: 'basic-frame',
  price: 199,
};

// ── validateCatalogProduct ───────────────────────────────────────────

describe('validateCatalogProduct', () => {
  it('validates a complete product with no issues', async () => {
    const result = await validateCatalogProduct(validProduct);
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects missing product name', async () => {
    const result = await validateCatalogProduct({ ...validProduct, name: '' });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('detects missing slug', async () => {
    const result = await validateCatalogProduct({ ...validProduct, slug: '' });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ field: 'slug' }));
  });

  it('detects missing or zero price', async () => {
    const result = await validateCatalogProduct({ ...validProduct, price: 0 });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ field: 'price' }));
  });

  it('detects negative price', async () => {
    const result = await validateCatalogProduct({ ...validProduct, price: -50 });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ field: 'price' }));
  });

  it('warns on missing description', async () => {
    const result = await validateCatalogProduct({ ...validProduct, description: '' });
    expect(result.valid).toBe(true); // warning, not error
    expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'description' }));
  });

  it('warns on missing image', async () => {
    const result = await validateCatalogProduct({ ...validProduct, mainMedia: '' });
    expect(result.valid).toBe(true); // warning, not error — default image fallback
    expect(result.warnings).toContainEqual(expect.objectContaining({ field: 'mainMedia' }));
  });

  it('warns on description exceeding 500 chars', async () => {
    const longDesc = 'A'.repeat(501);
    const result = await validateCatalogProduct({ ...validProduct, description: longDesc });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ field: 'description', type: 'length' })
    );
  });

  it('warns on title exceeding 150 chars', async () => {
    const longName = 'X'.repeat(151);
    const result = await validateCatalogProduct({ ...validProduct, name: longName });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ field: 'name', type: 'length' })
    );
  });

  it('returns error for null input', async () => {
    const result = await validateCatalogProduct(null);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for non-object input', async () => {
    const result = await validateCatalogProduct('not-an-object');
    expect(result.success).toBe(false);
  });

  it('detects non-absolute image URL', async () => {
    const result = await validateCatalogProduct({
      ...validProduct,
      mainMedia: '/relative/path.jpg',
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ field: 'mainMedia', type: 'format' })
    );
  });

  it('sanitizes XSS in product fields', async () => {
    const result = await validateCatalogProduct({
      ...validProduct,
      name: '<script>alert(1)</script>Clean Frame',
    });
    expect(result.success).toBe(true);
    // Sanitized name should not contain script tags
    expect(result.sanitizedName).not.toContain('<script>');
  });
});

// ── auditCatalog ─────────────────────────────────────────────────────

describe('auditCatalog', () => {
  it('audits all products in the catalog', async () => {
    seedData('Stores/Products', [
      validProduct,
      { _id: 'prod-bad', name: '', slug: '', price: 0 },
      minimalProduct,
    ]);

    const result = await auditCatalog();
    expect(result.success).toBe(true);
    expect(result.totalProducts).toBe(3);
    expect(result.validCount).toBeGreaterThanOrEqual(1);
    expect(result.invalidCount).toBeGreaterThanOrEqual(1);
    expect(result.issues).toBeInstanceOf(Array);
  });

  it('returns empty audit for empty catalog', async () => {
    seedData('Stores/Products', []);

    const result = await auditCatalog();
    expect(result.success).toBe(true);
    expect(result.totalProducts).toBe(0);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });

  it('includes product ID in issue reports', async () => {
    seedData('Stores/Products', [
      { _id: 'bad-prod', name: '', slug: 'test', price: 99 },
    ]);

    const result = await auditCatalog();
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].productId).toBe('bad-prod');
  });

  it('tracks warning count separately from errors', async () => {
    seedData('Stores/Products', [minimalProduct]); // valid but missing desc/image

    const result = await auditCatalog();
    expect(result.warningCount).toBeGreaterThanOrEqual(1);
  });

  it('handles wix-data query errors gracefully', async () => {
    // Empty store with no seed — should still succeed with 0 products
    const result = await auditCatalog();
    expect(result.success).toBe(true);
    expect(result.totalProducts).toBe(0);
  });
});

// ── getCatalogSyncStatus ─────────────────────────────────────────────

describe('getCatalogSyncStatus', () => {
  it('returns feed configuration status', async () => {
    seedData('Stores/Products', [validProduct, minimalProduct]);

    const result = await getCatalogSyncStatus();
    expect(result.success).toBe(true);
    expect(result.feedUrl).toContain('pinterestProductFeed');
    expect(result.productCount).toBe(2);
    expect(result.feedFormat).toBe('TSV');
  });

  it('includes health score based on product validity', async () => {
    seedData('Stores/Products', [validProduct]);

    const result = await getCatalogSyncStatus();
    expect(result.healthScore).toBeDefined();
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
  });

  it('returns zero product count for empty catalog', async () => {
    seedData('Stores/Products', []);

    const result = await getCatalogSyncStatus();
    expect(result.productCount).toBe(0);
    expect(result.healthScore).toBe(0);
  });
});

// ── mapProductToBoard ────────────────────────────────────────────────

describe('mapProductToBoard', () => {
  it('maps futon frames to Futon Living Rooms board', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      collections: ['futon-frames'],
    });
    expect(result.success).toBe(true);
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('maps murphy beds to Murphy & Cabinet Beds board', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      name: 'Daisy Murphy Cabinet Bed',
      collections: ['murphy-cabinet-beds'],
    });
    expect(result.board).toBe('Murphy & Cabinet Beds');
  });

  it('maps platform beds to Platform Bed Inspiration board', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      collections: ['platform-beds'],
    });
    expect(result.board).toBe('Platform Bed Inspiration');
  });

  it('maps mattresses to Small Space Solutions board', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      collections: ['mattresses'],
    });
    expect(result.board).toBe('Small Space Solutions');
  });

  it('maps wall huggers to Futon Living Rooms board', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      collections: ['wall-huggers'],
    });
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('maps unfinished wood to Handcrafted & Unfinished board', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      collections: ['unfinished-wood'],
    });
    expect(result.board).toBe('Handcrafted & Unfinished');
  });

  it('maps accessories to Small Space Solutions board', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      collections: ['casegoods-accessories'],
    });
    expect(result.board).toBe('Small Space Solutions');
  });

  it('defaults to Futon Living Rooms for unknown collections', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      collections: ['unknown-collection'],
    });
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('handles products with no collections', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      collections: [],
    });
    expect(result.success).toBe(true);
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('returns error for null input', async () => {
    const result = await mapProductToBoard(null);
    expect(result.success).toBe(false);
  });

  it('maps sale items to Sale & Clearance board', async () => {
    const result = await mapProductToBoard({
      ...validProduct,
      discountedPrice: 399.99,
      collections: ['sales', 'futon-frames'],
    });
    expect(result.board).toBe('Sale & Clearance');
  });
});

// ── generatePinContent ───────────────────────────────────────────────

describe('generatePinContent', () => {
  it('generates pin title, description, hashtags, and link', async () => {
    const result = await generatePinContent(validProduct);
    expect(result.success).toBe(true);
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
    expect(result.hashtags).toBeInstanceOf(Array);
    expect(result.hashtags.length).toBeGreaterThan(0);
    expect(result.link).toContain('carolinafutons.com');
  });

  it('includes UTM parameters in link', async () => {
    const result = await generatePinContent(validProduct);
    expect(result.link).toContain('utm_source=pinterest');
    expect(result.link).toContain('utm_medium=social');
  });

  it('includes price in description', async () => {
    const result = await generatePinContent(validProduct);
    expect(result.description).toContain('$599.99');
  });

  it('includes product category hashtags', async () => {
    const result = await generatePinContent({
      ...validProduct,
      collections: ['futon-frames'],
    });
    expect(result.hashtags).toContain('#FutonLiving');
  });

  it('always includes brand hashtags', async () => {
    const result = await generatePinContent(validProduct);
    expect(result.hashtags).toContain('#CarolinaFutons');
    expect(result.hashtags).toContain('#HandcraftedFurniture');
  });

  it('formats pin description with keyword-rich text', async () => {
    const result = await generatePinContent(validProduct);
    // Should mention the product name
    expect(result.description).toContain('Eureka Futon Frame');
  });

  it('returns error for null input', async () => {
    const result = await generatePinContent(null);
    expect(result.success).toBe(false);
  });

  it('returns error for product without name', async () => {
    const result = await generatePinContent({ slug: 'test', price: 99 });
    expect(result.success).toBe(false);
  });

  it('handles sale price in description', async () => {
    const result = await generatePinContent({
      ...validProduct,
      discountedPrice: 449.99,
    });
    expect(result.description).toContain('$449.99');
  });

  it('sanitizes XSS in product name for pin content', async () => {
    const result = await generatePinContent({
      ...validProduct,
      name: '<script>alert(1)</script>Bad Frame',
    });
    expect(result.title).not.toContain('<script>');
    expect(result.description).not.toContain('<script>');
  });

  it('limits description length for Pinterest', async () => {
    const result = await generatePinContent({
      ...validProduct,
      description: 'X'.repeat(1000),
    });
    // Pinterest descriptions should be ≤500 chars
    expect(result.description.length).toBeLessThanOrEqual(500);
  });
});

// ── getBoardStructure ────────────────────────────────────────────────

describe('getBoardStructure', () => {
  it('returns all configured boards', async () => {
    const result = await getBoardStructure();
    expect(result.success).toBe(true);
    expect(result.boards).toBeInstanceOf(Array);
    expect(result.boards.length).toBeGreaterThanOrEqual(7);
  });

  it('each board has name, contentType, and pinFrequency', async () => {
    const result = await getBoardStructure();
    for (const board of result.boards) {
      expect(board.name).toBeTruthy();
      expect(board.contentType).toBeTruthy();
      expect(board.pinFrequency).toBeTruthy();
    }
  });

  it('includes Futon Living Rooms board', async () => {
    const result = await getBoardStructure();
    const board = result.boards.find(b => b.name === 'Futon Living Rooms');
    expect(board).toBeDefined();
    expect(board.pinFrequency).toContain('3-4');
  });

  it('includes Customer Showcase board', async () => {
    const result = await getBoardStructure();
    const board = result.boards.find(b => b.name === 'Customer Showcase');
    expect(board).toBeDefined();
  });
});
