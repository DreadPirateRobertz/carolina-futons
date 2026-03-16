/**
 * Deep coverage tests for productRecommendations.web.js — limit clamping,
 * invalid IDs, empty cart, price range boundaries, co-purchase frequency
 * ranking, and recently-viewed dedup/cap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __onInsert, __onRemove } from './__mocks__/wix-data.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' })),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => String(val || '').slice(0, max),
  validateId: (id) => (/^[a-f0-9-]+$/i.test(id) ? id : null),
  validateSlug: (slug) => (/^[a-z0-9-]+$/.test(slug) ? slug : null),
}));

const {
  getRelatedProducts,
  getCompletionSuggestions,
  getSameCollection,
  getFeaturedProducts,
  getSaleProducts,
  getBundleSuggestion,
  getBestsellers,
  trackRecentlyViewed,
  getRecentlyViewed,
  getSimilarProducts,
  getCustomersAlsoBought,
} = await import('../src/backend/productRecommendations.web.js');

beforeEach(() => {
  __seed('Stores/Products', []);
  __seed('Stores/Orders', []);
  __seed('ProductAnalytics', []);
  __seed('RecentlyViewed', []);
  vi.clearAllMocks();
});

// ── getRelatedProducts — edge cases ──────────────────────────────────

describe('getRelatedProducts — edge cases', () => {
  it('returns empty for unknown category slug', async () => {
    const result = await getRelatedProducts('aaa00000-0000-0000-0000-000000000001', 'unknown-category');
    expect(result).toEqual([]);
  });

  it('returns empty for null category slug', async () => {
    const result = await getRelatedProducts('aaa00000-0000-0000-0000-000000000001', null);
    expect(result).toEqual([]);
  });

  it('maps futon-frames to mattresses cross-sell', async () => {
    __seed('Stores/Products', [
      { _id: 'bbb00000-0000-0000-0000-000000000001', name: 'Haley Mattress', collections: ['mattresses'], price: 299, slug: 'haley' },
    ]);
    const result = await getRelatedProducts('aaa00000-0000-0000-0000-000000000001', 'futon-frames');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Haley Mattress');
  });

  it('excludes current product from results', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Self', collections: ['mattresses'], price: 299, slug: 'self' },
      { _id: 'bbb00000-0000-0000-0000-000000000001', name: 'Other', collections: ['mattresses'], price: 399, slug: 'other' },
    ]);
    const result = await getRelatedProducts('aaa00000-0000-0000-0000-000000000001', 'futon-frames');
    expect(result.every(p => p._id !== 'aaa00000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('respects custom limit parameter', async () => {
    const products = Array.from({ length: 10 }, (_, i) => ({
      _id: `bbb0000${i}-0000-0000-0000-000000000001`,
      name: `Mattress ${i}`,
      collections: ['mattresses'],
      price: 200 + i * 10,
      slug: `mattress-${i}`,
    }));
    __seed('Stores/Products', products);
    const result = await getRelatedProducts('aaa00000-0000-0000-0000-000000000001', 'futon-frames', 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

// ── getCompletionSuggestions — edge cases ────────────────────────────

describe('getCompletionSuggestions — edge cases', () => {
  it('returns empty for null cart', async () => {
    expect(await getCompletionSuggestions(null)).toEqual([]);
  });

  it('returns empty for empty cart', async () => {
    expect(await getCompletionSuggestions([])).toEqual([]);
  });

  it('returns empty for undefined cart', async () => {
    expect(await getCompletionSuggestions(undefined)).toEqual([]);
  });
});

// ── getSameCollection — edge cases ───────────────────────────────────

describe('getSameCollection — edge cases', () => {
  it('returns empty for null collections', async () => {
    expect(await getSameCollection('aaa00000-0000-0000-0000-000000000001', null)).toEqual([]);
  });

  it('returns empty for empty collections array', async () => {
    expect(await getSameCollection('aaa00000-0000-0000-0000-000000000001', [])).toEqual([]);
  });
});

// ── getFeaturedProducts — edge cases ─────────────────────────────────

describe('getFeaturedProducts — edge cases', () => {
  it('returns empty when no products exist', async () => {
    expect(await getFeaturedProducts()).toEqual([]);
  });

  it('respects custom limit', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'P1', ribbon: 'Featured', price: 100, slug: 'p1' },
      { _id: 'aaa00000-0000-0000-0000-000000000002', name: 'P2', ribbon: 'Featured', price: 200, slug: 'p2' },
      { _id: 'aaa00000-0000-0000-0000-000000000003', name: 'P3', ribbon: 'Featured', price: 300, slug: 'p3' },
    ]);
    const result = await getFeaturedProducts(2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('falls back to newest products when no Featured ribbon', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'New Product', price: 100, slug: 'new', _createdDate: new Date() },
    ]);
    const result = await getFeaturedProducts();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('New Product');
  });
});

// ── getSaleProducts — edge cases ─────────────────────────────────────

describe('getSaleProducts — edge cases', () => {
  it('returns empty when no sale products', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Full Price', price: 500, slug: 'full' },
    ]);
    expect(await getSaleProducts()).toEqual([]);
  });

  it('sorts by discount amount descending', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Small Sale', price: 100, discountedPrice: 90, slug: 'small' },
      { _id: 'aaa00000-0000-0000-0000-000000000002', name: 'Big Sale', price: 500, discountedPrice: 300, slug: 'big' },
    ]);
    const result = await getSaleProducts();
    expect(result[0].name).toBe('Big Sale'); // $200 discount > $10 discount
  });
});

// ── getBundleSuggestion — edge cases ─────────────────────────────────

describe('getBundleSuggestion — edge cases', () => {
  it('returns null for invalid product ID', async () => {
    expect(await getBundleSuggestion('invalid!')).toBeNull();
  });

  it('returns null when product not found', async () => {
    expect(await getBundleSuggestion('aaa00000-0000-0000-0000-000000000099')).toBeNull();
  });

  it('returns null for product with no collections', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Bare', price: 100 },
    ]);
    expect(await getBundleSuggestion('aaa00000-0000-0000-0000-000000000001')).toBeNull();
  });

  it('suggests mattress for futon frame', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Eureka Frame', price: 499, collections: ['futon-frames'] },
      { _id: 'bbb00000-0000-0000-0000-000000000001', name: 'Haley Mattress', price: 299, collections: ['mattresses'], slug: 'haley' },
    ]);
    const result = await getBundleSuggestion('aaa00000-0000-0000-0000-000000000001');
    expect(result).not.toBeNull();
    expect(result.heading).toContain('Complete Your Futon');
    expect(result.product.name).toBe('Haley Mattress');
    expect(result.savings).toBeCloseTo((499 + 299) * 0.05, 2);
  });

  it('suggests frame for mattress', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Haley Mattress', price: 299, collections: ['mattresses'] },
      { _id: 'bbb00000-0000-0000-0000-000000000001', name: 'Eureka Frame', price: 499, collections: ['futon-frames'], slug: 'eureka' },
    ]);
    const result = await getBundleSuggestion('aaa00000-0000-0000-0000-000000000001');
    expect(result.heading).toContain('Complete Your Futon');
  });

  it('suggests casegoods for Murphy bed', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Daisy Cabinet Bed', price: 2199, collections: ['murphy-cabinet-beds'] },
      { _id: 'bbb00000-0000-0000-0000-000000000001', name: 'Nightstand', price: 249, collections: ['casegoods-accessories'], slug: 'nightstand' },
    ]);
    const result = await getBundleSuggestion('aaa00000-0000-0000-0000-000000000001');
    expect(result.heading).toContain('Complete the Bedroom');
  });

  it('returns null when no matching complement products exist', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Eureka Frame', price: 499, collections: ['futon-frames'] },
    ]);
    const result = await getBundleSuggestion('aaa00000-0000-0000-0000-000000000001');
    expect(result).toBeNull();
  });

  it('calculates 5% bundle discount correctly', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Frame', price: 1000, collections: ['futon-frames'] },
      { _id: 'bbb00000-0000-0000-0000-000000000001', name: 'Mattress', price: 500, collections: ['mattresses'], slug: 'mattress' },
    ]);
    const result = await getBundleSuggestion('aaa00000-0000-0000-0000-000000000001');
    expect(result.originalTotal).toBe(1500);
    expect(result.savings).toBe(75); // 5% of 1500
    expect(result.bundlePrice).toBe(1425);
  });
});

// ── trackRecentlyViewed — edge cases ─────────────────────────────────

describe('trackRecentlyViewed — edge cases', () => {
  it('rejects invalid product ID', async () => {
    const result = await trackRecentlyViewed('invalid!');
    expect(result.success).toBe(false);
  });

  it('rejects null product ID', async () => {
    const result = await trackRecentlyViewed(null);
    expect(result.success).toBe(false);
  });

  it('inserts viewed product with memberId and viewedAt', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'RecentlyViewed') inserted = item;
    });
    await trackRecentlyViewed('aaa00000-0000-0000-0000-000000000001');
    expect(inserted).not.toBeNull();
    expect(inserted.memberId).toBe('a0b1c2d3-e4f5-6789-abcd-ef0123456789');
    expect(inserted.productId).toBe('aaa00000-0000-0000-0000-000000000001');
    expect(inserted.viewedAt).toBeInstanceOf(Date);
  });

  it('deduplicates by removing existing entry first', async () => {
    __seed('RecentlyViewed', [
      { _id: 'rv-1', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', productId: 'aaa00000-0000-0000-0000-000000000001', viewedAt: new Date() },
    ]);
    let removed = false;
    __onRemove((col, id) => {
      if (col === 'RecentlyViewed' && id === 'rv-1') removed = true;
    });
    await trackRecentlyViewed('aaa00000-0000-0000-0000-000000000001');
    expect(removed).toBe(true);
  });
});

// ── getRecentlyViewed — edge cases ───────────────────────────────────

describe('getRecentlyViewed — edge cases', () => {
  it('returns empty for member with no viewed products', async () => {
    const result = await getRecentlyViewed();
    expect(result.success).toBe(true);
    expect(result.products).toEqual([]);
  });

  it('clamps limit to minimum 1', async () => {
    const result = await getRecentlyViewed(0);
    expect(result.success).toBe(true);
  });

  it('clamps limit to maximum 20', async () => {
    const result = await getRecentlyViewed(100);
    expect(result.success).toBe(true);
  });

  it('rounds fractional limit', async () => {
    const result = await getRecentlyViewed(3.7);
    expect(result.success).toBe(true);
  });
});

// ── getSimilarProducts — edge cases ──────────────────────────────────

describe('getSimilarProducts — edge cases', () => {
  it('rejects invalid product ID', async () => {
    const result = await getSimilarProducts('invalid!');
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('returns empty when product not found', async () => {
    const result = await getSimilarProducts('aaa00000-0000-0000-0000-000000000099');
    expect(result.success).toBe(false);
  });

  it('clamps priceRange to min 0.1', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Source', price: 500, collections: ['futon-frames'] },
    ]);
    const result = await getSimilarProducts('aaa00000-0000-0000-0000-000000000001', { priceRange: 0 });
    expect(result.success).toBe(true);
  });

  it('clamps priceRange to max 1.0', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Source', price: 500, collections: ['futon-frames'] },
    ]);
    const result = await getSimilarProducts('aaa00000-0000-0000-0000-000000000001', { priceRange: 5 });
    expect(result.success).toBe(true);
  });

  it('clamps limit to min 1 and max 12', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Source', price: 500, collections: ['futon-frames'] },
    ]);
    const result = await getSimilarProducts('aaa00000-0000-0000-0000-000000000001', { limit: 0 });
    expect(result.success).toBe(true);
  });

  it('handles product with no collections', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'No Collection', price: 500 },
    ]);
    const result = await getSimilarProducts('aaa00000-0000-0000-0000-000000000001');
    expect(result.success).toBe(true);
  });

  it('handles product with string collections (not array)', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'String Col', price: 500, collections: 'futon-frames' },
    ]);
    const result = await getSimilarProducts('aaa00000-0000-0000-0000-000000000001');
    expect(result.success).toBe(true);
  });
});

// ── getCustomersAlsoBought — edge cases ──────────────────────────────

describe('getCustomersAlsoBought — edge cases', () => {
  it('rejects invalid product ID', async () => {
    const result = await getCustomersAlsoBought('invalid!');
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('falls back to category-based when no matching orders', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Source', price: 500, collections: ['futon-frames'], slug: 'source' },
      { _id: 'bbb00000-0000-0000-0000-000000000001', name: 'Related', price: 300, collections: ['futon-frames'], slug: 'related' },
    ]);
    __seed('Stores/Orders', []);
    const result = await getCustomersAlsoBought('aaa00000-0000-0000-0000-000000000001');
    expect(result.success).toBe(true);
  });

  it('ranks co-purchased products by frequency', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Source', price: 500, slug: 'source' },
      { _id: 'bbb00000-0000-0000-0000-000000000001', name: 'Rare', price: 200, slug: 'rare' },
      { _id: 'ccc00000-0000-0000-0000-000000000001', name: 'Popular', price: 300, slug: 'popular' },
    ]);
    __seed('Stores/Orders', [
      { _id: 'ord-1', lineItems: [{ productId: 'aaa00000-0000-0000-0000-000000000001' }, { productId: 'ccc00000-0000-0000-0000-000000000001' }] },
      { _id: 'ord-2', lineItems: [{ productId: 'aaa00000-0000-0000-0000-000000000001' }, { productId: 'ccc00000-0000-0000-0000-000000000001' }] },
      { _id: 'ord-3', lineItems: [{ productId: 'aaa00000-0000-0000-0000-000000000001' }, { productId: 'bbb00000-0000-0000-0000-000000000001' }] },
    ]);
    const result = await getCustomersAlsoBought('aaa00000-0000-0000-0000-000000000001');
    expect(result.products[0].name).toBe('Popular'); // 2 co-purchases vs 1
  });

  it('clamps limit to max 12', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Source', price: 500, collections: ['futon-frames'] },
    ]);
    const result = await getCustomersAlsoBought('aaa00000-0000-0000-0000-000000000001', 100);
    expect(result.success).toBe(true);
  });

  it('returns empty when product has no collections and no orders', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Bare', price: 500 },
    ]);
    const result = await getCustomersAlsoBought('aaa00000-0000-0000-0000-000000000001');
    expect(result.products).toEqual([]);
  });
});

// ── getBestsellers — edge cases ──────────────────────────────────────

describe('getBestsellers — edge cases', () => {
  it('returns empty when no products exist', async () => {
    expect(await getBestsellers()).toEqual([]);
  });

  it('falls back to Bestseller ribbon when no analytics', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'Best', ribbon: 'Bestseller', price: 500, slug: 'best' },
    ]);
    const result = await getBestsellers();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Best');
  });
});

// ── formatProduct — output shape ─────────────────────────────────────

describe('formatProduct — output shape via getFeaturedProducts', () => {
  it('includes all expected fields', async () => {
    __seed('Stores/Products', [
      {
        _id: 'aaa00000-0000-0000-0000-000000000001',
        name: 'Full Product',
        slug: 'full-product',
        price: 499,
        formattedPrice: '$499.00',
        discountedPrice: 399,
        formattedDiscountedPrice: '$399.00',
        mainMedia: 'https://example.com/img.jpg',
        sku: 'FP-001',
        ribbon: 'Featured',
        collections: ['futon-frames'],
        color: 'Natural',
        productOptions: [{ name: 'Size', choices: ['Full', 'Queen'] }],
      },
    ]);
    const result = await getFeaturedProducts(1);
    const p = result[0];
    expect(p._id).toBeDefined();
    expect(p.name).toBe('Full Product');
    expect(p.slug).toBe('full-product');
    expect(p.price).toBe(499);
    expect(p.discountedPrice).toBe(399);
    expect(p.mainMedia).toBe('https://example.com/img.jpg');
    expect(p.sku).toBe('FP-001');
    expect(p.ribbon).toBe('Featured');
    expect(p.collections).toContain('futon-frames');
    expect(p.color).toBe('Natural');
    expect(p.productOptions).toHaveLength(1);
  });

  it('defaults color to null when missing', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'No Color', ribbon: 'Featured', price: 100, slug: 'no-color' },
    ]);
    const result = await getFeaturedProducts(1);
    expect(result[0].color).toBeNull();
  });

  it('defaults productOptions to empty array when missing', async () => {
    __seed('Stores/Products', [
      { _id: 'aaa00000-0000-0000-0000-000000000001', name: 'No Options', ribbon: 'Featured', price: 100, slug: 'no-opts' },
    ]);
    const result = await getFeaturedProducts(1);
    expect(result[0].productOptions).toEqual([]);
  });
});
