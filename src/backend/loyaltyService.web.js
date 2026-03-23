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
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

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

/**
 * Get the current member's streak data from the MemberPoints CMS collection.
 * Returns defaults when no record exists or on error.
 *
 * @function getMyStreakData
 * @returns {Promise<{currentStreakDays: number, streakMultiplier: number, streakStartDate: string|null, lastActivityDate: string|null}>}
 * @permission SiteMember
 */
export const getMyStreakData = webMethod(
  Permissions.SiteMember,
  async () => {
    const defaults = { currentStreakDays: 0, streakMultiplier: 1, streakStartDate: null, lastActivityDate: null };
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return defaults;
      const res = await wixData.query('MemberPoints')
        .eq('memberId', member._id)
        .limit(1)
        .find({ suppressAuth: true });
      const record = res.items[0];
      if (!record) return defaults;
      return {
        currentStreakDays: record.currentStreakDays ?? 0,
        streakMultiplier: record.streakMultiplier ?? 1,
        streakStartDate: record.streakStartDate ?? null,
        lastActivityDate: record.lastActivityDate ?? null,
      };
    } catch {
      return defaults;
    }
  }
);

/**
 * Get the top N members ranked by loyalty points.
 * Optionally filtered to this week's activity.
 * Also marks the current member's entry with isCurrentUser: true.
 *
 * @function getLeaderboard
 * @param {{ limit?: number, period?: 'all-time' | 'weekly' }} options
 * @returns {Promise<{ entries: Array<{ rank, memberId, nickname, points, tier, isCurrentUser }> }>}
 * @permission SiteMember
 */
export const getLeaderboard = webMethod(
  Permissions.SiteMember,
  async ({ limit = 20, period = 'all-time' } = {}) => {
    const MAX_LIMIT = 50;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), MAX_LIMIT);
    try {
      const member = await currentMember.getMember();
      const currentMemberId = member?._id ?? null;

      let query = wixData.query('LoyaltyAccounts').descending('points');

      if (period === 'weekly') {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        query = query.ge('lastActivityDate', startOfWeek);
      }

      const res = await query.limit(safeLimit).find({ suppressAuth: true });
      const entries = res.items.map((item, idx) => ({
        rank: idx + 1,
        memberId: item.memberId,
        nickname: item.nickname ?? '',
        points: item.points ?? 0,
        tier: item.tier ?? 'Bronze',
        isCurrentUser: item.memberId === currentMemberId,
      }));

      return { entries };
    } catch (err) {
      console.error('Error getting leaderboard:', err);
      return { entries: [] };
    }
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

// ── Phase 8: Daily quest engine ───────────────────────────────────────────────

const DAILY_QUEST_POOL = [
  { id: 'purchase',       title: 'Place an order today',    action: 'purchase',       pointReward: 50 },
  { id: 'review',         title: 'Write a product review',  action: 'review',         pointReward: 30 },
  { id: 'referral',       title: 'Refer a friend',          action: 'referral',       pointReward: 75 },
  { id: 'browse',         title: 'View 5 products',         action: 'browse',         pointReward: 15 },
  { id: 'wishlist_share', title: 'Share your wishlist',     action: 'wishlist_share', pointReward: 20 },
];

const DAILY_QUESTS_PER_DAY = 3;
const DAILY_QUESTS_RATE_LIMIT = 30;
const DAILY_QUESTS_WINDOW_MS = 60_000;

/** In-memory rate limit store: memberId → { count, windowStart } */
const _dailyQuestsRateLimit = new Map();

/** @internal — exposed for test reset only */
export function _resetDailyQuestsRateLimit() {
  _dailyQuestsRateLimit.clear();
}

/**
 * Get the day-of-year (1-indexed) for a given Date.
 * Uses Math.round to avoid DST off-by-one on spring-forward days.
 * @param {Date} date
 * @returns {number}
 */
function getDayOfYear(date) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  return Math.round((date - startOfYear) / 86_400_000);
}

/**
 * Deterministic 3-quest selection for a given date.
 * Base slot = dayOfYear % poolSize, then wraps through the pool to pick 3.
 *
 * @param {Date} date
 * @returns {Array<{ id: string, title: string, action: string, pointReward: number }>}
 */
export function generateDailyQuests(date) {
  const poolSize = DAILY_QUEST_POOL.length;
  const base = getDayOfYear(date) % poolSize;
  const quests = [];
  for (let i = 0; i < DAILY_QUESTS_PER_DAY; i++) {
    quests.push(DAILY_QUEST_POOL[(base + i) % poolSize]);
  }
  return quests;
}

/**
 * Return today's 3 daily quests with completion status for the authenticated member.
 *
 * @function getMyDailyQuests
 * @returns {Promise<{ quests: Array, date: string } | { status: 401|429, error: string }>}
 * @permission SiteMember
 */
export const getMyDailyQuests = webMethod(
  Permissions.SiteMember,
  async () => {
    const member = await currentMember.getMember();
    if (!member?._id) return { status: 401, error: 'Unauthenticated' };
    const memberId = member._id;

    // Rate limit: 30 requests per minute per member
    const now = Date.now();
    const rl = _dailyQuestsRateLimit.get(memberId) || { count: 0, windowStart: now };
    if (now - rl.windowStart > DAILY_QUESTS_WINDOW_MS) {
      rl.count = 0;
      rl.windowStart = now;
    }
    rl.count += 1;
    _dailyQuestsRateLimit.set(memberId, rl);
    if (rl.count > DAILY_QUESTS_RATE_LIMIT) {
      return { status: 429, error: 'Rate limit exceeded' };
    }

    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const quests = generateDailyQuests(today);

    // Fetch completions for this member + today
    let completions = [];
    try {
      const res = await wixData.query('QuestCompletions')
        .eq('memberId', memberId)
        .eq('dateKey', dateKey)
        .find({ suppressAuth: true });
      completions = res.items;
    } catch (err) {
      console.error('[loyaltyService] QuestCompletions query failed:', err.message);
    }

    const completionByAction = new Map(completions.map(c => [c.action, c]));

    return {
      quests: quests.map(q => {
        const record = completionByAction.get(q.action) ?? null;
        return {
          id: q.id,
          title: q.title,
          action: q.action,
          pointReward: q.pointReward,
          completed: record !== null,
          completedAt: record?.completedAt ?? null,
        };
      }),
      date: dateKey,
    };
  }
);
