import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTodayET, getYesterdayET } from '../src/backend/utils/dateUtils.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('getTodayET', () => {
  it('returns today as YYYY-MM-DD in Eastern time (EST offset)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z')); // noon UTC = 8am ET (EST = UTC-5)
    expect(getTodayET()).toBe('2026-03-15');
  });

  it('returns previous ET day when UTC time is before midnight ET (Jan, EST=UTC-5)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T04:00:00Z')); // 4am UTC = 11pm EST Jan 14 (EST=UTC-5)
    expect(getTodayET()).toBe('2026-01-14');
  });

  it('returns correct date at midnight ET (4am UTC = 00:00 EDT on March 15, post-spring-forward)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T04:00:00Z')); // 4am UTC = 00:00 EDT (UTC-4 after March 8 spring-forward)
    expect(getTodayET()).toBe('2026-03-15');
  });
});

describe('getYesterdayET', () => {
  it('returns yesterday as YYYY-MM-DD in Eastern time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // noon UTC = 10am EDT
    expect(getYesterdayET()).toBe('2026-03-21');
  });

  it('handles month boundary: March 1 → February 28', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T14:00:00Z')); // noon UTC = 9am ET (March 1, EST)
    expect(getYesterdayET()).toBe('2026-02-28');
  });

  it('handles year boundary: Jan 1 → Dec 31 of prior year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T14:00:00Z')); // noon UTC = 9am ET (Jan 1, EST)
    expect(getYesterdayET()).toBe('2025-12-31');
  });

  it('handles US spring-forward DST night (March 8 2026: clocks go 2am→3am)', () => {
    vi.useFakeTimers();
    // 3:30am EDT March 8 2026 (first moment after spring-forward) = 7:30am UTC March 8
    vi.setSystemTime(new Date('2026-03-08T07:30:00Z'));
    // getYesterdayET() must return March 7, not March 8
    expect(getYesterdayET()).toBe('2026-03-07');
  });

  it('handles US fall-back DST night (Nov 1 2026: clocks go 2am→1am)', () => {
    vi.useFakeTimers();
    // 1:30am EST Nov 1 2026 (second occurrence, after fall-back) = 6:30am UTC Nov 1
    vi.setSystemTime(new Date('2026-11-01T06:30:00Z'));
    // getYesterdayET() must return Oct 31, not Nov 1
    expect(getYesterdayET()).toBe('2026-10-31');
  });
});
