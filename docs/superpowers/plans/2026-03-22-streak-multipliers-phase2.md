# Streak Multipliers — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily-streak multiplier system to `gamificationEventReceiver.web.js` that boosts point awards (1×/1.5×/2×) based on consecutive ET-day activity, with a 7-day milestone bonus and Member Page display.

**Architecture:** Streak state (4 new fields) lives in the existing `MemberPoints` CMS collection. On every qualifying event, the receiver reads the record, computes the new streak state in a pure helper, applies the multiplier to base points, and writes everything in one DB write. A shared `dateUtils.js` backend helper provides DST-safe ET date functions for both this feature and the Phase 1 spin wheel. A `StreakDisplay.js` frontend module renders the streak chip and toast in `Member Page.js`.

**Tech Stack:** Wix Velo JS, wix-data (no atomic transactions), vitest, `Intl.DateTimeFormat` for ET date math, existing wix-data mock (`__seed`, `__onUpdate`, `__onInsert`, `__reset`, `vi.setSystemTime`).

---

## File Structure

| File | Status | Purpose |
|------|--------|---------|
| `src/backend/utils/dateUtils.js` | **Create** | Shared ET date helpers: `getTodayET()`, `getYesterdayET()` |
| `tests/dateUtils.test.js` | **Create** | Tests for ET date helpers including DST transition nights |
| `src/public/gamificationTokens.js` | **Modify** | Add `STREAK_MULTIPLIER_TIERS`, `getStreakMultiplier()`, update `week_wanderer`, update `getBadgesForAccount` |
| `tests/gamificationTokens.test.js` | **Modify** | Tests for new streak functions and updated badge logic |
| `src/backend/gamificationEventReceiver.web.js` | **Modify** | Extend with `updateStreakState()` helper + streak logic in main handler |
| `tests/gamificationEventReceiver.test.js` | **Modify** | Tests for streak multiplier application, milestone, same-day no-op, reset |
| `src/backend/spinWheel.web.js` | **Modify** | Import ET date helpers from `dateUtils.js` (remove inline copy) |
| `src/public/StreakDisplay.js` | **Create** | Frontend pure functions: `renderStreakChip`, `showStreakToast`, `initStreakDisplay` |
| `tests/StreakDisplay.test.js` | **Create** | Tests for streak display pure functions |

---

## Environment Setup

All commands run from: `/Users/hal/gt/cfutons/refinery/rig`

Run tests: `npx vitest run tests/<filename>.test.js`
Run all tests: `npx vitest run`

The wix-data mock is at `tests/__mocks__/wix-data.js` and exposes:
- `__seed(collection, items)` — pre-populate collection
- `__reset()` — clear all collections and callbacks
- `__onUpdate(fn)` — intercept updates: `fn(collection, item)`
- `__onInsert(fn)` — intercept inserts: `fn(collection, item)`
- `__setQueryError(collection, err)` — force query to throw
- `__getInserted(collection)` — return array of inserted items

To mock system time in vitest: `vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-08T10:00:00Z'));`
Always restore in `afterEach`: `vi.useRealTimers();`

---

## Task 1: `dateUtils.js` — DST-safe ET date helpers

**Files:**
- Create: `src/backend/utils/dateUtils.js`
- Create: `tests/dateUtils.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/dateUtils.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/dateUtils.test.js
```

Expected: FAIL — "Cannot find module '../src/backend/utils/dateUtils.js'"

- [ ] **Step 3: Implement `dateUtils.js`**

Create `src/backend/utils/dateUtils.js`:

```js
/**
 * DST-safe ET date helpers.
 * Uses Intl.DateTimeFormat (IANA tz) for UTC→ET conversion.
 * Calendar-day arithmetic avoids fixed-millisecond DST errors.
 * CF-phase2-streak
 */

/**
 * Returns today's date as "YYYY-MM-DD" in Eastern Time (America/New_York).
 * Correctly handles both EST (UTC-5) and EDT (UTC-4) offsets.
 * @returns {string}
 */
export function getTodayET() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).split('/').reverse().join('-');
  // Intl returns "MM/DD/YYYY" → split → ["YYYY", "MM", "DD"] → join → "YYYY-MM-DD"
}

/**
 * Returns yesterday's date as "YYYY-MM-DD" in Eastern Time.
 * Uses calendar-day subtraction via Date.UTC to avoid DST off-by-one errors.
 * DO NOT use Date.now() - 86400000 — spring-forward day is 23h, fall-back is 25h.
 * @returns {string}
 */
export function getYesterdayET() {
  const today = getTodayET(); // e.g. "2026-03-22"
  const [y, m, d] = today.split('-').map(Number);
  // Date.UTC with d-1=0 correctly resolves to last day of previous month.
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  return [
    yesterday.getUTCFullYear(),
    String(yesterday.getUTCMonth() + 1).padStart(2, '0'),
    String(yesterday.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/dateUtils.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/backend/utils/dateUtils.js tests/dateUtils.test.js
git commit -m "feat(streak): dateUtils.js — DST-safe getTodayET/getYesterdayET helpers"
```

---

## Task 2: `gamificationTokens.js` — Streak multiplier + badge updates

**Files:**
- Modify: `src/public/gamificationTokens.js`
- Modify: `tests/gamificationTokens.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/gamificationTokens.test.js`:

```js
import {
  getStreakMultiplier,
  STREAK_MULTIPLIER_TIERS,
  getBadgesForAccount,
} from '../src/public/gamificationTokens.js';

// ── getStreakMultiplier ────────────────────────────────────────────────────────

describe('getStreakMultiplier', () => {
  it('returns 1 for day 0 (no streak)', () => {
    expect(getStreakMultiplier(0)).toBe(1);
  });

  it('returns 1 for day 1', () => {
    expect(getStreakMultiplier(1)).toBe(1);
  });

  it('returns 1 for day 2 (top of 1x tier)', () => {
    expect(getStreakMultiplier(2)).toBe(1);
  });

  it('returns 1.5 for day 3 (bottom of 1.5x tier)', () => {
    expect(getStreakMultiplier(3)).toBe(1.5);
  });

  it('returns 1.5 for day 6 (top of 1.5x tier)', () => {
    expect(getStreakMultiplier(6)).toBe(1.5);
  });

  it('returns 2 for day 7 (bottom of 2x tier)', () => {
    expect(getStreakMultiplier(7)).toBe(2);
  });

  it('returns 2 for day 30 (well into 2x tier)', () => {
    expect(getStreakMultiplier(30)).toBe(2);
  });
});

// ── getBadgesForAccount — week_wanderer via currentStreakDays ─────────────────

describe('getBadgesForAccount — week_wanderer', () => {
  it('earns week_wanderer at currentStreakDays >= 7', () => {
    const badges = getBadgesForAccount({ currentStreakDays: 7 });
    expect(badges).toContain('week_wanderer');
  });

  it('does not earn week_wanderer at currentStreakDays = 6', () => {
    const badges = getBadgesForAccount({ currentStreakDays: 6 });
    expect(badges).not.toContain('week_wanderer');
  });

  it('loginStreakDays alone does NOT earn week_wanderer (superseded field)', () => {
    const badges = getBadgesForAccount({ loginStreakDays: 100, currentStreakDays: 0 });
    expect(badges).not.toContain('week_wanderer');
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx vitest run tests/gamificationTokens.test.js
```

Expected: FAIL — `getStreakMultiplier is not a function` and `week_wanderer` badge tests fail.

- [ ] **Step 3: Implement in `gamificationTokens.js`**

Add to the existing `POINT_VALUES` object:

```js
STREAK_7_DAY: 100,  // Milestone bonus when streak crosses to day 7
```

Add after the existing `POINT_VALUES` block:

```js
// ── Streak multiplier tiers ───────────────────────────────────────────────────

export const STREAK_MULTIPLIER_TIERS = [
  { minDays: 7, multiplier: 2 },
  { minDays: 3, multiplier: 1.5 },
  { minDays: 1, multiplier: 1 },
];

/**
 * Returns the streak multiplier for a given number of consecutive ET days.
 * Tiers: 1-2 days → 1×, 3-6 days → 1.5×, 7+ days → 2×.
 * @param {number} days
 * @returns {number}
 */
export function getStreakMultiplier(days) {
  for (const tier of STREAK_MULTIPLIER_TIERS) {
    if (days >= tier.minDays) return tier.multiplier;
  }
  return 1;
}
```

Update the `week_wanderer` badge `earnCondition` in `BADGE_REGISTRY`:

```js
week_wanderer: {
  label: 'Week Wanderer',
  icon: '🗺️',
  tier: 'TRAIL_BLAZER',
  description: 'Active in the rewards program 7 days in a row.',
  earnCondition: 'Earn points or spin the wheel for 7 consecutive days.',  // was: 'Maintain a 7-day login streak.'
},
```

Update `getBadgesForAccount` to use `currentStreakDays` instead of `loginStreakDays` for `week_wanderer`:

```js
export function getBadgesForAccount(accountHistory = {}) {
  const {
    purchaseCount = 0,
    productLines = [],
    arTryOnUsed = false,
    reviewCount = 0,
    loginStreakDays = 0,    // kept for backwards compat — no longer used for week_wanderer
    currentStreakDays = 0,  // Phase 2: activity-based streak (authoritative for week_wanderer)
  } = accountHistory;

  const earned = [];

  if (purchaseCount >= 1) earned.push('first_step');
  if (purchaseCount >= 3) earned.push('trail_regular');
  if (arTryOnUsed) earned.push('visualizer');
  if (Array.isArray(productLines) && new Set(productLines).size >= 3) earned.push('curator');
  if (currentStreakDays >= 7) earned.push('week_wanderer');  // was: loginStreakDays
  if (reviewCount >= 3) earned.push('voice_of_mountain');

  return earned;
}
```

- [ ] **Step 4: Run — confirm PASS**

```bash
npx vitest run tests/gamificationTokens.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/public/gamificationTokens.js tests/gamificationTokens.test.js
git commit -m "feat(streak): add STREAK_MULTIPLIER_TIERS + getStreakMultiplier; update week_wanderer to use currentStreakDays"
```

---

## Task 3: `updateStreakState()` — Pure helper + full branch tests

**Files:**
- Modify: `src/backend/gamificationEventReceiver.web.js` (add helper only — no integration yet)
- Modify: `tests/gamificationEventReceiver.test.js` (add streak helper tests)

The plan here is TDD: write tests for `updateStreakState()` exported from the receiver module, then implement the helper in the module. Do NOT integrate into the main handler yet — that's Task 4.

**Note on signature:** The plan uses a 3-argument signature `(record, todayET, yesterdayET)` rather than the spec's pseudocode `(record, todayET)`. This intentional deviation makes the pure helper fully testable without any clock mocking — the caller (receiver) computes both dates and passes them in. The spec's `yesterdayET = ...` local variable becomes a caller concern.

- [ ] **Step 1: Write failing tests for `updateStreakState`**

Add a new describe block to `tests/gamificationEventReceiver.test.js`:

```js
import { updateStreakState } from '../src/backend/gamificationEventReceiver.web.js';
import { POINT_VALUES } from '../src/public/gamificationTokens.js';

// ── updateStreakState ─────────────────────────────────────────────────────────

describe('updateStreakState', () => {
  const TODAY = '2026-03-22';
  const YESTERDAY = '2026-03-21';

  describe('same-day no-op (lastActivityDate === todayET)', () => {
    it('returns existing streak fields unchanged', () => {
      const record = {
        currentStreakDays: 4,
        streakStartDate: '2026-03-18',
        lastActivityDate: TODAY,
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(4);
      expect(result.streakMultiplier).toBe(1.5);
      expect(result.lastActivityDate).toBe(TODAY);
    });

    it('returns milestoneBonus = 0 (not undefined) on same-day no-op', () => {
      const record = {
        currentStreakDays: 7,
        streakStartDate: '2026-03-15',
        lastActivityDate: TODAY,
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.milestoneBonus).toBe(0);
    });
  });

  describe('increment (lastActivityDate === yesterdayET)', () => {
    it('increments currentStreakDays by 1', () => {
      const record = {
        currentStreakDays: 2,
        streakStartDate: '2026-03-20',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(3);
    });

    it('upgrades multiplier when crossing into 1.5x tier (days 2→3)', () => {
      const record = {
        currentStreakDays: 2,
        streakStartDate: '2026-03-20',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.streakMultiplier).toBe(1.5);
    });

    it('upgrades multiplier when crossing into 2x tier (days 6→7)', () => {
      const record = {
        currentStreakDays: 6,
        streakStartDate: '2026-03-16',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(7);
      expect(result.streakMultiplier).toBe(2);
    });

    it('fires milestoneBonus = STREAK_7_DAY when crossing to day 7', () => {
      const record = {
        currentStreakDays: 6,
        streakStartDate: '2026-03-16',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.milestoneBonus).toBe(POINT_VALUES.STREAK_7_DAY); // 100
    });

    it('does NOT fire milestoneBonus when crossing to day 8 (already past milestone)', () => {
      const record = {
        currentStreakDays: 7,
        streakStartDate: '2026-03-15',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.milestoneBonus).toBe(0);
      expect(result.currentStreakDays).toBe(8);
    });

    it('sets lastActivityDate to todayET', () => {
      const record = {
        currentStreakDays: 3,
        streakStartDate: '2026-03-19',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.lastActivityDate).toBe(TODAY);
    });
  });

  describe('reset (missed ≥1 day or no prior activity)', () => {
    it('resets currentStreakDays to 1 when last activity was 2+ days ago', () => {
      const record = {
        currentStreakDays: 10,
        streakStartDate: '2026-03-01',
        lastActivityDate: '2026-03-19', // 3 days ago
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(1);
    });

    it('resets multiplier to 1 on reset', () => {
      const record = {
        currentStreakDays: 10,
        streakStartDate: '2026-03-01',
        lastActivityDate: '2026-03-10',
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.streakMultiplier).toBe(1);
    });

    it('sets streakStartDate to todayET on reset', () => {
      const record = {
        currentStreakDays: 5,
        streakStartDate: '2026-03-01',
        lastActivityDate: '2026-03-10',
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.streakStartDate).toBe(TODAY);
    });

    it('milestoneBonus = 0 on reset', () => {
      const record = { currentStreakDays: 5, lastActivityDate: '2026-03-10', streakMultiplier: 1.5 };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.milestoneBonus).toBe(0);
    });

    it('resets correctly for new member with no streak fields (null/undefined)', () => {
      const record = { currentStreakDays: null, lastActivityDate: null, streakMultiplier: null };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(1);
      expect(result.streakMultiplier).toBe(1);
      expect(result.streakStartDate).toBe(TODAY);
    });
  });
});
```

- [ ] **Step 2: Run — confirm FAIL (function not exported)**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — `SyntaxError: The requested module does not export 'updateStreakState'` (or similar import error).

- [ ] **Step 3: Add `updateStreakState` stub to receiver (throws — keeps tests failing with meaningful error)**

Add to the bottom of `src/backend/gamificationEventReceiver.web.js`:

```js
// ── Streak helper (exported for testing) ──────────────────────────────────────

/**
 * @throws {Error} Not yet implemented
 */
export function updateStreakState(_record, _todayET, _yesterdayET) {
  throw new Error('updateStreakState: not yet implemented');
}
```

- [ ] **Step 4: Run — confirm FAIL with "not yet implemented"**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — `Error: updateStreakState: not yet implemented`

- [ ] **Step 5: Implement `updateStreakState()`**

Replace the stub in `gamificationEventReceiver.web.js`:

```js
import { getStreakMultiplier, POINT_VALUES } from 'public/gamificationTokens.js';

/**
 * Compute new streak state based on the member's last activity date.
 * Pure function — no DB calls. All three branches set milestoneBonus explicitly.
 *
 * @param {Object} record - Current MemberPoints record (streak fields may be null for new members)
 * @param {string} todayET - Today's ET date string e.g. "2026-03-22"
 * @param {string} yesterdayET - Yesterday's ET date string e.g. "2026-03-21"
 * @returns {{ currentStreakDays, streakStartDate, lastActivityDate, streakMultiplier, milestoneBonus }}
 */
export function updateStreakState(record, todayET, yesterdayET) {
  const lastActivity = record.lastActivityDate || null;
  const existingDays = record.currentStreakDays || 0;
  const existingStart = record.streakStartDate || todayET;
  const existingMultiplier = record.streakMultiplier || 1;

  // Branch 1: already active today — no change
  if (lastActivity === todayET) {
    return {
      currentStreakDays: existingDays,
      streakStartDate: existingStart,
      lastActivityDate: todayET,
      streakMultiplier: existingMultiplier,
      milestoneBonus: 0,
    };
  }

  // Branch 2: active yesterday — increment streak
  if (lastActivity === yesterdayET) {
    const currentStreakDays = existingDays + 1;
    const streakMultiplier = getStreakMultiplier(currentStreakDays);
    const milestoneBonus = currentStreakDays === 7 ? POINT_VALUES.STREAK_7_DAY : 0;
    return {
      currentStreakDays,
      streakStartDate: existingStart,
      lastActivityDate: todayET,
      streakMultiplier,
      milestoneBonus,
    };
  }

  // Branch 3: missed ≥1 day or no prior activity — reset streak
  return {
    currentStreakDays: 1,
    streakStartDate: todayET,
    lastActivityDate: todayET,
    streakMultiplier: 1,
    milestoneBonus: 0,
  };
}
```

- [ ] **Step 6: Run — confirm PASS**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: All `updateStreakState` tests PASS. All prior tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
git commit -m "feat(streak): updateStreakState() pure helper — all 3 branches + milestone guard"
```

---

## Task 4: Integrate streak into `receiveGamificationEvent`

**Files:**
- Modify: `src/backend/gamificationEventReceiver.web.js`
- Modify: `src/backend/utils/dateUtils.js` (import in receiver)
- Modify: `tests/gamificationEventReceiver.test.js`

**Note:** All existing tests must continue to pass. Streak is additive.

- [ ] **Step 1: Write failing integration tests**

Add to `tests/gamificationEventReceiver.test.js`:

```js
// ── Streak multiplier — integration with receiveGamificationEvent ─────────────

describe('streak multiplier — integration', () => {
  it('applies 1.5x multiplier (3-day streak) to add_to_cart points', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-21',  // yesterday
      streakMultiplier: 1.5,
    }]);
    // Today = 2026-03-22 (from vi.setSystemTime must be set via vi.useFakeTimers — but
    // here the mock's lastActivityDate = yesterday string means increment path fires)
    // To test multiplier: seed last activity = yesterday, check that points are multiplied
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // add_to_cart base = 5 pts. After increment streak from 3→4 days, multiplier stays 1.5x.
    // Math.round(5 * 1.5) = 8
    expect(result.newTotal).toBe(8);
  });

  it('applies 2x multiplier (day 7) to submit_review points', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 7, streakStartDate: '2026-03-15',
      lastActivityDate: '2026-03-21',  // yesterday — streak will go to 8, multiplier stays 2x
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_submit_review', { has_photo: false }, 'mem-1');
    // 50 * 2 = 100
    expect(result.newTotal).toBe(100);
  });

  it('fires milestoneBonus of 100 pts when streak crosses to day 7', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21',  // yesterday — streak goes 6→7, milestone fires
      streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // base 5 * 2x (day 7 multiplier) = 10, + 100 milestone = 110
    expect(result.newTotal).toBe(110);
    expect(result.milestoneUnlocked).toBe(true);
  });

  it('returns currentStreakDays and streakMultiplier in result', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21',  // yesterday
      streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.currentStreakDays).toBe(3);
    expect(result.streakMultiplier).toBe(1.5);
  });

  it('resets streak to 1 when lastActivityDate is 2 days ago', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 10, streakStartDate: '2026-03-01',
      lastActivityDate: '2026-03-20',  // 2 days ago — missed yesterday
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.currentStreakDays).toBe(1);
    expect(result.streakMultiplier).toBe(1);
    // Points at 1x: Math.round(5 * 1) = 5
    expect(result.newTotal).toBe(5);
  });

  it('does not double-award streak on same-day second event', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 8, tier: 'Trail Blazer',
      currentStreakDays: 4, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-22',  // today — already active
      streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // Same-day no-op: streak stays at day 4, multiplier stays 1.5x
    // 5 * 1.5 = 7.5 → Math.round = 8; total = 8 + 8 = 16
    expect(result.currentStreakDays).toBe(4);
    expect(result.newTotal).toBe(16);
  });

  it('persists streak fields in the MemberPoints update', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 1,
    }]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const mpUpdate = updated.find(u => u.collection === 'MemberPoints');
    expect(mpUpdate.item.currentStreakDays).toBe(3);
    expect(mpUpdate.item.streakMultiplier).toBe(1.5);
    expect(mpUpdate.item.lastActivityDate).toBeDefined();
  });

  it('milestone writes streakMultiplier = 2 to MemberPoints', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 1.5,
    }]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const mpUpdate = updated.find(u => u.collection === 'MemberPoints');
    expect(mpUpdate.item.streakMultiplier).toBe(2);
    expect(mpUpdate.item.currentStreakDays).toBe(7);
  });

  it('non-points spin (FREE_SHIP) still increments streak with 0 adjusted points', async () => {
    // Spec: spin_completed qualifies regardless of prize type; multiplier applied to 0 base = 0
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21',  // yesterday
      streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_spin_completed', { prizeType: 'FREE_SHIP' }, 'mem-1');
    // Streak increments 2→3 (into 1.5x tier), but basePoints=0 so totalPoints unchanged
    expect(result.currentStreakDays).toBe(3);
    expect(result.streakMultiplier).toBe(1.5);
    expect(result.newTotal).toBe(50);  // no points awarded for non-points prize
  });

  it('ET midnight boundary — correct streak at 00:01 ET (EST, Jan date)', async () => {
    // 2026-01-15 05:01 UTC = 00:01 EST (UTC-5): today=2026-01-15, yesterday=2026-01-14
    vi.setSystemTime(new Date('2026-01-15T05:01:00Z'));
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-01-12',
      lastActivityDate: '2026-01-14',  // yesterday in ET
      streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // Should increment streak from 3→4, keep 1.5x multiplier (not yet 7)
    expect(result.currentStreakDays).toBe(4);
    expect(result.streakMultiplier).toBe(1.5);
  });

  it('badge de-dup — week_wanderer not re-inserted when already in badge set', async () => {
    // Spec: milestone handler checks existing badge set before inserting
    __seed('MemberBadges', [{ memberId: 'mem-1', badgeId: 'week_wanderer' }]);
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 1.5,
    }]);
    const badgeInserts = [];
    __onInsert((collection, item) => {
      if (collection === 'MemberBadges') badgeInserts.push(item);
    });
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // Milestone fires (points awarded) but badge not re-inserted
    expect(result.milestoneUnlocked).toBe(true);
    expect(badgeInserts).toHaveLength(0);
  });
});
```

**Important note on date mocking in integration tests:**
The integration tests above use `lastActivityDate` values relative to a fixed date string (`'2026-03-22'` as today). The `receiveGamificationEvent` handler calls `getTodayET()` and `getYesterdayET()` at runtime — which will use the actual current date. To make these tests deterministic, you have two options:
- **Option A (recommended):** Use `vi.useFakeTimers()` + `vi.setSystemTime()` in a `beforeEach`/`afterEach` to pin the clock to `2026-03-22T14:00:00Z`.
- **Option B:** Seed `lastActivityDate` values relative to the ACTUAL yesterday/today at test-run time.

Use Option A. Add to the top of the streak integration describe block:

```js
describe('streak multiplier — integration', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // pins today=2026-03-22, yesterday=2026-03-21
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  // ... tests above
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — streak fields not returned, multiplier not applied.

- [ ] **Step 3: Integrate streak into receiver**

Update `gamificationEventReceiver.web.js`:

```js
import { Permissions, webMethod } from 'wix-web-module';
import { POINT_VALUES, getTierForPoints } from 'public/gamificationTokens.js';
import { logError } from 'backend/utils/errorHandler';
import { getTodayET, getYesterdayET } from 'backend/utils/dateUtils.js';
import wixData from 'wix-data';

// ... keep existing constants ...

export const receiveGamificationEvent = webMethod(
  Permissions.SiteMember,
  async (eventName, payload, memberId) => {
    if (!memberId) {
      return { success: false, error: 'memberId is required' };
    }

    const basePoints = resolvePoints(eventName, payload);

    // Unknown event: return current total without writing
    if (basePoints === null) {
      // ... existing unknown-event block unchanged ...
    }

    try {
      const record = await findMemberRecord(memberId);
      const oldTotal = record ? record.totalPoints : 0;
      const oldTier = record ? record.tier : getTierForPoints(0);

      // Phase 2: compute streak state (pure, no DB calls)
      const todayET = getTodayET();
      const yesterdayET = getYesterdayET();
      const streakState = updateStreakState(record || {}, todayET, yesterdayET);

      // Apply streak multiplier to base points
      const adjustedPoints = Math.round(basePoints * streakState.streakMultiplier);
      const bonusSpins = await resolveBonusSpinGrant(eventName, record);
      const newTotal = oldTotal + adjustedPoints + streakState.milestoneBonus;
      const newTier = getTierForPoints(newTotal);
      const tierChanged = newTier !== oldTier;

      const updatedFields = {
        totalPoints: newTotal,
        tier: newTier,
        currentStreakDays: streakState.currentStreakDays,
        streakStartDate: streakState.streakStartDate,
        lastActivityDate: streakState.lastActivityDate,
        streakMultiplier: streakState.streakMultiplier,
        ...(bonusSpins !== null && { bonusSpinsAvailable: (record?.bonusSpinsAvailable || 0) + bonusSpins }),
      };

      if (record) {
        await wixData.update(MEMBER_POINTS_COLLECTION, { ...record, ...updatedFields });
      } else {
        await wixData.insert(MEMBER_POINTS_COLLECTION, { memberId, ...updatedFields });
      }

      return {
        success: true,
        newTotal,
        tierChanged,
        newTier,
        currentStreakDays: streakState.currentStreakDays,
        streakMultiplier: streakState.streakMultiplier,
        milestoneUnlocked: streakState.milestoneBonus > 0,
      };
    } catch (err) {
      logError(`gamificationEventReceiver — ${eventName} failed for member ${memberId}`, err);
      return { success: false, error: 'Failed to award points' };
    }
  }
);
```

**Note:** The actual implementation integrates the existing bonus spin grant logic. You must refactor the existing `receiveGamificationEvent` to work with the streak multiplier without breaking the bonus spin grant logic. Read the current implementation carefully before editing. The key change is:
1. `delta` → `basePoints` (rename to make the multiplier step clear)
2. `adjustedPoints = Math.round(basePoints * streakState.streakMultiplier)`
3. `newTotal = oldTotal + adjustedPoints + streakState.milestoneBonus`
4. Add streak fields to the update/insert object
5. Return streak fields in the response

- [ ] **Step 4: Run — confirm PASS**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: All tests PASS, including the new streak integration tests AND all existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
git commit -m "feat(streak): integrate streak multiplier into receiveGamificationEvent"
```

---

## Task 5: Migrate `spinWheel.web.js` to use `dateUtils.js`

**Files:**
- Modify: `src/backend/spinWheel.web.js`

**Context:** Phase 1 `spinWheel.web.js` has inline ET date logic. Extract to use `dateUtils.js` to eliminate duplication. This is a refactor — no new behaviour, existing tests must still pass.

- [ ] **Step 1: Run existing spinWheel tests to confirm baseline PASS**

```bash
npx vitest run tests/spinWheel.test.js
```

Expected: All PASS (confirm baseline).

- [ ] **Step 2: Replace inline ET date logic in `spinWheel.web.js`**

Find the inline `getTodayET()` function (or equivalent pattern using `Intl.DateTimeFormat`) in `spinWheel.web.js` and replace all inline date logic with imports:

```js
import { getTodayET, getYesterdayET } from 'backend/utils/dateUtils.js';
```

Remove any inline `function getTodayET()` or `function getET DateString()` from `spinWheel.web.js`.

**Note:** Phase 1 spin wheel uses a different ET date pattern for `nextETMidnightMs` (computing next midnight). That's a separate function — only replace the `getTodayET()` date-string helpers, not the midnight-timestamp computation.

- [ ] **Step 3: Run spinWheel tests — confirm still PASS**

```bash
npx vitest run tests/spinWheel.test.js
```

Expected: All PASS.

- [ ] **Step 4: Run all tests — confirm no regressions**

```bash
npx vitest run
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/spinWheel.web.js
git commit -m "refactor(streak): spinWheel.web.js — import ET date helpers from dateUtils.js"
```

---

## Task 6: `StreakDisplay.js` — Frontend pure functions

**Files:**
- Create: `src/public/StreakDisplay.js`
- Create: `tests/StreakDisplay.test.js`

**Note:** This is a pure-function module. It does not import Wix SDK modules — all functions accept element references as parameters so they can be unit-tested without a DOM. The DOM wiring happens in `Member Page.js` (Task 7).

- [ ] **Step 1: Write failing tests**

Create `tests/StreakDisplay.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildStreakChipText,
  buildMultiplierBadgeText,
  buildToastText,
  shouldShowStreakChip,
} from '../src/public/StreakDisplay.js';

describe('buildStreakChipText', () => {
  it('returns "🔥 1-day streak" for 1 day', () => {
    expect(buildStreakChipText(1)).toBe('🔥 1-day streak');
  });

  it('returns "🔥 7-day streak" for 7 days', () => {
    expect(buildStreakChipText(7)).toBe('🔥 7-day streak');
  });

  it('uses "days" (plural) for counts > 1', () => {
    expect(buildStreakChipText(3)).toContain('days');
  });
});

describe('buildMultiplierBadgeText', () => {
  it('returns empty string for 1x (no bonus)', () => {
    expect(buildMultiplierBadgeText(1)).toBe('');
  });

  it('returns "1.5× points" for 1.5 multiplier', () => {
    expect(buildMultiplierBadgeText(1.5)).toBe('1.5× points');
  });

  it('returns "2× points" for 2 multiplier', () => {
    expect(buildMultiplierBadgeText(2)).toBe('2× points');
  });
});

describe('buildToastText', () => {
  it('returns milestone text when milestoneUnlocked is true', () => {
    const text = buildToastText({ streakDays: 7, multiplier: 2, milestoneUnlocked: true });
    expect(text).toContain('7-day streak');
    expect(text).toContain('+100');
    expect(text).toContain('Week Wanderer');
  });

  it('returns standard increment text when milestoneUnlocked is false', () => {
    const text = buildToastText({ streakDays: 4, multiplier: 1.5, milestoneUnlocked: false });
    expect(text).toContain('4');
    expect(text).toContain('1.5×');
  });
});

describe('shouldShowStreakChip', () => {
  it('returns true for streakDays >= 1', () => {
    expect(shouldShowStreakChip(1)).toBe(true);
    expect(shouldShowStreakChip(7)).toBe(true);
  });

  it('returns false for streakDays = 0', () => {
    expect(shouldShowStreakChip(0)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(shouldShowStreakChip(null)).toBe(false);
    expect(shouldShowStreakChip(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx vitest run tests/StreakDisplay.test.js
```

Expected: FAIL — `StreakDisplay.js` not found.

- [ ] **Step 3: Implement `StreakDisplay.js`**

Create `src/public/StreakDisplay.js`:

```js
/**
 * Streak display pure functions for Member Page.
 * No Wix SDK imports — accepts element references as parameters for testability.
 * DOM wiring happens in Member Page.js.
 * CF-phase2-streak
 */

/**
 * @param {number} streakDays
 * @returns {string}
 */
export function buildStreakChipText(streakDays) {
  const unit = streakDays === 1 ? 'day' : 'days';
  return `🔥 ${streakDays}-${unit} streak`;
}

/**
 * Returns empty string for 1x (no visible badge when no bonus).
 * @param {number} multiplier
 * @returns {string}
 */
export function buildMultiplierBadgeText(multiplier) {
  if (multiplier <= 1) return '';
  return `${multiplier}× points`;
}

/**
 * @param {{ streakDays: number, multiplier: number, milestoneUnlocked: boolean }} data
 * @returns {string}
 */
export function buildToastText({ streakDays, multiplier, milestoneUnlocked }) {
  if (milestoneUnlocked) {
    return `🏔️ ${streakDays}-day streak! +100 bonus pts + Week Wanderer badge unlocked`;
  }
  return `Streak extended! ${streakDays} days → ${multiplier}× multiplier active`;
}

/**
 * @param {number|null|undefined} streakDays
 * @returns {boolean}
 */
export function shouldShowStreakChip(streakDays) {
  return typeof streakDays === 'number' && streakDays >= 1;
}

/**
 * Update streak display elements. Call after any point-earning event response.
 * Pass $element references from Wix ($w('#streakCountChip'), etc.)
 *
 * @param {Object} $elements - { $chip, $badge, $toast }
 * @param {{ currentStreakDays, streakMultiplier, milestoneUnlocked }} data
 * @param {boolean} reducedMotion - from wix-window useReducedMotion()
 */
export function updateStreakDisplay($elements, data, reducedMotion = false) {
  const { $chip, $badge, $toast } = $elements;
  const { currentStreakDays, streakMultiplier, milestoneUnlocked } = data;

  if (shouldShowStreakChip(currentStreakDays)) {
    $chip.text = buildStreakChipText(currentStreakDays);
    $chip.show();
  } else {
    $chip.hide();
  }

  const badgeText = buildMultiplierBadgeText(streakMultiplier);
  if (badgeText) {
    $badge.text = badgeText;
    $badge.show();
  } else {
    $badge.hide();
  }

  // Toast: show only when streak was incremented or milestone reached
  // Caller (Member Page.js) decides when to show toast based on whether streak changed
  if ($toast && !reducedMotion) {
    $toast.text = buildToastText({ streakDays: currentStreakDays, multiplier: streakMultiplier, milestoneUnlocked });
    $toast.show();
    setTimeout(() => $toast.hide(), milestoneUnlocked ? 5000 : 3000);
  }
}
```

- [ ] **Step 4: Run — confirm PASS**

```bash
npx vitest run tests/StreakDisplay.test.js
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/public/StreakDisplay.js tests/StreakDisplay.test.js
git commit -m "feat(streak): StreakDisplay.js — pure display functions + buildToastText + updateStreakDisplay"
```

---

## Task 7: Manual Steps — Editor Elements + Member Page.js + MemberPoints CMS

**These steps require Wix Studio editor access (performed by Stilgar or the designated browser driver).**

- [ ] **Step 1: Add 4 new fields to `MemberPoints` collection in Wix Dashboard**

In Wix Dashboard → Content → CMS → `MemberPoints` collection:
- Add field: `currentStreakDays` (Number, default 0)
- Add field: `streakStartDate` (Text — NOT DateTime)
- Add field: `lastActivityDate` (Text — NOT DateTime)
- Add field: `streakMultiplier` (Number, default 1)

**Critical:** Use Text (not DateTime) for `streakStartDate` and `lastActivityDate`. The streak logic depends on string equality comparison.

- [ ] **Step 2: Add 3 new elements inside `#loyaltySection` in the Wix editor**

Open the Member Page in the editor. Inside the `#loyaltySection` container, add:

| Element | Type | Nickname | Initial state |
|---------|------|----------|---------------|
| Text element | Text | `#streakCountChip` | Hidden |
| Text or Box | Text/Box | `#streakMultiplierBadge` | Hidden |
| Box element | Box | `#streakToastBox` | Hidden |

Assign nicknames via the Velo sidebar or bulk rename script.

- [ ] **Step 3: Wire `StreakDisplay.js` into `Member Page.js`**

In `Member Page.js`, add streak initialization after any gamification event response:

```js
import { updateStreakDisplay } from 'public/StreakDisplay.js';

// After receiveGamificationEvent response:
const reducedMotion = await wixWindow.reducedMotion;
updateStreakDisplay(
  {
    $chip: $w('#streakCountChip'),
    $badge: $w('#streakMultiplierBadge'),
    $toast: $w('#streakToastBox'),
  },
  {
    currentStreakDays: result.currentStreakDays,
    streakMultiplier: result.streakMultiplier,
    milestoneUnlocked: result.milestoneUnlocked,
  },
  reducedMotion
);
```

Also call on page load using the member's current streak state from their `MemberPoints` record (query on `$w.onReady`).

- [ ] **Step 4: Update EDITOR_HOOKUP_GUIDE.html**

Add to the element nicknames table:
- `#streakCountChip` — streak day count chip (Text, in loyaltySection)
- `#streakMultiplierBadge` — multiplier badge (Text/Box, in loyaltySection)
- `#streakToastBox` — streak toast container (Box, hidden by default, in loyaltySection)

- [ ] **Step 5: Update EDITOR-HOOKUP-GUIDE.md**

Sync the same 3 element entries to EDITOR-HOOKUP-GUIDE.md.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Final commit**

```bash
git add EDITOR_HOOKUP_GUIDE.html EDITOR-HOOKUP-GUIDE.md
git commit -m "docs(gamification): Phase 2 streak — update editor hookup guides (3 new elements)"
```

---

## Validation Checklist

Before marking Phase 2 complete, verify:

- [ ] `getStreakMultiplier(2)` returns `1`, `getStreakMultiplier(3)` returns `1.5`, `getStreakMultiplier(7)` returns `2`
- [ ] `updateStreakState` with same-day `lastActivityDate` returns `milestoneBonus: 0` (not undefined)
- [ ] `receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1')` with 3-day streak: `newTotal = 8` (not 5)
- [ ] Day-7 milestone: `newTotal` includes +100 bonus, `milestoneUnlocked: true` in response
- [ ] Streak fields persisted in MemberPoints after event
- [ ] `getYesterdayET()` returns correct date at spring-forward and fall-back boundary (unit tests pass)
- [ ] All prior gamification tests still pass (no regressions)
- [ ] EDITOR_HOOKUP_GUIDE.html has 3 new element nicknames
- [ ] EDITOR-HOOKUP-GUIDE.md synced
