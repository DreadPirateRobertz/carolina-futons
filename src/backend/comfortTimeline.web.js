/**
 * @module comfortTimeline
 * @description Mattress break-in tracker — Comfort Timeline.
 *
 * Futon mattresses need 2-4 weeks to break in. During this period, customers
 * often think their mattress is defective and initiate returns. This module
 * tracks the break-in journey with milestone notifications and comfort logging,
 * reducing comfort-related returns by setting expectations.
 *
 * Flow:
 *   1. Order delivered → comfortTimeline auto-created (via events.js)
 *   2. Day 1: Welcome email with break-in guide
 *   3. Day 7: Check-in email + comfort log prompt
 *   4. Day 14: Milestone — "You're halfway through break-in!"
 *   5. Day 30: Break-in complete — comfort survey + cross-sell trigger
 *   6. Day 60: Cross-sell: mattress topper or cover upgrade
 *
 * Comfort logging: customers rate comfort 1-5 at each milestone.
 * If comfort drops below 3 at Day 14+, trigger support outreach.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create CMS collection `ComfortTimelines`:
 *   orderId (Text, indexed), memberId (Text, indexed), productId (Text),
 *   productName (Text), deliveredAt (DateTime), status (Text: active|complete|cancelled),
 *   currentDay (Number), lastCheckIn (DateTime),
 *   comfortLogs (Text/JSON: [{day, rating, notes, loggedAt}]),
 *   milestonesCompleted (Text/JSON: [day numbers]),
 *   crossSellTriggered (Boolean), supportEscalated (Boolean)
 *
 * Create CMS collection `ComfortTimelineRateLimit`:
 *   key (Text), count (Number), windowStart (DateTime)
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';
import { logError } from 'backend/utils/errorHandler';

const COLLECTION = 'ComfortTimelines';
const MILESTONES = [1, 7, 14, 30, 60];
const COMFORT_CONCERN_THRESHOLD = 3; // Rating below this triggers support escalation
const CROSS_SELL_DAY = 60;
const BREAK_IN_COMPLETE_DAY = 30;

// ── Create Timeline (called from events.js on order delivered) ──────

/**
 * Create a comfort timeline for a delivered mattress order.
 * Called automatically when an order containing a mattress is delivered.
 * Idempotent — skips if timeline already exists for this orderId.
 *
 * @param {Object} params
 * @param {string} params.orderId - Wix order ID
 * @param {string} params.memberId - Customer member ID
 * @param {string} params.productId - Mattress product ID
 * @param {string} params.productName - Product display name
 * @returns {Promise<{success: boolean, timelineId?: string, error?: string}>}
 */
export async function createTimeline({ orderId, memberId, productId, productName }) {
  try {
    if (!orderId || !memberId || !productId) {
      return { success: false, error: 'orderId, memberId, and productId are required' };
    }

    const cleanOrderId = sanitize(orderId, 50);
    const cleanMemberId = sanitize(memberId, 50);
    const cleanProductId = sanitize(productId, 50);
    const cleanProductName = sanitize(productName ?? '', 200);

    // Idempotency check
    const existing = await wixData.query(COLLECTION)
      .eq('orderId', cleanOrderId)
      .limit(1)
      .find({ suppressAuth: true });

    if (existing.items.length > 0) {
      return { success: true, timelineId: existing.items[0]._id };
    }

    const timeline = await wixData.insert(COLLECTION, {
      orderId: cleanOrderId,
      memberId: cleanMemberId,
      productId: cleanProductId,
      productName: cleanProductName,
      deliveredAt: new Date(),
      status: 'active',
      currentDay: 0,
      lastCheckIn: null,
      comfortLogs: '[]',
      milestonesCompleted: '[]',
      crossSellTriggered: false,
      supportEscalated: false,
    }, { suppressAuth: true });

    logAuditEvent('ComfortTimelines', 'create', cleanMemberId, {
      orderId: cleanOrderId,
      productId: cleanProductId,
    });

    return { success: true, timelineId: timeline._id };
  } catch (err) {
    logError('comfortTimeline.createTimeline', err);
    return { success: false, error: 'Failed to create comfort timeline' };
  }
}

// ── Log Comfort Rating ──────────────────────────────────────────────

/**
 * Log a comfort rating for the current milestone.
 * Members rate their mattress comfort 1-5 at check-in prompts.
 *
 * @param {string} timelineId - ComfortTimelines record ID
 * @param {number} rating - Comfort rating 1-5
 * @param {string} [notes] - Optional notes
 * @returns {Promise<{success: boolean, milestone?: number, supportEscalated?: boolean, error?: string}>}
 * @permission SiteMember
 */
export const logComfortRating = webMethod(
  Permissions.SiteMember,
  async (timelineId, rating, notes = '') => {
    try {
      if (!validateId(timelineId)) {
        return { success: false, error: 'Valid timeline ID required' };
      }
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return { success: false, error: 'Rating must be between 1 and 5' };
      }

      const { allowed } = await checkRateLimit('ComfortTimelineRateLimit', timelineId, { max: 10 });
      if (!allowed) return { success: false, error: 'Too many requests. Please try again later.' };

      const timeline = await wixData.get(COLLECTION, timelineId);
      if (!timeline) return { success: false, error: 'Timeline not found' };
      if (timeline.status !== 'active') return { success: false, error: 'Timeline is no longer active' };

      const daysSinceDelivery = Math.floor(
        (Date.now() - new Date(timeline.deliveredAt).getTime()) / (24 * 60 * 60 * 1000)
      );

      const comfortLogs = safeParseArray(timeline.comfortLogs);
      comfortLogs.push({
        day: daysSinceDelivery,
        rating: Math.round(rating),
        notes: sanitize(notes, 500),
        loggedAt: new Date().toISOString(),
      });

      const updates = {
        ...timeline,
        comfortLogs: JSON.stringify(comfortLogs),
        lastCheckIn: new Date(),
        currentDay: daysSinceDelivery,
      };

      // Check for support escalation — low comfort at Day 14+
      let supportEscalated = timeline.supportEscalated;
      if (rating < COMFORT_CONCERN_THRESHOLD && daysSinceDelivery >= 14 && !supportEscalated) {
        updates.supportEscalated = true;
        supportEscalated = true;
      }

      // Check if break-in is complete
      if (daysSinceDelivery >= BREAK_IN_COMPLETE_DAY && timeline.status === 'active') {
        updates.status = 'complete';
      }

      await wixData.update(COLLECTION, updates, { suppressAuth: true });

      logAuditEvent('ComfortTimelines', 'log_rating', timeline.memberId, {
        rating,
        day: daysSinceDelivery,
        supportEscalated,
      });

      return {
        success: true,
        milestone: [...MILESTONES].reverse().find(m => m <= daysSinceDelivery) ?? 0,
        supportEscalated,
      };
    } catch (err) {
      logError('comfortTimeline.logComfortRating', err);
      return { success: false, error: 'Failed to log comfort rating' };
    }
  }
);

// ── Get Timeline ────────────────────────────────────────────────────

/**
 * Get a member's comfort timeline for a specific order.
 *
 * @param {string} orderId - The order ID
 * @returns {Promise<{success: boolean, timeline?: Object, error?: string}>}
 * @permission SiteMember
 */
export const getTimeline = webMethod(
  Permissions.SiteMember,
  async (orderId) => {
    try {
      if (!orderId) return { success: false, error: 'Order ID required' };

      const cleanOrderId = sanitize(orderId, 50);
      const result = await wixData.query(COLLECTION)
        .eq('orderId', cleanOrderId)
        .limit(1)
        .find({ suppressAuth: true });

      if (result.items.length === 0) {
        return { success: false, error: 'No comfort timeline found for this order' };
      }

      const timeline = result.items[0];
      const daysSinceDelivery = Math.floor(
        (Date.now() - new Date(timeline.deliveredAt).getTime()) / (24 * 60 * 60 * 1000)
      );

      const comfortLogs = safeParseArray(timeline.comfortLogs);
      const milestonesCompleted = safeParseArray(timeline.milestonesCompleted);
      const nextMilestone = MILESTONES.find(m => m > daysSinceDelivery) ?? null;
      const breakInProgress = Math.min(100, Math.round((daysSinceDelivery / BREAK_IN_COMPLETE_DAY) * 100));

      return {
        success: true,
        timeline: {
          id: timeline._id,
          orderId: timeline.orderId,
          productName: timeline.productName,
          deliveredAt: timeline.deliveredAt,
          status: timeline.status,
          currentDay: daysSinceDelivery,
          breakInProgress,
          comfortLogs,
          milestonesCompleted,
          nextMilestone,
          needsCheckIn: !timeline.lastCheckIn || daysSinceDelivery > (timeline.currentDay ?? 0) + 6,
          supportEscalated: timeline.supportEscalated,
          crossSellEligible: daysSinceDelivery >= CROSS_SELL_DAY && !timeline.crossSellTriggered,
        },
      };
    } catch (err) {
      logError('comfortTimeline.getTimeline', err);
      return { success: false, error: 'Failed to load comfort timeline' };
    }
  }
);

// ── Get All Timelines for Member ────────────────────────────────────

/**
 * Get all comfort timelines for the current member.
 * Used on the member dashboard to show break-in progress for all mattresses.
 *
 * @returns {Promise<{success: boolean, timelines?: Array, error?: string}>}
 * @permission SiteMember
 */
export const getMyTimelines = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const { currentMember } = await import('wix-members-backend');
      const member = await currentMember.getMember();
      if (!member) return { success: false, error: 'Not logged in' };

      const result = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .descending('deliveredAt')
        .find({ suppressAuth: true });

      const timelines = result.items.map(t => {
        const daysSinceDelivery = Math.floor(
          (Date.now() - new Date(t.deliveredAt).getTime()) / (24 * 60 * 60 * 1000)
        );
        return {
          id: t._id,
          orderId: t.orderId,
          productName: t.productName,
          status: t.status,
          currentDay: daysSinceDelivery,
          breakInProgress: Math.min(100, Math.round((daysSinceDelivery / BREAK_IN_COMPLETE_DAY) * 100)),
          lastRating: getLastRating(t.comfortLogs),
          needsCheckIn: !t.lastCheckIn || daysSinceDelivery > (t.currentDay ?? 0) + 6,
        };
      });

      return { success: true, timelines };
    } catch (err) {
      logError('comfortTimeline.getMyTimelines', err);
      return { success: false, error: 'Failed to load timelines' };
    }
  }
);

// ── Cron: Process Milestones ────────────────────────────────────────

/**
 * Process milestone notifications for all active timelines.
 * Called daily by cron — checks each active timeline for upcoming milestones
 * and triggers appropriate notifications.
 *
 * @param {string} cronSecret - Cron authentication secret
 * @returns {Promise<{success: boolean, processed: number, notifications: number, error?: string}>}
 * @permission Admin
 */
export const processMilestones = webMethod(
  Permissions.Admin,
  async (cronSecret) => {
    try {
      const { getSecret } = await import('wix-secrets-backend');
      const expectedSecret = await getSecret('CRON_SECRET');
      if (!cronSecret || cronSecret !== expectedSecret) {
        return { success: false, error: 'Authentication failed' };
      }

      // Paginate past Wix 50-item default limit
      let allTimelines = [];
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const page = await wixData.query(COLLECTION)
          .eq('status', 'active')
          .limit(1000)
          .skip(skip)
          .find({ suppressAuth: true });
        allTimelines = allTimelines.concat(page.items ?? []);
        skip += 1000;
        hasMore = (page.items ?? []).length === 1000;
      }

      let processed = 0;
      let notifications = 0;

      for (const timeline of allTimelines) {
        const daysSinceDelivery = Math.floor(
          (Date.now() - new Date(timeline.deliveredAt).getTime()) / (24 * 60 * 60 * 1000)
        );

        const milestonesCompleted = safeParseArray(timeline.milestonesCompleted);
        const newMilestones = MILESTONES.filter(m =>
          m <= daysSinceDelivery && !milestonesCompleted.includes(m)
        );

        if (newMilestones.length > 0) {
          milestonesCompleted.push(...newMilestones);

          const updates = {
            ...timeline,
            milestonesCompleted: JSON.stringify(milestonesCompleted),
            currentDay: daysSinceDelivery,
          };

          // Auto-complete at break-in day
          if (daysSinceDelivery >= BREAK_IN_COMPLETE_DAY) {
            updates.status = 'complete';
          }

          await wixData.update(COLLECTION, updates, { suppressAuth: true });
          notifications += newMilestones.length;
        }

        processed++;
      }

      logAuditEvent('ComfortTimelines', 'process_milestones', 'cron', { processed, notifications });
      return { success: true, processed, notifications };
    } catch (err) {
      logError('comfortTimeline.processMilestones', err);
      return { success: false, error: 'Milestone processing failed' };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function safeParseArray(jsonStr) {
  if (!jsonStr) return [];
  if (Array.isArray(jsonStr)) return jsonStr;
  try { return JSON.parse(jsonStr); } catch { return []; }
}

function getLastRating(comfortLogsJson) {
  const logs = safeParseArray(comfortLogsJson);
  if (logs.length === 0) return null;
  return logs[logs.length - 1].rating ?? null;
}

// ── Exports for testing ─────────────────────────────────────────────
export { MILESTONES as _MILESTONES };
export { COMFORT_CONCERN_THRESHOLD as _COMFORT_CONCERN_THRESHOLD };
