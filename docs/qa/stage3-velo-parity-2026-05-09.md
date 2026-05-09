# stage3-velo ↔ cfutons monorepo parity audit — 2026-05-09

**Bead:** cf-kull (P2). Stilgar follow-up to cf-w1lg (5 endpoints + cors.js
were ported in PR #18). This audit verifies nothing else was missed before the
cf-3qt-Phase-9 cutover.

**TL;DR:** Stage3 is a strict subset of cfutons monorepo. There are NO broken
imports inside stage3 (every `from 'backend/…'` and `from 'public/…'` resolves
to a file that ships in stage3). The remaining divergence is one-way:
cfutons has features stage3 doesn't, none of which stage3 needs. **The only
real production gap is two HTTP cron endpoints** + their backing webMethod
file. Everything else is cfw-side or canonical-only work that the live Wix
Studio site doesn't depend on.

## Methodology

```bash
# Tree-level diff for the three Velo source roots
diff <(cd src/backend && find . -name '*.js' -o -name '*.json' | sort) \
     <(cd carolina-futons-stage3-velo/src/backend && find . -name '*.js' -o -name '*.json' | sort)

# Same for src/public, src/pages.
# Then for each missing module, grep stage3's source to see if anything in
# stage3 imports it (= real gap) or not (= one-way feature divergence).
```

The reverse direction (files only in stage3) is empty for all three roots —
stage3 does NOT have any orphan files relative to cfutons.

## Findings

### 1. Real production gaps (HIGH) — 2 HTTP endpoints + 1 dep file

```
src/backend/http-functions.js
  + export async function get_runReviewRequestEmailsCron(request)   [cf-fsm]
  + export async function get_scanAndTriggerWinbackCron(request)
src/backend/marketingSequences.web.js   (entirely missing)
```

Both endpoints are cron-style: `GET /_functions/<name>` with `X-Cron-Secret`
header (validated against `ALERT_CRON_KEY` Wix secret). They proxy to
`runReviewRequestEmails` / `scanAndTriggerWinback` webMethods in
`marketingSequences.web.js`. Without the dep file present in stage3, the
endpoints can't be ported alone — the file must come over too.

**Note on schedule:** cfutons inline comment for `get_runReviewRequestEmailsCron`
notes "Primary schedule is jobs.config `runReviewRequestEmails` (daily 10 AM
EST). This HTTP endpoint is a manual/external trigger for the same logic."
If stage3's `jobs.config` covers the schedule (separate file, not part of
this audit), then the missing HTTP endpoint is only an external-trigger
gap — operationally low-impact. **Action: verify stage3 jobs.config
includes both jobs before deciding whether to port the HTTP endpoints.**

| Recommended action | Cost | Risk |
|---|---|---|
| (A) Port both endpoints + `marketingSequences.web.js` (mirrors cf-w1lg pattern) | ~30 min, 1 PR, 1 review | low — additive |
| (B) Verify `jobs.config` covers the schedule, leave HTTP endpoints behind | 10 min, doc note | low — assumes ops will fall back to the scheduler |
| (C) Defer until cf-3qt-Phase-9 (publish from monorepo directly) | 0 today | none — gap closes when migration completes |

Stilgar's call. Recommend (B) — verify `jobs.config` parity then defer the
HTTP shim to Phase-9.

### 2. One-way feature divergence (LOW) — cfutons-only, stage3 doesn't reference

The numbers are misleading on first read. Stage3 doesn't IMPORT any of these
modules, so their absence in stage3 has zero runtime impact on the live Wix
Studio site.

#### 2a. Backend webMethods (34 files in cfutons, missing in stage3)

```
abTestResults.web.js, buyingGuideOgCards.web.js, cartSessionService.web.js,
challengeService.web.js, chatbotService.web.js, completeTheLookService.web.js,
conversionFunnel.web.js, customerRoomPhotos.web.js, deepLinkService.web.js,
deliveryNotifications.web.js, emailQueueService.web.js,
furnitureCareGuideService.web.js, gamificationChipService.web.js,
lifecycleCron.web.js, lifecycleEmailSender.web.js, lifecycleEmailTemplates.js,
marketingSequences.web.js (← see §1), memberPointsLedgerService.web.js,
mobileChallengeService.web.js, priceAlertService.web.js,
pushNotificationService.web.js, pushTokenRegistry.web.js, rewardEngine.web.js,
seoAutoMeta.web.js, sitemapEnhancer.web.js, sommelierService.web.js,
spinRedemptionService.web.js, surveyService.web.js, swatchKitService.web.js,
tradeInService.web.js, trailChallengeService.web.js, trailPerkService.web.js,
unsubscribeService.web.js
```

Most of these are "feature added in cfutons but never wired into stage3" —
the corresponding Velo Editor pages (e.g. `Survey.js`, `Swatch Kit.js`,
`Trade In.js`) are also missing from stage3 (§2c), so the feature simply
doesn't ship in the production Wix Studio site. No action required unless
Stilgar wants to ship one of these features pre-Phase-9.

#### 2b. Public widgets (29 files in cfutons, missing in stage3)

```
BNPLCalculatorWidget.js, BNPLWidget.js, BundleBuilder.js, CategoryPage.js,
CollectionPage.js, CompleteTheLookWidget.js, FurnitureCareGuideWidget.js,
HeroPorchWix.js, HeroV3Wix.js, LoyaltyBadgeWidget.js, LoyaltyPerksWidget.js,
LoyaltyTierBanner.js, NpsSurveyWidget.js, ProductUGCGallery.js,
RatingsRollup.js, ReviewsCarousel.js, SaleLightbox.js, ShareYourRoom.js,
SommelierWidget.js, SwatchKitWidget.js, TradeInWidget.js,
TrailProgressDisplay.js, TrailProgressWidget.js, VideoReviewGrid.js,
WarrantyInfoWidget.js, WarrantyWidget.js, YouMightAlsoLike.js,
funnelTracker.js, ugcTaxonomy.js
```

Velo `public/` widgets only run when wired into a Wix Editor page. Since
stage3's pages don't import any of these (verified — zero broken imports),
they're inert in stage3 even if ported. No action.

#### 2c. Pages (12 files in cfutons, missing in stage3)

```
Admin A-B Tests.js, Admin Delivery Calendar.js, Admin Virtual Consultation.js,
Consultation.js, Leaderboard.js, Reviews.js, Survey.js, Swatch Kit.js,
Trade In.js, Virtual Consultation.js, Warranty Registration.js,
White Glove Delivery.js
```

Page modules are bound to specific Wix Studio Editor pages. If the Editor
page doesn't exist in the live Stage 3 site, the file can't fire — so
absence is correct. **Action: melania confirms Stilgar's intent for each
Admin/feature page — none ship in production today, so audit is clean.**

### 3. Reverse direction — stage3-only files

```
$ diff <stage3 tree> | grep '^> '
(empty)
```

Stage3 has **zero** files that aren't in cfutons. No accidental drift in the
deploy direction — every file in stage3 has a canonical source in the
monorepo.

## What this audit DIDN'T cover

- **`jobs.config` parity** — the scheduler config file. If it diverges,
  scheduled webMethods may silently stop firing. **Recommend follow-up
  bead** to diff `jobs.config` between repos and confirm the cron schedules
  in §1 are still wired even without the HTTP endpoints.
- **`wix.config.json`, `tsconfig.json`, `package.json` deps** — covered
  partially via the build (`npm run lint` + `npm test` clean), but not
  audited end-to-end. Out of scope for parity sweep.
- **CMS collection schema parity** — Wix Stages site has its own collections
  configured in the Dashboard. Code references match if names match;
  shape mismatches would surface only as runtime errors. **Recommend
  separate cf-* bead** for CMS schema audit if Stilgar wants belt-and-
  suspenders pre-Phase-9.
- **`.wix/types/` generated type files** — auto-regenerated on `wix
  sync-types`, divergence here is expected and harmless.

## Linked beads

- cf-w1lg (closed) — original 5-endpoint port that uncovered the drift
  problem
- cf-89xn (closed) — radahn's review of cf-w1lg PR #18 → second-wave fixes
- cf-fuvd (closed) — orphan `importProductOptions.web.js` deletion
- cf-9ieq (open, P0) — sendEmail 500 (downstream from cf-foo0)
- cf-c6g5 (open, P0) — Triggered Email template setup (blocks cf-9ieq close)
- cf-3qt-Phase-9 (open, P1 epic) — publish from monorepo directly
  (eliminates the parity-drift problem at the structural level)

## Recommended follow-ups

1. **(P2)** Verify stage3 `jobs.config` schedules `runReviewRequestEmails`
   and `scanAndTriggerWinback` — if yes, the §1 HTTP endpoint gap is purely
   an external-trigger convenience, defer to Phase-9. If no, port the
   endpoints + `marketingSequences.web.js` (~30 min, follows cf-w1lg
   pattern).
2. **(P2)** CMS collection schema parity audit — separate scope, separate
   bead. Confirm collection names + field shapes align between code refs
   and the live Wix Dashboard.
3. **(P1)** Continue with cf-3qt-Phase-9 (publish from monorepo) — at
   that point the parity question goes away. Until then this audit + the
   wix-publish.yml automation in cf-g2sa keep drift visible.
