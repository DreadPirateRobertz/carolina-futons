/**
 * @module gamificationEventReceiver.web
 * @description Wix backend webMethod for receiving gamification events from the mobile app.
 * Awards points to members based on trackEvent calls and returns updated tier state.
 *
 * Supported events:
 *   gamification_add_to_cart      — +5 pts
 *   gamification_submit_review    — +50 pts (+25 bonus if has_photo)
 *   gamification_referral_shared  — +100 pts
 *   (unknown)                     — no-op, returns current total
 *
 * CF-eo88
 */

import { Permissions, webMethod } from 'wix-web-module';
import { POINT_VALUES, getTierForPoints } from 'public/gamificationTokens.js';
import { logError } from 'backend/utils/errorHandler';
import wixData from 'wix-data';

const MEMBER_POINTS_COLLECTION = 'MemberPoints';

// Point values not in POINT_VALUES (which covers review/AR/referral-accepted/etc.)
const ADD_TO_CART_POINTS = 5;
const REFERRAL_SHARED_POINTS = 100; // distinct from REFERRAL_ACCEPTED (200 pts for completed referrals)

/**
 * Receive a gamification event and award points to the member.
 *
 * @param {string} eventName  - e.g. 'gamification_add_to_cart'
 * @param {Object} payload    - Event-specific data (product_id, has_photo, etc.)
 * @param {string} memberId   - Wix member ID
 * @returns {Promise<{success: boolean, newTotal?: number, tierChanged?: boolean, newTier?: string, error?: string}>}
 */
export const receiveGamificationEvent = webMethod(
  Permissions.Member,
  async (eventName, payload, memberId) => {
    if (!memberId) {
      return { success: false, error: 'memberId is required' };
    }

    const delta = resolvePoints(eventName, payload);

    // Unknown event: return current total without writing
    if (delta === null) {
      try {
        const record = await findMemberRecord(memberId);
        const totalPoints = record ? record.totalPoints : 0;
        return {
          success: true,
          newTotal: totalPoints,
          tierChanged: false,
          newTier: getTierForPoints(totalPoints),
        };
      } catch (err) {
        logError('gamificationEventReceiver.receiveGamificationEvent', err);
        return { success: false, error: 'Failed to retrieve points' };
      }
    }

    try {
      const record = await findMemberRecord(memberId);
      const oldTotal = record ? record.totalPoints : 0;
      const oldTier = record ? record.tier : getTierForPoints(0);
      const newTotal = oldTotal + delta;
      const newTier = getTierForPoints(newTotal);
      const tierChanged = newTier !== oldTier;

      if (record) {
        await wixData.update(MEMBER_POINTS_COLLECTION, {
          ...record,
          totalPoints: newTotal,
          tier: newTier,
        });
      } else {
        await wixData.insert(MEMBER_POINTS_COLLECTION, {
          memberId,
          totalPoints: newTotal,
          tier: newTier,
        });
      }

      return { success: true, newTotal, tierChanged, newTier };
    } catch (err) {
      logError('gamificationEventReceiver.receiveGamificationEvent', err);
      return { success: false, error: 'Failed to award points' };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the point delta for a given event, or null for unknown events.
 * @param {string} eventName
 * @param {Object} payload
 * @returns {number|null}
 */
function resolvePoints(eventName, payload) {
  switch (eventName) {
    case 'gamification_add_to_cart':
      return ADD_TO_CART_POINTS;
    case 'gamification_submit_review':
      return POINT_VALUES.REVIEW + (payload?.has_photo ? POINT_VALUES.PHOTO_REVIEW_BONUS : 0);
    case 'gamification_referral_shared':
      return REFERRAL_SHARED_POINTS;
    default:
      return null;
  }
}

/**
 * Look up a member's current MemberPoints record.
 * Returns null if the member has no record yet.
 * @param {string} memberId
 * @returns {Promise<Object|null>}
 */
async function findMemberRecord(memberId) {
  const results = await wixData.query(MEMBER_POINTS_COLLECTION)
    .eq('memberId', memberId)
    .limit(1)
    .find({ suppressAuth: true });
  return results.items.length > 0 ? results.items[0] : null;
}
