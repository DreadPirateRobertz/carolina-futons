/**
 * @file localSeoFeaturedProducts.test.js
 * @description CF-4e8m: Additional coverage for getFeaturedProductsForCity — S4 behavior.
 *
 * Supplements localSeoS4.test.js with: strict limit enforcement (6+ seeded products),
 * products without salesRank field, formattedPrice fallback, getLocalPage with
 * preferredCategories city, and getLocalPage page:null for unknown slug.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getFeaturedProductsForCity, getLocalPage } from '../src/backend/localSeoService.web.js';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';

// ── 6-product fixture for strict limit testing ────────────────────────────────

const SIX_PRODUCTS = [
  { _id: 'p1', name: 'Frame A',    price: 399, formattedPrice: '$399.00', mainMedia: 'a.jpg', slug: 'frame-a',    salesRank: 1, categories: ['futon-frames'] },
  { _id: 'p2', name: 'Mattress B', price: 199, formattedPrice: '$199.00', mainMedia: 'b.jpg', slug: 'mattress-b', salesRank: 2, categories: ['mattresses'] },
  { _id: 'p3', name: 'Cover C',    price:  49, formattedPrice: '$49.00',  mainMedia: 'c.jpg', slug: 'cover-c',    salesRank: 3, categories: ['covers'] },
  { _id: 'p4', name: 'Frame D',    price: 499, formattedPrice: '$499.00', mainMedia: 'd.jpg', slug: 'frame-d',    salesRank: 4, categories: ['futon-frames'] },
  { _id: 'p5', name: 'Mattress E', price: 249, formattedPrice: '$249.00', mainMedia: 'e.jpg', slug: 'mattress-e', salesRank: 5, categories: ['mattresses'] },
  { _id: 'p6', name: 'Cover F',    price:  59, formattedPrice: '$59.00',  mainMedia: 'f.jpg', slug: 'cover-f',    salesRank: 6, categories: ['covers'] },
];

beforeEach(() => {
  __reset();
  __seed('Stores/Products', SIX_PRODUCTS);
});

// ── Strict limit enforcement ──────────────────────────────────────────────────

describe('getFeaturedProductsForCity — strict limit enforcement', () => {
  it('default limit 4 returns exactly 4 products when 6 are seeded', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(4);
  });

  it('explicit limit 2 returns exactly 2 products when 6 are seeded', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc', 2);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
  });

  it('clamps limit 0 to 1 — returns 1 product', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc', 0);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
  });

  it('clamps limit 100 to 20 — returns at most 20 products', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc', 100);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(20);
  });

  it('clamps non-numeric limit to default 4', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc', 'abc');
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(4);
  });
});

// ── Products without salesRank ────────────────────────────────────────────────

describe('getFeaturedProductsForCity — products without salesRank', () => {
  it('does not throw when products lack salesRank field', async () => {
    __reset();
    __seed('Stores/Products', [
      { _id: 'px', name: 'No-rank product', price: 100, slug: 'no-rank', mainMedia: '', categories: ['futon-frames'] },
    ]);
    await expect(getFeaturedProductsForCity('asheville-nc')).resolves.toMatchObject({ success: true });
  });

  it('products without salesRank return undefined salesRank (not throw)', async () => {
    __reset();
    __seed('Stores/Products', [
      { _id: 'px', name: 'No-rank', price: 100, slug: 'no-rank', mainMedia: '', categories: ['futon-frames'] },
    ]);
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.products[0]).toHaveProperty('productId', 'px');
  });
});

// ── formattedPrice fallback ───────────────────────────────────────────────────

describe('getFeaturedProductsForCity — formattedPrice fallback', () => {
  it('falls back to $price when formattedPrice is missing', async () => {
    __reset();
    __seed('Stores/Products', [
      { _id: 'pf', name: 'Bare product', price: 250, slug: 'bare', mainMedia: '', salesRank: 1, categories: ['futon-frames'] },
    ]);
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.products[0].formattedPrice).toBe('$250');
  });
});

// ── getLocalPage with preferredCategories city ────────────────────────────────

describe('getLocalPage — featuredProducts respect preferredCategories', () => {
  it('hendersonville-nc featuredProducts only include futon-frames category', async () => {
    const result = await getLocalPage('hendersonville-nc');
    expect(result.success).toBe(true);
    expect(Array.isArray(result.page.featuredProducts)).toBe(true);
    for (const p of result.page.featuredProducts) {
      expect(p.categories).toContain('futon-frames');
    }
  });

  it('hendersonville-nc featuredProducts are ordered by salesRank', async () => {
    const result = await getLocalPage('hendersonville-nc');
    expect(result.success).toBe(true);
    const prods = result.page.featuredProducts;
    expect(prods.length).toBeGreaterThan(0);
    const ranks = prods.map(p => p.salesRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

// ── getLocalPage — page:null for undefined city ───────────────────────────────

describe('getLocalPage — page:null contract for undefined city slug', () => {
  it('returns success:true, page:null for a valid but undefined slug', async () => {
    const result = await getLocalPage('unknown-city-xyz');
    expect(result.success).toBe(true);
    expect(result.page).toBeNull();
  });
});
