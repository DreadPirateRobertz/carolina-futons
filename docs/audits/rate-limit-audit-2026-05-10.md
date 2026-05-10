# Rate-limit audit — checkRateLimit call sites + drift — 2026-05-10

**Bead:** cf-3ldu
**Auditor:** rennala
**Method:** Static enumeration of every `checkRateLimit(...)` call across `src/backend/` + grep for local rate-limit re-implementations. Captured per-call-site (collection, max, windowMs) tuples and grouped by domain.
**Pre-cutover scope:** every wixData rate-limit collection a real call path depends on must exist in the staging CMS BEFORE DNS flip, or the helper logs an error and fails-open (no protection) on every request.

## TL;DR

**75 `checkRateLimit` call sites across 43 distinct rate-limit collections** + 1 module-local helper (`gamificationRateLimit.js`) wrapping the canonical helper. Plus **3 services with local re-implementations** that bypass the canonical helper.

**One P1 finding:** `returnsService.web.js` uses an in-memory `Map` for rate-limiting — does NOT survive Velo serverless instance cold-starts, and doesn't share state across concurrent instances. Effectively no rate-limit protection on `lookupReturn` / `submitGuestReturn` against an attacker who knows the Wix scale-out behavior.

**One P2 finding:** the canonical helper [fails open on DB error](src/backend/utils/rateLimit.js:154-157), which is correct for legitimate-user availability — but means every missing rate-limit CMS collection at cutover silently disables protection without alerting. Pre-cutover collection-existence verification is therefore non-optional.

**Two P3 findings:** drift in default `max=3, windowMs=1h` between similar surfaces; local newsletter helper that predates the canonical helper.

## Inventory

### Canonical helper
[`src/backend/utils/rateLimit.js`](src/backend/utils/rateLimit.js) — defaults `RATE_LIMIT_MAX = 3, RATE_LIMIT_WINDOW_MS = 1 hour`. Backed by per-collection wixData buckets. Trusted client IP via `extractTrustedClientIp()` (X-Forwarded-For with 1 trusted proxy = Wix edge). FNV-1a hashes keys before storing (CF-sec1 CMEK compliance).

Imported in 38 files via `import { checkRateLimit } from 'backend/utils/rateLimit'`.

### Wrapper helper
[`src/backend/utils/gamificationRateLimit.js`](src/backend/utils/gamificationRateLimit.js) — wraps canonical helper with two-layer protection (per-actionType bucket + per-user daily cap). `GAMIFICATION_ACTION_LIMITS` defines per-action max/window.

### 43 distinct rate-limit collections

Grouped by domain. Each row: collection · max · windowMs · representative anchor.

#### High-traffic public surfaces (per-minute windows)
| Collection | max | windowMs | Anchor |
|------------|-----|----------|--------|
| `AnalyticsEventRateLimit` | 60 | 60_000 | `analyticsHelpers.web.js:49` (4 sites total) |
| `LeaderboardPublicRateLimit` | 60 | 60_000 | `http-functions.js:2272` |
| `BadgesPublicRateLimit` | 30 | 60_000 | `http-functions.js:2388` |
| `BusEventRateLimit` | 30 | 60_000 | `http-functions.js:2499` |
| `EmailEventRateLimit` | 60 | 60_000 | `emailAutomation.web.js:1443` |
| `ChatMessageRateLimit` | 30 | 60_000 | `liveChatService.web.js:152` |
| `MetricsReportRateLimit` | 30 | 60_000 | `coreWebVitals.web.js:85` |
| `ViewerCountRateLimit` | 60 | 60_000 | `socialProof.web.js:246` |
| `ViewerTrackerRateLimit` | (varies) | 60_000 | `viewerTracker.web.js:44` |
| `AchievementsRateLimit` | 20 | 60_000 | `loyaltyService.web.js:642` |
| `AbTestEventRateLimit` | (varies) | 60_000 | various |
| `BrowseSessionRateLimit` | (varies) | 60_000 | various |
| `CheckoutTrackingRateLimit` | (varies) | 60_000 | various |
| `ConversionFunnelRateLimit` | 10 | 60_000 | `conversionFunnel.web.js:77` |
| `VisualSearchExportRateLimit` | 10 | 60_000 | `visualSearchExport.web.js:188` |
| `ErrorLogRateLimit` | (varies) | 60_000 | various |
| `ExperimentVariantRateLimit` | (varies) | 60_000 | various |

#### Per-hour windows (default 3/hr unless overridden)
| Collection | max | Anchor |
|------------|-----|--------|
| `QARateLimit` | 3 (default) | `productQA.web.js:426` |
| `ReviewRateLimit` | 3 (default) | `dataService.web.js:167` |
| `BackInStockRateLimit` | 3 (default) | `inventoryService.web.js:122` |
| `ContactRateLimits` | 3 (default) | `contactSubmissions.web.js:130` (note: plural, drift-prone) |
| `QuizLeadRateLimit` | 3 (default) | `styleQuiz.web.js:323` |
| `RegistryPurchaseRateLimit` | 3 (default) | `giftRegistry.web.js:381` |
| `WhiteGloveBookingRateLimit` | 3 (default) | `whiteGloveScheduling.web.js:237` |
| `SupportTicketRateLimit` | 3 (default) | `liveChatService.web.js:242` |
| `PriceLockRateLimit` | 3 | `priceLock.web.js:77` |
| `SommelierRateLimit` | 5 | `futonSommelier.web.js:145` |
| `BundleAddRateLimit` | 10 | `bundleService.web.js:161` |
| `ComfortTimelineRateLimit` | 10 | `comfortTimeline.web.js:136` |
| `GiftCardBalanceRateLimit` | 10 | `giftCards.web.js:117` |
| `TrackingRateLimit` | 5/10 | `orderTracking.web.js:70/192/266` (3 call sites with mixed limits) |
| `SwatchRequestRateLimit` | 5 | `http-functions.js:3208` |
| `ResubscribeRateLimit` | 5 | `unsubscribeService.web.js:52` |
| `UnsubscribeRateLimit` | 100 | `emailAutomation.web.js:1341` |
| `RealRoomsRateLimit` | (custom) | `realRoomsGallery.web.js:61` |
| `CommunityPhotoRateLimit` | (custom) | `communityPhoto.web.js:136` |
| `CustomerRoomPhotosRateLimit` | (custom) | `customerRoomPhotos.web.js:74` |
| `RemindMeRateLimit` | (varies) | various |
| `ProtectionPlanRateLimit` | (varies) | various |
| `ComparisonRateLimit` | (varies) | various |
| `CouponValidationRateLimit` | (varies) | various |
| `DeliveryReservationRateLimit` | (varies) | various |
| `SpinWheelRateLimit` | (varies) | various |
| `ActivityRateLimit` | (varies) | `loyaltyService.web.js:869` |
| `BurnRateLimit` | (varies) | `loyaltyService.web.js:941` |

### Local re-implementations (non-canonical)

| File | Pattern | Storage | Risk |
|------|---------|---------|------|
| `returnsService.web.js:46-72` | `_checkRateLimit(identifier)` over module-scope `Map` | **in-memory** | **F1 below** — does not survive cold-starts or scale-out |
| `styleConsultant.web.js:176` | per-session counter on session record | session CMS row | OK — different model (per-session AI-cost protection), legitimately not bucketed by key |
| `newsletterService.web.js:49-95` | `_checkRateLimit(key)` over `NewsletterRateLimit` collection | wixData (its own collection) | OK functionally; F4 below — predates the canonical helper, could be migrated |

## Findings

### F1 (P1) — `returnsService.web.js` rate-limit is in-memory only
**Where:** `src/backend/returnsService.web.js:46-72` (`_checkRateLimit`) called from `:382` (`lookupReturn`) and `:452` (`submitGuestReturn`).

**Why it's P1:** the module-scope `_rateLimitMap = new Map()` lives in a single Velo serverless instance's memory. Wix Velo can — and does — spin up multiple concurrent instances under load. Each instance has its own empty Map. An attacker who:
- Sends 5 requests fast → some land on instance A (1-5/5), some land on instance B (1-5/5)
- Effective rate = N × 5 per 60s where N = instance count

Plus: cold-start resets clear all timestamps. Sustained low-and-slow brute force trivially bypasses.

**The threat the comment claims to defend:** `// Prevents order enumeration via brute-force lookupReturn/submitGuestReturn.` — the protection does not actually exist as documented. **Customer order enumeration via the public guest return endpoint is feasible.**

**Fix:** swap to canonical `checkRateLimit('ReturnsLookupRateLimit', cleanEmail, { max: 5, windowMs: 60_000 })` + create the `ReturnsLookupRateLimit` wixData collection. ~10 lines of churn. Roll the change with the cutover collection-additions batch.

**Severity P1 not P0:** `lookupReturn` requires a valid email + order number combo to enumerate, so it's not a one-shot dump. But a determined attacker with a leaked email list can confirm/deny carolinafutons.com customer status — that's a privacy issue, not just a denial-of-service nuisance.

### F2 (P2) — Helper fails open on DB errors → missing collection at cutover = silent disable
**Where:** `src/backend/utils/rateLimit.js:154-157` — `catch (err) { logError(...); return { allowed: true }; }`.

**Why P2:** the fail-open is a deliberate availability choice — never block a legitimate user when wixData itself is sick. But the same path is taken when the collection doesn't exist at all. At cutover (cf-3qt.8), if even one of the 43 rate-limit collections wasn't created in staging:
- `wixData.query('XYZRateLimit').find()` rejects with "Collection does not exist"
- Helper logs error + returns `{ allowed: true }`
- Endpoint silently has no rate limit protection
- Stilgar sees no signal in customer-facing behavior (everything works) until an attacker notices

**Fix:** pre-cutover, run a one-shot probe script that calls `wixData.query(collection).limit(1).find()` for each of the 43 collections and reports which (if any) reject with the missing-collection error. The probe itself has no production cost. Or: add a startup-time existence check that logs `[rate-limit] WARNING: collection X missing` once per cold-start.

**Why not P1:** at production today the protection has been live for months and the collections exist. The risk only materializes at cutover where staging may not mirror.

### F3 (P3) — Default `max=3 per 1h` applied to surfaces of vastly different traffic class
**Examples:**
- `productQA.web.js:426` `checkRateLimit('QARateLimit', cleanEmail)` → 3 product-QA submits per hour. Reasonable.
- `inventoryService.web.js:122` `checkRateLimit('BackInStockRateLimit', cleanEmail)` → 3 back-in-stock subscriptions per hour. **Probably too tight** for a customer browsing a category page who wants alerts on 4+ products in one session.
- `whiteGloveScheduling.web.js:237` `checkRateLimit('WhiteGloveBookingRateLimit', memberId)` → 3 white-glove bookings per hour. Reasonable (it's a high-touch sale).
- `giftRegistry.web.js:381` `checkRateLimit('RegistryPurchaseRateLimit', itemId)` keyed by **itemId** with 3/hr — this means only 3 people total can purchase any given registry item per hour, regardless of who they are. **Probable bug** — should be keyed by purchaser email/memberId, not the registry item, otherwise legitimate "two relatives bought the same gift, registry now blocks the third" scenarios hit the limit.

**Fix:** review each `checkRateLimit(name, key)` call where the default `(3, 1h)` is implicit and confirm it's appropriate per surface. Per-call audit, no helper change needed. **`RegistryPurchaseRateLimit` keyed by itemId is the most concerning — recommend re-keying to memberId before cutover or filing a P2 bead.**

### F4 (P3) — `newsletterService.web.js` predates the canonical helper, has its own implementation
**Where:** `src/backend/newsletterService.web.js:33-95`.

**Observation:** functionally equivalent to canonical helper. Has its own `NewsletterRateLimit` wixData collection. Drift risk: if the canonical helper changes (e.g., switches hash function, adds atomicity guards), newsletter doesn't get the upgrade.

**Fix:** post-cutover refactor — replace `_checkRateLimit` with `checkRateLimit('NewsletterRateLimit', cleaned, { max: 5, windowMs: 60 * 60_000 })`. Delete ~50 lines. Don't refactor under cutover pressure.

### F5 (informational) — `ContactRateLimits` (plural) is the only collection with a plural suffix
**Where:** `src/backend/contactSubmissions.web.js:130` — collection `ContactRateLimits` (note the trailing "s").

**Observation:** every other rate-limit collection is singular (`ReviewRateLimit`, `QARateLimit` etc.). Drift-prone for typo-induced bugs (e.g., a future rename to `ContactRateLimit` singular would break the bucket).

**Fix:** post-cutover normalize to singular + run a one-shot migration of the existing rows. Not worth doing under cutover pressure.

## Pre-cutover acceptance (cf-3qt.8)

Before DNS flip:
- [ ] **F1 fix** — replace `returnsService.web.js` in-memory rate limit with canonical helper backed by a new `ReturnsLookupRateLimit` collection. The bypass is real, not theoretical.
- [ ] **F2 mitigation** — verify all 43 rate-limit collections exist in the staging CMS. If any are missing, the helper silently fails-open. Either run a probe script or eyeball the CMS dashboard against the inventory list above.
- [ ] **F3 fix** — `RegistryPurchaseRateLimit` re-keyed from `itemId` to purchaser memberId. The current key is a probable bug, not just drift.
- [ ] (optional) F4/F5 deferred to post-cutover hardening sweep.

## Out of scope (file separately if needed)

- **Rate-limit value tuning per-surface** — F3 review is a starter; a full tuning pass needs traffic data we don't have.
- **Distributed rate-limit synchronization across Velo instances** — fundamentally bounded by wixData read-then-write atomicity (see `gamificationRateLimit.js` comment about accepted concurrency risk). Out of scope for an audit.
- **cfw-side rate limiting** — cfw (Next.js) has no built-in rate limit; if the migrated routes need it, that's a separate scope (likely Vercel Edge middleware or upstash/redis).
- **Brute-force protection beyond rate-limiting** — CAPTCHAs, account lockouts, etc. are different controls; this audit only covers the rate-limit helper.

## References

- `src/backend/utils/rateLimit.js` (canonical helper)
- `src/backend/utils/gamificationRateLimit.js` (gamification wrapper)
- cf-3qt.8 (DNS cutover, in_progress) — this audit feeds the Phase-8 readiness checklist
- cf-sec1 (CMEK compliance — bucket key hashing requirement)
- cf-owrr (X-Forwarded-For trusted-proxy fix; see helper file header)
- Companion audits: cf-icww (email touchpoints), cf-jqkg (cfw→Velo HTTP gaps), cf-mgnh (lying-status taxonomy), cf-3pwy (V1↔V3 stores), cf-ox0h (cron schedule), cf-7pd6 (secrets manager)
