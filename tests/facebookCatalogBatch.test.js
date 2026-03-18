/**
 * facebookCatalogBatch.test.js
 *
 * Coverage for previously-untested functions in facebookCatalog.web.js:
 *   - buildCatalogBatch: partial failures, recovery, malformed products
 *   - validateFeedProduct: required fields, warning conditions
 *   - normalizeImageUrl: wixstatic resize, passthrough, empty input
 *   - getMetaRateLimits: returns rate limit config
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-data', () => ({
  default: { query: () => ({ limit: () => ({ skip: () => ({ find: async () => ({ items: [] }) }) }) }) },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

vi.mock('backend/utils/mediaHelpers', () => ({
  getImageUrl: (src) => {
    if (!src || (typeof src === 'string' && !src.trim())) return null;
    if (typeof src === 'string' && src.startsWith('https://')) return src;
    return `https://cdn.example.com/${src}`;
  },
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/facebookCatalog.web.js');
});

// ── buildCatalogBatch ────────────────────────────────────────────────

describe('buildCatalogBatch', () => {
  const validProduct = {
    _id: 'prod-001',
    name: 'Eureka Futon Frame',
    slug: 'eureka-futon-frame',
    description: 'Solid hardwood frame.',
    price: 499,
    inStock: true,
    mainMedia: 'https://cdn.example.com/eureka.jpg',
    collections: ['futon-frames'],
  };

  it('returns success with empty results for empty array', () => {
    const result = mod.buildCatalogBatch([]);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('returns error for non-array input', () => {
    const result = mod.buildCatalogBatch(null);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Input must be an array');
  });

  it('returns error for object input', () => {
    const result = mod.buildCatalogBatch({ product: validProduct });
    expect(result.success).toBe(false);
  });

  it('processes a single valid product successfully', () => {
    const result = mod.buildCatalogBatch([validProduct]);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(1);
  });

  it('processes multiple valid products', () => {
    const products = [
      validProduct,
      { ...validProduct, _id: 'prod-002', slug: 'big-frame', name: 'Big Frame', price: 699 },
    ];
    const result = mod.buildCatalogBatch(products);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(2);
  });

  it('skips invalid product and continues batch (partial failure recovery)', () => {
    const products = [
      validProduct,
      { _id: 'bad', name: '', slug: '', price: 0 }, // invalid
      { ...validProduct, _id: 'prod-003', slug: 'good-frame-2', name: 'Good Frame 2', price: 299 },
    ];
    const result = mod.buildCatalogBatch(products);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].productId).toBe('bad');
  });

  it('returns success: false when all products fail', () => {
    const products = [
      { name: '', slug: '', price: 0 },
      { name: '', slug: '', price: -1 },
    ];
    const result = mod.buildCatalogBatch(products);
    expect(result.success).toBe(false);
    expect(result.failed).toBe(2);
    expect(result.processed).toBe(0);
  });

  it('handles null product in array without throwing', () => {
    const result = mod.buildCatalogBatch([null]);
    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
    expect(result.errors[0].productId).toBe('unknown');
  });

  it('formats price as "NNN.NN USD" in result', () => {
    const result = mod.buildCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(item.price).toMatch(/^\d+\.\d{2} USD$/);
  });

  it('sets availability to "in stock" for inStock=true', () => {
    const result = mod.buildCatalogBatch([{ ...validProduct, inStock: true }]);
    expect(result.results[0].availability).toBe('in stock');
  });

  it('sets availability to "out of stock" for inStock=false', () => {
    const result = mod.buildCatalogBatch([{ ...validProduct, inStock: false }]);
    expect(result.results[0].availability).toBe('out of stock');
  });

  it('includes product link with carolinafutons.com/product-page', () => {
    const result = mod.buildCatalogBatch([validProduct]);
    expect(result.results[0].link).toContain('carolinafutons.com/product-page/eureka-futon-frame');
  });

  it('strips HTML from product title in result', () => {
    const product = { ...validProduct, name: '<b>Bold Frame</b>' };
    const result = mod.buildCatalogBatch([product]);
    expect(result.results[0].title).not.toContain('<b>');
    expect(result.results[0].title).toContain('Bold Frame');
  });

  it('includes enhanced catalog fields in result', () => {
    const result = mod.buildCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(item.custom_label_0).toBeDefined(); // price bucket
    expect(item.custom_label_1).toBeDefined(); // brand
    expect(item.product_type).toBeDefined();
  });

  it('includes _warnings from validation', () => {
    const productWithWarnings = { ...validProduct, description: '' };
    const result = mod.buildCatalogBatch([productWithWarnings]);
    const item = result.results[0];
    expect(Array.isArray(item._warnings)).toBe(true);
  });

  it('includes total count in result', () => {
    const result = mod.buildCatalogBatch([validProduct]);
    expect(result.total).toBe(1);
  });

  it('error entry includes productId and errors array', () => {
    const result = mod.buildCatalogBatch([{ name: '', slug: '', price: 0 }]);
    expect(result.errors[0]).toHaveProperty('errors');
    expect(Array.isArray(result.errors[0].errors)).toBe(true);
  });
});

// ── validateFeedProduct ──────────────────────────────────────────────

describe('validateFeedProduct', () => {
  const validProduct = {
    _id: 'v1',
    name: 'Good Frame',
    slug: 'good-frame',
    price: 299,
    mainMedia: 'https://cdn.example.com/img.jpg',
    description: 'A solid frame.',
    inStock: true,
  };

  it('validates a complete product with no errors', () => {
    const result = mod.validateFeedProduct(validProduct);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid for null product', () => {
    const result = mod.validateFeedProduct(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('errors on missing _id', () => {
    const result = mod.validateFeedProduct({ ...validProduct, _id: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('_id'))).toBe(true);
  });

  it('errors on empty product name', () => {
    const result = mod.validateFeedProduct({ ...validProduct, name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('title'))).toBe(true);
  });

  it('errors on missing slug', () => {
    const result = mod.validateFeedProduct({ ...validProduct, slug: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('slug'))).toBe(true);
  });

  it('errors on zero price', () => {
    const result = mod.validateFeedProduct({ ...validProduct, price: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('price'))).toBe(true);
  });

  it('errors on negative price', () => {
    const result = mod.validateFeedProduct({ ...validProduct, price: -10 });
    expect(result.valid).toBe(false);
  });

  it('warns on product name exceeding 200 characters', () => {
    const result = mod.validateFeedProduct({ ...validProduct, name: 'X'.repeat(201) });
    expect(result.valid).toBe(true); // only a warning
    expect(result.warnings.some(w => w.includes('200 chars'))).toBe(true);
  });

  it('warns on missing description', () => {
    const result = mod.validateFeedProduct({ ...validProduct, description: '' });
    expect(result.warnings.some(w => w.includes('description'))).toBe(true);
  });

  it('errors on missing product image (required for catalog)', () => {
    const result = mod.validateFeedProduct({ ...validProduct, mainMedia: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('image'))).toBe(true);
  });
});

// ── normalizeImageUrl ────────────────────────────────────────────────

describe('normalizeImageUrl', () => {
  it('returns empty string for null input', () => {
    expect(mod.normalizeImageUrl(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(mod.normalizeImageUrl(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(mod.normalizeImageUrl('')).toBe('');
  });

  it('returns non-wixstatic URL unchanged (passthrough)', () => {
    const url = 'https://cdn.example.com/product.jpg';
    const result = mod.normalizeImageUrl(url);
    expect(result).toBe(url);
  });

  it('applies resize parameters to wixstatic.com URLs', () => {
    const wixUrl = 'https://static.wixstatic.com/media/abc123.jpg';
    const result = mod.normalizeImageUrl(wixUrl);
    expect(result).toContain('v1/fill');
    expect(result).toContain('w_1200');
    expect(result).toContain('h_1200');
  });

  it('respects custom width/height options', () => {
    const wixUrl = 'https://static.wixstatic.com/media/abc123.jpg';
    const result = mod.normalizeImageUrl(wixUrl, { width: 600, height: 600 });
    expect(result).toContain('w_600');
    expect(result).toContain('h_600');
  });
});

// ── getMetaRateLimits ────────────────────────────────────────────────

describe('getMetaRateLimits', () => {
  it('returns rate limit configuration', () => {
    const limits = mod.getMetaRateLimits();
    expect(limits.catalogBatchApi).toBeDefined();
    expect(limits.conversionsApi).toBeDefined();
    expect(limits.audienceApi).toBeDefined();
  });

  it('returns a defensive copy (mutation does not affect module)', () => {
    const limits1 = mod.getMetaRateLimits();
    limits1.catalogBatchApi = 999999;
    const limits2 = mod.getMetaRateLimits();
    expect(limits2.catalogBatchApi).not.toBe(999999);
  });

  it('catalogBatchApi limit is a positive number', () => {
    const limits = mod.getMetaRateLimits();
    expect(typeof limits.catalogBatchApi).toBe('number');
    expect(limits.catalogBatchApi).toBeGreaterThan(0);
  });
});
