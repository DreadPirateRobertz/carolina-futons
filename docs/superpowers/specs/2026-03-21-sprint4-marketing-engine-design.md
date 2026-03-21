# Sprint 4 Design: Full Marketing Engine

**Date**: 2026-03-21
**Status**: PENDING STILGAR APPROVAL — proceeding with Option C (activate + build)
**Scope**: Social commerce, lifecycle marketing, content/SEO, and net-new growth features
**Theme**: We have a powerful marketing backend (115 files). This sprint makes it ACTUALLY work for the business.

---

## Context

The Carolina Futons backend is largely complete. Social services, email automation, loyalty/referral programs, and content pipelines are all built and tested. The gap is **activation** — wiring pixels, enabling drip triggers, launching the content engine, and adding the 4-5 growth features that don't exist yet.

This sprint runs in parallel with Stilgar's editor hookup work. Crew builds backend activation + new features; Stilgar wires the front-end elements. They converge when Premium is upgraded.

---

## Approach: Option C — Activate + Build (Recommended)

Two tracks run simultaneously:
- **Activation Track** (godfrey + radahn): Wire what's built, make it go-live ready
- **Growth Track** (miquella + rennala): Build net-new capabilities with highest business impact

---

## Track 1: Social Commerce Activation

**Goal**: Get existing social services actually firing — tracking, posting, converting.

### 1A: Marketing Pixels (CF-qg7d — assigned to godfrey, P1)
Install TikTok Pixel + Pinterest Tag via Wix CLI embeddedScript extension.
- Fires on all pages automatically (no page-by-page wiring needed)
- Events: pageview, product_view, add_to_cart, purchase, search
- Validation: TikTok Pixel Helper + Pinterest Tag Helper browser extensions
- Tests: pixel install, event dispatch, event deduplication (15+ tests)

### 1B: Pinterest Rich Pins Verification
pinterestRichPins.web.js exists — needs Pinterest Validator sign-off.
- Verify og:type product, og:price, og:availability on product pages
- Submit domain to Pinterest for Rich Pins approval
- Tests: og tag output validation per product page template

### 1C: Facebook Catalog Sync Health
facebookCatalog.web.js is built. Run smoke test against prod catalog, verify scheduled refresh.
- Confirm 88 CF products syncing to Meta Business Manager
- Verify cron schedule (every 6h) is active via jobs.config
- Alert if sync failure (Wix automations hook)

### 1D: Social Story Automation
socialStoryScheduler.web.js + socialStoryService.web.js built + tested.
- Wire Wix cron (jobs.config) to call socialStoryScheduler daily
- Content: new arrivals, sale alerts, behind-the-scenes rotation
- Platform targets: TikTok, Pinterest, Instagram (via existing API integrations)

---

## Track 2: Lifecycle Marketing

**Goal**: Email + loyalty loops that bring customers back.

### 2A: Welcome Email Series (rennala, P1)
3-part sequence: welcome → style guide → first purchase nudge (Day 0, Day 3, Day 7).
- emailTemplates.web.js has base templates — extend for each step
- emailAutomation.web.js orchestrates triggers — add `welcome_series` workflow
- Wix Automations: trigger on member signup → sequence with delays
- Tests: template rendering, trigger logic, unsubscribe path (25+ tests)

### 2B: Cart Recovery Activation (miquella, P1)
cartRecovery.web.js is built and tested — needs activation wiring.
- Wix Automations: trigger on checkout abandonment (1hr delay) → emailService
- Template: abandoned items with images, price, CTA to cart
- Discount code optional (10% off, single-use, 48hr expiry via couponsService)
- Tests: trigger conditions, email content, discount generation

### 2C: Browse Abandonment Flow (rennala, P2)
browseAbandonment.web.js exists — needs trigger wiring.
- Session event: product page view > 30s, then exit without add-to-cart
- 2hr delay → email with "Still thinking about [Product Name]?"
- Personalized with viewed product image + price
- Tests: session detection, delay logic, email personalization

### 2D: Loyalty Tier Display Spec (blocked on editor hookup)
loyaltyService.web.js + loyaltyTiers.web.js built.
- Write Velo code for member page: `$w('#loyaltyPointsDisplay').text = points`
- Wire to member dashboard (CF-35ok deferred — spec the Velo code now, execute when hookup lands)
- HTTP endpoint: `GET /_functions/loyalty/{memberId}` → {points, tier, nextTierAt}

### 2E: Referral Program Launch (miquella, P2)
referralService.web.js built — needs public UI.
- Referral link generator: `/_functions/generateReferralLink` → unique short URL
- Share UI: copy link + social share buttons on thank-you page and account dashboard
- Reward trigger: $25 store credit on referee first purchase (storeCreditService.web.js exists)
- Tests: link generation, uniqueness, reward trigger, duplicate prevention

---

## Track 3: Content & SEO Engine

**Goal**: Drive organic traffic via blog + local SEO + structured content.

### 3A: Blog Frontend Completion (radahn, P1 — CF-26cr + remaining stories)
CF-f224 epic in progress. Complete:
- CF-26cr: Blog list page — blogListRepeater, pagination, category filter
- Blog post page — full article rendering, author, date, tags
- Related posts widget
- Blog RSS feed (blogRssFeed.web.js exists, endpoint returns 404 — fix)

### 3B: Topic Cluster Pages (radahn, P2)
topicClusters.web.js built.
- CMS Collection: TopicCluster {topic, pillarContent, clusterArticles[]}
- Dynamic pages: /guides/[topic] with SEO-optimized pillar content
- Internal linking: cross-link cluster articles to pillar + back
- Initial topics: futon buying guide, murphy bed sizes, mattress types

### 3C: Local SEO Activation (P3 stories already in backlog: CF-kj47→CF-gjy4)
Assign to polecats when available.
- Dynamic /showrooms/[city] pages with LocalBusiness JSON-LD
- Google Maps embed + directions
- City-specific product availability callouts

---

## Track 4: Growth Features (Net-New)

**Goal**: New capabilities that don't exist yet, highest business impact.

### 4A: UGC Photo Review Workflow (miquella, P2)
photoReviews.web.js handles backend — need full-stack workflow.
- **Submission**: Product page → "Share Your Photo" CTA → upload form (Wix Media Manager)
- **Moderation**: Dashboard page `/admin-reviews` — approval queue, reject/approve actions
- **Display**: Approved photos in product gallery, homepage social proof section
- Tests: upload, moderation queue, display filtering, spam/abuse prevention (20+ tests)

### 4B: Exit Intent Capture (rennala, P2)
Not built yet. High-conversion, low-effort.
- Trigger: cursor moves toward browser chrome after 30s on site
- Overlay: "Wait! Here's 10% off your first order" + email input
- emailService.web.js integration: add to newsletter + send coupon
- couponsService.web.js: generate single-use 10% code
- Tests: trigger logic (not repeated), email capture, coupon delivery

### 4C: Affiliate Program Dashboard (P3)
affiliateProgram.web.js built — needs UI portal.
- Affiliate signup page + approval flow
- Dashboard: link generator, click tracking, commission history, payout status
- Admin view: all affiliates, pending approvals, payout queue
- Defer until Track 1-3 are stable

### 4D: SMS Campaign Sequences (P3)
smsService.web.js exists.
- Welcome SMS: opt-in at checkout → "Thanks! Here's 10% off"
- Order update: shipped → "Your futon is on the way! Track: [URL]"
- Re-engagement: 90-day inactive → "We miss you — new arrivals + exclusive deal"
- Requires: Twilio/SMS provider API key (check secrets.env)

---

## Crew Assignments

| Worker | Priority | Bead(s) | Track |
|--------|----------|---------|-------|
| **godfrey** | P1 → P2 | CF-qg7d (marketing pixels) → 1C (Facebook catalog) → 1D (social story cron) | Track 1 |
| **radahn** | P1 → P2 | CF-26cr + blog stories → 3B topic clusters | Track 3 |
| **miquella** | P1 → P2 | CF-q4zm → CF-g5fa (Style Quiz) → 2B cart recovery → 2E referral | Tracks 2+4 |
| **rennala** | P1 → P2 | CF-mwpw → 2A welcome email → 2C browse abandonment → 4B exit intent | Tracks 2+4 |
| **polecats** | P1 | CF-267m (S7), CF-7zri (S9), CF-h7eh (S8), CF-kbsg (S12), CF-yixo (S15), CF-g5fa, CF-av74, CF-avez, CF-yz54 | Hookup Assist + Style Quiz |

---

## New Beads to Create (Sprint 4)

| ID | Title | Priority | Assignee |
|----|-------|----------|----------|
| TBD | Social story automation cron activation | P1 | godfrey |
| TBD | Welcome email series (3-part) | P1 | rennala |
| TBD | Cart recovery email activation | P1 | miquella |
| TBD | Pinterest Rich Pins verification | P2 | godfrey |
| TBD | Browse abandonment email flow | P2 | rennala |
| TBD | Referral program public UI | P2 | miquella |
| TBD | UGC photo review workflow | P2 | miquella |
| TBD | Exit intent capture overlay | P2 | rennala |
| TBD | Loyalty tier HTTP endpoint | P2 | godfrey |
| TBD | Blog RSS feed fix (404 → 200) | P2 | radahn |
| TBD | Topic cluster CMS + dynamic pages | P2 | radahn |
| TBD | SMS campaign sequences | P3 | TBD |
| TBD | Affiliate portal dashboard | P3 | TBD |

---

## Success Metrics

- **TikTok + Pinterest pixels firing** on all pages (day 1)
- **Cart recovery email live** within 7 days (estimated 5-15% recovered carts)
- **Welcome series active** within 7 days (improves new customer LTV)
- **Blog live** with 5+ posts indexed (organic traffic baseline)
- **Photo review workflow** — first 10 customer UGC photos approved and displayed
- **Referral program launched** — first referral link generated + tracked

---

## Dependencies & Blockers

- **Premium upgrade**: Required for TikTok/Pinterest pixel activation on live site. Staging can be tested without it.
- **Editor hookup**: Loyalty display + social proof widgets blocked until Stilgar wires nicknames. Backend can be built now.
- **Wix Automations**: Cart recovery + browse abandonment triggers require Wix Automations access (available on Premium).
- **TikTok/Pinterest API keys**: In secrets.env — godfrey should verify at start of CF-qg7d.

---

## Timeline Estimate

| Week | Milestones |
|------|-----------|
| Week 1 | Pixels installed, blog live, cart recovery wired, welcome email drafted |
| Week 2 | Exit intent live, referral UI shipped, photo review workflow in QA |
| Week 3 | Topic clusters live, all activations tested against staging |
| Week 4 | Sprint retrospective, bead closure, v1.1.0 release prep |
