# Permissions.Anyone Endpoint Security Audit

**Bead:** CF-d8k2
**Date:** 2026-03-21
**Auditor:** cfutons/crew/godfrey
**Reference:** CF-env4 (IDOR fix), CF-a68a (customization IDOR), Dutch/Billy SSRF patterns

---

## Executive Summary

| Metric | Count | Coverage |
|--------|-------|----------|
| Total Permissions.Anyone methods | 336 | — |
| Mutation methods (write/track/submit) | 52 | 15.5% of total |
| **Has rate limiting** | **9** | **2.7%** |
| Has input validation (sanitize/validateId) | 291 | 86.6% |
| Files without ANY validation | 14 | — |
| Mutation methods without rate limiting | **48** | **92.3% of mutations** |
| Mutation methods without validation | 1 | 1.9% of mutations |

**Overall Grade: C+** — Input validation is strong (87%), but rate limiting is critically absent (97% of methods unprotected). Only 4 mutation methods have rate limiting.

---

## Critical Findings

### Finding 1: 48 mutation methods lack rate limiting

Only 4 mutation methods across 2 files have rate limiting:

| File | Method | Rate Limit Type |
|------|--------|----------------|
| newsletterService.web.js | subscribeToNewsletter | Email-keyed, 3/hour window + honeypot |
| newsletterService.web.js | captureExitIntentEmail | Same rate limiter |
| returnsService.web.js | submitGuestReturn | Rate limit check |
| returnsService.web.js | trackReturnShipment | Rate limit check |

**48 unprotected mutation methods** can be called without limit by anonymous users:

**HIGH RISK (data writes, email sends, bookings):**

| File | Method | Risk |
|------|--------|------|
| emailService.web.js | sendEmail | Spam vector — sends real emails |
| emailService.web.js | sendSwatchConfirmationEmail | Email spam |
| emailService.web.js | submitSwatchRequest | CMS write + email |
| fabricSampleService.web.js | submitFabricSampleRequest | CMS write + potential email |
| contactSubmissions.web.js | submitContactForm | CMS write |
| deliveryScheduling.web.js | bookAppointment | CMS write — book infinite slots |
| deliveryScheduling.web.js | cancelAppointment | CMS delete — cancel others' appointments |
| giftRegistry.web.js | markItemPurchased | CMS write — false purchase claims |
| productQA.web.js | insertGuestQuestion | CMS write — Q&A spam |
| dataService.web.js | submitReview | CMS write — review spam |
| liveChat.web.js | createSupportTicket | CMS write — ticket flood |
| liveChat.web.js | sendMessage (liveChatService) | CMS write — chat spam |
| browseAbandonment.web.js | captureRemindMeRequest | CMS write + email trigger |
| promotionsEngine.web.js | applyPromoCode | Promo abuse — enumerate valid codes |
| protectionPlan.web.js | addProtectionPlan | Cart manipulation |
| tradeProgram.web.js | applyForTradeAccount | CMS write — application spam |
| styleQuiz.web.js | captureQuizLead | CMS write |

**MEDIUM RISK (analytics/tracking — no direct data harm but cost/noise):**

| File | Method |
|------|--------|
| analyticsHelpers.web.js | trackAddToCart, trackProductView, trackPurchase, trackSocialShare |
| abTesting.web.js | trackEvent |
| affiliateProgram.web.js | trackAffiliateClick |
| bundleAnalytics.web.js | trackBundleImpression |
| checkoutOptimization.web.js | trackCheckoutStep |
| comparisonService.web.js | trackComparison |
| coreWebVitals.web.js | reportMetrics |
| dataService.web.js | trackVideoView |
| dynamicPricing.web.js | recordDemandSignal |
| emailAutomation.web.js | recordEmailEvent |
| searchService.web.js | recordSearchQuery |

**LOW RISK (validation helpers, no state change):**

| File | Method |
|------|--------|
| checkoutOptimization.web.js | validateShippingAddress |
| ups-shipping.web.js | validateAddress |
| promotionsEngine.web.js | validatePromoCode |

### Finding 2: 14 files lack input validation entirely

These files have Permissions.Anyone methods but use NO sanitize/validateId/validateEmail:

| File | Methods | Risk |
|------|---------|------|
| blogService.web.js | fetchBlogPost, fetchBlogFaqs, fetchBlogSlugs, fetchAllBlogPosts | Slug passed raw to backend |
| financingCalc.web.js | calculateForTerm, getAfterpayBreakdown, getCartFinancing, getFinancingWidget | Numeric inputs unchecked |
| financingService.web.js | calculateMonthlyPayment, getFinancingOptions, getLowestMonthlyDisplay | Numeric inputs unchecked |
| comfortService.web.js | getComfortLevels, getComfortProducts, getProductComfort | String inputs raw |
| sizeGuide.web.js | checkRoomFit, convertUnit, getComparisonTable, getDimensionsByCategory | Numeric/string raw |
| storeLocatorService.web.js | 7 methods | Geo/string inputs raw |
| swatchService.web.js | getAllSwatchFamilies, getProductSwatches, getSwatchCount, getSwatchPreviewColors | Slug inputs raw |
| imageAltText.web.js | getBatchAltText, getProductAltText | Product ID raw |
| accessibility.web.js | 3 methods | Config methods, low risk |
| blogRssFeed.web.js | generateBlogRssFeed | No inputs, low risk |
| googleMerchantFeed.web.js | generateFeed, getFeedData | No user inputs |
| membershipService.web.js | getMembershipPlans | No user inputs |
| showroomService.web.js | 3 methods | getShowroomBookingUrl is mutation w/o validation |
| wishlistShare.web.js | resolveShareToken | Token input raw |

### Finding 3: Abuse test coverage is minimal

Rate limit / abuse scenario tests exist only for:
- `newsletterService` (comprehensive — 271-line test suite)
- `returnsService` (rate limit checks in test)
- `visualSearch` (rate limit in tests)
- `socialStoryScheduler` (throttle tests)

**0 of the 48 unprotected mutation methods have abuse scenario tests.**

---

## Rate Limiting Patterns Available

The codebase has a proven rate limiting pattern in `newsletterService.web.js`:

```
Pattern: CMS-backed rate limit with email-keyed windows
- Collection: NewsletterRateLimit (key, count, windowStart)
- Window: 3 requests / 60 minutes
- Fail-open: allows on DB error
- Honeypot: silent success for bot submissions
```

Files that DO have rate limiting (5 files, covering 9 Anyone methods):
1. `newsletterService.web.js` — CMS-backed, email-keyed
2. `returnsService.web.js` — Rate limit on guest returns
3. `socialStoryScheduler.web.js` — Cooldown on story scheduling
4. `visualSearch.web.js` — Rate limit on image analysis
5. `wishlistAlerts.web.js` — Rate limit on alert subscriptions

---

## Recommendations

### P0 — Immediate (new beads needed)

1. **Add rate limiting to email-sending methods**: `sendEmail`, `sendSwatchConfirmationEmail`, `submitSwatchRequest` — these can send real emails to arbitrary addresses
2. **Add rate limiting to `submitContactForm`** — CMS write + potential email notification
3. **Add rate limiting to `bookAppointment`/`cancelAppointment`** — appointment slot exhaustion
4. **Add rate limiting to `insertGuestQuestion`** — Q&A spam floods product pages
5. **Add rate limiting to `submitReview`** — review spam
6. **Add rate limiting to `applyPromoCode`** — promo code enumeration

### P1 — Next sprint

7. Add input validation to `blogService.web.js` (sanitize slugs)
8. Add input validation to `financingCalc.web.js` / `financingService.web.js` (numeric bounds)
9. Add input validation to `wishlistShare.web.js` `resolveShareToken` (sanitize token)
10. Add honeypot pattern to `submitContactForm`, `insertGuestQuestion`, `fabricSampleService`

### P2 — Hardening

11. Add abuse scenario tests for all mutation methods
12. Consider IP-based rate limiting at Wix platform level (if available)
13. Add `showroomService.getShowroomBookingUrl` input validation (only mutation method with no validation)

---

## Methodology

- Scanned all `src/backend/*.web.js` files for `webMethod(Permissions.Anyone, ...)`
- Classified methods as mutation (write/track/submit/send) vs read-only
- Checked each file for `sanitize|validateId|validateEmail|validateSlug|cleanSlug` imports
- Checked each file for `rateLimit|_checkRateLimit|throttle|cooldown` patterns
- Searched `tests/` for abuse/rate-limit/spam scenario test coverage
- Cross-referenced with CF-env4 (IDOR), CF-a68a (customization IDOR) findings
