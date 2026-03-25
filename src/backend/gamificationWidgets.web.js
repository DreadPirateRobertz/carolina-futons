/**
 * @module gamificationWidgets.web
 * @description Widget data endpoints for the gamification system.
 * Split from gamificationEventReceiver.web.js for maintainability (CF-jz4r).
 *
 * Exported webMethods:
 *   getGamificationStats(memberId) — aggregate stats for stats widget
 *   checkMilestoneProximity(memberId) — nudge data for milestone proximity
 *   getRecentAchievements(limit) — social proof toast data
 *   getDailyQuests(memberId) — daily quest progress for quest widget
 *   getShareableProgress() — social sharing data (auth via currentMember)
 *   getMilestones(memberId) — milestone progress for rewards widget
 *
 * CF-jz4r
 */

import { Permissions, webMethod } from 'wix-web-module';
import { TIER_NAMES } from 'public/gamificationTokens.js';
import { logError } from 'backend/utils/errorHandler';
import wixData from 'wix-data';
import {
  findMemberRecord,
  computeTierInfo,
  getActiveChallenges,
  MEMBER_POINTS_COLLECTION,
  MEMBER_BADGES_COLLECTION,
  CHALLENGE_PROGRESS_COLLECTION,
} from 'backend/gamificationCore.web';

// ── getGamificationStats (CF-ytrl) ──────────────────────────────────────────

/**
 * Get aggregate gamification stats for a member.
 * Returns { totalPoints, currentTier, currentStreak, badgesEarned, questsCompleted, rank }.
 *
 * CF-ytrl
 *
 * @param {string} memberId
 * @returns {Promise<{ totalPoints: number, currentTier: string, currentStreak: number, badgesEarned: number, questsCompleted: number, rank: number }>}
 */
export const getGamificationStats = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    const { currentMember } = await import('wix-members-backend');
    const caller = await currentMember.getMember();
    if (!caller?._id || caller._id !== memberId) return null;

    const [memberResult, badgesResult, questsResult, rankResult] = await Promise.all([
      findMemberRecord(memberId),
      wixData.query(MEMBER_BADGES_COLLECTION)
        .eq('memberId', memberId)
        .find({ suppressAuth: true }),
      wixData.query(CHALLENGE_PROGRESS_COLLECTION)
        .eq('memberId', memberId)
        .eq('completed', true)
        .find({ suppressAuth: true }),
      wixData.query(MEMBER_POINTS_COLLECTION)
        .gt('totalPoints', 0)
        .descending('totalPoints')
        .find({ suppressAuth: true }),
    ]);

    const record = memberResult;
    const totalPoints = record?.totalPoints ?? 0;
    const tierInfo = computeTierInfo(totalPoints);

    // Calculate rank from sorted list
    const rankItems = rankResult.items;
    const rankIdx = rankItems.findIndex(item => item.memberId === memberId);
    const rank = rankIdx >= 0 ? rankIdx + 1 : rankItems.length + 1;

    return {
      totalPoints,
      currentTier: tierInfo.tierName,
      currentStreak: record?.currentStreakDays ?? 0,
      badgesEarned: badgesResult.totalCount,
      questsCompleted: questsResult.totalCount,
      rank,
    };
  }
);

// ── checkMilestoneProximity (CF-cgpy) ───────────────────────────────────────

const STREAK_MILESTONES = [7, 14, 30, 60, 100, 365];
const PROXIMITY_THRESHOLD = 0.8; // 80%

/**
 * Check if member is close to any milestones (tier upgrade or streak milestone).
 * Returns nudges for milestones at >= 80% progress.
 *
 * CF-cgpy
 *
 * @param {string} memberId
 * @returns {Promise<Array<{ type: string, milestone: string, current: number, target: number, remaining: number }>>}
 */
export const checkMilestoneProximity = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    const record = await findMemberRecord(memberId);
    const totalPoints = record?.totalPoints ?? 0;
    const currentStreak = record?.currentStreakDays ?? 0;
    const nudges = [];

    // Tier proximity: find next tier threshold
    for (let i = 0; i < TIER_NAMES.length; i++) {
      if (totalPoints < TIER_NAMES[i].threshold) {
        const target = TIER_NAMES[i].threshold;
        const prevThreshold = i > 0 ? TIER_NAMES[i - 1].threshold : 0;
        const range = target - prevThreshold;
        const progress = totalPoints - prevThreshold;
        if (range > 0 && progress / range >= PROXIMITY_THRESHOLD) {
          nudges.push({
            type: 'tier',
            milestone: TIER_NAMES[i].name,
            current: totalPoints,
            target,
            remaining: target - totalPoints,
          });
        }
        break;
      }
    }

    // Streak proximity: find next streak milestone
    for (const milestone of STREAK_MILESTONES) {
      if (currentStreak < milestone) {
        if (milestone > 0 && currentStreak / milestone >= PROXIMITY_THRESHOLD) {
          nudges.push({
            type: 'streak',
            milestone: `${milestone}-day streak`,
            current: currentStreak,
            target: milestone,
            remaining: milestone - currentStreak,
          });
        }
        break;
      }
    }

    return nudges;
  }
);

// ── getRecentAchievements (CF-cj4l) ─────────────────────────────────────────

/**
 * Get recent public achievements (badge_earned, tier_upgraded) for social proof toasts.
 * Returns last N achievements across all members.
 *
 * CF-cj4l
 *
 * @param {number} [limit=5]
 * @returns {Promise<Array<{ memberNickname: string, achievementType: string, achievementName: string, timestamp: string }>>}
 */
export const getRecentAchievements = webMethod(
  Permissions.Anyone,
  async (limit = 5) => {
    const result = await wixData
      .query('AnalyticsEvents')
      .hasSome('eventType', ['badge_earned', 'tier_upgraded'])
      .descending('timestamp')
      .limit(limit)
      .find({ suppressAuth: true });

    // Look up display names for each member
    const memberIds = [...new Set(result.items.map(i => i.memberId).filter(Boolean))];
    const memberRecords = {};
    if (memberIds.length > 0) {
      const membersResult = await wixData
        .query(MEMBER_POINTS_COLLECTION)
        .hasSome('memberId', memberIds)
        .find({ suppressAuth: true });
      for (const m of membersResult.items) {
        memberRecords[m.memberId] = m.displayName ?? 'A member';
      }
    }

    return result.items.map((item) => {
      const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload ?? {});
      return {
        memberNickname: memberRecords[item.memberId] ?? 'A member',
        achievementType: item.eventType,
        achievementName: payload.badgeLabel ?? payload.newTier ?? item.eventType,
        timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : null,
      };
    });
  }
);

// ── getDailyQuests (CF-8t8z) ────────────────────────────────────────────────

/**
 * Returns active daily quests for a member, merged with their progress.
 * Wraps getActiveChallenges and reshapes for DailyQuestsWidget consumption.
 *
 * CF-8t8z
 *
 * @param {string} memberId
 * @returns {Promise<Array<{ questId: string, title: string, description: string|null,
 *   currentProgress: number, targetProgress: number, pointsReward: number,
 *   isComplete: boolean, expiresAt: string|null }> | { error: string }>}
 */
export const getDailyQuests = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId) {
      logError('getDailyQuests — called without memberId');
      return { error: 'missing_member_id' };
    }

    try {
      const result = await getActiveChallenges(memberId);
      if (result.error || result.status === 429) {
        logError(`getDailyQuests — upstream error for member ${memberId}`, {
          error: result.error,
          status: result.status,
        });
        return { error: result.error || 'rate_limited' };
      }
      const challenges = result.challenges || [];

      return challenges.map(c => ({
        questId: c.challengeId,
        title: c.title,
        description: c.description ?? null,
        currentProgress: c.progressValue ?? 0,
        targetProgress: c.targetCount ?? 1,
        pointsReward: c.rewardPoints ?? 0,
        isComplete: c.completedAt != null,
        expiresAt: c.expiresAt ?? null,
      }));
    } catch (err) {
      logError(`getDailyQuests — failed for member ${memberId}`, err);
      return { error: 'service_unavailable' };
    }
  }
);

// ── getShareableProgress (CF-fxby) ──────────────────────────────────────────

/**
 * Get the authenticated caller's shareable progress summary for social sharing.
 * Uses currentMember to resolve identity server-side — never trusts client-supplied memberId.
 *
 * @returns {Promise<{ tierName: string, totalPoints: number, streak: number, topBadges: string[], shareText: string, shareUrl: string } | { error: string }>}
 *
 * CF-fxby
 */
export const getShareableProgress = webMethod(
  Permissions.SiteMember,
  async () => {
    let memberId;
    try {
      const { currentMember } = await import('wix-members-backend');
      const caller = await currentMember.getMember();
      memberId = caller?._id;
    } catch (_) { /* auth unavailable */ }

    if (!memberId) {
      return { error: 'auth_required' };
    }

    const record = await findMemberRecord(memberId);
    const totalPoints = record?.totalPoints ?? 0;
    const streak = record?.currentStreakDays ?? 0;
    const tierInfo = computeTierInfo(totalPoints);

    // Top 3 badges
    const badgeResult = await wixData
      .query(MEMBER_BADGES_COLLECTION)
      .eq('memberId', memberId)
      .descending('earnedDate')
      .limit(3)
      .find({ suppressAuth: true });
    const topBadges = badgeResult.items.map(b => b.badgeName ?? b.badgeId ?? 'Badge');

    const pointsStr = String(totalPoints).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const shareText = `I'm a ${tierInfo.tierName} member at Carolina Futons with ${pointsStr} points${streak > 0 ? ` and a ${streak}-day streak` : ''}! 🏆`;
    const shareUrl = `https://www.carolinafutons.com/referral?ref=${encodeURIComponent(memberId)}`;

    return { tierName: tierInfo.tierName, totalPoints, streak, topBadges, shareText, shareUrl };
  }
);

// ── getMilestones (CF-lhrg) ─────────────────────────────────────────────────

const MILESTONES = [
  { milestoneId: 'first-purchase',   title: 'First Purchase',   description: 'Complete your first order',       targetValue: 1,  reward: '100 bonus points',                        field: 'orderCount' },
  { milestoneId: 'loyal-customer',   title: 'Loyal Customer',   description: 'Complete 5 orders',               targetValue: 5,  reward: '500 bonus points + free shipping coupon', field: 'orderCount' },
  { milestoneId: 'top-reviewer',     title: 'Top Reviewer',     description: 'Write 10 reviews',                targetValue: 10, reward: '1000 bonus points + badge',               field: 'reviewCount' },
  { milestoneId: 'social-butterfly', title: 'Social Butterfly', description: 'Share 5 wishlists',               targetValue: 5,  reward: '250 bonus points',                        field: 'wishlistShareCount' },
  { milestoneId: 'streak-master',    title: 'Streak Master',    description: 'Maintain a 30-day login streak',  targetValue: 30, reward: '2000 bonus points + exclusive badge',     field: 'longestStreak' },
];

/**
 * Get milestone progress for a member.
 *
 * CF-lhrg
 *
 * @param {string} memberId
 * @returns {Promise<Array<{ milestoneId: string, title: string, description: string, currentValue: number, targetValue: number, reward: string, isUnlocked: boolean }>>}
 */
export const getMilestones = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    const [memberResult, reviewResult, wishlistResult] = await Promise.all([
      findMemberRecord(memberId),
      wixData.query('AnalyticsEvents')
        .eq('memberId', memberId)
        .eq('eventType', 'review')
        .find({ suppressAuth: true }),
      wixData.query('AnalyticsEvents')
        .eq('memberId', memberId)
        .eq('eventType', 'wishlist_share')
        .find({ suppressAuth: true }),
    ]);

    const record = memberResult;
    const counts = {
      orderCount: record?.orderCount ?? 0,
      reviewCount: reviewResult.totalCount,
      wishlistShareCount: wishlistResult.totalCount,
      longestStreak: record?.longestStreak ?? 0,
    };

    return MILESTONES.map((m) => {
      const currentValue = Math.min(counts[m.field] ?? 0, m.targetValue);
      return {
        milestoneId: m.milestoneId,
        title: m.title,
        description: m.description,
        currentValue,
        targetValue: m.targetValue,
        reward: m.reward,
        isUnlocked: currentValue >= m.targetValue,
      };
    });
  }
);
