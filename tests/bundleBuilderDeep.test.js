/**
 * Deep coverage tests for bundleBuilder.web.js — edge cases in
 * calculateBundlePrice + _TIERS boundary conditions.
 *
 * Trimmed in cf-4x7e Pass 2 chunk 5 alongside the source-side delete
 * of the 10 dead webMethods (getBundleRecommendations, getCoPurchasePatterns,
 * recordCoPurchase, getBundleTemplates, saveBundleTemplate,
 * getBundlePerformance, getCompatibleMattresses, getCompatibleCovers,
 * getBundlePrice, addFutonStudioBundleToCart) and the BUNDLE_RULES const.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { allProducts } from './fixtures/products.js';
import {
  calculateBundlePrice,
  _TIERS,
} from '../src/backend/bundleBuilder.web.js';

beforeEach(() => {
  resetData();
  __seed('Stores/Products', allProducts);
  __seed('BundleTemplates', []);
});

// ── calculateBundlePrice — deep edge cases ──────────────────────────

describe('calculateBundlePrice — deep edge cases', () => {
  it('returns zeros for undefined input', async () => {
    const result = await calculateBundlePrice(undefined);
    expect(result).toEqual({ basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '' });
  });

  it('returns zeros for empty array', async () => {
    const result = await calculateBundlePrice([]);
    expect(result).toEqual({ basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '' });
  });

  it('returns zeros when only 1 product found among IDs', async () => {
    const result = await calculateBundlePrice(['prod-frame-001', 'nonexistent-id-abc']);
    expect(result).toEqual({ basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '' });
  });

  it('handles products with price 0 (call-for-price items)', async () => {
    // prod-cfp-002 has price: 0, prod-cfp-001 has price: 1
    const result = await calculateBundlePrice(['prod-cfp-001', 'prod-cfp-002']);
    expect(result.basePrice).toBe(1);
    expect(result.bundlePrice).toBeLessThanOrEqual(result.basePrice);
    expect(Number.isFinite(result.savings)).toBe(true);
  });

  it('handles products with undefined price (treated as 0)', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0003-0000-0000-000000000003', name: 'No Price A', collections: ['futon-frames'] },
      { _id: 'a0b1c2d3-0004-0000-0000-000000000004', name: 'No Price B', collections: ['mattresses'] },
    ]);
    const result = await calculateBundlePrice([
      'a0b1c2d3-0003-0000-0000-000000000003',
      'a0b1c2d3-0004-0000-0000-000000000004',
    ]);
    expect(result.basePrice).toBe(0);
    expect(result.bundlePrice).toBe(0);
    expect(result.savings).toBe(0);
    expect(result.discountPercent).toBeGreaterThan(0); // Still assigns a discount %
  });

  it('gives 5% base discount for 2 products in same category', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0005-0000-0000-000000000005', name: 'Frame A', price: 500, collections: ['futon-frames'] },
      { _id: 'a0b1c2d3-0006-0000-0000-000000000006', name: 'Frame B', price: 300, collections: ['futon-frames'] },
    ]);
    const result = await calculateBundlePrice([
      'a0b1c2d3-0005-0000-0000-000000000005',
      'a0b1c2d3-0006-0000-0000-000000000006',
    ]);
    // Same category = 1 category in set, so base 5%
    expect(result.discountPercent).toBe(5);
    expect(result.bundlePrice).toBe(Math.round(800 * 0.95 * 100) / 100);
  });

  it('assigns starter tier for low-price bundles', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0007-0000-0000-000000000007', name: 'Cheap A', price: 100, collections: ['cat-a'] },
      { _id: 'a0b1c2d3-0008-0000-0000-000000000008', name: 'Cheap B', price: 100, collections: ['cat-a'] },
    ]);
    const result = await calculateBundlePrice([
      'a0b1c2d3-0007-0000-0000-000000000007',
      'a0b1c2d3-0008-0000-0000-000000000008',
    ]);
    // 200 * 0.95 = 190 → starter tier (maxPrice 500)
    expect(result.tier).toBe('Starter Bundle');
  });

  it('assigns deluxe tier for high-price bundles', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0009-0000-0000-000000000009', name: 'Luxury A', price: 2000, collections: ['cat-x'] },
      { _id: 'a0b1c2d3-000a-0000-0000-000000000010', name: 'Luxury B', price: 2000, collections: ['cat-x'] },
    ]);
    const result = await calculateBundlePrice([
      'a0b1c2d3-0009-0000-0000-000000000009',
      'a0b1c2d3-000a-0000-0000-000000000010',
    ]);
    // 4000 * 0.95 = 3800 → deluxe tier
    expect(result.tier).toBe('Deluxe Bundle');
  });

  it('template with lower discount does not override dynamic discount', async () => {
    __seed('BundleTemplates', [{
      _id: 'a0b1c2d3-e4f5-0002-abcd-ef0123456789',
      name: 'Low Discount',
      productIds: ['prod-frame-001', 'prod-matt-001', 'prod-case-001'],
      isActive: true,
      discountPercent: 3, // Lower than the 10% for 3 categories
    }]);

    const result = await calculateBundlePrice(['prod-frame-001', 'prod-matt-001', 'prod-case-001']);
    expect(result.discountPercent).toBe(10); // 3 categories → 10%, template 3% ignored
  });

  it('caps product IDs at 10 for calculation', async () => {
    const ids = Array.from({ length: 15 }, (_, i) => `prod-frame-001`);
    // Only first 10 will be processed; duplicates resolve to same product
    const result = await calculateBundlePrice(ids);
    expect(result).toHaveProperty('basePrice');
  });

  it('savings equals basePrice minus bundlePrice', async () => {
    const result = await calculateBundlePrice(['prod-frame-001', 'prod-matt-001']);
    expect(result.savings).toBe(
      Math.round((result.basePrice - result.bundlePrice) * 100) / 100
    );
  });
});

// ── _TIERS — boundary conditions ────────────────────────────────────

describe('_TIERS — boundary conditions', () => {
  it('deluxe tier maxPrice is Infinity', () => {
    expect(_TIERS.deluxe.maxPrice).toBe(Infinity);
  });

  it('starter maxPrice is exactly 500', () => {
    expect(_TIERS.starter.maxPrice).toBe(500);
  });

  it('essentials maxPrice is exactly 1000', () => {
    expect(_TIERS.essentials.maxPrice).toBe(1000);
  });

  it('premium maxPrice is exactly 1500', () => {
    expect(_TIERS.premium.maxPrice).toBe(1500);
  });
});


