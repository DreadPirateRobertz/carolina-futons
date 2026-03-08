import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert } from '../__mocks__/wix-data.js';
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
} from '../../src/backend/coreWebVitals.web.js';

// ── Helpers ─────────────────────────────────────────────────────────

const baseMetrics = {
  sessionId: 'sess-001',
  page: '/product/eureka-futon',
  deviceType: 'desktop',
  lcp: 1800,
  fid: 50,
  inp: 150,
  cls: 0.05,
  ttfb: 400,
  fcp: 1200,
  connectionType: '4g',
};

const sampleMetricRecords = [
  { ...baseMetrics, _id: 'pm-001', timestamp: new Date(), deviceType: 'desktop', lcp: 2000, cls: 0.08, inp: 180 },
  { ...baseMetrics, _id: 'pm-002', timestamp: new Date(), deviceType: 'desktop', lcp: 2500, cls: 0.12, inp: 220 },
  { ...baseMetrics, _id: 'pm-003', timestamp: new Date(), deviceType: 'mobile', lcp: 3500, cls: 0.15, inp: 350 },
  { ...baseMetrics, _id: 'pm-004', timestamp: new Date(), deviceType: 'mobile', lcp: 4200, cls: 0.30, inp: 600 },
];

beforeEach(() => {
  __reset();
  __seed('PerformanceMetrics', []);
  __seed('PerformanceBudgets', []);
});

// ── clampMetric ─────────────────────────────────────────────────────

describe('clampMetric', () => {
  it('clamps within range', () => {
    expect(clampMetric(500, 0, 1000)).toBe(500);
  });

  it('clamps below min', () => {
    expect(clampMetric(-10, 0, 1000)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clampMetric(99999, 0, 60000)).toBe(60000);
  });

  it('returns 0 for non-number', () => {
    expect(clampMetric('hello', 0, 1000)).toBe(0);
    expect(clampMetric(null, 0, 1000)).toBe(0);
    expect(clampMetric(undefined, 0, 1000)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(clampMetric(NaN, 0, 1000)).toBe(0);
  });
});

// ── percentile ──────────────────────────────────────────────────────

describe('percentile', () => {
  it('returns p75 of sorted values', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800];
    expect(percentile(values, 75)).toBe(600);
  });

  it('returns p50 (median) correctly', () => {
    const values = [100, 200, 300, 400];
    expect(percentile(values, 50)).toBe(200);
  });

  it('returns 0 for empty array', () => {
    expect(percentile([], 75)).toBe(0);
  });

  it('returns single value for array of one', () => {
    expect(percentile([42], 75)).toBe(42);
  });
});

// ── rateMetric ──────────────────────────────────────────────────────

describe('rateMetric', () => {
  it('rates LCP as good when under 2500', () => {
    expect(rateMetric(2000, DEFAULT_THRESHOLDS.lcp)).toBe('good');
  });

  it('rates LCP as needs-improvement when between 2500-4000', () => {
    expect(rateMetric(3000, DEFAULT_THRESHOLDS.lcp)).toBe('needs-improvement');
  });

  it('rates LCP as poor when over 4000', () => {
    expect(rateMetric(5000, DEFAULT_THRESHOLDS.lcp)).toBe('poor');
  });

  it('rates CLS as good when under 0.1', () => {
    expect(rateMetric(0.05, DEFAULT_THRESHOLDS.cls)).toBe('good');
  });

  it('rates CLS as poor when over 0.25', () => {
    expect(rateMetric(0.5, DEFAULT_THRESHOLDS.cls)).toBe('poor');
  });

  it('returns no-data for null thresholds', () => {
    expect(rateMetric(100, null)).toBe('no-data');
  });

  it('returns no-data for non-number value', () => {
    expect(rateMetric('fast', DEFAULT_THRESHOLDS.lcp)).toBe('no-data');
  });

  it('rates at exactly the good threshold as good', () => {
    expect(rateMetric(2500, DEFAULT_THRESHOLDS.lcp)).toBe('good');
  });
});

// ── getWorstRating ──────────────────────────────────────────────────

describe('getWorstRating', () => {
  it('returns poor if any metric is poor', () => {
    expect(getWorstRating(['good', 'poor', 'good'])).toBe('poor');
  });

  it('returns needs-improvement if worst is needs-improvement', () => {
    expect(getWorstRating(['good', 'needs-improvement', 'good'])).toBe('needs-improvement');
  });

  it('returns good if all are good', () => {
    expect(getWorstRating(['good', 'good', 'good'])).toBe('good');
  });

  it('returns no-data for empty array', () => {
    expect(getWorstRating([])).toBe('no-data');
  });
});

// ── checkBudgetViolations ───────────────────────────────────────────

describe('checkBudgetViolations', () => {
  it('returns no violations for good metrics', () => {
    const record = { lcp: 1500, inp: 100, cls: 0.05 };
    expect(checkBudgetViolations(record)).toHaveLength(0);
  });

  it('flags poor LCP', () => {
    const record = { lcp: 5000, inp: 100, cls: 0.05 };
    const violations = checkBudgetViolations(record);
    expect(violations).toHaveLength(1);
    expect(violations[0].metric).toBe('lcp');
    expect(violations[0].severity).toBe('poor');
  });

  it('flags needs-improvement CLS', () => {
    const record = { lcp: 1500, inp: 100, cls: 0.15 };
    const violations = checkBudgetViolations(record);
    expect(violations).toHaveLength(1);
    expect(violations[0].metric).toBe('cls');
    expect(violations[0].severity).toBe('needs-improvement');
  });

  it('flags multiple violations', () => {
    const record = { lcp: 5000, inp: 600, cls: 0.5 };
    const violations = checkBudgetViolations(record);
    expect(violations).toHaveLength(3);
  });

  it('skips zero values', () => {
    const record = { lcp: 0, inp: 0, cls: 0 };
    expect(checkBudgetViolations(record)).toHaveLength(0);
  });
});

// ── getTargetDimensions ─────────────────────────────────────────────

describe('getTargetDimensions', () => {
  it('returns hero dimensions', () => {
    const dims = getTargetDimensions('hero');
    expect(dims.maxWidth).toBe(1920);
    expect(dims.maxHeight).toBe(800);
  });

  it('returns thumbnail dimensions', () => {
    const dims = getTargetDimensions('thumbnail');
    expect(dims.maxWidth).toBe(300);
  });

  it('returns product dimensions for unknown context', () => {
    const dims = getTargetDimensions('unknown');
    expect(dims.maxWidth).toBe(800);
  });
});

// ── reportMetrics ───────────────────────────────────────────────────

describe('reportMetrics', () => {
  it('stores metrics successfully', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    const result = await reportMetrics(baseMetrics);
    expect(result.success).toBe(true);
    expect(inserted).not.toBeNull();
    expect(inserted.sessionId).toBe('sess-001');
    expect(inserted.lcp).toBe(1800);
    expect(inserted.cls).toBe(0.05);
  });

  it('returns budget violations for poor metrics', async () => {
    const result = await reportMetrics({
      ...baseMetrics,
      lcp: 5000,
      cls: 0.5,
    });
    expect(result.success).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some(v => v.metric === 'lcp')).toBe(true);
  });

  it('returns empty violations for good metrics', async () => {
    const result = await reportMetrics(baseMetrics);
    expect(result.success).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects missing sessionId', async () => {
    const result = await reportMetrics({ page: '/home' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects missing page', async () => {
    const result = await reportMetrics({ sessionId: 'sess-001' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects null data', async () => {
    const result = await reportMetrics(null);
    expect(result.success).toBe(false);
  });

  it('defaults deviceType to desktop for invalid value', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    await reportMetrics({ ...baseMetrics, deviceType: 'smartwatch' });
    expect(inserted.deviceType).toBe('desktop');
  });

  it('clamps extreme LCP values', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    await reportMetrics({ ...baseMetrics, lcp: 999999 });
    expect(inserted.lcp).toBe(60000);
  });

  it('handles non-numeric metric values', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    await reportMetrics({ ...baseMetrics, lcp: 'fast', cls: 'low' });
    expect(inserted.lcp).toBe(0);
    expect(inserted.cls).toBe(0);
  });

  it('sanitizes connection type', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    await reportMetrics({ ...baseMetrics, connectionType: '<script>alert(1)</script>4g' });
    expect(inserted.connectionType).not.toContain('<script>');
  });
});

// ── getPerformanceSummary ───────────────────────────────────────────

describe('getPerformanceSummary', () => {
  it('returns summary with p75 values', async () => {
    __seed('PerformanceMetrics', sampleMetricRecords);
    const result = await getPerformanceSummary({ days: 7 });
    expect(result.success).toBe(true);
    expect(result.sampleCount).toBe(4);
    expect(result.metrics.lcp).toBeDefined();
    expect(result.metrics.lcp.p75).toBeGreaterThan(0);
    expect(result.metrics.lcp.rating).toBeDefined();
  });

  it('returns no-data for empty collection', async () => {
    const result = await getPerformanceSummary();
    expect(result.success).toBe(true);
    expect(result.sampleCount).toBe(0);
    expect(result.rating).toBe('no-data');
  });

  it('includes device breakdown', async () => {
    __seed('PerformanceMetrics', sampleMetricRecords);
    const result = await getPerformanceSummary({ days: 7 });
    expect(result.deviceBreakdown.desktop).toBe(2);
    expect(result.deviceBreakdown.mobile).toBe(2);
  });

  it('returns overall rating based on worst core metric', async () => {
    __seed('PerformanceMetrics', sampleMetricRecords);
    const result = await getPerformanceSummary({ days: 7 });
    expect(['good', 'needs-improvement', 'poor']).toContain(result.overallRating);
  });

  it('clamps days parameter', async () => {
    __seed('PerformanceMetrics', sampleMetricRecords);
    const result = await getPerformanceSummary({ days: 999 });
    expect(result.success).toBe(true);
    expect(result.period).toBe('90 days');
  });
});

// ── getPagePerformance ──────────────────────────────────────────────

describe('getPagePerformance', () => {
  it('returns per-page performance metrics', async () => {
    __seed('PerformanceMetrics', [
      ...sampleMetricRecords,
      { ...baseMetrics, _id: 'pm-005', page: '/category/futons', timestamp: new Date(), lcp: 3000, cls: 0.2, inp: 300 },
    ]);

    const result = await getPagePerformance(7);
    expect(result.success).toBe(true);
    expect(result.pages.length).toBeGreaterThanOrEqual(1);
    expect(result.pages[0]).toHaveProperty('lcp');
    expect(result.pages[0]).toHaveProperty('cls');
    expect(result.pages[0]).toHaveProperty('sampleCount');
  });

  it('returns empty for no data', async () => {
    const result = await getPagePerformance(7);
    expect(result.success).toBe(true);
    expect(result.pages).toHaveLength(0);
  });

  it('sorts by worst LCP first', async () => {
    __seed('PerformanceMetrics', [
      { ...baseMetrics, _id: 'pm-a', page: '/fast-page', timestamp: new Date(), lcp: 1000 },
      { ...baseMetrics, _id: 'pm-b', page: '/slow-page', timestamp: new Date(), lcp: 5000 },
    ]);

    const result = await getPagePerformance(7);
    expect(result.pages[0].page).toBe('/slow-page');
    expect(result.pages[1].page).toBe('/fast-page');
  });
});

// ── getImageOptimizationHints ───────────────────────────────────────

describe('getImageOptimizationHints', () => {
  it('returns resize recommendation for oversized images', () => {
    const result = getImageOptimizationHints([
      { src: 'https://example.com/huge.jpg', width: 5000, height: 3000, context: 'product' },
    ]);
    expect(result.hints).toHaveLength(1);
    const resize = result.hints[0].recommendations.find(r => r.type === 'resize');
    expect(resize).toBeDefined();
    expect(resize.priority).toBe('high');
  });

  it('suggests WebP format for non-webp images', () => {
    const result = getImageOptimizationHints([
      { src: 'https://example.com/photo.jpg', width: 800, height: 600, context: 'product' },
    ]);
    const format = result.hints[0].recommendations.find(r => r.type === 'format');
    expect(format).toBeDefined();
    expect(format.message).toContain('WebP');
  });

  it('does not suggest WebP for webp images', () => {
    const result = getImageOptimizationHints([
      { src: 'https://example.com/photo.webp', width: 800, height: 600, context: 'product' },
    ]);
    const format = result.hints[0].recommendations.find(r => r.type === 'format');
    expect(format).toBeUndefined();
  });

  it('suggests eager loading for hero images', () => {
    const result = getImageOptimizationHints([
      { src: 'https://example.com/hero.jpg', width: 1920, height: 800, context: 'hero' },
    ]);
    const loading = result.hints[0].recommendations.find(r => r.type === 'loading');
    expect(loading.loading).toBe('eager');
    expect(loading.fetchPriority).toBe('high');
  });

  it('suggests lazy loading for product images', () => {
    const result = getImageOptimizationHints([
      { src: 'https://example.com/product.jpg', width: 800, height: 800, context: 'product' },
    ]);
    const loading = result.hints[0].recommendations.find(r => r.type === 'loading');
    expect(loading.loading).toBe('lazy');
  });

  it('suggests explicit dimensions when missing', () => {
    const result = getImageOptimizationHints([
      { src: 'https://example.com/photo.jpg', context: 'gallery' },
    ]);
    const dims = result.hints[0].recommendations.find(r => r.type === 'dimensions');
    expect(dims).toBeDefined();
    expect(dims.priority).toBe('high');
  });

  it('returns empty for non-array input', () => {
    expect(getImageOptimizationHints(null).hints).toEqual([]);
    expect(getImageOptimizationHints('string').hints).toEqual([]);
  });

  it('limits batch size to 20', () => {
    const images = Array.from({ length: 30 }, (_, i) => ({
      src: `https://example.com/img${i}.jpg`, width: 800, height: 600, context: 'product',
    }));
    const result = getImageOptimizationHints(images);
    expect(result.hints).toHaveLength(20);
  });

  it('returns target dimensions for context', () => {
    const result = getImageOptimizationHints([
      { src: 'https://example.com/thumb.jpg', width: 300, height: 300, context: 'thumbnail' },
    ]);
    expect(result.hints[0].targetWidth).toBe(300);
  });
});

// ── getLazyLoadConfig ───────────────────────────────────────────────

describe('getLazyLoadConfig', () => {
  it('returns home page config', () => {
    const { config } = getLazyLoadConfig('home');
    expect(config.hero.loading).toBe('eager');
    expect(config.hero.fetchPriority).toBe('high');
    expect(config.featuredProducts.loading).toBe('lazy');
  });

  it('returns product page config', () => {
    const { config } = getLazyLoadConfig('product');
    expect(config.mainImage.loading).toBe('eager');
    expect(config.gallery.loading).toBe('lazy');
    expect(config.reviews.loading).toBe('lazy');
  });

  it('returns category page config', () => {
    const { config } = getLazyLoadConfig('category');
    expect(config.banner.loading).toBe('eager');
    expect(config.productGrid.loading).toBe('lazy');
  });

  it('returns blog page config', () => {
    const { config } = getLazyLoadConfig('blog');
    expect(config.featuredImage.loading).toBe('eager');
    expect(config.inlineImages.loading).toBe('lazy');
  });

  it('returns fallback config for unknown page type', () => {
    const { config } = getLazyLoadConfig('unknown');
    expect(config.primaryImage.loading).toBe('eager');
    expect(config.secondaryImages.loading).toBe('lazy');
  });
});

// ── checkPerformanceBudget ──────────────────────────────────────────

describe('checkPerformanceBudget', () => {
  it('passes for good metrics', async () => {
    const result = await checkPerformanceBudget({
      lcp: 1500, fid: 50, inp: 100, cls: 0.05, ttfb: 400, fcp: 1000,
    });
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.checked).toBe(6);
  });

  it('fails for poor LCP', async () => {
    const result = await checkPerformanceBudget({ lcp: 5000 });
    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe('poor');
  });

  it('passes with needs-improvement (not poor)', async () => {
    const result = await checkPerformanceBudget({ lcp: 3000 });
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe('needs-improvement');
  });

  it('uses custom budgets from CMS', async () => {
    __seed('PerformanceBudgets', [{
      _id: 'budget-1',
      metricName: 'lcp',
      goodThreshold: 1000,
      needsImprovementThreshold: 2000,
      page: '*',
      enabled: true,
    }]);

    const result = await checkPerformanceBudget({ lcp: 1500 });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].metric).toBe('lcp');
    expect(result.violations[0].severity).toBe('needs-improvement');
  });

  it('rejects null metrics', async () => {
    const result = await checkPerformanceBudget(null);
    expect(result.error).toContain('required');
  });

  it('skips non-numeric metric values', async () => {
    const result = await checkPerformanceBudget({ lcp: 'fast', cls: true });
    expect(result.checked).toBe(0);
  });

  it('handles multiple violations', async () => {
    const result = await checkPerformanceBudget({
      lcp: 5000, inp: 600, cls: 0.5,
    });
    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(3);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('constants', () => {
  it('exports valid metrics list', () => {
    expect(VALID_METRICS).toContain('lcp');
    expect(VALID_METRICS).toContain('cls');
    expect(VALID_METRICS).toContain('inp');
    expect(VALID_METRICS).toHaveLength(6);
  });

  it('exports device types', () => {
    expect(VALID_DEVICE_TYPES).toContain('mobile');
    expect(VALID_DEVICE_TYPES).toContain('desktop');
  });

  it('has thresholds for all core metrics', () => {
    expect(DEFAULT_THRESHOLDS.lcp).toBeDefined();
    expect(DEFAULT_THRESHOLDS.cls).toBeDefined();
    expect(DEFAULT_THRESHOLDS.inp).toBeDefined();
    expect(DEFAULT_THRESHOLDS.lcp.good).toBe(2500);
    expect(DEFAULT_THRESHOLDS.cls.good).toBe(0.1);
  });
});
