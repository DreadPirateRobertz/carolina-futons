# Content Pipeline + Go-Live Readiness — Design Spec

**Date**: 2026-03-16
**Author**: cfutons/crew/melania (PM)
**Status**: DRAFT — awaiting crew review
**Approach**: A (Content Pipeline Completion) + C (Go-Live Readiness)

---

## Problem Statement

We have 100+ backend modules covering email automation, social media posting, catalog sync, newsletter templates, blog content, SEO, and analytics. These modules are individually tested (24,900+ tests, 99.6% test file coverage) but **disconnected**. No pipeline connects catalog events to content generation to scheduled delivery.

Meanwhile, go-live requires completing editor hookup, upgrading to Premium, and verifying all systems end-to-end.

## Goals

1. Wire disconnected content modules into an automated pipeline
2. Prepare all go-live prerequisites that don't require editor access
3. Enable rapid content deployment once editor hookup + Premium are complete

## Non-Goals

- Editor element hookup (Stilgar handles this manually)
- Premium upgrade or DNS config (business decision, not code work)
- New feature development beyond connecting existing modules

---

## Phase 1: Content Orchestration Engine

**Priority**: HIGH — fully unblocked, no editor dependency

### New Module: `src/backend/contentOrchestrator.web.js`

Event-driven coordinator that triggers content generation when catalog changes happen.

**Event sources** (inputs):
- Catalog import completes (new products added)
- Product price update
- Product back in stock
- Seasonal date triggers (configurable)

**Actions** (outputs):
- Generate newsletter section via `emailTemplates.web.js` → `buildProductBlock`, `getNewArrivalsSection`, `getCategorySpotlightSection`
- Generate social story via `socialStoryHelpers.js` → `buildProductSpotlight`, `buildNewArrivalStory`, `buildSeasonalPromo`
- Queue email campaign via `emailAutomation.web.js` → `processEmailQueue` (with send-time optimization from PR #447)
- Trigger catalog sync via `facebookCatalog.web.js` → `buildCatalogBatch` and `pinterestCatalogSync.web.js` → `syncCatalogBatch`

**Design constraints**:
- Idempotent: same event processed twice produces no duplicate content
- Configurable: each action can be enabled/disabled independently
- Dry-run mode: log what would happen without executing
- Rate-limit aware: uses `getMetaRateLimits()` / `getPinterestRateLimits()` from PR #448

### New Module: `src/backend/contentScheduler.web.js`

Queue-based scheduler that spaces out content delivery.

**Rules**:
- No duplicate product features within 7-day window
- Respect platform rate limits
- Align with content calendar (CF-8b18 social media calendar)
- Time-zone aware send windows (8am-8pm EST, from PR #447)
- Priority queue: back-in-stock > price drop > new arrival > seasonal

**Storage**: Wix CMS collection `ContentSchedule` with fields:
- `contentType` (newsletter | social_story | catalog_sync)
- `platform` (email | instagram | facebook | pinterest)
- `productId` (ref to product)
- `scheduledAt` (datetime)
- `status` (pending | sent | failed | cancelled)
- `createdBy` (orchestrator event ID)

### Existing Module Dependencies (all tested + hardened)

| Module | PRs | Tests | Status |
|---|---|---|---|
| emailTemplates.web.js | #442 | 43+ | Catalog-driven templates |
| emailAutomation.web.js | #441, #447 | 50+ | A/B testing, send-time opt |
| socialStoryHelpers.js | #446 | 50+ | Platform formatting, 4 templates |
| socialStoryService.web.js | #437 | 30+ | Meta Graph API posting |
| facebookCatalog.web.js | #448 | 51+ | Feed validation, partial recovery |
| pinterestCatalogSync.web.js | #448 | 51+ | Feed validation, rate limits |
| newsletterService.web.js | #441 | 30+ | ESP sync, Klaviyo |

---

## Phase 2: Blog System Activation

**Priority**: MEDIUM — backend unblocked, frontend needs editor pages

### Backend Work (unblocked)

1. **Blog RSS feed**: New `src/backend/blogRssFeed.web.js`
   - Generate RSS 2.0 XML from `blogContent.js` (14 posts ready)
   - Include: title, description, pubDate, link, category
   - Endpoint: `/blog/feed.xml`

2. **Blog sitemap entries**: Extend `seoHelpers.web.js`
   - Add blog post URLs to sitemap generation
   - Include lastmod from blog content dates
   - Priority: 0.7 for blog posts (below product pages at 0.8)

3. **Blog → newsletter integration**: Extend `contentOrchestrator.web.js`
   - New event: blog post published
   - Action: auto-generate "new blog post" email using existing templates
   - Include post excerpt, featured image, read-more CTA

### Editor Work (blocked on Stilgar)

- Blog listing page (route: `/blog`)
- Blog post dynamic page (route: `/blog/{slug}`)
- Both pages use `blogService.web.js` (already wired in PR #436)

---

## Phase 3: Go-Live Readiness

**Priority**: HIGH — prepare everything possible before Premium upgrade

### 3A: SEO Prep (unblocked)

| Task | Module | Status |
|---|---|---|
| Structured data verification | productSchema.js, localBusinessSeo.js | Done (CF-qocr) |
| Canonical URLs | seoHelpers.web.js | Fixed (PR #449) |
| Falsy-zero price bugs | 9 files | Fixed (PR #455, 20 sites) |
| Sitemap generation | seoHelpers.web.js | Needs extension (blog + category pages) |
| robots.txt | New file | Needs creation |
| Open Graph tags | All page modules | Needs audit |
| Google Search Console prep | N/A | Ready when DNS is configured |

### 3B: Error Monitoring (unblocked)

- Wire `errorMonitoring.web.js` to collect runtime errors
- Add error boundaries to critical user flows: checkout, cart, product page
- Dashboard alerts for: payment failures, API timeouts, missing product data
- Test: simulate failures in staging, verify alerts fire

### 3C: Core Web Vitals Baseline (unblocked)

- Measure current staging performance (LCP, FID, CLS)
- Identify bottlenecks: image sizes, JS bundle, render-blocking resources
- Document baseline for post-launch comparison
- `coreWebVitals.web.js` exists but untested — needs hardening

### 3D: Marketing Tags Prep (blocked on Premium)

- GTM container configuration ready to deploy
- FB Pixel, GA4, TikTok Pixel tag definitions pre-built
- Pinterest tag pre-configured
- All fire on: page view, add to cart, purchase, signup
- Code in `metaPixel.js` — falsy-zero already fixed (PR #455)

### 3E: Content Final QA (unblocked)

- 4 remaining content issues from CF-8ssy QA report
- Verify all campaign files reference real catalog-MASTER.json data
- No fabricated product names, correct prices, correct manufacturer attributions

---

## Phase 4: Launch Sequence (after editor hookup + Premium)

Sequential checklist — each step depends on prior:

1. Final editor hookup verification (all element IDs match Velo `$w` selectors)
2. Premium upgrade + domain DNS configuration
3. Deploy marketing tags via GTM
4. Submit sitemaps to Google Search Console
5. Activate email automation sequences (welcome, cart recovery, browse abandonment)
6. Start social posting pipeline (content orchestrator)
7. Sync catalog to Facebook + Pinterest
8. Smoke test: full purchase flow, email delivery, social posting
9. Monitor Core Web Vitals for 48h
10. v1.0 release tag on both repos

---

## Crew Assignment

| Crew | Phase | Work | Est. Effort |
|---|---|---|---|
| **godfrey** | 1 | Content orchestrator + scheduler (new modules) | 2-3 sessions |
| **radahn** | 2 | Blog RSS feed + sitemap extension + newsletter integration | 1-2 sessions |
| **rennala** | 3A+3E | SEO sitemap/robots.txt + OG audit + content final QA | 1-2 sessions |
| **miquella** | 3B+3C | Error monitoring wiring + Core Web Vitals baseline | 1-2 sessions |

### Sequencing

```
Phase 1 (orchestrator) ──────────────────────────► Phase 4 (launch)
Phase 2 (blog backend) ──► Editor hookup ──► Blog pages ──┘
Phase 3A-E (go-live prep) ────────────────────────┘
```

Phases 1, 2 (backend), and 3 run in parallel. Phase 4 runs after all three complete + editor hookup + Premium.

---

## Success Criteria

1. Content orchestrator processes a catalog import and auto-generates newsletter + social content
2. Blog RSS feed serves valid XML with all 14 posts
3. Sitemap includes all product pages, category pages, and blog posts
4. Error monitoring fires alerts on simulated failures
5. Core Web Vitals baseline documented
6. All content QA issues resolved (0 remaining from CF-8ssy)
7. Go-live checklist 100% green except Premium-dependent items

---

## Open Questions for Crew Review

1. **godfrey**: Content orchestrator — should it use Wix Events API for triggers, or polling-based detection of catalog changes? What's the Wix Velo pattern for this?
2. **radahn**: Blog RSS — should we also generate Atom feed, or RSS 2.0 only? Any SEO benefit to both?
3. **rennala**: robots.txt — any pages we should explicitly block? (admin pages, member-only content?)
4. **miquella**: Error monitoring — should we use Wix's built-in monitoring, or build custom with external service? What's feasible on Wix Velo?
