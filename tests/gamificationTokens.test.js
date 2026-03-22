/**
 * Tests for src/public/gamification-tokens.js
 *
 * Covers: TIER_THRESHOLDS, POINT_VALUES, BADGE_COLORS, BADGE_REGISTRY,
 * TIER_NAMES, getTierForPoints, getBadgesForAccount.
 *
 * Pure functions only — no Wix mocks needed.
 * TDD: written before implementation (CF-8f5o).
 */
import { describe, it, expect } from 'vitest';
import {
  TIER_THRESHOLDS,
  POINT_VALUES,
  BADGE_COLORS,
  BADGE_REGISTRY,
  TIER_NAMES,
  getTierForPoints,
  getBadgesForAccount,
} from '../src/public/gamificationTokens.js';

// ── TIER_THRESHOLDS ───────────────────────────────────────────────────────────

describe('TIER_THRESHOLDS', () => {
  it('exports all 4 tier thresholds', () => {
    expect(TIER_THRESHOLDS).toHaveProperty('TRAIL_BLAZER');
    expect(TIER_THRESHOLDS).toHaveProperty('MOUNTAIN_GUIDE');
    expect(TIER_THRESHOLDS).toHaveProperty('SUMMIT_MASTER');
    expect(TIER_THRESHOLDS).toHaveProperty('BLUE_RIDGE_LEGEND');
  });

  it('TRAIL_BLAZER starts at 0', () => {
    expect(TIER_THRESHOLDS.TRAIL_BLAZER).toBe(0);
  });

  it('MOUNTAIN_GUIDE starts at 500', () => {
    expect(TIER_THRESHOLDS.MOUNTAIN_GUIDE).toBe(500);
  });

  it('SUMMIT_MASTER starts at 2000', () => {
    expect(TIER_THRESHOLDS.SUMMIT_MASTER).toBe(2000);
  });

  it('BLUE_RIDGE_LEGEND starts at 5000', () => {
    expect(TIER_THRESHOLDS.BLUE_RIDGE_LEGEND).toBe(5000);
  });

  it('tiers are in ascending order', () => {
    const values = Object.values(TIER_THRESHOLDS);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

// ── POINT_VALUES ──────────────────────────────────────────────────────────────

describe('POINT_VALUES', () => {
  it('PURCHASE_PER_DOLLAR is 1', () => {
    expect(POINT_VALUES.PURCHASE_PER_DOLLAR).toBe(1);
  });

  it('REVIEW is 50', () => {
    expect(POINT_VALUES.REVIEW).toBe(50);
  });

  it('PHOTO_REVIEW_BONUS is 25', () => {
    expect(POINT_VALUES.PHOTO_REVIEW_BONUS).toBe(25);
  });

  it('REVIEW_ACCURACY_BONUS is 10', () => {
    expect(POINT_VALUES.REVIEW_ACCURACY_BONUS).toBe(10);
  });

  it('REFERRAL_ACCEPTED is 200', () => {
    expect(POINT_VALUES.REFERRAL_ACCEPTED).toBe(200);
  });

  it('AR_TRY_ON is 25', () => {
    expect(POINT_VALUES.AR_TRY_ON).toBe(25);
  });

  it('STREAK_7_DAY is 100', () => {
    expect(POINT_VALUES.STREAK_7_DAY).toBe(100);
  });

  it('all point values are positive integers', () => {
    for (const [key, value] of Object.entries(POINT_VALUES)) {
      expect(Number.isInteger(value) && value > 0, `${key} must be positive integer`).toBe(true);
    }
  });
});

// ── BADGE_COLORS ──────────────────────────────────────────────────────────────

describe('BADGE_COLORS', () => {
  it('PREMIUM is Espresso (#3D1C02)', () => {
    expect(BADGE_COLORS.PREMIUM).toBe('#3D1C02');
  });

  it('ACHIEVEMENT is Mountain Blue (#2B5FA5)', () => {
    expect(BADGE_COLORS.ACHIEVEMENT).toBe('#2B5FA5');
  });

  it('URGENCY is Coral (#E8634B)', () => {
    expect(BADGE_COLORS.URGENCY).toBe('#E8634B');
  });

  it('all badge colors are valid hex strings', () => {
    for (const [key, value] of Object.entries(BADGE_COLORS)) {
      expect(value, `${key} must be a hex color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ── BADGE_REGISTRY ────────────────────────────────────────────────────────────

describe('BADGE_REGISTRY', () => {
  const REQUIRED_BADGES = [
    'first_step',
    'trail_regular',
    'visualizer',
    'curator',
    'week_wanderer',
    'voice_of_mountain',
  ];

  it('contains all 6 required badge IDs', () => {
    for (const id of REQUIRED_BADGES) {
      expect(BADGE_REGISTRY, `missing badge: ${id}`).toHaveProperty(id);
    }
  });

  it('each badge has required fields: label, icon, tier, description, earnCondition', () => {
    for (const [id, badge] of Object.entries(BADGE_REGISTRY)) {
      expect(badge, `${id} missing label`).toHaveProperty('label');
      expect(badge, `${id} missing icon`).toHaveProperty('icon');
      expect(badge, `${id} missing tier`).toHaveProperty('tier');
      expect(badge, `${id} missing description`).toHaveProperty('description');
      expect(badge, `${id} missing earnCondition`).toHaveProperty('earnCondition');
    }
  });

  it('first_step has boot emoji icon', () => {
    expect(BADGE_REGISTRY.first_step.icon).toBe('🥾');
  });

  it('trail_regular has campsite emoji icon', () => {
    expect(BADGE_REGISTRY.trail_regular.icon).toBe('🏕️');
  });

  it('visualizer has telescope emoji icon', () => {
    expect(BADGE_REGISTRY.visualizer.icon).toBe('🔭');
  });

  it('curator has artist palette emoji icon', () => {
    expect(BADGE_REGISTRY.curator.icon).toBe('🎨');
  });

  it('each badge tier references a valid TIER_THRESHOLDS key', () => {
    const validTiers = Object.keys(TIER_THRESHOLDS);
    for (const [id, badge] of Object.entries(BADGE_REGISTRY)) {
      expect(validTiers, `${id}.tier '${badge.tier}' is not a valid tier`).toContain(badge.tier);
    }
  });
});

// ── TIER_NAMES ────────────────────────────────────────────────────────────────

describe('TIER_NAMES', () => {
  it('is an array', () => {
    expect(Array.isArray(TIER_NAMES)).toBe(true);
  });

  it('has 4 entries (one per tier)', () => {
    expect(TIER_NAMES).toHaveLength(4);
  });

  it('each entry has threshold and name properties', () => {
    for (const entry of TIER_NAMES) {
      expect(entry).toHaveProperty('threshold');
      expect(entry).toHaveProperty('name');
    }
  });

  it('entries are sorted ascending by threshold', () => {
    for (let i = 1; i < TIER_NAMES.length; i++) {
      expect(TIER_NAMES[i].threshold).toBeGreaterThan(TIER_NAMES[i - 1].threshold);
    }
  });

  it('includes "Trail Blazer" as the first tier name', () => {
    expect(TIER_NAMES[0].name).toBe('Trail Blazer');
  });

  it('includes "Blue Ridge Legend" as the highest tier name', () => {
    expect(TIER_NAMES[TIER_NAMES.length - 1].name).toBe('Blue Ridge Legend');
  });

  it('thresholds match corresponding TIER_THRESHOLDS values', () => {
    expect(TIER_NAMES[0].threshold).toBe(TIER_THRESHOLDS.TRAIL_BLAZER);
    expect(TIER_NAMES[1].threshold).toBe(TIER_THRESHOLDS.MOUNTAIN_GUIDE);
    expect(TIER_NAMES[2].threshold).toBe(TIER_THRESHOLDS.SUMMIT_MASTER);
    expect(TIER_NAMES[3].threshold).toBe(TIER_THRESHOLDS.BLUE_RIDGE_LEGEND);
  });
});

// ── getTierForPoints ──────────────────────────────────────────────────────────

describe('getTierForPoints', () => {
  it('returns Trail Blazer for 0 points', () => {
    expect(getTierForPoints(0)).toBe('Trail Blazer');
  });

  it('returns Trail Blazer for 499 points', () => {
    expect(getTierForPoints(499)).toBe('Trail Blazer');
  });

  it('returns Mountain Guide at 500 points', () => {
    expect(getTierForPoints(500)).toBe('Mountain Guide');
  });

  it('returns Mountain Guide for 1999 points', () => {
    expect(getTierForPoints(1999)).toBe('Mountain Guide');
  });

  it('returns Summit Master at 2000 points', () => {
    expect(getTierForPoints(2000)).toBe('Summit Master');
  });

  it('returns Summit Master for 4999 points', () => {
    expect(getTierForPoints(4999)).toBe('Summit Master');
  });

  it('returns Blue Ridge Legend at 5000 points', () => {
    expect(getTierForPoints(5000)).toBe('Blue Ridge Legend');
  });

  it('returns Blue Ridge Legend for very large point totals', () => {
    expect(getTierForPoints(100000)).toBe('Blue Ridge Legend');
  });

  it('returns Trail Blazer for negative points (floor at 0)', () => {
    expect(getTierForPoints(-50)).toBe('Trail Blazer');
  });

  it('returns Trail Blazer for NaN input', () => {
    expect(getTierForPoints(NaN)).toBe('Trail Blazer');
  });

  it('returns Trail Blazer for null input', () => {
    // Number(null) === 0: null routes through the normal loop, not the guard
    expect(getTierForPoints(null)).toBe('Trail Blazer');
  });

  it('returns Trail Blazer for undefined input', () => {
    // Number(undefined) === NaN: caught by the isFinite guard
    expect(getTierForPoints(undefined)).toBe('Trail Blazer');
  });

  it('returns Mountain Guide for string "500" (numeric coercion)', () => {
    expect(getTierForPoints('500')).toBe('Mountain Guide');
  });

  it('returns Trail Blazer for 499.9 points', () => {
    expect(getTierForPoints(499.9)).toBe('Trail Blazer');
  });

  it('returns Mountain Guide for 500.1 points', () => {
    expect(getTierForPoints(500.1)).toBe('Mountain Guide');
  });
});

// ── getBadgesForAccount ───────────────────────────────────────────────────────

describe('getBadgesForAccount', () => {
  it('returns first_step badge after first purchase', () => {
    const history = { purchaseCount: 1, productLines: ['futons'], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).toContain('first_step');
  });

  it('does not return first_step with zero purchases', () => {
    const history = { purchaseCount: 0, productLines: [], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).not.toContain('first_step');
  });

  it('returns trail_regular after 3+ purchases', () => {
    const history = { purchaseCount: 3, productLines: ['futons'], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).toContain('trail_regular');
  });

  it('does not return trail_regular for 2 purchases', () => {
    const history = { purchaseCount: 2, productLines: ['futons'], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).not.toContain('trail_regular');
  });

  it('returns visualizer when AR try-on has been used', () => {
    const history = { purchaseCount: 1, productLines: ['futons'], arTryOnUsed: true, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).toContain('visualizer');
  });

  it('does not return visualizer when AR try-on not used', () => {
    const history = { purchaseCount: 1, productLines: ['futons'], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).not.toContain('visualizer');
  });

  it('returns curator for 3+ different product lines', () => {
    const history = { purchaseCount: 3, productLines: ['futons', 'covers', 'mattresses'], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).toContain('curator');
  });

  it('does not return curator for 2 product lines', () => {
    const history = { purchaseCount: 2, productLines: ['futons', 'covers'], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).not.toContain('curator');
  });

  it('does not return curator for 3 duplicate product lines', () => {
    const history = { purchaseCount: 3, productLines: ['futons', 'futons', 'futons'], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).not.toContain('curator');
  });

  it('does not return curator for 2 unique + 1 duplicate product line', () => {
    const history = { purchaseCount: 3, productLines: ['futons', 'covers', 'futons'], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).not.toContain('curator');
  });

  it('does not return curator when productLines is a non-array', () => {
    const history = { purchaseCount: 3, productLines: 'futons,covers,mattresses', arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).not.toContain('curator');
  });

  it('returns week_wanderer for 7+ day login streak', () => {
    const history = { purchaseCount: 0, productLines: [], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 7 };
    expect(getBadgesForAccount(history)).toContain('week_wanderer');
  });

  it('does not return week_wanderer for 6 day streak', () => {
    const history = { purchaseCount: 0, productLines: [], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 6 };
    expect(getBadgesForAccount(history)).not.toContain('week_wanderer');
  });

  it('returns voice_of_mountain for 3+ reviews', () => {
    const history = { purchaseCount: 3, productLines: ['futons'], arTryOnUsed: false, reviewCount: 3, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).toContain('voice_of_mountain');
  });

  it('does not return voice_of_mountain for 2 reviews', () => {
    const history = { purchaseCount: 2, productLines: ['futons'], arTryOnUsed: false, reviewCount: 2, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).not.toContain('voice_of_mountain');
  });

  it('returns multiple badges when multiple conditions are met', () => {
    const history = { purchaseCount: 5, productLines: ['futons', 'covers', 'mattresses'], arTryOnUsed: true, reviewCount: 3, loginStreakDays: 7 };
    const badges = getBadgesForAccount(history);
    expect(badges).toContain('first_step');
    expect(badges).toContain('trail_regular');
    expect(badges).toContain('visualizer');
    expect(badges).toContain('curator');
    expect(badges).toContain('week_wanderer');
    expect(badges).toContain('voice_of_mountain');
  });

  it('returns empty array for a brand new account with no activity', () => {
    const history = { purchaseCount: 0, productLines: [], arTryOnUsed: false, reviewCount: 0, loginStreakDays: 0 };
    expect(getBadgesForAccount(history)).toEqual([]);
  });

  it('returns an array (never throws on empty history object)', () => {
    expect(() => getBadgesForAccount({})).not.toThrow();
    expect(Array.isArray(getBadgesForAccount({}))).toBe(true);
  });
});
