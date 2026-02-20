# Carolina Futons — Active Sprint Plan

**Status**: IN PROGRESS
**Test Suite**: 738 tests across 38 files (all passing)
**Last Push**: fa3ba77
**Updated by**: mayor — 2026-02-20 14:35 MST

---

## Crew Roles (Restructured per Human Orders)

| Crew | Role | Owns | Current Task |
|------|------|------|-------------|
| **melania** | Crew Lead / Quality Gate / Strategist | Sprint plan, report, story approval, design sessions | Updating docs, reviewing stories, driving crew |
| **caesar** | PRIMARY WEBSITE DEVELOPER | All web pages, desktop UX, responsive design, design tokens, ARIA, visual polish | ARIA pass (15/21 done) → 6 policy pages → mobile responsive |
| **radahn** | PRIMARY MOBILE APP DEVELOPER | Mobile-first patterns, mobile app features, touch UX, mobile-specific code/tests | Mobile app proposal → STORY-004/007/008 revisions |

**Workflow**: Both submit SHORT stories to melania for approval before implementing. Nothing ships without review.

---

## Design Session Findings (2026-02-20 13:50 MST)

### Critical Issues Identified

| Issue | Severity | Owner | Action |
|-------|----------|-------|--------|
| Design tokens defined but 0% import usage | HIGH | caesar | Write story to import tokens into top 5 pages |
| ARIA coverage only 29% (6/21 pages) | HIGH | caesar | Write story for ARIA pass on remaining 15 pages |
| 230 try/catch blocks in Product Page alone | MEDIUM | radahn | Revise STORY-004 with hard numbers per file |
| 80% of catch blocks are silent `catch(e){}` | MEDIUM | radahn | Write STORY-008 for shared errorHandler.js |
| No centralized error boundary | MEDIUM | radahn | Part of STORY-008 |
| Loading state pattern is excellent and consistent | — | — | Document as standard (no action needed) |

### UX Patterns Audit Summary

| Pattern | Consistency | Coverage | Status |
|---------|-------------|----------|--------|
| Loading states (Adding.../Added!/Error) | HIGH | 71% | Standard — document and maintain |
| Error messaging | MODERATE | 58% | Needs centralization (STORY-008) |
| ARIA labels | LOW | 29% | Needs expansion (caesar story) |
| Design token usage | NONE | 0% | Critical — tokens exist, not imported (caesar story) |
| Try/catch defensive coding | HIGH | 100% | Needs rationalization (STORY-004 rev) |

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

## Crew Completed This Session

### Caesar — UX Audit (P0) COMPLETE + Social Audit IN PROGRESS
- [x] Product Page UX audit: 9 improvements (`6650a90`)
- [x] Category Page UX audit: N+1 fix, sort, breadcrumbs, ARIA (`c43e029`)
- [x] Cart Page UX audit: quantity/remove API, empty state, 4→1 fetches (`dd893da`)
- [x] Side Cart UX audit: remove API, dedup handlers, ARIA (`6462f12`)
- [x] Checkout ARIA labels (`125aa37`)
- [x] wix-data mock: or(), contains(), distinct(), count() (`3307557`)
- [x] Social feed & OG meta audit story filed (`1347f61`)
- [ ] Feed bug fixes: broken wix:image URLs, [object Promise] OG, shipping schema (IN PROGRESS)
- [ ] Design token import story (PENDING)
- [ ] ARIA expansion story (PENDING)

### Radahn — Tests (P0) COMPLETE + STORY-005 DONE
- [x] seoHelpers +29 tests (`017600b`)
- [x] shipping-rates-plugin +8 tests (`84e231e`)
- [x] httpFunctions +22 tests (`80cf2f4`)
- [x] promotions +9 tests, styleQuiz +17 tests (`de8aaf8`)
- [x] 6 stories filed (STORY-001 through STORY-006)
- [x] STORY-005: Cart recovery dupe fix + 4 tests (`6a3317d`)
- [ ] Mobile app proposal story (ASSIGNED)
- [ ] STORY-004 revision with hard numbers (ASSIGNED)
- [ ] STORY-007: Test hardening story (ASSIGNED)
- [ ] STORY-008: Shared errorHandler.js story (ASSIGNED)

### Melania — Strategy & Coordination
- [x] STRATEGY.md written and pushed (`8fa999e`)
- [x] 6 stories reviewed: 4 approved, 1 revision needed, 1 done
- [x] Design session: full UX pattern audit across 21 page files
- [x] Role restructuring: caesar→web, radahn→mobile
- [ ] Mobile app proposal review (WAITING)
- [ ] Ongoing: report updates after every crew commit

---

## Remaining Work — Priority Order

### P0 — Active Now
- [ ] Caesar: Push feed bug fixes (3 bugs + 3 improvements)
- [ ] Radahn: Write mobile app proposal story

### P1 — Stories Pending
| Story | Author | Status | Reviewer |
|-------|--------|--------|----------|
| social-feed-og-audit | caesar | DONE (`00a2f0a`) | melania |
| Design token integration | caesar | DONE (4 pages: Product, Category, Member, ThankYou) | melania |
| ARIA coverage pass | caesar | DONE (21/21 pages) | melania |
| STORY-004 rev: safe-element-init | radahn | APPROVED (P2 — after PWA) | melania |
| STORY-007: test hardening | radahn | DONE (`8cd2944`) | melania |
| STORY-008: shared errorHandler | radahn | DONE (`3ce9214`) | melania |
| STORY-009: PWA mobile app | radahn | DONE Phase 1 (`927dc0d`) | melania |
| STORY-010: Wix SW research (pivot to PWA-lite) | radahn | APPROVED → implementing | melania |
| STORY-011a: productCache + install banner | radahn | APPROVED → after STORY-010 | melania |
| STORY-011b: touch helpers (swipe/pinch) | radahn | APPROVED → after STORY-011a | melania |

### P2 — Needs Wix Dashboard
- [ ] Create 11 CMS collections (see memory.md)
- [ ] Store UPS secrets in Wix Secrets Manager
- [ ] Configure feed URLs in Facebook/Pinterest/Google
- [ ] Set up Wix Automations for care sequence emails
- [ ] Editor layout buildout (element IDs)

---

## Story Tracker (All Stories)

| ID | Title | Author | Status | Priority |
|----|-------|--------|--------|----------|
| STORY-001 | Gift card code truncation | radahn | DONE (already fixed) | P0 |
| STORY-002 | HTTP functions test suite | radahn | DONE (implemented) | P1 |
| STORY-003 | Style quiz test suite | radahn | DONE (implemented) | P1 |
| STORY-004 | Safe element init pattern (revised) | radahn | APPROVED (P2 — after PWA) | P2 |
| STORY-005 | Cart recovery duplicate detection | radahn | DONE (`6a3317d`) | P1 |
| STORY-006 | Swatch service test suite | radahn | DONE (implemented by mayor) | P1 |
| STORY-007 | Test hardening: XSS, sort, XML | radahn | APPROVED → implementing now | P1 |
| STORY-008 | Shared errorHandler utility | radahn | APPROVED (P2 — after PWA) | P2 |
| STORY-009 | PWA mobile app (Phase 1) | radahn | APPROVED → after STORY-007 | P1 |
| social-feed-og-audit | Feed bugs + OG meta fixes | caesar | DONE (`00a2f0a`) | P1 |
| design-token-integration | Import tokens into 5 pages | caesar | DONE (4 pages) | P1 |
| aria-coverage-pass | ARIA on all pages | caesar | DONE (21/21 pages) | P1 |

---

## Orchestration Rules

1. **All stories go through melania** — submit for review, wait for approval
2. **Run `npx vitest run` BEFORE EVERY COMMIT** — no exceptions, human's direct order
3. **Always pull before starting** — `git pull`
4. **Small commits** — one logical change per commit
5. **Push to main** — no feature branches
6. **Caesar owns web, Radahn owns mobile** — coordinate via melania
7. **Design sessions** — melania calls sessions to ensure web+mobile cohesion
