/**
 * @module loyaltyHelpers
 * @description Pure frontend helpers for loyalty dashboard display.
 * Formats points, tier progress, rewards, and comparison data for the Member Page.
 * All functions are pure (no side effects, no $w calls) for testability.
 */
import { colors } from 'public/sharedTokens.js';

const TIER_ORDER = ['Bronze', 'Silver', 'Gold'];

const TIER_COLORS = {
  Bronze: colors.espressoLight,
  Silver: colors.mountainBlue,
  Gold: colors.sunsetCoral,
};

const TIER_ICONS = {
  Bronze: '\u2728', // sparkles
  Silver: '\u2B50', // star
  Gold: '\uD83C\uDFC6', // trophy
};

/**
 * Format a points value for display with locale-aware comma separators.
 * @param {number|string|null|undefined} points - Raw points value
 * @returns {string} Formatted string like "1,250 pts"
 */
export function formatPoints(points) {
  const num = Number(points);
  if (!Number.isFinite(num) || num < 0) return '0 pts';
  return `${num.toLocaleString('en-US')} pts`;
}

/**
 * Format the tier progress text for display.
 * @param {Object|null} account - Loyalty account from getMyLoyaltyAccount()
 * @returns {string} Progress text like "300 points to Silver" or max-tier message
 */
export function formatProgressText(account) {
  if (!account || !account.tier) return 'Join our rewards program';
  if (!account.nextTier) return `You've reached ${account.tier} — our highest tier!`;
  if (account.pointsToNext > 0) return `${account.pointsToNext} points to ${account.nextTier}`;
  return 'Join our rewards program';
}

/**
 * Get the progress percentage (0-100) from an account object.
 * @param {Object|null} account - Loyalty account
 * @returns {number} Progress percent clamped to 0-100
 */
export function getProgressPercent(account) {
  if (!account || typeof account.progress !== 'number') return 0;
  return Math.max(0, Math.min(100, account.progress));
}

/**
 * Get the brand color for a loyalty tier.
 * @param {string|null} tier - Tier name (Bronze, Silver, Gold)
 * @returns {string} Hex color from design tokens
 */
export function getTierColor(tier) {
  return TIER_COLORS[tier] || colors.espressoLight;
}

/**
 * Get the emoji icon for a loyalty tier.
 * @param {string|null} tier - Tier name
 * @returns {string} Emoji icon
 */
export function getTierIcon(tier) {
  return TIER_ICONS[tier] || '\u2728';
}

/**
 * Check whether a member can afford a given reward.
 * @param {Object|null} reward - Reward with pointsCost
 * @param {number} memberPoints - Member's current points
 * @returns {boolean}
 */
export function canAffordReward(reward, memberPoints) {
  if (!reward) return false;
  const cost = reward.pointsCost || 0;
  const pts = Number(memberPoints);
  if (!Number.isFinite(pts) || pts < 0) return false;
  return pts >= cost;
}

/**
 * Format the cost display for a reward, showing deficit if unaffordable.
 * @param {Object|null} reward - Reward with pointsCost
 * @param {number} memberPoints - Member's current points
 * @returns {string} Formatted cost string
 */
export function formatRewardCost(reward, memberPoints) {
  if (!reward) return '';
  const cost = reward.pointsCost || 0;
  if (cost === 0) return 'Free';
  const pts = Number(memberPoints) || 0;
  const formatted = cost.toLocaleString('en-US');
  if (pts >= cost) return `${formatted} pts`;
  const deficit = (cost - pts).toLocaleString('en-US');
  return `${formatted} pts (need ${deficit} more)`;
}

/**
 * Build tier comparison data with current/achieved status flags.
 * @param {Array|null} tiers - Tier definitions from getLoyaltyTiers()
 * @param {string} currentTier - Member's current tier name
 * @returns {Array} Tiers with isCurrent and isAchieved flags
 */
export function buildTierComparisonData(tiers, currentTier) {
  if (!tiers || !Array.isArray(tiers)) return [];
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  return tiers.map(tier => {
    const tierIdx = TIER_ORDER.indexOf(tier.name);
    return {
      ...tier,
      isCurrent: tier.name === currentTier,
      isAchieved: currentIdx >= 0 && tierIdx >= 0 && tierIdx <= currentIdx,
    };
  });
}

/**
 * Get a motivational milestone message based on account status.
 * @param {Object|null} account - Loyalty account
 * @returns {string} Milestone message
 */
export function getNextMilestone(account) {
  if (!account || !account.tier) return '';
  if (!account.nextTier) return `You're at the top! Enjoy your ${account.tier} rewards.`;
  if (account.pointsToNext > 0) {
    return `Only ${account.pointsToNext} points to ${account.nextTier}!`;
  }
  return '';
}
