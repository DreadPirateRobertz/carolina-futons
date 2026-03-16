# Element Usage Audit — $w('#elementId') Reachability Map

**Generated**: 2026-03-16 | **Auditor**: cfutons/crew/miquella (CF-hnoc)
**Scope**: All `$w('#elementId')` calls across `src/pages/` and `src/public/`

## Summary

| Metric | Count |
|---|---|
| Total unique element IDs | 1,190 |
| Pages with onReady | 41 (all pages) |
| Reachable from onReady | 1,021 |
| In orphan public modules | 197 |
| Orphan modules (not imported by any page) | 57 total, 24 with element refs |

All 41 pages have `$w.onReady` handlers. No completely dead page files.

169 element IDs exist only in public modules that are NOT imported by any page — these are unreachable until their modules are connected.

---

## Tier 1: CRITICAL (Homepage + PDP + Master Page)

**Wire these first for maximum impact.** These pages drive traffic and revenue.

### Home.js — 51 direct elements + 19 from imports = 70 total

| Section | Element IDs | Purpose |
|---|---|---|
| **Hero** | `#heroBg`, `#heroCTA`, `#heroOverlay`, `#heroSection`, `#heroSubtitle`, `#heroTitle` | Main hero banner |
| **Featured Products** | `#featuredRepeater`, `#featuredSkeleton`, `#featuredSubtitle`, `#featuredTitle`, `#featuredQuickViewModal`, `#featuredQvAddToCart`, `#featuredQvClose`, `#featuredQvImage`, `#featuredQvName`, `#featuredQvPrice`, `#featuredQvViewFull` | Featured product grid + quick view |
| **Categories** | `#categoryRepeater`, `#categorySkeleton` | Category cards |
| **Sale** | `#saleRepeater`, `#saleSection`, `#saleSkeleton` | Sale items |
| **Newsletter** | `#newsletterEmail`, `#newsletterError`, `#newsletterSection`, `#newsletterSubmit`, `#newsletterSubtitle`, `#newsletterSuccess`, `#newsletterTitle` | Email signup |
| **Testimonials** | `#testimonialPauseBtn`, `#testimonialRepeater`, `#testimonialSchemaScript`, `#testimonialSection`, `#testimonialSlideshow` | Customer reviews |
| **Video** | `#videoShowcaseSection`, `#videoShowcaseSubtitle`, `#videoShowcaseTitle`, `#viewAllVideosCTA` | Video showcase |
| **Quiz CTA** | `#quizCTAButton`, `#quizCTASection`, `#quizCTASubtitle`, `#quizCTATitle` | Style quiz promo |
| **Swatch Promo** | `#swatchPromoCTA`, `#swatchPromoSection`, `#swatchPromoSubtitle`, `#swatchPromoTitle` | Swatch request promo |
| **Recently Viewed** | `#recentSection` | Recently viewed strip |
| **Other** | `#ridgelineHeader`, `#section4`, `#trustBar`, `#websiteSchemaHtml` | Layout + SEO |

### Product Page.js — 19 direct elements + 108 from imports = 127 total

| Section | Element IDs | Purpose |
|---|---|---|
| **Core Product** | `#productDataset`, `#productMainImage`, `#productName`, `#productPrice`, `#productComparePrice`, `#productDescription` | Product display |
| **Add to Cart** | `#addToCartButton`, `#buyNowButton`, `#quantityInput`, `#quantityMinus`, `#quantityPlus` | Purchase actions |
| **Cross-Sell** | `#alsoBoughtRepeater`, `#alsoBoughtSection`, `#collectionRepeater`, `#collectionSection`, `#relatedRepeater`, `#relatedSection` | Related products |
| **Recently Viewed** | `#recentlyViewedRepeater`, `#recentlyViewedSection` | Recent browsing |

**Note**: 108 additional elements come from 19 imported public modules (ProductGallery, ProductOptions, ProductDetails, AddToCart, ProductPagePolish, InventoryDisplay, etc.). These handle gallery, size/color options, reviews, size guide, financing, and more.

### masterPage.js — 48 direct elements + 30 from imports = 78 total

| Section | Element IDs | Purpose |
|---|---|---|
| **Header/Nav** | `#cartBadge`, `#cartIcon`, `#headerSearchInput`, `#siteLogo`, `#sideCartPanel` | Global navigation |
| **Shipping Bar** | `#headerShippingBar`, `#headerShippingText` | Free shipping promo |
| **Promo/Lightbox** | `#promoCTA`, `#promoClose`, `#promoCode`, `#promoCopyCode`, `#promoCountdown`, `#promoDismiss`, `#promoEmailInput`, `#promoEmailSubmit`, `#promoHeroImage`, `#promoLightbox`, `#promoOverlay`, `#promoRepeater`, `#promoSubtitle`, `#promoTitle` | Promotional overlay |
| **Exit Intent** | `#exitDragHandle`, `#exitEmailError`, `#exitEmailInput`, `#exitEmailSubmit`, `#exitIntentPopup`, `#exitOverlay`, `#exitSubtitle`, `#exitSuccess`, `#exitSwatchLink`, `#exitTitle` | Exit intent popup |
| **Newsletter Modal** | `#newsletterModal`, `#newsletterModalEmail`, `#newsletterModalError`, `#newsletterModalOverlay`, `#newsletterModalSubmit`, `#newsletterModalSuccess`, `#newsletterModalTrigger` | Newsletter modal |
| **Install Banner** | `#installBanner`, `#installBannerBtn`, `#installBannerDismiss`, `#installBannerText` | PWA install |
| **SEO/Schema** | `#a11yLiveRegion`, `#businessSchemaHtml`, `#websiteSchemaHtml`, `#productTitle` | A11y + structured data |
| **Announcement** | `#announcementText`, `#justAddedHighlight` | Top announcement bar |

---

## Tier 2: IMPORTANT (Commerce Pages)

**Wire these second — they complete the purchase funnel.**

### Category Page.js — 62 direct + 18 from imports = 80 total

Key groups: Product grid (`#productGridRepeater`, `#quickViewModal`, etc.), Filters (20 filter elements: `#filterBrand`, `#filterCategory`, `#filterColor`, `#filterPrice`, `#filterSize`, etc.), Sorting (`#sortDropdown`, `#mobileSortBar`), Empty states (`#emptyStateSection`, `#noMatchesSection`), Compare (`#compareBar`, `#compareRepeater`, `#compareViewBtn`), Breadcrumbs, SEO schema.

### Cart Page.js — 22 direct + 26 from imports = 48 total

Key groups: Cart items (`#cartDataset`, `#cartItemsRepeater`), Totals (`#cartSubtotal`, `#cartTotal`, `#cartShipping`), Empty state (`#emptyCartSection`, `#emptyCartMessage`, `#emptyCartTitle`), Shipping progress bar (`#shippingProgressBar/Text/Icon`, `#tierProgressBar/Text`), Cross-sell (`#cartRecentRepeater`, `#suggestionsSection`), Financing teaser.

### Side Cart.js — 18 direct + 2 from imports = 20 total

Key groups: Panel (`#sideCartPanel`, `#sideCartOverlay`, `#sideCartClose`), Items (`#sideCartRepeater`, `#sideCartItems`), Footer (`#sideCartFooter`, `#sideCartSubtotal`, `#sideCartCheckout`, `#viewFullCart`), Shipping bar (`#sideShippingBar/Text`, `#sideTierBar/Text`), Empty state (`#sideCartEmpty`).

### Checkout.js — 46 direct + 20 from imports = 66 total

Key groups: Address form (6 fields + errors/success), Order summary sidebar (9 elements), Payment methods, Shipping options, Express checkout, Financing/Afterpay messages, Store credit, Protection plan section, Trust badges, Checkout progress nav.

### Search Results.js — 21 direct + 15 from imports = 36 total

Key groups: Search input/button, Results repeater, Filters (category, color, material, price), Sort, Load more, No results state, Suggestions, Search chips.

### Thank You Page.js — 48 direct + 14 from imports = 62 total

Key groups: Thank you message + order number, Delivery timeline/estimate, Assembly guide section, Post-purchase recommendations, Newsletter signup, Review form, Testimonial form, Referral section, Social sharing (5 platforms), Brenda's personal message section.

---

## Tier 3: NICE-TO-HAVE (Secondary Pages)

| Page | Direct Elements | Total w/ Imports | Notes |
|---|---|---|---|
| Admin Returns | 47 | 49 | Internal admin — low priority for editor |
| Member Page | 36 | 69 | Returns portal, store credit, gift cards, loyalty |
| Order Tracking | 33 | 35 | Post-purchase |
| Contact | 32 | 34 | Contact form, map, hours |
| Returns | 35 | 50 | Customer returns flow |
| Buying Guide | 31 | 33 | Single guide page |
| Assembly Guides | 25 | 27 | Assembly instructions |
| Blog | 22 | 24 | Blog listing |
| Referral Page | 22 | 24 | Referral program |
| Price Match Guarantee | 20 | 22 | Price match form |
| Store Locator | 19 | 21 | Map + directions |
| Sustainability | 18 | 20 | Brand values |
| Financing | 18 | 20 | Financing options |
| About | 18 | 22 | About page |
| Style Quiz | 17 | 19 | Product recommendation quiz |
| Gift Cards | 17 | 31 | Gift card purchase/check balance |
| Blog Post | 16 | 18 | Single blog post |
| Room Planner | 15 | 17 | Room planning tool |
| Shipping Policy | 14 | 16 | Shipping info |
| Compare Page | 11 | 26 | Product comparison |
| FAQ | 10 | 12 | FAQ accordion |
| Fullscreen Page | 10 | 12 | Fullscreen video |
| Newsletter | 9 | 11 | Newsletter signup |
| Buying Guides | 7 | 9 | Guide listing |
| UGC Gallery | 7 | 19 | User gallery |
| Getting It Home | 6 | 8 | Delivery info |
| Sale | 5 | 7 | Sale page |
| Privacy Policy | 5 | 7 | Legal |
| Terms & Conditions | 5 | 5 | Legal |
| Search Suggestions Box | 3 | 5 | Search autocomplete |
| Refund Policy | 1 | 1 | Legal |
| Accessibility Statement | 0 | 0 | Legal — no elements |

---

## Orphan Public Modules (24 modules with element refs, not imported by any page)

These modules contain element references but are NOT imported by any page file. Their elements are unreachable until integration is completed.

| Module | Element Count | Key Elements | Action Needed |
|---|---|---|---|
| **ProductReviews** | 22 | `#reviewForm`, `#reviewBodyInput`, `#reviewRating`, `#reviewSubmitBtn`, etc. | Import in Product Page |
| **ProductSizeGuide** | 35 | `#sizeGuideModal`, `#dimensionDiagram`, `#checkFitBtn`, room dimensions, etc. | Import in Product Page |
| **ProductFinancing** | 10 | `#financingModal`, `#afterpayMessage`, `#financingTerms`, etc. | Import in Product Page |
| **ProductQA** | 12 | `#qaForm`, `#qaRepeater`, `#qaSubmitBtn`, etc. | Import in Product Page |
| **ProductVideoSection** | 11 | `#assemblyVideoSection`, `#assemblyPlayBtn`, etc. | Import in Product Page |
| **Product360Viewer** | 6 | `#viewer360Container`, `#view360Btn`, etc. | Import in Product Page |
| **ProductARViewer** | 3 | `#productARViewer`, `#viewInRoomBtn`, `#arViewerContainer` | Import in Product Page |
| **ProductAssemblyGuide** | 6 | `#assemblyGuideSection`, `#assemblyGuideBtn`, etc. | Import in Product Page |
| **CustomizationBuilder** | 21 | `#custBuilderSection`, `#custConfigName`, etc. | Import in Product Page |
| **SwatchRequestFlow** | 10 | `#swatchRequestForm`, `#srEmail`, `#srName`, etc. | Import in Product Page |
| **CategoryPagePolish** | 16 | `#categoryHeroSection`, `#emptyStateSection`, etc. | Import in Category Page |
| **ComfortStoryCards** | 3 | `#comfortSection`, `#comfortFilter` | Import in Category/Product Page |
| **LifestyleGallery** | 4 | `#lifestyleSection`, `#lifestyleRepeater` | Import in Home or Category |
| **LiveChat** | 17 | `#chatWidget`, `#chatMessageInput`, `#chatMessages`, etc. | Import in masterPage |
| **MultiImageGallery** | 7 | `#productGallery`, `#lightboxOverlay`, `#imageZoomOverlay` | Import in Product Page |
| **CartIllustrations** | 3 | `#cartHeroSkyline`, `#emptyCartIllustration` | Import in Cart Page |
| **CartIllustrationsFigma** | 2 | `#cartHeroSkyline`, `#emptyCartIllustration` | Figma version of above |
| **FeelAndComfort** | 6 | `#feelAndComfortSection`, `#comfortSection` | Import in Product Page |
| **SizeGuideModal** | 2 | `#sizeGuideBtn`, `#sizeGuideModal` | Overlaps with ProductSizeGuide |
| **proactiveChatTriggers** | 3 | `#chatWidget`, `#proactiveBubble` | Import in masterPage |
| **emptyStates** | 1 | `#searchSuggestionsList` | Import in Search Results |
| **elementIdValidator** | 1 | `#id` (generic validator) | Utility — no hookup needed |
| **emptyStateBuilder** | 1 | `#element` (generic) | Utility — no hookup needed |
| **illustrations** | 1 | `#element` (generic) | Utility — no hookup needed |

---

## Priority Hookup Order for Stilgar

### Phase 1: Critical Path (do first)
1. **masterPage** (48 elements) — Global nav, cart icon, exit intent, promo overlay
2. **Home** (51 elements) — Hero, featured products, categories, testimonials
3. **Product Page** (19 direct + connect orphan modules for full 127+)

### Phase 2: Commerce Funnel
4. **Category Page** (62 elements) — Product grid, filters, sorting
5. **Cart Page** (22 elements) — Cart items, totals, shipping bar
6. **Side Cart** (18 elements) — Slide-out cart panel
7. **Checkout** (46 elements) — Full checkout flow
8. **Search Results** (21 elements) — Search + filters

### Phase 3: Post-Purchase + Support
9. **Thank You Page** (48 elements) — Post-purchase engagement
10. **Member Page** (36 elements) — Account dashboard
11. **Order Tracking** (33 elements) — Order status
12. **Returns** (35 elements) — Returns flow

### Phase 4: Content + Discovery
13. **Blog** + **Blog Post** (38 combined) — Content marketing
14. **FAQ** (10 elements) — Customer support
15. **About** + **Contact** (50 combined) — Brand pages
16. All remaining pages

### Phase 5: Connect Orphan Modules
After Phase 1-2 pages are wired, import orphan modules into their target pages:
- ProductReviews, ProductSizeGuide, ProductFinancing, ProductQA, Product360Viewer, ProductARViewer → Product Page
- CategoryPagePolish → Category Page
- LiveChat, proactiveChatTriggers → masterPage
- CartIllustrations → Cart Page

---

## Cross-Reference: EDITOR-HOOKUP-GUIDE.md

The existing hookup guide covers element placement instructions for many of these IDs. This audit adds:
- **Reachability mapping** — which elements are actually called from running code
- **Orphan module identification** — 24 modules with 197 elements awaiting import
- **Priority ordering** — which pages to wire first for maximum business impact
- **Total scope** — 1,190 unique element IDs across the full codebase
