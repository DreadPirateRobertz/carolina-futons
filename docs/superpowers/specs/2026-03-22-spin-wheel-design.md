# Phase 1 — Daily Spin Wheel Spec
**Date:** 2026-03-22
**Status:** Approved by Stilgar
**Parent spec:** `2026-03-22-gamification-system-design.md`
**Phase:** 1 of 7

---

## Overview

A daily spin wheel inline in the Rewards section of the Member Page. Members get 1 free spin per day (ET midnight reset) plus bonus spins earned through qualifying actions. Prize pool is CMS-configurable from the Wix Dashboard — no code changes needed to add, remove, or adjust prizes.

---

## Placement & Visual Design

- **Placement:** B — inline card inside the existing Rewards section of `Member Page.js`. No separate nav tab.
- **Visual weight:** A — full-size SVG wheel prominently displayed (180px diameter), not a compact card.
- **Layout:** Tier/points strip at top → spin wheel (left) + prize list panel (right) → last-win display.
- **Wheel:** SVG, 8 segments, dynamically rendered from `SpinPrizes` CMS. Segment arc angle proportional to weight (same formula as server-side draw — see Weighted Draw section).
- **Color palette:** Mountain theme — purple `#7c6af7`, forest green `#2d6a4f`, terracotta `#b5451b`, dark bg `#0f0f1a`.
- **Center hub:** Waving Bear Lottie animation (`waving-bear-3e2qFVfuGO`) — idle loop.
- **Spin animation:** Lottie spin wheel (`spin-wheel-PF5xGgYspK`) on button tap.
- **Win animation:** Two-layer confetti: `confetti-Ljf8PgS2P4` plays inline at wheel position; `confetti-on-transparent-background-ajhx1TPBa7` plays as full-screen overlay behind the result modal.
- **Reduced motion:** `useReducedMotion` check — instant prize reveal fallback, no animation.

---

## Prize Pool

All prizes are rows in the `SpinPrizes` CMS collection. Dashboard-editable — no code changes to tune the pool.

### `SpinPrizes` Collection

| Field | Type | Notes |
|-------|------|-------|
| `label` | Text | Display name e.g. `"10% Off Order"` |
| `prizeType` | Text | Enum: `POINTS`, `FREE_SHIP`, `DISCOUNT_PCT`, `SWATCH` |
| `prizeValue` | Number | Points amount, discount %, or 0 for swatch |
| `weight` | Number | Relative probability — higher = lands more often |
| `emoji` | Text | Segment icon e.g. `"🏷"` |
| `active` | Boolean | Toggle segments on/off without deleting |

### Default Prize Pool (examples — fully tunable)

| Prize | Type | Weight |
|-------|------|--------|
| 25 pts | POINTS | 30 |
| 50 pts | POINTS | 25 |
| 100 pts | POINTS | 20 |
| 250 pts | POINTS | 10 |
| 500 pts | POINTS | 3 |
| Free Shipping | FREE_SHIP | 5 |
| 10% Off Order | DISCOUNT_PCT | 4 |
| Free Swatch | SWATCH | 3 |

### Weighted Draw Algorithm

Both the server-side prize draw and the SVG segment sizing use identical weight-proportional logic:

```
totalWeight = sum of all active prize weights
probability(prize) = prize.weight / totalWeight
arcAngle(prize) = (prize.weight / totalWeight) * 360°
```

Server draw: generate a random float in [0, totalWeight), walk the sorted prize list accumulating weights, return the first prize where cumulative weight exceeds the random value. If only one active prize remains, it always wins. Minimum 1 active prize required — if `SpinPrizes` has no active rows, fall back to 25 pts base award and log an error.

---

## Spin Eligibility

- **Daily spin:** 1 per ET calendar day. Reset at midnight ET (`America/New_York`).
- **Bonus spins:** Earned through qualifying actions, tracked in `MemberPoints.bonusSpinsAvailable`.
- **Priority:** Daily spin consumed first; bonus spins used when daily is exhausted.

### `BonusSpinGrants` Collection (dashboard-editable)

| Field | Type | Notes |
|-------|------|-------|
| `triggerEvent` | Text | Enum: `gamification_order_complete`, `gamification_submit_review`, `gamification_referral_shared` — must match exact event names used in `gamificationEventReceiver.web.js` |
| `spinsGranted` | Number | How many bonus spins awarded per trigger |
| `active` | Boolean | Toggle per trigger |

**Event name alignment:** `gamification_submit_review` and `gamification_referral_shared` already exist in the receiver. `gamification_order_complete` is a new event that must be added to the receiver (wired to the Wix eCommerce order-paid webhook). All three `triggerEvent` values in this collection use the exact same names as the receiver's event switch cases.

---

## CMS Schema Changes

### `SpinHistory` (new collection)

| Field | Type | Notes |
|-------|------|-------|
| `memberId` | Text | Indexed |
| `spinDate` | Text | ET date string e.g. `"2026-03-22"` |
| `prize` | Text | Prize label |
| `prizeType` | Text | Enum: `POINTS`, `FREE_SHIP`, `DISCOUNT_PCT`, `SWATCH` |
| `pointsAwarded` | Number | 0 for non-points prizes |
| `eventId` | Text | Idempotency key — unique per spin request |
| `spinType` | Text | `DAILY` or `BONUS` |
| `createdAt` | DateTime | UTC write timestamp — required for race condition detection |

> **Note:** Parent spec `2026-03-22-gamification-system-design.md` lists the original 5-field `SpinHistory` schema. This spec supersedes that definition — implementers use the 8-field version above. The parent spec's `SpinHistory` table should be treated as a draft; this spec is authoritative for Phase 1 implementation.

### `MemberPoints` (existing — one new field)

| Field | Type | Notes |
|-------|------|-------|
| `bonusSpinsAvailable` | Number | Default 0. Incremented on qualifying action, decremented on spin use |

### `MemberPendingPrizes` (new collection — non-points prize redemption state)

| Field | Type | Notes |
|-------|------|-------|
| `memberId` | Text | Indexed |
| `prizeType` | Text | `FREE_SHIP`, `DISCOUNT_PCT`, `SWATCH` |
| `prizeValue` | Number | Discount % for `DISCOUNT_PCT`; 0 for others |
| `spinHistoryId` | Text | Foreign key to originating `SpinHistory` row |
| `awardedAt` | DateTime | UTC |
| `redeemedAt` | DateTime | Null until redeemed |
| `status` | Text | `PENDING`, `REDEEMED`, `EXPIRED` |
| `expiresAt` | DateTime | Null in Phase 1 — no expiry enforced. Revisit in Phase 2. |

**Expiry:** No expiry enforced in Phase 1. `EXPIRED` status field exists for future use. Revisit expiry window (e.g. 90 days) in Phase 2 spec.

**Stacking rule:** Multiple `FREE_SHIP` or `DISCOUNT_PCT` prizes can exist in `PENDING` state simultaneously. At checkout, apply the best available `DISCOUNT_PCT` value (not stacked). `FREE_SHIP` prizes: apply first available. `SWATCH` prizes: each row triggers one physical swatch fulfilment request (existing swatch request flow). After redemption, set `redeemedAt` and `status = REDEEMED`.

**Display source:** The Rewards section "pending prizes" display queries `MemberPendingPrizes` where `memberId` matches AND `status = PENDING`. Same collection clears on redemption.

---

## Backend — `spinWheel()` webMethod

Located in `gamificationEventReceiver.web.js` (CF-eo88). **Extend, do not replace.**

**Rate limit:** 20 calls/hr per member (consistent with project-wide rate limiting pattern from security audit wave PRs #605–#610).

### Flow

1. Verify member auth (Wix members API)
2. Check rate limit — return `429` if exceeded
3. Read `MemberPoints` for `memberId` (get `bonusSpinsAvailable`)
4. Check eligibility:
   - Daily: query `SpinHistory` where `memberId` matches AND `spinDate` = today's ET date, ordered by `createdAt` DESC. If any row exists → no daily spin available.
   - Bonus: `bonusSpinsAvailable > 0` → bonus spin available
   - Neither → return `{ eligible: false, nextSpinAt: <Unix epoch ms of next ET midnight> }`
   - **Resolve `spinType` here:** if daily spin is available → `spinType = DAILY`; else → `spinType = BONUS`. Carry this value into step 6.
5. Draw prize: weighted random selection from active `SpinPrizes` rows (server-side only — client never determines prize)
6. Write `SpinHistory` entry with unique `eventId` + `createdAt = now()` + `spinType` resolved in step 4
7. Re-query `SpinHistory` for today to confirm no duplicate (race guard — if another row with same `memberId` + `spinDate` and earlier `createdAt` exists, abort and return the earlier spin's result)
8. If `POINTS`: add to `MemberPoints.totalPoints`, recalculate tier (`getTierForPoints()` from `gamificationTokens.js` — gamification tiers only, not loyalty spend tiers)
9. If non-points prize: insert row into `MemberPendingPrizes` with `status = PENDING`; queue confirmation email
10. If `spinType = BONUS`: read-then-write `bonusSpinsAvailable - 1` (see Bonus Spin Guard below)
11. Emit `gamification_spin_completed` through existing `gamificationEventReceiver` pipeline
12. Return `{ prize, prizeType, pointsAwarded, spinType, bonusSpinsRemaining, nextSpinAt }`
    - `nextSpinAt`: Unix epoch milliseconds of next ET midnight (enables frontend countdown)
    - `bonusSpinsRemaining`: locally computed post-decrement value (`N - 1` where N was read in step 3) — do NOT re-read from DB here to avoid stale-read inconsistency under Wix Data's no-transaction constraint

### Timestamp Guard Pattern — Daily Spin Race

Read → validate → write → re-read to confirm:
1. Query `SpinHistory` for today's ET date before writing
2. Write new row with unique `eventId`
3. Re-query `SpinHistory` for today, ordered by `createdAt` ASC — if more than one row exists for this member+date and another row has an earlier `createdAt`, a race occurred; abort and return the earlier result
4. No double-award — second concurrent request detects the earlier row and stops

### Bonus Spin Guard — Concurrent Bonus Spin Race

`bonusSpinsAvailable` decrement uses optimistic read-then-conditional-write:
1. Read `MemberPoints.bonusSpinsAvailable` (value N)
2. After prize write succeeds, write `bonusSpinsAvailable = N - 1` only if current DB value still equals N
3. If the conditional write fails (value changed — concurrent request already decremented), log a warning and do not double-decrement; the spin already awarded is valid
4. This is an accepted rare edge: in the unlikely concurrent case, a member may consume one bonus spin and receive two prizes. The exposure is one spin's worth of prize value and is preferable to a complex lock mechanism in Wix Data.

---

## Frontend — `SpinWheel.js` Module

New file: `src/public/SpinWheel.js`

### Responsibilities

- Load `SpinPrizes` from CMS on mount — cached for 5 minutes (session cache; re-fetched after 5 min or on explicit refresh). Stale prize weights only affect the SVG display, not the server-side draw, so 5-min TTL is acceptable.
- Render SVG wheel dynamically from prize data (segment arcs proportional to weight — same formula as server draw)
- Handle spin button tap → call `spinWheel()` webMethod → animate → show result
- Show bonus spin count chip when `bonusSpinsAvailable > 0`
- Show disabled state + countdown to next ET midnight when no spins available (`nextSpinAt` from webMethod response, Unix epoch ms)
- Show pending prizes from `MemberPendingPrizes` (PENDING status) in Rewards section
- Integrate into `Member Page.js` inside the Rewards section

### Lottie Animations Used

| Moment | Animation | LottieFiles ID |
|--------|-----------|---------------|
| Center hub idle | Waving Bear | `waving-bear-3e2qFVfuGO` |
| Spin in progress | Spin Wheel | `spin-wheel-PF5xGgYspK` |
| Win burst (inline) | Confetti | `confetti-Ljf8PgS2P4` |
| Win overlay (full-screen) | Confetti transparent | `confetti-on-transparent-background-ajhx1TPBa7` |
| Loading state | Loading Bear | `loading-bear-nSFUgnPuv6` |

### Accessibility

- `useReducedMotion` respected — instant prize reveal instead of animation
- Screen-reader-friendly result announcement (aria-live region on prize result)
- Spin button disabled state clearly labelled with countdown timer

---

## Non-Points Prize Redemption

When a member wins `FREE_SHIP`, `DISCOUNT_PCT`, or `SWATCH`:

1. Server inserts row into `MemberPendingPrizes` with `status = PENDING`
2. Prize shown in their Rewards section (query `MemberPendingPrizes` WHERE `status = PENDING`)
3. Confirmation email sent with prize details
4. At next order checkout: checkout flow queries `MemberPendingPrizes` for PENDING prizes, applies best available discount, sets `redeemedAt` + `status = REDEEMED`
5. `SWATCH`: triggers existing swatch request flow, marks `REDEEMED` after fulfilment request submitted
6. Stilgar can add/remove/adjust non-points prize types from `SpinPrizes` CMS at any time

---

## Bonus Spin Grants — Integration with `gamificationEventReceiver`

When `gamification_order_complete`, `gamification_submit_review`, or `gamification_referral_shared` fires in the receiver:
1. Check `BonusSpinGrants` collection for active entry matching `triggerEvent` (exact event name match)
2. If found: increment `MemberPoints.bonusSpinsAvailable` by `spinsGranted`
3. Trigger toast/notification: "You earned a bonus spin!"

`gamification_order_complete` is a **new event** that must be added to the receiver. It is emitted by the Wix eCommerce order-paid webhook handler. Existing events (`gamification_submit_review`, `gamification_referral_shared`) already exist — bonus spin grant logic is added alongside their existing point-award logic within the same switch case.

---

## Error Handling

| Scenario | Handling |
|----------|---------|
| Already spun today, no bonus | Button disabled, countdown to midnight ET (`nextSpinAt` Unix ms) |
| Network failure mid-spin | Spin not recorded, idempotency key prevents double-award on retry |
| Prize pool empty/misconfigured | Fallback to 25 pts base award, log error |
| Daily spin race condition | Re-query after write; return earlier spin's result if race detected |
| Bonus spin concurrent race | Conditional decrement; accepted edge — log warning, do not double-decrement |
| Non-points redemption email failure | Prize still awarded in `MemberPendingPrizes`, email retried async |
| Rate limit exceeded | Return 429, frontend shows "Try again shortly" |

---

## Definition of Done

- [ ] `SpinPrizes` CMS collection created in Wix Dashboard
- [ ] `BonusSpinGrants` CMS collection created in Wix Dashboard
- [ ] `SpinHistory` CMS collection created (8-field schema including `createdAt`, `spinType`)
- [ ] `MemberPendingPrizes` CMS collection created in Wix Dashboard
- [ ] `MemberPoints.bonusSpinsAvailable` field added
- [ ] `spinWheel()` webMethod implemented: rate limit + eligibility guard + weighted draw + idempotency + timestamp guard + bonus spin guard
- [ ] `gamification_order_complete` event added to `gamificationEventReceiver.web.js`
- [ ] Bonus spin grant logic added to all three event handlers in receiver
- [ ] `gamification_spin_completed` event wired into receiver
- [ ] `SpinWheel.js` frontend module complete
- [ ] Integrated into `Member Page.js` Rewards section
- [ ] Lottie animations wired (spin, win inline + overlay, hub idle, loading)
- [ ] Reduced-motion fallback implemented
- [ ] `MemberPendingPrizes` display wired in Rewards section
- [ ] Checkout integration reads + redeems `MemberPendingPrizes`
- [ ] Tests: eligibility guard, idempotency, weighted draw distribution, bonus spin lifecycle, redemption flow, rate limit
- [ ] **EDITOR_HOOKUP_GUIDE.html updated** (new element nicknames, CMS collections)
- [ ] **EDITOR-HOOKUP-GUIDE.md updated** (sync with HTML)
