/**
 * @module mobileChallengeService.web
 * @description App-native challenge variants for the Carolina Futons mobile app.
 * Handles AR product discovery, quiz completion, and social share challenges.
 * Idempotent: same challenge+product combo is not double-awarded within the same day.
 *
 * CMS collection: MobileChallengeCompletions
 *   _id, memberId, challengeType, completedAt, pointsAwarded, productId, score, platform
 *
 * Exports:
 *   - MOBILE_CHALLENGE_TYPES — AR_DISCOVERY | QUIZ_COMPLETION | SOCIAL_SHARE
 *   - MOBILE_CHALLENGES_COLLECTION — CMS collection name
 *   - completeMobileChallenge(memberId, challengeType, params) — record + award
 *   - getMobileChallengeProgress(memberId) — counts by type
 */

import wixData from 'wix-data';

export const MOBILE_CHALLENGE_TYPES = {
  AR_DISCOVERY: 'ar_discovery',
  QUIZ_COMPLETION: 'quiz_completion',
  SOCIAL_SHARE: 'social_share',
};

export const MOBILE_CHALLENGES_COLLECTION = 'MobileChallengeCompletions';

const POINTS_BY_TYPE = {
  [MOBILE_CHALLENGE_TYPES.AR_DISCOVERY]: 75,
  [MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION]: 50,
  [MOBILE_CHALLENGE_TYPES.SOCIAL_SHARE]: 100,
};

// cf-m3tj: synthetic event names dispatched into receiveGamificationEvent so
// the canonical web pipeline (PointsLedger + MemberPoints + tier milestone +
// bonus-spin) processes mobile challenge awards. Mirrors point values above;
// gamificationCore.web.js MOBILE_CHALLENGE_POINTS table must stay in sync.
const SYNTHETIC_EVENT_BY_TYPE = {
  [MOBILE_CHALLENGE_TYPES.AR_DISCOVERY]: 'gamification_mobile_ar_discovery',
  [MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION]: 'gamification_mobile_quiz_completion',
  [MOBILE_CHALLENGE_TYPES.SOCIAL_SHARE]: 'gamification_mobile_social_share',
};

const VALID_TYPES = new Set(Object.values(MOBILE_CHALLENGE_TYPES));

function _todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Record a mobile challenge completion and award points.
 * Idempotent per challengeType+productId (for AR) within the calendar day.
 *
 * @param {string} memberId
 * @param {string} challengeType - One of MOBILE_CHALLENGE_TYPES values
 * @param {object} params        - { productId?, score?, total?, platform? }
 * @returns {Promise<{ success: boolean, alreadyAwarded?: boolean, pointsAwarded?: number, error?: string }>}
 */
// idor-ok: called from crossRigEventReceiver webMethod which resolves memberId from authenticated session (hq-u35ub)
export async function completeMobileChallenge(memberId, challengeType, params = {}) {
  if (!memberId) return { success: false, error: 'memberId is required' };
  if (!VALID_TYPES.has(challengeType)) {
    return { success: false, error: `unknown challenge type: ${challengeType}` };
  }

  try {
    // Idempotency check: same type + productId completed today
    let query = wixData
      .query(MOBILE_CHALLENGES_COLLECTION)
      .eq('memberId', memberId)
      .eq('challengeType', challengeType)
      .ge('completedAt', _todayStart());
    if (params.productId) query = query.eq('productId', params.productId);

    const existing = await query.find({ suppressAuth: true });
    if (existing.items.length > 0) {
      return { success: true, alreadyAwarded: true, pointsAwarded: 0 };
    }

    const pointsAwarded = POINTS_BY_TYPE[challengeType];
    const insertedRow = await wixData.insert(
      MOBILE_CHALLENGES_COLLECTION,
      {
        memberId,
        challengeType,
        completedAt: new Date(),
        pointsAwarded,
        productId: params.productId || null,
        score: params.score ?? null,
        platform: params.platform || null,
      },
      { suppressAuth: true }
    );

    // cf-m3tj fix: dispatch synthetic event into receiveGamificationEvent so
    // the canonical pipeline (PointsLedger insert, MemberPoints update, tier
    // milestone notification, BonusSpinGrants check) actually moves the
    // member's balance. Pre-cf-m3tj this step was missing — the completion
    // row was written but the member earned 0 points. Idempotency is already
    // enforced above (alreadyAwarded short-circuit), so the synthetic only
    // fires on a fresh completion. Non-blocking: if the synthetic fails the
    // completion row stays — backfill via cf-m3tj-followup script.
    const syntheticEventName = SYNTHETIC_EVENT_BY_TYPE[challengeType];
    if (syntheticEventName) {
      try {
        const { receiveGamificationEvent } = await import('backend/gamificationCore.web');
        await receiveGamificationEvent(
          syntheticEventName,
          {
            completionId: insertedRow._id,
            productId: params.productId || null,
            score: params.score ?? null,
            total: params.total ?? null,
            platform: params.platform || null,
          },
          memberId,
        );
      } catch (err) {
        console.error(
          `[mobileChallengeService] synthetic ${syntheticEventName} dispatch failed for member ${memberId}, completion ${insertedRow._id}:`,
          err,
        );
        // Non-blocking — see comment above. Logged with completionId so a
        // backfill job can find orphaned completions.
      }
    }

    return { success: true, alreadyAwarded: false, pointsAwarded };
  } catch (err) {
    console.error('[mobileChallengeService] completeMobileChallenge error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Return completion counts by challenge type for a member.
 *
 * @param {string} memberId
 * @returns {Promise<{ success: boolean, counts: object, error?: string }>}
 */
// idor-ok: internal helper — caller (webMethod) validates session before passing memberId; read-only aggregate, no mutation
export async function getMobileChallengeProgress(memberId) {
  try {
    const result = await wixData
      .query(MOBILE_CHALLENGES_COLLECTION)
      .eq('memberId', memberId)
      .find({ suppressAuth: true });

    const counts = Object.fromEntries(
      Object.values(MOBILE_CHALLENGE_TYPES).map(t => [t, 0])
    );
    for (const item of result.items) {
      if (counts[item.challengeType] !== undefined) counts[item.challengeType]++;
    }

    return { success: true, counts };
  } catch (err) {
    console.error('[mobileChallengeService] getMobileChallengeProgress error:', err);
    return { success: false, counts: {}, error: err.message };
  }
}
