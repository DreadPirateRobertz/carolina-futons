/**
 * @module rewardsStore.web
 * @description Points redemption store backend — catalog, redemption, and history.
 * Members spend earned points on discounts, free shipping, and perks.
 *
 * CF-n932
 */

import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';
import { insertLedgerEntry } from 'backend/utils/memberPointsLedger';

const MEMBER_POINTS_COLLECTION = 'MemberPoints';
const REWARD_REDEMPTIONS_COLLECTION = 'RewardRedemptions';

/**
 * Static reward catalog. 5 reward types with fixed pricing.
 * In future this could move to a CMS collection.
 */
export const REWARD_CATALOG = [
  {
    rewardId: 'DISCOUNT_5',
    name: '$5 Off Your Next Order',
    description: 'Get $5 off any order of $25 or more',
    pointsCost: 500,
    type: 'DISCOUNT_5',
    value: 5,
    stock: null,
    imageUrl: '/images/rewards/discount-5.png',
  },
  {
    rewardId: 'FREE_SHIPPING',
    name: 'Free Shipping',
    description: 'Free standard shipping on your next order',
    pointsCost: 800,
    type: 'FREE_SHIPPING',
    value: 0,
    stock: null,
    imageUrl: '/images/rewards/free-shipping.png',
  },
  {
    rewardId: 'DOUBLE_POINTS_24H',
    name: '24-Hour Double Points',
    description: 'Earn 2x points on all activities for 24 hours',
    pointsCost: 600,
    type: 'DOUBLE_POINTS_24H',
    value: 2,
    stock: null,
    imageUrl: '/images/rewards/double-points.png',
  },
  {
    rewardId: 'DISCOUNT_15',
    name: '$15 Off Your Next Order',
    description: 'Get $15 off any order of $50 or more',
    pointsCost: 1200,
    type: 'DISCOUNT_15',
    value: 15,
    stock: null,
    imageUrl: '/images/rewards/discount-15.png',
  },
  {
    rewardId: 'EXCLUSIVE_EARLY_ACCESS',
    name: 'Exclusive Early Access',
    description: 'Get 48-hour early access to new collection launches',
    pointsCost: 2000,
    type: 'EXCLUSIVE_EARLY_ACCESS',
    value: 48,
    stock: null,
    imageUrl: '/images/rewards/early-access.png',
  },
];

const CATALOG_MAP = Object.fromEntries(REWARD_CATALOG.map(r => [r.rewardId, r]));

function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CF-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Returns the full rewards catalog (static, no auth required).
 *
 * @returns {Promise<Array<{ rewardId: string, name: string, description: string,
 *   pointsCost: number, type: string, value: number, stock: number|null, imageUrl: string }>>}
 */
export const getRewardsCatalog = webMethod(
  Permissions.Anyone,
  async () => {
    return [...REWARD_CATALOG];
  }
);

/**
 * Redeem a reward for a member. Verifies identity, checks balance,
 * deducts points, creates redemption record, and returns coupon code.
 *
 * @param {string} memberId
 * @param {string} rewardId — must match a REWARD_CATALOG entry
 * @returns {Promise<{ success: true, couponCode: string, newBalance: number, rewardName: string }
 *   | { error: string }>}
 */
export const redeemReward = webMethod(
  Permissions.SiteMember,
  async (memberId, rewardId) => {
    if (!memberId) {
      logError('redeemReward — called without memberId');
      return { error: 'missing_member_id' };
    }

    const reward = CATALOG_MAP[rewardId];
    if (!reward) {
      return { error: 'invalid_reward_id' };
    }

    try {
      // IDOR guard: verify caller is the member
      const caller = await currentMember.getMember();
      if (!caller || caller._id !== memberId) {
        return { error: 'forbidden' };
      }

      // Fetch member points
      const mpResult = await wixData
        .query(MEMBER_POINTS_COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      if (mpResult.items.length === 0) {
        return { error: 'no_member_record' };
      }

      const record = mpResult.items[0];
      const currentBalance = record.totalPoints ?? 0;

      if (currentBalance < reward.pointsCost) {
        return { error: 'insufficient_points', required: reward.pointsCost, current: currentBalance };
      }

      // Deduct points
      const newBalance = currentBalance - reward.pointsCost;
      await wixData.update(MEMBER_POINTS_COLLECTION, {
        ...record,
        totalPoints: newBalance,
      }, { suppressAuth: true });

      // Generate coupon code
      const couponCode = generateCouponCode();

      // Create redemption record
      await wixData.insert(REWARD_REDEMPTIONS_COLLECTION, {
        memberId,
        rewardId: reward.rewardId,
        rewardType: reward.type,
        pointsSpent: reward.pointsCost,
        couponCode,
        status: 'active',
        redeemedAt: new Date().toISOString(),
      }, { suppressAuth: true });

      // Ledger entry for the burn
      try {
        await insertLedgerEntry({
          memberId,
          traceId: `${memberId}_redeem_${rewardId}_${Date.now()}`,
          operationType: 'burn',
          delta: -reward.pointsCost,
          reason: `reward_redemption:${rewardId}`,
          previousBalance: currentBalance,
          newBalance,
        });
      } catch (err) {
        logError(`redeemReward — ledger insert failed for ${memberId}`, err);
      }

      return {
        success: true,
        couponCode,
        newBalance,
        rewardName: reward.name,
      };
    } catch (err) {
      logError(`redeemReward — failed for member ${memberId}, reward ${rewardId}`, err);
      return { error: 'service_unavailable' };
    }
  }
);

/**
 * Returns redemption history for a member (most recent first).
 * IDOR-guarded: caller must be the member.
 *
 * @param {string} memberId
 * @returns {Promise<Array<{ rewardId: string, redeemedAt: string, couponCode: string,
 *   status: string, pointsSpent: number, rewardType: string }> | { error: string }>}
 */
export const getRedemptionHistory = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId) {
      logError('getRedemptionHistory — called without memberId');
      return { error: 'missing_member_id' };
    }

    try {
      // IDOR guard
      const caller = await currentMember.getMember();
      if (!caller || caller._id !== memberId) {
        return { error: 'forbidden' };
      }

      const result = await wixData
        .query(REWARD_REDEMPTIONS_COLLECTION)
        .eq('memberId', memberId)
        .descending('redeemedAt')
        .limit(50)
        .find({ suppressAuth: true });

      return result.items.map(item => ({
        rewardId: item.rewardId,
        redeemedAt: item.redeemedAt,
        couponCode: item.couponCode,
        status: item.status ?? 'active',
        pointsSpent: item.pointsSpent ?? 0,
        rewardType: item.rewardType ?? item.rewardId,
      }));
    } catch (err) {
      logError(`getRedemptionHistory — failed for member ${memberId}`, err);
      return { error: 'service_unavailable' };
    }
  }
);
