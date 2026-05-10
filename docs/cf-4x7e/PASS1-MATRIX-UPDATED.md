# cf-4x7e Pass 1 Matrix — UPDATED post-SUPERSEDE

> **Generated**: 2026-05-10 by miquella · **Bead**: cf-4x7e.1 · **Supersedes**: [`docs/cf-66ne-phase-b2-decision-matrix-2026-05-10.md`](../cf-66ne-phase-b2-decision-matrix-2026-05-10.md) (PR #1209)
>
> Pass 2 (8 chunks) deleted 73 methods · Detector now runs at **v3** (cf-sq0d / PR #1223) which adds the **PATH-REFERENCED** bucket — promotes any method whose defining file is named as a quoted-string path in another source (mostly test imports). Numbers below reflect the v3 lens; the column **PATH-ONLY** is what v2 would have called DEAD but tests still couple the file's existence to its consumers.

---

## Detector baseline (current main, v3)

| Bucket | Pass 1 (v2, pre-Pass-2) | Now (v3, post-Pass-2) | Δ |
|---|---:|---:|---:|
| Total webMethods | 985 | 914 | −71 |
| HTTP-EXPOSED | 80 | 80 | 0 |
| EVENT-WIRED (any) | 9 | 9 | 0 |
| FRONTEND (any) | 375 | 375 | 0 |
| INTERNAL (any) | 230 | 230 | 0 |
| **PATH-REFERENCED** (any, NEW v3) | n/a | **908** | — |
| DEAD (zero callers / paths) | **437** | **4** | −433 |

| Gap-verdict | Pass 1 | Now |
|---|---:|---:|
| VELO-INTERNAL | 451 | 812 |
| UNUSED-CAN-DELETE | 435 | **4** |
| WRAPPED-NO-CONSUMER | 51 | 51 |
| OK-WIRED | 29 | 29 |
| MAYBE-CFW-NAME-COLLISION | 19 | 18 |

The DEAD column collapsed almost entirely because v3 picks up the test-import path strings that v2 missed. **The 4 remaining true-DEAD methods are the only deletions that need zero further audit.**

---

## DELETED — Pass 2 chunks (8 files, ~73 methods, −15,917 LOC)

morgott completed all 8 chunks. Each file removed both the .web.js source and its .test.js companion(s). Tests for the deleted modules also went with each chunk so the post-Pass-2 detector run sees no orphan path-references for these.

| File | Pass 2 chunk | Verdict |
|---|---:|---|
| `accessibility.web.js` | 1 | DELETE-NOW-SAFE |
| `liveShopping.web.js` | 1 | DELETE-NOW-SAFE |
| `tradeProgram.web.js` | 2 | DELETE-NOW-SAFE |
| `productPassport.web.js` | 3 | DELETE-NOW-SAFE |
| `socialStoryScheduler.web.js` | 4 | DELETE-NOW-SAFE |
| `fulfillment.web.js` | 4 | DELETE-NOW-SAFE |
| `deliveryTracker.web.js` | 4 | DELETE-NOW-SAFE |
| `bundleBuilder.web.js` (partial) | 5 | SUPERSEDE — kept 2 alive admin methods, dropped 9 dead |
| `dataService.web.js` (partial) | 6 | SUPERSEDE — kept 2 vestigial alive, dropped 6 dead |
| `catalogImport.web.js` | 7 | DELETE-NOW-SAFE (originally hit the cf-sq0d path-ref blind-spot; resolved) |
| `blogService.web.js` (partial) | 8 | SUPERSEDE — kept 4 alive, dropped 5 dead |

(Per the morgott Wave 10 progress report. The exact per-chunk file mix may not match the original Pass 1 sequencing — order was reshuffled mid-execution; the verdicts above are the as-merged truth.)

---

## KEEP-PARTIAL — Pass 3 candidates (8 files, surgical chunks)

Each file below has at least one method with a real symbol caller (ALIVE) plus several methods that are PATH-ONLY (test-import-only). Per the cf-sq0d v3 lens, **PATH-ONLY methods are still safely deletable as long as the corresponding test files are removed in the same chunk** — there are zero non-test references.

morgott's Pass 3 unit of work: per-file PR that drops PATH-ONLY methods + their test cases, preserves the ALIVE subset.

### `errorMonitoring.web.js` — 9 methods (alive 1 / path-only 8)

| Method | Status | Caller |
|---|---|---|
| `logError` | ALIVE | `challengeService.web.js`, `swatchAttribution.web.js`, +20 more |
| `getErrorDashboard` | path-only | tests |
| `getErrorDetails` | path-only | tests |
| `updateErrorGroupStatus` | path-only | tests |
| `checkErrorRateSpike` | path-only | tests |
| `getErrorFrequency` | path-only | tests |
| `configureAlert` | path-only | tests |
| `getAlertRules` | path-only | tests |
| `checkAlertConditions` | path-only | tests |

**Pass 3 action**: keep `logError`; drop the 8 admin-dashboard methods + `tests/errorMonitoring*.test.js` cases that exercise them.

### `wishlistAlerts.web.js` — 8 methods (alive 1 / path-only 7)

| Method | Status | Caller |
|---|---|---|
| `checkBackInStock` | ALIVE | `src/public/AddToCart.js` |
| `recordPriceSnapshot` | path-only | tests |
| `getPriceHistory` | path-only | tests |
| `checkPriceDrops` | path-only | tests |
| `checkLowStock` | path-only | tests |
| `getAlertPrefs` | path-only | tests |
| `updateAlertPrefs` | path-only | tests |
| `getAlertHistory` | path-only | tests |

**Pass 3 action**: keep `checkBackInStock`; drop the 7 dashboard / preference helpers + their test files.

### `coreWebVitals.web.js` — 8 methods (alive 1 / path-only 7)

| Method | Status | Caller |
|---|---|---|
| `reportMetrics` | ALIVE | `src/pages/masterPage.js` (same-file caller too) |
| `getPerformanceSummary` | path-only | tests |
| `getPagePerformance` | path-only | tests |
| `getImageOptimizationHints` | path-only | tests |
| `getLazyLoadConfig` | path-only | tests |
| `checkPerformanceBudget` | path-only | tests |
| `getBaseline` | path-only | tests |
| `measureVitals` | path-only | tests |

**Pass 3 action**: keep `reportMetrics` (the wired ingestion path); drop the 7 dashboard helpers (Vercel Web Vitals supersedes them).

### `warrantyService.web.js` — 9 methods (alive 2 / path-only 7)

| Method | Status | Caller |
|---|---|---|
| `registerWarranty` | ALIVE | `src/pages/Warranty Registration.js` |
| `getMyWarranties` | ALIVE | `src/public/WarrantyWidget.js` |
| `getWarrantyPlans` | path-only | tests |
| `calculateWarrantyPrice` | path-only | tests |
| `purchaseWarranty` | path-only | tests |
| `getWarrantyDetails` | path-only | tests |
| `submitClaim` | path-only | tests |
| `getClaimStatus` | path-only | tests |
| `getMyClaims` | path-only | tests |

**Pass 3 action**: keep `registerWarranty` + `getMyWarranties`; drop the 7 plan / claim methods. (Verify with Stilgar: any plan to wire claims UI? If yes, demote to KEEP-BLOCKED.)

### `dynamicPricing.web.js` — 7 methods (alive 1 / path-only 6)

| Method | Status | Caller |
|---|---|---|
| `calculateBundleDiscount` | ALIVE | `src/public/bundleDiscountExperiment.js` |
| `calculateDynamicPrice` | path-only | tests |
| `evaluateClearanceCandidates` | path-only | tests |
| `recordDemandSignal` | path-only | tests |
| `getDemandMetrics` | path-only | tests |
| `getClearanceQueue` | path-only | tests |
| `updatePricingRule` | path-only | tests |

**Pass 3 action**: keep `calculateBundleDiscount`; drop the 6 demand / clearance methods. The dynamic-pricing dashboard never shipped.

### `inventoryService.web.js` — 10 methods (alive 4 / path-only 6)

| Method | Status | Caller |
|---|---|---|
| `getStockStatus` | ALIVE | `inventoryAlerts.web.js`, `liveInventory.web.js` |
| `getLowStockAlerts` | ALIVE | `inventoryAlerts.web.js` |
| `signUpBackInStock` | ALIVE | `liveInventory.web.js` |
| `getInventoryUrgency` | ALIVE | `src/public/inventoryUrgency.js` |
| `getInventoryDashboard` | path-only | tests |
| `updateStockLevel` | path-only | tests |
| `getRestockSuggestions` | path-only | tests |
| `getBackInStockSignups` | path-only | tests |
| `getBackInStockDashboard` | path-only | tests |
| `markSignupsNotified` | path-only | tests |

**Pass 3 action**: keep the 4 alive methods; drop the 6 dashboard / admin helpers.

### `photoReviews.web.js` — 6 methods (alive 1 / path-only 5)

| Method | Status | Caller |
|---|---|---|
| `submitPhotoReview` | ALIVE | `src/pages/Submit Photo Review.js` |
| `getPhotoReviews` | path-only | tests |
| `moderatePhotoReview` | path-only | tests |
| `getPhotoGallery` | path-only | tests |
| `reportPhotoReview` | path-only | tests |
| `getPhotoReviewStats` | path-only | tests |

**Pass 3 action**: keep `submitPhotoReview`; drop the 5 admin / read methods. (Confirm with Stilgar: photo gallery feature deferred or shipped via cfw alone?)

### `affiliateProgram.web.js` — 10 methods (alive 2 / path-only 8)

| Method | Status | Caller |
|---|---|---|
| `getMyAffiliateLinks` | ALIVE | `src/public/affiliateHelpers.js` |
| `getAffiliateDashboard` | ALIVE | `src/public/affiliateHelpers.js` |
| `applyForAffiliate` | path-only | tests |
| `getMyAffiliateAccount` | path-only | tests |
| `createAffiliateLink` | path-only | tests |
| `recordAffiliateConversion` | path-only | tests |
| `getMyCommissions` | path-only | tests |
| `requestPayout` | path-only | tests |
| `getMyPayouts` | path-only | tests |
| `updatePaymentInfo` | path-only | tests |

**Pass 3 action**: keep the 2 dashboard methods; drop the 8 application / payout helpers. (Note: original matrix listed `applyForAffiliate` as alive — under v3 the only quote of its name is in tests and `affiliateHelpers.js` doesn't actually call it; confirm before deletion.)

---

## KEEP-FULL — alive across the board (no Pass 3 work)

Files where every webMethod has a real caller; nothing to surgically remove.

| File | Methods | All alive? |
|---|---:|---|
| `bundleBuilder.web.js` | 2 | ✓ post-Pass-2-chunk-5 |
| `dataService.web.js` | 2 | ✓ post-Pass-2-chunk-6 (1 ALIVE + 1 PATH-ONLY — vestigial single-method file; treat as DELETE-WHOLE if the path-only test gets retired) |
| `blogService.web.js` | 4 | ✓ post-Pass-2-chunk-8 |

---

## KEEP-BLOCKED — wait for external work (3 files, Pass 1 originals)

These ride out the originally-flagged blockers; not Pass 3 candidates.

| File | Methods (alive / path-only) | Blocker |
|---|---|---|
| `emailTemplates.web.js` | 19 (1 / 18) | **cf-c6g5** Stilgar dashboard template population. Once the 20 Triggered Email templates land, several `templateRegistry` consumers wire up. |
| `emailAutomation.web.js` | 17 (10 / 7) | **cf-c6g5**. The 7 path-only methods (review-thanks, stats, etc.) fire only after templates exist. |
| `subscriptionService.web.js` | 11 (3 / 8) | CF+ subscription rollout. The 8 path-only methods are the customer-facing surface (`cancelSubscription`, `pauseSubscription`, …). |

---

## DEFER — admin / partial features (4 files, Pass 1 originals)

Re-evaluate at next sync; not Pass 3 priority.

| File | Methods (alive / path-only) | Why defer |
|---|---|---|
| `smsService.web.js` | 12 (6 / 6) | SMS infra partly live; the 6 path-only methods may wire post-cf-c6g5. |
| `virtualConsultation.web.js` | 10 (5 / 5) | Half-shipped feature. The 5 path-only methods may be customer-facing surfaces still pending. |
| `contentOrchestrator.web.js` | 7 (2 / 5) | Admin tooling. Defer until next admin-tooling audit. |
| `postPurchaseCare.web.js` | 7 (2 / 5) | Like emailAutomation, may wire post-cf-c6g5. |

---

## Recommended Pass 3 PR sequence

Order by least-risk first. Each PR drops PATH-ONLY methods + their corresponding tests; preserves the ALIVE subset.

1. **PR-1**: `errorMonitoring.web.js` (8 methods + tests) — admin-dashboard surface, low-risk.
2. **PR-2**: `coreWebVitals.web.js` (7 methods + tests) — superseded by Vercel Web Vitals.
3. **PR-3**: `wishlistAlerts.web.js` (7 methods + tests) — admin / preference helpers.
4. **PR-4**: `dynamicPricing.web.js` (6 methods + tests) — clearance dashboard never shipped.
5. **PR-5**: `inventoryService.web.js` (6 methods + tests) — admin/dashboard subset.
6. **PR-6**: `photoReviews.web.js` (5 methods + tests) — pending Stilgar confirmation on gallery feature.
7. **PR-7**: `warrantyService.web.js` (7 methods + tests) — pending Stilgar confirmation on claims UI.
8. **PR-8**: `affiliateProgram.web.js` (8 methods + tests) — confirm `applyForAffiliate` is genuinely unused first.

Total Pass 3 deletion target: ~54 methods + their test files. Estimate: 8 small PRs at ~30–60 min each.

## Two open Stilgar checks

Two of the eight Pass 3 candidates need a product call before the chunk lands:

- `photoReviews`: gallery / moderation feature shipped via cfw alone, or deferred with these helpers as the future wire-up?
- `warrantyService`: claims UI a planned feature, or fully deferred?

Both default-safe to delete the path-only methods; if either becomes a planned feature, they demote to KEEP-BLOCKED.

## Refs
- Pass 1 (original): `docs/cf-66ne-phase-b2-decision-matrix-2026-05-10.md` (PR #1209)
- Pass 2 chunks: PR #1217 / #1219 / etc. — see git log `cf-4x7e Pass 2`
- Detector v3 (added PATH-REFERENCED bucket): cf-sq0d / PR #1223
- Parent epic: cf-66ne · `docs/cf-66ne-phase-b-audit-2026-05-09.md`
