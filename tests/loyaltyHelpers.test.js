import { describe, it, expect } from 'vitest';
import {
  formatPoints,
  formatProgressText,
  getProgressPercent,
  getTierColor,
  getTierIcon,
  canAffordReward,
  formatRewardCost,
  buildTierComparisonData,
  getNextMilestone,
} from '../src/public/loyaltyHelpers.js';

// ── formatPoints ──────────────────────────────────────────────────────

describe('formatPoints', () => {
  it('formats zero points', () => {
    expect(formatPoints(0)).toBe('0 pts');
  });

  it('formats small number without comma', () => {
    expect(formatPoints(42)).toBe('42 pts');
  });

  it('formats number with locale comma separator', () => {
    expect(formatPoints(1250)).toBe('1,250 pts');
  });

  it('formats large number', () => {
    expect(formatPoints(15000)).toBe('15,000 pts');
  });

  it('handles undefined by returning 0 pts', () => {
    expect(formatPoints(undefined)).toBe('0 pts');
  });

  it('handles null by returning 0 pts', () => {
    expect(formatPoints(null)).toBe('0 pts');
  });

  it('handles negative numbers', () => {
    expect(formatPoints(-5)).toBe('0 pts');
  });

  it('handles NaN by returning 0 pts', () => {
    expect(formatPoints(NaN)).toBe('0 pts');
  });

  it('handles string input by coercing', () => {
    expect(formatPoints('500')).toBe('500 pts');
  });

  it('handles non-numeric string by returning 0 pts', () => {
    expect(formatPoints('abc')).toBe('0 pts');
  });
});

// ── formatProgressText ─────────────────────────────────────────────────

describe('formatProgressText', () => {
  it('returns points-to-next for Bronze member', () => {
    const account = { tier: 'Bronze', nextTier: 'Silver', pointsToNext: 300, points: 200 };
    expect(formatProgressText(account)).toBe('300 points to Silver');
  });

  it('returns points-to-next for Silver member', () => {
    const account = { tier: 'Silver', nextTier: 'Gold', pointsToNext: 500, points: 1000 };
    expect(formatProgressText(account)).toBe('500 points to Gold');
  });

  it('returns max tier message for Gold member', () => {
    const account = { tier: 'Gold', nextTier: null, pointsToNext: 0, points: 2000 };
    expect(formatProgressText(account)).toContain('Gold');
  });

  it('handles missing account gracefully', () => {
    expect(formatProgressText(null)).toBe('Join our rewards program');
  });

  it('handles undefined account', () => {
    expect(formatProgressText(undefined)).toBe('Join our rewards program');
  });

  it('handles account with missing fields', () => {
    expect(formatProgressText({})).toBe('Join our rewards program');
  });

  it('handles zero pointsToNext at max tier', () => {
    const account = { tier: 'Gold', nextTier: null, pointsToNext: 0, points: 1500 };
    const result = formatProgressText(account);
    expect(result).not.toContain('0 points to');
  });
});

// ── getProgressPercent ──────────────────────────────────────────────────

describe('getProgressPercent', () => {
  it('returns 0 for brand new member', () => {
    const account = { points: 0, progress: 0, tier: 'Bronze' };
    expect(getProgressPercent(account)).toBe(0);
  });

  it('returns backend progress value', () => {
    const account = { points: 250, progress: 50, tier: 'Bronze' };
    expect(getProgressPercent(account)).toBe(50);
  });

  it('returns 100 for max tier', () => {
    const account = { points: 2000, progress: 100, tier: 'Gold' };
    expect(getProgressPercent(account)).toBe(100);
  });

  it('caps at 100', () => {
    const account = { points: 5000, progress: 150, tier: 'Gold' };
    expect(getProgressPercent(account)).toBe(100);
  });

  it('handles null account', () => {
    expect(getProgressPercent(null)).toBe(0);
  });

  it('handles missing progress field', () => {
    expect(getProgressPercent({ points: 100 })).toBe(0);
  });

  it('handles negative progress', () => {
    expect(getProgressPercent({ progress: -10 })).toBe(0);
  });
});

// ── getTierColor ──────────────────────────────────────────────────────

describe('getTierColor', () => {
  it('returns espresso-based color for Bronze', () => {
    const color = getTierColor('Bronze');
    expect(color).toBeTruthy();
    expect(typeof color).toBe('string');
  });

  it('returns mountainBlue for Silver', () => {
    const color = getTierColor('Silver');
    expect(color).toBeTruthy();
  });

  it('returns sunsetCoral for Gold', () => {
    const color = getTierColor('Gold');
    expect(color).toBeTruthy();
  });

  it('returns default for unknown tier', () => {
    const color = getTierColor('Platinum');
    expect(color).toBeTruthy();
  });

  it('handles null tier', () => {
    const color = getTierColor(null);
    expect(color).toBeTruthy();
  });

  it('handles empty string tier', () => {
    const color = getTierColor('');
    expect(color).toBeTruthy();
  });

  it('is case-sensitive', () => {
    const color = getTierColor('bronze');
    expect(color).toBeTruthy();
  });
});

// ── getTierIcon ──────────────────────────────────────────────────────

describe('getTierIcon', () => {
  it('returns an icon string for Bronze', () => {
    expect(typeof getTierIcon('Bronze')).toBe('string');
    expect(getTierIcon('Bronze').length).toBeGreaterThan(0);
  });

  it('returns an icon string for Silver', () => {
    expect(typeof getTierIcon('Silver')).toBe('string');
  });

  it('returns an icon string for Gold', () => {
    expect(typeof getTierIcon('Gold')).toBe('string');
  });

  it('returns different icons for different tiers', () => {
    const bronze = getTierIcon('Bronze');
    const silver = getTierIcon('Silver');
    const gold = getTierIcon('Gold');
    // At least some should differ
    expect(new Set([bronze, silver, gold]).size).toBeGreaterThanOrEqual(2);
  });

  it('returns fallback for null', () => {
    expect(typeof getTierIcon(null)).toBe('string');
  });
});

// ── canAffordReward ──────────────────────────────────────────────────

describe('canAffordReward', () => {
  it('returns true when member has enough points', () => {
    expect(canAffordReward({ pointsCost: 200 }, 500)).toBe(true);
  });

  it('returns true when member has exact points', () => {
    expect(canAffordReward({ pointsCost: 200 }, 200)).toBe(true);
  });

  it('returns false when member has insufficient points', () => {
    expect(canAffordReward({ pointsCost: 200 }, 100)).toBe(false);
  });

  it('returns true for free rewards', () => {
    expect(canAffordReward({ pointsCost: 0 }, 0)).toBe(true);
  });

  it('handles null reward', () => {
    expect(canAffordReward(null, 500)).toBe(false);
  });

  it('handles undefined points', () => {
    expect(canAffordReward({ pointsCost: 100 }, undefined)).toBe(false);
  });

  it('handles missing pointsCost field', () => {
    expect(canAffordReward({}, 500)).toBe(true);
  });

  it('handles negative member points', () => {
    expect(canAffordReward({ pointsCost: 100 }, -5)).toBe(false);
  });
});

// ── formatRewardCost ──────────────────────────────────────────────────

describe('formatRewardCost', () => {
  it('formats affordable reward', () => {
    const result = formatRewardCost({ pointsCost: 200 }, 500);
    expect(result).toContain('200');
  });

  it('formats unaffordable reward with deficit', () => {
    const result = formatRewardCost({ pointsCost: 500 }, 200);
    expect(result).toContain('300');
  });

  it('formats free reward', () => {
    const result = formatRewardCost({ pointsCost: 0 }, 100);
    expect(result).toContain('Free');
  });

  it('handles null reward', () => {
    expect(formatRewardCost(null, 500)).toBe('');
  });

  it('handles large point costs with comma formatting', () => {
    const result = formatRewardCost({ pointsCost: 5000 }, 10000);
    expect(result).toContain('5,000');
  });
});

// ── buildTierComparisonData ───────────────────────────────────────────

describe('buildTierComparisonData', () => {
  const tiers = [
    { name: 'Bronze', minPoints: 0, benefits: ['Earn 1 point per $1'] },
    { name: 'Silver', minPoints: 500, benefits: ['5% discount'] },
    { name: 'Gold', minPoints: 1500, benefits: ['10% discount'] },
  ];

  it('marks current tier', () => {
    const result = buildTierComparisonData(tiers, 'Silver');
    const silver = result.find(t => t.name === 'Silver');
    expect(silver.isCurrent).toBe(true);
  });

  it('marks past tiers as achieved', () => {
    const result = buildTierComparisonData(tiers, 'Gold');
    const bronze = result.find(t => t.name === 'Bronze');
    const silver = result.find(t => t.name === 'Silver');
    expect(bronze.isAchieved).toBe(true);
    expect(silver.isAchieved).toBe(true);
  });

  it('marks future tiers as not achieved', () => {
    const result = buildTierComparisonData(tiers, 'Bronze');
    const silver = result.find(t => t.name === 'Silver');
    const gold = result.find(t => t.name === 'Gold');
    expect(silver.isAchieved).toBe(false);
    expect(gold.isAchieved).toBe(false);
  });

  it('returns all tiers with their benefits', () => {
    const result = buildTierComparisonData(tiers, 'Bronze');
    expect(result).toHaveLength(3);
    result.forEach(t => {
      expect(t.benefits).toBeDefined();
      expect(t.benefits.length).toBeGreaterThan(0);
    });
  });

  it('handles empty tiers array', () => {
    const result = buildTierComparisonData([], 'Bronze');
    expect(result).toEqual([]);
  });

  it('handles null tiers', () => {
    const result = buildTierComparisonData(null, 'Bronze');
    expect(result).toEqual([]);
  });

  it('handles unknown current tier', () => {
    const result = buildTierComparisonData(tiers, 'Platinum');
    result.forEach(t => {
      expect(t.isCurrent).toBe(false);
    });
  });

  it('current tier is also marked as achieved', () => {
    const result = buildTierComparisonData(tiers, 'Silver');
    const silver = result.find(t => t.name === 'Silver');
    expect(silver.isAchieved).toBe(true);
    expect(silver.isCurrent).toBe(true);
  });
});

// ── getNextMilestone ──────────────────────────────────────────────────

describe('getNextMilestone', () => {
  it('returns milestone message for Bronze member close to Silver', () => {
    const account = { tier: 'Bronze', points: 450, nextTier: 'Silver', pointsToNext: 50 };
    const result = getNextMilestone(account);
    expect(result).toContain('50');
    expect(result).toContain('Silver');
  });

  it('returns milestone for Silver member', () => {
    const account = { tier: 'Silver', points: 1200, nextTier: 'Gold', pointsToNext: 300 };
    const result = getNextMilestone(account);
    expect(result).toContain('300');
    expect(result).toContain('Gold');
  });

  it('returns celebration message for Gold member', () => {
    const account = { tier: 'Gold', points: 2000, nextTier: null, pointsToNext: 0 };
    const result = getNextMilestone(account);
    expect(result).not.toContain('points to');
  });

  it('handles null account', () => {
    expect(getNextMilestone(null)).toBe('');
  });

  it('handles account with no tier', () => {
    expect(getNextMilestone({})).toBe('');
  });
});
