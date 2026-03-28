# Wave 31+ Epics — Launch to Revenue

**Author:** melania (PM) | **Date:** 2026-03-28
**Status:** DRAFT — dallas cross-rig input pending
**Context:** Wave 30 hardening nearly complete (14/15 features shipped). Codebase is massive (153 backend modules, 50 pages, 34K+ tests, 121K LOC) but the site isn't generating revenue yet. These epics bridge the gap from code-complete to $15K/month online revenue.

---

## Strategic Context

Carolina Futons has:
- A fully hardened e-commerce platform with gamification, loyalty, referrals, bundles, and 88 products
- Security: rate-limited endpoints, audit logging, schema validation, IDOR fixes
- SEO: JSON-LD schemas, Google Merchant feed, Pinterest Rich Pins, sitemaps
- Cross-rig APIs: visual search, order tracking webhooks, coupon validation for mobile
- Editor hookup in progress (Stilgar manually wiring 232 elements)

Carolina Futons needs:
- Revenue. Zero sales today. Target: $15K/month within 3 months of launch.
- Premium upgrade to activate Wix Payments
- Marketing tags to attribute traffic
- Real product content (photos, descriptions) from owner Brenda Deal
- Conversion optimization data to tune the extensive feature set

---

## EPIC 1: LAUNCH READINESS — "Open the Doors"

**Goal:** Get the site accepting payments and tracking visitors. Everything else depends on this.

**Priority:** P0 — Nothing else matters until customers can buy.

**Owner:** melania (PM coordination) + Stilgar (editor + dashboard)

### Problem Statement

The site has 153 backend modules and 50 page files, but zero customers because:
1. Wix Payments is connected but inactive — needs Premium upgrade ($27/month Business plan)
2. Marketing tags (GA4, Meta Pixel, TikTok, Pinterest) are blocked until Premium
3. Google Merchant Center feed endpoint exists but isn't connected to Google
4. Editor hookup is in progress — Stilgar is wiring 232 missing elements
5. Contact page has wrong address (329 N Main → 824 Locust St Suite 200)
6. Homepage still shows template placeholder sections

### Beads

| # | Bead | Title | Owner | Priority | Dependencies |
|---|------|-------|-------|----------|-------------|
| 1.1 | cf-2wxp | Contact page address + mailto fix | Stilgar (editor) | P1 | Editor access |
| 1.2 | cf-2gfp | Remove homepage template placeholders | Stilgar (editor) | P2 | Editor access |
| 1.3 | NEW | Premium upgrade — activate Wix Payments | Stilgar (dashboard) | P0 | Credit card on file |
| 1.4 | NEW | Install GA4 + Meta Pixel + Pinterest Tag | Stilgar (dashboard) | P1 | Premium active |
| 1.5 | NEW | Connect Google Merchant Center feed | Stilgar (dashboard) | P1 | Premium + feed URL verification |
| 1.6 | NEW | Enable Wix Chat widget | Stilgar (dashboard) | P2 | Premium active |
| 1.7 | NEW | Mobile-responsive QA sweep | radahn + miquella | P1 | Editor hookup complete |
| 1.8 | NEW | Smoke test: end-to-end purchase flow | godfrey | P0 | Premium + Payments active |
| 1.9 | NEW | SSL + custom domain setup (carolinafutons.com) | Stilgar (dashboard) | P1 | Premium active |
| 1.10 | cf-yw0m | Editor hookup doc update (standing) | melania | P1 | Phase 1 complete |

### Acceptance Criteria

- [ ] A customer can browse products, add to cart, and complete checkout with credit card
- [ ] GA4 fires ecommerce events (product_view, add_to_cart, purchase)
- [ ] Google Shopping shows Carolina Futons products in search results
- [ ] Contact page shows correct address and working email link
- [ ] No template placeholder text visible on any page
- [ ] Site loads and functions correctly on mobile (iPhone Safari, Android Chrome)
- [ ] Custom domain carolinafutons.com resolves with SSL

### Revenue Impact

This epic alone doesn't generate revenue — it removes the blockers. Expected timeline: 1-2 days of Stilgar dashboard work + 1 day crew QA.

---

## EPIC 2: CONVERSION INTELLIGENCE — "Know What Works"

**Goal:** Instrument, measure, and optimize the conversion funnel. Turn 2% visitors into buyers.

**Priority:** P1 — Must happen within 2 weeks of launch.

**Owner:** rennala (SEO/analytics lead) + godfrey (backend instrumentation)

### Problem Statement

We have an extensive feature set (style quiz, gamification, bundles, loyalty, spin-to-win, exit-intent) but zero data on what actually converts. Without measurement:
- We can't tell if the style quiz registration gate helps or hurts
- We don't know if the spin-to-win email capture is effective
- Bundle discount of 5% vs 10% is a guess
- Free shipping threshold at $999 may be too high or too low
- Gamification features may delight or annoy — we can't tell

### Features

#### 2A. Product Review System Activation
**Why:** Social proof is the #1 missing conversion driver (Strategy doc: "+15-25% conversion lift"). We have `reviewsService.web.js`, `productReviews.web.js`, and `photoReviews.web.js` — all code-complete — but no reviews data.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Integrate Stamped.io from Wix App Market | Stilgar (dashboard) | 30 min |
| NEW | Wire Stamped.io widget to Product Page review section | miquella | 1 bead |
| NEW | Post-purchase review request email (Day 7 trigger) | godfrey | 1 bead |
| NEW | Review moderation queue in member dashboard | rennala | 1 bead |
| NEW | Import seed reviews from showroom customers | melania (coordination) | Manual |

**Expected impact:** +15-25% conversion rate lift. Reviews also feed into JSON-LD aggregateRating (cf-8du3 already wired).

#### 2B. A/B Testing Framework Activation
**Why:** We have `abTesting.web.js` code-complete but no experiments running. Every optimization assumption is untested.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Define 5 initial experiments with hypotheses and metrics | melania | 1 bead |
| NEW | Wire experiment assignment to key pages (Home, PDP, Cart) | godfrey | 2 beads |
| NEW | A/B dashboard — view running experiments + results | rennala | 1 bead |
| NEW | Shipping threshold test: $999 vs $799 vs $599 | radahn | 1 bead |
| NEW | Bundle discount test: 5% vs 10% vs free accessory | miquella | 1 bead |

**Initial experiments:**
1. Free shipping threshold: $999 vs $799 vs $599 (measures AOV impact)
2. Bundle discount: 5% vs 10% vs "free cover with frame+mattress" (measures attach rate)
3. Style quiz gate: registration required vs optional (measures email capture vs quiz completion)
4. Spin-to-win: email gate vs no gate (measures capture vs annoyance)
5. Gamification tour: auto-show vs opt-in (measures engagement vs bounce)

#### 2C. Analytics Deep Instrumentation
**Why:** GA4 gives us pageviews but not the micro-conversions that matter: swatch requests, quiz completions, loyalty enrollments, bundle adds.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Funnel event taxonomy — define all custom events | melania + rennala | 1 bead |
| NEW | Wire custom events to GA4 via wixWindow.trackEvent | godfrey | 2 beads |
| NEW | Conversion dashboard — real-time funnel visualization | rennala | 2 beads |
| NEW | Weekly automated analytics digest email to Brenda | godfrey | 1 bead |

**Custom event taxonomy (draft):**
- `quiz_started`, `quiz_completed`, `quiz_lead_captured`
- `swatch_requested`, `swatch_to_purchase` (attribution)
- `bundle_viewed`, `bundle_added`, `bundle_purchased`
- `loyalty_enrolled`, `loyalty_redeemed`
- `spin_played`, `spin_won`, `spin_converted`
- `referral_shared`, `referral_converted`
- `review_submitted`, `review_with_photo`
- `financing_calculated`, `financing_applied`
- `compare_started`, `compare_to_cart`
- `room_planner_used`, `room_planner_to_cart`

### Cross-Rig (dallas)

- **Mobile needs:** A/B test variant sync so mobile app shows same variants as web
- **Mobile needs:** Review data API so mobile can display reviews
- **Contract:** New web method `getExperimentVariant(experimentId, userId)` returns variant assignment

### Acceptance Criteria

- [ ] Stamped.io displaying reviews on Product Page
- [ ] 5 A/B experiments running with measurable variants
- [ ] All custom events firing in GA4 Enhanced Ecommerce
- [ ] Weekly digest email delivers to carolinafutons@gmail.com
- [ ] Conversion dashboard shows real-time funnel from visit → purchase

### Revenue Impact

- Reviews: +15-25% conversion → $2,250-$3,750/month at $15K baseline
- A/B optimization: +5-10% conversion lift over 60 days
- Analytics: enables all future optimization decisions

---

## EPIC 3: RETENTION & LIFECYCLE — "Keep Them Coming Back"

**Goal:** Turn one-time buyers into repeat customers. Furniture has long purchase cycles (2-5 years) — we need to own the relationship.

**Priority:** P1 — Start within 30 days of launch, compound over time.

**Owner:** godfrey (backend automation) + miquella (frontend lifecycle)

### Problem Statement

We have extensive lifecycle infrastructure code-complete but not activated:
- Email automation modules exist but Wix Automations aren't configured
- Cart recovery tracks events but doesn't send emails
- Post-purchase care sequence is coded (Day 3/7/30) but not triggered
- Referral system has anti-hijack guards but no marketing push
- Loyalty program has tiers but no enrollment campaign
- Birthday rewards are coded but no birthday data collected

The #1 risk: customers buy once and forget us. With 2-5 year furniture purchase cycles, we must stay in their inbox.

### Features

#### 3A. Email Automation Activation (Wix Automations + Klaviyo Migration Path)
**Why:** Email is the highest-ROI marketing channel for e-commerce (42:1 average return). We have 8 email modules but none are sending.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Configure Wix Automations: welcome series (3 emails) | Stilgar + godfrey | 2 beads |
| NEW | Configure Wix Automations: cart abandonment (3 emails) | godfrey | 1 bead |
| NEW | Configure Wix Automations: post-purchase care (Day 3/7/30) | godfrey | 1 bead |
| NEW | Configure Wix Automations: review request (Day 7) | godfrey | 1 bead |
| NEW | Configure Wix Automations: birthday reward | godfrey | 1 bead |
| NEW | Klaviyo migration spike — evaluate replacing Wix emails | rennala | 1 bead |
| NEW | Browse abandonment activation (exit-intent → email capture → drip) | miquella | 1 bead |

**Email sequences:**

Welcome series:
1. **Immediately:** "Welcome to Carolina Futons" + 10% first-order coupon (welcomeCoupon10)
2. **Day 2:** "Our Best Sellers" — top 5 products with lifestyle photos
3. **Day 5:** "Your Futon Buying Guide" — link to category buying guide matching quiz results (if taken)

Cart abandonment:
1. **1 hour:** "You left something behind" — cart contents with images + prices
2. **24 hours:** "Still thinking?" — add urgency (limited stock) + free shipping if threshold met
3. **72 hours:** "Last chance" — 5% recovery coupon (unique per cart, single-use)

Post-purchase care:
1. **Day 3:** "Your [Product] care guide" — assembly tips, fabric care, warranty info
2. **Day 7:** "How's your new [Product]?" — review request with 50 loyalty points incentive
3. **Day 30:** "Complete your room" — cross-sell recommendations based on purchase

#### 3B. Referral Program Full Activation
**Why:** Referred customers have 37% higher retention and 25% higher LTV. Our system is code-complete with anti-hijack guards but has zero marketing presence.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Referral landing page — dedicated /referral page with how-it-works | miquella | 1 bead |
| NEW | Post-purchase referral prompt enhancement — richer CTA on Thank You page | radahn | 1 bead |
| NEW | Referral email in post-purchase sequence (Day 14) | godfrey | 1 bead |
| NEW | Referral dashboard in Member Page — track shares, clicks, conversions | miquella | 1 bead |
| NEW | Social sharing deep links for referral codes | rennala | 1 bead |

**Incentive structure:** Referrer gets $25 store credit. Friend gets 10% off first order. Both credited on friend's first purchase.

#### 3C. Loyalty Program Marketing Push
**Why:** Loyalty program is fully built (Bronze/Silver/Gold tiers, points, badges, leaderboard, rewards store) but zero members. Need active enrollment campaign.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Loyalty enrollment prompt on Thank You page — auto-prompt after first purchase | miquella | 1 bead |
| NEW | Loyalty explainer page — /loyalty with tier comparison table | rennala | 1 bead |
| NEW | Tier-up notification emails — "You're X points from Silver!" | godfrey | 1 bead |
| NEW | Birthday collection — prompt for DOB during loyalty enrollment | miquella | 1 bead |
| NEW | Points statement email — monthly summary of points earned/redeemed | godfrey | 1 bead |

### Cross-Rig (dallas)

- **Push notifications:** Cart abandonment + referral + loyalty tier-up push to mobile devices
- **Deep links:** Referral codes must work as mobile deep links (open app → apply credit)
- **Contract:** Extend order tracking webhook (cf-hfao) to include loyalty points earned per order

### Acceptance Criteria

- [ ] Welcome series sends automatically on member registration
- [ ] Cart abandonment emails send at 1h, 24h, 72h intervals
- [ ] Post-purchase care emails deliver at Day 3, 7, 30
- [ ] Referral program visible on Thank You page and in Day 14 email
- [ ] Loyalty enrollment rate > 40% of first-time purchasers
- [ ] Birthday rewards trigger automatically on member's birthday
- [ ] Email unsubscribe works and is audit-logged (compliance)

### Revenue Impact

- Cart recovery emails: +5-15% recovery → $750-$2,250/month at $15K baseline
- Welcome coupon: +10% first-purchase conversion
- Referral program: 5-10% of customers refer → $750-$1,500/month incremental
- Loyalty repeat purchases: +20% LTV over 12 months

---

## EPIC 4: CONTENT MARKETING ENGINE — "Compound Growth"

**Goal:** Build sustainable organic traffic through content that compounds over time. Blog posts, buying guides, and social content that rank in search and drive free traffic forever.

**Priority:** P2 — Start 30 days after launch, compound over 6-12 months.

**Owner:** rennala (SEO/content) + melania (editorial calendar)

### Problem Statement

We have the infrastructure (blog page, CMS, JSON-LD, topic clusters, social feeds) but zero content. The marketing strategy targets 8 buying guides + 2 blog posts/week, but none are written. Organic search is a 6-12 month investment — every day delayed is a day of compounding lost.

### Features

#### 4A. Buying Guide Content Pipeline
**Why:** Long-form buying guides rank for high-intent keywords ("best futon mattress for daily sleeping", "murphy bed vs futon") and drive qualified traffic.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | 8 category buying guides — research, outline, draft (CMS entries) | rennala | 4 beads |
| NEW | Buying guide → product page linking (related products sidebar) | miquella | 1 bead |
| NEW | Buying guide SEO schema + internal linking strategy | rennala | 1 bead |
| NEW | Auto-generate buying guide social cards (OG images) | godfrey | 1 bead |

**8 Buying Guides (one per category):**
1. "The Complete Futon Buying Guide" — futon-frames (anchor piece)
2. "Wall Hugger Futons: Space-Saving Furniture That Doesn't Sacrifice Comfort"
3. "Murphy Cabinet Beds: The Ultimate Guest Room Solution"
4. "Platform Beds: Modern Sleep Without the Box Spring"
5. "How to Choose the Right Futon Mattress"
6. "Futon Covers & Fabrics: A Visual Guide"
7. "Outdoor Furniture That Handles Mountain Weather"
8. "Casegoods & Accessories: Complete Your Room"

#### 4B. Blog Content Calendar
**Why:** Regular blog content signals freshness to Google, gives social media material, and builds email newsletter content.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Content calendar template — 12-week rolling schedule | melania | 1 bead |
| NEW | Blog post template with SEO checklist | rennala | 1 bead |
| NEW | First 4 blog posts (room transformation, seasonal, how-to, local) | rennala | 2 beads |
| NEW | Blog → newsletter automation — weekly digest of new posts | godfrey | 1 bead |

**Content pillars:**
1. **Room transformations** — Before/after photos, styling tips
2. **Buying decisions** — Comparison posts ("Futon vs Sofa Bed: Which Is Right for You?")
3. **Care & maintenance** — "How to Clean Your Futon Mattress" (evergreen)
4. **Local/seasonal** — "Best Furniture for Mountain Living" (local SEO)
5. **Customer stories** — UGC photo features, testimonial spotlights

#### 4C. Social Media Content Automation
**Why:** Our social story scheduler, Facebook catalog sync, and Pinterest feed are code-complete but producing zero content.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Pinterest board strategy — 5 boards with initial 20 pins each | melania (coordination) | Manual |
| NEW | Instagram content template — product shots + room scenes | melania (coordination) | Manual |
| NEW | Social story cron activation — daily auto-post from product catalog | radahn | 1 bead |
| NEW | Facebook catalog verification — confirm feed syncs to Commerce Manager | rennala | 1 bead |

### Cross-Rig (dallas)

- **Mobile content:** Blog posts and buying guides should render in mobile app WebView
- **Push content:** Weekly "new blog post" push notification to engaged users
- **Contract:** RSS/JSON feed of blog posts for mobile consumption (blogService.web.js already has getPublishedBlogPosts)

### Acceptance Criteria

- [ ] 8 buying guides published in CMS with SEO schema
- [ ] 4 blog posts published within first 30 days
- [ ] Content calendar populated for 12 weeks
- [ ] Pinterest has 5 boards with 20+ pins each
- [ ] Facebook catalog sync verified in Commerce Manager
- [ ] Social story cron posts daily without manual intervention
- [ ] Blog → newsletter automation sends weekly

### Revenue Impact

- Organic traffic: 500-2,000 monthly sessions within 3 months (compounding)
- Buying guide conversion: 3-5% (higher intent than general traffic)
- Social referral traffic: 100-500 sessions/month
- Email list growth from content: +200-400 subscribers/month

---

## EPIC 5: PREMIUM EXPERIENCE — "Why Shop Here, Not Amazon"

**Goal:** Activate the premium service features that differentiate Carolina Futons from mass-market competitors. These features justify higher prices and build brand loyalty.

**Priority:** P2 — Activate within 60 days of launch.

**Owner:** radahn (shipping/delivery lead) + miquella (frontend experience)

### Problem Statement

Our competitive moat is expertise + service, not price. Amazon sells futons for less. But Amazon can't:
- Send you fabric swatches before you buy
- Deliver and assemble your futon in your living room
- Help you pick the right mattress for your use case
- Offer a virtual consultation with a futon expert

These premium features are CODE-COMPLETE but not activated or marketed.

### Features

#### 5A. Swatch Sample Commerce
**Why:** Fabric swatch requests are the #1 high-intent signal for guest-room buyers (Persona B). Currently just a form. Convert to a micro-product.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Swatch kit micro-product — $5 for 5 swatches, refundable on purchase | miquella | 2 beads |
| NEW | Swatch → purchase attribution tracking | godfrey | 1 bead |
| NEW | Swatch follow-up email sequence (Day 3: "What did you think?") | godfrey | 1 bead |

#### 5B. White-Glove Delivery Marketing
**Why:** White-glove delivery ($149 local, $249 regional) is our biggest differentiator vs online-only competitors. Currently hidden in shipping options — needs prominent marketing.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | "Getting It Home" page content — delivery options comparison, coverage map | radahn | 1 bead |
| NEW | White-glove badge on product cards ("White Glove Available") | miquella | 1 bead |
| NEW | Delivery scheduling integration — calendar picker for white-glove appointments | radahn | 2 beads |
| NEW | Delivery confirmation + day-of reminder SMS | godfrey | 1 bead |

#### 5C. Virtual Consultation Activation
**Why:** virtualConsultation.web.js is code-complete. Video consultations with Brenda or staff convert at 5-10x vs self-service for high-ticket items.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Consultation booking page with Wix Bookings integration | radahn | 1 bead |
| NEW | Pre-consultation quiz — "Tell us about your space" | miquella | 1 bead |
| NEW | Post-consultation follow-up with personalized recommendations | godfrey | 1 bead |

#### 5D. Assembly Guide Enhancement
**Why:** Assembly anxiety is the #2 objection after price for online furniture purchases. Our assemblyGuides.web.js module exists but has no content.

| Bead | Task | Owner | Effort |
|------|------|-------|--------|
| NEW | Assembly video content (partner with manufacturers for existing videos) | melania (coordination) | Manual |
| NEW | Assembly difficulty rating on product cards (Easy/Medium/Expert) | miquella | 1 bead |
| NEW | "Need help?" CTA linking to assembly service or local TaskRabbit | radahn | 1 bead |

### Cross-Rig (dallas)

- **Mobile consultation:** Video consultation should work from mobile app (WebRTC or Zoom link)
- **Mobile delivery tracking:** White-glove appointments visible in mobile order tracking
- **AR integration:** "Will it fit?" AR tool (already have AR-to-gamification bridge) for room visualization before purchase

### Acceptance Criteria

- [ ] Swatch kits purchasable as products with refund-on-purchase tracking
- [ ] White-glove delivery prominently featured on all eligible product pages
- [ ] Virtual consultation bookable through Wix Bookings
- [ ] Assembly guides accessible from Product Page with difficulty ratings
- [ ] Delivery scheduling shows available time slots via calendar picker

### Revenue Impact

- Swatch-to-purchase conversion: 30-40% (high-intent signal)
- White-glove delivery revenue: $149-$249 per order, 15-20% take rate = $300-$500/month
- Virtual consultation: 5-10x conversion rate, $100-200 AOV lift
- Assembly service: $75-150 per order, 5-10% take rate

---

## Epic Dependency Graph

```
EPIC 1 (Launch Readiness) — P0, MUST BE FIRST
    │
    ├──→ EPIC 2 (Conversion Intelligence) — P1, within 2 weeks of launch
    │       │
    │       └──→ EPIC 4 (Content Marketing) — P2, within 30 days (needs analytics)
    │
    ├──→ EPIC 3 (Retention & Lifecycle) — P1, within 30 days of launch
    │       │
    │       └──→ EPIC 5 (Premium Experience) — P2, within 60 days
    │
    └──→ dallas: Mobile App Integration (parallel with Epics 2-5)
```

**Critical path:** Epic 1 → Epic 2 → optimize → Epic 3 → compound → Epics 4+5

---

## Crew Capacity Planning

| Crew | Strengths | Epic Assignment |
|------|-----------|----------------|
| godfrey | Backend, security, automation | Epic 2 (instrumentation), Epic 3 (email automation) |
| radahn | Shipping, testing, frontend UX | Epic 1 (QA), Epic 5 (delivery, consultation) |
| miquella | Product catalog, editor, frontend | Epic 2 (reviews), Epic 5 (swatch, assembly) |
| rennala | SEO, content, data quality | Epic 2 (analytics), Epic 4 (content pipeline) |
| melania | PM, coordination, editorial | All epics (planning, cross-rig, editorial calendar) |
| dallas + mobile crew | Mobile app, push, deep links | Cross-rig integration for Epics 2-5 |

---

## Estimated Timeline

| Epic | Start | Duration | Revenue Start |
|------|-------|----------|--------------|
| Epic 1: Launch Readiness | NOW (blocked on Stilgar) | 1-2 days | Day 1 |
| Epic 2: Conversion Intelligence | Launch + 1 week | 2-3 weeks | Launch + 3 weeks |
| Epic 3: Retention & Lifecycle | Launch + 2 weeks | 3-4 weeks | Launch + 6 weeks |
| Epic 4: Content Marketing | Launch + 30 days | Ongoing | Launch + 90 days (compound) |
| Epic 5: Premium Experience | Launch + 45 days | 3-4 weeks | Launch + 75 days |

**Target: $15K/month by Launch + 90 days.**
