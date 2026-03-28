import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildStreakChipText,
  buildMultiplierBadgeText,
  buildToastText,
  shouldShowStreakChip,
  updateStreakDisplay,
} from '../src/public/StreakDisplay.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return { html: '', text: '', show: vi.fn(), hide: vi.fn(), ...overrides };
}

function makeElements(overrides = {}) {
  return {
    $chip: makeEl(),
    $badge: makeEl(),
    $toast: makeEl(),
    ...overrides,
  };
}

describe('buildStreakChipText', () => {
  it('returns an HTML string containing an SVG hawk icon for 1 day', () => {
    const result = buildStreakChipText(1);
    expect(result).toContain('<svg');
    expect(result).toContain('Sharp-shinned Hawk');
  });

  it('returns "1-day streak" label for 1 day', () => {
    expect(buildStreakChipText(1)).toContain('1-day streak');
  });

  it('returns "7-day streak" label for 7 days', () => {
    expect(buildStreakChipText(7)).toContain('7-day streak');
  });

  it('uses "days" (plural) for counts 2-6', () => {
    expect(buildStreakChipText(3)).toContain('days');
  });

  it('does not contain the old fire emoji', () => {
    expect(buildStreakChipText(1)).not.toContain('🔥');
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

// ── updateStreakDisplay ───────────────────────────────────────────────────────

describe('updateStreakDisplay', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows chip and sets html when streak >= 1', () => {
    const els = makeElements();
    updateStreakDisplay(els, { currentStreakDays: 3, streakMultiplier: 1, milestoneUnlocked: false });
    expect(els.$chip.show).toHaveBeenCalled();
    expect(els.$chip.html).toContain('3');
  });

  it('hides chip when streak = 0', () => {
    const els = makeElements();
    updateStreakDisplay(els, { currentStreakDays: 0, streakMultiplier: 1, milestoneUnlocked: false });
    expect(els.$chip.hide).toHaveBeenCalled();
    expect(els.$chip.show).not.toHaveBeenCalled();
  });

  it('shows badge when multiplier > 1', () => {
    const els = makeElements();
    updateStreakDisplay(els, { currentStreakDays: 3, streakMultiplier: 1.5, milestoneUnlocked: false });
    expect(els.$badge.show).toHaveBeenCalled();
    expect(els.$badge.text).toBe('1.5× points');
  });

  it('hides badge when multiplier = 1 (no bonus)', () => {
    const els = makeElements();
    updateStreakDisplay(els, { currentStreakDays: 3, streakMultiplier: 1, milestoneUnlocked: false });
    expect(els.$badge.hide).toHaveBeenCalled();
    expect(els.$badge.show).not.toHaveBeenCalled();
  });

  it('shows toast and hides after 3s when milestoneUnlocked = false', () => {
    const els = makeElements();
    updateStreakDisplay(els, { currentStreakDays: 5, streakMultiplier: 1.5, milestoneUnlocked: false });
    expect(els.$toast.show).toHaveBeenCalled();
    expect(els.$toast.hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(els.$toast.hide).toHaveBeenCalled();
  });

  it('hides toast after 5s when milestoneUnlocked = true', () => {
    const els = makeElements();
    updateStreakDisplay(els, { currentStreakDays: 7, streakMultiplier: 2, milestoneUnlocked: true });
    vi.advanceTimersByTime(4999);
    expect(els.$toast.hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(els.$toast.hide).toHaveBeenCalled();
  });

  it('skips toast when reducedMotion = true', () => {
    const els = makeElements();
    updateStreakDisplay(els, { currentStreakDays: 3, streakMultiplier: 1, milestoneUnlocked: false }, true);
    expect(els.$toast.show).not.toHaveBeenCalled();
  });

  it('skips toast when $toast is null', () => {
    const els = makeElements({ $toast: null });
    updateStreakDisplay(els, { currentStreakDays: 3, streakMultiplier: 1, milestoneUnlocked: false });
    // no throw, no toast ops
  });
});
