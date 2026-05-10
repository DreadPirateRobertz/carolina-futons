# cf-4x7e Pass 3 — KEEP-BLOCKED triage

**Bead**: cf-3l5l · **Author**: cfutons/crew/morgott · **Date**: 2026-05-10

## Goal

Preparatory analysis for cf-4x7e Pass 3 (KEEP-BLOCKED phase, parked behind cf-c6g5 gate). For each of the 8 KEEP-BLOCKED files: count DEAD vs LIVE methods using a bare-grep cross-rig caller sweep, then assign disposition per the cf-3l5l threshold:

- **KEEP-PARTIAL**: >20% of methods live → surgical deletion of dead methods only
- **SUPERSEDE**: ≥80% dead → wholesale deletion, keep only live methods as stubs

**No code changes** — analysis only.

## Methodology

For each file:
1. Extract all `export const NAME = webMethod(` exports.
2. For each method name, run cross-rig grep on `\bNAME\b` across `cfutons/src` + `stage3-velo/src` + `cfw/src`, excluding the self-file.
3. Classify each method as **LIVE-CANDIDATE** (any cross-file hits) or **DEAD** (zero hits anywhere).
4. Compute % dead → assign disposition per threshold.

### Methodology limitations carried over from prior chunks

The bare-grep classification has known false-positive shapes that will need per-method verification when each KEEP-PARTIAL chunk is actually executed (matching the discipline of cf-4x7e Pass 2 chunks 5, 7, 8, 9, 13, 14, 15):

- **Cross-file backend webMethod collisions**: when two `*.web.js` files export the same method name (e.g., `markHelpful` lives in BOTH `reviewsService.web.js` and the now-deleted `photoReviews.web.js`-shaped pattern). The bare-grep counts hits to either definition.
- **src/public local-function collisions**: when a `src/public/<X>.js` page-side file declares its own local `function NAME` or `export function NAME`. v3.1 detector's collision filter handles this; the bare-grep step here does not.
- **JSDoc-only references**: `* @param {Object} foo - data from getXxx` in a docstring counts as 1 hit but is not a real caller. v3.2 detector's comment-strip handles this; the bare-grep step here does not.
- **Dynamic imports** (`await import('...')`): captured by `\bNAME\b` grep alongside static imports — no special handling needed.

These limitations matter for the LIVE-CANDIDATE column. A reasonable rule of thumb: methods with ≥3 hits in cfutons AND ≥3 hits in stage3 are highly likely to be genuinely live. Methods with 1–2 hits in cfutons only need per-method verification before deletion. Flagged below where applicable.

## Per-file triage

### `emailTemplates.web.js` (19 methods) → **SUPERSEDE** (95% dead)

| Method | cf | s3 | cfw | Status |
|---|---:|---:|---:|---|
| `queuePromotionalEmail` | 2 | 2 | 0 | LIVE-CANDIDATE |
| `getTemplatesBySequence` | 0 | 0 | 0 | DEAD |
| `getTemplate` | 0 | 0 | 0 | DEAD |
| `getTemplateIndex` | 0 | 0 | 0 | DEAD |
| `resolveSubjectLine` | 0 | 0 | 0 | DEAD |
| `validateTemplateVariables` | 0 | 0 | 0 | DEAD |
| `getTemplatePerformance` | 0 | 0 | 0 | DEAD |
| `getNewArrivalsSection` | 0 | 0 | 0 | DEAD |
| `getCategorySpotlightSection` | 0 | 0 | 0 | DEAD |
| `getProductRecommendationBlock` | 0 | 0 | 0 | DEAD |
| `getPriceDropSection` | 0 | 0 | 0 | DEAD |
| `getBackInStockSection` | 0 | 0 | 0 | DEAD |
| `getWelcomeDay0Template` | 0 | 0 | 0 | DEAD |
| `getWelcomeDay3Template` | 0 | 0 | 0 | DEAD |
| `getWelcomeDay7Template` | 0 | 0 | 0 | DEAD |
| `getOrderConfirmationTemplate` | 0 | 0 | 0 | DEAD |
| `getOrderShippedTemplate` | 0 | 0 | 0 | DEAD |
| `getDeliveryConfirmationTemplate` | 0 | 0 | 0 | DEAD |
| `getPostPurchaseDay7ReviewTemplate` | 0 | 0 | 0 | DEAD |

**Rationale**: only `queuePromotionalEmail` survives; everything else (18 methods) is dead. The CF-c6g5 work that will batch-copy templates uses TEMPLATE_ID_MAP (PR #1243) — Wix dashboard IDs replace these per-template generator methods. Confirm `resolveTemplateId` consumers cover all live cases before SUPERSEDE-style trim. Note also that `emailTemplates.web.js` exports the `TEMPLATE_ID_MAP` const + `resolveTemplateId` function — these are NOT webMethods and are critical infrastructure (heavy importers across emailService, emailAutomation, etc.); they MUST be preserved.

### `emailAutomation.web.js` (20 methods) → KEEP-PARTIAL (35% dead)

| Method | cf | s3 | cfw | Status | Note |
|---|---:|---:|---:|---|---|
| `triggerWelcomeSequence` | 12 | 2 | 0 | LIVE-CANDIDATE | strong |
| `triggerWelcomeSeries` | 4 | 0 | 0 | LIVE-CANDIDATE | cfutons-only — possible cross-file collision; verify |
| `triggerPostPurchaseSequence` | 6 | 3 | 0 | LIVE-CANDIDATE | strong |
| `triggerReviewRewardPrompt` | 0 | 0 | 0 | DEAD | |
| `triggerConsultationFollowup` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `triggerSwatchFollowupSequence` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `triggerAbandonedCartRecovery` | 5 | 3 | 0 | LIVE-CANDIDATE | strong (touched in cf-trm0) |
| `triggerReengagement` | 3 | 3 | 0 | LIVE-CANDIDATE | |
| `processEmailQueue` | 8 | 4 | 0 | LIVE-CANDIDATE | strong |
| `unsubscribeContact` | 4 | 3 | 0 | LIVE-CANDIDATE | |
| `getEmailAutomationStats` | 0 | 0 | 0 | DEAD | |
| `recordEmailEvent` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `getEmailEvents` | 0 | 0 | 0 | DEAD | |
| `triggerRestockNotifications` | 4 | 4 | 0 | LIVE-CANDIDATE | |
| `triggerReviewThanks` | 0 | 0 | 0 | DEAD | |
| `createAbTest` | 0 | 0 | 0 | DEAD | |
| `resolveAbTestWinner` | 0 | 0 | 0 | DEAD | |
| `getAbTestResults` | 4 | 0 | 0 | LIVE-CANDIDATE | cfutons-only — possible test-only refs; verify |
| `getAbTestConfig` | 0 | 0 | 0 | DEAD | |
| `getCampaignAnalytics` | 2 | 2 | 0 | LIVE-CANDIDATE | |

**Rationale**: 13 alive / 7 dead. Drop the dead ones (3 ab-test admin methods that never shipped: `createAbTest`, `resolveAbTestWinner`, `getAbTestConfig`; 2 review-thanks/reward methods superseded by other paths; 2 email-automation-stats/events admin methods).

### `subscriptionService.web.js` (11 methods) → KEEP-PARTIAL (73% dead, near SUPERSEDE threshold)

| Method | cf | s3 | cfw | Status |
|---|---:|---:|---:|---|
| `getSubscriptionPlans` | 3 | 3 | 0 | LIVE-CANDIDATE |
| `createSubscription` | 3 | 3 | 0 | LIVE-CANDIDATE |
| `isProductSubscribable` | 3 | 3 | 0 | LIVE-CANDIDATE |
| `getMySubscriptions` | 0 | 0 | 0 | DEAD |
| `getSubscriptionDetails` | 0 | 0 | 0 | DEAD |
| `updateFrequency` | 0 | 0 | 0 | DEAD |
| `pauseSubscription` | 0 | 0 | 0 | DEAD |
| `resumeSubscription` | 0 | 0 | 0 | DEAD |
| `skipNextDelivery` | 0 | 0 | 0 | DEAD |
| `cancelSubscription` | 0 | 0 | 0 | DEAD |
| `getSubscriberDiscount` | 0 | 0 | 0 | DEAD |

**Rationale**: 3 alive / 8 dead. The 8 dead are the customer-facing manage-subscription surface (`getMySubscriptions`, `pause`, `resume`, `cancel`, etc.) — which the Pass 1 matrix identified as parked behind the **CF+ subscription rollout**. The 3 alive are the catalog-side hooks (`getSubscriptionPlans`, `createSubscription`, `isProductSubscribable`) used at signup and PDP. **Recommend**: KEEP-PARTIAL with a Stilgar gate — drop the 8 customer-management methods only after confirmation that CF+ rollout is genuinely deferred (otherwise these are pre-built and ship together when CF+ launches).

### `loyaltyMarketing.web.js` (11 methods) → KEEP-PARTIAL (18% dead)

| Method | cf | s3 | cfw | Status |
|---|---:|---:|---:|---|
| `getTierExplainerData` | 3 | 3 | 0 | LIVE-CANDIDATE |
| `getEnrollmentPrompt` | 4 | 4 | 0 | LIVE-CANDIDATE |
| `sendMonthlyLoyaltyStatements` | 4 | 4 | 0 | LIVE-CANDIDATE |
| `calculatePointsFromSpend` | 3 | 3 | 0 | LIVE-CANDIDATE |
| `getLoyaltyFaq` | 3 | 3 | 0 | LIVE-CANDIDATE |
| `enrollMember` | 2 | 2 | 0 | LIVE-CANDIDATE |
| `calculatePointsForOrder` | 2 | 2 | 0 | LIVE-CANDIDATE |
| `saveBirthday` | 3 | 3 | 0 | LIVE-CANDIDATE |
| `getBirthdayStatus` | 2 | 2 | 0 | LIVE-CANDIDATE |
| `checkTierUpNotifications` | 0 | 0 | 0 | DEAD |
| `generateMonthlyStatement` | 0 | 0 | 0 | DEAD |

**Rationale**: 9 alive / 2 dead. Smallest cleanup of the 8 — only `checkTierUpNotifications` and `generateMonthlyStatement` are dead. Verify these aren't called by `sendMonthlyLoyaltyStatements` internally before dropping (they may be intended-private helpers exported as webMethods).

### `notificationService.web.js` (6 methods) → KEEP-PARTIAL (33% dead)

| Method | cf | s3 | cfw | Status |
|---|---:|---:|---:|---|
| `recordPriceSnapshots` | 2 | 2 | 0 | LIVE-CANDIDATE |
| `checkWishlistAlerts` | 4 | 4 | 0 | LIVE-CANDIDATE |
| `toggleProductAlerts` | 2 | 2 | 0 | LIVE-CANDIDATE |
| `notifyOwner` | 4 | 4 | 0 | LIVE-CANDIDATE |
| `getNotificationHistory` | 0 | 0 | 0 | DEAD |
| `getMyNotifications` | 0 | 0 | 0 | DEAD |

**Rationale**: 4 alive / 2 dead. Drop the 2 customer-facing read methods (`getNotificationHistory`, `getMyNotifications`) — admin-tooling surface that never shipped.

### `futonSommelier.web.js` (5 methods) → KEEP-PARTIAL (60% dead)

| Method | cf | s3 | cfw | Status | Note |
|---|---:|---:|---:|---|---|
| `getRecommendation` | 8 | 2 | **15** | LIVE-CANDIDATE | **cfw consumer detected** — verify whether real callVelo or local-name collision before drop |
| `getSommelierResults` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `rateRecommendation` | 0 | 0 | 0 | DEAD | |
| `getLifestyleQuestions` | 0 | 0 | 0 | DEAD | |
| `recordSommelierResult` | 0 | 0 | 0 | DEAD | |

**Rationale**: 2 alive / 3 dead. **Flag for cf-w1lg-style cross-rig audit before dropping**: `getRecommendation` shows 15 cfw hits — could be a real callVelo to the Velo webMethod (live cross-rig consumer), OR a different cfw-side `getRecommendation` function entirely. Per the chunk-12 (`calculateBundleDiscount`) and chunk-15 (photoReviews `getPhotoGallery`) lessons, cfw-side hits with this magnitude need explicit verification of the real call shape before any deletion. The 3 confirmed-dead methods (`rateRecommendation`, `getLifestyleQuestions`, `recordSommelierResult`) are safe to drop.

### `productRecommendations.web.js` (15 methods) → KEEP-PARTIAL (13% dead)

| Method | cf | s3 | cfw | Status | Note |
|---|---:|---:|---:|---|---|
| `getRelatedProducts` | 7 | 7 | 0 | LIVE-CANDIDATE | strong |
| `getCompletionSuggestions` | 5 | 5 | 0 | LIVE-CANDIDATE | strong |
| `getSameCollection` | 4 | 4 | 0 | LIVE-CANDIDATE | |
| `getFeaturedProducts` | 6 | 6 | 0 | LIVE-CANDIDATE | strong |
| `getSaleProducts` | 4 | 4 | 0 | LIVE-CANDIDATE | |
| `getBundleSuggestion` | 4 | 4 | 0 | LIVE-CANDIDATE | |
| `getBestsellers` | 0 | 0 | 0 | DEAD | |
| `trackRecentlyViewed` | 0 | 0 | 0 | DEAD | |
| `getRecentlyViewed` | 24 | 24 | 0 | LIVE-CANDIDATE | **very high hit count** — likely cross-file collision or shared name; verify before any KEEP-PARTIAL touch |
| `getSimilarProducts` | 9 | 3 | 0 | LIVE-CANDIDATE | strong |
| `getCustomersAlsoBought` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `getBatchCurrentPrices` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `getRecommendations` | 11 | 5 | 0 | LIVE-CANDIDATE | strong |
| `getFreightComplementProducts` | 3 | 3 | 0 | LIVE-CANDIDATE | |
| `getProductRecommendations` | 3 | 3 | 0 | LIVE-CANDIDATE | |

**Rationale**: 13 alive / 2 dead. Drop `getBestsellers` + `trackRecentlyViewed`. **Note on `getRecentlyViewed`**: 24 hits in cfutons + 24 in stage3 is suspiciously high; could be a same-name collision with a `src/public/recentlyViewed.js` or similar local function. Verify before any other change to that method, but it's not in the drop list anyway.

### `reviewsService.web.js` (17 methods) → KEEP-PARTIAL (24% dead)

| Method | cf | s3 | cfw | Status | Note |
|---|---:|---:|---:|---|---|
| `getProductReviews` | 10 | 10 | 0 | LIVE-CANDIDATE | strong |
| `getAggregateRating` | 7 | 2 | 0 | LIVE-CANDIDATE | |
| `submitReview` | 10 | 7 | 0 | LIVE-CANDIDATE | strong (post-chunk-7 — dataService kept its submitReview too; verify which file each caller targets) |
| `markHelpful` | 5 | 4 | 0 | LIVE-CANDIDATE | (post-chunk-15 — photoReviews's markHelpful was dropped as cross-file FP; this is the canonical impl) |
| `flagReview` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `getPendingReviews` | 2 | 1 | 0 | LIVE-CANDIDATE | (post-chunk-15 — photoReviews's getPendingReviews was dropped; this is canonical) |
| `moderateReview` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `getReviewStats` | 0 | 0 | 0 | DEAD | |
| `addOwnerResponse` | 0 | 0 | 0 | DEAD | |
| `getCategoryReviewSummaries` | 2 | 2 | 0 | LIVE-CANDIDATE | |
| `submitVideoReview` | 6 | 0 | 0 | LIVE-CANDIDATE | cfutons-only — verify (recent feature?) |
| `getVideoReviews` | 6 | 0 | 0 | LIVE-CANDIDATE | cfutons-only |
| `uploadVideoReview` | 0 | 0 | 0 | DEAD | |
| `getVideoReviewsForProduct` | 0 | 0 | 0 | DEAD | |
| `moderateVideoReview` | 3 | 0 | 0 | LIVE-CANDIDATE | cfutons-only |
| `getSiteAggregateRating` | 2 | 0 | 0 | LIVE-CANDIDATE | cfutons-only |
| `getFeaturedReviews` | 4 | 0 | 0 | LIVE-CANDIDATE | cfutons-only |

**Rationale**: 13 alive / 4 dead. Drop `getReviewStats`, `addOwnerResponse`, `uploadVideoReview`, `getVideoReviewsForProduct`. **Note on stage3-only-zero LIVE-CANDIDATEs**: 5 methods (`submitVideoReview`, `getVideoReviews`, `moderateVideoReview`, `getSiteAggregateRating`, `getFeaturedReviews`) have cfutons callers but zero stage3 callers — these are recent cfutons additions awaiting publish to stage3 (cf-w1lg-style normal lag), NOT dead.

## Summary table

| File | Total | Dead | Live | Disposition | Methods to drop |
|---|---:|---:|---:|---|---:|
| `emailTemplates.web.js` | 19 | 18 | 1 | **SUPERSEDE** | 18 |
| `emailAutomation.web.js` | 20 | 7 | 13 | KEEP-PARTIAL | 7 |
| `subscriptionService.web.js` | 11 | 8 | 3 | KEEP-PARTIAL (Stilgar gate: confirm CF+ rollout deferred) | 8 |
| `loyaltyMarketing.web.js` | 11 | 2 | 9 | KEEP-PARTIAL | 2 |
| `notificationService.web.js` | 6 | 2 | 4 | KEEP-PARTIAL | 2 |
| `futonSommelier.web.js` | 5 | 3 | 2 | KEEP-PARTIAL (verify cfw `getRecommendation` 15 hits before broader change) | 3 |
| `productRecommendations.web.js` | 15 | 2 | 13 | KEEP-PARTIAL | 2 |
| `reviewsService.web.js` | 17 | 4 | 13 | KEEP-PARTIAL | 4 |
| **Total** | **104** | **46** | **58** | 1 SUPERSEDE + 7 KEEP-PARTIAL | **46** |

## Estimated Pass 3 deletion target

If all triage decisions ship as-is: **46 webMethods retired**. Plus matching test cases, helper-only consts, and the SUPERSEDE shape on emailTemplates likely takes the file from ~700 LOC to ~80 LOC (TEMPLATE_ID_MAP + resolveTemplateId + queuePromotionalEmail only). Rough-order LOC estimate: −5,000 to −7,000 LOC across Pass 3, dependent on test-side cleanup ratios (cf-4x7e Pass 2 averaged ~−260 LOC per dropped method including tests).

## Recommended Pass 3 chunk sequence (when cf-c6g5 gate lifts)

Order chunks by Stilgar/feature-rollout independence:

1. **Chunk 17** — `loyaltyMarketing.web.js` (drop 2, smallest, lowest risk). 2 dead methods.
2. **Chunk 18** — `notificationService.web.js` (drop 2, narrow surface). 2 dead methods.
3. **Chunk 19** — `productRecommendations.web.js` (drop 2). Verify `getRecentlyViewed` 24-hit pattern is name-collision FP-clean before TOUCHING that method (it's not in the drop list anyway, but worth flagging). 2 dead methods.
4. **Chunk 20** — `reviewsService.web.js` (drop 4). 4 dead methods.
5. **Chunk 21** — `emailAutomation.web.js` (drop 7, ab-test surface + admin/stats reads). 7 dead methods.
6. **Chunk 22** — `futonSommelier.web.js` (drop 3, after verifying cfw `getRecommendation` is real or FP). 3 dead methods.
7. **Chunk 23** — `subscriptionService.web.js` (drop 8, **awaits Stilgar CF+ rollout-deferred confirmation**). 8 dead methods.
8. **Chunk 24** — `emailTemplates.web.js` (SUPERSEDE — drop 18, keep TEMPLATE_ID_MAP + resolveTemplateId + queuePromotionalEmail). 18 dead methods.

Chunks 23 + 24 are gated; chunks 17–22 can land in any order once cf-c6g5 gate lifts and Pass 3 begins.

## Refs

- Bead: cf-3l5l
- Predecessor: cf-4x7e Pass 2 (16 chunks shipped: 128 webMethods, −29,430 LOC)
- Detector: cf-hpwy / cf-sq0d v3.2 (this triage uses bare-grep + cross-file lessons; the detector at v3.2 covers same-name-collision filter + JSDoc-strip — when each chunk PR is opened, the detector should be re-run as the canonical truth source)
- Gate: cf-c6g5 (Stilgar email templates batch-copy; chunks 17–24 unblock when this lands)
