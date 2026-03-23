/**
 * Shared gamification constants and pure utility functions.
 * Used by both web (Wix Velo) and mobile (cfutons_mobile) layers.
 *
 * No Wix imports — fully portable.
 * CF-8f5o
 */

// ── Tier thresholds (minimum points to reach each tier) ──────────────────────

export const TIER_THRESHOLDS = {
  TRAIL_BLAZER: 0,
  MOUNTAIN_GUIDE: 500,
  SUMMIT_MASTER: 2000,
  BLUE_RIDGE_LEGEND: 5000,
};

// ── Point values per earning action ──────────────────────────────────────────

export const POINT_VALUES = {
  PURCHASE_PER_DOLLAR: 1,
  REVIEW: 50,
  PHOTO_REVIEW_BONUS: 25,
  REVIEW_ACCURACY_BONUS: 10,
  REFERRAL_ACCEPTED: 200,
  AR_TRY_ON: 25,
  STREAK_7_DAY: 100,
};

// ── Streak multiplier tiers ───────────────────────────────────────────────────

export const STREAK_MULTIPLIER_TIERS = [
  { minDays: 7, multiplier: 2 },
  { minDays: 3, multiplier: 1.5 },
  { minDays: 1, multiplier: 1 },
];

/**
 * Returns the streak multiplier for a given number of consecutive ET days.
 * Tiers: 1-2 days → 1×, 3-6 days → 1.5×, 7+ days → 2×.
 * @param {number} days
 * @returns {number}
 */
export function getStreakMultiplier(days) {
  for (const tier of STREAK_MULTIPLIER_TIERS) {
    if (days >= tier.minDays) return tier.multiplier;
  }
  return 1;
}

// ── Badge color palette ───────────────────────────────────────────────────────

export const BADGE_COLORS = {
  PREMIUM: '#3D1C02',     // Espresso
  ACHIEVEMENT: '#2B5FA5', // Mountain Blue
  URGENCY: '#E8634B',     // Coral
};

// ── Badge registry ────────────────────────────────────────────────────────────

export const BADGE_REGISTRY = {
  first_step: {
    label: 'First Step',
    icon: '🥾',
    tier: 'TRAIL_BLAZER',
    description: 'Made your first purchase.',
    earnCondition: 'Complete your first order.',
  },
  trail_regular: {
    label: 'Trail Regular',
    icon: '🏕️',
    tier: 'TRAIL_BLAZER',
    description: 'Returned for 3 or more purchases.',
    earnCondition: 'Complete 3 or more orders.',
  },
  visualizer: {
    label: 'Visualizer',
    icon: '🔭',
    tier: 'TRAIL_BLAZER',
    description: 'Used AR try-on to preview a product.',
    earnCondition: 'Try the AR viewer at least once.',
  },
  curator: {
    label: 'Curator',
    icon: '🎨',
    tier: 'MOUNTAIN_GUIDE',
    description: 'Purchased across 3 or more product lines.',
    earnCondition: 'Buy from 3 different product categories.',
  },
  week_wanderer: {
    label: 'Week Wanderer',
    icon: '🗺️',
    tier: 'TRAIL_BLAZER',
    description: 'Active in the rewards program 7 days in a row.',
    earnCondition: 'Earn points or spin the wheel for 7 consecutive days.',
  },
  voice_of_mountain: {
    label: 'Voice of the Mountain',
    icon: '🏔️',
    tier: 'MOUNTAIN_GUIDE',
    description: 'Submitted 3 or more product reviews.',
    earnCondition: 'Write 3 reviews.',
  },
};

// ── TIER_NAMES — ascending by threshold; getTierForPoints depends on this order ─

export const TIER_NAMES = [
  { threshold: TIER_THRESHOLDS.TRAIL_BLAZER, name: 'Trail Blazer' },
  { threshold: TIER_THRESHOLDS.MOUNTAIN_GUIDE, name: 'Mountain Guide' },
  { threshold: TIER_THRESHOLDS.SUMMIT_MASTER, name: 'Summit Master' },
  { threshold: TIER_THRESHOLDS.BLUE_RIDGE_LEGEND, name: 'Blue Ridge Legend' },
];

// ── getTierForPoints ──────────────────────────────────────────────────────────

/**
 * Returns the tier name for a given point total.
 * NaN / Infinity / negative input returns 'Trail Blazer' via the guard.
 * null / undefined coerce to 0 via Number() and return 'Trail Blazer' through
 * the normal loop (TRAIL_BLAZER threshold = 0).
 *
 * @param {number} points
 * @returns {string} tier name
 */
export function getTierForPoints(points) {
  const p = Number(points);
  if (!Number.isFinite(p) || p < 0) return TIER_NAMES[0].name;
  for (let i = TIER_NAMES.length - 1; i >= 0; i--) {
    if (p >= TIER_NAMES[i].threshold) return TIER_NAMES[i].name;
  }
}

// ── getBadgesForAccount ───────────────────────────────────────────────────────

/**
 * Returns the list of badge IDs earned by an account based on its history.
 * Safe to call with a partial or empty object.
 *
 * @param {{ purchaseCount?: number, productLines?: string[], arTryOnUsed?: boolean, reviewCount?: number, loginStreakDays?: number, currentStreakDays?: number }} accountHistory
 * @returns {string[]} array of earned badge IDs
 */
export function getBadgesForAccount(accountHistory = {}) {
  const {
    purchaseCount = 0,
    productLines = [],
    arTryOnUsed = false,
    reviewCount = 0,
    loginStreakDays = 0,    // kept for backwards compat — no longer used for week_wanderer
    currentStreakDays = 0,  // Phase 2: activity-based streak (authoritative for week_wanderer)
  } = accountHistory;

  const earned = [];

  if (purchaseCount >= 1) earned.push('first_step');
  if (purchaseCount >= 3) earned.push('trail_regular');
  if (arTryOnUsed) earned.push('visualizer');
  if (Array.isArray(productLines) && new Set(productLines).size >= 3) earned.push('curator');
  if (currentStreakDays >= 7) earned.push('week_wanderer');  // was: loginStreakDays
  if (reviewCount >= 3) earned.push('voice_of_mountain');

  return earned;
}

// ── BADGE_DISPLAY_NAMES ───────────────────────────────────────────────────────

/**
 * Display names for badge slugs.
 * Used by TriggerMoments.js to render human-readable badge names.
 * Extend as new badges are added.
 */
export const BADGE_DISPLAY_NAMES = {
  week_wanderer: 'Week Wanderer',
  trail_regular: 'Trail Regular',
  top_reviewer: 'Top Reviewer',
  ar_explorer: 'AR Explorer',
};
