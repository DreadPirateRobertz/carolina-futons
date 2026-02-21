import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('returns null for undefined slug', () => {
    expect(getCachedProduct(undefined)).toBeNull();
  });

  it('ignores products without slug', () => {
    cacheProduct({ _id: 'no-slug', name: 'Test' });
    expect(getCacheSize()).toBe(0);
  });

  it('ignores null product', () => {
    cacheProduct(null);
    expect(getCacheSize()).toBe(0);
  });

  it('ignores undefined product', () => {
    cacheProduct(undefined);
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
    cacheProduct({ ...PRODUCT_A, secretField: 'hidden', internalNote: 'private' });
    const cached = getCachedProduct('kodiak-futon-frame');
    expect(cached.secretField).toBeUndefined();
    expect(cached.internalNote).toBeUndefined();
    expect(cached).toHaveProperty('_id');
    expect(cached).toHaveProperty('name');
    expect(cached).toHaveProperty('slug');
    expect(cached).toHaveProperty('price');
    expect(cached).toHaveProperty('mainMedia');
  });

  it('stores description and collections', () => {
    cacheProduct(PRODUCT_A);
    const cached = getCachedProduct('kodiak-futon-frame');
    expect(cached.description).toBe('Solid hardwood futon frame.');
    expect(cached.collections).toEqual(['futon-frames']);
  });

  it('stores formattedPrice', () => {
    cacheProduct(PRODUCT_B);
    const cached = getCachedProduct('murphy-cabinet-bed');
    expect(cached.formattedPrice).toBe('$1,299.00');
  });

  it('can cache multiple products independently', () => {
    cacheProduct(PRODUCT_A);
    cacheProduct(PRODUCT_B);
    cacheProduct(PRODUCT_C);

    expect(getCacheSize()).toBe(3);
    expect(getCachedProduct('kodiak-futon-frame')._id).toBe('prod-1');
    expect(getCachedProduct('murphy-cabinet-bed')._id).toBe('prod-2');
    expect(getCachedProduct('moonshadow-mattress')._id).toBe('prod-3');
  });
});

// ── TTL expiration ─────────────────────────────────────────────────

describe('TTL expiration', () => {
  it('returns null for expired cache entries (>24h)', () => {
    cacheProduct(PRODUCT_A);

    // Advance time past 24h TTL
    const twentyFiveHours = 25 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + twentyFiveHours);

    expect(getCachedProduct('kodiak-futon-frame')).toBeNull();
    vi.restoreAllMocks();
  });

  it('returns product within TTL window', () => {
    cacheProduct(PRODUCT_A);

    // 23 hours — still within 24h TTL
    const twentyThreeHours = 23 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + twentyThreeHours);

    const cached = getCachedProduct('kodiak-futon-frame');
    expect(cached).not.toBeNull();
    expect(cached._id).toBe('prod-1');
    vi.restoreAllMocks();
  });

  it('filters expired products from recentlyViewed', () => {
    cacheProduct(PRODUCT_A);
    cacheProduct(PRODUCT_B);

    // Advance past TTL
    const twentyFiveHours = 25 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + twentyFiveHours);

    const recent = getRecentlyViewed(4);
    expect(recent).toEqual([]);
    vi.restoreAllMocks();
  });

  it('cleans up expired entry from cache on access', () => {
    cacheProduct(PRODUCT_A);
    cacheProduct(PRODUCT_B);

    const twentyFiveHours = 25 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + twentyFiveHours);

    // Access expired entry triggers removal
    getCachedProduct('kodiak-futon-frame');
    vi.restoreAllMocks();

    // Re-cache after expiration to confirm cache still works
    cacheProduct(PRODUCT_C);
    expect(getCachedProduct('moonshadow-mattress')).not.toBeNull();
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

  it('uses default limit of 4', () => {
    for (let i = 0; i < 6; i++) {
      cacheProduct({ _id: `p-${i}`, name: `Product ${i}`, slug: `product-${i}`, price: i * 100 });
    }
    const recent = getRecentlyViewed();
    expect(recent).toHaveLength(4);
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

  it('returns products with correct data fields', () => {
    cacheProduct(PRODUCT_A);
    const recent = getRecentlyViewed(1);
    expect(recent[0]).toHaveProperty('_id');
    expect(recent[0]).toHaveProperty('name');
    expect(recent[0]).toHaveProperty('slug');
    expect(recent[0]).toHaveProperty('price');
    expect(recent[0]).toHaveProperty('mainMedia');
  });
});

// ── LRU eviction ────────────────────────────────────────────────────

describe('LRU eviction', () => {
  it('evicts oldest entries when cache exceeds 20 products', () => {
    for (let i = 0; i < 22; i++) {
      cacheProduct({ _id: `prod-${i}`, name: `Product ${i}`, slug: `product-${i}`, price: 100 + i });
    }

    expect(getCacheSize()).toBe(20);
    expect(getCachedProduct('product-0')).toBeNull();
    expect(getCachedProduct('product-1')).toBeNull();
    expect(getCachedProduct('product-21')).not.toBeNull();
  });

  it('keeps exactly MAX_PRODUCTS (20) items', () => {
    for (let i = 0; i < 25; i++) {
      cacheProduct({ _id: `p-${i}`, name: `P ${i}`, slug: `p-${i}`, price: i });
    }
    expect(getCacheSize()).toBe(20);
  });

  it('preserves most recent entries during eviction', () => {
    for (let i = 0; i < 22; i++) {
      cacheProduct({ _id: `p-${i}`, name: `P ${i}`, slug: `p-${i}`, price: i });
    }
    // Most recent 20 should be kept (p-2 through p-21)
    expect(getCachedProduct('p-2')).not.toBeNull();
    expect(getCachedProduct('p-21')).not.toBeNull();
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

  it('can cache products again after clearing', () => {
    cacheProduct(PRODUCT_A);
    clearCache();
    cacheProduct(PRODUCT_B);

    expect(getCacheSize()).toBe(1);
    expect(getCachedProduct('murphy-cabinet-bed')).not.toBeNull();
  });
});

// ── getCacheSize ──────────────────────────────────────────────────

describe('getCacheSize', () => {
  it('returns 0 for empty cache', () => {
    expect(getCacheSize()).toBe(0);
  });

  it('reflects number of cached products', () => {
    cacheProduct(PRODUCT_A);
    expect(getCacheSize()).toBe(1);
    cacheProduct(PRODUCT_B);
    expect(getCacheSize()).toBe(2);
  });
});
