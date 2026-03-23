/**
 * @file living-sky-wix.test.js
 * @description TDD tests for CF-ad3: living-sky-wix.js Wix Velo integration shim.
 *
 * Covers:
 *  - initLivingSky: calls useLivingSky with correct totalMinutes on load
 *  - initLivingSky: calls postMessage on #livingSkyFrame with state
 *  - initLivingSky: starts 60s interval when not reduced-motion
 *  - initLivingSky: reduced-motion — renders once, no interval
 *  - updateSkyToState: calls postMessage on #livingSkyFrame
 *  - updateSkyToState: gracefully ignores missing element
 *  - State at midnight (totalMinutes=0) posts to frame
 *  - State at noon (totalMinutes=720) posts to frame
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── $w mock ───────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    postMessage: vi.fn(),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

globalThis.$w = (sel) => getEl(sel);

// ── Hoisted mock refs ──────────────────────────────────────────────────────────

const livingSkyMocks = vi.hoisted(() => ({
  useLivingSky: vi.fn(),
}));

// ── vi.mock calls ──────────────────────────────────────────────────────────────

vi.mock('public/living-sky.js', () => ({
  useLivingSky: livingSkyMocks.useLivingSky,
}));

// ── Default mock state factory ────────────────────────────────────────────────

function makeMockState(overrides = {}) {
  return {
    skyColors: ['#1A2A3C', '#1A2A3C', '#1A2A3C', '#1A2A3C'],
    glowColors: ['#1A2A3C', '#1A2A3C'],
    ridgeColors: { r1: '#1A2A3C', r2: '#1A2A3C', r3: '#2A3848', r4: '#3A4858', tree: '#101820' },
    sunPos: { cx: 70, cy: 200, r: 12, opacity: 0 },
    moonPos: { cx: 730, cy: 28, opacity: 0.9, phase: 0.5, shadowOffset: { dx: 5, dy: 0 } },
    starOpacity: 0.95,
    cloudOpacity: 0,
    birdOpacity: 0,
    ...overrides,
  };
}

const NOON_STATE = makeMockState({
  skyColors: ['#3A78A8', '#6098B8', '#80B0C8', '#A0C8D8'],
  glowColors: ['#FFE080', '#FFF0A0'],
  ridgeColors: { r1: '#2A3A50', r2: '#5B8FA8', r3: '#8BB5C9', r4: '#B8D4E3', tree: '#1A2830' },
  sunPos: { cx: 520, cy: 10, r: 14, opacity: 1 },
  moonPos: { cx: 730, cy: 200, opacity: 0, phase: 0.5, shadowOffset: { dx: 0, dy: 0 } },
  starOpacity: 0,
  cloudOpacity: 0.2,
  birdOpacity: 0.8,
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Default: return deep-night state
  livingSkyMocks.useLivingSky.mockReturnValue(makeMockState());
});

afterEach(() => {
  vi.useRealTimers();
});

// ── updateSkyToState ──────────────────────────────────────────────────────────

describe('updateSkyToState', () => {
  it('calls postMessage on #livingSkyFrame with the state', async () => {
    const { updateSkyToState } = await import('../src/public/living-sky-wix.js');
    const state = makeMockState();
    updateSkyToState($w, state);
    expect(getEl('#livingSkyFrame').postMessage).toHaveBeenCalledWith(state);
  });

  it('does not throw when #livingSkyFrame is missing (element throws)', async () => {
    const { updateSkyToState } = await import('../src/public/living-sky-wix.js');
    // Make element throw on postMessage (simulates missing HtmlComponent)
    getEl('#livingSkyFrame').postMessage = vi.fn().mockImplementation(() => {
      throw new Error('element not found');
    });
    expect(() => updateSkyToState($w, makeMockState())).not.toThrow();
  });
});

// ── initLivingSky — core wiring ───────────────────────────────────────────────

describe('initLivingSky — on load', () => {
  it('calls useLivingSky with current totalMinutes on page load', async () => {
    vi.setSystemTime(new Date('2026-03-23T14:30:00'));
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w);
    // 14h * 60 + 30min = 870
    expect(livingSkyMocks.useLivingSky).toHaveBeenCalledWith(870);
  });

  it('calls postMessage on #livingSkyFrame with state from useLivingSky', async () => {
    const state = makeMockState({ starOpacity: 0.42 });
    livingSkyMocks.useLivingSky.mockReturnValue(state);
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w);
    expect(getEl('#livingSkyFrame').postMessage).toHaveBeenCalledWith(state);
  });

  it('starts a 60s interval for live updates (default, no reduced motion)', async () => {
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w);
    const callCount = livingSkyMocks.useLivingSky.mock.calls.length;
    vi.advanceTimersByTime(60_000);
    expect(livingSkyMocks.useLivingSky.mock.calls.length).toBe(callCount + 1);
    vi.advanceTimersByTime(60_000);
    expect(livingSkyMocks.useLivingSky.mock.calls.length).toBe(callCount + 2);
  });

  it('interval posts updated state each tick', async () => {
    const state2 = makeMockState({ starOpacity: 0.7 });
    livingSkyMocks.useLivingSky.mockReturnValueOnce(makeMockState());
    livingSkyMocks.useLivingSky.mockReturnValueOnce(state2);
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w);
    vi.advanceTimersByTime(60_000);
    expect(getEl('#livingSkyFrame').postMessage).toHaveBeenLastCalledWith(state2);
  });

  it('stop() clears the interval', async () => {
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    const { stop } = initLivingSky($w);
    const callCount = livingSkyMocks.useLivingSky.mock.calls.length;
    stop();
    vi.advanceTimersByTime(120_000);
    // No additional calls after stop
    expect(livingSkyMocks.useLivingSky.mock.calls.length).toBe(callCount);
  });
});

// ── initLivingSky — reduced motion ───────────────────────────────────────────

describe('initLivingSky — reduced motion', () => {
  it('renders once immediately', async () => {
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w, { reducedMotion: true });
    expect(livingSkyMocks.useLivingSky).toHaveBeenCalledTimes(1);
    expect(getEl('#livingSkyFrame').postMessage).toHaveBeenCalledTimes(1);
  });

  it('does not start an interval', async () => {
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w, { reducedMotion: true });
    vi.advanceTimersByTime(300_000); // 5 minutes
    expect(livingSkyMocks.useLivingSky).toHaveBeenCalledTimes(1);
  });
});

// ── Time boundary correctness ──────────────────────────────────────────────────

describe('initLivingSky — time boundaries', () => {
  it('midnight (00:00) uses totalMinutes=0', async () => {
    vi.setSystemTime(new Date('2026-03-23T00:00:00'));
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w);
    expect(livingSkyMocks.useLivingSky).toHaveBeenCalledWith(0);
  });

  it('noon (12:00) uses totalMinutes=720', async () => {
    vi.setSystemTime(new Date('2026-03-23T12:00:00'));
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w);
    expect(livingSkyMocks.useLivingSky).toHaveBeenCalledWith(720);
  });

  it('noon state gets posted to frame', async () => {
    vi.setSystemTime(new Date('2026-03-23T12:00:00'));
    livingSkyMocks.useLivingSky.mockReturnValue(NOON_STATE);
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w);
    expect(getEl('#livingSkyFrame').postMessage).toHaveBeenCalledWith(NOON_STATE);
  });

  it('midnight state gets posted to frame', async () => {
    vi.setSystemTime(new Date('2026-03-23T00:00:00'));
    const midnightState = makeMockState();
    livingSkyMocks.useLivingSky.mockReturnValue(midnightState);
    const { initLivingSky } = await import('../src/public/living-sky-wix.js');
    initLivingSky($w);
    expect(getEl('#livingSkyFrame').postMessage).toHaveBeenCalledWith(midnightState);
  });
});
