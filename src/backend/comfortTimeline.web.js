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

import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
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
// idor-ok: internal backend helper — called from wixEcom_onOrderCreated event handler only
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
