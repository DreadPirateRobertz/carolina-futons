/**
 * @file streakTrackerWidget.test.js
 * @description Tests for CF-4xnp: StreakTrackerWidget — display current streak on member dashboard.
 *
 * Covers:
 *  - streak count text set ("N day streak")
 *  - longest streak text set ("Best: N days")
 *  - flame shown when streak >= 3, hidden when < 3
 *  - multiplier "2x" for streak 3-6, "3x" for streak 7+, hidden for < 3
 *  - error shows #noStreakMsg and hides streak elements
 *  - does not throw on reject
 *
 * CF-4xnp
 */
import { describe, it, expect, vi } from 'vitest';
import { initStreakTrackerWidget } from '../src/public/StreakTrackerWidget.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    _classes: [],
    show:     vi.fn(function () { this._visible = true; }),
    hide:     vi.fn(function () { this._visible = false; }),
    addClass: vi.fn(function (cls) { this._classes.push(cls); }),
  };
}

function make$w() {
  const els = {
    '#streakCount':           makeEl(),
    '#longestStreak':         makeEl(),
    '#streakFlameIcon':       makeEl(),
    '#streakMultiplierLabel': makeEl(),
    '#noStreakMsg':           makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

function makeOpts($w, streakData) {
  return {
    $w,
    getStreakData: vi.fn().mockResolvedValue(streakData),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-test';

function makeStreakData(overrides = {}) {
  return {
    currentStreak: 5,
    longestStreak: 10,
    lastActivityDate: '2026-03-23',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('streak count text', () => {
  it('sets #streakCount text to "N day streak"', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 5 })));
    expect($w._els['#streakCount'].text).toBe('5 day streak');
  });

  it('sets #streakCount to "0 day streak" when streak is 0', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 0 })));
    expect($w._els['#streakCount'].text).toBe('0 day streak');
  });
});

describe('longest streak text', () => {
  it('sets #longestStreak text to "Best: N days"', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ longestStreak: 10 })));
    expect($w._els['#longestStreak'].text).toBe('Best: 10 days');
  });

  it('sets #longestStreak to "Best: 0 days" when longestStreak is 0', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ longestStreak: 0 })));
    expect($w._els['#longestStreak'].text).toBe('Best: 0 days');
  });
});

describe('flame icon visibility', () => {
  it('shows #streakFlameIcon when streak >= 3', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 3 })));
    expect($w._els['#streakFlameIcon'].show).toHaveBeenCalled();
  });

  it('adds "streak-active" class when streak >= 3', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 5 })));
    expect($w._els['#streakFlameIcon'].addClass).toHaveBeenCalledWith('streak-active');
  });

  it('hides #streakFlameIcon when streak < 3', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 2 })));
    expect($w._els['#streakFlameIcon'].hide).toHaveBeenCalled();
  });

  it('hides #streakFlameIcon when streak is 0', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 0 })));
    expect($w._els['#streakFlameIcon'].hide).toHaveBeenCalled();
  });
});

describe('multiplier label', () => {
  it('shows "2x" when streak is 3', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 3 })));
    expect($w._els['#streakMultiplierLabel'].text).toBe('2x');
    expect($w._els['#streakMultiplierLabel'].show).toHaveBeenCalled();
  });

  it('shows "2x" when streak is 6', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 6 })));
    expect($w._els['#streakMultiplierLabel'].text).toBe('2x');
    expect($w._els['#streakMultiplierLabel'].show).toHaveBeenCalled();
  });

  it('shows "3x" when streak is 7', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 7 })));
    expect($w._els['#streakMultiplierLabel'].text).toBe('3x');
    expect($w._els['#streakMultiplierLabel'].show).toHaveBeenCalled();
  });

  it('shows "3x" when streak is 15', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 15 })));
    expect($w._els['#streakMultiplierLabel'].text).toBe('3x');
    expect($w._els['#streakMultiplierLabel'].show).toHaveBeenCalled();
  });

  it('hides multiplier label when streak < 3', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 2 })));
    expect($w._els['#streakMultiplierLabel'].hide).toHaveBeenCalled();
  });

  it('hides multiplier label when streak is 0', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, makeStreakData({ currentStreak: 0 })));
    expect($w._els['#streakMultiplierLabel'].hide).toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('shows #noStreakMsg when getStreakData returns null', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#noStreakMsg'].show).toHaveBeenCalled();
  });

  it('hides streak elements when getStreakData returns null', async () => {
    const $w = make$w();
    await initStreakTrackerWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#streakCount'].hide).toHaveBeenCalled();
    expect($w._els['#longestStreak'].hide).toHaveBeenCalled();
    expect($w._els['#streakFlameIcon'].hide).toHaveBeenCalled();
    expect($w._els['#streakMultiplierLabel'].hide).toHaveBeenCalled();
  });

  it('shows #noStreakMsg when getStreakData rejects', async () => {
    const $w = make$w();
    const opts = { $w, getStreakData: vi.fn().mockRejectedValue(new Error('API down')) };
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w._els['#noStreakMsg'].show).toHaveBeenCalled();
  });

  it('hides streak elements when getStreakData rejects', async () => {
    const $w = make$w();
    const opts = { $w, getStreakData: vi.fn().mockRejectedValue(new Error('API down')) };
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w._els['#streakCount'].hide).toHaveBeenCalled();
    expect($w._els['#longestStreak'].hide).toHaveBeenCalled();
    expect($w._els['#streakFlameIcon'].hide).toHaveBeenCalled();
    expect($w._els['#streakMultiplierLabel'].hide).toHaveBeenCalled();
  });

  it('does not throw when getStreakData rejects', async () => {
    const $w = make$w();
    const opts = { $w, getStreakData: vi.fn().mockRejectedValue(new Error('API down')) };
    await expect(initStreakTrackerWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});
