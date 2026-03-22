/**
 * sessionTimer.test.ts — useSessionTimer hook and helper unit tests.
 *
 * Covers:
 *  - computePace: returns 0 before MIN_PACE_ELAPSED_MS, correct rate after
 *  - formatElapsed: M:SS and H:MM:SS formats
 *  - loadHistory: returns [] on empty/invalid localStorage; parses valid data
 *  - useSessionTimer: starts on first recordApply, ticks, auto-pauses on visibilitychange, persists to history on unmount
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  computePace,
  formatElapsed,
  loadHistory,
  useSessionTimer,
} from '../src/hooks/useSessionTimer.js';

// ── localStorage mock ─────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── computePace ───────────────────────────────────────────────────────────────

describe('computePace', () => {
  it('returns 0 when applyCount is 0', () => {
    expect(computePace(0, 10_000)).toBe(0);
  });

  it('returns 0 when elapsed < MIN_PACE_ELAPSED_MS (5000ms)', () => {
    expect(computePace(5, 4_999)).toBe(0);
  });

  it('returns 0 exactly at elapsed === 0', () => {
    expect(computePace(10, 0)).toBe(0);
  });

  it('computes correct rate at exactly MIN_PACE_ELAPSED_MS threshold', () => {
    // 1 apply in 5s = 720/hr
    expect(computePace(1, 5_000)).toBeCloseTo(720, 0);
  });

  it('computes correct rate for 10 applies in 1 hour', () => {
    expect(computePace(10, 3_600_000)).toBeCloseTo(10, 5);
  });

  it('computes correct rate for 60 applies in 30 minutes', () => {
    expect(computePace(60, 1_800_000)).toBeCloseTo(120, 5);
  });
});

// ── formatElapsed ─────────────────────────────────────────────────────────────

describe('formatElapsed', () => {
  it('formats 0ms as 0:00', () => {
    expect(formatElapsed(0)).toBe('0:00');
  });

  it('formats 59 seconds as 0:59', () => {
    expect(formatElapsed(59_000)).toBe('0:59');
  });

  it('formats 60 seconds as 1:00', () => {
    expect(formatElapsed(60_000)).toBe('1:00');
  });

  it('formats 90 seconds as 1:30', () => {
    expect(formatElapsed(90_000)).toBe('1:30');
  });

  it('formats exactly 1 hour as 1:00:00', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
  });

  it('formats 1h 2m 3s as 1:02:03', () => {
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
  });

  it('formats sub-second ms as 0:00', () => {
    expect(formatElapsed(500)).toBe('0:00');
  });
});

// ── loadHistory ───────────────────────────────────────────────────────────────

describe('loadHistory', () => {
  it('returns [] when localStorage is empty', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('returns [] on invalid JSON', () => {
    localStorageMock.setItem('cf-hookup-session-history', '{bad json');
    expect(loadHistory()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    localStorageMock.setItem('cf-hookup-session-history', JSON.stringify({ foo: 1 }));
    expect(loadHistory()).toEqual([]);
  });

  it('returns stored records when data is valid', () => {
    const records = [
      { date: '2026-01-01T00:00:00.000Z', elapsed: 60000, applyCount: 5, pace: 300 },
    ];
    localStorageMock.setItem('cf-hookup-session-history', JSON.stringify(records));
    expect(loadHistory()).toEqual(records);
  });
});

// ── useSessionTimer hook ──────────────────────────────────────────────────────

describe('useSessionTimer — initial state', () => {
  it('starts not started, elapsed 0, applyCount 0, not paused', () => {
    const { result } = renderHook(() => useSessionTimer());
    expect(result.current.started).toBe(false);
    expect(result.current.elapsed).toBe(0);
    expect(result.current.applyCount).toBe(0);
    expect(result.current.paused).toBe(false);
    expect(result.current.pace).toBe(0);
  });
});

describe('useSessionTimer — recordApply', () => {
  it('starts the timer on first recordApply', () => {
    const { result } = renderHook(() => useSessionTimer());
    act(() => result.current.recordApply());
    expect(result.current.started).toBe(true);
    expect(result.current.applyCount).toBe(1);
  });

  it('increments applyCount on each call', () => {
    const { result } = renderHook(() => useSessionTimer());
    act(() => result.current.recordApply());
    act(() => result.current.recordApply());
    act(() => result.current.recordApply());
    expect(result.current.applyCount).toBe(3);
  });

  it('advances elapsed after tick interval', () => {
    const { result } = renderHook(() => useSessionTimer());
    act(() => result.current.recordApply());
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.elapsed).toBeGreaterThanOrEqual(3000);
  });
});

describe('useSessionTimer — auto-pause on visibilitychange', () => {
  it('pauses when document becomes hidden', () => {
    const { result } = renderHook(() => useSessionTimer());
    act(() => result.current.recordApply());

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });

    expect(result.current.paused).toBe(true);
  });

  it('resumes when document becomes visible again', () => {
    const { result } = renderHook(() => useSessionTimer());
    act(() => result.current.recordApply());

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.paused).toBe(true);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.paused).toBe(false);
  });

  it('does not resume if session never started', () => {
    const { result } = renderHook(() => useSessionTimer());
    // No recordApply — session not started
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    // Should remain not-started
    expect(result.current.started).toBe(false);
  });
});

describe('useSessionTimer — elapsed does not advance while paused', () => {
  it('elapsed stays the same while paused', () => {
    const { result } = renderHook(() => useSessionTimer());
    act(() => result.current.recordApply());

    // Let 2s tick
    act(() => { vi.advanceTimersByTime(2000); });
    const elapsedBeforePause = result.current.elapsed;

    // Pause
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });

    // Advance 5s while paused
    act(() => { vi.advanceTimersByTime(5000); });

    expect(result.current.elapsed).toBe(elapsedBeforePause);
  });
});

describe('useSessionTimer — persists to history on unmount', () => {
  it('writes a session record to localStorage on unmount after start', () => {
    const { result, unmount } = renderHook(() => useSessionTimer());
    act(() => result.current.recordApply());
    act(() => { vi.advanceTimersByTime(1000); });
    unmount();

    const saved = loadHistory();
    expect(saved).toHaveLength(1);
    expect(saved[0].applyCount).toBe(1);
    expect(saved[0].elapsed).toBeGreaterThan(0);
  });

  it('does not write a record if session never started', () => {
    const { unmount } = renderHook(() => useSessionTimer());
    unmount();
    expect(loadHistory()).toHaveLength(0);
  });
});
