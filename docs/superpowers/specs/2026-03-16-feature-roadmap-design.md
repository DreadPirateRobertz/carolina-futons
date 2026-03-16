# Carolina Futons — Comprehensive Feature Roadmap

**Date**: 2026-03-16
**Author**: melania (PM)
**Iterations**: 3 (crew feedback from miquella, radahn, dallas)
**Status**: DRAFT — awaiting user approval

## Context

Carolina Futons staging site has 88 products, 19 pages, and a massive existing codebase:
- **98 backend modules** (Velo web modules)
- **41 page controllers**
- **116 public utility modules**
- **16,658+ tests** across 409 files

Nearly all features are already coded and tested but **not yet wired to the Wix Studio editor**. The primary work is editor hookup + activation, not new development.

**Business**: Small-town furniture showroom in Hendersonville, NC. Brick-and-mortar since 1991, transitioning to omnichannel e-commerce. Owner: Brenda Deal. Products: futons ($200-$800), Murphy cabinet beds ($1,400-$3,000), platform beds ($300-$1,200), mattresses, accessories.

**Stack**: Wix Studio + Wix Velo (JavaScript), UPS REST API, GitHub CI/CD with Codecov.

## Design Principles

1. **Code exists — wire it up.** Most features need editor hookup, not new development.
2. **Conversion funnel first.** Tier 1 covers: find → evaluate → buy → receive → return.
3. **Reduce Brenda's workload.** Self-service features (tracking, returns) cut phone support.
4. **Considered purchases need social proof.** $500+ furniture requires reviews, comparisons, guides.
5. **Delivery is the #1 anxiety.** Furniture shipping is complex — estimators and scheduling are critical.

---

## TIER 1 — Launch Essentials

Must be live before accepting real orders. Covers the complete purchase decision funnel.

### 1.1 Search (searchService + categorySearch)

**Modules**: `searchService.web.js`, `categorySearch.web.js`
**Pages**: `Search Results.js`, `Category Page.js`
**Public**: `categoryFilterHelpers.js`

**Exports**: `searchProducts()`, `getFilterValues()`, `fullTextSearch()`, `getAutocompleteSuggestions()`, `getPopularSearches()`, `recordSearchQuery()`

**What it does**: Full-text product search with faceted filtering (price range, category, material, size), autocomplete suggestions, and popular query tracking. Category pages use same filter engine.

**Hookup work**: Wire search input in header to `searchProducts()`. Connect filter sidebar on Category Page to `getFilterValues()`. Wire Search Results page to display results.

**Effort**: Medium

### 1.2 Cart Recovery + Email Automation

**Modules**: `cartRecovery.web.js`, `browseAbandonment.web.js`, `emailAutomation.web.js`, `emailTemplates.web.js`, `emailService.web.js`

**Exports**: `wixEcom_onAbandonedCheckoutCreated()`, `wixEcom_onAbandonedCheckoutRecovered()`, `getAbandonedCartStats()`, `triggerWelcomeSequence()`, `triggerPostPurchaseSequence()`, `triggerAbandonedCartRecovery()`, `processEmailQueue()`

**What it does**: Automated email sequences:
- Abandoned cart recovery (with discount nudge)
- Welcome series for new members
- Post-purchase care (assembly tips, review request)
- Re-engagement for dormant customers

**Hookup work**: Enable Wix Triggered Emails, configure email templates, wire event listeners.

**Effort**: Medium (template design + Triggered Emails config)

### 1.3 Delivery Estimator by Zip Code

**Modules**: `deliveryExperience.web.js`, `deliveryScheduling.web.js`
**Public**: `cartDeliveryEstimate.js`

**What it does**: Shows estimated delivery date on Product Page and Cart based on customer zip code. Uses UPS shipping zones + processing time. Reduces #1 purchase barrier: "when will it arrive?"

**Hookup work**: Add zip code input on Product Page, wire to `getDeliveryEstimate()`. Display in Cart.

**Effort**: Medium

### 1.4 Delivery Scheduling

**Modules**: `deliveryScheduling.web.js`

**What it does**: Appointment window picker at checkout for furniture delivery. Liftgate, white glove, and curbside options. Prevents #1 post-purchase complaint (missed deliveries).

**Hookup work**: Add scheduling widget to Checkout page, wire to backend.

**Effort**: Medium

### 1.5 Order Tracking

**Modules**: `orderTracking.web.js`
**Pages**: `Order Tracking.js`

**Exports**: `lookupOrder()`, `getTrackingTimeline()`, `subscribeToNotifications()`

**What it does**: Customer-facing order status page. Lookup by order number + email. UPS tracking integration with visual timeline. Cuts "where's my order?" calls by 50%+.

**Hookup work**: Create Order Tracking page in editor, wire form + timeline display.

**Effort**: Low (UPS API already configured)

### 1.6 Returns Portal

**Modules**: `returnsService.web.js`
**Pages**: `Returns.js`, `Admin Returns.js`

**Exports**: `getReturnEligibleOrders()`, `submitReturnRequest()`, `getMyReturns()`, `generateReturnLabel()`, `getAdminReturns()`, `processRefund()` (14 total exports)

**What it does**: Self-service returns with RMA tracking. 10% restocking fee per policy. Return label generation. Guest returns supported. Admin dashboard for processing.

**Hookup work**: Create Returns + Admin Returns pages in editor, wire forms.

**Effort**: Medium

### 1.7 Reviews & Ratings

**Modules**: `productReviews.web.js`, `reviewsService.web.js`, `photoReviews.web.js`

**Exports**: `getReviewSummary()`, `getUnifiedReviews()`, `getReviewHighlights()`, `getModerationQueue()`

**What it does**: Star ratings + text reviews + photo reviews on Product Page. Unified feed combining all review types. Moderation queue for admin. Social proof is critical — nobody buys a $700 frame without reviews.

**Hookup work**: Add review widget to Product Page, wire submission form + display. Consider importing Google/Yelp reviews as starter content.

**Effort**: Medium

### 1.8 Assembly Guide on Product Page (Quick Win)

**Modules**: `assemblyGuides.web.js`
**Pages**: `Assembly Guides.js` (already built)

**Exports**: `getAssemblyGuide()`, `getCareTips()`, `listAssemblyGuides()`

**What it does**: Links "Assembly difficulty: Easy | 30 min" directly on Product Page. Links to full assembly guide. Reduces purchase anxiety.

**Hookup work**: Add info section to Product Page template, wire to `getAssemblyGuide()` by SKU.

**Effort**: Low (just wiring existing content)

---

## TIER 2 — Conversion Boosters (Month 1 Post-Launch)

Features that increase AOV and conversion rate.

### 2.1 Product Recommendations + Cross-Sell

**Modules**: `productRecommendations.web.js`, `crossSellWidget.js`

**Exports**: `getRelatedProducts()`, `getCompletionSuggestions()`, `getBundleSuggestion()`, `getBestsellers()`, `getRecentlyViewed()`, `getCustomersAlsoBought()`, `initCrossSellWidget()`

**What it does**: "You might also like", "Complete the room" (frame + mattress + cover), recently viewed, bestsellers. Cross-sell widget on Cart/Side Cart.

**Effort**: Low (algorithm exists, needs widget hookup)

### 2.2 Bundle Builder

**Modules**: `bundleBuilder.web.js`, `bundleAnalytics.web.js`

**Exports**: `getBundleRecommendations()`, `calculateBundlePrice()`, `getCoPurchasePatterns()`, `getBundleTemplates()`

**What it does**: "Frame + Mattress + Cover" configurator with bundle discount. Co-purchase pattern analysis. Performance tracking.

**Effort**: Medium (needs UX for configurator)

### 2.3 Product Comparison

**Modules**: `comparisonService.web.js`
**Pages**: `Compare Page.js`

**What it does**: Side-by-side comparison of 2-4 products. Dimensions, price, material, ratings. Critical for considered purchases.

**Effort**: Medium

### 2.4 Style Quiz

**Modules**: `styleQuiz.web.js`
**Pages**: `Style Quiz.js`

**Exports**: `getQuizRecommendations()`, `getQuizOptions()`

**What it does**: 5-7 question quiz → personalized product recommendations. Great lead gen for email capture.

**Effort**: Medium

### 2.5 Gift Cards

**Modules**: `giftCards.web.js`
**Pages**: `Gift Cards.js`

**Exports**: `purchaseGiftCard()`, `checkBalance()`, `redeemGiftCard()`

**What it does**: Digital gift cards with email delivery, balance check, redemption at checkout.

**Effort**: Medium

### 2.6 Financing Calculator

**Modules**: `financingCalc.web.js`, `financingService.web.js`
**Pages**: `Financing.js`

**Exports**: `calculateForTerm()`, `getAfterpayBreakdown()`, `getCartFinancing()`

**What it does**: Monthly payment calculator for 6/12/18/24-month terms. Afterpay 4-installment breakdown. Removes price objection on Murphy beds.

**Effort**: Low

### 2.7 Size Guide Modal

**Modules**: `sizeGuide.web.js`

**What it does**: Interactive size guide showing product dimensions, room fit recommendations.

**Effort**: Low

### 2.8 Loyalty Program

**Modules**: `loyaltyService.web.js`, `loyaltyTiers.web.js`
**Pages**: `Member Page.js`

**Exports**: `getMyLoyaltyAccount()`, `getAvailableRewards()`, `redeemReward()`, `getLoyaltyTiers()`

**What it does**: Bronze/Silver/Gold tier progression. Points per dollar. Birthday discounts. Uses Wix Loyalty v2 API.

**Effort**: High (member area integration)

### 2.9 Wishlist Alerts

**Modules**: `wishlistAlerts.web.js`

**Exports**: `checkPriceDrops()`, `checkBackInStock()`, `checkLowStock()`

**What it does**: Price drop (>=10% from 30-day high) and back-in-stock email notifications.

**Effort**: Low

### 2.10 Social Proof Badges

**Modules**: `socialProof.web.js`

**What it does**: "32 people viewed today", "3 sold this week" badges on product cards.

**Effort**: Low

### 2.11 Abandoned Cart SMS

**Modules**: `smsService.web.js`

**What it does**: SMS cart recovery (higher open rate than email). Opt-in at checkout.

**Effort**: Medium (needs SMS provider)

---

## TIER 3 — Content & Engagement (Months 2-3)

| Feature | Module | Page | Effort |
|---------|--------|------|--------|
| Buying Guides | `buyingGuides.web.js` | `Buying Guides.js` | Med |
| Room Planner | `roomPlanner.web.js` | `Room Planner.js` | High |
| UGC Gallery | `ugcService.web.js` | `UGC Gallery.js` | Med |
| Blog SEO Hub | `seoContentHub.web.js` + `topicClusters.web.js` | `Blog.js` | Low |
| Sustainability | `sustainability.web.js` | `Sustainability.js` | Low |
| Virtual Consultation | `virtualConsultation.web.js` | — | Med |
| Post-Purchase Care | `postPurchaseCare.web.js` | — | Low |

---

## TIER 4 — Growth & Optimization (Months 3-6)

| Feature | Module | Effort |
|---------|--------|--------|
| A/B Testing | `abTesting.web.js` | Med |
| Analytics Dashboard | `analyticsDashboard.web.js` | Med |
| Google Merchant Feed | `googleMerchantFeed.web.js` | Low |
| Pinterest Catalog Sync | `pinterestCatalogSync.web.js` | Low |
| Facebook Catalog | `facebookCatalog.web.js` | Low |
| Referral Program | `referralService.web.js` | Med |
| Trade/Designer Program | `tradeProgram.web.js` | Med |
| Store Credit | `storeCreditService.web.js` | Low |
| Price Match | `priceMatchService.web.js` | Low |
| SMS Marketing | `smsService.web.js` | Med |
| 360-Spin / AR Preview | (new) | High |

---

## Cross-Cutting Concerns

| Feature | Module | Always Active |
|---------|--------|--------------|
| Accessibility (WCAG 2.1 AA) | `accessibility.web.js` + `a11yHelpers.js` | Yes |
| Core Web Vitals | `coreWebVitals.web.js` | Yes |
| Error Monitoring | `errorMonitoring.web.js` | Yes |
| SEO Helpers | `seoHelpers.web.js` + `imageAltText.web.js` | Yes |
| Dynamic Pricing | `dynamicPricing.web.js` | Yes |
| Notifications | `notificationService.web.js` | Yes |

---

## Summary

| Tier | Features | Focus | Timeline |
|------|----------|-------|----------|
| 1 | 8 | Purchase funnel completion | Before go-live |
| 2 | 11 | AOV + conversion lift | Month 1 |
| 3 | 7 | Traffic + trust | Months 2-3 |
| 4 | 11 | Scale + channels | Months 3-6 |
| Cross-cutting | 6 | Infrastructure | Always |
| **Total** | **43** | | |

## Iteration History

- **v1**: Initial 4-tier structure, 30+ features
- **v2**: Promoted Delivery Estimator/Scheduling + Reviews to Tier 1 (radahn + miquella feedback). Added Product Comparison, Size Guide, Assembly Guide on PDP.
- **v3**: Demoted Gift Cards + Financing to Tier 2 (miquella: not launch blockers). Reordered Tier 2 (Recs before Bundles). Added Abandoned Cart SMS to Tier 2. Marked Assembly Guide as quick win. Tier 1 tightened to 8 focused features.

## Dependencies

- **All Tier 1 features** depend on editor login being resolved (currently blocked)
- **Reviews** may benefit from Google/Yelp import tool for starter content
- **Delivery Scheduling** depends on UPS API (already configured)
- **Email Automation** depends on Wix Triggered Emails app being installed
- **Loyalty** depends on Wix Loyalty app
- **Gift Cards** depends on Wix Gift Cards app
- **SMS** depends on SMS provider selection (Twilio, etc.)

## Risks

1. **Editor access blocker** — most hookup work requires Wix Studio editor login (currently blocked)
2. **App installation** — several features need Wix apps installed (eCommerce, Gift Cards, Loyalty)
3. **Review cold start** — launching with zero reviews hurts conversion. Need import strategy.
4. **Delivery complexity** — furniture shipping is complex. Estimator accuracy depends on UPS zone data quality.
5. **Email deliverability** — need to verify sending domain and warm up email reputation.
