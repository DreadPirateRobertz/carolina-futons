# Sprint 4 Design: Full Marketing Engine

**Date**: 2026-03-21
**Status**: SPEC REVIEW COMPLETE — fixes applied, pending Stilgar approval
**Spec Reviewer**: Passed (v2, 2026-03-21) — 6 issues fixed, 2 items deferred per Stilgar decision
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
- **Cookie consent**: Integrate with Wix cookieManager — pixels only fire after consent granted (GDPR/CCPA compliance)
- **Premium gate**: Requires site upgrade to Premium before pixels activate on live site. Owner: Stilgar.
- Tests: pixel install, event dispatch, event deduplication, consent-gate (15+ tests)

### 1B: Pinterest Rich Pins Verification
pinterestRichPins.web.js exists — needs Pinterest Validator sign-off.
- Verify og:type product, og:price, og:availability on product pages
- Submit domain to Pinterest for Rich Pins approval
- Tests: og tag output validation per product page template

### 1C: Facebook Catalog Sync Health (godfrey, P2 — new bead)
facebookCatalog.web.js is built. Run smoke test against prod catalog, verify scheduled refresh.
- Confirm 88 CF products syncing to Meta Business Manager
- Verify cron schedule (every 6h) is active via jobs.config
- Alert on sync failure via notificationService
- Tests: catalog format validation, cron registration, failure alert dispatch (10+ tests)

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
- **Approach**: Cron job (every 1hr) queries checkouts abandoned > 1hr ago — NOT Wix Automations (trigger reliability unconfirmed on current plan). Cron → cartRecovery.web.js → emailService.
- Template: abandoned items with images, price, CTA to cart
- Discount code optional (10% off, single-use, 48hr expiry via couponsService)
- **Wix Automations note**: When Premium lands, revisit migrating trigger to native Automations for lower latency. Cron approach works on any plan.
- Tests: trigger conditions, deduplication (don't resend), email content, discount generation (15+ tests)

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
- **Implementation**: Wix Lightbox (single lightbox element — Stilgar adds one lightbox to site, no full hookup needed). Velo opens it via `wixWindow.openLightbox('exitIntentLightbox', data)` on cursor-leave event.
- **Dependency on Stilgar**: Add one Lightbox element named `exitIntentLightbox` to the site in the editor. Single-element add, not a full hookup session.
- Trigger: cursor moves toward browser chrome after 30s (mouseleave on document), once per session
- Content: "Wait! Here's 10% off your first order" + email input field
- emailService.web.js: add to newsletter list + send coupon code email
- couponsService.web.js: generate single-use 10% code on submit
- Tests: trigger logic (not repeated per session), email capture, coupon delivery, lightbox open/close (15+ tests)

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

| Worker | Current | Queue (in order) | Tracks |
|--------|---------|-----------------|--------|
| **godfrey** | CF-qg7d (TikTok+Pinterest pixels) | 1B Pinterest Rich Pins → 1C Facebook catalog smoke test → 1D social story cron → 2D loyalty endpoint | Track 1 → 2 |
| **radahn** | CF-26cr (Blog S1) + CF-9mx0 (related products) | blog RSS fix → 3B topic clusters | Track 3 |
| **miquella** | CF-q4zm (Style Quiz S1) | CF-g5fa (Style Quiz S2) → 2B cart recovery → 2E referral program UI | Style Quiz → Tracks 2+4 |
| **rennala** | CF-mwpw (Gift Cards S1) | 2A welcome email series → 2C browse abandonment → 4B exit intent capture | Tracks 2+4 |
| **polecats (9)** | Unassigned | CF-267m (HA S7), CF-7zri (HA S9), CF-h7eh (HA S8), CF-kbsg (HA S12), CF-yixo (HA S15), CF-av74 (SQ S3), CF-avez (SQ S4), CF-yz54 (SQ S5), CF-75d1 (SQ S6) | Hookup Assist + Style Quiz (miquella owns S1+S2; polecats own S3-S6) |

**Boundary note**: miquella owns Style Quiz S1 (CF-q4zm) and S2 (CF-g5fa). Polecats own S3–S6 (CF-av74, CF-avez, CF-yz54, CF-75d1). All Style Quiz polecat work feeds back to miquella for review before merge.

---

## New Beads to Create (Sprint 4)

| ID | Title | Priority | Assignee |
|----|-------|----------|----------|
| TBD | Social story automation cron activation | P1 | godfrey |
| TBD | Welcome email series (3-part: welcome/style-guide/first-purchase) | P1 | rennala |
| TBD | Cart recovery — cron-based (1hr poll, not Wix Automations) | P1 | miquella |
| TBD | Pinterest Rich Pins verification — og tags + Pinterest Validator | P2 | godfrey |
| TBD | Facebook catalog smoke test + cron health check | P2 | godfrey |
| TBD | Browse abandonment email flow | P2 | rennala |
| TBD | Referral program public UI — link gen + share + reward trigger | P2 | miquella |
| TBD | UGC photo review workflow — submit + moderation + display | P2 | miquella |
| TBD | Exit intent capture — Wix Lightbox + email capture + coupon | P2 | rennala |
| TBD | Loyalty tier HTTP endpoint /_functions/loyalty/{memberId} | P2 | godfrey |
| TBD | Blog RSS feed fix (endpoint returns 404) | P2 | radahn |
| TBD | Topic cluster CMS collection + dynamic pages /guides/[topic] | P2 | radahn |
| TBD | Transactional email audit (order confirm, ship, delivery) | P2 | rennala |
| TBD | Email A/B testing — welcome series variants (infra exists in abTesting.web.js) | P2 | rennala |
| TBD | GA4 + pixel attribution validation — verify event schema alignment | P2 | godfrey |
| TBD | SMS campaign sequences (requires Twilio key — verify in secrets.env first) | P3 | TBD |
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

- **Premium upgrade** (OWNER: Stilgar — decision needed): Required for TikTok/Pinterest pixel activation on live site. Pixels can be built + tested on staging without it. All activation work proceeds; flip the switch at upgrade.
- **Editor hookup (most features)**: Loyalty display, social proof widgets, UGC display section, product gallery blocked until Stilgar wires element nicknames. All backend work can be built now; frontend wiring follows hookup.
- **Exit intent lightbox** (OWNER: Stilgar — single action): Stilgar adds ONE Lightbox element named `exitIntentLightbox` in editor. ~5 min task, not a full hookup session.
- **Wix Automations uncertainty**: Trigger reliability for cart recovery/browse abandonment is unconfirmed on current plan. Using cron-based fallback for both (works on any plan). Revisit with native Automations post-Premium.
- **TikTok/Pinterest/Twilio API keys**: TikTok + Pinterest in secrets.env — godfrey verifies at start of CF-qg7d. Twilio SMS key: check secrets.env before starting 4D — if absent, 4D stays P3-deferred.
- **Cookie consent (GDPR/CCPA)**: Pixels must respect Wix cookieManager consent status. Built into 1A spec. No separate work needed.
- **Facebook catalog**: Must confirm Meta Business Manager access + catalog ID in secrets.env before 1C.
- **UGC admin dashboard**: `/admin-reviews` page cannot be a Wix page until editor hookup lands. Interim: implement as HTTP-only admin endpoint (/_functions/adminReviews with API key auth) until dashboard page is wired.

---

## Timeline Estimate

| Week | Milestones |
|------|-----------|
| Week 1 | Pixels installed, blog live, cart recovery wired, welcome email drafted |
| Week 2 | Exit intent live, referral UI shipped, photo review workflow in QA |
| Week 3 | Topic clusters live, all activations tested against staging |
| Week 4 | Sprint retrospective, bead closure, v1.1.0 release prep |
