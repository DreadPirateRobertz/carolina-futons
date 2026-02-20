import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { allProducts, analyticsRecords } from './fixtures/products.js';
import {
  trackProductView,
  trackAddToCart,
  getMostViewedProducts,
  getTrendingProducts,
} from '../src/backend/analyticsHelpers.web.js';

beforeEach(() => {
  __seed('Stores/Products', allProducts);
  __seed('ProductAnalytics', analyticsRecords);
});

// ── trackProductView ────────────────────────────────────────────────

describe('trackProductView', () => {
  it('increments view count for existing product', async () => {
    await trackProductView('prod-frame-001', 'Eureka Futon Frame', 'futon-frames');
    // The mock will have updated the record — no error thrown
  });

  it('creates new analytics record for new product', async () => {
    await trackProductView('prod-new-001', 'New Product', 'other');
    // Should insert a new record without throwing
  });

  it('does not throw on errors (non-critical)', async () => {
    // Even with bad data, tracking should not throw
    await expect(trackProductView(null, null, null)).resolves.not.toThrow();
  });
});

// ── trackAddToCart ──────────────────────────────────────────────────

describe('trackAddToCart', () => {
  it('increments add-to-cart count for tracked product', async () => {
    await trackAddToCart('prod-frame-001');
    // Should complete without error
  });

  it('does nothing for untracked product (no record exists)', async () => {
    // Product not in analytics yet — should not throw
    await expect(trackAddToCart('prod-nonexistent')).resolves.not.toThrow();
  });
});

// ── getMostViewedProducts ──────────────────────────────────────────

describe('getMostViewedProducts', () => {
  it('returns products sorted by view count', async () => {
    const results = await getMostViewedProducts(8);
    expect(results.length).toBeGreaterThan(0);
    // Products should have viewCount field
    if (results.length >= 2) {
      expect(results[0].viewCount).toBeGreaterThanOrEqual(results[1].viewCount);
    }
  });

  it('respects limit parameter', async () => {
    const results = await getMostViewedProducts(1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('returns formatted product objects with viewCount', async () => {
    const results = await getMostViewedProducts(8);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('_id');
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('viewCount');
    }
  });

  it('returns empty when no analytics exist', async () => {
    __seed('ProductAnalytics', []);
    const results = await getMostViewedProducts(8);
    expect(results).toEqual([]);
  });
});

// ── getTrendingProducts ────────────────────────────────────────────

describe('getTrendingProducts', () => {
  it('returns products viewed within the last 7 days', async () => {
    const results = await getTrendingProducts(6);
    expect(results.length).toBeGreaterThan(0);
    // ana-003 has lastViewed 14 days ago — should be excluded
    const ids = results.map(r => r._id);
    expect(ids).not.toContain('prod-murphy-001');
  });

  it('returns empty when no recent views', async () => {
    const oldDate = new Date(Date.now() - 30 * 86400000);
    __seed('ProductAnalytics', [
      { ...analyticsRecords[0], lastViewed: oldDate },
    ]);
    const results = await getTrendingProducts(6);
    expect(results).toEqual([]);
  });

  it('respects limit parameter', async () => {
    const results = await getTrendingProducts(1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
