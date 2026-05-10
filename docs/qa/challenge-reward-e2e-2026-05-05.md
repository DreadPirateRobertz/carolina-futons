# Challenge / reward E2E — STAGING_SITE verification plan

**Bead:** cf-jvut
**Author:** rennala
**Date:** 2026-05-05 (drafted 2026-05-09)
**Scope:** AR Discovery (75pts), Quiz Completion (50pts), Social Share (100pts) — three mobile-app-driven challenge types. Verifies the gamification engine fires AND records points end-to-end on STAGING_SITE.
**Method:** static read of dispatch paths + a tester-runnable verification matrix. Static analysis cannot prove "points actually appear in the member's balance" — only the staging probe can. Three concrete gaps surfaced ahead of the run; calling them out so the tester knows what to expect.

## TL;DR

**Three concrete gaps discovered statically. Run the staging matrix to confirm each.**

| # | Concern | Severity (if confirmed) | Quick check |
|---|---------|-------------------------|--------------|
| G1 | `completeMobileChallenge` writes a `MobileChallengeCompletions` row but **does not call `insertLedgerEntry`** — the member's PointsLedger / point balance does not move. | **P1 silent failure.** Spec promises 75/50/100 pts; member sees 0. | After firing a mobile challenge, query `MemberPointsLedger` for the member — expect 0 new entries. |
| G2 | `completeMobileChallenge` does not call `maybeGrantBonusSpin` — bonus-spin grants tied to mobile challenges (if any are configured) won't fire. | **P2** unless BonusSpinGrants has rows with `triggerEvent` matching mobile event names. | Inspect `BonusSpinGrants` for rows where `triggerEvent IN ('quiz_completed', 'ar_discovery_completed', 'social_share_completed')`. If any are active, expected behaviour diverges from impl. |
| G3 | AR discovery has TWO different caps in TWO different paths. Web path (`receiveGamificationEvent`) is **once per member ever** (CF-0gly, queries `AnalyticsEvents`). Mobile path (`completeMobileChallenge`) is **once per day per productId** (queries `MobileChallengeCompletions`). | **P2** correctness — a hostile client firing both paths could earn the AR award twice (once via mobile per-day, once via web lifetime-cap). | Fire `ar_discovery_completed` via mobile, then `gamification_ar_discovery` via web for the same member; assert exactly one award lands. |

Plus three challenge-specific verification matrices below.

## Dispatch map (static)

```
Mobile event from app   ──HTTP──▶  /_functions/crossRigEvent
                                         │
                                         ▼
                                crossRigEventReceiver.web.js
                                         │
                                         ├─▶ insertAnalyticsEvent(...)        ← logged ✓
                                         │
                                         └─▶ completeMobileChallenge(memberId, type, params)
                                                  │
                                                  ▼
                                          mobileChallengeService.web.js
                                                  │
                                                  ├─▶ idempotency query (MobileChallengeCompletions)
                                                  ├─▶ wixData.insert('MobileChallengeCompletions', { ... pointsAwarded: 75/50/100 })
                                                  ├─▶ insertLedgerEntry(...)   ← MISSING (G1)
                                                  └─▶ maybeGrantBonusSpin(...) ← MISSING (G2)
```

For comparison, the canonical web event path (`receiveGamificationEvent` in `gamificationCore.web.js`):

```
Web event ──▶ receiveGamificationEvent
              ├─▶ checkRateLimit
              ├─▶ daily-cap / one-time-cap branches (CF-0gly etc)
              ├─▶ apply streak multiplier
              ├─▶ wixData.update('MemberPoints', { ... newTotal })  ← balance moves ✓
              ├─▶ insertLedgerEntry({ memberId, delta, source, sourceId })  ← ledger writes ✓
              ├─▶ maybeGrantBonusSpin(eventName, payload)           ← bonus spin checked ✓
              └─▶ checkAndTriggerTierMilestone(...)
```

The mobile path is missing the bottom three steps. **G1/G2 are real until staging proves otherwise.**

## Acceptance matrix

For each row: tester triggers via the listed mechanism, then runs the listed CMS queries on STAGING_SITE, then asserts the expected post-conditions.

### Setup

1. Authenticate as a fresh test member (no prior gamification activity). Capture `memberId`.
2. Snapshot baseline:
   - `MemberPoints` row for `memberId` → record `currentPoints` (call it `P0`)
   - `MemberPointsLedger` count for `memberId` → record `L0`
   - `MobileChallengeCompletions` count for `memberId` → record `C0` (expected 0)
   - `BonusSpinGrants` configuration → record any rows where `triggerEvent` references mobile events
3. Use the same `memberId` for all three challenge tests; each should be independent thanks to per-type idempotency keys.

### Challenge 1 — AR Discovery (75 pts)

**Trigger (pick the path the spec maps to — confirm with godfrey/Stilgar before running):**
- Mobile path: POST `/_functions/crossRigEvent` with `{ event: 'ar_discovery_completed', productId: '<some-product-id>', platform: 'ios' }` + valid bearer token for the test member.
- Web path: POST a `gamification_ar_discovery` event via the gamification HTTP route (or in-app event bus).

**Assertions (after trigger, allow 5s for any async cron):**

| Path | Collection | Query | Expected |
|------|-----------|-------|----------|
| MOBILE | `MobileChallengeCompletions` | `eq('memberId', X).eq('challengeType', 'ar_discovery').ge('completedAt', today)` | 1 row, `pointsAwarded === 75`, `productId` matches |
| MOBILE | `MemberPoints` | `eq('memberId', X)` | `currentPoints` equals `P0` *(this is G1; if it equals `P0 + 75`, the gap is closed)* |
| MOBILE | `MemberPointsLedger` | count entries for memberId | equals `L0` *(G1 — if `L0 + 1`, gap is closed)* |
| MOBILE | `BonusSpinGrants` | manual lookup vs `triggerEvent` match | no SpinGrants row appears for memberId — *unless* G2 is closed AND a matching grant config exists |
| WEB | `MemberPoints` | as above | `currentPoints === P0 + 75` (web path correctly writes balance) |
| WEB | `MemberPointsLedger` | last row for memberId | new entry, `delta === 75`, `source === 'gamification_ar_discovery'` (or whichever source string the impl uses — record observed value for the doc) |
| WEB | `AnalyticsEvents` | `eq('eventType', 'ar_discovery').eq('memberId', X)` | 1 row (drives the CF-0gly lifetime cap) |

**Idempotency / cap test:**
- Fire the SAME trigger a second time within 60s.
  - MOBILE path same productId → `MobileChallengeCompletions` count stays at 1 (today + productId scope hits the dedup query); `pointsAwarded` not double-counted in the ledger (if G1 is closed).
  - WEB path → `MemberPoints` does NOT increase a second time (CF-0gly lifetime cap).
- Fire a SECOND mobile trigger with a DIFFERENT productId same day → `MobileChallengeCompletions` count becomes 2, points (if G1 closed) increase by 75 again. *Cross-check: the web path would have 0'd the second award via the lifetime cap. Cap divergence is G3.*

### Challenge 2 — Quiz Completion (50 pts)

**Trigger:** POST `/_functions/crossRigEvent` with `{ event: 'quiz_completed', score: <0-10>, total: <0-10>, platform: 'ios' }` + bearer token.

**Assertions:**

| Collection | Query | Expected |
|-----------|-------|----------|
| `MobileChallengeCompletions` | `eq('memberId', X).eq('challengeType', 'quiz_completion').ge('completedAt', today)` | 1 row, `pointsAwarded === 50`, `score` and `total` populated |
| `MemberPoints` | `eq('memberId', X)` | unchanged from previous test (G1 — should be `P0 + 50` if gap closed) |
| `MemberPointsLedger` | last entry | unchanged (G1 — should be a new `+50` entry if closed) |

**Idempotency test:**
- Fire `quiz_completed` again (no productId → idempotency keyed only on `memberId + challengeType + today`).
- Expect: `MobileChallengeCompletions` count stays at 1 for today; second response is `{ success: true, alreadyAwarded: true, pointsAwarded: 0 }`.
- Day-rollover test (if staging time can be advanced): fire again "tomorrow" → new row, fresh award.

### Challenge 3 — Social Share (100 pts)

**Trigger:** POST `/_functions/crossRigEvent` with `{ event: 'social_share_completed', productId: '<id>', platform: 'ios' }` + bearer token. *(productId is captured per `crossRigEventReceiver` line 182 — confirm spec intent: is the dedup keyed on productId or on memberId-only? code uses `if (params.productId) query = query.eq('productId', params.productId)` so omitting productId → dedup is per-day-per-type only.)*

**Assertions:**

| Collection | Query | Expected |
|-----------|-------|----------|
| `MobileChallengeCompletions` | `eq('memberId', X).eq('challengeType', 'social_share').ge('completedAt', today)` | 1 row, `pointsAwarded === 100` |
| `MemberPoints` | `eq('memberId', X)` | unchanged (G1) |

**Idempotency test:**
- Same productId same day → 1 row preserved.
- Different productId same day → 2 rows (each award independent — confirm with PM whether this is intended; sharing 5 different products in one day awarding 500 pts seems ripe for abuse).

## Daily caps + dedup (cross-cutting)

| Cap class | Where enforced | Scope | Failure mode if missed |
|-----------|----------------|-------|------------------------|
| Per-day per-type per-productId (mobile) | `mobileChallengeService.web.js#completeMobileChallenge` query at line ~59 | UTC midnight rollover | Mid-day timezone switch could let a member earn twice across a UTC boundary. Confirm `_todayStart()` aligns with PM expectation (currently uses local server time via `setHours(0,0,0,0)`). |
| AR discovery once-per-member (web) | `gamificationCore.web.js#receiveGamificationEvent` line ~152 (CF-0gly) | Lifetime, queries `AnalyticsEvents` | G3 — divergent from mobile per-day cap. Document explicitly: which is canonical? |
| Wishlist add monthly (web) | `checkWishlistMonthlyCap` (out of scope for this bead) | Calendar month | n/a for this run |
| Rate limit (call frequency, not award eligibility) | `gamificationCore.web.js` rate-limit at top of `receiveGamificationEvent` | Sliding window | Hostile client spamming mobile events → no rate-limit on the mobile path. Confirm with godfrey whether `crossRigEvent` HTTP function rate-limits at its boundary. |

## BonusSpinGrants verification

For staging tester:
1. Inspect `BonusSpinGrants` collection. Filter `active === true`. Note any rows where `triggerEvent` IN `('quiz_completed', 'ar_discovery_completed', 'social_share_completed', 'gamification_ar_discovery', 'gamification_quiz_completion', 'gamification_social_share')`.
2. If any rows exist:
   - For mobile path: fire the matching event, then query `SpinGrants` (the redemption-side collection from `spinRedemptionService.web.js`) for new rows with this memberId. **Expect 0 new rows due to G2** — unless `completeMobileChallenge` has been wired to call `maybeGrantBonusSpin`.
   - For web path: same trigger via `receiveGamificationEvent`; expect 1 new SpinGrants row per active grant matched, with `status='pending'`, `expiresAt = now + 30 days`.
3. If no matching rows exist: bonus-spin coverage for these challenges is unspecified — note in the bead and ask PM whether any should be configured.

## Observability checks (no behavioral assertion)

While running the matrix, capture these outputs for the audit doc:
- Velo console / cloud logs for `[mobileChallengeService] completeMobileChallenge error:` warnings — should be absent.
- `[crossRigEvent — completeMobileChallenge(...)] failed` warnings — should be absent.
- `AnalyticsEvents` row inserted for each mobile trigger (cross-rig pipeline writes one regardless of mobile-challenge dispatch).

## Recommended fix order (post-staging confirmation)

1. **G1** — `completeMobileChallenge` calls `insertLedgerEntry({ memberId, delta: pointsAwarded, source: 'mobile_challenge', sourceId: completion._id, eventName: challengeType })` AND updates `MemberPoints.currentPoints`. Either inline or by emitting a synthetic `gamification_mobile_challenge` event into `receiveGamificationEvent` (preferred — reuses streak multiplier + tier milestone + analytics).
2. **G3** — pick a single canonical cap (recommend the per-member-lifetime web-path semantic since AR is a marketing one-shot per CF-0gly, then mirror it in the mobile path by querying `MobileChallengeCompletions` for any prior `ar_discovery` row regardless of productId). Document the cap in the spec.
3. **G2** — once G1 lands (synthetic-event approach gives this for free), bonus spin grants fire automatically. If inline approach is taken, add `await maybeGrantBonusSpin(challengeType + '_completed', params)` after the ledger write.
4. **Backfill** — for any test members who completed challenges during the gap window, retroactively credit via a one-shot script that reads `MobileChallengeCompletions` rows missing a ledger entry, sums `pointsAwarded` per memberId, writes the balance + ledger entries with `source='backfill_cf_jvut'`.

## What this audit cannot answer

Static analysis can't prove:
- Wix Loyalty's external balance (the `wix-loyalty.v2` SDK) is or isn't separately ticking up alongside the in-house `MemberPoints` collection — there might be a parallel write I missed. Tester should query the loyalty account via `wixLoyaltyClient.accounts.getCurrentMemberAccount()` after each trigger to confirm.
- The mobile app's request body actually carries the `platform`, `productId`, `score`, `total` fields the helper expects. Capture an actual app request via Charles Proxy / Wix runtime logs and pin the shape in a follow-up bead if it diverges.
- Time zone semantics for `_todayStart()` align with the spec's "daily cap" expectation. Tester at midnight ET vs midnight UTC will catch the drift if any.

Hand off to whoever owns the staging probe (Stilgar) — file the matrix results into this doc as `## Staging run results — <date>` so the doc becomes the canonical e2e record per cf-jvut acceptance.
