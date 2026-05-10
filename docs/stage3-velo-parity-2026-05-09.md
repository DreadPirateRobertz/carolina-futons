# stage3-velo ↔ cfutons monorepo Parity Audit — 2026-05-09 (cf-kull)

**Scope**: full-grep parity sweep of `src/backend/`, `src/pages/`, `src/public/` between the cfutons monorepo (Velo source-of-truth) and `carolina-futons-stage3-velo` (Wix CLI deploy target). Per Stilgar 2026-05-05: *"STAGE3 REPO: was latest production code pre-migration — verify nothing missed."*

cf-w1lg only closed the 5 missing `/_functions/*` endpoints. This audit answers the bigger question: **what else has drifted?**

## Headline

| Subtree | Common | Identical | Differ | Only cfutons | Only stage3 |
|---|---:|---:|---:|---:|---:|
| `src/backend` | 222 | 166 | 56 | **36** | 1 |
| `src/pages` | 54 | 41 | 13 | **12** | 0 |
| `src/public` | 257 | 224 | 33 | **31** | 0 |
| **Total** | **533** | **431** | **102** | **79** | **1** |

The **79 only-in-cfutons files** are the cf-w1lg pattern at scale: code committed to the monorepo that never made it into the deploy target, so any consumer (cfw HTTP call, Wix Studio editor page reference, internal Velo import) hits a 404 / undefined-export. The **102 differ files** are stage3-velo running an older cut of the monorepo logic.

The **1 only-in-stage3 file** (`src/backend/blogRssFeed.web.js`) is the inverse pattern — cfutons just deleted it in PR #1186 (cf-66ne chunk 3). stage3-velo will catch up at next Wix CLI publish.

## HTTP endpoint diff (`http-functions.js`)

The most cfw-impacting layer. cfw → Velo calls land here:

| | cfutons | stage3-velo |
|---|---:|---:|
| Total `*_NAME` endpoints | 81 | 81 |
| Common | 79 | 79 |
| Only this side | **2** | **2** |

**Only in cfutons** (deploy target lacks them; cfw cannot reach):
- `get_runReviewRequestEmailsCron` — review-request email cron trigger
- `get_scanAndTriggerWinbackCron` — winback campaign cron trigger

Both are admin-cron endpoints. If cfutons monorepo expects them callable from a scheduler hitting the live Wix site, those calls 404 today. Verify scheduler config; if the scheduler is internal (Wix Velo cron events), the endpoints don't need to be HTTP-reachable and the gap is moot.

**Only in stage3-velo** (cfutons monorepo lacks them; would be undone on next Wix CLI sync from cfutons):
- `options_referralService`
- `post_referralService`

These are the cf-vtx5 referralService dispatcher. The fix landed in stage3-velo first (under prod-fire pressure). Needs back-port to cfutons OR the cfutons-side will overwrite stage3-velo at next publish. Recommended: back-port immediately.

## Backend — 36 files in cfutons, missing from stage3-velo

Grouped by likely impact:

### High impact — has webMethods + plausible cfw / Wix Studio caller (verify each)
- `cartSessionService.web.js` — guest-cart entry point per `eventBus.js` documentation
- `chatbotService.web.js` — chatbot backend
- `completeTheLookService.web.js` — PDP cross-sell helper
- `customerRoomPhotos.web.js` — UGC backend
- `deepLinkService.web.js` — mobile deep linking
- `deliveryNotifications.web.js` — fulfillment notification flow
- `emailQueueService.web.js` — email queue helper
- `fabricSampleService.web.js` — already-broken frontend per cf-kg1x reconcile bead
- `furnitureCareGuideService.web.js` — care-guide content service
- `gamificationChipService.web.js` — gamification PDP chips
- `marketingSequences.web.js` — marketing email sequencer
- `memberPointsLedgerService.web.js` — loyalty points ledger
- `mobileChallengeService.web.js` — mobile-challenge gamification
- `priceAlertService.web.js` — price-drop alerts
- `rewardEngine.web.js` — loyalty rewards engine
- `sommelierService.web.js` — futon-sommelier quiz backend
- `swatchKitService.web.js` — fabric swatch-kit logic
- `tradeInService.web.js` — trade-in program
- `trailChallengeService.web.js` — trail/challenge service
- `trailPerkService.web.js` — trail perks
- `unsubscribeService.web.js` — unsubscribe-token verification
- `videoReviewService.web.js` — video reviews backend
- `whiteGloveScheduling.web.js` — white-glove delivery scheduling

### Medium impact — tooling / internal services (verify whether anything imports them)
- `abTestResults.web.js` — admin A/B-test results
- `buyingGuideOgCards.web.js` — OG-card generator for buying guides
- `challengeService.web.js` — generic challenge service
- `conversionFunnel.web.js` — funnel analytics
- `lifecycleCron.web.js` — lifecycle email cron
- `lifecycleEmailSender.web.js` — lifecycle email sender
- `lifecycleEmailTemplates.js` — lifecycle email template registry
- `seoAutoMeta.web.js` — auto meta-tag generator
- `siteContentSeed.web.js` — site-content seeding helper (likely cf-4mol / cfw-66o adjacent)
- `sitemapEnhancer.web.js` — sitemap enhancer

### Low impact — utilities (no HTTP, no caller from outside)
- `utils/chatbotContext.js`
- `utils/crossRigSyncUtils.js`
- `utils/queryAll.js`

## Pages — 12 only in cfutons (no live Wix Studio editor surface for these)

Wix Studio publishes pages from stage3-velo. These 12 page modules exist as cfutons code but no live page on the published Wix site can use them:

`Admin A-B Tests.js`, `Admin Delivery Calendar.js`, `Admin Virtual Consultation.js`, `Consultation.js`, `Leaderboard.js`, `Reviews.js`, `Survey.js`, `Swatch Kit.js`, `Trade In.js`, `Virtual Consultation.js`, `Warranty Registration.js`, `White Glove Delivery.js`.

Note: cfw replicates several of these as Next.js routes (`/reviews`, `/survey`, `/white-glove-delivery`) so the cfw-side experience is fine. The Wix Studio side is the gap.

## Public — 31 only in cfutons

Wix Studio frontend modules that exist as cfutons code but aren't deployable today:

`BNPLCalculatorWidget.js`, `BNPLWidget.js`, `BundleBuilder.js`, `CategoryPage.js`, `CollectionPage.js`, `CompleteTheLookWidget.js`, `FabricSampleRequest.js`, `FurnitureCareGuideWidget.js`, `HeroPorchWix.js`, `HeroV3Wix.js`, `LoyaltyBadgeWidget.js`, `LoyaltyPerksWidget.js`, `LoyaltyTierBanner.js`, `NpsSurveyWidget.js`, `ProductUGCGallery.js`, `RatingsRollup.js`, `ReviewsCarousel.js`, `SaleLightbox.js`, `ShareYourRoom.js`, `SommelierWidget.js`, `SwatchKitWidget.js`, `TradeInWidget.js`, `TrailProgressDisplay.js`, `TrailProgressWidget.js`, `VideoReviewGrid.js`, `WarrantyInfoWidget.js`, `WarrantyWidget.js`, `YouMightAlsoLike.js`, `funnelTracker.js`, `loyaltyTiers.ts`, `ugcTaxonomy.js`.

Many of these are paired with the corresponding "only-in-cfutons" backend modules above (e.g., `FabricSampleRequest.js` ↔ `fabricSampleService.web.js`). The frontend ↔ backend mismatch means the entire feature is non-deployable until both sides land in stage3-velo.

## Top divergent files (largest content gap on the same path)

Stage3-velo is running an older cut of these:

| Δ bytes | Δ lines | Path |
|---:|---:|---|
| +12,519 | +303 | `src/backend/gamificationNotifs.web.js` |
| +11,973 | +292 | `src/backend/socialStoryScheduler.web.js` |
| +11,945 | +254 | `src/backend/http-functions.js` |
| +11,583 | +328 | `src/backend/reviewsService.web.js` |
| +11,067 | +224 | `src/backend/gamificationCore.web.js` |
| +9,445  | +274 | `src/backend/leaderboardService.web.js` |
| +8,789  | +247 | `src/backend/bundleBuilder.web.js` |
| +6,676  | +197 | `src/backend/styleQuizService.web.js` |
| +5,714  | +153 | `src/backend/smsService.web.js` |
| +5,518  | +157 | `src/backend/productRecommendations.web.js` |

Positive deltas mean cfutons is bigger; the same-named file in stage3-velo is older / smaller. These are exactly where new features have been merged to monorepo without the mirror landing in stage3-velo.

## Recommendations

### Immediate (P1)
1. **Back-port stage3-velo's referralService dispatcher to cfutons** (the `options_referralService` + `post_referralService` exports in stage3-velo's `http-functions.js`). cfutons-side will overwrite at next Wix CLI publish unless this lands first. Owner: whoever shipped cf-vtx5 referralService.

### Convergence sweep (P2 — file as cf-kull.fu sequence)
2. **23 high-impact backend files** to mirror into stage3-velo (the "High impact" list above). Pair this with the corresponding `src/public/*Widget.js` and `src/pages/*` files where dependencies exist.
3. **Stilgar / Wix CLI publish cycle**: every time a backend or page merges to cfutons, the deploy-to-stage3-velo step should be a CI gate (proposed in cf-w1lg long-term follow-up). Right now, each merge has to manually mirror, and most don't.

### Verify-then-decide (P3)
4. **Confirm the 2 only-in-cfutons HTTP cron endpoints** (`get_runReviewRequestEmailsCron`, `get_scanAndTriggerWinbackCron`) are not actually scheduled to hit the live site. If they are, mirror to stage3-velo. If they're internal Velo cron, no action.
5. **102 differ files**: not all need same-day reconciliation. Top 10 by size delta (per table above) are the real risk; the rest are mostly minor (whitespace, version bumps, JSDoc edits). Spot-check the top 10; bulk-reconcile the rest at next major Wix CLI publish.
6. **12 admin / scheduling page modules** (`Admin *.js`, `Consultation.js`, etc.) — confirm whether any are intended to be live on the Wix Studio site. If not, no action; if yes, port.

## Method (re-runnable)

```
scripts/cf-kull/audit.py:
  1. Walk cfutons/src/{backend,pages,public} and stage3-velo/src/{backend,pages,public}
  2. Build {relative_path → absolute_path} maps
  3. Set difference: only-in-cfutons, only-in-stage3, common
  4. For each common: byte-equal check + size/line delta
  5. Special-case http-functions.js: extract `*_NAME` endpoint exports both sides, diff
```

Re-run after every sync window to track convergence progress. Output: `/tmp/cf-kull-results.json` (full per-file detail) + this Markdown summary.

## Source artifacts

- `scripts/cf-kull/audit.py` — re-runnable detector
- `docs/stage3-velo-parity-2026-05-09.md` — this report
- Full per-file detail: not committed (regenerable from audit script)

Refs cf-kull, cf-w1lg, cf-vtx5, cf-66ne.
