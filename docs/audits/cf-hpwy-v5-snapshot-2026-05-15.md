# cf-hpwy v5 detector snapshot — 2026-05-15

**Bead:** cf-5dto
**Branch:** `feat/cf-hpwy-v5-detector`
**Detector version:** v5 (cf-5dto — closes 3 FP-shape blind spots surfaced during cf-4x7e.B3/B4/B5)

## What's new in v5

Three enhancements, each closing a specific false-positive shape that cost a 1-PR revert during cf-4x7e:

### 1. Non-webMethod export inventory
v4 only scanned `export const NAME = webMethod(...)`. v5 adds a parallel inventory of `export [async] function NAME(...)` exports in `src/backend/*.web.js`. Result: 149 non-webMethod function exports surfaced.

**Trap closed:** cf-4x7e.B5 (PR #1333) initially planned to whole-file-delete `comfortTimeline.web.js`. All 4 webMethods were correctly DEAD, but the file also exported a non-webMethod `async function createTimeline(...)` that `tests/integration/purchaseFlowSmoke.test.js` dynamically imports. v4 was blind to this; v5 reports it as a separate inventory so the operator decides surgical-drop vs whole-file before the revert.

### 2. INTENTIONAL_ANYONE bucket propagation
v4 had the `INTENTIONAL_ANYONE` allowlist but only used it to gate the SUSPICIOUS flag. Allowlisted methods with no in-tree callers still bucketed DEAD. v5 adds an explicit `HTTP-EXPOSED-INTENTIONAL` bucket and `OK-INTENTIONAL-ANYONE` gap-verdict so allowlisted endpoints are correctly flagged as kept-by-design.

**Trap closed:** cf-4x7e.B4 (PR #1331) initially picked `cartSessionService.web.js` for whole-file delete. The allowlist correctly suppressed SUSPICIOUS but the file still bucketed DEAD in the planning report. The mobile-rig consumer (out of in-tree scope) is what kept the file alive.

### 3. CI-sentinel sub-classification
v4 had one bucket: `FILESYSTEM-PATH-REFERENCED`. v5 splits each consumer into a sub-classification:

| Sub-bucket | Consumer path shape | Deletion semantic |
|---|---|---|
| `FS-PATH-TEST-IMPORT` | `tests/*.test.{js,ts}` | Test-target; migrate test then safe to delete |
| `FS-PATH-DATA-SOURCE` | `scripts/*.{js,ts,py,sh,mjs,cjs}` | Tooling depends on file body; refactor tooling FIRST |
| `FS-PATH-OTHER` | anything else | Operator inspects manually |

**Trap closed:** cf-4x7e.B4 (PR #1331) initially picked `loadCatalogMaster.web.js` for whole-file delete. v3 caught the fs-path reference but didn't distinguish `scripts/validate-catalog.js` (parses VALID_CATEGORIES from file body — data-source) from `tests/validateCatalog.test.js` (test-import). Reverted by hand; v5 now exposes both kinds on the row.

## v5 live tally (cfutons + cfw cross-rig scan)

```
scanning 2056 src files
webMethods discovered: 755
cfw src files: 808
backend modules referenced by filesystem-path: 23
backend modules wired via namespace dispatcher: 1
  wishlistService -> wishlistServiceModule
```

### Primary bucket (first match per row)
| Bucket | Count |
|---|---:|
| FRONTEND | 319 |
| FILESYSTEM-PATH-REFERENCED | 286 |
| HTTP-EXPOSED | 75 |
| INTERNAL | 64 |
| EVENT-WIRED | 6 |
| HTTP-EXPOSED-INTENTIONAL | **5** ← new in v5 |
| **DEAD** | **0** ← was 287 pre-B3 baseline |

### Gap-verdict tally (cf-hpwy core)
| Verdict | Count |
|---|---:|
| VELO-INTERNAL | 658 |
| WRAPPED-NO-CONSUMER | 44 |
| OK-WIRED | 29 |
| MAYBE-CFW-NAME-COLLISION | 17 |
| **OK-INTENTIONAL-ANYONE** | **5** ← new in v5 |
| OK-WIRED-VIA-DISPATCHER | 2 |
| GAP-CFW-WANTS | 0 |
| UNUSED-CAN-DELETE | 0 |

**Headline: DEAD count = 0.** The cf-4x7e wave (231 methods retired, ~-54k LOC across B-3/B-4/B-5/B-5.fu plus parallel crew work) cleared every truly-dead webMethod in scope. v5's allowlist propagation reclassified the 5 false-DEAD entries (cartSessionService.{createSession,updateCartItems}, ups-shipping.trackShipment, pinterestCatalogSync.generatePinContent, emailService.sendSwatchConfirmationEmail) into their correct `HTTP-EXPOSED-INTENTIONAL` bucket.

## Non-webMethod export inventory

149 non-webMethod function exports across `src/backend/*.web.js`. The majority are deliberate test-seam underscores (`_check*RateLimit`, `__resetCache`, `__clearCache`) — these are exposed for tests to drive specific paths but aren't part of the production caller graph.

Operator action: before a whole-file delete, cross-check the non-webMethod inventory for the target file. If any export is consumed outside of the same module's tests or its own webMethod handlers, surgical-drop instead of whole-file.

## Test coverage

`scripts/cf-dead-routes/test_audit_v5.py`: 10 tests, all green. Pinning:
- 3× non-webMethod export shape detection (async function, plain function, const-value skip)
- 2× INTENTIONAL_ANYONE propagation (allowlist hit → bucket; non-allowlist Anyone still DEAD)
- 4× fs-path consumer classification (test-import, data-source-js, data-source-py, other-fallthrough)
- 1× integration: classify_method row includes `fs_path_consumer_kinds` field with both data-source and test-import for a mixed consumer set

Full v3+v4+v5 suite: 35/35 pass, no regression.

## Refs
- Source bead: cf-5dto
- Lineage: cf-hpwy v2 (CF-byib) → v3 (cf-sq0d) → v3.1 (cf-sq0d.fu1) → v3.2 (cf-sq0d.fu2) → v4 (cf-eov3, PR #1315) → **v5 (cf-5dto, this PR)**
- Traps closed during: cf-4x7e.B3 (PR #1325), B4 (PR #1331), B5 (PR #1333), B5.fu (PR #1337)
