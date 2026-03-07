/**
 * Tests for testProducts.js — Mock product data for development/preview
 */
import { describe, it, expect } from 'vitest';
import {
  testProductsByCategory,
  getTestProducts,
  getAllTestProducts,
  getFeaturedTestProducts,
  getSaleTestProducts,
} from '../src/public/testProducts.js';

// ── testProductsByCategory ────────────────────────────────────────────

describe('testProductsByCategory', () => {
  it('has products for expected categories', () => {
    expect(testProductsByCategory).toHaveProperty('futon-frames');
    expect(testProductsByCategory).toHaveProperty('mattresses');
    expect(testProductsByCategory).toHaveProperty('murphy-cabinet-beds');
    expect(testProductsByCategory).toHaveProperty('platform-beds');
  });

  it('each category has multiple products', () => {
    Object.values(testProductsByCategory).forEach(products => {
      expect(products.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('products have required fields', () => {
    const allProducts = Object.values(testProductsByCategory).flat();
    allProducts.forEach(p => {
      expect(p).toHaveProperty('_id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('slug');
      expect(p).toHaveProperty('price');
      expect(p).toHaveProperty('formattedPrice');
      expect(p).toHaveProperty('mainMedia');
      expect(p).toHaveProperty('mediaItems');
      expect(typeof p.price).toBe('number');
    });
  });
});

// ── getTestProducts ───────────────────────────────────────────────────

describe('getTestProducts', () => {
  it('returns products for known category', () => {
    const products = getTestProducts('futon-frames');
    expect(products.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown category', () => {
    expect(getTestProducts('nonexistent')).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(getTestProducts(null)).toEqual([]);
  });
});

// ── getAllTestProducts ─────────────────────────────────────────────────

describe('getAllTestProducts', () => {
  it('returns flat array of all products', () => {
    const all = getAllTestProducts();
    expect(all.length).toBeGreaterThan(10);
  });

  it('includes products from multiple categories', () => {
    const all = getAllTestProducts();
    const categories = new Set(all.flatMap(p => p.collections));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });
});

// ── getFeaturedTestProducts ───────────────────────────────────────────

describe('getFeaturedTestProducts', () => {
  it('returns requested count', () => {
    const featured = getFeaturedTestProducts(3);
    expect(featured).toHaveLength(3);
  });

  it('prioritizes Best Seller and New ribbons', () => {
    const featured = getFeaturedTestProducts(4);
    const ribbons = featured.map(p => p.ribbon).filter(Boolean);
    expect(ribbons.some(r => r === 'Best Seller' || r === 'New')).toBe(true);
  });

  it('does not exceed total available products', () => {
    const all = getAllTestProducts();
    const featured = getFeaturedTestProducts(999);
    expect(featured.length).toBeLessThanOrEqual(all.length);
  });

  it('returns empty for count 0', () => {
    expect(getFeaturedTestProducts(0)).toHaveLength(0);
  });
});

// ── getSaleTestProducts ───────────────────────────────────────────────

describe('getSaleTestProducts', () => {
  it('returns only products with discounted price', () => {
    const sale = getSaleTestProducts(10);
    sale.forEach(p => {
      expect(p.formattedDiscountedPrice).toBeTruthy();
    });
  });

  it('respects count limit', () => {
    const sale = getSaleTestProducts(1);
    expect(sale).toHaveLength(1);
  });

  it('returns empty if no sale products match count', () => {
    expect(getSaleTestProducts(0)).toHaveLength(0);
  });
});
