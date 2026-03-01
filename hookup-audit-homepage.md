# Hookup Audit: Homepage (Home.js)

**Bead**: cf-wszg | **Auditor**: miquella | **Date**: 2026-03-01

---

## 1. $w('#id') Mapping: Code → Spec

### Hero Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#heroSection` | `#heroSection` | MATCH | Section container |
| `#heroBg` | `#heroBg` | MATCH | Hero background image |
| `#heroOverlay` | — | IN CODE ONLY | Semi-transparent overlay for text readability. Not in spec. |
| `#heroTitle` | `#heroTitle` | MATCH | H1 heading |
| `#heroSubtitle` | `#heroSubtitle` | MATCH | Tagline |
| `#heroCTA` | `#heroCTA` | MATCH | "Explore Our Collection" button |

### Featured Products Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#featuredTitle` | — | IN CODE ONLY | Section heading "Our Favorite Finds". Spec says `—` (no ID). |
| `#featuredSubtitle` | — | IN CODE ONLY | Subtitle text. Not in spec. |
| `#featuredRepeater` | `#featuredRepeater` | MATCH | Product grid repeater |
| `#featuredImage` | `#featuredImage` | MATCH | Repeater: product image |
| `#featuredName` | `#featuredName` | MATCH | Repeater: product name |
| `#featuredPrice` | `#featuredPrice` | MATCH | Repeater: price |
| `#featuredOriginalPrice` | `#featuredOriginalPrice` | MATCH | Repeater: strikethrough price |
| `#featuredSaleBadge` | `#featuredSaleBadge` | MATCH | Repeater: sale badge |
| `#featuredRibbon` | — | IN CODE ONLY | Repeater: ribbon badge (Featured/New/Clearance). Not in spec. |
| `#featuredColorText` | — | IN CODE ONLY | Repeater: "X finishes" text. Not in spec. |
| `#featuredSwatchContainer` | — | IN CODE ONLY | Repeater: swatch container. Not in spec. |
| `#featuredQuickViewBtn` | — | IN CODE ONLY | Repeater: Quick View button. Not in spec. |

### Featured Quick View Modal
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#featuredQuickViewModal` | — | IN CODE ONLY | Quick view modal container. Not in spec. |
| `#featuredQvImage` | — | IN CODE ONLY | Modal: product image. Not in spec. |
| `#featuredQvName` | — | IN CODE ONLY | Modal: product name. Not in spec. |
| `#featuredQvPrice` | — | IN CODE ONLY | Modal: price. Not in spec. |
| `#featuredQvViewFull` | — | IN CODE ONLY | Modal: "View Full Details" button. Not in spec. |
| `#featuredQvAddToCart` | — | IN CODE ONLY | Modal: "Add to Cart" button. Not in spec. |
| `#featuredQvClose` | — | IN CODE ONLY | Modal: close button. Not in spec. |

### Sale Highlights Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#saleSection` | `#saleSection` | MATCH | Collapsible section |
| `#saleRepeater` | `#saleRepeater` | MATCH | Sale items repeater |
| `#saleImage` | `#saleImage` | MATCH | Repeater: image |
| `#saleName` | `#saleName` | MATCH | Repeater: name |
| `#salePrice` | `#salePrice` | MATCH | Repeater: price |
| `#saleOrigPrice` | `#saleOrigPrice` | MATCH | Repeater: original price |

### Category Showcase
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#categoryRepeater` | `#categoryRepeater` | MATCH | Repeater alternative |
| `#categoryCardTitle` | `#categoryCardTitle` | MATCH | Repeater: category name |
| `#categoryCardTagline` | `#categoryCardTagline` | MATCH | Repeater: tagline |
| `#categoryCardCount` | `#categoryCardCount` | MATCH | Repeater: product count |
| `#categoryCardImage` | — | IN CODE ONLY | Repeater: card image. Not in spec. |
| `#categoryCard` | — | IN CODE ONLY | Repeater: card container (hover). Not in spec. |
| `#categoryFutonFrames` | `#categoryFutonFrames` | MATCH | Static card (backward compat) |
| `#categoryMattresses` | `#categoryMattresses` | MATCH | Static card |
| `#categoryMurphy` | `#categoryMurphy` | MATCH | Static card |
| `#categoryPlatformBeds` | `#categoryPlatformBeds` | MATCH | Static card |
| `#categoryCasegoods` | `#categoryCasegoods` | MATCH | Static card |
| `#categorySale` | `#categorySale` | MATCH | Static card |
| `#categoryWallHuggers` | — | IN CODE ONLY | Code has 8 categories; spec has 6. Wall Huggers not in spec. |
| `#categoryUnfinished` | — | IN CODE ONLY | Unfinished Wood not in spec. |

### Recently Viewed Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#recentSection` | `#recentSection` | MATCH | Collapsible section |
| `#recentRepeater` | — | IN CODE ONLY | Repeater ID. Spec says `—` (no ID). |
| `#recentImage` | `#recentImage` | MATCH | Repeater: image |
| `#recentName` | `#recentName` | MATCH | Repeater: name |
| `#recentPrice` | `#recentPrice` | MATCH | Repeater: price |

### Trust Bar
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#trustBar` | `#trustBar` | MATCH | Container |
| `#trustItem1` – `#trustItem5` | — | IN CODE ONLY | Individual trust items. Spec only has container. |
| `#trustIcon1` – `#trustIcon5` | — | IN CODE ONLY | Trust icon elements. Not in spec. |
| `#trustText1` – `#trustText5` | — | IN CODE ONLY | Trust text elements. Not in spec. |

### Testimonials Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#testimonialRepeater` | `#testimonialRepeater` | MATCH | Testimonial repeater |
| `#testimonialQuote` | `#testimonialQuote` | MATCH | Repeater: quote text |
| `#testimonialName` | `#testimonialName` | MATCH | Repeater: customer name |
| `#testimonialPhoto` | — | IN CODE ONLY | Repeater: customer photo. Not in spec. |
| `#testimonialRating` | — | IN CODE ONLY | Repeater: star rating. Not in spec. |
| `#testimonialSchemaScript` | — | IN CODE ONLY | JSON-LD schema HtmlComponent. Not in spec. |
| `#testimonialSection` | — | IN CODE ONLY | Section container (for collapseOnMobile). Not in spec. |

### Video Showcase Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#videoShowcaseSection` | `#videoShowcaseSection` | MATCH | Section container |
| `#videoShowcaseTitle` | `#videoShowcaseTitle` | MATCH | Section title |
| `#videoShowcaseSubtitle` | `#videoShowcaseSubtitle` | MATCH | Section subtitle |
| `#viewAllVideosCTA` | `#viewAllVideosCTA` | MATCH | CTA button |
| `#videoThumb1` – `#videoThumb3` | — | IN CODE ONLY | Video thumbnails. Not in spec. |

### Style Quiz CTA Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#quizCTASection` | `#quizCTASection` | MATCH | Section container |
| `#quizCTATitle` | `#quizCTATitle` | MATCH | Title |
| `#quizCTASubtitle` | `#quizCTASubtitle` | MATCH | Subtitle |
| `#quizCTAButton` | `#quizCTAButton` | MATCH | Start quiz button |

### Swatch Promo Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#swatchPromoSection` | — | IN CODE ONLY | Entire section not in spec. |
| `#swatchPromoTitle` | — | IN CODE ONLY | Not in spec. |
| `#swatchPromoSubtitle` | — | IN CODE ONLY | Not in spec. |
| `#swatchPromoCTA` | — | IN CODE ONLY | Not in spec. |

### Newsletter Section
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#newsletterSection` | — | IN CODE ONLY | Entire section not in spec. |
| `#newsletterTitle` | — | IN CODE ONLY | Not in spec. |
| `#newsletterSubtitle` | — | IN CODE ONLY | Not in spec. |
| `#newsletterEmail` | — | IN CODE ONLY | Not in spec. |
| `#newsletterSubmit` | — | IN CODE ONLY | Not in spec. |
| `#newsletterSuccess` | — | IN CODE ONLY | Not in spec. |
| `#newsletterError` | — | IN CODE ONLY | Not in spec. |

### Other Elements
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#ridgelineHeader` | — | IN CODE ONLY | Mountain ridgeline SVG decoration. Not in spec. |
| `#websiteSchemaHtml` | `#websiteSchemaHtml` | MATCH | WebSite JSON-LD schema |

### Scroll Anchors (initSmoothScroll)
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#scrollToFeatured` | — | IN CODE ONLY | Scroll trigger. Not in spec. |
| `#scrollToCategories` | — | IN CODE ONLY | Scroll trigger. Not in spec. |
| `#scrollToSale` | — | IN CODE ONLY | Scroll trigger. Not in spec. |
| `#scrollToReviews` | — | IN CODE ONLY | Scroll trigger. Not in spec. |

---

## 2. IDs in Code Missing from Spec (Need to add to spec or create in editor)

**Total: 43 IDs in code not in spec**

### Must Create in Wix Studio Editor:

**Hero Section:**
- `#heroOverlay` — Box, semi-transparent overlay (rgba(58,37,24,0.6))

**Featured Products (repeater items):**
- `#featuredTitle` — Text (H2), section heading
- `#featuredSubtitle` — Text, section subtitle
- `#featuredRibbon` — Text, ribbon badge inside repeater
- `#featuredColorText` — Text, "X finishes" inside repeater
- `#featuredSwatchContainer` — Box, swatch container inside repeater
- `#featuredQuickViewBtn` — Button, Quick View inside repeater

**Featured Quick View Modal (7 elements):**
- `#featuredQuickViewModal` — Box, modal container, hidden default
- `#featuredQvImage` — Image, product image
- `#featuredQvName` — Text, product name
- `#featuredQvPrice` — Text, product price
- `#featuredQvViewFull` — Button, "View Full Details"
- `#featuredQvAddToCart` — Button, "Add to Cart"
- `#featuredQvClose` — Button, close icon

**Category Showcase (repeater items):**
- `#categoryCardImage` — Image, card image inside repeater
- `#categoryCard` — Box, card container inside repeater (for hover)
- `#categoryWallHuggers` — Box, static card for Wall Huggers
- `#categoryUnfinished` — Box, static card for Unfinished Wood

**Recently Viewed:**
- `#recentRepeater` — Repeater (spec omits ID)

**Trust Bar (15 elements):**
- `#trustItem1` through `#trustItem5` — Box/Container per trust signal
- `#trustIcon1` through `#trustIcon5` — Text, icon element per signal
- `#trustText1` through `#trustText5` — Text, label per signal

**Testimonials:**
- `#testimonialPhoto` — Image inside repeater
- `#testimonialRating` — Text inside repeater (star rating)
- `#testimonialSchemaScript` — HtmlComponent, hidden
- `#testimonialSection` — Section container

**Video Showcase:**
- `#videoThumb1`, `#videoThumb2`, `#videoThumb3` — Image/Box thumbnails

**Swatch Promo Section (4 elements):**
- `#swatchPromoSection` — Section container
- `#swatchPromoTitle` — Text (H2)
- `#swatchPromoSubtitle` — Text
- `#swatchPromoCTA` — Button, "Request Free Fabric Swatches"

**Newsletter Section (7 elements):**
- `#newsletterSection` — Section container
- `#newsletterTitle` — Text (H2)
- `#newsletterSubtitle` — Text
- `#newsletterEmail` — Input (email)
- `#newsletterSubmit` — Button
- `#newsletterSuccess` — Text, hidden default
- `#newsletterError` — Text, hidden default

**Mountain Ridgeline:**
- `#ridgelineHeader` — Image/SVG

**Scroll Anchors (4 elements):**
- `#scrollToFeatured` — Button/Link
- `#scrollToCategories` — Button/Link
- `#scrollToSale` — Button/Link
- `#scrollToReviews` — Button/Link

---

## 3. IDs in Spec Missing from Code

None. All spec-defined IDs for the Homepage are referenced in code.

---

## 4. Backend Import Verification

| Import | Source | Exists |
|--------|--------|--------|
| `getFeaturedProducts`, `getSaleProducts` | `backend/productRecommendations.web` | YES |
| `getWebSiteSchema` | `backend/seoHelpers.web` | YES |
| `getRecentlyViewed`, `buildRecentlyViewedSection` | `public/galleryHelpers.js` | YES |
| `getHomepageHeroImage`, `getCategoryHeroImage`, `getCategoryCardImage` | `public/placeholderImages.js` | YES |
| `isMobile`, `collapseOnMobile`, `initBackToTop`, `limitForViewport` | `public/mobileHelpers` | YES |
| `trackEvent` | `public/engagementTracker` | YES |
| `announce`, `makeClickable` | `public/a11yHelpers` | YES |
| `colors` | `public/designTokens.js` | YES |
| `prioritizeSections` | `public/performanceHelpers.js` | YES |
| `wixData` | `wix-data` | YES (Wix built-in) |
| `errorMonitoring.web` | `backend/errorMonitoring.web` (dynamic) | YES |
| `newsletterService.web` | `backend/newsletterService.web` (dynamic) | YES |
| `testimonialService.web` | `backend/testimonialService.web` (dynamic) | YES |
| `wix-location-frontend` | Wix built-in (dynamic) | YES |
| `cartService` | `public/cartService` (dynamic) | YES |

**All imports resolve. No missing files.**

Note: `getCategoryHeroImage` is imported but not used in Home.js (only `getCategoryCardImage` is called).

---

## 5. Dead Code / Unused $w Refs

| Item | Location | Issue |
|------|----------|-------|
| `getCategoryHeroImage` | Import line 7 | Imported but never called in Home.js |
| `isMobile` | Import line 8 | Imported but never directly called (used via `collapseOnMobile` and `limitForViewport`) |

---

## 6. Summary

| Metric | Count |
|--------|-------|
| Total unique $w IDs in code | 74 |
| IDs matching spec | 31 |
| IDs in code, missing from spec | 43 |
| IDs in spec, missing from code | 0 |
| Backend/public imports | 15 (all resolve) |
| Dead imports | 1 (`getCategoryHeroImage`) |
| Wix Studio elements to create | 43 |
