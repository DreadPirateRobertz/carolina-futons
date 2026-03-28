/**
 * @module swatchAttribution
 * @description Swatch → purchase attribution tracking.
 *
 * Matches swatch requests to subsequent purchases by email within a 90-day
 * window to calculate swatch conversion rate and average days to purchase.
 *
 * CF-rmf2
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';

const SWATCH_COLLECTION = 'SwatchRequests';
const ATTRIBUTION_COLLECTION = 'SwatchAttributions';
const ATTRIBUTION_WINDOW_DAYS = 90;

// ── Attribution Check ───────────────────────────────────────────────

/**
 * Check if a purchase can be attributed to a swatch request.
 * Call from wixEcom_onOrderCreated event handler.
 *
 * @param {string} buyerEmail
 * @param {string} orderId
 * @param {number} orderTotal
 * @returns {Promise<{success: boolean, attributed: boolean, swatchRequestId: string|null, daysToPurchase: number|null}>}
 * @permission Admin
 */
export const checkSwatchAttribution = webMethod(
  Permissions.Admin,
  async (buyerEmail, orderId, orderTotal) => {
    try {
      const cleanEmail = sanitize(buyerEmail, 254).toLowerCase();
      if (!cleanEmail || !orderId) return { success: false, attributed: false, swatchRequestId: null, daysToPurchase: null };

      const windowStart = new Date(Date.now() - ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      // Find swatch requests from this email within the attribution window
      const requests = await wixData.query(SWATCH_COLLECTION)
        .eq('contactEmail', cleanEmail)
        .ge('requestedAt', windowStart)
        .descending('requestedAt')
        .limit(1)
        .find();

      if (requests.items.length === 0) {
        return { success: true, attributed: false, swatchRequestId: null, daysToPurchase: null };
      }

      const swatchRequest = requests.items[0];

      // Check if already attributed (dedup)
      const existing = await wixData.query(ATTRIBUTION_COLLECTION)
        .eq('orderId', sanitize(orderId, 50))
        .find();

      if (existing.items.length > 0) {
        return { success: true, attributed: true, swatchRequestId: swatchRequest._id, daysToPurchase: null };
      }

      const daysToPurchase = Math.round(
        (Date.now() - new Date(swatchRequest.requestedAt).getTime()) / (24 * 60 * 60 * 1000)
      );

      // Record attribution
      await wixData.insert(ATTRIBUTION_COLLECTION, {
        swatchRequestId: swatchRequest._id,
        orderId: sanitize(orderId, 50),
        email: cleanEmail,
        orderTotal: typeof orderTotal === 'number' ? orderTotal : 0,
        swatchRequestDate: swatchRequest.requestedAt,
        purchaseDate: new Date(),
        daysToPurchase,
        productSlug: swatchRequest.productSlug || '',
      });

      logAuditEvent(ATTRIBUTION_COLLECTION, 'attributed', 'system', {
        orderId, daysToPurchase,
      });

      return { success: true, attributed: true, swatchRequestId: swatchRequest._id, daysToPurchase };
    } catch (err) {
      console.error('[swatchAttribution] checkSwatchAttribution error:', err);
      return { success: false, attributed: false, swatchRequestId: null, daysToPurchase: null };
    }
  }
);

// ── Analytics ────────────────────────────────────────────────────────

/**
 * Get swatch attribution analytics.
 *
 * @param {number} [days=90] - Lookback period
 * @returns {Promise<{success: boolean, analytics: Object}>}
 * @permission Admin
 */
export const getSwatchAnalytics = webMethod(
  Permissions.Admin,
  async (days) => {
    try {
      const lookback = Math.min(Math.max(1, days || 90), 365);
      const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000);

      // Total swatch requests in period
      const totalRequests = await wixData.query(SWATCH_COLLECTION)
        .ge('requestedAt', since)
        .count();

      // Attributions in period
      const attributions = await wixData.query(ATTRIBUTION_COLLECTION)
        .ge('purchaseDate', since)
        .limit(1000)
        .find();

      const totalAttributed = attributions.items.length;
      const conversionRate = totalRequests > 0
        ? Math.round((totalAttributed / totalRequests) * 10000) / 100
        : 0;

      // Average days to purchase
      let avgDaysToPurchase = 0;
      let totalRevenue = 0;
      if (totalAttributed > 0) {
        const totalDays = attributions.items.reduce((sum, a) => sum + (a.daysToPurchase || 0), 0);
        avgDaysToPurchase = Math.round(totalDays / totalAttributed);
        totalRevenue = attributions.items.reduce((sum, a) => sum + (a.orderTotal || 0), 0);
      }

      // Days-to-purchase distribution
      const distribution = { '0-7': 0, '8-14': 0, '15-30': 0, '31-60': 0, '61-90': 0 };
      for (const a of attributions.items) {
        const d = a.daysToPurchase || 0;
        if (d <= 7) distribution['0-7']++;
        else if (d <= 14) distribution['8-14']++;
        else if (d <= 30) distribution['15-30']++;
        else if (d <= 60) distribution['31-60']++;
        else distribution['61-90']++;
      }

      return {
        success: true,
        analytics: {
          period: lookback,
          totalRequests,
          totalAttributed,
          conversionRate,
          avgDaysToPurchase,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          avgOrderValue: totalAttributed > 0
            ? Math.round((totalRevenue / totalAttributed) * 100) / 100
            : 0,
          distribution,
        },
      };
    } catch (err) {
      console.error('[swatchAttribution] getSwatchAnalytics error:', err);
      return { success: false, analytics: null };
    }
  }
);

export const _ATTRIBUTION_WINDOW_DAYS = ATTRIBUTION_WINDOW_DAYS;
