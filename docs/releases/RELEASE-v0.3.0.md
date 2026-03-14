# Release v0.3.0

**Date:** 2026-03-14
**Since:** v0.2.0 (2026-03-08)
**PRs merged:** 51

## Highlights

- Template migration infrastructure: element ID mapping, remapping utility, connectivity verification across all major pages
- Product Page Phase 1 hookup prep complete (gallery, details, variants, add-to-cart)
- Delivery estimator and assembly guide links wired to Product Page
- TypeError guard sweep across 6 page modules — zero uncaught element access errors
- Test suite grew from 11,079 to 12,084 tests (309 files)
- Codecov integration with PR coverage comments
- Social media story content pipeline launched

---

## Features (19)

| PR | Title |
|----|-------|
| #225 | Category Page filter debounce and grid batching |
| #230 | SEO canonical URLs and Twitter Cards across all pages |
| #235 | Rework team-portrait — rustic photo frames replace geometric stick figures |
| #236 | Redesign contact-showroom building illustration |
| #238 | Email template provisioning for MASTER-HOOKUP Step 8 |
| #247 | CMS collection provisioning for MASTER-HOOKUP Step 4 |
| #248 | Complete email template manifest with backend cross-reference |
| #251 | Codecov integration + cross-repo proposal |
| #255 | Blog + Guides element build spec |
| #257 | About, FAQ, Contact page build specs |
| #261 | Bulk import 313 product photos to Wix Media Manager |
| #264 | Element ID remapping utility |
| #266 | Category Page element mapping for template migration |
| #268 | Product Page Phase 1 template-to-code ID mapping |
| #274 | Cart + Side Cart element ID mapping JSONs |
| #275 | Social media stories, CI fix, gitignore cleanup |
| #283 | Home Page + masterPage element ID mapping |
| #286 | Delivery estimator with live UPS rates |
| #288 | Assembly guide links wired to Product Page |

## Fixes (12)

| PR | Title |
|----|-------|
| #231 | Product image alt text audit and fixes |
| #232 | Cart ARIA test quality improvements |
| #233 | Category Page SSR schema test gaps + MAX_SSR_PRODUCTS |
| #244 | CI: add permissions for PR coverage comments |
| #245 | Defer gift card redemption to order completion |
| #249 | CI: add token permissions for PR comments |
| #252 | Migrate from My Site 1 to My Site 2 IDs |
| #254 | Add missing category folders to mediaGallery + VALID_CATEGORIES |
| #280 | FAQ build order + Contact hardcoded colors |
| #282 | Guard unprotected element accesses in product grid |
| #284 | Catch sync TypeError in prioritizeSections |
| #287 | TypeError guard sweep — wrap bare $w() calls across 6 pages |

## Tests (10)

| PR | Title |
|----|-------|
| #228 | E2E verification of all 5 Velo MCP tools |
| #239 | Edge case tests for accessibility.web.js |
| #240 | Complete test coverage for batch 1 helpers |
| #241 | TDD batch 2 — expand coverage for 6 public helpers |
| #243 | Import count budget tests for page modules |
| #250 | Edge-case tests for 7 public helpers (batch 2) |
| #258 | Contact page edge case validation tests |
| #259 | Product Page gallery wiring tests |
| #260 | Gallery integration tests (ProductGallery + galleryHelpers) |
| #262 | Element ID verification test script |

## Docs (6)

| PR | Title |
|----|-------|
| #246 | Wix MCP gap analysis for My Site 1 staging |
| #253 | Cart + Side Cart + Checkout element build specs |
| #256 | Build specs for Store Locator, Financing, Sustainability |
| #263 | Element ID reconciliation report |
| #265 | Element connectivity verification report |
| #267 | Gitignore audit artifacts and local ops docs |

## CI/Infra (4)

| PR | Title |
|----|-------|
| #227 | Configure vitest coverage thresholds |
| #229 | Prevent CLS on product images |
| #237 | Post coverage summary comments on PRs |
| #281 | Add workflow_dispatch to CI workflow |

---

## Stats

| Metric | v0.2.0 | v0.3.0 | Delta |
|--------|--------|--------|-------|
| Test files | 290 | 309 | +19 |
| Tests | 11,079 | 12,084 | +1,005 |
| Page modules | 39 | 39 | — |
| Public helpers | 100+ | 106 | +6 |
| Backend modules | 91 | 189 | +98 |
| Products cataloged | 88 | 88 | — |
| Product photos imported | 0 | 313 | +313 |

## Template Migration Progress

Element ID mapping completed for:
- Product Page (Phase 1: 25 elements, 7 groups)
- Category Page (full mapping)
- Cart Page + Side Cart
- Home Page + masterPage

Remapping utility (`scripts/remap-element-ids.js`) ready for code-side ID renames.
Connectivity verification report shows 71.4% element coverage on Product Page.

## Breaking Changes

None. All changes are backward-compatible.
