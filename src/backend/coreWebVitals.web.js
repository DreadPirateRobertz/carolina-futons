/**
 * @module coreWebVitals
 * @description Core Web Vitals monitoring and performance optimization service.
 * Collects LCP, FID/INP, CLS metrics from frontend, stores in CMS for
 * dashboarding, enforces performance budgets, and provides image
 * optimization helpers for Wix media.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create CMS collection "PerformanceMetrics" in Wix Dashboard with fields:
 * - sessionId (Text) - Unique session identifier
 * - page (Text) - Page URL path
 * - deviceType (Text) - "mobile" | "tablet" | "desktop"
 * - lcp (Number) - Largest Contentful Paint in ms
 * - fid (Number) - First Input Delay in ms
 * - inp (Number) - Interaction to Next Paint in ms
 * - cls (Number) - Cumulative Layout Shift score
 * - ttfb (Number) - Time to First Byte in ms
 * - fcp (Number) - First Contentful Paint in ms
 * - connectionType (Text) - "4g" | "3g" | "2g" | "slow-2g" | "wifi" | "unknown"
 * - timestamp (DateTime)
 *
 * Create CMS collection "PerformanceBudgets" with fields:
 * - metricName (Text) - "lcp" | "fid" | "inp" | "cls" | "ttfb" | "fcp"
 * - goodThreshold (Number) - "Good" upper bound
 * - needsImprovementThreshold (Number) - "Needs Improvement" upper bound
 * - page (Text) - Page pattern or "*" for all pages
 * - enabled (Boolean)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const METRICS_COLLECTION = 'PerformanceMetrics';
const BUDGETS_COLLECTION = 'PerformanceBudgets';
const MAX_BATCH_SIZE = 20;
const VALID_DEVICE_TYPES = ['mobile', 'tablet', 'desktop'];
const VALID_METRICS = ['lcp', 'fid', 'inp', 'cls', 'ttfb', 'fcp'];

// Google's Core Web Vitals thresholds (defaults if no custom budgets set)
const DEFAULT_THRESHOLDS = {
  lcp:  { good: 2500, needsImprovement: 4000 },
  fid:  { good: 100,  needsImprovement: 300 },
  inp:  { good: 200,  needsImprovement: 500 },
  cls:  { good: 0.1,  needsImprovement: 0.25 },
  ttfb: { good: 800,  needsImprovement: 1800 },
  fcp:  { good: 1800, needsImprovement: 3000 },
};

// ─── reportMetrics ─────────────────────────────────────────────────

/**
 * Report Core Web Vitals metrics from the frontend.
 * Called after page load when metrics are available.
 *
 * @param {Object} data
 * @param {string} data.sessionId - Unique session identifier
 * @param {string} data.page - Page URL path
 * @param {string} [data.deviceType="desktop"] - Device category
 * @param {number} [data.lcp] - Largest Contentful Paint (ms)
 * @param {number} [data.fid] - First Input Delay (ms)
 * @param {number} [data.inp] - Interaction to Next Paint (ms)
 * @param {number} [data.cls] - Cumulative Layout Shift
 * @param {number} [data.ttfb] - Time to First Byte (ms)
 * @param {number} [data.fcp] - First Contentful Paint (ms)
 * @param {string} [data.connectionType] - Network connection type
 * @returns {Promise<{success: boolean, violations?: Array}>}
 */
export const reportMetrics = webMethod(
  Permissions.Anyone,
  async (data) => {
    try {
      if (!data?.sessionId || !data?.page) {
        return { success: false, error: 'sessionId and page are required' };
      }

      const sessionId = sanitize(data.sessionId, 100);
      const page = sanitize(data.page, 500);
      if (!sessionId || !page) {
        return { success: false, error: 'Invalid sessionId or page' };
      }

      const deviceType = VALID_DEVICE_TYPES.includes(data.deviceType)
        ? data.deviceType
        : 'desktop';

      const record = {
        sessionId,
        page,
        deviceType,
        lcp: clampMetric(data.lcp, 0, 60000),
        fid: clampMetric(data.fid, 0, 10000),
        inp: clampMetric(data.inp, 0, 10000),
        cls: clampMetric(data.cls, 0, 10),
        ttfb: clampMetric(data.ttfb, 0, 30000),
        fcp: clampMetric(data.fcp, 0, 30000),
        connectionType: sanitize(data.connectionType || 'unknown', 20),
        timestamp: new Date(),
      };

      await wixData.insert(METRICS_COLLECTION, record);

      // Check against performance budgets
      const violations = checkBudgetViolations(record);

      return { success: true, violations };
    } catch (err) {
      console.error('[coreWebVitals] reportMetrics error:', err);
      return { success: false, error: 'Failed to report metrics' };
    }
  }
);

// ─── getPerformanceSummary ────────────────────────────────────────

/**
 * Get performance summary with p75 values for each metric,
 * broken down by device type and page.
 *
 * @param {Object} [options]
 * @param {number} [options.days=7] - Number of days to analyze
 * @param {string} [options.page] - Filter by page path
 * @param {string} [options.deviceType] - Filter by device type
 * @returns {Promise<Object>} Performance summary
 */
export const getPerformanceSummary = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const days = Math.min(Math.max(1, options.days || 7), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      let query = wixData.query(METRICS_COLLECTION)
        .ge('timestamp', since);

      if (options.page) {
        query = query.eq('page', sanitize(options.page, 500));
      }
      if (options.deviceType && VALID_DEVICE_TYPES.includes(options.deviceType)) {
        query = query.eq('deviceType', options.deviceType);
      }

      const result = await query.limit(1000).find();
      const items = result.items;

      if (items.length === 0) {
        return { success: true, sampleCount: 0, metrics: {}, rating: 'no-data' };
      }

      const metrics = {};
      for (const metric of VALID_METRICS) {
        const values = items
          .map(item => item[metric])
          .filter(v => typeof v === 'number' && v > 0)
          .sort((a, b) => a - b);

        if (values.length === 0) {
          metrics[metric] = { p75: 0, median: 0, count: 0, rating: 'no-data' };
          continue;
        }

        const p75 = percentile(values, 75);
        const median = percentile(values, 50);
        const thresholds = DEFAULT_THRESHOLDS[metric];
        const rating = rateMetric(p75, thresholds);

        metrics[metric] = { p75, median, count: values.length, rating };
      }

      // Overall rating: worst of LCP, INP, CLS (the 3 Core Web Vitals)
      const coreRatings = ['lcp', 'inp', 'cls'].map(m => metrics[m]?.rating || 'no-data');
      const overallRating = getWorstRating(coreRatings);

      // Device breakdown
      const deviceBreakdown = {};
      for (const dt of VALID_DEVICE_TYPES) {
        const deviceItems = items.filter(i => i.deviceType === dt);
        deviceBreakdown[dt] = deviceItems.length;
      }

      return {
        success: true,
        period: `${days} days`,
        sampleCount: items.length,
        metrics,
        overallRating,
        deviceBreakdown,
      };
    } catch (err) {
      console.error('[coreWebVitals] getPerformanceSummary error:', err);
      return { success: false, error: 'Failed to get performance summary' };
    }
  }
);

// ─── getPagePerformance ──────────────────────────────────────────

/**
 * Get per-page performance comparison to identify slow pages.
 *
 * @param {number} [days=7] - Analysis period
 * @returns {Promise<Object>} Pages ranked by performance
 */
export const getPagePerformance = webMethod(
  Permissions.Admin,
  async (days = 7) => {
    try {
      const safeDays = Math.min(Math.max(1, days), 90);
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      const result = await wixData.query(METRICS_COLLECTION)
        .ge('timestamp', since)
        .limit(1000)
        .find();

      if (result.items.length === 0) {
        return { success: true, pages: [] };
      }

      // Group by page
      const pageMap = {};
      for (const item of result.items) {
        const page = item.page || 'unknown';
        if (!pageMap[page]) {
          pageMap[page] = { page, samples: [] };
        }
        pageMap[page].samples.push(item);
      }

      // Calculate p75 for each page
      const pages = Object.values(pageMap).map(entry => {
        const lcpValues = entry.samples.map(s => s.lcp).filter(v => v > 0).sort((a, b) => a - b);
        const clsValues = entry.samples.map(s => s.cls).filter(v => typeof v === 'number').sort((a, b) => a - b);
        const inpValues = entry.samples.map(s => s.inp).filter(v => v > 0).sort((a, b) => a - b);

        const lcpP75 = percentile(lcpValues, 75);
        const clsP75 = percentile(clsValues, 75);
        const inpP75 = percentile(inpValues, 75);

        return {
          page: entry.page,
          sampleCount: entry.samples.length,
          lcp: { p75: lcpP75, rating: rateMetric(lcpP75, DEFAULT_THRESHOLDS.lcp) },
          cls: { p75: clsP75, rating: rateMetric(clsP75, DEFAULT_THRESHOLDS.cls) },
          inp: { p75: inpP75, rating: rateMetric(inpP75, DEFAULT_THRESHOLDS.inp) },
        };
      });

      // Sort by worst LCP first
      pages.sort((a, b) => b.lcp.p75 - a.lcp.p75);

      return { success: true, pages };
    } catch (err) {
      console.error('[coreWebVitals] getPagePerformance error:', err);
      return { success: false, error: 'Failed to get page performance' };
    }
  }
);

// ─── getImageOptimizationHints ────────────────────────────────────

/**
 * Generate image optimization recommendations based on image dimensions
 * and usage context. Wix automatically serves responsive images, but
 * this helps with explicit sizing and format hints.
 *
 * @param {Array<Object>} images - Array of {src, width, height, context}
 *   context: "hero" | "product" | "thumbnail" | "gallery" | "icon"
 * @returns {{hints: Array<Object>}}
 */
export const getImageOptimizationHints = webMethod(
  Permissions.Anyone,
  (images) => {
    if (!Array.isArray(images)) return { hints: [] };

    const hints = images.slice(0, MAX_BATCH_SIZE).map(img => {
      const src = typeof img.src === 'string' ? img.src : '';
      const width = typeof img.width === 'number' ? img.width : 0;
      const height = typeof img.height === 'number' ? img.height : 0;
      const context = img.context || 'product';

      const recommendations = [];
      const targetDimensions = getTargetDimensions(context);

      // Check oversized images
      if (width > targetDimensions.maxWidth * 2) {
        recommendations.push({
          type: 'resize',
          message: `Image width ${width}px exceeds 2x target (${targetDimensions.maxWidth}px). Resize to reduce payload.`,
          priority: 'high',
        });
      }

      // Suggest format
      if (src && !src.includes('.webp') && !src.includes('format/webp')) {
        recommendations.push({
          type: 'format',
          message: 'Use WebP format for 25-35% smaller file sizes.',
          priority: 'medium',
        });
      }

      // Suggest lazy loading for below-the-fold contexts
      const eagerContexts = ['hero'];
      if (!eagerContexts.includes(context)) {
        recommendations.push({
          type: 'loading',
          message: `Use lazy loading for ${context} images.`,
          priority: 'low',
          loading: 'lazy',
        });
      } else {
        recommendations.push({
          type: 'loading',
          message: 'Use eager loading with fetchpriority="high" for hero images.',
          priority: 'high',
          loading: 'eager',
          fetchPriority: 'high',
        });
      }

      // Suggest dimensions for CLS prevention
      if (!width || !height) {
        recommendations.push({
          type: 'dimensions',
          message: 'Set explicit width and height to prevent CLS.',
          priority: 'high',
        });
      }

      return {
        src: src.slice(0, 200),
        context,
        targetWidth: targetDimensions.maxWidth,
        targetHeight: targetDimensions.maxHeight,
        recommendations,
      };
    });

    return { hints };
  }
);

// ─── getLazyLoadConfig ────────────────────────────────────────────

/**
 * Get lazy loading configuration for a page's images and sections.
 * Returns which elements should be eager vs lazy loaded based on
 * their position and importance.
 *
 * @param {string} pageType - "home" | "product" | "category" | "blog" | "other"
 * @returns {{config: Object}}
 */
export const getLazyLoadConfig = webMethod(
  Permissions.Anyone,
  (pageType) => {
    const configs = {
      home: {
        hero: { loading: 'eager', fetchPriority: 'high', decoding: 'sync' },
        featuredProducts: { loading: 'lazy', decoding: 'async', rootMargin: '200px' },
        testimonials: { loading: 'lazy', decoding: 'async', rootMargin: '300px' },
        footer: { loading: 'lazy', decoding: 'async', rootMargin: '400px' },
      },
      product: {
        mainImage: { loading: 'eager', fetchPriority: 'high', decoding: 'sync' },
        gallery: { loading: 'lazy', decoding: 'async', rootMargin: '100px' },
        reviews: { loading: 'lazy', decoding: 'async', rootMargin: '300px' },
        recommendations: { loading: 'lazy', decoding: 'async', rootMargin: '400px' },
      },
      category: {
        banner: { loading: 'eager', fetchPriority: 'high', decoding: 'sync' },
        productGrid: { loading: 'lazy', decoding: 'async', rootMargin: '200px' },
        filters: { loading: 'eager', decoding: 'async' },
      },
      blog: {
        featuredImage: { loading: 'eager', fetchPriority: 'high', decoding: 'sync' },
        inlineImages: { loading: 'lazy', decoding: 'async', rootMargin: '200px' },
        relatedPosts: { loading: 'lazy', decoding: 'async', rootMargin: '400px' },
      },
      other: {
        primaryImage: { loading: 'eager', decoding: 'async' },
        secondaryImages: { loading: 'lazy', decoding: 'async', rootMargin: '200px' },
      },
    };

    const config = configs[pageType] || configs.other;
    return { config };
  }
);

// ─── checkPerformanceBudget ──────────────────────────────────────

/**
 * Check if reported metrics violate configured performance budgets.
 * Used by CI/CD or admin dashboard to enforce performance standards.
 *
 * @param {Object} metrics - Metric values to check
 * @param {string} [page="*"] - Page to check budgets for
 * @returns {Promise<{pass: boolean, violations: Array, checked: number}>}
 */
export const checkPerformanceBudget = webMethod(
  Permissions.Admin,
  async (metrics, page = '*') => {
    try {
      if (!metrics || typeof metrics !== 'object') {
        return { pass: false, violations: [], checked: 0, error: 'Metrics object required' };
      }

      // Load custom budgets from CMS
      const budgetResult = await wixData.query(BUDGETS_COLLECTION)
        .eq('enabled', true)
        .find();

      const customBudgets = budgetResult.items;
      const violations = [];
      let checked = 0;

      for (const metric of VALID_METRICS) {
        const value = metrics[metric];
        if (typeof value !== 'number') continue;

        checked++;

        // Find custom budget for this metric + page
        const budget = customBudgets.find(
          b => b.metricName === metric && (b.page === page || b.page === '*')
        );

        const thresholds = budget
          ? { good: budget.goodThreshold, needsImprovement: budget.needsImprovementThreshold }
          : DEFAULT_THRESHOLDS[metric];

        if (!thresholds) continue;

        if (value > thresholds.needsImprovement) {
          violations.push({
            metric,
            value,
            threshold: thresholds.needsImprovement,
            severity: 'poor',
            message: `${metric.toUpperCase()} of ${value} exceeds poor threshold (${thresholds.needsImprovement})`,
          });
        } else if (value > thresholds.good) {
          violations.push({
            metric,
            value,
            threshold: thresholds.good,
            severity: 'needs-improvement',
            message: `${metric.toUpperCase()} of ${value} exceeds good threshold (${thresholds.good})`,
          });
        }
      }

      return {
        pass: violations.filter(v => v.severity === 'poor').length === 0,
        violations,
        checked,
      };
    } catch (err) {
      console.error('[coreWebVitals] checkPerformanceBudget error:', err);
      return { pass: false, violations: [], checked: 0, error: 'Failed to check budgets' };
    }
  }
);

// ─── Internal Helpers ──────────────────────────────────────────────

/**
 * Clamp a numeric metric value to a valid range.
 * Returns 0 for non-numeric inputs.
 */
function clampMetric(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculate a percentile value from a sorted array.
 */
function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

/**
 * Rate a metric value against thresholds.
 * @returns {'good'|'needs-improvement'|'poor'}
 */
function rateMetric(value, thresholds) {
  if (!thresholds || typeof value !== 'number') return 'no-data';
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Get the worst rating from an array of ratings.
 */
function getWorstRating(ratings) {
  const order = ['poor', 'needs-improvement', 'good', 'no-data'];
  for (const level of order) {
    if (ratings.includes(level)) return level;
  }
  return 'no-data';
}

/**
 * Check reported metrics against default budgets (synchronous).
 */
function checkBudgetViolations(record) {
  const violations = [];
  for (const metric of ['lcp', 'inp', 'cls']) {
    const value = record[metric];
    if (typeof value !== 'number' || value === 0) continue;

    const thresholds = DEFAULT_THRESHOLDS[metric];
    if (value > thresholds.needsImprovement) {
      violations.push({ metric, value, severity: 'poor' });
    } else if (value > thresholds.good) {
      violations.push({ metric, value, severity: 'needs-improvement' });
    }
  }
  return violations;
}

/**
 * Get target dimensions for image context.
 */
function getTargetDimensions(context) {
  const dimensions = {
    hero: { maxWidth: 1920, maxHeight: 800 },
    product: { maxWidth: 800, maxHeight: 800 },
    thumbnail: { maxWidth: 300, maxHeight: 300 },
    gallery: { maxWidth: 600, maxHeight: 600 },
    icon: { maxWidth: 64, maxHeight: 64 },
  };
  return dimensions[context] || dimensions.product;
}

// Exported for testing
export {
  DEFAULT_THRESHOLDS,
  VALID_METRICS,
  VALID_DEVICE_TYPES,
  clampMetric,
  percentile,
  rateMetric,
  getWorstRating,
  checkBudgetViolations,
  getTargetDimensions,
};
