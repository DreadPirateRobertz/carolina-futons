/**
 * @file gamificationStatsWidget.test.js
 * @description Tests for CF-ytrl: GamificationStatsWidget — aggregate stats dashboard header.
 *
 * Covers:
 *  - all 6 stats render correctly
 *  - tier badge color matches tier
 *  - streak icon shows when >= 3, plain when < 3
 *  - retry button calls getGamificationStats again
 *  - error state
 *  - no throw on reject
 *
 * CF-ytrl
 */
import { describe, it, expect, vi } from 'vitest';
import { initGamificationStatsWidget } from '../src/public/GamificationStatsWidget.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    _classes: [],
    _onClick: null,
    show:     vi.fn(function () { this._visible = true; }),
    hide:     vi.fn(function () { this._visible = false; }),
    addClass: vi.fn(function (cls) { this._classes.push(cls); }),
    onClick:  vi.fn(function (cb) { this._onClick = cb; }),
  };
}

function make$w() {
  const els = {
    '#statsPoints':  makeEl(),
    '#statsTier':    makeEl(),
    '#statsStreak':  makeEl(),
    '#statsBadges':  makeEl(),
    '#statsQuests':  makeEl(),
    '#statsRank':    makeEl(),
    '#statsError':   makeEl(),
    '#statsRetry':   makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-test';

function makeStats(overrides = {}) {
  return {
    totalPoints: 2450,
    currentTier: 'Gold',
    currentStreak: 7,
    badgesEarned: 12,
    questsCompleted: 45,
    rank: 23,
    ...overrides,
  };
}

function makeOpts($w, stats) {
  return {
    $w,
    getGamificationStats: vi.fn().mockResolvedValue(stats),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('stats rendering', () => {
  it('sets #statsPoints with comma formatting', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ totalPoints: 2450 })));
    expect($w._els['#statsPoints'].text).toBe('2,450 pts');
  });

  it('sets #statsTier text', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentTier: 'Gold' })));
    expect($w._els['#statsTier'].text).toBe('Gold');
  });

  it('sets #statsStreak text with day count', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentStreak: 7 })));
    expect($w._els['#statsStreak'].text).toContain('7-day streak');
  });

  it('sets #statsBadges text', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ badgesEarned: 12 })));
    expect($w._els['#statsBadges'].text).toBe('12 badges');
  });

  it('sets #statsQuests text', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ questsCompleted: 45 })));
    expect($w._els['#statsQuests'].text).toBe('45 quests completed');
  });

  it('sets #statsRank text', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ rank: 23 })));
    expect($w._els['#statsRank'].text).toBe('Rank #23');
  });
});

describe('tier badge color', () => {
  it('adds tier-bronze class for Bronze', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentTier: 'Bronze' })));
    expect($w._els['#statsTier'].addClass).toHaveBeenCalledWith('tier-bronze');
  });

  it('adds tier-silver class for Silver', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentTier: 'Silver' })));
    expect($w._els['#statsTier'].addClass).toHaveBeenCalledWith('tier-silver');
  });

  it('adds tier-gold class for Gold', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentTier: 'Gold' })));
    expect($w._els['#statsTier'].addClass).toHaveBeenCalledWith('tier-gold');
  });

  it('adds tier-platinum class for Platinum', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentTier: 'Platinum' })));
    expect($w._els['#statsTier'].addClass).toHaveBeenCalledWith('tier-platinum');
  });
});

describe('streak icon', () => {
  it('includes fire emoji when streak >= 3', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentStreak: 5 })));
    expect($w._els['#statsStreak'].text).toBe('\uD83D\uDD25 5-day streak');
  });

  it('no fire emoji when streak < 3', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentStreak: 2 })));
    expect($w._els['#statsStreak'].text).toBe('2-day streak');
  });

  it('no fire emoji when streak is 0', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats({ currentStreak: 0 })));
    expect($w._els['#statsStreak'].text).toBe('0-day streak');
  });
});

describe('retry button', () => {
  it('wires onClick handler on #statsRetry', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, makeStats()));
    expect($w._els['#statsRetry'].onClick).toHaveBeenCalled();
  });

  it('calls getGamificationStats again on retry click', async () => {
    const $w = make$w();
    const opts = makeOpts($w, makeStats());
    await initGamificationStatsWidget(MEMBER_ID, opts);
    expect(opts.getGamificationStats).toHaveBeenCalledTimes(1);

    // Simulate retry click
    const retryHandler = $w._els['#statsRetry']._onClick;
    await retryHandler();
    expect(opts.getGamificationStats).toHaveBeenCalledTimes(2);
  });
});

describe('error handling', () => {
  it('shows #statsError when getGamificationStats returns null', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#statsError'].show).toHaveBeenCalled();
  });

  it('hides all stat elements on error', async () => {
    const $w = make$w();
    await initGamificationStatsWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#statsPoints'].hide).toHaveBeenCalled();
    expect($w._els['#statsTier'].hide).toHaveBeenCalled();
    expect($w._els['#statsStreak'].hide).toHaveBeenCalled();
    expect($w._els['#statsBadges'].hide).toHaveBeenCalled();
    expect($w._els['#statsQuests'].hide).toHaveBeenCalled();
    expect($w._els['#statsRank'].hide).toHaveBeenCalled();
  });

  it('shows #statsError when getGamificationStats rejects', async () => {
    const $w = make$w();
    const opts = { $w, getGamificationStats: vi.fn().mockRejectedValue(new Error('fail')) };
    await initGamificationStatsWidget(MEMBER_ID, opts);
    expect($w._els['#statsError'].show).toHaveBeenCalled();
  });

  it('does not throw when getGamificationStats rejects', async () => {
    const $w = make$w();
    const opts = { $w, getGamificationStats: vi.fn().mockRejectedValue(new Error('fail')) };
    await expect(initGamificationStatsWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});
