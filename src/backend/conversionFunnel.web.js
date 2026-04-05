/**
 * @module conversionFunnel
 * @description Conversion funnel analytics backend — tracks the 5-stage
 * purchase pipeline (page_view → product_view → add_to_cart →
 * checkout_start → purchase) in the FunnelEvents CMS collection.
 *
 * Dedup strategy: _id = `${sessionId}_${stage}` — Wix unique-index
 * constraint silently prevents double-counting within a session.
 *
 * CF-wave32 (Wave 32 — blaidd)
 *
 * @setup
 * Create `FunnelEvents` CMS collection with fields:
 *   memberId     (Text)     — Wix member ID, null for anonymous
 *   sessionId    (Text)     — client-generated session token
 *   stage        (Text)     — FUNNEL_STAGES entry
 *   productId    (Text)     — product slug/ID, optional
 *   revenue      (Number)   — populated for purchase stage
 *   experimentId (Text)     — A/B test name, optional
 *   variantId    (Text)     — A/B variant ID, optional
 *   timestamp    (DateTime) — event time
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

const FUNNEL_COLLECTION = 'FunnelEvents';

/** Ordered funnel stages — each must be traversed in sequence. */
export const FUNNEL_STAGES = [
  'page_view',
  'product_view',
  'add_to_cart',
  'checkout_start',
  'purchase',
];

const STAGE_SET = new Set(FUNNEL_STAGES);

// ── trackFunnelEvent ───────────────────────────────────────────────

/**
 * Record a funnel stage transition for a session.
 * Safe to call from any page — anonymous (no auth required).
 *
 * @param {string} stage - One of FUNNEL_STAGES
 * @param {Object} payload
 * @param {string}  payload.sessionId    - Client session token (required)
 * @param {string}  [payload.memberId]   - Wix member ID
 * @param {string}  [payload.productId]  - Product slug or ID
 * @param {number}  [payload.revenue]    - Order total (purchase stage)
 * @param {string}  [payload.experimentId] - A/B test name
 * @param {string}  [payload.variantId]    - A/B variant ID
 * @returns {Promise<{success: boolean, duplicate?: boolean, error?: string}>}
 * @permission Anyone
 */
export const trackFunnelEvent = webMethod(
  Permissions.Anyone,
  async (stage, payload = {}) => {
    try {
      if (!STAGE_SET.has(stage)) {
        return { success: false, error: `Invalid funnel stage: "${stage}". Must be one of: ${FUNNEL_STAGES.join(', ')}` };
      }

      const rawSession = payload.sessionId;
      if (!rawSession) return { success: false, error: 'sessionId is required' };

      const sessionId = sanitize(String(rawSession), 254);
      if (!sessionId) return { success: false, error: 'sessionId is required' };

      const record = {
        _id: `${sessionId}_${stage}`,
        sessionId,
        stage,
        timestamp: new Date(),
        memberId:     payload.memberId     ? sanitize(String(payload.memberId), 254) : null,
        productId:    payload.productId    ? sanitize(String(payload.productId), 254) : null,
        experimentId: payload.experimentId ? sanitize(String(payload.experimentId), 100) : null,
        variantId:    payload.variantId    ? sanitize(String(payload.variantId), 100) : null,
        revenue:      (stage === 'purchase' && typeof payload.revenue === 'number') ? payload.revenue : null,
      };

      await wixData.insert(FUNNEL_COLLECTION, record, { suppressAuth: true });
      return { success: true };
    } catch (err) {
      // Unique-index violation == duplicate session+stage — treat as success
      const isDuplicate = err?.message?.toLowerCase().includes('duplicate')
        || err?.code === 'WD_UNIQUE_FIELD_VIOLATION'
        || err?.code === 'WD_DUPLICATE_ITEM_EXISTS';

      if (isDuplicate) return { success: true, duplicate: true };

      logError('conversionFunnel.trackFunnelEvent', err);
      return { success: false, error: 'Failed to record funnel event' };
    }
  }
);

// ── getFunnelReport ────────────────────────────────────────────────

/**
 * Aggregate funnel stage counts and drop-off rates for an admin report.
 *
 * @param {Object} [options]
 * @param {number} [options.days=7]       - Lookback window (clamped 1–90)
 * @param {string} [options.productId]    - Optional product filter
 * @returns {Promise<{success: boolean, report?: Object}>}
 * @permission Admin
 */
export const getFunnelReport = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const days = Math.min(90, Math.max(1, options.days != null ? options.days : 7));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      let query = wixData.query(FUNNEL_COLLECTION).ge('timestamp', since).limit(1000);
      if (options.productId) {
        query = query.eq('productId', sanitize(String(options.productId), 254));
      }

      const result = await query.find({ suppressAuth: true });
      const events = result.items;

      // Count per stage
      const stageCounts = {};
      for (const s of FUNNEL_STAGES) stageCounts[s] = 0;
      for (const ev of events) {
        if (STAGE_SET.has(ev.stage)) stageCounts[ev.stage]++;
      }

      // Build stage report with drop-off rates
      const stages = {};
      for (let i = 0; i < FUNNEL_STAGES.length; i++) {
        const s = FUNNEL_STAGES[i];
        const count = stageCounts[s];
        const prevCount = i === 0 ? count : stageCounts[FUNNEL_STAGES[i - 1]];
        const dropOffRate = (i === 0 || prevCount === 0)
          ? 0
          : Math.round((1 - count / prevCount) * 10000) / 100;

        stages[s] = { count, dropOffRate };
      }

      const topCount = stageCounts.page_view;
      const bottomCount = stageCounts.purchase;
      const overallConversionRate = topCount === 0
        ? 0
        : Math.round((bottomCount / topCount) * 10000) / 100;

      return {
        success: true,
        report: {
          period: { days, since: since.toISOString() },
          stages,
          overallConversionRate,
          totalEvents: events.length,
        },
      };
    } catch (err) {
      logError('conversionFunnel.getFunnelReport', err);
      return { success: false, error: 'Failed to generate funnel report' };
    }
  }
);
