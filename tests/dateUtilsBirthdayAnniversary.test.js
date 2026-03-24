/**
 * @file dateUtilsBirthdayAnniversary.test.js
 * @description TDD tests for CF-p6v2 date helpers:
 *   isBirthdayWindow — 7-day window (±3 days) around a birthday MM-DD
 *   getAnniversaryYear — returns 1 or 2 when todayET is the 1- or 2-year
 *                        anniversary of a date, else null
 */
import { describe, it, expect } from 'vitest';
import {
  isBirthdayWindow,
  getAnniversaryYear,
} from '../src/backend/utils/dateUtils.js';

// ── isBirthdayWindow ──────────────────────────────────────────────────────────

describe('isBirthdayWindow', () => {
  it('returns true when today IS the birthday', () => {
    expect(isBirthdayWindow('03-22', '2026-03-22')).toBe(true);
  });

  it('returns true when today is 1 day before birthday', () => {
    expect(isBirthdayWindow('03-22', '2026-03-21')).toBe(true);
  });

  it('returns true when today is 3 days before birthday', () => {
    expect(isBirthdayWindow('03-22', '2026-03-19')).toBe(true);
  });

  it('returns false when today is 4 days before birthday', () => {
    expect(isBirthdayWindow('03-22', '2026-03-18')).toBe(false);
  });

  it('returns true when today is 3 days after birthday', () => {
    expect(isBirthdayWindow('03-22', '2026-03-25')).toBe(true);
  });

  it('returns false when today is 4 days after birthday', () => {
    expect(isBirthdayWindow('03-22', '2026-03-26')).toBe(false);
  });

  // Dec/Jan year-boundary
  it('returns true when birthday is Dec 31 and today is Jan 2 (within 3 days, next year)', () => {
    expect(isBirthdayWindow('12-31', '2026-01-02')).toBe(true);
  });

  it('returns true when birthday is Jan 1 and today is Dec 30 (within 3 days, prev year)', () => {
    expect(isBirthdayWindow('01-01', '2025-12-30')).toBe(true);
  });

  it('returns false when birthday is Dec 31 and today is Jan 5 (4 days after)', () => {
    expect(isBirthdayWindow('12-31', '2026-01-05')).toBe(false);
  });

  // Feb 29 birthday in non-leap year — treated as Feb 28
  it('returns true for Feb 29 birthday in non-leap year when today is Feb 28', () => {
    // 2026 is not a leap year; Feb 29 birthday → treated as Feb 28
    expect(isBirthdayWindow('02-29', '2026-02-28')).toBe(true);
  });

  it('returns true for Feb 29 birthday in non-leap year when today is Feb 26 (2 days before Feb 28)', () => {
    expect(isBirthdayWindow('02-29', '2026-02-26')).toBe(true);
  });

  it('returns true for Feb 29 birthday in an actual leap year when today is Feb 29', () => {
    // 2028 is a leap year
    expect(isBirthdayWindow('02-29', '2028-02-29')).toBe(true);
  });

  // Guard clauses
  it('returns false when birthdayMMDD is null', () => {
    expect(isBirthdayWindow(null, '2026-03-22')).toBe(false);
  });

  it('returns false when todayET is null', () => {
    expect(isBirthdayWindow('03-22', null)).toBe(false);
  });
});

// ── getAnniversaryYear ────────────────────────────────────────────────────────

describe('getAnniversaryYear', () => {
  it('returns 1 when today is exactly the 1-year anniversary', () => {
    expect(getAnniversaryYear('2025-06-15', '2026-06-15')).toBe(1);
  });

  it('returns 2 when today is exactly the 2-year anniversary', () => {
    expect(getAnniversaryYear('2024-06-15', '2026-06-15')).toBe(2);
  });

  it('returns null when today is not an anniversary', () => {
    expect(getAnniversaryYear('2025-06-15', '2026-06-16')).toBeNull();
  });

  it('returns null for 3-year anniversary (only 1 and 2 are rewarded)', () => {
    expect(getAnniversaryYear('2023-06-15', '2026-06-15')).toBeNull();
  });

  it('returns null when firstPurchaseDate is null', () => {
    expect(getAnniversaryYear(null, '2026-06-15')).toBeNull();
  });

  it('returns null when firstPurchaseDate is empty string', () => {
    expect(getAnniversaryYear('', '2026-06-15')).toBeNull();
  });

  it('returns null when todayET is null', () => {
    expect(getAnniversaryYear('2025-06-15', null)).toBeNull();
  });

  // Feb 29 first purchase in non-leap anniversary year
  it('returns 1 for Feb 29 first purchase when 1-year anniversary falls in non-leap year (Feb 28)', () => {
    // First purchase: 2024-02-29 (2024 is a leap year)
    // 1-year anniversary: 2025-02-29 doesn't exist → Feb 28
    expect(getAnniversaryYear('2024-02-29', '2025-02-28')).toBe(1);
  });

  it('does not return 1 for Feb 29 first purchase on Mar 1 in non-leap year (outside window)', () => {
    expect(getAnniversaryYear('2024-02-29', '2025-03-01')).toBeNull();
  });

  // Multiple anniversary edge case: same MM-DD, different year diffs
  it('returns 2 not 1 when today is the 2-year anniversary (year diff is 2)', () => {
    // 2024-03-01 first purchase; 2026-03-01 is 2-year anniversary
    expect(getAnniversaryYear('2024-03-01', '2026-03-01')).toBe(2);
  });
});
