# cf-66ne Phase B Audit — Permissions.Anyone SUSPICIOUS Items

**Generated**: 2026-05-09 by morgott (cfutons crew)
**Scope**: Per-item verdict on the 11 SUSPICIOUS Permissions.Anyone deletion candidates surfaced by cf-hpwy + the 3 INTERNAL-Anyone perm-tightening candidates flagged in the same audit. Each item: (a) confirm truly unused via cf-hpwy v2 detector, (b) confirm not security-relevant intentional public endpoint, (c) document deletion vs preservation rationale.

## TL;DR — What's left

After Phase A (PRs #1171, #1180, #1186) deleted 8 of the 11 originals:

| Status | Count | Items |
|---|---:|---|
| ✅ Deleted in Phase A | 8 | `trackVideoView`, `trackBundleImpression`, `trackComparison`, `trackAffiliateClick`, `trackEngagement`, `generateBlogRssFeed`, `generateInternalLinks`, `generateRoomPrepChecklist` |
| 🟡 Remaining (SUSPICIOUS) | 3 | `submitFabricSampleRequest`, `sendSwatchConfirmationEmail`, `generatePinContent` |
| 🟢 Add'l flagged (INTERNAL-Anyone perm) | 3 | `cartSessionService.createSession`, `cartSessionService.updateCartItems`, `ups-shipping.trackShipment` |

Verdicts after this audit:
- **Delete now**: **0** items (no remaining SUSPICIOUS pass the safe-to-delete bar).
- **Keep + tighten perm**: **0** items (the 3 INTERNAL-Anyone are intentional or already correctly permissioned for their use case).
- **Keep + flag follow-up**: **2** items (`submitFabricSampleRequest`, `sendSwatchConfirmationEmail`) blocked on external work.
- **Keep + close investigation**: **4** items (`generatePinContent`, `createSession`, `updateCartItems`, `trackShipment`) — confirmed in-use or intentional.

**No PR deliverable from Phase B.** Phase A captured the safely-deletable ones; the residual 6 each have a documented reason to stay. The doc below is the canonical record.

## Detector v2 baseline (986 webMethods on cfutons main today)

Re-run of `scripts/cf-dead-routes/audit.py` against current main:

| Bucket | Count |
|---|---:|
| DEAD | 438 |
| FRONTEND | 337 |
| INTERNAL | 129 |
| HTTP-EXPOSED | 76 |
| EVENT-WIRED | 6 |

| Gap-verdict | Count |
|---|---:|
| VELO-INTERNAL | 455 |
| UNUSED-CAN-DELETE | 436 |
| WRAPPED-NO-CONSUMER | 47 |
| OK-WIRED | 29 |
| MAYBE-CFW-NAME-COLLISION | 19 |

**SUSPICIOUS: 6** (down from 14 at audit start; Phase A caught 8 of the original 11).

## Per-item verdict

### 1. `submitFabricSampleRequest` (`fabricSampleService.web.js:194`)

| Check | Result |
|---|---|
| In-cfutons callers | None outside defining file + tests |
| In stage3-velo callers | None outside defining file |
| Same-file caller | No |
| In cfw `/_functions/<name>` | No |
| In cfw `callVelo({ method: ... })` | No |
| Detector verdict | DEAD / UNUSED-CAN-DELETE |

**Twist**: `src/public/FabricSampleRequest.js` (Wix Studio editor frontend) imports `getAvailableSwatches` and `submitFabricSample` from `backend/fabricSampleService.web` — **neither name exists** in the backend file. The backend has only `submitFabricSampleRequest`. There's a name mismatch that already breaks production for any Wix Studio page that calls `FabricSampleRequest.init()`.

**Verdict: KEEP + file follow-up bead** for the frontend/backend reconcile. Deleting `submitFabricSampleRequest` now would mask the rename-or-rebuild decision.

**Recommended follow-up**: file P2 bead "fabric-sample frontend/backend name reconcile — decide rename / delete / rebuild." Fixing it requires either renaming `submitFabricSampleRequest` → `submitFabricSample` + adding `getAvailableSwatches`, or deleting both the backend file and the orphan frontend.

### 2. `sendSwatchConfirmationEmail` (`emailService.web.js:306`)

| Check | Result |
|---|---|
| In-cfutons callers | None outside defining file + tests |
| In stage3-velo callers | None outside defining file |
| Same-file caller | No |
| In cfw | No |
| Detector verdict | DEAD / UNUSED-CAN-DELETE |
| Email-template dependency | `swatch_confirmation` is template **#13** of the 20 cf-c6g5 templates STAGING_SITE needs |

**Verdict: KEEP, defer until cf-c6g5 ships.** Once Stilgar's batch-copy lands the `swatch_confirmation` Triggered Email on STAGING_SITE, this method becomes the natural wiring point for the swatch-request flow. Deleting now means whoever wires the email later has to rebuild from history.

**Recommended action**: revisit when cf-c6g5 closes. Either (a) wire the existing method into the swatch-request flow (post_sampleRequests calls submitSwatchRequest → on success → calls sendSwatchConfirmationEmail), or (b) delete if email infra ends up wiring through a different path.

### 3. `generatePinContent` (`pinterestCatalogSync.web.js:303`)

| Check | Result |
|---|---|
| In-cfutons callers | None outside defining file (BUT see same-file) |
| Same-file caller | **YES** — `syncCatalogBatch` at line 451 calls `generatePinContent(product)` for each product in the batch |
| Detector verdict | INTERNAL / VELO-INTERNAL |

**Verdict: KEEP — actively in use.** The cf-hpwy v1 detector flagged this as DEAD because v1 skipped the defining file when looking for callers; cf-hpwy v2 (#1185) caught the same-file call and correctly demoted it out of DEAD. `Permissions.Anyone` is irrelevant since the only caller is internal.

**Recommended action**: leave as-is. Optional: tighten `Permissions.Anyone` → `Permissions.Admin` since `syncCatalogBatch` is admin-cron-grade and there's no public reason to call `generatePinContent` directly. But this is cosmetic; internal calls bypass the permission gate, so the only effect is "fewer rows in the SUSPICIOUS bucket."

### 4. `cartSessionService.createSession` (`cartSessionService.web.js:41`)

| Check | Result |
|---|---|
| In-cfutons callers | None directly (but `eventBus.js` doc comment says "Call createSession on page load") |
| Same-file caller | No |
| In stage3-velo | Same as cfutons (no external caller) |
| Documentation intent | Public guest-cart entry-point per JSDoc + `eventBus.js` |
| Permission | Anyone — **intentionally** permissive: guest carts must work without auth |

**Verdict: KEEP `Permissions.Anyone` — intentionally public guest-cart endpoint.** Documented as the page-load entry point. The reason no caller exists today is that the Wix Studio frontend that would call it was never built (or was replaced by direct cfw cart handling). Tightening to `SiteMember` would break the guest-cart contract.

**Recommended action**: leave permission as-is. If/when Phase B-2 happens (deleting "no caller anywhere" backend services wholesale), this whole `cartSessionService.web.js` module is a candidate — but only after confirming neither the Wix Studio editor pages nor the cfw cart system needs server-side cart persistence.

### 5. `cartSessionService.updateCartItems` (`cartSessionService.web.js:109`)

| Check | Result |
|---|---|
| In-cfutons callers | None (same as createSession) |
| Same-file caller | No |
| Detector verdict | INTERNAL / MAYBE-CFW-NAME-COLLISION (cfw_low=1 — cfw has a method with the same name elsewhere) |
| Permission | Anyone — **intentionally** permissive (paired with createSession) |

**Verdict: same as `createSession` — keep `Permissions.Anyone`, intentional public guest-cart endpoint.** The MAYBE-CFW-NAME-COLLISION flag points at a cfw-side method with the same name (likely an internal cart helper). Not an actual cross-rig caller of the Velo function.

### 6. `ups-shipping.trackShipment` (`ups-shipping.web.js:520`)

| Check | Result |
|---|---|
| In-cfutons callers | **3 backend modules** — `orderTracking.web.js` (×2 call sites), `fulfillment.web.js` (×3), `returnsService.web.js` (×1). Detector v2 already classifies INTERNAL via `in_pdocs_backend`. |
| In stage3-velo | Same callers |
| Same-file caller | No |
| Permission | Anyone — author note: *"customers need to track their own packages"* |

**Verdict: KEEP `Permissions.Anyone` — intentional + actively used.** Six internal call sites across three backend modules. The author's intent for `Anyone` is documented in the source: customer-facing tracking lookups via Wix Studio editor pages. Even if no Wix page currently exposes this, the permission is correct for the documented use case. Tightening would break the design.

**Note**: SUSPICIOUS flag fires because the public-verb name (`track…`) + Anyone perm + no HTTP wrapper / no cfw caller pattern-matches our heuristic. The flag is a true positive on the heuristic but a false positive on the actual security concern.

**Recommended action**: leave as-is. Consider expanding the detector's PUBLIC_VERB_RE allowlist with an exception list for known-intentional public methods (e.g., `trackShipment` is intentional even though it starts with `track*`). Not urgent.

## Why no PR ships from Phase B

The 6 remaining items split cleanly:

- **2 (`submitFabricSampleRequest`, `sendSwatchConfirmationEmail`) need other work to land first.** Filing follow-up beads is the correct action; deletion would mask a bug or pre-empt a planned wiring.
- **4 (`generatePinContent`, `createSession`, `updateCartItems`, `trackShipment`) are intentional or correctly-permissioned.** Keeping them is the right call.

Phase A already extracted the safely-deletable subset. The residual SUSPICIOUS bucket is now signal — these are real items that need design decisions, not just-grep-and-delete work.

## Recommended follow-up beads (for melania to file or skip)

1. **P2 — fabric-sample frontend/backend reconcile** (high value):
   - `src/public/FabricSampleRequest.js` imports `getAvailableSwatches` + `submitFabricSample`
   - Backend has only `submitFabricSampleRequest`
   - Production breaks for any Wix Studio page that mounts this frontend
   - Decision: rename backend / build the missing methods / delete both frontend + backend
   - Owner: godfrey (Velo expertise) or whoever owns the Wix Studio fabric-swatch flow

2. **P3 — `sendSwatchConfirmationEmail` wire-up after cf-c6g5** (track):
   - Add to cf-c6g5 follow-up checklist: "wire sendSwatchConfirmationEmail into swatch-request flow once `swatch_confirmation` template exists"
   - Or delete if a different email-infra path is chosen post-cf-c6g5

3. **P3 — detector heuristic tweak** (cosmetic):
   - `cf-hpwy` v3: PUBLIC_VERB_RE allowlist exceptions for known-intentional Anyone methods (`trackShipment`, `createSession`, `updateCartItems`)
   - Drops SUSPICIOUS from 6 to ~3
   - Low value; defer indefinitely

4. **P3 — wholesale cleanup of "no caller anywhere" services** (Phase B-2):
   - 438 webMethods in DEAD bucket today
   - 6 single-purpose service files concentrate ~70 methods (`emailTemplates` 18, `tradeProgram` 13, etc. — see cf-hpwy report)
   - Big lift; needs per-file decision (keep / supersede / delete)
   - Defer until town has bandwidth

## Source of truth

- `scripts/cf-dead-routes/audit.py` — re-runnable detector (v2)
- `docs/velo-dead-routes-2026-05-09.md` — original cf-hpwy report (PR #1166, merged)
- This doc — Phase B per-item audit

Refs cf-66ne, cf-hpwy, cf-c6g5.
