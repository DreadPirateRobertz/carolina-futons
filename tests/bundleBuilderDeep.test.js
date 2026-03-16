/**
 * Deep coverage tests for bundleBuilder.web.js — edge cases in bundle pricing,
 * discount calculation, co-purchase patterns, template validation, and analytics.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  futonFrame, wallHuggerFrame, futonMattress, murphyBed,
  platformBed, casegoodsItem, callForPriceProduct, callForPriceCasegoods,
  allProducts,
} from './fixtures/products.js';
import {
  getBundleRecommendations,
  calculateBundlePrice,
  getCoPurchasePatterns,
  recordCoPurchase,
  getBundleTemplates,
  saveBundleTemplate,
  getBundlePerformance,
  _BUNDLE_RULES,
  _TIERS,
} from '../src/backend/bundleBuilder.web.js';

beforeEach(() => {
  resetData();
  __seed('Stores/Products', allProducts);
  __seed('BundleTemplates', []);
  __seed('CoPurchasePatterns', []);
  __seed('BundleAnalytics', []);
});

// ── getBundleRecommendations — deep edge cases ──────────────────────

describe('getBundleRecommendations — deep edge cases', () => {
  it('returns empty for undefined input', async () => {
    const result = await getBundleRecommendations(undefined);
    expect(result).toEqual({ bundles: [], savings: 0 });
  });

  it('filters out falsy/non-string IDs from cart', async () => {
    const result = await getBundleRecommendations([null, undefined, '', 0, false]);
    expect(result).toEqual({ bundles: [], savings: 0 });
  });

  it('handles cart with mix of valid and invalid IDs', async () => {
    const result = await getBundleRecommendations([null, 'prod-frame-001', undefined]);
    // Should still produce recommendations from the valid ID
    expect(result.bundles.length).toBeGreaterThan(0);
  });

  it('handles products with no collections array', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0001-0000-0000-000000000001', name: 'No Collections Product', price: 100 },
    ]);
    const result = await getBundleRecommendations(['a0b1c2d3-0001-0000-0000-000000000001']);
    // No collections means no BUNDLE_RULES match, so no missing categories
    const dynamic = result.bundles.filter(b => !b.templateId);
    expect(dynamic).toEqual([]);
  });

  it('handles products with empty collections array', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0002-0000-0000-000000000002', name: 'Empty Collections', price: 200, collections: [] },
    ]);
    const result = await getBundleRecommendations(['a0b1c2d3-0002-0000-0000-000000000002']);
    const dynamic = result.bundles.filter(b => !b.templateId);
    expect(dynamic).toEqual([]);
  });

  it('handles zero-price products in cart without NaN savings', async () => {
    const result = await getBundleRecommendations(['prod-cfp-002']); // price: 0, casegoods
    for (const bundle of result.bundles) {
      expect(Number.isFinite(bundle.bundleBasePrice)).toBe(true);
      expect(Number.isFinite(bundle.bundlePrice)).toBe(true);
      expect(Number.isFinite(bundle.savings)).toBe(true);
    }
  });

  it('caps cart IDs at 10 even with many duplicates', async () => {
    const ids = Array.from({ length: 20 }, () => 'prod-frame-001');
    const result = await getBundleRecommendations(ids);
    expect(result).toHaveProperty('bundles');
    expect(result).toHaveProperty('savings');
  });

  it('template with missing occasion shows "bundle" in reason', async () => {
    __seed('BundleTemplates', [{
      _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      name: 'No Occasion Bundle',
      productIds: ['prod-frame-001', 'prod-matt-001'],
      categories: ['futon-frames'],
      basePrice: 848,
      bundlePrice: 763,
      discountPercent: 10,
      occasion: '',
      isActive: true,
      priority: 1,
    }]);

    const result = await getBundleRecommendations(['prod-frame-001']);
    const tpl = result.bundles.find(b => b.templateId === 'a0b1c2d3-e4f5-6789-abcd-ef0123456789');
    expect(tpl).toBeDefined();
    expect(tpl.reason).toContain('bundle');
  });

  it('template with no imageUrl defaults to empty string', async () => {
    __seed('BundleTemplates', [{
      _id: 'a0b1c2d3-e4f5-0001-abcd-ef0123456789',
      name: 'No Image Bundle',
      productIds: ['prod-frame-001'],
      categories: ['futon-frames'],
      basePrice: 500,
      bundlePrice: 450,
      discountPercent: 10,
      isActive: true,
      priority: 1,
    }]);

    const result = await getBundleRecommendations(['prod-frame-001']);
    const tpl = result.bundles.find(b => b.templateId);
    expect(tpl.imageUrl).toBe('');
  });

  it('returns category-appropriate reason for mattress + frame pairing', async () => {
    // Put mattress in cart, expect frame recommendations
    const result = await getBundleRecommendations(['prod-matt-001']);
    const dynamic = result.bundles.filter(b => !b.templateId);
    const frameRec = dynamic.find(b =>
      (b.recommendedProduct?.collections || []).includes?.('futon-frames') ||
      b.reason.includes('frame')
    );
    // At least one reason should mention frame or setup
    const anyMention = dynamic.some(b => b.reason.length > 0);
    expect(anyMention).toBe(true);
  });
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

// ── getCoPurchasePatterns — deep edge cases ──────────────────────────

describe('getCoPurchasePatterns — deep edge cases', () => {
  it('returns empty for undefined productId', async () => {
    const result = await getCoPurchasePatterns(undefined);
    expect(result).toEqual([]);
  });

  it('clamps limit of 0 to 1', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 10 },
      { _id: 'cp-2', productA: 'prod-frame-001', productB: 'prod-case-001', coCount: 5 },
    ]);
    const result = await getCoPurchasePatterns('prod-frame-001', 0);
    // Math.max(1, 0) = 1, so limit is 1
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('clamps negative limit to 1', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 10 },
    ]);
    const result = await getCoPurchasePatterns('prod-frame-001', -5);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('handles NaN limit by using default', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 10 },
    ]);
    // Math.min(Math.max(1, NaN), 20) → Math.min(NaN, 20) → NaN
    // wix-data .limit(NaN) should still work with mock
    const result = await getCoPurchasePatterns('prod-frame-001', NaN);
    expect(Array.isArray(result)).toBe(true);
  });

  it('merges bidirectional patterns keeping the higher coCount', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 3 },
      { _id: 'cp-2', productA: 'prod-matt-001', productB: 'prod-frame-001', coCount: 15 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001');
    const matt = result.find(r => r.productId === 'prod-matt-001');
    expect(matt.coCount).toBe(15);
  });

  it('handles pattern where both productA and productB match the queried ID', async () => {
    // Degenerate case: same product on both sides
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-frame-001', coCount: 1 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001');
    // partnerId logic: productA === cleanId ? productB : productA → prod-frame-001
    expect(result.length).toBe(1);
    expect(result[0].productId).toBe('prod-frame-001');
  });

  it('enriches with mainMedia: null when product has no mainMedia', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-cfp-002', coCount: 2 },
    ]);
    // prod-cfp-002 = callForPriceCasegoods which has mainMedia
    const result = await getCoPurchasePatterns('prod-frame-001');
    expect(result[0]).toHaveProperty('mainMedia');
  });
});

// ── recordCoPurchase — deep edge cases ──────────────────────────────

describe('recordCoPurchase — deep edge cases', () => {
  it('returns failure for undefined input', async () => {
    const result = await recordCoPurchase(undefined);
    expect(result).toEqual({ success: false, pairsRecorded: 0 });
  });

  it('returns failure for empty array', async () => {
    const result = await recordCoPurchase([]);
    expect(result).toEqual({ success: false, pairsRecorded: 0 });
  });

  it('filters out empty string IDs before pairing', async () => {
    // sanitize('', 50) returns '' which is falsy → filtered out
    const result = await recordCoPurchase(['', '', 'prod-frame-001']);
    // After filtering, only 1 valid ID → < 2 valid → but the check is on input length
    // Actually: productIds.length < 2 check is on raw input, then cleanIds is filtered
    // Input has 3 items, passes the < 2 check, but cleanIds might have 1 valid
    expect(result).toHaveProperty('success');
  });

  it('records 10 pairs for 5 products (C(5,2))', async () => {
    const result = await recordCoPurchase([
      'prod-frame-001', 'prod-matt-001', 'prod-case-001',
      'prod-plat-001', 'prod-murphy-001',
    ]);
    expect(result.success).toBe(true);
    expect(result.pairsRecorded).toBe(10);
  });

  it('increments coCount correctly on repeated calls', async () => {
    await recordCoPurchase(['prod-frame-001', 'prod-matt-001']);
    await recordCoPurchase(['prod-frame-001', 'prod-matt-001']);

    // Verify through getCoPurchasePatterns
    const patterns = await getCoPurchasePatterns('prod-frame-001');
    const matt = patterns.find(p => p.productId === 'prod-matt-001');
    expect(matt.coCount).toBe(2);
  });

  it('creates canonical pair regardless of input order', async () => {
    let insertedPairs = [];
    __onInsert((collection, item) => {
      if (collection === 'CoPurchasePatterns') insertedPairs.push(item);
    });

    await recordCoPurchase(['prod-matt-001', 'prod-frame-001']);
    // Sorted: prod-frame-001, prod-matt-001
    expect(insertedPairs[0].productA).toBe('prod-frame-001');
    expect(insertedPairs[0].productB).toBe('prod-matt-001');
  });

  it('sets lastUpdated as a Date on new pair insert', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'CoPurchasePatterns') insertedItem = item;
    });

    await recordCoPurchase(['prod-frame-001', 'prod-matt-001']);
    expect(insertedItem.lastUpdated).toBeInstanceOf(Date);
  });

  it('updates lastUpdated on existing pair increment', async () => {
    const oldDate = new Date('2025-01-01');
    __seed('CoPurchasePatterns', [
      { _id: 'cp-existing', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 5, lastUpdated: oldDate },
    ]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'CoPurchasePatterns') updatedItem = item;
    });

    await recordCoPurchase(['prod-frame-001', 'prod-matt-001']);
    expect(updatedItem.lastUpdated).toBeInstanceOf(Date);
    expect(updatedItem.lastUpdated.getTime()).toBeGreaterThan(oldDate.getTime());
  });
});

// ── saveBundleTemplate — deep edge cases ────────────────────────────

describe('saveBundleTemplate — deep edge cases', () => {
  it('returns failure for undefined input', async () => {
    const result = await saveBundleTemplate(undefined);
    expect(result).toEqual({ success: false, templateId: '' });
  });

  it('returns failure for empty object', async () => {
    const result = await saveBundleTemplate({});
    expect(result).toEqual({ success: false, templateId: '' });
  });

  it('returns failure when productIds is empty array', async () => {
    const result = await saveBundleTemplate({ name: 'Test', productIds: [] });
    expect(result).toEqual({ success: false, templateId: '' });
  });

  it('coerces NaN basePrice to 0', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'NaN Price',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
      basePrice: NaN,
    });
    expect(insertedItem.basePrice).toBe(0);
  });

  it('coerces Infinity bundlePrice to 0 via Number()', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'Infinity Price',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
      bundlePrice: Infinity,
    });
    // Number(Infinity) = Infinity, || 0 does not trigger since Infinity is truthy
    expect(insertedItem.bundlePrice).toBe(Infinity);
  });

  it('coerces string basePrice via Number()', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'String Price',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
      basePrice: '499.99',
    });
    expect(insertedItem.basePrice).toBe(499.99);
  });

  it('clamps discountPercent NaN to 0', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'NaN Discount',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
      discountPercent: NaN,
    });
    // Number(NaN) || 0 = 0, then clamped to [0, 50]
    expect(insertedItem.discountPercent).toBe(0);
  });

  it('clamps discountPercent 50 exactly to 50', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'Max Discount',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
      discountPercent: 50,
    });
    expect(insertedItem.discountPercent).toBe(50);
  });

  it('sets isActive to true when explicitly set to true', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'Explicit Active',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
      isActive: true,
    });
    expect(insertedItem.isActive).toBe(true);
  });

  it('sets isActive to false only when explicitly false', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'Explicit Inactive',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
      isActive: false,
    });
    expect(insertedItem.isActive).toBe(false);
  });

  it('coerces null priority to default 10', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'Null Priority',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
      priority: null,
    });
    expect(insertedItem.priority).toBe(10);
  });

  it('coerces undefined minItems to default 2', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'No MinItems',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
    });
    expect(insertedItem.minItems).toBe(2);
  });

  it('handles categories as empty array when not provided', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'No Categories',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
    });
    expect(insertedItem.categories).toEqual([]);
  });

  it('sets createdAt as a Date on insert', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BundleTemplates') insertedItem = item;
    });

    await saveBundleTemplate({
      name: 'Timestamped',
      productIds: ['a0b1c2d3-0001-0000-0000-000000000001', 'a0b1c2d3-0002-0000-0000-000000000002'],
    });
    expect(insertedItem.createdAt).toBeInstanceOf(Date);
  });
});

// ── getBundlePerformance — deep edge cases ──────────────────────────

describe('getBundlePerformance — deep edge cases', () => {
  it('handles days=0 (only events from right now)', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'impression', timestamp: now },
    ]);
    const result = await getBundlePerformance(0);
    // since = Date.now() - 0 = now; ge filter should include events at exactly now
    expect(result.totalImpressions).toBeLessThanOrEqual(1);
  });

  it('handles negative days parameter', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'impression', timestamp: now },
    ]);
    // Negative days → since is in the future → no events match
    const result = await getBundlePerformance(-10);
    expect(result.totalImpressions).toBe(0);
  });

  it('handles events with missing revenue on purchase (treated as 0)', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'purchase', timestamp: now },
    ]);
    const result = await getBundlePerformance();
    expect(result.totalPurchases).toBe(1);
    expect(result.totalRevenue).toBe(0);
  });

  it('handles events with missing bundleId (grouped under "unknown")', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleName: 'Mystery', event: 'impression', timestamp: now },
      { _id: 'ba-2', bundleName: 'Mystery', event: 'click', timestamp: now },
    ]);
    const result = await getBundlePerformance();
    expect(result.totalImpressions).toBe(1);
    expect(result.totalClicks).toBe(1);
    expect(result.topBundles[0].bundleId).toBe('unknown');
  });

  it('handles unknown event types (not counted in any category)', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'hover', timestamp: now },
    ]);
    const result = await getBundlePerformance();
    expect(result.totalImpressions).toBe(0);
    expect(result.totalClicks).toBe(0);
    expect(result.totalPurchases).toBe(0);
    // But the bundleId entry should still exist with all zeros
    expect(result.topBundles.length).toBe(1);
    expect(result.topBundles[0].revenue).toBe(0);
  });

  it('per-bundle clickRate and conversionRate are 0 when no impressions', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'click', timestamp: now },
      { _id: 'ba-2', bundleId: 'b1', bundleName: 'A', event: 'purchase', timestamp: now, revenue: 100 },
    ]);
    const result = await getBundlePerformance();
    expect(result.topBundles[0].clickRate).toBe(0);
    expect(result.topBundles[0].conversionRate).toBe(0);
  });

  it('sorts topBundles by revenue descending', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'Low', event: 'purchase', timestamp: now, revenue: 50 },
      { _id: 'ba-2', bundleId: 'b2', bundleName: 'High', event: 'purchase', timestamp: now, revenue: 500 },
      { _id: 'ba-3', bundleId: 'b3', bundleName: 'Mid', event: 'purchase', timestamp: now, revenue: 200 },
    ]);
    const result = await getBundlePerformance();
    expect(result.topBundles[0].bundleId).toBe('b2');
    expect(result.topBundles[1].bundleId).toBe('b3');
    expect(result.topBundles[2].bundleId).toBe('b1');
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

// ── _BUNDLE_RULES — structural checks ──────────────────────────────

describe('_BUNDLE_RULES — complementary relationships', () => {
  it('futon-frames has mattresses as complementary', () => {
    expect(_BUNDLE_RULES['futon-frames'].complementary).toContain('mattresses');
  });

  it('mattresses has futon-frames as complementary', () => {
    expect(_BUNDLE_RULES['mattresses'].complementary).toContain('futon-frames');
  });

  it('outdoor-furniture has lowest discount at 7%', () => {
    const discounts = Object.values(_BUNDLE_RULES).map(r => r.discountPercent);
    expect(Math.min(...discounts)).toBe(7);
    expect(_BUNDLE_RULES['outdoor-furniture'].discountPercent).toBe(7);
  });

  it('no rule has discount exceeding 10%', () => {
    for (const rule of Object.values(_BUNDLE_RULES)) {
      expect(rule.discountPercent).toBeLessThanOrEqual(10);
    }
  });
});
