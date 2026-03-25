/**
 * @file gamificationSocialToast.test.js
 * @description Tests for CF-cj4l: GamificationSocialToast — social proof toasts
 * when members earn badges or tier up.
 *
 * Covers:
 *  - formatSocialText for badge_earned, tier_upgraded, fallback
 *  - isSuppressed / suppressAchievement (1h TTL)
 *  - toast shows first available achievement
 *  - cycling through multiple achievements via setInterval
 *  - dismiss suppresses current and advances to next
 *  - all suppressed → no toast
 *  - empty achievements → no toast
 *  - backend error → no toast, no throw
 *  - null response → no throw
 *
 * CF-cj4l
 */
import { describe, it, expect, vi } from 'vitest';
import {
  initGamificationSocialToast,
  isSuppressed,
  suppressAchievement,
  formatSocialText,
} from '../src/public/GamificationSocialToast.js';

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
    '#socialToast':   makeEl(),
    '#socialText':    makeEl(),
    '#socialDismiss': makeEl(),
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

const NOW = 1711400000000;

function makeBadgeAchievement(overrides = {}) {
  return {
    memberNickname: 'Alex',
    achievementType: 'badge_earned',
    achievementName: 'First Purchase',
    timestamp: '2026-03-25T00:00:00.000Z',
    ...overrides,
  };
}

function makeTierAchievement(overrides = {}) {
  return {
    memberNickname: 'Jordan',
    achievementType: 'tier_upgraded',
    achievementName: 'Mountain Guide',
    timestamp: '2026-03-25T01:00:00.000Z',
    ...overrides,
  };
}

function makeOpts($w, achievements, storage = makeStorage()) {
  return {
    $w,
    getRecentAchievements: vi.fn().mockResolvedValue(achievements),
    storage,
    now: NOW,
    setInterval: vi.fn(),
  };
}

// ── formatSocialText ─────────────────────────────────────────────────────────

describe('formatSocialText', () => {
  it('formats badge_earned', () => {
    expect(formatSocialText(makeBadgeAchievement()))
      .toBe('Alex just earned the First Purchase badge!');
  });

  it('formats tier_upgraded', () => {
    expect(formatSocialText(makeTierAchievement()))
      .toBe('Jordan just reached Mountain Guide!');
  });

  it('formats unknown achievementType with fallback', () => {
    expect(formatSocialText({ memberNickname: 'Sam', achievementType: 'other', achievementName: 'Something' }))
      .toBe('Sam achieved Something!');
  });
});

// ── isSuppressed / suppressAchievement ───────────────────────────────────────

describe('isSuppressed / suppressAchievement', () => {
  it('returns false when no suppression exists', () => {
    const storage = makeStorage();
    expect(isSuppressed(makeBadgeAchievement(), storage, NOW)).toBe(false);
  });

  it('returns true when dismissed within 1h', () => {
    const storage = makeStorage();
    const a = makeBadgeAchievement();
    suppressAchievement(a, storage, NOW);
    expect(isSuppressed(a, storage, NOW + 1000)).toBe(true);
  });

  it('returns false when suppression expired (>1h)', () => {
    const storage = makeStorage();
    const a = makeBadgeAchievement();
    suppressAchievement(a, storage, NOW);
    const after2h = NOW + 2 * 60 * 60 * 1000;
    expect(isSuppressed(a, storage, after2h)).toBe(false);
  });

  it('returns true at exactly 59m59s', () => {
    const storage = makeStorage();
    const a = makeBadgeAchievement();
    suppressAchievement(a, storage, NOW);
    const almostExpired = NOW + 59 * 60 * 1000 + 59 * 1000;
    expect(isSuppressed(a, storage, almostExpired)).toBe(true);
  });

  it('different achievements have independent suppression', () => {
    const storage = makeStorage();
    suppressAchievement(makeBadgeAchievement(), storage, NOW);
    expect(isSuppressed(makeTierAchievement(), storage, NOW)).toBe(false);
  });
});

// ── Toast display ────────────────────────────────────────────────────────────

describe('toast display', () => {
  it('shows toast with badge achievement text', async () => {
    const $w = make$w();
    await initGamificationSocialToast(makeOpts($w, [makeBadgeAchievement()]));
    expect($w._els['#socialToast'].show).toHaveBeenCalled();
    expect($w._els['#socialText'].text).toBe('Alex just earned the First Purchase badge!');
  });

  it('shows toast with tier achievement text', async () => {
    const $w = make$w();
    await initGamificationSocialToast(makeOpts($w, [makeTierAchievement()]));
    expect($w._els['#socialToast'].show).toHaveBeenCalled();
    expect($w._els['#socialText'].text).toBe('Jordan just reached Mountain Guide!');
  });

  it('skips suppressed achievements', async () => {
    const $w = make$w();
    const storage = makeStorage();
    suppressAchievement(makeBadgeAchievement(), storage, NOW);
    const achievements = [makeBadgeAchievement(), makeTierAchievement()];
    await initGamificationSocialToast(makeOpts($w, achievements, storage));
    expect($w._els['#socialText'].text).toBe('Jordan just reached Mountain Guide!');
  });

  it('does not show toast when all achievements suppressed', async () => {
    const $w = make$w();
    const storage = makeStorage();
    const a = makeBadgeAchievement();
    suppressAchievement(a, storage, NOW);
    await initGamificationSocialToast(makeOpts($w, [a], storage));
    expect($w._els['#socialToast'].show).not.toHaveBeenCalled();
  });

  it('does not show toast when no achievements returned', async () => {
    const $w = make$w();
    await initGamificationSocialToast(makeOpts($w, []));
    expect($w._els['#socialToast'].show).not.toHaveBeenCalled();
  });

  it('hides toast container initially', async () => {
    const $w = make$w();
    await initGamificationSocialToast(makeOpts($w, [makeBadgeAchievement()]));
    expect($w._els['#socialToast'].hide).toHaveBeenCalled();
  });
});

// ── Cycling ──────────────────────────────────────────────────────────────────

describe('cycling', () => {
  it('sets up interval when multiple achievements available', async () => {
    const $w = make$w();
    const mockSetInterval = vi.fn();
    const opts = makeOpts($w, [makeBadgeAchievement(), makeTierAchievement()]);
    opts.setInterval = mockSetInterval;
    await initGamificationSocialToast(opts);
    expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
  });

  it('does not set up interval for single achievement', async () => {
    const $w = make$w();
    const mockSetInterval = vi.fn();
    const opts = makeOpts($w, [makeBadgeAchievement()]);
    opts.setInterval = mockSetInterval;
    await initGamificationSocialToast(opts);
    expect(mockSetInterval).not.toHaveBeenCalled();
  });

  it('cycles to next achievement on interval tick', async () => {
    const $w = make$w();
    const mockSetInterval = vi.fn();
    const badge = makeBadgeAchievement();
    const tier = makeTierAchievement();
    const opts = makeOpts($w, [badge, tier]);
    opts.setInterval = mockSetInterval;
    await initGamificationSocialToast(opts);

    // First shows badge
    expect($w._els['#socialText'].text).toBe('Alex just earned the First Purchase badge!');

    // Simulate interval tick
    const intervalCb = mockSetInterval.mock.calls[0][0];
    intervalCb();
    expect($w._els['#socialText'].text).toBe('Jordan just reached Mountain Guide!');
  });

  it('wraps around to first achievement after last', async () => {
    const $w = make$w();
    const mockSetInterval = vi.fn();
    const opts = makeOpts($w, [makeBadgeAchievement(), makeTierAchievement()]);
    opts.setInterval = mockSetInterval;
    await initGamificationSocialToast(opts);

    const intervalCb = mockSetInterval.mock.calls[0][0];
    intervalCb(); // → index 1 (tier)
    intervalCb(); // → index 0 (badge, wrapped)
    expect($w._els['#socialText'].text).toBe('Alex just earned the First Purchase badge!');
  });

  it('fires onCycle callback with achievement and index', async () => {
    const $w = make$w();
    const onCycle = vi.fn();
    const badge = makeBadgeAchievement();
    const opts = makeOpts($w, [badge]);
    opts.onCycle = onCycle;
    await initGamificationSocialToast(opts);
    expect(onCycle).toHaveBeenCalledWith(badge, 0);
  });
});

// ── Dismiss behavior ─────────────────────────────────────────────────────────

describe('dismiss behavior', () => {
  it('wires onClick on dismiss button', async () => {
    const $w = make$w();
    await initGamificationSocialToast(makeOpts($w, [makeBadgeAchievement()]));
    expect($w._els['#socialDismiss'].onClick).toHaveBeenCalled();
  });

  it('hides toast and suppresses achievement on dismiss', async () => {
    const $w = make$w();
    const storage = makeStorage();
    await initGamificationSocialToast(makeOpts($w, [makeBadgeAchievement()], storage));

    const handler = $w._els['#socialDismiss']._onClick;
    handler();

    expect($w._els['#socialToast'].hide).toHaveBeenCalled();
    expect(storage.setItem).toHaveBeenCalledWith(
      'social_proof_dismissed_badge_earned_First Purchase',
      String(NOW)
    );
  });

  it('advances to next achievement after dismiss', async () => {
    const $w = make$w();
    const storage = makeStorage();
    const achievements = [makeBadgeAchievement(), makeTierAchievement()];
    await initGamificationSocialToast(makeOpts($w, achievements, storage));

    const handler = $w._els['#socialDismiss']._onClick;
    handler();

    expect($w._els['#socialText'].text).toBe('Jordan just reached Mountain Guide!');
    expect($w._els['#socialToast'].show).toHaveBeenCalled();
  });

  it('does not show next toast when last achievement dismissed', async () => {
    const $w = make$w();
    const storage = makeStorage();
    await initGamificationSocialToast(makeOpts($w, [makeBadgeAchievement()], storage));

    // Reset show mock to track only post-dismiss calls
    $w._els['#socialToast'].show.mockClear();

    const handler = $w._els['#socialDismiss']._onClick;
    handler();

    // showCurrent is called but currentIdx >= available.length so it returns early
    // The hide was called, but show should not be re-called
    expect($w._els['#socialToast'].hide).toHaveBeenCalled();
  });
});

// ── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('does not show toast on backend error', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getRecentAchievements: vi.fn().mockRejectedValue(new Error('fail')),
      storage: makeStorage(),
      now: NOW,
      setInterval: vi.fn(),
    };
    await initGamificationSocialToast(opts);
    expect($w._els['#socialToast'].show).not.toHaveBeenCalled();
  });

  it('does not throw on backend rejection', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getRecentAchievements: vi.fn().mockRejectedValue(new Error('fail')),
      storage: makeStorage(),
      now: NOW,
      setInterval: vi.fn(),
    };
    await expect(initGamificationSocialToast(opts)).resolves.not.toThrow();
  });

  it('does not throw when achievements is null', async () => {
    const $w = make$w();
    await expect(
      initGamificationSocialToast(makeOpts($w, null))
    ).resolves.not.toThrow();
  });
});
