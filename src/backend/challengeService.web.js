/**
 * @module challengeService.web
 * @description Trail data model for the Blue Ridge Trail challenge system (CF-mcyh).
 *
 * Trails:
 *   - Spring (Trail 1): First purchase → Review → Share room photo → Refer friend → Sleep quiz
 *   - Summer (Trail 2): 3-day streak → Wishlist 3 items → Futon Studio → Price alerts → 2nd purchase
 *   - Fall   (Trail 3): 7-day streak → Video review → Trade-in → 1000 pts → Mountain Guide tier
 *
 * Collections:
 *   - MemberTrailProgress: { memberId, trailId, completedChallengeIds[], completedAt }
 *
 * Exports:
 *   - TRAIL_REGISTRY    — static trail definitions
 *   - TRAIL_PROGRESS_COLLECTION — CMS collection name
 *   - getTrailProgress — webMethod: progress for all trails (memberId derived server-side)
 *   - recordTrailChallengeCompletion — webMethod: mark challenge done (memberId derived server-side)
 *   - _getTrailProgressForMember(memberId) — internal helper for backend-to-backend calls
 *   - _recordTrailChallengeCompletion(memberId, trailId, challengeId, recipientEmail) — internal helper
 */

import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';
import { deliverTrailPerk } from 'backend/trailPerkService.web';

export const TRAIL_PROGRESS_COLLECTION = 'MemberTrailProgress';

/**
 * Static trail definitions.
 * Each trail has 5 challenges. challengeIds correspond to _id values in the
 * Challenges CMS collection (created separately by Melania/editor).
 */
export const TRAIL_REGISTRY = [
  {
    id: 'trail-spring',
    name: 'Spring Awakening',
    theme: 'new beginnings',
    season: 'spring',
    challengeIds: [
      'ch-first-purchase',
      'ch-write-review',
      'ch-share-room-photo',
      'ch-refer-friend',
      'ch-sleep-quiz',
    ],
    perkId: 'perk-free-shipping',
  },
  {
    id: 'trail-summer',
    name: 'Summer Stride',
    theme: 'momentum',
    season: 'summer',
    challengeIds: [
      'ch-3day-streak',
      'ch-wishlist-3-items',
      'ch-futon-studio',
      'ch-price-alert-subscribe',
      'ch-second-purchase',
    ],
    perkId: 'perk-early-access',
  },
  {
    id: 'trail-fall',
    name: 'Fall Harvest',
    theme: 'mastery',
    season: 'fall',
    challengeIds: [
      'ch-7day-streak',
      'ch-video-review',
      'ch-trade-in',
      'ch-earn-1000-pts',
      'ch-reach-mountain-guide',
    ],
    perkId: 'perk-styling-call',
  },
];

/**
 * Internal helper: returns trail progress for a given member.
 * Used by trailChallengeService.web.js (backend-to-backend).
 * NOT safe for direct frontend calls — use getTrailProgress webMethod instead.
 *
 * @param {string} memberId
 * @returns {Promise<{ success: boolean, trails: Array, error?: string }>}
 */
export async function _getTrailProgressForMember(memberId) {
  try {
    const { items } = await wixData
      .query(TRAIL_PROGRESS_COLLECTION)
      .eq('memberId', memberId)
      .limit(100)
      .find({ suppressAuth: true });

    // Index saved progress by trailId for O(1) lookup
    const progressByTrailId = {};
    for (const record of items) {
      progressByTrailId[record.trailId] = record;
    }

    const trails = TRAIL_REGISTRY.map(trail => {
      const saved = progressByTrailId[trail.id];
      const completedChallengeIds = saved?.completedChallengeIds ?? [];
      const completedAt = saved?.completedAt ?? null;
      const isComplete = completedChallengeIds.length === trail.challengeIds.length;

      return {
        trailId: trail.id,
        name: trail.name,
        season: trail.season,
        theme: trail.theme,
        challengeIds: trail.challengeIds,
        perkId: trail.perkId,
        completedChallengeIds,
        isComplete,
        completedAt,
      };
    });

    return { success: true, trails };
  } catch (err) {
    console.error('[challengeService] Error getting trail progress:', err);
    return { success: false, trails: [], error: 'Failed to load trail progress.' };
  }
}

/**
 * WebMethod: returns trail progress for the currently authenticated member.
 * memberId is derived server-side — callers cannot supply an arbitrary member.
 *
 * @returns {Promise<{ success: boolean, trails: Array, error?: string }>}
 */
export const getTrailProgress = webMethod(Permissions.SiteMember, async () => {
  let member;
  try { member = await currentMember.getMember(); } catch { member = null; }
  if (!member?._id) return { success: false, trails: [], error: 'auth_required' };
  return _getTrailProgressForMember(member._id);
});

// ── recordTrailChallengeCompletion ────────────────────────────────────────────

/**
 * Internal helper: marks a single challenge as complete for a member on a given trail.
 * Used by trailChallengeService.web.js (backend-to-backend).
 * NOT safe for direct frontend calls — use recordTrailChallengeCompletion webMethod instead.
 *
 * @param {string} memberId
 * @param {string} trailId        — must match a TRAIL_REGISTRY entry id
 * @param {string} challengeId    — must be in the trail's challengeIds array
 * @param {string} recipientEmail — member email for perk notification
 * @returns {Promise<{
 *   success: boolean,
 *   trailComplete?: boolean,
 *   perkDelivered?: boolean,
 *   couponCode?: string | null,
 *   error?: string
 * }>}
 */
export async function _recordTrailChallengeCompletion(memberId, trailId, challengeId, recipientEmail) {
  if (!memberId || typeof memberId !== 'string') {
    return { success: false, error: 'memberId is required.' };
  }
  if (!trailId || typeof trailId !== 'string') {
    return { success: false, error: 'trailId is required.' };
  }
  if (!challengeId || typeof challengeId !== 'string') {
    return { success: false, error: 'challengeId is required.' };
  }

  // Validate trail and challenge exist in registry
  const trail = TRAIL_REGISTRY.find(t => t.id === trailId);
  if (!trail) {
    return { success: false, error: `Unknown trailId: ${trailId}.` };
  }
  if (!trail.challengeIds.includes(challengeId)) {
    return { success: false, error: `challengeId ${challengeId} does not belong to trail ${trailId}.` };
  }

  // Fetch or create progress record
  const existing = await wixData
    .query(TRAIL_PROGRESS_COLLECTION)
    .eq('memberId', memberId)
    .eq('trailId', trailId)
    .limit(1)
    .find({ suppressAuth: true });

  const savedRecord = existing.items[0] || null;
  const completedChallengeIds = savedRecord
    ? [...(savedRecord.completedChallengeIds || [])]
    : [];

  // Idempotent: already marked
  if (completedChallengeIds.includes(challengeId)) {
    const isComplete = completedChallengeIds.length === trail.challengeIds.length;
    return { success: true, trailComplete: isComplete, perkDelivered: false };
  }

  completedChallengeIds.push(challengeId);
  const now = new Date();
  const isComplete = completedChallengeIds.length === trail.challengeIds.length;

  // Upsert progress record
  try {
    if (savedRecord) {
      await wixData.update(TRAIL_PROGRESS_COLLECTION, {
        ...savedRecord,
        completedChallengeIds,
        ...(isComplete && !savedRecord.completedAt ? { completedAt: now } : {}),
      }, { suppressAuth: true });
    } else {
      await wixData.insert(TRAIL_PROGRESS_COLLECTION, {
        _id: `${memberId}_${trailId}`,
        memberId,
        trailId,
        completedChallengeIds,
        completedAt: isComplete ? now : null,
      }, { suppressAuth: true });
    }
  } catch (err) {
    logError(`challengeService — progress upsert failed for ${memberId} / ${trailId}`, err);
    return { success: false, error: 'Failed to save trail progress.' };
  }

  // Deliver perk on trail completion
  if (isComplete) {
    try {
      const perkResult = await deliverTrailPerk(memberId, trail.perkId, recipientEmail || '');
      return {
        success: true,
        trailComplete: true,
        perkDelivered: perkResult.success && !perkResult.alreadyDelivered,
        couponCode: perkResult.couponCode || null,
      };
    } catch (err) {
      logError(`challengeService — perk delivery failed for ${memberId} / ${trail.perkId}`, err);
      // Progress is saved; perk delivery failure is non-fatal
      return { success: true, trailComplete: true, perkDelivered: false };
    }
  }

  return { success: true, trailComplete: false, perkDelivered: false };
}

/**
 * WebMethod: marks a challenge complete for the currently authenticated member.
 * memberId is derived server-side — callers cannot target another member.
 *
 * @param {string} trailId
 * @param {string} challengeId
 * @returns {Promise<{ success: boolean, trailComplete?: boolean, perkDelivered?: boolean, couponCode?: string|null, error?: string }>}
 */
export const recordTrailChallengeCompletion = webMethod(Permissions.SiteMember, async (trailId, challengeId) => {
  let member;
  try { member = await currentMember.getMember(); } catch { member = null; }
  if (!member?._id) return { success: false, error: 'auth_required' };
  return _recordTrailChallengeCompletion(member._id, trailId, challengeId, member.loginEmail || '');
});
