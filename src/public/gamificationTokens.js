/**
 * Shared gamification constants and pure utility functions.
 * Used by both web (Wix Velo) and mobile (cfutons_mobile) layers.
 *
 * No Wix imports — fully portable.
 * CF-8f5o
 */
import { colors } from './sharedTokens.js';

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
  AR_USED: 10,           // gamification_ar_used event
  WISHLIST_ADD: 2,       // gamification_wishlist_add event (5/day cap enforced in receiver)
};

/** Points deducted to restore a broken streak via recoverStreak(). Once per 30 days. */
export const STREAK_RECOVERY_COST = 50;

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
  PREMIUM: colors.badgeEspresso,     // Espresso brown
  ACHIEVEMENT: colors.badgeForestBlue, // Forest Blue
  URGENCY: colors.badgeCoral,        // Coral
};

// ── Badge registry ────────────────────────────────────────────────────────────

export const BADGE_REGISTRY = {
  first_step: {
    label: 'First Step',
    icon: '🥾',
    tier: 'TRAIL_BLAZER',
    description: 'Made your first purchase.',
    earnCondition: 'Complete your first order.',
    // Eastern Bluebird — perched songbird, profile silhouette
    svgLabel: 'Eastern Bluebird',
    svgColor: colors.badgeCoral,
    svgPath:
      'M25 12 C22 11 19 12 18 15 L14 14 C12 13 11 15 13 17 L16 18 ' +
      'C15 21 15 25 17 28 L13 33 L15 35 L19 31 ' +
      'C20 33 22 36 24 37 C26 36 28 33 29 31 L33 35 L35 33 L31 28 ' +
      'C33 25 33 21 32 18 L35 17 C37 15 36 13 34 14 L30 15 ' +
      'C29 12 27 11 25 12Z',
  },
  trail_regular: {
    label: 'Trail Regular',
    icon: '🏕️',
    tier: 'TRAIL_BLAZER',
    description: 'Returned for 3 or more purchases.',
    earnCondition: 'Complete 3 or more orders.',
    // Black Bear — side profile, rounded bear silhouette
    svgLabel: 'Black Bear',
    svgColor: colors.badgeEspresso,
    svgPath:
      'M16 14 C13 12 11 14 12 17 C10 17 9 19 10 21 ' +
      'C8 22 8 25 10 27 L9 32 C9 35 11 37 13 37 L14 40 L16 40 L17 37 ' +
      'L22 38 L24 40 L26 40 L28 38 L33 37 L34 40 L36 40 L37 37 ' +
      'C39 37 41 35 41 32 L40 27 C42 25 42 22 40 21 ' +
      'C41 19 40 17 38 17 C39 14 37 12 34 14 ' +
      'C32 11 29 10 24 10 C20 10 18 11 16 14Z',
  },
  visualizer: {
    label: 'Visualizer',
    icon: '🔭',
    tier: 'TRAIL_BLAZER',
    description: 'Used AR try-on to preview a product.',
    earnCondition: 'Try the AR viewer at least once.',
    // Great Horned Owl — front-facing with distinctive ear tufts
    svgLabel: 'Great Horned Owl',
    svgColor: colors.mountainBlue,
    svgPath:
      'M20 8 L19 11 L16 13 C13 15 12 18 14 20 ' +
      'C11 22 11 26 14 27 C12 30 13 34 16 35 L14 39 L17 39 L19 36 ' +
      'C21 38 24 39 27 39 C30 38 33 37 34 36 L36 39 L39 39 L37 35 ' +
      'C40 34 41 30 39 27 C42 26 42 22 39 20 C41 18 40 15 37 13 L34 11 L28 8 ' +
      'L26 11 C25 10 23 10 22 11 Z',
  },
  curator: {
    label: 'Curator',
    icon: '🎨',
    tier: 'MOUNTAIN_GUIDE',
    description: 'Purchased across 3 or more product lines.',
    earnCondition: 'Buy from 3 different product categories.',
    // Luna Moth — spread wings with elongated hindwing tail streamers
    svgLabel: 'Luna Moth',
    svgColor: colors.badgeForestBlue,
    svgPath:
      'M24 15 C22 13 17 11 13 13 C9 15 8 19 10 22 ' +
      'C7 23 6 27 9 29 C7 32 9 36 12 37 L11 40 L13 41 L15 38 ' +
      'C18 40 21 41 24 41 C27 41 30 40 33 38 L35 41 L37 40 L36 37 ' +
      'C39 36 41 32 39 29 C42 27 41 23 38 22 ' +
      'C40 19 39 15 35 13 C31 11 26 13 24 15Z ' +
      'M20 40 C19 43 17 45 16 47 L18 47 L22 42 Z ' +
      'M28 40 C29 43 31 45 32 47 L30 47 L26 42 Z',
  },
  week_wanderer: {
    label: 'Week Wanderer',
    icon: '🗺️',
    tier: 'TRAIL_BLAZER',
    description: 'Active in the rewards program 7 days in a row.',
    earnCondition: 'Earn points or spin the wheel for 7 consecutive days.',
    // Red-Tailed Hawk — soaring buteo, broad wings and fanned tail
    svgLabel: 'Red-Tailed Hawk',
    svgColor: colors.badgeGold,
    svgPath:
      'M24 10 C22 10 20 12 19 14 L8 11 C6 10 5 13 7 14 L17 18 ' +
      'C15 21 15 26 17 29 L10 35 L12 37 L19 32 ' +
      'C20 35 22 38 24 39 C26 38 28 35 29 32 L36 37 L38 35 L31 29 ' +
      'C33 26 33 21 31 18 L41 14 C43 13 42 10 40 11 L29 14 ' +
      'C28 12 26 10 24 10Z',
  },
  voice_of_mountain: {
    label: 'Voice of the Mountain',
    icon: '🏔️',
    tier: 'MOUNTAIN_GUIDE',
    description: 'Submitted 3 or more product reviews.',
    earnCondition: 'Write 3 reviews.',
    // Keeps emoji icon — no SVG replacement for this badge
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

// ── GAMIFICATION_TIER_ORDER — avatar tier display order (ascending) ───────────

export const GAMIFICATION_TIER_ORDER = [
  'Trail Blazer',
  'Blue Ridge Explorer',
  'Summit Seeker',
  'Peak Performer',
  'Blue Ridge Legend',
];

// ── isBonusPointsDayAvailable ─────────────────────────────────────────────────

/**
 * Returns true if the bonus points day feature is available for use.
 * A bonus points day resets after a 7-day rolling window (strictly > 6 days ago).
 *
 * @param {string|null|undefined} bonusPointsDayUsed  ISO date string 'YYYY-MM-DD' or falsy
 * @param {string} todayET  Current date in ET as 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isBonusPointsDayAvailable(bonusPointsDayUsed, todayET) {
  if (!bonusPointsDayUsed) return true;
  const [y, m, d] = bonusPointsDayUsed.split('-').map(Number);
  const usedMs = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayET.split('-').map(Number);
  const todayMs = Date.UTC(ty, tm - 1, td);
  return Math.floor((todayMs - usedMs) / 86400000) > 6;
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
