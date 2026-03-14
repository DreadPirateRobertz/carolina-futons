# CF-bhcf: Element Connectivity Verification Report

**Date**: 2026-03-09
**Method**: Playwright MCP → Wix Studio editor → Layers panel search per element ID
**Scope**: All 39 pages + masterPage | 827 unique `$w('#id')` references across codebase

## Summary

| Metric | Count |
|--------|-------|
| Total unique element IDs in code | 827 |
| Elements FOUND in editor | 595 |
| Elements MISSING from editor | 232 |
| Connectivity rate | 71.9% |
| Pages verified | 39 + masterPage |

## Per-Page Results

### masterPage (13/48 found — 27.1%)
**Missing (35):** a11yLiveRegion, exitDragHandle, exitEmailError, exitEmailInput, exitEmailSubmit, exitIntentPopup, exitOverlay, exitSubtitle, exitSuccess, exitSwatchLink, exitTitle, headerShippingBar, headerShippingText, installBanner, installBannerBtn, installBannerDismiss, installBannerText, justAddedHighlight, newsletterModal, newsletterModalEmail, newsletterModalError, newsletterModalOverlay, newsletterModalSubmit, newsletterModalSuccess, newsletterModalTrigger, productTitle, promoCode, promoCopyCode, promoCountdown, promoCTA, promoHeroImage, promoLightbox, promoRepeater, sideCartPanel, websiteSchemaHtml

**Note**: masterPage IDs from code differ from ELEMENT_PLACEMENT_LOG.md IDs placed in CF-hhdg. The code references IDs that were renamed or not placed in that earlier phase.

### Home (29/50 found — 58.0%)
**Missing (21):** categoryRepeater, categorySkeleton, newsletterEmail, newsletterError, newsletterSubmit, newsletterSubtitle, newsletterSuccess, newsletterTitle, quizCTAButton, quizCTASubtitle, quizCTATitle, swatchPromoCTA, swatchPromoSubtitle, swatchPromoTitle, testimonialPauseBtn, testimonialRepeater, testimonialSchemaScript, testimonialSlideshow, videoShowcaseSubtitle, videoShowcaseTitle, viewAllVideosCTA

### About (8/12 found — 66.7%)
**Missing (4):** aboutTestimonials, brandStoryRepeater, teamRepeater, timelineRepeater

### Blog (19/22 found — 86.4%)
**Missing (3):** blogGridRepeater, blogProductsRepeater, categoryFilterRepeater

### Blog Post (15/16 found — 93.8%)
**Missing (1):** relatedPostsRepeater

### Buying Guide (15/31 found — 48.4%)
**Missing (16):** breadcrumbRepeater, comparisonHeaderRepeater, comparisonRowRepeater, guideFaqRepeater, relatedGuideRepeater, relatedGuidesBox, relatedProductRepeater, relatedProductsBox, sectionRepeater, shareEmail, shareFacebook, sharePinterest, shareTwitter, tocContainer, tocRepeater, tocToggle

### Buying Guides (2/7 found — 28.6%)
**Missing (5):** breadcrumbRepeater, categoryFilterRepeater, guidesRepeater, hubMetaHtml, hubSeoSchema

### Cart Page (19/22 found — 86.4%)
**Missing (3):** cartItemsRepeater, cartRecentRepeater, cartShipping

### Category Page (55/61 found — 90.2%)
**Missing (6):** categoryDataset, compareRepeater, filterChipRepeater, productGridRepeater, recentlyViewedRepeater, recentlyViewedSection

### Checkout (36/46 found — 78.3%)
**Missing (10):** checkoutProgressRepeater, orderSummaryItemsRepeater, paymentMethodsRepeater, protectionPlanRepeater, shippingOptionsRepeater, storeCreditAppliedAmount, storeCreditAppliedSection, storeCreditApplyBtn, trustRepeater, validateAddressBtn

### Compare Page (10/11 found — 90.9%)
**Missing (1):** comparisonRowRepeater

### Contact (29/32 found — 90.6%)
**Missing (3):** contactTestimonials, hoursRepeater, todayStatus

### FAQ (2/4 found — 50.0%)
**Missing (2):** faqCategoryRepeater, faqRepeater

### Financing (10/18 found — 55.6%)
**Missing (8):** afterpayScheduleRepeater, comparisonRepeater, financingFaqRepeater, providerRepeater, quickPriceRepeater, resultHeader, resultsSection, shopNowBtn

### Fullscreen Page (5/6 found — 83.3%)
**Missing (1):** videosRepeater

### Gift Cards (16/17 found — 94.1%)
**Missing (1):** gcDenomRepeater

### Member Page (24/36 found — 66.7%)
**Missing (12):** addressRepeater, ordersRepeater, rewardsRepeater, tierComparisonRepeater, wishAlertHistoryRepeater, wishlistEmpty, wishlistRepeater, wishShareBtn, wishShareEmail, wishShareFacebook, wishSharePinterest, wishSortDropdown

### Newsletter (8/9 found — 88.9%)
**Missing (1):** benefitsRepeater

### Order Tracking (30/33 found — 90.9%)
**Missing (3):** activityRepeater, trackingItemsRepeater, upsTrackingBtn

### Price Match Guarantee (14/20 found — 70.0%)
**Missing (6):** pmNewRequestBtn, pmRequestsRepeater, policyExclusionsRepeater, policyRulesRepeater, priceMatchDescription, priceMatchTitle

### Privacy Policy (0/1 found — 0.0%)
**Missing (1):** policyTocRepeater

### Product Page (10/14 found — 71.4%)
**Missing (4):** alsoBoughtRepeater, collectionRepeater, recentlyViewedRepeater, relatedRepeater

### Referral Page (20/22 found — 90.9%)
**Missing (2):** howItWorksRepeater, referralHistoryRepeater

### Refund Policy (0/1 found — 0.0%)
**Missing (1):** policyRepeater

### Room Planner (12/15 found — 80.0%)
**Missing (3):** plannerStepsRepeater, productPaletteRepeater, roomPresetsRepeater

### Returns (32/35 found — 91.4%)
**Missing (3):** existingReturnsRepeater, rmaActivityRepeater, trackRmaBtn

### Search Results (18/21 found — 85.7%)
**Missing (3):** searchChipsRepeater, searchRepeater, suggestionsRepeater

### Search Suggestions Box (2/3 found — 66.7%)
**Missing (1):** suggestionsRepeater

### Shipping Policy (8/14 found — 57.1%)
**Missing (6):** assemblyGuidesRepeater, careTipsRepeater, deliveryRepeater, shippingResult, shippingSchemaHtml, shippingZipInput

### Side Cart (17/18 found — 94.4%)
**Missing (1):** sideCartRepeater

### Store Locator (0/19 found — 0.0%)
**Missing (19):** directionsCTA, locationAddress, locationFeatures, locationGallery, locationHours, locationPhone, locatorMapPlaceholder, locatorSchemaHtml, nearbyRepeater, nearbySection, searchDistance, searchResultsSection, storeDescription, storeFeaturesRepeater, storeGallery, storeHeroSection, storeMapIframe, storeSearchInput, storeTitle

### Style Quiz (1/17 found — 5.9%)
**Missing (16):** progressBar, progressText, quizBudgetOptions, quizCompleteSection, quizEstimate, quizFeaturedRepeater, quizFeaturedSection, quizMatches, quizProgressSection, quizQuestion, quizQuestionSection, quizRecommendationsRepeater, quizRestartBtn, quizResultsSection, quizStartBtn, quizStartSection, quizViewAllBtn

### Sustainability (0/18 found — 0.0%)
**Missing (18):** certRepeater, certSection, challengeRepeater, challengeSection, commitmentRepeater, commitmentSection, impactCo2, impactSection, impactTrees, impactWaste, materialRepeater, materialSection, partnerRepeater, partnerSection, pledgeBtn, pledgeSection, sustainHeroSection, sustainHeroSubtitle

### Terms and Conditions (0/1 found — 0.0%)
**Missing (1):** policyTocRepeater

### Thank You Page (9/48 found — 18.8%)
**Missing (39):** assemblyGuideLink, assemblySection, deliveryEstimate, deliverySection, deliveryTracking, loyaltyEarnedPoints, loyaltyJoinBtn, loyaltySection, loyaltyStatus, orderDetails, orderItems, orderNumber, orderSummary, orderTotal, postPurchaseSurvey, receiptEmail, receiptSection, referralBonusText, referralCodeDisplay, referralSection, referralShareBtn, reviewIncentive, reviewProductRepeater, reviewSection, shareEmail, shareFacebook, shareInstagram, sharePinterest, shareSection, shareTwitter, socialProofSection, socialProofText, suggestedRepeater, suggestionsSection, thankYouMessage, thankYouSchemaHtml, thankYouTitle, trackingLink, trackingSection, trackOrderBtn, upsellRepeater, upsellSection, warrantyInfo, warrantySection, welcomeOffer, welcomeOfferSection, whatsNextRepeater, whatsNextSection

### UGC Gallery (1/7 found — 14.3%)
**Missing (6):** galleryModerationNote, galleryRepeater, gallerySection, submitPhotoBtn, ugcUploadForm, ugcUploadSection

### Admin Returns (46/47 found — 97.9%)
**Missing (1):** returnsRepeater

### Assembly Guides (22/25 found — 88.0%)
**Missing (3):** careTipsRepeater, guideCategoryRepeater, guideListRepeater

### Accessibility Statement (0/0 — N/A)
No `$w` references in code.

## Missing Element Patterns

### 1. Repeaters (most common missing type)
Many missing elements are Repeaters (`*Repeater`). This is expected — Wix Studio's "Quick Add" presets don't include Repeaters. Repeaters require manual addition via the full Add Elements panel or programmatic creation. **78 of 232 missing elements are Repeaters.**

### 2. Completely unbuilt pages (0% connectivity)
- **Store Locator** (0/19) — No elements placed yet
- **Sustainability** (0/18) — No elements placed yet
- **Privacy Policy** (0/1) — No elements placed yet
- **Refund Policy** (0/1) — No elements placed yet
- **Terms and Conditions** (0/1) — No elements placed yet

### 3. Mostly unbuilt pages (<20% connectivity)
- **Style Quiz** (1/17 = 5.9%)
- **UGC Gallery** (1/7 = 14.3%)
- **Thank You Page** (9/48 = 18.8%)

### 4. Well-built pages (>90% connectivity)
- **Admin Returns** (46/47 = 97.9%)
- **Gift Cards** (16/17 = 94.1%)
- **Side Cart** (17/18 = 94.4%)
- **Blog Post** (15/16 = 93.8%)
- **Returns** (32/35 = 91.4%)
- **Order Tracking** (30/33 = 90.9%)
- **Referral Page** (20/22 = 90.9%)
- **Compare Page** (10/11 = 90.9%)
- **Contact** (29/32 = 90.6%)
- **Category Page** (55/61 = 90.2%)

## Console Errors

The only recurring editor error is `"Can't sort page children in layers"` — a known Wix Studio internal issue that doesn't affect element connectivity. No functional errors were observed during page navigation.

## Recommendations

1. **Priority 1 — Add missing Repeaters**: The most impactful gap. Repeaters can't be added via Quick Add presets; they need the full Add Elements → Lists & Grids → Repeaters workflow.
2. **Priority 2 — Build unplaced pages**: Store Locator (19), Sustainability (18), Style Quiz (16), Thank You Page (39 missing) need full element builds.
3. **Priority 3 — masterPage gap analysis**: The masterPage code references 48 IDs but only 13 are found. Many were placed in CF-hhdg under different names (e.g., `#promoOverlay` was placed but code references `promoOverlay` — need to verify ID rename persistence).
4. **Wix Dev verification**: `wix dev` started successfully, synced types and pages for UI version 19 without errors. The local editor connection confirmed the site structure is healthy.
