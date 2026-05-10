# cf-hpwy v3.2 detector — fresh state snapshot (2026-05-10, post-cf-4x7e Pass 3)

**Bead**: self-paced overnight audit · **Author**: cfutons/crew/morgott · **Detector**: `scripts/cf-dead-routes/audit.py` v3.2 (cf-sq0d.fu2)

## TL;DR

**Zero true-DEAD webMethods remaining.** Down from 4 in the v3.1 matrix (pre-cf-q8m2 / pre-cf-namd / pre-cf-4ogf / pre-cf-cw6e / pre-cf-q5hd). All confirmed-dead methods identified by Pass 2 + Pass 3 triage have been retired. The detector now classifies every backend webMethod as reachable via at least one of: HTTP, EVENT, FRONTEND, INTERNAL, or FILESYSTEM-PATH-REFERENCED.

## Bucket counts (single-bucket primary tally)

| Bucket | Count |
|---|---:|
| FILESYSTEM-PATH-REFERENCED | 354 |
| FRONTEND | 319 |
| HTTP-EXPOSED | 75 |
| INTERNAL | 68 |
| EVENT-WIRED | 6 |
| **DEAD** | **0** |
| **Total** | **822** |

## Gap-verdict tally

| Gap | Count | Notes |
|---|---:|---|
| VELO-INTERNAL | 728 | Reachable from `src/backend` or `src/public/pages`, not from cfw |
| WRAPPED-NO-CONSUMER | 46 | HTTP-exposed via `http-functions.js` but no cfw caller |
| OK-WIRED | 29 | cfw URL/callVelo + matching HTTP wrapper (live cfw consumers) |
| MAYBE-CFW-NAME-COLLISION | 19 | Bare-name appears in cfw but no `from backend/<X>` import — likely cfw-side same-name function |
| GAP-CFW-WANTS | **0** | cfw URL/callVelo with no HTTP wrapper (the dead-letter bucket) |

## Delta vs prior matrices

| Metric | v3 (PASS1-MATRIX-UPDATED) | v3.1 (post collision filter) | v3.2 (post JSDoc strip) | **Now (post-Pass-3)** |
|---|---:|---:|---:|---:|
| Total webMethods | 985 | 914 | 914 | **822** |
| DEAD | 437 | 4 | 4 | **0** |
| HTTP-EXPOSED | 80 | 80 | 80 | 75 |
| EVENT-WIRED | 9 | 9 | 9 | 6 |
| FRONTEND (any) | 375 | 375 | 363 | 319 |
| INTERNAL (any) | 230 | 196 | 196 | … (any-match) |

The 92-method drop (914 → 822) reconciles closely with the cumulative cf-4x7e Pass 2 + Pass 3 retirements (~146 in cf-4x7e tracking + ~5 from sibling cf-4ogf/cf-cw6e/cf-q5hd cleanups + others).

## SUSPICIOUS (2)

`Permissions.Anyone` + public-verb name + not HTTP-/frontend-reachable. These look publicly-callable but aren't reachable via the standard surfaces:

- `captureExitIntentEmail` — `src/backend/newsletterService.web.js:450`
- `sendSwatchConfirmationEmail` — `src/backend/emailService.web.js:371`

**Interpretation**: both are likely called from server-side internal flows (cron / event handler / other webMethod) but the bare-name search didn't pick up the call shape. `captureExitIntentEmail` was specifically retained in cf-trm0 for stage3-velo cross-rig; verify that lineage. Worth a per-method spot-check before assuming dead.

## MAYBE-CFW-NAME-COLLISION (19)

cfw has bare-name references to these methods but no `from backend/<X>` import — same FP shape as chunks 11/12/14/15/16/file-6 lessons (cfw has its own same-named function/component). 19 methods to audit across:

| Method | File | cfw bare-hits |
|---|---|---:|
| `removeItem` | `collaborativePlanner.web.js:348` | 11 |
| `subscribe` | `priceAlertService.web.js:38` | 10 |
| `searchProducts` | `categorySearch.web.js:84` | 7 |
| `trackAddToCart` | `analyticsHelpers.web.js:92` | 4 |
| `trackPurchase` | `analyticsHelpers.web.js:436` | 4 |
| `saveLayout` | `roomPlanner.web.js:313` | 4 |
| `bookAppointment` | `deliveryScheduling.web.js:644` | 4 |
| `getShippingZone` | `internationalShipping.web.js:29` | 4 |
| `getRecommendation` | `styleQuizService.web.js:387` | 3 |
| `checkRoomFit` | `sizeGuide.web.js:96` | 3 |
| `getRegistry` | `giftRegistry.web.js:173` | 3 |
| `getProductBadges` | `badgeService.web.js:132` | 3 |
| `spinWheel` | `spinWheel.web.js:219` | 3 |
| `getProductDimensions` | `sizeGuide.web.js:27` | 2 |
| `getRelatedGuides` | `guideSeoService.web.js:140` | 2 |
| `sendRecoveryEmail` | `cartRecovery.web.js:190` | 2 |
| `getProductSwatches` | `swatchService.web.js:7` | 2 |
| `getCareGuide` | `furnitureCareGuideService.web.js:37` | 2 |
| `updateWishlistStock` | `wishlistService.web.js:255` | 1 |

Each row needs a per-method audit to confirm the bare-name hit is a cfw-local same-name function (true FP, dead → could retire) vs a real cfw consumer that the detector missed.

**Recommended**: file as a follow-on triage bead. Do NOT trim any of these without per-method verification. Same FP-discipline as cf-4x7e Pass 2 chunks 11-16 demonstrated.

## WRAPPED-NO-CONSUMER (46) — context

Down 1 from the wrapped-no-consumer audit's count of 47 (cf-4ogf already retired the 2 TRULY-ORPHAN candidates from that list, but the file-by-file count net-decreased by 1 since one was reclassified after the overnight audit ran). This bucket needs the per-service consumer audit (Wix Studio Velo page audit + third-party POSTs + admin tools) per the prior audit doc — **not solo overnight material**.

## Recommended next steps

1. **No new dead-code chunks recommended.** The DEAD bucket is empty.
2. **Per-method triage on the 19 MAYBE-CFW-NAME-COLLISION** — file as a follow-on bead. Each verified true-FP would be a candidate for retirement in a future Pass 4. Estimated effort: 19 × 5min sweep = ~1.5hr.
3. **Per-service WRAPPED-NO-CONSUMER consumer audit** — separate scoping work, requires Wix Studio + Stripe/etc reviews.
4. **SUSPICIOUS pair** — quick spot-check: `captureExitIntentEmail` is known-alive cross-rig (cf-trm0); `sendSwatchConfirmationEmail` likely invoked from `swatchRequest.web.js` or events. Verify and silence the SUSPICIOUS flag if confirmed.

## Refs

- Bead: self-paced (no formal bead — this is a state-of-cleanup snapshot doc)
- Detector: `scripts/cf-dead-routes/audit.py` (cf-hpwy v3.2 / cf-sq0d.fu2)
- Predecessor matrix: `docs/cf-4x7e/PASS1-MATRIX-UPDATED-v3.2.md`
- Recent dead-code work: cf-4x7e (Pass 2 + 3), cf-4ogf, cf-q5hd, cf-cw6e, cf-ivpn, cf-xpqf
- Raw classification data: `/tmp/cf-dead-routes/results.json` (regen via `CFUTONS_ROOT=$REPO_ROOT python3 scripts/cf-dead-routes/audit.py`)
