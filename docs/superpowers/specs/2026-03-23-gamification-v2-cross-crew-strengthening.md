# Gamification v2 — Cross-Crew Strengthening Plan
**Date:** 2026-03-23
**Status:** Draft — pending Stilgar approval
**Extends:** `2026-03-22-gamification-system-design.md` (Phases 1–7 complete + Phase 8 wired)
**Input from:** radahn, godfrey, miquella, rennala (cfutons) + dallas (cfutons_mobile) + melania synthesis
**Approach:** D — All three pillars (deep enrichment + cross-crew integration + analytics), parallel tracks

---

## Context

Phases 1–8 are complete on web. Mobile has Phases 1–7 live independently. Phase 8 is undefined on mobile. This spec defines what "v2" means for every phase, defines Phase 8 for both platforms, and establishes the cross-rig event bus.

---

## Parallel Track Structure

```
TRACK A — Stilgar (editor, async to all below)
  Unblock P0/P1 hookup beads as pages are built in Wix Studio
  CF-edjm, CF-pln5, CF-7w4b, CF-0y0w, CF-35ok, CF-fs8g, CF-ph91

TRACK B — Web crew (cfutons) — Phase v2 deepening
  4 crew members, 1 cluster each, work in parallel

TRACK C — Mobile (dallas's crew) — Phase 8 + event bus
  Phase 8 social layer beads (new)
  Cross-rig event bus co-authored with rennala

TRACK D — Backend hardening (rennala leads)
  Unified event pipeline, idempotency, retry queue, clock fixes
```

---

## Phase 8 Definition (BOTH PLATFORMS)

> **Phase 8 = Cross-Rig Social Layer**
>
> Friend challenges, shared badge showcase, leaderboard sync between web and mobile. Both platforms participate equally as producers and consumers of gamification events.

**Shared event schema (co-owned, rennala + dallas):**
```json
{ "eventId": "uuid-v4-required", "event": "points_earned", "userId": "...", "delta": 50, "newTotal": 800, "source": "mobile|web", "ts": 1711234567 }
```
> **`eventId` is required on every event.** Wix webMethod must reject events without one. Prevents offline queue replays from double-awarding (idempotency key matches base gamification spec).

**6-event cross-rig bus:**

| Direction | Event | Web trigger | Mobile consumer |
|---|---|---|---|
| Web → Mobile | `points_earned` | Purchase, challenge complete | Badge refresh + optional push |
| Web → Mobile | `tier_upgraded` | Tier threshold crossed | Celebration toast |
| Web → Mobile | `challenge_completed` | Challenge finished on web | Confetti on ChallengesScreen |
| Mobile → Web | `streak_extended` | Daily app open w/ active streak | Web streak display update |
| Mobile → Web | `challenge_started` | User taps challenge card | Web challenge progress sync |
| Mobile → Web | `redemption_initiated` | User taps redeem in LoyaltyScreen | Web points ledger update |

**Mobile deep link screens (cf-m1c / PR #305 in CI):**
- `loyalty` → LoyaltyScreen
- `challenges` → ChallengesScreen
- `achievement` → AchievementBadgesScreen
- `leaderboard` → LeaderboardScreen
- `streak` → AccountScreen (streak section)

---

## Section 1 — Web Phase v2 Expansions (Track B)

### Phase 1 v2 — Badges + Points

**Crew assignment: miquella**

| Enhancement | Source | Detail |
|---|---|---|
| Real-time feedback loop | miquella | `gamificationEventReceiver` fires in-page toast/animation immediately on event receipt — no page reload needed. Dopamine moment on earn. |
| Points burn rate | godfrey | Visible "burn rate" on member page: "At this pace, free pillow by April." Derived from rolling 30-day average. |
| Badge progression tiers | godfrey | bluebird → bear → hawk as tier advances. Subtle animation on unlock. Sequence matches Blue Ridge animal SVG set already shipped. |
| Badge showcase visibility | miquella | Badges visible on product pages + nav (not only member page). Ambient brand presence. |

---

### Phase 2 v2 — Streak Multipliers

**Crew assignment: godfrey**

| Enhancement | Source | Detail |
|---|---|---|
| Streak grace day token | godfrey | One grace token per month, earned at day-7 streak. **Schema: `MemberPoints.graceTokenUsedDate: Text`** (ET date string of last grace use, empty if never used). Check if current month matches stored month to determine eligibility — same pattern as `lastActivityDate`. Prevents one missed day from nuking momentum. Field to update: `currentStreakDays` (not `streakLength` — that field does not exist). **Blocked on `CF-hard-clockfix` landing first.** |
| Streak recovery mechanic | godfrey | Spend N points to restore a broken streak (once per 30 days). CTA in member page streak section. Updates `currentStreakDays`. |
| "You're at risk" warning | miquella | Duolingo-style: push notification + in-app indicator when streak at risk (within 2h of cutoff). Fires from `TriggerMoments.js` `triggers.streakDanger` (Phase 5, already wired) — miquella wires the backend signal to the push notification path. **Blocked on `CF-hard-clockfix` landing first.** |

---

### Phase 3 v2 — Spin Wheel

**Crew assignment: radahn**

| Enhancement | Source | Detail |
|---|---|---|
| Animated wheel with sound | — | **Augments** the existing Phase 1 Lottie spin animation (`spinLottieHub` / `spinLottieConfetti`) — does not replace it. Add a CSS animation layer on the SVG wheel segments during the spin interval. Sound via Web Audio API: create `AudioContext` on user gesture only (avoids Chrome autoplay policy violation). `prefers-reduced-motion` suppresses both CSS layer and sound. |
| Social share of wins | godfrey | One-tap share card — pre-rendered SVG with member's prize + brand. Opens native share sheet on mobile. |
| Bonus spin earn triggers | — | Earn bonus spins from: purchase over $X, referral, streak milestone. Wired through gamification event pipeline. |
| Mobile port | dallas | Evaluate spin wheel for cfutons_mobile. Dallas co-decides — native wheel vs web view. New bead if yes. |

---

### Phase 4 v2 — Push Notifications + Challenge Discovery

**Crew assignment: miquella**

| Enhancement | Source | Detail |
|---|---|---|
| Challenge discovery indicator | miquella | Ambient "challenge in progress" chip on product/catalog pages where earning actually happens. User sees why they're earning points in context. |
| Personalized push cadence | — | Per-user push frequency cap. Heavy buyers get purchase challenges; browsers get discovery challenges. No spam. |
| Deep link alignment | dallas | Web URLs match mobile deep link slugs. Coordinate slug pattern between web + cf-m1c. |

---

### Phase 5 v2 — Challenges + Leaderboard

**Crew assignment: godfrey**

| Enhancement | Source | Detail |
|---|---|---|
| Zip-code micro-leaderboard | godfrey | "Your neighborhood" leaderboard (10–20 buyers in same ZIP cluster). Beating someone in Asheville is personal vs abstract national rank. |
| Time-limited challenges | — | Challenges with expiry dates. Countdown shown on challenge card. Urgency drives engagement. |
| Challenge leaderboards | — | Per-challenge leaderboard: first N to complete earn bonus prizes. |
| CF+ exclusive challenge tier | — | CF+ members get access to premium challenges with better prizes. Extends godfrey's "exclusive experience" principle. |

---

### Phase 6 v2 — Milestone Rewards

**Crew assignment: miquella**

| Enhancement | Source | Detail |
|---|---|---|
| Social share card on quest complete | godfrey | Pre-rendered SVG share card: member's badge + quest name + CF brand. One tap. Drives organic acquisition. |
| Birthday week (not just day) | — | Birthday reward window expanded to 7 days. Increases redemption rate. |
| Anniversary rewards | — | 1-year, 2-year purchase anniversary rewards. `orderHistory` already tracked. |

---

### Phase 7 v2 — Living Sky

**Crew assignment: radahn**

| Enhancement | Source | Detail |
|---|---|---|
| `weatherLabel` in sky state | radahn | Pass `weatherLabel: string` (e.g. "foggy mountain morning") alongside sky state object. Illustrations and UI can display ambient flavor text. Low cost — single string addition. |
| CF+ golden-hour perk | godfrey | CF+ members receive LivingSkyState with a −60min offset applied to the raw device clock hour before the sky table lookup in `useLivingSky` (i.e. subtract 1 from the hour value, then clamp to 0–23). They see golden hour 1hr earlier than non-members. One conditional in `useLivingSky`, device-clock-relative (same `new Date()` already used in `updateScene(hour)`). Costs zero compute. Feels magical. |
| `animationHint` in sky state | radahn | Pass `animationHint: 'slow-drift' | 'flicker' | 'shimmer' | null` in sky state. Each illustration applies a CSS animation class to its container. XSS surface stays tiny (class names only, not innerHTML). |

---

### Phase 8 v2 — Cross-Rig Social Layer (NEW, BOTH PLATFORMS)

**Crew assignment: rennala (web) + dallas (mobile)**

| Feature | Owner | Detail |
|---|---|---|
| Cross-rig event bus | rennala + dallas | 6-event schema above. Wix webhook → mobile consumer. Mobile app event → Wix webMethod. |
| postMessage reply channel | radahn | Illustrations can fire events back up: illustration → page → gamification engine. Unlocks discovery moments (find hidden constellation → earn badge) without changing tick loop. |
| Friend challenges | dallas | Challenger sends invite via deep link. Both platforms surface challenge card. First to complete wins bonus prize. |
| Shared badge showcase | rennala | Wix http-functions route: `GET /api/badges?memberId={userId}` (Wix does not support path param routing — use query string). Mobile consumer calls `GET /api/badges?memberId=...`. Web member page uses same endpoint. Confirm final route shape with rennala before dallas builds the mobile consumer. |
| Leaderboard sync | dallas | LeaderboardScreen (mobile, PR #303 in CI) reads same Wix leaderboard endpoint. Source of truth = Wix. |

---

## Section 2 — Backend Hardening (Track D)

**Lead: rennala**

| Fix | Priority | Detail |
|---|---|---|
| Achievement idempotency | P0 | DB-level unique index on `(userId, achievementKey)` in `Achievements` collection. Closes TOCTOU race when two requests land simultaneously (e.g. order webhook fires twice). |
| Streak clock fix (`CF-hard-clockfix`) | P0 | Use webhook event `ts` field, not `Date.now()`. Applies everywhere `currentStreakDays` is updated in `gamificationEventReceiver.web.js`. **Sole owner: rennala.** This fix must land before `CF-p2v2` (godfrey's grace token) and `CF-p4v2` (miquella's risk warning) — both are blocked on it. |
| Notification retry queue | P1 | `PendingNotifications` CMS collection: `{ userId, type, payload, status: 'pending|sent|failed', retries, updatedAt }`. Cron job retries failed rows on 5min cadence. |
| Centralized rate-limit layer | P1 | Shared `checkGamificationRateLimit(userId, action)` utility. Replace ad-hoc guards in `achievementService`, `notificationService`, `loyaltyService`. |
| suppressAuth audit | P2 | grep `wixData.query` in gamification webMethods for missing `suppressAuth`. Silently returns 0 results in staging without clear error signal. |
| Unified event pipeline | P2 | Gamification events (`streak_extended`, `badge_earned`, `tier_upgrade`) routed through same analytics collection as quiz/recommendation events. **CF-yz54 = quiz/recommendation analytics bead (closed, shipped in Sprint 4).** The `AnalyticsEvents` collection it created is the target. Rennala adds gamification event writes to the same collection. Enables cross-funnel cohort analysis. |

---

## Section 3 — Analytics + Intelligence (Track D, secondary)

**Lead: rennala, timeline: after hardening**

| Feature | Detail |
|---|---|
| Phase effectiveness dashboard | Per-phase engagement metrics: events fired, badges earned, challenges started/completed. Admin-only view. |
| Gamification funnel | quiz_started → quiz_completed → product_viewed → added_to_cart → purchased → badge_earned. Single collection, cross-joinable. |
| Points burn rate engine | Rolling 30-day average spend → projected reward date. Powers member page display + email nudge. |
| A/B testing hooks | SpinPrizes `variant: 'A' | 'B'` field. ChallengeTypes `cohort` field. No framework needed — just field + split in query. |

---

## Section 4 — Crew Dispatch Map

| Phase Cluster | Web Assignee | Mobile Assignee | Track |
|---|---|---|---|
| P1 v2 (Badges/Points) + P4 v2 + P6 v2 | miquella | — | B |
| P2 v2 (Streaks) + P5 v2 (Challenges/Leaderboard) | godfrey | — | B |
| P3 v2 (Spin Wheel) + P7 v2 (Living Sky) + P8 postMessage reply | radahn | — | B |
| Backend hardening + unified pipeline | rennala | — | D |
| P8 social layer + cross-rig event bus | rennala (Wix side) | dallas (mobile side) | C |
| Editor hookup (P0/P1 beads) | — (Stilgar only) | — | A |

---

## Bead Creation Plan (post-approval)

Create the following beads immediately after Stilgar approves this spec:

**Web (cfutons) — Track B:**
- `CF-p1v2` — Phase 1 v2: real-time feedback loop + points burn rate + badge tiers (miquella)
- `CF-p2v2` — Phase 2 v2: streak grace token (`MemberPoints.graceTokenUsedDate`) + streak recovery mechanic. **Blocked on `CF-hard-clockfix`.** (godfrey)
- `CF-p3v2` — Phase 3 v2: animated CSS wheel layer + Web Audio sound + social share + bonus triggers (radahn)
- `CF-p4v2` — Phase 4 v2: challenge discovery indicator + push cadence + deep link alignment. **Blocked on `CF-hard-clockfix` for risk warning.** (miquella)
- `CF-p5v2` — Phase 5 v2: zip-code leaderboard + time-limited challenges (godfrey)
- `CF-p6v2` — Phase 6 v2: social share card + birthday week + anniversary (miquella)
- `CF-p7v2` — Phase 7 v2: weatherLabel + animationHint + CF+ golden hour (radahn)
- `CF-p8-reply` — Phase 8: postMessage reply channel in illustrations (radahn)
- `CF-p8-bus` — see rennala sequenced list item 4 (not a separate creation action — owned and sequenced by rennala in Track D)

**Backend hardening — Track D (rennala, sequenced — do NOT run in parallel):**
1. `CF-hard-clockfix` — P0: streak clock fix (`currentStreakDays`, webhook `ts`, `gamificationEventReceiver.web.js`) — **first, unblocks CF-p2v2 + CF-p4v2**
2. `CF-hard-idempotency` — P0: achievement DB unique index on `(userId, achievementKey)` — **second, unblocks CF-p8-bus**
3. `CF-hard-ratelimit` — P1: centralized `checkGamificationRateLimit` utility, replaces ad-hoc guards
4. `CF-p8-bus` — P1: cross-rig event bus (after idempotency lands)
5. `CF-hard-retry` — P2: PendingNotifications retry queue + cron (can wait)
6. `CF-hard-pipeline` — P2: unified event pipeline into AnalyticsEvents collection (can wait)

**Mobile (cfutons_mobile) — Track C:**
- `cm-p8-social` — Phase 8 social layer: friend challenges + badge showcase (`GET /api/badges?memberId=...`) + leaderboard sync (dallas) **Blocked on rennala confirming final endpoint shape**
- `cm-p8-bus` — Phase 8 mobile event emitter: streak_extended, challenge_started, redemption_initiated with `eventId` UUID v4 (dallas)
- `cm-spin` — Spin wheel port **spike** (dallas): **1-day time-box.** Deliverable: written recommendation to melania covering native vs WebView tradeoffs + whether Phase 1 Lottie asset is usable in React Native. New bead created only on melania approval.

**Total: 16 unique beads across 4 tracks. Rennala's 6 are sequenced (not parallel). All Track B + Track C beads dispatchable same day pending spec approval.**

---

## Acceptance Criteria

- [ ] All 8 web phases have at least 2 v2 enhancements shipped and tested
- [ ] Cross-rig event bus operational: web event → mobile push notification within 30s
- [ ] Phase 8 social layer: friend challenge flow works end-to-end (web invite → mobile notification → mobile CTA → web leaderboard update)
- [ ] Backend: no duplicate achievement rows possible (idempotency proven in tests)
- [ ] Streak clock: no fair-streak breaks from webhook delivery lag (proven in tests)
- [ ] Analytics: full gamification funnel queryable from single collection
- [ ] Hookup: at least P0 pages (Home, Product Page, Category Page, masterPage) wired in Wix Studio (Track A, Stilgar-gated)
