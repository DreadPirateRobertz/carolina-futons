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
const MAX_COUPON_RETRIES = 3;

/** Static reward catalog with fixed pricing. */
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

/**
 * Generate CF-XXXXXXXX coupon code using unambiguous alphanumerics
 * (excludes O/0/I/1 to avoid confusion).
 */
function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CF-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate a unique coupon code, checking for collisions.
 * Retries up to MAX_COUPON_RETRIES times. If all retries collide,
 * logs a warning and falls back to an unchecked code (statistically
 * near-impossible given the 31^8 keyspace).
 */
async function generateUniqueCouponCode() {
  for (let attempt = 0; attempt < MAX_COUPON_RETRIES; attempt++) {
    const code = generateCouponCode();
    const existing = await wixData
      .query(REWARD_REDEMPTIONS_COLLECTION)
      .eq('couponCode', code)
      .limit(1)
      .find({ suppressAuth: true });
    if (existing.items.length === 0) return code;
  }
  logError('generateUniqueCouponCode — exhausted all retries, falling back to unchecked code');
  return generateCouponCode();
}

/**
 * Returns the full rewards catalog (static, no auth required).
 *
 * @returns {Promise<Array<{ rewardId: string, name: string, description: string,
 *   pointsCost: number, type: string, value: number, stock: number|null, imageUrl: string }>>}
 */
export const getRewardsCatalog = webMethod(
  Permissions.Anyone,
  async () => REWARD_CATALOG
);

/**
 * Redeem a reward for a member. Verifies identity, checks balance,
 * deducts points, creates redemption record, and returns coupon code.
 * Returns { error: 'missing_member_id' } if memberId is falsy.
 *
 * Uses post-write verification: re-reads balance after update to detect
 * concurrent modifications. If the stored balance diverges, the deduction
 * is rolled back and the request is rejected.
 *
 * @param {string} memberId
 * @param {string} rewardId — must match a REWARD_CATALOG entry
 * @returns {Promise<{ success: true, couponCode: string, newBalance: number, rewardName: string }
 *   | { error: 'insufficient_points', required: number, current: number }
 *   | { error: string }>}
 */
export const redeemReward = webMethod(
  Permissions.SiteMember,
  async (memberId, rewardId) => {
    if (!memberId) {
      logError('redeemReward — called without memberId');
      return { error: 'missing_member_id' };
    }

    if (typeof rewardId !== 'string' || !/^[A-Z0-9_]+$/.test(rewardId)) {
      return { error: 'invalid_reward_id' };
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

      const newBalance = currentBalance - reward.pointsCost;
      await wixData.update(MEMBER_POINTS_COLLECTION, {
        ...record,
        totalPoints: newBalance,
      }, { suppressAuth: true });

      // Best-effort race detection: re-read after update to catch concurrent
      // modifications. Wix Data lacks conditional writes, so this narrows but
      // does not eliminate the race window. Client-side debounce recommended.
      const verifyResult = await wixData
        .query(MEMBER_POINTS_COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      if (verifyResult.items.length > 0) {
        const verified = verifyResult.items[0];
        if (verified.totalPoints !== newBalance) {
          // Race detected — restore and reject
          logError(`redeemReward — TOCTOU detected for ${memberId}, expected ${newBalance}, got ${verified.totalPoints}`);
          try {
            await wixData.update(MEMBER_POINTS_COLLECTION, {
              ...verified,
              totalPoints: verified.totalPoints + reward.pointsCost,
            }, { suppressAuth: true });
          } catch (restoreErr) {
            logError(`redeemReward — CRITICAL: TOCTOU restore failed for ${memberId}, points lost: ${reward.pointsCost}`, restoreErr);
          }
          return { error: 'concurrent_modification' };
        }
      }

      const couponCode = await generateUniqueCouponCode();

      // Insert redemption record — rollback points if this fails
      try {
        await wixData.insert(REWARD_REDEMPTIONS_COLLECTION, {
          memberId,
          rewardId: reward.rewardId,
          rewardType: reward.type,
          pointsSpent: reward.pointsCost,
          couponCode,
          status: 'active',
          redeemedAt: new Date(),
        }, { suppressAuth: true });
      } catch (insertErr) {
        logError(`redeemReward — redemption insert failed, rolling back points for ${memberId}`, insertErr);
        try {
          // Re-read fresh record to avoid clobbering concurrent writes
          const freshRead = await wixData
            .query(MEMBER_POINTS_COLLECTION)
            .eq('memberId', memberId)
            .limit(1)
            .find({ suppressAuth: true });
          if (freshRead.items.length > 0) {
            const fresh = freshRead.items[0];
            await wixData.update(MEMBER_POINTS_COLLECTION, {
              ...fresh,
              totalPoints: (fresh.totalPoints ?? 0) + reward.pointsCost,
            }, { suppressAuth: true });
          }
        } catch (rollbackErr) {
          logError(`redeemReward — CRITICAL: rollback failed for ${memberId}, points lost: ${reward.pointsCost}`, rollbackErr);
        }
        return { error: 'redemption_failed' };
      }

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
 * Returns redemption history for a member (most recent first, max 50).
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
      // IDOR guard: verify caller is the member
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
