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
 *   - getTrailProgress(memberId) — webMethod: progress for all trails for a member
 */

import wixData from 'wix-data';

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
 * Each entry includes the trail definition fields plus:
 *   - completedChallengeIds: string[] (from saved progress, or [] if none)
 *   - isComplete: boolean (all trail challenges completed)
 *   - completedAt: Date | null
 *
 * @param {string} memberId
 * @returns {Promise<{ success: boolean, trails: Array, error?: string }>}
 */
export async function getTrailProgress(memberId) {
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
