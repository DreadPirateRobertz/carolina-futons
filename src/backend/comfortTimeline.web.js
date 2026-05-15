/**
 * @module comfortTimeline
 * @description Mattress break-in tracker — comfort-timeline creation.
 *
 * The full break-in journey (milestone notifications, comfort logging,
 * cross-sell triggers) was retired in cf-4x7e.B5 — only `createTimeline`
 * remains as a CMS-seed helper exercised by the purchase-flow smoke test.
 * Re-instate the flow methods alongside the events.js wiring when the
 * post-purchase email sequence lands.
 *
 * @setup
 * Create CMS collection `ComfortTimelines`:
 *   orderId (Text, indexed), memberId (Text, indexed), productId (Text),
 *   productName (Text), deliveredAt (DateTime), status (Text: active|complete|cancelled),
 *   currentDay (Number), lastCheckIn (DateTime),
 *   comfortLogs (Text/JSON: [{day, rating, notes, loggedAt}]),
 *   milestonesCompleted (Text/JSON: [day numbers]),
 *   crossSellTriggered (Boolean), supportEscalated (Boolean)
 */

import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';
import { logError } from 'backend/utils/errorHandler';

const COLLECTION = 'ComfortTimelines';

/**
 * Create a comfort timeline for a delivered mattress order.
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
