# Phase 4 — Challenges / Missions Spec
**Date:** 2026-03-22
**Status:** Approved — autonomous crew consensus
**Parent spec:** `2026-03-22-gamification-system-design.md`
**Phase:** 4 of 7

---

## Overview

A CMS-driven Challenges system that rewards members for completing sequences of qualifying actions. Each challenge defines a condition type, a target count, and a reward. Members progress through challenges passively — every qualifying event increments their progress automatically. Completion awards points, optionally unlocks a badge, and emits a `gamification_challenge_completed` event for the Trigger Moments phase (Phase 5). Up to 5 active challenges are shown at a time in the UI.

This is the most complex gamification phase and builds entirely on the event pipeline proven in Phases 1–2. All progress logic runs server-side in `gamificationEventReceiver.web.js` — the client is display-only.

---

## Two New Event Types

Two new events are added to the receiver as part of this phase. They carry their own point awards and also participate in challenge progress tracking.

| Event | Points Awarded | Cap |
|---|---|---|
| `gamification_ar_used` | +10 pts | No daily cap |
| `gamification_wishlist_add` | +2 pts | Max 5/day per member |

Both events follow the existing point award + streak multiplier pattern from Phase 2. The `gamification_wishlist_add` daily cap is enforced server-side: query `WishlistAddLog` (see CMS section) for today's ET date and this member; if count >= 5, award 0 pts (but still process challenge progress).

> **Note on challenge progress vs. point caps:** The daily cap on `gamification_wishlist_add` applies only to point awards. Challenge progress increments regardless of the daily cap, subject only to the per-event idempotency check. This is intentional — a member can add more than 5 wishlist items and have those count toward a "add 10 to wishlist" challenge even after the point cap is reached.

---

## conditionType → Event Name Mapping

| conditionType | Receiver event name | Already in receiver? |
|---|---|---|
| `ORDER_COMPLETE` | `gamification_order_complete` | Yes (Phase 1) |
| `REVIEW_SUBMITTED` | `gamification_submit_review` | Yes (pre-existing) |
| `SPIN_COMPLETED` | `gamification_spin_completed` | Yes (Phase 1) |
| `AR_USED` | `gamification_ar_used` | **New — Phase 4** |
| `WISHLIST_ADD` | `gamification_wishlist_add` | **New — Phase 4** |

Every event processed by the receiver now also triggers the challenge progress logic (step added after the existing point award + streak update). No conditionType is treated as exclusive — a single event can match multiple active challenges simultaneously.

---

## CMS Schema Changes

### `Challenges` (new collection — static definitions, dashboard-editable)

Use the parent spec schema exactly. No deviations.

| Field | Type | Notes |
|---|---|---|
| `title` | Text | Display name e.g. `"First Steps"` |
| `description` | Text | Member-facing description |
| `conditionType` | Text | Enum: `ORDER_COMPLETE`, `REVIEW_SUBMITTED`, `SPIN_COMPLETED`, `AR_USED`, `WISHLIST_ADD` |
| `targetCount` | Number | How many qualifying events to complete the challenge |
| `rewardPoints` | Number | Points awarded on completion |
| `rewardBadgeId` | Text | Optional — badge slug to unlock on completion |
| `expiresAt` | DateTime | UTC. Manual expiry enforced in backend (not relied upon from CMS active flag alone) |
| `active` | Boolean | Toggle without deleting. Backend AND frontend filter on this |

**Index:** `conditionType` indexed — receiver queries challenges by conditionType on every event.

**Dashboard examples (seed data, not required at launch):**

| Title | conditionType | targetCount | rewardPoints | rewardBadgeId |
|---|---|---|---|---|
| First Steps | ORDER_COMPLETE | 1 | 50 | — |
| Trail Regular | ORDER_COMPLETE | 5 | 250 | `trail_regular` |
| Top Reviewer | REVIEW_SUBMITTED | 3 | 150 | `top_reviewer` |
| Spin Enthusiast | SPIN_COMPLETED | 7 | 100 | — |
| AR Explorer | AR_USED | 1 | 25 | `ar_explorer` |
| Wishlist Builder | WISHLIST_ADD | 10 | 30 | — |

### `MemberChallengeProgress` (new collection — live state per member per challenge)

Use the parent spec schema exactly. No deviations.

| Field | Type | Notes |
|---|---|---|
| `memberId` | Text | Indexed |
| `challengeId` | Text | Indexed |
| `progressValue` | Number | Current count toward `targetCount` |
| `completedAt` | DateTime | Null until challenge is complete |
| `eventIds` | Text | JSON array string — idempotency log. Max 1000 entries |
| `notifiedAt` | DateTime | Set when completion toast/notification is sent |

**Composite lookup:** Every progress read queries `memberId` AND `challengeId` together. Both fields indexed.

**`eventIds` management:** Parse on read (`JSON.parse(record.eventIds || '[]')`), push new `eventId`, stringify on write. If parsed array length >= 1000, trim the oldest 500 entries before pushing (sliding window — keeps the array bounded without losing recent idempotency coverage).

### `WishlistAddLog` (new collection — daily cap enforcement for `gamification_wishlist_add`)

| Field | Type | Notes |
|---|---|---|
| `memberId` | Text | Indexed |
| `logDate` | Text | ET date string e.g. `"2026-03-22"` |
| `count` | Number | How many wishlist adds today (incremented per event) |

**Write strategy:** Read record for `memberId` + `logDate`. If none, create with `count = 1`. If exists and `count < 5`, increment. If `count >= 5`, skip point award (but still process challenge progress). This is a separate wixData operation — non-critical path, does not block the point award.

> **Cleanup:** `WishlistAddLog` rows older than 30 days are safe to delete. No scheduled cleanup is implemented in Phase 4 — add a cron cleanup task in Phase 5 if row count becomes a concern.

---

## Backend — `gamificationEventReceiver.web.js` Extension

**Extend, do not replace.** The receiver already handles point awards and streak updates (Phases 1–2). Phase 4 adds two new event handlers and appends challenge progress logic after each event's existing point award cycle.

### New `webMethod`: `getActiveChallenges(memberId)`

Located in `gamificationEventReceiver.web.js`. New exported webMethod.

**Rate limit:** 10 calls/hr per member.

**Flow:**

1. Verify member auth
2. Check rate limit — return `429` if exceeded
3. Query `Challenges` where `active = true`
4. Filter client-side: exclude challenges where `expiresAt < now()` (belt-and-suspenders — backend enforces even if CMS `active` flag is stale)
5. Sort by `expiresAt` ASC (soonest-to-expire first — matches UI display order)
6. Slice to max 5 challenges
7. For each challenge, query `MemberChallengeProgress` for this `memberId` + `challengeId`
8. Return array of `{ challengeId, title, description, targetCount, rewardPoints, rewardBadgeId, expiresAt, progressValue, completedAt }` — merge challenge definition with member's progress record (default `progressValue = 0`, `completedAt = null` if no progress record exists yet)

**Response shape:**

```js
{
  challenges: [
    {
      challengeId: String,
      title: String,
      description: String,
      targetCount: Number,
      rewardPoints: Number,
      rewardBadgeId: String | null,
      expiresAt: String,       // ISO UTC string
      progressValue: Number,   // 0 if no record yet
      completedAt: String | null,
    }
  ]
}
```

### Extended `receiveGamificationEvent` Flow

Phase 4 adds step 9 and 10 to the existing flow. Steps 1–8 (point award + streak) are unchanged.

**Existing flow (steps 1–8, abbreviated):**
1. Verify member auth
2. Check rate limit
3. Resolve `basePoints` from event type
4. Read `MemberPoints`
5. Compute streak state (`updateStreakState`)
6. Apply multiplier: `adjustedPoints = Math.round(basePoints * streakMultiplier)`
7. Write `MemberPoints` (totalPoints + tier + streak fields) — **critical path write**
8. Return point award result

**Phase 4 additions (steps 9–10, non-critical path):**

9. **Daily cap check** (for `gamification_wishlist_add` only): read `WishlistAddLog` for `memberId` + `todayET`. If `count >= 5`, set `pointAwardSkipped = true` — point award in step 6 is 0. Write `WishlistAddLog` increment (separate wixData operation). For all other event types, skip this step.

10. **Challenge progress update** (all event types):
    a. Map incoming event name to `conditionType` (e.g. `gamification_ar_used` → `AR_USED`)
    b. Query `Challenges` where `conditionType` matches AND `active = true`
    c. Filter out challenges where `expiresAt < now()`
    d. For each matched challenge:
       - Query `MemberChallengeProgress` for `memberId` + `challengeId`
       - If no record: create with `{ memberId, challengeId, progressValue: 0, eventIds: '[]', completedAt: null, notifiedAt: null }`
       - Check idempotency: parse `eventIds` JSON array. If `eventId` is already present → skip this challenge (log debug, do not increment)
       - If `progressValue < challenge.targetCount`:
         - Increment `progressValue` by 1
         - Append `eventId` to `eventIds` array (trim to 500 if length >= 1000 before appending)
         - Write updated `MemberChallengeProgress`
       - If `progressValue` now equals `challenge.targetCount` (just completed):
         - Set `completedAt = now()`
         - Award `challenge.rewardPoints` — separate `MemberPoints` write (add to `totalPoints`, recalculate tier)
         - If `challenge.rewardBadgeId` is set: emit `gamification_badge_unlocked` (with de-dup guard — check badge not already in member's badge set)
         - Emit `gamification_challenge_completed` event (used by Phase 5 Trigger Moments)
         - Track in local `challengeProgress` results array: `{ challengeId, title, progressValue, targetCount, justCompleted: true }`
       - Else:
         - Track in results array: `{ challengeId, title, progressValue, targetCount, justCompleted: false }`
    e. Return `challengeProgress` array appended to existing event response

**Write order (non-atomic, intentional):**

| Order | Write | Criticality |
|---|---|---|
| 1 | `MemberPoints` (points + streak) | Critical — must succeed |
| 2 | `WishlistAddLog` (daily cap) | Non-critical |
| 3 | `MemberChallengeProgress` (progress) | Non-critical |
| 4 | `MemberPoints` (challenge completion bonus) | Non-critical — log if fails |

If writes 2–4 fail, the event response still returns the point award result from write 1. Challenge progress failure is logged and surfaced in the response as `{ challengeProgressError: true }` — not surfaced to the member as an error.

### New Event Handlers — `gamification_ar_used` and `gamification_wishlist_add`

Add two new cases to the receiver's event switch:

```js
case 'gamification_ar_used':
  basePoints = POINT_VALUES.AR_USED; // 10
  break;

case 'gamification_wishlist_add':
  basePoints = POINT_VALUES.WISHLIST_ADD; // 2 (subject to daily cap, enforced in step 9)
  break;
```

Both follow the identical flow as existing events: streak multiplier applied, `MemberPoints` written, then challenge progress appended.

Add constants to `gamificationTokens.js`:

```js
POINT_VALUES.AR_USED = 10;
POINT_VALUES.WISHLIST_ADD = 2;
```

### Idempotency Detail

The `eventId` used for challenge progress dedup is the same `eventId` already present on the incoming event payload. The existing receiver generates this per-event. No new ID scheme required.

Edge case: if `eventId` is missing from the incoming payload (malformed request), generate a fallback `eventId` as `${memberId}:${eventType}:${Date.now()}`. Log a warning. This fallback is not replay-safe — it only prevents null/undefined from being stored in `eventIds`.

---

## Frontend — `ChallengesDisplay.js` Module

New file: `src/public/ChallengesDisplay.js`

### New Editor Elements Required

All elements are added inside or adjacent to `#loyaltySection` in the editor.

| Nickname | Type | Purpose |
|---|---|---|
| `#challengesSection` | Box | Outer container for the challenges UI block |
| `#challengesList` | Repeater | Renders one card per active challenge |
| `#challengeCompletionToast` | Box (hidden by default) | Completion celebration — shown on `justCompleted: true` |

### Repeater Item Elements (inside `#challengesList`)

Each repeater item renders one challenge card. The following nicknames are used inside the repeater item template:

| Nickname | Type | Purpose |
|---|---|---|
| `#challengeTitle` | Text | Challenge title |
| `#challengeDescription` | Text | Challenge description |
| `#challengeProgressBar` | Progress Bar | Visual fill = `progressValue / targetCount` |
| `#challengeProgressLabel` | Text | e.g. `"2 / 5"` |
| `#challengeRewardLabel` | Text | e.g. `"+250 pts"` |
| `#challengeExpiresLabel` | Text | e.g. `"Expires Mar 28"` or hidden if no expiry near |
| `#challengeCompletedBadge` | Image or Box | Shown when `completedAt` is set; hidden otherwise |

### Responsibilities

- `initChallengesDisplay(memberId)` — called by `Member Page.js` on page load. Calls `getActiveChallenges(memberId)` webMethod, renders results into `#challengesList` repeater.
- `renderChallengeCard(item, challenge)` — populates repeater item fields from `challenge` data object.
- `updateChallengeProgress(challengeId, progressValue, targetCount, justCompleted)` — called when a point-earning event response includes `challengeProgress`. Updates the matching repeater item's progress bar and label without a full re-render.
- `showCompletionToast(challengeTitle, rewardPoints)` — unhides `#challengeCompletionToast`, populates title + points, shows for 4s then hides. Plays Bear Clapping Lottie animation.
- `useReducedMotion` — skip toast animation; show completion state instantly.

### Lottie Animations Used

| Moment | Animation | LottieFiles ID |
|---|---|---|
| Challenge completion toast | Bear Clapping | `bear-clapping-4hjv0nfIf9` |
| Challenge completion overlay (full-screen) | Success Confetti | `success-confetti-f5PdexvrBK` |

### Active Challenge Display Rules

- Max 5 challenges displayed (filtered and sorted by `getActiveChallenges` — frontend does not re-filter)
- Challenges already completed (`completedAt` set) shown with completed state (greyed progress bar, checkmark badge) for the current session, then hidden on next page load once `notifiedAt` is set
- Expired challenges (`expiresAt < now()`) never shown — filtered server-side in `getActiveChallenges`
- If no active challenges: `#challengesSection` is hidden

### Integration in `Member Page.js`

1. On page load: call `initChallengesDisplay(currentMemberId)`
2. On any point-earning event response that includes `challengeProgress`: call `updateChallengeProgress(...)` for each entry. If any entry has `justCompleted: true`, call `showCompletionToast(...)`

---

## Mobile Integration (dallas)

ChallengesRail and ChallengeCard components already exist on mobile (PR #237 merged). Mobile wires to the same `getActiveChallenges()` webMethod via the `useChallenges` hook.

**Web → Mobile contract:** The response shape defined in the `getActiveChallenges` section above is the agreed API. Dallas must not be blocked — the webMethod is the deliverable for Phase 4 mobile wiring. Any shape changes must be coordinated with dallas before merging.

**Cross-rig sync:** When `gamification_challenge_completed` emits, a Wix webhook fires → silent push notification → invalidates mobile `useChallenges` cache (same pattern as tier-up and badge-unlock from parent spec).

---

## Error Handling

| Scenario | Handling |
|---|---|
| `getActiveChallenges` rate limit exceeded | Return `429`, frontend hides challenges section gracefully |
| No active challenges in CMS | `getActiveChallenges` returns `{ challenges: [] }`, `#challengesSection` hidden |
| Expired challenge in CMS with `active = true` | Backend filters by `expiresAt < now()` — never reaches member |
| Challenge progress write fails | Log error, return `{ challengeProgressError: true }` in response — point award already succeeded |
| Duplicate `eventId` (replay) | Idempotency check skips increment — progress unchanged, no double-award |
| `eventIds` array reaches 1000 | Trim oldest 500 before appending — bounded memory, recent coverage preserved |
| `rewardBadgeId` already unlocked | Badge de-dup guard prevents double-award — log debug only |
| `gamification_badge_unlocked` emit fails | Challenge still marked complete, points still awarded — badge retry acceptable next session |
| Missing `eventId` on incoming payload | Fallback ID generated (`memberId:eventType:timestamp`) — logged as warning, not replay-safe |
| `WishlistAddLog` write fails | Daily cap not enforced for this event — points awarded, log warning |
| Wishlist add over daily cap (5/day) | Points = 0, but challenge progress still increments — member can still progress toward wishlist challenges |
| Mobile `useChallenges` cache stale | On-focus re-fetch via existing polling pattern — corrects within one focus event |

---

## Definition of Done

- [ ] `Challenges` CMS collection created in Wix Dashboard (schema exactly as defined above, `conditionType` indexed)
- [ ] `MemberChallengeProgress` CMS collection created in Wix Dashboard (`memberId` + `challengeId` both indexed)
- [ ] `WishlistAddLog` CMS collection created in Wix Dashboard (`memberId` indexed)
- [ ] `POINT_VALUES.AR_USED = 10` and `POINT_VALUES.WISHLIST_ADD = 2` added to `gamificationTokens.js`
- [ ] `gamification_ar_used` event handler added to `gamificationEventReceiver.web.js`
- [ ] `gamification_wishlist_add` event handler added to `gamificationEventReceiver.web.js` (with daily cap via `WishlistAddLog`)
- [ ] Challenge progress logic added to `receiveGamificationEvent` — runs on all event types after point award + streak update
- [ ] Idempotency check implemented: `eventIds` JSON array parse → dedup → push → stringify on every progress write
- [ ] `eventIds` bounded: trim oldest 500 when array reaches 1000 entries
- [ ] Missing `eventId` fallback implemented with warning log
- [ ] Challenge completion path: `completedAt` set, `rewardPoints` awarded, badge unlocked (with de-dup guard), `gamification_challenge_completed` emitted
- [ ] `getActiveChallenges(memberId)` webMethod implemented: auth + rate limit + active filter + expiry filter + sort by `expiresAt` ASC + slice to 5 + member progress merge
- [ ] `getActiveChallenges` response shape matches mobile contract (coordinate with dallas before merge)
- [ ] `ChallengesDisplay.js` frontend module complete: init, render repeater, progress update, completion toast
- [ ] `#challengesSection`, `#challengesList`, `#challengeCompletionToast` added to editor inside/adjacent to `#loyaltySection`
- [ ] Repeater item elements added with nicknames: `#challengeTitle`, `#challengeDescription`, `#challengeProgressBar`, `#challengeProgressLabel`, `#challengeRewardLabel`, `#challengeExpiresLabel`, `#challengeCompletedBadge`
- [ ] Bear Clapping + Success Confetti Lottie animations wired in completion toast
- [ ] Reduced-motion fallback implemented (instant completion state, no animation)
- [ ] `Member Page.js` integrated: `initChallengesDisplay` on page load, `updateChallengeProgress` + `showCompletionToast` on event response
- [ ] `#challengesSection` hidden when no active challenges
- [ ] Tests: `getActiveChallenges` returns only active non-expired challenges with member progress
- [ ] Tests: challenge progress increments on qualifying event
- [ ] Tests: idempotency — same `eventId` does NOT increment progress twice
- [ ] Tests: challenge completes at `targetCount` — awards points, sets `completedAt`, emits `gamification_challenge_completed`
- [ ] Tests: badge unlock on completion fires `gamification_badge_unlocked` with de-dup guard
- [ ] Tests: `gamification_ar_used` awards 10 pts (multiplier applied)
- [ ] Tests: `gamification_wishlist_add` awards 2 pts per add, 0 pts after 5/day, challenge progress continues past cap
- [ ] Tests: expired challenge (`expiresAt` in past) excluded from `getActiveChallenges` even if `active = true` in CMS
- [ ] Tests: `eventIds` trim — array of 1000 trimmed to 501 entries after push
- [ ] Tests: `challengeProgressError: true` returned when progress write fails, point award unaffected
- [ ] Tests: `getActiveChallenges` rate limit returns `429` after 10 calls/hr
- [ ] **EDITOR_HOOKUP_GUIDE.html updated** (new element nicknames: `#challengesSection`, `#challengesList`, `#challengeCompletionToast`, all repeater item elements; new CMS collections: `Challenges`, `MemberChallengeProgress`, `WishlistAddLog`)
- [ ] **EDITOR-HOOKUP-GUIDE.md updated** (sync with HTML)
