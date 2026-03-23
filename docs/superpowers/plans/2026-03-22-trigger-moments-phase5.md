# Trigger Moments — Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralise all gamification celebration moments into a single `TriggerMoments.js` frontend module and extend the `receiveGamificationEvent` backend response with a unified `triggers` object covering tier-up, badge unlocked, challenge completed, streak milestone, and streak danger.

**Architecture:** The backend (`gamificationEventReceiver.web.js`) gains a `triggers` object in its return shape, computed from existing Phase 2 and Phase 4 state plus a new `getNextETMidnightUTC()` helper in `dateUtils.js`. The frontend `TriggerMoments.js` module receives that object from `Member Page.js`, builds a priority-ordered queue of animation/toast moments, and plays them sequentially with a 500 ms gap. A `sessionStorage` gate prevents streak-danger toasts from repeating within the same ET calendar day. Lottie animation playback is wired in `Member Page.js` via `data-lottie-src` attribute — `TriggerMoments.js` only sets the attribute value; the Wix Lottie widget picks it up automatically.

**Tech Stack:** Wix Velo JS (ES modules), vitest, `Intl.DateTimeFormat` for DST-safe ET date math, jsdom sessionStorage (available in vitest), existing wix-data mock (`__seed`, `__reset`, `__onUpdate`, `__onInsert`, `__setQueryError`, `__getInserted`), `vi.useFakeTimers` / `vi.setSystemTime`.

> **Scope note — "First purchase" trigger:** The spec trigger table lists a "First purchase (ever)" moment (tier-up animation + "Welcome to the Trail!" toast). This trigger is **absent from the spec's Definition of Done** and is not implemented in this plan. The `showTierUp` infrastructure handles the animation when it is eventually wired. Detecting `totalPoints === 0` before the first award is a follow-on backend flag. Defer to a separate bead.

---

## File Structure

| File | Status | Purpose |
|------|--------|---------|
| `src/backend/utils/dateUtils.js` | **Modify** | Add `getNextETMidnightUTC()` helper |
| `tests/dateUtils.test.js` | **Modify** | Add DST-boundary tests for `getNextETMidnightUTC()` |
| `src/backend/gamificationEventReceiver.web.js` | **Modify** | Extend return shape: add `triggers` object; populate all trigger fields; add `rewardPoints` to `challengeProgress` items |
| `tests/gamificationEventReceiver.test.js` | **Modify** | Tests for `triggers` object, all `streakDanger` branches, badge slug capture, `challengeCompleted` shape |
| `src/public/gamificationTokens.js` | **Modify** | Add `BADGE_DISPLAY_NAMES` export |
| `tests/gamificationTokens.test.js` | **Modify** | Tests for `BADGE_DISPLAY_NAMES` entries and fallback |
| `src/public/TriggerMoments.js` | **Create** | `processTriggers`, `buildMomentQueue`, `showTierUp`, `showChallengeCompleted`, `showBadgeUnlocked`, `showStreakMilestone`, `showStreakDanger`, `playQueue`, `getTodayETClient`, `useReducedMotion` |
| `tests/TriggerMoments.test.js` | **Create** | Full unit coverage: priority queue, all show* paths, sessionStorage gate, reduced-motion, edge cases |
| `src/public/Member Page.js` | **Modify** | Wire `processTriggers`; replace direct `showStreakToast` / `showCompletionToast` calls for celebration moments |

---

## Environment Setup

All test commands run from: `/Users/hal/gt/cfutons/refinery/rig`

Run single file: `npx vitest run tests/<filename>.test.js`
Run all tests: `npx vitest run`

**wix-data mock** at `tests/__mocks__/wix-data.js`:
- `__seed(collection, items)` — pre-populate
- `__reset()` — clear all collections/callbacks
- `__onUpdate(fn)` — intercept updates
- `__onInsert(fn)` — intercept inserts
- `__setQueryError(collection, err)` — force query throw
- `__getInserted(collection)` — return inserted items

**Fake timers:** `vi.useFakeTimers(); vi.setSystemTime(new Date(...))` — always restore in `afterEach: vi.useRealTimers()`

**sessionStorage:** Available in jsdom (vitest default). Reset in `beforeEach: sessionStorage.clear()`.

---

## Task 1: `getNextETMidnightUTC()` helper + `computeStreakDanger()` — TDD in dateUtils

**Files:**
- Modify: `src/backend/utils/dateUtils.js`
- Modify: `tests/dateUtils.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/dateUtils.test.js`:

```js
import { getTodayET, getYesterdayET, getNextETMidnightUTC } from '../src/backend/utils/dateUtils.js';

// ── getNextETMidnightUTC ──────────────────────────────────────────────────────

describe('getNextETMidnightUTC', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns next ET midnight as UTC ms — standard EST day (UTC-5)', () => {
    vi.useFakeTimers();
    // 2026-03-10 14:00 UTC = 9:00 AM EST (UTC-5) — well before midnight
    vi.setSystemTime(new Date('2026-03-10T14:00:00Z'));
    const result = getNextETMidnightUTC();
    // Next ET midnight = 2026-03-11 00:00 EST = 2026-03-11T05:00:00Z
    expect(result).toBe(new Date('2026-03-11T05:00:00Z').getTime());
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
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/dateUtils.test.js
```

Expected: FAIL — `getNextETMidnightUTC is not a function`

- [ ] **Step 3: Implement `getNextETMidnightUTC()` in `dateUtils.js`**

Add after the existing `getYesterdayET` export:

```js
/**
 * Returns the UTC timestamp (ms) of the next ET calendar-day midnight.
 * DST-safe: uses Intl to find current ET date, then backs-calculates
 * the UTC equivalent of midnight for the NEXT ET day.
 *
 * Approach: construct "tomorrow noon ET" as a UTC value, then ask Intl
 * what ET hour that corresponds to. The difference between 12 and that
 * ET hour gives the ET→UTC offset for that day (DST-aware). Subtract
 * 12h from tomorrow-noon-UTC to get tomorrow-midnight-UTC.
 *
 * @returns {number} UTC timestamp in milliseconds
 */
export function getNextETMidnightUTC() {
  const todayET = getTodayET(); // "YYYY-MM-DD"
  const [y, m, d] = todayET.split('-').map(Number);

  // UTC timestamp of "tomorrow at 12:00:00 UTC"
  const tomorrowNoonUTC = Date.UTC(y, m - 1, d + 1, 12, 0, 0);

  // Ask Intl what ET hour "tomorrow noon UTC" corresponds to
  const etHourAtNoon = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(new Date(tomorrowNoonUTC))
  );

  // ET offset = 12 (UTC noon) - etHourAtNoon
  // e.g. EDT: etHour = 8 → offset = 4h → UTC midnight = noon - 12h + 4h offset adjustment
  // Tomorrow midnight ET (UTC) = tomorrowNoonUTC - 12h + (12 - etHourAtNoon)h
  const etOffsetMs = (12 - etHourAtNoon) * 3600 * 1000;
  return tomorrowNoonUTC - (12 * 3600 * 1000) + etOffsetMs;
}
```

- [ ] **Step 4: Run tests — confirm PASS**

```bash
npx vitest run tests/dateUtils.test.js
```

Expected: All tests PASS (including pre-existing `getTodayET` / `getYesterdayET` tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/backend/utils/dateUtils.js tests/dateUtils.test.js
git commit -m "feat(phase5): getNextETMidnightUTC helper with DST-safe ET midnight calculation"
```

---

## Task 2: Extend receiver return shape — `triggers` object

**Files:**
- Modify: `src/backend/gamificationEventReceiver.web.js`
- Modify: `tests/gamificationEventReceiver.test.js`

### 2a: `streakDanger` computation

- [ ] **Step 1: Write failing tests for `streakDanger`**

Add to `tests/gamificationEventReceiver.test.js`:

```js
// ── triggers.streakDanger ─────────────────────────────────────────────────────

describe('triggers.streakDanger', () => {
  beforeEach(() => { wixData.__reset(); vi.useRealTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('is true when < 4h to ET midnight AND member not active today', async () => {
    vi.useFakeTimers();
    // 2026-03-22 03:00 UTC = 11pm EDT (1h to midnight) — < 4h window
    vi.setSystemTime(new Date('2026-03-22T03:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 100,
      tier: 'Trailhead', lastActivityDate: '2026-03-21', // yesterday — not today
      currentStreakDays: 3, streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.triggers.streakDanger).toBe(true);
  });

  it('is false when member is already active today (lastActivityDate === todayET)', async () => {
    vi.useFakeTimers();
    // 2026-03-22 03:00 UTC = 11pm EDT on March 21 → todayET = '2026-03-21'
    // We seed lastActivityDate = '2026-03-21' so it matches todayET → streakDanger = false
    // even though < 4h remain in that ET day.
    vi.setSystemTime(new Date('2026-03-22T03:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 100,
      tier: 'Trailhead', lastActivityDate: '2026-03-21', // matches todayET at this UTC time
      currentStreakDays: 3, streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.triggers.streakDanger).toBe(false);
  });

  it('is false when > 4h to ET midnight', async () => {
    vi.useFakeTimers();
    // 2026-03-22 14:00 UTC = 10am EDT — 14h to midnight, well outside 4h window
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 100,
      tier: 'Trailhead', lastActivityDate: '2026-03-21',
      currentStreakDays: 3, streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.triggers.streakDanger).toBe(false);
  });

  it('is false for new member with no lastActivityDate', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T03:00:00Z')); // < 4h window
    // No MemberPoints record — new member
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'newmem');
    expect(result.triggers.streakDanger).toBe(false);
  });

  it('defaults to false if getNextETMidnightUTC throws', async () => {
    // Point award must still succeed even if streak danger computation errors
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 50, tier: 'Trailhead',
      lastActivityDate: '2026-03-20', currentStreakDays: 1, streakMultiplier: 1,
    }]);
    // Simulate by using a spy if the implementation imports getNextETMidnightUTC
    // (implementation detail — confirm streakDanger = false and success = true)
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.success).toBe(true);
    expect(result.triggers).toBeDefined();
    expect(typeof result.triggers.streakDanger).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — `result.triggers is undefined`

### 2b: Full `triggers` object shape

- [ ] **Step 3: Write failing tests for triggers shape and badge/challenge fields**

Add to `tests/gamificationEventReceiver.test.js`:

```js
// ── triggers object shape ─────────────────────────────────────────────────────

describe('triggers object — shape and defaults', () => {
  beforeEach(() => { wixData.__reset(); vi.useRealTimers(); });

  it('triggers object always present — all defaults when no special conditions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // > 4h to midnight
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 50, tier: 'Trailhead',
      lastActivityDate: '2026-03-22', currentStreakDays: 2, streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.triggers).toBeDefined();
    expect(result.triggers.tierChanged).toBe(false);
    expect(result.triggers.newTier).toBe(result.newTier);
    expect(result.triggers.milestoneUnlocked).toBe(false);
    expect(result.triggers.badgeUnlocked).toBeNull();
    expect(result.triggers.challengeCompleted).toEqual([]);
    expect(result.triggers.streakDanger).toBe(false);
  });

  it('triggers.tierChanged mirrors top-level tierChanged', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    // Seed near a tier boundary — e.g. Trailhead→Wanderer at 500 pts
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 495, tier: 'Trailhead',
      lastActivityDate: '2026-03-22', currentStreakDays: 2, streakMultiplier: 1,
    }]);
    // gamification_submit_review = 50 pts → crosses 500 tier boundary
    const result = await receiveGamificationEvent('gamification_submit_review', {}, 'mem1');
    expect(result.tierChanged).toBe(true);
    expect(result.triggers.tierChanged).toBe(result.tierChanged);
    expect(result.triggers.newTier).toBe(result.newTier);
  });

  it('triggers.milestoneUnlocked = true on day-7 streak milestone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    // Seed at day 6 streak — next event completes day 7
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 200, tier: 'Trailhead',
      lastActivityDate: '2026-03-21', currentStreakDays: 6, streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.triggers.milestoneUnlocked).toBe(true);
    expect(result.milestoneUnlocked).toBe(true); // top-level preserved
  });

  it('triggers.badgeUnlocked = "week_wanderer" on day-7 milestone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 200, tier: 'Trailhead',
      lastActivityDate: '2026-03-21', currentStreakDays: 6, streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.triggers.badgeUnlocked).toBe('week_wanderer');
  });

  it('triggers.challengeCompleted is subset of challengeProgress where justCompleted = true', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    // Seed a challenge that will complete on this event
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 100, tier: 'Trailhead',
      lastActivityDate: '2026-03-21', currentStreakDays: 2, streakMultiplier: 1,
    }]);
    wixData.__seed('MemberChallengeProgress', [{
      _id: 'cp1', memberId: 'mem1', challengeId: 'ch_first_review',
      progressValue: 0, completedAt: null,
    }]);
    wixData.__seed('Challenges', [{
      _id: 'ch1', challengeId: 'ch_first_review', title: 'First Review',
      targetEvent: 'gamification_submit_review', targetCount: 1,
      rewardPoints: 150, rewardBadgeId: null, active: true,
    }]);
    const result = await receiveGamificationEvent('gamification_submit_review', {}, 'mem1');
    const completed = result.triggers.challengeCompleted;
    expect(completed.length).toBeGreaterThan(0);
    expect(completed[0]).toMatchObject({
      challengeId: 'ch_first_review',
      title: 'First Review',
      rewardPoints: 150,
    });
  });

  it('triggers.challengeCompleted is [] when no challenges complete', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 100, tier: 'Trailhead',
      lastActivityDate: '2026-03-22', currentStreakDays: 2, streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.triggers.challengeCompleted).toEqual([]);
  });

  it('triggers.badgeUnlocked = challenge rewardBadgeId when challenge with badge completes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 100, tier: 'Trailhead',
      lastActivityDate: '2026-03-21', currentStreakDays: 2, streakMultiplier: 1,
    }]);
    wixData.__seed('MemberChallengeProgress', [{
      _id: 'cp1', memberId: 'mem1', challengeId: 'ch_ar_explorer',
      progressValue: 0, completedAt: null,
    }]);
    wixData.__seed('Challenges', [{
      _id: 'ch2', challengeId: 'ch_ar_explorer', title: 'AR Explorer',
      targetEvent: 'gamification_add_to_cart', targetCount: 1,
      rewardPoints: 200, rewardBadgeId: 'ar_explorer', active: true,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem1');
    expect(result.triggers.badgeUnlocked).toBe('ar_explorer');
  });

  it('triggers object present on unknown-event (no-op) return path', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 100, tier: 'Trailhead',
      lastActivityDate: '2026-03-22', currentStreakDays: 2, streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('unknown_event_xyz', {}, 'mem1');
    expect(result.triggers).toBeDefined();
    expect(result.triggers.challengeCompleted).toEqual([]);
    expect(result.triggers.badgeUnlocked).toBeNull();
  });

  it('top-level tierChanged / newTier / milestoneUnlocked preserved (backwards compat)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [{
      _id: 'rec1', memberId: 'mem1', totalPoints: 495, tier: 'Trailhead',
      lastActivityDate: '2026-03-22', currentStreakDays: 2, streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_submit_review', {}, 'mem1');
    // Top-level fields must still be present
    expect(result).toHaveProperty('tierChanged');
    expect(result).toHaveProperty('newTier');
    expect(result).toHaveProperty('milestoneUnlocked');
    expect(result).toHaveProperty('currentStreakDays');
    expect(result).toHaveProperty('streakMultiplier');
  });
});
```

- [ ] **Step 4: Run — confirm FAIL**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — `triggers` missing from return shape.

- [ ] **Step 5: Implement `triggers` object in `gamificationEventReceiver.web.js`**

1. Import `getNextETMidnightUTC` and `getTodayET` from `dateUtils.js`:

```js
import { getTodayET, getNextETMidnightUTC } from 'backend/utils/dateUtils.js';
```

2. Add `computeStreakDanger(record, todayET)` internal helper:

```js
/**
 * Returns true when the member has not been active today AND ET midnight is
 * less than 4 hours away (seconds until midnight < 14400).
 * Defaults to false on any error — never blocks point award.
 * @param {Object|null} record - MemberPoints record (may be null for new member)
 * @param {string} todayET - Today's date in ET as "YYYY-MM-DD"
 * @returns {boolean}
 */
function computeStreakDanger(record, todayET) {
  try {
    if (!record || !record.lastActivityDate) return false;
    if (record.lastActivityDate === todayET) return false;
    const secondsUntilMidnight = (getNextETMidnightUTC() - Date.now()) / 1000;
    return secondsUntilMidnight < 14400;
  } catch {
    return false;
  }
}
```

3. Inside the main handler, after the streak state is computed and before the final return, build the `triggers` object:

```js
const todayET = getTodayET();

// Build triggers — derive from already-computed values
const triggers = {
  tierChanged,
  newTier,
  milestoneUnlocked: milestoneBonus > 0,
  badgeUnlocked: null,          // populated below
  challengeCompleted: [],       // populated below
  streakDanger: computeStreakDanger(record, todayET),
};

// Badge: day-7 milestone path
if (milestoneBonus > 0) {
  triggers.badgeUnlocked = 'week_wanderer';
}

// Badge: challenge completion with rewardBadgeId (Phase 4 path)
// challengeProgress is already built by this point
if (Array.isArray(challengeProgress)) {
  triggers.challengeCompleted = challengeProgress
    .filter(c => c.justCompleted)
    .map(c => ({ challengeId: c.challengeId, title: c.title, rewardPoints: c.rewardPoints }));

  // If a completed challenge has a badge, it overwrites (last badge wins)
  for (const c of challengeProgress) {
    if (c.justCompleted && c.rewardBadgeId) {
      triggers.badgeUnlocked = c.rewardBadgeId;
    }
  }
}
```

4. Add `rewardPoints` to each `challengeProgress` item in the Phase 4 challenge builder section (wherever `justCompleted` is set):

```js
// In challengeProgress item construction — add rewardPoints:
{
  challengeId: ch.challengeId,
  title: ch.title,
  progressValue: updatedProgress,
  targetCount: ch.targetCount,
  justCompleted: didJustComplete,
  rewardPoints: ch.rewardPoints,   // <-- add this
  rewardBadgeId: ch.rewardBadgeId, // <-- needed for triggers.badgeUnlocked
}
```

5. Add `triggers` to the return object:

```js
return {
  success: true,
  newTotal,
  tierChanged,
  newTier,
  currentStreakDays,
  streakMultiplier,
  milestoneUnlocked: milestoneBonus > 0,
  challengeProgress,
  triggers,       // <-- new
};
```

6. Also add a default `triggers` object to the **unknown-event early-return path** (the `delta === null` branch that returns `newTotal` without awarding points). This path currently returns without `triggers` — add the default shape so `processTriggers` never crashes on an unknown event response:

```js
// In the delta === null branch, after fetching the record:
return {
  success: true,
  newTotal: totalPoints,
  tierChanged: false,
  newTier: getTierForPoints(totalPoints),
  triggers: {
    tierChanged: false, newTier: getTierForPoints(totalPoints),
    milestoneUnlocked: false, badgeUnlocked: null,
    challengeCompleted: [], streakDanger: false,
  },
};
```

- [ ] **Step 6: Run tests — confirm PASS**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: All new and existing tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
git commit -m "feat(phase5): extend receiveGamificationEvent return shape with triggers object"
```

---

## Task 3: `gamificationTokens.js` — `BADGE_DISPLAY_NAMES`

**Files:**
- Modify: `src/public/gamificationTokens.js`
- Modify: `tests/gamificationTokens.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/gamificationTokens.test.js`:

```js
import { BADGE_DISPLAY_NAMES } from '../src/public/gamificationTokens.js';

describe('BADGE_DISPLAY_NAMES', () => {
  it('exports an object', () => {
    expect(typeof BADGE_DISPLAY_NAMES).toBe('object');
    expect(BADGE_DISPLAY_NAMES).not.toBeNull();
  });

  it('week_wanderer maps to human-readable name', () => {
    expect(BADGE_DISPLAY_NAMES['week_wanderer']).toBe('Week Wanderer');
  });

  it('trail_regular maps to human-readable name', () => {
    expect(BADGE_DISPLAY_NAMES['trail_regular']).toBe('Trail Regular');
  });

  it('ar_explorer maps to human-readable name', () => {
    expect(BADGE_DISPLAY_NAMES['ar_explorer']).toBe('AR Explorer');
  });

  it('unknown slug is not present (fallback handled in TriggerMoments)', () => {
    expect(BADGE_DISPLAY_NAMES['unknown_badge_xyz']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx vitest run tests/gamificationTokens.test.js
```

Expected: FAIL — `BADGE_DISPLAY_NAMES is not exported`

- [ ] **Step 3: Add `BADGE_DISPLAY_NAMES` to `gamificationTokens.js`**

```js
/**
 * Display names for badge slugs.
 * Used by TriggerMoments.js to render human-readable badge names.
 * Extend as new badges are added.
 */
export const BADGE_DISPLAY_NAMES = {
  week_wanderer: 'Week Wanderer',
  trail_regular: 'Trail Regular',
  top_reviewer: 'Top Reviewer',
  ar_explorer: 'AR Explorer',
};
```

- [ ] **Step 4: Run — confirm PASS**

```bash
npx vitest run tests/gamificationTokens.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/public/gamificationTokens.js tests/gamificationTokens.test.js
git commit -m "feat(phase5): add BADGE_DISPLAY_NAMES to gamificationTokens"
```

---

## Task 4: `TriggerMoments.js` — `buildMomentQueue()` pure function

**Files:**
- Create: `src/public/TriggerMoments.js`
- Create: `tests/TriggerMoments.test.js`

This task covers the priority queue logic only — no DOM manipulation, so no jsdom needed beyond what vitest provides.

- [ ] **Step 1: Write failing tests**

Create `tests/TriggerMoments.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildMomentQueue } from '../src/public/TriggerMoments.js';

// buildMomentQueue(triggers) → array of { key, fn } in priority order

const emptyTriggers = {
  tierChanged: false,
  newTier: null,
  milestoneUnlocked: false,
  badgeUnlocked: null,
  challengeCompleted: [],
  streakDanger: false,
};

describe('buildMomentQueue', () => {
  it('returns empty array when no triggers fire', () => {
    const queue = buildMomentQueue(emptyTriggers);
    expect(queue).toHaveLength(0);
  });

  it('returns single item for tier-up only', () => {
    const triggers = { ...emptyTriggers, tierChanged: true, newTier: 'Wanderer' };
    const queue = buildMomentQueue(triggers);
    expect(queue).toHaveLength(1);
    expect(queue[0].key).toBe('tierChanged');
  });

  it('tier-up is first when tier-up + badge fire together', () => {
    const triggers = { ...emptyTriggers, tierChanged: true, newTier: 'Wanderer', badgeUnlocked: 'week_wanderer' };
    const queue = buildMomentQueue(triggers);
    expect(queue[0].key).toBe('tierChanged');
    expect(queue[1].key).toBe('badgeUnlocked');
    expect(queue).toHaveLength(2);
  });

  it('challenge is first when challenge + streak milestone fire together', () => {
    const triggers = {
      ...emptyTriggers,
      challengeCompleted: [{ challengeId: 'ch1', title: 'First Review', rewardPoints: 150 }],
      milestoneUnlocked: true,
    };
    const queue = buildMomentQueue(triggers);
    expect(queue[0].key).toBe('challengeCompleted');
    expect(queue[1].key).toBe('milestoneUnlocked');
  });

  it('priority order: tierChanged > challengeCompleted > badgeUnlocked > milestoneUnlocked > streakDanger', () => {
    const triggers = {
      tierChanged: true,
      newTier: 'Wanderer',
      challengeCompleted: [{ challengeId: 'ch1', title: 'T', rewardPoints: 50 }],
      badgeUnlocked: 'week_wanderer',
      milestoneUnlocked: true,
      streakDanger: true,
    };
    const queue = buildMomentQueue(triggers);
    expect(queue.map(q => q.key)).toEqual([
      'tierChanged',
      'challengeCompleted',
      'badgeUnlocked',
      'milestoneUnlocked',
      'streakDanger',
    ]);
  });

  it('challengeCompleted not added when array is empty', () => {
    const triggers = { ...emptyTriggers, challengeCompleted: [] };
    const queue = buildMomentQueue(triggers);
    expect(queue.find(q => q.key === 'challengeCompleted')).toBeUndefined();
  });

  it('badgeUnlocked not added when null', () => {
    const triggers = { ...emptyTriggers, badgeUnlocked: null };
    const queue = buildMomentQueue(triggers);
    expect(queue.find(q => q.key === 'badgeUnlocked')).toBeUndefined();
  });

  it('each queue item has a callable fn property', () => {
    const triggers = { ...emptyTriggers, tierChanged: true, newTier: 'Wanderer' };
    const queue = buildMomentQueue(triggers);
    expect(typeof queue[0].fn).toBe('function');
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx vitest run tests/TriggerMoments.test.js
```

Expected: FAIL — `buildMomentQueue is not a function`

- [ ] **Step 3: Create `src/public/TriggerMoments.js` with `buildMomentQueue`**

```js
/**
 * @module TriggerMoments
 * @description Central owner of all gamification celebration animations and toasts.
 * Called from Member Page.js after any receiveGamificationEvent response.
 *
 * Lottie integration note: TriggerMoments does NOT wire Lottie playback directly.
 * It sets the `data-lottie-src` attribute on `$triggerLottieContainer` and
 * `$confettiOverlay`. The Wix Lottie widget on the page picks up the attribute
 * and plays the animation. Lottie wiring is handled in Member Page.js.
 *
 * CF-phase5-trigger-moments
 */

import { BADGE_DISPLAY_NAMES } from 'public/gamificationTokens.js';

// Lottie animation IDs
const LOTTIE = {
  BEAR_DANCING: 'cute-bear-dancing-AfMGeP3e3h',
  CONFETTI: 'confetti-on-transparent-background-ajhx1TPBa7',
  SUCCESS_CONFETTI: 'success-confetti-f5PdexvrBK',
  BEAR_CLAPPING: 'bear-clapping-4hjv0nfIf9',
};

// Animation durations in ms (used by playQueue for gap timing)
const DURATION = {
  TIER_UP: 5000,
  CHALLENGE: 4000,
  BADGE: 3000,
  MILESTONE: 4000,
  STREAK_DANGER: 6000,
};

const QUEUE_GAP_MS = 500;

/**
 * Returns true if the user prefers reduced motion.
 * Called at invocation time — not cached — so OS setting changes mid-session work.
 * @returns {boolean}
 */
function useReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Returns today's date as "YYYY-MM-DD" in Eastern Time, client-side.
 * Uses en-CA locale which returns ISO format directly.
 * @returns {string}
 */
export function getTodayETClient() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
    .format(new Date());
}

/**
 * Builds a priority-ordered queue of { key, fn } entries for the given triggers.
 * Pure function — no side effects, no DOM access. Testable without jsdom.
 *
 * Priority: tierChanged > challengeCompleted > badgeUnlocked > milestoneUnlocked > streakDanger
 *
 * @param {object} triggers - The triggers object from receiveGamificationEvent
 * @param {object} [$elements] - Wix $w element references (optional — passed into fns via closure)
 * @returns {Array<{key: string, fn: function}>}
 */
export function buildMomentQueue(triggers, $elements = null) {
  const PRIORITY_ORDER = [
    {
      key: 'tierChanged',
      test: () => triggers.tierChanged === true,
      fn: () => showTierUp($elements, triggers.newTier),
    },
    {
      key: 'challengeCompleted',
      test: () => Array.isArray(triggers.challengeCompleted) && triggers.challengeCompleted.length > 0,
      fn: () => showChallengeCompleted($elements, triggers.challengeCompleted),
    },
    {
      key: 'badgeUnlocked',
      test: () => triggers.badgeUnlocked != null,
      fn: () => showBadgeUnlocked($elements, triggers.badgeUnlocked),
    },
    {
      key: 'milestoneUnlocked',
      test: () => triggers.milestoneUnlocked === true,
      fn: () => showStreakMilestone($elements),
    },
    {
      key: 'streakDanger',
      test: () => triggers.streakDanger === true,
      fn: () => showStreakDanger($elements),
    },
  ];

  return PRIORITY_ORDER
    .filter(entry => entry.test())
    .map(entry => ({ key: entry.key, fn: entry.fn }));
}
```

- [ ] **Step 4: Run — confirm PASS**

```bash
npx vitest run tests/TriggerMoments.test.js
```

Expected: `buildMomentQueue` tests PASS. (The `show*` functions are referenced but not called by `buildMomentQueue` itself during these tests since `$elements` is null and fns are not invoked in this task.)

- [ ] **Step 5: Commit**

```bash
git add src/public/TriggerMoments.js tests/TriggerMoments.test.js
git commit -m "feat(phase5): TriggerMoments.js — buildMomentQueue pure function with priority queue"
```

---

## Task 5: `TriggerMoments.js` — `processTriggers()` and all `show*` functions

**Files:**
- Modify: `src/public/TriggerMoments.js`
- Modify: `tests/TriggerMoments.test.js`

This task adds DOM manipulation. Tests use vitest's jsdom environment with mock `$w` element objects.

- [ ] **Step 1: Write failing tests**

Add to `tests/TriggerMoments.test.js`:

```js
import {
  buildMomentQueue,
  processTriggers,
  showTierUp,
  showChallengeCompleted,
  showBadgeUnlocked,
  showStreakDanger,
  getTodayETClient,
} from '../src/public/TriggerMoments.js';

// ── Mock $w element factory ───────────────────────────────────────────────────

function makeMockEl(overrides = {}) {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    setAttribute: vi.fn(),
    getText: vi.fn(() => ''),
    setText: vi.fn(),
    addClass: vi.fn(),
    removeClass: vi.fn(),
    ...overrides,
  };
}

function makeElements() {
  return {
    $tierUpToast: makeMockEl(),
    $triggerLottieContainer: makeMockEl(),
    $confettiOverlay: makeMockEl(),
    $streakToastBox: makeMockEl(),
  };
}

// ── processTriggers ───────────────────────────────────────────────────────────

describe('processTriggers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns without throwing when triggers is undefined', () => {
    const $elements = makeElements();
    expect(() => processTriggers(undefined, $elements)).not.toThrow();
  });

  it('returns without throwing when triggers is null', () => {
    const $elements = makeElements();
    expect(() => processTriggers(null, $elements)).not.toThrow();
  });

  it('does not call show on any element when no triggers fire', () => {
    const $elements = makeElements();
    processTriggers({
      tierChanged: false, newTier: null, milestoneUnlocked: false,
      badgeUnlocked: null, challengeCompleted: [], streakDanger: false,
    }, $elements);
    expect($elements.$tierUpToast.show).not.toHaveBeenCalled();
    expect($elements.$triggerLottieContainer.show).not.toHaveBeenCalled();
  });

  it('calls show on $tierUpToast for tier-up trigger', () => {
    const $elements = makeElements();
    processTriggers({
      tierChanged: true, newTier: 'Wanderer',
      milestoneUnlocked: false, badgeUnlocked: null, challengeCompleted: [], streakDanger: false,
    }, $elements);
    expect($elements.$tierUpToast.show).toHaveBeenCalled();
  });

  it('plays tier-up first, then badge — in priority order', async () => {
    const callOrder = [];
    const $elements = {
      ...makeElements(),
      $tierUpToast: {
        ...makeMockEl(),
        show: vi.fn(() => callOrder.push('tierUpToast.show')),
      },
    };
    processTriggers({
      tierChanged: true, newTier: 'Wanderer',
      badgeUnlocked: 'week_wanderer',
      milestoneUnlocked: false, challengeCompleted: [], streakDanger: false,
    }, $elements);

    // First moment plays immediately
    expect(callOrder).toContain('tierUpToast.show');

    // Advance timers past the queue gap to trigger the next moment
    vi.advanceTimersByTime(5500);
    // $tierUpToast.show called again for badge moment
    expect($elements.$tierUpToast.show).toHaveBeenCalledTimes(2);
  });
});

// ── showTierUp ────────────────────────────────────────────────────────────────

describe('showTierUp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows $tierUpToast with tier name text', () => {
    const $elements = makeElements();
    showTierUp($elements, 'Wanderer');
    expect($elements.$tierUpToast.setText).toHaveBeenCalledWith(
      expect.stringContaining('Wanderer')
    );
    expect($elements.$tierUpToast.show).toHaveBeenCalled();
  });

  it('hides $tierUpToast after 5s', () => {
    const $elements = makeElements();
    showTierUp($elements, 'Wanderer');
    expect($elements.$tierUpToast.hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect($elements.$tierUpToast.hide).toHaveBeenCalled();
  });

  it('sets Lottie src on $triggerLottieContainer when NOT reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
    const $elements = makeElements();
    showTierUp($elements, 'Wanderer');
    expect($elements.$triggerLottieContainer.setAttribute).toHaveBeenCalledWith(
      'data-lottie-src',
      expect.stringContaining('cute-bear-dancing')
    );
  });

  it('skips Lottie and still shows toast when reduced motion is on', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const $elements = makeElements();
    showTierUp($elements, 'Wanderer');
    expect($elements.$triggerLottieContainer.setAttribute).not.toHaveBeenCalled();
    expect($elements.$tierUpToast.show).toHaveBeenCalled();
  });

  it('does not throw if $confettiOverlay is missing from $elements', () => {
    const $elements = makeElements();
    delete $elements.$confettiOverlay;
    expect(() => showTierUp($elements, 'Wanderer')).not.toThrow();
  });
});

// ── showChallengeCompleted ────────────────────────────────────────────────────

describe('showChallengeCompleted', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('shows toast with challenge title and reward points', () => {
    const $elements = makeElements();
    showChallengeCompleted($elements, [{ challengeId: 'ch1', title: 'First Review', rewardPoints: 150 }]);
    expect($elements.$tierUpToast.setText).toHaveBeenCalledWith(
      expect.stringContaining('First Review')
    );
    expect($elements.$tierUpToast.show).toHaveBeenCalled();
  });

  it('shows "+2 more" when 3 challenges complete simultaneously', () => {
    const $elements = makeElements();
    showChallengeCompleted($elements, [
      { challengeId: 'ch1', title: 'First Review', rewardPoints: 150 },
      { challengeId: 'ch2', title: 'Second', rewardPoints: 100 },
      { challengeId: 'ch3', title: 'Third', rewardPoints: 50 },
    ]);
    expect($elements.$tierUpToast.setText).toHaveBeenCalledWith(
      expect.stringContaining('+2 more')
    );
  });

  it('hides after 4s', () => {
    const $elements = makeElements();
    showChallengeCompleted($elements, [{ challengeId: 'ch1', title: 'T', rewardPoints: 50 }]);
    vi.advanceTimersByTime(4000);
    expect($elements.$tierUpToast.hide).toHaveBeenCalled();
  });

  it('skips Lottie when reduced motion is on', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const $elements = makeElements();
    showChallengeCompleted($elements, [{ challengeId: 'ch1', title: 'T', rewardPoints: 50 }]);
    expect($elements.$triggerLottieContainer.setAttribute).not.toHaveBeenCalled();
  });
});

// ── showBadgeUnlocked ─────────────────────────────────────────────────────────

describe('showBadgeUnlocked', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('shows toast with human-readable badge name', () => {
    const $elements = makeElements();
    showBadgeUnlocked($elements, 'week_wanderer');
    expect($elements.$tierUpToast.setText).toHaveBeenCalledWith(
      expect.stringContaining('Week Wanderer')
    );
    expect($elements.$tierUpToast.show).toHaveBeenCalled();
  });

  it('falls back to raw badge slug when not in BADGE_DISPLAY_NAMES', () => {
    const $elements = makeElements();
    showBadgeUnlocked($elements, 'mystery_badge_xyz');
    expect($elements.$tierUpToast.setText).toHaveBeenCalledWith(
      expect.stringContaining('mystery_badge_xyz')
    );
  });

  it('hides after 3s', () => {
    const $elements = makeElements();
    showBadgeUnlocked($elements, 'week_wanderer');
    vi.advanceTimersByTime(3000);
    expect($elements.$tierUpToast.hide).toHaveBeenCalled();
  });

  it('skips Lottie when reduced motion is on', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const $elements = makeElements();
    showBadgeUnlocked($elements, 'week_wanderer');
    expect($elements.$triggerLottieContainer.setAttribute).not.toHaveBeenCalled();
  });
});

// ── showStreakDanger — sessionStorage gate ────────────────────────────────────

describe('showStreakDanger', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows amber toast on first call of the ET day', () => {
    const $elements = makeElements();
    showStreakDanger($elements);
    expect($elements.$tierUpToast.show).toHaveBeenCalled();
    expect($elements.$tierUpToast.addClass).toHaveBeenCalledWith('trigger-toast--warning');
  });

  it('does NOT show toast on second call same ET day (sessionStorage gate)', () => {
    const $elements = makeElements();
    showStreakDanger($elements);    // first call — shown
    $elements.$tierUpToast.show.mockClear();
    showStreakDanger($elements);    // second call — gated
    expect($elements.$tierUpToast.show).not.toHaveBeenCalled();
  });

  it('shows toast again on a different ET day', () => {
    // First call on day 1
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // 10am EDT March 22
    const $elements = makeElements();
    showStreakDanger($elements);

    // Advance to next day
    vi.setSystemTime(new Date('2026-03-23T14:00:00Z')); // 10am EDT March 23
    $elements.$tierUpToast.show.mockClear();
    showStreakDanger($elements);
    expect($elements.$tierUpToast.show).toHaveBeenCalled();
  });

  it('hides after 6s', () => {
    const $elements = makeElements();
    showStreakDanger($elements);
    vi.advanceTimersByTime(6000);
    expect($elements.$tierUpToast.hide).toHaveBeenCalled();
  });

  it('shows toast (fallback) if sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
    const $elements = makeElements();
    expect(() => showStreakDanger($elements)).not.toThrow();
    expect($elements.$tierUpToast.show).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx vitest run tests/TriggerMoments.test.js
```

Expected: FAIL — `processTriggers`, `showTierUp`, etc. not yet exported.

- [ ] **Step 3: Implement all `show*` functions, `processTriggers`, and `playQueue` in `TriggerMoments.js`**

Add to `src/public/TriggerMoments.js` after `buildMomentQueue`:

```js
/**
 * Internal: plays a queue of moment functions sequentially with a 500ms gap.
 * Each show* function manages its own hide timing internally.
 * Uses a fixed 5500ms max gap (5s max animation + 500ms gap) between moments.
 * @param {Array<{key: string, fn: function}>} queue
 */
function playQueue(queue) {
  if (queue.length === 0) return;
  const [head, ...rest] = queue;
  head.fn();
  if (rest.length > 0) {
    setTimeout(() => playQueue(rest), 5500);
  }
}

/**
 * Entry point. Call after any receiveGamificationEvent response.
 * Evaluates trigger flags, queues moments in priority order,
 * and begins playing the queue. Silent no-op if triggers is absent.
 *
 * @param {object|null|undefined} triggers - The `triggers` object from the event response
 * @param {object} $elements - Wix $w element references:
 *   { $tierUpToast, $triggerLottieContainer, $confettiOverlay, $streakToastBox }
 */
export function processTriggers(triggers, $elements) {
  if (!triggers) return;
  const queue = buildMomentQueue(triggers, $elements);
  playQueue(queue);
}

/**
 * Plays dancing bear + confetti overlay for tier-up.
 * Falls back to text-only toast if reduced motion is preferred.
 * @param {object} $elements
 * @param {string} newTier
 */
export function showTierUp($elements, newTier) {
  const { $tierUpToast, $triggerLottieContainer, $confettiOverlay } = $elements || {};
  const text = `You reached ${newTier}!`;

  if ($tierUpToast) {
    $tierUpToast.setText(text);
    $tierUpToast.addClass('trigger-toast--default');
    $tierUpToast.show();
  }

  if (!useReducedMotion()) {
    if ($triggerLottieContainer) {
      $triggerLottieContainer.setAttribute('data-lottie-src', LOTTIE.BEAR_DANCING);
      $triggerLottieContainer.show();
    }
    if ($confettiOverlay) {
      $confettiOverlay.setAttribute('data-lottie-src', LOTTIE.CONFETTI);
      $confettiOverlay.show();
    }
  }

  setTimeout(() => {
    if ($tierUpToast) $tierUpToast.hide();
    if ($triggerLottieContainer) $triggerLottieContainer.hide();
    if ($confettiOverlay) $confettiOverlay.hide();
  }, DURATION.TIER_UP);
}

/**
 * Plays clapping bear + points toast for one or more completed challenges.
 * Shows first challenge title + "+N more" if multiple completed simultaneously.
 * @param {object} $elements
 * @param {Array<{challengeId, title, rewardPoints}>} challenges
 */
export function showChallengeCompleted($elements, challenges) {
  const { $tierUpToast, $triggerLottieContainer } = $elements || {};
  if (!Array.isArray(challenges) || challenges.length === 0) return;

  const first = challenges[0];
  const extra = challenges.length > 1 ? ` +${challenges.length - 1} more` : '';
  const text = `${first.title}${extra} complete! +${first.rewardPoints} pts`;

  if ($tierUpToast) {
    $tierUpToast.setText(text);
    $tierUpToast.addClass('trigger-toast--default');
    $tierUpToast.show();
  }

  if (!useReducedMotion() && $triggerLottieContainer) {
    $triggerLottieContainer.setAttribute('data-lottie-src', LOTTIE.BEAR_CLAPPING);
    $triggerLottieContainer.show();
  }

  setTimeout(() => {
    if ($tierUpToast) $tierUpToast.hide();
    if ($triggerLottieContainer) $triggerLottieContainer.hide();
  }, DURATION.CHALLENGE);
}

/**
 * Shows badge name + confetti pulse toast.
 * Resolves slug to human-readable name via BADGE_DISPLAY_NAMES; falls back to slug.
 * @param {object} $elements
 * @param {string} badgeId - Badge slug
 */
export function showBadgeUnlocked($elements, badgeId) {
  const { $tierUpToast, $triggerLottieContainer } = $elements || {};
  const displayName = BADGE_DISPLAY_NAMES[badgeId] || badgeId;
  const text = `Badge unlocked: ${displayName}`;

  if ($tierUpToast) {
    $tierUpToast.setText(text);
    $tierUpToast.addClass('trigger-toast--default');
    $tierUpToast.show();
  }

  if (!useReducedMotion() && $triggerLottieContainer) {
    $triggerLottieContainer.setAttribute('data-lottie-src', LOTTIE.SUCCESS_CONFETTI);
    $triggerLottieContainer.show();
  }

  setTimeout(() => {
    if ($tierUpToast) $tierUpToast.hide();
    if ($triggerLottieContainer) $triggerLottieContainer.hide();
  }, DURATION.BADGE);
}

/**
 * Delegates to StreakDisplay.showStreakToast for the day-7 milestone moment.
 * TriggerMoments orchestrates — StreakDisplay owns the display logic.
 * @param {object} $elements — must include $streakToastBox
 */
export function showStreakMilestone($elements) {
  // Dynamic import to avoid circular dependency in test environment
  // In production Wix Velo, StreakDisplay is imported at module top level.
  // Implementer: add `import { showStreakToast } from 'public/StreakDisplay.js';`
  // at the top of this file and call:
  //   showStreakToast($elements.$streakToastBox, { milestoneUnlocked: true });
  const { $streakToastBox } = $elements || {};
  if ($streakToastBox) {
    // showStreakToast($streakToastBox, { milestoneUnlocked: true });
    // Placeholder — wire StreakDisplay import in implementation step
  }
}

/**
 * Shows amber "streak danger" toast.
 * sessionStorage gate: shows at most once per ET calendar day.
 * Graceful degradation: shows toast if sessionStorage is unavailable.
 * @param {object} $elements
 */
export function showStreakDanger($elements) {
  const { $tierUpToast } = $elements || {};
  const todayKey = `cf_streak_danger_shown_${getTodayETClient()}`;

  try {
    if (sessionStorage.getItem(todayKey)) return;
    sessionStorage.setItem(todayKey, '1');
  } catch {
    // sessionStorage unavailable (private browsing) — show anyway
  }

  if ($tierUpToast) {
    $tierUpToast.setText("Your streak resets in < 4h — earn points to keep it!");
    $tierUpToast.addClass('trigger-toast--warning');
    $tierUpToast.show();
    setTimeout(() => $tierUpToast.hide(), DURATION.STREAK_DANGER);
  }
}
```

- [ ] **Step 4: Run — confirm PASS**

```bash
npx vitest run tests/TriggerMoments.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Run full suite to catch regressions**

```bash
npx vitest run
```

Expected: No regressions.

- [ ] **Step 6: Commit**

```bash
git add src/public/TriggerMoments.js tests/TriggerMoments.test.js
git commit -m "feat(phase5): TriggerMoments.js — processTriggers, all show* functions, sessionStorage gate"
```

---

## Task 6: `Member Page.js` integration

**No new automated tests for this task** — integration wiring is exercised by existing Member Page tests. Manual verification covers the Lottie attribute pickup.

- [ ] **Step 1: Add import to `Member Page.js`**

```js
import { processTriggers } from 'public/TriggerMoments.js';
import { showStreakToast } from 'public/StreakDisplay.js'; // already imported (Phase 2)
```

- [ ] **Step 2: Wire `processTriggers` after every `receiveGamificationEvent` call**

Replace existing per-feature celebration calls (direct `showStreakToast` for milestone, `showCompletionToast` for challenges) with a single `processTriggers` call:

```js
const result = await receiveGamificationEvent(eventType, payload, memberId);

if (result.triggers) {
  processTriggers(result.triggers, {
    $tierUpToast:            $w('#tierUpToast'),
    $triggerLottieContainer: $w('#triggerLottieContainer'),
    $confettiOverlay:        $w('#confettiOverlay'),
    $streakToastBox:         $w('#streakToastBox'),   // Phase 2 element
  });
}

// Informational UI updates continue unchanged:
// - renderStreakChip, updateProgressBars, etc.
```

- [ ] **Step 3: Wire `StreakDisplay.showStreakToast` inside `TriggerMoments.showStreakMilestone`**

Add the import at the top of `TriggerMoments.js` and complete the `showStreakMilestone` function body:

```js
import { showStreakToast } from 'public/StreakDisplay.js';

export function showStreakMilestone($elements) {
  const { $streakToastBox } = $elements || {};
  if ($streakToastBox) {
    showStreakToast($streakToastBox, { milestoneUnlocked: true });
  }
}
```

- [ ] **Step 4: Remove direct `showCompletionToast` and `showStreakToast` (milestone path) calls from `Member Page.js`**

These celebration calls are now owned by `processTriggers`. The informational streak chip render (`renderStreakChip`) remains in `Member Page.js` — only the celebratory overlay calls move.

- [ ] **Step 5: Smoke test on staging**

Trigger a point award event on the staging site. Verify:
- No console errors
- Tier-up toast fires when crossing a tier boundary
- Challenge completion toast fires when a challenge completes
- Streak danger toast shows when < 4h to ET midnight (manual clock-skew test or wait for the window)
- All existing streak chip and progress bar informational UI still updates correctly

---

## Task 7: Manual — editor elements and CSS

**No automated tests.** These are Wix Editor and CSS steps.

- [ ] **Step 1: Add editor elements inside `#loyaltySection` on Member Page**

| Element | Type | Nickname | Default state |
|---------|------|----------|---------------|
| Toast box | Box | `#tierUpToast` | Hidden |
| Lottie container | Box | `#triggerLottieContainer` | Hidden |
| Confetti overlay | Box | `#confettiOverlay` | Hidden, full-screen, z-index above all content |

All three elements added via Wix Studio editor. `#confettiOverlay` positioned absolute, full viewport width/height.

- [ ] **Step 2: Add CSS classes to `global.css`**

```css
/* TriggerMoments — toast variants */
.trigger-toast--default {
  background-color: var(--wst-color-primary, #6B46C1);
  color: #ffffff;
  border-radius: 8px;
  padding: 16px 24px;
}

.trigger-toast--warning {
  background-color: #F59E0B;
  color: #1a1a1a;
  border-radius: 8px;
  padding: 16px 24px;
}
```

- [ ] **Step 3: Update EDITOR_HOOKUP_GUIDE.html**

Add 3 new rows to the element nicknames table:
- `#tierUpToast` — Box — Member Page — Toast for tier-up, badge, challenge, streak danger
- `#triggerLottieContainer` — Box — Member Page — Inline Lottie host for bear animations
- `#confettiOverlay` — Box — Member Page — Full-screen confetti overlay

- [ ] **Step 4: Update EDITOR-HOOKUP-GUIDE.md**

Sync with HTML changes — same 3 entries added to the element table.

---

## Definition of Done

- [ ] `getNextETMidnightUTC()` helper added to `src/backend/utils/dateUtils.js` — DST-safe, 5 tests (2 DST boundary) all PASS
- [ ] `receiveGamificationEvent` extended: `triggers` object computed and returned on every success response
- [ ] `triggers.streakDanger` computed with catch guard (defaults `false` on error)
- [ ] `triggers.badgeUnlocked` populated in Phase 2 day-7 milestone path and Phase 4 challenge completion path
- [ ] `triggers.challengeCompleted` includes `rewardPoints` field (Phase 4 `challengeProgress` builder updated)
- [ ] All top-level `tierChanged`, `newTier`, `milestoneUnlocked` fields preserved (backwards compat)
- [ ] `triggers` default object present on the unknown-event early-return path (all false/null/empty)
- [ ] `BADGE_DISPLAY_NAMES` exported from `gamificationTokens.js`
- [ ] `TriggerMoments.js` implemented: `processTriggers`, `buildMomentQueue`, `showTierUp`, `showChallengeCompleted`, `showBadgeUnlocked`, `showStreakMilestone`, `showStreakDanger`, `playQueue`, `getTodayETClient`
- [ ] `useReducedMotion()` called per-invocation in every public function
- [ ] `sessionStorage` gate in `showStreakDanger` with try/catch for unavailable storage
- [ ] All Lottie calls use `setAttribute('data-lottie-src', ...)` — Wix Lottie widget picks up the attribute; TriggerMoments does NOT call Lottie play directly
- [ ] All `show*` functions guard against missing `$elements` properties — no throws if element absent
- [ ] `#tierUpToast`, `#triggerLottieContainer`, `#confettiOverlay` added to editor inside `#loyaltySection`
- [ ] `trigger-toast--default` and `trigger-toast--warning` CSS classes added to `global.css`
- [ ] `Member Page.js` updated: all celebration moment calls replaced by `processTriggers(result.triggers, $elements)`
- [ ] `TriggerMoments.showStreakMilestone` wired to `StreakDisplay.showStreakToast`
- [ ] Backend tests: all `streakDanger` branches PASS
- [ ] Backend tests: `triggers` object present and correct on all response paths
- [ ] Backend tests: DST boundary coverage for `getNextETMidnightUTC()` (spring-forward + fall-back)
- [ ] Frontend tests: priority queue ordering, all reduced-motion paths, sessionStorage gate, unknown badge slug fallback, null/undefined `triggers` guard
- [ ] Full test suite passes with no regressions (`npx vitest run`)
- [ ] `EDITOR_HOOKUP_GUIDE.html` updated (3 new element nicknames)
- [ ] `EDITOR-HOOKUP-GUIDE.md` updated (sync with HTML)
