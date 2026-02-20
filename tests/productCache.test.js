import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheProduct,
  getCachedProduct,
  getRecentlyViewed,
  getCacheSize,
  clearCache,
} from '../src/public/productCache.js';

const PRODUCT_A = {
  _id: 'prod-1',
  name: 'Kodiak Futon Frame',
  slug: 'kodiak-futon-frame',
  price: 599,
  formattedPrice: '$599.00',
  mainMedia: 'https://example.com/kodiak.jpg',
  description: 'Solid hardwood futon frame.',
  collections: ['futon-frames'],
};

const PRODUCT_B = {
  _id: 'prod-2',
  name: 'Murphy Cabinet Bed',
  slug: 'murphy-cabinet-bed',
  price: 1299,
  formattedPrice: '$1,299.00',
  mainMedia: 'https://example.com/murphy.jpg',
  description: 'Space-saving Murphy bed.',
  collections: ['murphy-cabinet-beds'],
};

const PRODUCT_C = {
  _id: 'prod-3',
  name: 'Moonshadow Mattress',
  slug: 'moonshadow-mattress',
  price: 349,
  formattedPrice: '$349.00',
  mainMedia: 'https://example.com/moon.jpg',
  description: 'Premium futon mattress.',
  collections: ['mattresses'],
};

beforeEach(() => {
  clearCache();
});

// ── cacheProduct + getCachedProduct ─────────────────────────────────

describe('cacheProduct / getCachedProduct', () => {
  it('caches and retrieves a product by slug', () => {
    cacheProduct(PRODUCT_A);
    const cached = getCachedProduct('kodiak-futon-frame');
    expect(cached).not.toBeNull();
    expect(cached._id).toBe('prod-1');
    expect(cached.name).toBe('Kodiak Futon Frame');
    expect(cached.price).toBe(599);
  });

  it('returns null for uncached slug', () => {
    expect(getCachedProduct('nonexistent')).toBeNull();
  });

  it('returns null for null/empty slug', () => {
    expect(getCachedProduct(null)).toBeNull();
    expect(getCachedProduct('')).toBeNull();
  });

  it('ignores products without slug', () => {
    cacheProduct({ _id: 'no-slug', name: 'Test' });
    expect(getCacheSize()).toBe(0);
  });

  it('overwrites existing cache entry for same slug', () => {
    cacheProduct(PRODUCT_A);
    cacheProduct({ ...PRODUCT_A, price: 499 });
    const cached = getCachedProduct('kodiak-futon-frame');
    expect(cached.price).toBe(499);
    expect(getCacheSize()).toBe(1);
  });

  it('stores only mapped fields (no extra data leakage)', () => {
    cacheProduct({ ...PRODUCT_A, secretField: 'hidden' });
    const cached = getCachedProduct('kodiak-futon-frame');
    expect(cached.secretField).toBeUndefined();
    expect(cached).toHaveProperty('_id');
    expect(cached).toHaveProperty('name');
    expect(cached).toHaveProperty('slug');
    expect(cached).toHaveProperty('price');
    expect(cached).toHaveProperty('mainMedia');
  });
});

// ── getRecentlyViewed ───────────────────────────────────────────────

describe('getRecentlyViewed', () => {
  it('returns recently viewed products in reverse chronological order', () => {
    cacheProduct(PRODUCT_A);
    cacheProduct(PRODUCT_B);
    cacheProduct(PRODUCT_C);

    const recent = getRecentlyViewed(4);
    expect(recent).toHaveLength(3);
    expect(recent[0].slug).toBe('moonshadow-mattress');
    expect(recent[1].slug).toBe('murphy-cabinet-bed');
    expect(recent[2].slug).toBe('kodiak-futon-frame');
  });

  it('respects limit parameter', () => {
    cacheProduct(PRODUCT_A);
    cacheProduct(PRODUCT_B);
    cacheProduct(PRODUCT_C);

    const recent = getRecentlyViewed(2);
    expect(recent).toHaveLength(2);
  });

  it('returns empty array when no products cached', () => {
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('deduplicates — viewing same product twice moves it to front', () => {
    cacheProduct(PRODUCT_A);
    cacheProduct(PRODUCT_B);
    cacheProduct(PRODUCT_A); // re-view

    const recent = getRecentlyViewed(4);
    expect(recent).toHaveLength(2);
    expect(recent[0].slug).toBe('kodiak-futon-frame');
    expect(recent[1].slug).toBe('murphy-cabinet-bed');
  });
});

// ── LRU eviction ────────────────────────────────────────────────────

describe('LRU eviction', () => {
  it('evicts oldest entries when cache exceeds 20 products', () => {
    // Cache 22 products
    for (let i = 0; i < 22; i++) {
      cacheProduct({ _id: `prod-${i}`, name: `Product ${i}`, slug: `product-${i}`, price: 100 + i });
    }

    expect(getCacheSize()).toBe(20);
    // Oldest (product-0 and product-1) should be evicted
    expect(getCachedProduct('product-0')).toBeNull();
    expect(getCachedProduct('product-1')).toBeNull();
    // Newest should still be present
    expect(getCachedProduct('product-21')).not.toBeNull();
  });
});

// ── clearCache ──────────────────────────────────────────────────────

describe('clearCache', () => {
  it('removes all cached products', () => {
    cacheProduct(PRODUCT_A);
    cacheProduct(PRODUCT_B);
    expect(getCacheSize()).toBe(2);

    clearCache();
    expect(getCacheSize()).toBe(0);
    expect(getCachedProduct('kodiak-futon-frame')).toBeNull();
    expect(getRecentlyViewed()).toEqual([]);
  });
});
