/**
 * @module bundleAnalytics
 * @description Bundle analytics: impression tracking, conversion rates, and
 * data-driven recommendations. Tracks bundle view/add-to-cart events, calculates
 * conversion rates per bundle, and recommends bundle adjustments to admins.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `BundleAnalytics` with fields:
 *   bundleId (Text, indexed) - Product bundle identifier
 *   bundleName (Text) - Display name of the bundle
 *   event (Text, indexed) - 'impression'|'click'|'add_to_cart'|'purchase'
 *   memberId (Text) - Member who triggered event (empty for anonymous)
 *   sessionId (Text) - Session identifier for anonymous tracking
 *   source (Text) - Where the bundle was shown: 'product_page'|'cart'|'homepage'|'category'
 *   revenue (Number) - Revenue if purchase event
 *   timestamp (Date, indexed) - When the event occurred
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

const VALID_EVENTS = ['impression', 'click', 'add_to_cart', 'purchase'];
const VALID_SOURCES = ['product_page', 'cart', 'homepage', 'category'];

/**
 * Track a bundle impression or interaction event.
 *
 * @param {Object} data
 * @param {string} data.bundleId - Bundle identifier.
 * @param {string} data.bundleName - Bundle display name.
 * @param {string} data.event - Event type: 'impression'|'click'|'add_to_cart'|'purchase'
 * @param {string} [data.source] - Where the bundle was displayed.
 * @param {string} [data.sessionId] - Session ID for anonymous tracking.
 * @param {number} [data.revenue] - Revenue amount for purchase events.
 * @returns {Promise<{success: boolean}>}
 */
export const trackBundleImpression = webMethod(
  Permissions.Anyone,
  async (data) => {
    try {
      const bundleId = validateId(data.bundleId);
      if (!bundleId) {
        return { success: false, error: 'Valid bundle ID is required.' };
      }

      const event = sanitize(data.event, 20);
      if (!VALID_EVENTS.includes(event)) {
        return { success: false, error: 'Invalid event type. Must be impression, click, add_to_cart, or purchase.' };
      }

      let memberId = '';
      try {
        const member = await currentMember.getMember();
        if (member) memberId = member._id;
      } catch {
        // Anonymous user — continue without memberId
      }

      const source = sanitize(data.source || '', 30);

      const record = {
        bundleId,
        bundleName: sanitize(data.bundleName || '', 200),
        event,
        memberId,
        sessionId: sanitize(data.sessionId || '', 100),
        source: VALID_SOURCES.includes(source) ? source : 'product_page',
        revenue: event === 'purchase' ? Math.max(0, Number(data.revenue) || 0) : 0,
        timestamp: new Date(),
      };

      await wixData.insert('BundleAnalytics', record);
      return { success: true };
    } catch (err) {
      console.error('[bundleAnalytics] Error tracking bundle impression:', err);
      return { success: false, error: 'Failed to track event.' };
    }
  }
);

/**
 * Get analytics summary for a specific bundle.
 * Returns impression count, click count, add-to-cart count, purchase count,
 * and calculated conversion rates.
 *
 * @param {string} bundleId - Bundle identifier.
 * @param {number} [days=30] - Lookback period in days.
 * @returns {Promise<{success: boolean, analytics: Object}>}
 */
export const getBundleAnalytics = webMethod(
  Permissions.Admin,
  async (bundleId, days = 30) => {
    try {
      const cleanId = validateId(bundleId);
      if (!cleanId) {
        return { success: false, error: 'Valid bundle ID is required.', analytics: null };
      }

      const lookback = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookback);

      const result = await wixData.query('BundleAnalytics')
        .eq('bundleId', cleanId)
        .ge('timestamp', startDate)
        .limit(1000)
        .find();

      const events = result.items;
      const impressions = events.filter(e => e.event === 'impression').length;
      const clicks = events.filter(e => e.event === 'click').length;
      const addToCarts = events.filter(e => e.event === 'add_to_cart').length;
      const purchases = events.filter(e => e.event === 'purchase').length;
      const totalRevenue = events
        .filter(e => e.event === 'purchase')
        .reduce((sum, e) => sum + (e.revenue || 0), 0);

      const analytics = {
        bundleId: cleanId,
        bundleName: events[0]?.bundleName || '',
        period: { days: lookback, start: startDate.toISOString() },
        impressions,
        clicks,
        addToCarts,
        purchases,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        clickRate: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cartRate: impressions > 0 ? Math.round((addToCarts / impressions) * 10000) / 100 : 0,
        conversionRate: impressions > 0 ? Math.round((purchases / impressions) * 10000) / 100 : 0,
        avgOrderValue: purchases > 0 ? Math.round((totalRevenue / purchases) * 100) / 100 : 0,
      };

      return { success: true, analytics };
    } catch (err) {
      console.error('[bundleAnalytics] Error getting bundle analytics:', err);
      return { success: false, error: 'Failed to load analytics.', analytics: null };
    }
  }
);

/**
 * Get performance comparison across all bundles.
 * Returns top-performing and underperforming bundles for admin dashboard.
 *
 * @param {number} [days=30] - Lookback period in days.
 * @param {number} [limit=20] - Max bundles to return.
 * @returns {Promise<{success: boolean, bundles: Array}>}
 */
export const getBundlePerformance = webMethod(
  Permissions.Admin,
  async (days = 30, limit = 20) => {
    try {
      const lookback = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
      const maxBundles = Math.max(1, Math.min(50, Math.round(Number(limit) || 20)));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookback);

      const result = await wixData.query('BundleAnalytics')
        .ge('timestamp', startDate)
        .limit(1000)
        .find();

      // Group by bundleId
      const bundleMap = {};
      for (const item of result.items) {
        const id = item.bundleId;
        if (!bundleMap[id]) {
          bundleMap[id] = {
            bundleId: id,
            bundleName: item.bundleName || '',
            impressions: 0,
            clicks: 0,
            addToCarts: 0,
            purchases: 0,
            totalRevenue: 0,
          };
        }
        const b = bundleMap[id];
        if (item.event === 'impression') b.impressions++;
        else if (item.event === 'click') b.clicks++;
        else if (item.event === 'add_to_cart') b.addToCarts++;
        else if (item.event === 'purchase') {
          b.purchases++;
          b.totalRevenue += item.revenue || 0;
        }
      }

      const bundles = Object.values(bundleMap)
        .map(b => ({
          ...b,
          totalRevenue: Math.round(b.totalRevenue * 100) / 100,
          conversionRate: b.impressions > 0
            ? Math.round((b.purchases / b.impressions) * 10000) / 100
            : 0,
          cartRate: b.impressions > 0
            ? Math.round((b.addToCarts / b.impressions) * 10000) / 100
            : 0,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, maxBundles);

      return { success: true, bundles };
    } catch (err) {
      console.error('[bundleAnalytics] Error getting bundle performance:', err);
      return { success: false, error: 'Failed to load performance data.', bundles: [] };
    }
  }
);

/**
 * Get data-driven bundle recommendations for admins.
 * Analyzes performance data to suggest which bundles to promote, adjust, or retire.
 *
 * @param {number} [days=30] - Lookback period.
 * @returns {Promise<{success: boolean, recommendations: Array}>}
 */
export const getRecommendedBundles = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      const lookback = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookback);

      const result = await wixData.query('BundleAnalytics')
        .ge('timestamp', startDate)
        .limit(1000)
        .find();

      // Group by bundleId
      const bundleMap = {};
      for (const item of result.items) {
        const id = item.bundleId;
        if (!bundleMap[id]) {
          bundleMap[id] = {
            bundleId: id,
            bundleName: item.bundleName || '',
            impressions: 0,
            clicks: 0,
            addToCarts: 0,
            purchases: 0,
            totalRevenue: 0,
            sources: new Set(),
          };
        }
        const b = bundleMap[id];
        if (item.event === 'impression') b.impressions++;
        else if (item.event === 'click') b.clicks++;
        else if (item.event === 'add_to_cart') b.addToCarts++;
        else if (item.event === 'purchase') {
          b.purchases++;
          b.totalRevenue += item.revenue || 0;
        }
        if (item.source) b.sources.add(item.source);
      }

      const recommendations = [];
      for (const b of Object.values(bundleMap)) {
        const convRate = b.impressions > 0 ? b.purchases / b.impressions : 0;
        const cartRate = b.impressions > 0 ? b.addToCarts / b.impressions : 0;

        if (convRate >= 0.05 && b.purchases >= 3) {
          // High performers — promote more
          recommendations.push({
            bundleId: b.bundleId,
            bundleName: b.bundleName,
            action: 'promote',
            reason: `Strong conversion rate (${(convRate * 100).toFixed(1)}%) with ${b.purchases} purchases. Consider featuring on homepage.`,
            conversionRate: Math.round(convRate * 10000) / 100,
            revenue: Math.round(b.totalRevenue * 100) / 100,
            priority: 1,
          });
        } else if (cartRate >= 0.1 && convRate < 0.02 && b.addToCarts >= 5) {
          // High cart adds but low conversion — pricing issue
          recommendations.push({
            bundleId: b.bundleId,
            bundleName: b.bundleName,
            action: 'adjust_price',
            reason: `High add-to-cart rate (${(cartRate * 100).toFixed(1)}%) but low conversion (${(convRate * 100).toFixed(1)}%). Consider adjusting price or adding a discount.`,
            conversionRate: Math.round(convRate * 10000) / 100,
            revenue: Math.round(b.totalRevenue * 100) / 100,
            priority: 2,
          });
        } else if (b.impressions >= 50 && convRate < 0.01 && b.purchases === 0) {
          // High impressions, no conversions — consider retiring
          recommendations.push({
            bundleId: b.bundleId,
            bundleName: b.bundleName,
            action: 'retire',
            reason: `${b.impressions} impressions with zero purchases. Consider retiring or restructuring this bundle.`,
            conversionRate: 0,
            revenue: 0,
            priority: 3,
          });
        } else if (b.impressions < 10 && b.sources.size <= 1) {
          // Low visibility — expand placement
          recommendations.push({
            bundleId: b.bundleId,
            bundleName: b.bundleName,
            action: 'expand_placement',
            reason: `Only ${b.impressions} impressions from ${b.sources.size} source(s). Try showing in more locations.`,
            conversionRate: Math.round(convRate * 10000) / 100,
            revenue: Math.round(b.totalRevenue * 100) / 100,
            priority: 2,
          });
        }
      }

      recommendations.sort((a, b) => a.priority - b.priority);

      return { success: true, recommendations };
    } catch (err) {
      console.error('[bundleAnalytics] Error getting recommendations:', err);
      return { success: false, error: 'Failed to generate recommendations.', recommendations: [] };
    }
  }
);
