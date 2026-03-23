# Phase 5 — Trigger Moments Spec
**Date:** 2026-03-22
**Status:** Approved — autonomous crew consensus
**Parent spec:** `2026-03-22-gamification-system-design.md`
**Phase:** 5 of 7

---

## Overview

Trigger Moments is the polish layer of the gamification system. Phases 1–4 built the event pipeline, streak logic, and challenge engine — all of which already return completion signals in their response payloads. Phase 5 does two things:

1. **Enriches server responses** with a unified `triggers` object so every celebration-worthy moment is surfaced through one consistent shape, regardless of which phase generated it.
2. **Ships `TriggerMoments.js`** — a single frontend module that owns all animation and toast moments across the entire gamification system. Previously each feature module (StreakDisplay, ChallengesDisplay) handled its own toasts. Phase 5 centralises them, adds priority queuing, and adds new trigger types (tier-up, badge unlocked, streak danger) that no prior phase handled.

The result: one place to read for "what celebration is happening and why," consistent reduced-motion fallbacks, and a priority queue that prevents simultaneous triggers from stacking animations.

**No new CMS collections required.** All data needed for trigger evaluation already exists in `MemberPoints` and `MemberChallengeProgress`.

---

## Trigger Moments Table

| Trigger | Animation | Duration | Condition |
|---|---|---|---|
| Tier-up | Lottie `cute-bear-dancing-AfMGeP3e3h` (inline `#triggerLottieContainer`) + Lottie `confetti-on-transparent-background-ajhx1TPBa7` (full-screen `#confettiOverlay`) | 5s | `triggers.tierChanged = true` |
| 7-day streak milestone | Lottie `success-confetti-f5PdexvrBK` (inline `#triggerLottieContainer`) | 4s | `triggers.milestoneUnlocked = true` |
| Badge unlocked | Lottie `success-confetti-f5PdexvrBK` pulse (inline) + toast with badge name | 3s | `triggers.badgeUnlocked != null` |
| Challenge completed | Lottie `bear-clapping-4hjv0nfIf9` (inline `#triggerLottieContainer`) + points toast | 4s | `triggers.challengeCompleted.length > 0` |
| Streak danger warning | Amber toast — "Your streak resets in < 4h — earn points to keep it!" | 6s (no animation) | `triggers.streakDanger = true` AND sessionStorage gate |
| First purchase (ever) | Tier-up animation + "Welcome to the Trail! 🏔️" toast | 5s | First `gamification_order_complete` where `totalPoints` was 0 before award |

### Priority Queue

When multiple triggers fire on a single event response, only the highest-priority trigger plays immediately. Lower-priority triggers are pushed to a queue and dequeued at 500ms intervals after the current animation ends.

Priority order (highest first):

1. Tier-up
2. Challenge completed
3. Badge unlocked
4. Streak milestone
5. Streak danger

**Example:** A purchase simultaneously triggers tier-up and badge unlocked. Tier-up animation plays first (5s). After tier-up ends + 500ms gap, badge toast plays (3s).

---

## Backend Extension — `receiveGamificationEvent` Return Shape

### Current Return Shape (after Phase 2 + Phase 4)

```js
{
  success: boolean,
  newTotal: number,
  tierChanged: boolean,       // Phase 2 top-level field
  newTier: string | null,     // Phase 2 top-level field
  currentStreakDays: number,
  streakMultiplier: number,
  milestoneUnlocked: boolean, // Phase 2 top-level field
  challengeProgress: [        // Phase 4 addition
    { challengeId, title, progressValue, targetCount, justCompleted: boolean }
  ],
}
```

### Phase 5 Extended Return Shape

Phase 5 adds a `triggers` object. Existing top-level fields (`tierChanged`, `newTier`, `milestoneUnlocked`) are **preserved at the top level for backwards compatibility** and also duplicated inside `triggers`.

```js
{
  success: boolean,
  newTotal: number,
  tierChanged: boolean,        // kept — backwards compat
  newTier: string | null,      // kept — backwards compat
  currentStreakDays: number,
  streakMultiplier: number,
  milestoneUnlocked: boolean,  // kept — backwards compat
  challengeProgress: [...],    // kept — unchanged
  triggers: {
    tierChanged: boolean,             // mirrors top-level tierChanged
    newTier: string | null,           // mirrors top-level newTier
    milestoneUnlocked: boolean,       // mirrors top-level milestoneUnlocked
    badgeUnlocked: string | null,     // badge slug if a badge was just awarded, else null
    challengeCompleted: [             // subset of challengeProgress where justCompleted = true
      { challengeId: string, title: string, rewardPoints: number }
    ],
    streakDanger: boolean,            // see streakDanger logic below
  }
}
```

`triggers` is always present in the response — never null or absent. All boolean fields default `false`; array fields default `[]`; nullable fields default `null`.

### `badgeUnlocked` Population

The receiver already emits `gamification_badge_unlocked` when Phase 2 day-7 milestone fires or when a Phase 4 challenge completion awards a badge. Phase 5 adds badge slug capture to those paths:

- Phase 2 milestone path: if `milestoneBonus > 0` and `week_wanderer` badge was written, set `triggers.badgeUnlocked = 'week_wanderer'`.
- Phase 4 challenge completion path: if `challenge.rewardBadgeId` is set and badge was written, set `triggers.badgeUnlocked = challenge.rewardBadgeId`.

If multiple badges unlock in a single event (edge case: challenge + milestone on same event), `triggers.badgeUnlocked` holds the last badge slug written. Badge queue display is handled client-side via the priority queue.

### `challengeCompleted` Population

Phase 4 already builds a `challengeProgress` array. Phase 5 derives `triggers.challengeCompleted` server-side by filtering that array:

```js
triggers.challengeCompleted = challengeProgress
  .filter(c => c.justCompleted)
  .map(c => ({ challengeId: c.challengeId, title: c.title, rewardPoints: c.rewardPoints }));
```

`rewardPoints` must be added to the existing `challengeProgress` item shape (currently `{ challengeId, title, progressValue, targetCount, justCompleted }`). Add `rewardPoints: challenge.rewardPoints` when building each item in Phase 4's step 10.

### `streakDanger` Logic

Computed server-side on every `receiveGamificationEvent` call.

```
todayET = getTodayET()  // from dateUtils.js (Phase 2)
nowUTC = Date.now()
midnightETTomorrow = next ET midnight timestamp (see helper below)
secondsUntilETMidnight = (midnightETTomorrow - nowUTC) / 1000

streakDanger = (secondsUntilETMidnight < 14400)           // < 4 hours to ET midnight
               AND (record.lastActivityDate !== todayET)   // member not yet active today
```

**`getNextETMidnightUTC()` helper** — add to `src/backend/utils/dateUtils.js`:

```js
export function getNextETMidnightUTC() {
  // Build the next ET midnight as a UTC timestamp.
  // Uses Intl to find today's ET date, then constructs midnight in ET offset.
  // Handles DST: ET offset is -5h (EST) or -4h (EDT).
  const nowET = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const parts = Object.fromEntries(nowET.map(p => [p.type, p.value]));
  const y = Number(parts.year);
  const m = Number(parts.month) - 1;
  const d = Number(parts.day);

  // Construct "tomorrow at 00:00:00 ET" by adding 1 day then finding UTC equivalent.
  // We create a Date from the ET noon of tomorrow (12:00 is safely inside the day,
  // avoiding any DST transition ambiguity at midnight itself), then subtract 12h.
  const tomorrowNoonET = new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
      .format(new Date(Date.UTC(y, m, d + 1, 12, 0, 0))) + 'T12:00:00'
  );
  // Fallback: use a fixed-offset approximation if Intl construction fails.
  // This is a belt-and-suspenders path only.
  const etOffsetMs = (() => {
    const utcNoon = Date.UTC(y, m, d + 1, 12, 0, 0);
    const etDate = new Date(utcNoon);
    const etStr = etDate.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
    const [datePart, timePart] = etStr.split(', ');
    const [etH] = timePart.split(':').map(Number);
    return (12 - etH) * 3600 * 1000; // offset between UTC noon and ET noon
  })();
  return Date.UTC(y, m, d + 1, 0, 0, 0) + etOffsetMs;
}
```

> **Simpler implementation acceptable:** The helper above demonstrates correctness. Implementers may use a simpler approach — e.g. get today's ET date string, parse it, add 1 day, and back-calculate UTC midnight — as long as DST transitions are handled correctly. Tests cover spring-forward (March) and fall-back (November) boundary cases.

`streakDanger` is `false` when `secondsUntilETMidnight >= 14400` OR when `record.lastActivityDate === todayET`. It is always `false` for a brand-new member with no `lastActivityDate`.

---

## Frontend — `TriggerMoments.js` Module

New file: `src/public/TriggerMoments.js`

### Module Responsibilities

`TriggerMoments.js` is the single owner of all celebration animations and toasts in the gamification system. It does NOT replace `StreakDisplay.js` or `ChallengesDisplay.js` for their informational UI (streak chip, progress bars) — it only owns the celebratory overlay moments.

**Migration note for Phase 2 and Phase 4:** `StreakDisplay.showStreakToast` and `ChallengesDisplay.showCompletionToast` continue to exist but are called by `TriggerMoments` rather than directly from `Member Page.js`. The toast display logic remains in each module; `TriggerMoments` becomes the orchestrator.

### Public API

```js
// src/public/TriggerMoments.js

/**
 * Entry point. Call after any receiveGamificationEvent response.
 * Evaluates trigger flags, queues moments in priority order,
 * and begins playing the queue.
 *
 * @param {object} triggers - The `triggers` object from the event response
 * @param {object} $elements - Wix $w element references (see Editor Elements section)
 */
export function processTriggers(triggers, $elements) { ... }

/**
 * Plays dancing bear + confetti overlay for tier-up.
 * @param {object} $elements
 * @param {string} newTier - Display name of new tier
 */
export function showTierUp($elements, newTier) { ... }

/**
 * Plays clapping bear + points toast for one or more completed challenges.
 * @param {object} $elements
 * @param {Array<{challengeId, title, rewardPoints}>} challenges
 */
export function showChallengeCompleted($elements, challenges) { ... }

/**
 * Shows badge name + confetti pulse toast.
 * @param {object} $elements
 * @param {string} badgeId - Badge slug
 */
export function showBadgeUnlocked($elements, badgeId) { ... }

/**
 * Delegates to StreakDisplay.showStreakToast for the milestone moment.
 * @param {object} $elements
 */
export function showStreakMilestone($elements) { ... }

/**
 * Shows amber "streak danger" toast. Checks sessionStorage gate — no-ops
 * if already shown today (ET).
 * @param {object} $elements
 */
export function showStreakDanger($elements) { ... }
```

### `processTriggers` — Priority Queue Algorithm

```
PRIORITY_ORDER = [
  { key: 'tierChanged',         fn: () => showTierUp($elements, triggers.newTier) },
  { key: 'challengeCompleted',  fn: () => showChallengeCompleted($elements, triggers.challengeCompleted),
                                 test: () => triggers.challengeCompleted.length > 0 },
  { key: 'badgeUnlocked',       fn: () => showBadgeUnlocked($elements, triggers.badgeUnlocked),
                                 test: () => triggers.badgeUnlocked != null },
  { key: 'milestoneUnlocked',   fn: () => showStreakMilestone($elements) },
  { key: 'streakDanger',        fn: () => showStreakDanger($elements) },
]

queue = []
for each entry in PRIORITY_ORDER:
  if entry.test ? entry.test() : triggers[entry.key] === true:
    queue.push(entry.fn)

if queue.length === 0: return

playQueue(queue)  // plays first item, then schedules next after animationDuration + 500ms gap
```

### `showTierUp` Detail

1. If `useReducedMotion`: skip Lottie, show `#tierUpToast` with text "You reached [newTier]!" for 5s, hide.
2. Otherwise:
   - Set `#tierUpToast` text to "You reached [newTier]!"
   - Show `#tierUpToast`
   - Play `cute-bear-dancing-AfMGeP3e3h` Lottie in `#triggerLottieContainer` (show container)
   - Show `#confettiOverlay`, play `confetti-on-transparent-background-ajhx1TPBa7` Lottie
   - After 5s: hide `#tierUpToast`, `#triggerLottieContainer`, `#confettiOverlay`

### `showChallengeCompleted` Detail

1. If multiple challenges completed simultaneously, display title of first; append "+N more" if count > 1.
2. If `useReducedMotion`: show `#tierUpToast` (reused for text) with challenge title + reward points text. 4s then hide.
3. Otherwise:
   - Play `bear-clapping-4hjv0nfIf9` in `#triggerLottieContainer`
   - Show `#tierUpToast` with "[Challenge Title] complete! +[N] pts"
   - After 4s: hide both

> **Note:** `#challengeCompletionToast` from Phase 4's `ChallengesDisplay.js` is superseded by this path for the celebratory moment. `ChallengesDisplay.showCompletionToast` should be updated to delegate to `TriggerMoments.showChallengeCompleted` — or simply removed if `TriggerMoments` is wired directly from `Member Page.js`.

### `showBadgeUnlocked` Detail

Badge display name is resolved from `badgeId` using a local mapping. Add `BADGE_DISPLAY_NAMES` to `gamificationTokens.js`:

```js
export const BADGE_DISPLAY_NAMES = {
  week_wanderer: 'Week Wanderer',
  trail_regular: 'Trail Regular',
  top_reviewer: 'Top Reviewer',
  ar_explorer: 'AR Explorer',
  // extend as badges are added
};
```

1. Look up `BADGE_DISPLAY_NAMES[badgeId]`. If not found, use `badgeId` as fallback display string.
2. If `useReducedMotion`: show `#tierUpToast` with "Badge unlocked: [Badge Name]" for 3s.
3. Otherwise:
   - Play `success-confetti-f5PdexvrBK` in `#triggerLottieContainer` (brief pulse — stop at first loop end)
   - Show `#tierUpToast` with "Badge unlocked: [Badge Name]"
   - After 3s: hide both

### `showStreakMilestone` Detail

Delegates to `StreakDisplay.showStreakToast($streakToastBox, { milestoneUnlocked: true })`. `TriggerMoments` calls this rather than `Member Page.js` calling it directly. No new animation elements used — `#streakToastBox` from Phase 2 is the display target.

### `showStreakDanger` Detail

**sessionStorage gate key:** `cf_streak_danger_shown_<ET_date_string>`

Example: `cf_streak_danger_shown_2026-03-22`

```
todayKey = 'cf_streak_danger_shown_' + getTodayETClient()
if sessionStorage.getItem(todayKey): return  // already shown today
sessionStorage.setItem(todayKey, '1')
```

`getTodayETClient()` — a client-side ET date helper (pure JS, same Intl approach as server):

```js
function getTodayETClient() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
    .format(new Date()); // returns "YYYY-MM-DD" directly in en-CA locale
}
```

No animation. Show `#tierUpToast` styled amber (add CSS class `trigger-toast--warning`) with text "Your streak resets in < 4h — earn points to keep it!" for 6s then hide.

### `useReducedMotion` Check

```js
function useReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

Every public function in `TriggerMoments.js` calls `useReducedMotion()` at invocation time — not cached at module load — so a user who changes their OS accessibility setting mid-session gets correct behaviour on the next trigger.

### `playQueue` Helper (internal)

```js
function playQueue(queue) {
  if (queue.length === 0) return;
  const [head, ...rest] = queue;
  head(); // play first moment
  // next moment fires after animation duration + 500ms gap
  // duration is encoded per-moment; use a post-play callback or fixed delay
  // Implementation note: simplest approach is a fixed 5500ms max-gap between moments.
  // Each show* function handles its own hide timing internally.
  setTimeout(() => playQueue(rest), 5500); // 5s max animation + 500ms gap
}
```

---

## Editor Elements (New — Phase 5)

All three elements are added inside `#loyaltySection`. They are hidden by default and managed exclusively by `TriggerMoments.js`.

| Nickname | Type | Purpose |
|---|---|---|
| `#tierUpToast` | Box | Text toast for tier-up, badge unlocked, challenge completed, streak danger. Reused across moment types via class swap. Hidden by default. |
| `#triggerLottieContainer` | Box | Hosts inline Lottie bear animations (dancing bear, clapping bear, success confetti). Hidden by default. |
| `#confettiOverlay` | Box | Full-screen overlay for tier-up confetti. Positioned absolute, full viewport, z-index above all content. Hidden by default. |

### `#tierUpToast` CSS Classes

`#tierUpToast` uses a base style with variant classes applied dynamically:

| Class | Visual | Used for |
|---|---|---|
| `trigger-toast--default` | Mountain purple background, white text | Tier-up, milestone, badge unlocked, challenge completed |
| `trigger-toast--warning` | Amber `#F59E0B` background, dark text | Streak danger |

Wix custom CSS classes — add to `global.css` or the page's CSS section.

---

## Integration in `Member Page.js`

Phase 5 adds one new call site in `Member Page.js`. All existing direct calls to `StreakDisplay.showStreakToast` and `ChallengesDisplay.showCompletionToast` for celebration moments are replaced by `TriggerMoments.processTriggers`.

### Wiring

```js
import { processTriggers } from 'public/TriggerMoments';

// On any receiveGamificationEvent response:
const result = await receiveGamificationEvent({ eventType, memberId, eventId });
if (result.triggers) {
  processTriggers(result.triggers, {
    $tierUpToast:           $w('#tierUpToast'),
    $triggerLottieContainer: $w('#triggerLottieContainer'),
    $confettiOverlay:       $w('#confettiOverlay'),
    $streakToastBox:        $w('#streakToastBox'),      // Phase 2 element — passed through
  });
}
// Informational UI updates (streak chip, progress bars) continue as before
```

The `$elements` object passed to `TriggerMoments` carries only the display elements. No business logic passes through it.

---

## `gamificationTokens.js` Changes

Two additions required:

1. **`BADGE_DISPLAY_NAMES`** — new export (see `showBadgeUnlocked` detail above).
2. **`rewardPoints` on `challengeProgress` items** — the Phase 4 challenge progress builder must include `rewardPoints: challenge.rewardPoints` on each item in the array so `triggers.challengeCompleted` can surface it to the client.

No new point value constants are needed for Phase 5.

---

## Backend Changes Summary

All changes are in `src/backend/gamificationEventReceiver.web.js` and `src/backend/utils/dateUtils.js`.

| File | Change |
|---|---|
| `gamificationEventReceiver.web.js` | Extend `receiveGamificationEvent` return shape: add `triggers` object. Populate `triggers.tierChanged`, `triggers.newTier`, `triggers.milestoneUnlocked` (from existing Phase 2 values). Populate `triggers.badgeUnlocked` when badge is written. Populate `triggers.challengeCompleted` from filtered `challengeProgress`. Compute `triggers.streakDanger` using `getNextETMidnightUTC()`. |
| `dateUtils.js` | Add `getNextETMidnightUTC()` helper. |

**No new webMethods.** `triggers` is returned as part of the existing `receiveGamificationEvent` response.

---

## Error Handling

| Scenario | Handling |
|---|---|
| `triggers` absent from response (old cached code calling receiver) | `processTriggers` checks `if (!triggers) return` — no crash |
| `BADGE_DISPLAY_NAMES[badgeId]` not found | Use `badgeId` string as fallback — always shows something |
| `getNextETMidnightUTC()` throws | `streakDanger` defaults to `false` — catch the error, log it, return `false`. Never block the point award response. |
| `sessionStorage` unavailable (private browsing restriction) | Wrap in try/catch — streak danger toast shows on every event if storage unavailable (acceptable degradation; not a frequent path) |
| `useReducedMotion()` returns true | Every animation skipped — text-only toast for all moments |
| Multiple challenges complete simultaneously | `showChallengeCompleted` receives the full array; displays first challenge title + "+N more" count |
| Lottie element not found in DOM | Wrap Lottie play calls in existence check — toast still shows without animation |
| `#confettiOverlay` not found | Skip confetti step — tier-up toast still shows |
| Queue interrupted by page navigation | Queue is in-memory only — no cleanup needed, GC handles it |

---

## Tests Required

All tests in `src/backend/__tests__/gamificationEventReceiver.test.js` and `src/public/__tests__/TriggerMoments.test.js`.

### Backend Tests

| Test | File |
|---|---|
| `streakDanger = true` when `secondsUntilETMidnight < 14400` AND `lastActivityDate !== todayET` | `gamificationEventReceiver.test.js` |
| `streakDanger = false` when `lastActivityDate === todayET` (already active) | `gamificationEventReceiver.test.js` |
| `streakDanger = false` when `secondsUntilETMidnight >= 14400` (> 4h to midnight) | `gamificationEventReceiver.test.js` |
| `streakDanger = false` for new member with no `lastActivityDate` | `gamificationEventReceiver.test.js` |
| `triggers.tierChanged` mirrors top-level `tierChanged` | `gamificationEventReceiver.test.js` |
| `triggers.badgeUnlocked` = `'week_wanderer'` on Phase 2 day-7 milestone | `gamificationEventReceiver.test.js` |
| `triggers.badgeUnlocked` = badge slug on Phase 4 challenge completion with `rewardBadgeId` | `gamificationEventReceiver.test.js` |
| `triggers.challengeCompleted` is subset of `challengeProgress` where `justCompleted = true` | `gamificationEventReceiver.test.js` |
| `triggers.challengeCompleted` includes `rewardPoints` field | `gamificationEventReceiver.test.js` |
| `triggers` object present with all fields when no triggers fire (all false/null/empty) | `gamificationEventReceiver.test.js` |
| `getNextETMidnightUTC()` returns correct UTC timestamp on spring-forward night (March DST) | `dateUtils.test.js` |
| `getNextETMidnightUTC()` returns correct UTC timestamp on fall-back night (November DST) | `dateUtils.test.js` |
| `getNextETMidnightUTC()` throw path returns `false` for `streakDanger` — point award unaffected | `gamificationEventReceiver.test.js` |

### Frontend Tests (`TriggerMoments.test.js`)

| Test |
|---|
| `processTriggers` queues moments in correct priority order (tier-up first, then challenge, then badge, etc.) |
| Multiple simultaneous triggers: tier-up + badge → tier-up queued first, badge queued second |
| Multiple simultaneous triggers: challenge + streak milestone → challenge first, milestone second |
| Single trigger (tier-up only): queue has exactly one item |
| No triggers (all false/null/empty): `processTriggers` returns without queuing anything |
| Reduced motion: `showTierUp` does not call Lottie play, shows text toast only |
| Reduced motion: `showChallengeCompleted` does not call Lottie play, shows text toast only |
| Reduced motion: `showBadgeUnlocked` does not call Lottie play, shows text toast only |
| sessionStorage gate: `showStreakDanger` called twice same ET day — toast shown only once |
| sessionStorage gate: `showStreakDanger` called on different ET days — toast shown each day |
| `showBadgeUnlocked` with unknown `badgeId` — falls back to raw slug string in toast |
| `processTriggers` with `triggers = undefined` — no throw, silent return |
| `showChallengeCompleted` with 3 simultaneous completions — toast shows first title + "+2 more" |

---

## Definition of Done

- [ ] `getNextETMidnightUTC()` helper added to `src/backend/utils/dateUtils.js`
- [ ] `receiveGamificationEvent` extended: `triggers` object computed and returned on every response
- [ ] `triggers.streakDanger` computed using `getNextETMidnightUTC()` with catch guard (defaults `false` on error)
- [ ] `triggers.badgeUnlocked` populated in Phase 2 milestone path and Phase 4 challenge completion path
- [ ] `triggers.challengeCompleted` includes `rewardPoints` field (requires Phase 4 `challengeProgress` builder update)
- [ ] All top-level `tierChanged`, `newTier`, `milestoneUnlocked` fields preserved at top level (backwards compat)
- [ ] `BADGE_DISPLAY_NAMES` exported from `gamificationTokens.js`
- [ ] `TriggerMoments.js` implemented: `processTriggers`, `showTierUp`, `showChallengeCompleted`, `showBadgeUnlocked`, `showStreakMilestone`, `showStreakDanger`, `playQueue`
- [ ] `useReducedMotion()` check in every public function — skip Lottie, show text toast only
- [ ] `sessionStorage` gate in `showStreakDanger` with try/catch for unavailable storage
- [ ] `getTodayETClient()` helper implemented in `TriggerMoments.js` (client-side ET date string)
- [ ] `#tierUpToast`, `#triggerLottieContainer`, `#confettiOverlay` added to editor inside `#loyaltySection`
- [ ] `trigger-toast--default` and `trigger-toast--warning` CSS classes added to `global.css`
- [ ] `Member Page.js` updated: all celebration moment calls replaced by `processTriggers(result.triggers, $elements)`
- [ ] `ChallengesDisplay.showCompletionToast` delegation to `TriggerMoments` implemented (or call path removed from `Member Page.js` in favour of `processTriggers`)
- [ ] All Lottie calls guarded by element existence check — toast still shows if Lottie container missing
- [ ] Backend tests: all `streakDanger` branches (< 4h + not active, < 4h + active, > 4h, new member)
- [ ] Backend tests: `triggers` object present on all response paths
- [ ] Backend tests: DST boundary coverage for `getNextETMidnightUTC()` (spring-forward + fall-back)
- [ ] Frontend tests: priority queue ordering, all reduced-motion paths, sessionStorage gate, unknown badge slug fallback
- [ ] **EDITOR_HOOKUP_GUIDE.html updated** (3 new element nicknames: `#tierUpToast`, `#triggerLottieContainer`, `#confettiOverlay`)
- [ ] **EDITOR-HOOKUP-GUIDE.md updated** (sync with HTML)
