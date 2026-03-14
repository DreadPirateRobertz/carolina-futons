# Carolina Futons — Product Strategy

**Author:** melania (crew lead)
**Date:** 2026-02-20
**Status:** ACTIVE

---

## 1. Who We Are

Carolina Futons is a family-owned furniture store in Hendersonville, NC (Blue Ridge Mountains). Owner Brenda Deal. Physical showroom open Wed-Sat 10am-5pm. We sell futon frames, mattresses, covers, pillows, storage, and outdoor furniture across 8 product categories.

**Our edge:** We're not a faceless Amazon marketplace. We're a real store with real people who know futons inside and out. Brenda can tell you which mattress works for a guest room vs. a college dorm vs. a daily sleeper. That expertise is our moat.

---

## 2. Customer Personas

### Persona A: "College Parent" (35-55, suburban)
- **Trigger:** Kid going to college, needs a dorm/apartment futon
- **Budget:** $300-700
- **Cares about:** Durability, easy assembly, looks decent on video calls home
- **Objections:** "Will it last 4 years?" / "Can my kid put it together?"
- **Journey:** Google "best futon for college" → lands on category page → wants frame+mattress bundle → needs shipping to campus
- **Win strategy:** Bundle deals, assembly guides, "ships to dorm" messaging, student discount coupon

### Persona B: "Guest Room Upgrader" (40-65, homeowner)
- **Trigger:** Spare room needs a sofa that converts to a bed for guests
- **Budget:** $600-1,500
- **Cares about:** Aesthetics (must look like furniture, not a dorm piece), comfort for occasional sleeping, fabric options
- **Objections:** "Will this look cheap?" / "Is it comfortable enough for my parents to sleep on?"
- **Journey:** Pinterest/Instagram inspiration → product page → fabric swatch request → wants white-glove delivery
- **Win strategy:** Premium fabric visualization, swatch samples, room-scene photography, white-glove delivery option, style quiz

### Persona C: "Small Space Dweller" (25-40, renter/condo)
- **Trigger:** Apartment too small for both a couch and a bed
- **Budget:** $400-1,000
- **Cares about:** Space efficiency, modern look, easy conversion mechanism
- **Objections:** "Will it fit through my door?" / "Does it look like a futon or a couch?"
- **Journey:** Google "space saving furniture" → category browse → dimension obsession → needs delivery scheduling
- **Win strategy:** Dimension specs prominently displayed, lifestyle photos in small rooms, delivery scheduling for apartment buildings

### Persona D: "Outdoor Living Enthusiast" (35-60, homeowner with porch/patio)
- **Trigger:** Wants comfortable outdoor seating that handles weather
- **Budget:** $500-1,200
- **Cares about:** Weather resistance, comfort, mountain-living aesthetic
- **Objections:** "Will this fade in the sun?" / "Can it handle rain?"
- **Journey:** Local search "outdoor furniture Hendersonville" → outdoor category → care instructions matter
- **Win strategy:** Weather-resistance details, care guides, local delivery, mountain-aesthetic alignment

---

## 3. Conversion Funnel Analysis

### Current Funnel (Code-Complete State)

```
AWARENESS        → Google Shopping feed, Facebook catalog, Pinterest feed,
                   Blog with SEO, social meta (OG/Rich Pin/Twitter)

DISCOVERY        → Home page: 8 category showcase, featured products, sale items
                   Category pages: filters, sort, badges, swatch previews
                   Search: autocomplete + results page

CONSIDERATION    → Product page: variants, gallery, zoom, swatch visualizer,
                   cross-sell, bundles, delivery estimate, reviews placeholder
                   Style quiz: "Find Your Perfect Futon"
                   Comparison bar (up to 3 products)

INTENT           → Side cart auto-open, tiered discount progress bars
                   Free shipping threshold ($999), bundle discount (5%)
                   Exit-intent popup with email capture

PURCHASE         → Cart page: shipping calculator, cross-sell
                   Checkout: address validation, trust signals
                   Gift cards and marketing coupons accepted

POST-PURCHASE    → Thank You page: care sequence, assembly guide, referral
                   Member page: order history, wishlist, loyalty points
                   Email: Day 3/7/30 care sequence (needs Wix Automation setup)
```

### Funnel Gaps

| Gap | Impact | Fix |
|-----|--------|-----|
| No product reviews/ratings | High — social proof missing at decision point | Integrate Wix Reviews or Stamped.io (see PLUGIN-RECOMMENDATIONS.md) |
| No live chat | Medium — questions kill momentum at checkout | Add Tidio or Wix Chat widget |
| No "recently viewed" persistence | Low — resets on page reload | Implement sessionStorage-based persistence (partially coded) |
| No A/B testing | Medium — can't optimize without data | Google Optimize or Wix built-in A/B |
| Placeholder images everywhere | CRITICAL — no real product photos yet | Photography session or Wix AI generation |

---

## 4. Revenue Optimization

### Current Levers (Code-Complete)

| Lever | Mechanism | Expected Impact |
|-------|-----------|----------------|
| **Bundle discount** | Frame + mattress = 5% off | +15-25% AOV lift |
| **Tiered discount** | 5% > $500, 10% > $1000 | Encourages upsell |
| **Free shipping threshold** | Free at $999 | Anchors purchases near $1K |
| **Cross-sell engine** | "Complete Your Futon" on every product/cart page | +10-20% attach rate |
| **White-glove delivery** | $149 local, $249 regional, free > $1,999 | Premium service revenue |
| **Gift cards** | Custom amounts, email delivery | Gift-giving occasions |
| **Loyalty program** | Bronze/Silver/Gold tiers, points on purchase | Repeat purchase incentive |
| **Marketing coupons** | Welcome (10%), birthday (15%), tier upgrade | New customer conversion |
| **Abandoned cart recovery** | Event tracking + stats | Recovery email automation |

### Untapped Revenue Opportunities

1. **Swatch sample shipping** — Charge $5 for fabric swatch kit, refundable on purchase. Currently just a request form. Convert to a micro-product.

2. **Assembly service upsell** — Partner with local TaskRabbit/Handy for assembly add-on at checkout. $75-150 per order. High margin.

3. **Protection plan** — Fabric protection or extended warranty. 15-20% attachment rate is typical for furniture. Partner with Extend or similar.

4. **Seasonal bundles** — "Back to School" (frame + mattress + cover, August), "Guest Ready" (frame + mattress + pillows, November), "Patio Season" (outdoor frame + cushions, April).

5. **Referral program** — Currently just a code on Thank You page. Make it a proper two-sided incentive: referrer gets $25 credit, friend gets 10% off first order.

---

## 5. Competitive Positioning

### Competitive Landscape

| Competitor | Strength | Weakness |
|-----------|----------|----------|
| **Amazon** | Price, speed, reviews | No expertise, no white-glove, no swatch |
| **Wayfair** | Selection, lifestyle photos | Impersonal, slow shipping, returns hassle |
| **IKEA** | Price, design | No futon specialization, no local delivery, assembly nightmare |
| **Local furniture stores** | Touch and feel, local delivery | Poor websites, no e-commerce |
| **DHP/Novogratz (D2C)** | Brand recognition, modern designs | Limited customer service, no customization |

### Our Differentiators

1. **Futon specialists** — We don't sell everything. We sell futons and we know them cold.
2. **Real showroom** — Come sit on it before you buy. Nobody else in e-commerce can say that.
3. **White-glove delivery** — We bring it in, set it up, take away the packaging. Amazon can't.
4. **Fabric expertise** — Swatch samples, color visualization, care guidance. Not just a dropdown.
5. **Mountain brand** — Blue Ridge aesthetic is authentic and distinctive. Not manufactured.
6. **Local + national** — Local showroom credibility + national shipping reach.

### Positioning Statement

> Carolina Futons is the specialty futon store for people who want more than a cheap frame from Amazon. We combine showroom expertise with online convenience — real fabric swatches, white-glove delivery, and a team that actually knows futons.

---

## 6. Marketing Channel Strategy

### Owned (High Priority)

| Channel | Status | Next Steps |
|---------|--------|-----------|
| **Google Shopping** | Feed endpoint live | Connect in Merchant Center, verify products |
| **SEO / Blog** | Blog page coded, JSON-LD on all pages | Publish 2 posts/week: buying guides, room ideas, care tips |
| **Email** | Newsletter capture on blog, exit-intent, Thank You | Set up Wix Automations for care sequence + welcome series |
| **Pinterest** | Feed endpoint live, Rich Pin meta | Validate Rich Pins, create 5 boards (Room Ideas, Before/After, Colors, Outdoor, Dorm) |

### Earned (Medium Priority)

| Channel | Status | Next Steps |
|---------|--------|-----------|
| **Google Reviews** | Not started | Add review prompt to Day 7 care email |
| **Social sharing** | Share buttons on wishlist + blog | Encourage user-generated content with hashtag |
| **Referral** | Basic code on Thank You page | Build proper referral tracking system |

### Paid (Future — After Organic Foundation)

| Channel | When | Why |
|---------|------|-----|
| **Google Ads** | After Shopping feed verified | Brand + category keywords |
| **Facebook/Instagram Ads** | After catalog connected | Retargeting cart abandoners, lookalike audiences |
| **Pinterest Ads** | After Rich Pins validated | Home decor intent is high on Pinterest |

---

## 7. 30/60/90 Day Roadmap

### Days 1-30: LAUNCH FOUNDATION

**Goal:** Get the site live on Wix with core shopping flow working.

- [ ] Create all 11 CMS collections in Wix Dashboard
- [ ] Store UPS secrets in Wix Secrets Manager
- [ ] Build editor layouts matching element IDs (WIX-STUDIO-BUILD-SPEC.md)
- [ ] Upload real product photos (or generate via Wix AI)
- [ ] Publish to Experiment_2, test all 4 layers (core pages → cart → engagement → member)
- [ ] Connect Google Shopping feed in Merchant Center
- [ ] Install reviews app (Wix Reviews or Stamped.io)
- [ ] Set up Wix Automations for welcome email + care sequence
- [ ] Mobile responsive QA pass
- [ ] Fix any integration bugs discovered in live testing

**Crew assignments:**
- Caesar: Editor layout buildout, mobile QA, product photography direction
- Radahn: Complete remaining test suites (6 files), write integration test stories

### Days 31-60: OPTIMIZE & GROW

**Goal:** Optimize conversion rate and start driving traffic.

- [ ] Validate Pinterest Rich Pins, connect catalog
- [ ] Connect Facebook catalog, set up retargeting pixel
- [ ] Publish 8 blog posts (buying guides per category)
- [ ] Add live chat widget (Tidio)
- [ ] A/B test: free shipping threshold ($999 vs $799 vs $1,199)
- [ ] A/B test: bundle discount (5% vs 10% vs free accessory)
- [ ] Launch referral program with proper tracking
- [ ] Build seasonal "Back to School" bundle for August
- [ ] Analyze first 30 days of analytics data
- [ ] Iterate on Product Page based on user behavior

### Days 61-90: SCALE

**Goal:** Scale what works, cut what doesn't.

- [ ] Launch Google Ads on top-performing categories
- [ ] Launch Facebook/Instagram ads with retargeting
- [ ] Add protection plan upsell at checkout
- [ ] Add assembly service upsell (local market)
- [ ] Build out TikTok presence (room transformation videos)
- [ ] Loyalty program promotion campaign
- [ ] Analyze and optimize based on 60 days of data
- [ ] Plan holiday season strategy (Black Friday, Christmas gift cards)
- [ ] Consider Wix Branded App for repeat customers

---

## 8. Key Metrics to Track

| Metric | Target | Tool |
|--------|--------|------|
| **Conversion rate** | 2-3% (furniture industry avg: 1-2%) | Wix Analytics + GA4 |
| **Average order value** | $650+ (frame + mattress baseline) | Wix Analytics |
| **Cart abandonment rate** | < 70% (industry avg: ~75%) | cartRecovery.web.js + GA4 |
| **Bundle attach rate** | 30%+ | productRecommendations tracking |
| **Email capture rate** | 5%+ of visitors | Exit-intent + newsletter tracking |
| **Return visitor rate** | 25%+ | GA4 |
| **Review submission rate** | 10%+ of purchasers | Reviews app |
| **Loyalty program enrollment** | 40%+ of purchasers | loyaltyService tracking |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Placeholder images hurt credibility | HIGH | CRITICAL | Prioritize real product photography. Use Wix AI for lifestyle scenes. |
| CMS collections not created → features silently fail | HIGH | HIGH | Block everything on collection creation. Test incrementally. |
| UPS API rate limits in production | LOW | MEDIUM | Flat-rate fallback already coded. Cache rate responses. |
| Mobile experience poor | MEDIUM | HIGH | Mobile QA is sprint priority. Wix handles basics. |
| Competitor price undercutting | MEDIUM | MEDIUM | Compete on service (white-glove, expertise), not price. |
| SEO takes months to rank | HIGH | MEDIUM | Supplement with paid ads after day 30. Blog content compounds. |

---

## 10. Strategic Principles

1. **Expertise over price.** We will never win a price war with Amazon. We win by knowing more about futons than anyone else online.

2. **Show, don't tell.** Fabric swatches, room photos, video demos, assembly guides. Every piece of content should reduce purchase anxiety.

3. **Local roots, national reach.** The Hendersonville showroom is our credibility anchor. The website is our scale engine. Both reinforce each other.

4. **Bundle everything.** A futon frame alone is a commodity. A frame + mattress + cover + delivery + assembly is a solution. Solutions have higher margins and higher satisfaction.

5. **Post-purchase is the real product.** The care sequence, assembly guides, loyalty program, and referral system turn one-time buyers into repeat customers and advocates. This is where lifetime value lives.

---

*This is a living document. Updated as data comes in and strategy evolves.*
