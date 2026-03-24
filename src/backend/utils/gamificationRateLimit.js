/**
 * @module gamificationRateLimit
 * @description Centralized rate limiting for all gamification action types.
 *
 * Two layers of protection:
 *  1. Per (userId, actionType) bucket — limits bursts within each action type.
 *  2. Per-user daily cap across ALL action types — closes the "spam 12 different
 *     action types to accumulate uncapped points" attack vector.
 *
 * CF-hard-ratelimit / cf-20v
 */

import { checkRateLimit } from 'backend/utils/rateLimit';

// ── Action-type limits ────────────────────────────────────────────────────────

/** @type {Record<string, {max: number, windowMs: number}>} */
export const GAMIFICATION_ACTION_LIMITS = {
  gamification_order_complete: { max: 50,  windowMs: 24 * 3600_000 }, // 50/day
  gamification_add_to_cart:    { max: 10,  windowMs:  1 * 3600_000 }, // 10/hr
  gamification_submit_review:  { max:  3,  windowMs:  1 * 3600_000 }, // 3/hr
  spinWheel:                   { max: 20,  windowMs:  1 * 3600_000 }, // 20/hr
  challenge_progress:          { max: 100, windowMs:  1 * 3600_000 }, // 100/hr
};

/**
 * Global per-user daily event cap (all action types combined).
 * Prevents accumulating uncapped points by spreading across many action types.
 */
export const GAMIFICATION_DAILY_CAP = { max: 500, windowMs: 24 * 3600_000 };

// ── Collections ───────────────────────────────────────────────────────────────

const ACTION_COLLECTION  = 'GamificationActionRateLimit';
const DAILY_CAP_COLLECTION = 'GamificationDailyCap';

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Check rate limits for a gamification action.
 * Applies both per-action-type and global per-user daily cap.
 *
 * @param {string} userId - Authenticated member _id.
 * @param {string} actionType - Action key (must be in GAMIFICATION_ACTION_LIMITS or uses fallback).
 * @param {object} [opts]
 * @param {number} [opts.now] - Timestamp override for deterministic tests.
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function checkGamificationRateLimit(userId, actionType, opts = {}) {
  const actionLimit = GAMIFICATION_ACTION_LIMITS[actionType];
  const actionKey = `${userId}:${actionType}`;

  // Step 1 — per-action-type check
  if (actionLimit) {
    const actionResult = await checkRateLimit(ACTION_COLLECTION, actionKey, {
      max: actionLimit.max,
      windowMs: actionLimit.windowMs,
      now: opts.now,
    });
    if (!actionResult.allowed) {
      return { allowed: false, reason: `action_rate_limited:${actionType}` };
    }
  }

  // Step 2 — global per-user daily cap (all action types)
  const dailyResult = await checkRateLimit(DAILY_CAP_COLLECTION, userId, {
    max: GAMIFICATION_DAILY_CAP.max,
    windowMs: GAMIFICATION_DAILY_CAP.windowMs,
    now: opts.now,
  });
  if (!dailyResult.allowed) {
    return { allowed: false, reason: 'daily_cap_exceeded' };
  }

  return { allowed: true };
}
