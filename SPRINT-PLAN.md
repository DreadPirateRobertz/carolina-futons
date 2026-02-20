# Carolina Futons — Active Sprint Plan

**Status**: IN PROGRESS
**Test Suite**: 553 tests across 28 files (all passing)
**Last Push**: 7f5ecaa
**Updated by**: melania (crew lead) — 2026-02-20 13:48 MST

---

## Active Crew

| Crew | Focus | Current Task |
|------|-------|-------------|
| **melania** | Crew Lead & Strategist | Reviewing stories, updating plans/reports, driving crew |
| **caesar** | Design, UX, social/marketing | Implementing social-feed-og-audit (3 bugs + 3 improvements) |
| **radahn** | Code quality, TDD, stories | STORY-005 (cart recovery dupes) → STORY-006 (swatchService tests) |

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
13. Bug fix: gift card code sanitize truncation
14. swatchService tests (16 tests): product swatches, color families, count, preview colors
15. contactSubmissions tests (11 tests): form submit, sanitization, rate limiting, validation
16. googleMerchantFeed tests (21 tests): XML feed generation, pricing, brands, categories, JSON feed
17. wix-data mock: added skip() method

## Crew Completed This Session

### Caesar — UX Audit (P0) COMPLETE
- [x] Product Page audit: 9 improvements — variant image sync, bundle button fix, quantity selector, accordion, ARIA (`6650a90`)
- [x] Category Page audit: N+1 query fix, bestselling sort, breadcrumbs, quick view states, ARIA (`c43e029`)
- [x] Cart Page audit: quantity/remove wired to API (were no-ops), empty state, 4→1 cart fetches (`dd893da`)
- [x] Side Cart audit: remove wired to API (was animation-only), dedup handlers, error states, ARIA (`6462f12`)
- [x] Checkout audit: ARIA labels on order notes (`125aa37`)
- [x] wix-data mock: added or(), contains(), distinct(), count() (`3307557`)

### Radahn — Test Coverage (P0) + Stories
- [x] seoHelpers tests: +29 tests — OG, Twitter Card, Rich Pin, WebSite, Collection schemas (`017600b`)
- [x] shipping-rates-plugin tests: +8 tests — white-glove tiers, local delivery (`84e231e`)
- [x] httpFunctions tests: +22 tests — feeds, sitemap, health endpoint + new mock (`80cf2f4`)
- [x] promotions tests: +9 tests — active/inactive/expired campaigns (`de8aaf8`)
- [x] styleQuiz tests: +17 tests — scoring, collection matching, budget filtering (`de8aaf8`)
- [x] 5 stories filed: STORY-001 through STORY-005 (`24b4fd0`)
- [x] STORY-006 filed: swatchService tests (`440ae7a`)

### Melania — Strategy & Coordination
- [x] STRATEGY.md: 4 personas, funnel analysis, revenue optimization, competitive positioning, 30/60/90 roadmap (`8fa999e`)
- [x] Story reviews: 4 approved, 1 needs revision (STORY-004)

## Remaining Work — Priority Order

### P0 — Critical Bug Fixes (Caesar — NOW)
- [ ] Fix Facebook + Pinterest feed broken wix:image:// URLs (extract shared wixImageToUrl)
- [ ] Fix category OG meta `[object Promise]` bug (sync vs async)
- [ ] Fix product schema shipping rate (conditional on $999 threshold)
- [ ] Add missing sitemap pages (Wall Huggers, Unfinished Wood, Blog)
- [ ] Fix Pinterest `og:price:amount` tag
- [ ] Add Facebook `content_type` column

### P0 — Bug Fixes (Radahn — NOW)
- [ ] STORY-005: Cart recovery duplicate detection (checkoutId dedup + line item validation)

### P1 — Test Coverage (Mayor — DONE)
- [x] STORY-006: swatchService.test.js (16 tests — mayor completed)
- [x] contactSubmissions.test.js (11 tests — mayor completed)
- [x] googleMerchantFeed.test.js (21 tests — mayor completed)

### P1 — Stories Pending Review
- [ ] STORY-004: Safe element init pattern — NEEDS REVISION (too vague on scope)

### P1 — Remaining UX
- [ ] Mobile responsive patterns across all pages
- [ ] Design token consistency check

### P2 — Needs Wix Dashboard
- [ ] Create 11 CMS collections (see memory.md)
- [ ] Store UPS secrets in Wix Secrets Manager
- [ ] Configure feed URLs in Facebook/Pinterest/Google
- [ ] Set up Wix Automations for care sequence emails
- [ ] Editor layout buildout (element IDs)

---

## Story Tracker

| ID | Title | Author | Status | Priority |
|----|-------|--------|--------|----------|
| STORY-001 | Gift card code truncation | radahn | DONE (already fixed) | P0 |
| STORY-002 | HTTP functions test suite | radahn | DONE (implemented) | P1 |
| STORY-003 | Style quiz test suite | radahn | DONE (implemented) | P1 |
| STORY-004 | Safe element init pattern | radahn | REVISION NEEDED | P2 |
| STORY-005 | Cart recovery duplicate detection | radahn | APPROVED → implementing | P1 |
| STORY-006 | Swatch service test suite | radahn | APPROVED → next | P1 |
| social-feed-og-audit | Feed bugs + OG meta fixes | caesar | APPROVED → implementing | P1 |

---

## Orchestration Rules

1. **Stories go through melania** — submit for review, wait for approval before implementing
2. **Always pull before starting** — `git pull` to get latest
3. **Always test before pushing** — `npx vitest run` must pass
4. **Small commits** — one logical change per commit
5. **Push to main** — no feature branches for crew (direct to main)
6. **Conflict resolution** — pull, rebase, fix, push
7. **Communication** — use `gt nudge` for coordination between workers
