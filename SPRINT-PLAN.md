# Carolina Futons — Active Sprint Plan

**Status**: LAUNCH READY — All blockers resolved, deployment-ready
**Test Suite**: 3,535+ tests across 97 files (all passing)
**Updated by**: architect — 2026-02-22

---

## Launch Readiness

| Item | Status |
|------|--------|
| CI/Tests | GREEN — 3,535+ tests, 97 files |
| CMS Collections | LIVE — 16 collections created |
| Secrets Manager | LIVE — 8 secrets configured |
| Payment | LIVE — Wix Payments (Credit, Apple Pay, Google Pay, Afterpay) |
| DNS | RESOLVED — Wix handles it |
| Backend Modules | 63 .web.js modules |
| Page Code | 24 pages with $w bindings |
| Media Gallery | READY — wix-media-backend integration |

### Last Blocker
- None — catalog shipped (88 products enriched)

---

## Active Assignments

| Bead | Title | Priority | Assignee | Status |
|------|-------|----------|----------|--------|
| cf-k73 | Scrape CarolinaFutons.com catalog | P0 | brainstorm | IN_PROGRESS |
| cf-1iq | Customer account dashboard | P1 | radahn | IN_PROGRESS |
| cf-e7n | Product photography | P0 | — | OPEN (partially resolved by media API) |

---

## Closed This Session (20+ beads)

### Features Shipped by melania
| Bead | Title | Tests |
|------|-------|-------|
| cf-0lr | Bundle builder (cart-aware cross-sell) | 50 |
| cf-fbg | Sustainability badges + trade-in | 54 |
| cf-of4 | Wix Media Manager gallery integration | 35 |
| cf-5ef | Marketing strategy ($15K/month) | — |
| cf-0fm | Deployment guide | — |

### Features Shipped by crew
| Bead | Title | Worker | Tests |
|------|-------|--------|-------|
| cf-2fx | Checkout optimization | radahn | 60 |
| cf-eiu | Core Web Vitals tracking | caesar | 51 |
| cf-bpp | Photo reviews with moderation | brainstorm | 28 |
| cf-z8t | SEO topic clusters | brainstorm | 57 |
| cf-7bk | Inventory management | caesar | 37 |
| cf-0xa | Product comparison | caesar | 84 |
| cf-1nb | Browse abandonment | caesar | 44 |
| cf-xfr | Customer testimonials | radahn | 30 |
| cf-10x | Store locator | radahn | — |
| cf-doy | Bundle analytics | radahn | — |
| cf-bkc | Wishlist alerts | caesar | 15 |

### Admin/Infra Closed
| Bead | Resolution |
|------|------------|
| cf-303 | CMS + Payments + DNS + Secrets all live |
| cf-27q | Superseded by cf-7bk |

---

## Test Suite Growth
| Checkpoint | Tests | Files |
|------------|-------|-------|
| Session start | 2,394 | 70 |
| +comparison, abandonment | 2,639 | 75 |
| +checkout, vitals, reviews | 2,899 | 81 |
| +sustainability | 2,953 | 82 |
| +media, delivery, topics | 3,200 | 88 |
| +catalogImport, productQA, loyalty | 3,444 | 94 |
| +orderTracking, search, financing | 3,535 | 97 |

---

## Orchestration Rules

1. **All stories go through melania** — submit for review, wait for approval
2. **Run `npx vitest run` BEFORE EVERY COMMIT** — no exceptions
3. **Always pull before starting** — `git pull`
4. **Small commits** — one logical change per commit
5. **Push to main** — no feature branches
6. **Tests must pass before push**
