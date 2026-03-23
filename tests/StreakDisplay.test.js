import { describe, it, expect } from 'vitest';
import {
  buildStreakChipText,
  buildMultiplierBadgeText,
  buildToastText,
  shouldShowStreakChip,
} from '../src/public/StreakDisplay.js';

describe('buildStreakChipText', () => {
  it('returns "🔥 1-day streak" for 1 day', () => {
    expect(buildStreakChipText(1)).toBe('🔥 1-day streak');
  });

  it('returns "🔥 7-day streak" for 7 days', () => {
    expect(buildStreakChipText(7)).toBe('🔥 7-day streak');
  });

  it('uses "days" (plural) for counts > 1', () => {
    expect(buildStreakChipText(3)).toContain('days');
  });
});

describe('buildMultiplierBadgeText', () => {
  it('returns empty string for 1x (no bonus)', () => {
    expect(buildMultiplierBadgeText(1)).toBe('');
  });

  it('returns "1.5× points" for 1.5 multiplier', () => {
    expect(buildMultiplierBadgeText(1.5)).toBe('1.5× points');
  });

  it('returns "2× points" for 2 multiplier', () => {
    expect(buildMultiplierBadgeText(2)).toBe('2× points');
  });
});

describe('buildToastText', () => {
  it('returns milestone text when milestoneUnlocked is true', () => {
    const text = buildToastText({ streakDays: 7, multiplier: 2, milestoneUnlocked: true });
    expect(text).toContain('7-day streak');
    expect(text).toContain('+100');
    expect(text).toContain('Week Wanderer');
  });

  it('returns standard increment text when milestoneUnlocked is false', () => {
    const text = buildToastText({ streakDays: 4, multiplier: 1.5, milestoneUnlocked: false });
    expect(text).toContain('4');
    expect(text).toContain('1.5×');
  });
});

describe('shouldShowStreakChip', () => {
  it('returns true for streakDays >= 1', () => {
    expect(shouldShowStreakChip(1)).toBe(true);
    expect(shouldShowStreakChip(7)).toBe(true);
  });

  it('returns false for streakDays = 0', () => {
    expect(shouldShowStreakChip(0)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(shouldShowStreakChip(null)).toBe(false);
    expect(shouldShowStreakChip(undefined)).toBe(false);
  });
});
