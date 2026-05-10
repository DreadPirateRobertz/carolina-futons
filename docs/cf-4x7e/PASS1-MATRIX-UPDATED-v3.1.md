# cf-4x7e Pass 1 Matrix — UPDATED v3.1 (post chunks 11+12 + collision-filter)

> **Generated**: 2026-05-10 by miquella · **Bead**: cf-sq0d.fu1 / cf-4x7e.1.fu1 · **Supersedes**: [`PASS1-MATRIX-UPDATED.md`](./PASS1-MATRIX-UPDATED.md) for the chunks 13+ planning lens.
>
> Two consecutive inverted-FPs (chunks 11 + 12 — `checkBackInStock`, `calculateBundleDiscount`) traced to the v3 detector crediting frontend files as backend callers when those files happened to define their own same-named functions. Detector fix in this PR adds a **same-name-collision filter**: a candidate caller is skipped when it locally declares `function NAME` / `const NAME = …` AND has no quoted-string reference to the defining backend module.
>
> Net effect on the chunk-13+ pickable list: **-1 file** (`wishlistAlerts` already shipped in chunks 11+12) and **-2 method-level FPs** corrected (`calculateBundleDiscount` flips ALIVE-INTERNAL → PATH-ONLY; `getLowStockAlerts` likewise after `inventoryAlerts.web.js`'s post-chunk state).

---

## Detector deltas (v3 → v3.1)

| Bucket | v3 (any-match) | v3.1 (any-match) | Δ |
|---|---:|---:|---:|
| INTERNAL | 230 | 196 | **−34** |
| FRONTEND | 375 | 363 | −12 |
| HTTP-EXPOSED | 80 | 80 | 0 |
| EVENT-WIRED | 9 | 9 | 0 |
| FILESYSTEM-PATH-REFERENCED | 908 | 885 | −23 |
| DEAD | 4 | 4 | 0 |

The 34-method INTERNAL drop is the FP correction surface area. Most are admin / dashboard helpers whose names happened to be common verb–noun pairs (`recordError`, `getDashboard`, etc.) and matched local helpers in cfutons frontend bundles.

---

## Chunks 11+12 — DELETED in this window

| Chunk | File | Notes |
|---|---|---|
| 11 | `wishlistAlerts.web.js` | DELETE-WHOLE (the only "alive" caller `checkBackInStock` was an AddToCart.js local-fn name collision). |
| 12 | `dynamicPricing.web.js` (kept) | KEEP-PARTIAL → after the `calculateBundleDiscount` FP correction, **all 7 methods are PATH-ONLY**. Whole file is a Pass 3 DELETE-WHOLE candidate now. (See below.) |

(Per melania's chunk reports — exact PR numbers may differ; verifying against \`git log\` for the canonical SHAs is morgott's call when finalizing chunk 13.)

---

## Chunks 13+ pickable list (post-FP fix)

The 7 surviving KEEP-PARTIAL files. **One has graduated to DELETE-WHOLE** post-fix (`dynamicPricing`). Each row is an independent Pass 3 chunk.

### 🟢 DELETE-WHOLE — graduated post-FP

#### `dynamicPricing.web.js` — 7 methods (alive 0 / path-only 7)

| Method | Status |
|---|---|
| `calculateDynamicPrice` | path-only |
| `evaluateClearanceCandidates` | path-only |
| `calculateBundleDiscount` | path-only **← FP corrected v3.1** |
| `recordDemandSignal` | path-only |
| `getDemandMetrics` | path-only |
| `getClearanceQueue` | path-only |
| `updatePricingRule` | path-only |

The `bundleDiscountExperiment.js` "caller" was a same-name local export. With that FP cleared, no symbol caller remains. **Chunk 13 candidate**: drop the whole file + tests.

### 🔵 KEEP-PARTIAL — remaining 6 files

#### `errorMonitoring.web.js` — 1 method survives, was 9
| Method | Status | Caller |
|---|---|---|
| `logError` | ALIVE | `challengeService.web.js`, `swatchAttribution.web.js`, +many |

The 8 path-only admin/dashboard helpers were **already retired in an earlier chunk** (only `logError` remains in the file). Confirms the surgery was clean. **No Pass 3 work needed** here unless `logError` itself moves.

#### `coreWebVitals.web.js` — 1 method survives, was 8
| Method | Status | Caller |
|---|---|---|
| `reportMetrics` | ALIVE | `src/pages/masterPage.js` |

Same shape as `errorMonitoring` — already trimmed; only the wired ingestion path remains. **No Pass 3 work needed.**

#### `warrantyService.web.js` — 9 methods (alive 2 / path-only 7)
| Method | Status | Caller |
|---|---|---|
| `registerWarranty` | ALIVE | `Warranty Registration.js` |
| `getMyWarranties` | ALIVE | `src/public/WarrantyWidget.js` |
| `getWarrantyPlans` | path-only | (tests) |
| `calculateWarrantyPrice` | path-only | (tests) |
| `purchaseWarranty` | path-only | (tests) |
| `getWarrantyDetails` | path-only | (tests) |
| `submitClaim` | path-only | (tests) |
| `getClaimStatus` | path-only | (tests) |
| `getMyClaims` | path-only | (tests) |

**Pass 3 chunk candidate**. Stilgar-check still open: claims UI planned or shelved?

#### `inventoryService.web.js` — 10 methods (alive 3 / path-only 7)
| Method | Status | Caller |
|---|---|---|
| `getStockStatus` | ALIVE | `liveInventory.web.js`, `src/public/InventoryDisplay.js` |
| `signUpBackInStock` | ALIVE | `liveInventory.web.js` |
| `getInventoryUrgency` | ALIVE | `src/public/inventoryUrgency.js` |
| `getLowStockAlerts` | path-only | (tests) **← was ALIVE pre-v3.1** |
| `getInventoryDashboard` | path-only | (tests) |
| `updateStockLevel` | path-only | (tests) |
| `getRestockSuggestions` | path-only | (tests) |
| `getBackInStockSignups` | path-only | (tests) |
| `getBackInStockDashboard` | path-only | (tests) |
| `markSignupsNotified` | path-only | (tests) |

**Pass 3 chunk candidate**. The `getLowStockAlerts` shift to PATH-ONLY came after `inventoryAlerts.web.js` was deleted in an earlier chunk; cross-rig-sweep confirms.

#### `photoReviews.web.js` — 6 methods (alive 1 / path-only 5)
| Method | Status | Caller |
|---|---|---|
| `submitPhotoReview` | ALIVE | `Submit Photo Review.js` |
| `getPhotoReviews` | path-only | (tests) |
| `moderatePhotoReview` | path-only | (tests) |
| `getPhotoGallery` | path-only | (tests) |
| `reportPhotoReview` | path-only | (tests) |
| `getPhotoReviewStats` | path-only | (tests) |

**Pass 3 chunk candidate**. Stilgar-check still open: gallery / moderation feature.

#### `affiliateProgram.web.js` — 10 methods (alive 2 / path-only 8)
| Method | Status | Caller |
|---|---|---|
| `getMyAffiliateLinks` | ALIVE | `src/public/affiliateHelpers.js` |
| `getAffiliateDashboard` | ALIVE | `src/public/affiliateHelpers.js` |
| `applyForAffiliate` | path-only | (tests) |
| `getMyAffiliateAccount` | path-only | (tests) |
| `createAffiliateLink` | path-only | (tests) |
| `recordAffiliateConversion` | path-only | (tests) |
| `getMyCommissions` | path-only | (tests) |
| `requestPayout` | path-only | (tests) |
| `getMyPayouts` | path-only | (tests) |
| `updatePaymentInfo` | path-only | (tests) |

**Pass 3 chunk candidate**. The two ALIVE methods are confirmed by `affiliateHelpers.js` having explicit calls (verified — no local same-name decls).

---

## Recommended chunk 13+ sequence (revised)

| # | File | Action | Methods removed |
|---|---|---|---:|
| 13 | `dynamicPricing.web.js` | DELETE-WHOLE (post-FP graduation) | 7 |
| 14 | `inventoryService.web.js` | KEEP-PARTIAL surgical | 7 |
| 15 | `affiliateProgram.web.js` | KEEP-PARTIAL surgical | 8 |
| 16 | `photoReviews.web.js` | KEEP-PARTIAL surgical (Stilgar-check first) | 5 |
| 17 | `warrantyService.web.js` | KEEP-PARTIAL surgical (Stilgar-check first) | 7 |

`errorMonitoring` and `coreWebVitals` are excluded — already trimmed to alive-only in earlier chunks.

Total chunk 13–17 deletion target: ~34 methods + matching test files.

## Filter precedent for future detector iterations

The same-name-collision filter is a **conservative** screen: it skips a candidate only when (a) the file declares the symbol locally **and** (b) no quoted-path reference to the defining backend module is present. Re-export and namespace-alias patterns (rare but possible) still get credited because they will carry the path string. If a future audit surfaces a missed-real-caller class, extend the second leg of the AND clause — not the first.

## Refs
- Bead: cf-sq0d.fu1 (collision filter for chunks 11+12 inverted-FPs)
- Detector: `scripts/cf-dead-routes/audit.py` v3.1 — same PR
- Predecessor matrix: `docs/cf-4x7e/PASS1-MATRIX-UPDATED.md` (still authoritative for the historical chunks 1–8 record)
- Pass 1 origin: `docs/cf-66ne-phase-b2-decision-matrix-2026-05-10.md` (PR #1209)
