/**
 * @module coreWebVitals
 * @description Core Web Vitals monitoring and performance optimization service.
 * Tracks LCP, FID, CLS metrics from real user monitoring (RUM).
 * Provides image optimization config, lazy loading rules, and performance budgets.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create CMS collection `WebVitalsMetrics` with fields:
 *   pageUrl (Text, indexed) - Page URL path
 *   metric (Text, indexed) - 'LCP'|'FID'|'CLS'|'TTFB'|'INP'
 *   value (Number) - Metric value (ms for timing, score for CLS)
 *   rating (Text) - 'good'|'needs-improvement'|'poor'
 *   device (Text) - 'mobile'|'desktop'
 *   timestamp (Date, indexed) - When metric was recorded
 *   sessionId (Text) - Browser session
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Performance Thresholds (Google 2024 standards) ─────────────────

const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  FID: { good: 100, poor: 300, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: 'score' },
  TTFB: { good: 800, poor: 1800, unit: 'ms' },
  INP: { good: 200, poor: 500, unit: 'ms' },
};

const VALID_METRICS = Object.keys(THRESHOLDS);
const VALID_DEVICES = ['mobile', 'desktop'];

// ── Image Optimization Presets ─────────────────────────────────────

const IMAGE_PRESETS = {
  hero: {
    maxWidth: 1920,
    maxHeight: 800,
    quality: 80,
    format: 'webp',
    loading: 'eager',
    fetchPriority: 'high',
    sizes: '100vw',
  },
  product_main: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 85,
    format: 'webp',
    loading: 'eager',
    fetchPriority: 'high',
    sizes: '(max-width: 768px) 100vw, 50vw',
  },
  product_thumbnail: {
    maxWidth: 300,
    maxHeight: 300,
    quality: 75,
    format: 'webp',
    loading: 'lazy',
    fetchPriority: 'low',
    sizes: '150px',
  },
  product_gallery: {
    maxWidth: 600,
    maxHeight: 600,
    quality: 80,
    format: 'webp',
    loading: 'lazy',
    fetchPriority: 'auto',
    sizes: '(max-width: 768px) 100vw, 400px',
  },
  category_card: {
    maxWidth: 400,
    maxHeight: 400,
    quality: 75,
    format: 'webp',
    loading: 'lazy',
    fetchPriority: 'auto',
    sizes: '(max-width: 768px) 50vw, 25vw',
  },
  blog: {
    maxWidth: 1200,
    maxHeight: 675,
    quality: 80,
    format: 'webp',
    loading: 'lazy',
    fetchPriority: 'auto',
    sizes: '(max-width: 768px) 100vw, 800px',
  },
};

// ── Performance Budgets ────────────────────────────────────────────

const PERFORMANCE_BUDGETS = {
  homepage: {
    maxLCP: 2500,
    maxCLS: 0.1,
    maxTTFB: 800,
    maxImages: 15,
    maxImageSizeKB: 200,
    maxTotalSizeKB: 3000,
  },
  product_page: {
    maxLCP: 2500,
    maxCLS: 0.1,
    maxTTFB: 800,
    maxImages: 20,
    maxImageSizeKB: 250,
    maxTotalSizeKB: 3500,
  },
  category_page: {
    maxLCP: 3000,
    maxCLS: 0.1,
    maxTTFB: 900,
    maxImages: 30,
    maxImageSizeKB: 150,
    maxTotalSizeKB: 4000,
  },
  checkout: {
    maxLCP: 2000,
    maxCLS: 0.05,
    maxTTFB: 600,
    maxImages: 5,
    maxImageSizeKB: 100,
    maxTotalSizeKB: 1500,
  },
};

// ── Public API ─────────────────────────────────────────────────────

/**
 * Record a web vitals metric from real user monitoring.
 * @param {Object} data
 * @param {string} data.pageUrl - Page URL path
 * @param {string} data.metric - Metric name (LCP, FID, CLS, TTFB, INP)
 * @param {number} data.value - Metric value
 * @param {string} [data.device] - 'mobile' or 'desktop'
 * @param {string} [data.sessionId] - Browser session ID
 * @returns {Promise<{ success: boolean }>}
 */
export const recordMetric = webMethod(
  Permissions.Anyone,
  async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Metric data is required.' };
      }

      const metric = (data.metric || '').toUpperCase().trim();
      if (!VALID_METRICS.includes(metric)) {
        return { success: false, error: `Invalid metric. Must be one of: ${VALID_METRICS.join(', ')}` };
      }

      const value = Number(data.value);
      if (isNaN(value) || value < 0) {
        return { success: false, error: 'Metric value must be a non-negative number.' };
      }

      const pageUrl = sanitize(data.pageUrl || '/', 500);
      const device = VALID_DEVICES.includes(data.device) ? data.device : 'desktop';
      const rating = getRating(metric, value);

      await wixData.insert('WebVitalsMetrics', {
        pageUrl,
        metric,
        value: Math.round(value * 1000) / 1000,
        rating,
        device,
        timestamp: new Date(),
        sessionId: sanitize(data.sessionId || '', 100),
      });

      return { success: true };
    } catch (err) {
      console.error('[coreWebVitals] Error recording metric:', err);
      return { success: false, error: 'Failed to record metric.' };
    }
  }
);

/**
 * Get performance summary for a page.
 * Returns average metrics and ratings for the specified period.
 * @param {string} pageUrl - Page URL path
 * @param {number} [daysBack=7] - Look back period
 * @returns {Promise<{ success: boolean, data?: Object }>}
 */
export const getPagePerformance = webMethod(
  Permissions.Admin,
  async (pageUrl, daysBack = 7) => {
    try {
      const url = sanitize(pageUrl || '/', 500);
      const days = Math.max(1, Math.min(90, Math.round(Number(daysBack) || 7)));
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const result = await wixData.query('WebVitalsMetrics')
        .eq('pageUrl', url)
        .ge('timestamp', cutoff)
        .limit(1000)
        .find();

      if (result.items.length === 0) {
        return { success: true, data: { pageUrl: url, metrics: {}, sampleCount: 0, period: `${days} days` } };
      }

      const metrics = {};
      for (const item of result.items) {
        if (!metrics[item.metric]) {
          metrics[item.metric] = { values: [], ratings: { good: 0, 'needs-improvement': 0, poor: 0 } };
        }
        metrics[item.metric].values.push(item.value);
        metrics[item.metric].ratings[item.rating] = (metrics[item.metric].ratings[item.rating] || 0) + 1;
      }

      const summary = {};
      for (const [name, data] of Object.entries(metrics)) {
        const sorted = data.values.sort((a, b) => a - b);
        const p75 = sorted[Math.floor(sorted.length * 0.75)] || 0;
        const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;

        summary[name] = {
          p75: Math.round(p75 * 1000) / 1000,
          average: Math.round(avg * 1000) / 1000,
          sampleCount: sorted.length,
          rating: getRating(name, p75),
          ratings: data.ratings,
        };
      }

      return {
        success: true,
        data: {
          pageUrl: url,
          metrics: summary,
          sampleCount: result.items.length,
          period: `${days} days`,
        },
      };
    } catch (err) {
      console.error('[coreWebVitals] Error getting page performance:', err);
      return { success: false, error: 'Failed to get performance data.' };
    }
  }
);

/**
 * Get image optimization preset for a given context.
 * @param {string} presetName - Preset name (hero, product_main, product_thumbnail, etc.)
 * @returns {{ success: boolean, data?: Object }}
 */
export const getImagePreset = webMethod(
  Permissions.Anyone,
  (presetName) => {
    const name = sanitize(presetName || '', 50).toLowerCase().replace(/\s+/g, '_');
    const preset = IMAGE_PRESETS[name];

    if (!preset) {
      return {
        success: false,
        error: `Unknown preset. Available: ${Object.keys(IMAGE_PRESETS).join(', ')}`,
      };
    }

    return { success: true, data: { name, ...preset } };
  }
);

/**
 * Get all image optimization presets.
 * @returns {{ success: boolean, presets: Object }}
 */
export const getAllImagePresets = webMethod(
  Permissions.Anyone,
  () => {
    return { success: true, presets: { ...IMAGE_PRESETS } };
  }
);

/**
 * Get performance budget for a page type.
 * @param {string} pageType - Page type (homepage, product_page, category_page, checkout)
 * @returns {{ success: boolean, data?: Object }}
 */
export const getPerformanceBudget = webMethod(
  Permissions.Anyone,
  (pageType) => {
    const type = sanitize(pageType || '', 50).toLowerCase().replace(/[\s-]+/g, '_');
    const budget = PERFORMANCE_BUDGETS[type];

    if (!budget) {
      return {
        success: false,
        error: `Unknown page type. Available: ${Object.keys(PERFORMANCE_BUDGETS).join(', ')}`,
      };
    }

    return { success: true, data: { pageType: type, ...budget } };
  }
);

/**
 * Get metric thresholds for all web vitals.
 * @returns {{ success: boolean, thresholds: Object }}
 */
export const getMetricThresholds = webMethod(
  Permissions.Anyone,
  () => {
    return { success: true, thresholds: { ...THRESHOLDS } };
  }
);

/**
 * Evaluate a metric value and return its rating.
 * @param {string} metric - Metric name
 * @param {number} value - Metric value
 * @returns {{ success: boolean, data?: { metric: string, value: number, rating: string, threshold: Object } }}
 */
export const evaluateMetric = webMethod(
  Permissions.Anyone,
  (metric, value) => {
    const name = (metric || '').toUpperCase().trim();
    if (!VALID_METRICS.includes(name)) {
      return { success: false, error: `Invalid metric. Must be one of: ${VALID_METRICS.join(', ')}` };
    }

    const val = Number(value);
    if (isNaN(val) || val < 0) {
      return { success: false, error: 'Value must be a non-negative number.' };
    }

    return {
      success: true,
      data: {
        metric: name,
        value: val,
        rating: getRating(name, val),
        threshold: THRESHOLDS[name],
      },
    };
  }
);

/**
 * Get lazy loading configuration for page elements.
 * Above-the-fold elements load eagerly; below-the-fold elements load lazily.
 * @param {string} pageType - Page type
 * @returns {{ success: boolean, data?: Object }}
 */
export const getLazyLoadConfig = webMethod(
  Permissions.Anyone,
  (pageType) => {
    const configs = {
      homepage: {
        eager: ['hero-image', 'logo', 'nav-icons'],
        lazy: ['category-cards', 'featured-products', 'testimonials', 'blog-previews', 'footer'],
        prefetch: ['/futon-frames', '/mattresses', '/murphy-cabinet-beds'],
      },
      product_page: {
        eager: ['product-main-image', 'product-title', 'add-to-cart'],
        lazy: ['product-gallery', 'related-products', 'reviews', 'size-guide', 'financing-calc'],
        prefetch: ['/cart'],
      },
      category_page: {
        eager: ['category-title', 'first-row-products'],
        lazy: ['remaining-products', 'filters', 'buying-guide-link'],
        prefetch: [],
      },
      checkout: {
        eager: ['order-summary', 'address-form', 'trust-badges'],
        lazy: ['order-notes', 'delivery-estimate'],
        prefetch: ['/thank-you'],
      },
    };

    const type = sanitize(pageType || '', 50).toLowerCase().replace(/[\s-]+/g, '_');
    const config = configs[type];

    if (!config) {
      return {
        success: false,
        error: `Unknown page type. Available: ${Object.keys(configs).join(', ')}`,
      };
    }

    return { success: true, data: { pageType: type, ...config } };
  }
);

// ── Internal Helpers ───────────────────────────────────────────────

function getRating(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}
