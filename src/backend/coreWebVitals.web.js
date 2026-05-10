/**
 * @module coreWebVitals
 * @description Core Web Vitals ingestion. `reportMetrics` accepts LCP /
 * FID / INP / CLS / TTFB / FCP from `src/pages/masterPage.js` (cfutons +
 * stage3) and writes them to the PerformanceMetrics CMS collection,
 * with a synchronous default-threshold budget check that returns
 * violations to the page for client-side handling.
 *
 * cf-4x7e Pass 2 chunk 10 retired the dashboard / image-optimization /
 * lazy-load / budget / baseline surface (getPerformanceSummary,
 * getPagePerformance, getImageOptimizationHints, getLazyLoadConfig,
 * checkPerformanceBudget, getBaseline, measureVitals — admin tooling
 * superseded by Vercel Web Vitals on cfw, never wired in Velo). Refer
 * to git history for the dashboard implementation if revived.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Requires CMS collection `PerformanceMetrics` with fields:
 *   sessionId (Text)        — Unique session identifier
 *   page (Text)             — Page URL path
 *   deviceType (Text)       — "mobile" | "tablet" | "desktop"
 *   lcp (Number)            — Largest Contentful Paint in ms
 *   fid (Number)            — First Input Delay in ms
 *   inp (Number)            — Interaction to Next Paint in ms
 *   cls (Number)            — Cumulative Layout Shift score
 *   ttfb (Number)           — Time to First Byte in ms
 *   fcp (Number)            — First Contentful Paint in ms
 *   connectionType (Text)   — "4g" | "3g" | "2g" | "slow-2g" | "wifi" | "unknown"
 *   timestamp (DateTime)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';

const METRICS_COLLECTION = 'PerformanceMetrics';
const VALID_DEVICE_TYPES = ['mobile', 'tablet', 'desktop'];

// Google's Core Web Vitals thresholds (used by the synchronous
// budget-violation check on every report).
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

      const { allowed } = await checkRateLimit('MetricsReportRateLimit', sessionId, { max: 30, windowMs: 60_000 });
      if (!allowed) return { success: true }; // Silent drop for tracking

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

      // Check against default thresholds (synchronous; the per-page
      // PerformanceBudgets dashboard surface was retired with Pass 2 chunk 10).
      const violations = checkBudgetViolations(record);

      return { success: true, violations };
    } catch (err) {
      console.error('[coreWebVitals] reportMetrics error:', err);
      return { success: false, error: 'Failed to report metrics' };
    }
  }
);

// ─── Internal Helpers ──────────────────────────────────────────────

/**
 * Clamp a numeric metric value to a valid range.
 * Returns 0 for non-numeric or non-finite inputs (NaN, Infinity, -Infinity).
 */
function clampMetric(value, min, max) {
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
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

// Exported for testing
export {
  DEFAULT_THRESHOLDS,
  VALID_DEVICE_TYPES,
  clampMetric,
  checkBudgetViolations,
};
