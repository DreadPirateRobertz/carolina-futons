import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTodayET, getYesterdayET, getYesterdayOf, tsToETDate, getNextETMidnightUTC, computeStreakDanger } from '../src/backend/utils/dateUtils.js';

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

// ── getNextETMidnightUTC ──────────────────────────────────────────────────────

describe('getNextETMidnightUTC', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns next ET midnight as UTC ms — standard EST day (UTC-5)', () => {
    vi.useFakeTimers();
    // 2026-03-05 14:00 UTC = 9:00 AM EST (UTC-5) — before spring-forward (Mar 8)
    vi.setSystemTime(new Date('2026-03-05T14:00:00Z'));
    const result = getNextETMidnightUTC();
    // Next ET midnight = 2026-03-06 00:00 EST = 2026-03-06T05:00:00Z
    expect(result).toBe(new Date('2026-03-06T05:00:00Z').getTime());
  });

  it('returns next ET midnight as UTC ms — standard EDT day (UTC-4)', () => {
    vi.useFakeTimers();
    // 2026-03-22 14:00 UTC = 10:00 AM EDT (UTC-4) — well before midnight
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    const result = getNextETMidnightUTC();
    // Next ET midnight = 2026-03-23 00:00 EDT = 2026-03-23T04:00:00Z
    expect(result).toBe(new Date('2026-03-23T04:00:00Z').getTime());
  });

  it('handles spring-forward night: 2026-03-08 (ET clocks go 2am→3am)', () => {
    vi.useFakeTimers();
    // 2026-03-08 06:00 UTC = 1:00 AM EST (clocks jump at 2am; still EST at 1am)
    vi.setSystemTime(new Date('2026-03-08T06:00:00Z'));
    const result = getNextETMidnightUTC();
    // Next midnight is 2026-03-09 00:00 EDT (UTC-4) = 2026-03-09T04:00:00Z
    expect(result).toBe(new Date('2026-03-09T04:00:00Z').getTime());
  });

  it('handles fall-back night: 2026-11-01 (ET clocks go 2am→1am)', () => {
    vi.useFakeTimers();
    // 2026-11-01 06:00 UTC = 2:00 AM EDT (one hour before fall-back repeats 1am)
    vi.setSystemTime(new Date('2026-11-01T06:00:00Z'));
    const result = getNextETMidnightUTC();
    // Next midnight is 2026-11-02 00:00 EST (UTC-5) = 2026-11-02T05:00:00Z
    expect(result).toBe(new Date('2026-11-02T05:00:00Z').getTime());
  });

  it('returns a value greater than Date.now()', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T20:00:00Z'));
    expect(getNextETMidnightUTC()).toBeGreaterThan(Date.now());
  });
});

// ── tsToETDate ────────────────────────────────────────────────────────────────

describe('tsToETDate', () => {
  it('converts Unix timestamp (seconds) to ET date — standard EST day', () => {
    // 2026-01-15 12:00:00 UTC = 7:00 AM EST (UTC-5) → ET date is 2026-01-15
    const ts = Math.floor(new Date('2026-01-15T12:00:00Z').getTime() / 1000);
    expect(tsToETDate(ts)).toBe('2026-01-15');
  });

  it('returns previous ET day when UTC timestamp is before ET midnight (EST)', () => {
    // 2026-01-15 04:30:00 UTC = 11:30 PM EST Jan 14 (UTC-5) → ET date is 2026-01-14
    const ts = Math.floor(new Date('2026-01-15T04:30:00Z').getTime() / 1000);
    expect(tsToETDate(ts)).toBe('2026-01-14');
  });

  it('converts Unix timestamp to ET date — EDT day (UTC-4)', () => {
    // 2026-03-22 03:30:00 UTC = 11:30 PM EDT March 21 (UTC-4) → ET date is 2026-03-21
    const ts = Math.floor(new Date('2026-03-22T03:30:00Z').getTime() / 1000);
    expect(tsToETDate(ts)).toBe('2026-03-21');
  });

  it('handles an event at exactly ET midnight (not before) → correct current day', () => {
    // 2026-03-22 04:00:00 UTC = 00:00:00 EDT March 22 (UTC-4) → ET date is 2026-03-22
    const ts = Math.floor(new Date('2026-03-22T04:00:00Z').getTime() / 1000);
    expect(tsToETDate(ts)).toBe('2026-03-22');
  });
});

// ── getYesterdayOf ────────────────────────────────────────────────────────────

describe('getYesterdayOf', () => {
  it('returns the day before a given ET date string', () => {
    expect(getYesterdayOf('2026-03-22')).toBe('2026-03-21');
  });

  it('handles month boundary', () => {
    expect(getYesterdayOf('2026-03-01')).toBe('2026-02-28');
  });

  it('handles year boundary', () => {
    expect(getYesterdayOf('2026-01-01')).toBe('2025-12-31');
  });

  it('getYesterdayET() is equivalent to getYesterdayOf(getTodayET())', () => {
    // Both must agree — getYesterdayET is now implemented as getYesterdayOf(getTodayET())
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    expect(getYesterdayET()).toBe(getYesterdayOf(getTodayET()));
    vi.useRealTimers();
  });
});

// ── computeStreakDanger ───────────────────────────────────────────────────────

describe('computeStreakDanger', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns true when inactive today AND < 4h until ET midnight', () => {
    vi.useFakeTimers();
    // 2026-03-22 03:00 UTC = 11:00 PM EDT (1h to midnight)
    vi.setSystemTime(new Date('2026-03-22T03:00:00Z'));
    // todayET = '2026-03-21', lastActivityDate = '2026-03-20' (not today)
    expect(computeStreakDanger('2026-03-20', '2026-03-21')).toBe(true);
  });

  it('returns false when already active today', () => {
    vi.useFakeTimers();
    // 2026-03-22 03:00 UTC = 11:00 PM EDT — < 4h window
    vi.setSystemTime(new Date('2026-03-22T03:00:00Z'));
    // lastActivityDate matches todayET → not in danger
    expect(computeStreakDanger('2026-03-21', '2026-03-21')).toBe(false);
  });

  it('returns false when > 4h until ET midnight', () => {
    vi.useFakeTimers();
    // 2026-03-22 14:00 UTC = 10:00 AM EDT — 14h to midnight
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    expect(computeStreakDanger('2026-03-21', '2026-03-22')).toBe(false);
  });

  it('returns false when lastActivityDate is null/undefined (new member)', () => {
    vi.useFakeTimers();
    // < 4h window
    vi.setSystemTime(new Date('2026-03-22T03:00:00Z'));
    expect(computeStreakDanger(null, '2026-03-21')).toBe(false);
    expect(computeStreakDanger(undefined, '2026-03-21')).toBe(false);
  });

  it('DST spring-forward: danger window uses correct UTC offset (5am UTC = midnight EDT)', () => {
    vi.useFakeTimers();
    // 2026-03-09 03:00 UTC = 11:00 PM EDT on March 8 (1h before spring-forward midnight)
    vi.setSystemTime(new Date('2026-03-09T03:00:00Z'));
    // todayET = '2026-03-08', lastActivityDate = '2026-03-07'
    expect(computeStreakDanger('2026-03-07', '2026-03-08')).toBe(true);
  });
});
