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
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let _mockMember = { _id: 'member1' };
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: async () => _mockMember },
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
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit' || key === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ge') items = items.filter(i => i[f.field] >= f.value);
      }
      const skip = filters._skip || 0;
      const limit = filters._limit || items.length;
      items = items.slice(skip, skip + limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _mockMember = { _id: 'member1' };
  vi.resetModules();
  mod = await import('../src/backend/bundleAnalytics.web.js');
});


describe('getBundleAnalytics', () => {
  it('rejects invalid bundle ID', async () => {
    const r = await mod.getBundleAnalytics(null);
    expect(r.success).toBe(false);
  });

  it('returns zeros for bundle with no data', async () => {
    __seed('BundleAnalytics', []);
    const r = await mod.getBundleAnalytics('b1');
    expect(r.success).toBe(true);
    expect(r.analytics.impressions).toBe(0);
    expect(r.analytics.conversionRate).toBe(0);
  });

  it('calculates analytics correctly', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { bundleId: 'b1', bundleName: 'Test', event: 'impression', timestamp: now },
      { bundleId: 'b1', bundleName: 'Test', event: 'impression', timestamp: now },
      { bundleId: 'b1', bundleName: 'Test', event: 'click', timestamp: now },
      { bundleId: 'b1', bundleName: 'Test', event: 'add_to_cart', timestamp: now },
      { bundleId: 'b1', bundleName: 'Test', event: 'purchase', revenue: 500, timestamp: now },
    ]);
    const r = await mod.getBundleAnalytics('b1');
    expect(r.analytics.impressions).toBe(2);
    expect(r.analytics.clicks).toBe(1);
    expect(r.analytics.addToCarts).toBe(1);
    expect(r.analytics.purchases).toBe(1);
    expect(r.analytics.totalRevenue).toBe(500);
    expect(r.analytics.clickRate).toBe(50); // 1/2 * 100
    expect(r.analytics.conversionRate).toBe(50); // 1/2 * 100
    expect(r.analytics.avgOrderValue).toBe(500);
  });

  it('defaults days to 30 for falsy value', async () => {
    __seed('BundleAnalytics', []);
    const r = await mod.getBundleAnalytics('b1', 0);
    expect(r.success).toBe(true);
    expect(r.analytics.period.days).toBe(30);
  });
});

// ── getBundlePerformance ───────────────────────────────────────────

describe('getBundlePerformance', () => {
  it('returns empty when no data', async () => {
    __seed('BundleAnalytics', []);
    const r = await mod.getBundlePerformance();
    expect(r.success).toBe(true);
    expect(r.bundles).toHaveLength(0);
  });

  it('groups by bundleId and sorts by revenue', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { bundleId: 'b1', bundleName: 'Bundle A', event: 'purchase', revenue: 200, timestamp: now },
      { bundleId: 'b2', bundleName: 'Bundle B', event: 'purchase', revenue: 500, timestamp: now },
      { bundleId: 'b1', bundleName: 'Bundle A', event: 'impression', timestamp: now },
      { bundleId: 'b2', bundleName: 'Bundle B', event: 'impression', timestamp: now },
    ]);
    const r = await mod.getBundlePerformance();
    expect(r.bundles).toHaveLength(2);
    expect(r.bundles[0].bundleId).toBe('b2'); // Higher revenue first
    expect(r.bundles[0].totalRevenue).toBe(500);
  });

  it('caps limit at 50', async () => {
    const r = await mod.getBundlePerformance(30, 100);
    expect(r.success).toBe(true);
  });
});

// ── getRecommendedBundles ──────────────────────────────────────────

describe('getRecommendedBundles', () => {
  it('returns empty when no data', async () => {
    __seed('BundleAnalytics', []);
    const r = await mod.getRecommendedBundles();
    expect(r.success).toBe(true);
    expect(r.recommendations).toHaveLength(0);
  });

  it('recommends promoting high performers', async () => {
    const now = new Date();
    const events = [];
    // 20 impressions, 3 purchases = 15% conv rate
    for (let i = 0; i < 20; i++) events.push({ bundleId: 'b1', bundleName: 'Star', event: 'impression', timestamp: now, source: 'homepage' });
    for (let i = 0; i < 3; i++) events.push({ bundleId: 'b1', bundleName: 'Star', event: 'purchase', revenue: 500, timestamp: now });
    __seed('BundleAnalytics', events);

    const r = await mod.getRecommendedBundles();
    const promote = r.recommendations.find(rec => rec.action === 'promote');
    expect(promote).toBeTruthy();
    expect(promote.bundleId).toBe('b1');
  });

  it('recommends retiring zero-conversion bundles', async () => {
    const now = new Date();
    const events = [];
    for (let i = 0; i < 55; i++) events.push({ bundleId: 'b1', bundleName: 'Dud', event: 'impression', timestamp: now, source: 'homepage' });
    __seed('BundleAnalytics', events);

    const r = await mod.getRecommendedBundles();
    const retire = r.recommendations.find(rec => rec.action === 'retire');
    expect(retire).toBeTruthy();
  });

  it('recommends expanding placement for low-visibility bundles', async () => {
    const now = new Date();
    __seed('BundleAnalytics', [
      { bundleId: 'b1', bundleName: 'Hidden', event: 'impression', timestamp: now, source: 'product_page' },
    ]);

    const r = await mod.getRecommendedBundles();
    const expand = r.recommendations.find(rec => rec.action === 'expand_placement');
    expect(expand).toBeTruthy();
    expect(expand.reason).toContain('1 source');
  });

  it('sorts recommendations by priority', async () => {
    const now = new Date();
    const events = [];
    // High performer
    for (let i = 0; i < 20; i++) events.push({ bundleId: 'b1', bundleName: 'Star', event: 'impression', timestamp: now, source: 'homepage' });
    for (let i = 0; i < 3; i++) events.push({ bundleId: 'b1', bundleName: 'Star', event: 'purchase', revenue: 500, timestamp: now });
    // Low visibility
    events.push({ bundleId: 'b2', bundleName: 'Hidden', event: 'impression', timestamp: now, source: 'cart' });
    __seed('BundleAnalytics', events);

    const r = await mod.getRecommendedBundles();
    expect(r.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(r.recommendations[0].priority).toBeLessThanOrEqual(r.recommendations[1].priority);
  });
});
