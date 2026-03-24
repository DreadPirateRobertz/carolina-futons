/**
 * streakTrackerWidget.test.js
 * CF-4xnp — StreakTrackerWidget: current streak and multiplier display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initStreakTrackerWidget } from '../src/public/StreakTrackerWidget.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _class: '',
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    addClass: vi.fn(function (cls) { this._class = cls; }),
    removeClass: vi.fn(),
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
  return (id) => els[id] ?? makeEl();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-streak-1';

function makeStreak(currentStreak, longestStreak = currentStreak, lastActivityDate = '2026-03-24') {
  return { currentStreak, longestStreak, lastActivityDate };
}

function makeOpts($w, streakData) {
  return {
    $w,
    getStreakData: vi.fn().mockResolvedValue(streakData),
  };
}

// ── Text rendering ────────────────────────────────────────────────────────────

describe('initStreakTrackerWidget — text rendering', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('sets #streakCount text to "N day streak"', async () => {
    const opts = makeOpts($w, makeStreak(5));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakCount').text).toBe('5 day streak');
  });

  it('sets #streakCount to "1 day streak" for single day', async () => {
    const opts = makeOpts($w, makeStreak(1));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakCount').text).toBe('1 day streak');
  });

  it('sets #longestStreak text to "Best: N days"', async () => {
    const opts = makeOpts($w, makeStreak(5, 12));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#longestStreak').text).toBe('Best: 12 days');
  });

  it('passes memberId to getStreakData', async () => {
    const opts = makeOpts($w, makeStreak(3));
    await initStreakTrackerWidget('specific-member', opts);
    expect(opts.getStreakData).toHaveBeenCalledWith('specific-member');
  });
});

// ── Flame icon ────────────────────────────────────────────────────────────────

describe('initStreakTrackerWidget — flame icon', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('shows flame and adds streak-active class when streak >= 3', async () => {
    const opts = makeOpts($w, makeStreak(3));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakFlameIcon').show).toHaveBeenCalled();
    expect($w('#streakFlameIcon').addClass).toHaveBeenCalledWith('streak-active');
  });

  it('shows flame for streak of 7', async () => {
    const opts = makeOpts($w, makeStreak(7));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakFlameIcon').show).toHaveBeenCalled();
  });

  it('hides flame when streak is 2', async () => {
    const opts = makeOpts($w, makeStreak(2));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakFlameIcon').hide).toHaveBeenCalled();
    expect($w('#streakFlameIcon').addClass).not.toHaveBeenCalledWith('streak-active');
  });

  it('hides flame when streak is 0', async () => {
    const opts = makeOpts($w, makeStreak(0));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakFlameIcon').hide).toHaveBeenCalled();
  });
});

// ── Multiplier label ──────────────────────────────────────────────────────────

describe('initStreakTrackerWidget — multiplier label', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('shows "2x" multiplier for streak 3', async () => {
    const opts = makeOpts($w, makeStreak(3));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakMultiplierLabel').show).toHaveBeenCalled();
    expect($w('#streakMultiplierLabel').text).toBe('2x');
  });

  it('shows "2x" multiplier for streak 6', async () => {
    const opts = makeOpts($w, makeStreak(6));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakMultiplierLabel').text).toBe('2x');
  });

  it('shows "3x" multiplier for streak 7', async () => {
    const opts = makeOpts($w, makeStreak(7));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakMultiplierLabel').show).toHaveBeenCalled();
    expect($w('#streakMultiplierLabel').text).toBe('3x');
  });

  it('shows "3x" multiplier for streak 10', async () => {
    const opts = makeOpts($w, makeStreak(10));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakMultiplierLabel').text).toBe('3x');
  });

  it('hides multiplier when streak is 2', async () => {
    const opts = makeOpts($w, makeStreak(2));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakMultiplierLabel').hide).toHaveBeenCalled();
  });

  it('hides multiplier when streak is 0', async () => {
    const opts = makeOpts($w, makeStreak(0));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakMultiplierLabel').hide).toHaveBeenCalled();
  });
});

// ── Error / null handling ─────────────────────────────────────────────────────

describe('initStreakTrackerWidget — error handling', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('does not throw when getStreakData rejects', async () => {
    const opts = makeOpts($w, null);
    opts.getStreakData.mockRejectedValue(new Error('Service down'));
    await expect(initStreakTrackerWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('shows #noStreakMsg on getStreakData error', async () => {
    const opts = makeOpts($w, null);
    opts.getStreakData.mockRejectedValue(new Error('Service down'));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#noStreakMsg').show).toHaveBeenCalled();
  });

  it('hides streak elements on error', async () => {
    const opts = makeOpts($w, null);
    opts.getStreakData.mockRejectedValue(new Error('Service down'));
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#streakCount').hide).toHaveBeenCalled();
    expect($w('#longestStreak').hide).toHaveBeenCalled();
    expect($w('#streakFlameIcon').hide).toHaveBeenCalled();
    expect($w('#streakMultiplierLabel').hide).toHaveBeenCalled();
  });

  it('shows #noStreakMsg when getStreakData returns null', async () => {
    const opts = makeOpts($w, null);
    await initStreakTrackerWidget(MEMBER_ID, opts);
    expect($w('#noStreakMsg').show).toHaveBeenCalled();
  });
});
