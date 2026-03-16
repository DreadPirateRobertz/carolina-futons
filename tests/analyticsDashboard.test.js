import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { allProducts, analyticsRecords } from './fixtures/products.js';
import {
  getConversionFunnel,
  getTopConverters,
  getCategoryPerformance,
  getEmailFunnelMetrics,
  getRevenueAttribution,
  getDashboardSummary,
} from '../src/backend/analyticsDashboard.web.js';

beforeEach(() => {
  __seed('Stores/Products', allProducts);
  __seed('ProductAnalytics', analyticsRecords);
  __seed('EmailQueue', []);
});

// ── getConversionFunnel ─────────────────────────────────────────────

describe('getConversionFunnel', () => {
  it('returns three funnel stages', async () => {
    const funnel = await getConversionFunnel();
    expect(funnel.stages).toHaveLength(3);
    expect(funnel.stages[0].name).toBe('Product Views');
    expect(funnel.stages[1].name).toBe('Add to Cart');
    expect(funnel.stages[2].name).toBe('Purchase');
  });

  it('sums view counts from all analytics records', async () => {
    const funnel = await getConversionFunnel();
    // 150 + 120 + 80 = 350
    expect(funnel.stages[0].count).toBe(350);
  });

  it('sums add-to-cart counts', async () => {
    const funnel = await getConversionFunnel();
    // 30 + 25 + 8 = 63
    expect(funnel.stages[1].count).toBe(63);
  });

  it('sums purchase counts', async () => {
    const funnel = await getConversionFunnel();
    // 12 + 10 + 3 = 25
    expect(funnel.stages[2].count).toBe(25);
  });

  it('calculates view-to-cart conversion rate', async () => {
    const funnel = await getConversionFunnel();
    // 63 / 350 * 100 = 18
    expect(funnel.conversionRates.viewToCart).toBe(18);
  });

  it('calculates cart-to-purchase conversion rate', async () => {
    const funnel = await getConversionFunnel();
    // 25 / 63 * 100 = 39.68
    expect(funnel.conversionRates.cartToPurchase).toBe(39.68);
  });

  it('calculates view-to-purchase conversion rate', async () => {
    const funnel = await getConversionFunnel();
    // 25 / 350 * 100 = 7.14
    expect(funnel.conversionRates.viewToPurchase).toBe(7.14);
  });

  it('returns zeros when no analytics data', async () => {
    __seed('ProductAnalytics', []);
    const funnel = await getConversionFunnel();
    expect(funnel.stages[0].count).toBe(0);
    expect(funnel.conversionRates.viewToCart).toBe(0);
  });

  it('includes period string', async () => {
    const funnel = await getConversionFunnel(7);
    expect(funnel.period).toBe('7 days');
  });

  it('defaults to 30 days period', async () => {
    const funnel = await getConversionFunnel();
    expect(funnel.period).toBe('30 days');
  });

  it('stages have correct icons', async () => {
    const funnel = await getConversionFunnel();
    expect(funnel.stages[0].icon).toBe('eye');
    expect(funnel.stages[1].icon).toBe('cart');
    expect(funnel.stages[2].icon).toBe('check');
  });

  it('handles records with missing viewCount gracefully', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'p1', addToCartCount: 5, purchaseCount: 2 },
    ]);
    const funnel = await getConversionFunnel();
    expect(funnel.stages[0].count).toBe(0);
    expect(funnel.stages[1].count).toBe(5);
    expect(funnel.stages[2].count).toBe(2);
    expect(funnel.conversionRates.viewToCart).toBe(0);
  });
});

// ── getTopConverters ────────────────────────────────────────────────

describe('getTopConverters', () => {
  it('returns products sorted by conversion rate', async () => {
    const converters = await getTopConverters(10, 1);
    expect(converters.length).toBeGreaterThan(0);
    for (let i = 1; i < converters.length; i++) {
      expect(converters[i - 1].conversionRate).toBeGreaterThanOrEqual(converters[i].conversionRate);
    }
  });

  it('includes conversion rate for each product', async () => {
    const converters = await getTopConverters(10, 1);
    for (const c of converters) {
      expect(c).toHaveProperty('conversionRate');
      expect(c).toHaveProperty('productName');
      expect(c).toHaveProperty('viewCount');
      expect(c).toHaveProperty('addToCartCount');
    }
  });

  it('filters by minimum views', async () => {
    const converters = await getTopConverters(10, 100);
    for (const c of converters) {
      expect(c.viewCount).toBeGreaterThanOrEqual(100);
    }
  });

  it('respects limit', async () => {
    const converters = await getTopConverters(1, 1);
    expect(converters).toHaveLength(1);
  });

  it('returns empty for no data', async () => {
    __seed('ProductAnalytics', []);
    const converters = await getTopConverters();
    expect(converters).toEqual([]);
  });

  it('calculates correct conversion rate', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'p1', productName: 'Test', viewCount: 100, addToCartCount: 20, purchaseCount: 5, category: 'test' },
    ]);
    const converters = await getTopConverters(10, 1);
    expect(converters[0].conversionRate).toBe(20);
  });

  it('includes purchaseCount and category in output', async () => {
    const converters = await getTopConverters(10, 1);
    expect(converters[0]).toHaveProperty('purchaseCount');
    expect(converters[0]).toHaveProperty('category');
  });

  it('defaults productName to empty string when missing', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'p1', viewCount: 50, addToCartCount: 10, purchaseCount: 3 },
    ]);
    const converters = await getTopConverters(10, 1);
    expect(converters[0].productName).toBe('');
  });

  it('uses default limit of 10 and minViews of 10', async () => {
    const converters = await getTopConverters();
    // Should only return products with viewCount >= 10
    for (const c of converters) {
      expect(c.viewCount).toBeGreaterThanOrEqual(10);
    }
    expect(converters.length).toBeLessThanOrEqual(10);
  });
});

// ── getCategoryPerformance ──────────────────────────────────────────

describe('getCategoryPerformance', () => {
  it('returns performance by category', async () => {
    const cats = await getCategoryPerformance();
    expect(cats.length).toBeGreaterThan(0);
    for (const cat of cats) {
      expect(cat).toHaveProperty('category');
      expect(cat).toHaveProperty('views');
      expect(cat).toHaveProperty('addToCart');
      expect(cat).toHaveProperty('purchases');
      expect(cat).toHaveProperty('conversionRate');
    }
  });

  it('sorts by views descending', async () => {
    const cats = await getCategoryPerformance();
    for (let i = 1; i < cats.length; i++) {
      expect(cats[i - 1].views).toBeGreaterThanOrEqual(cats[i].views);
    }
  });

  it('aggregates correctly for futon-frames', async () => {
    const cats = await getCategoryPerformance();
    const frames = cats.find(c => c.category === 'futon-frames');
    expect(frames).toBeDefined();
    expect(frames.views).toBe(150);
    expect(frames.addToCart).toBe(30);
  });

  it('returns empty for no data', async () => {
    __seed('ProductAnalytics', []);
    const cats = await getCategoryPerformance();
    expect(cats).toEqual([]);
  });

  it('defaults missing category to uncategorized', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'p1', viewCount: 50, addToCartCount: 5, purchaseCount: 1 },
    ]);
    const cats = await getCategoryPerformance();
    expect(cats[0].category).toBe('uncategorized');
  });

  it('calculates conversionRate as addToCart/views percentage', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'p1', viewCount: 200, addToCartCount: 40, purchaseCount: 10, category: 'test' },
    ]);
    const cats = await getCategoryPerformance();
    expect(cats[0].conversionRate).toBe(20);
  });

  it('returns 0 conversionRate when views is 0', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'p1', viewCount: 0, addToCartCount: 0, purchaseCount: 0, category: 'test' },
    ]);
    const cats = await getCategoryPerformance();
    expect(cats[0].conversionRate).toBe(0);
  });
});

// ── getEmailFunnelMetrics ───────────────────────────────────────────

describe('getEmailFunnelMetrics', () => {
  it('aggregates email metrics by sequence type', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-3', sequenceType: 'welcome', status: 'failed', createdAt: new Date() },
      { _id: 'eq-4', sequenceType: 'cart_recovery', status: 'sent', createdAt: new Date() },
      { _id: 'eq-5', sequenceType: 'cart_recovery', status: 'cancelled', createdAt: new Date() },
    ]);

    const result = await getEmailFunnelMetrics();
    expect(result.metrics.welcome.sent).toBe(2);
    expect(result.metrics.welcome.failed).toBe(1);
    expect(result.metrics.cart_recovery.sent).toBe(1);
    expect(result.metrics.cart_recovery.cancelled).toBe(1);
    expect(result.totalEmails).toBe(5);
  });

  it('calculates delivery rate', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-3', sequenceType: 'welcome', status: 'failed', createdAt: new Date() },
      { _id: 'eq-4', sequenceType: 'welcome', status: 'pending', createdAt: new Date() },
    ]);

    const result = await getEmailFunnelMetrics();
    // 2 sent / 4 queued = 50%
    expect(result.metrics.welcome.deliveryRate).toBe(50);
  });

  it('returns empty metrics for no data', async () => {
    const result = await getEmailFunnelMetrics();
    expect(result.metrics).toEqual({});
    expect(result.totalEmails).toBe(0);
  });

  it('includes period string', async () => {
    const result = await getEmailFunnelMetrics(7);
    expect(result.period).toBe('7 days');
  });

  it('defaults to 30 days period', async () => {
    const result = await getEmailFunnelMetrics();
    expect(result.period).toBe('30 days');
  });

  it('groups unknown sequence type', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', status: 'sent', createdAt: new Date() },
    ]);
    const result = await getEmailFunnelMetrics();
    expect(result.metrics.unknown).toBeDefined();
    expect(result.metrics.unknown.sent).toBe(1);
  });

  it('queued count matches items per sequence', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'welcome', status: 'pending', createdAt: new Date() },
      { _id: 'eq-3', sequenceType: 'welcome', status: 'failed', createdAt: new Date() },
    ]);
    const result = await getEmailFunnelMetrics();
    expect(result.metrics.welcome.queued).toBe(3);
  });

  it('handles 100% delivery rate', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'promo', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'promo', status: 'sent', createdAt: new Date() },
    ]);
    const result = await getEmailFunnelMetrics();
    expect(result.metrics.promo.deliveryRate).toBe(100);
  });

  it('handles 0% delivery rate', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'promo', status: 'failed', createdAt: new Date() },
    ]);
    const result = await getEmailFunnelMetrics();
    expect(result.metrics.promo.deliveryRate).toBe(0);
  });
});

// ── getRevenueAttribution ───────────────────────────────────────────

describe('getRevenueAttribution', () => {
  it('returns top products by purchase count with revenue', async () => {
    const result = await getRevenueAttribution(10);
    expect(result.topProducts.length).toBeGreaterThan(0);
    expect(result.totalAttributedRevenue).toBeGreaterThan(0);
  });

  it('calculates attributed revenue from price * purchases', async () => {
    const result = await getRevenueAttribution(10);
    const frame = result.topProducts.find(p => p.productId === 'prod-frame-001');
    // 499 * 12 = 5988
    expect(frame).toBeDefined();
    expect(frame.attributedRevenue).toBe(5988);
  });

  it('filters out products with zero purchases', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'prod-frame-001', productName: 'Test', viewCount: 100, addToCartCount: 10, purchaseCount: 0, category: 'test' },
    ]);
    const result = await getRevenueAttribution(10);
    expect(result.topProducts).toHaveLength(0);
    expect(result.totalAttributedRevenue).toBe(0);
  });

  it('returns empty for no data', async () => {
    __seed('ProductAnalytics', []);
    const result = await getRevenueAttribution();
    expect(result.topProducts).toEqual([]);
    expect(result.totalAttributedRevenue).toBe(0);
  });

  it('uses discounted price when available', async () => {
    // prod-matt-001 has discountedPrice: 299
    const result = await getRevenueAttribution(10);
    const mattress = result.topProducts.find(p => p.productId === 'prod-matt-001');
    // 299 * 10 = 2990
    expect(mattress).toBeDefined();
    expect(mattress.attributedRevenue).toBe(2990);
  });

  it('respects limit', async () => {
    const result = await getRevenueAttribution(1);
    expect(result.topProducts.length).toBeLessThanOrEqual(1);
  });

  it('falls back to product.name when analytics productName missing', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'prod-frame-001', viewCount: 100, addToCartCount: 20, purchaseCount: 5 },
    ]);
    const result = await getRevenueAttribution(10);
    const prod = result.topProducts.find(p => p.productId === 'prod-frame-001');
    expect(prod).toBeDefined();
    expect(prod.productName.length).toBeGreaterThan(0);
  });

  it('returns 0 price when product not found in Stores/Products', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'nonexistent-id', productName: 'Ghost', viewCount: 50, addToCartCount: 10, purchaseCount: 5, category: 'test' },
    ]);
    __seed('Stores/Products', []);
    const result = await getRevenueAttribution(10);
    const ghost = result.topProducts.find(p => p.productId === 'nonexistent-id');
    expect(ghost).toBeDefined();
    expect(ghost.price).toBe(0);
    expect(ghost.attributedRevenue).toBe(0);
  });

  it('defaults limit to 10', async () => {
    const result = await getRevenueAttribution();
    expect(result.topProducts.length).toBeLessThanOrEqual(10);
  });

  it('includes category in output', async () => {
    const result = await getRevenueAttribution(10);
    for (const p of result.topProducts) {
      expect(p).toHaveProperty('category');
    }
  });
});

// ── getDashboardSummary ─────────────────────────────────────────────

describe('getDashboardSummary', () => {
  it('returns unified dashboard KPIs', async () => {
    const summary = await getDashboardSummary();
    expect(summary).toHaveProperty('funnel');
    expect(summary).toHaveProperty('totalViews');
    expect(summary).toHaveProperty('totalAddToCart');
    expect(summary).toHaveProperty('totalPurchases');
    expect(summary).toHaveProperty('topCategory');
    expect(summary).toHaveProperty('emailsSent');
    expect(summary).toHaveProperty('totalRevenue');
    expect(summary).toHaveProperty('period');
  });

  it('has correct total views', async () => {
    const summary = await getDashboardSummary();
    expect(summary.totalViews).toBe(350);
  });

  it('includes funnel conversion rates', async () => {
    const summary = await getDashboardSummary();
    expect(summary.funnel).toHaveProperty('viewToCart');
    expect(summary.funnel).toHaveProperty('cartToPurchase');
    expect(summary.funnel).toHaveProperty('viewToPurchase');
  });

  it('identifies top category by views', async () => {
    const summary = await getDashboardSummary();
    expect(summary.topCategory).toBe('futon-frames');
  });

  it('includes revenue total', async () => {
    const summary = await getDashboardSummary();
    expect(summary.totalRevenue).toBeGreaterThan(0);
  });

  it('works with empty data', async () => {
    __seed('ProductAnalytics', []);
    __seed('EmailQueue', []);
    const summary = await getDashboardSummary();
    expect(summary.totalViews).toBe(0);
    expect(summary.totalRevenue).toBe(0);
    expect(summary.topCategory).toBe('none');
  });

  it('respects days parameter', async () => {
    const summary = await getDashboardSummary(7);
    expect(summary.period).toBe('7 days');
  });

  it('includes emailsSent from email queue', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-3', sequenceType: 'promo', status: 'failed', createdAt: new Date() },
    ]);
    const summary = await getDashboardSummary();
    expect(summary.emailsSent).toBe(2);
  });

  it('totalAddToCart matches funnel data', async () => {
    const summary = await getDashboardSummary();
    expect(summary.totalAddToCart).toBe(63);
  });

  it('totalPurchases matches funnel data', async () => {
    const summary = await getDashboardSummary();
    expect(summary.totalPurchases).toBe(25);
  });
});
