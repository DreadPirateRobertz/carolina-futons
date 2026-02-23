/**
 * @module analyticsDashboard
 * @description GA4 analytics dashboard helpers for marketing launch.
 * Provides conversion funnel data, revenue attribution, and e-commerce
 * event aggregation for admin dashboards. Builds on analyticsHelpers.web.js
 * (which handles individual event tracking and GA4 payload building).
 *
 * Data sources:
 * - ProductAnalytics CMS collection (views, add-to-cart counts)
 * - EmailQueue CMS collection (email funnel metrics)
 * - Stores/Orders collection (revenue, order data)
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Conversion Funnel ───────────────────────────────────────────────

/**
 * Get the e-commerce conversion funnel data.
 * Tracks: Product Views → Add to Cart → Checkout → Purchase.
 *
 * @function getConversionFunnel
 * @param {number} [days=30] - Lookback window in days
 * @returns {Promise<{stages: Array, conversionRates: Object, period: string}>}
 * @permission Admin
 */
export const getConversionFunnel = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      // Aggregate from ProductAnalytics
      const analytics = await wixData.query('ProductAnalytics')
        .find();

      let totalViews = 0;
      let totalAddToCart = 0;
      let totalPurchases = 0;

      for (const item of analytics.items) {
        totalViews += item.viewCount || 0;
        totalAddToCart += item.addToCartCount || 0;
        totalPurchases += item.purchaseCount || 0;
      }

      const stages = [
        { name: 'Product Views', count: totalViews, icon: 'eye' },
        { name: 'Add to Cart', count: totalAddToCart, icon: 'cart' },
        { name: 'Purchase', count: totalPurchases, icon: 'check' },
      ];

      return {
        stages,
        conversionRates: {
          viewToCart: totalViews > 0 ? round((totalAddToCart / totalViews) * 100) : 0,
          cartToPurchase: totalAddToCart > 0 ? round((totalPurchases / totalAddToCart) * 100) : 0,
          viewToPurchase: totalViews > 0 ? round((totalPurchases / totalViews) * 100) : 0,
        },
        period: `${days} days`,
      };
    } catch (err) {
      console.error('[analyticsDashboard] Error building conversion funnel:', err);
      return {
        stages: [],
        conversionRates: { viewToCart: 0, cartToPurchase: 0, viewToPurchase: 0 },
        period: `${days} days`,
      };
    }
  }
);

/**
 * Get top-performing products by conversion rate (add-to-cart / views).
 *
 * @function getTopConverters
 * @param {number} [limit=10] - Max products to return
 * @param {number} [minViews=10] - Minimum views to qualify
 * @returns {Promise<Array<{productId: string, productName: string, viewCount: number, addToCartCount: number, conversionRate: number}>>}
 * @permission Admin
 */
export const getTopConverters = webMethod(
  Permissions.Admin,
  async (limit = 10, minViews = 10) => {
    try {
      const analytics = await wixData.query('ProductAnalytics')
        .ge('viewCount', minViews)
        .descending('viewCount')
        .find();

      return analytics.items
        .map(item => ({
          productId: item.productId,
          productName: item.productName || '',
          category: item.category || '',
          viewCount: item.viewCount || 0,
          addToCartCount: item.addToCartCount || 0,
          purchaseCount: item.purchaseCount || 0,
          conversionRate: item.viewCount > 0
            ? round((item.addToCartCount || 0) / item.viewCount * 100)
            : 0,
        }))
        .sort((a, b) => b.conversionRate - a.conversionRate)
        .slice(0, limit);
    } catch (err) {
      console.error('[analyticsDashboard] Error fetching top converters:', err);
      return [];
    }
  }
);

// ── Category Performance ────────────────────────────────────────────

/**
 * Get analytics breakdown by product category.
 *
 * @function getCategoryPerformance
 * @returns {Promise<Array<{category: string, views: number, addToCart: number, purchases: number, conversionRate: number}>>}
 * @permission Admin
 */
export const getCategoryPerformance = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const analytics = await wixData.query('ProductAnalytics')
        .find();

      const categories = {};

      for (const item of analytics.items) {
        const cat = item.category || 'uncategorized';
        if (!categories[cat]) {
          categories[cat] = { category: cat, views: 0, addToCart: 0, purchases: 0 };
        }
        categories[cat].views += item.viewCount || 0;
        categories[cat].addToCart += item.addToCartCount || 0;
        categories[cat].purchases += item.purchaseCount || 0;
      }

      return Object.values(categories)
        .map(cat => ({
          ...cat,
          conversionRate: cat.views > 0 ? round((cat.addToCart / cat.views) * 100) : 0,
        }))
        .sort((a, b) => b.views - a.views);
    } catch (err) {
      console.error('[analyticsDashboard] Error fetching category performance:', err);
      return [];
    }
  }
);

// ── Email Marketing Metrics ─────────────────────────────────────────

/**
 * Get email marketing funnel metrics for the dashboard.
 *
 * @function getEmailFunnelMetrics
 * @param {number} [days=30] - Lookback window
 * @returns {Promise<Object>} Email metrics by sequence type
 * @permission Admin
 */
export const getEmailFunnelMetrics = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await wixData.query('EmailQueue')
        .ge('createdAt', since)
        .find();

      const metrics = {};

      for (const item of result.items) {
        const seq = item.sequenceType || 'unknown';
        if (!metrics[seq]) {
          metrics[seq] = { queued: 0, sent: 0, failed: 0, cancelled: 0 };
        }
        metrics[seq].queued++;
        if (item.status === 'sent') metrics[seq].sent++;
        if (item.status === 'failed') metrics[seq].failed++;
        if (item.status === 'cancelled') metrics[seq].cancelled++;
      }

      // Calculate delivery rates
      for (const seq of Object.values(metrics)) {
        seq.deliveryRate = seq.queued > 0 ? round((seq.sent / seq.queued) * 100) : 0;
      }

      return {
        metrics,
        totalEmails: result.items.length,
        period: `${days} days`,
      };
    } catch (err) {
      console.error('[analyticsDashboard] Error fetching email metrics:', err);
      return { metrics: {}, totalEmails: 0, period: `${days} days` };
    }
  }
);

// ── Revenue Attribution ─────────────────────────────────────────────

/**
 * Get revenue summary from ProductAnalytics purchase data.
 * Joins with product data to calculate attributed revenue.
 *
 * @function getRevenueAttribution
 * @param {number} [limit=10] - Top products to return
 * @returns {Promise<{topProducts: Array, totalAttributedRevenue: number}>}
 * @permission Admin
 */
export const getRevenueAttribution = webMethod(
  Permissions.Admin,
  async (limit = 10) => {
    try {
      const analytics = await wixData.query('ProductAnalytics')
        .descending('purchaseCount')
        .limit(limit)
        .find();

      if (analytics.items.length === 0) {
        return { topProducts: [], totalAttributedRevenue: 0 };
      }

      const productIds = analytics.items.map(a => a.productId);
      const products = await wixData.query('Stores/Products')
        .hasSome('_id', productIds)
        .find();

      const productMap = new Map(products.items.map(p => [p._id, p]));

      let totalAttributedRevenue = 0;
      const topProducts = analytics.items.map(a => {
        const product = productMap.get(a.productId);
        const price = product ? (product.discountedPrice || product.price || 0) : 0;
        const revenue = price * (a.purchaseCount || 0);
        totalAttributedRevenue += revenue;

        return {
          productId: a.productId,
          productName: a.productName || (product ? product.name : ''),
          category: a.category || '',
          purchaseCount: a.purchaseCount || 0,
          price,
          attributedRevenue: round(revenue),
        };
      }).filter(p => p.purchaseCount > 0);

      return {
        topProducts,
        totalAttributedRevenue: round(totalAttributedRevenue),
      };
    } catch (err) {
      console.error('[analyticsDashboard] Error fetching revenue attribution:', err);
      return { topProducts: [], totalAttributedRevenue: 0 };
    }
  }
);

// ── Dashboard Summary ───────────────────────────────────────────────

/**
 * Get a unified dashboard summary with key KPIs.
 *
 * @function getDashboardSummary
 * @param {number} [days=30] - Lookback window
 * @returns {Promise<Object>} Dashboard KPIs
 * @permission Admin
 */
export const getDashboardSummary = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      const [funnel, categories, emailMetrics, revenue] = await Promise.all([
        getConversionFunnel(days),
        getCategoryPerformance(),
        getEmailFunnelMetrics(days),
        getRevenueAttribution(5),
      ]);

      return {
        funnel: funnel.conversionRates,
        totalViews: funnel.stages[0]?.count || 0,
        totalAddToCart: funnel.stages[1]?.count || 0,
        totalPurchases: funnel.stages[2]?.count || 0,
        topCategory: categories[0]?.category || 'none',
        emailsSent: Object.values(emailMetrics.metrics).reduce((sum, m) => sum + m.sent, 0),
        totalRevenue: revenue.totalAttributedRevenue,
        period: `${days} days`,
      };
    } catch (err) {
      console.error('[analyticsDashboard] Error building dashboard summary:', err);
      return {
        funnel: { viewToCart: 0, cartToPurchase: 0, viewToPurchase: 0 },
        totalViews: 0,
        totalAddToCart: 0,
        totalPurchases: 0,
        topCategory: 'none',
        emailsSent: 0,
        totalRevenue: 0,
        period: `${days} days`,
      };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function round(n) {
  return Math.round(n * 100) / 100;
}
