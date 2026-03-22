/**
 * @file localSeoS4.test.js
 * @description CF-4e8m: Local SEO S4 — city-based product recommendations.
 *
 * Covers:
 *  - getFeaturedProductsForCity: salesRank ordering, limit, preferredCategories filter
 *  - getFeaturedProductsForCity: empty result, CMS error, unknown slug, invalid slug
 *  - getLocalPage: featuredProducts[] includes actual product objects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getFeaturedProductsForCity, getLocalPage } from '../src/backend/localSeoService.web.js';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';

// ── Shared product fixtures ───────────────────────────────────────────────────

const PRODUCTS = [
  { _id: 'p1', name: 'Futon Frame A', price: 399, formattedPrice: '$399.00', mainMedia: 'img1.jpg', slug: 'futon-frame-a', salesRank: 1, categories: ['futon-frames'] },
  { _id: 'p2', name: 'Mattress B',    price: 199, formattedPrice: '$199.00', mainMedia: 'img2.jpg', slug: 'mattress-b',    salesRank: 2, categories: ['mattresses'] },
  { _id: 'p3', name: 'Cover C',       price:  49, formattedPrice: '$49.00',  mainMedia: 'img3.jpg', slug: 'cover-c',       salesRank: 3, categories: ['covers'] },
  { _id: 'p4', name: 'Futon Frame D', price: 499, formattedPrice: '$499.00', mainMedia: 'img4.jpg', slug: 'futon-frame-d', salesRank: 4, categories: ['futon-frames'] },
  { _id: 'p5', name: 'Mattress E',    price: 249, formattedPrice: '$249.00', mainMedia: 'img5.jpg', slug: 'mattress-e',    salesRank: 5, categories: ['mattresses'] },
];

beforeEach(() => {
  __reset();
  __seed('Stores/Products', PRODUCTS);
});

// ── getFeaturedProductsForCity ────────────────────────────────────────────────

describe('getFeaturedProductsForCity — salesRank ordering', () => {
  it('returns products sorted by salesRank ascending (most popular first)', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
    const ranks = result.products.map(p => p.salesRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('returns productId, name, price, formattedPrice, imageUrl, productPageUrl on each product', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    const p = result.products[0];
    expect(p).toHaveProperty('productId');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('price');
    expect(p).toHaveProperty('formattedPrice');
    expect(p).toHaveProperty('imageUrl');
    expect(p).toHaveProperty('productPageUrl');
    expect(p.productPageUrl).toContain('/product-page/');
  });

  it('defaults to limit 4 — returns at most 4 products', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(4);
  });

  it('respects explicit limit parameter', async () => {
    const result = await getFeaturedProductsForCity('asheville-nc', 2);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(2);
  });
});

describe('getFeaturedProductsForCity — preferredCategories filter', () => {
  it('filters by preferredCategories when city config has them', async () => {
    // hendersonville-nc has preferredCategories: ['futon-frames'] in S4 config
    const result = await getFeaturedProductsForCity('hendersonville-nc');
    expect(result.success).toBe(true);
    // All returned products should match the preferred categories
    for (const p of result.products) {
      expect(p.categories.some(c => ['futon-frames'].includes(c))).toBe(true);
    }
  });

  it('returns all categories when city has no preferredCategories', async () => {
    // asheville-nc has no preferredCategories — gets all products by rank
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    const categories = new Set(result.products.flatMap(p => p.categories));
    expect(categories.size).toBeGreaterThan(1); // mixed categories
  });

  it('returns empty products when preferredCategories has no matches', async () => {
    // charlotte-nc preferredCategories: ['accessories'] — not in PRODUCTS
    const result = await getFeaturedProductsForCity('charlotte-nc');
    expect(result.success).toBe(true);
    expect(result.products).toEqual([]);
  });
});

describe('getFeaturedProductsForCity — edge cases', () => {
  it('returns empty products for unknown slug', async () => {
    const result = await getFeaturedProductsForCity('unknown-city');
    expect(result.success).toBe(true);
    expect(result.products).toEqual([]);
  });

  it('returns success:false for invalid slug (empty string)', async () => {
    const result = await getFeaturedProductsForCity('');
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('returns success:false for null slug', async () => {
    const result = await getFeaturedProductsForCity(null);
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('returns empty products when Stores/Products collection is empty', async () => {
    __reset();
    __seed('Stores/Products', []);
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.products).toEqual([]);
  });

  it('returns success:false and error string on CMS query error', async () => {
    __setQueryError('Stores/Products', new Error('Wix DB unavailable'));
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});

// ── getLocalPage — featuredProducts included ──────────────────────────────────

describe('getLocalPage — featuredProducts[] from S4', () => {
  it('includes featuredProducts array in page response', async () => {
    const result = await getLocalPage('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.page).toHaveProperty('featuredProducts');
    expect(Array.isArray(result.page.featuredProducts)).toBe(true);
  });

  it('featuredProducts contains product objects (not category slugs)', async () => {
    const result = await getLocalPage('asheville-nc');
    expect(result.success).toBe(true);
    if (result.page.featuredProducts.length > 0) {
      const p = result.page.featuredProducts[0];
      expect(p).toHaveProperty('productId');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('price');
    }
  });

  it('featuredProducts are ordered by salesRank', async () => {
    const result = await getLocalPage('asheville-nc');
    expect(result.success).toBe(true);
    const prods = result.page.featuredProducts;
    if (prods.length > 1) {
      const ranks = prods.map(p => p.salesRank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('getLocalPage still succeeds when product fetch fails', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const result = await getLocalPage('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.page).toBeTruthy();
    expect(Array.isArray(result.page.featuredProducts)).toBe(true);
  });
});
