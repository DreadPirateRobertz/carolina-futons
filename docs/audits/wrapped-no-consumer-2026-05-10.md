# cf-hpwy v3 audit — WRAPPED-NO-CONSUMER triage (2026-05-10)

47 webMethods classified by cf-hpwy v3 as `WRAPPED-NO-CONSUMER` (HTTP-exposed via http-functions.js but no cfw-side caller). This doc classifies them by call shape so the next planning pass can decide what to deprecate vs keep.

## Classification summary

| Bucket           | Count | Notes |
| ---------------- | ----- | ----- |
| **CRON**         | 8     | Called by `get_<x>Cron` HTTP wrappers (scheduled jobs). Alive. |
| **LEGACY-PUBLIC**| 35    | Reachable via direct `/_functions/<x>` URLs. Alive (may be Wix-Studio-page consumers, third-party POSTs, or admin tools). |
| **TRULY-ORPHAN** | 2     | Imported into http-functions.js but never dispatched. Cleanup candidates. |
| (Misclassified)  | 2     | wishlist methods alive via `post_wishlistService` dispatcher (allowlist + dynamic call). v3 detector limitation. |

Total: 47.

## TRULY-ORPHAN candidates (immediate cleanup)

### 1. `triggerPostPurchaseSequence` — `src/backend/marketingSequences.web.js:157`

**Status:** Truly dead. The http-functions.js import block at line 13 only pulls `scanAndTriggerWinback` + `runReviewRequestEmails` from `marketingSequences.web.js` — `triggerPostPurchaseSequence` is NOT imported. There is also a same-named `triggerPostPurchaseSequence` in `emailAutomation.web.js:584` which IS the wired one (called from events.js:241 + emailAutomation.web.js:212/317). The `marketingSequences.web.js` version is a duplicate orphan.

**Cleanup shape:** trim the function from `marketingSequences.web.js` (lines 144-175 approx). Likely also trim a corresponding test block in `tests/marketingSequences*.test.js`.

### 2. `getAssemblyFollowUpData` — `src/backend/postPurchaseCare.web.js:355`

**Status:** Imported at `http-functions.js:16` but no wrapper body calls it. Test file exists at `tests/postPurchaseCareHardening.test.js` (5 cases). The import looks like a leftover — an earlier wrapper that got removed without dropping the import or the source export.

**Cleanup shape:** drop the import line in http-functions.js + delete the function from `postPurchaseCare.web.js` + drop the test block. Verify `tests/postPurchaseCareHardening.test.js` has other content to keep before fully deleting it.

## CRON (8 — alive, no action)

All called by scheduled HTTP cron functions:
- `sendWeeklyBlogDigest` ← `get_weeklyBlogDigestCron`
- `processContentSchedule` ← `get_processContentScheduleCron`
- `triggerAbandonedCartRecovery` ← `get_triggerCartRecoveryCron`
- `triggerReengagement` ← `get_triggerReengagementCron`
- `processEmailQueue` ← `get_processEmailQueueCron` + `get_processPostPurchaseCareCron`
- `triggerBrowseRecovery` ← `get_triggerBrowseRecoveryCron`
- `runReviewRequestEmails` ← `get_runReviewRequestEmailsCron`
- `scanAndTriggerWinback` ← `get_scanAndTriggerWinbackCron`

## LEGACY-PUBLIC (35 — alive, audit-only)

Each has a corresponding `(get|post|options)_<name>` HTTP wrapper. Reachable via `/_functions/<name>`. May or may not have actual external callers — to confirm, would need:
1. Wix Studio Velo page audit (legacy front-end widgets)
2. Third-party webhook/POST audit (Stripe, mail providers, etc)
3. Admin-tool audit (Wix dashboard custom widgets)

Not enumerated here — would need a follow-on bead per service. Top-level by file:
- emailAutomation.web.js (5)
- giftRegistry.web.js (5)
- referralService.web.js (4)
- bundleDeals.web.js (3)
- productQA.web.js (3)
- emailService.web.js (2)
- notificationService.web.js (2)
- (12 others, 1 each)

## Misclassified (2 — v3 detector limitation)

The cf-hpwy v3 detector's `WRAPPED-NO-CONSUMER` verdict requires a direct cfw URL/callVelo reference, but cfw can also reach a webMethod via a dispatcher pattern:

```js
// http-functions.js
import * as wishlistServiceModule from 'backend/wishlistService.web';
const ALLOWLIST = new Set(['removeFromWishlist','isOnWishlist',...]);
export async function post_wishlistService(request) {
  const method = request.path[0];
  if (!ALLOWLIST.has(method)) return notFound(...);
  await wishlistServiceModule[method](...args); // ← dynamic dispatch
}
```

The `wishlistServiceModule[method]()` call site can't be matched by name-based grep. cfw calls `/_functions/wishlistService/removeFromWishlist` and the dispatcher forwards it.

False-positives in this batch:
- `removeFromWishlist` (wishlistService.web.js:109)
- `isOnWishlist` (wishlistService.web.js:221)

**v3 detector follow-up (cf-hpwy v4?):** add a "module-namespace dispatcher" pattern to the classifier — when http-functions.js imports `* as <module>` and calls `<module>[<dynamic-key>](...)`, every export of that module should be considered HTTP-EXPOSED with a wrapper. Out of scope for this audit; surfaced for melania's planning.

## Recommended action

1. **File 1 small bead per TRULY-ORPHAN** (or batch as a single chunk): trim `triggerPostPurchaseSequence` from marketingSequences + drop `getAssemblyFollowUpData` + its dead import. Same shape as cf-567r/cf-q5hd/cf-cw6e (cf-hpwy v3 cleanup batch).
2. **Defer the 35 LEGACY-PUBLIC** — they're alive at the http surface, deprecation requires a real consumer audit per service.
3. **File a v3 detector enhancement bead** for the dispatcher-pattern blind-spot (low priority — affects only the 2 wishlist methods today).

## Source

Raw classification data: `/tmp/wrapped-no-consumer-classified.json` (radahn local, 2026-05-10).
Audit script: ad-hoc in `/Users/hal/gt/cfutons/crew/radahn` working session — uses `scripts/cf-dead-routes/audit.py`'s output + a wrapper-body regex pass over `src/backend/http-functions.js`.
