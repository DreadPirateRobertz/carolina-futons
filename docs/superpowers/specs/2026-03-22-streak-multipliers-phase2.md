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

- **Qualifying activity:** Any event processed by `receiveGamificationEvent` that awards points: `gamification_add_to_cart`, `gamification_submit_review`, `gamification_referral_shared`, `gamification_order_complete`, `gamification_spin_completed`.
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

**Multiplier applies to:** base point awards only. Never to spin prize type (`FREE_SHIP`, `DISCOUNT_PCT`, `SWATCH`). Never to spin point prize directly — the `spinWheel()` webMethod calls `receiveGamificationEvent` for point prizes, so multiplier is applied there via the normal flow.

---

## Milestone: 7-Day Streak

Triggered exactly once when `currentStreakDays` crosses 7 (previous day was 6, today becomes 7).

- Award `POINT_VALUES.STREAK_7_DAY` (100 pts) — added to the same point-award write
- Unlock `week_wanderer` badge — emit `gamification_badge_unlocked` event through receiver pipeline
- Frontend: milestone toast — "🏔️ 7-day streak! +100 bonus pts + Week Wanderer badge unlocked"

No repeat milestone for day 7 if streak breaks and resets — only on first crossing per streak run. (If streak breaks and member rebuilds to 7, milestone fires again — intentional.)

---

## CMS Schema Changes

### `MemberPoints` — 4 new fields (Phase 2)

| Field | Type | Notes |
|-------|------|-------|
| `currentStreakDays` | Number | Default 0. Incremented/reset on each qualifying event |
| `streakStartDate` | Text | ET date string of streak start. Set when streak resets |
| `lastActivityDate` | Text | ET date string of last qualifying event. Used for lazy reset check |
| `streakMultiplier` | Number | Default 1. One of: 1, 1.5, 2. Updated after streak recalc |

No new CMS collections. All streak state lives in `MemberPoints`.

---

## Backend — `gamificationEventReceiver.web.js` Extension

**Extend, do not replace.** Current flow: read record → compute delta → write updated points. Phase 2 extends this to compute streak state in the same read/write cycle.

### Extended Flow

1. Read `MemberPoints` record (existing step — now also reads streak fields)
2. Compute `basePoints` from event (existing `resolvePoints()`)
3. Compute new streak state: `updateStreakState(record, todayET)` → `{ currentStreakDays, streakStartDate, lastActivityDate, streakMultiplier, milestoneBonus }`
4. Apply multiplier: `adjustedPoints = Math.round(basePoints * streakMultiplier)`
5. Add `milestoneBonus` (100 pts if day-7 crossed, else 0)
6. Write single `MemberPoints` update: `{ totalPoints: newTotal + milestoneBonus, tier, currentStreakDays, streakStartDate, lastActivityDate, streakMultiplier }`
7. If `milestoneBonus > 0`: emit `gamification_badge_unlocked` event, add `week_wanderer` to member's badge set
8. Return: `{ success, newTotal, tierChanged, newTier, currentStreakDays, streakMultiplier, milestoneUnlocked }`

One DB read + one DB write — no extra round trips vs. current. Streak update is not async relative to point award; both are committed in the same write. The "async" from the parent spec refers to the client-side display update (toast appears after the streak response is received, not blocking the primary point-award UX).

### `updateStreakState(record, todayET)` — Pure Helper

```
todayET = current ET date string e.g. "2026-03-22"
yesterdayET = date string for yesterday in ET

if record.lastActivityDate === todayET:
  → no change to streak (already active today)
  → return existing streak fields unchanged

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

### ET Date Helper

Reuse the same ET date pattern from `spinWheel.web.js` (CF-ecs):
```js
function getTodayET() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).split('/').reverse().join('-'); // → "YYYY-MM-DD"
}
// Also needed: getYesterdayET() — same but for Date(now - 86400000)
```

Factor into a shared `dateUtils.js` backend helper (used by both `spinWheel.web.js` and the streak logic) to eliminate duplication.

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

---

## Definition of Done

- [ ] `MemberPoints` collection updated with 4 new fields in Wix Dashboard
- [ ] `getStreakMultiplier()` + `STREAK_MULTIPLIER_TIERS` added to `gamificationTokens.js`
- [ ] `dateUtils.js` backend helper created (shared ET date logic, extracted from spinWheel.web.js)
- [ ] `updateStreakState()` helper implemented and unit tested
- [ ] `gamificationEventReceiver.web.js` extended: reads streak fields, applies multiplier, writes unified update, emits badge on milestone
- [ ] `StreakDisplay.js` frontend module complete
- [ ] `#streakCountChip`, `#streakMultiplierBadge`, `#streakToastBox` added to editor in `#loyaltySection`
- [ ] `Member Page.js` integrated: streak display updates on point-earning event response
- [ ] Reduced-motion fallback implemented
- [ ] Tests: `getStreakMultiplier()` boundaries, `updateStreakState()` all branches (same-day no-op, increment, reset, day-7 milestone), multiplier applied correctly in receiver, ET midnight boundary
- [ ] **EDITOR_HOOKUP_GUIDE.html updated** (3 new element nicknames)
- [ ] **EDITOR-HOOKUP-GUIDE.md updated** (sync with HTML)
