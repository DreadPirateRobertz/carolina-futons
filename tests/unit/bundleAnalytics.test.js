import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from '../__mocks__/wix-data.js';
import { __setMember, __setRoles } from '../__mocks__/wix-members-backend.js';
import {
  trackBundleImpression,
  getBundleAnalytics,
  getBundlePerformance,
  getRecommendedBundles,
} from '../../src/backend/bundleAnalytics.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'admin-1', loginEmail: 'admin@carolinafutons.com' });
  __setRoles([{ _id: 'admin' }]);
});

// ── trackBundleImpression ─────────────────────────────────────────────

describe('trackBundleImpression', () => {
  it('tracks an impression event', async () => {
    const result = await trackBundleImpression({
      bundleId: 'bundle-frame-cover',
      bundleName: 'Frame + Cover Combo',
      event: 'impression',
      source: 'product_page',
    });

    expect(result.success).toBe(true);
  });

  it('tracks a click event', async () => {
    const result = await trackBundleImpression({
      bundleId: 'bundle-frame-cover',
      bundleName: 'Frame + Cover Combo',
      event: 'click',
      source: 'homepage',
    });

    expect(result.success).toBe(true);
  });

  it('tracks an add_to_cart event', async () => {
    const result = await trackBundleImpression({
      bundleId: 'bundle-complete',
      bundleName: 'Complete Futon Set',
      event: 'add_to_cart',
      source: 'category',
    });

    expect(result.success).toBe(true);
  });

  it('tracks a purchase event with revenue', async () => {
    const result = await trackBundleImpression({
      bundleId: 'bundle-complete',
      bundleName: 'Complete Futon Set',
      event: 'purchase',
      revenue: 499.99,
      source: 'cart',
    });

    expect(result.success).toBe(true);
  });

  it('requires valid bundle ID', async () => {
    const result = await trackBundleImpression({
      bundleId: '',
      event: 'impression',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('bundle ID');
  });

  it('rejects invalid event type', async () => {
    const result = await trackBundleImpression({
      bundleId: 'bundle-1',
      event: 'invalid',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid event');
  });

  it('works for anonymous users', async () => {
    __setMember(null);
    const result = await trackBundleImpression({
      bundleId: 'bundle-1',
      bundleName: 'Test Bundle',
      event: 'impression',
      sessionId: 'session-abc123',
    });

    expect(result.success).toBe(true);
  });

  it('defaults source to product_page for invalid source', async () => {
    const result = await trackBundleImpression({
      bundleId: 'bundle-1',
      bundleName: 'Test',
      event: 'impression',
      source: 'invalid_source',
    });

    expect(result.success).toBe(true);
  });

  it('only records revenue for purchase events', async () => {
    const result = await trackBundleImpression({
      bundleId: 'bundle-1',
      bundleName: 'Test',
      event: 'impression',
      revenue: 999,
    });

    expect(result.success).toBe(true);
  });
});

// ── getBundleAnalytics ────────────────────────────────────────────────

describe('getBundleAnalytics', () => {
  it('returns analytics summary for a bundle', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'e-1', bundleId: 'bundle-1', bundleName: 'Frame + Cover', event: 'impression', timestamp: now },
      { _id: 'e-2', bundleId: 'bundle-1', bundleName: 'Frame + Cover', event: 'impression', timestamp: now },
      { _id: 'e-3', bundleId: 'bundle-1', bundleName: 'Frame + Cover', event: 'impression', timestamp: now },
      { _id: 'e-4', bundleId: 'bundle-1', bundleName: 'Frame + Cover', event: 'click', timestamp: now },
      { _id: 'e-5', bundleId: 'bundle-1', bundleName: 'Frame + Cover', event: 'add_to_cart', timestamp: now },
      { _id: 'e-6', bundleId: 'bundle-1', bundleName: 'Frame + Cover', event: 'purchase', revenue: 299.99, timestamp: now },
    ]);

    const result = await getBundleAnalytics('bundle-1', 30);
    expect(result.success).toBe(true);
    expect(result.analytics.impressions).toBe(3);
    expect(result.analytics.clicks).toBe(1);
    expect(result.analytics.addToCarts).toBe(1);
    expect(result.analytics.purchases).toBe(1);
    expect(result.analytics.totalRevenue).toBe(299.99);
    expect(result.analytics.conversionRate).toBeCloseTo(33.33, 0);
    expect(result.analytics.avgOrderValue).toBe(299.99);
  });

  it('returns zero rates when no impressions', async () => {
    __seed('BundleAnalytics', []);
    const result = await getBundleAnalytics('bundle-empty', 30);
    expect(result.success).toBe(true);
    expect(result.analytics.impressions).toBe(0);
    expect(result.analytics.conversionRate).toBe(0);
    expect(result.analytics.clickRate).toBe(0);
  });

  it('requires valid bundle ID', async () => {
    const result = await getBundleAnalytics('', 30);
    expect(result.success).toBe(false);
    expect(result.error).toContain('bundle ID');
  });

  it('clamps days to valid range', async () => {
    __seed('BundleAnalytics', []);
    const result = await getBundleAnalytics('bundle-1', 9999);
    expect(result.success).toBe(true);
    expect(result.analytics.period.days).toBe(365);
  });

  it('filters by date range', async () => {
    const now = new Date();
    const old = new Date();
    old.setDate(old.getDate() - 60);

    __seed('BundleAnalytics', [
      { _id: 'e-1', bundleId: 'bundle-1', bundleName: 'Test', event: 'impression', timestamp: now },
      { _id: 'e-2', bundleId: 'bundle-1', bundleName: 'Test', event: 'impression', timestamp: old },
    ]);

    const result = await getBundleAnalytics('bundle-1', 30);
    expect(result.success).toBe(true);
    expect(result.analytics.impressions).toBe(1);
  });
});

// ── getBundlePerformance ──────────────────────────────────────────────

describe('getBundlePerformance', () => {
  it('returns performance data sorted by revenue', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'e-1', bundleId: 'bundle-a', bundleName: 'Bundle A', event: 'impression', timestamp: now },
      { _id: 'e-2', bundleId: 'bundle-a', bundleName: 'Bundle A', event: 'purchase', revenue: 100, timestamp: now },
      { _id: 'e-3', bundleId: 'bundle-b', bundleName: 'Bundle B', event: 'impression', timestamp: now },
      { _id: 'e-4', bundleId: 'bundle-b', bundleName: 'Bundle B', event: 'purchase', revenue: 500, timestamp: now },
      { _id: 'e-5', bundleId: 'bundle-c', bundleName: 'Bundle C', event: 'impression', timestamp: now },
    ]);

    const result = await getBundlePerformance(30, 20);
    expect(result.success).toBe(true);
    expect(result.bundles).toHaveLength(3);
    expect(result.bundles[0].bundleId).toBe('bundle-b');
    expect(result.bundles[0].totalRevenue).toBe(500);
    expect(result.bundles[1].bundleId).toBe('bundle-a');
  });

  it('calculates conversion rates per bundle', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'e-1', bundleId: 'bundle-x', bundleName: 'Bundle X', event: 'impression', timestamp: now },
      { _id: 'e-2', bundleId: 'bundle-x', bundleName: 'Bundle X', event: 'impression', timestamp: now },
      { _id: 'e-3', bundleId: 'bundle-x', bundleName: 'Bundle X', event: 'purchase', revenue: 200, timestamp: now },
    ]);

    const result = await getBundlePerformance(30);
    expect(result.success).toBe(true);
    expect(result.bundles[0].conversionRate).toBe(50);
  });

  it('returns empty when no data', async () => {
    __seed('BundleAnalytics', []);
    const result = await getBundlePerformance();
    expect(result.success).toBe(true);
    expect(result.bundles).toHaveLength(0);
  });

  it('respects limit parameter', async () => {
    const now = new Date();
    const items = [];
    for (let i = 0; i < 10; i++) {
      items.push({ _id: `e-${i}`, bundleId: `bundle-${i}`, bundleName: `Bundle ${i}`, event: 'impression', timestamp: now });
    }
    __seed('BundleAnalytics', items);

    const result = await getBundlePerformance(30, 3);
    expect(result.success).toBe(true);
    expect(result.bundles).toHaveLength(3);
  });
});

// ── getRecommendedBundles ─────────────────────────────────────────────

describe('getRecommendedBundles', () => {
  it('recommends promoting high-performing bundles', async () => {
    const now = new Date();
    const items = [];
    // Bundle with 5% conversion and 3+ purchases
    for (let i = 0; i < 60; i++) {
      items.push({ _id: `imp-${i}`, bundleId: 'bundle-star', bundleName: 'Star Bundle', event: 'impression', source: 'product_page', timestamp: now });
    }
    for (let i = 0; i < 4; i++) {
      items.push({ _id: `pur-${i}`, bundleId: 'bundle-star', bundleName: 'Star Bundle', event: 'purchase', revenue: 300, source: 'product_page', timestamp: now });
    }
    __seed('BundleAnalytics', items);

    const result = await getRecommendedBundles(30);
    expect(result.success).toBe(true);
    const promo = result.recommendations.find(r => r.bundleId === 'bundle-star');
    expect(promo).toBeDefined();
    expect(promo.action).toBe('promote');
  });

  it('recommends price adjustment for high-cart low-conversion bundles', async () => {
    const now = new Date();
    const items = [];
    // 100 impressions, 15 add-to-carts (15%), 1 purchase (1%)
    for (let i = 0; i < 100; i++) {
      items.push({ _id: `imp-${i}`, bundleId: 'bundle-pricey', bundleName: 'Pricey Bundle', event: 'impression', source: 'homepage', timestamp: now });
    }
    for (let i = 0; i < 15; i++) {
      items.push({ _id: `atc-${i}`, bundleId: 'bundle-pricey', bundleName: 'Pricey Bundle', event: 'add_to_cart', source: 'homepage', timestamp: now });
    }
    items.push({ _id: 'pur-0', bundleId: 'bundle-pricey', bundleName: 'Pricey Bundle', event: 'purchase', revenue: 400, source: 'homepage', timestamp: now });
    __seed('BundleAnalytics', items);

    const result = await getRecommendedBundles(30);
    expect(result.success).toBe(true);
    const adj = result.recommendations.find(r => r.bundleId === 'bundle-pricey');
    expect(adj).toBeDefined();
    expect(adj.action).toBe('adjust_price');
  });

  it('recommends retiring zero-conversion bundles', async () => {
    const now = new Date();
    const items = [];
    // 60 impressions, 0 purchases
    for (let i = 0; i < 60; i++) {
      items.push({ _id: `imp-${i}`, bundleId: 'bundle-dead', bundleName: 'Dead Bundle', event: 'impression', source: 'category', timestamp: now });
    }
    __seed('BundleAnalytics', items);

    const result = await getRecommendedBundles(30);
    expect(result.success).toBe(true);
    const retire = result.recommendations.find(r => r.bundleId === 'bundle-dead');
    expect(retire).toBeDefined();
    expect(retire.action).toBe('retire');
  });

  it('recommends expanding placement for low-visibility bundles', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { _id: 'e-1', bundleId: 'bundle-hidden', bundleName: 'Hidden Bundle', event: 'impression', source: 'cart', timestamp: now },
      { _id: 'e-2', bundleId: 'bundle-hidden', bundleName: 'Hidden Bundle', event: 'impression', source: 'cart', timestamp: now },
    ]);

    const result = await getRecommendedBundles(30);
    expect(result.success).toBe(true);
    const expand = result.recommendations.find(r => r.bundleId === 'bundle-hidden');
    expect(expand).toBeDefined();
    expect(expand.action).toBe('expand_placement');
  });

  it('returns empty recommendations when no data', async () => {
    __seed('BundleAnalytics', []);
    const result = await getRecommendedBundles();
    expect(result.success).toBe(true);
    expect(result.recommendations).toHaveLength(0);
  });

  it('sorts recommendations by priority', async () => {
    const now = new Date();
    const items = [];
    // High performer (priority 1)
    for (let i = 0; i < 40; i++) {
      items.push({ _id: `star-imp-${i}`, bundleId: 'bundle-star', bundleName: 'Star', event: 'impression', source: 'homepage', timestamp: now });
    }
    for (let i = 0; i < 3; i++) {
      items.push({ _id: `star-pur-${i}`, bundleId: 'bundle-star', bundleName: 'Star', event: 'purchase', revenue: 200, source: 'homepage', timestamp: now });
    }
    // Low visibility (priority 2)
    items.push({ _id: 'hid-1', bundleId: 'bundle-low', bundleName: 'Low Vis', event: 'impression', source: 'cart', timestamp: now });
    __seed('BundleAnalytics', items);

    const result = await getRecommendedBundles(30);
    expect(result.success).toBe(true);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(result.recommendations[0].priority).toBeLessThanOrEqual(result.recommendations[1].priority);
  });
});
