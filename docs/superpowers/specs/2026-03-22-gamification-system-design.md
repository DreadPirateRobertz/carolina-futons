# Carolina Futons Gamification System — Architecture Spec
**Date:** 2026-03-22
**Status:** Approved by Stilgar
**Approach:** B — Mayor's Sequential Pipeline
**Input from:** godfrey, radahn, rennala, miquella, hicks, burke, ripley, dallas, mayor

---

## Vision

A mountain-themed loyalty experience that replaces transactional account management with a living, personalized identity. Every visit, purchase, and interaction earns the customer a place on the trail — from Trail Blazer to Blue Ridge Legend. The system is delightful on web and native on mobile, coordinated but not duplicated.

---

## Feature Sequence (Build Order)

Each feature gets its own design session, crew review, spike if needed, and bead set when it reaches the front of the queue.

| Phase | Feature | Notes |
|-------|---------|-------|
| 1 | **Daily Spin Wheel** | Proves event pipeline end-to-end |
| 2 | **Streak Multipliers** | Low-risk add-on once spin is live |
| 3 | **Claude Chatbot** | Ships behind feature flag, Stilgar holds API key flip |
| 4 | **Challenges / Missions** | Most complex, after pipeline proven |
| 5 | **Trigger Moments** | Polish layer, parallel with challenges |
| 6 | **Chibi Futon Avatar** | Longest art lead time — start assets now, ships last |
| 7 | **Visual Header & Footer Redesign** | Full site visual refresh — header, footer, and global visual elements designed with visual companion in browser |

**Mobile layer** (push notifications, achievement share card, home screen widget) = post-launch v2, after 500+ MAU.

---

## Interaction Model (Loosely Connected)

- Spin wheel counts as a streak activity
- Missions can include "spin X times" as a verifiable condition
- Streak multiplier boosts points earned — **never** spin prizes
- All systems emit events through shared `gamificationEventReceiver` — one pipeline, web and mobile both write to it
- Mobile offline queue replays through the same server-side idempotency layer (no fork)

---

## Technical Architecture

### Server-Side Enforcement (Non-Negotiable)
All earn events, spin eligibility, streak state, and challenge progress validated server-side only. Client state is display-only. Tier and accessory unlocks are server-validated — never trust the client on what tier a user is.

### Timezone
`America/New_York` (canonical for Hendersonville NC). All timestamps stored as UTC, converted at display. "Daily" boundaries use ET local date — a user near midnight gets their spin at ET midnight, not UTC midnight.

### No Atomic Transactions — Timestamp Guard Pattern
Every write-gated action (spin, challenge completion, streak update) follows:
1. Read current state
2. Validate eligibility (timestamp check, idempotency key check)
3. Write with conditional timestamp check

If two events race, second write fails gracefully — no double-awards.

### Idempotency Keys
`gamificationEventReceiver` emits a unique `eventId` per trigger. Challenge tracker checks "have I counted this event ID?" before incrementing. Prevents mobile offline queue replays from inflating counts.

### Async Streak Updates
Spin result shown immediately (<200ms). Streak recalculation fires async, updates with a subtle toast. Never block the happy path on streak state.

### Chatbot Rate Limiting
Per-member daily token budget stored in CMS, checked server-side before each Claude call. Ships behind a feature flag — Stilgar controls the API key flip via Wix Secrets Manager. Full tool list but sandboxed: no write access to products/pricing/inventory, no access to other members' data.

### CMS-Driven Configuration
Accessories, challenges, and chatbot tool permissions live in Wix CMS — editable from the Wix dashboard without code changes.

---

## CMS Schema — New Collections

### `SpinHistory`
| Field | Type | Notes |
|-------|------|-------|
| `memberId` | Text | Indexed |
| `spinDate` | Text | ET date string e.g. `"2026-03-22"` |
| `prize` | Text | |
| `pointsAwarded` | Number | |
| `eventId` | Text | Idempotency key |

### `Challenges` (static definitions, dashboard-editable)
| Field | Type | Notes |
|-------|------|-------|
| `title` | Text | |
| `description` | Text | |
| `conditionType` | Text | Enum: `ORDER_COMPLETE`, `REVIEW_SUBMITTED`, `SPIN_COMPLETED`, `AR_USED`, `WISHLIST_ADD` |
| `targetCount` | Number | |
| `rewardPoints` | Number | |
| `rewardBadgeId` | Text | Optional |
| `expiresAt` | DateTime | Manual expiry enforced in backend |
| `active` | Boolean | |

### `MemberChallengeProgress` (live state)
| Field | Type | Notes |
|-------|------|-------|
| `memberId` | Text | Indexed |
| `challengeId` | Text | Indexed |
| `progressValue` | Number | |
| `completedAt` | DateTime | Null until complete |
| `eventIds` | Text | JSON array — idempotency log |
| `notifiedAt` | DateTime | |

### `AvatarAccessories` (dashboard-editable)
| Field | Type | Notes |
|-------|------|-------|
| `label` | Text | |
| `description` | Text | |
| `pointCost` | Number | |
| `perkType` | Text | Enum: `COSMETIC`, `DISCOUNT_PCT`, `EARLY_ACCESS`, `BONUS_POINTS_DAY` |
| `perkValue` | Number | Percentage or days |
| `tierRequired` | Text | e.g. `MOUNTAIN_GUIDE` |
| `active` | Boolean | |
| `seasonalUntil` | DateTime | Optional |

### `MemberAvatar` (per member)
| Field | Type | Notes |
|-------|------|-------|
| `memberId` | Text | Indexed |
| `unlockedAccessoryIds` | Text | JSON array |
| `equippedAccessoryId` | Text | |
| `photoUrl` | Text | Optional, rare |

### `MemberPoints` — Full Schema
Pre-existing fields (written by `gamificationEventReceiver.web.js` CF-eo88):

| Field | Type | Notes |
|-------|------|-------|
| `memberId` | Text | Indexed |
| `totalPoints` | Number | |
| `tier` | Text | Gamification tier name (display string) |

New fields added by this spec (Phase 2 — Streaks):

| Field | Type | Notes |
|-------|------|-------|
| `currentStreakDays` | Number | |
| `streakStartDate` | DateTime | |
| `lastActivityDate` | DateTime | Server-side UTC, used for lazy streak expiry check |
| `streakMultiplier` | Number | Default 1 |

### `ChatbotSessions` (new collection — separate from StyleConsultantSessions)
`StyleConsultantSessions` uses an anonymous SHA-256 session key and cannot be reused for member-auth-gated chatbot. Create a new collection:

| Field | Type | Notes |
|-------|------|-------|
| `memberId` | Text | Indexed — member auth required |
| `dailyTokensUsed` | Number | Reset daily (ET) |
| `dailyResetDate` | Text | ET date string |
| `sessionHistory` | Text | JSON, last N turns only |

---

## Two Tier Systems — Important Distinction

Two separate tier systems exist in the codebase. They are **independent and must not be confused:**

| System | File | Tiers | Basis |
|--------|------|-------|-------|
| **Gamification tiers** (this spec) | `gamificationTokens.js` | Trail Blazer → Mountain Guide → Summit Master → Blue Ridge Legend | Points earned via actions |
| **Loyalty spend tiers** (separate) | `loyaltyTiers.web.js` | Bronze → Silver → Gold → Platinum | Lifetime dollar spend |

All gamification features in this spec use the **points-based gamification tiers only** (`getTierForPoints()` from `gamificationTokens.js`). `loyaltyTiers.web.js` and `CustomerTierHistory` are unaffected and continue to operate independently. `AvatarAccessories.tierRequired` uses gamification tier keys (`TRAIL_BLAZER`, `MOUNTAIN_GUIDE`, `SUMMIT_MASTER`, `BLUE_RIDGE_LEGEND`).

---

## Extending `gamificationEventReceiver` (CF-eo88)

`/src/backend/gamificationEventReceiver.web.js` already exists (CF-eo88). **Do not create a new file.** The existing receiver handles three events and writes to `MemberPoints` (`memberId`, `totalPoints`, `tier`).

**What is already there:**
- `gamification_add_to_cart` (+5 pts)
- `gamification_submit_review` (+50 pts, +25 photo bonus)
- `gamification_referral_shared` (+100 pts)
- Writes `{ memberId, totalPoints, tier }` to `MemberPoints`

**What must be added per phase:**

| Phase | New events to add | New logic |
|-------|------------------|-----------|
| 1 — Spin | `gamification_spin_completed` | Idempotency key check, `SpinHistory` write, daily eligibility guard |
| 2 — Streaks | All existing events | Streak state read → async update after point award |
| 3 — Chatbot | None (chatbot has own session layer) | — |
| 4 — Challenges | All events + new ones | Challenge progress increment with idempotency dedup |

Each feature spec will define the exact extension required at implementation time.

---

## Cross-Rig Sync

Web and mobile write to the same `gamificationEventReceiver` endpoint — one source of truth, no forked implementation.

**Real-time milestones:** Wix webhook → silent push notification → invalidates mobile `useLoyalty` cache.
**Background refresh:** On-focus polling via existing `useLoyalty` hook.
**Rule:** Webhooks for milestone moments only (tier-up, badge unlock, challenge complete). Polling for routine state.

---

## Mobile Layer (Web + App Shared)

**Points visibility (dallas):**
- Points chip on PDP badge row
- "You'll earn N pts" line in cart above CTA
- Post-purchase toast via existing `cm-ihz` hook
- Avoid mid-checkout — kills conversion

**Challenges UI:**
- HomeScreen section below hero carousel (not a 5th tab)
- Sheet/drawer on tap for detail
- Badge dot on Account tab for expiring challenges
- ≤5 active challenges at a time (cognitive overload on small screens)

**Offline earn queue:** Use existing `cm-offline-queue` infrastructure — hook in, don't rebuild. Events earned offline are queued locally and replayed through the server-side idempotency layer on reconnect. The server holds authoritative streak state; offline mode may show a stale display value that corrects on reconnect. Streaks are not extended based on client-asserted timestamps.

---

## Accessibility (Required)

- `useReducedMotion` respected on spin wheel — simple reveal fallback instead of animation
- Reduced-motion path for chatbot response animations
- Chibi avatar touch target sized for smallest viewports (iPhone SE)
- Streak counter persistent and visible — mobile users won't hunt for it

---

## Chatbot — Full Tool Scope

Read-only: product recommendations, sizing, care instructions, style guide, room planning, FAQ/policies
Soft writes: add to wishlist, start swatch request, save style preference to member profile
Transactional: order status lookup, return request initiation, apply promo code

All sandboxed: member auth required for write actions, daily token budget enforced, no access to other members' data, no write access to products/pricing/inventory.

---

## Leaderboard (Deferred — spec at Phase 4+)

Member-only rank chip on loyalty screen. No public page — protects high-value customer privacy. Full design (rank calculation, refresh cadence, CMS schema, permission model) deferred to its own spec when prioritised.

---

## Deferred

| Feature | Condition to Unblock |
|---------|---------------------|
| Home screen widget (iOS/Android) | 500+ MAU |
| Achievement share card | Post-launch v2 |
| Push notification streak warnings | Post-launch v2 |
| AR feature + app download prompt | When model files ready |

**AR web fallback:** If user declines app download prompt, web AR loads anyway (graceful degradation).

---

## Art Assets Note

**Phase 1–5 (current):** Using free LottieFiles bear character set as avatar placeholder. All Lottie Simple License. Native Wix integration available.

| Moment | Animation | LottieFiles ID |
|--------|-----------|---------------|
| Account icon / idle | Waving Bear | `waving-bear-3e2qFVfuGO` |
| Loyalty screen ambient | Bear Drinking Tea | `bear-drinking-tea-NjXL1qGxqj` |
| Tier-up / spin win | Cute Bear Dancing | `cute-bear-dancing-AfMGeP3e3h` |
| Challenge complete | Bear Clapping | `bear-clapping-4hjv0nfIf9` |
| Loading state | Loading Bear | `loading-bear-nSFUgnPuv6` |
| Spin wheel | Spin Wheel (SM Rony) | `spin-wheel-PF5xGgYspK` |
| Confetti overlay | Confetti (transparent bg) | `confetti-on-transparent-background-ajhx1TPBa7` |
| Spin win burst | Confetti (Emas DP) | `confetti-Ljf8PgS2P4` |
| Badge / success | Success Confetti | `success-confetti-f5PdexvrBK` |

Required emote states for full system (ripley mobile spec): idle wave → earn/excited → streak active/happy → streak danger/worried → streak broken/sad.

**Phase 6 (custom chibi, deferred):** Commission a custom futon-themed bear avatar when budget approved. SVG base + accessories, Lottie JSON idle animation. Fiverr Pro / ArtStation / Behance. Style: cozy sleeping/mountain bear, Blue Ridge color palette, NOT generic trail/outdoor. Budget ~$300–1,500 depending on scope. Revisit when gamification reaches Phase 4+.

---

## Per-Feature Design Sessions

When each phase approaches, the PM (melania) will:
1. File a spike bead if feasibility research is needed
2. Run a fresh design session with Stilgar
3. Collect targeted crew input for that feature
4. Write a feature-specific spec (this doc as parent context)
5. File implementation beads with full acceptance criteria
6. Dispatch to crew

*This spec is the architecture contract. Feature specs inherit it.*
