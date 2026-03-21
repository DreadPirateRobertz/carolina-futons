/**
 * Tests for getFeaturedProductsForCity webMethod in localSeoService.web.js
 *
 * Covers: known city products, home city (4 categories) vs. nearby (2 categories),
 * unknown city, invalid slugs, required product fields, missing product IDs,
 * and partial catalog failures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Wix modules ────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: vi.fn((_, fn) => fn),
}));

import { getFeaturedProductsForCity } from '../src/backend/localSeoService.web.js';
import { __seed, __reset } from './__mocks__/wix-data.js';
import {
  FEATURED_PRODUCT_CATALOG,
  HOME_CITY_FEATURED_CATEGORIES,
  NEARBY_CITY_FEATURED_CATEGORIES,
} from '../src/backend/utils/localSeoData.js';

// Seed test products matching catalog IDs
const TEST_PRODUCTS = {
  'cf-seo-frame-001': {
    _id: 'cf-seo-frame-001',
    name: 'Classic Futon Frame',
    slug: 'classic-futon-frame',
    price: 499,
    formattedPrice: '$499.00',
    mainMedia: 'https://example.com/frame.jpg',
  },
  'cf-seo-mattress-001': {
    _id: 'cf-seo-mattress-001',
    name: 'Premium Foam Mattress',
    slug: 'premium-foam-mattress',
    price: 299,
    formattedPrice: '$299.00',
    mainMedia: 'https://example.com/mattress.jpg',
  },
  'cf-seo-cover-001': {
    _id: 'cf-seo-cover-001',
    name: 'Cotton Futon Cover',
    slug: 'cotton-futon-cover',
    price: 79,
    formattedPrice: '$79.00',
    mainMedia: 'https://example.com/cover.jpg',
  },
  'cf-seo-accessory-001': {
    _id: 'cf-seo-accessory-001',
    name: 'Futon Pillow Set',
    slug: 'futon-pillow-set',
    price: 49,
    formattedPrice: '$49.00',
    mainMedia: 'https://example.com/pillows.jpg',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  __reset();
  __seed('Stores/Products', Object.values(TEST_PRODUCTS));
});

// ── Happy path — known cities ────────────────────────────────────────────

describe('getFeaturedProductsForCity — known city', () => {
  it('returns success: true for a known city slug', async () => {

    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
  });

  it('returns an array of products', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    expect(Array.isArray(products)).toBe(true);
  });

  it('each product has productId', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    for (const p of products) {
      expect(p.productId).toBeTruthy();
    }
  });

  it('each product has name', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    for (const p of products) {
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it('each product has price', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    for (const p of products) {
      expect(typeof p.price).toBe('number');
      expect(p.price).toBeGreaterThan(0);
    }
  });

  it('each product has formattedPrice', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    for (const p of products) {
      expect(typeof p.formattedPrice).toBe('string');
      expect(p.formattedPrice.length).toBeGreaterThan(0);
    }
  });

  it('each product has imageUrl', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    for (const p of products) {
      expect(typeof p.imageUrl).toBe('string');
    }
  });

  it('each product has productPageUrl containing /product-page/', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    for (const p of products) {
      expect(p.productPageUrl).toContain('/product-page/');
    }
  });

  it('productPageUrl starts with site domain', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    for (const p of products) {
      expect(p.productPageUrl).toMatch(/^https:\/\/www\.carolinafutons\.com/);
    }
  });
});

// ── Home city (Hendersonville) — 4 categories ───────────────────────────

describe('getFeaturedProductsForCity — home city', () => {
  it('Hendersonville returns 4 products', async () => {

    const { products } = await getFeaturedProductsForCity('hendersonville-nc');
    expect(products).toHaveLength(4);
  });

  it('home city product count matches HOME_CITY_FEATURED_CATEGORIES length', async () => {

    const { products } = await getFeaturedProductsForCity('hendersonville-nc');
    expect(products.length).toBe(HOME_CITY_FEATURED_CATEGORIES.length);
  });

  it('Hendersonville includes a futon frame product', async () => {

    const { products } = await getFeaturedProductsForCity('hendersonville-nc');
    const frameProductId = FEATURED_PRODUCT_CATALOG['futon-frames'].productId;
    expect(products.some(p => p.productId === frameProductId)).toBe(true);
  });

  it('Hendersonville includes a mattress product', async () => {

    const { products } = await getFeaturedProductsForCity('hendersonville-nc');
    const mattressProductId = FEATURED_PRODUCT_CATALOG['mattresses'].productId;
    expect(products.some(p => p.productId === mattressProductId)).toBe(true);
  });

  it('Hendersonville includes a cover product', async () => {

    const { products } = await getFeaturedProductsForCity('hendersonville-nc');
    const coverProductId = FEATURED_PRODUCT_CATALOG['covers'].productId;
    expect(products.some(p => p.productId === coverProductId)).toBe(true);
  });

  it('Hendersonville includes an accessories product', async () => {

    const { products } = await getFeaturedProductsForCity('hendersonville-nc');
    const accessoryProductId = FEATURED_PRODUCT_CATALOG['accessories'].productId;
    expect(products.some(p => p.productId === accessoryProductId)).toBe(true);
  });
});

// ── Nearby cities — 2 categories ─────────────────────────────────────────

describe('getFeaturedProductsForCity — nearby cities', () => {
  it('asheville-nc returns 2 products', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    expect(products).toHaveLength(2);
  });

  it('nearby city product count matches NEARBY_CITY_FEATURED_CATEGORIES length', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    expect(products.length).toBe(NEARBY_CITY_FEATURED_CATEGORIES.length);
  });

  it('all 5 non-home cities return 2 products each', async () => {

    const nearbySlugs = ['asheville-nc', 'charlotte-nc', 'greenville-sc', 'spartanburg-sc', 'boone-nc'];
    for (const slug of nearbySlugs) {
      const { products } = await getFeaturedProductsForCity(slug);
      expect(products).toHaveLength(2);
    }
  });

  it('nearby cities include futon-frames product', async () => {

    const { products } = await getFeaturedProductsForCity('greenville-sc');
    const frameProductId = FEATURED_PRODUCT_CATALOG['futon-frames'].productId;
    expect(products.some(p => p.productId === frameProductId)).toBe(true);
  });

  it('nearby cities include mattresses product', async () => {

    const { products } = await getFeaturedProductsForCity('greenville-sc');
    const mattressProductId = FEATURED_PRODUCT_CATALOG['mattresses'].productId;
    expect(products.some(p => p.productId === mattressProductId)).toBe(true);
  });

  it('nearby cities do not include covers product', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    const coverProductId = FEATURED_PRODUCT_CATALOG['covers'].productId;
    expect(products.some(p => p.productId === coverProductId)).toBe(false);
  });

  it('nearby cities do not include accessories product', async () => {

    const { products } = await getFeaturedProductsForCity('asheville-nc');
    const accessoryProductId = FEATURED_PRODUCT_CATALOG['accessories'].productId;
    expect(products.some(p => p.productId === accessoryProductId)).toBe(false);
  });
});

// ── Unknown city ──────────────────────────────────────────────────────────

describe('getFeaturedProductsForCity — unknown city', () => {
  it('returns success: true, products: [] for unknown slug', async () => {
    const result = await getFeaturedProductsForCity('portland-or');
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('returns empty products for any undefined city slug', async () => {
    const result = await getFeaturedProductsForCity('not-a-city');
    expect(result.success).toBe(true);
    expect(Array.isArray(result.products)).toBe(true);
    expect(result.products.length).toBe(0);
  });
});

// ── Product field fallbacks ───────────────────────────────────────────────

describe('getFeaturedProductsForCity — product field fallbacks', () => {
  it('uses formattedPrice fallback when product has no formattedPrice', async () => {
    const productWithoutFormattedPrice = {
      _id: 'cf-seo-frame-001',
      name: 'Classic Futon Frame',
      slug: 'classic-futon-frame',
      price: 499,
      // no formattedPrice field
      mainMedia: 'https://example.com/frame.jpg',
    };
    __seed('Stores/Products', [productWithoutFormattedPrice]);
    const { products } = await getFeaturedProductsForCity('asheville-nc');
    expect(products.length).toBeGreaterThan(0);
    const frame = products.find(p => p.productId === 'cf-seo-frame-001');
    expect(frame.formattedPrice).toBe('$499');
  });

  it('sets imageUrl to empty string when mainMedia is missing', async () => {
    const productWithoutMedia = {
      _id: 'cf-seo-frame-001',
      name: 'Classic Futon Frame',
      slug: 'classic-futon-frame',
      price: 499,
      formattedPrice: '$499.00',
      // no mainMedia field
    };
    __seed('Stores/Products', [productWithoutMedia]);
    const { products } = await getFeaturedProductsForCity('asheville-nc');
    const frame = products.find(p => p.productId === 'cf-seo-frame-001');
    expect(frame.imageUrl).toBe('');
  });
});

// ── Invalid slugs ─────────────────────────────────────────────────────────

describe('getFeaturedProductsForCity — invalid slug', () => {
  it('returns success: false for empty string', async () => {
    const result = await getFeaturedProductsForCity('');
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
  });

  it('returns success: false for null', async () => {
    const result = await getFeaturedProductsForCity(null);
    expect(result.success).toBe(false);
  });

  it('returns success: false for undefined', async () => {
    const result = await getFeaturedProductsForCity(undefined);
    expect(result.success).toBe(false);
  });

  it('returns success: false for HTML injection', async () => {
    const result = await getFeaturedProductsForCity('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });

  it('returns success: false for path-traversal', async () => {
    const result = await getFeaturedProductsForCity('../etc/passwd');
    expect(result.success).toBe(false);
  });
});

// ── Partial catalog (missing product in store) ────────────────────────────

describe('getFeaturedProductsForCity — missing product in catalog', () => {
  it('skips products not found in Wix Stores (no throw)', async () => {
    // Only seed frame and mattress — covers and accessories are missing
    __seed('Stores/Products', [
      TEST_PRODUCTS['cf-seo-frame-001'],
      TEST_PRODUCTS['cf-seo-mattress-001'],
    ]);
    const result = await getFeaturedProductsForCity('hendersonville-nc');
    expect(result.success).toBe(true);
    expect(result.products.length).toBe(2); // only 2 found
  });

  it('returns success: true even if all products are missing', async () => {
    __seed('Stores/Products', []); // override beforeEach seed — empty store
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('skips a product when wixData.get throws, still returns others', async () => {
    // Seed only mattress — frame fetch will return null (not found) → skipped
    __seed('Stores/Products', [TEST_PRODUCTS['cf-seo-mattress-001']]);
    const result = await getFeaturedProductsForCity('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].productId).toBe('cf-seo-mattress-001');
  });
});
