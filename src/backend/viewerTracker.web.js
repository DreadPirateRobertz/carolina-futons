/**
 * @module viewerTracker.web
 * @description Lightweight real-time viewer counter for PDP social proof.
 * Uses a 5-minute rolling window — views older than 5 minutes don't count.
 * Display capped at 1-99 for realism.
 *
 * @setup
 * Create CMS collection `ProductViewerCounts`:
 *   productId (Text, indexed), count (Number), windowStart (DateTime),
 *   updatedAt (DateTime)
 *
 * CF-n4ne
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logError } from 'backend/utils/errorHandler';

const COLLECTION = 'ProductViewerCounts';
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MIN_DISPLAY = 1;
const MAX_DISPLAY = 99;

// ── Increment Viewer Count ───────────────────────────────────────────

/**
 * Record a product view. Increments the viewer counter within the current
 * 5-minute window. If the window has expired, resets to 1.
 *
 * Rate limited: 60 views per minute per product (prevents bot inflation).
 *
 * @param {string} productId
 * @returns {Promise<{ok: boolean}>}
 */
export const trackView = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = sanitize(productId, 50);
      if (!cleanId) return { ok: false };

      const { allowed } = await checkRateLimit('ViewerTrackerRateLimit', cleanId, {
        max: 60, windowMs: 60_000,
      });
      if (!allowed) return { ok: true }; // Silent drop — don't reveal rate limiting

      const now = Date.now();
      const existing = await wixData.query(COLLECTION)
        .eq('productId', cleanId)
        .limit(1)
        .find({ suppressAuth: true });

      if (existing.items.length === 0) {
        await wixData.insert(COLLECTION, {
          productId: cleanId,
          count: 1,
          windowStart: new Date(now),
          updatedAt: new Date(now),
        }, { suppressAuth: true });
      } else {
        const record = existing.items[0];
        const windowAge = now - new Date(record.windowStart).getTime();

        if (windowAge > WINDOW_MS) {
          // Window expired — reset
          await wixData.update(COLLECTION, {
            ...record,
            count: 1,
            windowStart: new Date(now),
            updatedAt: new Date(now),
          }, { suppressAuth: true });
        } else {
          // Within window — increment
          await wixData.update(COLLECTION, {
            ...record,
            count: record.count + 1,
            updatedAt: new Date(now),
          }, { suppressAuth: true });
        }
      }

      return { ok: true };
    } catch (err) {
      logError('viewerTracker.trackView', err);
      return { ok: false };
    }
  }
);

// ── Get Viewer Count ─────────────────────────────────────────────────

/**
 * Get the current viewer count for a product. Returns 0 if the window
 * has expired (no active viewers in last 5 minutes).
 *
 * @param {string} productId
 * @returns {Promise<{count: number, display: string}>}
 */
export const getViewerCount = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = sanitize(productId, 50);
      if (!cleanId) return { count: 0, display: '' };

      const existing = await wixData.query(COLLECTION)
        .eq('productId', cleanId)
        .limit(1)
        .find({ suppressAuth: true });

      if (existing.items.length === 0) return { count: 0, display: '' };

      const record = existing.items[0];
      const now = Date.now();
      const windowAge = now - new Date(record.windowStart).getTime();

      // Window expired — no active viewers
      if (windowAge > WINDOW_MS) return { count: 0, display: '' };

      const count = record.count;
      const capped = Math.min(MAX_DISPLAY, Math.max(MIN_DISPLAY, count));
      const display = `${capped} ${capped === 1 ? 'person' : 'people'} viewing now`;

      return { count, display };
    } catch (err) {
      logError('viewerTracker.getViewerCount', err);
      return { count: 0, display: '' };
    }
  }
);

// ── Social Proof Signals (Mobile API) ────────────────────────────────

/**
 * Get aggregated social proof signals for a product.
 * Single endpoint for mobile consumption — combines viewer count
 * with any other social proof data.
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, signals: Object}>}
 */
export const getSocialProofSignals = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = sanitize(productId, 50);
      if (!cleanId) return { success: false, signals: {} };

      const viewerResult = await getViewerCount(cleanId);

      return {
        success: true,
        signals: {
          viewerCount: viewerResult.count,
          viewerDisplay: viewerResult.display,
          hasActiveViewers: viewerResult.count > 0,
        },
      };
    } catch (err) {
      logError('viewerTracker.getSocialProofSignals', err);
      return { success: false, signals: {} };
    }
  }
);

// ── Exports for Testing ──────────────────────────────────────────────

export const _COLLECTION = COLLECTION;
export const _WINDOW_MS = WINDOW_MS;
export const _MIN_DISPLAY = MIN_DISPLAY;
export const _MAX_DISPLAY = MAX_DISPLAY;
