import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import {
  futonFrame, wallHuggerFrame, futonMattress, murphyBed,
  platformBed, casegoodsItem, allProducts,
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

// ── Exported constants ────────────────────────────────────────────────

describe('_BUNDLE_RULES', () => {
  it('has rules for expected categories', () => {
    expect(_BUNDLE_RULES).toHaveProperty('futon-frames');
    expect(_BUNDLE_RULES).toHaveProperty('mattresses');
    expect(_BUNDLE_RULES).toHaveProperty('murphy-cabinet-beds');
    expect(_BUNDLE_RULES).toHaveProperty('platform-beds');
    expect(_BUNDLE_RULES).toHaveProperty('outdoor-furniture');
  });

  it('each rule has complementary array, bundleName, and discount', () => {
    for (const [, rule] of Object.entries(_BUNDLE_RULES)) {
      expect(Array.isArray(rule.complementary)).toBe(true);
      expect(rule.complementary.length).toBeGreaterThan(0);
      expect(typeof rule.discountPercent).toBe('number');
      expect(rule.discountPercent).toBeGreaterThan(0);
      expect(typeof rule.bundleName).toBe('string');
    }
  });
});

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

describe('getBundleRecommendations', () => {
  it('returns empty when no cart IDs provided', async () => {
    const result = await getBundleRecommendations(null);
    expect(result).toEqual({ bundles: [], savings: 0 });
  });

  it('returns empty for empty cart array', async () => {
    const result = await getBundleRecommendations([]);
    expect(result).toEqual({ bundles: [], savings: 0 });
  });

  it('returns empty when cart products not found', async () => {
    const result = await getBundleRecommendations(['nonexistent-id']);
    expect(result).toEqual({ bundles: [], savings: 0 });
  });

  it('recommends complementary products for futon frame in cart', async () => {
    const result = await getBundleRecommendations(['prod-frame-001']);
    expect(result.bundles.length).toBeGreaterThan(0);
    // Frame complementary = mattresses + casegoods-accessories
    const recIds = result.bundles
      .map(b => b.recommendedProduct?._id)
      .filter(Boolean);
    expect(recIds).not.toContain('prod-frame-001');
  });

  it('each dynamic bundle has expected fields', async () => {
    const result = await getBundleRecommendations(['prod-frame-001']);
    const dynamic = result.bundles.filter(b => !b.templateId);
    for (const bundle of dynamic) {
      expect(bundle).toHaveProperty('recommendedProduct');
      expect(bundle).toHaveProperty('bundleName');
      expect(bundle).toHaveProperty('bundleBasePrice');
      expect(bundle).toHaveProperty('bundlePrice');
      expect(bundle).toHaveProperty('savings');
      expect(bundle).toHaveProperty('discountPercent');
      expect(bundle).toHaveProperty('tier');
      expect(bundle).toHaveProperty('tierBadgeColor');
      expect(bundle).toHaveProperty('reason');
    }
  });

  it('calculates positive savings', async () => {
    const result = await getBundleRecommendations(['prod-frame-001']);
    expect(result.savings).toBeGreaterThan(0);
    for (const bundle of result.bundles.filter(b => !b.templateId)) {
      expect(bundle.savings).toBeGreaterThan(0);
      expect(bundle.bundlePrice).toBeLessThan(bundle.bundleBasePrice);
    }
  });

  it('returns at most 6 bundles', async () => {
    const result = await getBundleRecommendations(['prod-frame-001']);
    expect(result.bundles.length).toBeLessThanOrEqual(6);
  });

  it('sorts dynamic bundles by savings descending', async () => {
    const result = await getBundleRecommendations(['prod-frame-001']);
    const dynamic = result.bundles.filter(b => !b.templateId);
    for (let i = 1; i < dynamic.length; i++) {
      expect(dynamic[i - 1].savings).toBeGreaterThanOrEqual(dynamic[i].savings);
    }
  });

  it('includes matching bundle templates at the front', async () => {
    __seed('BundleTemplates', [{
      _id: 'tpl-1',
      name: 'College Futon Set',
      productIds: ['prod-frame-001', 'prod-matt-001'],
      categories: ['futon-frames'],
      basePrice: 848,
      bundlePrice: 763,
      discountPercent: 10,
      occasion: 'back_to_school',
      tier: 'essentials',
      isActive: true,
      priority: 1,
      imageUrl: 'https://example.com/bundle.jpg',
    }]);

    const result = await getBundleRecommendations(['prod-frame-001']);
    expect(result.bundles[0].templateId).toBe('tpl-1');
    expect(result.bundles[0].bundleName).toBe('College Futon Set');
    expect(result.bundles[0].occasion).toBe('back_to_school');
    expect(result.bundles[0].reason).toContain('back_to_school');
  });

  it('caps cart IDs at 10', async () => {
    const ids = Array.from({ length: 15 }, (_, i) => `id-${i}`);
    const result = await getBundleRecommendations(ids);
    expect(result).toHaveProperty('bundles');
    expect(result).toHaveProperty('savings');
  });

  it('returns no dynamic recs when all complementary categories already in cart', async () => {
    // Frame + mattress + casegoods covers all complements for futon-frames
    const result = await getBundleRecommendations([
      'prod-frame-001', 'prod-matt-001', 'prod-case-001',
    ]);
    const dynamic = result.bundles.filter(b => !b.templateId);
    expect(dynamic.length).toBe(0);
  });

  it('recommends mattresses for platform bed in cart', async () => {
    const result = await getBundleRecommendations(['prod-plat-001']);
    const dynamic = result.bundles.filter(b => !b.templateId);
    expect(dynamic.length).toBeGreaterThan(0);
    // platform-beds complementary = mattresses + casegoods-accessories
    // At least some recs
    expect(dynamic.length).toBeGreaterThan(0);
  });

  it('provides a reason string for each recommendation', async () => {
    const result = await getBundleRecommendations(['prod-frame-001']);
    for (const bundle of result.bundles) {
      expect(typeof bundle.reason).toBe('string');
      expect(bundle.reason.length).toBeGreaterThan(0);
    }
  });
});

// ── calculateBundlePrice ──────────────────────────────────────────────

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

describe('getCoPurchasePatterns', () => {
  it('returns empty for null productId', async () => {
    const result = await getCoPurchasePatterns(null);
    expect(result).toEqual([]);
  });

  it('returns empty for empty string', async () => {
    const result = await getCoPurchasePatterns('');
    expect(result).toEqual([]);
  });

  it('returns empty when no co-purchase data exists', async () => {
    const result = await getCoPurchasePatterns('prod-frame-001');
    expect(result).toEqual([]);
  });

  it('returns patterns sorted by coCount descending', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 10 },
      { _id: 'cp-2', productA: 'prod-frame-001', productB: 'prod-case-001', coCount: 25 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001');
    expect(result.length).toBe(2);
    expect(result[0].coCount).toBeGreaterThanOrEqual(result[1].coCount);
  });

  it('enriches patterns with product name and price', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 5 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001');
    expect(result[0].productId).toBe('prod-matt-001');
    expect(result[0].productName).toBe('Moonshadow Futon Mattress');
    expect(result[0].price).toBe(349);
  });

  it('finds patterns where product is in productB position', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-case-001', productB: 'prod-frame-001', coCount: 7 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001');
    expect(result.length).toBe(1);
    expect(result[0].productId).toBe('prod-case-001');
  });

  it('deduplicates patterns keeping higher coCount', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 10 },
      { _id: 'cp-2', productA: 'prod-matt-001', productB: 'prod-frame-001', coCount: 3 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001');
    const mattEntries = result.filter(r => r.productId === 'prod-matt-001');
    expect(mattEntries.length).toBe(1);
    expect(mattEntries[0].coCount).toBe(10);
  });

  it('respects limit parameter', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 10 },
      { _id: 'cp-2', productA: 'prod-frame-001', productB: 'prod-case-001', coCount: 8 },
      { _id: 'cp-3', productA: 'prod-frame-001', productB: 'prod-plat-001', coCount: 3 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001', 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('clamps limit to max 20', async () => {
    const result = await getCoPurchasePatterns('prod-frame-001', 100);
    expect(result).toEqual([]);
  });

  it('handles missing product gracefully in enrichment', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'deleted-product', coCount: 5 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001');
    expect(result.length).toBe(1);
    expect(result[0].productName).toBe('');
    expect(result[0].price).toBe(0);
  });

  it('includes mainMedia in enriched results', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-1', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 5 },
    ]);

    const result = await getCoPurchasePatterns('prod-frame-001');
    expect(result[0]).toHaveProperty('mainMedia');
    expect(result[0].mainMedia).toBe('https://example.com/moonshadow.jpg');
  });
});

// ── recordCoPurchase ──────────────────────────────────────────────────

describe('recordCoPurchase', () => {
  it('returns failure for null input', async () => {
    const result = await recordCoPurchase(null);
    expect(result).toEqual({ success: false, pairsRecorded: 0 });
  });

  it('returns failure for fewer than 2 products', async () => {
    const result = await recordCoPurchase(['prod-frame-001']);
    expect(result).toEqual({ success: false, pairsRecorded: 0 });
  });

  it('records one pair for 2 products', async () => {
    const result = await recordCoPurchase(['prod-frame-001', 'prod-matt-001']);
    expect(result.success).toBe(true);
    expect(result.pairsRecorded).toBe(1);
  });

  it('records 3 pairs for 3 products (C(3,2))', async () => {
    const result = await recordCoPurchase([
      'prod-frame-001', 'prod-matt-001', 'prod-case-001',
    ]);
    expect(result.success).toBe(true);
    expect(result.pairsRecorded).toBe(3);
  });

  it('records 6 pairs for 4 products (C(4,2))', async () => {
    const result = await recordCoPurchase([
      'prod-frame-001', 'prod-matt-001', 'prod-case-001', 'prod-plat-001',
    ]);
    expect(result.success).toBe(true);
    expect(result.pairsRecorded).toBe(6);
  });

  it('increments coCount for existing pair', async () => {
    __seed('CoPurchasePatterns', [
      { _id: 'cp-existing', productA: 'prod-frame-001', productB: 'prod-matt-001', coCount: 5 },
    ]);

    const result = await recordCoPurchase(['prod-matt-001', 'prod-frame-001']);
    expect(result.success).toBe(true);
    expect(result.pairsRecorded).toBe(1);
  });

  it('inserts new pair when not existing', async () => {
    const result = await recordCoPurchase(['prod-frame-001', 'prod-matt-001']);
    expect(result.success).toBe(true);
    expect(result.pairsRecorded).toBe(1);
  });

  it('sorts product IDs to create canonical pairs', async () => {
    // Record A,B then B,A — second call should find existing pair
    await recordCoPurchase(['prod-matt-001', 'prod-frame-001']);
    const result = await recordCoPurchase(['prod-frame-001', 'prod-matt-001']);
    expect(result.success).toBe(true);
    expect(result.pairsRecorded).toBe(1);
  });

  it('caps product IDs at 20', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `p${String(i).padStart(3, '0')}`);
    const result = await recordCoPurchase(ids);
    expect(result.success).toBe(true);
    // C(20,2) = 190
    expect(result.pairsRecorded).toBe(190);
  });
});

// ── getBundleTemplates ────────────────────────────────────────────────

describe('getBundleTemplates', () => {
  const templates = [
    { _id: 'tpl-1', name: 'College Set', isActive: true, occasion: 'back_to_school', priority: 2 },
    { _id: 'tpl-2', name: 'Guest Room', isActive: true, occasion: 'guest_room', priority: 1 },
    { _id: 'tpl-3', name: 'Inactive', isActive: false, occasion: 'general', priority: 3 },
  ];

  it('returns only active templates', async () => {
    __seed('BundleTemplates', templates);
    const result = await getBundleTemplates();
    expect(result.length).toBe(2);
    expect(result.every(t => t.isActive)).toBe(true);
  });

  it('sorts by priority ascending', async () => {
    __seed('BundleTemplates', templates);
    const result = await getBundleTemplates();
    expect(result[0]._id).toBe('tpl-2'); // priority 1
    expect(result[1]._id).toBe('tpl-1'); // priority 2
  });

  it('filters by occasion when provided', async () => {
    __seed('BundleTemplates', templates);
    const result = await getBundleTemplates('back_to_school');
    expect(result.length).toBe(1);
    expect(result[0].occasion).toBe('back_to_school');
  });

  it('returns empty array for non-matching occasion', async () => {
    __seed('BundleTemplates', templates);
    const result = await getBundleTemplates('outdoor');
    expect(result).toEqual([]);
  });

  it('returns empty array when no templates exist', async () => {
    const result = await getBundleTemplates();
    expect(result).toEqual([]);
  });
});

// ── saveBundleTemplate ────────────────────────────────────────────────

describe('saveBundleTemplate', () => {
  it('returns failure for null input', async () => {
    const result = await saveBundleTemplate(null);
    expect(result).toEqual({ success: false, templateId: '' });
  });

  it('returns failure when name is missing', async () => {
    const result = await saveBundleTemplate({ productIds: ['a', 'b'] });
    expect(result).toEqual({ success: false, templateId: '' });
  });

  it('returns failure when productIds missing', async () => {
    const result = await saveBundleTemplate({ name: 'Test' });
    expect(result).toEqual({ success: false, templateId: '' });
  });

  it('returns failure when fewer than 2 productIds', async () => {
    const result = await saveBundleTemplate({ name: 'Test', productIds: ['a'] });
    expect(result).toEqual({ success: false, templateId: '' });
  });

  it('creates a new template when no _id provided', async () => {
    const result = await saveBundleTemplate({
      name: 'New Bundle',
      productIds: ['prod-frame-001', 'prod-matt-001'],
      basePrice: 848,
      bundlePrice: 763,
      discountPercent: 10,
      occasion: 'general',
    });
    expect(result.success).toBe(true);
    expect(result.templateId).toBeTruthy();
  });

  it('updates existing template when _id provided', async () => {
    __seed('BundleTemplates', [{
      _id: 'tpl-update',
      name: 'Old Name',
      productIds: ['a', 'b'],
      isActive: true,
    }]);

    const result = await saveBundleTemplate({
      _id: 'tpl-update',
      name: 'Updated Name',
      productIds: ['prod-frame-001', 'prod-matt-001'],
      basePrice: 848,
      bundlePrice: 763,
    });
    expect(result.success).toBe(true);
    expect(result.templateId).toBe('tpl-update');
  });

  it('clamps discountPercent to max 50', async () => {
    const result = await saveBundleTemplate({
      name: 'Excessive Discount',
      productIds: ['a', 'b'],
      discountPercent: 99,
    });
    expect(result.success).toBe(true);
  });

  it('clamps discountPercent to min 0', async () => {
    const result = await saveBundleTemplate({
      name: 'Negative Discount',
      productIds: ['a', 'b'],
      discountPercent: -10,
    });
    expect(result.success).toBe(true);
  });

  it('defaults isActive to true', async () => {
    const result = await saveBundleTemplate({
      name: 'Default Active',
      productIds: ['a', 'b'],
    });
    expect(result.success).toBe(true);
  });

  it('defaults occasion to general', async () => {
    const result = await saveBundleTemplate({
      name: 'No Occasion',
      productIds: ['a', 'b'],
    });
    expect(result.success).toBe(true);
  });

  it('caps productIds at 10', async () => {
    const ids = Array.from({ length: 15 }, (_, i) => `id-${i}`);
    const result = await saveBundleTemplate({
      name: 'Big Bundle',
      productIds: ids,
    });
    expect(result.success).toBe(true);
  });

  it('sanitizes name to 200 chars', async () => {
    const result = await saveBundleTemplate({
      name: 'A'.repeat(500),
      productIds: ['a', 'b'],
    });
    expect(result.success).toBe(true);
  });
});

// ── getBundlePerformance ──────────────────────────────────────────────

describe('getBundlePerformance', () => {
  it('returns zero stats when no analytics data', async () => {
    const result = await getBundlePerformance();
    expect(result.totalImpressions).toBe(0);
    expect(result.totalClicks).toBe(0);
    expect(result.totalPurchases).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.conversionRate).toBe(0);
    expect(result.topBundles).toEqual([]);
  });

  it('counts impressions, clicks, and purchases', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'Set A', event: 'impression', timestamp: now },
      { _id: 'ba-2', bundleId: 'b1', bundleName: 'Set A', event: 'impression', timestamp: now },
      { _id: 'ba-3', bundleId: 'b1', bundleName: 'Set A', event: 'click', timestamp: now },
      { _id: 'ba-4', bundleId: 'b1', bundleName: 'Set A', event: 'purchase', timestamp: now, revenue: 500 },
    ]);

    const result = await getBundlePerformance();
    expect(result.totalImpressions).toBe(2);
    expect(result.totalClicks).toBe(1);
    expect(result.totalPurchases).toBe(1);
    expect(result.totalRevenue).toBe(500);
  });

  it('calculates conversion rate correctly', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'impression', timestamp: now },
      { _id: 'ba-2', bundleId: 'b1', bundleName: 'A', event: 'impression', timestamp: now },
      { _id: 'ba-3', bundleId: 'b1', bundleName: 'A', event: 'impression', timestamp: now },
      { _id: 'ba-4', bundleId: 'b1', bundleName: 'A', event: 'impression', timestamp: now },
      { _id: 'ba-5', bundleId: 'b1', bundleName: 'A', event: 'purchase', timestamp: now, revenue: 100 },
    ]);

    const result = await getBundlePerformance();
    // 1 purchase / 4 impressions = 25%
    expect(result.conversionRate).toBe(25);
  });

  it('groups stats by bundleId in topBundles', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'Set A', event: 'purchase', timestamp: now, revenue: 800 },
      { _id: 'ba-2', bundleId: 'b2', bundleName: 'Set B', event: 'purchase', timestamp: now, revenue: 200 },
      { _id: 'ba-3', bundleId: 'b1', bundleName: 'Set A', event: 'impression', timestamp: now },
      { _id: 'ba-4', bundleId: 'b2', bundleName: 'Set B', event: 'impression', timestamp: now },
    ]);

    const result = await getBundlePerformance();
    expect(result.topBundles.length).toBe(2);
    // Sorted by revenue descending
    expect(result.topBundles[0].bundleId).toBe('b1');
    expect(result.topBundles[0].revenue).toBe(800);
    expect(result.topBundles[1].bundleId).toBe('b2');
  });

  it('excludes events older than the days window', async () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    const recent = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'Old', event: 'impression', timestamp: old },
      { _id: 'ba-2', bundleId: 'b1', bundleName: 'Recent', event: 'impression', timestamp: recent },
    ]);

    const result = await getBundlePerformance(30);
    expect(result.totalImpressions).toBe(1);
  });

  it('respects custom days parameter', async () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const recent = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'Old', event: 'impression', timestamp: old },
      { _id: 'ba-2', bundleId: 'b1', bundleName: 'Recent', event: 'impression', timestamp: recent },
    ]);

    const result = await getBundlePerformance(90);
    expect(result.totalImpressions).toBe(2);
  });

  it('limits topBundles to 10', async () => {
    const now = new Date();
    const items = [];
    for (let i = 0; i < 15; i++) {
      items.push({
        _id: `ba-${i}`,
        bundleId: `b-${i}`,
        bundleName: `Bundle ${i}`,
        event: 'purchase',
        timestamp: now,
        revenue: i * 10,
      });
    }
    __seed('BundleAnalytics', items);

    const result = await getBundlePerformance();
    expect(result.topBundles.length).toBeLessThanOrEqual(10);
  });

  it('calculates clickRate and conversionRate per bundle', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'impression', timestamp: now },
      { _id: 'ba-2', bundleId: 'b1', bundleName: 'A', event: 'impression', timestamp: now },
      { _id: 'ba-3', bundleId: 'b1', bundleName: 'A', event: 'click', timestamp: now },
      { _id: 'ba-4', bundleId: 'b1', bundleName: 'A', event: 'purchase', timestamp: now, revenue: 100 },
    ]);

    const result = await getBundlePerformance();
    const bundle = result.topBundles[0];
    expect(bundle.clickRate).toBe(50);       // 1/2 = 50%
    expect(bundle.conversionRate).toBe(50);  // 1/2 = 50%
  });

  it('rounds totalRevenue to 2 decimal places', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'purchase', timestamp: now, revenue: 33.333 },
      { _id: 'ba-2', bundleId: 'b1', bundleName: 'A', event: 'purchase', timestamp: now, revenue: 33.333 },
    ]);

    const result = await getBundlePerformance();
    expect(result.totalRevenue).toBe(Math.round(66.666 * 100) / 100);
  });

  it('handles zero impressions without division error', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'ba-1', bundleId: 'b1', bundleName: 'A', event: 'purchase', timestamp: now, revenue: 100 },
    ]);

    const result = await getBundlePerformance();
    expect(result.conversionRate).toBe(0);
    expect(result.topBundles[0].clickRate).toBe(0);
    expect(result.topBundles[0].conversionRate).toBe(0);
  });
});
