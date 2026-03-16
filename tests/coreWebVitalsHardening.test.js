import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Inline mocks ─────────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

let _collections = {};
let _insertCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}
function __onInsert(cb) { _insertCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = [];
  let _limit = null;
  const chain = {
    eq: (field, val) => { filters.push({ field, type: 'eq', value: val }); return chain; },
    ne: (field, val) => { filters.push({ field, type: 'ne', value: val }); return chain; },
    ge: (field, val) => { filters.push({ field, type: 'ge', value: val }); return chain; },
    le: (field, val) => { filters.push({ field, type: 'le', value: val }); return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { _limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const f of filters) {
        if (f.type === 'eq') items = items.filter(i => i[f.field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
        if (f.type === 'ge') items = items.filter(i => i[f.field] >= f.value);
        if (f.type === 'le') items = items.filter(i => i[f.field] <= f.value);
      }
      if (_limit) items = items.slice(0, _limit);
      return { items, totalCount: items.length };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const f of filters) {
        if (f.type === 'eq') items = items.filter(i => i[f.field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
        if (f.type === 'ge') items = items.filter(i => i[f.field] >= f.value);
        if (f.type === 'le') items = items.filter(i => i[f.field] <= f.value);
      }
      return items.length;
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => (_collections[col] || []).find(i => i._id === id) || null),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || `ins-${Date.now()}` };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
    update: vi.fn(async (col, item) => {
      _collections[col] = (_collections[col] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      return item;
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
});

const mod = await import('../src/backend/coreWebVitals.web.js');
const {
  reportMetrics,
  getPerformanceSummary,
  getPagePerformance,
  getImageOptimizationHints,
  getLazyLoadConfig,
  checkPerformanceBudget,
  getBaseline,
  measureVitals,
  DEFAULT_THRESHOLDS,
  VALID_METRICS,
  VALID_DEVICE_TYPES,
  clampMetric,
  percentile,
  rateMetric,
  getWorstRating,
  checkBudgetViolations,
  getTargetDimensions,
} = mod;

// ═══════════════════════════════════════════════════════════════════
// getBaseline — snapshot current performance state
// ═══════════════════════════════════════════════════════════════════
describe('getBaseline', () => {
  it('returns baseline with all core vitals', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 2000, fid: 80, inp: 150, cls: 0.08, ttfb: 500, fcp: 1200, deviceType: 'desktop', page: '/home', timestamp: new Date() },
      { lcp: 2500, fid: 100, inp: 200, cls: 0.12, ttfb: 600, fcp: 1500, deviceType: 'desktop', page: '/home', timestamp: new Date() },
      { lcp: 3500, fid: 150, inp: 350, cls: 0.20, ttfb: 900, fcp: 2000, deviceType: 'mobile', page: '/product', timestamp: new Date() },
      { lcp: 4000, fid: 200, inp: 400, cls: 0.25, ttfb: 1000, fcp: 2200, deviceType: 'mobile', page: '/product', timestamp: new Date() },
    ]);

    const result = await getBaseline();
    expect(result.success).toBe(true);
    expect(result.baseline).toBeDefined();
    expect(result.baseline.overall).toBeDefined();
    expect(result.baseline.overall.lcp).toBeDefined();
    expect(result.baseline.overall.lcp.p75).toBeGreaterThan(0);
    expect(result.baseline.overall.lcp.rating).toBeDefined();
  });

  it('includes per-device breakdown', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 1500, inp: 100, cls: 0.05, deviceType: 'desktop', page: '/home', timestamp: new Date() },
      { lcp: 3000, inp: 300, cls: 0.15, deviceType: 'mobile', page: '/home', timestamp: new Date() },
    ]);

    const result = await getBaseline();
    expect(result.baseline.byDevice).toBeDefined();
    expect(result.baseline.byDevice.desktop).toBeDefined();
    expect(result.baseline.byDevice.mobile).toBeDefined();
  });

  it('includes per-page breakdown', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 1500, inp: 100, cls: 0.05, deviceType: 'desktop', page: '/home', timestamp: new Date() },
      { lcp: 2500, inp: 200, cls: 0.10, deviceType: 'desktop', page: '/product', timestamp: new Date() },
    ]);

    const result = await getBaseline();
    expect(result.baseline.byPage).toBeDefined();
    expect(Object.keys(result.baseline.byPage).length).toBeGreaterThanOrEqual(1);
  });

  it('includes timestamp for when baseline was captured', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 2000, inp: 150, cls: 0.08, deviceType: 'desktop', page: '/home', timestamp: new Date() },
    ]);

    const result = await getBaseline();
    expect(result.baseline.capturedAt).toBeDefined();
    expect(new Date(result.baseline.capturedAt)).toBeInstanceOf(Date);
  });

  it('returns no-data baseline when no metrics exist', async () => {
    __seed('PerformanceMetrics', []);

    const result = await getBaseline();
    expect(result.success).toBe(true);
    expect(result.baseline.overall.lcp.rating).toBe('no-data');
    expect(result.baseline.sampleCount).toBe(0);
  });

  it('includes sample count', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 2000, inp: 150, cls: 0.08, deviceType: 'desktop', page: '/home', timestamp: new Date() },
      { lcp: 2500, inp: 200, cls: 0.10, deviceType: 'mobile', page: '/home', timestamp: new Date() },
    ]);

    const result = await getBaseline();
    expect(result.baseline.sampleCount).toBe(2);
  });

  it('rates each metric against Google thresholds', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 1500, fid: 50, inp: 100, cls: 0.05, ttfb: 400, fcp: 1000, deviceType: 'desktop', page: '/home', timestamp: new Date() },
    ]);

    const result = await getBaseline();
    expect(result.baseline.overall.lcp.rating).toBe('good');
    expect(result.baseline.overall.cls.rating).toBe('good');
    expect(result.baseline.overall.inp.rating).toBe('good');
  });

  it('accepts custom days parameter', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 2000, inp: 150, cls: 0.08, deviceType: 'desktop', page: '/home', timestamp: new Date() },
    ]);

    const result = await getBaseline({ days: 30 });
    expect(result.success).toBe(true);
    expect(result.baseline.period).toBe('30 days');
  });

  it('includes overall pass/fail status', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 5000, inp: 600, cls: 0.5, deviceType: 'desktop', page: '/home', timestamp: new Date() },
    ]);

    const result = await getBaseline();
    expect(result.baseline.overallRating).toBe('poor');
  });
});

// ═══════════════════════════════════════════════════════════════════
// measureVitals — frontend collection helper
// ═══════════════════════════════════════════════════════════════════
describe('measureVitals', () => {
  it('accepts and stores LCP measurement', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    const result = await measureVitals({
      sessionId: 'sess-1',
      page: '/home',
      deviceType: 'desktop',
      vitals: { lcp: 1800 },
    });
    expect(result.success).toBe(true);
    expect(inserted).not.toBeNull();
    expect(inserted.lcp).toBe(1800);
  });

  it('accepts and stores FID measurement', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    const result = await measureVitals({
      sessionId: 'sess-1',
      page: '/home',
      vitals: { fid: 45 },
    });
    expect(result.success).toBe(true);
    expect(inserted.fid).toBe(45);
  });

  it('accepts and stores CLS measurement', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    const result = await measureVitals({
      sessionId: 'sess-1',
      page: '/product',
      vitals: { cls: 0.12 },
    });
    expect(result.success).toBe(true);
    expect(inserted.cls).toBe(0.12);
  });

  it('accepts all vitals at once', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    const result = await measureVitals({
      sessionId: 'sess-1',
      page: '/home',
      deviceType: 'mobile',
      connectionType: '4g',
      vitals: { lcp: 2500, fid: 80, inp: 200, cls: 0.1, ttfb: 600, fcp: 1500 },
    });
    expect(result.success).toBe(true);
    expect(inserted.lcp).toBe(2500);
    expect(inserted.fid).toBe(80);
    expect(inserted.inp).toBe(200);
    expect(inserted.cls).toBe(0.1);
    expect(inserted.ttfb).toBe(600);
    expect(inserted.fcp).toBe(1500);
    expect(inserted.deviceType).toBe('mobile');
    expect(inserted.connectionType).toBe('4g');
  });

  it('returns violations when vitals are poor', async () => {
    const result = await measureVitals({
      sessionId: 'sess-1',
      page: '/home',
      vitals: { lcp: 5000, cls: 0.5 },
    });
    expect(result.success).toBe(true);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('returns rating for each reported vital', async () => {
    const result = await measureVitals({
      sessionId: 'sess-1',
      page: '/home',
      vitals: { lcp: 1500, cls: 0.05, inp: 100 },
    });
    expect(result.ratings).toBeDefined();
    expect(result.ratings.lcp).toBe('good');
    expect(result.ratings.cls).toBe('good');
    expect(result.ratings.inp).toBe('good');
  });

  it('rejects missing sessionId', async () => {
    const result = await measureVitals({ page: '/home', vitals: { lcp: 1000 } });
    expect(result.success).toBe(false);
    expect(result.error).toContain('sessionId');
  });

  it('rejects missing page', async () => {
    const result = await measureVitals({ sessionId: 'sess-1', vitals: { lcp: 1000 } });
    expect(result.success).toBe(false);
    expect(result.error).toContain('page');
  });

  it('rejects missing vitals', async () => {
    const result = await measureVitals({ sessionId: 'sess-1', page: '/home' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('vitals');
  });

  it('clamps extreme values', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await measureVitals({
      sessionId: 'sess-1',
      page: '/home',
      vitals: { lcp: 999999, cls: -5, fid: NaN },
    });
    expect(inserted.lcp).toBe(60000);
    expect(inserted.cls).toBe(0);
    expect(inserted.fid).toBe(0);
  });

  it('defaults deviceType to desktop', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await measureVitals({
      sessionId: 'sess-1',
      page: '/home',
      vitals: { lcp: 1500 },
    });
    expect(inserted.deviceType).toBe('desktop');
  });

  it('defaults connectionType to unknown', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await measureVitals({
      sessionId: 'sess-1',
      page: '/home',
      vitals: { lcp: 1500 },
    });
    expect(inserted.connectionType).toBe('unknown');
  });

  it('handles null vitals gracefully', async () => {
    const result = await measureVitals({ sessionId: 'sess-1', page: '/home', vitals: null });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Hardening: clampMetric with isFinite guard
// ═══════════════════════════════════════════════════════════════════
describe('clampMetric — isFinite hardening', () => {
  it('returns 0 for Infinity', () => {
    expect(clampMetric(Infinity, 0, 60000)).toBe(0);
  });

  it('returns 0 for -Infinity', () => {
    expect(clampMetric(-Infinity, 0, 60000)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(clampMetric(NaN, 0, 1000)).toBe(0);
  });

  it('allows valid numbers', () => {
    expect(clampMetric(500, 0, 1000)).toBe(500);
    expect(clampMetric(0, 0, 1000)).toBe(0);
    expect(clampMetric(1000, 0, 1000)).toBe(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Hardening: percentile with edge cases
// ═══════════════════════════════════════════════════════════════════
describe('percentile — hardening edge cases', () => {
  it('handles very large arrays', () => {
    const values = Array.from({ length: 1000 }, (_, i) => i + 1);
    const p75 = percentile(values, 75);
    expect(p75).toBe(750);
  });

  it('handles all identical values', () => {
    expect(percentile([100, 100, 100, 100], 75)).toBe(100);
  });

  it('handles array of two values', () => {
    const values = [10, 20];
    expect(percentile(values, 50)).toBe(10);
    expect(percentile(values, 75)).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Hardening: reportMetrics with Infinity
// ═══════════════════════════════════════════════════════════════════
describe('reportMetrics — Infinity hardening', () => {
  it('clamps Infinity LCP to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', lcp: Infinity });
    expect(inserted.lcp).toBe(0);
  });

  it('clamps -Infinity FID to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', fid: -Infinity });
    expect(inserted.fid).toBe(0);
  });
});
