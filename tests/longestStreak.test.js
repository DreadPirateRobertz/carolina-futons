/**
 * @file longestStreak.test.js
 * @description TDD tests for CF-qsxp: longestStreakDays tracking in updateStreakState.
 *
 * BUG: longestStreakDays is never computed or persisted by updateStreakState().
 *      getStreakData falls back to currentStreak, which is wrong after a streak break.
 *
 * Covers:
 *  - longestStreakDays returned from every branch of updateStreakState
 *  - longestStreakDays = max(current, historical) on increment
 *  - longestStreakDays preserved on streak reset (does NOT fall to 1)
 *  - longestStreakDays preserved on same-day revisit
 *  - longestStreakDays preserved on grace token use
 *  - getStreakData returns correct longestStreak from record
 *  - widget displays historical longest, not current after break
 *
 * CF-qsxp
 */
import { describe, it, expect, vi } from 'vitest';
import { updateStreakState } from '../src/backend/gamificationCore.web.js';
import { initStreakTrackerWidget } from '../src/public/StreakTrackerWidget.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = '2026-03-24';
const YESTERDAY = '2026-03-23';
const TWO_DAYS_AGO = '2026-03-22';
const THREE_DAYS_AGO = '2026-03-21';

function makeRecord(overrides = {}) {
  return {
    currentStreakDays: 0,
    streakStartDate: TODAY,
    lastActivityDate: null,
    streakMultiplier: 1,
    graceTokenUsedDate: null,
    longestStreakDays: 0,
    ...overrides,
  };
}

// ── updateStreakState: longestStreakDays tracking ─────────────────────────────

describe('updateStreakState — longestStreakDays', () => {
  describe('Branch 1: already active today', () => {
    it('preserves longestStreakDays when revisiting same day', () => {
      const record = makeRecord({
        currentStreakDays: 5,
        lastActivityDate: TODAY,
        longestStreakDays: 15,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.longestStreakDays).toBe(15);
    });

    it('preserves longestStreakDays even when current > longest on same day', () => {
      // This shouldn't happen in practice but tests defensive behavior
      const record = makeRecord({
        currentStreakDays: 20,
        lastActivityDate: TODAY,
        longestStreakDays: 15,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.longestStreakDays).toBe(20);
    });
  });

  describe('Branch 2: active yesterday — increment streak', () => {
    it('updates longestStreakDays when new streak exceeds historical', () => {
      const record = makeRecord({
        currentStreakDays: 10,
        lastActivityDate: YESTERDAY,
        longestStreakDays: 10,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      // streak increments to 11, which exceeds longest of 10
      expect(result.currentStreakDays).toBe(11);
      expect(result.longestStreakDays).toBe(11);
    });

    it('preserves longestStreakDays when current streak is still below historical', () => {
      const record = makeRecord({
        currentStreakDays: 3,
        lastActivityDate: YESTERDAY,
        longestStreakDays: 30,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(4);
      expect(result.longestStreakDays).toBe(30);
    });

    it('initializes longestStreakDays from first streak increment', () => {
      const record = makeRecord({
        currentStreakDays: 1,
        lastActivityDate: YESTERDAY,
        // longestStreakDays not set (legacy record)
        longestStreakDays: undefined,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(2);
      expect(result.longestStreakDays).toBe(2);
    });
  });

  describe('Branch 3a: grace token — streak preserved', () => {
    it('preserves longestStreakDays when grace token is used', () => {
      const record = makeRecord({
        currentStreakDays: 15,
        lastActivityDate: TWO_DAYS_AGO,
        longestStreakDays: 25,
        graceTokenUsedDate: null,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.graceApplied).toBe(true);
      expect(result.longestStreakDays).toBe(25);
    });
  });

  describe('Branch 3b: streak break — reset to 1', () => {
    it('preserves longestStreakDays on streak break (THE BUG)', () => {
      const record = makeRecord({
        currentStreakDays: 30,
        lastActivityDate: THREE_DAYS_AGO,
        longestStreakDays: 30,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      // Streak resets to 1, but longestStreakDays must stay 30
      expect(result.currentStreakDays).toBe(1);
      expect(result.longestStreakDays).toBe(30);
    });

    it('preserves longestStreakDays when it exceeds the broken streak', () => {
      const record = makeRecord({
        currentStreakDays: 5,
        lastActivityDate: THREE_DAYS_AGO,
        longestStreakDays: 45,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(1);
      expect(result.longestStreakDays).toBe(45);
    });

    it('sets longestStreakDays from current when no historical (legacy record)', () => {
      const record = makeRecord({
        currentStreakDays: 12,
        lastActivityDate: THREE_DAYS_AGO,
        longestStreakDays: undefined,
      });
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(1);
      // Should capture the pre-break streak as longest
      expect(result.longestStreakDays).toBe(12);
    });
  });
});

// ── Widget: displays historical longest after break ──────────────────────────

describe('StreakTrackerWidget — longestStreak after break', () => {
  function makeEl() {
    return {
      text: '',
      _visible: true,
      _classes: [],
      show: vi.fn(function () { this._visible = true; }),
      hide: vi.fn(function () { this._visible = false; }),
      addClass: vi.fn(function (cls) { this._classes.push(cls); }),
    };
  }

  function make$w() {
    const els = {
      '#streakCount': makeEl(),
      '#longestStreak': makeEl(),
      '#streakFlameIcon': makeEl(),
      '#streakMultiplierLabel': makeEl(),
      '#noStreakMsg': makeEl(),
    };
    const $w = (id) => els[id] ?? makeEl();
    $w._els = els;
    return $w;
  }

  it('displays historical longest (30) not current (2) after streak break', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getStreakData: vi.fn().mockResolvedValue({
        currentStreak: 2,
        longestStreak: 30,
        lastActivityDate: '2026-03-24',
      }),
    };
    await initStreakTrackerWidget('mem-test', opts);
    expect($w._els['#streakCount'].text).toBe('2 day streak');
    expect($w._els['#longestStreak'].text).toBe('Best: 30 days');
  });

  it('shows same value when current equals longest (no break)', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getStreakData: vi.fn().mockResolvedValue({
        currentStreak: 15,
        longestStreak: 15,
        lastActivityDate: '2026-03-24',
      }),
    };
    await initStreakTrackerWidget('mem-test', opts);
    expect($w._els['#streakCount'].text).toBe('15 day streak');
    expect($w._els['#longestStreak'].text).toBe('Best: 15 days');
  });
});
