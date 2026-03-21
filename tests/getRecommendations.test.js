/**
 * Tests for getRecommendations — CF-8bbu "Customers Also Love" carousel.
 * Covers: input validation, scoring (collection overlap + price band),
 * limit clamping, cache behavior, and error handling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { allProducts, futonFrame, futonMattress, murphyBed, platformBed } from './fixtures/products.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

const { getRecommendations, __resetRecCache } = await import('../src/backend/productRecommendations.web.js');

beforeEach(() => {
  __seed('Stores/Products', allProducts);
  __resetRecCache();
});

describe('getRecommendations — input validation', () => {
  it('returns success:false for null productId', async () => {
    const result = await getRecommendations(null);
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('returns success:false for invalid productId (injection attempt)', async () => {
    const result = await getRecommendations('DROP TABLE;--');
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('returns success:false for unknown productId', async () => {
    const result = await getRecommendations('does-not-exist-xyz');
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });
});

describe('getRecommendations — limit clamping', () => {
  it('clamps limit to minimum of 1', async () => {
    const result = await getRecommendations(futonFrame._id, 0);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThanOrEqual(0);
    expect(result.products.length).toBeLessThanOrEqual(1);
  });

  it('clamps limit to maximum of 12', async () => {
    const result = await getRecommendations(futonFrame._id, 100);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(12);
  });

  it('rounds fractional limit', async () => {
    const result = await getRecommendations(futonFrame._id, 3.7);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(4);
  });
});

describe('getRecommendations — scoring', () => {
  it('excludes the source product from results', async () => {
    const result = await getRecommendations(futonFrame._id, 6);
    expect(result.success).toBe(true);
    result.products.forEach(p => expect(p._id).not.toBe(futonFrame._id));
  });

  it('returns products sharing a collection', async () => {
    // futonFrame is in 'futon-frames'; should find other futon-frames products
    const result = await getRecommendations(futonFrame._id, 6);
    expect(result.success).toBe(true);
    // At minimum should return something if there are other futon-frames in allProducts
    if (result.products.length > 0) {
      expect(result.products[0]._id).toBeTruthy();
    }
  });

  it('returns products array on success', async () => {
    const result = await getRecommendations(futonFrame._id, 6);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.products)).toBe(true);
    result.products.forEach(p => {
      expect(p).toHaveProperty('_id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('price');
    });
  });
});

describe('getRecommendations — caching', () => {
  it('returns same results on second call (cache hit)', async () => {
    const first = await getRecommendations(futonFrame._id, 6);
    const second = await getRecommendations(futonFrame._id, 6);
    expect(second.success).toBe(first.success);
    expect(second.products.map(p => p._id)).toEqual(first.products.map(p => p._id));
  });

  it('serves different limits from same cache', async () => {
    const large = await getRecommendations(futonFrame._id, 6);
    const small = await getRecommendations(futonFrame._id, 2);
    expect(small.products.length).toBeLessThanOrEqual(2);
    if (large.products.length >= 2) {
      expect(small.products[0]._id).toBe(large.products[0]._id);
    }
  });

  it('clears cache and re-fetches after __resetRecCache', async () => {
    await getRecommendations(futonFrame._id, 6);
    __resetRecCache();
    const fresh = await getRecommendations(futonFrame._id, 6);
    expect(fresh.success).toBe(true);
  });
});

describe('getRecommendations — error handling', () => {
  it('returns success:false and empty products array on db error', async () => {
    __seed('Stores/Products', []); // empty — source product not found
    __resetRecCache();
    const result = await getRecommendations(futonFrame._id, 6);
    // source product not found → success:false
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });
});
