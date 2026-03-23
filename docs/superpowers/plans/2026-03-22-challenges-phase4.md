# Challenges/Missions — Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CMS-driven Challenges system to `gamificationEventReceiver.web.js` that awards points and badges when members complete sequences of qualifying actions, with a `getActiveChallenges` webMethod for the web and mobile frontends.

**Architecture:** Three new CMS collections (`Challenges`, `MemberChallengeProgress`, `WishlistAddLog`) store challenge definitions, per-member progress, and daily wishlist cap state. All progress logic runs server-side in `gamificationEventReceiver.web.js` — challenge checks are appended after the existing Phase 1–2 point-award and streak-multiplier flow. A new pure `updateChallengeProgress()` helper is unit-tested in isolation. A `ChallengesDisplay.js` frontend module is display-only and integrates with `Member Page.js`. Two new event types (`gamification_ar_used`, `gamification_wishlist_add`) are added with their own point values and daily-cap logic.

**Tech Stack:** Wix Velo JS, wix-data (no atomic transactions), vitest, existing wix-data mock (`__seed`, `__onInsert`, `__onUpdate`, `__setQueryError`, `__getInserted`, `__reset`), `getTodayET()` from `backend/utils/dateUtils.js` (Phase 2).

---

## File Structure

| File | Status | Purpose |
|------|--------|---------|
| `src/public/gamificationTokens.js` | **Modify** | Add `POINT_VALUES.AR_USED = 10`, `POINT_VALUES.WISHLIST_ADD = 2` |
| `tests/gamificationTokens.test.js` | **Modify** | Tests for new point value constants |
| `src/backend/gamificationEventReceiver.web.js` | **Modify** | Add new event handlers, WishlistAddLog daily cap, `updateChallengeProgress()` helper, challenge progress pipeline, `getActiveChallenges` webMethod |
| `tests/gamificationEventReceiver.test.js` | **Modify** | Tests for new event points, daily cap, challenge progress, idempotency, completion, `getActiveChallenges` |
| `src/public/ChallengesDisplay.js` | **Create** | Frontend pure functions: `initChallengesDisplay`, `renderChallengeCard`, `updateChallengeProgress`, `showCompletionToast` |
| `tests/ChallengesDisplay.test.js` | **Create** | Tests for frontend pure functions |

---

## Environment Setup

All commands run from: `/Users/hal/gt/cfutons/refinery/rig`

Run tests: `npx vitest run tests/<filename>.test.js`
Run all tests: `npx vitest run`

The wix-data mock at `tests/__mocks__/wix-data.js` exposes:
- `__seed(collection, items)` — pre-populate collection
- `__reset()` — clear all collections and callbacks
- `__onUpdate(fn)` — intercept updates: `fn(collection, item)`
- `__onInsert(fn)` — intercept inserts: `fn(collection, item)`
- `__setQueryError(collection, err)` — force query to throw
- `__getInserted(collection)` — return array of inserted items

Time-pinning: `vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));`
Always restore in `afterEach`: `vi.useRealTimers();`

---

## Task 1: `gamificationTokens.js` — New point value constants

**Files:**
- Modify: `src/public/gamificationTokens.js`
- Modify: `tests/gamificationTokens.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/gamificationTokens.test.js`:

```js
import { POINT_VALUES } from '../src/public/gamificationTokens.js';

describe('POINT_VALUES — Phase 4 additions', () => {
  it('POINT_VALUES.AR_USED is 10', () => {
    expect(POINT_VALUES.AR_USED).toBe(10);
  });

  it('POINT_VALUES.WISHLIST_ADD is 2', () => {
    expect(POINT_VALUES.WISHLIST_ADD).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/gamificationTokens.test.js
```

Expected: FAIL — `POINT_VALUES.AR_USED` and `POINT_VALUES.WISHLIST_ADD` are undefined.

- [ ] **Step 3: Implement — add constants to `POINT_VALUES`**

In `src/public/gamificationTokens.js`, add to the `POINT_VALUES` object:

```js
AR_USED: 10,
WISHLIST_ADD: 2,
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/gamificationTokens.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/public/gamificationTokens.js tests/gamificationTokens.test.js
git commit -m "feat(phase4): add AR_USED and WISHLIST_ADD point values to gamificationTokens"
```

---

## Task 2: WishlistAddLog daily cap logic — isolated tests

**Files:**
- Modify: `src/backend/gamificationEventReceiver.web.js`
- Modify: `tests/gamificationEventReceiver.test.js`

This task implements only the `checkAndIncrementWishlistCap(memberId, todayET)` helper — a pure async function that reads and writes `WishlistAddLog`. Test it in isolation before wiring it into the main event flow.

- [ ] **Step 1: Write failing tests**

Add to `tests/gamificationEventReceiver.test.js`:

```js
import wixData from 'wix-data';
// Import the cap helper once exported:
import { checkAndIncrementWishlistCap } from '../src/backend/gamificationEventReceiver.web.js';

const WISHLIST_LOG_COLLECTION = 'WishlistAddLog';

describe('checkAndIncrementWishlistCap', () => {
  beforeEach(() => wixData.__reset());
  afterEach(() => vi.useRealTimers());

  it('returns { capped: false, count: 1 } on first add of the day (no existing record)', async () => {
    const result = await checkAndIncrementWishlistCap('member-1', '2026-03-22');
    expect(result.capped).toBe(false);
    expect(result.count).toBe(1);
    const inserted = wixData.__getInserted(WISHLIST_LOG_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ memberId: 'member-1', logDate: '2026-03-22', count: 1 });
  });

  it('returns { capped: false, count: 3 } when count was 2', async () => {
    wixData.__seed(WISHLIST_LOG_COLLECTION, [
      { _id: 'log-1', memberId: 'member-1', logDate: '2026-03-22', count: 2 }
    ]);
    const result = await checkAndIncrementWishlistCap('member-1', '2026-03-22');
    expect(result.capped).toBe(false);
    expect(result.count).toBe(3);
  });

  it('returns { capped: false, count: 5 } when count was 4 (5th add is still awarded)', async () => {
    wixData.__seed(WISHLIST_LOG_COLLECTION, [
      { _id: 'log-1', memberId: 'member-1', logDate: '2026-03-22', count: 4 }
    ]);
    const result = await checkAndIncrementWishlistCap('member-1', '2026-03-22');
    expect(result.capped).toBe(false);
    expect(result.count).toBe(5);
  });

  it('returns { capped: true, count: 5 } when already at 5 (6th+ add is capped)', async () => {
    wixData.__seed(WISHLIST_LOG_COLLECTION, [
      { _id: 'log-1', memberId: 'member-1', logDate: '2026-03-22', count: 5 }
    ]);
    const result = await checkAndIncrementWishlistCap('member-1', '2026-03-22');
    expect(result.capped).toBe(true);
    expect(result.count).toBe(5);
  });

  it('ignores log entries from other dates', async () => {
    wixData.__seed(WISHLIST_LOG_COLLECTION, [
      { _id: 'log-1', memberId: 'member-1', logDate: '2026-03-21', count: 5 }
    ]);
    // Yesterday had 5, today has none — should not be capped
    const result = await checkAndIncrementWishlistCap('member-1', '2026-03-22');
    expect(result.capped).toBe(false);
    expect(result.count).toBe(1);
  });

  it('ignores log entries from other members', async () => {
    wixData.__seed(WISHLIST_LOG_COLLECTION, [
      { _id: 'log-1', memberId: 'member-other', logDate: '2026-03-22', count: 5 }
    ]);
    const result = await checkAndIncrementWishlistCap('member-1', '2026-03-22');
    expect(result.capped).toBe(false);
    expect(result.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — `checkAndIncrementWishlistCap` not exported.

- [ ] **Step 3: Implement `checkAndIncrementWishlistCap` in receiver**

Add the following near the top of `gamificationEventReceiver.web.js` (after existing constants):

```js
const CHALLENGES_COLLECTION = 'Challenges';
const CHALLENGE_PROGRESS_COLLECTION = 'MemberChallengeProgress';
const WISHLIST_LOG_COLLECTION = 'WishlistAddLog';

const DAILY_WISHLIST_CAP = 5;

/**
 * Reads and increments the WishlistAddLog for memberId + logDate.
 * Returns { capped: boolean, count: number }.
 * Creates a new record if none exists.
 * Non-critical — caller logs but does not throw on failure.
 * @param {string} memberId
 * @param {string} logDate  YYYY-MM-DD ET date string
 * @returns {Promise<{ capped: boolean, count: number }>}
 */
export async function checkAndIncrementWishlistCap(memberId, logDate) {
  const results = await wixData
    .query(WISHLIST_LOG_COLLECTION)
    .eq('memberId', memberId)
    .eq('logDate', logDate)
    .find();

  const existing = results.items[0];

  if (!existing) {
    await wixData.insert(WISHLIST_LOG_COLLECTION, { memberId, logDate, count: 1 });
    return { capped: false, count: 1 };
  }

  if (existing.count >= DAILY_WISHLIST_CAP) {
    return { capped: true, count: existing.count };
  }

  const newCount = existing.count + 1;
  await wixData.update(WISHLIST_LOG_COLLECTION, { ...existing, count: newCount });
  return { capped: false, count: newCount };
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: New cap tests PASS. Existing receiver tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
git commit -m "feat(phase4): WishlistAddLog daily cap helper — checkAndIncrementWishlistCap"
```

---

## Task 3: `updateChallengeProgress()` — pure helper with idempotency

**Files:**
- Modify: `src/backend/gamificationEventReceiver.web.js`
- Modify: `tests/gamificationEventReceiver.test.js`

This task implements the core challenge-progress update logic as a standalone async helper that can be tested independently of the main event flow.

`updateChallengeProgress(memberId, challenge, eventId, now)` — reads `MemberChallengeProgress`, checks idempotency, increments, handles completion, returns a result object.

- [ ] **Step 1: Write failing tests**

Add to `tests/gamificationEventReceiver.test.js`:

```js
import { updateChallengeProgress } from '../src/backend/gamificationEventReceiver.web.js';

const CHALLENGE_PROGRESS_COLLECTION = 'MemberChallengeProgress';

const BASE_CHALLENGE = {
  _id: 'ch-1',
  challengeId: 'ch-1',
  title: 'First Steps',
  conditionType: 'ORDER_COMPLETE',
  targetCount: 3,
  rewardPoints: 100,
  rewardBadgeId: null,
  expiresAt: new Date('2027-01-01T00:00:00Z'),
  active: true,
};

describe('updateChallengeProgress', () => {
  beforeEach(() => wixData.__reset());

  it('creates a new progress record and increments to 1 on first event', async () => {
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-001', new Date());
    expect(result.progressValue).toBe(1);
    expect(result.justCompleted).toBe(false);
    const inserted = wixData.__getInserted(CHALLENGE_PROGRESS_COLLECTION);
    expect(inserted[0]).toMatchObject({
      memberId: 'member-1',
      challengeId: 'ch-1',
      progressValue: 1,
    });
  });

  it('increments existing progress record', async () => {
    wixData.__seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 1,
        eventIds: JSON.stringify(['evt-000']),
        completedAt: null,
        notifiedAt: null,
      },
    ]);
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-001', new Date());
    expect(result.progressValue).toBe(2);
    expect(result.justCompleted).toBe(false);
  });

  it('does NOT increment when eventId is already in eventIds (idempotency)', async () => {
    wixData.__seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 1,
        eventIds: JSON.stringify(['evt-001']),
        completedAt: null,
        notifiedAt: null,
      },
    ]);
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-001', new Date());
    expect(result.alreadyProcessed).toBe(true);
    expect(result.progressValue).toBe(1);
  });

  it('sets justCompleted: true and completedAt when progressValue reaches targetCount', async () => {
    wixData.__seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 2,
        eventIds: JSON.stringify(['evt-000', 'evt-001']),
        completedAt: null,
        notifiedAt: null,
      },
    ]);
    const now = new Date('2026-03-22T14:00:00Z');
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-002', now);
    expect(result.progressValue).toBe(3);
    expect(result.justCompleted).toBe(true);
    expect(result.completedAt).toEqual(now);
  });

  it('does NOT increment past targetCount (already completed challenge)', async () => {
    wixData.__seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 3,
        eventIds: JSON.stringify(['evt-000', 'evt-001', 'evt-002']),
        completedAt: new Date('2026-03-22T10:00:00Z'),
        notifiedAt: null,
      },
    ]);
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-003', new Date());
    // Challenge already completed — progressValue stays at targetCount, no increment
    expect(result.alreadyCompleted).toBe(true);
    expect(result.progressValue).toBe(3);
  });

  it('trims eventIds to 501 entries when array reaches 1000 before appending', async () => {
    const bigIds = Array.from({ length: 1000 }, (_, i) => `evt-${i}`);
    wixData.__seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 1,
        eventIds: JSON.stringify(bigIds),
        completedAt: null,
        notifiedAt: null,
      },
    ]);

    let writtenRecord = null;
    wixData.__onUpdate((collection, item) => {
      if (collection === CHALLENGE_PROGRESS_COLLECTION) writtenRecord = item;
    });

    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-new', new Date());
    // After trim: keep newest 500 of original 1000, then append 'evt-new' = 501
    expect(result.progressValue).toBe(2);
    expect(result.justCompleted).toBe(false);
    expect(writtenRecord).not.toBeNull();
    const writtenIds = JSON.parse(writtenRecord.eventIds);
    expect(writtenIds).toHaveLength(501);
    // Newest 500 kept: evt-500 through evt-999, plus 'evt-new'
    expect(writtenIds).toContain('evt-999');
    expect(writtenIds).toContain('evt-new');
    expect(writtenIds).not.toContain('evt-0'); // oldest trimmed
  });

  it('returns { progressError: true } without throwing when wix-data query fails', async () => {
    wixData.__setQueryError(CHALLENGE_PROGRESS_COLLECTION, new Error('DB unavailable'));
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-001', new Date());
    expect(result.progressError).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — `updateChallengeProgress` not exported.

- [ ] **Step 3: Implement `updateChallengeProgress` helper**

Add to `gamificationEventReceiver.web.js`:

```js
/**
 * Updates MemberChallengeProgress for one member + one challenge.
 * Handles idempotency (eventIds JSON array), bounded array (trim at 1000),
 * and challenge completion detection.
 *
 * @param {string} memberId
 * @param {Object} challenge  - Full challenge record from Challenges collection
 * @param {string} eventId    - Unique event ID for idempotency
 * @param {Date}   now        - Current timestamp (injected for testability)
 * @returns {Promise<{
 *   challengeId: string,
 *   title: string,
 *   progressValue: number,
 *   targetCount: number,
 *   justCompleted: boolean,
 *   completedAt: Date|null,
 *   alreadyProcessed?: boolean,
 *   alreadyCompleted?: boolean,
 *   progressError?: boolean,
 * }>}
 */
export async function updateChallengeProgress(memberId, challenge, eventId, now) {
  const { challengeId, title, targetCount } = challenge;
  const base = { challengeId, title, targetCount };

  try {
    const results = await wixData
      .query(CHALLENGE_PROGRESS_COLLECTION)
      .eq('memberId', memberId)
      .eq('challengeId', challengeId)
      .find();

    let record = results.items[0];

    // If challenge already completed, do nothing
    if (record && record.completedAt) {
      return { ...base, progressValue: record.progressValue, justCompleted: false, completedAt: record.completedAt, alreadyCompleted: true };
    }

    // Parse eventIds — create record if none exists
    if (!record) {
      record = {
        memberId,
        challengeId,
        progressValue: 0,
        eventIds: '[]',
        completedAt: null,
        notifiedAt: null,
      };
    }

    const eventIds = JSON.parse(record.eventIds || '[]');

    // Idempotency check
    if (eventIds.includes(eventId)) {
      return { ...base, progressValue: record.progressValue, justCompleted: false, completedAt: record.completedAt, alreadyProcessed: true };
    }

    // Bounded array: trim oldest 500 if at 1000
    if (eventIds.length >= 1000) {
      eventIds.splice(0, 500);
    }
    eventIds.push(eventId);

    const newProgress = record.progressValue + 1;
    const justCompleted = newProgress >= targetCount;
    const completedAt = justCompleted ? now : null;

    const updatedRecord = {
      ...record,
      progressValue: newProgress,
      eventIds: JSON.stringify(eventIds),
      completedAt,
    };

    if (record._id) {
      await wixData.update(CHALLENGE_PROGRESS_COLLECTION, updatedRecord);
    } else {
      await wixData.insert(CHALLENGE_PROGRESS_COLLECTION, updatedRecord);
    }

    return { ...base, progressValue: newProgress, justCompleted, completedAt };
  } catch (err) {
    logError(`updateChallengeProgress — failed for member ${memberId} challenge ${challengeId}`, err, { silent: true });
    return { ...base, progressValue: 0, justCompleted: false, completedAt: null, progressError: true };
  }
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: All new `updateChallengeProgress` tests PASS. Existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
git commit -m "feat(phase4): updateChallengeProgress helper — idempotency, bounded eventIds, completion"
```

---

## Task 4: Extend `receiveGamificationEvent` with new event types + challenge pipeline

**Files:**
- Modify: `src/backend/gamificationEventReceiver.web.js`
- Modify: `tests/gamificationEventReceiver.test.js`

Wire the two new events into `resolvePoints()`, add the wishlist cap step and the challenge progress pipeline after the existing point-award + streak flow. The challenge pipeline calls `updateChallengeProgress()` (Task 3) for each matching active challenge.

### Event → conditionType mapping

```js
const EVENT_TO_CONDITION_TYPE = {
  'gamification_order_complete': 'ORDER_COMPLETE',
  'gamification_submit_review': 'REVIEW_SUBMITTED',
  'gamification_spin_completed': 'SPIN_COMPLETED',
  'gamification_ar_used': 'AR_USED',
  'gamification_wishlist_add': 'WISHLIST_ADD',
};
```

- [ ] **Step 1: Write failing tests**

Add to `tests/gamificationEventReceiver.test.js`:

```js
describe('receiveGamificationEvent — gamification_ar_used', () => {
  beforeEach(() => wixData.__reset());

  it('awards 10 pts for gamification_ar_used (no multiplier at streak 0)', async () => {
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 0, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    const result = await receiveGamificationEvent('gamification_ar_used', {}, 'member-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(10);
  });

  it('applies streak multiplier to gamification_ar_used (2x at day 7)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 500, tier: 'MOUNTAIN_GUIDE',
        currentStreakDays: 7, lastActivityDateET: '2026-03-21', bonusSpinsAvailable: 0 }
    ]);
    const result = await receiveGamificationEvent('gamification_ar_used', { eventId: 'e1' }, 'member-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(520); // 500 + Math.round(10 * 2) = 520
  });
});

describe('receiveGamificationEvent — gamification_wishlist_add daily cap', () => {
  beforeEach(() => wixData.__reset());
  afterEach(() => vi.useRealTimers());

  it('awards 2 pts for first wishlist add of the day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 100, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    const result = await receiveGamificationEvent('gamification_wishlist_add', { eventId: 'e1' }, 'member-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(102);
  });

  it('awards 0 pts when daily cap of 5 is reached, but returns success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 110, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('WishlistAddLog', [
      { _id: 'wl-1', memberId: 'member-1', logDate: '2026-03-22', count: 5 }
    ]);
    const result = await receiveGamificationEvent('gamification_wishlist_add', { eventId: 'e2' }, 'member-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(110); // no change
    expect(result.pointAwardSkipped).toBe(true);
  });

  it('challenge progress still increments past daily cap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 110, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('WishlistAddLog', [
      { _id: 'wl-1', memberId: 'member-1', logDate: '2026-03-22', count: 5 }
    ]);
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Wishlist Builder', conditionType: 'WISHLIST_ADD',
        targetCount: 10, rewardPoints: 30, rewardBadgeId: null,
        expiresAt: new Date('2027-01-01T00:00:00Z'), active: true }
    ]);
    const result = await receiveGamificationEvent('gamification_wishlist_add', { eventId: 'e6' }, 'member-1');
    expect(result.success).toBe(true);
    expect(result.pointAwardSkipped).toBe(true);
    // Challenge progress must have been attempted
    const progress = result.challengeProgress || [];
    const entry = progress.find(p => p.challengeId === 'ch-1');
    expect(entry).toBeTruthy();
    expect(entry.progressValue).toBe(1);
  });
});

describe('receiveGamificationEvent — challenge progress pipeline', () => {
  beforeEach(() => wixData.__reset());
  afterEach(() => vi.useRealTimers());

  it('increments progress for a matching active challenge on qualifying event', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 0, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'First Steps', conditionType: 'ORDER_COMPLETE',
        targetCount: 1, rewardPoints: 50, rewardBadgeId: null,
        expiresAt: new Date('2027-01-01T00:00:00Z'), active: true }
    ]);
    const result = await receiveGamificationEvent(
      'gamification_order_complete', { orderTotal: 100, eventId: 'evt-1' }, 'member-1'
    );
    expect(result.success).toBe(true);
    const progress = result.challengeProgress || [];
    const entry = progress.find(p => p.challengeId === 'ch-1');
    expect(entry).toBeTruthy();
    expect(entry.justCompleted).toBe(true);
  });

  it('does NOT progress challenges for non-matching conditionType', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 0, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Top Reviewer', conditionType: 'REVIEW_SUBMITTED',
        targetCount: 3, rewardPoints: 150, rewardBadgeId: 'top_reviewer',
        expiresAt: new Date('2027-01-01T00:00:00Z'), active: true }
    ]);
    const result = await receiveGamificationEvent(
      'gamification_order_complete', { orderTotal: 50, eventId: 'evt-1' }, 'member-1'
    );
    // REVIEW_SUBMITTED challenge should have 0 progress
    const progress = result.challengeProgress || [];
    expect(progress.find(p => p.challengeId === 'ch-1')).toBeFalsy();
  });

  it('awards challenge rewardPoints on completion and adds to member total', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 0, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'First Steps', conditionType: 'ORDER_COMPLETE',
        targetCount: 1, rewardPoints: 50, rewardBadgeId: null,
        expiresAt: new Date('2027-01-01T00:00:00Z'), active: true }
    ]);
    const result = await receiveGamificationEvent(
      'gamification_order_complete', { orderTotal: 100, eventId: 'evt-1' }, 'member-1'
    );
    // 100 base pts (order) + 50 challenge completion bonus = 150
    expect(result.newTotal).toBe(150);
  });

  it('excludes expired challenges even when active = true in CMS', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 0, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Expired Challenge', conditionType: 'ORDER_COMPLETE',
        targetCount: 1, rewardPoints: 50, rewardBadgeId: null,
        expiresAt: new Date('2026-01-01T00:00:00Z'), active: true } // expired
    ]);
    const result = await receiveGamificationEvent(
      'gamification_order_complete', { orderTotal: 50, eventId: 'evt-1' }, 'member-1'
    );
    const progress = result.challengeProgress || [];
    expect(progress.find(p => p.challengeId === 'ch-1')).toBeFalsy();
  });

  it('returns challengeProgressError: true on progress write failure, point award unaffected', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 0, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'First Steps', conditionType: 'ORDER_COMPLETE',
        targetCount: 1, rewardPoints: 50, rewardBadgeId: null,
        expiresAt: new Date('2027-01-01T00:00:00Z'), active: true }
    ]);
    wixData.__setQueryError('MemberChallengeProgress', new Error('DB error'));
    const result = await receiveGamificationEvent(
      'gamification_order_complete', { orderTotal: 100, eventId: 'evt-1' }, 'member-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(100); // point award succeeded
    expect(result.challengeProgressError).toBe(true);
  });

  it('uses fallback eventId when payload.eventId is missing, logs warning', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 0, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'First Steps', conditionType: 'ORDER_COMPLETE',
        targetCount: 2, rewardPoints: 50, rewardBadgeId: null,
        expiresAt: new Date('2027-01-01T00:00:00Z'), active: true }
    ]);
    // No eventId in payload
    const result = await receiveGamificationEvent('gamification_order_complete', { orderTotal: 50 }, 'member-1');
    expect(result.success).toBe(true);
    // Progress should still increment (fallback ID used)
    const progress = result.challengeProgress || [];
    const entry = progress.find(p => p.challengeId === 'ch-1');
    expect(entry).toBeTruthy();
    expect(entry.progressValue).toBe(1);
  });

  it('emits gamification_badge_unlocked when challenge has rewardBadgeId', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'member-1', totalPoints: 0, tier: 'TRAIL_BLAZER',
        currentStreakDays: 0, lastActivityDateET: null, bonusSpinsAvailable: 0 }
    ]);
    wixData.__seed('Challenges', [
      { _id: 'ch-2', challengeId: 'ch-2', title: 'AR Explorer', conditionType: 'AR_USED',
        targetCount: 1, rewardPoints: 25, rewardBadgeId: 'ar_explorer',
        expiresAt: new Date('2027-01-01T00:00:00Z'), active: true }
    ]);
    const result = await receiveGamificationEvent('gamification_ar_used', { eventId: 'e1' }, 'member-1');
    expect(result.success).toBe(true);
    const progress = result.challengeProgress || [];
    const entry = progress.find(p => p.challengeId === 'ch-2');
    expect(entry.justCompleted).toBe(true);
    // Badge unlock event recorded in result
    expect(entry.badgeUnlocked).toBe('ar_explorer');
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — new event types return null delta; challenge progress not yet wired.

- [ ] **Step 3: Implement — extend `resolvePoints()` and main event handler**

**3a. Add new cases to `resolvePoints()`:**

```js
case 'gamification_ar_used':
  return POINT_VALUES.AR_USED; // 10

case 'gamification_wishlist_add':
  return POINT_VALUES.WISHLIST_ADD; // 2 (before cap check — cap zeroes this out in step 9)
```

**3b. Add the `EVENT_TO_CONDITION_TYPE` map near the top of the file:**

```js
const EVENT_TO_CONDITION_TYPE = {
  'gamification_order_complete': 'ORDER_COMPLETE',
  'gamification_submit_review': 'REVIEW_SUBMITTED',
  'gamification_spin_completed': 'SPIN_COMPLETED',
  'gamification_ar_used': 'AR_USED',
  'gamification_wishlist_add': 'WISHLIST_ADD',
};
```

**3c. Extend the main `receiveGamificationEvent` handler body** — insert the cap pre-check BEFORE the existing MemberPoints write (before step 7), and then add the challenge progress pipeline after.

The wishlist cap check MUST happen before the MemberPoints write to avoid a double-write race. The spec states `basePoints = WISHLIST_ADD (subject to daily cap)` — treat cap enforcement as zeroing the delta before award, not reversing after.

**Insert before the existing MemberPoints write:**

```js
// ── Step 6.5: Wishlist daily cap pre-check (gamification_wishlist_add only) ──
let pointAwardSkipped = false;

if (eventName === 'gamification_wishlist_add') {
  try {
    const todayET = getTodayET();
    const capResult = await checkAndIncrementWishlistCap(memberId, todayET);
    if (capResult.capped) {
      // Zero out the delta before the MemberPoints write — single write, no race
      delta = 0;
      pointAwardSkipped = true;
    }
  } catch (capErr) {
    logError(`gamificationEventReceiver — WishlistAddLog failed for ${memberId}`, capErr, { silent: true });
    // Non-critical: proceed without cap enforcement (award points anyway)
  }
}
// MemberPoints write follows using delta (may be 0 if capped)
```

**After the existing MemberPoints write, add the challenge progress pipeline (step 10):**

```js
// ── Step 10: Challenge progress pipeline (all event types) ───────────────────
let challengeProgress = [];
let challengeProgressError = false;

const conditionType = EVENT_TO_CONDITION_TYPE[eventName];
if (conditionType) {
  try {
    const now = new Date();
    const eventId = payload.eventId || (() => {
      logError(`gamificationEventReceiver — missing eventId on ${eventName} for ${memberId}`,
        new Error('Missing eventId'), { silent: true });
      return `${memberId}:${eventName}:${Date.now()}`;
    })();

    // Query active challenges for this conditionType
    const challengeResults = await wixData
      .query(CHALLENGES_COLLECTION)
      .eq('conditionType', conditionType)
      .eq('active', true)
      .find();

    // Filter expired (belt-and-suspenders)
    const activeChallenges = challengeResults.items.filter(
      c => !c.expiresAt || new Date(c.expiresAt) > now
    );

    for (const challenge of activeChallenges) {
      const progressResult = await updateChallengeProgress(memberId, challenge, eventId, now);

      if (progressResult.progressError) {
        challengeProgressError = true;
        continue;
      }

      if (progressResult.justCompleted) {
        // Award challenge rewardPoints
        try {
          const currentRecord = await findMemberRecord(memberId);
          if (currentRecord) {
            const bonusTotal = currentRecord.totalPoints + challenge.rewardPoints;
            const bonusTier = getTierForPoints(bonusTotal);
            await wixData.update(MEMBER_POINTS_COLLECTION, {
              ...currentRecord,
              totalPoints: bonusTotal,
              tier: bonusTier,
            });
            newTotal = bonusTotal;
            newTier = bonusTier;
            tierChanged = newTier !== oldTier;
          }
        } catch (bonusErr) {
          logError(`gamificationEventReceiver — challenge bonus award failed for ${memberId} challenge ${challenge.challengeId}`, bonusErr, { silent: true });
        }

        // Badge unlock (with de-dup guard)
        if (challenge.rewardBadgeId) {
          try {
            const badgeRecord = await findMemberRecord(memberId);
            const unlockedBadges = badgeRecord ? JSON.parse(badgeRecord.unlockedBadges || '[]') : [];
            if (!unlockedBadges.includes(challenge.rewardBadgeId)) {
              progressResult.badgeUnlocked = challenge.rewardBadgeId;
              // Emit gamification_badge_unlocked event (Phase 5 will consume this)
              // For now: record in response; Phase 5 wires the actual trigger
            } else {
              progressResult.badgeDuplicate = true;
            }
          } catch (badgeErr) {
            logError(`gamificationEventReceiver — badge check failed for ${memberId}`, badgeErr, { silent: true });
          }
        }

        // Emit gamification_challenge_completed marker in response (Phase 5 consumes)
        progressResult.challengeCompleted = true;
      }

      challengeProgress.push(progressResult);
    }
  } catch (pipelineErr) {
    logError(`gamificationEventReceiver — challenge pipeline failed for ${memberId} event ${eventName}`, pipelineErr, { silent: true });
    challengeProgressError = true;
  }
}

return {
  success: true,
  newTotal,
  tierChanged,
  newTier,
  ...(pointAwardSkipped ? { pointAwardSkipped: true } : {}),
  ...(challengeProgress.length > 0 ? { challengeProgress } : {}),
  ...(challengeProgressError ? { challengeProgressError: true } : {}),
};
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: All new tests PASS. Full suite clean.

- [ ] **Step 5: Commit**

```bash
git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
git commit -m "feat(phase4): new event types + challenge progress pipeline in receiveGamificationEvent"
```

---

## Task 5: `getActiveChallenges()` webMethod

**Files:**
- Modify: `src/backend/gamificationEventReceiver.web.js`
- Modify: `tests/gamificationEventReceiver.test.js`

New exported `webMethod` (Permissions.Member). Rate limit: 10 calls/hr per member (same pattern as existing rate limiting in the receiver).

- [ ] **Step 1: Write failing tests**

Add to `tests/gamificationEventReceiver.test.js`:

```js
import { getActiveChallenges } from '../src/backend/gamificationEventReceiver.web.js';

describe('getActiveChallenges', () => {
  beforeEach(() => wixData.__reset());
  afterEach(() => vi.useRealTimers());

  it('returns empty challenges array when no active challenges exist', async () => {
    const result = await getActiveChallenges('member-1');
    expect(result).toEqual({ challenges: [] });
  });

  it('returns up to 5 active challenges sorted by expiresAt ASC', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'A', conditionType: 'ORDER_COMPLETE', targetCount: 1, rewardPoints: 10, rewardBadgeId: null, expiresAt: new Date('2026-04-05T00:00:00Z'), active: true },
      { _id: 'ch-2', challengeId: 'ch-2', title: 'B', conditionType: 'REVIEW_SUBMITTED', targetCount: 3, rewardPoints: 20, rewardBadgeId: null, expiresAt: new Date('2026-03-28T00:00:00Z'), active: true },
      { _id: 'ch-3', challengeId: 'ch-3', title: 'C', conditionType: 'AR_USED', targetCount: 1, rewardPoints: 25, rewardBadgeId: 'ar_explorer', expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
    ]);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges).toHaveLength(3);
    // Sorted expiresAt ASC: B (Mar 28), C (Apr 1), A (Apr 5)
    expect(result.challenges[0].challengeId).toBe('ch-2');
    expect(result.challenges[1].challengeId).toBe('ch-3');
    expect(result.challenges[2].challengeId).toBe('ch-1');
  });

  it('excludes expired challenges (expiresAt < now) even when active = true', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Active', conditionType: 'ORDER_COMPLETE', targetCount: 1, rewardPoints: 10, rewardBadgeId: null, expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
      { _id: 'ch-2', challengeId: 'ch-2', title: 'Expired', conditionType: 'ORDER_COMPLETE', targetCount: 1, rewardPoints: 10, rewardBadgeId: null, expiresAt: new Date('2026-01-01T00:00:00Z'), active: true },
    ]);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].challengeId).toBe('ch-1');
  });

  it('slices to maximum 5 challenges', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    const sixChallenges = Array.from({ length: 6 }, (_, i) => ({
      _id: `ch-${i}`, challengeId: `ch-${i}`, title: `Challenge ${i}`,
      conditionType: 'ORDER_COMPLETE', targetCount: 1, rewardPoints: 10, rewardBadgeId: null,
      expiresAt: new Date(`2026-04-0${i + 1}T00:00:00Z`), active: true,
    }));
    wixData.__seed('Challenges', sixChallenges);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges).toHaveLength(5);
  });

  it('merges member progress (progressValue, completedAt) into each challenge', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'First Steps', conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50, rewardBadgeId: null, expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
    ]);
    wixData.__seed('MemberChallengeProgress', [
      { _id: 'prog-1', memberId: 'member-1', challengeId: 'ch-1', progressValue: 2, completedAt: null, notifiedAt: null, eventIds: '[]' },
    ]);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges[0].progressValue).toBe(2);
    expect(result.challenges[0].completedAt).toBeNull();
  });

  it('defaults progressValue to 0 and completedAt to null when no progress record exists', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'First Steps', conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50, rewardBadgeId: null, expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
    ]);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges[0].progressValue).toBe(0);
    expect(result.challenges[0].completedAt).toBeNull();
  });

  it('returns response shape matching mobile API contract', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    wixData.__seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'AR Explorer', conditionType: 'AR_USED', targetCount: 1, rewardPoints: 25, rewardBadgeId: 'ar_explorer', expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
    ]);
    const result = await getActiveChallenges('member-1');
    const c = result.challenges[0];
    // Required fields per mobile contract
    expect(c).toHaveProperty('challengeId');
    expect(c).toHaveProperty('title');
    expect(c).toHaveProperty('description');
    expect(c).toHaveProperty('targetCount');
    expect(c).toHaveProperty('rewardPoints');
    expect(c).toHaveProperty('rewardBadgeId');
    expect(c).toHaveProperty('expiresAt');
    expect(c).toHaveProperty('progressValue');
    expect(c).toHaveProperty('completedAt');
  });

  it('returns 429 after exceeding rate limit of 10 calls per hour', async () => {
    // Call 11 times for same member — 11th should return 429
    for (let i = 0; i < 10; i++) {
      await getActiveChallenges('member-rate-limit');
    }
    const result = await getActiveChallenges('member-rate-limit');
    expect(result.error).toBe(429);
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — `getActiveChallenges` not exported.

- [ ] **Step 3: Implement `getActiveChallenges` webMethod**

Add to `gamificationEventReceiver.web.js`:

```js
// In-memory rate limit store for getActiveChallenges (10 calls/hr per member)
// Resets on server restart — acceptable for Wix serverless execution model
const _activeChallengesRateLimit = new Map(); // memberId → { count, windowStart }
const ACTIVE_CHALLENGES_RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns up to 5 active, non-expired challenges for a member, merged with their progress.
 * Rate limited to 10 calls/hr per member.
 *
 * @param {string} memberId
 * @returns {Promise<{ challenges: Array } | { error: 429 }>}
 */
export const getActiveChallenges = webMethod(
  Permissions.Member,
  async (memberId) => {
    if (!memberId) return { challenges: [] };

    // Rate limit check
    const now = Date.now();
    const rl = _activeChallengesRateLimit.get(memberId) || { count: 0, windowStart: now };
    if (now - rl.windowStart > RATE_LIMIT_WINDOW_MS) {
      rl.count = 0;
      rl.windowStart = now;
    }
    rl.count += 1;
    _activeChallengesRateLimit.set(memberId, rl);
    if (rl.count > ACTIVE_CHALLENGES_RATE_LIMIT) {
      return { error: 429 };
    }

    try {
      const nowDate = new Date();

      // Query active challenges
      const challengeResults = await wixData
        .query(CHALLENGES_COLLECTION)
        .eq('active', true)
        .find();

      // Filter expired, sort by expiresAt ASC, slice to 5
      const active = challengeResults.items
        .filter(c => c.expiresAt && new Date(c.expiresAt) > nowDate)
        .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))
        .slice(0, 5);

      if (active.length === 0) return { challenges: [] };

      // Fetch member progress for all matched challenges in parallel
      const progressPromises = active.map(c =>
        wixData
          .query(CHALLENGE_PROGRESS_COLLECTION)
          .eq('memberId', memberId)
          .eq('challengeId', c.challengeId || c._id)
          .find()
          .then(r => ({ challengeId: c.challengeId || c._id, record: r.items[0] || null }))
          .catch(() => ({ challengeId: c.challengeId || c._id, record: null }))
      );
      const progressResults = await Promise.all(progressPromises);
      const progressMap = Object.fromEntries(progressResults.map(p => [p.challengeId, p.record]));

      const challenges = active.map(c => {
        const cId = c.challengeId || c._id;
        const prog = progressMap[cId];
        return {
          challengeId: cId,
          title: c.title,
          description: c.description || null,
          conditionType: c.conditionType,
          targetCount: c.targetCount,
          rewardPoints: c.rewardPoints,
          rewardBadgeId: c.rewardBadgeId || null,
          expiresAt: c.expiresAt instanceof Date ? c.expiresAt.toISOString() : c.expiresAt,
          progressValue: prog ? prog.progressValue : 0,
          completedAt: prog ? prog.completedAt : null,
        };
      });

      return { challenges };
    } catch (err) {
      logError(`getActiveChallenges — failed for member ${memberId}`, err);
      return { challenges: [] };
    }
  }
);
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: All `getActiveChallenges` tests PASS. Full suite clean.

- [ ] **Step 5: Commit**

```bash
git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
git commit -m "feat(phase4): getActiveChallenges webMethod — rate limit, expiry filter, progress merge"
```

---

## Task 6: `ChallengesDisplay.js` — frontend pure functions

**Files:**
- Create: `src/public/ChallengesDisplay.js`
- Create: `tests/ChallengesDisplay.test.js`

All functions are pure (no Wix side-effects in tests). They accept `$element` mocks. The `showCompletionToast` function integrates with Lottie (Bear Clapping animation) and respects `prefers-reduced-motion`.

- [ ] **Step 1: Write failing tests**

Create `tests/ChallengesDisplay.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderChallengeCard,
  renderChallengesRail,
  showCompletionToast,
  updateChallengeProgress,
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
    expiresAt: '2026-04-01T00:00:00Z',
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
    renderChallengeCard({ $title: makeText(), $description: makeText(), $progressBar: makeProgressBar(), $progressLabel: makeText(), $rewardLabel: makeText(), $expiresLabel, $completedBadge: makeImage() }, makeChallenge({ expiresAt: '2026-04-01T00:00:00Z' }));
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
  it('shows the toast element', async () => {
    vi.useFakeTimers();
    const $toast = makeBox();
    $toast.$toastTitle = makeText();
    $toast.$toastPoints = makeText();
    await showCompletionToast($toast, { title: 'First Steps', rewardPoints: 50 }, false);
    expect($toast.show).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('sets title and points text on toast', async () => {
    vi.useFakeTimers();
    const $toast = makeBox();
    const $toastTitle = makeText();
    const $toastPoints = makeText();
    $toast.$toastTitle = $toastTitle;
    $toast.$toastPoints = $toastPoints;
    await showCompletionToast($toast, { title: 'AR Explorer', rewardPoints: 25 }, false);
    expect($toastTitle.text).toBe('AR Explorer');
    expect($toastPoints.text).toMatch(/25/);
    vi.useRealTimers();
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
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/ChallengesDisplay.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ChallengesDisplay.js`**

Create `src/public/ChallengesDisplay.js`:

```js
/**
 * ChallengesDisplay.js — Pure frontend functions for the Challenges/Missions UI.
 * No Wix imports — operates on injected $element objects for testability.
 * CF-phase4-challenges
 */

/**
 * Formats an ISO UTC date string to a short month+day display.
 * e.g. "2026-04-01T00:00:00Z" → "Apr 1"
 * @param {string} isoString
 * @returns {string}
 */
function formatExpiresAt(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Populates a single repeater item card with challenge data.
 * @param {{ $title, $description, $progressBar, $progressLabel, $rewardLabel, $expiresLabel, $completedBadge }} elements
 * @param {{ title, description, progressValue, targetCount, rewardPoints, expiresAt, completedAt }} challenge
 */
export function renderChallengeCard(elements, challenge) {
  const { $title, $description, $progressBar, $progressLabel, $rewardLabel, $expiresLabel, $completedBadge } = elements;
  const { title, description, progressValue, targetCount, rewardPoints, expiresAt, completedAt } = challenge;

  $title.text = title;
  $description.text = description || '';
  $progressBar.value = targetCount > 0 ? (progressValue / targetCount) * 100 : 0;
  $progressLabel.text = `${progressValue} / ${targetCount}`;
  $rewardLabel.text = `+${rewardPoints} pts`;
  $expiresLabel.text = expiresAt ? `Expires ${formatExpiresAt(expiresAt)}` : '';

  if (completedAt) {
    $completedBadge.show();
  } else {
    $completedBadge.hide();
  }
}

/**
 * Binds challenges data to the repeater and wires onItemReady.
 * @param {Object} $challengesList  - Wix Repeater element
 * @param {Array}  challenges       - From getActiveChallenges() response
 */
export function renderChallengesRail($challengesList, challenges) {
  $challengesList.data = challenges.map(c => ({ _id: c.challengeId, ...c }));

  $challengesList.onItemReady(($item, itemData) => {
    renderChallengeCard(
      {
        $title: $item('#challengeTitle'),
        $description: $item('#challengeDescription'),
        $progressBar: $item('#challengeProgressBar'),
        $progressLabel: $item('#challengeProgressLabel'),
        $rewardLabel: $item('#challengeRewardLabel'),
        $expiresLabel: $item('#challengeExpiresLabel'),
        $completedBadge: $item('#challengeCompletedBadge'),
      },
      itemData
    );
  });
}

/**
 * Shows the challenge completion toast for 4 seconds, then hides it.
 * Plays Bear Clapping Lottie animation unless reduced motion is requested.
 * @param {Object}  $toast          - Box element wrapping the toast
 * @param {{ title: string, rewardPoints: number }} challenge
 * @param {boolean} reducedMotion
 * @returns {Promise<void>}
 */
export async function showCompletionToast($toast, challenge, reducedMotion = false) {
  const { title, rewardPoints } = challenge;

  if ($toast.$toastTitle) $toast.$toastTitle.text = title;
  if ($toast.$toastPoints) $toast.$toastPoints.text = `+${rewardPoints} pts`;

  $toast.show();

  if (!reducedMotion) {
    // Lottie animation: Bear Clapping (bear-clapping-4hjv0nfIf9)
    // Triggered via Wix Lottie element in editor — wired in Member Page.js
    // ChallengesDisplay itself does not import wix-window or Lottie directly
  }

  await new Promise(resolve => setTimeout(resolve, 4000));
  $toast.hide();
}

/**
 * Pure data helper: returns a progress result object for UI update.
 * Called by Member Page.js when a point-earning event response includes challengeProgress.
 * @param {string}  challengeId
 * @param {number}  progressValue
 * @param {number}  targetCount
 * @param {boolean} justCompleted
 * @returns {{ challengeId, progressValue, targetCount, justCompleted }}
 */
export function updateChallengeProgress(challengeId, progressValue, targetCount, justCompleted) {
  return { challengeId, progressValue, targetCount, justCompleted };
}

/**
 * Initializes the challenges display section on page load.
 * Calls getActiveChallenges, hides section if empty, renders rail if challenges returned.
 * Wired in Member Page.js — not called directly from this module.
 *
 * @param {string}   memberId
 * @param {Function} getActiveChallengesFn  - webMethod reference (injected for testability)
 * @param {Object}   $challengesSection     - Outer container Box
 * @param {Object}   $challengesList        - Repeater element
 * @returns {Promise<void>}
 */
export async function initChallengesDisplay(memberId, getActiveChallengesFn, $challengesSection, $challengesList) {
  try {
    const response = await getActiveChallengesFn(memberId);
    const challenges = response.challenges || [];

    if (challenges.length === 0) {
      $challengesSection.hide();
      return;
    }

    $challengesSection.show();
    renderChallengesRail($challengesList, challenges);
  } catch (err) {
    // Non-critical — hide section on error
    $challengesSection.hide();
  }
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/ChallengesDisplay.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run
```

Expected: All tests PASS. No regressions.

- [ ] **Step 6: Commit**

```bash
git add src/public/ChallengesDisplay.js tests/ChallengesDisplay.test.js
git commit -m "feat(phase4): ChallengesDisplay.js — renderChallengesRail, showCompletionToast, updateChallengeProgress"
```

---

## Task 7: Manual steps — Wix Dashboard, editor hookup, guide updates

These steps require Stilgar (Wix Studio access) and are not automatable.

### 7a. Create CMS Collections in Wix Dashboard

- [ ] **Create `Challenges` collection**

  | Field | Type | Notes |
  |-------|------|-------|
  | `title` | Text | |
  | `description` | Text | |
  | `conditionType` | Text | Enum: `ORDER_COMPLETE`, `REVIEW_SUBMITTED`, `SPIN_COMPLETED`, `AR_USED`, `WISHLIST_ADD` |
  | `targetCount` | Number | |
  | `rewardPoints` | Number | |
  | `rewardBadgeId` | Text | Optional |
  | `expiresAt` | DateTime | UTC |
  | `active` | Boolean | Filter on this |

  Index `conditionType` field.

- [ ] **Create `MemberChallengeProgress` collection**

  | Field | Type | Notes |
  |-------|------|-------|
  | `memberId` | Text | Index |
  | `challengeId` | Text | Index |
  | `progressValue` | Number | |
  | `completedAt` | DateTime | Null until complete |
  | `notifiedAt` | DateTime | Set when toast/notif sent |
  | `eventIds` | Text | JSON array string — idempotency log |

  Index both `memberId` and `challengeId`.

- [ ] **Create `WishlistAddLog` collection**

  | Field | Type | Notes |
  |-------|------|-------|
  | `memberId` | Text | Index |
  | `logDate` | Text | ET date string `"YYYY-MM-DD"` |
  | `count` | Number | |

  Index `memberId`.

- [ ] **Seed optional example challenges** (from spec seed data table — `First Steps`, `Trail Regular`, `Top Reviewer`, `Spin Enthusiast`, `AR Explorer`, `Wishlist Builder`)

### 7b. Add editor elements inside/adjacent to `#loyaltySection`

- [ ] Add `#challengesSection` — Box, hidden by default
- [ ] Add `#challengesList` — Repeater inside `#challengesSection`
- [ ] Add `#challengeCompletionToast` — Box, hidden by default, positioned as overlay

Repeater item template — add elements with the following nicknames:

| Nickname | Type |
|----------|------|
| `#challengeTitle` | Text |
| `#challengeDescription` | Text |
| `#challengeProgressBar` | Progress Bar |
| `#challengeProgressLabel` | Text |
| `#challengeRewardLabel` | Text |
| `#challengeExpiresLabel` | Text |
| `#challengeCompletedBadge` | Image or Box |

Inside `#challengeCompletionToast`:

| Nickname | Type |
|----------|------|
| `#toastChallengeTitle` | Text |
| `#toastChallengePoints` | Text |
| `#toastLottie` | Lottie (Bear Clapping — `bear-clapping-4hjv0nfIf9`) |

- [ ] Wire Bear Clapping Lottie (`bear-clapping-4hjv0nfIf9`) inside toast
- [ ] Wire Success Confetti Lottie (`success-confetti-f5PdexvrBK`) as full-screen overlay (optional — Phase 5 may use this)

### 7c. Update `Member Page.js`

- [ ] Import `initChallengesDisplay`, `updateChallengeProgress`, `showCompletionToast` from `ChallengesDisplay.js`
- [ ] On page load: call `initChallengesDisplay(currentMemberId, getActiveChallenges, $w('#challengesSection'), $w('#challengesList'))`
- [ ] On any point-earning event response: check `result.challengeProgress` — call `updateChallengeProgress(...)` per entry, call `showCompletionToast(...)` for entries with `justCompleted: true`
- [ ] Detect `prefers-reduced-motion` via `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and pass to `showCompletionToast`

### 7d. Update hookup guides

- [ ] Update `EDITOR_HOOKUP_GUIDE.html` — add new element nicknames (`#challengesSection`, `#challengesList`, `#challengeCompletionToast`, all repeater item elements) and new CMS collections (`Challenges`, `MemberChallengeProgress`, `WishlistAddLog`)
- [ ] Update `EDITOR-HOOKUP-GUIDE.md` — sync with HTML changes

---

## Definition of Done

All spec checkboxes must pass. Key automated checks:

- [ ] `npx vitest run` — full suite green, no regressions
- [ ] `POINT_VALUES.AR_USED = 10`, `POINT_VALUES.WISHLIST_ADD = 2` in `gamificationTokens.js`
- [ ] `gamification_ar_used` and `gamification_wishlist_add` handled in receiver
- [ ] `WishlistAddLog` daily cap enforced server-side (5/day); challenge progress continues past cap
- [ ] `updateChallengeProgress` idempotency check passes (same `eventId` never double-increments)
- [ ] `eventIds` bounded at 1000 (trim to 501)
- [ ] Challenge completion: `completedAt` set, `rewardPoints` awarded to `MemberPoints`, badge de-dup guard active
- [ ] `getActiveChallenges` returns ≤5 active non-expired challenges sorted `expiresAt` ASC with member progress merged
- [ ] `getActiveChallenges` rate limit: 429 after 10/hr
- [ ] Response shape matches mobile API contract (coordinate with dallas before merge)
- [ ] `ChallengesDisplay.js` all frontend tests pass
- [ ] Manual: 3 CMS collections created, editor elements added with correct nicknames
- [ ] Manual: `EDITOR_HOOKUP_GUIDE.html` + `.md` updated
