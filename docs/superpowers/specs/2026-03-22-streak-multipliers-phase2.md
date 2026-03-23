# Phase 2 — Streak Multipliers Spec
**Date:** 2026-03-22
**Status:** Approved by Stilgar
**Parent spec:** `2026-03-22-gamification-system-design.md`
**Phase:** 2 of 7

---

## Overview

A daily-streak system that multiplies points earned on all point-earning events. Members build streaks by performing any qualifying gamification action at least once per ET calendar day. Streaks multiply point awards — never spin prizes. Low-risk add-on shipped after Phase 1 spin wheel is live.

---

## Streak Definition

- **Qualifying activity:** Any event processed by `receiveGamificationEvent`: `gamification_add_to_cart`, `gamification_submit_review`, `gamification_referral_shared`, `gamification_order_complete`, `gamification_spin_completed`. For spin events, the spin itself is the qualifying action regardless of prize type — a member who spins and wins a non-points prize (`FREE_SHIP`, `DISCOUNT_PCT`, `SWATCH`) still counts as active that day. The multiplier is only applied to base point amounts; non-points prizes are unaffected.
- **Daily window:** ET calendar day (`America/New_York`). Same timezone logic as spin wheel.
- **Streak increment:** If `lastActivityDate` was yesterday's ET date → increment `currentStreakDays` by 1. If `lastActivityDate` was today's ET date → no change (already counted). If `lastActivityDate` was older than yesterday → reset to 1 (today starts a new streak).
- **Reset condition:** Lazy — evaluated on next qualifying event. No cron job required for reset.
- **Server authority:** Streak state is computed server-side only. Client display value may be stale; it corrects on next event.

---

## Multiplier Tiers

| Consecutive ET days | Multiplier |
|---|---|
| 1–2 | 1× (base — no bonus) |
| 3–6 | 1.5× |
| 7+ | 2× |

Multiplier stored in `MemberPoints.streakMultiplier`. Updated on every qualifying event after streak state is recalculated.

**Point calculation:** `awardedPoints = Math.round(basePoints * streakMultiplier)`

Examples at 2×: add_to_cart 5 pts → 10 pts; submit_review 50 pts → 100 pts; referral_shared 100 pts → 200 pts.

**Multiplier applies to:** base point awards only. Never to spin prize type (`FREE_SHIP`, `DISCOUNT_PCT`, `SWATCH`).

---

## Milestone: 7-Day Streak

Triggered exactly once when `currentStreakDays` crosses 7 (previous value was 6, today becomes 7).

- Award `POINT_VALUES.STREAK_7_DAY` (100 pts) — added to the same point-award write
- Unlock `week_wanderer` badge — emit `gamification_badge_unlocked` event through receiver pipeline
- Frontend: milestone toast — "🏔️ 7-day streak! +100 bonus pts + Week Wanderer badge unlocked"

No repeat milestone for day 7 within the same streak run (checks `currentStreakDays === 7` after increment). If streak breaks and member rebuilds to 7 days, milestone fires again — intentional.

**Badge de-duplication:** The `gamification_badge_unlocked` event handler must check whether `week_wanderer` is already in the member's badge set before adding it. This prevents double-award if the event replays. `getBadgesForAccount()` in `gamificationTokens.js` is superseded for `week_wanderer` by this milestone emission path — the `loginStreakDays` field used there is unrelated to `currentStreakDays`. See DoD item for required `gamificationTokens.js` updates.

---

## CMS Schema Changes

### `MemberPoints` — 4 new fields (Phase 2)

> **Note:** The parent spec `2026-03-22-gamification-system-design.md` lists `streakStartDate` and `lastActivityDate` as type **DateTime**. This spec supersedes that definition — implementers use **Text** (ET date string, e.g. `"2026-03-22"`) for both fields. The lazy-reset logic depends on string equality comparison (`===`), which requires Text fields. DateTime fields store timestamp objects and cannot be compared to date strings with `===`. The parent spec's table should be treated as a draft; this spec is authoritative for Phase 2 implementation.

| Field | Type | Notes |
|-------|------|-------|
| `currentStreakDays` | Number | Default 0. Incremented/reset on each qualifying event |
| `streakStartDate` | **Text** | ET date string of streak start e.g. `"2026-03-22"`. Set when streak resets |
| `lastActivityDate` | **Text** | ET date string of last qualifying event e.g. `"2026-03-22"`. Used for lazy reset check |
| `streakMultiplier` | Number | Default 1. One of: 1, 1.5, 2. Updated after streak recalc |

No new CMS collections. All streak state lives in `MemberPoints`.

---

## Backend — `gamificationEventReceiver.web.js` Extension

**Extend, do not replace.** Current flow: read record → compute delta → write updated points. Phase 2 extends this to compute streak state in the same read/write cycle.

> **Deliberate deviation from parent spec:** The parent spec describes "async streak updates" as a separate async operation. After crew technical review (2026-03-22), streak recalculation is deliberately synchronised into the same DB write as the point award. This eliminates partial-state risk (member earns points but streak is not updated, or vice versa), keeps the implementation to a single read + single write, and avoids a second network round trip. The "async" in the parent spec referred to the client-side UX concern: the member sees the point award result immediately, and the streak toast appears as a secondary UI update once the response is received — not blocking the primary UX. This is achieved by client-side sequencing, not server-side async.

### Extended Flow

1. Read `MemberPoints` record (existing step — now also reads streak fields)
2. Compute `basePoints` from event (existing `resolvePoints()`)
3. Compute new streak state: `updateStreakState(record, todayET)` → `{ currentStreakDays, streakStartDate, lastActivityDate, streakMultiplier, milestoneBonus }`
4. Apply multiplier: `adjustedPoints = Math.round(basePoints * streakMultiplier)`
5. Add `milestoneBonus` (100 pts if day-7 crossed, else 0)
6. Write single `MemberPoints` update: `{ totalPoints: newTotal + milestoneBonus, tier, currentStreakDays, streakStartDate, lastActivityDate, streakMultiplier }`
7. If `milestoneBonus > 0` and `week_wanderer` not already in member's badge set: emit `gamification_badge_unlocked`, award badge
8. Return: `{ success, newTotal, tierChanged, newTier, currentStreakDays, streakMultiplier, milestoneUnlocked }`

One DB read + one DB write — no extra round trips vs. current.

### `updateStreakState(record, todayET)` — Pure Helper

```
todayET = current ET date string e.g. "2026-03-22"
yesterdayET = date string for yesterday in ET

if record.lastActivityDate === todayET:
  → no change to streak (already active today)
  → milestoneBonus = 0
  → return existing streak fields unchanged (with milestoneBonus = 0)

if record.lastActivityDate === yesterdayET:
  → increment: currentStreakDays = record.currentStreakDays + 1
  → streakMultiplier = getStreakMultiplier(currentStreakDays)
  → milestoneBonus = (currentStreakDays === 7) ? POINT_VALUES.STREAK_7_DAY : 0

else (missed ≥1 day or no prior activity):
  → reset: currentStreakDays = 1, streakStartDate = todayET
  → streakMultiplier = 1
  → milestoneBonus = 0

lastActivityDate = todayET
return { currentStreakDays, streakStartDate, lastActivityDate, streakMultiplier, milestoneBonus }
```

**Note:** `milestoneBonus = 0` is explicitly set in ALL branches, including the same-day no-op path. This prevents undefined values from propagating to the point-award calculation in step 5.

### `getStreakMultiplier(days)` — Pure Function (in `gamificationTokens.js`)

```js
export const STREAK_MULTIPLIER_TIERS = [
  { minDays: 7, multiplier: 2 },
  { minDays: 3, multiplier: 1.5 },
  { minDays: 1, multiplier: 1 },
];

export function getStreakMultiplier(days) {
  for (const tier of STREAK_MULTIPLIER_TIERS) {
    if (days >= tier.minDays) return tier.multiplier;
  }
  return 1;
}
```

No division, no floating-point accumulation — simple threshold lookup.

### ET Date Helper — `dateUtils.js`

Extract shared ET date helpers into `src/backend/utils/dateUtils.js`. Both `spinWheel.web.js` and the streak logic import from here. `spinWheel.web.js` must be updated to remove its inline copy.

```js
// src/backend/utils/dateUtils.js
export function getTodayET() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).split('/').reverse().join('-'); // "YYYY-MM-DD"
}

export function getYesterdayET() {
  // Parse the ET calendar date and subtract 1 day using date component arithmetic.
  // DO NOT use Date.now() - 86400000 — a fixed millisecond offset does not account
  // for US DST transitions (spring-forward day is 23 hours, fall-back day is 25 hours).
  // Calendar-day subtraction via Date.UTC handles month and year boundaries correctly.
  const today = getTodayET(); // e.g. "2026-03-22"
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)); // day-1=0 → last day of prev month
  return [
    yesterday.getUTCFullYear(),
    String(yesterday.getUTCMonth() + 1).padStart(2, '0'),
    String(yesterday.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
```

---

## Frontend — `StreakDisplay.js` Module

New file: `src/public/StreakDisplay.js`

### New Editor Elements Required

Per radahn's audit (2026-03-22), these elements do NOT exist and must be added to the editor inside `#loyaltySection`:

| Nickname | Type | Purpose |
|---|---|---|
| `#streakCountChip` | Text | Displays "🔥 N-day streak" |
| `#streakMultiplierBadge` | Text or Box | Displays "1.5× points" or "2× points" |
| `#streakToastBox` | Box (hidden by default) | Streak update + milestone toast |

### Responsibilities

- `initStreakDisplay(data)` — called by `Member Page.js` with `{ currentStreakDays, streakMultiplier, milestoneUnlocked }` from webMethod response
- `renderStreakChip($streakCountChip, $streakMultiplierBadge, streakDays, multiplier)` — updates text, hides chip when streakDays < 1
- `showStreakToast($streakToastBox, { streakDays, multiplier, milestoneUnlocked })` — shows toast for 3s then hides; milestone variant shows 5s
- `useReducedMotion` — skip toast animation, just update chip instantly

### Integration in `Member Page.js`

On any point-earning event response, call `initStreakDisplay` with returned streak data. The streak chip is always visible in `#loyaltySection` when `currentStreakDays >= 1`. Toast fires only on streak increment or milestone.

---

## Existing Elements Used

From radahn's audit — these already exist and are wired:
- `#loyaltySection` — parent container, streak elements live here
- `#loyaltyPointsDisplay`, `#loyaltyTierDisplay`, `#loyaltyProgressBar` — unchanged, streak display is additive

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Streak state missing (new member) | `currentStreakDays = 0`, no multiplier, treated as first day |
| `lastActivityDate` malformed/null | Treat as missed — reset streak to 1 |
| Milestone bonus write fails | Points still awarded, badge not unlocked — log error, retry on next event is acceptable |
| ET date computation edge case | Same `Intl.DateTimeFormat` verified approach as spin wheel (tests cover midnight ET boundary) |
| Spin with non-points prize | Counts as streak activity (spin is qualifying action). No points to apply multiplier to — streak state updates, `basePoints = 0`, `adjustedPoints = 0` |

---

## Definition of Done

- [ ] `MemberPoints` collection updated with 4 new fields in Wix Dashboard (Text type for `streakStartDate` + `lastActivityDate`)
- [ ] `getStreakMultiplier()` + `STREAK_MULTIPLIER_TIERS` added to `gamificationTokens.js`
- [ ] `week_wanderer` badge `earnCondition` updated in `gamificationTokens.js` (from "login streak" to "activity streak")
- [ ] `getBadgesForAccount()` in `gamificationTokens.js` updated: `week_wanderer` earned via `currentStreakDays >= 7` (not `loginStreakDays`) — or documented as superseded by milestone emission path with de-dup guard
- [ ] `dateUtils.js` backend helper created (`getTodayET`, `getYesterdayET`)
- [ ] `spinWheel.web.js` updated to import ET date helpers from `dateUtils.js` (inline copy removed)
- [ ] `updateStreakState()` helper implemented and unit tested
- [ ] `gamificationEventReceiver.web.js` extended: reads streak fields, applies multiplier, writes unified update, emits badge on milestone with de-dup guard
- [ ] `StreakDisplay.js` frontend module complete
- [ ] `#streakCountChip`, `#streakMultiplierBadge`, `#streakToastBox` added to editor in `#loyaltySection`
- [ ] `Member Page.js` integrated: streak display updates on point-earning event response
- [ ] Reduced-motion fallback implemented
- [ ] Tests: `getStreakMultiplier()` boundaries, `updateStreakState()` all branches (same-day no-op with `milestoneBonus = 0`, increment, reset, day-7 milestone, non-points spin), multiplier applied correctly in receiver, ET midnight boundary, badge de-dup, `getYesterdayET()` on both US DST transition nights (spring-forward: March clock change; fall-back: November clock change)
- [ ] **EDITOR_HOOKUP_GUIDE.html updated** (3 new element nicknames: `#streakCountChip`, `#streakMultiplierBadge`, `#streakToastBox`)
- [ ] **EDITOR-HOOKUP-GUIDE.md updated** (sync with HTML)
