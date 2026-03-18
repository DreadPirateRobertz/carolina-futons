# Changelog

All notable changes to the Carolina Futons Wix Velo codebase.

---

## [v1.0.0] — 2026-03-17

26,942 tests | 638 test files | 65 src files changed | 18 PRs merged (#481–#494) since v0.10.0

Source development repo: [DreadPirateRobertz/carolina-futons](https://github.com/DreadPirateRobertz/carolina-futons)
Production repo: [DreadPirateRobertz/carolina-futons-stage3-velo](https://github.com/DreadPirateRobertz/carolina-futons-stage3-velo)

### New Pages

- **Compare Page** `/compare` ([#483](https://github.com/DreadPirateRobertz/carolina-futons/pull/483)): Full S1–S6 — URL param parsing, column rendering, attributes table, mobile swipe, SEO schema, reset/back-nav. Supports up to 4 products in parallel fetch.
- **Fabric Swatches** `/swatches` ([#482](https://github.com/DreadPirateRobertz/carolina-futons/pull/482)): Full S1–S5 — swatch grid with filters (color/material/brand), selection system (max 5, sessionStorage tray), product page integration, request form + CRM submission, SEO schema.
- **Wishlist Share** `/wishlist-share` ([#484](https://github.com/DreadPirateRobertz/carolina-futons/pull/484)–[#489](https://github.com/DreadPirateRobertz/carolina-futons/pull/489)): Full S1–S5 — token resolution, product card repeater, add-to-cart from shared view, URL-safe share token on Member Page, OG tags + noindex for private wishlists.

### Hookup Assistant (Wix Studio Add-on)

- **S1 App Scaffold** — React+Vite add-on, @wix/editor SDK, private app registration, Tools menu panel
- **S2 Pages Data Bundle** — `src/data/pages.ts`, TypeScript interfaces, 28 pages / 1,093 elements migrated from editor-hookup-guide.html
- **S3 Element Detection** — @wix/editor selection events, 17 component type mappings, current Velo ID read
- **S5 Type Validator** ([#490](https://github.com/DreadPirateRobertz/carolina-futons/pull/490)) — wrong-type warning banner, Apply ID disabled on mismatch, Override link
- **S6 Default State Setter** ([#490](https://github.com/DreadPirateRobertz/carolina-futons/pull/490)) — auto-set Hidden/Collapsed after ID apply, CSS-only element badge, `!cssOnly` guard per spec
- **S10 Manual Mode** — Copy ID button, manual mark-done baseline, Tab advances queue

### Features

- **Email A/B Testing + Campaign Analytics Dashboard** ([#476](https://github.com/DreadPirateRobertz/carolina-futons/pull/476)): deepened A/B variant tracking, analytics dashboard endpoint
- **Blog → Newsletter Integration** ([#479](https://github.com/DreadPirateRobertz/carolina-futons/pull/479)): blog post auto-generates newsletter, blog sitemap entries
- **Email Retry with Backoff** ([#477](https://github.com/DreadPirateRobertz/carolina-futons/pull/477)): processEmailQueue exponential backoff — unblocked 33 previously skipped tests
- **Catalog-Driven Newsletter Templates** ([#475](https://github.com/DreadPirateRobertz/carolina-futons/pull/475)): product catalog drives template generation
- **Social Story Automation Pipeline** ([#473](https://github.com/DreadPirateRobertz/carolina-futons/pull/473)): scheduled social story posting
- **Content Orchestrator — Wix Events + Dry-Run** ([#472](https://github.com/DreadPirateRobertz/carolina-futons/pull/472)): event-triggered content pipeline, safe dry-run mode

### Security

- **XSS fix — comparePageHelpers** ([#491](https://github.com/DreadPirateRobertz/carolina-futons/pull/491)): `htmlEscape` sanitizes all attribute values rendered into DOM; `&` escaped first to prevent double-encoding

### CI / Infrastructure

- **Pre-commit hooks** ([#494](https://github.com/DreadPirateRobertz/carolina-futons/pull/494)): husky + lint-staged — ESLint fix + vitest run on staged files
- **Coverage thresholds** ([#493](https://github.com/DreadPirateRobertz/carolina-futons/pull/493)): vitest thresholds (statements 90%, branches 85%, functions 88%, lines 91%), hookup-assistant package thresholds (80/75/80/80), `.codecov.yml` target 91%
- **Codecov CI hardening** ([#492](https://github.com/DreadPirateRobertz/carolina-futons/pull/492)): `fail_ci_if_error: true` on all Codecov steps, `cache-dependency-path: package-lock.json` on all setup-node steps

### Test Hardening (+1,500 new tests since v0.10.0)

- Account dashboard + member features: +115 tests ([#481](https://github.com/DreadPirateRobertz/carolina-futons/pull/481))
- Social media + catalog sync: +119 tests ([#480](https://github.com/DreadPirateRobertz/carolina-futons/pull/480))
- HTTP functions + dashboard + orchestrator: +102 tests
- Deep content pipeline integration tests ([#471](https://github.com/DreadPirateRobertz/carolina-futons/pull/471))
- Blog→newsletter integration tests ([#479](https://github.com/DreadPirateRobertz/carolina-futons/pull/479))
- Pre-commit hook config tests: 16 tests

### Synced Files (65 src files since v0.9.0)

**Backend (38 files):**
- New: `wishlistShare.web.js`, `swatchRequest.web.js`, `comparisonService.web.js`, `contentOrchestrator.web.js`, `contentScheduler.web.js`, `analyticsDashboard.web.js`, `blogNewsletter.web.js`, `blogRssFeed.web.js`, `blogContent.js`, `coreWebVitals.web.js`, `errorMonitoring.web.js`, `socialStoryScheduler.web.js`, `socialStoryService.web.js`, `emailTemplates.web.js`
- Modified: `emailAutomation.web.js`, `http-functions.js`, `seoHelpers.web.js`, `events.js`, `fulfillment.web.js`, `inventoryAlerts.web.js`, `inventoryService.web.js`, `notificationService.web.js`, `photoReviews.web.js`, `pinterestCatalogSync.web.js`, `pinterestRichPins.web.js`, `postPurchaseCare.web.js`, `productRecommendations.web.js`, `productReviews.web.js`, `reviewsService.web.js`, `sizeGuide.web.js`, `testimonialService.web.js`, `ugcService.web.js`, `wishlistAlerts.web.js`, `browseAbandonment.web.js`, `buyingGuides.web.js`, `facebookCatalog.web.js`, `googleMerchantFeed.web.js`, `blogService.web.js`

**Pages (10 files):**
- New: `Compare Page.js`, `Fabric Swatches.js`, `Wishlist Share.js`
- Modified: `Cart Page.js`, `Category Page.js`, `masterPage.js`, `Member Page.js`, `Product Page.js`, `Search Results.js`, `Side Cart.js`, `Home.js`

**Public (17 files):**
- New: `comparePageHelpers.js`, `wishlistShareHelpers.js`, `collectionCardBuilder.js`, `emptyStateBuilder.js`, `HomeBlogTeasers.js`, `ProductFinancing.js`, `ProductOptions.js`, `ProductReviews.js`, `ProductSizeGuide.js`, `promoBannerCarousel.js`, `SocialFeedEmbed.js`
- Modified: `metaPixel.js`, `product/productSchema.js`, `salePageHelpers.js`, `SaveForLater.js`, `socialStoryHelpers.js`, `WishlistCardButton.js`

---

## [v0.10.0] — 2026-03-16

25,200+ tests | 590+ test files | 25 PRs merged (#435–#459)

### Features
- Content Pipeline (4 phases): content injection, scheduling, orchestration, QA
- Error Monitoring + Core Web Vitals ([#463](https://github.com/DreadPirateRobertz/carolina-futons/pull/463))
- Blog RSS Feed + Sitemap ([#465](https://github.com/DreadPirateRobertz/carolina-futons/pull/465))
- SEO Prep ([#466](https://github.com/DreadPirateRobertz/carolina-futons/pull/466))
- Order Tracking ([#460](https://github.com/DreadPirateRobertz/carolina-futons/pull/460)): 126 tests
- Email A/B Testing ([#476](https://github.com/DreadPirateRobertz/carolina-futons/pull/476))

### Tests
- 23,178 total tests (4,654 new since v0.9.0)

*Note: v0.10.0 was held from stage3-velo sync — all changes included in v1.0.0 above.*

---

## [v0.9.0] — 2026-03-16

18,524 tests | 445 test files | 5 PRs merged since v0.8.0

### Features
- Social Story Helpers ([#425](https://github.com/DreadPirateRobertz/carolina-futons/pull/425)): Instagram/TikTok/Pinterest story generation

### Tests (+321 new)
- SEO Helpers deep coverage, membership + delivery modules, illustration edge cases

---

## [v0.8.0] — 2026-03-16

18,203 tests | 438 test files | 47 src files changed | 70 PRs merged (#354–#423)

### Features
- CF+ Premium Membership (monthly $14.99 / annual $119.99)
- Exit-Intent Email Capture with dedup protection
- Loyalty Bonus Points (review, referral, social share rewards)
- Back-in-Stock Dashboard
- 5 Automation Gaps Wired (events, restock alerts, review requests, scheduler)
- Product Variant Refactor (dropdown + visual swatches)
- Room Planner (Canvas2D interactive)
- Web SVG Illustrations (6 mountain/contact)
- CMS Provisioning (5 new collections + email templates)

---

## [v0.7.0] — 2026-03-14

13,692 tests. 7 src files synced.

---

## [v0.6.0] — 2026-03-14

CSS v7 warm palette. 815 element IDs mapped. Product Videos + Getting It Home pages. 533 new tests.

---

## [v0.5.0] — 2026-03-14

CSS v5 Wix selector fix. FAQ + About content pages. Call-for-price filter.

---

## [v0.4.1] — 2026-03-14

Security: cron secrets → X-Cron-Secret header. Rate limiting on return endpoints.

---

## [v0.4.0] — 2026-03-14

Brand identity CSS overhaul (blue/white). Product page remap JSON.

---

## [v0.3.0] — 2026-03-14

CI: Node 22. CSS heading font overrides.

---

## [v0.2.0] — 2026-03-09

Template migration. Full Velo codebase deployment. CI pipeline.

---

## [v0.1.0] — 2026-03-07

Initial release. Core commerce backend. 39 pages. 109 public utilities.
