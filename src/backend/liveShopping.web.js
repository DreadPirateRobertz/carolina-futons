/**
 * @module liveShopping
 * @description Weekly live shopping stream management for showroom broadcasts.
 *
 * Manages stream lifecycle (schedule → live → ended → VOD), product pins
 * (timestamped product highlights during stream), viewer engagement tracking,
 * and VOD replay with shoppable product links at timestamps.
 *
 * Distinct from liveShowroom.web.js (static camera feeds) — this module
 * handles scheduled live shopping events with a host, product demos, and
 * interactive shoppable overlays.
 *
 * CMS Collections:
 *   LiveShoppingStreams — stream schedule and metadata
 *   StreamProductPins — timestamped product appearances in streams
 *   StreamEngagement — viewer actions (join, pin_click, add_to_cart)
 *
 * CF-e1zx
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';
import { checkRateLimit } from 'backend/utils/rateLimit';

const STREAMS_COLLECTION = 'LiveShoppingStreams';
const PINS_COLLECTION = 'StreamProductPins';
const ENGAGEMENT_COLLECTION = 'StreamEngagement';
const MAX_PINS_PER_STREAM = 20;

// ── Stream Management ───────────────────────────────────────────────

/**
 * Schedule a new live shopping stream.
 *
 * @param {Object} params
 * @param {string} params.title - Stream title
 * @param {string} params.description - Stream description
 * @param {Date} params.scheduledAt - Scheduled start time
 * @param {number} [params.durationMinutes=15] - Expected duration
 * @param {string} [params.streamUrl] - External stream URL (YouTube/Instagram)
 * @param {string} [params.vodUrl] - VOD replay URL (set after stream ends)
 * @returns {Promise<{success: boolean, streamId: string|null}>}
 * @permission Admin
 */
export const scheduleStream = webMethod(
  Permissions.Admin,
  async (params = {}) => {
    try {
      const title = sanitize(params.title || '', 200);
      const description = sanitize(params.description || '', 1000);
      const streamUrl = sanitize(params.streamUrl || '', 500);
      const duration = Math.min(Math.max(5, params.durationMinutes || 15), 120);

      if (!title) return { success: false, streamId: null, error: 'Title is required' };
      if (!params.scheduledAt) return { success: false, streamId: null, error: 'Scheduled time is required' };

      const scheduledAt = new Date(params.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        return { success: false, streamId: null, error: 'Invalid scheduled time' };
      }

      const stream = await wixData.insert(STREAMS_COLLECTION, {
        title,
        description,
        scheduledAt,
        durationMinutes: duration,
        streamUrl,
        vodUrl: '',
        status: 'scheduled',
        viewerCount: 0,
        peakViewers: 0,
        createdAt: new Date(),
      });

      logAuditEvent(STREAMS_COLLECTION, 'schedule', 'admin', { streamId: stream._id, title });

      return { success: true, streamId: stream._id };
    } catch (err) {
      console.error('[liveShopping] scheduleStream error:', err);
      return { success: false, streamId: null, error: 'Failed to schedule stream' };
    }
  }
);

/**
 * Update stream status (scheduled → live → ended).
 *
 * @param {string} streamId
 * @param {string} status - 'live' | 'ended'
 * @param {Object} [extra] - Additional fields (e.g., vodUrl on ended)
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 */
export const updateStreamStatus = webMethod(
  Permissions.Admin,
  async (streamId, status, extra = {}) => {
    try {
      const cleanId = sanitize(streamId, 50);
      if (!['live', 'ended'].includes(status)) {
        return { success: false, error: 'Invalid status' };
      }

      const stream = await wixData.get(STREAMS_COLLECTION, cleanId);
      if (!stream) return { success: false, error: 'Stream not found' };

      stream.status = status;
      if (status === 'live') stream.startedAt = new Date();
      if (status === 'ended') {
        stream.endedAt = new Date();
        if (extra.vodUrl) stream.vodUrl = sanitize(extra.vodUrl, 500);
      }

      await wixData.update(STREAMS_COLLECTION, stream);
      logAuditEvent(STREAMS_COLLECTION, `status_${status}`, 'admin', { streamId: cleanId });

      return { success: true };
    } catch (err) {
      console.error('[liveShopping] updateStreamStatus error:', err);
      return { success: false, error: 'Failed to update stream' };
    }
  }
);

/**
 * Get upcoming and recent streams for the live shopping page.
 *
 * @returns {Promise<{success: boolean, live: Object|null, upcoming: Array, recent: Array}>}
 * @permission Anyone
 */
export const getStreams = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const now = new Date();

      const liveResult = await wixData.query(STREAMS_COLLECTION)
        .eq('status', 'live')
        .limit(1)
        .find();

      const upcoming = await wixData.query(STREAMS_COLLECTION)
        .eq('status', 'scheduled')
        .ge('scheduledAt', now)
        .ascending('scheduledAt')
        .limit(5)
        .find();

      const recent = await wixData.query(STREAMS_COLLECTION)
        .eq('status', 'ended')
        .descending('endedAt')
        .limit(10)
        .find();

      return {
        success: true,
        live: liveResult.items.length > 0 ? formatStream(liveResult.items[0]) : null,
        upcoming: upcoming.items.map(formatStream),
        recent: recent.items.map(formatStream),
      };
    } catch (err) {
      console.error('[liveShopping] getStreams error:', err);
      return { success: false, live: null, upcoming: [], recent: [] };
    }
  }
);

// ── Product Pins (Shoppable Overlay) ────────────────────────────────

/**
 * Pin a product during a live stream at a timestamp.
 *
 * @param {Object} params
 * @param {string} params.streamId
 * @param {string} params.productId
 * @param {string} params.productName
 * @param {number} params.price
 * @param {string} [params.productImage]
 * @param {string} [params.productSlug]
 * @param {number} [params.timestampSeconds] - Seconds from stream start
 * @returns {Promise<{success: boolean, pinId: string|null}>}
 * @permission Admin
 */
export const pinProduct = webMethod(
  Permissions.Admin,
  async (params = {}) => {
    try {
      const streamId = sanitize(params.streamId, 50);
      const productId = sanitize(params.productId, 50);
      const productName = sanitize(params.productName, 200);
      const productImage = sanitize(params.productImage || '', 500);
      const productSlug = sanitize(params.productSlug || '', 200);
      const price = typeof params.price === 'number' ? params.price : 0;

      if (!streamId || !productId || !productName) {
        return { success: false, pinId: null, error: 'Missing required fields' };
      }

      const existingCount = await wixData.query(PINS_COLLECTION)
        .eq('streamId', streamId)
        .count();

      if (existingCount >= MAX_PINS_PER_STREAM) {
        return { success: false, pinId: null, error: `Maximum ${MAX_PINS_PER_STREAM} pins per stream` };
      }

      const pin = await wixData.insert(PINS_COLLECTION, {
        streamId,
        productId,
        productName,
        productImage,
        productSlug,
        price,
        timestampSeconds: params.timestampSeconds || 0,
        pinnedAt: new Date(),
        clicks: 0,
        addToCarts: 0,
      });

      return { success: true, pinId: pin._id };
    } catch (err) {
      console.error('[liveShopping] pinProduct error:', err);
      return { success: false, pinId: null, error: 'Failed to pin product' };
    }
  }
);

/**
 * Get all product pins for a stream (live overlay or VOD replay).
 * Sorted by timestamp for VOD timeline.
 *
 * @param {string} streamId
 * @returns {Promise<{success: boolean, pins: Array}>}
 * @permission Anyone
 */
export const getStreamPins = webMethod(
  Permissions.Anyone,
  async (streamId) => {
    try {
      const cleanId = sanitize(streamId, 50);
      if (!cleanId) return { success: false, pins: [] };

      const result = await wixData.query(PINS_COLLECTION)
        .eq('streamId', cleanId)
        .ascending('timestampSeconds')
        .limit(MAX_PINS_PER_STREAM)
        .find();

      return {
        success: true,
        pins: result.items.map(pin => ({
          pinId: pin._id,
          productId: pin.productId,
          productName: pin.productName,
          productImage: pin.productImage,
          productSlug: pin.productSlug,
          price: pin.price,
          timestampSeconds: pin.timestampSeconds,
          clicks: pin.clicks,
          addToCarts: pin.addToCarts,
        })),
      };
    } catch (err) {
      console.error('[liveShopping] getStreamPins error:', err);
      return { success: false, pins: [] };
    }
  }
);


/**
 * Get stream analytics summary.
 *
 * @param {string} streamId
 * @returns {Promise<{success: boolean, analytics: Object|null}>}
 * @permission Admin
 */
export const getStreamAnalytics = webMethod(
  Permissions.Admin,
  async (streamId) => {
    try {
      const cleanId = sanitize(streamId, 50);
      if (!cleanId) return { success: false, analytics: null };

      const stream = await wixData.get(STREAMS_COLLECTION, cleanId);
      if (!stream) return { success: false, analytics: null };

      const engagements = await wixData.query(ENGAGEMENT_COLLECTION)
        .eq('streamId', cleanId)
        .limit(1000)
        .find();

      const actionCounts = {};
      for (const e of engagements.items) {
        actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
      }

      const pins = await wixData.query(PINS_COLLECTION)
        .eq('streamId', cleanId)
        .find();

      const totalClicks = pins.items.reduce((sum, p) => sum + (p.clicks || 0), 0);
      const totalCarts = pins.items.reduce((sum, p) => sum + (p.addToCarts || 0), 0);

      return {
        success: true,
        analytics: {
          streamId: cleanId,
          title: stream.title,
          status: stream.status,
          viewers: actionCounts.join || 0,
          pinClicks: totalClicks,
          addToCarts: totalCarts,
          vodPlays: actionCounts.vod_play || 0,
          conversionRate: totalClicks > 0 ? Math.round((totalCarts / totalClicks) * 100) : 0,
          totalPins: pins.items.length,
          topProducts: pins.items
            .sort((a, b) => (b.addToCarts || 0) - (a.addToCarts || 0))
            .slice(0, 5)
            .map(p => ({ name: p.productName, clicks: p.clicks, addToCarts: p.addToCarts })),
        },
      };
    } catch (err) {
      console.error('[liveShopping] getStreamAnalytics error:', err);
      return { success: false, analytics: null };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function formatStream(stream) {
  return {
    streamId: stream._id,
    title: stream.title,
    description: stream.description,
    scheduledAt: stream.scheduledAt,
    startedAt: stream.startedAt || null,
    endedAt: stream.endedAt || null,
    durationMinutes: stream.durationMinutes,
    streamUrl: stream.streamUrl,
    vodUrl: stream.vodUrl || '',
    status: stream.status,
  };
}
