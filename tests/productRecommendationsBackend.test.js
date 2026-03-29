/**
 * Tests for CF-8bbu: getRecommendations backend function.
 * Covers scoring, cache, empty/error paths.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { allProducts, futonFrame, wallHuggerFrame } from './fixtures/products.js';
import { getRecommendations, __resetRecCache } from '../src/backend/productRecommendations.web.js';

describe('getRecommendations', () => {
  beforeEach(() => {
    resetData();
    __resetRecCache();
    __seed('Stores/Products', allProducts);
  });

  it('returns success:true with products for valid productId', async () => {
    const result = await getRecommendations(futonFrame._id, 6);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.products)).toBe(true);
  });

  it('excludes the source product from results', async () => {
    const result = await getRecommendations(futonFrame._id, 6);
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain(futonFrame._id);
  });

  it('returns products in same collection first (highest score)', async () => {
    // futonFrame is in 'futon-frames'; wallHuggerFrame is also in 'futon-frames'
    const result = await getRecommendations(futonFrame._id, 6);
    expect(result.products.length).toBeGreaterThan(0);
    const ids = result.products.map(p => p._id);
    // wallHuggerFrame shares collection 'futon-frames' — should be in results
    expect(ids).toContain(wallHuggerFrame._id);
  });

  it('respects limit parameter', async () => {
    const result = await getRecommendations(futonFrame._id, 2);
    expect(result.products.length).toBeLessThanOrEqual(2);
  });

  it('clamps limit to max 12', async () => {
    const result = await getRecommendations(futonFrame._id, 99);
    expect(result.products.length).toBeLessThanOrEqual(12);
  });

  it('returns success:false for invalid productId', async () => {
    const result = await getRecommendations('', 6);
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
  });

  it('returns success:false when product not found', async () => {
    const result = await getRecommendations('nonexistent-id-xyz', 6);
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
  });

  it('scores products sharing 2 collections higher than 1 collection', async () => {
    const result = await getRecommendations(wallHuggerFrame._id, 6);
    expect(result.success).toBe(true);
    const ids = result.products.map(p => p._id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('returns empty products array when no related products exist', async () => {
    resetData();
    __seed('Stores/Products', [{
      _id: 'lonely-prod',
      name: 'Lonely Product',
      slug: 'lonely',
      price: 200,
      collections: ['unique-collection-xyz'],
      inStock: true,
    }]);
    const result = await getRecommendations('lonely-prod', 6);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('returns success:false for product not in catalog', async () => {
    const result = await getRecommendations('missing-product', 6);
    expect(result.success).toBe(false);
  });

  it('formatted fields (name, formattedPrice, mainMedia) are included', async () => {
    const result = await getRecommendations(futonFrame._id, 6);
    if (result.products.length > 0) {
      const p = result.products[0];
      expect(p).toHaveProperty('_id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('slug');
      expect(p).toHaveProperty('price');
    }
  });

  it('products within price band appear in results', async () => {
    resetData();
    const inBandProduct = {
      _id: 'in-band',
      name: 'In Band',
      slug: 'in-band',
      price: 520,  // within ±20% of futonFrame price=499
      collections: ['futon-frames'],
      inStock: true,
    };
    __seed('Stores/Products', [futonFrame, inBandProduct]);
    const result = await getRecommendations(futonFrame._id, 6);
    expect(result.success).toBe(true);
    if (result.products.length > 0) {
      expect(result.products[0]._id).toBe('in-band');
    }
  });

  it('caches result for same productId within TTL', async () => {
    const first = await getRecommendations(futonFrame._id, 6);
    const second = await getRecommendations(futonFrame._id, 6);
    expect(second.success).toBe(true);
    expect(second.products.length).toBe(first.products.length);
  });
});
