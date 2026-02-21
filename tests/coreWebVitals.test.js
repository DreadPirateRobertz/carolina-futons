import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert } from './__mocks__/wix-data.js';
import {
  recordMetric,
  getPagePerformance,
  getImagePreset,
  getAllImagePresets,
  getPerformanceBudget,
  getMetricThresholds,
  evaluateMetric,
  getLazyLoadConfig,
} from '../src/backend/coreWebVitals.web.js';

beforeEach(() => {
  resetData();
});

// ── recordMetric ───────────────────────────────────────────────────

describe('recordMetric', () => {
  it('records an LCP metric', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    const result = await recordMetric({
      pageUrl: '/product-page/eureka',
      metric: 'LCP',
      value: 2100,
      device: 'mobile',
      sessionId: 'sess-1',
    });

    expect(result.success).toBe(true);
    expect(inserted.metric).toBe('LCP');
    expect(inserted.value).toBe(2100);
    expect(inserted.rating).toBe('good');
    expect(inserted.device).toBe('mobile');
  });

  it('records CLS metric', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await recordMetric({ pageUrl: '/', metric: 'CLS', value: 0.05 });
    expect(inserted.rating).toBe('good');
  });

  it('rates poor LCP', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await recordMetric({ pageUrl: '/', metric: 'LCP', value: 5000 });
    expect(inserted.rating).toBe('poor');
  });

  it('rates needs-improvement FID', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await recordMetric({ pageUrl: '/', metric: 'FID', value: 200 });
    expect(inserted.rating).toBe('needs-improvement');
  });

  it('accepts TTFB metric', async () => {
    const result = await recordMetric({ pageUrl: '/', metric: 'TTFB', value: 500 });
    expect(result.success).toBe(true);
  });

  it('accepts INP metric', async () => {
    const result = await recordMetric({ pageUrl: '/', metric: 'INP', value: 150 });
    expect(result.success).toBe(true);
  });

  it('is case-insensitive for metric name', async () => {
    const result = await recordMetric({ pageUrl: '/', metric: 'lcp', value: 2000 });
    expect(result.success).toBe(true);
  });

  it('defaults device to desktop', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await recordMetric({ pageUrl: '/', metric: 'LCP', value: 2000 });
    expect(inserted.device).toBe('desktop');
  });

  it('rejects invalid metric name', async () => {
    const result = await recordMetric({ pageUrl: '/', metric: 'INVALID', value: 100 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid metric');
  });

  it('rejects negative value', async () => {
    const result = await recordMetric({ pageUrl: '/', metric: 'LCP', value: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects NaN value', async () => {
    const result = await recordMetric({ pageUrl: '/', metric: 'LCP', value: 'not a number' });
    expect(result.success).toBe(false);
  });

  it('fails with null data', async () => {
    const result = await recordMetric(null);
    expect(result.success).toBe(false);
  });

  it('sanitizes page URL', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await recordMetric({ pageUrl: '<script>alert(1)</script>/page', metric: 'LCP', value: 2000 });
    expect(inserted.pageUrl).not.toContain('<script>');
  });
});

// ── getPagePerformance ─────────────────────────────────────────────

describe('getPagePerformance', () => {
  it('returns performance summary for a page', async () => {
    __seed('WebVitalsMetrics', [
      { _id: 'm1', pageUrl: '/', metric: 'LCP', value: 2000, rating: 'good', device: 'desktop', timestamp: new Date() },
      { _id: 'm2', pageUrl: '/', metric: 'LCP', value: 3000, rating: 'needs-improvement', device: 'mobile', timestamp: new Date() },
      { _id: 'm3', pageUrl: '/', metric: 'CLS', value: 0.05, rating: 'good', device: 'desktop', timestamp: new Date() },
    ]);

    const result = await getPagePerformance('/');
    expect(result.success).toBe(true);
    expect(result.data.metrics.LCP).toBeDefined();
    expect(result.data.metrics.LCP.sampleCount).toBe(2);
    expect(result.data.metrics.CLS).toBeDefined();
    expect(result.data.sampleCount).toBe(3);
  });

  it('calculates p75 correctly', async () => {
    __seed('WebVitalsMetrics', [
      { _id: 'm1', pageUrl: '/', metric: 'LCP', value: 1000, rating: 'good', timestamp: new Date() },
      { _id: 'm2', pageUrl: '/', metric: 'LCP', value: 2000, rating: 'good', timestamp: new Date() },
      { _id: 'm3', pageUrl: '/', metric: 'LCP', value: 3000, rating: 'needs-improvement', timestamp: new Date() },
      { _id: 'm4', pageUrl: '/', metric: 'LCP', value: 4000, rating: 'needs-improvement', timestamp: new Date() },
    ]);

    const result = await getPagePerformance('/');
    // p75 of [1000, 2000, 3000, 4000] = value at index 3 (floor(4 * 0.75)) = 4000
    expect(result.data.metrics.LCP.p75).toBe(4000);
  });

  it('returns empty metrics for unknown page', async () => {
    __seed('WebVitalsMetrics', []);
    const result = await getPagePerformance('/unknown');
    expect(result.success).toBe(true);
    expect(result.data.sampleCount).toBe(0);
  });

  it('includes rating distribution', async () => {
    __seed('WebVitalsMetrics', [
      { _id: 'm1', pageUrl: '/', metric: 'LCP', value: 2000, rating: 'good', timestamp: new Date() },
      { _id: 'm2', pageUrl: '/', metric: 'LCP', value: 5000, rating: 'poor', timestamp: new Date() },
    ]);

    const result = await getPagePerformance('/');
    expect(result.data.metrics.LCP.ratings.good).toBe(1);
    expect(result.data.metrics.LCP.ratings.poor).toBe(1);
  });

  it('clamps days to 1-90', async () => {
    __seed('WebVitalsMetrics', []);
    const result = await getPagePerformance('/', 200);
    expect(result.data.period).toBe('90 days');
  });
});

// ── getImagePreset ─────────────────────────────────────────────────

describe('getImagePreset', () => {
  it('returns hero preset', () => {
    const result = getImagePreset('hero');
    expect(result.success).toBe(true);
    expect(result.data.maxWidth).toBe(1920);
    expect(result.data.loading).toBe('eager');
    expect(result.data.fetchPriority).toBe('high');
  });

  it('returns product_main preset', () => {
    const result = getImagePreset('product_main');
    expect(result.success).toBe(true);
    expect(result.data.maxWidth).toBe(800);
    expect(result.data.format).toBe('webp');
  });

  it('returns product_thumbnail preset', () => {
    const result = getImagePreset('product_thumbnail');
    expect(result.success).toBe(true);
    expect(result.data.loading).toBe('lazy');
    expect(result.data.fetchPriority).toBe('low');
  });

  it('returns category_card preset', () => {
    const result = getImagePreset('category_card');
    expect(result.success).toBe(true);
    expect(result.data.maxWidth).toBe(400);
  });

  it('returns blog preset', () => {
    const result = getImagePreset('blog');
    expect(result.success).toBe(true);
    expect(result.data.maxWidth).toBe(1200);
  });

  it('fails for unknown preset', () => {
    const result = getImagePreset('unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Available');
  });

  it('handles case and spaces', () => {
    const result = getImagePreset('Product Main');
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('product_main');
  });
});

// ── getAllImagePresets ──────────────────────────────────────────────

describe('getAllImagePresets', () => {
  it('returns all presets', () => {
    const result = getAllImagePresets();
    expect(result.success).toBe(true);
    expect(Object.keys(result.presets).length).toBeGreaterThanOrEqual(6);
    expect(result.presets.hero).toBeDefined();
    expect(result.presets.product_main).toBeDefined();
  });
});

// ── getPerformanceBudget ───────────────────────────────────────────

describe('getPerformanceBudget', () => {
  it('returns homepage budget', () => {
    const result = getPerformanceBudget('homepage');
    expect(result.success).toBe(true);
    expect(result.data.maxLCP).toBe(2500);
    expect(result.data.maxCLS).toBe(0.1);
    expect(result.data.maxImages).toBe(15);
  });

  it('returns product page budget', () => {
    const result = getPerformanceBudget('product_page');
    expect(result.success).toBe(true);
    expect(result.data.maxImages).toBe(20);
  });

  it('returns checkout budget (stricter)', () => {
    const result = getPerformanceBudget('checkout');
    expect(result.success).toBe(true);
    expect(result.data.maxLCP).toBe(2000);
    expect(result.data.maxCLS).toBe(0.05);
    expect(result.data.maxImages).toBe(5);
  });

  it('handles hyphens and spaces', () => {
    const result = getPerformanceBudget('product-page');
    expect(result.success).toBe(true);
  });

  it('fails for unknown page type', () => {
    const result = getPerformanceBudget('unknown');
    expect(result.success).toBe(false);
  });
});

// ── getMetricThresholds ────────────────────────────────────────────

describe('getMetricThresholds', () => {
  it('returns all thresholds', () => {
    const result = getMetricThresholds();
    expect(result.success).toBe(true);
    expect(result.thresholds.LCP).toBeDefined();
    expect(result.thresholds.FID).toBeDefined();
    expect(result.thresholds.CLS).toBeDefined();
    expect(result.thresholds.TTFB).toBeDefined();
    expect(result.thresholds.INP).toBeDefined();
  });

  it('LCP thresholds match Google standards', () => {
    const { thresholds } = getMetricThresholds();
    expect(thresholds.LCP.good).toBe(2500);
    expect(thresholds.LCP.poor).toBe(4000);
  });

  it('CLS thresholds match Google standards', () => {
    const { thresholds } = getMetricThresholds();
    expect(thresholds.CLS.good).toBe(0.1);
    expect(thresholds.CLS.poor).toBe(0.25);
  });
});

// ── evaluateMetric ─────────────────────────────────────────────────

describe('evaluateMetric', () => {
  it('rates good LCP', () => {
    const result = evaluateMetric('LCP', 2000);
    expect(result.success).toBe(true);
    expect(result.data.rating).toBe('good');
  });

  it('rates needs-improvement LCP', () => {
    const result = evaluateMetric('LCP', 3000);
    expect(result.data.rating).toBe('needs-improvement');
  });

  it('rates poor LCP', () => {
    const result = evaluateMetric('LCP', 5000);
    expect(result.data.rating).toBe('poor');
  });

  it('rates good CLS', () => {
    const result = evaluateMetric('CLS', 0.05);
    expect(result.data.rating).toBe('good');
  });

  it('rates poor CLS', () => {
    const result = evaluateMetric('CLS', 0.3);
    expect(result.data.rating).toBe('poor');
  });

  it('includes threshold info', () => {
    const result = evaluateMetric('FID', 50);
    expect(result.data.threshold.good).toBe(100);
    expect(result.data.threshold.poor).toBe(300);
  });

  it('is case-insensitive', () => {
    const result = evaluateMetric('lcp', 2000);
    expect(result.success).toBe(true);
  });

  it('rejects invalid metric', () => {
    const result = evaluateMetric('INVALID', 100);
    expect(result.success).toBe(false);
  });

  it('rejects negative value', () => {
    const result = evaluateMetric('LCP', -1);
    expect(result.success).toBe(false);
  });

  it('rates boundary values correctly', () => {
    // Exactly at threshold boundary — should be "good"
    const result = evaluateMetric('LCP', 2500);
    expect(result.data.rating).toBe('good');
  });
});

// ── getLazyLoadConfig ──────────────────────────────────────────────

describe('getLazyLoadConfig', () => {
  it('returns homepage config', () => {
    const result = getLazyLoadConfig('homepage');
    expect(result.success).toBe(true);
    expect(result.data.eager).toContain('hero-image');
    expect(result.data.lazy).toContain('featured-products');
    expect(result.data.prefetch.length).toBeGreaterThan(0);
  });

  it('returns product page config', () => {
    const result = getLazyLoadConfig('product_page');
    expect(result.success).toBe(true);
    expect(result.data.eager).toContain('product-main-image');
    expect(result.data.lazy).toContain('related-products');
  });

  it('returns checkout config', () => {
    const result = getLazyLoadConfig('checkout');
    expect(result.success).toBe(true);
    expect(result.data.eager).toContain('order-summary');
    expect(result.data.eager).toContain('trust-badges');
  });

  it('prefetches cart from product page', () => {
    const result = getLazyLoadConfig('product_page');
    expect(result.data.prefetch).toContain('/cart');
  });

  it('prefetches thank-you from checkout', () => {
    const result = getLazyLoadConfig('checkout');
    expect(result.data.prefetch).toContain('/thank-you');
  });

  it('handles hyphens in page type', () => {
    const result = getLazyLoadConfig('product-page');
    expect(result.success).toBe(true);
  });

  it('fails for unknown page type', () => {
    const result = getLazyLoadConfig('unknown');
    expect(result.success).toBe(false);
  });
});
