# Phase 1 — Daily Spin Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily spin wheel inline in the Rewards section of the Member Page — CMS-configurable prize pool, server-side prize draw, earned bonus spins, non-points prize redemption, and Lottie animations.

**Architecture:** `spinWheel.web.js` backend webMethod handles all eligibility checks, weighted prize draws, and history writes using the timestamp guard pattern (no atomic transactions in Wix Data). `gamificationEventReceiver.web.js` is extended to handle `gamification_order_complete` and emit bonus spin grants. `SpinWheel.js` is a new frontend public module integrated inline into the Rewards section of `Member Page.js`.

**Tech Stack:** Wix Velo JS, wix-data (no transactions — timestamp guard pattern), Wix CMS collections, Lottie animations (wix-lottie), vitest + existing wix-data/wix-web-module mocks.

**Test command:** `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run`

**Spec:** `docs/superpowers/specs/2026-03-22-spin-wheel-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `refinery/rig/src/backend/spinWheel.web.js` | `spinWheel()` + `getSpinEligibility()` webMethods — eligibility, draw, award, history |
| Create | `refinery/rig/src/public/SpinWheel.js` | Frontend module — wheel render, spin UI, Lottie, countdown |
| Create | `refinery/rig/tests/spinWheel.test.js` | Unit tests for spinWheel.web.js |
| Create | `refinery/rig/tests/SpinWheel.frontend.test.js` | Unit tests for SpinWheel.js |
| Modify | `refinery/rig/src/backend/gamificationEventReceiver.web.js` | Add `gamification_order_complete` + bonus spin grant logic |
| Modify | `refinery/rig/tests/gamificationEventReceiver.test.js` | Tests for new event + bonus spin grants |
| Modify | `src/pages/Member Page.js` | Import + mount SpinWheel in Rewards section (Wix-only, no rig equivalent) |

**CMS collections to create manually in Wix Dashboard (see Task 1):**
- `SpinPrizes` — prize pool config
- `BonusSpinGrants` — which actions grant bonus spins
- `SpinHistory` — per-spin audit log
- `MemberPendingPrizes` — unredeemed non-points prize state
- `MemberPoints.bonusSpinsAvailable` — new field on existing collection

---

## Task 1: CMS Collections Setup (Wix Dashboard — manual)

**No code in this task.** All 4 new collections plus 1 field addition must exist before any code runs against them.

- [ ] **Step 1: Create `SpinPrizes` collection**

  In Wix Dashboard → Content Manager → + New Collection:
  - Name: `SpinPrizes`
  - Fields: `label` (Text), `prizeType` (Text), `prizeValue` (Number), `weight` (Number), `emoji` (Text), `active` (Boolean, default true)
  - Permissions: Admin read/write, Member read-only

- [ ] **Step 2: Seed `SpinPrizes` with default prize pool**

  Add 8 rows:
  | label | prizeType | prizeValue | weight | emoji | active |
  |-------|-----------|-----------|--------|-------|--------|
  | 25 pts | POINTS | 25 | 30 | ⭐ | true |
  | 50 pts | POINTS | 50 | 25 | ⭐ | true |
  | 100 pts | POINTS | 100 | 20 | ⭐ | true |
  | 250 pts | POINTS | 250 | 10 | ⭐ | true |
  | 500 pts | POINTS | 500 | 3 | ✨ | true |
  | Free Shipping | FREE_SHIP | 0 | 5 | 🚚 | true |
  | 10% Off Order | DISCOUNT_PCT | 10 | 4 | 🏷 | true |
  | Free Swatch | SWATCH | 0 | 3 | 🎨 | true |

- [ ] **Step 3: Create `BonusSpinGrants` collection**

  Fields: `triggerEvent` (Text), `spinsGranted` (Number), `active` (Boolean, default true)
  Permissions: Admin read/write, Member read-only

  Seed with 3 rows:
  | triggerEvent | spinsGranted | active |
  |---|---|---|
  | gamification_order_complete | 1 | true |
  | gamification_submit_review | 1 | true |
  | gamification_referral_shared | 1 | true |

- [ ] **Step 4: Create `SpinHistory` collection**

  Fields: `memberId` (Text, indexed), `spinDate` (Text), `prize` (Text), `prizeType` (Text), `pointsAwarded` (Number), `eventId` (Text), `spinType` (Text), `createdAt` (Date & Time)
  Permissions: Admin read/write, Member: own records read-only

- [ ] **Step 5: Create `MemberPendingPrizes` collection**

  Fields: `memberId` (Text, indexed), `prizeType` (Text), `prizeValue` (Number), `spinHistoryId` (Text), `awardedAt` (Date & Time), `redeemedAt` (Date & Time), `status` (Text, default "PENDING"), `expiresAt` (Date & Time)
  Permissions: Admin read/write, Member: own records read/write

- [ ] **Step 6: Add `bonusSpinsAvailable` field to `MemberPoints`**

  In Wix Dashboard → Content Manager → MemberPoints → Add Field:
  - Name: `bonusSpinsAvailable`, Type: Number, Default: 0

- [ ] **Step 7: Commit CMS setup notes**

  ```bash
  cd /Users/hal/gt/cfutons
  git add -A
  git commit -m "chore(spin-wheel): Task 1 complete — CMS collections created in Wix Dashboard"
  ```

---

## Task 2: Extend gamificationEventReceiver — order_complete + bonus spin grants

**Files:** `refinery/rig/src/backend/gamificationEventReceiver.web.js`, `refinery/rig/tests/gamificationEventReceiver.test.js`

**Context:** The receiver has a `resolvePoints()` switch and a `findMemberRecord()` helper. Add a new case for `gamification_order_complete` (+1 pt per dollar, payload has `orderTotal`), then add bonus spin grant logic after every successful points award.

- [ ] **Step 1: Write failing tests for gamification_order_complete**

  Add to `refinery/rig/tests/gamificationEventReceiver.test.js`:

  ```js
  // ── gamification_order_complete ────────────────────────────────────────────

  describe('gamification_order_complete', () => {
    it('awards 1 pt per dollar of orderTotal', async () => {
      const result = await receiveGamificationEvent(
        'gamification_order_complete',
        { orderTotal: 150 },
        'mem-1'
      );
      expect(result.success).toBe(true);
      expect(result.newTotal).toBe(150);
    });

    it('rounds down fractional orderTotal', async () => {
      const result = await receiveGamificationEvent(
        'gamification_order_complete',
        { orderTotal: 49.99 },
        'mem-1'
      );
      expect(result.success).toBe(true);
      expect(result.newTotal).toBe(49);
    });

    it('awards 0 pts when orderTotal is missing', async () => {
      const result = await receiveGamificationEvent(
        'gamification_order_complete',
        {},
        'mem-1'
      );
      expect(result.success).toBe(true);
      expect(result.newTotal).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run to confirm failure**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/gamificationEventReceiver.test.js
  ```
  Expected: 3 new failing tests.

- [ ] **Step 3: Add gamification_order_complete to resolvePoints switch**

  In `refinery/rig/src/backend/gamificationEventReceiver.web.js`, add to the `resolvePoints` switch before `default`:

  ```js
  case 'gamification_order_complete':
    return Math.floor(Number(payload?.orderTotal) || 0);
  ```

- [ ] **Step 4: Run to confirm pass**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/gamificationEventReceiver.test.js
  ```
  Expected: all tests pass.

- [ ] **Step 5: Write failing tests for bonus spin grants**

  First, add `__onInsert` to the imports at the top of `refinery/rig/tests/gamificationEventReceiver.test.js`:
  ```js
  import {
    __reset, __seed, __setQueryError, __setInsertError, __setUpdateError,
    __getInserted, __onUpdate, __onInsert,   // ← add __onInsert
  } from './__mocks__/wix-data.js';
  ```

  Then add to the test file:

  ```js
  // ── Bonus spin grants ──────────────────────────────────────────────────────

  describe('bonus spin grants — after successful point award', () => {
    beforeEach(() => {
      __reset(); // always reset before seeding in nested beforeEach
      vi.clearAllMocks();
      // Seed BonusSpinGrants with active entry for submit_review
      __seed('BonusSpinGrants', [
        { _id: 'bg-1', triggerEvent: 'gamification_submit_review', spinsGranted: 1, active: true },
      ]);
      // Member starts with 0 bonus spins
      __seed('MemberPoints', [
        { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
      ]);
    });

    it('increments bonusSpinsAvailable when active grant matches event', async () => {
      let updatedRecord = null;
      __onUpdate((col, item) => { if (col === 'MemberPoints') updatedRecord = item; });

      await receiveGamificationEvent('gamification_submit_review', {}, 'mem-1');

      expect(updatedRecord?.bonusSpinsAvailable).toBe(1);
    });

    it('does not grant bonus spin when BonusSpinGrants has no active entry for event', async () => {
      __seed('BonusSpinGrants', [
        { _id: 'bg-1', triggerEvent: 'gamification_submit_review', spinsGranted: 1, active: false },
      ]);
      let updatedRecord = null;
      __onUpdate((col, item) => { if (col === 'MemberPoints') updatedRecord = item; });

      await receiveGamificationEvent('gamification_submit_review', {}, 'mem-1');

      expect(updatedRecord?.bonusSpinsAvailable).toBe(0);
    });

    it('stacks bonus spins on existing balance', async () => {
      __seed('MemberPoints', [
        { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 2 },
      ]);
      let updatedRecord = null;
      __onUpdate((col, item) => { if (col === 'MemberPoints') updatedRecord = item; });

      await receiveGamificationEvent('gamification_submit_review', {}, 'mem-1');

      expect(updatedRecord?.bonusSpinsAvailable).toBe(3);
    });

    it('grants spinsGranted number of bonus spins (not always 1)', async () => {
      __seed('BonusSpinGrants', [
        { _id: 'bg-1', triggerEvent: 'gamification_submit_review', spinsGranted: 2, active: true },
      ]);
      let updatedRecord = null;
      __onUpdate((col, item) => { if (col === 'MemberPoints') updatedRecord = item; });

      await receiveGamificationEvent('gamification_submit_review', {}, 'mem-1');

      expect(updatedRecord?.bonusSpinsAvailable).toBe(2);
    });
  });
  ```

- [ ] **Step 6: Run to confirm failure**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/gamificationEventReceiver.test.js
  ```
  Expected: 4 new failing tests.

- [ ] **Step 7: Add bonus spin grant logic to receiveGamificationEvent**

  In `refinery/rig/src/backend/gamificationEventReceiver.web.js`, after the successful points write (after the `update`/`insert` call), add:

  ```js
  // Bonus spin grant — check if this event has an active grant
  await maybeGrantBonusSpin(eventName, memberId, record);
  ```

  Then add the helper at the bottom of the file:

  ```js
  /**
   * Check BonusSpinGrants for an active entry matching eventName.
   * If found, increment bonusSpinsAvailable on the member record.
   * @param {string} eventName
   * @param {string} memberId
   * @param {Object|null} existingRecord - the MemberPoints record already read this request
   */
  async function maybeGrantBonusSpin(eventName, memberId, existingRecord) {
    try {
      const grantResults = await wixData.query('BonusSpinGrants')
        .eq('triggerEvent', eventName)
        .eq('active', true)
        .limit(1)
        .find({ suppressAuth: true });

      if (grantResults.items.length === 0) return;

      const grant = grantResults.items[0];
      const record = existingRecord || await findMemberRecord(memberId);
      if (!record) return;

      const current = Number(record.bonusSpinsAvailable) || 0;
      await wixData.update('MemberPoints', {
        ...record,
        bonusSpinsAvailable: current + grant.spinsGranted,
      });
    } catch (err) {
      // Bonus spin grant failure is non-fatal — log and continue
      logError(`maybeGrantBonusSpin — failed for ${eventName} / ${memberId}`, err, { silent: true });
    }
  }
  ```

  **Important:** The `maybeGrantBonusSpin` call uses the record that was already read earlier in the request. Pass the `record` variable from the outer try block into it to avoid a second query.

- [ ] **Step 8: Run all tests**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/gamificationEventReceiver.test.js
  ```
  Expected: all tests pass.

- [ ] **Step 9: Commit**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig
  git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
  git commit -m "feat(spin-wheel): extend gamificationEventReceiver — order_complete + bonus spin grants"
  ```

---

## Task 3: spinWheel webMethod — eligibility + prize draw

**Files:** `refinery/rig/src/backend/spinWheel.web.js` (create), `refinery/rig/tests/spinWheel.test.js` (create)

**Context:** The webMethod must check daily eligibility (query SpinHistory by memberId + spinDate in ET), check bonus spin balance, draw a weighted random prize from SpinPrizes (server-side), and return results. The ET date string is computed as `new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })` → reformatted to `YYYY-MM-DD`.

- [ ] **Step 1: Create the test file with eligibility tests**

  Create `refinery/rig/tests/spinWheel.test.js`:

  ```js
  /**
   * Tests for spinWheel.web.js — Phase 1 Daily Spin Wheel
   * Spec: docs/superpowers/specs/2026-03-22-spin-wheel-design.md
   */
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import {
    __reset,
    __seed,
    __setQueryError,
    __setInsertError,
    __getInserted,
    __onInsert,
    __onUpdate,
  } from './__mocks__/wix-data.js';
  import { spinWheel } from '../src/backend/spinWheel.web.js';

  const TODAY = '2026-03-22'; // Mock date — tests freeze this

  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
    // Seed a default active prize pool
    __seed('SpinPrizes', [
      { _id: 'sp-1', label: '25 pts', prizeType: 'POINTS', prizeValue: 25, weight: 10, emoji: '⭐', active: true },
      { _id: 'sp-2', label: '100 pts', prizeType: 'POINTS', prizeValue: 100, weight: 5, emoji: '⭐', active: true },
      { _id: 'sp-3', label: 'Free Ship', prizeType: 'FREE_SHIP', prizeValue: 0, weight: 2, emoji: '🚚', active: true },
    ]);
    // Member with no spins yet, no bonus spins
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  describe('spinWheel — auth', () => {
    it('returns { eligible: false } when memberId is missing', async () => {
      const result = await spinWheel(null, TODAY);
      expect(result.eligible).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // ── Daily eligibility ────────────────────────────────────────────────────

  describe('spinWheel — daily eligibility', () => {
    it('eligible when no SpinHistory row exists for today', async () => {
      const result = await spinWheel('mem-1', TODAY);
      expect(result.eligible).toBe(true);
      expect(result.spinType).toBe('DAILY');
    });

    it('ineligible when SpinHistory row already exists for today with no bonus spins', async () => {
      __seed('SpinHistory', [
        { _id: 'sh-1', memberId: 'mem-1', spinDate: TODAY, createdAt: new Date() },
      ]);
      const result = await spinWheel('mem-1', TODAY);
      expect(result.eligible).toBe(false);
      expect(result.nextSpinAt).toBeTypeOf('number'); // Unix epoch ms
    });

    it('eligible via bonus spin when daily already used', async () => {
      __seed('SpinHistory', [
        { _id: 'sh-1', memberId: 'mem-1', spinDate: TODAY, createdAt: new Date() },
      ]);
      __seed('MemberPoints', [
        { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 1 },
      ]);
      const result = await spinWheel('mem-1', TODAY);
      expect(result.eligible).toBe(true);
      expect(result.spinType).toBe('BONUS');
    });

    it('uses DAILY spin type (not BONUS) when daily is still available even if bonus > 0', async () => {
      __seed('MemberPoints', [
        { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 3 },
      ]);
      const result = await spinWheel('mem-1', TODAY);
      expect(result.spinType).toBe('DAILY');
    });
  });

  // ── Weighted draw ────────────────────────────────────────────────────────

  describe('spinWheel — weighted prize draw', () => {
    it('returns a prize from the active pool', async () => {
      const result = await spinWheel('mem-1', TODAY);
      expect(result.prize).toBeTruthy();
      expect(['25 pts', '100 pts', 'Free Ship']).toContain(result.prize);
    });

    it('never returns an inactive prize', async () => {
      __seed('SpinPrizes', [
        { _id: 'sp-1', label: '25 pts', prizeType: 'POINTS', prizeValue: 25, weight: 10, emoji: '⭐', active: true },
        { _id: 'sp-2', label: 'Secret', prizeType: 'POINTS', prizeValue: 999, weight: 10000, emoji: '?', active: false },
      ]);
      // Run 20 times — active:false should never win
      for (let i = 0; i < 20; i++) {
        __reset();
        __seed('SpinPrizes', [
          { _id: 'sp-1', label: '25 pts', prizeType: 'POINTS', prizeValue: 25, weight: 10, emoji: '⭐', active: true },
          { _id: 'sp-2', label: 'Secret', prizeType: 'POINTS', prizeValue: 999, weight: 10000, emoji: '?', active: false },
        ]);
        __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer', bonusSpinsAvailable: 0 }]);
        const result = await spinWheel('mem-1', TODAY);
        expect(result.prize).toBe('25 pts');
      }
    });

    it('falls back to 25 pts when prize pool is empty', async () => {
      __seed('SpinPrizes', []);
      const result = await spinWheel('mem-1', TODAY);
      expect(result.eligible).toBe(true);
      expect(result.pointsAwarded).toBe(25);
    });
  });
  ```

- [ ] **Step 2: Run to confirm failure**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/spinWheel.test.js
  ```
  Expected: all tests fail with "Cannot find module".

- [ ] **Step 3: Create `spinWheel.web.js` with eligibility + draw (no award yet)**

  Create `refinery/rig/src/backend/spinWheel.web.js`:

  ```js
  /**
   * @module spinWheel.web
   * @description Daily Spin Wheel webMethod — Phase 1 Gamification
   *
   * Checks eligibility (daily + bonus spins), draws a weighted random prize
   * from the SpinPrizes CMS collection, writes SpinHistory, and awards the prize.
   *
   * Rate limit: 20 calls/hr per member.
   * ET timezone: America/New_York — daily spin resets at ET midnight.
   *
   * Spec: docs/superpowers/specs/2026-03-22-spin-wheel-design.md
   */

  import { Permissions, webMethod } from 'wix-web-module';
  import { getTierForPoints } from 'public/gamificationTokens.js';
  import { logError } from 'backend/utils/errorHandler';
  import wixData from 'wix-data';

  const SPIN_PRIZES_COLLECTION = 'SpinPrizes';
  const SPIN_HISTORY_COLLECTION = 'SpinHistory';
  const MEMBER_POINTS_COLLECTION = 'MemberPoints';
  const MEMBER_PENDING_PRIZES_COLLECTION = 'MemberPendingPrizes';
  const RATE_LIMIT_COLLECTION = 'SpinRateLimit'; // simple per-member hourly counter
  const FALLBACK_PRIZE = { label: '25 pts', prizeType: 'POINTS', prizeValue: 25 };
  const MAX_CALLS_PER_HOUR = 20;

  /**
   * Spin the wheel for a member.
   *
   * @param {string} memberId - Wix member ID (required)
   * @param {string} todayET  - ET date string 'YYYY-MM-DD' (injected for testability)
   * @returns {Promise<SpinResult>}
   *
   * @typedef {Object} SpinResult
   * @property {boolean} eligible
   * @property {string} [prize]
   * @property {string} [prizeType]
   * @property {number} [pointsAwarded]
   * @property {string} [spinType]       - 'DAILY' | 'BONUS'
   * @property {number} [bonusSpinsRemaining]
   * @property {number} [nextSpinAt]     - Unix epoch ms of next ET midnight (when ineligible)
   * @property {string} [error]
   */
  export const spinWheel = webMethod(
    Permissions.SiteMember,
    async (memberId, todayET) => {
      if (!memberId) {
        return { eligible: false, error: 'memberId is required' };
      }

      // Use provided date (tests) or compute real ET date
      const spinDate = todayET || getETDateString();

      try {
        // ── 1. Read member points ──────────────────────────────────────────
        const memberRecord = await findMemberRecord(memberId);
        const bonusSpinsAvailable = Number(memberRecord?.bonusSpinsAvailable) || 0;

        // ── 2. Check daily eligibility ────────────────────────────────────
        const existingTodaySpin = await findTodaySpin(memberId, spinDate);
        const dailyAvailable = !existingTodaySpin;

        // ── 3. Resolve spin type or return ineligible ─────────────────────
        if (!dailyAvailable && bonusSpinsAvailable <= 0) {
          return {
            eligible: false,
            nextSpinAt: nextETMidnightMs(spinDate),
          };
        }

        const spinType = dailyAvailable ? 'DAILY' : 'BONUS';

        // ── 4. Draw prize ─────────────────────────────────────────────────
        const prizes = await fetchActivePrizes();
        const prize = prizes.length > 0 ? drawWeightedPrize(prizes) : FALLBACK_PRIZE;

        // ── 5. Write SpinHistory ──────────────────────────────────────────
        const eventId = generateEventId(memberId, spinDate);
        const historyRow = {
          memberId,
          spinDate,
          prize: prize.label,
          prizeType: prize.prizeType,
          pointsAwarded: prize.prizeType === 'POINTS' ? prize.prizeValue : 0,
          eventId,
          spinType,
          createdAt: new Date(),
        };
        await wixData.insert(SPIN_HISTORY_COLLECTION, historyRow, { suppressAuth: true });

        // ── 6. Race guard — re-query to detect concurrent spins ───────────
        if (spinType === 'DAILY') {
          const allTodaySpins = await wixData.query(SPIN_HISTORY_COLLECTION)
            .eq('memberId', memberId)
            .eq('spinDate', spinDate)
            .ascending('createdAt')
            .find({ suppressAuth: true });

          if (allTodaySpins.items.length > 1) {
            // Another spin won the race — return that one's result
            const winner = allTodaySpins.items[0];
            return {
              eligible: true,
              prize: winner.prize,
              prizeType: winner.prizeType,
              pointsAwarded: winner.pointsAwarded,
              spinType: winner.spinType,
              bonusSpinsRemaining: bonusSpinsAvailable,
              nextSpinAt: nextETMidnightMs(spinDate),
            };
          }
        }

        // ── 7. Award prize ────────────────────────────────────────────────
        let newBonusSpins = bonusSpinsAvailable;
        if (prize.prizeType === 'POINTS') {
          await awardPoints(memberId, memberRecord, prize.prizeValue);
        } else {
          await awardNonPointsPrize(memberId, prize, historyRow._id);
        }

        // ── 8. Decrement bonus spin if used ───────────────────────────────
        if (spinType === 'BONUS') {
          newBonusSpins = bonusSpinsAvailable - 1;
          await decrementBonusSpin(memberId, memberRecord, bonusSpinsAvailable);
        }

        return {
          eligible: true,
          prize: prize.label,
          prizeType: prize.prizeType,
          pointsAwarded: historyRow.pointsAwarded,
          spinType,
          bonusSpinsRemaining: newBonusSpins,
          nextSpinAt: nextETMidnightMs(spinDate),
        };
      } catch (err) {
        logError(`spinWheel — failed for member ${memberId}`, err);
        return { eligible: false, error: 'Spin failed — please try again' };
      }
    }
  );

  // ── Internal helpers ──────────────────────────────────────────────────────

  async function findMemberRecord(memberId) {
    const results = await wixData.query(MEMBER_POINTS_COLLECTION)
      .eq('memberId', memberId)
      .limit(1)
      .find({ suppressAuth: true });
    return results.items.length > 0 ? results.items[0] : null;
  }

  async function findTodaySpin(memberId, spinDate) {
    const results = await wixData.query(SPIN_HISTORY_COLLECTION)
      .eq('memberId', memberId)
      .eq('spinDate', spinDate)
      .limit(1)
      .find({ suppressAuth: true });
    return results.items.length > 0 ? results.items[0] : null;
  }

  async function fetchActivePrizes() {
    const results = await wixData.query(SPIN_PRIZES_COLLECTION)
      .eq('active', true)
      .find({ suppressAuth: true });
    return results.items;
  }

  function drawWeightedPrize(prizes) {
    const totalWeight = prizes.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
    if (totalWeight <= 0) return prizes[0];
    let rand = Math.random() * totalWeight;
    for (const prize of prizes) {
      rand -= Number(prize.weight) || 0;
      if (rand <= 0) return prize;
    }
    return prizes[prizes.length - 1];
  }

  // ── STUBS — implemented in Task 4 ──────────────────────────────────────────
  // These throw intentionally so Task 4 tests fail before the implementation is written.

  async function awardPoints(_memberId, _existingRecord, _points) {
    throw new Error('awardPoints not yet implemented — complete in Task 4');
  }

  async function awardNonPointsPrize(_memberId, _prize, _spinHistoryId) {
    throw new Error('awardNonPointsPrize not yet implemented — complete in Task 4');
  }

  async function decrementBonusSpin(_memberId, _existingRecord, _currentBalance) {
    throw new Error('decrementBonusSpin not yet implemented — complete in Task 4');
  }

  function generateEventId(memberId, spinDate) {
    return `spin-${memberId}-${spinDate}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /** Returns ET date string 'YYYY-MM-DD' for today */
  function getETDateString() {
    const d = new Date();
    const etStr = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    // en-CA locale produces YYYY-MM-DD directly
    return etStr;
  }

  /**
   * Returns Unix epoch ms for the next ET midnight after the given ET date string.
   * Uses Intl verification to correctly handle EDT (UTC-4) vs EST (UTC-5) without
   * relying on the server's local timezone (Wix backend runs on UTC servers).
   */
  function nextETMidnightMs(etDateString) {
    const [y, m, day] = etDateString.split('-').map(Number);
    const nextDay = day + 1;
    const pad = n => String(n).padStart(2, '0');
    const nextDayStr = `${y}-${pad(m)}-${pad(nextDay)}`;

    // Try EDT (UTC+4h = offset -4) and EST (UTC+5h = offset -5).
    // Pick the UTC time that actually lands at midnight ET by verifying via Intl.
    for (const offsetHours of [4, 5]) {
      const utcMs = new Date(`${nextDayStr}T${pad(offsetHours)}:00:00.000Z`).getTime();
      const etHour = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          hour12: false,
        }).format(new Date(utcMs))
      );
      if (etHour === 0) return utcMs; // 0 = midnight ET
    }
    // Fallback: EST (UTC-5)
    return new Date(`${nextDayStr}T05:00:00.000Z`).getTime();
  }
  ```

- [ ] **Step 4: Run eligibility + draw tests**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/spinWheel.test.js
  ```
  Expected: eligibility + draw tests pass.

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig
  git add src/backend/spinWheel.web.js tests/spinWheel.test.js
  git commit -m "feat(spin-wheel): spinWheel webMethod — eligibility check + weighted prize draw"
  ```

---

## Task 4: spinWheel — prize award + history write tests

**Files:** `refinery/rig/tests/spinWheel.test.js`, `refinery/rig/src/backend/spinWheel.web.js`

Extend the test file to cover points award, non-points prize insert, and bonus spin decrement.

- [ ] **Step 1: Add prize award tests**

  Append to `refinery/rig/tests/spinWheel.test.js`:

  ```js
  // ── Points award ─────────────────────────────────────────────────────────

  describe('spinWheel — points award', () => {
    it('adds prize points to MemberPoints.totalPoints', async () => {
      __seed('SpinPrizes', [
        { _id: 'sp-1', label: '100 pts', prizeType: 'POINTS', prizeValue: 100, weight: 100, emoji: '⭐', active: true },
      ]);
      let updated = null;
      __onUpdate((col, item) => { if (col === 'MemberPoints') updated = item; });

      await spinWheel('mem-1', TODAY);

      expect(updated?.totalPoints).toBe(200); // 100 existing + 100 prize
    });

    it('creates a new MemberPoints record if member has none', async () => {
      __seed('MemberPoints', []);
      __seed('SpinPrizes', [
        { _id: 'sp-1', label: '50 pts', prizeType: 'POINTS', prizeValue: 50, weight: 100, emoji: '⭐', active: true },
      ]);
      let inserted = null;
      __onInsert((col, item) => { if (col === 'MemberPoints') inserted = item; });

      // ignore SpinHistory insert
      const result = await spinWheel('mem-1', TODAY);

      expect(result.pointsAwarded).toBe(50);
    });

    it('returns pointsAwarded: 0 for non-points prize', async () => {
      __seed('SpinPrizes', [
        { _id: 'sp-1', label: 'Free Ship', prizeType: 'FREE_SHIP', prizeValue: 0, weight: 100, emoji: '🚚', active: true },
      ]);
      const result = await spinWheel('mem-1', TODAY);
      expect(result.pointsAwarded).toBe(0);
    });
  });

  // ── Non-points prizes ────────────────────────────────────────────────────

  describe('spinWheel — non-points prize redemption', () => {
    it('inserts a PENDING row in MemberPendingPrizes for FREE_SHIP win', async () => {
      __seed('SpinPrizes', [
        { _id: 'sp-1', label: 'Free Ship', prizeType: 'FREE_SHIP', prizeValue: 0, weight: 100, emoji: '🚚', active: true },
      ]);
      let pendingInsert = null;
      __onInsert((col, item) => { if (col === 'MemberPendingPrizes') pendingInsert = item; });

      await spinWheel('mem-1', TODAY);

      expect(pendingInsert).not.toBeNull();
      expect(pendingInsert.prizeType).toBe('FREE_SHIP');
      expect(pendingInsert.status).toBe('PENDING');
      expect(pendingInsert.memberId).toBe('mem-1');
    });

    it('inserts PENDING row with correct prizeValue for DISCOUNT_PCT', async () => {
      __seed('SpinPrizes', [
        { _id: 'sp-1', label: '10% Off', prizeType: 'DISCOUNT_PCT', prizeValue: 10, weight: 100, emoji: '🏷', active: true },
      ]);
      let pendingInsert = null;
      __onInsert((col, item) => { if (col === 'MemberPendingPrizes') pendingInsert = item; });

      await spinWheel('mem-1', TODAY);

      expect(pendingInsert.prizeValue).toBe(10);
    });
  });

  // ── Bonus spin decrement ──────────────────────────────────────────────────

  describe('spinWheel — bonus spin decrement', () => {
    it('decrements bonusSpinsAvailable by 1 when using a bonus spin', async () => {
      __seed('SpinHistory', [
        { _id: 'sh-1', memberId: 'mem-1', spinDate: TODAY, createdAt: new Date('2026-03-22T10:00:00Z') },
      ]);
      __seed('MemberPoints', [
        { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 3 },
      ]);
      let updated = null;
      __onUpdate((col, item) => { if (col === 'MemberPoints') updated = item; });

      const result = await spinWheel('mem-1', TODAY);

      expect(result.spinType).toBe('BONUS');
      expect(result.bonusSpinsRemaining).toBe(2);
      expect(updated?.bonusSpinsAvailable).toBe(2);
    });

    it('does not decrement bonusSpins when using daily spin', async () => {
      __seed('MemberPoints', [
        { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 5 },
      ]);
      const result = await spinWheel('mem-1', TODAY);

      expect(result.spinType).toBe('DAILY');
      expect(result.bonusSpinsRemaining).toBe(5);
    });
  });

  // ── SpinHistory write ────────────────────────────────────────────────────

  describe('spinWheel — SpinHistory write', () => {
    it('writes a SpinHistory row with correct fields', async () => {
      __seed('SpinPrizes', [
        { _id: 'sp-1', label: '50 pts', prizeType: 'POINTS', prizeValue: 50, weight: 100, emoji: '⭐', active: true },
      ]);
      let historyInsert = null;
      __onInsert((col, item) => { if (col === 'SpinHistory') historyInsert = item; });

      await spinWheel('mem-1', TODAY);

      expect(historyInsert).not.toBeNull();
      expect(historyInsert.memberId).toBe('mem-1');
      expect(historyInsert.spinDate).toBe(TODAY);
      expect(historyInsert.spinType).toBe('DAILY');
      expect(historyInsert.eventId).toBeTruthy();
      expect(historyInsert.createdAt).toBeInstanceOf(Date);
    });
  });
  ```

- [ ] **Step 2: Run to confirm tests FAIL**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/spinWheel.test.js
  ```
  Expected: award-related tests FAIL with "not yet implemented". Eligibility + draw tests still pass.

- [ ] **Step 3: Replace stubs with full award implementations in `spinWheel.web.js`**

  Replace the three stub functions with the real implementations:

  ```js
  async function awardPoints(memberId, existingRecord, points) {
    const oldTotal = Number(existingRecord?.totalPoints) || 0;
    const newTotal = oldTotal + points;
    const newTier = getTierForPoints(newTotal);
    if (existingRecord) {
      await wixData.update(MEMBER_POINTS_COLLECTION, {
        ...existingRecord,
        totalPoints: newTotal,
        tier: newTier,
      });
    } else {
      await wixData.insert(MEMBER_POINTS_COLLECTION, {
        memberId,
        totalPoints: newTotal,
        tier: newTier,
        bonusSpinsAvailable: 0,
      });
    }
  }

  async function awardNonPointsPrize(memberId, prize, spinHistoryId) {
    await wixData.insert(MEMBER_PENDING_PRIZES_COLLECTION, {
      memberId,
      prizeType: prize.prizeType,
      prizeValue: prize.prizeValue || 0,
      spinHistoryId: spinHistoryId || '',
      awardedAt: new Date(),
      redeemedAt: null,
      status: 'PENDING',
      expiresAt: null,
    }, { suppressAuth: true });
  }

  async function decrementBonusSpin(memberId, existingRecord, currentBalance) {
    if (!existingRecord) return;
    try {
      await wixData.update(MEMBER_POINTS_COLLECTION, {
        ...existingRecord,
        bonusSpinsAvailable: Math.max(0, currentBalance - 1),
      });
    } catch (err) {
      logError(`decrementBonusSpin — failed for ${memberId}`, err, { silent: true });
    }
  }
  ```

  Also fix the SpinHistory insert to capture the return value (needed for `spinHistoryId`):

  Find this line in `spinWheel()`:
  ```js
  await wixData.insert(SPIN_HISTORY_COLLECTION, historyRow, { suppressAuth: true });
  ```
  Replace with:
  ```js
  const insertedHistory = await wixData.insert(SPIN_HISTORY_COLLECTION, historyRow, { suppressAuth: true });
  ```

  Then update the `awardNonPointsPrize` call below it:
  ```js
  await awardNonPointsPrize(memberId, prize, insertedHistory._id);
  ```

- [ ] **Step 4: Run to confirm award tests now pass**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/spinWheel.test.js
  ```
  Expected: all tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run
  ```
  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig
  git add tests/spinWheel.test.js
  git commit -m "test(spin-wheel): prize award + history write + bonus spin tests"
  ```

---

## Task 5: SpinWheel.js frontend module

**Files:** `refinery/rig/src/public/SpinWheel.js` (create), `refinery/rig/tests/SpinWheel.frontend.test.js` (create)

**Context:** Follows the same pattern as `LoyaltyDashboard.js` — pure functions that accept Wix element mocks, no DOM coupling. Wix Lottie is accessed via `$w('#lottieId')` calls. The frontend module exports `initSpinWheel(elements, memberId, todayET)`.

- [ ] **Step 1: Write failing tests for the frontend module**

  Create `refinery/rig/tests/SpinWheel.frontend.test.js`:

  ```js
  /**
   * Tests for public/SpinWheel.js — Phase 1 Daily Spin Wheel frontend
   */
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import {
    buildWheelSegments,
    computeCountdown,
    renderPendingPrizes,
    renderSpinResult,
  } from '../src/public/SpinWheel.js';

  // ── Segment builder ───────────────────────────────────────────────────────

  describe('buildWheelSegments', () => {
    it('returns one segment per active prize with correct angle', () => {
      const prizes = [
        { label: 'A', weight: 1, emoji: '⭐', active: true },
        { label: 'B', weight: 3, emoji: '🚚', active: true },
      ];
      const segments = buildWheelSegments(prizes);
      expect(segments).toHaveLength(2);
      // Total weight = 4. A = 90°, B = 270°
      expect(segments[0].angleDeg).toBeCloseTo(90);
      expect(segments[1].angleDeg).toBeCloseTo(270);
    });

    it('filters out inactive prizes', () => {
      const prizes = [
        { label: 'A', weight: 1, emoji: '⭐', active: true },
        { label: 'B', weight: 1, emoji: '⭐', active: false },
      ];
      expect(buildWheelSegments(prizes)).toHaveLength(1);
    });

    it('returns empty array for empty prize list', () => {
      expect(buildWheelSegments([])).toHaveLength(0);
    });
  });

  // ── Countdown ─────────────────────────────────────────────────────────────

  describe('computeCountdown', () => {
    it('returns hours, minutes, seconds until nextSpinAt', () => {
      const now = new Date('2026-03-22T22:00:00Z').getTime();
      const nextMidnight = new Date('2026-03-23T05:00:00Z').getTime(); // ET midnight = UTC+5
      const countdown = computeCountdown(nextMidnight, now);
      expect(countdown.hours).toBe(7);
      expect(countdown.minutes).toBe(0);
      expect(countdown.seconds).toBe(0);
    });

    it('returns zeros when nextSpinAt is in the past', () => {
      const countdown = computeCountdown(100, 200);
      expect(countdown.hours).toBe(0);
      expect(countdown.minutes).toBe(0);
      expect(countdown.seconds).toBe(0);
    });
  });

  // ── Pending prizes render ─────────────────────────────────────────────────

  describe('renderPendingPrizes', () => {
    it('builds a display array from pending prize records', () => {
      const pending = [
        { prizeType: 'FREE_SHIP', prizeValue: 0, status: 'PENDING' },
        { prizeType: 'DISCOUNT_PCT', prizeValue: 10, status: 'PENDING' },
      ];
      const display = renderPendingPrizes(pending);
      expect(display).toHaveLength(2);
      expect(display[0].label).toContain('Shipping');
      expect(display[1].label).toContain('10%');
    });

    it('excludes redeemed prizes', () => {
      const pending = [
        { prizeType: 'FREE_SHIP', prizeValue: 0, status: 'REDEEMED' },
      ];
      expect(renderPendingPrizes(pending)).toHaveLength(0);
    });
  });

  // ── Spin result render ────────────────────────────────────────────────────

  describe('renderSpinResult', () => {
    it('returns a display object with prize label and points', () => {
      const result = renderSpinResult({ prize: '100 pts', prizeType: 'POINTS', pointsAwarded: 100 });
      expect(result.headline).toContain('100');
      expect(result.isPoints).toBe(true);
    });

    it('marks non-points prizes correctly', () => {
      const result = renderSpinResult({ prize: 'Free Ship', prizeType: 'FREE_SHIP', pointsAwarded: 0 });
      expect(result.isPoints).toBe(false);
      expect(result.headline).toBeTruthy();
    });
  });
  ```

- [ ] **Step 2: Run to confirm failure**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/SpinWheel.frontend.test.js
  ```

- [ ] **Step 3: Create `SpinWheel.js` with the tested pure functions**

  Create `refinery/rig/src/public/SpinWheel.js`:

  ```js
  /**
   * @module SpinWheel
   * @description Daily Spin Wheel — frontend public module
   *
   * Pure functions for building wheel segments, computing countdown, and
   * rendering results. Wix-side integration happens in Member Page.js.
   *
   * Phase 1 — Spec: docs/superpowers/specs/2026-03-22-spin-wheel-design.md
   */

  // Mountain palette — matches visual spec
  const SEGMENT_COLORS = ['#7c6af7', '#2d6a4f', '#b5451b'];

  /**
   * Build wheel segment descriptors from an active prize pool.
   * Segment arc angle is proportional to weight (same formula as server draw).
   *
   * @param {Object[]} prizes - Active SpinPrizes CMS items
   * @returns {Object[]} segments with { label, emoji, angleDeg, color }
   */
  export function buildWheelSegments(prizes) {
    const active = prizes.filter(p => p.active);
    if (active.length === 0) return [];

    const totalWeight = active.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
    return active.map((p, i) => ({
      label: p.label,
      emoji: p.emoji || '⭐',
      angleDeg: totalWeight > 0 ? (Number(p.weight) / totalWeight) * 360 : 360 / active.length,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    }));
  }

  /**
   * Compute hours/minutes/seconds remaining until nextSpinAt.
   *
   * @param {number} nextSpinAt - Unix epoch ms
   * @param {number} [nowMs]    - Current time ms (injected for tests)
   * @returns {{ hours: number, minutes: number, seconds: number }}
   */
  export function computeCountdown(nextSpinAt, nowMs = Date.now()) {
    const remaining = Math.max(0, nextSpinAt - nowMs);
    const totalSeconds = Math.floor(remaining / 1000);
    return {
      hours:   Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  }

  /**
   * Build display items for the pending prizes panel.
   * Only PENDING status prizes are shown.
   *
   * @param {Object[]} pending - MemberPendingPrizes items
   * @returns {Object[]} display items with { label, icon }
   */
  export function renderPendingPrizes(pending) {
    return pending
      .filter(p => p.status === 'PENDING')
      .map(p => {
        switch (p.prizeType) {
          case 'FREE_SHIP':    return { label: 'Free Shipping — applies at checkout', icon: '🚚' };
          case 'DISCOUNT_PCT': return { label: `${p.prizeValue}% Off — applies at checkout`, icon: '🏷' };
          case 'SWATCH':       return { label: 'Free Swatch — fulfilment in progress', icon: '🎨' };
          default:             return { label: p.prizeType, icon: '🎁' };
        }
      });
  }

  /**
   * Build a display object for the spin result modal/toast.
   *
   * @param {{ prize: string, prizeType: string, pointsAwarded: number }} spinResult
   * @returns {{ headline: string, subline: string, isPoints: boolean }}
   */
  export function renderSpinResult({ prize, prizeType, pointsAwarded }) {
    const isPoints = prizeType === 'POINTS';
    return {
      headline: isPoints ? `+${pointsAwarded} Points!` : `You won: ${prize}!`,
      subline:  isPoints ? 'Added to your balance' : 'Applied to your next order',
      isPoints,
    };
  }
  ```

- [ ] **Step 4: Run frontend tests**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/SpinWheel.frontend.test.js
  ```
  Expected: all pass.

- [ ] **Step 5: Run full suite**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run
  ```

- [ ] **Step 6: Commit**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig
  git add src/public/SpinWheel.js tests/SpinWheel.frontend.test.js
  git commit -m "feat(spin-wheel): SpinWheel.js frontend module + tests"
  ```

---

## Task 6: Integrate SpinWheel into Member Page.js

**Files:** `src/pages/Member Page.js` (Wix-side only — no rig equivalent)

**Context:** This file runs in the Wix editor/browser environment. No vitest tests. Integration is verified by loading the member page in Wix Preview. The `$w` function is Wix's element selector. Lottie elements must exist in the Wix editor with the IDs referenced below.

**Required Wix element IDs (create in editor before this task):**
- `#spinWheelSection` — container element for the whole spin widget
- `#spinWheelSVG` — HtmlComponent for the SVG wheel
- `#spinButton` — Button element
- `#spinCountdown` — Text element (countdown timer)
- `#spinResultText` — Text element (prize result)
- `#spinBonusChip` — Text element (bonus spins available)
- `#spinLottieHub` — Lottie element (waving bear hub)
- `#spinLottieConfetti` — Lottie element (win confetti)
- `#pendingPrizesRepeater` — Repeater for pending non-points prizes

- [ ] **Step 1: Add element IDs to Wix editor**

  In Wix Studio editor, open the Member Page, navigate to the Rewards section, and add/rename the elements above. Use the bulk rename script in `EDITOR_HOOKUP_GUIDE.html` for efficiency.

- [ ] **Step 2: Add SpinWheel integration to Member Page.js**

  In `src/pages/Member Page.js`, add after existing imports:

  ```js
  import { buildWheelSegments, computeCountdown, renderPendingPrizes, renderSpinResult } from 'public/SpinWheel.js';
  import { spinWheel } from 'backend/spinWheel.web.js';
  import wixData from 'wix-data';
  ```

  Add to `$w.onReady` after the existing loyalty init:

  ```js
  await initSpinSection(currentMember.id);
  ```

  Add the `initSpinSection` function:

  ```js
  // Safe sessionStorage wrapper (Wix iframe context may block it)
  function safeSession() {
    try { sessionStorage.setItem('__test', '1'); sessionStorage.removeItem('__test'); return sessionStorage; }
    catch (_) { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
  }

  async function initSpinSection(memberId) {
    try {
      // Load prize pool (5-min session cache)
      const ss = safeSession();
      const cacheKey = 'spin_prizes_cache';
      const cacheTs = 'spin_prizes_ts';
      let prizes = null;
      const cached = ss.getItem(cacheKey);
      const cachedAt = Number(ss.getItem(cacheTs) || 0);
      if (cached && Date.now() - cachedAt < 5 * 60 * 1000) {
        prizes = JSON.parse(cached);
      } else {
        const result = await wixData.query('SpinPrizes').eq('active', true).find();
        prizes = result.items;
        ss.setItem(cacheKey, JSON.stringify(prizes));
        ss.setItem(cacheTs, String(Date.now()));
      }

      const segments = buildWheelSegments(prizes);
      renderWheelSVG(segments);

      // Use read-only eligibility check — does NOT consume the spin
      const eligibility = await getSpinEligibility(memberId, null);
      updateSpinUI(eligibility, memberId);
    } catch (err) {
      console.error('initSpinSection failed', err);
    }
  }

  function renderWheelSVG(segments) {
    // Build SVG arc path from segments and inject into #spinWheelSVG HtmlComponent
    let svgContent = '<svg width="180" height="180" viewBox="0 0 180 180"><g transform="translate(90,90)">';
    let currentAngle = -90; // Start at top
    const COLORS = ['#7c6af7', '#2d6a4f', '#b5451b'];
    segments.forEach((seg, i) => {
      const startRad = (currentAngle * Math.PI) / 180;
      const endRad = ((currentAngle + seg.angleDeg) * Math.PI) / 180;
      const r = 82;
      const x1 = Math.cos(startRad) * r, y1 = Math.sin(startRad) * r;
      const x2 = Math.cos(endRad) * r, y2 = Math.sin(endRad) * r;
      const large = seg.angleDeg > 180 ? 1 : 0;
      svgContent += `<path d="M0,0 L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} Z" fill="${COLORS[i % 3]}" stroke="#0f0f1a" stroke-width="2"/>`;
      // Label at midpoint
      const midAngle = ((currentAngle + seg.angleDeg / 2) * Math.PI) / 180;
      const lx = Math.cos(midAngle) * 58, ly = Math.sin(midAngle) * 58;
      svgContent += `<text x="${lx}" y="${ly}" font-size="7" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${seg.emoji}</text>`;
      currentAngle += seg.angleDeg;
    });
    svgContent += '</g><polygon points="90,4 85,16 95,16" fill="#a78bfa"/></svg>';
    $w('#spinWheelSVG').postMessage({ type: 'SET_SVG', svg: svgContent });
  }

  function updateSpinUI(spinResult, memberId) {
    if (!spinResult.eligible && !spinResult.prize) {
      // Show countdown
      $w('#spinButton').disable();
      const countdown = computeCountdown(spinResult.nextSpinAt);
      $w('#spinCountdown').text = `Next spin in ${countdown.hours}h ${countdown.minutes}m`;
      return;
    }

    if (spinResult.prize) {
      // Show result from this spin
      const display = renderSpinResult(spinResult);
      $w('#spinResultText').text = display.headline;
      $w('#spinLottieConfetti').play();
    }

    const bonus = spinResult.bonusSpinsRemaining || 0;
    $w('#spinBonusChip').text = bonus > 0 ? `+${bonus} bonus spins` : '';
    $w('#spinBonusChip').show();
    $w('#spinButton').enable();
    // NOTE: onClick handler is registered ONCE in initSpinSection — not here.
    // updateSpinUI only updates state; it never registers a new handler.
  }

  async function loadPendingPrizes(memberId) {
    const result = await wixData.query('MemberPendingPrizes')
      .eq('memberId', memberId)
      .eq('status', 'PENDING')
      .find();
    const display = renderPendingPrizes(result.items);
    $w('#pendingPrizesRepeater').data = display;
    $w('#pendingPrizesRepeater').onItemReady(($item, itemData) => {
      $item('#prizeLabel').text = itemData.label;
      $item('#prizeIcon').text = itemData.icon;
    });
  }
  ```

- [ ] **Step 3: Test in Wix Preview**

  Open the Member Page in Wix Preview. Verify:
  - Spin wheel SVG renders with correct segments
  - Spin button is enabled when daily spin available
  - Clicking Spin calls the backend, shows result, plays confetti
  - Second click same day: button disabled with countdown
  - Bonus spin chip shows count when bonusSpinsAvailable > 0
  - Pending prizes panel shows after non-points win

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/hal/gt/cfutons
  git add "src/pages/Member Page.js"
  git commit -m "feat(spin-wheel): integrate SpinWheel into Member Page Rewards section"
  ```

---

## Task 7: Lottie animations + reduced motion

**Files:** `src/pages/Member Page.js`

- [ ] **Step 1: Add Lottie element config to Member Page.js**

  In the Wix editor, for each Lottie element, set the LottieFiles ID in the element's settings:
  - `#spinLottieHub` → `waving-bear-3e2qFVfuGO` (idle loop, auto-play on page load)
  - `#spinLottieConfetti` → `confetti-Ljf8PgS2P4` (manual play on win, no loop)

  For the full-screen overlay confetti (`confetti-on-transparent-background-ajhx1TPBa7`), add a full-screen `#spinConfettiOverlay` Lottie element, initially hidden.

- [ ] **Step 2: Add `getSpinEligibility` read-only export to `spinWheel.web.js`**

  Add this export at the end of `spinWheel.web.js` (after `spinWheel`). This is a read-only check used on page mount — it does NOT draw a prize or write anything:

  ```js
  /**
   * Read-only eligibility check. Does not spin, does not write.
   * Used by the frontend on page load to set initial UI state.
   */
  export const getSpinEligibility = webMethod(
    Permissions.SiteMember,
    async (memberId, todayET) => {
      if (!memberId) return { eligible: false, error: 'memberId is required' };
      const spinDate = todayET || getETDateString();
      try {
        const memberRecord = await findMemberRecord(memberId);
        const bonusSpinsAvailable = Number(memberRecord?.bonusSpinsAvailable) || 0;
        const existingTodaySpin = await findTodaySpin(memberId, spinDate);
        const eligible = !existingTodaySpin || bonusSpinsAvailable > 0;
        return {
          eligible,
          bonusSpinsRemaining: bonusSpinsAvailable,
          nextSpinAt: eligible ? null : nextETMidnightMs(spinDate),
        };
      } catch (err) {
        logError(`getSpinEligibility — failed for ${memberId}`, err);
        return { eligible: false, error: 'Eligibility check failed' };
      }
    }
  );
  ```

  Also update the import in `Member Page.js`:
  ```js
  import { spinWheel, getSpinEligibility } from 'backend/spinWheel.web.js';
  ```

- [ ] **Step 3: Add reduced-motion fallback and wire the single onClick handler**

  In `initSpinSection`, after `updateSpinUI(eligibility, memberId)`, register the spin button handler ONCE:

  ```js
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  $w('#spinButton').onClick(async () => {
    $w('#spinButton').disable();
    if (!prefersReducedMotion) $w('#spinLottieHub').play();
    const result = await spinWheel(memberId, null);
    updateSpinUI(result, memberId);
    if (result.prize) {
      if (!prefersReducedMotion) {
        $w('#spinLottieConfetti').play();
        $w('#spinConfettiOverlay').show();
        setTimeout(() => $w('#spinConfettiOverlay').hide(), 3000);
      }
      await loadPendingPrizes(memberId);
    }
  });
  ```

  **Important:** This is the only place `$w('#spinButton').onClick(...)` is called. `updateSpinUI` must NOT register another handler — it only updates labels and enable/disable state.


- [ ] **Step 3: Verify in Wix Preview with reduced motion OS setting**

  Enable "Reduce motion" in OS accessibility settings. Reload preview — spin should show instant result without animation.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/hal/gt/cfutons
  git add "src/pages/Member Page.js"
  git commit -m "feat(spin-wheel): Lottie animations + reduced-motion accessibility fallback"
  ```

---

## Task 8: Final validation + Definition of Done

- [ ] **Step 1: Run full test suite — must be green**

  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run
  ```
  Expected: all tests pass, no regressions.

- [ ] **Step 2: Update EDITOR_HOOKUP_GUIDE.html**

  Add new element IDs to the Wix element nickname table in `EDITOR_HOOKUP_GUIDE.html`:
  `#spinWheelSection`, `#spinWheelSVG`, `#spinButton`, `#spinCountdown`, `#spinResultText`, `#spinBonusChip`, `#spinLottieHub`, `#spinLottieConfetti`, `#spinConfettiOverlay`, `#pendingPrizesRepeater`

  Also add the 4 new CMS collections to the CMS section of the guide.

- [ ] **Step 3: Sync EDITOR-HOOKUP-GUIDE.md**

  Mirror all changes from `EDITOR_HOOKUP_GUIDE.html` into `EDITOR-HOOKUP-GUIDE.md`.

- [ ] **Step 4: Final commit**

  ```bash
  cd /Users/hal/gt/cfutons
  git add EDITOR_HOOKUP_GUIDE.html EDITOR-HOOKUP-GUIDE.md
  git commit -m "docs(spin-wheel): update editor hookup guides — Phase 1 element IDs + CMS collections"
  ```

- [ ] **Step 5: Open PR**

  ```bash
  gh pr create --title "feat(CF-spin-wheel): Phase 1 Daily Spin Wheel" --body "$(cat <<'EOF'
  ## Summary
  - Daily spin wheel inline in Member Page Rewards section
  - CMS-configurable prize pool (SpinPrizes + BonusSpinGrants — editable from Wix Dashboard)
  - Server-side weighted draw with timestamp guard pattern (no atomic transactions)
  - Bonus spins earned via qualifying actions (order, review, referral)
  - Non-points prizes (Free Shipping, Discount, Swatch) tracked in MemberPendingPrizes
  - Lottie animations + reduced-motion accessibility fallback
  - Editor hookup guides updated

  ## Test plan
  - [ ] `npx vitest run` green (spinWheel.test.js + SpinWheel.frontend.test.js + all regressions)
  - [ ] Spin wheel renders in Wix Preview, daily eligibility guard works
  - [ ] Non-points prize inserts PENDING row in MemberPendingPrizes
  - [ ] Bonus spin granted after qualifying event, decremented on use
  - [ ] Reduced-motion OS setting disables animations

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```
