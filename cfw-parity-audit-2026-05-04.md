# cfw vs Wix Editor Hookup Guide — Parity Audit (cf-ah0m)

**Generated**: 2026-05-04 by morgott (cfutons crew)
**Sources**:
- `EDITOR-HOOKUP-GUIDE.md` (255 features extracted across 29 page sections)
- cfw `src/` static inventory: 193 `data-slot` values, 529 component basenames
- Live HEAD probes against `https://carolina-futons-web.vercel.app/` (page-existence only — no in-DOM verification)

**Method (automated, structural)**:
1. Parse hookup guide → list of (page, section, subfeature, element_ids[]) feature rows.
2. Tokenize feature labels + element ids; tokenize cfw component basenames + data-slot values.
3. Match heuristic: ≥2 token overlap → `yes`; ≥1 token → `partial`; none → `missing`.
4. Cross-check live URL probe for the 26 page roots.

**Caveats**: This is a static name-based audit. A `yes` does not guarantee runtime correctness — it means a same-named component exists in the cfw tree. Conversely a `missing` may be a naming-divergence false positive (e.g. `Filters` matches no `*filter*` component because cfw uses `FacetPanel`). Treat the report as triage input for a follow-up runtime audit, not as a sign-off.

## Summary

| Verdict | Count | % |
| --- | --- | --- |
| ✓ yes | 41 | 16.1% |
| ~ partial | 166 | 65.1% |
| ✗ missing | 41 | 16.1% |
| ? unknown | 7 | 2.7% |
| **total** | **255** | 100% |

## Per-page breakdown

| Page | cfw URL | ✓ | ~ | ✗ | ? | total |
| --- | --- | --: | --: | --: | --: | --: |
| ABOUT | `/about` | 0 | 2 | 1 | 0 | 3 |
| ADMIN A/B TESTS | `(admin)` | 0 | 2 | 1 | 0 | 3 |
| ADMIN DELIVERY CALENDAR | `(admin)` | 0 | 2 | 0 | 0 | 2 |
| BLOG | `/blog` | 1 | 9 | 1 | 1 | 12 |
| CART PAGE | `/cart` | 3 | 7 | 1 | 0 | 11 |
| CATEGORY PAGE | `/shop/<slug>` | 2 | 6 | 1 | 1 | 10 |
| CHECKOUT | `/checkout` | 0 | 11 | 2 | 0 | 13 |
| COMMUNITY GALLERY | `/community-gallery` | 0 | 3 | 1 | 0 | 4 |
| COMPARE PAGE | `/compare` | 0 | 3 | 1 | 1 | 5 |
| CONTACT | `/contact` | 1 | 4 | 1 | 0 | 6 |
| FABRIC SWATCHES | `/fabric-swatches (404)` | 2 | 2 | 0 | 1 | 5 |
| FAQ | `/faq` | 0 | 2 | 1 | 0 | 3 |
| FULLSCREEN / PRODUCT VIDEOS | `(modal)` | 0 | 2 | 0 | 0 | 2 |
| HOME PAGE | `/` | 8 | 8 | 1 | 0 | 17 |
| MASTER PAGE | `/ (global)` | 3 | 11 | 2 | 0 | 16 |
| MEMBER PAGE | `/dashboard` | 2 | 6 | 4 | 0 | 12 |
| PRICE MATCH GUARANTEE | `/price-match-guarantee (404)` | 1 | 3 | 2 | 0 | 6 |
| PRODUCT PAGE | `/products/<slug>` | 8 | 22 | 1 | 0 | 31 |
| REFERRAL PAGE | `/referral` | 1 | 4 | 1 | 0 | 6 |
| ROOM PLANNER | `/room-planner` | 2 | 6 | 0 | 0 | 8 |
| SEARCH RESULTS | `/search` | 0 | 4 | 1 | 0 | 5 |
| SHIPPING POLICY | `/shipping` | 0 | 5 | 2 | 0 | 7 |
| SIDE CART | `/ (drawer)` | 1 | 2 | 0 | 1 | 4 |
| STYLE QUIZ | `/style-quiz` | 2 | 8 | 4 | 0 | 14 |
| SUSTAINABILITY | `/sustainability` | 1 | 5 | 1 | 0 | 7 |
| THANK YOU PAGE | `/thank-you` | 1 | 7 | 1 | 0 | 9 |
| UGC GALLERY | `(component)` | 2 | 15 | 8 | 1 | 26 |
| WHITE GLOVE DELIVERY | `/white-glove-delivery (?)` | 0 | 3 | 2 | 0 | 5 |
| WISHLIST SHARE | `/wishlist-share (404)` | 0 | 2 | 0 | 1 | 3 |

## Live URL probe (page-root existence)

Probed `https://carolina-futons-web.vercel.app/` with `curl -I -L`.

**OK (200):** `/`, `/about`, `/blog`, `/cart`, `/checkout`, `/community-gallery`, `/compare`, `/contact`, `/dashboard`, `/faq`, `/products/canby`, `/products/cody-futon-frame`, `/referral`, `/returns`, `/reviews`, `/room-planner`, `/search`, `/shipping`, `/shop`, `/shop/all`, `/shop/futon-frames`, `/shop/mattresses`, `/style-quiz`, `/sustainability`, `/swatch-request`, `/thank-you`, `/warranty`

**Missing (404 — page-level gaps):** `/fabric-swatches`, `/price-match-guarantee`, `/sign-in`, `/wishlist`, `/wishlist-share`

> Page-level 404s are likely the most actionable items in this audit — they're features the hookup guide enumerates but cfw never built routes for.

## P0/P1 missing — commerce-critical pages

Features in CART, CHECKOUT, SIDE CART, PDP, HOME, MASTER, CATEGORY where the static match found no cfw component or data-slot. Verify each by hand before treating as a real gap.

| Page | Feature |
| --- | --- |
| HOME PAGE | SEO / Decorative |
| MASTER PAGE | Accessibility |
| MASTER PAGE | Navigation |
| PRODUCT PAGE | Collection Card Builder (NEW v0.9.0+) |
| CATEGORY PAGE | Filters |
| CART PAGE | Tier Discount |
| CHECKOUT | Payment Methods ⚠️ REPEATER |
| CHECKOUT | Protection Plans ⚠️ NESTED REPEATER |

## P2/P3 missing — non-critical pages

33 feature(s) on non-commerce pages with no static match. Most likely candidates for honest gaps:

| Page | Feature |
| --- | --- |
| SEARCH RESULTS | Filters |
| MEMBER PAGE | Rewards ⚠️ REPEATER |
| MEMBER PAGE | Streak Display (NEW — CF-64k) |
| MEMBER PAGE | Streak Display (NEW — Phase 2 Streak Multipliers) |
| MEMBER PAGE | CF+ Upgrade Prompt Modal (NEW v1.2.0+ — PR #666 / CF-llrd) |
| CONTACT | Hours ⚠️ REPEATER |
| ABOUT | Repeaters |
| FAQ | FAQ Accordion ⚠️ REPEATER |
| THANK YOU PAGE | Brenda's Message |
| WHITE GLOVE DELIVERY | Calendar (Date Picker) ⚠️ REPEATER |
| WHITE GLOVE DELIVERY | Window Selector ⚠️ REPEATER |
| ADMIN A/B TESTS | Experiments ⚠️ REPEATER |
| SHIPPING POLICY | Calculator |
| SHIPPING POLICY | Scheduling |
| COMPARE PAGE | URL Params / Fetch |
| SUSTAINABILITY | Certifications ⚠️ REPEATER |
| PRICE MATCH GUARANTEE | My Requests ⚠️ REPEATER |
| PRICE MATCH GUARANTEE | Policy Display ⚠️ REPEATERS |
| BLOG | Author Bio |
| COMMUNITY GALLERY | Filters ⚠️ REPEATER |
| REFERRAL PAGE | How It Works ⚠️ REPEATER |
| UGC GALLERY | Success |
| UGC GALLERY | Breadcrumb ⚠️ REPEATER |
| UGC GALLERY | Spoke Cards ⚠️ REPEATER |
| UGC GALLERY | Internal Links ⚠️ REPEATER |
| UGC GALLERY | Related Clusters ⚠️ REPEATER |
| UGC GALLERY | Denominations ⚠️ REPEATER |
| UGC GALLERY | Commerce |
| UGC GALLERY | Page-level Elements |
| STYLE QUIZ | Future Wiring — Leaderboard Page (`/leaderboard`) |
| STYLE QUIZ | Future Wiring — Challenge of the Week (Homepage) |
| STYLE QUIZ | Phase 7 Shipped (2026-04-13) |
| STYLE QUIZ | Phase 8 Shipped (2026-04-13) |

## Full feature matrix

### ABOUT — `/about`

_0 present / 2 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | Repeaters | — |
| ~ | Showroom Info | ~component:ProductInfoModal, ~component:ProductInfoModal.test, ~slot:pdp-loading-info |
| ~ | Visit CTA | ~component:VisitPage.test |

### ADMIN A/B TESTS — `(admin)`

_0 present / 2 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Detail Panel | ~component:GuideDetailPage.test, ~slot:mega-menu-panel |
| ✗ | Experiments ⚠️ REPEATER | — |
| ~ | Summary Stats | ~component:StatsStrip, ~component:StatsStrip.test, ~slot:bundle-price-summary |

### ADMIN DELIVERY CALENDAR — `(admin)`

_0 present / 2 partial / 0 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Appointment Calendar ⚠️ REPEATER | ~component:AppointmentForm, ~component:AppointmentForm.test |
| ~ | Block Date Form | ~component:AddressCheckForm, ~component:AppointmentForm, ~slot:getting-it-home-form |

### BLOG — `/blog`

_1 present / 9 partial / 1 missing / 1 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | Author Bio | — |
| ~ | Content | ~slot:card-content, ~slot:care-guide-content |
| ~ | Featured Post | ~component:FeaturedProducts, ~component:FeaturedProducts.test, ~slot:blog-post-body |
| ~ | Filter Chips ⚠️ REPEATER | ~component:FilterFirst, ~component:FilterFirst.test |
| ~ | Header + Filter | ~component:FilterFirst, ~component:FilterFirst.test, ~slot:blog-post-header |
| ~ | Newsletter Capture | ~component:EmailCapturePopup, ~component:EmailCapturePopup.test, ~slot:home-newsletter-section |
| ~ | Newsletter Capture | ~component:EmailCapturePopup, ~component:EmailCapturePopup.test, ~slot:home-newsletter-section |
| ~ | Post List ⚠️ REPEATER | ~slot:blog-post-body, ~slot:blog-post-header |
| ~ | Related Posts ⚠️ REPEATER | ~component:static-blog-posts.test, ~component:static-posts |
| ~ | Related Products ⚠️ REPEATER | ~component:FeaturedProducts, ~component:FeaturedProducts.test, ~slot:search-products |
| ? | SEO | — |
| ✓ | Share Buttons | component:PdpShareButtons, component:PdpShareButtons.test, slot:pdp-share-buttons |

### CART PAGE — `/cart`

_3 present / 7 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Cart Data | ~component:AddToCartButton, ~component:AddToCartButton.test, ~slot:cart-illustration |
| ~ | Cart Items ⚠️ REPEATER | ~component:AddToCartButton, ~component:AddToCartButton.test, ~slot:cart-illustration |
| ~ | Cart Totals | ~component:AddToCartButton, ~component:AddToCartButton.test, ~slot:cart-illustration |
| ✓ | Cross-Sell ⚠️ REPEATER | component:PdpCrossSell, component:PdpCrossSell.test, component:cross-sell |
| ~ | Delivery | ~component:api-delivery-zone.test, ~component:delivery-zone-types |
| ✓ | Empty Cart | component:EmptyCartIllustration, component:EmptyCartIllustration.test, slot:empty-cart-illustration |
| ~ | Financing | ~component:PdpFinancing, ~component:PdpFinancing.test |
| ✓ | Recently Viewed ⚠️ REPEATER | component:PdpRecentlyViewed, component:PdpRecentlyViewed.test, component:RecentlyViewedStrip |
| ~ | Shipping Progress | ~component:PdpShippingEstimate, ~component:PdpShippingEstimate.test, ~slot:pdp-shipping-estimate |
| ✗ | Tier Discount | — |
| ~ | You Might Also Like ⚠️ REPEATER | ~component:PdpAlsoBought, ~component:also-bought, ~slot:pdp-also-bought |

### CATEGORY PAGE — `/shop/<slug>`

_2 present / 6 partial / 1 missing / 1 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Comparison Tray (NEW v1.2.0+ — PR #667 / CF-r0dr) — REPLACES Compare Bar | ~component:AddToCompareButton, ~component:AddToCompareButton.test, ~slot:compare-column-head |
| ~ | Empty States | ~component:EmptyCartIllustration, ~component:EmptyCartIllustration.test, ~slot:compare-empty |
| ✗ | Filters | — |
| ~ | Hero / Breadcrumb | ~component:BearHero, ~component:CabinHero, ~slot:bear-hero |
| ~ | Mobile Filter Drawer | ~component:CartDrawer, ~component:CartDrawer.test |
| ~ | Product Grid ⚠️ REPEATER | ~component:AdGrid, ~component:MarugameGrid, ~slot:ad-grid |
| ✓ | Quick View Modal | component:QuickViewButton, component:QuickViewModal, component:QuickViewModal.test |
| ✓ | Recently Viewed | component:PdpRecentlyViewed, component:PdpRecentlyViewed.test, component:RecentlyViewedStrip |
| ? | SEO | — |
| ~ | Swatch Filter (NEW v1.2.0+ — PR #670 / CF-wigv) | ~component:FilterFirst, ~component:FilterFirst.test, ~slot:product-card-swatch-row |

### CHECKOUT — `/checkout`

_0 present / 11 partial / 2 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Address Validation | ~component:AddressCheckForm |
| ~ | Afterpay / Financing | ~component:PdpFinancing, ~component:PdpFinancing.test |
| ~ | Checkout Summary | ~component:checkout, ~component:checkout-action.test, ~slot:bundle-price-summary |
| ~ | Delivery Estimate | ~component:PdpShippingEstimate, ~component:PdpShippingEstimate.test, ~slot:pdp-shipping-estimate |
| ~ | Express Checkout | ~component:checkout, ~component:checkout-action.test |
| ~ | Order Notes | ~component:OrderHistoryList, ~component:OrderHistoryList.test, ~slot:order-history-card |
| ~ | Order Summary Sidebar ⚠️ REPEATER | ~component:OrderHistoryList, ~component:OrderHistoryList.test, ~slot:bundle-price-summary |
| ✗ | Payment Methods ⚠️ REPEATER | — |
| ~ | Progress ⚠️ REPEATER | ~component:ReadingProgress, ~component:RouteProgressBar, ~slot:route-progress-bar |
| ✗ | Protection Plans ⚠️ NESTED REPEATER | — |
| ~ | Shipping Options ⚠️ REPEATER | ~component:PdpShippingEstimate, ~component:PdpShippingEstimate.test, ~slot:pdp-shipping-estimate |
| ~ | Store Credit | ~component:newsletter-store, ~component:newsletter-store.test |
| ~ | Trust Signals ⚠️ REPEATER | ~component:TrustBar, ~component:TrustBar.test, ~slot:trust-bar |

### COMMUNITY GALLERY — `/community-gallery`

_0 present / 3 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | Filters ⚠️ REPEATER | — |
| ~ | Gallery Grid ⚠️ REPEATER | ~component:AdGrid, ~component:MarugameGrid, ~slot:ad-grid |
| ~ | Lightbox | ~component:PdpImageLightbox, ~component:PdpImageLightbox.test, ~slot:pdp-image-lightbox |
| ~ | State | ~component:appointment-state, ~component:cart-state |

### COMPARE PAGE — `/compare`

_0 present / 3 partial / 1 missing / 1 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Attributes Table ⚠️ REPEATER | ~component:CompareTable, ~slot:compare-table |
| ~ | Column Rendering ⚠️ REPEATER | ~slot:compare-column-head |
| ~ | Mobile & Reset | ~component:HeaderMobileMenu, ~component:HeaderMobileMenu.test |
| ? | SEO | — |
| ✗ | URL Params / Fetch | — |

### CONTACT — `/contact`

_1 present / 4 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Appointment ⚠️ FORM | ~component:AppointmentForm, ~component:AppointmentForm.test |
| ~ | Business Info | ~component:ProductInfoModal, ~component:ProductInfoModal.test, ~slot:pdp-loading-info |
| ✓ | Contact Form | component:ContactForm, component:ContactForm.test, ~component:AddressCheckForm |
| ✗ | Hours ⚠️ REPEATER | — |
| ~ | Schema | ~component:contact-schema, ~component:contact-schema.test |
| ~ | Social Proof ⚠️ REPEATER | ~component:SocialFeeds, ~component:social-embeds, ~slot:social-feeds |

### FABRIC SWATCHES — `/fabric-swatches (404)`

_2 present / 2 partial / 0 missing / 1 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Filter Controls | ~component:FilterFirst, ~component:FilterFirst.test |
| ✓ | Request Form | component:SwatchRequestForm, ~component:AddressCheckForm, ~component:AppointmentForm |
| ? | SEO | — |
| ~ | Selection Tray ⚠️ REPEATER | ~component:variant-selection, ~component:variant-selection.test |
| ✓ | Swatch Grid ⚠️ REPEATER | component:VariantSwatchGrid, component:VariantSwatchGrid.test, slot:variant-swatch-grid |

### FAQ — `/faq`

_0 present / 2 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Category Filters ⚠️ REPEATER | ~component:CategoryCardImage, ~component:FutonsCategory, ~slot:category-card |
| ~ | Contact CTA | ~component:ContactForm, ~component:ContactForm.test |
| ✗ | FAQ Accordion ⚠️ REPEATER | — |

### FULLSCREEN / PRODUCT VIDEOS — `(modal)`

_0 present / 2 partial / 0 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Category Filters ⚠️ REPEATER | ~component:CategoryCardImage, ~component:FutonsCategory, ~slot:category-card |
| ~ | Video Grid ⚠️ REPEATER | ~component:AdGrid, ~component:MarugameGrid, ~slot:ad-grid |

### HOME PAGE — `/`

_8 present / 8 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Blog Teasers (CF-iix7) | component:BlogTeasers, component:BlogTeasers.test, slot:blog-teasers |
| ~ | Category Cards ⚠️ REPEATER | ~component:CategoryCardImage, ~component:FutonsCategory, ~slot:category-card |
| ✓ | Continue Shopping (NEW v1.2.0+ — PR #665 / CF-ku3x) ⚠️ REPEATER | component:ContinueShoppingStrip, component:ContinueShoppingStrip.test, slot:continue-shopping-row |
| ✓ | Featured Products ⚠️ REPEATER | component:FeaturedProducts, component:FeaturedProducts.test, component:featured-products-data.test |
| ~ | Gift Card Section (PR #533 — CF-mwpw) | ~component:GiftCardPicker, ~component:GiftCardPicker.test, ~slot:gift-card-promo |
| ~ | Hero Section | ~component:BearHero, ~component:CabinHero, ~slot:bear-hero |
| ~ | Newsletter | ~component:HomeNewsletterSection, ~component:HomeNewsletterSection.test, ~slot:home-newsletter-section |
| ~ | Quiz CTA | ~component:FutonSommelierQuiz, ~component:HomeQuizCta, ~slot:futon-sommelier-quiz |
| ✓ | Recently Viewed | component:PdpRecentlyViewed, component:PdpRecentlyViewed.test, component:RecentlyViewedStrip |
| ✗ | SEO / Decorative | — |
| ✓ | Sale Products ⚠️ REPEATER | component:products-on-sale.test, ~component:FeaturedProducts, ~component:FeaturedProducts.test |
| ~ | Smooth Scroll Triggers | ~component:Header.scrollShrink.test, ~component:ScrollStory, ~slot:scroll-story |
| ✓ | Social Feeds (CF-iix7) | component:SocialFeeds, slot:social-feeds, ~component:social-embeds |
| ✓ | Swatch Promo | component:HomeSwatchPromo, component:SwatchPromoSection, slot:swatch-promo |
| ~ | Testimonials ⚠️ REPEATER | ~component:TestimonialsStrip, ~component:TestimonialsStrip.test |
| ~ | Trust Bar ✅ SECTION RENAMED | ~component:TrustBar, ~component:TrustBar.test, ~slot:trust-bar |
| ✓ | Video Showcase | component:VideoShowcaseStrip, component:VideoShowcaseStrip.test, slot:video-showcase-strip |

### MASTER PAGE — `/ (global)`

_3 present / 11 partial / 2 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | Accessibility | — |
| ~ | Announcement Bar | ~component:AnnouncementBar, ~component:AnnouncementBar.test, ~slot:announcement-bar |
| ~ | Breadcrumbs | ~component:Breadcrumbs, ~component:Breadcrumbs.test |
| ~ | Cart (global) | ~component:AddToCartButton, ~component:AddToCartButton.test, ~slot:cart-illustration |
| ~ | Exit Intent Popup | ~component:EmailCapturePopup, ~component:EmailCapturePopup.test |
| ~ | Footer Accordions (mobile) | ~component:Footer, ~component:Footer.animation.test, ~slot:card-footer |
| ~ | Footer ⚠️ REPEATERS | ~component:Footer, ~component:Footer.animation.test, ~slot:card-footer |
| ~ | Header Shipping Progress | ~component:Header, ~component:Header.scrollShrink.test, ~slot:blog-post-header |
| ✓ | Living Sky (Phase 7 + Phase 8 COMPLETE ✅) | component:LivingSky, component:LivingSkyClient, component:LivingSkyClient-dark.test |
| ~ | Mobile Drawer | ~component:CartDrawer, ~component:CartDrawer.test |
| ✗ | Navigation | — |
| ~ | Newsletter Modal | ~component:HomeNewsletterSection, ~component:HomeNewsletterSection.test, ~slot:home-newsletter-section |
| ✓ | PWA Install Banner | component:PwaInstallBanner, component:PwaInstallBanner.test, slot:pwa-install-banner |
| ~ | Promo Lightbox ⚠️ REPEATER | ~component:GiftCardPromo, ~component:HomeSwatchPromo, ~slot:gift-card-promo |
| ~ | Schema | ~component:contact-schema, ~component:contact-schema.test |
| ✓ | Sticky Nav / Back to Top | component:BackToTop, component:BackToTop.test, slot:back-to-top |

### MEMBER PAGE — `/dashboard`

_2 present / 6 partial / 4 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Account / Address / Prefs | ~component:AccountPage.test, ~component:AccountSignIn |
| ✗ | CF+ Upgrade Prompt Modal (NEW v1.2.0+ — PR #666 / CF-llrd) | — |
| ✓ | Daily Spin Wheel (NEW — CF-spin-wheel Phase 1) | component:SpinWheel, slot:spin-wheel, ~component:ProductSpinViewer |
| ~ | Dashboard | ~component:DashboardShell, ~component:DashboardShell.test, ~slot:dashboard-orders |
| ~ | Loyalty ⚠️ REPEATER | ~component:loyalty |
| ✓ | Order History ⚠️ REPEATER | component:OrderHistoryList, component:OrderHistoryList.test, slot:order-history-card |
| ~ | Quick Links | ~component:QuickViewButton, ~component:QuickViewModal, ~slot:quick-view-button |
| ~ | Returns Portal (`ReturnsPortal.js`) | ~component:ReturnsPage.test |
| ✗ | Rewards ⚠️ REPEATER | — |
| ✗ | Streak Display (NEW — CF-64k) | — |
| ✗ | Streak Display (NEW — Phase 2 Streak Multipliers) | — |
| ~ | Wishlist ⚠️ REPEATER | ~component:PdpWishlistButton, ~component:PdpWishlistButton.test, ~slot:dashboard-wishlist |

### PRICE MATCH GUARANTEE — `/price-match-guarantee (404)`

_1 present / 3 partial / 2 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | My Requests ⚠️ REPEATER | — |
| ~ | Page Header | ~component:Header, ~component:Header.scrollShrink.test, ~slot:blog-post-header |
| ✗ | Policy Display ⚠️ REPEATERS | — |
| ✓ | Request Form | component:SwatchRequestForm, ~component:AddressCheckForm, ~component:AppointmentForm |
| ~ | Savings Preview | ~slot:swatch-preview |
| ~ | Success State | ~component:appointment-state, ~component:cart-state |

### PRODUCT PAGE — `/products/<slug>`

_8 present / 22 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | 360° Spin Viewer (`ProductSpinViewer.js`) | component:ProductSpinViewer, component:ProductSpinViewer.test, ~component:ArModelViewer |
| ✓ | Also Bought ⚠️ REPEATER | component:PdpAlsoBought, component:also-bought, slot:pdp-also-bought |
| ~ | BNPL Calculator Widget (CF-zpf — in progress) | ~component:TurnstileWidget |
| ~ | BNPL Widget (CF-nqb5.1 — PR #936 ✅ MERGED 2026-03-29) | ~component:TurnstileWidget |
| ~ | CF+ Upgrade Prompt Modal — Product Page Instance (NEW v1.2.0+ — PR #666 / CF-llrd) | ~component:PdpProductBadges, ~component:PdpProductVideo, ~slot:pdp-product-video |
| ✗ | Collection Card Builder (NEW v0.9.0+) | — |
| ~ | Collection Products ⚠️ REPEATER | ~component:FeaturedProducts, ~component:FeaturedProducts.test, ~slot:search-products |
| ~ | Delivery Estimator (NEW v1.1.0+ — PR #649) | ~component:api-delivery-zone.test, ~component:delivery-zone-types |
| ~ | Empty State Builder (NEW v0.9.0+) | ~component:EmptyCartIllustration, ~component:EmptyCartIllustration.test, ~slot:compare-empty |
| ~ | Financing (v0.9.0+ — `ProductFinancing.js`) | ~component:PdpFinancing, ~component:PdpFinancing.test |
| ~ | Gallery Zoom Lightbox (v1.2.0+ — `GalleryZoomLightbox.js`) | ~component:PdpGallery, ~component:PdpGallery.test, ~slot:pdp-gallery |
| ~ | Gift as a Gift CTA (PR #529 — CF-9fv2) | ~component:GiftCardPicker, ~component:GiftCardPicker.test, ~slot:gift-card-promo |
| ~ | Live Inventory + Low Stock (Sprint 5 — `LiveInventory.js`) | ~component:PdpStockBadge, ~component:PdpStockBadge.test |
| ~ | Live Inventory + Low Stock (Sprint 5 — `LiveInventory.js`) :: Product Page Elements (added alongside existing product page) | ~component:PdpProductBadges, ~component:PdpProductVideo, ~slot:pdp-product-video |
| ~ | Price Lock Widget (NEW — CF-tjf0, PR #935) | ~component:TurnstileWidget, ~component:plp-price, ~slot:bundle-price-summary |
| ~ | Product Badge (NEW v1.2.0+ — PR #657 / CF-p56i) | ~component:PdpProductBadges, ~component:PdpProductVideo, ~slot:pdp-product-video |
| ✓ | Product Info | component:ProductInfoModal, component:ProductInfoModal.test, slot:product-info-modal |
| ✓ | Product Info Modal — Care Guide + Dimensions (NEW v1.1.0+ — PR #651) | component:ProductInfoModal, component:ProductInfoModal.test, slot:care-guide-content |
| ~ | Product Options / Variant Swatches (NEW v0.9.0+) | ~component:PdpFabricSwatches, ~component:PdpFabricSwatches.test, ~slot:pdp-product-video |
| ~ | Product Q&A Widget (Sprint 5 — `ProductQnA.js`) ✅ MERGED PR #678 | ~component:PdpProductBadges, ~component:PdpProductVideo, ~slot:pdp-product-video |
| ~ | Promo Banner Carousel (NEW v0.9.0+) | ~component:AppDownloadBanner, ~component:AppDownloadBanner.test, ~slot:consent-banner |
| ✓ | Recently Viewed ⚠️ REPEATER | component:PdpRecentlyViewed, component:PdpRecentlyViewed.test, component:RecentlyViewedStrip |
| ~ | Related Products ⚠️ REPEATER | ~component:FeaturedProducts, ~component:FeaturedProducts.test, ~slot:search-products |
| ~ | Reviews & Ratings (NEW v0.9.0+) | ~component:PdpReviews, ~component:PdpReviews.test, ~slot:pdp-reviews |
| ✓ | Share Your Room — UGC Photo Submit (CF-rw9i.1 — PR #938 ✅ MERGED 2026-03-29) | component:PhotoSubmitForm, ~component:DesignARoomPage.test, ~component:DragDropRoomPlanner |
| ~ | Shipping Intelligence Layer (Sprint 5 — `ShippingIntelligence.js`) ✅ MERGED PR #674 | ~component:PdpShippingEstimate, ~component:PdpShippingEstimate.test, ~slot:pdp-shipping-estimate |
| ✓ | Size Guide & Room Fit (NEW v0.9.0+) | component:PdpSizeGuide, component:PdpSizeGuide.test, component:size-guide |
| ~ | Social Story Helpers (NEW v0.9.0+) | ~component:ScrollStory, ~component:ScrollStory.test, ~slot:scroll-story |
| ~ | Stamped.io Reviews (NEW — CF-gxn1) | ~component:PdpProductBadges, ~component:PdpProductVideo, ~slot:pdp-product-video |
| ✓ | Sticky Add-to-Cart Bar (NEW v1.2.0+ — PR #664 / CF-gj26) | component:AddToCartButton, component:AddToCartButton.test, ~component:AddToCompareButton |
| ~ | Video Review Grid (CF-ou66.3 — PR #941 ✅ MERGED 2026-04-04) | ~component:AdGrid, ~component:MarugameGrid, ~slot:ad-grid |

### REFERRAL PAGE — `/referral`

_1 present / 4 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Auth State | ~component:appointment-state, ~component:auth-login-route.test |
| ~ | History ⚠️ REPEATER | ~component:OrderHistoryList, ~component:OrderHistoryList.test, ~slot:order-history-card |
| ✗ | How It Works ⚠️ REPEATER | — |
| ✓ | Share Buttons | component:PdpShareButtons, component:PdpShareButtons.test, slot:pdp-share-buttons |
| ~ | Stats | ~component:StatsStrip, ~component:StatsStrip.test |
| ~ | Your Code/Link | ~component:cf-link |

### ROOM PLANNER — `/room-planner`

_2 present / 6 partial / 0 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Canvas — CF-eqc5.3 (PR #948/949) | component:RoomPlannerCanvas, component:RoomPlannerCanvas.test, ~component:DragDropRoomPlanner |
| ~ | Hero | ~component:BearHero, ~component:CabinHero, ~slot:bear-hero |
| ~ | How-To Steps ⚠️ REPEATER | ~component:steps, ~slot:trade-in-steps |
| ~ | Palette Category ⚠️ REPEATER | ~component:CategoryCardImage, ~component:FutonsCategory, ~slot:category-card |
| ✓ | Product Palette ⚠️ REPEATER | component:ProductPalette, slot:product-palette, ~component:MascotPalette |
| ~ | Room Presets ⚠️ REPEATER | ~component:DesignARoomPage.test, ~component:DragDropRoomPlanner, ~slot:cf-delight-shop-the-room |
| ~ | Room Setup | ~component:DesignARoomPage.test, ~component:DragDropRoomPlanner, ~slot:cf-delight-shop-the-room |
| ~ | Save/Share | ~component:PdpShareButtons, ~component:PdpShareButtons.test, ~slot:pdp-share-buttons |

### SEARCH RESULTS — `/search`

_0 present / 4 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | Filters | — |
| ~ | No Results | ~slot:futon-sommelier-results, ~slot:search-no-results |
| ~ | Results Grid ⚠️ REPEATER | ~component:AdGrid, ~component:MarugameGrid, ~slot:ad-grid |
| ~ | Search Controls | ~component:EmptySearchIllustration, ~component:PLPControls, ~slot:empty-search-illustration |
| ~ | Suggestions ⚠️ REPEATER | ~slot:search-suggestions |

### SHIPPING POLICY — `/shipping`

_0 present / 5 partial / 2 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Assembly Guides ⚠️ REPEATER | ~component:GuidesIndexPage.test, ~component:guides |
| ✗ | Calculator | — |
| ~ | Care Tips ⚠️ REPEATER | ~slot:care-guide-content, ~slot:care-guide-inline |
| ~ | Delivery Methods ⚠️ REPEATER | ~component:api-delivery-zone.test, ~component:delivery-zone-types |
| ~ | Delivery Prep | ~component:api-delivery-zone.test, ~component:delivery-zone-types |
| ✗ | Scheduling | — |
| ~ | Schema | ~component:contact-schema, ~component:contact-schema.test |

### SIDE CART — `/ (drawer)`

_1 present / 2 partial / 0 missing / 1 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Cross-Sell ⚠️ REPEATER | component:PdpCrossSell, component:PdpCrossSell.test, component:cross-sell |
| ? | Items ⚠️ REPEATER | — |
| ~ | Panel | ~slot:mega-menu-panel |
| ~ | Progress Bars | ~component:ReadingProgress, ~component:RouteProgressBar, ~slot:route-progress-bar |

### STYLE QUIZ — `/style-quiz`

_2 present / 8 partial / 4 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | AI Style Consultant (Sprint 5 — `styleConsultant.web.js`) | ~component:StyleQuiz, ~component:StyleQuiz.test |
| ~ | AI Style Consultant (Sprint 5 — `styleConsultant.web.js`) :: AI Results Section (added to existing Style Quiz results area) | ~component:StyleQuiz, ~component:StyleQuiz.test, ~slot:futon-sommelier-results |
| ✓ | Futon Sommelier Elements (shown only if `'sommelierAnswers'` present in session storage) | component:FutonSommelierQuiz, component:futon-sommelier-data, component:futon-sommelier-data.test |
| ✗ | Future Wiring — Challenge of the Week (Homepage) | — |
| ~ | Future Wiring — Gamification Chips (inside `#collectionRepeater` item) | ~component:gamification |
| ✗ | Future Wiring — Leaderboard Page (`/leaderboard`) | — |
| ~ | Options ⚠️ REPEATER | ~component:color-options, ~component:color-options.test |
| ✗ | Phase 7 Shipped (2026-04-13) | — |
| ✗ | Phase 8 Shipped (2026-04-13) | — |
| ✓ | Quiz Result Elements | component:QuizResult, ~component:FutonSommelierQuiz, ~component:HomeQuizCta |
| ~ | Quiz Steps | ~component:FutonSommelierQuiz, ~component:HomeQuizCta, ~slot:futon-sommelier-quiz |
| ~ | Results | ~slot:futon-sommelier-results, ~slot:search-no-results |
| ~ | Results ⚠️ REPEATER | ~slot:futon-sommelier-results, ~slot:search-no-results |
| ~ | ⚠️ New CMS Collections — Stilgar must create | ~component:CreateRegistryForm, ~component:HomeFeaturedCollections, ~slot:create-registry-trigger |

### SUSTAINABILITY — `/sustainability`

_1 present / 5 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Carbon Offset | slot:carbon-offset-section |
| ✗ | Certifications ⚠️ REPEATER | — |
| ~ | Commitment Badges ⚠️ REPEATER | ~component:PdpProductBadges, ~component:product-badges, ~slot:product-badges |
| ~ | Hero | ~component:BearHero, ~component:CabinHero, ~slot:bear-hero |
| ~ | Materials ⚠️ REPEATER | ~slot:materials-repeater |
| ~ | SEO Schema | ~component:contact-schema, ~component:contact-schema.test |
| ~ | Trade-In Program ⚠️ REPEATER | ~slot:trade-in-steps |

### THANK YOU PAGE — `/thank-you`

_1 present / 7 partial / 1 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | Brenda's Message | — |
| ~ | Care / Assembly / Review | ~component:ReviewFilter, ~component:review-stats, ~slot:care-guide-content |
| ~ | Delivery Timeline | ~component:MascotTimeline, ~component:api-delivery-zone.test, ~slot:mascot-timeline |
| ~ | Newsletter | ~component:HomeNewsletterSection, ~component:HomeNewsletterSection.test, ~slot:home-newsletter-section |
| ~ | Order Summary | ~component:OrderHistoryList, ~component:OrderHistoryList.test, ~slot:bundle-price-summary |
| ~ | Post-Purchase ⚠️ REPEATER | ~component:Ga4PurchaseTracker, ~component:Ga4PurchaseTracker.test, ~slot:blog-post-body |
| ~ | Referral | ~component:ReferralDashboard, ~component:ReferralShareBanner |
| ~ | Social Sharing | ~component:SocialFeeds, ~component:social-embeds, ~slot:social-feeds |
| ✓ | White Glove Prompt (NEW — CF-y7lp) | component:PdpWhiteGlove, component:PdpWhiteGlove.test, slot:pdp-white-glove |

### UGC GALLERY — `(component)`

_2 present / 15 partial / 8 missing / 1 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Balance Check | ~component:AddressCheckForm |
| ✗ | Breadcrumb ⚠️ REPEATER | — |
| ~ | Bundle Builder Shipping | ~component:BundleConfigurator, ~component:PdpMattressBundle, ~slot:bundle-configurator |
| ✗ | Commerce | — |
| ~ | Content | ~slot:card-content, ~slot:care-guide-content |
| ~ | Content & SEO | ~slot:card-content, ~slot:care-guide-content |
| ~ | Content Sections ⚠️ REPEATER | ~slot:card-content, ~slot:care-guide-content |
| ✗ | Denominations ⚠️ REPEATER | — |
| ~ | Email Automation | ~component:EmailCapturePopup, ~component:EmailCapturePopup.test |
| ? | FAQ ⚠️ REPEATER | — |
| ~ | Form | ~component:AddressCheckForm, ~component:AppointmentForm, ~slot:getting-it-home-form |
| ~ | Gallery Grid | ~component:AdGrid, ~component:MarugameGrid, ~slot:ad-grid |
| ✗ | Internal Links ⚠️ REPEATER | — |
| ✗ | Page-level Elements | — |
| ~ | ProductShippingProfiles CMS Fields (for reference — edited directly in Wix CMS) | ~component:PdpProductBadges, ~component:PdpProductVideo, ~slot:pdp-product-video |
| ~ | Purchase Form | ~component:AddressCheckForm, ~component:AppointmentForm, ~slot:getting-it-home-form |
| ✓ | Registry List & Create Form | component:CreateRegistryForm, component:RegistryCreateForm, slot:create-registry-trigger |
| ✗ | Related Clusters ⚠️ REPEATER | — |
| ~ | Social Media Automation | ~component:SocialFeeds, ~component:social-embeds, ~slot:pdp-media |
| ✗ | Spoke Cards ⚠️ REPEATER | — |
| ~ | State | ~component:appointment-state, ~component:cart-state |
| ~ | Stats | ~component:StatsStrip, ~component:StatsStrip.test |
| ✓ | Submission Form | component:SurveyForm, component:SurveyForm.test, slot:survey-form |
| ~ | Submit | ~component:PhotoSubmitForm |
| ✗ | Success | — |
| ~ | Wix Dashboard Integrations (tracked 2026-03-21) | ~component:DashboardShell, ~component:DashboardShell.test, ~slot:dashboard-orders |

### WHITE GLOVE DELIVERY — `/white-glove-delivery (?)`

_0 present / 3 partial / 2 missing / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | Calendar (Date Picker) ⚠️ REPEATER | — |
| ~ | Confirmation | ~component:order-confirmation-page.test |
| ~ | Existing Appointment | ~component:AppointmentForm, ~component:AppointmentForm.test |
| ~ | State Sections (mutually exclusive — one shown at a time) | ~component:appointment-state, ~component:cart-state |
| ✗ | Window Selector ⚠️ REPEATER | — |

### WISHLIST SHARE — `/wishlist-share (404)`

_0 present / 2 partial / 0 missing / 1 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Product Cards ⚠️ REPEATER | ~component:PdpProductBadges, ~component:PdpProductVideo, ~slot:pdp-product-video |
| ? | SEO | — |
| ~ | Token Resolution | ~component:result-token, ~component:share-token |

## Forward-drift list (cfw-only, not in guide)

This audit did not yet enumerate cfw features absent from the hookup guide. Follow-up: scan `src/components` and `src/app` page-by-page for components/data-slots whose name has no token overlap with any guide feature, and flag for guide backfill.

## Acceptance status

- [x] `cfw-parity-audit-2026-05-04.md` committed
- [x] Table covers 255 features with present/partial/missing/unknown
- [x] List of P0/P1 missing features (8)
- [x] List of P2/P3 missing features (33)
- [ ] Forward-drift list — deferred to follow-up bead (see closing section)

## Next steps (for melania to schedule)

1. **Runtime probe** — for each P0/P1 missing feature, fetch the rendered cfw page and grep the HTML for the feature's keywords / expected data-slot. The static audit cannot distinguish renamed components from genuinely-absent ones.
2. **404 page triage** — `/wishlist`, `/wishlist-share`, `/price-match-guarantee`, `/fabric-swatches`, `/sign-in` exist in the guide but have no cfw route. Confirm whether each is intentionally deprecated, replaced by a different URL, or actually missing.
3. **Forward-drift sweep** — list cfw components/routes that the guide does not mention, so the guide can be updated before Wix Editor retirement.
4. **Refine matcher** — the `partial` bucket (~2/3 of features) is too noisy; a curated component-alias map (`ProductCard`→`featuredProduct*`) would tighten this materially.
