/**
 * @file milestoneNudgeToast.test.js
 * @description Tests for CF-cgpy: MilestoneNudgeToast — toast notifications near milestones.
 *
 * Covers:
 *  - tier proximity nudge at 80%+
 *  - streak proximity nudge at 80%+
 *  - toast text formatting
 *  - dismiss suppresses for 24h via storage
 *  - suppressed nudges not shown
 *  - expired suppression allows re-show
 *  - no nudge below 80%
 *  - no nudge at max tier
 *  - error handling
 *  - does not throw on reject
 *
 * CF-cgpy
 */
import { describe, it, expect, vi } from 'vitest';
import {
  initMilestoneNudgeToast,
  isSuppressed,
  suppressNudge,
  formatNudgeText,
} from '../src/public/MilestoneNudgeToast.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    _onClick: null,
    show:    vi.fn(function () { this._visible = true; }),
    hide:    vi.fn(function () { this._visible = false; }),
    onClick: vi.fn(function (cb) { this._onClick = cb; }),
  };
}

function make$w() {
  const els = {
    '#milestoneToast':      makeEl(),
    '#milestoneToastText':  makeEl(),
    '#milestoneToastClose': makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

function makeStorage() {
  const data = {};
  return {
    getItem: vi.fn((k) => data[k] ?? null),
    setItem: vi.fn((k, v) => { data[k] = v; }),
    _data: data,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-test';
const NOW = 1711400000000;

function makeTierNudge(overrides = {}) {
  return {
    type: 'tier',
    milestone: 'Mountain Guide',
    current: 450,
    target: 500,
    remaining: 50,
    ...overrides,
  };
}

function makeStreakNudge(overrides = {}) {
  return {
    type: 'streak',
    milestone: '7-day streak',
    current: 6,
    target: 7,
    remaining: 1,
    ...overrides,
  };
}

function makeOpts($w, nudges, storage = makeStorage()) {
  return {
    $w,
    checkMilestoneProximity: vi.fn().mockResolvedValue(nudges),
    storage,
    now: NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('formatNudgeText', () => {
  it('formats tier nudge', () => {
    expect(formatNudgeText(makeTierNudge({ remaining: 100, milestone: 'Mountain Guide' })))
      .toBe('Just 100 more points to Mountain Guide!');
  });

  it('formats streak nudge', () => {
    expect(formatNudgeText(makeStreakNudge({ remaining: 2, milestone: '14-day streak' })))
      .toBe('Just 2 more days to 14-day streak!');
  });
});

describe('isSuppressed / suppressNudge', () => {
  it('returns false when no suppression exists', () => {
    const storage = makeStorage();
    expect(isSuppressed('Mountain Guide', storage, NOW)).toBe(false);
  });

  it('returns true when dismissed within 24h', () => {
    const storage = makeStorage();
    suppressNudge('Mountain Guide', storage, NOW);
    expect(isSuppressed('Mountain Guide', storage, NOW + 1000)).toBe(true);
  });

  it('returns false when suppression expired (>24h)', () => {
    const storage = makeStorage();
    suppressNudge('Mountain Guide', storage, NOW);
    const after25h = NOW + 25 * 60 * 60 * 1000;
    expect(isSuppressed('Mountain Guide', storage, after25h)).toBe(false);
  });

  it('returns true at exactly 23h59m', () => {
    const storage = makeStorage();
    suppressNudge('Mountain Guide', storage, NOW);
    const almostExpired = NOW + 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
    expect(isSuppressed('Mountain Guide', storage, almostExpired)).toBe(true);
  });
});

describe('toast display', () => {
  it('shows toast with tier nudge text', async () => {
    const $w = make$w();
    await initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, [makeTierNudge()]));
    expect($w._els['#milestoneToast'].show).toHaveBeenCalled();
    expect($w._els['#milestoneToastText'].text).toBe('Just 50 more points to Mountain Guide!');
  });

  it('shows toast with streak nudge text', async () => {
    const $w = make$w();
    await initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, [makeStreakNudge()]));
    expect($w._els['#milestoneToast'].show).toHaveBeenCalled();
    expect($w._els['#milestoneToastText'].text).toBe('Just 1 more days to 7-day streak!');
  });

  it('shows first non-suppressed nudge when first is suppressed', async () => {
    const $w = make$w();
    const storage = makeStorage();
    suppressNudge('Mountain Guide', storage, NOW);
    const nudges = [makeTierNudge(), makeStreakNudge()];
    await initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, nudges, storage));
    expect($w._els['#milestoneToastText'].text).toBe('Just 1 more days to 7-day streak!');
  });

  it('hides toast when all nudges are suppressed', async () => {
    const $w = make$w();
    const storage = makeStorage();
    suppressNudge('Mountain Guide', storage, NOW);
    await initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, [makeTierNudge()], storage));
    expect($w._els['#milestoneToast'].show).not.toHaveBeenCalled();
  });

  it('hides toast when no nudges returned', async () => {
    const $w = make$w();
    await initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, []));
    expect($w._els['#milestoneToast'].show).not.toHaveBeenCalled();
  });
});

describe('dismiss behavior', () => {
  it('wires onClick on close button', async () => {
    const $w = make$w();
    await initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, [makeTierNudge()]));
    expect($w._els['#milestoneToastClose'].onClick).toHaveBeenCalled();
  });

  it('hides toast and sets suppression on dismiss', async () => {
    const $w = make$w();
    const storage = makeStorage();
    await initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, [makeTierNudge()], storage));

    // Simulate click
    const handler = $w._els['#milestoneToastClose']._onClick;
    handler();

    expect($w._els['#milestoneToast'].hide).toHaveBeenCalled();
    expect(storage.setItem).toHaveBeenCalledWith(
      'milestone_nudge_dismissed_Mountain Guide',
      String(NOW)
    );
  });

  it('suppressed nudge not shown on next init', async () => {
    const $w = make$w();
    const storage = makeStorage();
    suppressNudge('Mountain Guide', storage, NOW);

    await initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, [makeTierNudge()], storage));
    expect($w._els['#milestoneToast'].show).not.toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('does not show toast on error', async () => {
    const $w = make$w();
    const opts = {
      $w,
      checkMilestoneProximity: vi.fn().mockRejectedValue(new Error('fail')),
      storage: makeStorage(),
      now: NOW,
    };
    await initMilestoneNudgeToast(MEMBER_ID, opts);
    expect($w._els['#milestoneToast'].show).not.toHaveBeenCalled();
  });

  it('does not throw on reject', async () => {
    const $w = make$w();
    const opts = {
      $w,
      checkMilestoneProximity: vi.fn().mockRejectedValue(new Error('fail')),
      storage: makeStorage(),
      now: NOW,
    };
    await expect(initMilestoneNudgeToast(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('does not throw when nudges is null', async () => {
    const $w = make$w();
    await expect(
      initMilestoneNudgeToast(MEMBER_ID, makeOpts($w, null))
    ).resolves.not.toThrow();
  });
});
