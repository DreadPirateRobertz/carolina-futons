import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};
let _insertCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}
function __onInsert(cb) { _insertCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ge: (field, val) => { filters[field] = { type: 'ge', value: val }; return chain; },
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field.startsWith('_')) continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ge') items = items.filter(i => i[field] >= f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => (_collections[col] || []).find(i => i._id === id) || null),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || 'a1b2c3d4-0000-0000-0000-000000000001' };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
}));

import {
  reportMetrics,
  getPerformanceSummary,
  getPagePerformance,
  getImageOptimizationHints,
  getLazyLoadConfig,
  checkPerformanceBudget,
  DEFAULT_THRESHOLDS,
  VALID_METRICS,
  VALID_DEVICE_TYPES,
  clampMetric,
  percentile,
  rateMetric,
  getWorstRating,
  checkBudgetViolations,
  getTargetDimensions,
} from '../src/backend/coreWebVitals.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
});

// ── clampMetric — deep edge cases ───────────────────────────────────

describe('clampMetric — deep edge cases', () => {
  it('returns 0 for NaN', () => {
    expect(clampMetric(NaN, 0, 1000)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(clampMetric(undefined, 0, 1000)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(clampMetric(null, 0, 1000)).toBe(0);
  });

  it('returns 0 for string', () => {
    expect(clampMetric('500', 0, 1000)).toBe(0);
  });

  it('clamps below min', () => {
    expect(clampMetric(-5, 0, 1000)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clampMetric(99999, 0, 1000)).toBe(1000);
  });

  it('returns value within range', () => {
    expect(clampMetric(500, 0, 1000)).toBe(500);
  });

  it('returns 0 for Infinity (isNaN check passes but clamp catches)', () => {
    // typeof Infinity === 'number', isNaN(Infinity) === false
    // So Infinity passes the guard, gets clamped to max
    expect(clampMetric(Infinity, 0, 60000)).toBe(60000);
  });

  it('returns min for -Infinity', () => {
    expect(clampMetric(-Infinity, 0, 60000)).toBe(0);
  });
});

// ── percentile — deep edge cases ────────────────────────────────────

describe('percentile — deep edge cases', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 75)).toBe(0);
  });

  it('returns single value for array of one', () => {
    expect(percentile([42], 75)).toBe(42);
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 1)).toBe(42);
  });

  it('returns correct p75 for 4 values', () => {
    // sorted: [100, 200, 300, 400]
    // p75: ceil(0.75 * 4) - 1 = ceil(3) - 1 = 2 → values[2] = 300
    expect(percentile([100, 200, 300, 400], 75)).toBe(300);
  });

  it('returns correct p50 (median) for odd count', () => {
    // sorted: [10, 20, 30, 40, 50]
    // p50: ceil(0.5 * 5) - 1 = ceil(2.5) - 1 = 2 → values[2] = 30
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
  });

  it('returns last element at p100', () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it('returns first element at very low percentile', () => {
    // p1: ceil(0.01 * 5) - 1 = ceil(0.05) - 1 = 0 → values[0] = 1
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(1);
  });
});

// ── rateMetric — deep edge cases ────────────────────────────────────

describe('rateMetric — deep edge cases', () => {
  it('returns "good" at exactly threshold', () => {
    expect(rateMetric(2500, DEFAULT_THRESHOLDS.lcp)).toBe('good');
  });

  it('returns "needs-improvement" just above good threshold', () => {
    expect(rateMetric(2501, DEFAULT_THRESHOLDS.lcp)).toBe('needs-improvement');
  });

  it('returns "poor" above needsImprovement threshold', () => {
    expect(rateMetric(4001, DEFAULT_THRESHOLDS.lcp)).toBe('poor');
  });

  it('returns "needs-improvement" at exactly needsImprovement threshold', () => {
    expect(rateMetric(4000, DEFAULT_THRESHOLDS.lcp)).toBe('needs-improvement');
  });

  it('returns "no-data" for null value', () => {
    expect(rateMetric(null, DEFAULT_THRESHOLDS.lcp)).toBe('no-data');
  });

  it('returns "no-data" for null thresholds', () => {
    expect(rateMetric(100, null)).toBe('no-data');
  });

  it('CLS threshold: good at exactly 0.1', () => {
    expect(rateMetric(0.1, DEFAULT_THRESHOLDS.cls)).toBe('good');
  });

  it('CLS threshold: needs-improvement at 0.11', () => {
    expect(rateMetric(0.11, DEFAULT_THRESHOLDS.cls)).toBe('needs-improvement');
  });

  it('CLS threshold: poor above 0.25', () => {
    expect(rateMetric(0.26, DEFAULT_THRESHOLDS.cls)).toBe('poor');
  });
});

// ── getWorstRating — deep edge cases ────────────────────────────────

describe('getWorstRating — deep edge cases', () => {
  it('returns "poor" when any rating is poor', () => {
    expect(getWorstRating(['good', 'good', 'poor'])).toBe('poor');
  });

  it('returns "needs-improvement" when worst is needs-improvement', () => {
    expect(getWorstRating(['good', 'needs-improvement', 'good'])).toBe('needs-improvement');
  });

  it('returns "good" when all are good', () => {
    expect(getWorstRating(['good', 'good', 'good'])).toBe('good');
  });

  it('returns "no-data" when all no-data', () => {
    expect(getWorstRating(['no-data', 'no-data'])).toBe('no-data');
  });

  it('returns "poor" even with no-data present', () => {
    expect(getWorstRating(['no-data', 'poor'])).toBe('poor');
  });

  it('returns "no-data" for empty array', () => {
    expect(getWorstRating([])).toBe('no-data');
  });
});

// ── getTargetDimensions — deep edge cases ───────────────────────────

describe('getTargetDimensions — deep edge cases', () => {
  it('returns hero dimensions', () => {
    expect(getTargetDimensions('hero')).toEqual({ maxWidth: 1920, maxHeight: 800 });
  });

  it('returns thumbnail dimensions', () => {
    expect(getTargetDimensions('thumbnail')).toEqual({ maxWidth: 300, maxHeight: 300 });
  });

  it('returns icon dimensions', () => {
    expect(getTargetDimensions('icon')).toEqual({ maxWidth: 64, maxHeight: 64 });
  });

  it('defaults to product dimensions for unknown context', () => {
    expect(getTargetDimensions('banner')).toEqual({ maxWidth: 800, maxHeight: 800 });
  });

  it('defaults to product dimensions for undefined', () => {
    expect(getTargetDimensions(undefined)).toEqual({ maxWidth: 800, maxHeight: 800 });
  });
});

// ── checkBudgetViolations — deep edge cases ─────────────────────────

describe('checkBudgetViolations — deep edge cases', () => {
  it('returns empty for all-green metrics', () => {
    const violations = checkBudgetViolations({ lcp: 1000, inp: 50, cls: 0.05 });
    expect(violations.length).toBe(0);
  });

  it('detects poor LCP', () => {
    const violations = checkBudgetViolations({ lcp: 5000, inp: 50, cls: 0.05 });
    expect(violations.length).toBe(1);
    expect(violations[0].metric).toBe('lcp');
    expect(violations[0].severity).toBe('poor');
  });

  it('detects needs-improvement INP', () => {
    const violations = checkBudgetViolations({ lcp: 1000, inp: 300, cls: 0.05 });
    expect(violations.length).toBe(1);
    expect(violations[0].metric).toBe('inp');
    expect(violations[0].severity).toBe('needs-improvement');
  });

  it('skips metrics that are 0', () => {
    const violations = checkBudgetViolations({ lcp: 0, inp: 0, cls: 0 });
    expect(violations.length).toBe(0);
  });

  it('skips non-number metrics', () => {
    const violations = checkBudgetViolations({ lcp: 'fast', inp: null, cls: undefined });
    expect(violations.length).toBe(0);
  });

  it('only checks lcp, inp, cls (not fid, ttfb, fcp)', () => {
    const violations = checkBudgetViolations({ fid: 99999, ttfb: 99999, fcp: 99999 });
    expect(violations.length).toBe(0);
  });
});

// ── reportMetrics — deep edge cases ─────────────────────────────────

describe('reportMetrics — deep edge cases', () => {
  it('rejects null data', async () => {
    const result = await reportMetrics(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('sessionId');
  });

  it('rejects missing sessionId', async () => {
    const result = await reportMetrics({ page: '/home' });
    expect(result.success).toBe(false);
  });

  it('rejects missing page', async () => {
    const result = await reportMetrics({ sessionId: 'sess-1' });
    expect(result.success).toBe(false);
  });

  it('defaults deviceType to desktop for invalid value', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await reportMetrics({ sessionId: 'sess-1', page: '/home', deviceType: 'smartwatch' });
    expect(inserted.deviceType).toBe('desktop');
  });

  it('accepts valid device types', async () => {
    for (const dt of ['mobile', 'tablet', 'desktop']) {
      _insertCbs = [];
      let inserted = null;
      __onInsert((col, item) => { inserted = item; });

      await reportMetrics({ sessionId: `sess-${dt}`, page: '/test', deviceType: dt });
      expect(inserted.deviceType).toBe(dt);
    }
  });

  it('clamps LCP to 60000 max', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', lcp: 99999 });
    expect(inserted.lcp).toBe(60000);
  });

  it('clamps CLS to 10 max', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', cls: 50 });
    expect(inserted.cls).toBe(10);
  });

  it('clamps negative metrics to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', lcp: -100, fid: -50 });
    expect(inserted.lcp).toBe(0);
    expect(inserted.fid).toBe(0);
  });

  it('sets NaN metrics to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', lcp: NaN, cls: NaN });
    expect(inserted.lcp).toBe(0);
    expect(inserted.cls).toBe(0);
  });

  it('returns violations for poor metrics', async () => {
    const result = await reportMetrics({
      sessionId: 's1',
      page: '/p',
      lcp: 5000, // poor (> 4000)
      inp: 100,  // good
      cls: 0.3,  // poor (> 0.25)
    });
    expect(result.success).toBe(true);
    expect(result.violations.length).toBe(2);
    expect(result.violations[0].metric).toBe('lcp');
    expect(result.violations[1].metric).toBe('cls');
  });

  it('returns empty violations for good metrics', async () => {
    const result = await reportMetrics({
      sessionId: 's1',
      page: '/p',
      lcp: 1000,
      inp: 50,
      cls: 0.05,
    });
    expect(result.violations.length).toBe(0);
  });

  it('defaults connectionType to "unknown"', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p' });
    expect(inserted.connectionType).toBe('unknown');
  });
});

// ── getImageOptimizationHints — deep edge cases ─────────────────────

describe('getImageOptimizationHints — deep edge cases', () => {
  it('returns empty hints for non-array', () => {
    expect(getImageOptimizationHints(null)).toEqual({ hints: [] });
    expect(getImageOptimizationHints('string')).toEqual({ hints: [] });
    expect(getImageOptimizationHints(42)).toEqual({ hints: [] });
  });

  it('returns empty hints for empty array', () => {
    expect(getImageOptimizationHints([])).toEqual({ hints: [] });
  });

  it('limits to 20 images (MAX_BATCH_SIZE)', () => {
    const images = Array.from({ length: 30 }, (_, i) => ({ src: `img${i}.jpg`, width: 100, height: 100 }));
    const result = getImageOptimizationHints(images);
    expect(result.hints.length).toBe(20);
  });

  it('flags oversized image (width > 2x target)', () => {
    const result = getImageOptimizationHints([
      { src: 'big.jpg', width: 5000, height: 500, context: 'product' },
    ]);
    const resizeHint = result.hints[0].recommendations.find(r => r.type === 'resize');
    expect(resizeHint).toBeDefined();
    expect(resizeHint.priority).toBe('high');
  });

  it('does not flag image at exactly 2x target', () => {
    // product target is 800, so 2x = 1600. Width 1600 is NOT > 1600
    const result = getImageOptimizationHints([
      { src: 'ok.jpg', width: 1600, height: 800, context: 'product' },
    ]);
    const resizeHint = result.hints[0].recommendations.find(r => r.type === 'resize');
    expect(resizeHint).toBeUndefined();
  });

  it('suggests WebP format for non-WebP images', () => {
    const result = getImageOptimizationHints([
      { src: 'photo.jpg', width: 800, height: 600, context: 'product' },
    ]);
    const formatHint = result.hints[0].recommendations.find(r => r.type === 'format');
    expect(formatHint).toBeDefined();
    expect(formatHint.message).toContain('WebP');
  });

  it('skips WebP suggestion for .webp images', () => {
    const result = getImageOptimizationHints([
      { src: 'photo.webp', width: 800, height: 600, context: 'product' },
    ]);
    const formatHint = result.hints[0].recommendations.find(r => r.type === 'format');
    expect(formatHint).toBeUndefined();
  });

  it('skips WebP suggestion for format/webp URLs', () => {
    const result = getImageOptimizationHints([
      { src: 'https://cdn.com/img?format/webp', width: 800, height: 600, context: 'product' },
    ]);
    const formatHint = result.hints[0].recommendations.find(r => r.type === 'format');
    expect(formatHint).toBeUndefined();
  });

  it('suggests eager loading for hero images', () => {
    const result = getImageOptimizationHints([
      { src: 'hero.jpg', width: 1920, height: 800, context: 'hero' },
    ]);
    const loadHint = result.hints[0].recommendations.find(r => r.type === 'loading');
    expect(loadHint.loading).toBe('eager');
    expect(loadHint.fetchPriority).toBe('high');
  });

  it('suggests lazy loading for non-hero images', () => {
    for (const context of ['product', 'thumbnail', 'gallery', 'icon']) {
      const result = getImageOptimizationHints([
        { src: 'img.jpg', width: 100, height: 100, context },
      ]);
      const loadHint = result.hints[0].recommendations.find(r => r.type === 'loading');
      expect(loadHint.loading).toBe('lazy');
    }
  });

  it('suggests explicit dimensions when width/height missing', () => {
    const result = getImageOptimizationHints([
      { src: 'img.jpg', context: 'product' },
    ]);
    const dimHint = result.hints[0].recommendations.find(r => r.type === 'dimensions');
    expect(dimHint).toBeDefined();
    expect(dimHint.message).toContain('CLS');
  });

  it('no dimension hint when both width and height present', () => {
    const result = getImageOptimizationHints([
      { src: 'img.jpg', width: 800, height: 600, context: 'product' },
    ]);
    const dimHint = result.hints[0].recommendations.find(r => r.type === 'dimensions');
    expect(dimHint).toBeUndefined();
  });

  it('handles non-string src gracefully', () => {
    const result = getImageOptimizationHints([
      { src: 12345, width: 100, height: 100, context: 'product' },
    ]);
    expect(result.hints[0].src).toBe('');
  });

  it('truncates long src to 200 chars', () => {
    const longSrc = 'a'.repeat(500) + '.jpg';
    const result = getImageOptimizationHints([
      { src: longSrc, width: 100, height: 100, context: 'product' },
    ]);
    expect(result.hints[0].src.length).toBe(200);
  });

  it('defaults context to "product" when missing', () => {
    const result = getImageOptimizationHints([
      { src: 'img.jpg', width: 100, height: 100 },
    ]);
    expect(result.hints[0].context).toBe('product');
    expect(result.hints[0].targetWidth).toBe(800);
  });
});

// ── getLazyLoadConfig — deep edge cases ─────────────────────────────

describe('getLazyLoadConfig — deep edge cases', () => {
  it('returns home config', () => {
    const result = getLazyLoadConfig('home');
    expect(result.config.hero.loading).toBe('eager');
    expect(result.config.hero.fetchPriority).toBe('high');
    expect(result.config.featuredProducts.loading).toBe('lazy');
  });

  it('returns product config', () => {
    const result = getLazyLoadConfig('product');
    expect(result.config.mainImage.loading).toBe('eager');
    expect(result.config.gallery.loading).toBe('lazy');
  });

  it('returns category config', () => {
    const result = getLazyLoadConfig('category');
    expect(result.config.banner.loading).toBe('eager');
    expect(result.config.productGrid.loading).toBe('lazy');
  });

  it('returns blog config', () => {
    const result = getLazyLoadConfig('blog');
    expect(result.config.featuredImage.loading).toBe('eager');
  });

  it('defaults to "other" config for unknown page type', () => {
    const result = getLazyLoadConfig('checkout');
    expect(result.config.primaryImage.loading).toBe('eager');
    expect(result.config.secondaryImages.loading).toBe('lazy');
  });

  it('defaults to "other" for undefined page type', () => {
    const result = getLazyLoadConfig(undefined);
    expect(result.config.primaryImage).toBeDefined();
  });
});

// ── checkPerformanceBudget — deep edge cases ────────────────────────

describe('checkPerformanceBudget — deep edge cases', () => {
  it('rejects null metrics', async () => {
    const result = await checkPerformanceBudget(null);
    expect(result.pass).toBe(false);
    expect(result.error).toContain('Metrics object required');
  });

  it('rejects non-object metrics', async () => {
    const result = await checkPerformanceBudget('fast');
    expect(result.pass).toBe(false);
  });

  it('passes with good default thresholds', async () => {
    const result = await checkPerformanceBudget({ lcp: 1000, cls: 0.05 });
    expect(result.pass).toBe(true);
    expect(result.violations.length).toBe(0);
    expect(result.checked).toBe(2);
  });

  it('fails with poor metrics (pass considers only "poor" severity)', async () => {
    const result = await checkPerformanceBudget({ lcp: 5000 });
    expect(result.pass).toBe(false);
    expect(result.violations[0].severity).toBe('poor');
  });

  it('passes with needs-improvement (not poor)', async () => {
    const result = await checkPerformanceBudget({ lcp: 3000 });
    expect(result.pass).toBe(true);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].severity).toBe('needs-improvement');
  });

  it('uses custom budgets from CMS when available', async () => {
    __seed('PerformanceBudgets', [{
      _id: 'b1',
      metricName: 'lcp',
      goodThreshold: 1000,
      needsImprovementThreshold: 2000,
      page: '*',
      enabled: true,
    }]);
    // With custom budget: 1500 > 1000 (good) → needs-improvement
    const result = await checkPerformanceBudget({ lcp: 1500 });
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].severity).toBe('needs-improvement');
  });

  it('uses page-specific budget when matching', async () => {
    __seed('PerformanceBudgets', [{
      _id: 'b1',
      metricName: 'lcp',
      goodThreshold: 500,
      needsImprovementThreshold: 1000,
      page: '/product',
      enabled: true,
    }]);
    // lcp 700 with custom /product budget: > 500 → needs-improvement
    const result = await checkPerformanceBudget({ lcp: 700 }, '/product');
    expect(result.violations.length).toBe(1);
  });

  it('skips non-numeric metric values', async () => {
    const result = await checkPerformanceBudget({ lcp: 'fast', cls: null });
    expect(result.checked).toBe(0);
  });

  it('ignores disabled budgets', async () => {
    __seed('PerformanceBudgets', [{
      _id: 'b1',
      metricName: 'lcp',
      goodThreshold: 100,
      needsImprovementThreshold: 200,
      page: '*',
      enabled: false,
    }]);
    // Disabled budget should not be loaded; uses defaults
    const result = await checkPerformanceBudget({ lcp: 150 });
    // With default thresholds (good: 2500), 150 is good
    expect(result.pass).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('violation message includes metric name and values', async () => {
    const result = await checkPerformanceBudget({ fid: 500 });
    expect(result.violations[0].message).toContain('FID');
    expect(result.violations[0].message).toContain('500');
    expect(result.violations[0].message).toContain('300');
  });
});

// ── getPerformanceSummary — deep edge cases ─────────────────────────

describe('getPerformanceSummary — deep edge cases', () => {
  it('returns no-data for empty metrics', async () => {
    const result = await getPerformanceSummary();
    expect(result.success).toBe(true);
    expect(result.sampleCount).toBe(0);
    expect(result.rating).toBe('no-data');
  });

  it('clamps days to 1-90 range', async () => {
    // days=0 → Math.max(1, 0) = 1
    const result = await getPerformanceSummary({ days: 0 });
    expect(result.success).toBe(true);
  });

  it('caps days at 90', async () => {
    const result = await getPerformanceSummary({ days: 365 });
    expect(result.success).toBe(true);
  });

  it('calculates correct overall rating (worst of lcp, inp, cls)', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 1000, inp: 600, cls: 0.05, deviceType: 'desktop', timestamp: new Date() },
    ]);
    const result = await getPerformanceSummary({ days: 7 });
    // lcp 1000 = good, inp 600 = poor (> 500), cls 0.05 = good
    expect(result.overallRating).toBe('poor');
  });

  it('provides device breakdown', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 1000, deviceType: 'mobile', timestamp: new Date() },
      { lcp: 800, deviceType: 'mobile', timestamp: new Date() },
      { lcp: 500, deviceType: 'desktop', timestamp: new Date() },
    ]);
    const result = await getPerformanceSummary({ days: 7 });
    expect(result.deviceBreakdown.mobile).toBe(2);
    expect(result.deviceBreakdown.desktop).toBe(1);
    expect(result.deviceBreakdown.tablet).toBe(0);
  });

  it('filters out 0 values from metric calculations', async () => {
    __seed('PerformanceMetrics', [
      { lcp: 0, inp: 100, cls: 0, deviceType: 'desktop', timestamp: new Date() },
    ]);
    const result = await getPerformanceSummary({ days: 7 });
    // lcp values with 0 are filtered out → no data for lcp
    expect(result.metrics.lcp.count).toBe(0);
    expect(result.metrics.lcp.rating).toBe('no-data');
  });
});

// ── getPagePerformance — deep edge cases ────────────────────────────

describe('getPagePerformance — deep edge cases', () => {
  it('returns empty pages for no data', async () => {
    const result = await getPagePerformance(7);
    expect(result.success).toBe(true);
    expect(result.pages).toEqual([]);
  });

  it('sorts pages by worst LCP first', async () => {
    __seed('PerformanceMetrics', [
      { page: '/fast', lcp: 1000, cls: 0.05, inp: 50, deviceType: 'desktop', timestamp: new Date() },
      { page: '/slow', lcp: 5000, cls: 0.3, inp: 300, deviceType: 'desktop', timestamp: new Date() },
    ]);
    const result = await getPagePerformance(7);
    expect(result.pages[0].page).toBe('/slow');
    expect(result.pages[1].page).toBe('/fast');
  });

  it('groups samples by page', async () => {
    __seed('PerformanceMetrics', [
      { page: '/home', lcp: 1000, cls: 0.05, inp: 50, deviceType: 'desktop', timestamp: new Date() },
      { page: '/home', lcp: 1200, cls: 0.08, inp: 60, deviceType: 'mobile', timestamp: new Date() },
      { page: '/product', lcp: 2000, cls: 0.15, inp: 100, deviceType: 'desktop', timestamp: new Date() },
    ]);
    const result = await getPagePerformance(7);
    expect(result.pages.length).toBe(2);
    const homePage = result.pages.find(p => p.page === '/home');
    expect(homePage.sampleCount).toBe(2);
  });

  it('clamps days to 1-90', async () => {
    const result = await getPagePerformance(-5);
    expect(result.success).toBe(true);
  });
});
