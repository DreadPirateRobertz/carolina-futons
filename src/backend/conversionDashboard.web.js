/**
 * @module conversionDashboard
 * @description Conversion funnel dashboard — aggregates analytics events into
 * funnel visualization data with step-by-step conversion rates and drop-off.
 *
 * Funnel: product_view → add_to_cart → checkout → purchase
 *
 * Data sources:
 * - ProductAnalytics CMS (views, adds)
 * - AnalyticsEvents CMS (custom events)
 * - EmailQueue/Orders for purchase attribution
 *
 * CF-9dhf
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logAuditEvent } from 'backend/utils/auditLog';

const ANALYTICS_COLLECTION = 'ProductAnalytics';
const EVENTS_COLLECTION = 'AnalyticsEvents';

const FUNNEL_STEPS = ['product_view', 'add_to_cart', 'checkout', 'purchase'];

// ── Funnel Data ─────────────────────────────────────────────────────

/**
 * Get the conversion funnel for a time period.
 *
 * @param {Object} [options]
 * @param {number} [options.days=7] - Lookback period
 * @param {string} [options.category] - Filter by product category
 * @returns {Promise<{success: boolean, funnel: Object}>}
 * @permission Admin
 */
export const getConversionFunnel = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const days = Math.min(Math.max(1, options.days || 7), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const stepCounts = {};
      for (const step of FUNNEL_STEPS) {
        let query = wixData.query(EVENTS_COLLECTION)
          .eq('eventType', step)
          .ge('timestamp', since);

        stepCounts[step] = await query.count();
      }

      // Also check ProductAnalytics for view/add counts (may have more data)
      const analyticsViews = await wixData.query(ANALYTICS_COLLECTION)
        .ge('lastViewedAt', since)
        .limit(1000)
        .find();

      const totalProductViews = analyticsViews.items.reduce((sum, p) => sum + (p.viewCount || 0), 0);
      const totalAddToCarts = analyticsViews.items.reduce((sum, p) => sum + (p.addToCartCount || 0), 0);

      // Use the higher of the two data sources
      if (totalProductViews > stepCounts.product_view) {
        stepCounts.product_view = totalProductViews;
      }
      if (totalAddToCarts > stepCounts.add_to_cart) {
        stepCounts.add_to_cart = totalAddToCarts;
      }

      // Build funnel steps with conversion rates
      const steps = FUNNEL_STEPS.map((step, i) => {
        const count = stepCounts[step] || 0;
        const prevCount = i > 0 ? (stepCounts[FUNNEL_STEPS[i - 1]] || 0) : count;
        const stepRate = prevCount > 0 ? Math.round((count / prevCount) * 10000) / 100 : 0;
        const overallRate = stepCounts.product_view > 0
          ? Math.round((count / stepCounts.product_view) * 10000) / 100
          : 0;
        const dropOff = i > 0 ? prevCount - count : 0;
        const dropOffRate = prevCount > 0 ? Math.round((dropOff / prevCount) * 10000) / 100 : 0;

        return {
          step,
          label: getStepLabel(step),
          count,
          stepConversionRate: stepRate,
          overallConversionRate: overallRate,
          dropOff,
          dropOffRate,
        };
      });

      return {
        success: true,
        funnel: {
          period: { days, since: since.toISOString() },
          steps,
          overallConversion: stepCounts.product_view > 0
            ? Math.round(((stepCounts.purchase || 0) / stepCounts.product_view) * 10000) / 100
            : 0,
          biggestDropOff: steps.reduce((worst, s) =>
            s.dropOffRate > (worst?.dropOffRate || 0) ? s : worst, null),
        },
      };
    } catch (err) {
      console.error('[conversionDashboard] getConversionFunnel error:', err);
      return { success: false, funnel: null };
    }
  }
);

/**
 * Get daily conversion trends for the dashboard chart.
 *
 * @param {number} [days=7]
 * @returns {Promise<{success: boolean, trend: Array}>}
 * @permission Admin
 */
export const getDailyConversionTrend = webMethod(
  Permissions.Admin,
  async (days = 7) => {
    try {
      const safeDays = Math.min(Math.max(1, days), 90);
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      const events = await wixData.query(EVENTS_COLLECTION)
        .ge('timestamp', since)
        .limit(1000)
        .find();

      const daily = {};

      for (const event of events.items) {
        if (!FUNNEL_STEPS.includes(event.eventType)) continue;

        const day = event.timestamp
          ? new Date(event.timestamp).toISOString().split('T')[0]
          : null;
        if (!day) continue;

        if (!daily[day]) {
          daily[day] = { product_view: 0, add_to_cart: 0, checkout: 0, purchase: 0 };
        }
        daily[day][event.eventType]++;
      }

      const trend = Object.entries(daily)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, counts]) => ({
          date,
          ...counts,
          viewToCartRate: counts.product_view > 0
            ? Math.round((counts.add_to_cart / counts.product_view) * 10000) / 100
            : 0,
          cartToPurchaseRate: counts.add_to_cart > 0
            ? Math.round((counts.purchase / counts.add_to_cart) * 10000) / 100
            : 0,
        }));

      return { success: true, trend };
    } catch (err) {
      console.error('[conversionDashboard] getDailyConversionTrend error:', err);
      return { success: false, trend: [] };
    }
  }
);

/**
 * Get per-category conversion breakdown.
 *
 * @param {number} [days=7]
 * @returns {Promise<{success: boolean, categories: Array}>}
 * @permission Admin
 */
export const getCategoryConversion = webMethod(
  Permissions.Admin,
  async (days = 7) => {
    try {
      const safeDays = Math.min(Math.max(1, days), 90);
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      const events = await wixData.query(EVENTS_COLLECTION)
        .ge('timestamp', since)
        .limit(1000)
        .find();

      const catMap = {};

      for (const event of events.items) {
        if (!FUNNEL_STEPS.includes(event.eventType)) continue;

        let payload = {};
        try { payload = JSON.parse(event.payload || '{}'); } catch (e) {}
        const category = payload.category || 'uncategorized';

        if (!catMap[category]) {
          catMap[category] = { product_view: 0, add_to_cart: 0, checkout: 0, purchase: 0 };
        }
        catMap[category][event.eventType]++;
      }

      const categories = Object.entries(catMap)
        .map(([category, counts]) => ({
          category,
          ...counts,
          viewToCartRate: counts.product_view > 0
            ? Math.round((counts.add_to_cart / counts.product_view) * 10000) / 100
            : 0,
          overallConversion: counts.product_view > 0
            ? Math.round((counts.purchase / counts.product_view) * 10000) / 100
            : 0,
        }))
        .sort((a, b) => b.product_view - a.product_view);

      return { success: true, categories };
    } catch (err) {
      console.error('[conversionDashboard] getCategoryConversion error:', err);
      return { success: false, categories: [] };
    }
  }
);

/**
 * Get dashboard summary with key metrics.
 *
 * @param {number} [days=7]
 * @returns {Promise<{success: boolean, summary: Object}>}
 * @permission Admin
 */
export const getDashboardSummary = webMethod(
  Permissions.Admin,
  async (days = 7) => {
    try {
      const funnelResult = await getConversionFunnel({ days });
      if (!funnelResult.success) return { success: false, summary: null };

      const funnel = funnelResult.funnel;
      const steps = funnel.steps;

      return {
        success: true,
        summary: {
          period: funnel.period,
          totalViews: steps[0]?.count || 0,
          totalPurchases: steps[3]?.count || 0,
          overallConversion: funnel.overallConversion,
          viewToCartRate: steps[1]?.stepConversionRate || 0,
          cartToCheckoutRate: steps[2]?.stepConversionRate || 0,
          checkoutToPurchaseRate: steps[3]?.stepConversionRate || 0,
          biggestDropOff: funnel.biggestDropOff
            ? { step: funnel.biggestDropOff.step, rate: funnel.biggestDropOff.dropOffRate }
            : null,
        },
      };
    } catch (err) {
      console.error('[conversionDashboard] getDashboardSummary error:', err);
      return { success: false, summary: null };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function getStepLabel(step) {
  const labels = {
    product_view: 'Product View',
    add_to_cart: 'Add to Cart',
    checkout: 'Checkout',
    purchase: 'Purchase',
  };
  return labels[step] || step;
}

export const _FUNNEL_STEPS = FUNNEL_STEPS;
