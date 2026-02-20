# Carolina Futons — Active Sprint Plan

**Status**: IN PROGRESS
**Test Suite**: 457 tests across 22 files (all passing)
**Last Push**: c43e029

---

## Active Crew

| Crew | Focus | Current Task |
|------|-------|-------------|
| **melania** | Crew Lead & Strategist | STRATEGY.md (done) → coordinating crew |
| **caesar** | Design, logistics, e-commerce, social | ✅ Product Page UX, ✅ Category Page → Cart flow audit |
| **radahn** | Code quality, TDD, feature proposals | ✅ seoHelpers, ✅ shippingRates, ✅ 5 stories → httpFunctions tests |

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

## Remaining Work — Priority Order

### P0 — Test Coverage (Radahn)
- [x] tests/seoHelpers.test.js (+29 tests: OG, Twitter Card, Rich Pin, WebSite, Collection schemas)
- [x] tests/shippingRates.test.js (+8 tests: white-glove tiers, local delivery pricing)
- [ ] tests/httpFunctions.test.js (feed endpoints, sitemap) — IN PROGRESS
- [ ] tests/promotions.test.js (lightbox campaign engine)
- [ ] tests/styleQuiz.test.js (recommendation engine)
- [ ] tests/swatchService.test.js (swatch queries)

### P0 — UX Polish (Caesar)
- [x] Product Page audit: 9 improvements (loading states, error messages, accessibility)
- [x] Category Page audit: sort/filter/breadcrumbs/accessibility/performance
- [ ] Cart flow audit: Cart Page → Side Cart → Checkout — NEXT
- [ ] Mobile responsive patterns across all pages
- [ ] Design token consistency check

### P1 — Feature Stories (Radahn)
- [x] Create stories/ directory structure
- [x] Write 5 story files (bugs/001, bugs/005, code-quality/004, tests/002, tests/003)
- [ ] Write 5 more stories (features, additional bugs/tests)

### P1 — Social & Marketing (Caesar)
- [ ] Audit feed endpoint output quality
- [ ] Verify OG meta completeness
- [ ] Improve engagement tracking coverage

### P2 — Needs Wix Dashboard
- [ ] Create 11 CMS collections (see memory.md)
- [ ] Store UPS secrets in Wix Secrets Manager
- [ ] Configure feed URLs in Facebook/Pinterest/Google
- [ ] Set up Wix Automations for care sequence emails
- [ ] Editor layout buildout (element IDs)

---

## Orchestration Rules

1. **Crew members work autonomously** — no waiting for instructions
2. **Always pull before starting** — `git pull` to get latest
3. **Always test before pushing** — `npm test` must pass
4. **Small commits** — one logical change per commit
5. **Push to main** — no feature branches for crew (direct to main)
6. **Conflict resolution** — pull, rebase, fix, push
7. **Communication** — use `gt nudge` for coordination between workers
