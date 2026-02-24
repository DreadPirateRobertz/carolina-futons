/**
 * @module loyaltyService
 * @description Backend web module for loyalty program management.
 * Provides points-per-dollar system with Bronze/Silver/Gold tier progression.
 * Uses Wix Loyalty v2 API for accounts, rewards, and transactions.
 *
 * @requires wix-web-module
 * @requires wix-loyalty.v2
 *
 * @setup
 * 1. Enable Wix Loyalty in Dashboard > Loyalty Program
 * 2. Configure tiers: Bronze (0pts), Silver (500pts), Gold (1500pts)
 * 3. Set earning rule: 1 point per $1 spent
 * 4. Create rewards in Dashboard > Loyalty > Rewards
 */
import { Permissions, webMethod } from 'wix-web-module';
import { accounts } from 'wix-loyalty.v2';
import { rewards } from 'wix-loyalty.v2';
import { sanitize, validateId } from 'backend/utils/sanitize';

// Tier thresholds (points)
const TIERS = {
  Bronze: { min: 0, discount: 0, label: 'Bronze' },
  Silver: { min: 500, discount: 5, label: 'Silver' },
  Gold: { min: 1500, discount: 10, label: 'Gold' },
};

/**
 * Get the current member's loyalty account info.
 * Returns points balance, tier, and progress to next tier.
 *
 * @function getMyLoyaltyAccount
 * @returns {Promise<Object>} Loyalty account with points, tier, nextTier, progress
 * @permission SiteMember — must be logged in
 */
export const getMyLoyaltyAccount = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const account = await accounts.getMyAccount();

      if (!account) {
        return { points: 0, tier: 'Bronze', nextTier: 'Silver', progress: 0, pointsToNext: 500 };
      }

      const points = account.points?.balance || 0;
      const tier = determineTier(points);
      const nextTier = getNextTier(tier.label);
      const pointsToNext = nextTier ? nextTier.min - points : 0;
      const progress = nextTier ? Math.min(100, Math.round((points / nextTier.min) * 100)) : 100;

      return {
        points,
        tier: tier.label,
        tierDiscount: tier.discount,
        nextTier: nextTier ? nextTier.label : null,
        pointsToNext: Math.max(0, pointsToNext),
        progress,
        accountId: account._id,
      };
    } catch (err) {
      console.error('Error getting loyalty account:', err);
      return { points: 0, tier: 'Bronze', nextTier: 'Silver', progress: 0, pointsToNext: 500 };
    }
  }
);

/**
 * Get available rewards the member can redeem.
 *
 * @function getAvailableRewards
 * @returns {Promise<Array>} List of redeemable rewards with name, description, pointsCost
 * @permission SiteMember
 */
export const getAvailableRewards = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const result = await rewards.listRewards();
      const rewardsList = result.rewards || [];

      return rewardsList
        .filter(r => r.active)
        .map(r => ({
          _id: r._id,
          name: r.name,
          description: r.description || '',
          pointsCost: r.requiredPoints || 0,
          type: r.type || 'discount',
        }));
    } catch (err) {
      console.error('Error getting rewards:', err);
      return [];
    }
  }
);

/**
 * Redeem a reward for the current member.
 *
 * @function redeemReward
 * @param {string} rewardId - The ID of the reward to redeem
 * @returns {Promise<Object>} { success, couponCode?, message }
 * @permission SiteMember
 */
export const redeemReward = webMethod(
  Permissions.SiteMember,
  async (rewardId) => {
    try {
      if (!rewardId) {
        return { success: false, message: 'Reward ID is required' };
      }

      const cleanId = validateId(rewardId);
      if (!cleanId) {
        return { success: false, message: 'Invalid reward ID format' };
      }

      // Check member has enough points
      const account = await accounts.getMyAccount();
      if (!account) {
        return { success: false, message: 'Loyalty account not found' };
      }

      const reward = (await rewards.listRewards()).rewards?.find(r => r._id === cleanId);
      if (!reward) {
        return { success: false, message: 'Reward not found' };
      }

      const points = account.points?.balance || 0;
      if (points < (reward.requiredPoints || 0)) {
        return { success: false, message: 'Not enough points' };
      }

      // Redeem via Loyalty API — creates a coupon automatically
      const redemption = await rewards.redeemReward(cleanId);

      return {
        success: true,
        couponCode: redemption.couponCode || null,
        message: `Redeemed: ${reward.name}`,
      };
    } catch (err) {
      console.error('Error redeeming reward:', err);
      return { success: false, message: 'Failed to redeem reward' };
    }
  }
);

/**
 * Get loyalty tier definitions with benefits.
 *
 * @function getLoyaltyTiers
 * @returns {Promise<Array>} Tier definitions with thresholds and benefits
 * @permission Anyone — public info for marketing
 */
export const getLoyaltyTiers = webMethod(
  Permissions.Anyone,
  async () => {
    return [
      {
        name: 'Bronze',
        minPoints: 0,
        benefits: ['Earn 1 point per $1', 'Birthday bonus points', 'Early access to sales'],
      },
      {
        name: 'Silver',
        minPoints: 500,
        benefits: ['All Bronze benefits', '5% member discount', 'Free standard shipping', 'Double points events'],
      },
      {
        name: 'Gold',
        minPoints: 1500,
        benefits: ['All Silver benefits', '10% member discount', 'Free expedited shipping', 'Exclusive products', 'Priority support'],
      },
    ];
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

function determineTier(points) {
  if (points >= TIERS.Gold.min) return TIERS.Gold;
  if (points >= TIERS.Silver.min) return TIERS.Silver;
  return TIERS.Bronze;
}

function getNextTier(currentLabel) {
  if (currentLabel === 'Bronze') return TIERS.Silver;
  if (currentLabel === 'Silver') return TIERS.Gold;
  return null; // Gold is max
}
