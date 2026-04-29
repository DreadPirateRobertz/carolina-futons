# cfw vs Wix Editor Parity Audit

**Generated**: 2026-04-28  
**Bead**: cf-69fx  
**Source**: EDITOR-HOOKUP-GUIDE.md + EDITOR_HOOKUP_GUIDE.html  
**Cross-check**: carolinafutons.com READ-ONLY + cfw src/  

**Status key**: PRESENT ✅ | PARTIAL ⚠️ | MISSING ❌

---

## Summary

| Category | Present | Partial | Missing |
|---|---|---|---|
| PDP Features | 9 | 5 | 6 |
| Home Page Sections | 6 | 1 | 9 |
| Sitewide / Layout | 5 | 2 | 3 |
| Standalone Pages | 14 | 3 | 11 |
| **TOTAL** | **34** | **11** | **29** |

**Top-10 missing filed as beads** — see §Beads Filed below.

---

## PDP (Product Detail Page) Features

| # | Feature | cfw Status | Notes |
|---|---|---|---|
| 1 | Fabric swatch picker | ⚠️ PARTIAL | `PdpFabricSwatches.tsx` renders hex color dots + family filter + "Order free swatches" link. **Missing: actual swatch photo images.** Wix side renders Crypton catalog photos (700+ swatches). cfw shows `backgroundColor: swatch.colorHex` circles only — no `<Image src={swatch.imageUrl}>`. |
| 2 | Free fabric swatch request | ✅ PRESENT | `/swatch-request` page + `SwatchRequestForm` + server action. Up to 5 swatches, pre-fills product from URL param. |
| 3 | Variant picker / color swatches | ✅ PRESENT | `VariantPicker.tsx` + `VariantSwatchGrid.tsx` — swatch dots for color options, dropdown for other options, price + image update on selection. |
| 4 | Product gallery + zoom lightbox | ✅ PRESENT | `PdpGallery.tsx` (multi-image strip) + `PdpImageLightbox.tsx` (full-screen zoom). |
| 5 | Sticky add-to-cart bar | ✅ PRESENT | `PdpStickyCta.tsx` — IntersectionObserver on primary CTA, slides in when primary scrolls out of view. Mirrors stock/disabled state. |
| 6 | Stock badge | ✅ PRESENT | `PdpStockBadge.tsx` — In Stock / Low Stock / Out of Stock display. Stock from Wix product data. |
| 7 | White Glove delivery learn-more modal | ✅ PRESENT | `PdpWhiteGlove.tsx` — threshold-based upsell with accessible dialog. |
| 8 | Delivery estimator (ZIP-based) | ✅ PRESENT | `PdpShippingEstimate.tsx` — ZIP → estimated delivery window. |
| 9 | Reviews & ratings | ✅ PRESENT | `PdpReviews.tsx` + `review-stats` lib + JSON-LD structured data. |
| 10 | Recently viewed (PDP) | ✅ PRESENT | `PdpRecentlyViewed.tsx` — sessionStorage LRU, strips on PDP. |
| 11 | Cross-sell / related products | ⚠️ PARTIAL | `PdpCrossSell.tsx` — cross-sell by category. Missing: "Also Bought / FBT" repeater (distinct from related — Wix has separate `alsoBoughtRepeater`). |
| 12 | Share buttons | ✅ PRESENT | `PdpShareButtons.tsx` — Web Share API + clipboard fallback. |
| 13 | Wishlist button | ✅ PRESENT | `PdpWishlistButton.tsx` on PDP. Member-gated save to wishlist. |
| 14 | 360° Spin Viewer | ❌ MISSING | `ProductSpinViewer.tsx` component built and tested but **not imported/rendered** in `products/[slug]/page.tsx`. No spin image set is fetched from Wix. Wix has `viewer360Section` + `viewer360Embed` wired via `initProduct360Viewer`. |
| 15 | Financing / BNPL section | ❌ MISSING | No `PdpFinancing` component. No Afterpay / Affirm messaging anywhere on PDP. Wix has `ProductFinancing.js` with term pills, monthly calc, Afterpay 4-payment breakdown, and modal. |
| 16 | Size Guide + Room Fit checker | ❌ MISSING | No `SizeGuide` / `ProductSizeGuide` component. No room-fit inputs on PDP. Wix has `ProductSizeGuide.js` with dimension grid, imperial/metric toggle, SVG diagrams, and room-fit checker (W × D inputs → clearance verdict). |
| 17 | Product Info Modal (care guide + dimensions) | ❌ MISSING | No `ProductInfoModal` component. Wix has `careGuideBtn`, `dimensionsModal`, `checkRoomFitBtn`, `fitResult`. |
| 18 | Back-in-stock notify me | ❌ MISSING | No `notifyMeSection` / `notifyMeInput` / `notifyMeBtn` on PDP. When stock is 0 cfw shows "Out of stock" badge only. Wix wires `notifyMeSection` + `inventoryService.web.js`. |
| 19 | CMS-driven product badge | ⚠️ PARTIAL | `PdpStockBadge.tsx` covers stock-state badges. Missing: CMS `ProductBadges` collection — "New", "Bestseller", "CF+ Exclusive", "Sale" from Wix `badgeService.web.js`. |
| 20 | Compare — Add from PDP/PLP | ⚠️ PARTIAL | `/compare` page with `CompareTable` exists and works (URL-param driven). **Missing: "Add to Compare" button on PDP or PLP product cards.** Users cannot discover the compare page through the UI. |

---

## Home Page Sections

| # | Feature | cfw Status | Notes |
|---|---|---|---|
| 21 | Hero section | ✅ PRESENT | `LivingHero` (animated Living Sky, time-of-day cycling) + headline + CTA buttons. |
| 22 | Product browser (FilterFirst) | ✅ PRESENT | Theme-D `FilterFirst` replaces Wix's separate Featured / Sale / Category repeaters with a single tab+grid UI. |
| 23 | Featured Products section | ⚠️ PARTIAL | Covered by FilterFirst but no dedicated "Featured" section with quick-view modal + "Available in X colors" text + swatch dots — the Wix featured repeater is richer per-card. |
| 24 | Sale Products section | ❌ MISSING | No dedicated sale strip on home. Wix has `saleRepeater` (auto-collapsed when no sales). FilterFirst does not surface a sale-only strip. |
| 25 | Category cards | ✅ PRESENT | FilterFirst tabs serve as category nav; individual category images come from collection data. |
| 26 | Quiz CTA section | ❌ MISSING | No `quizCTASection` on home. Wix: "Find Your Perfect Futon" section → `/style-quiz`. The style-quiz page exists at cfw but has no home entry point. |
| 27 | Swatch Promo section | ❌ MISSING | No `swatchPromoSection` on home. Wix: heading + CTA button → swatch request. |
| 28 | Blog teasers section | ❌ MISSING | No blog teasers on home. Wix: `HomeBlogTeasers.js` injects 3 recent posts via HtmlComponent. |
| 29 | Social feeds (Instagram / TikTok / Pinterest) | ❌ MISSING | No social feed embeds on home. Wix: `SocialFeedEmbed.js` → 3 HtmlComponents. |
| 30 | Video showcase section | ❌ MISSING | `/videos` page exists but no video section on home. Wix: `videoShowcaseSection` with 3 thumbnails + "View All" CTA. |
| 31 | Continue Shopping strip | ❌ MISSING | No `continueShoppingSection` on home. Wix: sessionStorage LRU, shows last 1–6 browsed products. |
| 32 | Recently Viewed (home) | ❌ MISSING | `PdpRecentlyViewed` exists on PDP, not on home. Wix has a home `recentSection`. |
| 33 | Newsletter section (home inline) | ❌ MISSING | `EmailCapturePopup` (exit-intent) + footer `NewsletterSignup` present. No inline newsletter section on home page canvas. Wix has `newsletterSection` on home. |
| 34 | Gift Card CTA section | ❌ MISSING | No gift card promo section on home. Wix has `giftCardSection` → `/gift-cards`. |
| 35 | Trust bar | ✅ PRESENT | `TrustBar.tsx` wired to home. |
| 36 | Testimonials | ✅ PRESENT | `TestimonialsStrip.tsx` wired to home. |
| 37 | Email capture / Exit intent popup | ✅ PRESENT | `EmailCapturePopup.tsx` — fires on first home visit, 24h suppression. |
| 38 | Stats strip | ✅ PRESENT | `StatsStrip.tsx` — social proof numbers. |

---

## Sitewide / Layout Features

| # | Feature | cfw Status | Notes |
|---|---|---|---|
| 39 | Announcement bar | ✅ PRESENT | `AnnouncementBar.tsx` in Header. Static copy ("Free white-glove delivery on orders over $1,500"). Phase 3: CMS-driven. |
| 40 | Desktop + mobile navigation | ✅ PRESENT | `Header.tsx` with primary nav + sub-nav + `HeaderMobileMenu.tsx`. |
| 41 | Mega-menu (hover panel with product images) | ❌ MISSING | Header has flat nav links. Wix has `megaMenuPanel` with category images on hover. |
| 42 | Promo Lightbox (full featured) | ⚠️ PARTIAL | `SaleLightbox.tsx` has countdown + CTA link + dismiss. **Missing**: email capture inside lightbox, promo code display + copy button, featured products repeater inside lightbox. Wix `promoLightbox` has all of these. |
| 43 | Back to top | ✅ PRESENT | `BackToTop.tsx` wired globally. |
| 44 | PWA Install Banner | ❌ MISSING | No `installBanner` component. Wix has `PWA Install Banner` in masterPage. |
| 45 | Cart + side-cart drawer | ✅ PRESENT | `CartDrawer.tsx` + `CartProvider` + `CartTrigger`. |
| 46 | Footer newsletter | ✅ PRESENT | `NewsletterSignup.tsx` wired into `Footer.tsx`. |
| 47 | Analytics tags (GA4, Meta, TikTok, Pinterest) | ✅ PRESENT | All 4 wired in `layout.tsx` behind consent. |

---

## Standalone Pages

| # | Page | cfw Status | Notes |
|---|---|---|---|
| 48 | Style Quiz | ✅ PRESENT | `/style-quiz` with multi-step quiz, email capture, inline results + product recommendations. |
| 49 | Style Quiz Result (standalone / shareable) | ⚠️ PARTIAL | Results render inline in quiz flow (phase change). Wix has a separate `StyleQuizResult.js` page at its own URL with full Futon Sommelier overlay. No standalone shareable result URL on cfw. |
| 50 | Blog | ✅ PRESENT | `/blog/[slug]` with full post rendering. |
| 51 | Community Gallery (view) | ✅ PRESENT | `/community-gallery` — masonry photo grid from Wix Data. |
| 52 | Community Gallery (submit photo / UGC) | ❌ MISSING | No photo upload / submission form on community gallery page or anywhere. Wix has `/submit-photo-review` page + `UGC Gallery.js` with `submitSection`. |
| 53 | Compare page | ⚠️ PARTIAL | `/compare` page + `CompareTable` works. But compare is URL-only — no "Add to Compare" button on PDP or product cards surfaces it. |
| 54 | Wishlist (member) + share | ✅ PRESENT | `/wishlist/[token]` share view + member dashboard `/dashboard/wishlist`. |
| 55 | Design a Room / Room Planner | ⚠️ PARTIAL | `/design-a-room` with `RoomPlannerCanvas` (futon footprint on grid). Wix has full `/room-planner` with drag-drop room setup, presets, product palette, and canvas save/share. cfw's is a simpler consultation/calculator page. |
| 56 | Guides / Topic Cluster | ✅ PRESENT | `/guides/[slug]` topic cluster pages. |
| 57 | Videos | ✅ PRESENT | `/videos` page. |
| 58 | Search | ✅ PRESENT | `/search` page. |
| 59 | Warranty Registration | ✅ PRESENT | `/warranty` page. |
| 60 | Contact | ✅ PRESENT | `/contact` page. |
| 61 | About / Our Story | ✅ PRESENT | `/about` + `/our-story`. |
| 62 | Visit | ✅ PRESENT | `/visit` showroom page. |
| 63 | Reviews | ✅ PRESENT | `/reviews` page. |
| 64 | Sustainability | ✅ PRESENT | `/sustainability` page. |
| 65 | FAQ | ✅ PRESENT | `/faq` page. |
| 66 | Press | ✅ PRESENT | `/press` page. |
| 67 | Terms / Privacy | ✅ PRESENT | `/terms` + `/privacy`. |
| 68 | Checkout | ✅ PRESENT | `/checkout`. |
| 69 | Account / Member Dashboard | ✅ PRESENT | `/(member)/dashboard` with orders, wishlist, preferences. |
| 70 | Gift Cards (/gift-cards) | ❌ MISSING | No route. Wix has `Gift Cards.js` (purchase form, denomination repeater, balance check). |
| 71 | Gift Registry (/gift-registry) | ❌ MISSING | No route. Wix has `Gift Registry.js` (CF-easy). |
| 72 | Bundle Builder (/bundle) | ❌ MISSING | No route. Wix has `BUNDLE BUILDER.js` (Sprint 5, PR #677). |
| 73 | Referral Program (/referral) | ❌ MISSING | No route. Wix has `Referral Page.js` + `Referral Share.js` + `referralService.web.js`. |
| 74 | Futon Sommelier | ❌ MISSING | No cfw implementation. Wix has `CMS_FUTON_SOMMELIER` collection + quiz integration (CF-ofc0, PR #876). |
| 75 | Spin Wheel | ❌ MISSING | No cfw implementation. Wix has `CMS_SPIN_WHEEL` + `SpinGrants` CMS. |
| 76 | Near City / Local SEO Pages | ❌ MISSING | No `/near/[city]` route. Wix has `Near City Page.js` (CF-city-seo). |
| 77 | Survey / NPS Page | ❌ MISSING | No `/survey` route. Wix has `Survey.js` (CF-1mlj, PR #924). |
| 78 | Winback Page | ✅ PRESENT | `/winback` page exists in cfw. |
| 79 | Spring Sale | ✅ PRESENT | `/spring-sale` page exists. |
| 80 | Leaderboard / Gamification | ❌ MISSING | No `/leaderboard` route. Wix has Phase 6 leaderboard + challenge-of-the-week + gamification chips wired to `collectionRepeater`. (cf-sg12 filed separately.) |

---

## Beads Filed — Top 10 Missing Features

> Filed to Melania for assignment. Priority = commercial impact + implementation effort.

| Bead ID | Title | Priority | Rationale |
|---|---|---|---|
| cf-vh30 | PDP fabric swatch images — render Crypton photos not hex dots | P1 | Core Stilgar ask. 700+ fabrics are a key differentiator; buyers need to see texture, not just a color swatch. `listFabricSwatches()` must return `imageUrl`; `PdpFabricSwatches` renders `<Image>`. |
| cf-d3hc | PDP Financing / BNPL section | P1 | Afterpay / Affirm messaging directly lifts ATC rate on $500–$2,000 SKUs. Wix backend `ProductFinancing.js` is already written; cfw needs a `PdpFinancing` component + Wix API call. |
| cf-ww8u | PDP Size Guide + Room Fit checker | P1 | Furniture shoppers' #1 objection is "will it fit?" Wix has full `ProductSizeGuide.js`. cfw needs dimension data from CMS + room-fit input UI. |
| cf-pkfu | PDP 360° Spin Viewer — wire `ProductSpinViewer` into PDP | P2 | Component + tests exist. Gap is: (a) Wix spin-image set → cfw, (b) import + render `ProductSpinViewer` in `products/[slug]/page.tsx` with spin image URLs. |
| cf-9fd8 | PDP Back-in-stock notify me | P2 | Out-of-stock products lose conversions without email capture. Wix has `notifyMeSection` + `inventoryService.web.js`. cfw needs a notify-me form on OOS products. |
| cf-ph80 | Home — Swatch Promo section | P2 | Direct answer to Stilgar's question about fabric swatches visibility. CTA on home drives swatch requests and reinforces 700-fabric story. |
| cf-e4vd | Home — Quiz CTA section | P2 | `/style-quiz` exists but has zero home entry points. Style quiz drives engagement + recommendation conversion. |
| cf-urfn | Home — Sale Products strip | P2 | Dedicated sale strip is a proven home-page conversion pattern. FilterFirst does not surface sale-only products prominently. |
| cf-u7yk | Gift Cards page (/gift-cards) | P3 | Gift card revenue stream entirely missing on cfw. Wix backend complete. Needs Next.js route + Wix pricing-plans integration. |
| cf-h9pj | Community Gallery — photo submission form | P3 | Gallery is view-only. UGC submission drives content flywheel. Wix has `/submit-photo-review`. cfw needs upload form + Wix Data write. |

---

## Notes on "Prime Suspects" from cf-69fx

1. **Fabric swatch picker** — ⚠️ PARTIAL. Grid + family filter + "Order free swatches" link all present. Missing: actual swatch photos. This is the most visible gap Stilgar flagged.
2. **Free fabric sample request** — ✅ PRESENT. `/swatch-request` page fully functional.
3. **Compare drawer** — ⚠️ PARTIAL. Page works via URL, no UI entry points on PDP/PLP.
4. **Wishlist share** — ✅ PRESENT. `/wishlist/[token]` shared view.
5. **Swatch promo section** — ❌ MISSING (home).
6. **Custom-build configurator** — ❌ MISSING. Not present on Wix either; no evidence in guide.
7. **Room visualizer** — ⚠️ PARTIAL. `/design-a-room` with simple canvas vs. Wix's full drag-drop room planner.
8. **Style quiz** — ✅ PRESENT. Full multi-step flow + recommendations.
9. **White Glove Delivery learn-more modal** — ✅ PRESENT (`PdpWhiteGlove.tsx`).
10. **Live showroom feed** — ❌ MISSING. No Instagram/TikTok embeds on home.
11. **Recently viewed** — ✅ PRESENT on PDP; ❌ MISSING on home.
12. **Reviews aggregate** — ✅ PRESENT.
