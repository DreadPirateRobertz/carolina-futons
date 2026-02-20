# Carolina Futons — Active Sprint Plan

**Status**: IN PROGRESS
**Test Suite**: 421 tests across 22 files (all passing)
**Last Push**: aa2c42f

---

## Active Crew

| Crew | Focus | Current Task |
|------|-------|-------------|
| **caesar** | Design, logistics, e-commerce, social | Audit Product Page UX → Category Page UX |
| **radahn** | Code quality, TDD, feature proposals | Write seoHelpers tests → shippingRates tests → stories/ |

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
- [ ] tests/seoHelpers.test.js (schema generation, OG meta, Rich Pins)
- [ ] tests/shippingRates.test.js (shipping plugin, white-glove, fallbacks)
- [ ] tests/httpFunctions.test.js (feed endpoints, sitemap)
- [ ] tests/promotions.test.js (lightbox campaign engine)
- [ ] tests/styleQuiz.test.js (recommendation engine)
- [ ] tests/swatchService.test.js (swatch queries)

### P0 — UX Polish (Caesar)
- [ ] Product Page audit: loading states, error messages, accessibility
- [ ] Category Page audit: same
- [ ] Cart flow audit: Cart Page → Side Cart → Checkout
- [ ] Mobile responsive patterns across all pages
- [ ] Design token consistency check

### P1 — Feature Stories (Radahn)
- [ ] Create stories/ directory structure
- [ ] Write 5-10 bite-size story files for next sprint
- [ ] Categories: code-quality, tests, features, bugs

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
