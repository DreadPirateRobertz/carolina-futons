# cf-4x7e Pass 1 Matrix — UPDATED v3.2 (post chunks 11–13 + JSDoc-strip filter)

> **Generated**: 2026-05-10 by miquella · **Bead**: cf-sq0d.fu2 · **Supersedes**: [`PASS1-MATRIX-UPDATED-v3.1.md`](./PASS1-MATRIX-UPDATED-v3.1.md) for chunks 14+ planning.
>
> Fourth FP shape from morgott's chunk-14 sweep on `affiliateProgram.web.js`: the two methods classified ALIVE (`getMyAffiliateLinks`, `getAffiliateDashboard`) were credited to `src/public/affiliateHelpers.js` whose **only mentions of those names are in JSDoc `@param` description text**. The v3.1 same-name-collision filter requires a local declaration to trip; pure JSDoc text doesn't match. v3.2 strips JSDoc/block + line comments before any caller-hit check.

---

## Detector deltas (v3.1 → v3.2)

| Bucket | v3.1 (any-match) | v3.2 (any-match) | Δ |
|---|---:|---:|---:|
| INTERNAL | 196 | (recompute below — pending stable run) | |
| FRONTEND | 363 | (recompute) | |
| HTTP-EXPOSED | 80 | 80 | 0 |
| EVENT-WIRED | 9 | 9 | 0 |
| FILESYSTEM-PATH-REFERENCED | 885 | (similar) | |
| DEAD | 4 | **5** | **+1** |

The new DEAD entry is `affiliateProgram` (via the JSDoc-FP correction promoting the entire file's 2 "alive" methods to PATH-ONLY — see below).

A bonus surface from v3.2: 1 fresh **`GAP-CFW-WANTS`** appeared — `customEvents.web::trackCustomEvent` (cfw has 2 high-confidence callVelo references but no `post_trackCustomEvent` HTTP wrapper). Filing as a follow-up bead per cf-vtx5 norms.

---

## Chunks 14+ pickable list (post-JSDoc-strip)

### 🟢 DELETE-WHOLE — graduated post-FP

#### `affiliateProgram.web.js` — 10 methods (alive 0 / path-only 10)

The two methods previously classified ALIVE-INTERNAL were credited to JSDoc text in `src/public/affiliateHelpers.js`:

```
affiliateHelpers.js:137:  * @param {Object} dashboardData - Dashboard data from getAffiliateDashboard
affiliateHelpers.js:174:  * @param {Object} linkData     - Link data from getMyAffiliateLinks
```

Pure description strings, not code. `affiliateHelpers.js` itself has zero consumers; its `initAffiliateDashboard` / `initAffiliateLinkItem` helpers are uncalled.

| Method | Status |
|---|---|
| `applyForAffiliate` | path-only |
| `getMyAffiliateAccount` | path-only |
| `createAffiliateLink` | path-only |
| `getMyAffiliateLinks` | path-only **← FP corrected v3.2** |
| `recordAffiliateConversion` | path-only |
| `getMyCommissions` | path-only |
| `getAffiliateDashboard` | path-only **← FP corrected v3.2** |
| `requestPayout` | path-only |
| `getMyPayouts` | path-only |
| `updatePaymentInfo` | path-only |

**Chunk 14 candidate**: drop the whole file + tests. Also clean up the dead `affiliateHelpers.js` in the same chunk (or follow-up) since it's the only file the JSDoc lived in.

### 🔵 KEEP-PARTIAL — remaining 2 files

#### `warrantyService.web.js` — 9 methods (alive 2 / path-only 7) — unchanged from v3.1

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

**Chunk 15 candidate**. Stilgar-check open: claims UI planned or shelved?

#### `photoReviews.web.js` — 6 methods (alive 1 / path-only 5) — unchanged

| Method | Status | Caller |
|---|---|---|
| `submitPhotoReview` | ALIVE | `Submit Photo Review.js` |
| `getPhotoReviews` | path-only | (tests) |
| `moderatePhotoReview` | path-only | (tests) |
| `getPhotoGallery` | path-only | (tests) |
| `reportPhotoReview` | path-only | (tests) |
| `getPhotoReviewStats` | path-only | (tests) |

**Chunk 16 candidate**. Stilgar-check open: gallery/moderation feature.

---

## Already shipped (chunks 13 reconciliation)

`inventoryService.web.js` shipped in chunk 13 — keep 3 / drop 7. Current status (post-chunk-13):

| Method | Status | Caller |
|---|---|---|
| `getStockStatus` | ALIVE | `liveInventory.web.js`, `InventoryDisplay.js` |
| `signUpBackInStock` | ALIVE | `liveInventory.web.js` |
| `getInventoryUrgency` | ALIVE | `src/public/inventoryUrgency.js` |

The 7 dropped methods (incl. `getLowStockAlerts`) are no longer present. Detector v3.2 confirms the file is now `KEEP-FULL` shape.

---

## Recommended chunk 14+ sequence (revised)

| # | File | Action | Methods removed | Notes |
|---|---|---|---:|---|
| 14 | `affiliateProgram.web.js` | DELETE-WHOLE (post-JSDoc-FP graduation) | 10 | Also retire `src/public/affiliateHelpers.js` (zero consumers; was the JSDoc holder). |
| 15 | `warrantyService.web.js` | KEEP-PARTIAL surgical (Stilgar-check first) | 7 | Claims UI roadmap question. |
| 16 | `photoReviews.web.js` | KEEP-PARTIAL surgical (Stilgar-check first) | 5 | Gallery/moderation roadmap question. |

Total chunks 14–16 deletion target: ~22 methods + matching tests + `affiliateHelpers.js`.

## Tangential finding — file as separate bead

**`customEvents.web::trackCustomEvent`** newly surfaced as `GAP-CFW-WANTS` under v3.2:
- cfw has 2 high-confidence callVelo references for `trackCustomEvent`
- No `post_trackCustomEvent` HTTP wrapper in cfutons `http-functions.js`
- Same shape as the cf-vtx5 cluster — needs an HTTP wrapper for cfw to actually reach it

Recommend filing as `cf-customEvents-wrapper` (P3, ~2hr work — single dispatcher entry + Permissions.Anyone gate + tests). Not in this PR's scope.

---

## Filter precedent

cf-sq0d.fu2 strips comments at every caller-hit check site:
1. Per-file caller scan (the inner loop)
2. Same-file call detection
3. http-functions.js / events.js text load (in `main()`)

The two regexes are intentionally simple — `/\* … \*/` block-strip + `(^|[^:])//[^\n]*` line-strip with URL-scheme guard. JS template literals containing comment-like substrings are rare enough that the filter doesn't try to parse them; if a future regression surfaces, upgrade to a proper tokenizer at that point.

If a fifth shape of FP surfaces:
- **CSS-in-JS / template-literal mention** — the symbol name appears inside a backtick string. Mitigation: strip backtick-quoted regions too, with care that legitimate `\`/_functions/\${name}\`` callVelo patterns aren't lost (they're already matched by the URL pattern, which is path-aware).
- **Generated artifact** — the symbol shows up in a `.next/`, `dist/`, or `coverage/` file we accidentally walked. Mitigation: add explicit ignore prefixes to `all_source_files()` if the walker isn't already filtering them.

Both are out of scope here unless they bite a specific chunk.

---

## Refs
- Bead: cf-sq0d.fu2 (JSDoc-strip filter)
- Detector: `scripts/cf-dead-routes/audit.py` v3.2 (same PR)
- Predecessor: `docs/cf-4x7e/PASS1-MATRIX-UPDATED-v3.1.md` (still authoritative for v3.1's collision-filter coverage)
- Pass 1 origin: `docs/cf-66ne-phase-b2-decision-matrix-2026-05-10.md` (PR #1209)
