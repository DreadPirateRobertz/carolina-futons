/**
 * @module crossRigSyncUtils
 * @description Internal backend utilities for cross-rig gamification sync.
 *
 * Not a .web.js module — these functions are backend-only helpers called by
 * crossRigEventReceiver. They are NOT exposed as public web endpoints.
 *
 * CF-z51
 */
import wixData from 'wix-data';
import { sendPushToMember, skipIfOptedOut, PUSH_EVENTS } from 'backend/pushNotificationService.web';

export const SYNC_LOG_COLLECTION = 'CrossRigSyncLog';
const ALLOWED_SOURCE_RIGS = ['cfutons_mobile'];

/**
 * Log a mobile-side points award into the cross-rig sync log.
 * Called by crossRigEventReceiver on quiz_completed, ar_discovery_completed,
 * social_share_completed events.
 *
 * @param {string} memberId
 * @param {number} points    - Must be >= 0
 * @param {string} eventType - e.g. 'quiz_completed'
 * @param {string} sourceRig - Must be 'cfutons_mobile'
 * @returns {Promise<{ success: boolean, points?: number, error?: string }>}
 */
export async function syncMobilePoints(memberId, points, eventType, sourceRig) {
  if (!memberId) {
    return { success: false, error: 'memberId is required' };
  }
  if (!ALLOWED_SOURCE_RIGS.includes(sourceRig)) {
    return { success: false, error: `unknown source rig: ${sourceRig}` };
  }
  if (typeof points !== 'number' || points < 0) {
    return { success: false, error: 'points must be a non-negative number' };
  }
  try {
    await wixData.insert(
      SYNC_LOG_COLLECTION,
      {
        memberId,
        points,
        eventType,
        sourceRig,
        syncedAt: new Date(),
        direction: 'mobile_to_web',
      },
      { suppressAuth: true }
    );
    return { success: true, points };
  } catch (err) {
    console.error('[crossRigSyncUtils] syncMobilePoints error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send a push notification to all member devices when a badge is earned.
 *
 * @param {string} memberId
 * @param {string} badgeId
 * @returns {Promise<{ success: boolean, pushSent?: number, error?: string }>}
 */
export async function syncBadgeEarnedToPush(memberId, badgeId) {
  try {
    if (await skipIfOptedOut(memberId, PUSH_EVENTS.BADGE_EARNED)) {
      return { success: true, pushSent: 0, skipped: true };
    }
    const { sent } = await sendPushToMember(memberId, PUSH_EVENTS.BADGE_EARNED, { badgeId });
    return { success: true, pushSent: sent };
  } catch (err) {
    console.error('[crossRigSyncUtils] syncBadgeEarnedToPush error:', err);
    return { success: false, error: err.message };
  }
}
