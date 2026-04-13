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
 *   - getMyTrailProgress() — webMethod: trail progress for the current session member
 *   - _getTrailProgress(memberId) — internal backend helper (server-side use only)
 *   - recordTrailChallengeCompletion(memberId, trailId, challengeId, recipientEmail)
 *       — marks a challenge done; if trail now complete, triggers perk delivery
 */

import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { Permissions, webMethod } from 'wix-web-module';
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
 * Returns trail progress for all trails for a given member.
 * Internal backend helper — called from server-side event handlers and crons.
 * Frontend callers must use getMyTrailProgress() instead.
 *
 * @param {string} memberId
 * @returns {Promise<{ success: boolean, trails: Array, error?: string }>}
 */
// idor-ok: internal backend helper — server-side use only; frontend uses getMyTrailProgress()
export async function _getTrailProgress(memberId) {
  try {
    const { items } = await wixData
      .query(TRAIL_PROGRESS_COLLECTION)
      .eq('memberId', memberId)
      .limit(100)
      .find();

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
 * Returns trail progress for all trails for the currently logged-in member.
 * Derives memberId from the session — callers cannot supply an arbitrary memberId.
 *
 * @returns {Promise<{ success: boolean, trails: Array, error?: string }>}
 */
export const getMyTrailProgress = webMethod(Permissions.SiteMember, async () => {
  const member = await currentMember.getMember();
  if (!member?._id) return { success: false, trails: [], error: 'Not authenticated.' };
  return _getTrailProgress(member._id);
});

// ── recordTrailChallengeCompletion ────────────────────────────────────────────

/**
 * Marks a single challenge as complete for a member on a given trail.
 * Idempotent: completing an already-completed challenge is a no-op.
 * If all challenges on the trail are now complete, auto-delivers the trail perk.
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
// idor-ok: internal backend helper — called from gamification event handlers only, no frontend import
export async function recordTrailChallengeCompletion(memberId, trailId, challengeId, recipientEmail) {
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
