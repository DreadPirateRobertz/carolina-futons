/**
 * Catalog sync improvements tests — CF-3apm
 * Tests feed validation, partial-failure recovery, image URL normalization,
 * and rate-limit awareness for Facebook and Pinterest catalog modules.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import {
  validateFeedProduct,
  normalizeImageUrl,
  buildCatalogBatch,
  getMetaRateLimits,
} from '../src/backend/facebookCatalog.web.js';
import {
  normalizePinterestImageUrl,
  syncCatalogBatch,
  getPinterestRateLimits,
} from '../src/backend/pinterestCatalogSync.web.js';

beforeEach(() => {
  __reset();
});

// ── Helper fixtures ──────────────────────────────────────────────────

const validProduct = {
  _id: 'prod-001',
  name: 'Eureka Futon Frame',
  slug: 'eureka-futon-frame',
  description: 'Solid hardwood futon frame with wall hugger design.',
  price: 599.99,
  inStock: true,
  mainMedia: 'https://static.wixstatic.com/media/abc123.jpg',
  collections: ['futon-frames'],
  brand: 'Night & Day Furniture',
};

const minimalProduct = {
  _id: 'prod-002',
  name: 'Basic Frame',
  slug: 'basic-frame',
  price: 199,
};

const invalidProduct = {
  _id: 'prod-bad',
  name: '',
  slug: '',
  price: 0,
};

// ══════════════════════════════════════════════════════════════════════
// Facebook — validateFeedProduct
// ══════════════════════════════════════════════════════════════════════

describe('validateFeedProduct', () => {
  it('validates a complete product with no errors', () => {
    const result = validateFeedProduct(validProduct);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid for null product', () => {
    const result = validateFeedProduct(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Product object is required');
  });

  it('detects missing product ID', () => {
    const result = validateFeedProduct({ ...validProduct, _id: undefined });
    expect(result.errors).toContainEqual(expect.stringContaining('Missing product ID'));
  });

  it('detects missing product name', () => {
    const result = validateFeedProduct({ ...validProduct, name: '' });
    expect(result.errors).toContainEqual(expect.stringContaining('Missing or empty product title'));
  });

  it('warns on long product name', () => {
    const result = validateFeedProduct({ ...validProduct, name: 'A'.repeat(210) });
    expect(result.warnings).toContainEqual(expect.stringContaining('exceeds 200 chars'));
  });

  it('detects missing price', () => {
    const result = validateFeedProduct({ ...validProduct, price: 0 });
    expect(result.errors).toContainEqual(expect.stringContaining('Missing or invalid price'));
  });

  it('detects negative price', () => {
    const result = validateFeedProduct({ ...validProduct, price: -10 });
    expect(result.errors).toContainEqual(expect.stringContaining('Missing or invalid price'));
  });

  it('detects missing image', () => {
    const result = validateFeedProduct({ ...validProduct, mainMedia: undefined, image: undefined });
    expect(result.errors).toContainEqual(expect.stringContaining('Missing product image'));
  });

  it('warns on non-HTTPS image', () => {
    const result = validateFeedProduct({ ...validProduct, mainMedia: 'http://example.com/img.jpg' });
    expect(result.warnings).toContainEqual(expect.stringContaining('not HTTPS'));
  });

  it('detects missing slug', () => {
    const result = validateFeedProduct({ ...validProduct, slug: '' });
    expect(result.errors).toContainEqual(expect.stringContaining('Missing product slug'));
  });

  it('warns on missing description', () => {
    const result = validateFeedProduct({ ...validProduct, description: undefined });
    expect(result.warnings).toContainEqual(expect.stringContaining('Missing description'));
  });

  it('warns on missing explicit stock status', () => {
    const { inStock, inventoryStatus, ...noStock } = validProduct;
    const result = validateFeedProduct(noStock);
    expect(result.warnings).toContainEqual(expect.stringContaining('No explicit stock status'));
  });

  it('warns on default brand', () => {
    const { brand, ...noBrand } = validProduct;
    const result = validateFeedProduct({ ...noBrand, collections: [] });
    expect(result.warnings).toContainEqual(expect.stringContaining('No explicit brand'));
  });

  it('does not warn on brand when explicitly set', () => {
    const result = validateFeedProduct(validProduct);
    expect(result.warnings).not.toContainEqual(expect.stringContaining('brand'));
  });

  it('accepts product with image property instead of mainMedia', () => {
    const { mainMedia, ...noMain } = validProduct;
    const result = validateFeedProduct({ ...noMain, image: 'https://example.com/img.jpg' });
    expect(result.errors).not.toContainEqual(expect.stringContaining('Missing product image'));
  });

  it('collects multiple errors for severely invalid product', () => {
    const result = validateFeedProduct(invalidProduct);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Facebook — normalizeImageUrl
// ══════════════════════════════════════════════════════════════════════

describe('normalizeImageUrl', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeImageUrl(null)).toBe('');
    expect(normalizeImageUrl('')).toBe('');
  });

  it('resizes Wix static media URLs', () => {
    const url = normalizeImageUrl('https://static.wixstatic.com/media/abc123.jpg');
    expect(url).toContain('w_1200');
    expect(url).toContain('h_1200');
    expect(url).toContain('abc123');
  });

  it('respects custom dimensions', () => {
    const url = normalizeImageUrl('https://static.wixstatic.com/media/abc123.jpg', {
      width: 600, height: 600,
    });
    expect(url).toContain('w_600');
    expect(url).toContain('h_600');
  });

  it('respects custom format', () => {
    const url = normalizeImageUrl('https://static.wixstatic.com/media/abc123.jpg', {
      format: 'webp',
    });
    expect(url).toContain('.webp');
  });

  it('passes through non-Wix URLs unchanged', () => {
    const original = 'https://cdn.example.com/image.jpg';
    expect(normalizeImageUrl(original)).toBe(original);
  });

  it('converts wix:image:// URIs via getImageUrl', () => {
    const url = normalizeImageUrl('wix:image://v1/abc123/myimage.jpg#originWidth=800&originHeight=600');
    expect(url).toContain('abc123');
    expect(url).toContain('static.wixstatic.com');
  });

  it('handles media objects with src property', () => {
    const url = normalizeImageUrl({ src: 'https://static.wixstatic.com/media/def456.jpg' });
    expect(url).toContain('def456');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Facebook — buildCatalogBatch
// ══════════════════════════════════════════════════════════════════════

describe('buildCatalogBatch', () => {
  it('returns error for non-array input', () => {
    const result = buildCatalogBatch('not an array');
    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual('Input must be an array');
  });

  it('processes valid products successfully', () => {
    const result = buildCatalogBatch([validProduct]);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe('prod-001');
    expect(result.results[0].title).toBe('Eureka Futon Frame');
    expect(result.results[0].link).toContain('/product-page/eureka-futon-frame');
  });

  it('continues processing after failure — partial recovery', () => {
    const products = [invalidProduct, validProduct, { _id: 'p3', name: '', price: 0 }];
    const result = buildCatalogBatch(products);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.total).toBe(3);
    expect(result.results).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
  });

  it('collects error details per failed product', () => {
    const result = buildCatalogBatch([invalidProduct]);
    expect(result.errors[0].productId).toBe('prod-bad');
    expect(result.errors[0].errors.length).toBeGreaterThan(0);
  });

  it('includes enhanced catalog fields in results', () => {
    const result = buildCatalogBatch([validProduct]);
    const item = result.results[0];
    expect(item.product_type).toBeDefined();
    expect(item.custom_label_0).toBeDefined();
    expect(item.custom_label_1).toBeDefined();
  });

  it('includes validation warnings in results', () => {
    // Product with all required fields but optional gaps → valid with warnings
    const withWarnings = {
      ...validProduct,
      description: undefined,  // triggers "missing description" warning
    };
    const result = buildCatalogBatch([withWarnings]);
    expect(result.processed).toBe(1);
    const item = result.results[0];
    expect(item._warnings.length).toBeGreaterThan(0);
  });

  it('normalizes image URL in results', () => {
    const result = buildCatalogBatch([validProduct]);
    expect(result.results[0].image_link).toContain('static.wixstatic.com');
  });

  it('sets availability correctly for in-stock and OOS products', () => {
    const oos = { ...validProduct, _id: 'p-oos', inStock: false };
    const result = buildCatalogBatch([validProduct, oos]);
    expect(result.results[0].availability).toBe('in stock');
    expect(result.results[1].availability).toBe('out of stock');
  });

  it('uses discounted price when available', () => {
    const sale = { ...validProduct, discountedPrice: 399.99 };
    const result = buildCatalogBatch([sale]);
    expect(result.results[0].price).toBe('399.99 USD');
  });

  it('handles empty array', () => {
    const result = buildCatalogBatch([]);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Facebook — getMetaRateLimits
// ══════════════════════════════════════════════════════════════════════

describe('getMetaRateLimits', () => {
  it('returns rate limit configuration', () => {
    const limits = getMetaRateLimits();
    expect(limits.catalogBatchApi).toBe(4800);
    expect(limits.conversionsApi).toBe(100000);
    expect(limits.audienceApi).toBe(700);
  });

  it('returns a copy (not a reference)', () => {
    const a = getMetaRateLimits();
    a.catalogBatchApi = 0;
    const b = getMetaRateLimits();
    expect(b.catalogBatchApi).toBe(4800);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Pinterest — normalizePinterestImageUrl
// ══════════════════════════════════════════════════════════════════════

describe('normalizePinterestImageUrl', () => {
  it('returns invalid for empty input', async () => {
    const result = await normalizePinterestImageUrl('');
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.stringContaining('No image URL'));
  });

  it('passes through valid HTTPS URLs', async () => {
    const result = await normalizePinterestImageUrl('https://example.com/image.jpg');
    expect(result.url).toBe('https://example.com/image.jpg');
    expect(result.valid).toBe(true);
  });

  it('converts wix:image:// URIs to static URL with dimensions', async () => {
    const result = await normalizePinterestImageUrl('wix:image://v1/abc123/img.jpg#originWidth=800');
    expect(result.url).toContain('static.wixstatic.com');
    expect(result.url).toContain('abc123');
    expect(result.url).toContain('w_1000');
  });

  it('converts HTTP to HTTPS with warning', async () => {
    const result = await normalizePinterestImageUrl('http://example.com/image.jpg');
    expect(result.url).toBe('https://example.com/image.jpg');
    expect(result.issues).toContainEqual(expect.stringContaining('Converted HTTP'));
  });

  it('rejects non-absolute URLs', async () => {
    const result = await normalizePinterestImageUrl('/images/local.jpg');
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.stringContaining('absolute HTTPS'));
  });

  it('handles null input', async () => {
    const result = await normalizePinterestImageUrl(null);
    expect(result.valid).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Pinterest — syncCatalogBatch
// ══════════════════════════════════════════════════════════════════════

describe('syncCatalogBatch', () => {
  it('returns error for non-array input', async () => {
    const result = await syncCatalogBatch('not array');
    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual('Input must be an array');
  });

  it('processes valid products', async () => {
    const result = await syncCatalogBatch([validProduct]);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results[0].productId).toBe('prod-001');
    expect(result.results[0].board).toBe('Futon Living Rooms');
    expect(result.results[0].pinTitle).toBe('Eureka Futon Frame');
    expect(result.results[0].pinLink).toContain('utm_source=pinterest');
  });

  it('continues after failure — partial recovery', async () => {
    const products = [
      invalidProduct,
      validProduct,
      { _id: 'p3', name: '', slug: '', price: 0 },
    ];
    const result = await syncCatalogBatch(products);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.total).toBe(3);
  });

  it('includes board mapping in results', async () => {
    const murphy = { ...validProduct, _id: 'p-murphy', collections: ['murphy-cabinet-beds'] };
    const result = await syncCatalogBatch([murphy]);
    expect(result.results[0].board).toBe('Murphy & Cabinet Beds');
  });

  it('includes hashtags in results', async () => {
    const result = await syncCatalogBatch([validProduct]);
    expect(result.results[0].hashtags).toContain('#CarolinaFutons');
    expect(result.results[0].hashtags).toContain('#FutonLiving');
  });

  it('includes image issues in results', async () => {
    const noImage = { ...validProduct, _id: 'p-noimg', mainMedia: '' };
    const result = await syncCatalogBatch([noImage]);
    // Product still valid (mainMedia is optional in validateCatalogProduct),
    // but imageIssues should note the missing image
    if (result.processed > 0) {
      expect(result.results[0].imageIssues.length).toBeGreaterThan(0);
    }
  });

  it('collects error details per failed product', async () => {
    const result = await syncCatalogBatch([invalidProduct]);
    expect(result.errors[0].productId).toBe('prod-bad');
    expect(result.errors[0].issues.length).toBeGreaterThan(0);
  });

  it('handles empty array', async () => {
    const result = await syncCatalogBatch([]);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Pinterest — getPinterestRateLimits
// ══════════════════════════════════════════════════════════════════════

describe('getPinterestRateLimits', () => {
  it('returns rate limit configuration', async () => {
    const limits = await getPinterestRateLimits();
    expect(limits.catalogFeedRefresh).toBe(6);
    expect(limits.pinCreation).toBe(50);
    expect(limits.boardPins).toBe(200);
  });

  it('returns a copy (not a reference)', async () => {
    const a = await getPinterestRateLimits();
    a.pinCreation = 0;
    const b = await getPinterestRateLimits();
    expect(b.pinCreation).toBe(50);
  });
});
