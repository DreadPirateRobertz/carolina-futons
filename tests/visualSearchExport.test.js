/**
 * @file visualSearchExport.test.js
 * @description CF-juq6: Tests for visual search batch export API.
 *
 * Covers:
 *  - transformProduct maps Wix product to mobile contract format
 *  - buildExportPayload filters hidden products, includes all visible
 *  - getExportData returns cached data when available
 *  - getExportData rate-limits per clientId
 *  - generateExport authenticates with CRON_SECRET
 *  - Image URL deduplication (mainMedia + mediaItems overlap)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── transformProduct ────────────────────────────────────────────────

describe('_transformProduct', () => {
  let _transformProduct;

  beforeEach(async () => {
    ({ _transformProduct } = await import('../src/backend/visualSearchExport.web.js'));
  });

  it('maps Wix product to mobile contract format', () => {
    const product = {
      _id: 'prod-1',
      name: 'Monterey Futon Frame',
      slug: 'monterey',
      sku: 'CF-FRAME-MONTEREY',
      productType: 'futon-frames',
      price: 549,
      mainMedia: 'https://static.wixstatic.com/media/e04e89_abc.jpg',
      mediaItems: [
        { src: 'https://static.wixstatic.com/media/e04e89_def.jpg' },
      ],
    };

    const result = _transformProduct(product);

    expect(result).toMatchObject({
      id: 'prod-1',
      name: 'Monterey Futon Frame',
      slug: 'monterey',
      sku: 'CF-FRAME-MONTEREY',
      category: 'futon-frames',
      price: 549,
    });
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toMatchObject({
      url: 'https://static.wixstatic.com/media/e04e89_abc.jpg',
      width: 2000,
      height: 2000,
    });
  });

  it('deduplicates mainMedia appearing in mediaItems', () => {
    const url = 'https://static.wixstatic.com/media/e04e89_same.jpg';
    const product = {
      _id: 'prod-2',
      name: 'Test',
      mainMedia: url,
      mediaItems: [{ src: url }, { src: 'https://static.wixstatic.com/media/e04e89_other.jpg' }],
    };

    const result = _transformProduct(product);
    expect(result.images).toHaveLength(2); // Deduplicated from 3 to 2
  });

  it('handles product with no images', () => {
    const product = { _id: 'prod-3', name: 'No Image Product' };
    const result = _transformProduct(product);
    expect(result.images).toEqual([]);
  });

  it('handles wix:image:// URIs', () => {
    const product = {
      _id: 'prod-4',
      name: 'Wix URI',
      mainMedia: 'wix:image://v1/e04e89_abc123~mv2.jpg/file.jpg#originWidth=2000&originHeight=2000',
      mediaItems: [],
    };

    const result = _transformProduct(product);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toContain('static.wixstatic.com');
  });
});

// ── buildExportPayload ──────────────────────────────────────────────

describe('_buildExportPayload', () => {
  let _buildExportPayload;

  beforeEach(async () => {
    ({ _buildExportPayload } = await import('../src/backend/visualSearchExport.web.js'));
  });

  it('returns export payload with version and products', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Product A', slug: 'a', price: 100, visible: true, mainMedia: 'https://img.com/a.jpg', mediaItems: [] },
      { _id: 'p2', name: 'Product B', slug: 'b', price: 200, visible: true, mainMedia: 'https://img.com/b.jpg', mediaItems: [] },
    ]);

    const result = await _buildExportPayload();

    expect(result.version).toBe('1.0.0');
    expect(result.totalProducts).toBe(2);
    expect(result.products).toHaveLength(2);
    expect(result.generatedAt).toBeTruthy();
  });

  it('filters out hidden products', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Visible', visible: true, mainMedia: '', mediaItems: [] },
      { _id: 'p2', name: 'Hidden', visible: false, mainMedia: '', mediaItems: [] },
    ]);

    const result = await _buildExportPayload();
    expect(result.totalProducts).toBe(1);
    expect(result.products[0].name).toBe('Visible');
  });
});

// ── getExportData ───────────────────────────────────────────────────

describe('getExportData', () => {
  let getExportData;

  beforeEach(async () => {
    ({ getExportData } = await import('../src/backend/visualSearchExport.web.js'));
  });

  it('returns cached data when available', async () => {
    const cachedPayload = JSON.stringify({
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      totalProducts: 5,
      products: [{ id: 'p1', name: 'Test', images: [] }],
    });

    __seed('VisualSearchExportCache', [{
      _id: 'cache-1',
      key: 'latest',
      payload: cachedPayload,
      generatedAt: new Date(),
      productCount: 5,
    }]);

    const result = await getExportData('mobile-client-1');
    expect(result.success).toBe(true);
    expect(result.data.totalProducts).toBe(5);
    expect(result.staleMinutes).toBeDefined();
  });

  it('rate-limits per clientId', async () => {
    // Seed rate limit at max
    __seed('VisualSearchExportRateLimit', [{
      _id: 'rl-1',
      key: 'flood-client',
      count: 10,
      windowStart: new Date(),
    }]);

    const result = await getExportData('flood-client');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('generates on-demand when no cache exists', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Fresh', visible: true, mainMedia: 'https://img.com/a.jpg', mediaItems: [] },
    ]);

    const result = await getExportData('new-client');
    expect(result.success).toBe(true);
    expect(result.data.totalProducts).toBe(1);
    expect(result.staleMinutes).toBe(0);
  });
});

// ── generateExport ──────────────────────────────────────────────────

describe('generateExport', () => {
  let generateExport;

  beforeEach(async () => {
    ({ generateExport } = await import('../src/backend/visualSearchExport.web.js'));
  });

  it('rejects when cron secret validation fails', async () => {
    const result = await generateExport('wrong-secret');
    expect(result.success).toBe(false);
    // In test env, wix-secrets-backend throws → caught → generic error
    expect(result.error).toBeTruthy();
  });
});
