import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ge: (field, val) => { filters[`${field}_ge`] = { type: 'ge', field, value: val }; return chain; },
    hasSome: (field, vals) => { filters[`${field}_hasSome`] = { type: 'hasSome', field, value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ge') items = items.filter(i => (i[f.field] || 0) >= f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[f.field]));
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/analyticsDashboard.web.js');
});

// ── getConversionFunnel ──────────────────────────────────────────

describe('getConversionFunnel', () => {
  it('returns zeros for no data', async () => {
    __seed('ProductAnalytics', []);
    const r = await mod.getConversionFunnel();
    expect(r.stages).toHaveLength(3);
    expect(r.stages[0].count).toBe(0);
    expect(r.conversionRates.viewToCart).toBe(0);
  });

  it('calculates conversion rates', async () => {
    __seed('ProductAnalytics', [
      { viewCount: 100, addToCartCount: 20, purchaseCount: 5 },
      { viewCount: 200, addToCartCount: 30, purchaseCount: 10 },
    ]);
    const r = await mod.getConversionFunnel();
    expect(r.stages[0].count).toBe(300); // 100+200
    expect(r.stages[1].count).toBe(50);  // 20+30
    expect(r.stages[2].count).toBe(15);  // 5+10
    expect(r.conversionRates.viewToCart).toBeCloseTo(16.67, 1);
    expect(r.conversionRates.cartToPurchase).toBe(30);
    expect(r.conversionRates.viewToPurchase).toBe(5);
  });

  it('includes period string', async () => {
    __seed('ProductAnalytics', []);
    const r = await mod.getConversionFunnel(7);
    expect(r.period).toBe('7 days');
  });
});

// ── getTopConverters ─────────────────────────────────────────────

describe('getTopConverters', () => {
  it('returns empty for no data', async () => {
    __seed('ProductAnalytics', []);
    const r = await mod.getTopConverters();
    expect(r).toEqual([]);
  });

  it('sorts by conversion rate descending', async () => {
    __seed('ProductAnalytics', [
      { productId: 'p1', productName: 'Futon A', viewCount: 100, addToCartCount: 10, purchaseCount: 2 },
      { productId: 'p2', productName: 'Futon B', viewCount: 50, addToCartCount: 25, purchaseCount: 5 },
    ]);
    const r = await mod.getTopConverters(10, 10);
    expect(r[0].productId).toBe('p2'); // 50% vs 10%
    expect(r[0].conversionRate).toBe(50);
    expect(r[1].conversionRate).toBe(10);
  });

  it('filters by minimum views', async () => {
    __seed('ProductAnalytics', [
      { productId: 'p1', viewCount: 5, addToCartCount: 3 },
      { productId: 'p2', viewCount: 20, addToCartCount: 5 },
    ]);
    const r = await mod.getTopConverters(10, 10);
    expect(r).toHaveLength(1);
    expect(r[0].productId).toBe('p2');
  });

  it('respects limit', async () => {
    __seed('ProductAnalytics', [
      { productId: 'p1', viewCount: 100, addToCartCount: 10 },
      { productId: 'p2', viewCount: 200, addToCartCount: 20 },
      { productId: 'p3', viewCount: 150, addToCartCount: 15 },
    ]);
    const r = await mod.getTopConverters(2, 10);
    expect(r).toHaveLength(2);
  });
});

// ── getCategoryPerformance ───────────────────────────────────────

describe('getCategoryPerformance', () => {
  it('returns empty for no data', async () => {
    __seed('ProductAnalytics', []);
    const r = await mod.getCategoryPerformance();
    expect(r).toEqual([]);
  });

  it('aggregates by category', async () => {
    __seed('ProductAnalytics', [
      { category: 'futons', viewCount: 100, addToCartCount: 20, purchaseCount: 5 },
      { category: 'futons', viewCount: 50, addToCartCount: 10, purchaseCount: 2 },
      { category: 'covers', viewCount: 80, addToCartCount: 16, purchaseCount: 4 },
    ]);
    const r = await mod.getCategoryPerformance();
    expect(r).toHaveLength(2);
    const futons = r.find(c => c.category === 'futons');
    expect(futons.views).toBe(150);
    expect(futons.addToCart).toBe(30);
    expect(futons.conversionRate).toBe(20);
  });

  it('sorts by views descending', async () => {
    __seed('ProductAnalytics', [
      { category: 'covers', viewCount: 50 },
      { category: 'futons', viewCount: 200 },
    ]);
    const r = await mod.getCategoryPerformance();
    expect(r[0].category).toBe('futons');
  });

  it('uses uncategorized for missing category', async () => {
    __seed('ProductAnalytics', [{ viewCount: 10, addToCartCount: 1 }]);
    const r = await mod.getCategoryPerformance();
    expect(r[0].category).toBe('uncategorized');
  });
});

// ── getEmailFunnelMetrics ────────────────────────────────────────

describe('getEmailFunnelMetrics', () => {
  it('returns empty for no emails', async () => {
    __seed('EmailQueue', []);
    const r = await mod.getEmailFunnelMetrics();
    expect(r.totalEmails).toBe(0);
    expect(r.metrics).toEqual({});
  });

  it('aggregates by sequence type', async () => {
    __seed('EmailQueue', [
      { sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { sequenceType: 'welcome', status: 'failed', createdAt: new Date() },
      { sequenceType: 'abandoned_cart', status: 'sent', createdAt: new Date() },
    ]);
    const r = await mod.getEmailFunnelMetrics();
    expect(r.totalEmails).toBe(4);
    expect(r.metrics.welcome.queued).toBe(3);
    expect(r.metrics.welcome.sent).toBe(2);
    expect(r.metrics.welcome.failed).toBe(1);
    expect(r.metrics.welcome.deliveryRate).toBeCloseTo(66.67, 1);
    expect(r.metrics.abandoned_cart.sent).toBe(1);
  });

  it('includes period string', async () => {
    __seed('EmailQueue', []);
    const r = await mod.getEmailFunnelMetrics(7);
    expect(r.period).toBe('7 days');
  });
});

// ── getRevenueAttribution ────────────────────────────────────────

describe('getRevenueAttribution', () => {
  it('returns empty for no data', async () => {
    __seed('ProductAnalytics', []);
    const r = await mod.getRevenueAttribution();
    expect(r.topProducts).toEqual([]);
    expect(r.totalAttributedRevenue).toBe(0);
  });

  it('calculates attributed revenue', async () => {
    __seed('ProductAnalytics', [
      { productId: 'p1', productName: 'Futon A', purchaseCount: 10 },
      { productId: 'p2', productName: 'Futon B', purchaseCount: 5 },
    ]);
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Futon A', price: 400 },
      { _id: 'p2', name: 'Futon B', discountedPrice: 350, price: 500 },
    ]);
    const r = await mod.getRevenueAttribution();
    expect(r.topProducts).toHaveLength(2);
    expect(r.topProducts[0].attributedRevenue).toBe(4000); // 10 * 400
    expect(r.topProducts[1].attributedRevenue).toBe(1750); // 5 * 350
    expect(r.totalAttributedRevenue).toBe(5750);
  });

  it('filters out zero-purchase products', async () => {
    __seed('ProductAnalytics', [
      { productId: 'p1', purchaseCount: 0 },
      { productId: 'p2', purchaseCount: 3 },
    ]);
    __seed('Stores/Products', [
      { _id: 'p2', price: 100 },
    ]);
    const r = await mod.getRevenueAttribution();
    expect(r.topProducts).toHaveLength(1);
  });
});

// ── getDashboardSummary ──────────────────────────────────────────

describe('getDashboardSummary', () => {
  it('returns complete summary with data', async () => {
    __seed('ProductAnalytics', [
      { productId: 'p1', productName: 'Futon A', category: 'futons', viewCount: 100, addToCartCount: 20, purchaseCount: 5 },
    ]);
    __seed('EmailQueue', [
      { sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
    ]);
    __seed('Stores/Products', [
      { _id: 'p1', price: 400 },
    ]);
    const r = await mod.getDashboardSummary();
    expect(r.totalViews).toBe(100);
    expect(r.totalAddToCart).toBe(20);
    expect(r.totalPurchases).toBe(5);
    expect(r.topCategory).toBe('futons');
    expect(r.emailsSent).toBe(1);
    expect(r.totalRevenue).toBe(2000);
    expect(r.period).toBe('30 days');
  });

  it('returns defaults for empty data', async () => {
    __seed('ProductAnalytics', []);
    __seed('EmailQueue', []);
    __seed('Stores/Products', []);
    const r = await mod.getDashboardSummary();
    expect(r.totalViews).toBe(0);
    expect(r.topCategory).toBe('none');
    expect(r.emailsSent).toBe(0);
    expect(r.totalRevenue).toBe(0);
  });
});
