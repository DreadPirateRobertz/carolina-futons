import { describe, it, expect, vi } from 'vitest';
import {
  renderChallengeCard,
  renderChallengesRail,
  showCompletionToast,
  updateChallengeProgress,
  formatCountdown,
  initChallengesDisplay,
} from '../src/public/ChallengesDisplay.js';

// ── Mock Wix $w element helpers ───────────────────────────────────────────────

function makeText() {
  let val = '';
  return { set text(v) { val = v; }, get text() { return val; }, hide: vi.fn(), show: vi.fn() };
}

function makeProgressBar() {
  let val = 0;
  return { set value(v) { val = v; }, get value() { return val; } };
}

function makeImage() {
  return { hide: vi.fn(), show: vi.fn() };
}

function makeBox() {
  return { hide: vi.fn(), show: vi.fn() };
}

function makeChallenge(overrides = {}) {
  return {
    challengeId: 'ch-1',
    title: 'First Steps',
    description: 'Complete your first order.',
    targetCount: 3,
    rewardPoints: 50,
    rewardBadgeId: null,
    expiresAt: '2099-04-01T00:00:00Z',
    progressValue: 1,
    completedAt: null,
    ...overrides,
  };
}

// ── renderChallengeCard ───────────────────────────────────────────────────────

describe('renderChallengeCard', () => {
  it('sets title text', () => {
    const $title = makeText();
    renderChallengeCard({ $title, $description: makeText(), $progressBar: makeProgressBar(), $progressLabel: makeText(), $rewardLabel: makeText(), $expiresLabel: makeText(), $completedBadge: makeImage() }, makeChallenge());
    expect($title.text).toBe('First Steps');
  });

  it('sets description text', () => {
    const $description = makeText();
    renderChallengeCard({ $title: makeText(), $description, $progressBar: makeProgressBar(), $progressLabel: makeText(), $rewardLabel: makeText(), $expiresLabel: makeText(), $completedBadge: makeImage() }, makeChallenge());
    expect($description.text).toBe('Complete your first order.');
  });

  it('sets progress bar value as fraction (progressValue / targetCount)', () => {
    const $progressBar = makeProgressBar();
    renderChallengeCard({ $title: makeText(), $description: makeText(), $progressBar, $progressLabel: makeText(), $rewardLabel: makeText(), $expiresLabel: makeText(), $completedBadge: makeImage() }, makeChallenge({ progressValue: 1, targetCount: 3 }));
    // Progress bar value should be approximately 33 (1/3 * 100)
    expect($progressBar.value).toBeCloseTo(33.3, 0);
  });

  it('sets progress label as "progressValue / targetCount" string', () => {
    const $progressLabel = makeText();
    renderChallengeCard({ $title: makeText(), $description: makeText(), $progressBar: makeProgressBar(), $progressLabel, $rewardLabel: makeText(), $expiresLabel: makeText(), $completedBadge: makeImage() }, makeChallenge({ progressValue: 2, targetCount: 5 }));
    expect($progressLabel.text).toBe('2 / 5');
  });

  it('sets reward label as "+N pts"', () => {
    const $rewardLabel = makeText();
    renderChallengeCard({ $title: makeText(), $description: makeText(), $progressBar: makeProgressBar(), $progressLabel: makeText(), $rewardLabel, $expiresLabel: makeText(), $completedBadge: makeImage() }, makeChallenge({ rewardPoints: 250 }));
    expect($rewardLabel.text).toBe('+250 pts');
  });

  it('shows completedBadge when completedAt is set', () => {
    const $completedBadge = makeImage();
    renderChallengeCard({ $title: makeText(), $description: makeText(), $progressBar: makeProgressBar(), $progressLabel: makeText(), $rewardLabel: makeText(), $expiresLabel: makeText(), $completedBadge }, makeChallenge({ completedAt: '2026-03-22T10:00:00Z' }));
    expect($completedBadge.show).toHaveBeenCalled();
  });

  it('hides completedBadge when completedAt is null', () => {
    const $completedBadge = makeImage();
    renderChallengeCard({ $title: makeText(), $description: makeText(), $progressBar: makeProgressBar(), $progressLabel: makeText(), $rewardLabel: makeText(), $expiresLabel: makeText(), $completedBadge }, makeChallenge({ completedAt: null }));
    expect($completedBadge.hide).toHaveBeenCalled();
  });

  it('sets expires label from expiresAt ISO string', () => {
    const $expiresLabel = makeText();
    const frozenNow = new Date('2026-03-15T12:00:00Z').getTime();
    renderChallengeCard({ $title: makeText(), $description: makeText(), $progressBar: makeProgressBar(), $progressLabel: makeText(), $rewardLabel: makeText(), $expiresLabel, $completedBadge: makeImage() }, makeChallenge({ expiresAt: '2026-04-01T00:00:00Z' }), frozenNow);
    expect($expiresLabel.text).toMatch(/Apr/);
  });
});

// ── renderChallengesRail ──────────────────────────────────────────────────────

describe('renderChallengesRail', () => {
  it('calls onItemReady for each challenge in the list', () => {
    const onItemReadyFn = vi.fn();
    const $challengesList = {
      onItemReady: (fn) => { onItemReadyFn.mockImplementation(fn); },
      data: [],
    };
    const challenges = [makeChallenge(), makeChallenge({ challengeId: 'ch-2', title: 'Trail Regular' })];
    renderChallengesRail($challengesList, challenges);
    expect($challengesList.data).toHaveLength(2);
  });
});

// ── showCompletionToast ───────────────────────────────────────────────────────

describe('showCompletionToast', () => {
  it('shows the toast element', () => {
    const $toast = makeBox();
    $toast.$toastTitle = makeText();
    $toast.$toastPoints = makeText();
    // fire-and-forget: show() is called synchronously before the 4s timer
    showCompletionToast($toast, { title: 'First Steps', rewardPoints: 50 }, false);
    expect($toast.show).toHaveBeenCalled();
  });

  it('sets title and points text on toast', () => {
    const $toast = makeBox();
    const $toastTitle = makeText();
    const $toastPoints = makeText();
    $toast.$toastTitle = $toastTitle;
    $toast.$toastPoints = $toastPoints;
    // fire-and-forget: text is set synchronously before the 4s timer
    showCompletionToast($toast, { title: 'AR Explorer', rewardPoints: 25 }, false);
    expect($toastTitle.text).toBe('AR Explorer');
    expect($toastPoints.text).toMatch(/25/);
  });

  it('hides the toast after 4000ms', async () => {
    vi.useFakeTimers();
    const $toast = makeBox();
    $toast.$toastTitle = makeText();
    $toast.$toastPoints = makeText();
    const p = showCompletionToast($toast, { title: 'Test', rewardPoints: 10 }, false);
    vi.advanceTimersByTime(4000);
    await p;
    expect($toast.hide).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('skips animation and shows completion state instantly when reducedMotion = true', async () => {
    vi.useFakeTimers();
    const $toast = makeBox();
    $toast.$toastTitle = makeText();
    $toast.$toastPoints = makeText();
    await showCompletionToast($toast, { title: 'Test', rewardPoints: 10 }, true);
    expect($toast.show).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ── updateChallengeProgress (frontend) ───────────────────────────────────────

describe('updateChallengeProgress (frontend)', () => {
  it('returns updated progressValue and justCompleted flag', () => {
    const result = updateChallengeProgress('ch-1', 2, 3, false);
    expect(result).toEqual({ challengeId: 'ch-1', progressValue: 2, targetCount: 3, justCompleted: false });
  });

  it('marks justCompleted when progressValue equals targetCount', () => {
    const result = updateChallengeProgress('ch-1', 3, 3, true);
    expect(result.justCompleted).toBe(true);
  });
});

// ── formatCountdown (cf-lx5: countdown UI within 24h) ────────────────────────

describe('formatCountdown', () => {
  const NOW = new Date('2026-03-23T12:00:00Z').getTime();

  it('returns empty string for null expiresAt', () => {
    expect(formatCountdown(null, NOW)).toBe('');
  });

  it('returns empty string for undefined expiresAt', () => {
    expect(formatCountdown(undefined, NOW)).toBe('');
  });

  it('returns "Expires <date>" when more than 24h remain', () => {
    const expires = new Date('2026-03-25T12:00:00Z').toISOString(); // 48h away
    const result = formatCountdown(expires, NOW);
    expect(result).toMatch(/^Expires /);
    expect(result).not.toMatch(/left$/);
  });

  it('returns countdown "Xh Ym left" when less than 24h remain', () => {
    const expires = new Date('2026-03-24T06:00:00Z').toISOString(); // 18h away
    const result = formatCountdown(expires, NOW);
    expect(result).toMatch(/18h 0m left/);
  });

  it('returns "Xh Ym left" with correct minutes', () => {
    const expires = new Date('2026-03-23T15:30:00Z').toISOString(); // 3h 30m away
    const result = formatCountdown(expires, NOW);
    expect(result).toBe('3h 30m left');
  });

  it('returns "< 1h left" when less than 1 hour remains', () => {
    const expires = new Date('2026-03-23T12:45:00Z').toISOString(); // 45m away
    const result = formatCountdown(expires, NOW);
    expect(result).toBe('< 1h left');
  });

  it('returns "" for already-expired expiresAt', () => {
    const expires = new Date('2026-03-23T10:00:00Z').toISOString(); // 2h ago
    const result = formatCountdown(expires, NOW);
    expect(result).toBe('');
  });

  it('uses Date.now() when nowMs is not provided', () => {
    const farFuture = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const result = formatCountdown(farFuture);
    expect(result).toMatch(/^Expires /);
  });

  it('returns "" for a malformed ISO string (NaN guard)', () => {
    expect(formatCountdown('not-a-date', NOW)).toBe('');
    expect(formatCountdown('2026-99-99', NOW)).toBe('');
  });

  it('returns "Expires <date>" at exactly 24h remaining (boundary)', () => {
    const expires = new Date(NOW + 24 * 3600 * 1000).toISOString(); // exactly 24h
    const result = formatCountdown(expires, NOW);
    expect(result).toMatch(/^Expires /);
  });
});

// ── renderChallengeCard — countdown integration ───────────────────────────────

describe('renderChallengeCard — countdown integration', () => {
  function makeCard() {
    const make = () => {
      let v = '';
      return { set text(x) { v = x; }, get text() { return v; }, show: vi.fn(), hide: vi.fn() };
    };
    const pb = (() => { let v = 0; return { set value(x) { v = x; }, get value() { return v; } }; })();
    return {
      $title: make(), $description: make(), $progressBar: pb,
      $progressLabel: make(), $rewardLabel: make(), $expiresLabel: make(),
      $completedBadge: { show: vi.fn(), hide: vi.fn() },
    };
  }

  it('shows "Xh Ym left" when expiresAt is within 24h (uses nowMs override)', () => {
    const now = new Date('2026-03-23T12:00:00Z').getTime();
    const expires = new Date('2026-03-24T03:30:00Z').toISOString(); // 15h 30m away
    const card = makeCard();
    renderChallengeCard(card, makeChallenge({ expiresAt: expires }), now);
    expect(card.$expiresLabel.text).toBe('15h 30m left');
  });

  it('shows "Expires <date>" when expiresAt is more than 24h away', () => {
    const now = new Date('2026-03-23T12:00:00Z').getTime();
    const expires = new Date('2026-03-26T00:00:00Z').toISOString(); // 60h away
    const card = makeCard();
    renderChallengeCard(card, makeChallenge({ expiresAt: expires }), now);
    expect(card.$expiresLabel.text).toMatch(/^Expires /);
  });

  it('shows empty string when challenge has already expired', () => {
    const now = new Date('2026-03-23T12:00:00Z').getTime();
    const expires = new Date('2026-03-23T10:00:00Z').toISOString(); // 2h ago
    const card = makeCard();
    renderChallengeCard(card, makeChallenge({ expiresAt: expires }), now);
    expect(card.$expiresLabel.text).toBe('');
  });
});

// cf-9lp.2: initChallengesDisplay must surface response.error and the catch-path
// instead of silently hiding the section. Previously a DB failure (cf-tlt
// `internal_error` shape) was indistinguishable from "no active challenges" —
// user saw an empty section either way and we lost the signal at the user-facing
// layer. Now: on error, show the error element (optional 5th param, tolerates
// missing element) and hide the section. Empty path is preserved silently.
describe('initChallengesDisplay — cf-9lp.2 error surfacing', () => {
  function makeContainer() {
    return { show: vi.fn(), hide: vi.fn() };
  }
  function makeRepeater() {
    return {
      _data: null, _onItemReady: null, show: vi.fn(), hide: vi.fn(),
      set data(v) { this._data = v; }, get data() { return this._data; },
      onItemReady(cb) { this._onItemReady = cb; },
    };
  }

  it('shows $challengesError and hides section when response.error is "internal_error"', async () => {
    const $section = makeContainer();
    const $list = makeRepeater();
    const $error = makeContainer();
    const fn = vi.fn().mockResolvedValue({ challenges: [], error: 'internal_error' });
    await initChallengesDisplay('mem-1', fn, $section, $list, $error);
    expect($error.show).toHaveBeenCalled();
    expect($section.hide).toHaveBeenCalled();
    expect($list._data).toBeNull();
  });

  it('shows $challengesError for any truthy error (future-proof)', async () => {
    const $section = makeContainer();
    const $list = makeRepeater();
    const $error = makeContainer();
    const fn = vi.fn().mockResolvedValue({ challenges: [], error: 'some-future-code' });
    await initChallengesDisplay('mem-1', fn, $section, $list, $error);
    expect($error.show).toHaveBeenCalled();
    expect($section.hide).toHaveBeenCalled();
  });

  it('shows $challengesError and hides section when fn rejects', async () => {
    const $section = makeContainer();
    const $list = makeRepeater();
    const $error = makeContainer();
    const fn = vi.fn().mockRejectedValue(new Error('network failure'));
    await initChallengesDisplay('mem-1', fn, $section, $list, $error);
    expect($error.show).toHaveBeenCalled();
    expect($section.hide).toHaveBeenCalled();
  });

  // cf-2qe: the reject branch previously showed the error UI but left no
  // client-side observability signal — a network/CORS/timeout failure became
  // indistinguishable from a backend-flagged error once the UI was rendered.
  it('logs to console.error when fn rejects (cf-2qe observability)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const $section = makeContainer();
      const $list = makeRepeater();
      const $error = makeContainer();
      const fn = vi.fn().mockRejectedValue(new Error('network failure'));
      await initChallengesDisplay('mem-1', fn, $section, $list, $error);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does NOT log to console.error on normal happy-path (cf-2qe non-regression)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const $section = makeContainer();
      const $list = makeRepeater();
      const $error = makeContainer();
      const fn = vi.fn().mockResolvedValue({ challenges: [] });
      await initChallengesDisplay('mem-1', fn, $section, $list, $error);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('tolerates missing $challengesError (pre-editor-update safety)', async () => {
    const $section = makeContainer();
    const $list = makeRepeater();
    const fn = vi.fn().mockResolvedValue({ challenges: [], error: 'internal_error' });
    // 5th arg omitted — must not throw.
    await expect(initChallengesDisplay('mem-1', fn, $section, $list)).resolves.not.toThrow();
    expect($section.hide).toHaveBeenCalled();
  });

  it('shows $challengesError when fn resolves to null (defensive null-guard)', async () => {
    const $section = makeContainer();
    const $list = makeRepeater();
    const $error = makeContainer();
    const fn = vi.fn().mockResolvedValue(null);
    await initChallengesDisplay('mem-1', fn, $section, $list, $error);
    expect($error.show).toHaveBeenCalled();
    expect($section.hide).toHaveBeenCalled();
  });

  it('hides $challengesError on normal render with challenges', async () => {
    const $section = makeContainer();
    const $list = makeRepeater();
    const $error = makeContainer();
    const fn = vi.fn().mockResolvedValue({
      challenges: [{ challengeId: 'ch-1', title: 't', description: 'd', targetCount: 1, rewardPoints: 10, expiresAt: '2099-01-01T00:00:00Z', progressValue: 0, completedAt: null }],
    });
    await initChallengesDisplay('mem-1', fn, $section, $list, $error);
    expect($error.hide).toHaveBeenCalled();
    expect($error.show).not.toHaveBeenCalled();
    expect($section.show).toHaveBeenCalled();
    expect($list._data).toHaveLength(1);
  });

  it('hides section silently on empty-but-authed (no error field)', async () => {
    const $section = makeContainer();
    const $list = makeRepeater();
    const $error = makeContainer();
    const fn = vi.fn().mockResolvedValue({ challenges: [] });
    await initChallengesDisplay('mem-1', fn, $section, $list, $error);
    expect($section.hide).toHaveBeenCalled();
    expect($error.show).not.toHaveBeenCalled();
  });
});
