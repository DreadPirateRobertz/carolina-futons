/**
 * @file gamificationOnboarding.test.js
 * @description Tests for CF-ekzr: GamificationOnboarding first-visit tutorial overlay.
 *
 * Covers:
 *  - hasSeenOnboarding: returns false when key absent
 *  - hasSeenOnboarding: returns true when key is 'true'
 *  - hasSeenOnboarding: returns false for non-'true' values
 *  - initOnboarding: skips on second visit (flag already set)
 *  - initOnboarding: shows overlay on first visit
 *  - initOnboarding: renders first step text on init
 *  - initOnboarding: step indicator shows "1 / 3" on first step
 *  - Next button: advances to step 2, renders correct text
 *  - Next button: step indicator updates to "2 / 3"
 *  - Next button on last step: marks seen and hides overlay
 *  - Next button on last step: does NOT advance step index
 *  - Prev button: goes back when not on first step
 *  - Prev button: no-op when already on first step
 *  - Close button: marks seen and hides overlay
 *  - ONBOARDING_STEPS: exports exactly 3 steps with expected ids
 *  - initOnboarding: recovers gracefully on element error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ONBOARDING_STEPS,
  hasSeenOnboarding,
  initOnboarding,
} from '../src/public/GamificationOnboarding.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: vi.fn((k) => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = v; }),
    _store: store,
  };
}

function makeElements() {
  const stepText = { text: '' };
  const stepIndicator = { text: '' };
  const overlay = {
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
  };
  const handlers = {};
  const nextBtn = { onClick: vi.fn((fn) => { handlers.next = fn; }) };
  const prevBtn = { onClick: vi.fn((fn) => { handlers.prev = fn; }) };
  const closeBtn = { onClick: vi.fn((fn) => { handlers.close = fn; }) };

  return { stepText, stepIndicator, overlay, nextBtn, prevBtn, closeBtn, handlers };
}

function make$w({ stepText, stepIndicator, overlay, nextBtn, prevBtn, closeBtn }) {
  return vi.fn((sel) => {
    if (sel === '#gamificationOnboardingOverlay') return overlay;
    if (sel === '#onboardingNextBtn') return nextBtn;
    if (sel === '#onboardingPrevBtn') return prevBtn;
    if (sel === '#onboardingCloseBtn') return closeBtn;
    if (sel === '#onboardingStepText') return stepText;
    if (sel === '#onboardingStepIndicator') return stepIndicator;
    return null;
  });
}

// ── hasSeenOnboarding ─────────────────────────────────────────────────────────

describe('hasSeenOnboarding', () => {
  it('returns false when key is absent', () => {
    const storage = makeStorage();
    expect(hasSeenOnboarding(storage)).toBe(false);
  });

  it('returns true when key is exactly "true"', () => {
    const storage = makeStorage({ gamification_onboarding_seen: 'true' });
    expect(hasSeenOnboarding(storage)).toBe(true);
  });

  it('returns false for value "1" (not "true")', () => {
    const storage = makeStorage({ gamification_onboarding_seen: '1' });
    expect(hasSeenOnboarding(storage)).toBe(false);
  });

  it('returns false for value "false"', () => {
    const storage = makeStorage({ gamification_onboarding_seen: 'false' });
    expect(hasSeenOnboarding(storage)).toBe(false);
  });
});

// ── ONBOARDING_STEPS ──────────────────────────────────────────────────────────

describe('ONBOARDING_STEPS', () => {
  it('exports exactly 3 steps', () => {
    expect(ONBOARDING_STEPS).toHaveLength(3);
  });

  it('first step id is earn_points', () => {
    expect(ONBOARDING_STEPS[0].id).toBe('earn_points');
  });

  it('second step id is write_review', () => {
    expect(ONBOARDING_STEPS[1].id).toBe('write_review');
  });

  it('third step id is keep_streak', () => {
    expect(ONBOARDING_STEPS[2].id).toBe('keep_streak');
  });

  it('each step has non-empty text', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.text).toBeTruthy();
    }
  });
});

// ── initOnboarding ────────────────────────────────────────────────────────────

describe('initOnboarding — first visit', () => {
  let elems, $w, storage;

  beforeEach(() => {
    elems   = makeElements();
    $w      = make$w(elems);
    storage = makeStorage();
    globalThis.$w = $w;
  });

  it('shows the overlay on first visit', async () => {
    await initOnboarding('mem-1', { storage });
    expect(elems.overlay.show).toHaveBeenCalledOnce();
  });

  it('renders first step text on init', async () => {
    await initOnboarding('mem-1', { storage });
    expect(elems.stepText.text).toBe(ONBOARDING_STEPS[0].text);
  });

  it('renders step indicator "1 / 3" on init', async () => {
    await initOnboarding('mem-1', { storage });
    expect(elems.stepIndicator.text).toBe('1 / 3');
  });

  it('wires Next, Prev, and Close button handlers', async () => {
    await initOnboarding('mem-1', { storage });
    expect(elems.nextBtn.onClick).toHaveBeenCalledOnce();
    expect(elems.prevBtn.onClick).toHaveBeenCalledOnce();
    expect(elems.closeBtn.onClick).toHaveBeenCalledOnce();
  });
});

describe('initOnboarding — second visit (flag already set)', () => {
  it('does not show overlay when flag is set', async () => {
    const elems   = makeElements();
    const $w      = make$w(elems);
    const storage = makeStorage({ gamification_onboarding_seen: 'true' });
    globalThis.$w = $w;

    await initOnboarding('mem-1', { storage });
    expect(elems.overlay.show).not.toHaveBeenCalled();
  });
});

// ── Next button navigation ────────────────────────────────────────────────────

describe('Next button', () => {
  let elems, $w, storage;

  beforeEach(async () => {
    elems   = makeElements();
    $w      = make$w(elems);
    storage = makeStorage();
    globalThis.$w = $w;
    await initOnboarding('mem-1', { storage });
  });

  it('advances to step 2 and renders its text', async () => {
    await elems.handlers.next();
    expect(elems.stepText.text).toBe(ONBOARDING_STEPS[1].text);
  });

  it('updates step indicator to "2 / 3" after first click', async () => {
    await elems.handlers.next();
    expect(elems.stepIndicator.text).toBe('2 / 3');
  });

  it('advances to step 3 on second click', async () => {
    await elems.handlers.next();
    await elems.handlers.next();
    expect(elems.stepText.text).toBe(ONBOARDING_STEPS[2].text);
    expect(elems.stepIndicator.text).toBe('3 / 3');
  });

  it('hides overlay then marks seen when clicking Next on the last step', async () => {
    await elems.handlers.next(); // → step 2
    await elems.handlers.next(); // → step 3
    await elems.handlers.next(); // last step → close
    expect(elems.overlay.hide).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledWith('gamification_onboarding_seen', 'true');
    // hide() must resolve before markSeen is called
    expect(storage.setItem).toHaveBeenCalledAfter(elems.overlay.hide);
  });

  it('does not call show again after advancing steps', async () => {
    await elems.handlers.next();
    await elems.handlers.next();
    expect(elems.overlay.show).toHaveBeenCalledOnce();
  });
});

// ── Prev button navigation ────────────────────────────────────────────────────

describe('Prev button', () => {
  let elems, $w, storage;

  beforeEach(async () => {
    elems   = makeElements();
    $w      = make$w(elems);
    storage = makeStorage();
    globalThis.$w = $w;
    await initOnboarding('mem-1', { storage });
  });

  it('goes back to step 1 after advancing to step 2', async () => {
    await elems.handlers.next();
    elems.handlers.prev();
    expect(elems.stepText.text).toBe(ONBOARDING_STEPS[0].text);
    expect(elems.stepIndicator.text).toBe('1 / 3');
  });

  it('is a no-op when already on the first step', async () => {
    elems.handlers.prev();
    expect(elems.stepText.text).toBe(ONBOARDING_STEPS[0].text);
    expect(elems.stepIndicator.text).toBe('1 / 3');
  });
});

// ── Close button ──────────────────────────────────────────────────────────────

describe('Close button', () => {
  let elems, $w, storage;

  beforeEach(async () => {
    elems   = makeElements();
    $w      = make$w(elems);
    storage = makeStorage();
    globalThis.$w = $w;
    await initOnboarding('mem-1', { storage });
  });

  it('hides overlay then marks seen when close is clicked', async () => {
    await elems.handlers.close();
    expect(elems.overlay.hide).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledWith('gamification_onboarding_seen', 'true');
    expect(storage.setItem).toHaveBeenCalledAfter(elems.overlay.hide);
  });

  it('does not advance step when close is clicked on step 1', async () => {
    await elems.handlers.close();
    expect(elems.stepText.text).toBe(ONBOARDING_STEPS[0].text);
  });
});

// ── Graceful error recovery ───────────────────────────────────────────────────

describe('initOnboarding — graceful error recovery', () => {
  it('does not throw when overlay element throws on show', async () => {
    const elems = makeElements();
    elems.overlay.show = vi.fn().mockRejectedValue(new Error('element unavailable'));
    const $w = make$w(elems);
    globalThis.$w = $w;
    const storage = makeStorage();

    await expect(initOnboarding('mem-1', { storage })).resolves.toBeUndefined();
  });

  it('does not set seen flag when overlay.show throws (overlay never appeared)', async () => {
    const elems = makeElements();
    elems.overlay.show = vi.fn().mockRejectedValue(new Error('element unavailable'));
    const $w = make$w(elems);
    globalThis.$w = $w;
    const storage = makeStorage();

    await initOnboarding('mem-1', { storage });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('does not mark seen when Close hide() throws', async () => {
    const elems = makeElements();
    elems.overlay.hide = vi.fn().mockRejectedValue(new Error('hide failed'));
    const $w = make$w(elems);
    globalThis.$w = $w;
    const storage = makeStorage();

    await initOnboarding('mem-1', { storage });
    await elems.handlers.close();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('does not mark seen when last-step Next hide() throws', async () => {
    const elems = makeElements();
    elems.overlay.hide = vi.fn().mockRejectedValue(new Error('hide failed'));
    const $w = make$w(elems);
    globalThis.$w = $w;
    const storage = makeStorage();

    await initOnboarding('mem-1', { storage });
    await elems.handlers.next(); // step 2
    await elems.handlers.next(); // step 3
    await elems.handlers.next(); // last step → attempts hide
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
