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
import { logError } from 'backend/utils/errorHandler';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { getGamePrefsForMember } from 'backend/memberGamePreferences.web';

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

      // Filter to members who have opted in to the leaderboard (privacy-default: false)
      const prefsChecks = await Promise.all(
        res.items.map(item => getGamePrefsForMember(item.memberId))
      );
      const optedInItems = res.items.filter((_, idx) => prefsChecks[idx].leaderboardOptIn === true);

      const entries = optedInItems.map((item, idx) => ({
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
 * @returns {Promise<{ challenges: Array } | { status: 429, error: string }>}
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
      return { status: 429, error: 'Rate limit exceeded' };
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

// ── Daily quest engine ────────────────────────────────────────────────────────

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
 * Get the day-of-year (1-indexed) for a given Date in local time.
 * The input must be a local-time Date within its own calendar year.
 * Uses Math.round to avoid DST off-by-one on spring-forward days
 * (elapsed ms ≈ 66.958 days → Math.floor gives 66; Math.round gives 67).
 * @param {Date} date - Local-time Date object
 * @returns {number} Day of year, 1-indexed (Jan 1 = 1)
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
    let member;
    try {
      member = await currentMember.getMember();
    } catch (err) {
      logError('[loyaltyService] getMember failed', err);
      return { status: 401, error: 'Unauthenticated' };
    }
    if (!member?._id) return { status: 401, error: 'Unauthenticated' };
    const memberId = member._id;

    // Rate limit: 30 requests per minute per member.
    // NOTE: this Map is module-scoped and is instance-local in serverless environments.
    // It provides soft rate limiting within a single warm instance; cross-instance
    // enforcement requires a CMS-backed counter (acceptable for this use case).
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
      logError('[loyaltyService] QuestCompletions query failed', err);
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
      if (!allowed) return { status: 429, error: 'Rate limit exceeded' };

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

// ── PointsLedger constants ────────────────────────────────────────────────────

const POINTS_LEDGER_COLLECTION = 'PointsLedger';
// NOTE: CHALLENGES_COLLECTION is also defined in gamificationEventReceiver.web.js — keep in sync.
// If the collection is ever renamed, update both files.
const CHALLENGES_COLLECTION = 'Challenges';

/**
 * Returns true if the error is a Wix Data unique-constraint violation.
 * Wix surfaces these as errors whose message contains 'duplicate'
 * (e.g. "WDE0025: duplicate key value violates unique constraint").
 * @param {unknown} err
 * @returns {boolean}
 */
function isDuplicateKeyError(err) {
  const msg = typeof err?.message === 'string' ? err.message.toLowerCase() : '';
  return msg.includes('duplicate') || msg.includes('wde0025');
}

/**
 * Write a PointsLedger entry when a streak milestone is reached.
 * Idempotent — skips if an entry already exists for memberId + milestone.
 *
 * Deduplication strategy (two layers):
 *   1. App-level: read-before-write guard (fast path, has TOCTOU window).
 *   2. DB-level: unique index on `memberMilestoneKey` field enforced by
 *      ensurePointsLedgerIndex() in src/backend/cms/ensureIndexes.js.
 *      When the DB rejects a duplicate insert the error is caught and
 *      silently swallowed — the record already exists, so the goal is met.
 *
 * @param {string} memberId
 * @param {number} milestone - Day count of the milestone. Known labelled values:
 *   7, 14, 30, 60, 100, 365. Other values are stored with a fallback description.
 * @param {number} points - Points awarded (typically milestone * 2)
 * @returns {Promise<void>}
 * @throws {TypeError} if memberId is invalid or milestone/points are not positive numbers
 */
export async function recordStreakMilestoneEvent(memberId, milestone, points) {
  const cleanId = validateId(memberId);
  if (!cleanId) throw new TypeError('recordStreakMilestoneEvent: invalid memberId');
  if (typeof milestone !== 'number' || !Number.isFinite(milestone) || milestone <= 0) {
    throw new TypeError('recordStreakMilestoneEvent: milestone must be a positive finite number');
  }
  if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0) {
    throw new TypeError('recordStreakMilestoneEvent: points must be a positive finite number');
  }

  const existing = await wixData.query(POINTS_LEDGER_COLLECTION)
    .eq('memberId', cleanId)
    .eq('milestone', milestone)
    .limit(1)
    .find({ suppressAuth: true });
  if (existing.items.length > 0) return;

  const label = BADGE_LABELS[milestone];
  const description = label ? `${milestone}-day streak — ${label}` : `${milestone}-day streak`;

  try {
    await wixData.insert(POINTS_LEDGER_COLLECTION, {
      memberId: cleanId,
      milestone,
      memberMilestoneKey: `${cleanId}:${milestone}`,
      type: 'streak_milestone',
      description,
      points,
      earnedAt: new Date(),
    }, { suppressAuth: true });
  } catch (err) {
    // DB-level unique constraint violation: record was inserted by a concurrent
    // call between our read and write. Treat as idempotent success.
    if (isDuplicateKeyError(err)) return;
    throw err;
  }
}

/**
 * Record a challenge completion event in the PointsLedger CMS collection.
 * Idempotent: skips insert if a record for this member + challenge already exists.
 *
 * @param {string} memberId
 * @param {string} challengeId
 * @param {number} points — reward points for this challenge (must be > 0)
 * @returns {Promise<void>}
 * @throws {TypeError} if memberId or challengeId are invalid, or points is not a positive finite number
 */
export async function recordChallengeCompleteEvent(memberId, challengeId, points) {
  const cleanId = validateId(memberId);
  if (!cleanId) throw new TypeError('recordChallengeCompleteEvent: invalid memberId');
  const cleanChallengeId = validateId(challengeId);
  if (!cleanChallengeId) throw new TypeError('recordChallengeCompleteEvent: invalid challengeId');
  if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0) {
    throw new TypeError('recordChallengeCompleteEvent: points must be a positive finite number');
  }

  const existing = await wixData
    .query(POINTS_LEDGER_COLLECTION)
    .eq('memberId', cleanId)
    .eq('challengeId', cleanChallengeId)
    .eq('type', 'challenge_complete')
    .limit(1)
    .find({ suppressAuth: true });
  if (existing.items.length > 0) return;

  const challengeRes = await wixData
    .query(CHALLENGES_COLLECTION)
    .eq('challengeId', cleanChallengeId)
    .limit(1)
    .find({ suppressAuth: true });
  const title = challengeRes.items[0]?.title ?? cleanChallengeId;

  await wixData.insert(POINTS_LEDGER_COLLECTION, {
    memberId: cleanId,
    type: 'challenge_complete',
    challengeId: cleanChallengeId,
    description: `${title} completed`,
    points,
    earnedAt: new Date(),
  }, { suppressAuth: true });
}

/**
 * Write a PointsLedger entry when a challenge is completed.
 * Idempotent — skips if an entry already exists for memberId + challengeId.
 *
 * Deduplication strategy (two layers):
 *   1. App-level: read-before-write guard (fast path, has TOCTOU window).
 *   2. DB-level: unique index on `memberChallengeKey` field enforced by
 *      ensureChallengeCompletionIndex() in src/backend/cms/ensureIndexes.js.
 *      When the DB rejects a duplicate insert the error is caught and
 *      silently swallowed — the record already exists, so the goal is met.
 *
 * @param {string} memberId
 * @param {string} challengeId - ID of the completed challenge.
 * @param {number} points - Points awarded for challenge completion.
 * @returns {Promise<void>}
 * @throws {TypeError} if memberId/challengeId are invalid or points is not a positive finite number
 */
export async function recordChallengeCompletionEvent(memberId, challengeId, points) {
  const cleanId = validateId(memberId);
  if (!cleanId) throw new TypeError('recordChallengeCompletionEvent: invalid memberId');
  const cleanChallengeId = validateId(challengeId);
  if (!cleanChallengeId) throw new TypeError('recordChallengeCompletionEvent: invalid challengeId');
  if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0) {
    throw new TypeError('recordChallengeCompletionEvent: points must be a positive finite number');
  }

  const existing = await wixData.query(POINTS_LEDGER_COLLECTION)
    .eq('memberId', cleanId)
    .eq('challengeId', cleanChallengeId)
    .limit(1)
    .find({ suppressAuth: true });
  if (existing.items.length > 0) return;

  try {
    await wixData.insert(POINTS_LEDGER_COLLECTION, {
      memberId: cleanId,
      challengeId: cleanChallengeId,
      memberChallengeKey: `${cleanId}:${cleanChallengeId}`,
      type: 'challenge_completion',
      points,
      earnedAt: new Date(),
    }, { suppressAuth: true });
  } catch (err) {
    // DB-level unique constraint violation: record was inserted by a concurrent
    // call between our read and write. Treat as idempotent success.
    if (isDuplicateKeyError(err)) return;
    throw err;
  }
}

// ── Activity feed ─────────────────────────────────────────────────────────────

const ACTIVITY_MAX_LIMIT = 50;

/**
 * Get the authenticated member's recent loyalty point events.
 * Reads the PointsLedger CMS collection, sorted by earnedAt descending.
 *
 * @function getMyActivity
 * @param {{ limit?: number, offset?: number }} options - limit is coerced and clamped to [1, 50]; offset is floored to 0
 * @returns {Promise<{ events: Array, hasMore: boolean, total: number } | { status: 401|429, error: string }>}
 * @permission SiteMember
 */
export const getMyActivity = webMethod(
  Permissions.SiteMember,
  async ({ limit = 20, offset = 0 } = {}) => {
    let member;
    try {
      member = await currentMember.getMember();
    } catch (err) {
      logError('[loyaltyService] getMyActivity getMember failed', err);
      return { status: 401, error: 'Unauthenticated' };
    }
    if (!member?._id) return { status: 401, error: 'Unauthenticated' };

    const { allowed } = await checkRateLimit('ActivityRateLimit', member._id, {
      max: 30,
      windowMs: 60_000,
    });
    if (!allowed) return { status: 429, error: 'Rate limit exceeded' };

    const safeLimit  = Math.min(Math.max(1, Number(limit)  || 20), ACTIVITY_MAX_LIMIT);
    const safeOffset = Math.max(0, Number(offset) || 0);

    const defaults = { events: [], hasMore: false, total: 0 };
    try {
      const res = await wixData.query(POINTS_LEDGER_COLLECTION)
        .eq('memberId', member._id)
        .descending('earnedAt')
        .skip(safeOffset)
        .limit(safeLimit)
        .find({ suppressAuth: true });

      const total   = res.totalCount;
      const events  = res.items.map(item => ({
        id:          item._id,
        type:        item.type,
        description: item.description,
        points:      item.points,
        earnedAt:    item.earnedAt,
      }));

      return {
        events,
        hasMore: safeOffset + events.length < total,
        total,
      };
    } catch (err) {
      logError('[loyaltyService] getMyActivity PointsLedger query failed', err);
      return defaults;
    }
  }
);
