# cf-lzkm — `checkRateLimit` Callers Audit

**Bead:** cf-lzkm
**Author:** millicent
**Date:** 2026-05-10
**Driver:** cf-sazb fix (PR #1305) showed that PR #1288's fail-closed change has a semantic interaction with callers that don't read `reason`

## TL;DR for melania

PR #1288 (cf-3ldu.F2) made `checkRateLimit` return `{allowed: false, reason: 'db_error'}` instead of throwing on rate-limit-DB outages. Most callers destructure only `{ allowed }` and treat both `'rate_limited'` and `'db_error'` as throttle hits.

For most user-facing endpoints, this is **acceptable** — a 429 to the user is a reasonable degradation when the rate-limit DB itself is sick.

For a few callers (errorMonitoring fixed in cf-sazb, plus the candidates in §FIX below), the throttle-equals-success conflation is a **real bug**: the caller's purpose is to surface signal during outages, and silently throttling defeats it.

**Recommendation: solve at the source.** Add a `failOpenOnDbError` option to `checkRateLimit` itself (default `false` to preserve current security posture) and have the surface-during-outage callers opt in. Cleaner than 50 caller-side fixes, and the policy becomes documented in one place.

## Caller inventory

83 call sites identified across `src/backend/*.web.js` + `src/backend/http-functions.js` + `src/backend/utils/gamificationRateLimit.js`. Excluding:

- `src/backend/utils/rateLimit.js` itself (the implementation)
- `src/backend/styleConsultant.web.js` line 176 — local helper, different signature
- `src/backend/zipLeaderboard.web.js` line 30 — local helper, different signature
- `src/backend/newsletterService.web.js` `_checkRateLimit` — local private fn

Net **~50 caller sites that consume the shared utility**.

## Classification

### KEEP — db_error throttle is acceptable user-facing behavior

The vast majority. User-driven actions where "Too many requests, try later" is a reasonable graceful-degradation message even if the underlying cause is a sick rate-limit DB rather than actual throttle. No per-caller fixes needed.

Includes (non-exhaustive):

- `bundleService.web.js` (BundleAdd) · `productQA.web.js` · `socialProof.web.js` · `priceLock.web.js` · `inventoryService.web.js` (BackInStock) · `comparisonService.web.js` · `giftCards.web.js` · `couponValidation.web.js` · `liveChat.web.js` (SupportTicket) · `orderTracking.web.js` (3 sites) · `deliveryScheduling.web.js` · `customEvents.web.js` · `futonSommelier.web.js` · `analyticsHelpers.web.js` (4 sites — analytics events, low-value drops are fine) · `dataService.web.js` (Reviews) · `conversionFunnel.web.js` · `realRoomsGallery.web.js` · `unsubscribeService.web.js` · `giftRegistry.web.js` · `coreWebVitals.web.js` · `loyaltyService.web.js` (3 sites) · `whiteGloveScheduling.web.js` · `visualSearchExport.web.js` · `customerRoomPhotos.web.js` · `comfortTimeline.web.js` · `protectionPlan.web.js` · `liveChatService.web.js` (2 sites) · `viewerTracker.web.js` · `checkoutOptimization.web.js` · `abExperiments.web.js` · `spinWheel.web.js` · `abTesting.web.js` · `browseAbandonment.web.js` (2 sites) · `wishlistService.web.js` · `shippingIntelligence.web.js` (4 sites) · `swatchRequest.web.js` · `roomStaging.web.js` · `collaborativePlanner.web.js` (5 sites) · `neighborhoodMap.web.js`

For all of these, the caller emits a 429-equivalent on `!allowed` regardless of `reason`. The user-experience is the same. **No action needed.**

### FIX — db_error breaks caller semantics (cf-sazb-class)

These callers' job is to surface signal _during the exact failure modes_ that knock out the rate-limit DB. Silently turning the call into a "throttled" no-op defeats the purpose.

| File | Line | Why FIX | Suggested treatment |
|---|---:|---|---|
| `errorMonitoring.web.js` | 103 | **DONE** in cf-sazb (PR #1305). Logger silently dropped errors during DB outages. Reference fix for the pattern. | reads `{allowed, reason}`, db_error → `success:false` |
| `emailQueueService.web.js` | 242 | Email queue dispatcher. db_error → silently throttle = email never sent during the outage. Worse than user-visible throttle because queued message is "delivered" from caller's view. | read reason; db_error → leave message in queue, retry later |
| `http-functions.js` | 2271 (LeaderboardPublic), 2387 (BadgesPublic) | Public read endpoints. Less severe than email-queue, but the 429 they return now masquerades as deliberate throttle when the actual cause is a DB outage. Operators looking at error rates will misread. | could opt into fail-open, OR explicitly emit `503` on db_error so dashboards see the real cause |
| `dataService.web.js` | 167 (ReviewRateLimit) | Reviews submission. If DB is sick during a review write, dropping the review with "rate limited" loses customer content. | log the db_error explicitly + still attempt the write, fail-open for this one |

### INSPECT — needs closer read of caller intent

These have unusual handling worth a look before bucketing:

| File | Line | Note |
|---|---:|---|
| `tradeInService.web.js` | 193 | Wrapped in try/catch + `rl = { allowed: true }` on throw. **Fail-open by design.** Post-PR #1288, checkRateLimit no longer throws → catch never fires → caller hits the standard `!allowed` path on db_error. **The intentional fail-open is silently broken.** Real bug. Should read `reason` and treat db_error as the catch-block-equivalent. |
| `communityPhoto.web.js` | 136 | Captures `rl` whole, doesn't destructure. May already check `rl.reason`. |
| `contactSubmissions.web.js` | 130 | Captures `rateCheck` whole. Same — may already inspect. |
| `swatchRequest.web.js` | 192 + http-functions.js:3207 | Two callers for same collection — confirm consistent handling. |
| `gamificationRateLimit.js` | 60, 71 | Wrapper utility used by other callers. Reading its callers' patterns matters more than the wrapper itself. |

The `tradeInService.web.js` case is interesting — it's the **inverse** of cf-sazb. The author wrote try/catch to fail-open, PR #1288 silently broke that intent. Worth flagging as a sibling P1 fix to cf-sazb.

## Recommended approach: fix at the source

Rather than 50 caller-side patches (high churn, easy to miss new callers), **modify `src/backend/utils/rateLimit.js` to take a policy flag**:

```js
// src/backend/utils/rateLimit.js
export async function checkRateLimit(collection, key, opts = {}) {
  // ... existing logic ...
  } catch (err) {
    logError(`rateLimit.checkRateLimit[${collection}/${storedKey}]`, err);
    if (opts.failOpenOnDbError) {
      // Caller opted in: db outages preserve availability for endpoints
      // whose semantics break worse on silent throttle (errorMonitoring,
      // tradeInService catch-block, email queue retry).
      return { allowed: true, reason: 'db_error_fail_open' };
    }
    // Default — fail closed (cf-3ldu.F2 — security posture)
    return { allowed: false, reason: 'db_error' };
  }
}
```

Caller sites then change one keyword:

```diff
- await checkRateLimit('TradeInRateLimit', email, { max: RL_MAX, windowMs: RL_WINDOW_MS })
+ await checkRateLimit('TradeInRateLimit', email, { max: RL_MAX, windowMs: RL_WINDOW_MS, failOpenOnDbError: true })
```

Benefits:
- Policy lives in one place; new callers can't accidentally pick wrong default
- Default remains fail-closed (preserves cf-3ldu.F2 security posture)
- The 4 known FIX candidates each become one-line opt-ins, no caller logic changes

Drawbacks:
- Two small bugs still need explicit caller fixes: `errorMonitoring.web.js` is already done (cf-sazb), and `tradeInService.web.js` would adopt `failOpenOnDbError: true` to restore the original try/catch fail-open intent

## Suggested follow-up beads

1. **P1** — `tradeInService.web.js` cf-sazb-sibling fix (silent break of intentional fail-open). 1-line change once `failOpenOnDbError` is added.
2. **P2** — Add `failOpenOnDbError` option to `rateLimit.js`. Tests + docstring.
3. **P3** — Audit the 4 FIX candidates above; opt each into `failOpenOnDbError: true` if the operational rationale holds.

## Out of scope for this audit

- Whether cf-3ldu.F2's fail-closed default is correct globally (it is — security posture).
- Whether to instrument `db_error` events (separate observability question).
- Whether other shared utilities (sanitize, hashRateLimitKey) have similar latent post-cf-3ldu interactions.

## References

- Driver fix: cf-sazb (cfutons PR #1305) — pattern reference
- Originating change: cf-3ldu.F2 (PR #1288) — fail-closed semantics
- Implementation: `src/backend/utils/rateLimit.js`
