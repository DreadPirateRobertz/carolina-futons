/**
 * @module achievementBadgeService
 * @description Award and query achievement badges for members.
 * Badges are stored in the MemberBadges CMS collection.
 *
 * memberId ownership is always validated server-side — callers cannot
 * read or write another member's badges.
 *
 * @setup
 * Create CMS collection "MemberBadges" with fields:
 * - memberId  (Text)     — Wix member ID
 * - badgeId   (Text)     — Badge identifier key from BADGES
 * - awardedAt (DateTime) — When the badge was awarded
 * - notified  (Boolean)  — Whether the member has been shown the badge notification
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

const COLLECTION = 'MemberBadges';

// ── Badge registry ────────────────────────────────────────────────────────────

export const BADGES = {
  FIRST_PURCHASE: { id: 'first_purchase', label: 'First Purchase',  points: 50  },
  STREAK_7:       { id: 'streak_7',       label: '7-Day Streak',    points: 100 },
  STREAK_30:      { id: 'streak_30',      label: '30-Day Streak',   points: 300 },
  REVIEW_5:       { id: 'review_5',       label: '5 Reviews',       points: 150 },
  REFERRAL_3:     { id: 'referral_3',     label: '3 Referrals',     points: 250 },
  WISHLIST_10:    { id: 'wishlist_10',    label: '10 Wishlist Adds', points: 75  },
};

// Build a lookup map from badge id string → BADGES entry for O(1) validation.
const BADGE_BY_ID = Object.fromEntries(
  Object.values(BADGES).map((b) => [b.id, b])
);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireOwnMember(memberId) {
  const member = await currentMember.getMember();
  if (!member || !member._id) return { error: 'auth_required' };
  if (member._id !== memberId) return { error: 'forbidden' };
  return { memberId: member._id };
}

// ── awardBadge ────────────────────────────────────────────────────────────────

/**
 * Award a badge to the authenticated member.
 * No-ops (returns alreadyAwarded: true) if the badge was previously awarded.
 *
 * @param {string} memberId
 * @param {string} badgeId  — Must be a known BADGES id (e.g. 'first_purchase')
 * @returns {Promise<{ awarded?: boolean, badge?: Object, alreadyAwarded?: boolean, error?: string }>}
 */
export const awardBadge = webMethod(
  Permissions.SiteMember,
  async (memberId, badgeId) => {
    const auth = await requireOwnMember(memberId);
    if (auth.error) return { success: false, error: auth.error };

    const badge = BADGE_BY_ID[badgeId];
    if (!badge) {
      return { success: false, error: `Unknown badgeId "${badgeId}"`, status: 400 };
    }

    try {
      const existing = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('badgeId', badgeId)
        .limit(1)
        .find({ suppressAuth: true });

      if (existing.items.length > 0) {
        return { alreadyAwarded: true };
      }

      await wixData.insert(COLLECTION, {
        memberId,
        badgeId,
        awardedAt: new Date(),
        notified: false,
      }, { suppressAuth: true });

      return { awarded: true, badge };
    } catch (err) {
      console.error('[achievementBadgeService] awardBadge failed:', err);
      return { success: false, error: 'Unable to award badge' };
    }
  }
);

// ── getMemberBadges ───────────────────────────────────────────────────────────

/**
 * Return all badges awarded to a member (public — any caller may read).
 *
 * @param {string} memberId
 * @returns {Promise<{ badges: Array<{ badgeId, label, awardedAt }> }>}
 */
export const getMemberBadges = webMethod(
  Permissions.Anyone,
  async (memberId) => {
    try {
      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .find({ suppressAuth: true });

      const badges = result.items.map((record) => ({
        badgeId:   record.badgeId,
        label:     BADGE_BY_ID[record.badgeId]?.label ?? record.badgeId,
        awardedAt: record.awardedAt,
      }));

      return { badges };
    } catch (err) {
      console.error('[achievementBadgeService] getMemberBadges failed:', err);
      return { success: false, error: 'Unable to retrieve badges' };
    }
  }
);

// ── markBadgeNotified ─────────────────────────────────────────────────────────

/**
 * Mark a badge notification as seen for the authenticated member.
 *
 * @param {string} memberId
 * @param {string} badgeId
 * @returns {Promise<{ updated?: boolean, notFound?: boolean, error?: string }>}
 */
export const markBadgeNotified = webMethod(
  Permissions.SiteMember,
  async (memberId, badgeId) => {
    const auth = await requireOwnMember(memberId);
    if (auth.error) return { success: false, error: auth.error };

    try {
      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('badgeId', badgeId)
        .limit(1)
        .find({ suppressAuth: true });

      if (result.items.length === 0) {
        return { notFound: true };
      }

      await wixData.update(COLLECTION, {
        ...result.items[0],
        notified: true,
      }, { suppressAuth: true });

      return { updated: true };
    } catch (err) {
      console.error('[achievementBadgeService] markBadgeNotified failed:', err);
      return { success: false, error: 'Unable to update badge' };
    }
  }
);
