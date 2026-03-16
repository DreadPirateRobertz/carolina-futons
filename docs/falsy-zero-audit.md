# Falsy-Zero Pattern Audit — CF-05nn

**Date:** 2026-03-16
**Auditor:** cfutons/crew/rennala
**Scope:** All `src/backend/*.js` and `src/public/*.js`

## Background

JavaScript's `||` operator treats `0`, `""`, `null`, `undefined`, and `false` as falsy. When used as `value || DEFAULT`, an intentional zero is silently replaced by the default. This bug was found independently in 3 modules before this systematic sweep.

## Methodology

1. Grepped all `src/` for `|| <number>` and `|| DEFAULT_*` patterns
2. Classified each hit as **safe** (zero is invalid/impossible) or **dangerous** (zero is a valid value)
3. Fixed dangerous patterns with `!= null` or `== null` checks
4. Wrote regression tests for each fix

## Fixes Applied (This PR)

### Category 1: `discountedPrice || price` → `discountedPrice != null ? discountedPrice : price`

A `discountedPrice` of `$0` (free item promo) was treated as "no discount," reverting to the base price.

| File | Lines | Sites |
|------|-------|-------|
| `src/backend/facebookCatalog.web.js` | 177, 190, 257, 303, 486 | 5 |
| `src/public/metaPixel.js` | 114, 137, 247 | 3 |
| `src/backend/notificationService.web.js` | 66 | 1 |
| `src/backend/analyticsDashboard.web.js` | 239 | 1 |
| `src/backend/productRecommendations.web.js` | 279, 280 | 2 |
| `src/backend/comparisonService.web.js` | 210, 273, 274 | 3 |
| `src/public/salePageHelpers.js` | 48, 62, 63 | 3 |
| `src/public/product/productSchema.js` | 138 | 1 |
| **Total** | | **19** |

### Category 2: `threshold || DEFAULT` → `threshold != null ? threshold : DEFAULT`

A threshold of `0` should mean "never trigger" (urgency) or "always trigger" (reorder), not silently revert to default 5 or 10.

| File | Lines | Sites |
|------|-------|-------|
| `src/backend/inventoryService.web.js` | 162 | 1 |
| **Total** | | **1** |

### Previously Fixed (Prior PRs)

| File | Bead | Sites |
|------|------|-------|
| `src/backend/inventoryAlerts.web.js` | CF-3xgl | 5 |
| `src/backend/inventoryService.web.js` (other lines) | CF-3xgl | 7 |
| `src/backend/googleMerchantFeed.web.js` | CF-4z4d | 2 |
| `src/backend/seoHelpers.web.js` | CF-qocr | 1 |
| **Total previously fixed** | | **15** |

## Safe Patterns (Not Fixed — No Bug)

These use `|| 0` or `|| 1` where zero/one is the correct fallback for missing data:

- **`price || 0`** (base price) — A $0 base price on furniture is not a valid business state. 40+ sites.
- **`quantity || 0` / `quantity || 1`** — Cart quantity defaults. 20+ sites.
- **`viewCount || 0` / `purchaseCount || 0`** etc. — Counter increments from null. 30+ sites.
- **`parseInt(...) || 0`** — Parse failure fallback. 5+ sites.
- **`rating || 0` / `rating || 5`** — Ratings are 1-5; 0 is invalid. 8 sites.
- **`weight || 50`** (A/B test) — 0-weight variant is not a valid test config. 3 sites.
- **String patterns** (`image || DEFAULT_IMAGE`, `tier || DEFAULT_TIER`) — Zero is not a valid string. 15+ sites.

## Total Impact

| Category | Sites Fixed |
|----------|------------|
| This PR | 20 |
| Prior PRs | 15 |
| **Grand total** | **35** |

## Tests Added

- `tests/falsyZeroAudit.test.js` — 16 regression tests covering all fix categories
