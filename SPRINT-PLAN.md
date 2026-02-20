# Carolina Futons — Active Sprint Plan

**Status**: COMPLETE — All P0/P1 stories done
**Test Suite**: 738 tests across 38 files (all passing)
**Last Push**: a203e97
**Updated by**: melania — 2026-02-20 14:50 MST

---

## Sprint Summary

All P0 and P1 work is complete. 16 stories filed, 16 stories done. Only P2 items remain — these require Wix Dashboard access and cannot be done in code.

---

## Crew Roles (Restructured per Human Orders)

| Crew | Role | Status |
|------|------|--------|
| **melania** | Crew Lead / Quality Gate / Strategist | DONE — sprint plan, report, 16 story reviews, design session, coordination |
| **caesar** | PRIMARY WEBSITE DEVELOPER | DONE — UX audits, ARIA 21/21, design tokens complete, mobile responsive, safeInit |
| **radahn** | PRIMARY MOBILE APP DEVELOPER | DONE — 85+ tests, PWA-lite complete, productCache, touchHelpers, page integration |

---

## Design Session Findings (2026-02-20 13:50 MST) — ALL RESOLVED

| Issue | Severity | Owner | Resolution |
|-------|----------|-------|------------|
| Design tokens defined but 0% import usage | HIGH | caesar | **DONE** — all pages with inline styles tokenized |
| ARIA coverage only 29% (6/21 pages) | HIGH | caesar | **DONE** — 21/21 pages (100%) |
| 230 try/catch blocks in Product Page alone | MEDIUM | caesar | **DONE** — safeInit.js (8 helpers, 16 tests) |
| 80% of catch blocks are silent `catch(e){}` | MEDIUM | radahn | **DONE** — errorHandler.js (13 tests) |
| No centralized error boundary | MEDIUM | radahn | **DONE** — part of errorHandler.js |
| Loading state pattern is excellent and consistent | — | — | Documented as standard |

---

## Mayor Completed This Sprint

1. Security remediation (sanitize, admin auth, rate limiting) — 38 tests
2. Test infrastructure fixes (6 Wix mocks, vitest aliases)
3. 6 new backend modules: loyalty, coupons, cartRecovery, deliveryScheduling, assemblyGuides, giftCards
4. GA4 enhanced analytics events (5 event builders)
5. White-glove delivery tier ($149/$249, free >$1,999)
6. Facebook + Pinterest catalog feed endpoints
7. Open Graph / Rich Pin / Twitter Card meta generators
8. Blog.js page (SEO schema, product sidebar, social share, newsletter)
9. Wishlist sharing (4 channels) + loyalty points on Member Page
10. Post-purchase care sequence on Thank You Page
11. PLUGIN-RECOMMENDATIONS.md + SOCIAL-MEDIA-STRATEGY.md
12. 3 new test suites: giftCards (18), deliveryScheduling (16), assemblyGuides (15)
13. Gift card code sanitize truncation fix
14. 3 more test suites: swatchService (16), contactSubmissions (11), googleMerchantFeed (20)
15. 2 more test suites: designTokens (18), galleryConfig (12)
16. emailService tests (+8)

## Crew Completed This Session — ALL DONE

### Caesar — ALL TASKS COMPLETE
- [x] Product Page UX audit: 9 improvements (`6650a90`)
- [x] Category Page UX audit: N+1 fix, sort, breadcrumbs, ARIA (`c43e029`)
- [x] Cart Page UX audit: quantity/remove API, empty state, 4→1 fetches (`dd893da`)
- [x] Side Cart UX audit: remove API, dedup handlers, ARIA (`6462f12`)
- [x] Checkout ARIA labels (`125aa37`)
- [x] wix-data mock: or(), contains(), distinct(), count() (`3307557`)
- [x] Social feed & OG meta fix: 3 bugs + 3 improvements (`00a2f0a`)
- [x] mediaHelpers tests: 8 tests (`c4e9e98`)
- [x] Design token integration: COMPLETE — all inline-styled pages tokenized (`2aa0405`→`516edf4`)
- [x] ARIA coverage pass: 21/21 pages (`d7aa91d`→`021da01`)
- [x] Mobile responsive pass: 13 pages, well-tiered (`cfd50d2`→`05ba012`)
- [x] STORY-004: safeInit utility — 8 helpers, 16 tests (`59840c2`)

### Radahn — ALL TASKS COMPLETE
- [x] seoHelpers +29 tests (`017600b`)
- [x] shipping-rates-plugin +8 tests (`84e231e`)
- [x] httpFunctions +22 tests (`80cf2f4`)
- [x] promotions +9 tests, styleQuiz +17 tests (`de8aaf8`)
- [x] 11 stories filed (STORY-001 through STORY-011)
- [x] STORY-005: Cart recovery dupe fix + 4 tests (`6a3317d`)
- [x] STORY-007: Test hardening — XSS, sort, XML (`8cd2944`)
- [x] STORY-008: Shared errorHandler + 13 tests (`3ce9214`)
- [x] STORY-009: PWA Phase 1 — manifest, service worker, install helpers + 17 tests (`927dc0d`)
- [x] STORY-010: Wix SW research → PWA-lite pivot (`ba4f8c7`)
- [x] STORY-011b: touchHelpers — swipe + pinch-zoom + 7 tests (`9893787`)
- [x] productCache module — LRU cache, 24hr TTL, recently viewed + 10 tests
- [x] STORY-011a: Page integration — Product cache, Category recently-viewed, masterPage install banner, Search Results, FAQ (`2dd8e5d`→`01cd3d3`)

### Melania — ALL TASKS COMPLETE
- [x] STRATEGY.md written and pushed (`8fa999e`)
- [x] 16 stories reviewed: 14 approved, 1 revision requested, 1 already done
- [x] Design session: full UX pattern audit across 21 page files — all 5 findings resolved
- [x] Role restructuring: caesar→web, radahn→mobile
- [x] 8 report checkpoints, 20+ coordination nudges
- [x] Final sprint wrap-up report

---

## Story Tracker — ALL COMPLETE

| ID | Title | Author | Status | Priority |
|----|-------|--------|--------|----------|
| STORY-001 | Gift card code truncation | radahn | **DONE** | P0 |
| STORY-002 | HTTP functions test suite | radahn | **DONE** | P1 |
| STORY-003 | Style quiz test suite | radahn | **DONE** | P1 |
| STORY-004 | Safe element init pattern | caesar | **DONE** (`59840c2`, 16 tests) | P2 |
| STORY-005 | Cart recovery duplicate detection | radahn | **DONE** (`6a3317d`, 4 tests) | P1 |
| STORY-006 | Swatch service test suite | mayor | **DONE** (16 tests) | P1 |
| STORY-007 | Test hardening: XSS, sort, XML | radahn | **DONE** (`8cd2944`) | P1 |
| STORY-008 | Shared errorHandler utility | radahn | **DONE** (`3ce9214`, 13 tests) | P2 |
| STORY-009 | PWA mobile app (Phase 1) | radahn | **DONE** (`927dc0d`, 17 tests) | P1 |
| STORY-010 | Wix SW compatibility research | radahn | **DONE** — pivoted to PWA-lite (`ba4f8c7`) | P0 |
| STORY-011a | PWA Phase 2: page integration | radahn | **DONE** (5 pages) | P1 |
| STORY-011b | PWA Phase 2: touch helpers | radahn | **DONE** (`9893787`, 7 tests) | P1 |
| social-feed-og-audit | Feed bugs + OG meta fixes | caesar | **DONE** (`00a2f0a`) | P1 |
| design-token-integration | Import tokens into pages | caesar | **DONE** (all inline-styled pages) | P1 |
| aria-coverage-pass | ARIA on all pages | caesar | **DONE** (21/21 pages) | P1 |
| mobile-responsive-pass | Mobile helpers on pages | caesar | **DONE** (13 pages, well-tiered) | P1 |

---

## Only Remaining — P2 (Needs Wix Dashboard)

These items cannot be done in code — they require manual Wix Dashboard access:

- [ ] Create 11 CMS collections (loyalty, coupons, cart recovery, delivery scheduling, assembly guides, etc.)
- [ ] Store UPS API secrets in Wix Secrets Manager
- [ ] Configure feed URLs in Facebook Business, Pinterest, Google Merchant
- [ ] Set up Wix Automations for post-purchase care sequence emails
- [ ] Editor layout buildout (map element IDs to $w selectors)

---

## Orchestration Rules

1. **All stories go through melania** — submit for review, wait for approval
2. **Run `npx vitest run` BEFORE EVERY COMMIT** — no exceptions, human's direct order
3. **Always pull before starting** — `git pull`
4. **Small commits** — one logical change per commit
5. **Push to main** — no feature branches
6. **Caesar owns web, Radahn owns mobile** — coordinate via melania
7. **Design sessions** — melania calls sessions to ensure web+mobile cohesion
