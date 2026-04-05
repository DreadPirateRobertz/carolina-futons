/**
 * @module trailChallengeService.web
 * @description WebMethod layer for Blue Ridge Trail challenge completion + perk unlock (CF-mcyh.2).
 *
 * Wraps the plain functions in challengeService.web with SiteMember auth context
 * so frontend pages/widgets can call them directly.
 *
 * Exports:
 *   getMyTrailProgress()                          — returns progress for all trails
 *   completeTrailChallenge(trailId, challengeId)  — marks a challenge done; unlocks
 *                                                    trail perk on completion
 *
 * @requires wix-web-module
 * @requires wix-members-backend
 * @requires backend/challengeService.web
 *
 * CF-mcyh.2
 */
import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import {
  _getTrailProgressForMember,
  _recordTrailChallengeCompletion,
} from 'backend/challengeService.web';

// ── helpers ───────────────────────────────────────────────────────────────────

async function resolveCurrentMember() {
  try {
    const member = await currentMember.getMember();
    return member ?? null;
  } catch {
    return null;
  }
}

// ── getMyTrailProgress ────────────────────────────────────────────────────────

/**
 * Returns Blue Ridge Trail progress for the currently logged-in member.
 *
 * @returns {Promise<{ success: boolean, trails?: Array, error?: string }>}
 */
export const getMyTrailProgress = webMethod(
  Permissions.SiteMember,
  async () => {
    const member = await resolveCurrentMember();
    if (!member?._id) {
      return { success: false, trails: [], error: 'Authentication required.' };
    }
    return _getTrailProgressForMember(member._id);
  }
);

// ── completeTrailChallenge ────────────────────────────────────────────────────

/**
 * Marks a challenge as complete for the current member on the given trail.
 * If all challenges on the trail are now done, the trail perk is automatically
 * delivered (free-shipping coupon, early-access email, or styling-call link).
 *
 * Idempotent: completing an already-completed challenge is a no-op.
 *
 * @param {string} trailId      — e.g. 'trail-spring'
 * @param {string} challengeId  — e.g. 'ch-first-purchase'
 * @returns {Promise<{
 *   success: boolean,
 *   trailComplete?: boolean,
 *   perkDelivered?: boolean,
 *   couponCode?: string | null,
 *   error?: string
 * }>}
 */
export const completeTrailChallenge = webMethod(
  Permissions.SiteMember,
  async (trailId, challengeId) => {
    if (!trailId || typeof trailId !== 'string') {
      return { success: false, error: 'trailId is required.' };
    }
    if (!challengeId || typeof challengeId !== 'string') {
      return { success: false, error: 'challengeId is required.' };
    }

    const member = await resolveCurrentMember();
    if (!member?._id) {
      return { success: false, error: 'Authentication required.' };
    }

    return _recordTrailChallengeCompletion(
      member._id,
      trailId,
      challengeId,
      member.loginEmail || '',
    );
  }
);
