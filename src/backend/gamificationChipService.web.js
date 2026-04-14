/**
 * @module gamificationChipService
 * @description Per-product gamification chip data for Collection and Category pages.
 *
 * webMethod getGamificationChipsForProducts(productIds, memberId) —
 *   Returns gamification chip metadata for a batch of product IDs.
 *   Chips encode the member's current points, streak, and earned badges.
 *   Product IDs are validated but chip data is member-level (same across
 *   all products in the batch); the per-product envelope enables future
 *   category-specific badge targeting without an API change.
 *
 *   Returns:
 *     { success: true,
 *       chips: { points, tier, streak, badges: string[], hasActivity: boolean } }
 *
 * CMS collections read:
 *   MemberPoints  — totalPoints, tier, currentStreakDays
 *   MemberBadges  — badgeId (per member)
 *
 * Stilgar-independent: no Wix Stores or dynamic page dependencies.
 * cf-tcs / cf-wisp-kmwl
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

const MEMBER_POINTS_COLLECTION = 'MemberPoints';
const MEMBER_BADGES_COLLECTION = 'MemberBadges';
const MAX_PRODUCT_IDS = 50;

/**
 * Returns gamification chip data for a set of product IDs and a member.
 *
 * productIds is validated (array, 1–50 strings) but chip data is member-scoped —
 * all products in the batch receive the same chip envelope. The per-product
 * structure is intentional for forward compatibility with category-based badge
 * targeting.
 *
 * @param {string[]} productIds  Array of Wix Stores product IDs (max 50).
 * @param {string}   memberId    Wix member ID.
 * @returns {Promise<{
 *   success: boolean,
 *   chips?: { points: number, tier: string|null, streak: number, badges: string[], hasActivity: boolean },
 *   error?: string
 * }>}
 */
export const getGamificationChipsForProducts = webMethod(
  Permissions.Anyone,
  async (productIds, memberId) => {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return { success: false, error: 'productIds must be a non-empty array.' };
    }
    if (productIds.length > MAX_PRODUCT_IDS) {
      return { success: false, error: `productIds exceeds maximum of ${MAX_PRODUCT_IDS}.` };
    }
    if (!memberId || typeof memberId !== 'string') {
      return { success: true, chips: { points: 0, tier: null, streak: 0, badges: [], hasActivity: false } };
    }

    try {
      // Fetch member points + streak
      const pointsRes = await wixData
        .query(MEMBER_POINTS_COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      const record = pointsRes.items[0] ?? null;
      const points = record?.totalPoints ?? 0;
      const tier   = record?.tier ?? null;
      const streak = record?.currentStreakDays ?? 0;

      // Fetch earned badges (best-effort — empty on error)
      let badges = [];
      try {
        const badgeRes = await wixData
          .query(MEMBER_BADGES_COLLECTION)
          .eq('memberId', memberId)
          .limit(50)
          .find({ suppressAuth: true });
        badges = badgeRes.items.map(b => b.badgeId).filter(Boolean);
      } catch (err) {
        logError('gamificationChipService.getGamificationChipsForProducts.badges', err, { silent: true });
      }

      const hasActivity = points > 0 || streak > 0 || badges.length > 0;

      return { success: true, chips: { points, tier, streak, badges, hasActivity } };
    } catch (e) {
      logError('gamificationChipService.getGamificationChipsForProducts', e);
      return { success: false, error: 'Failed to load gamification chip data.' };
    }
  }
);
