# Chibi Futon Avatar — Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full chibi futon avatar system — bear Lottie placeholder, equippable accessories with four perk types (including BONUS_POINTS_DAY), and shop UI — on the Member Page loyalty section.

**Architecture:** A new `avatarService.web.js` backend webMethod file handles all three avatar operations (read state, purchase, equip) with auth guards and rate limiting following the project security-audit pattern (PRs #605–#610). On every point-earn event, `gamificationEventReceiver.web.js` reads `MemberAvatar.equippedAccessoryId` and applies a BONUS_POINTS_DAY doubling multiplier (capped at 4× combined with streak) before awarding points. A new `AvatarDisplay.js` frontend module provides pure functions that wire to `Member Page.js` via `$w()` selectors for the Lottie container, accessory overlay, shop repeater, and unlock toast.

**Tech Stack:** Wix Velo JS, wix-data (no atomic transactions), vitest, existing wix-data mock (`__seed`, `__reset`, `__onUpdate`, `__onInsert`, `__setQueryError`, `__setInsertError`, `__setUpdateError`, `__getInserted`), `Intl.DateTimeFormat` ET date math from `dateUtils.js` (Phase 2).

---

## File Structure

| File | Status | Purpose |
|------|--------|---------|
| `src/public/gamificationTokens.js` | **Modify** | Add `GAMIFICATION_TIER_ORDER` constant; add `isBonusPointsDayAvailable()` helper |
| `tests/gamificationTokens.test.js` | **Modify** | Tests for `GAMIFICATION_TIER_ORDER` and `isBonusPointsDayAvailable()` |
| `src/backend/avatarService.web.js` | **Create** | webMethods: `getAvatarState`, `purchaseAccessory`, `equipAccessory` |
| `tests/avatarService.test.js` | **Create** | Full TDD test suite for all three webMethods |
| `src/backend/gamificationEventReceiver.web.js` | **Modify** | Extend point-earn path with BONUS_POINTS_DAY multiplier + `bonusPointsDayUsed` write |
| `tests/gamificationEventReceiver.test.js` | **Modify** | BONUS_POINTS_DAY tests: active, exhausted, 4× cap, no avatar record |
| `src/public/AvatarDisplay.js` | **Create** | Pure frontend functions: `renderAvatar`, `showUnlockCelebration`, `buildAccessoryShopItems` |
| `tests/AvatarDisplay.test.js` | **Create** | Unit tests for all three display functions |

---

## Environment Setup

All test commands run from: `/Users/hal/gt/cfutons/refinery/rig`

Run single file: `npx vitest run tests/<filename>.test.js`
Run all: `npx vitest run`

wix-data mock exports: `__seed`, `__reset`, `__onUpdate`, `__onInsert`, `__setQueryError`, `__setInsertError`, `__setUpdateError`, `__getInserted`

Fake timers: `vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));`
Always restore: `vi.useRealTimers();` in `afterEach`.

---

## Task 1: `gamificationTokens.js` — `GAMIFICATION_TIER_ORDER` + `isBonusPointsDayAvailable()`

**Files:**
- Modify: `src/public/gamificationTokens.js`
- Modify: `tests/gamificationTokens.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/gamificationTokens.test.js`:

```js
import {
  GAMIFICATION_TIER_ORDER,
  isBonusPointsDayAvailable,
} from '../src/public/gamificationTokens.js';

// ── GAMIFICATION_TIER_ORDER ───────────────────────────────────────────────────

describe('GAMIFICATION_TIER_ORDER', () => {
  it('is an array with four tiers in ascending order', () => {
    expect(GAMIFICATION_TIER_ORDER).toEqual([
      'TRAIL_BLAZER',
      'MOUNTAIN_GUIDE',
      'SUMMIT_MASTER',
      'BLUE_RIDGE_LEGEND',
    ]);
  });

  it('TRAIL_BLAZER index is lower than MOUNTAIN_GUIDE', () => {
    expect(GAMIFICATION_TIER_ORDER.indexOf('TRAIL_BLAZER'))
      .toBeLessThan(GAMIFICATION_TIER_ORDER.indexOf('MOUNTAIN_GUIDE'));
  });

  it('SUMMIT_MASTER index is lower than BLUE_RIDGE_LEGEND', () => {
    expect(GAMIFICATION_TIER_ORDER.indexOf('SUMMIT_MASTER'))
      .toBeLessThan(GAMIFICATION_TIER_ORDER.indexOf('BLUE_RIDGE_LEGEND'));
  });
});

// ── isBonusPointsDayAvailable ─────────────────────────────────────────────────

describe('isBonusPointsDayAvailable', () => {
  it('returns true when bonusPointsDayUsed is empty string (never used)', () => {
    expect(isBonusPointsDayAvailable('', '2026-03-22')).toBe(true);
  });

  it('returns true when bonusPointsDayUsed is null (never used)', () => {
    expect(isBonusPointsDayAvailable(null, '2026-03-22')).toBe(true);
  });

  it('returns false when used today (0 days ago)', () => {
    expect(isBonusPointsDayAvailable('2026-03-22', '2026-03-22')).toBe(false);
  });

  it('returns false when used 3 days ago (within 7-day window)', () => {
    expect(isBonusPointsDayAvailable('2026-03-19', '2026-03-22')).toBe(false);
  });

  it('returns false when used exactly 6 days ago (boundary — still in window)', () => {
    expect(isBonusPointsDayAvailable('2026-03-16', '2026-03-22')).toBe(false);
  });

  it('returns true when used exactly 7 days ago (window just expired)', () => {
    expect(isBonusPointsDayAvailable('2026-03-15', '2026-03-22')).toBe(true);
  });

  it('returns true when used 14 days ago (well outside window)', () => {
    expect(isBonusPointsDayAvailable('2026-03-08', '2026-03-22')).toBe(true);
  });

  it('handles month boundary correctly (Mar 1, used Feb 22)', () => {
    expect(isBonusPointsDayAvailable('2026-02-22', '2026-03-01')).toBe(true); // 7 days
  });

  it('handles year boundary correctly (Jan 7, used Dec 31)', () => {
    expect(isBonusPointsDayAvailable('2025-12-31', '2026-01-07')).toBe(true); // 7 days
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/gamificationTokens.test.js
```

Expected: FAIL — `GAMIFICATION_TIER_ORDER` not exported, `isBonusPointsDayAvailable` not exported.

- [ ] **Step 3: Implement in `gamificationTokens.js`**

Add to `src/public/gamificationTokens.js`:

```js
/**
 * Ordered tier list from lowest to highest. Used for tier-gating accessory purchases.
 */
export const GAMIFICATION_TIER_ORDER = [
  'TRAIL_BLAZER',
  'MOUNTAIN_GUIDE',
  'SUMMIT_MASTER',
  'BLUE_RIDGE_LEGEND',
];

/**
 * Returns true if the member is eligible to use BONUS_POINTS_DAY.
 * Eligible when bonusPointsDayUsed is empty/null OR more than 6 days before todayET
 * (i.e., the 7-day rolling window has expired).
 *
 * @param {string|null} bonusPointsDayUsed - ET date string e.g. "2026-03-15", or empty/null
 * @param {string} todayET - Today's ET date string e.g. "2026-03-22"
 * @returns {boolean}
 */
export function isBonusPointsDayAvailable(bonusPointsDayUsed, todayET) {
  if (!bonusPointsDayUsed) return true;
  const [y, m, d] = bonusPointsDayUsed.split('-').map(Number);
  const usedMs = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayET.split('-').map(Number);
  const todayMs = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.floor((todayMs - usedMs) / 86400000);
  return diffDays > 6; // older than 6 days = at least 7 days ago
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/gamificationTokens.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Run full suite — no regressions**

```bash
npx vitest run
```

Expected: all pre-existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/public/gamificationTokens.js tests/gamificationTokens.test.js
git commit -m "feat(avatar): GAMIFICATION_TIER_ORDER + isBonusPointsDayAvailable helper"
```

---

## Task 2: `avatarService.web.js` — `getAvatarState`

**Files:**
- Create: `src/backend/avatarService.web.js`
- Create: `tests/avatarService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/avatarService.test.js` with the `getAvatarState` describe block:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
  __onUpdate,
} from './__mocks__/wix-data.js';
import { getAvatarState } from '../src/backend/avatarService.web.js';

const MEMBER_AVATAR_COLLECTION = 'MemberAvatar';
const AVATAR_ACCESSORIES_COLLECTION = 'AvatarAccessories';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getAvatarState', () => {
  it('returns safe defaults when no MemberAvatar record exists', async () => {
    const result = await getAvatarState('mem-1');
    expect(result.equippedAccessoryId).toBeNull();
    expect(result.unlockedAccessoryIds).toEqual([]);
    expect(result.lottieAnimationId).toBe('waving-bear-3e2qFVfuGO');
    expect(result.bonusPointsDayEligible).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('returns correct state for a member with existing avatar record', async () => {
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-1',
      memberId: 'mem-2',
      equippedAccessoryId: 'acc-hat',
      unlockedAccessoryIds: JSON.stringify(['acc-hat', 'acc-bow']),
      bonusPointsDayUsed: '',
    }]);
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-hat',
      label: 'Party Hat',
      description: 'Wear a party hat!',
      perkType: 'COSMETIC',
      perkValue: 0,
      active: true,
    }]);

    const result = await getAvatarState('mem-2');
    expect(result.equippedAccessoryId).toBe('acc-hat');
    expect(result.unlockedAccessoryIds).toEqual(['acc-hat', 'acc-bow']);
    expect(result.equippedAccessory.label).toBe('Party Hat');
    expect(result.equippedAccessory.perkType).toBe('COSMETIC');
    expect(result.lottieAnimationId).toBe('waving-bear-3e2qFVfuGO');
  });

  it('returns bonusPointsDayEligible = true when BONUS_POINTS_DAY equipped and window expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // today ET = 2026-03-22
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-3',
      memberId: 'mem-3',
      equippedAccessoryId: 'acc-bonus',
      unlockedAccessoryIds: JSON.stringify(['acc-bonus']),
      bonusPointsDayUsed: '2026-03-14', // 8 days ago — eligible
    }]);
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-bonus',
      label: 'Lucky Charm',
      description: 'Double points once a week',
      perkType: 'BONUS_POINTS_DAY',
      perkValue: 0,
      active: true,
    }]);

    const result = await getAvatarState('mem-3');
    expect(result.bonusPointsDayEligible).toBe(true);
  });

  it('returns bonusPointsDayEligible = false when BONUS_POINTS_DAY used within 7-day window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-4',
      memberId: 'mem-4',
      equippedAccessoryId: 'acc-bonus',
      unlockedAccessoryIds: JSON.stringify(['acc-bonus']),
      bonusPointsDayUsed: '2026-03-20', // 2 days ago — not eligible
    }]);
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-bonus',
      label: 'Lucky Charm',
      description: 'Double points once a week',
      perkType: 'BONUS_POINTS_DAY',
      perkValue: 0,
      active: true,
    }]);

    const result = await getAvatarState('mem-4');
    expect(result.bonusPointsDayEligible).toBe(false);
  });

  it('treats malformed unlockedAccessoryIds JSON as empty array and logs parse error', async () => {
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-5',
      memberId: 'mem-5',
      equippedAccessoryId: null,
      unlockedAccessoryIds: 'NOT_VALID_JSON',
      bonusPointsDayUsed: '',
    }]);
    const result = await getAvatarState('mem-5');
    expect(result.unlockedAccessoryIds).toEqual([]);
    expect(result.error).toBeUndefined(); // does not surface parse error to caller
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/avatarService.test.js
```

Expected: FAIL — "Cannot find module '../src/backend/avatarService.web.js'"

- [ ] **Step 3: Implement `getAvatarState` in `avatarService.web.js`**

Create `src/backend/avatarService.web.js` with the following structure:

```js
/**
 * @module avatarService.web
 * @description Wix backend webMethods for the Chibi Futon Avatar system.
 * Handles avatar state reads, accessory purchases, and accessory equipping.
 * All methods require member auth. Rate limits follow the project-wide pattern.
 *
 * CF-phase6-avatar
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';
import {
  getTierForPoints,
  GAMIFICATION_TIER_ORDER,
  isBonusPointsDayAvailable,
} from 'public/gamificationTokens.js';
import { getTodayET } from 'backend/utils/dateUtils.js';

const MEMBER_AVATAR_COLLECTION = 'MemberAvatar';
const AVATAR_ACCESSORIES_COLLECTION = 'AvatarAccessories';
const MEMBER_POINTS_COLLECTION = 'MemberPoints';

const DEFAULT_LOTTIE_ID = 'waving-bear-3e2qFVfuGO';

// ── Rate limiting (per project pattern from PRs #605-#610) ────────────────────

const _rateLimits = new Map(); // key: `${memberId}:${method}` → { count, windowStart }

function checkRateLimit(memberId, method, maxPerHour) {
  const key = `${memberId}:${method}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = _rateLimits.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    _rateLimits.set(key, { count: 1, windowStart: now });
    return false; // not limited
  }
  if (entry.count >= maxPerHour) return true; // limited
  entry.count++;
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findAvatarRecord(memberId) {
  const results = await wixData.query(MEMBER_AVATAR_COLLECTION)
    .eq('memberId', memberId)
    .limit(1)
    .find({ suppressAuth: true });
  return results.items.length > 0 ? results.items[0] : null;
}

function parseUnlockedIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logError('avatarService — malformed unlockedAccessoryIds JSON', err, { silent: true });
    return [];
  }
}

// ── getAvatarState ────────────────────────────────────────────────────────────

export const getAvatarState = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (checkRateLimit(memberId, 'getAvatarState', 10)) {
      return { error: 'rate_limited', retryAfterMs: 3600000 };
    }

    try {
      const record = await findAvatarRecord(memberId);

      if (!record) {
        return {
          equippedAccessoryId: null,
          equippedAccessory: null,
          unlockedAccessoryIds: [],
          lottieAnimationId: DEFAULT_LOTTIE_ID,
          bonusPointsDayEligible: false,
        };
      }

      const unlockedAccessoryIds = parseUnlockedIds(record.unlockedAccessoryIds);
      const equippedAccessoryId = record.equippedAccessoryId || null;

      let equippedAccessory = null;
      let bonusPointsDayEligible = false;

      if (equippedAccessoryId) {
        try {
          const accResult = await wixData.query(AVATAR_ACCESSORIES_COLLECTION)
            .eq('_id', equippedAccessoryId)
            .limit(1)
            .find({ suppressAuth: true });
          if (accResult.items.length > 0) {
            const acc = accResult.items[0];
            equippedAccessory = {
              label: acc.label,
              description: acc.description,
              perkType: acc.perkType,
              perkValue: acc.perkValue,
            };
            if (acc.perkType === 'BONUS_POINTS_DAY') {
              const todayET = getTodayET();
              bonusPointsDayEligible = isBonusPointsDayAvailable(
                record.bonusPointsDayUsed || '',
                todayET
              );
            }
          }
        } catch (err) {
          logError('avatarService.getAvatarState — accessory lookup failed', err, { silent: true });
        }
      }

      return {
        equippedAccessoryId,
        equippedAccessory,
        unlockedAccessoryIds,
        lottieAnimationId: DEFAULT_LOTTIE_ID,
        bonusPointsDayEligible,
      };
    } catch (err) {
      logError('avatarService.getAvatarState — failed', err);
      return { error: 'Failed to load avatar state' };
    }
  }
);
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/avatarService.test.js
```

Expected: All `getAvatarState` tests PASS (purchaseAccessory/equipAccessory tests not yet written).

---

## Task 3: `avatarService.web.js` — `purchaseAccessory`

**Files:**
- Modify: `src/backend/avatarService.web.js`
- Modify: `tests/avatarService.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/avatarService.test.js`. Extend the existing top-level import for `avatarService.web.js` to also include `purchaseAccessory`:

```js
import { purchaseAccessory } from '../src/backend/avatarService.web.js';

const MEMBER_POINTS_COLLECTION = 'MemberPoints';

describe('purchaseAccessory', () => {
  it('deducts correct point cost and adds accessoryId to unlockedAccessoryIds', async () => {
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-bow',
      label: 'Bow Tie',
      description: 'Dapper.',
      pointCost: 100,
      perkType: 'COSMETIC',
      tierRequired: 'TRAIL_BLAZER',
      active: true,
      seasonalUntil: null,
    }]);
    __seed(MEMBER_POINTS_COLLECTION, [{
      _id: 'mp-1',
      memberId: 'mem-1',
      totalPoints: 500,
      tier: 'MOUNTAIN_GUIDE',
    }]);
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-1',
      memberId: 'mem-1',
      equippedAccessoryId: null,
      unlockedAccessoryIds: JSON.stringify([]),
    }]);

    const result = await purchaseAccessory('mem-1', 'acc-bow');
    expect(result.success).toBe(true);
    expect(result.newTotalPoints).toBe(400);
    expect(result.state.unlockedAccessoryIds).toContain('acc-bow');
  });

  it('returns { error: "insufficient_points" } when totalPoints < pointCost; no deduction', async () => {
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-crown',
      label: 'Crown',
      pointCost: 1000,
      perkType: 'COSMETIC',
      tierRequired: 'TRAIL_BLAZER',
      active: true,
      seasonalUntil: null,
    }]);
    __seed(MEMBER_POINTS_COLLECTION, [{
      _id: 'mp-2',
      memberId: 'mem-2',
      totalPoints: 200,
      tier: 'TRAIL_BLAZER',
    }]);
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-2',
      memberId: 'mem-2',
      equippedAccessoryId: null,
      unlockedAccessoryIds: JSON.stringify([]),
    }]);

    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    const result = await purchaseAccessory('mem-2', 'acc-crown');
    expect(result.error).toBe('insufficient_points');
    expect(result.needed).toBe(1000);
    expect(result.available).toBe(200);
    expect(updates.filter(u => u.col === MEMBER_POINTS_COLLECTION)).toHaveLength(0);
  });

  it('returns { error: "tier_required" } when member tier is below tierRequired; no deduction', async () => {
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-legend',
      label: 'Legend Cape',
      pointCost: 50,
      perkType: 'COSMETIC',
      tierRequired: 'BLUE_RIDGE_LEGEND',
      active: true,
      seasonalUntil: null,
    }]);
    __seed(MEMBER_POINTS_COLLECTION, [{
      _id: 'mp-3',
      memberId: 'mem-3',
      totalPoints: 5000,
      tier: 'TRAIL_BLAZER',
    }]);
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-3',
      memberId: 'mem-3',
      equippedAccessoryId: null,
      unlockedAccessoryIds: JSON.stringify([]),
    }]);

    const result = await purchaseAccessory('mem-3', 'acc-legend');
    expect(result.error).toBe('tier_required');
    expect(result.requiredTier).toBe('BLUE_RIDGE_LEGEND');
  });

  it('returns { error: "already_owned" } idempotently when accessory already in unlockedAccessoryIds', async () => {
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-bow',
      label: 'Bow Tie',
      pointCost: 100,
      perkType: 'COSMETIC',
      tierRequired: 'TRAIL_BLAZER',
      active: true,
      seasonalUntil: null,
    }]);
    __seed(MEMBER_POINTS_COLLECTION, [{
      _id: 'mp-4',
      memberId: 'mem-4',
      totalPoints: 500,
      tier: 'MOUNTAIN_GUIDE',
    }]);
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-4',
      memberId: 'mem-4',
      equippedAccessoryId: 'acc-bow',
      unlockedAccessoryIds: JSON.stringify(['acc-bow']),
    }]);

    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    const result = await purchaseAccessory('mem-4', 'acc-bow');
    expect(result.error).toBe('already_owned');
    expect(updates.filter(u => u.col === MEMBER_POINTS_COLLECTION)).toHaveLength(0);
  });

  it('returns { error: "not_found" } for inactive accessory', async () => {
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-inactive',
      label: 'Retired Item',
      pointCost: 50,
      perkType: 'COSMETIC',
      tierRequired: 'TRAIL_BLAZER',
      active: false,
      seasonalUntil: null,
    }]);
    __seed(MEMBER_POINTS_COLLECTION, [{ _id: 'mp-5', memberId: 'mem-5', totalPoints: 500, tier: 'TRAIL_BLAZER' }]);

    const result = await purchaseAccessory('mem-5', 'acc-inactive');
    expect(result.error).toBe('not_found');
  });

  it('returns { error: "not_found" } for non-existent accessory', async () => {
    __seed(MEMBER_POINTS_COLLECTION, [{ _id: 'mp-6', memberId: 'mem-6', totalPoints: 500, tier: 'TRAIL_BLAZER' }]);

    const result = await purchaseAccessory('mem-6', 'acc-does-not-exist');
    expect(result.error).toBe('not_found');
  });

  it('returns { error: "seasonal_expired" } when seasonalUntil is in the past', async () => {
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-xmas',
      label: 'Santa Hat',
      pointCost: 50,
      perkType: 'COSMETIC',
      tierRequired: 'TRAIL_BLAZER',
      active: true,
      seasonalUntil: new Date('2025-12-31T00:00:00Z'), // past
    }]);
    __seed(MEMBER_POINTS_COLLECTION, [{ _id: 'mp-7', memberId: 'mem-7', totalPoints: 500, tier: 'TRAIL_BLAZER' }]);

    const result = await purchaseAccessory('mem-7', 'acc-xmas');
    expect(result.error).toBe('seasonal_expired');
  });
});
```

**Note on write failure:** If `MemberAvatar` write fails after points are deducted, the spec documents this as an accepted risk (no atomic cross-collection writes in Wix Velo). The service logs the error and does not retry. No test for this scenario beyond confirming the error is logged — the spec explicitly states this is acceptable.

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/avatarService.test.js
```

Expected: FAIL — `purchaseAccessory` is not exported.

- [ ] **Step 3: Implement `purchaseAccessory` in `avatarService.web.js`**

Add the `purchaseAccessory` webMethod:

```js
export const purchaseAccessory = webMethod(
  Permissions.SiteMember,
  async (memberId, accessoryId) => {
    if (checkRateLimit(memberId, 'purchaseAccessory', 5)) {
      return { error: 'rate_limited', retryAfterMs: 3600000 };
    }

    try {
      // 1. Load accessory
      const accResults = await wixData.query(AVATAR_ACCESSORIES_COLLECTION)
        .eq('_id', accessoryId)
        .limit(1)
        .find({ suppressAuth: true });
      if (accResults.items.length === 0) return { error: 'not_found' };
      const accessory = accResults.items[0];
      if (!accessory.active) return { error: 'not_found' };

      // 2. Seasonal expiry
      if (accessory.seasonalUntil && new Date(accessory.seasonalUntil) < new Date()) {
        return { error: 'seasonal_expired' };
      }

      // 3. Load or init avatar record
      let avatarRecord = await findAvatarRecord(memberId);
      const unlockedIds = parseUnlockedIds(avatarRecord?.unlockedAccessoryIds);

      // 4. Idempotency: already owned
      if (unlockedIds.includes(accessoryId)) {
        const state = avatarRecord ? {
          equippedAccessoryId: avatarRecord.equippedAccessoryId || null,
          unlockedAccessoryIds: unlockedIds,
        } : { equippedAccessoryId: null, unlockedAccessoryIds: [] };
        return { error: 'already_owned', state };
      }

      // 5. Load MemberPoints
      const ptResults = await wixData.query(MEMBER_POINTS_COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });
      const ptRecord = ptResults.items.length > 0 ? ptResults.items[0] : null;
      const totalPoints = ptRecord ? ptRecord.totalPoints : 0;

      // 6. Tier check
      const memberTier = getTierForPoints(totalPoints);
      const memberTierIdx = GAMIFICATION_TIER_ORDER.indexOf(memberTier);
      const requiredTierIdx = GAMIFICATION_TIER_ORDER.indexOf(accessory.tierRequired);
      if (requiredTierIdx > memberTierIdx) {
        return { error: 'tier_required', requiredTier: accessory.tierRequired };
      }

      // 7. Points check
      if (totalPoints < accessory.pointCost) {
        return { error: 'insufficient_points', needed: accessory.pointCost, available: totalPoints };
      }

      // 8. Deduct points
      const newTotalPoints = totalPoints - accessory.pointCost;
      const newTier = getTierForPoints(newTotalPoints);
      if (ptRecord) {
        await wixData.update(MEMBER_POINTS_COLLECTION, {
          ...ptRecord,
          totalPoints: newTotalPoints,
          tier: newTier,
        });
      } else {
        await wixData.insert(MEMBER_POINTS_COLLECTION, {
          memberId,
          totalPoints: newTotalPoints,
          tier: newTier,
        });
      }

      // 9. Add to unlocked list
      const newUnlockedIds = [...unlockedIds, accessoryId];
      try {
        if (avatarRecord) {
          await wixData.update(MEMBER_AVATAR_COLLECTION, {
            ...avatarRecord,
            unlockedAccessoryIds: JSON.stringify(newUnlockedIds),
          });
        } else {
          avatarRecord = await wixData.insert(MEMBER_AVATAR_COLLECTION, {
            memberId,
            equippedAccessoryId: '',
            unlockedAccessoryIds: JSON.stringify(newUnlockedIds),
            bonusPointsDayUsed: '',
          });
        }
      } catch (avatarErr) {
        // Accepted risk: points already deducted; log and do not retry
        logError('avatarService.purchaseAccessory — MemberAvatar write failed after points deducted', avatarErr);
      }

      const updatedState = {
        equippedAccessoryId: avatarRecord?.equippedAccessoryId || null,
        unlockedAccessoryIds: newUnlockedIds,
        lottieAnimationId: DEFAULT_LOTTIE_ID,
      };

      return { success: true, state: updatedState, newTotalPoints, newTier };
    } catch (err) {
      logError('avatarService.purchaseAccessory — failed', err);
      return { error: 'Failed to purchase accessory' };
    }
  }
);
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/avatarService.test.js
```

Expected: All `purchaseAccessory` tests PASS.

---

## Task 4: `avatarService.web.js` — `equipAccessory`

**Files:**
- Modify: `src/backend/avatarService.web.js`
- Modify: `tests/avatarService.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/avatarService.test.js`. Extend the existing top-level import to also include `equipAccessory`:

```js
import { equipAccessory } from '../src/backend/avatarService.web.js';

describe('equipAccessory', () => {
  it('sets equippedAccessoryId and returns equipped accessory data', async () => {
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-eq1',
      memberId: 'mem-eq1',
      equippedAccessoryId: null,
      unlockedAccessoryIds: JSON.stringify(['acc-hat', 'acc-bow']),
      bonusPointsDayUsed: '',
    }]);
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-hat',
      label: 'Party Hat',
      description: 'Festive!',
      perkType: 'COSMETIC',
      perkValue: 0,
      active: true,
    }]);

    const result = await equipAccessory('mem-eq1', 'acc-hat');
    expect(result.success).toBe(true);
    expect(result.equippedAccessory.label).toBe('Party Hat');
    expect(result.equippedAccessory.perkType).toBe('COSMETIC');
  });

  it('returns { error: "not_unlocked" } when accessoryId not in unlockedAccessoryIds', async () => {
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-eq2',
      memberId: 'mem-eq2',
      equippedAccessoryId: null,
      unlockedAccessoryIds: JSON.stringify([]),
      bonusPointsDayUsed: '',
    }]);

    const result = await equipAccessory('mem-eq2', 'acc-hat');
    expect(result.error).toBe('not_unlocked');
  });

  it('clears equippedAccessoryId when accessoryId is null (unequip)', async () => {
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-eq3',
      memberId: 'mem-eq3',
      equippedAccessoryId: 'acc-hat',
      unlockedAccessoryIds: JSON.stringify(['acc-hat']),
      bonusPointsDayUsed: '',
    }]);

    const result = await equipAccessory('mem-eq3', null);
    expect(result.success).toBe(true);
    expect(result.equippedAccessory).toBeNull();
  });

  it('returns rate limit error after 10 calls in one hour', async () => {
    // Seed a valid record for repeated calls
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-eq4',
      memberId: 'mem-rl1',
      equippedAccessoryId: null,
      unlockedAccessoryIds: JSON.stringify(['acc-hat']),
      bonusPointsDayUsed: '',
    }]);
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-hat',
      label: 'Party Hat',
      description: 'Festive!',
      perkType: 'COSMETIC',
      perkValue: 0,
      active: true,
    }]);

    // Exhaust rate limit
    for (let i = 0; i < 10; i++) {
      await equipAccessory('mem-rl1', 'acc-hat');
    }
    const result = await equipAccessory('mem-rl1', 'acc-hat');
    expect(result.error).toBe('rate_limited');
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/avatarService.test.js
```

Expected: FAIL — `equipAccessory` not exported.

- [ ] **Step 3: Implement `equipAccessory` in `avatarService.web.js`**

```js
export const equipAccessory = webMethod(
  Permissions.SiteMember,
  async (memberId, accessoryId) => {
    if (checkRateLimit(memberId, 'equipAccessory', 10)) {
      return { error: 'rate_limited', retryAfterMs: 3600000 };
    }

    try {
      const avatarRecord = await findAvatarRecord(memberId);
      if (!avatarRecord) {
        return { error: 'not_unlocked' };
      }

      // Unequip path: accessoryId = null clears the slot
      if (accessoryId === null) {
        await wixData.update(MEMBER_AVATAR_COLLECTION, {
          ...avatarRecord,
          equippedAccessoryId: '',
        });
        return { success: true, equippedAccessory: null };
      }

      const unlockedIds = parseUnlockedIds(avatarRecord.unlockedAccessoryIds);
      if (!unlockedIds.includes(accessoryId)) {
        logError(
          `avatarService.equipAccessory — anomaly: member ${memberId} tried to equip unowned accessory ${accessoryId}`,
          new Error('not_unlocked'),
          { silent: true }
        );
        return { error: 'not_unlocked' };
      }

      await wixData.update(MEMBER_AVATAR_COLLECTION, {
        ...avatarRecord,
        equippedAccessoryId: accessoryId,
      });

      const accResults = await wixData.query(AVATAR_ACCESSORIES_COLLECTION)
        .eq('_id', accessoryId)
        .limit(1)
        .find({ suppressAuth: true });
      const acc = accResults.items[0];

      return {
        success: true,
        equippedAccessory: acc
          ? { label: acc.label, description: acc.description, perkType: acc.perkType, perkValue: acc.perkValue }
          : null,
      };
    } catch (err) {
      logError('avatarService.equipAccessory — failed', err);
      return { error: 'Failed to equip accessory' };
    }
  }
);
```

- [ ] **Step 4: Run full avatarService test suite — all PASS**

```bash
npx vitest run tests/avatarService.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/backend/avatarService.web.js tests/avatarService.test.js
git commit -m "feat(avatar): avatarService.web.js — getAvatarState, purchaseAccessory, equipAccessory"
```

---

## Task 5: Extend `gamificationEventReceiver.web.js` with BONUS_POINTS_DAY

**Files:**
- Modify: `src/backend/gamificationEventReceiver.web.js`
- Modify: `tests/gamificationEventReceiver.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/gamificationEventReceiver.test.js`:

```js
import { vi } from 'vitest';
import { __reset, __seed, __onUpdate } from './__mocks__/wix-data.js';
import { receiveGamificationEvent } from '../src/backend/gamificationEventReceiver.web.js';

const MEMBER_AVATAR_COLLECTION = 'MemberAvatar';
const MEMBER_POINTS_COLLECTION = 'MemberPoints';
const AVATAR_ACCESSORIES_COLLECTION = 'AvatarAccessories';

afterEach(() => {
  vi.useRealTimers();
});

describe('BONUS_POINTS_DAY multiplier', () => {
  const setupBonus = (bonusPointsDayUsed, streakMultiplier = 1) => {
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-bonus',
      label: 'Lucky Charm',
      perkType: 'BONUS_POINTS_DAY',
      active: true,
    }]);
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-1',
      memberId: 'mem-bonus',
      equippedAccessoryId: 'acc-bonus',
      unlockedAccessoryIds: JSON.stringify(['acc-bonus']),
      bonusPointsDayUsed,
    }]);
    __seed(MEMBER_POINTS_COLLECTION, [{
      _id: 'mp-1',
      memberId: 'mem-bonus',
      totalPoints: 0,
      tier: 'TRAIL_BLAZER',
      streakMultiplier,
      currentStreakDays: streakMultiplier === 2 ? 7 : 1,
      lastActivityDate: null,
      streakStartDate: null,
    }]);
  };

  it('applies 2× bonusMultiplier when BONUS_POINTS_DAY equipped and eligible (no streak)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    setupBonus(''); // never used — eligible
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-bonus');
    // base 5 pts × bonusMultiplier 2 × streakMultiplier 1 = 10
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(10);
  });

  it('caps combined multiplier at 4× when bonusMultiplier 2 × streakMultiplier 2', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    setupBonus('', 2); // eligible, 7-day streak = streakMultiplier 2
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-bonus');
    // base 5 × Math.min(2*2, 4) = 5 × 4 = 20
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(20);
  });

  it('does NOT apply bonus when bonusPointsDayUsed is within the 7-day window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    setupBonus('2026-03-20'); // 2 days ago — not eligible
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-bonus');
    // base 5 × 1 (no bonus) × streakMultiplier 1 = 5
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(5);
  });

  it('DOES apply bonus when bonusPointsDayUsed is exactly 7 days ago (window expired)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    setupBonus('2026-03-15'); // 7 days ago — eligible
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-bonus');
    expect(result.newTotal).toBe(10); // 5 × 2
  });

  it('sets bonusPointsDayUsed to todayET after applying bonus', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    setupBonus('');
    const updates = [];
    __onUpdate((col, item) => {
      if (col === MEMBER_AVATAR_COLLECTION) updates.push(item);
    });
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-bonus');
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].bonusPointsDayUsed).toBe('2026-03-22');
  });

  it('does NOT apply bonus when equipped accessory has different perkType', async () => {
    __seed(AVATAR_ACCESSORIES_COLLECTION, [{
      _id: 'acc-cosmetic',
      label: 'Bow Tie',
      perkType: 'COSMETIC',
      active: true,
    }]);
    __seed(MEMBER_AVATAR_COLLECTION, [{
      _id: 'av-2',
      memberId: 'mem-cosmetic',
      equippedAccessoryId: 'acc-cosmetic',
      unlockedAccessoryIds: JSON.stringify(['acc-cosmetic']),
      bonusPointsDayUsed: '',
    }]);
    __seed(MEMBER_POINTS_COLLECTION, [{
      _id: 'mp-2',
      memberId: 'mem-cosmetic',
      totalPoints: 0,
      tier: 'TRAIL_BLAZER',
      streakMultiplier: 1,
      currentStreakDays: 1,
      lastActivityDate: null,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-cosmetic');
    expect(result.newTotal).toBe(5); // no bonus
  });

  it('does NOT apply bonus and does NOT error when member has no MemberAvatar record', async () => {
    __seed(MEMBER_POINTS_COLLECTION, [{
      _id: 'mp-3',
      memberId: 'mem-noavatar',
      totalPoints: 0,
      tier: 'TRAIL_BLAZER',
      streakMultiplier: 1,
      currentStreakDays: 1,
      lastActivityDate: null,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-noavatar');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(5); // normal points, no bonus
  });

  it('Phase 2 streak multiplier behaviour is unchanged when no BONUS_POINTS_DAY equipped', async () => {
    __seed(MEMBER_POINTS_COLLECTION, [{
      _id: 'mp-4',
      memberId: 'mem-streak',
      totalPoints: 0,
      tier: 'TRAIL_BLAZER',
      streakMultiplier: 1.5,
      currentStreakDays: 4,
      lastActivityDate: null,
    }]);
    // No MemberAvatar record at all
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-streak');
    // base 5 × streakMultiplier 1.5 = 7 (Math.round(7.5) = 8 actually — check spec)
    // From spec: awardedPoints = Math.round(basePoints * bonusMultiplier * streakMultiplier)
    // bonusMultiplier = 1, streakMultiplier = 1.5: Math.round(5 * 1 * 1.5) = Math.round(7.5) = 8
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(8);
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: FAIL — BONUS_POINTS_DAY logic not yet implemented.

- [ ] **Step 3: Implement BONUS_POINTS_DAY in `gamificationEventReceiver.web.js`**

Update the imports at the top of `gamificationEventReceiver.web.js`. The `getStreakMultiplier` import already exists from Phase 2 — extend it to also include `isBonusPointsDayAvailable`. The `getTodayET`/`getYesterdayET` imports also already exist from Phase 2 — no change needed there. `updateStreakState` is already exported from this same file (used internally). The final import lines should read:

```js
import { POINT_VALUES, getTierForPoints, getStreakMultiplier, isBonusPointsDayAvailable } from 'public/gamificationTokens.js';
import { getTodayET, getYesterdayET } from 'backend/utils/dateUtils.js';
```

Add collection constants:

```js
const MEMBER_AVATAR_COLLECTION = 'MemberAvatar';
const AVATAR_ACCESSORIES_COLLECTION = 'AvatarAccessories';
```

Add a helper to read the BONUS_POINTS_DAY multiplier for a member:

```js
/**
 * Reads MemberAvatar + AvatarAccessories to determine if BONUS_POINTS_DAY
 * is active for the member today. Returns { bonusMultiplier, avatarRecord }.
 * bonusMultiplier is 2 if eligible, 1 otherwise.
 * Never throws — returns bonusMultiplier = 1 on any error.
 *
 * @param {string} memberId
 * @param {string} todayET
 * @returns {Promise<{ bonusMultiplier: number, avatarRecord: Object|null }>}
 */
async function resolveBonusMultiplier(memberId, todayET) {
  try {
    const avatarResults = await wixData.query(MEMBER_AVATAR_COLLECTION)
      .eq('memberId', memberId)
      .limit(1)
      .find({ suppressAuth: true });
    if (avatarResults.items.length === 0) return { bonusMultiplier: 1, avatarRecord: null };
    const avatarRecord = avatarResults.items[0];
    if (!avatarRecord.equippedAccessoryId) return { bonusMultiplier: 1, avatarRecord };

    const accResults = await wixData.query(AVATAR_ACCESSORIES_COLLECTION)
      .eq('_id', avatarRecord.equippedAccessoryId)
      .limit(1)
      .find({ suppressAuth: true });
    if (accResults.items.length === 0) return { bonusMultiplier: 1, avatarRecord };
    const accessory = accResults.items[0];
    if (accessory.perkType !== 'BONUS_POINTS_DAY') return { bonusMultiplier: 1, avatarRecord };

    const eligible = isBonusPointsDayAvailable(avatarRecord.bonusPointsDayUsed || '', todayET);
    return { bonusMultiplier: eligible ? 2 : 1, avatarRecord };
  } catch (err) {
    logError('gamificationEventReceiver — resolveBonusMultiplier failed', err, { silent: true });
    return { bonusMultiplier: 1, avatarRecord: null };
  }
}
```

In the main `receiveGamificationEvent` handler, replace the `newTotal = oldTotal + delta` line with the combined multiplier calculation. The relevant section inside `try { const record = ...` becomes:

```js
const todayET = getTodayET();
const yesterdayET = getYesterdayET();
// updateStreakState is exported from this same file (added in Phase 2).
// Passing `record || {}` is safe — it uses `|| 0` / `|| 1` fallbacks for missing fields.
// milestoneBonus is a flat point bonus for 7-day streak milestone; `|| 0` guards new members.
const streakState = updateStreakState(record || {}, todayET, yesterdayET);
const streakMultiplier = streakState.streakMultiplier;
const milestoneBonus = streakState.milestoneBonus || 0;

// BONUS_POINTS_DAY: read avatar + accessory (silently no-ops if no avatar record)
const { bonusMultiplier, avatarRecord } = await resolveBonusMultiplier(memberId, todayET);

// Combined multiplier capped at 4×
const combinedMultiplier = Math.min(bonusMultiplier * streakMultiplier, 4);
const awardedPoints = Math.round(delta * combinedMultiplier) + milestoneBonus;
const newTotal = oldTotal + awardedPoints;
const newTier = getTierForPoints(newTotal);
const tierChanged = newTier !== oldTier;
```

After the `MemberPoints` write, add the `bonusPointsDayUsed` write (only when bonus was applied):

```js
// Update bonusPointsDayUsed if BONUS_POINTS_DAY was active this event
if (bonusMultiplier === 2 && avatarRecord) {
  try {
    await wixData.update(MEMBER_AVATAR_COLLECTION, {
      ...avatarRecord,
      bonusPointsDayUsed: todayET,
    });
  } catch (avatarErr) {
    // Accepted risk: points already awarded. Log, do not retry.
    logError('gamificationEventReceiver — bonusPointsDayUsed write failed', avatarErr);
  }
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/gamificationEventReceiver.test.js
```

Expected: All BONUS_POINTS_DAY tests PASS, all pre-existing tests still PASS.

- [ ] **Step 5: Run full suite — no regressions**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/backend/gamificationEventReceiver.web.js tests/gamificationEventReceiver.test.js
git commit -m "feat(avatar): BONUS_POINTS_DAY multiplier in gamificationEventReceiver — capped at 4×"
```

---

## Task 6: `AvatarDisplay.js` — Frontend Pure Functions

**Files:**
- Create: `src/public/AvatarDisplay.js`
- Create: `tests/AvatarDisplay.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/AvatarDisplay.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderAvatar,
  buildAccessoryShopItems,
  showUnlockCelebration,
} from '../src/public/AvatarDisplay.js';

// ── renderAvatar ──────────────────────────────────────────────────────────────

describe('renderAvatar', () => {
  let $lottieContainer, $accessoryOverlay;

  beforeEach(() => {
    $lottieContainer = {
      show: vi.fn(),
      hide: vi.fn(),
      html: '',
    };
    $accessoryOverlay = {
      show: vi.fn(),
      hide: vi.fn(),
      text: vi.fn(),
    };
  });

  it('hides lottie container when useReducedMotion is true', () => {
    const avatarState = {
      lottieAnimationId: 'waving-bear-3e2qFVfuGO',
      equippedAccessory: null,
      unlockedAccessoryIds: [],
    };
    renderAvatar($lottieContainer, $accessoryOverlay, avatarState, { useReducedMotion: true });
    expect($lottieContainer.hide).toHaveBeenCalled();
  });

  it('shows lottie container when useReducedMotion is false', () => {
    const avatarState = {
      lottieAnimationId: 'waving-bear-3e2qFVfuGO',
      equippedAccessory: null,
      unlockedAccessoryIds: [],
    };
    renderAvatar($lottieContainer, $accessoryOverlay, avatarState, { useReducedMotion: false });
    expect($lottieContainer.show).toHaveBeenCalled();
  });

  it('shows accessory overlay with label when accessory is equipped', () => {
    const avatarState = {
      lottieAnimationId: 'waving-bear-3e2qFVfuGO',
      equippedAccessory: { label: '🎩 Top Hat', perkType: 'COSMETIC' },
      unlockedAccessoryIds: ['acc-hat'],
    };
    renderAvatar($lottieContainer, $accessoryOverlay, avatarState, { useReducedMotion: false });
    expect($accessoryOverlay.text).toHaveBeenCalledWith('🎩 Top Hat');
    expect($accessoryOverlay.show).toHaveBeenCalled();
  });

  it('hides accessory overlay when no accessory is equipped', () => {
    const avatarState = {
      lottieAnimationId: 'waving-bear-3e2qFVfuGO',
      equippedAccessory: null,
      unlockedAccessoryIds: [],
    };
    renderAvatar($lottieContainer, $accessoryOverlay, avatarState, { useReducedMotion: false });
    expect($accessoryOverlay.hide).toHaveBeenCalled();
  });
});

// ── buildAccessoryShopItems ───────────────────────────────────────────────────

describe('buildAccessoryShopItems', () => {
  const accessories = [
    {
      _id: 'acc-cosmetic',
      label: 'Bow Tie',
      description: 'Dapper.',
      pointCost: 50,
      perkType: 'COSMETIC',
      perkValue: 0,
      tierRequired: 'TRAIL_BLAZER',
    },
    {
      _id: 'acc-discount',
      label: 'Discount Card',
      description: '5% off forever.',
      pointCost: 200,
      perkType: 'DISCOUNT_PCT',
      perkValue: 5,
      tierRequired: 'MOUNTAIN_GUIDE',
    },
    {
      _id: 'acc-early',
      label: 'Early Bird Pass',
      description: 'Shop early.',
      pointCost: 300,
      perkType: 'EARLY_ACCESS',
      perkValue: 0,
      tierRequired: 'MOUNTAIN_GUIDE',
    },
    {
      _id: 'acc-bonus',
      label: 'Lucky Charm',
      description: 'Double points.',
      pointCost: 500,
      perkType: 'BONUS_POINTS_DAY',
      perkValue: 0,
      tierRequired: 'SUMMIT_MASTER',
    },
  ];

  it('marks owned accessories as isUnlocked = true', () => {
    const items = buildAccessoryShopItems(accessories, ['acc-cosmetic'], 200, null);
    const cosmetic = items.find(i => i._id === 'acc-cosmetic');
    expect(cosmetic.isUnlocked).toBe(true);
    const discount = items.find(i => i._id === 'acc-discount');
    expect(discount.isUnlocked).toBe(false);
  });

  it('sets canAfford = false when memberPoints < pointCost', () => {
    const items = buildAccessoryShopItems(accessories, [], 100, null);
    const discount = items.find(i => i._id === 'acc-discount');
    expect(discount.canAfford).toBe(false);
    const cosmetic = items.find(i => i._id === 'acc-cosmetic');
    expect(cosmetic.canAfford).toBe(true);
  });

  it('sets isEquipped = true only for the currently equipped accessory', () => {
    const items = buildAccessoryShopItems(accessories, ['acc-cosmetic', 'acc-discount'], 500, 'acc-cosmetic');
    expect(items.find(i => i._id === 'acc-cosmetic').isEquipped).toBe(true);
    expect(items.find(i => i._id === 'acc-discount').isEquipped).toBe(false);
  });

  it('returns correct perkDescription for COSMETIC', () => {
    const items = buildAccessoryShopItems(accessories, [], 0, null);
    expect(items.find(i => i._id === 'acc-cosmetic').perkDescription).toBe('Cosmetic — visual only');
  });

  it('returns correct perkDescription for DISCOUNT_PCT', () => {
    const items = buildAccessoryShopItems(accessories, [], 0, null);
    expect(items.find(i => i._id === 'acc-discount').perkDescription).toBe('Always 5% off every order');
  });

  it('returns correct perkDescription for EARLY_ACCESS', () => {
    const items = buildAccessoryShopItems(accessories, [], 0, null);
    expect(items.find(i => i._id === 'acc-early').perkDescription).toBe('Shop new products 24h early');
  });

  it('returns correct perkDescription for BONUS_POINTS_DAY', () => {
    const items = buildAccessoryShopItems(accessories, [], 0, null);
    expect(items.find(i => i._id === 'acc-bonus').perkDescription)
      .toBe('2× points once per week (before streak multiplier, max 4× total)');
  });
});

// ── showUnlockCelebration ─────────────────────────────────────────────────────

describe('showUnlockCelebration', () => {
  it('shows unlock toast with accessory label for 4 seconds', async () => {
    vi.useFakeTimers();
    const $lottieContainer = { setAnimation: vi.fn(), show: vi.fn() };
    const $accessoryUnlockToast = { show: vi.fn(), hide: vi.fn(), text: vi.fn() };
    const accessory = { label: '🎩 Top Hat', perkType: 'COSMETIC' };

    showUnlockCelebration(
      { $lottieContainer, $accessoryUnlockToast },
      accessory,
      { useReducedMotion: false }
    );

    expect($accessoryUnlockToast.text).toHaveBeenCalledWith('🎉 🎩 Top Hat unlocked!');
    expect($accessoryUnlockToast.show).toHaveBeenCalled();

    vi.advanceTimersByTime(4000);
    expect($accessoryUnlockToast.hide).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('skips animation and goes straight to toast when useReducedMotion is true', () => {
    const $lottieContainer = { setAnimation: vi.fn(), show: vi.fn() };
    const $accessoryUnlockToast = { show: vi.fn(), hide: vi.fn(), text: vi.fn() };
    const accessory = { label: 'Bow Tie', perkType: 'COSMETIC' };

    showUnlockCelebration(
      { $lottieContainer, $accessoryUnlockToast },
      accessory,
      { useReducedMotion: true }
    );

    expect($lottieContainer.setAnimation).not.toHaveBeenCalled();
    expect($accessoryUnlockToast.show).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npx vitest run tests/AvatarDisplay.test.js
```

Expected: FAIL — "Cannot find module '../src/public/AvatarDisplay.js'"

- [ ] **Step 3: Implement `AvatarDisplay.js`**

Create `src/public/AvatarDisplay.js`:

```js
/**
 * @module AvatarDisplay
 * @description Pure frontend functions for the Chibi Futon Avatar display.
 * No side effects beyond DOM mutations passed in as $w() elements.
 * All functions are testable without a Wix environment.
 *
 * CF-phase6-avatar
 */

const DANCING_BEAR_ID = 'cute-bear-dancing-AfMGeP3e3h';
const IDLE_BEAR_ID    = 'waving-bear-3e2qFVfuGO';

const PERK_DESCRIPTIONS = {
  COSMETIC:         'Cosmetic — visual only',
  DISCOUNT_PCT:     (perkValue) => `Always ${perkValue}% off every order`,
  EARLY_ACCESS:     'Shop new products 24h early',
  BONUS_POINTS_DAY: '2× points once per week (before streak multiplier, max 4× total)',
};

/**
 * Initialise the avatar display. Call on page load or after state refresh.
 *
 * @param {Object} $lottieContainer - Wix $w element wrapping the Lottie box
 * @param {Object} $accessoryOverlay - Wix $w text element for accessory label
 * @param {Object} avatarState - Result of getAvatarState()
 * @param {{ useReducedMotion: boolean }} [opts]
 */
export function renderAvatar($lottieContainer, $accessoryOverlay, avatarState, opts = {}) {
  const { useReducedMotion = false } = opts;

  if (useReducedMotion) {
    $lottieContainer.hide();
  } else {
    $lottieContainer.show();
    // Lottie play is triggered by the page-level Lottie widget setup using
    // avatarState.lottieAnimationId — this function only controls show/hide.
  }

  if (avatarState.equippedAccessory) {
    $accessoryOverlay.text(avatarState.equippedAccessory.label);
    $accessoryOverlay.show();
  } else {
    $accessoryOverlay.hide();
  }
}

/**
 * Temporarily show unlock celebration animation + toast.
 * Called immediately after a successful purchaseAccessory response.
 *
 * @param {{ $lottieContainer: Object, $accessoryUnlockToast: Object }} $elements
 * @param {{ label: string, perkType: string }} accessory
 * @param {{ useReducedMotion: boolean }} [opts]
 */
export function showUnlockCelebration($elements, accessory, opts = {}) {
  const { $lottieContainer, $accessoryUnlockToast } = $elements;
  const { useReducedMotion = false } = opts;

  // Show toast immediately
  $accessoryUnlockToast.text(`🎉 ${accessory.label} unlocked!`);
  $accessoryUnlockToast.show();
  setTimeout(() => $accessoryUnlockToast.hide(), 4000);

  if (useReducedMotion) return;

  // Swap to dancing bear for 3s, then restore idle
  if ($lottieContainer.setAnimation) {
    $lottieContainer.setAnimation(DANCING_BEAR_ID);
    setTimeout(() => $lottieContainer.setAnimation(IDLE_BEAR_ID), 3000);
  }
}

/**
 * Build view-model array for the #accessoryShopList Repeater.
 * Pure function — no side effects, no wix-data calls.
 *
 * @param {Object[]} accessories - Active AvatarAccessories rows
 * @param {string[]} unlockedIds - Member's currently unlocked accessory IDs
 * @param {number} memberPoints - Member's current totalPoints
 * @param {string|null} equippedAccessoryId - Currently equipped accessory ID
 * @returns {Object[]}
 */
export function buildAccessoryShopItems(accessories, unlockedIds, memberPoints, equippedAccessoryId) {
  return accessories.map(acc => {
    const perkDescFn = PERK_DESCRIPTIONS[acc.perkType];
    const perkDescription = typeof perkDescFn === 'function'
      ? perkDescFn(acc.perkValue)
      : (perkDescFn || '');

    return {
      _id: acc._id,
      label: acc.label,
      description: acc.description,
      pointCost: acc.pointCost,
      perkType: acc.perkType,
      perkDescription,
      isUnlocked: unlockedIds.includes(acc._id),
      canAfford: memberPoints >= acc.pointCost,
      tierRequired: acc.tierRequired,
      isEquipped: acc._id === equippedAccessoryId,
    };
  });
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npx vitest run tests/AvatarDisplay.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Run full suite — no regressions**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/public/AvatarDisplay.js tests/AvatarDisplay.test.js
git commit -m "feat(avatar): AvatarDisplay.js — renderAvatar, buildAccessoryShopItems, showUnlockCelebration"
```

---

## Task 7: Manual Steps — Wix Dashboard + Editor Hookup + Documentation

These steps cannot be automated via code and must be performed manually by Stilgar (editor access) or the assigned crew member via the Wix Dashboard.

- [ ] **Step 1: Add `bonusPointsDayUsed` field to `MemberAvatar` collection in Wix Dashboard**

  - Open Wix Dashboard → CMS → `MemberAvatar` collection
  - Add field:
    - **Field name:** `bonusPointsDayUsed`
    - **Type:** Text
    - **Default:** (empty string — no default needed)
  - Confirm all other `MemberAvatar` fields are present: `memberId`, `unlockedAccessoryIds`, `equippedAccessoryId`, `photoUrl`

- [ ] **Step 2: Confirm `AvatarAccessories` collection schema**

  Verify the following fields exist in the `AvatarAccessories` collection (defined in parent spec, do not recreate):

  | Field | Type |
  |-------|------|
  | `label` | Text |
  | `description` | Text |
  | `pointCost` | Number |
  | `perkType` | Text |
  | `perkValue` | Number |
  | `tierRequired` | Text |
  | `active` | Boolean |
  | `seasonalUntil` | DateTime |

- [ ] **Step 3: Add editor elements inside `#loyaltySection` on Member Page**

  Use Wix Studio editor. All four elements must be added inside `#loyaltySection`:

  | Nickname | Type | Initial State | Notes |
  |----------|------|---------------|-------|
  | `#avatarLottieContainer` | Box | Visible | Hosts Lottie bear; use Stack layout to allow `#avatarAccessoryOverlay` to sit on top |
  | `#avatarAccessoryOverlay` | Text | Hidden | Positioned over or adjacent to bear box; shows equipped accessory label/emoji |
  | `#accessoryShopList` | Repeater | Visible | Accessory shop list |
  | `#accessoryUnlockToast` | Box | **Hidden** | Revealed on purchase success |

  Repeater item sub-elements (inside each `#accessoryShopList` item):

  | Nickname | Type | Notes |
  |----------|------|-------|
  | `#shopItemLabel` | Text | Accessory name |
  | `#shopItemCost` | Text | Point cost |
  | `#shopItemPerkDesc` | Text | Perk description |
  | `#shopItemStatus` | Text | "Owned", "Equipped", or empty |
  | `#shopItemBuyButton` | Button | "Unlock for N pts" |
  | `#shopItemEquipButton` | Button | "Equip" |

  After adding elements: run the bulk nickname rename script from `EDITOR_HOOKUP_GUIDE.html` How To section to assign all nicknames.

- [ ] **Step 4: Wire `Member Page.js`**

  Connect the avatar system to the Member Page. Add to `Member Page.js` (after existing loyalty section wiring):

  ```js
  import { getAvatarState, purchaseAccessory, equipAccessory } from 'backend/avatarService.web.js';
  import { renderAvatar, buildAccessoryShopItems, showUnlockCelebration } from 'public/AvatarDisplay.js';

  // Inside $w.onReady or the loyalty section init function:
  const avatarState = await getAvatarState(currentMemberId);
  renderAvatar($w('#avatarLottieContainer'), $w('#avatarAccessoryOverlay'), avatarState);

  // Populate shop repeater
  const shopItems = buildAccessoryShopItems(allActiveAccessories, avatarState.unlockedAccessoryIds, memberPoints, avatarState.equippedAccessoryId);
  $w('#accessoryShopList').data = shopItems;
  $w('#accessoryShopList').onItemReady(($item, itemData) => {
    $item('#shopItemLabel').text = itemData.label;
    $item('#shopItemCost').text = `${itemData.pointCost} pts`;
    $item('#shopItemPerkDesc').text = itemData.perkDescription;
    $item('#shopItemStatus').text = itemData.isEquipped ? 'Equipped' : itemData.isUnlocked ? 'Owned' : '';
    $item('#shopItemBuyButton').label = `Unlock for ${itemData.pointCost} pts`;
    $item('#shopItemBuyButton').disable = itemData.isUnlocked || !itemData.canAfford;
    $item('#shopItemEquipButton').show = itemData.isUnlocked && !itemData.isEquipped ? 'block' : 'none';

    $item('#shopItemBuyButton').onClick(async () => {
      const result = await purchaseAccessory(currentMemberId, itemData._id);
      if (result.success) {
        showUnlockCelebration(
          { $lottieContainer: $w('#avatarLottieContainer'), $accessoryUnlockToast: $w('#accessoryUnlockToast') },
          { label: itemData.label }
        );
        // Refresh shop and avatar after purchase
        // (re-call getAvatarState + buildAccessoryShopItems)
      }
    });

    $item('#shopItemEquipButton').onClick(async () => {
      await equipAccessory(currentMemberId, itemData._id);
      // Refresh avatar display after equip
    });
  });
  ```

- [ ] **Step 5: Update `EDITOR_HOOKUP_GUIDE.html` and `EDITOR-HOOKUP-GUIDE.md`**

  Add Phase 6 avatar element nicknames to both guide files:
  - `#avatarLottieContainer` — Box, `#loyaltySection`
  - `#avatarAccessoryOverlay` — Text, `#loyaltySection`
  - `#accessoryShopList` — Repeater, `#loyaltySection`
  - `#accessoryUnlockToast` — Box, `#loyaltySection` (hidden by default)
  - Repeater sub-elements: `#shopItemLabel`, `#shopItemCost`, `#shopItemPerkDesc`, `#shopItemStatus`, `#shopItemBuyButton`, `#shopItemEquipButton`

  Keep HTML and MD in sync.

---

## Definition of Done Checklist

- [ ] `GAMIFICATION_TIER_ORDER` exported from `gamificationTokens.js`
- [ ] `isBonusPointsDayAvailable()` exported from `gamificationTokens.js`, all edge cases tested
- [ ] `avatarService.web.js` created: `getAvatarState`, `purchaseAccessory`, `equipAccessory` — auth guard + rate limits
- [ ] `gamificationEventReceiver.web.js` extended: BONUS_POINTS_DAY multiplier, 4× cap, `bonusPointsDayUsed` written after award
- [ ] `AvatarDisplay.js` created: `renderAvatar`, `showUnlockCelebration`, `buildAccessoryShopItems`
- [ ] All tests passing (`npx vitest run`)
- [ ] `MemberAvatar.bonusPointsDayUsed` field added in Wix Dashboard
- [ ] `AvatarAccessories` collection schema confirmed
- [ ] Editor elements added and nicknames assigned: `#avatarLottieContainer`, `#avatarAccessoryOverlay`, `#accessoryShopList`, `#accessoryUnlockToast` + repeater sub-elements
- [ ] `Member Page.js` wired: avatar renders on load, shop populates, buy/equip handlers connected
- [ ] Reduced-motion fallback: static `🐻` shows when `useReducedMotion = true`; overlay still renders
- [ ] `EDITOR_HOOKUP_GUIDE.html` updated with Phase 6 element nicknames
- [ ] `EDITOR-HOOKUP-GUIDE.md` synced with HTML
- [ ] **Phase 6 uses Lottie bear placeholders. Custom chibi futon bear art deferred — accessory mechanics are art-agnostic.**
