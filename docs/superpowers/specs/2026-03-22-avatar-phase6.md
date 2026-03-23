# Phase 6 — Chibi Futon Avatar Spec
**Date:** 2026-03-22
**Status:** Approved — autonomous crew consensus
**Parent spec:** `2026-03-22-gamification-system-design.md`
**Phase:** 6 of 7

---

## Overview

A personalised bear avatar system on the Member Page loyalty section. Members unlock and equip accessories using earned points. Accessories range from cosmetic overlays to functional perks (discounts, early access, bonus points days). The avatar idle animation plays continuously; the equipped accessory is layered as an HTML overlay on top of the Lottie animation — no animation baking required, so custom art can drop in without code changes.

Phase 6 ships the full accessory mechanics using Lottie bear placeholder animations (all Simple License). Custom chibi futon bear art is deferred to post-Phase 4. See Art Assets section.

---

## Accessory Perk Types

| perkType | Effect |
|---|---|
| `COSMETIC` | Visual only — emoji/label overlay, no gameplay effect |
| `DISCOUNT_PCT` | Unlocks a standing discount (e.g. always 5% off) — redeemed at checkout via existing promotions engine |
| `EARLY_ACCESS` | Access to new products 24h before general public release |
| `BONUS_POINTS_DAY` | One day per rolling 7-day period where earned points are doubled before streak multiplier is applied. See BONUS_POINTS_DAY Math section. |

---

## BONUS_POINTS_DAY Math

### Formula

```
awardedPoints = Math.round(basePoints * bonusMultiplier * streakMultiplier)
```

Where:
- `bonusMultiplier = 2` when BONUS_POINTS_DAY is active for that day
- `bonusMultiplier = 1` otherwise
- `streakMultiplier` = current streak multiplier from `MemberPoints.streakMultiplier` (1, 1.5, or 2 — per Phase 2 spec)
- **Maximum total multiplier cap: 4×** — `Math.min(bonusMultiplier * streakMultiplier, 4)` applied before rounding to prevent abuse

**Combined multiplier examples:**

| Streak days | streakMultiplier | bonusMultiplier | Combined | Capped at |
|---|---|---|---|---|
| 1–2 | 1× | 2× | 2× | 2× |
| 3–6 | 1.5× | 2× | 3× | 3× |
| 7+ | 2× | 2× | 4× | 4× |

The 4× cap only applies when BONUS_POINTS_DAY is active. A 7-day streak without BONUS_POINTS_DAY equipped remains 2× (Phase 2 behaviour unchanged).

### 7-Day Rolling Window

A member can activate BONUS_POINTS_DAY once per rolling 7-day period. Activation is implicit — the bonus applies automatically to all point-earning events on that day.

**Eligibility check (server-side, in `gamificationEventReceiver.web.js`):**

1. Read `MemberAvatar.equippedAccessoryId` → look up accessory's `perkType`
2. If `perkType === 'BONUS_POINTS_DAY'`:
   - Read `MemberAvatar.bonusPointsDayUsed` (ET date string or empty)
   - If empty OR `bonusPointsDayUsed` is more than 6 days before today's ET date → bonus is eligible
   - Compute `effectiveBonusMultiplier = 2`; apply cap: `totalMultiplier = Math.min(2 * streakMultiplier, 4)`
   - After awarding points: set `MemberAvatar.bonusPointsDayUsed = todayET`
3. If bonus not eligible (used within current 7-day window) → `bonusMultiplier = 1`, normal streak-only multiplier

**7-day window check:**

```
windowStart = date 6 days before todayET (inclusive of today = 7-day rolling window)
bonusEligible = (bonusPointsDayUsed is empty) OR (bonusPointsDayUsed < windowStart)
```

Use the same `getTodayET()` and date arithmetic from `src/backend/utils/dateUtils.js` (Phase 2). Add a `getDateNDaysAgo(n)` helper or inline the subtraction.

**Write order:** Points are awarded first; `bonusPointsDayUsed` is updated in the same `MemberAvatar` write immediately after. The `MemberAvatar` write is separate from the `MemberPoints` write — both must succeed; if the `MemberAvatar` write fails, log the error and do not retry silently (the bonus was already awarded; a failed state write is preferable to double-awarding on retry).

---

## CMS Schema Changes (Phase 6 Only)

### `MemberAvatar` — 1 new field

The parent spec defines the base `MemberAvatar` schema. Phase 6 adds:

| Field | Type | Notes |
|-------|------|-------|
| `bonusPointsDayUsed` | Text | ET date string of last BONUS_POINTS_DAY activation, e.g. `"2026-03-22"`. Empty string = never used. |

All other `MemberAvatar` fields (`memberId`, `unlockedAccessoryIds`, `equippedAccessoryId`, `photoUrl`) are as defined in the parent spec. No new CMS collections required.

### `AvatarAccessories` — no schema changes

The `AvatarAccessories` collection schema is fully defined in the parent spec. No additional fields for Phase 6. Confirm these fields exist before implementation:

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

---

## Backend — `avatarService.web.js`

New file: `src/backend/avatarService.web.js`

All webMethods in this file require member auth (Wix members API). Rate limits follow the project-wide pattern (security audit wave PRs #605–#610).

---

### `getAvatarState(memberId)`

**Rate limit:** 10 calls/hr per member.

**Flow:**

1. Verify member auth — member can only fetch their own state
2. Read `MemberAvatar` record for `memberId` (or return empty defaults if no record exists)
3. Read `AvatarAccessories` for `equippedAccessoryId` (if set)
4. Resolve Lottie animation ID:
   - Default idle: `waving-bear-3e2qFVfuGO`
   - If equipped accessory has `perkType === 'BONUS_POINTS_DAY'` AND bonus is eligible today → return `bear-drinking-tea-NjXL1qGxqj` as ambient upgrade (optional visual hint — crew may omit if scope creep)
   - Otherwise: always `waving-bear-3e2qFVfuGO`
5. Return:

```js
{
  equippedAccessoryId: String | null,
  equippedAccessory: { label, description, perkType, perkValue } | null,
  unlockedAccessoryIds: String[], // parsed from JSON
  lottieAnimationId: String,      // always waving-bear-3e2qFVfuGO for Phase 6
  bonusPointsDayEligible: Boolean // true if BONUS_POINTS_DAY equipped + eligible
}
```

---

### `purchaseAccessory(memberId, accessoryId)`

**Rate limit:** 5 calls/hr per member.

**Flow:**

1. Verify member auth
2. Check rate limit
3. Read `AvatarAccessories` row for `accessoryId`; if not found or `active = false` → return `{ error: 'not_found' }`
4. Check seasonal expiry: if `seasonalUntil` is set AND `seasonalUntil < now()` → return `{ error: 'seasonal_expired' }`
5. Read `MemberAvatar` for `memberId` (or initialise empty record)
6. Parse `unlockedAccessoryIds` JSON array
7. Idempotency: if `accessoryId` already in `unlockedAccessoryIds` → return `{ error: 'already_owned', state: currentState }`
8. Read `MemberPoints` for `memberId`
9. Tier check: resolve member's gamification tier via `getTierForPoints(totalPoints)` from `gamificationTokens.js`. Compare against `tierRequired` using the gamification tier order (`TRAIL_BLAZER` < `MOUNTAIN_GUIDE` < `SUMMIT_MASTER` < `BLUE_RIDGE_LEGEND`). If member is below `tierRequired` → return `{ error: 'tier_required', requiredTier }`
10. Points check: if `totalPoints < pointCost` → return `{ error: 'insufficient_points', needed: pointCost, available: totalPoints }`
11. Deduct points: write `MemberPoints.totalPoints = totalPoints - pointCost`; recalculate tier
12. Add to unlocked: append `accessoryId` to `unlockedAccessoryIds` array; write `MemberAvatar`
13. Return `{ success: true, state: updatedAvatarState, newTotalPoints, newTier }`

**Tier order constant** (add to `gamificationTokens.js`):

```js
export const GAMIFICATION_TIER_ORDER = [
  'TRAIL_BLAZER',
  'MOUNTAIN_GUIDE',
  'SUMMIT_MASTER',
  'BLUE_RIDGE_LEGEND',
];
```

---

### `equipAccessory(memberId, accessoryId)`

**Rate limit:** 10 calls/hr per member.

**Flow:**

1. Verify member auth
2. Check rate limit
3. Read `MemberAvatar` for `memberId`
4. Parse `unlockedAccessoryIds` JSON array
5. If `accessoryId` not in `unlockedAccessoryIds` → return `{ error: 'not_unlocked' }`
6. Write `MemberAvatar.equippedAccessoryId = accessoryId`
7. Read full `AvatarAccessories` row for the newly equipped accessory
8. Return `{ success: true, equippedAccessory: { label, description, perkType, perkValue } }`

**Unequip:** Pass `accessoryId = null` to clear the equipped slot. Skip step 5 when `accessoryId` is null; write `equippedAccessoryId = ''`.

---

## Frontend — `AvatarDisplay.js` Module

New file: `src/public/AvatarDisplay.js`

---

### `renderAvatar($lottieContainer, $accessoryOverlay, avatarState)`

Initialises the avatar display on page load or after state refresh.

- If `useReducedMotion = true`: hide `$lottieContainer`, show static `🐻` text in its place; skip Lottie entirely. Accessory overlay still renders normally.
- If `useReducedMotion = false`: play Lottie animation `avatarState.lottieAnimationId` in `$lottieContainer` (idle loop)
- If `avatarState.equippedAccessory` is set: populate `$accessoryOverlay` with `equippedAccessory.label` (or emoji if accessory label starts with an emoji character); show overlay
- If no accessory equipped: hide `$accessoryOverlay`

---

### `showUnlockCelebration($elements, accessory)`

Called immediately after a successful `purchaseAccessory` response.

- `$elements`: `{ $lottieContainer, $accessoryUnlockToast }`
- Temporarily swap Lottie to `cute-bear-dancing-AfMGeP3e3h` (3 seconds), then restore idle animation
- If `useReducedMotion`: skip animation, go straight to toast
- Show `#accessoryUnlockToast` with accessory name for 4 seconds, then hide
- `$accessoryUnlockToast` text: `"🎉 [accessory.label] unlocked!"`

---

### `buildAccessoryShopItems(accessories, unlockedIds, memberPoints)`

Pure function — no side effects.

- `accessories`: array of active `AvatarAccessories` rows (filtered `active = true`, seasonal expiry checked)
- `unlockedIds`: array of already-owned accessory IDs
- `memberPoints`: member's current total points (Number)
- Returns array of shop item data objects for populating `#accessoryShopList` repeater:

```js
[
  {
    _id: accessoryId,
    label: String,
    description: String,
    pointCost: Number,
    perkType: String,
    perkDescription: String,  // human-readable perk effect
    isUnlocked: Boolean,
    canAfford: Boolean,        // memberPoints >= pointCost
    tierRequired: String,
    isEquipped: Boolean,       // accessoryId === equippedAccessoryId
  },
  ...
]
```

`perkDescription` mapping:

| perkType | perkDescription example |
|---|---|
| `COSMETIC` | `"Cosmetic — visual only"` |
| `DISCOUNT_PCT` | `"Always ${perkValue}% off every order"` |
| `EARLY_ACCESS` | `"Shop new products 24h early"` |
| `BONUS_POINTS_DAY` | `"2× points once per week (before streak multiplier, max 4× total)"` |

---

## Editor Elements

All elements live inside `#loyaltySection` on the Member Page. Use `$w()` selector in `Member Page.js`.

| Nickname | Type | Purpose |
|---|---|---|
| `#avatarLottieContainer` | Box | Hosts the bear Lottie animation (idle loop) |
| `#avatarAccessoryOverlay` | Text | Positioned over the bear box; shows equipped accessory label/emoji |
| `#accessoryShopList` | Repeater | Available accessories list with name, cost, lock status, buy/equip buttons |
| `#accessoryUnlockToast` | Box | Hidden by default; shown on successful unlock for 4s |

**Layout note:** `#avatarLottieContainer` and `#avatarAccessoryOverlay` must be positioned such that the overlay sits visually on top of the Lottie bear (Wix Studio: use a Stack layout or manually position the overlay Box with absolute positioning within a parent container). The overlay does not need to be pixel-perfect for Phase 6 — it is a text/emoji label adjacent to or over the bear.

**Repeater item elements** (inside `#accessoryShopList` each item):

| Nickname | Type | Purpose |
|---|---|---|
| `#shopItemLabel` | Text | Accessory name |
| `#shopItemCost` | Text | Point cost |
| `#shopItemPerkDesc` | Text | Perk description |
| `#shopItemStatus` | Text | "Owned", "Equipped", or empty |
| `#shopItemBuyButton` | Button | "Unlock for N pts" — disabled if owned or insufficient points |
| `#shopItemEquipButton` | Button | "Equip" — visible only when owned and not equipped |

---

## Art Assets Note (Placeholder vs Custom)

Phase 6 uses Lottie bear placeholders throughout. All animations are Simple License from LottieFiles.

| Moment | Animation | LottieFiles ID |
|--------|-----------|---------------|
| Avatar idle (base) | Waving Bear | `waving-bear-3e2qFVfuGO` |
| Unlock celebration | Cute Bear Dancing | `cute-bear-dancing-AfMGeP3e3h` |
| Ambient (ambient hint only) | Bear Drinking Tea | `bear-drinking-tea-NjXL1qGxqj` |

Accessories are displayed as HTML overlay elements (`#avatarAccessoryOverlay`) on top of the Lottie bear. They are not baked into the animation. This design is intentional: when the custom chibi futon bear art is commissioned, the Lottie animation ID is swapped and the overlay system continues to work unchanged.

**Custom art (deferred):** Commission a custom futon-themed bear avatar when budget approved (~$300–1,500). SVG base + Lottie JSON idle animation. Style: cozy sleeping/mountain bear, Blue Ridge color palette. Revisit when gamification reaches Phase 4+. Full details in parent spec art assets section.

---

## Error Handling

| Scenario | Handling |
|---|---|
| `purchaseAccessory` — insufficient points | Return `{ error: 'insufficient_points', needed, available }`. Frontend shows inline error on shop item: "Need N more pts" |
| `purchaseAccessory` — tier too low | Return `{ error: 'tier_required', requiredTier }`. Frontend shows: "Reach [Tier] to unlock" |
| `purchaseAccessory` — already owned | Return `{ error: 'already_owned', state }`. Frontend marks item as owned; no double-deduct |
| `purchaseAccessory` — seasonal expired | Return `{ error: 'seasonal_expired' }`. Frontend hides item or shows "Seasonal — expired" |
| `equipAccessory` — not in unlocked list | Return `{ error: 'not_unlocked' }`. Should not be reachable via normal UI; log as anomaly |
| `getAvatarState` — no `MemberAvatar` record | Return defaults: `{ equippedAccessoryId: null, unlockedAccessoryIds: [], lottieAnimationId: 'waving-bear-3e2qFVfuGO' }` — do not error |
| BONUS_POINTS_DAY write fails after points awarded | Log error; do not retry. Points stand. Manual audit if abuse suspected. |
| `MemberAvatar.unlockedAccessoryIds` malformed JSON | Treat as empty array `[]`; log parse error |
| Rate limit exceeded | Return 429. Frontend: "Try again shortly" |
| Lottie fails to load | Fall back to static `🐻` emoji (same as reduced-motion path) |

---

## Tests Required

All tests in `src/backend/__tests__/avatarService.test.js` and `src/public/__tests__/AvatarDisplay.test.js`.

### `purchaseAccessory`

- [ ] Deducts correct point cost from `MemberPoints.totalPoints`; adds `accessoryId` to `MemberAvatar.unlockedAccessoryIds`
- [ ] Returns `{ error: 'insufficient_points' }` when `totalPoints < pointCost`; no points deducted, no unlock added
- [ ] Returns `{ error: 'tier_required' }` when member gamification tier is below `tierRequired`; no points deducted
- [ ] Returns `{ error: 'already_owned' }` when `accessoryId` already in `unlockedAccessoryIds`; idempotent — no second deduction
- [ ] Returns `{ error: 'not_found' }` for inactive or non-existent accessory
- [ ] Returns `{ error: 'seasonal_expired' }` for accessory past `seasonalUntil`

### `equipAccessory`

- [ ] Returns `{ error: 'not_unlocked' }` when `accessoryId` not in `unlockedAccessoryIds`
- [ ] Successfully sets `equippedAccessoryId` and returns equipped accessory data when accessory is in unlocked list
- [ ] Passing `accessoryId = null` clears `equippedAccessoryId` (unequip)

### `getAvatarState`

- [ ] Returns correct `equippedAccessory`, `unlockedAccessoryIds`, and `lottieAnimationId` for a member with state
- [ ] Returns safe defaults (no error) for a member with no `MemberAvatar` record

### BONUS_POINTS_DAY

- [ ] 2× `bonusMultiplier` applied correctly: `awardedPoints = Math.round(basePoints * 2 * streakMultiplier)` when BONUS_POINTS_DAY is equipped and eligible
- [ ] Total multiplier capped at 4×: `Math.round(basePoints * Math.min(2 * streakMultiplier, 4))` — verify with `streakMultiplier = 2` (cap hits exactly 4×)
- [ ] Bonus NOT applied when `bonusPointsDayUsed` is within the current 7-day rolling window (< 7 days ago)
- [ ] Bonus IS applied again once 7-day window has expired (`bonusPointsDayUsed` is exactly 7 days old)
- [ ] `bonusPointsDayUsed` set to `todayET` after bonus applied
- [ ] Bonus NOT applied when BONUS_POINTS_DAY accessory is not equipped (different perkType or no accessory)
- [ ] Normal streak multiplier (Phase 2) behaviour unchanged when no BONUS_POINTS_DAY accessory equipped

### `buildAccessoryShopItems` (unit)

- [ ] `isUnlocked = true` for IDs in `unlockedIds`
- [ ] `canAfford = false` when `memberPoints < pointCost`
- [ ] `isEquipped = true` only for the currently equipped ID
- [ ] Correct `perkDescription` string for all four `perkType` values

---

## Definition of Done

- [ ] `MemberAvatar.bonusPointsDayUsed` field added to `MemberAvatar` collection in Wix Dashboard (Text type)
- [ ] `AvatarAccessories` collection confirmed present with all parent-spec fields
- [ ] `GAMIFICATION_TIER_ORDER` constant added to `gamificationTokens.js`
- [ ] `avatarService.web.js` implemented: `getAvatarState`, `purchaseAccessory`, `equipAccessory` — all with auth guard + rate limiting
- [ ] `gamificationEventReceiver.web.js` extended: reads `MemberAvatar` for BONUS_POINTS_DAY perk on point-earn events; applies capped combined multiplier; writes `bonusPointsDayUsed` after award
- [ ] `AvatarDisplay.js` frontend module complete: `renderAvatar`, `showUnlockCelebration`, `buildAccessoryShopItems`
- [ ] `Member Page.js` wired: calls `getAvatarState` on load, renders avatar, populates shop list, handles buy/equip actions
- [ ] `#avatarLottieContainer`, `#avatarAccessoryOverlay`, `#accessoryShopList`, `#accessoryUnlockToast` added to editor in `#loyaltySection`
- [ ] Repeater item sub-elements wired (`#shopItemLabel`, `#shopItemCost`, `#shopItemPerkDesc`, `#shopItemStatus`, `#shopItemBuyButton`, `#shopItemEquipButton`)
- [ ] Reduced-motion fallback: static `🐻` replaces Lottie; overlay still renders
- [ ] All tests passing (see Tests Required section above)
- [ ] **Phase 6 uses Lottie bear placeholders. Custom chibi futon bear art is deferred — see parent spec art assets note. All accessory mechanics are art-agnostic.**
- [ ] **EDITOR_HOOKUP_GUIDE.html updated** (4 new element nicknames: `#avatarLottieContainer`, `#avatarAccessoryOverlay`, `#accessoryShopList`, `#accessoryUnlockToast`, plus repeater sub-elements)
- [ ] **EDITOR-HOOKUP-GUIDE.md updated** (sync with HTML)
