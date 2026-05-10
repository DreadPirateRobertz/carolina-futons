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

// ── Exported constants ────────────────────────────────────────────────

describe('_TIERS', () => {
  it('has starter, essentials, premium, deluxe', () => {
    expect(_TIERS).toHaveProperty('starter');
    expect(_TIERS).toHaveProperty('essentials');
    expect(_TIERS).toHaveProperty('premium');
    expect(_TIERS).toHaveProperty('deluxe');
  });

  it('tiers have ascending maxPrice', () => {
    expect(_TIERS.starter.maxPrice).toBeLessThan(_TIERS.essentials.maxPrice);
    expect(_TIERS.essentials.maxPrice).toBeLessThan(_TIERS.premium.maxPrice);
    expect(_TIERS.premium.maxPrice).toBeLessThan(_TIERS.deluxe.maxPrice);
  });

  it('each tier has label and badgeColor', () => {
    for (const tier of Object.values(_TIERS)) {
      expect(typeof tier.label).toBe('string');
      expect(tier.label.length).toBeGreaterThan(0);
      expect(tier.badgeColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ── getBundleRecommendations ──────────────────────────────────────────

describe('calculateBundlePrice', () => {
  it('returns zeros for null input', async () => {
    const result = await calculateBundlePrice(null);
    expect(result).toEqual({
      basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '',
    });
  });

  it('returns zeros for fewer than 2 products', async () => {
    const result = await calculateBundlePrice(['prod-frame-001']);
    expect(result).toEqual({
      basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '',
    });
  });

  it('returns zeros when products not found', async () => {
    const result = await calculateBundlePrice(['no-exist-1', 'no-exist-2']);
    expect(result).toEqual({
      basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '',
    });
  });

  it('calculates 8% discount for 2 products spanning 2 categories', async () => {
    // prod-frame-001 = futon-frames, prod-frame-002 = futon-frames + wall-huggers => 2 categories
    const result = await calculateBundlePrice(['prod-frame-001', 'prod-frame-002']);
    expect(result.basePrice).toBe(499 + 699);
    expect(result.discountPercent).toBe(8);
    expect(result.bundlePrice).toBe(
      Math.round((499 + 699) * 0.92 * 100) / 100
    );
    expect(result.savings).toBe(
      Math.round((result.basePrice - result.bundlePrice) * 100) / 100
    );
    expect(result.tier).toBeTruthy();
  });

  it('gives 8% discount for 2 different categories', async () => {
    const result = await calculateBundlePrice(['prod-frame-001', 'prod-matt-001']);
    expect(result.basePrice).toBe(499 + 349);
    expect(result.discountPercent).toBe(8);
    expect(result.bundlePrice).toBe(
      Math.round((499 + 349) * 0.92 * 100) / 100
    );
  });

  it('gives 10% discount for 3+ categories', async () => {
    const result = await calculateBundlePrice([
      'prod-frame-001', 'prod-matt-001', 'prod-case-001',
    ]);
    expect(result.discountPercent).toBe(10);
  });

  it('gives 12% discount for 4+ products', async () => {
    const result = await calculateBundlePrice([
      'prod-frame-001', 'prod-matt-001', 'prod-case-001', 'prod-plat-001',
    ]);
    expect(result.discountPercent).toBeGreaterThanOrEqual(12);
  });

  it('uses template discount if higher', async () => {
    __seed('BundleTemplates', [{
      _id: 'tpl-big',
      name: 'Big Bundle',
      productIds: ['prod-frame-001', 'prod-matt-001'],
      isActive: true,
      discountPercent: 20,
    }]);

    const result = await calculateBundlePrice(['prod-frame-001', 'prod-matt-001']);
    expect(result.discountPercent).toBe(20);
  });

  it('ignores inactive templates', async () => {
    __seed('BundleTemplates', [{
      _id: 'tpl-inactive',
      name: 'Inactive Bundle',
      productIds: ['prod-frame-001', 'prod-matt-001'],
      isActive: false,
      discountPercent: 25,
    }]);

    const result = await calculateBundlePrice(['prod-frame-001', 'prod-matt-001']);
    expect(result.discountPercent).toBeLessThan(25);
  });

  it('rounds prices to 2 decimal places', async () => {
    const result = await calculateBundlePrice(['prod-frame-001', 'prod-matt-001']);
    expect(result.basePrice).toBe(Math.round(result.basePrice * 100) / 100);
    expect(result.bundlePrice).toBe(Math.round(result.bundlePrice * 100) / 100);
    expect(result.savings).toBe(Math.round(result.savings * 100) / 100);
  });

  it('assigns correct tier label', async () => {
    // 499 + 349 = 848, * 0.92 = 780.16 => essentials (maxPrice 1000)
    const result = await calculateBundlePrice(['prod-frame-001', 'prod-matt-001']);
    expect(result.tier).toBe('Essentials Bundle');
  });
});

// ── getCoPurchasePatterns ─────────────────────────────────────────────
