/**
 * pinterestSyncBatch.test.js
 *
 * Coverage for previously-untested functions in pinterestCatalogSync.web.js:
 *   - syncCatalogBatch: batch recovery, partial failures, result structure
 *   - normalizePinterestImageUrl: wix URI conversion, HTTP→HTTPS, validation
 *   - getPinterestRateLimits: returns rate limit config
 *   - mapProductToBoard: edge cases with mixed collections
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-data', () => ({
  default: {
    query: () => ({
      limit: () => ({ skip: () => ({ find: async () => ({ items: [] }) }) }),
    }),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/pinterestCatalogSync.web.js');
});

// ── syncCatalogBatch ─────────────────────────────────────────────────

describe('syncCatalogBatch', () => {
  const validProduct = {
    _id: 'prod-001',
    name: 'Eureka Futon Frame',
    slug: 'eureka-futon-frame',
    description: 'Solid hardwood futon frame.',
    price: 599,
    inStock: true,
    mainMedia: 'https://cdn.example.com/eureka.jpg',
    collections: ['futon-frames'],
  };

  it('returns success with 0 processed for empty array', async () => {
    const result = await mod.syncCatalogBatch([]);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('returns error for non-array input', async () => {
    const result = await mod.syncCatalogBatch(null);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Input must be an array');
  });

  it('processes a single valid product', async () => {
    const result = await mod.syncCatalogBatch([validProduct]);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(1);
  });

  it('processes multiple valid products', async () => {
    const products = [
      validProduct,
      { ...validProduct, _id: 'prod-002', slug: 'murphy-bed', name: 'Murphy Cabinet Bed', collections: ['murphy-cabinet-beds'] },
    ];
    const result = await mod.syncCatalogBatch(products);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('skips invalid product and continues (partial failure recovery)', async () => {
    const products = [
      validProduct,
      { name: '', slug: '', price: 0 }, // invalid — missing required fields
      { ...validProduct, _id: 'prod-003', slug: 'platform-bed', name: 'Platform Bed', collections: ['platform-beds'] },
    ];
    const result = await mod.syncCatalogBatch(products);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.success).toBe(true);
  });

  it('returns success: false when all products fail validation', async () => {
    const products = [
      { name: '', slug: '', price: 0 },
      { name: '', slug: '', price: -1 },
    ];
    const result = await mod.syncCatalogBatch(products);
    expect(result.success).toBe(false);
    expect(result.failed).toBe(2);
    expect(result.processed).toBe(0);
  });

  it('result entry includes board mapping', async () => {
    const result = await mod.syncCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(item.board).toBe('Futon Living Rooms');
  });

  it('result entry includes pin title from product name', async () => {
    const result = await mod.syncCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(item.pinTitle).toBe('Eureka Futon Frame');
  });

  it('result entry includes UTM-tagged link', async () => {
    const result = await mod.syncCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(item.pinLink).toContain('utm_source=pinterest');
    expect(item.pinLink).toContain('eureka-futon-frame');
  });

  it('result entry includes hashtags array', async () => {
    const result = await mod.syncCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(Array.isArray(item.hashtags)).toBe(true);
    expect(item.hashtags.length).toBeGreaterThan(0);
    expect(item.hashtags).toContain('#CarolinaFutons');
  });

  it('result entry includes imageUrl', async () => {
    const result = await mod.syncCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(item.imageUrl).toBeTruthy();
  });

  it('result entry includes warnings array', async () => {
    const result = await mod.syncCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(Array.isArray(item.warnings)).toBe(true);
  });

  it('error entry includes productId and issues', async () => {
    const result = await mod.syncCatalogBatch([{ name: '', slug: '', price: 0 }]);
    const err = result.errors[0];
    expect(err.productId).toBe('unknown');
    expect(Array.isArray(err.issues)).toBe(true);
  });

  it('handles null product in array without throwing', async () => {
    const result = await mod.syncCatalogBatch([null]);
    expect(result.failed).toBe(1);
    expect(result.errors[0].productId).toBe('unknown');
  });

  it('maps murphy bed product to Murphy & Cabinet Beds board', async () => {
    const product = { ...validProduct, _id: 'p2', slug: 'murphy-bed', name: 'Murphy Cabinet Bed', collections: ['murphy-cabinet-beds'] };
    const result = await mod.syncCatalogBatch([product]);
    expect(result.results[0].board).toBe('Murphy & Cabinet Beds');
  });

  it('includes total in result', async () => {
    const result = await mod.syncCatalogBatch([validProduct]);
    expect(result.total).toBe(1);
  });
});

// ── normalizePinterestImageUrl ───────────────────────────────────────

describe('normalizePinterestImageUrl', () => {
  it('returns invalid for null input', async () => {
    const result = await mod.normalizePinterestImageUrl(null);
    expect(result.valid).toBe(false);
    expect(result.url).toBe('');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('returns invalid for empty string', async () => {
    const result = await mod.normalizePinterestImageUrl('');
    expect(result.valid).toBe(false);
  });

  it('accepts valid HTTPS URL', async () => {
    const result = await mod.normalizePinterestImageUrl('https://cdn.example.com/img.jpg');
    expect(result.valid).toBe(true);
    expect(result.url).toBe('https://cdn.example.com/img.jpg');
    expect(result.issues).toHaveLength(0);
  });

  it('converts HTTP to HTTPS and returns valid with warning issue', async () => {
    const result = await mod.normalizePinterestImageUrl('http://example.com/img.jpg');
    expect(result.valid).toBe(true);
    expect(result.url).toContain('https://');
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toContain('HTTPS');
  });

  it('returns invalid for non-absolute URL', async () => {
    const result = await mod.normalizePinterestImageUrl('/relative/path.jpg');
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('absolute'))).toBe(true);
  });

  it('converts wix:image:// URI to HTTPS static URL', async () => {
    const wixUri = 'wix:image://v1/abc123def456.jpg/image.jpg#originWidth=1200&originHeight=800';
    const result = await mod.normalizePinterestImageUrl(wixUri);
    expect(result.valid).toBe(true);
    expect(result.url).toContain('https://');
    expect(result.url).toContain('static.wixstatic.com');
  });

  it('HTTPS URL has no issues array entries', async () => {
    const result = await mod.normalizePinterestImageUrl('https://cdn.example.com/product.jpg');
    expect(result.issues).toHaveLength(0);
  });
});

// ── getPinterestRateLimits ───────────────────────────────────────────

describe('getPinterestRateLimits', () => {
  it('returns rate limit configuration object', async () => {
    const limits = await mod.getPinterestRateLimits();
    expect(limits.catalogFeedRefresh).toBeDefined();
    expect(limits.pinCreation).toBeDefined();
    expect(limits.boardPins).toBeDefined();
  });

  it('catalogFeedRefresh is 6 (once per 4 hours)', async () => {
    const limits = await mod.getPinterestRateLimits();
    expect(limits.catalogFeedRefresh).toBe(6);
  });

  it('pinCreation is a positive number', async () => {
    const limits = await mod.getPinterestRateLimits();
    expect(typeof limits.pinCreation).toBe('number');
    expect(limits.pinCreation).toBeGreaterThan(0);
  });
});

// ── mapProductToBoard — edge cases ───────────────────────────────────

describe('mapProductToBoard — edge cases', () => {
  it('maps "clearance" collection to Sale & Clearance when discountedPrice present', async () => {
    const result = await mod.mapProductToBoard({
      collections: ['clearance'],
      discountedPrice: 199,
    });
    expect(result.board).toBe('Sale & Clearance');
  });

  it('does not map to Sale & Clearance when no discountedPrice even if in sales collection', async () => {
    // Without discountedPrice, the sale rule needs both discountedPrice and collection
    const result = await mod.mapProductToBoard({
      collections: ['sales'],
      discountedPrice: undefined,
    });
    // Falls through to default (not Sale & Clearance)
    expect(result.board).not.toBe('Sale & Clearance');
  });

  it('maps product with both murphy and mattress collections to Murphy first (rule order)', async () => {
    const result = await mod.mapProductToBoard({
      collections: ['murphy-cabinet-beds', 'mattresses'],
    });
    expect(result.board).toBe('Murphy & Cabinet Beds');
  });

  it('handles collection IDs as objects with id property', async () => {
    const result = await mod.mapProductToBoard({
      collections: [{ id: 'platform-beds' }],
    });
    expect(result.board).toBe('Platform Bed Inspiration');
  });

  it('handles empty collections array — defaults to Futon Living Rooms', async () => {
    const result = await mod.mapProductToBoard({ collections: [] });
    expect(result.success).toBe(true);
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('returns error for undefined product', async () => {
    const result = await mod.mapProductToBoard(undefined);
    expect(result.success).toBe(false);
  });
});
