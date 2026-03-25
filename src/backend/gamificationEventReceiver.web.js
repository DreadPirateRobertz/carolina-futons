/**
 * @module gamificationEventReceiver.web
 * @description Backward-compatible barrel re-export for the gamification system.
 * The monolith has been split into focused modules (CF-jz4r):
 *
 *   gamificationCore.web.js    — events, points, streaks, challenges, leaderboard, tiers
 *   gamificationWidgets.web.js — widget data endpoints (stats, quests, milestones, sharing)
 *   gamificationNotifs.web.js  — notification preferences
 *
 * All exports are re-exported here so existing imports continue to work.
 */

// Core: events, points, streaks, challenges, leaderboard, tiers, activity feed
export {
  receiveGamificationEvent,
  updateStreakState,
  updateChallengeProgress,
  checkWishlistMonthlyCap,
  recordWishlistAdd,
  getActiveChallenges,
  recordChallengeProgress,
  recoverStreak,
  getStreakData,
  getLeaderboard,
  getMemberTier,
  getActivityFeed,
  findMemberRecord,
  computeTierInfo,
  seedWelcomePoints,
  _resetActiveChallengesRateLimit,
  _resetRecordChallengeProgressRateLimit,
  MEMBER_POINTS_COLLECTION,
  MEMBER_BADGES_COLLECTION,
  CHALLENGE_PROGRESS_COLLECTION,
} from 'backend/gamificationCore.web';

// Widgets: stats, milestone proximity, achievements, quests, sharing, milestones
export {
  getGamificationStats,
  checkMilestoneProximity,
  getRecentAchievements,
  getDailyQuests,
  getShareableProgress,
  getMilestones,
  getWeeklyChallenge,
} from 'backend/gamificationWidgets.web';

// Notifications: member notification preferences
export {
  getNotificationPrefs,
  updateNotificationPrefs,
  checkStreakMilestoneNotifications,
} from 'backend/gamificationNotifs.web';
