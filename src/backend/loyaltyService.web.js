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
import { checkRateLimit } from 'backend/utils/rateLimit';

// ── Challenge catalog constants ───────────────────────────────────────────────
const CHALLENGE_DEFS_COLLECTION = 'ChallengeDefinitions';
const CHALLENGE_PROGRESS_COLLECTION = 'ChallengeProgress';

// ── Challenge catalog cache + rate limit (module-level, reset via test helpers) ──
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CATALOG_RATE_LIMIT = 30;
const CATALOG_WINDOW_MS = 60 * 1000;
let _catalogCache = new Map();
let _catalogRateLimit = new Map();
export function _resetChallengeCatalogCache() { _catalogCache = new Map(); }
export function _resetChallengeCatalogRateLimit() { _catalogRateLimit = new Map(); }

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

/**
 * Get all active challenge definitions merged with the current member's progress.
 * Extends getActiveChallenges with: full catalog (not capped at 5), null-expiresAt
 * support, 5-min per-member cache, and 30/min rate limit.
 *
 * @function getChallengeCatalog
 * @returns {Promise<{ challenges: Array } | { error: 429 }>}
 * @permission SiteMember
 */
export const getChallengeCatalog = webMethod(
  Permissions.SiteMember,
  async () => {
    const member = await currentMember.getMember();
    if (!member?._id) return { challenges: [] };
    const memberId = member._id;

    // Rate limit: 30/min per member
    const now = Date.now();
    const rl = _catalogRateLimit.get(memberId) || { count: 0, windowStart: now };
    if (now - rl.windowStart > CATALOG_WINDOW_MS) {
      rl.count = 0;
      rl.windowStart = now;
    }
    rl.count += 1;
    _catalogRateLimit.set(memberId, rl);
    if (rl.count > CATALOG_RATE_LIMIT) {
      return { error: 429 };
    }

    // Cache: return early if fresh
    const cached = _catalogCache.get(memberId);
    if (cached && now < cached.expiresAt) {
      return cached.data;
    }

    try {
      const nowDate = new Date();

      // Fetch all active definitions; filter expired in JS (supports null expiresAt)
      const defsResult = await wixData
        .query(CHALLENGE_DEFS_COLLECTION)
        .eq('active', true)
        .find({ suppressAuth: true });

      const defs = defsResult.items.filter(d => !d.expiresAt || new Date(d.expiresAt) > nowDate);

      if (defs.length === 0) {
        const result = { challenges: [] };
        _catalogCache.set(memberId, { data: result, expiresAt: now + CATALOG_CACHE_TTL_MS });
        return result;
      }

      // Fetch all progress for this member in one batch query
      const progressResult = await wixData
        .query(CHALLENGE_PROGRESS_COLLECTION)
        .eq('memberId', memberId)
        .find({ suppressAuth: true });

      const progressMap = Object.fromEntries(progressResult.items.map(p => [p.challengeId, p]));

      const challenges = defs.map(d => {
        const prog = progressMap[d._id];
        const progress = prog ? (prog.completedCount ?? 0) : 0;
        const completed = progress >= d.goal;
        const rawCompletedAt = prog?.completedAt ?? null;
        return {
          id: d._id,
          title: d.title,
          description: d.description ?? null,
          goal: d.goal,
          unit: d.unit,
          pointReward: d.pointReward,
          expiresAt: d.expiresAt instanceof Date ? d.expiresAt.toISOString() : (d.expiresAt ?? null),
          progress,
          completed,
          completedAt: rawCompletedAt instanceof Date ? rawCompletedAt.toISOString() : rawCompletedAt,
        };
      });

      const result = { challenges };
      _catalogCache.set(memberId, { data: result, expiresAt: now + CATALOG_CACHE_TTL_MS });
      return result;
    } catch (err) {
      console.error('Error getting challenge catalog:', err);
      return { challenges: [] };
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

// ── Achievement system ────────────────────────────────────────────────────────

const STREAK_MILESTONES = [7, 14, 30, 60, 100, 365];

const BADGE_LABELS = {
  7:   'Week Warrior',
  14:  'Fortnight Fighter',
  30:  'Monthly Master',
  60:  'Two Month Titan',
  100: 'Century Club',
  365: 'Year-Round Legend',
};

/**
 * Return milestone thresholds newly crossed by currentStreakDays that have not
 * yet been recorded for memberId in the StreakAchievements collection.
 *
 * @param {string} memberId
 * @param {number} currentStreakDays
 * @returns {Promise<number[]>}
 */
export async function checkStreakAchievements(memberId, currentStreakDays) {
  try {
    const reached = STREAK_MILESTONES.filter(m => currentStreakDays >= m);
    if (reached.length === 0) return [];

    const existing = await wixData.query('StreakAchievements')
      .eq('memberId', memberId)
      .find({ suppressAuth: true });
    const earned = new Set(existing.items.map(r => r.milestone));
    return reached.filter(m => !earned.has(m));
  } catch (err) {
    console.error('Error checking streak achievements:', err);
    return [];
  }
}

/**
 * Insert a StreakAchievements record. Idempotent — skips if already recorded.
 *
 * @param {string} memberId
 * @param {number} milestone
 * @param {number} streakDays
 * @returns {Promise<void>}
 */
export async function insertStreakAchievement(memberId, milestone, streakDays) {
  try {
    const existing = await wixData.query('StreakAchievements')
      .eq('memberId', memberId)
      .eq('milestone', milestone)
      .limit(1)
      .find({ suppressAuth: true });
    if (existing.items.length > 0) return;

    await wixData.insert('StreakAchievements', {
      memberId,
      milestone,
      streakDays,
      earnedAt: new Date(),
      notified: false,
    }, { suppressAuth: true });
  } catch (err) {
    console.error('Error inserting streak achievement:', err);
    throw err;
  }
}

/**
 * Return all streak achievements earned by the authenticated member.
 *
 * @function getMyAchievements
 * @returns {Promise<{ achievements: Array<{ milestone, streakDays, earnedAt, badgeLabel }> }>}
 * @permission SiteMember
 */
export const getMyAchievements = webMethod(
  Permissions.SiteMember,
  async () => {
    const defaults = { achievements: [] };
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return defaults;

      const { allowed } = await checkRateLimit('AchievementsRateLimit', member._id, { max: 20, windowMs: 60_000 });
      if (!allowed) return { error: 'Rate limit exceeded' };

      const res = await wixData.query('StreakAchievements')
        .eq('memberId', member._id)
        .find({ suppressAuth: true });

      const achievements = res.items.map(item => ({
        milestone:  item.milestone,
        streakDays: item.streakDays,
        earnedAt:   item.earnedAt,
        badgeLabel: BADGE_LABELS[item.milestone] ?? `${item.milestone}-day streak`,
      }));

      return { achievements };
    } catch (err) {
      // Fail-open: return empty list rather than surface errors to the client
      console.error('Error getting achievements:', err);
      return defaults;
    }
  }
);
