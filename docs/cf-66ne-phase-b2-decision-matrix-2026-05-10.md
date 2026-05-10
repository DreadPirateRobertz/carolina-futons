# cf-66ne Phase B-2 — Wholesale Decision Matrix for DEAD webMethods

**Generated**: 2026-05-10 by morgott (cfutons crew)
**Bead**: cf-4x7e Pass 1 (decision matrix only — no code changes)
**Source**: cf-hpwy v2 detector (`scripts/cf-dead-routes/audit.py`) re-run against current main

## Pass 1 deliverable

This doc IS the Pass 1 deliverable. Pass 2 (chunked PRs) executes deletions per the recommendations below; each Pass 2 PR does its own pre-deletion verification (dynamic-import grep, Wix Studio pages config check, stage3-velo back-pressure check) before touching code.

## Detector baseline (current main)

| Bucket | Count |
|---|---:|
| DEAD (no caller anywhere) | **437** |
| FRONTEND (Wix Studio pages) | 334 |
| INTERNAL (other backend) | 128 |
| HTTP-EXPOSED | 80 |
| EVENT-WIRED | 6 |
| **Total webMethods** | **985** |

| Gap-verdict | Count |
|---|---:|
| VELO-INTERNAL | 451 |
| UNUSED-CAN-DELETE | 435 |
| WRAPPED-NO-CONSUMER | 51 |
| OK-WIRED | 29 |
| MAYBE-CFW-NAME-COLLISION | 19 |
| GAP-CFW-WANTS | **0** ← cf-vtx5 closed all 23 originally flagged |

**SUSPICIOUS** (Permissions.Anyone, public-verb name, not HTTP/frontend reachable): **5** — addressed in cf-66ne Phase B audit (PR #1190); 0 safe-to-delete now, 2 follow-up beads (cf-kg1x fabric reconcile, cf-obsb swatch-confirm post-c6g5), 3 confirmed intentional.

## Files with ≥5 dead webMethods (26 files, 180 methods)

26 files concentrate **180 of the 437 dead methods (41%)**. These are the per-file decision rows below.

The remaining 257 dead methods are spread across single-method-per-file or 2–4-per-file patterns; they're better triaged via per-feature deprecation PRs (Phase B-3, deferred indefinitely) than per-file deletion.

## Decision matrix

Verdicts:
- **DELETE-NOW-SAFE** — 100% dead AND no module-level imports anywhere in `src/`. Safe to delete the whole file + its tests in one chunked PR.
- **DELETE-PENDING-VERIFY** — 100% dead webMethods but file may be imported as a non-webMethod helper. Pass 2 PR must spot-check.
- **KEEP-BLOCKED** — feature is planned and waiting on external work (cf-c6g5 email infra, CF+ subscription rollout, etc.). Don't delete.
- **KEEP-PARTIAL** — file has both alive and dead webMethods. Surgical deletion of the dead subset only; preserve the alive ones.
- **SUPERSEDE** — feature partially overlaps with cfw or another module that already does the job. Document the overlap; defer deletion until the supersession is confirmed.
- **DEFER** — admin tooling that's not actively maintained but isn't blocking anything either.

### 🟢 DELETE-NOW-SAFE (8 files / 51 methods)

100% dead, zero module-level imports anywhere in `src/`. Verified by `grep -rE "from 'backend/<module>.web'" src` returning empty.

| File | Dead | Total | Notes |
|---|---:|---:|---|
| `tradeProgram.web.js` | 13 | 13 | B2B/wholesale trade program. Built but never wired. No Wix Studio editor page for trade applications exists. |
| `socialStoryScheduler.web.js` | 7 | 7 | Scheduled social-story rotation service. Distinct from `socialStoryService.web.js` (which has live callers); the *scheduler* layer is dead. |
| `productPassport.web.js` | 6 | 6 | Product passport / resale listing feature. Future-vision built, never wired. |
| `liveShopping.web.js` | 6 | 6 | Live-shopping feature post the chunk-1 `trackEngagement` deletion. Whole feature dead. |
| `accessibility.web.js` | 5 | 5 | A11y audit / aria-config helpers. cfw has its own a11y story (per cf-ah0m audit); these are unwired Wix-side helpers. |
| `fulfillment.web.js` | 5 | 5 | Order-fulfillment helpers. NOT to be confused with the `fulfillment` event handlers in `events.js` (those are alive). |
| `catalogImport.web.js` | 5 | 5 | Catalog import admin tools. Wix CLI has its own import path; this is a parallel implementation that never went live. |
| `deliveryTracker.web.js` | 5 | 5 | Delivery-tracking helpers. NOT to be confused with `ups-shipping.web::trackShipment` (alive, Phase B audit confirmed). The tracker file has its own dead methods. |
| **Total** | **52** | **52** | |

**Estimated chunked PR count**: 4 PRs (~2 files each, ~13 methods each, mirrors cf-66ne Phase A chunk size).

### 🟡 KEEP-BLOCKED (3 files / 33 methods) — wait for external work

| File | Dead | Total | Blocked on |
|---|---:|---:|---|
| `emailTemplates.web.js` | 18 | 19 | **cf-c6g5** (Stilgar STAGING_SITE template population). Once the 20 Triggered Email templates land in the dashboard, several of these helpers become wiring points for `templateRegistry.web.js` consumption. Premature deletion would force re-implementation. |
| `emailAutomation.web.js` | 7 | 17 | **cf-c6g5**. Same blocker. The 10 alive methods include actively-wired sequence triggers; the 7 dead include `triggerReviewThanks`, `getEmailAutomationStats`, etc., that fire only after templates exist. |
| `subscriptionService.web.js` | 8 | 11 | **CF+ subscription product rollout**. The 8 dead methods (`cancelSubscription`, `pauseSubscription`, `getMySubscriptions`, etc.) are the customer-facing surface of the planned CF+ membership. Backend exists; Wix Studio editor page wiring + cfw `/dashboard/subscriptions` route are pending. |
| **Total** | **33** | **47** | |

**Action**: file watch beads referencing cf-c6g5 + CF+ rollout. Re-evaluate at next Phase B-2 sync (post-cf-c6g5).

### 🟠 SUPERSEDE (3 files / 20 methods) — replaced by another path

| File | Dead | Total | Superseded by |
|---|---:|---:|---|
| `bundleBuilder.web.js` | 9 | 11 | cfw's bundle-builder route (`cf-l6aj.17` shipped). The 2 alive methods are admin-side bundle-config; the 9 dead are customer-facing helpers replaced by Next.js client logic. |
| `dataService.web.js` | 6 | 8 | Generic catch-all from the Wix Studio era; replaced by feature-specific services (`reviewsService`, `referralService`, etc.). The 2 alive methods are vestigial; could be moved to feature-specific homes and the file deleted in a follow-up. |
| `blogService.web.js` | 5 | 8 | cfw has its own blog reader (CMS-direct). The 5 dead methods are duplicate fetchers (`fetchAllBlogPosts`, `fetchBlogPost`, `fetchBlogSlugs`, etc.) that the cfw side bypasses. **Caveat**: cfw_low=4 — bare-name match in cfw — likely a coincidental name collision since none use callVelo/URL pattern, but Pass 2 should verify. |
| **Total** | **20** | **27** | |

**Action**: confirm supersession with whoever owns each replacement path; if confirmed, surgical removal of the dead methods (preserve alive subset). If supersession is not confirmed, demote to KEEP-PARTIAL.

### 🔵 KEEP-PARTIAL (8 files / 49 methods) — file has alive endpoints, surgical only

| File | Dead | Total | Alive endpoints (sample) |
|---|---:|---:|---|
| `errorMonitoring.web.js` | 8 | 9 | `recordError` (alive) — error capture; admin dashboard methods are dead but the capture path is live. |
| `wishlistAlerts.web.js` | 7 | 8 | The 1 alive method is the active alert-fire path; admin/audit helpers are dead. |
| `coreWebVitals.web.js` | 7 | 8 | 1 alive method; the 7 dead are dashboard/baseline tools superseded by Vercel Web Vitals. |
| `warrantyService.web.js` | 7 | 9 | 2 alive methods around active warranty; the 7 dead are claim/purchase flow that never wired. |
| `dynamicPricing.web.js` | 6 | 7 | 1 alive method (likely the price-evaluator cron); admin/clearance methods dead. |
| `inventoryService.web.js` | 6 | 10 | 4 alive methods around active inventory; admin dashboard methods dead. |
| `photoReviews.web.js` | 5 | 6 | 1 alive (post-photo); 5 dead admin/moderation helpers. |
| `affiliateProgram.web.js` | 8 | 10 | 2 alive (`getAffiliateDashboard`, `applyForAffiliate`); 8 dead. Affiliate program is partially live. |
| **Total** | **54** | **67** | |

**Action**: per-file surgical delete PRs (mirrors cf-66ne Phase A chunk 2 pattern). Each PR removes the dead webMethods + matching tests, preserving the alive subset. ~8 small PRs.

### ⚪ DEFER (4 files / 28 methods) — admin tooling, low priority

| File | Dead | Total | Reason to defer |
|---|---:|---:|---|
| `smsService.web.js` | 6 | 12 | SMS infrastructure — feature exists with live methods; dead set is reminder/order-confirmation flows that may be wired post-cf-c6g5 (similar pattern to email infra). |
| `virtualConsultation.web.js` | 5 | 10 | 5 alive, 5 dead. Virtual consultation feature is partly live; dead methods may be deferred-customer-facing surfaces. Investigate before deletion. |
| `contentOrchestrator.web.js` | 5 | 7 | Admin orchestration tooling. 2 alive, 5 dead. Defer until next admin-tooling audit. |
| `postPurchaseCare.web.js` | 5 | 7 | 2 alive (active post-purchase emails); 5 dead helpers. Like emailAutomation, may be wired post-cf-c6g5. |
| **Total** | **21** | **36** | |

**Action**: re-evaluate after cf-c6g5 + admin-tooling sweep. Not urgent.

## Summary tally

| Verdict | Files | Dead methods | Action |
|---|---:|---:|---|
| 🟢 DELETE-NOW-SAFE | 8 | 52 | 4 chunked PRs |
| 🟡 KEEP-BLOCKED | 3 | 33 | watch beads, re-evaluate post-cf-c6g5 |
| 🟠 SUPERSEDE | 3 | 20 | confirm supersession + surgical PRs (3 PRs) |
| 🔵 KEEP-PARTIAL | 8 | 54 | 8 surgical PRs (mirrors cf-66ne chunk 2 pattern) |
| ⚪ DEFER | 4 | 21 | re-evaluate at next sync |
| **Total** | **26** | **180** | |

The remaining **257 dead methods** (out of 437) are spread across single-method or 2–4-per-file patterns; deferred to a future Phase B-3 sweep that triages by feature rather than by file.

## Recommended Pass 2 PR sequence

Order by least-risk first:

1. **PR-1**: `accessibility.web.js` + `liveShopping.web.js` (DELETE-NOW-SAFE × 2; ~11 methods)
2. **PR-2**: `tradeProgram.web.js` (DELETE-NOW-SAFE × 1, large file; 13 methods)
3. **PR-3**: `productPassport.web.js` + `catalogImport.web.js` (DELETE-NOW-SAFE × 2; 11 methods)
4. **PR-4**: `socialStoryScheduler.web.js` + `fulfillment.web.js` + `deliveryTracker.web.js` (DELETE-NOW-SAFE × 3; 17 methods)
5. **PR-5..PR-7**: SUPERSEDE files (`bundleBuilder`, `dataService`, `blogService`) — surgical
6. **PR-8..PR-15**: KEEP-PARTIAL files — surgical, one per file

Each PR follows the cf-66ne chunk pattern: delete code + matching tests + verify full vitest passes + zero grep regressions.

## Pre-deletion checklist (Pass 2 PRs apply this per file)

For each DELETE-NOW-SAFE file:
- [ ] `grep -rE "from 'backend/<module>.web'" src` returns empty (already verified for the 8 above)
- [ ] `grep -rE "<methodName>" tests` returns only same-file test references
- [ ] `grep -rE "/_functions/<methodName>" /Users/hal/gt/carolina-futons-web/src` returns empty (no cfw URL caller)
- [ ] `grep -rE "wixWebMethods.invoke" src` and confirm `<methodName>` not in the targets (dynamic dispatch caveat)
- [ ] Re-check stage3-velo for callers (`grep -rE "<methodName>" /Users/hal/gt/cfutons/carolina-futons-stage3-velo/src` outside the defining file)
- [ ] Wix Studio editor page files (`src/pages/*.js`) — confirm no `import('backend/<module>')` reference

## Source artifacts

- `scripts/cf-dead-routes/audit.py` (cf-hpwy v2 detector, regenerable)
- `docs/velo-dead-routes-2026-05-09.md` (cf-hpwy original report, PR #1166)
- `docs/cf-66ne-phase-b-audit-2026-05-09.md` (cf-66ne Phase B residual audit, PR #1190)
- This doc — Phase B-2 Pass 1 decision matrix.

Refs cf-66ne, cf-hpwy, cf-4x7e, cf-c6g5.
