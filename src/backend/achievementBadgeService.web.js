/**
 * @module achievementBadgeService
 * @description Award and query achievement badges for members.
 *
 * webMethod awardBadge(memberId, badgeId) (Permissions.SiteMember)
 *   - IDOR guard: caller must own memberId.
 *   - Returns { alreadyAwarded: true } if badge already exists.
 *   - Returns { awarded: true, badge } on success.
 *   - Returns { error, status: 400 } for unknown badgeId.
 *
 * webMethod getMemberBadges(memberId) (Permissions.Anyone)
 *   - Returns array of { badgeId, label, awardedAt, notified }.
 *
 * webMethod markBadgeNotified(memberId, badgeId) (Permissions.SiteMember)
 *   - IDOR guard: caller must own memberId.
 *   - Returns { updated: true } or { notFound: true }.
 *
 * CMS collection: MemberBadges — memberId, badgeId, awardedAt, notified
 *
 * CF-7tdf
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 */
import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { logError } from 'backend/utils/errorHandler';

const COLLECTION = 'MemberBadges';

export const BADGES = {
  FIRST_PURCHASE: { id: 'first_purchase', label: 'First Purchase',  points: 50  },
  STREAK_7:       { id: 'streak_7',       label: '7-Day Streak',    points: 100 },
  STREAK_30:      { id: 'streak_30',      label: '30-Day Streak',   points: 300 },
  REVIEW_5:       { id: 'review_5',       label: '5 Reviews',       points: 150 },
  REFERRAL_3:     { id: 'referral_3',     label: '3 Referrals',     points: 250 },
  WISHLIST_10:    { id: 'wishlist_10',    label: '10 Wishlist Adds', points: 75  },
};

/** Map badgeId → BADGES entry for O(1) lookup. */
const BADGE_BY_ID = Object.fromEntries(
  Object.values(BADGES).map(b => [b.id, b])
);

/**
 * Award a badge to a member (idempotent).
 */
export const awardBadge = webMethod(
  Permissions.SiteMember,
  async (memberId, badgeId) => {
    // IDOR guard
    let session;
    try {
      session = await currentMember.getMember();
    } catch (e) {
      logError(`achievementBadgeService.awardBadge.auth [member=${memberId}]`, e);
      return null;
    }
    if (!session || session._id !== memberId) return null;

    if (!BADGE_BY_ID[badgeId]) {
      return { error: `Unknown badgeId: ${String(badgeId).slice(0, 50)}`, status: 400 };
    }

    const existing = await wixData
      .query(COLLECTION)
      .eq('memberId', memberId)
      .eq('badgeId', badgeId)
      .find({ suppressAuth: true });

    if (existing.items.length > 0) return { alreadyAwarded: true };

    await wixData.insert(COLLECTION, {
      memberId,
      badgeId,
      awardedAt: new Date(),
      notified: false,
    }, { suppressAuth: true });

    return { awarded: true, badge: BADGE_BY_ID[badgeId] };
  }
);

/**
 * Get all badges earned by a member.
 * Returns array of { badgeId, label, awardedAt, notified }.
 */
export const getMemberBadges = webMethod(
  Permissions.Anyone,
  async (memberId) => {
    if (!memberId) return [];

    try {
      const result = await wixData
        .query(COLLECTION)
        .eq('memberId', memberId)
        .ascending('awardedAt')
        .find({ suppressAuth: true });

      return result.items.map(item => ({
        badgeId:   item.badgeId,
        label:     BADGE_BY_ID[item.badgeId]?.label ?? item.badgeId,
        awardedAt: item.awardedAt,
        notified:  item.notified ?? false,
      }));
    } catch (e) {
      logError(`achievementBadgeService.getMemberBadges [member=${memberId}]`, e);
      return [];
    }
  }
);

/**
 * Mark a badge as notified (user has seen the "new badge" highlight).
 */
export const markBadgeNotified = webMethod(
  Permissions.SiteMember,
  async (memberId, badgeId) => {
    // IDOR guard
    let session;
    try {
      session = await currentMember.getMember();
    } catch (e) {
      logError(`achievementBadgeService.markBadgeNotified.auth [member=${memberId}]`, e);
      return null;
    }
    if (!session || session._id !== memberId) return null;

    const result = await wixData
      .query(COLLECTION)
      .eq('memberId', memberId)
      .eq('badgeId', badgeId)
      .find({ suppressAuth: true });

    if (result.items.length === 0) return { notFound: true };

    const record = { ...result.items[0], notified: true };
    await wixData.update(COLLECTION, record, { suppressAuth: true });

    return { updated: true };
  }
);
