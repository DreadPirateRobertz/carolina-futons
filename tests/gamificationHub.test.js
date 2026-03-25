/**
 * gamificationHub.test.js
 * CF-zgmv — GamificationHub: orchestrate all gamification widgets
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGamificationHub } from '../src/public/GamificationHub.js';

const MEMBER_ID = 'mem-hub-1';

function makeEl() {
  return { show: vi.fn(), hide: vi.fn(), text: '' };
}

function make$w() {
  return (id) => makeEl();
}

function makeOpts($w, overrides = {}) {
  return {
    $w,
    initPointsBalanceWidget: vi.fn().mockResolvedValue(undefined),
    initLeaderboardWidget:   vi.fn().mockResolvedValue(undefined),
    initSpinWheel:           vi.fn().mockResolvedValue(undefined),
    initOnboarding:          vi.fn().mockResolvedValue(undefined),
    initDailyChallengeWidget: vi.fn().mockResolvedValue(undefined),
    initBadgeDisplayWidget:  vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── All succeed ───────────────────────────────────────────────────────────────

describe('initGamificationHub — all widgets succeed', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('returns initialized array with all 6 module names', async () => {
    const opts = makeOpts($w);
    const result = await initGamificationHub(MEMBER_ID, opts);
    expect(result.initialized).toHaveLength(6);
    expect(result.failed).toHaveLength(0);
  });

  it('includes pointsBalance in initialized', async () => {
    const result = await initGamificationHub(MEMBER_ID, makeOpts($w));
    expect(result.initialized).toContain('pointsBalance');
  });

  it('includes leaderboard in initialized', async () => {
    const result = await initGamificationHub(MEMBER_ID, makeOpts($w));
    expect(result.initialized).toContain('leaderboard');
  });

  it('includes spinWheel in initialized', async () => {
    const result = await initGamificationHub(MEMBER_ID, makeOpts($w));
    expect(result.initialized).toContain('spinWheel');
  });

  it('includes onboarding in initialized', async () => {
    const result = await initGamificationHub(MEMBER_ID, makeOpts($w));
    expect(result.initialized).toContain('onboarding');
  });

  it('includes dailyChallenge in initialized', async () => {
    const result = await initGamificationHub(MEMBER_ID, makeOpts($w));
    expect(result.initialized).toContain('dailyChallenge');
  });

  it('includes badgeDisplay in initialized', async () => {
    const result = await initGamificationHub(MEMBER_ID, makeOpts($w));
    expect(result.initialized).toContain('badgeDisplay');
  });
});

// ── One widget fails ──────────────────────────────────────────────────────────

describe('initGamificationHub — one widget fails', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('records failed module in failed array', async () => {
    const opts = makeOpts($w, {
      initLeaderboardWidget: vi.fn().mockRejectedValue(new Error('Leaderboard down')),
    });
    const result = await initGamificationHub(MEMBER_ID, opts);
    expect(result.failed).toContain('leaderboard');
  });

  it('does not include failed module in initialized', async () => {
    const opts = makeOpts($w, {
      initLeaderboardWidget: vi.fn().mockRejectedValue(new Error('Leaderboard down')),
    });
    const result = await initGamificationHub(MEMBER_ID, opts);
    expect(result.initialized).not.toContain('leaderboard');
  });

  it('other 5 modules still initialize when one fails', async () => {
    const opts = makeOpts($w, {
      initLeaderboardWidget: vi.fn().mockRejectedValue(new Error('Leaderboard down')),
    });
    const result = await initGamificationHub(MEMBER_ID, opts);
    expect(result.initialized).toHaveLength(5);
  });

  it('does not throw when a widget init rejects', async () => {
    const opts = makeOpts($w, {
      initSpinWheel: vi.fn().mockRejectedValue(new Error('Spin down')),
    });
    await expect(initGamificationHub(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});

// ── Multiple failures ─────────────────────────────────────────────────────────

describe('initGamificationHub — multiple failures', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('records all failed modules', async () => {
    const opts = makeOpts($w, {
      initSpinWheel:          vi.fn().mockRejectedValue(new Error('err')),
      initBadgeDisplayWidget: vi.fn().mockRejectedValue(new Error('err')),
    });
    const result = await initGamificationHub(MEMBER_ID, opts);
    expect(result.failed).toContain('spinWheel');
    expect(result.failed).toContain('badgeDisplay');
    expect(result.initialized).toHaveLength(4);
    expect(result.failed).toHaveLength(2);
  });
});

// ── Passthrough ───────────────────────────────────────────────────────────────

describe('initGamificationHub — passthrough', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('passes memberId to all widget inits', async () => {
    const opts = makeOpts($w);
    await initGamificationHub('specific-member', opts);
    for (const fn of [
      opts.initPointsBalanceWidget,
      opts.initLeaderboardWidget,
      opts.initSpinWheel,
      opts.initOnboarding,
      opts.initDailyChallengeWidget,
      opts.initBadgeDisplayWidget,
    ]) {
      expect(fn).toHaveBeenCalledWith('specific-member', expect.anything());
    }
  });

  it('passes $w to all widget inits', async () => {
    const opts = makeOpts($w);
    await initGamificationHub(MEMBER_ID, opts);
    for (const fn of [
      opts.initPointsBalanceWidget,
      opts.initLeaderboardWidget,
      opts.initSpinWheel,
      opts.initOnboarding,
      opts.initDailyChallengeWidget,
      opts.initBadgeDisplayWidget,
    ]) {
      expect(fn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ $w })
      );
    }
  });
});
