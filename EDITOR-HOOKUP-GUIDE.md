# Editor Hookup Guide — Element ID Map & Manual Work Queue

**Generated**: 2026-03-15 | **Last Updated**: 2026-03-16 (v0.9.0+ — added PDP Options, Financing, Reviews, Size Guide, Promo Banner, Collection Cards, Empty States)
**Purpose**: Persistent reference for wiring Wix Studio editor elements to Velo code
**Approach**: Skeleton-first — place elements with correct IDs, code + CSS + CMS handle the rest

---

## Dashboard Prerequisites (updated 2026-03-16)

All required dashboard/API configurations are now in place for editor hookup:

| Prerequisite | Status | Details |
|---|---|---|
| **Wix eCommerce app** | INSTALLED | Instance: `0ac4428f-705a-446e-b638-988e94a0e869` |
| **Wix Inbox app** | INSTALLED | Instance: `bb7c1bad-cb6c-44d1-bf35-e5a7fc773ecb` |
| **Wix Pricing Plans app** | INSTALLED | Instance: `d8293f8b-51b0-42c1-9869-7e438381eb26` |
| **Wix Invoices app** | INSTALLED | Instance: `7d4ec574-6d7c-4511-bf41-c063090a508f` |
| **CF+ Monthly plan** | CREATED | Slug: `cf-plus-monthly`, $14.99/mo, ID: `85e98967-6754-4cbb-ac67-f3613ee5ae24` |
| **CF+ Annual plan** | CREATED | Slug: `cf-plus-annual`, $119.99/yr, ID: `d494d2a1-a1e2-43a3-b1bf-4d0474ddb604` |
| **UPS carrier** | CONFIGURED | Live rates + $49.99 fallback |
| **Local Pickup** | CONFIGURED | $0 (Hendersonville showroom) |
| **Local Delivery** | CONFIGURED | $49.99 flat rate |
| **CMS collections** | 28 TOTAL | All collections provisioned on staging |
| **Back In Stock** | BLOCKED | API returns NOT_SUPPORTED — needs manual dashboard toggle |
| **Wix Payments** | CONNECTED | Credit/Debit, Apple Pay, Google Pay, PayPal, Afterpay, Affirm — activates at Premium upgrade |
| **Manual Payments** | CONNECTED | In-store cash/check at Hendersonville showroom |
| **Marketing Tags** | BLOCKED | Staging not Premium — FB Pixel, GA4, TikTok blocked until go-live |

**New backend modules (merged 2026-03-16):**
- `src/backend/membershipService.web.js` — CF+ plan lookup, active membership check, cancel
- `src/public/membershipHelpers.js` — UI display helpers for membership status/CTA
- `src/backend/premiumMembership.web.js` — Premium tier features
- `src/public/premiumMembershipHelpers.js` — Premium display helpers
- Plans expect slugs `cf-plus-monthly` and `cf-plus-annual` (now created on staging)

**Current Dev Release**: v0.10.0 (2026-03-16) — 23,178 tests, 545 files
- Dev: [carolina-futons v0.10.0](https://github.com/DreadPirateRobertz/carolina-futons/releases/tag/v0.10.0)
- Velo: [carolina-futons-stage3-velo v0.9.0](https://github.com/DreadPirateRobertz/carolina-futons-stage3-velo/releases/tag/v0.9.0) (sync pending — accumulating sizable release)
- Pages synced to Wix page ID format (19 pages)
- 47+ src files synced (backend, public, pages, styles, assets)
- **New PDP modules**: ProductOptions (variant swatches), ProductFinancing (BNPL), ProductReviews (full review system), ProductSizeGuide (dimensions + room fit checker)
- **New Homepage modules (v0.10.0)**: SocialFeedEmbed (Instagram/TikTok/Pinterest), HomeBlogTeasers (3 recent posts)
- **New backend (v0.10.0)**: blogService.web.js (web module wrapper for blog content)

---

## How to Use This Guide

For each section below:
1. **Add the Wix element** (type listed in "Wix Element" column) to the editor
2. **Rename its ID** via Properties & Events panel (bottom of editor, click element → see `# elementId` field)
3. **Size roughly** — code/CSS handles precise styling, just get it in the right area
4. **Repeater children**: Add elements INSIDE the repeater's item template, rename each child ID

### Wix Element Type Key
| Abbreviation | Wix Studio Element | Where to Find |
|---|---|---|
| **Section** | Section | Add Elements → Section |
| **Box** | Container Box | Add Elements → Container |
| **Text** | Text element | Add Elements → Text |
| **Button** | Button | Add Elements → Button |
| **Image** | Image | Add Elements → Image |
| **Repeater** | Repeater | Add Elements → Lists & Grids → Repeater |
| **Input** | Text Input | Add Elements → Input |
| **TextBox** | Text Box (multiline) | Add Elements → Input → Text Box |
| **Dropdown** | Dropdown | Add Elements → Input → Dropdown |
| **Toggle** | Toggle Switch | Add Elements → Input → Toggle |
| **ProgressBar** | Progress Bar | Add Elements → Decorative |
| **HtmlComponent** | HTML iframe / Embed | Add Elements → Embed → HTML |
| **Video** | Video Player | Add Elements → Video |
| **Dataset** | Wix Dataset | Add Elements → CMS → Dataset |
| **Gallery** | Gallery | Add Elements → Gallery |
| **DatePicker** | Date Picker | Add Elements → Input → Date Picker |
| **CheckboxGroup** | Checkbox Group | Add Elements → Input → Checkbox Group |
| **RadioButton** | Radio Button | Add Elements → Input → Radio |

---

## Page Estimates Summary

| Page | Elements | Repeaters | Est. Manual Work | Priority |
|---|---|---|---|---|
| **Home** | ~75 | 4 + children | 45 min | P0 — above fold |
| **masterPage** (global) | ~105 | 3 + children | 60 min | P0 — every page |
| **Product Page** | ~120 | 11 + children | 90 min | P0 — revenue (expanded: options, financing, reviews, size guide) |
| **Category Page** | ~80 | 6 + children | 60 min | P0 — navigation |
| **Cart Page** | ~45 | 4 + children | 35 min | P1 — checkout flow |
| **Side Cart** | ~30 | 2 + children | 25 min | P1 — checkout flow |
| **Checkout** | ~65 | 6 + children | 50 min | P1 — checkout flow |
| **Search Results** | ~30 | 3 + children | 25 min | P1 — discovery |
| **Member Page** | ~70 | 8 + children | 55 min | P2 — post-login |
| **Contact** | ~40 | 4 + children | 30 min | P2 — support |
| **About** | ~25 | 5 + children | 20 min | P2 — brand |
| **FAQ** | ~15 | 2 + children | 15 min | P2 — support |
| **Thank You** | ~40 | 2 + children | 30 min | P2 — post-purchase |
| **Shipping Policy** | ~20 | 4 + children | 20 min | P3 — info |
| **Fullscreen/Videos** | ~15 | 2 + children | 15 min | P3 — content |
| **Privacy Policy** | ~15 | 2 + children | 10 min | P3 — legal |
| **Terms & Conditions** | ~15 | 2 + children | 10 min | P3 — legal |
| **Refund Policy** | ~5 | 1 + children | 5 min | P3 — legal |
| **Search Suggestions** | ~5 | 1 + children | 5 min | P3 — overlay |
| **Accessibility Stmt** | 0 | 0 | 0 min | Done — no elements |
| **TOTAL** | **~745** | **~64** | **~9.5 hours** | |

---

## HOME PAGE (`Home.c1dmp.js`)

### Hero Section
| Element ID | Wix Element | Notes |
|---|---|---|
| `heroSection` | Section | Full-width, bg set by code (`#3A2518`) |
| `heroBg` | Image | Hero background image, code sets `.src` |
| `heroOverlay` | Box | Transparent overlay, code sets bg color |
| `heroTitle` | Text | H1, code sets text |
| `heroSubtitle` | Text | Subheading, code sets text |
| `heroCTA` | Button | "Shop Now" — code sets label + onClick |
| `heroSkyline` | Box | Mountain skyline animation container |

### Featured Products ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `featuredTitle` | Text | Section heading |
| `featuredSubtitle` | Text | Section subheading |
| `featuredSkeleton` | Box | Loading placeholder, starts visible |
| `featuredRepeater` | **Repeater** | **4 product cards** |
| `featuredQuickViewModal` | Box | Hidden modal dialog |
| `featuredQvImage` | Image | Modal child |
| `featuredQvName` | Text | Modal child |
| `featuredQvPrice` | Text | Modal child |
| `featuredQvViewFull` | Button | Modal child |
| `featuredQvAddToCart` | Button | Modal child |
| `featuredQvClose` | Button | Modal child — X button |

**↳ Inside `featuredRepeater` item template:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `featuredCard` | Box | Card container |
| `featuredImage` | Image | Product image |
| `featuredName` | Text | Product name |
| `featuredPrice` | Text | Current price |
| `featuredOriginalPrice` | Text | Strikethrough price |
| `featuredSaleBadge` | Text | "X% OFF" badge |
| `featuredRibbon` | Text | "New" / "Sale" ribbon |
| `featuredColorText` | Text | "Available in X colors" |
| `featuredSwatchContainer` | Box | Color swatch dots container |
| `featuredQuickViewBtn` | Button | Quick view trigger |

### Sale Products ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `saleSection` | Section | Collapsible — hides if no sales |
| `saleSkeleton` | Box | Loading placeholder |
| `saleRepeater` | **Repeater** | Sale product cards |

**↳ Inside `saleRepeater` item template:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `saleCard` | Box | Card container |
| `saleImage` | Image | Product image |
| `saleName` | Text | Product name |
| `salePrice` | Text | Sale price |
| `saleOrigPrice` | Text | Original price (strikethrough) |

### Category Cards ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `categorySkeleton` | Box | Loading placeholder |
| `categoryRepeater` | **Repeater** | 8 category cards |

**↳ Inside `categoryRepeater` item template:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `categoryCard` | Box | Card with bg image |
| `categoryCardTitle` | Text | Category name |
| `categoryCardTagline` | Text | Category tagline |
| `categoryCardCount` | Text | Product count |
| `categoryCardImage` | Image | Category image |

### Trust Bar ✅ SECTION RENAMED
| Element ID | Wix Element | Notes |
|---|---|---|
| `trustBar` | Box/Section | ✅ Already renamed. Espresso bg `#3A2518`. |
| `trustItem1` | Box | Trust signal container |
| `trustIcon1` | Text | Emoji icon (🚚, etc.) |
| `trustText1` | Text | Signal text |
| `trustItem2` | Box | Trust signal container |
| `trustIcon2` | Text | Emoji icon |
| `trustText2` | Text | Signal text |
| `trustItem3` | Box | Trust signal container |
| `trustIcon3` | Text | Emoji icon |
| `trustText3` | Text | Signal text |
| `trustItem4` | Box | Trust signal container (may be hidden) |
| `trustIcon4` | Text | Emoji icon |
| `trustText4` | Text | Signal text |
| `trustItem5` | Box | Trust signal container |
| `trustIcon5` | Text | Emoji icon |
| `trustText5` | Text | Signal text |

### Testimonials ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `testimonialSection` | Section | Container |
| `testimonialRepeater` | **Repeater** | Rotating testimonials |
| `testimonialSchemaScript` | HtmlComponent | SEO schema injection (code uses `testimonialSchemaScript`) |
| `testimonialSlideshow` | Box | Slideshow wrapper |
| `testimonialPauseBtn` | Button | Pause/play toggle |

**↳ Inside `testimonialRepeater` item template:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `testimonialQuote` | Text | Quote text |
| `testimonialName` | Text | Customer name |
| `testimonialPhoto` | Image | Customer photo |
| `testimonialRating` | Text | Star rating (text) |

### Recently Viewed
| Element ID | Wix Element | Notes |
|---|---|---|
| `recentSection` | Section | Collapsible, expands when data exists |
| `recentRepeater` | **Repeater** | Recently viewed products |

**↳ Repeater children (shared pattern):**
`recentImage` (Image), `recentName` (Text), `recentPrice` (Text), `recentAddToCart` (Button)

### Video Showcase
| Element ID | Wix Element | Notes |
|---|---|---|
| `videoShowcaseSection` | Section | Collapsible |
| `videoShowcaseTitle` | Text | Section heading |
| `videoShowcaseSubtitle` | Text | Subheading |
| `viewAllVideosCTA` | Button | Link to videos page |
| `videoThumb1` | Image | Clickable video thumbnail |
| `videoThumb2` | Image | Clickable video thumbnail |
| `videoThumb3` | Image | Clickable video thumbnail |

### Smooth Scroll Triggers
| Element ID | Wix Element | Notes |
|---|---|---|
| `scrollToFeatured` | Button | Scroll to featured section |
| `scrollToCategories` | Button | Scroll to categories |
| `scrollToSale` | Button | Scroll to sale section |
| `scrollToReviews` | Button | Scroll to reviews |

### Quiz CTA
| Element ID | Wix Element | Notes |
|---|---|---|
| `quizCTASection` | Section | Collapsible |
| `quizCTATitle` | Text | "Find Your Perfect Futon" |
| `quizCTASubtitle` | Text | Description |
| `quizCTAButton` | Button | Start quiz |

### Swatch Promo
| Element ID | Wix Element | Notes |
|---|---|---|
| `swatchPromoSection` | Section | Container |
| `swatchPromoTitle` | Text | Heading |
| `swatchPromoSubtitle` | Text | Subheading |
| `swatchPromoCTA` | Button | Order swatches |

### Blog Teasers (CF-iix7)
| Element ID | Wix Element | Notes |
|---|---|---|
| `blogTeaserSection` | HtmlComponent | Blog post cards — code injects HTML grid of 3 recent posts via `HomeBlogTeasers.js` |

### Social Feeds (CF-iix7)
| Element ID | Wix Element | Notes |
|---|---|---|
| `instagramFeedContainer` | HtmlComponent | Instagram embed iframe — code injects via `SocialFeedEmbed.js` |
| `tiktokFeedContainer` | HtmlComponent | TikTok follow card — code injects via `SocialFeedEmbed.js` |
| `pinterestBoardContainer` | HtmlComponent | Pinterest follow card — code injects via `SocialFeedEmbed.js` |

### Newsletter
| Element ID | Wix Element | Notes |
|---|---|---|
| `newsletterSection` | Section | Container |
| `newsletterTitle` | Text | Heading |
| `newsletterSubtitle` | Text | Subheading |
| `newsletterEmail` | Input | Email field |
| `newsletterSubmit` | Button | Subscribe button |
| `newsletterSuccess` | Text | Hidden, shown on success |
| `newsletterError` | Text | Hidden, shown on error |

### SEO / Decorative
| Element ID | Wix Element | Notes |
|---|---|---|
| `websiteSchemaHtml` | HtmlComponent | SEO schema |
| `ridgelineHeader` | Box | Mountain skyline illustration |
| `section4` | Section | Collapsible misc section |

---

## MASTER PAGE (`masterPage.js`) — Global, appears on every page

### Accessibility
| Element ID | Wix Element | Notes |
|---|---|---|
| `mainContent` | Section | Skip-nav target |
| `skipToContent` | Button | Skip navigation link |
| `a11yLiveRegion` | Text | Hidden, screen reader announcements |

### Navigation
| Element ID | Wix Element | Notes |
|---|---|---|
| `navHome` | Text | Nav link |
| `navShop` | Text | Nav link |
| `navFutonFrames` | Text | Nav link |
| `navMattresses` | Text | Nav link |
| `navMurphy` | Text | Nav link |
| `navPlatformBeds` | Text | Nav link |
| `navSale` | Text | Nav link |
| `navProductVideos` | Text | Nav link |
| `navGettingItHome` | Text | Nav link |
| `navContact` | Text | Nav link |
| `navFAQ` | Text | Nav link |
| `navAbout` | Text | Nav link |
| `navBlog` | Text | Nav link |
| `navFreeSwatches` | Text | Nav link |
| `siteLogo` | Image | Logo image |
| `headerSearchInput` | Input | Search bar |
| `megaMenuPanel` | Box | Mega menu dropdown panel |
| `desktopNavBar` | Box | Desktop nav container |
| `productTitle` | Text | Read-only, LiveChat context |

### Mobile Drawer
| Element ID | Wix Element | Notes |
|---|---|---|
| `mobileMenuButton` | Button | Hamburger menu toggle |
| `mobileMenuOverlay` | Box | Full-screen mobile drawer |
| `mobileMenuClose` | Button | Close drawer |
| `mobileSearchInput` | Input | Mobile search input |
| `mobileNavHome` | Text | Mobile nav link |
| `mobileNavShop` | Text | Mobile nav link |
| `mobileNavFutonFrames` | Text | Mobile nav link |
| `mobileNavMattresses` | Text | Mobile nav link |
| `mobileNavMurphy` | Text | Mobile nav link |
| `mobileNavPlatformBeds` | Text | Mobile nav link |
| `mobileNavSale` | Text | Mobile nav link |
| `mobileNavContact` | Text | Mobile nav link |
| `mobileNavFAQ` | Text | Mobile nav link |
| `mobileNavAbout` | Text | Mobile nav link |

### Cart (global)
| Element ID | Wix Element | Notes |
|---|---|---|
| `cartIcon` | Image | Cart icon, clickable |
| `cartBadge` | Text | Item count badge |
| `sideCartPanel` | Box | Slide-in panel |
| `justAddedHighlight` | Box | Just-added animation |

### Header Shipping Progress
| Element ID | Wix Element | Notes |
|---|---|---|
| `headerShippingBar` | ProgressBar | Free shipping progress |
| `headerShippingText` | Text | "$X away from free shipping" |
| `headerSkyline` | Box | Mountain skyline illustration |

### Schema
| Element ID | Wix Element | Notes |
|---|---|---|
| `businessSchemaHtml` | HtmlComponent | Business schema |
| `websiteSchemaHtml` | HtmlComponent | Website schema |

### Breadcrumbs
| Element ID | Wix Element | Notes |
|---|---|---|
| `breadcrumb1` | Text | Breadcrumb level 1 |
| `breadcrumb2` | Text | Breadcrumb level 2 |
| `breadcrumb3` | Text | Breadcrumb level 3 |
| `breadcrumbSchemaHtml` | HtmlComponent | Breadcrumb JSON-LD |

### Announcement Bar
| Element ID | Wix Element | Notes |
|---|---|---|
| `announcementBar` | Box | Announcement bar container |
| `announcementText` | Text | Announcement text |
| `announcementDismiss` | Button | Dismiss button |

### Sticky Nav / Back to Top
| Element ID | Wix Element | Notes |
|---|---|---|
| `headerStrip` | Box | Header container for sticky nav |
| `backToTop` | Button | Back-to-top button |

### Promo Lightbox ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `promoLightbox` | Box | Modal dialog |
| `promoOverlay` | Box | Background overlay |
| `promoClose` | Button | Close X |
| `promoDismiss` | Button | "No thanks" link |
| `promoTitle` | Text | Promo heading |
| `promoSubtitle` | Text | Promo subheading |
| `promoHeroImage` | Image | Promo banner image |
| `promoCode` | Text | Discount code |
| `promoCopyCode` | Button | Copy code button |
| `promoCTA` | Button | Shop now |
| `promoCountdown` | Text | Timer countdown |
| `promoRepeater` | **Repeater** | Featured promo products |
| `promoEmailInput` | Input | Email capture |
| `promoEmailSubmit` | Button | Submit email |

**↳ Inside `promoRepeater` item template:**
`promoImage` (Image), `promoName` (Text), `promoPrice` (Text), `promoOrigPrice` (Text), `promoQuickAdd` (Button)

### Newsletter Modal
| Element ID | Wix Element | Notes |
|---|---|---|
| `newsletterModalTrigger` | Button | Open modal |
| `newsletterModal` | Box | Modal panel |
| `newsletterModalClose` | Button | Close X |
| `newsletterModalOverlay` | Box | Background overlay |
| `newsletterModalEmail` | Input | Email field |
| `newsletterModalSubmit` | Button | Subscribe |
| `newsletterModalError` | Text | Error message |
| `newsletterModalSuccess` | Text | Success message |

### Exit Intent Popup
| Element ID | Wix Element | Notes |
|---|---|---|
| `exitIntentPopup` | Box | Slide-in popup |
| `exitOverlay` | Box | Background overlay |
| `exitClose` | Button | Close X |
| `exitTitle` | Text | Heading |
| `exitSubtitle` | Text | Subheading |
| `exitEmailInput` | Input | Email field |
| `exitEmailSubmit` | Button | Submit |
| `exitEmailError` | Text | Error message |
| `exitSuccess` | Text | Success message |
| `exitSwatchLink` | Button | Swatch link |
| `exitDragHandle` | Box | Mobile bottom sheet handle |

### Footer Accordions (mobile)
| Element ID | Wix Element | Notes |
|---|---|---|
| `footerShopHeader` | Text | Accordion header |
| `footerShopLinks` | Box | Accordion content |
| `footerServiceHeader` | Text | Accordion header |
| `footerServiceLinks` | Box | Accordion content |
| `footerAboutHeader` | Text | Accordion header |
| `footerAboutLinks` | Box | Accordion content |

### PWA Install Banner
| Element ID | Wix Element | Notes |
|---|---|---|
| `installBanner` | Box | Slide-in banner |
| `installBannerText` | Text | Install prompt text |
| `installBannerBtn` | Button | Install button |
| `installBannerDismiss` | Button | Dismiss button |

### Footer ⚠️ REPEATERS
| Element ID | Wix Element | Notes |
|---|---|---|
| `siteFooter` | Section | Footer container |
| `footerLogo` | Image | Footer logo |
| `footerStoreName` | Text | Store name |
| `footerStoreAddress` | Text | Address |
| `footerStorePhone` | Text | Phone |
| `footerStoreHours` | Text | Hours |
| `footerCopyright` | Text | Copyright text |
| `footerMountainDivider` | HtmlComponent | Mountain SVG divider |
| `footerShopHeading` | Text | Column heading |
| `footerShopRepeater` | **Repeater** | Shop links |
| `footerServiceHeading` | Text | Column heading |
| `footerServiceRepeater` | **Repeater** | Service links |
| `footerAboutHeading` | Text | Column heading |
| `footerAboutRepeater` | **Repeater** | About links |
| `footerBadgeRepeater` | **Repeater** | Trust badges |
| `footerPaymentRepeater` | **Repeater** | Payment icons |
| `footerSocialRepeater` | **Repeater** | Social icons |
| `socialFacebook` | Button | Facebook link |
| `socialInstagram` | Button | Instagram link |
| `socialPinterest` | Button | Pinterest link |
| `footerEmailInput` | Input | Newsletter email |
| `footerEmailSubmit` | Button | Newsletter submit |
| `footerEmailError` | Text | Error message |
| `footerEmailSuccess` | Text | Success message |

**↳ Inside `footerShopRepeater` / `footerServiceRepeater` / `footerAboutRepeater`:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `footerLink` | Text | Link text |

**↳ Inside `footerBadgeRepeater`:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `badgeIcon` | Text | Badge icon |
| `badgeLabel` | Text | Badge label |

**↳ Inside `footerPaymentRepeater`:**
`paymentIcon` (Text)

**↳ Inside `footerSocialRepeater`:**
`socialIcon` (Text)

---

## PRODUCT PAGE (`Product Page.ve2z7.js`)

### Product Info
| Element ID | Wix Element | Notes |
|---|---|---|
| `productDataset` | Dataset | Connect to Stores/Products |
| `productName` | Text | H1 product name |
| `productPrice` | Text | Current price |
| `productMainImage` | Image | Main product image |
| `productDescription` | Text | Product description |
| `productComparePrice` | Text | Original price (hidden if no sale) |
| `addToCartButton` | Button | Add to cart |
| `quantityInput` | Input | Quantity field |
| `quantityMinus` | Button | Decrease qty |
| `quantityPlus` | Button | Increase qty |
| `buyNowButton` | Button | Buy now / express checkout |
| `productHeroSkyline` | Box | Mountain skyline decoration |

### Related Products ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `relatedSection` | Section | Collapsible |
| `relatedRepeater` | **Repeater** | Related product cards |

**↳ Inside `relatedRepeater`:** `relatedImage` (Image), `relatedName` (Text), `relatedPrice` (Text), `relatedBadge` (Text)

### Collection Products ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `collectionSection` | Section | Collapsible |
| `collectionRepeater` | **Repeater** | Same-collection products |

**↳ Inside `collectionRepeater`:** `collectionImage` (Image), `collectionName` (Text), `collectionPrice` (Text)

### Recently Viewed ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `recentlyViewedSection` | Section | Collapsible |
| `recentlyViewedRepeater` | **Repeater** | Recently viewed products |

**↳ Inside:** `recentImage` (Image), `recentName` (Text), `recentPrice` (Text), `recentAddToCart` (Button)

### Also Bought ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `alsoBoughtSection` | Section | Collapsible |
| `alsoBoughtRepeater` | **Repeater** | Frequently bought together |

**↳ Inside:** `alsoBoughtImage` (Image), `alsoBoughtName` (Text), `alsoBoughtPrice` (Text), `alsoBoughtBadge` (Text), `alsoBoughtAddToCart` (Button)

### Product Options / Variant Swatches (NEW v0.9.0+)
*Source: `src/public/ProductOptions.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `sizeDropdown` | Dropdown | Size variant selector |
| `finishDropdown` | Dropdown | Finish/color variant selector |
| `productPrice` | Text | *(shared)* Updated on variant change |
| `productComparePrice` | Text | *(shared)* Strikethrough price |
| `productMainImage` | Image | *(shared)* Updated on variant select |
| `productGallery` | Gallery | Product image gallery |
| `stockStatus` | Text | In Stock / Low Stock / Out of Stock badge |
| `finishSwatches` | Box | Visual swatch dot container |
| `swatchSection` | Section | Collapsible swatch section |
| `swatchCount` | Text | "Showing X of Y available fabrics" |
| `swatchViewAll` | Button | Opens full swatch gallery |
| `swatchRequestLink` | Button | Request free swatch link |

### Financing (NEW v0.9.0+)
*Source: `src/public/ProductFinancing.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `financingSection` | Section | Collapsible financing area |
| `financingTeaser` | Text | "As low as $X/mo" teaser |
| `afterpayMessage` | Text | Afterpay 4-payment breakdown |
| `financingLearnMore` | Button | Opens financing detail overlay |
| `financingOverlay` | Box | Modal overlay background |
| `financingModal` | Box | Modal content container |
| `financingClose` | Button | Close modal — X button |

**⚠️ REPEATER — Financing Terms:**

| Element ID | Wix Element | Notes |
|---|---|---|
| `financingRepeater` | **Repeater** | Monthly payment options |
| `financingTermPills` | **Repeater** | Term length pill selector |
| `financingDetailRepeater` | **Repeater** | Detailed breakdown in modal |

### Reviews & Ratings (NEW v0.9.0+)
*Source: `src/public/ProductReviews.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `reviewsSection` | Section | Collapsible reviews area |
| `reviewsAverage` | Text | Average rating (e.g. "4.5") |
| `reviewsCount` | Text | Total review count |
| `ratingBar1`–`ratingBar5` | Box | Star distribution bars |
| `ratingCount1`–`ratingCount5` | Text | Count per star level |
| `histogramBar1`–`histogramBar5` | Box | Visual histogram bars |
| `histogramPercent1`–`histogramPercent5` | Text | Percentage per star |
| `reviewsSortDropdown` | Dropdown | Sort by: Most Recent, Highest, etc. |
| `reviewsEmptyState` | Box | "No reviews yet" message |
| `reviewSchemaMarkup` | HtmlComponent | JSON-LD structured data |

**⚠️ REPEATER — Review List:**

| Element ID | Wix Element | Notes |
|---|---|---|
| `reviewsRepeater` | **Repeater** | Individual review cards |
| `reviewsNextBtn` | Button | Pagination next |
| `reviewsPrevBtn` | Button | Pagination prev |
| `reviewsPageInfo` | Text | "Page X of Y" |

**Star Filters:**
`starFilterAll` (Button), `starFilter1`–`starFilter5` (Button)

**Review Submission Form:**

| Element ID | Wix Element | Notes |
|---|---|---|
| `reviewSubmitBtn` | Button | Open/submit review form |
| `reviewRatingInput` | Input | Star rating selector |
| `reviewTitleInput` | Input | Review title |
| `reviewBodyInput` | TextBox | Review body text |
| `reviewForm` | Box | Form container (collapses on success) |
| `reviewFormError` | Text | Error message |
| `reviewFormSuccess` | Text | Success message |
| `reviewPhotoUpload` | Button | Upload review photo |
| `reviewPhotoStatus` | Text | Upload status label |
| `reviewPhotoCount` | Text | "X/3 photos" counter |
| `reviewPhotoPreview` | **Repeater** | Photo thumbnail previews |

### Size Guide & Room Fit (NEW v0.9.0+)
*Source: `src/public/ProductSizeGuide.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `dimensionSection` | Section | Collapsible dimensions area |
| `dimensionTitle` | Text | "Dimensions" heading |
| `dimensionPlaceholder` | Text | "Coming soon" / error fallback |
| `dimensionGrid` | Box | Dimension data grid |
| `unitToggle` | Toggle | Imperial ↔ Metric switch |
| `productWeight` | Text | "Weight: X lbs" |
| `mattressSize` | Text | "Mattress Size: Full/Queen" |
| `closedDimsLabel` | Text | "Closed (Sofa Position)" |
| `closedDims` | Text | W × D × H closed |
| `openDimsLabel` | Text | "Open (Bed Position)" |
| `openDims` | Text | W × D × H open |
| `seatHeight` | Text | Seat height measurement |
| `dimensionDiagramHtml` | HtmlComponent | SVG dimension diagram |
| `diagramPositionToggle` | Toggle | Closed ↔ Open diagram view |
| `dimensionOverlayBtn` | Button | Toggle dimension overlay |
| `dimensionOverlaySvg` | HtmlComponent | SVG overlay on product image |

**Room Fit Checker:**

| Element ID | Wix Element | Notes |
|---|---|---|
| `roomFitTitle` | Text | "Will It Fit?" heading |
| `doorwayWidth` | Input | Doorway width (inches) |
| `doorwayHeight` | Input | Doorway height (inches) |
| `hallwayWidth` | Input | Hallway width (inches) |
| `roomWidth` | Input | Room width (inches) |
| `roomDepth` | Input | Room depth (inches) |
| `checkFitBtn` | Button | "Check Fit" action |
| `fitResultText` | Text | Fit result summary |
| `fitResultSection` | Box | Result container |
| `roomFitCallout` | Box | Highlighted callout |

**Shipping Dimensions:**
`shippingDimsRow` (Box), `shippingDimsLabel` (Text), `shippingDims` (Text), `shippingWeight` (Text)

**Size Comparison:** ⚠️ REPEATER
`sizeCompareSection` (Section), `sizeCompareTitle` (Text), `sizeCompareRepeater` (Repeater), `sizeComparisonTitle` (Text), `sizeComparisonVisual` (HtmlComponent)

### Promo Banner Carousel (NEW v0.9.0+)
*Source: `src/public/promoBannerCarousel.js`*

Renders promo banners via repeater — element IDs TBD (module uses config-driven approach).

### Collection Card Builder (NEW v0.9.0+)
*Source: `src/public/collectionCardBuilder.js`*

Generates collection card HTML for injection into HtmlComponent elements — no direct $w element IDs (uses postMessage pattern).

### Empty State Builder (NEW v0.9.0+)
*Source: `src/public/emptyStateBuilder.js`*

Generates empty state HTML with mountain illustrations for injection via `$w('#element').postMessage()` — no direct element IDs.

### Social Story Helpers (NEW v0.9.0+)
*Source: `src/public/socialStoryHelpers.js`*

Backend utility for social media story generation — no editor elements needed.

---

## CATEGORY PAGE (`Category Page.u0gn0.js`)

### Hero / Breadcrumb
| Element ID | Wix Element | Notes |
|---|---|---|
| `categoryHeroSection` | Section | Dynamic bg color/image |
| `categoryHeroTitle` | Text | Category name H1 |
| `categoryHeroSubtitle` | Text | Category description |
| `breadcrumbHome` | Text | "Home" breadcrumb link |
| `breadcrumbCurrent` | Text | Current category name |
| `flashSaleBanner` | Box | Collapsible sale banner |

### Product Grid ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `categoryDataset` | Dataset | Stores/Products dataset |
| `productGridRepeater` | **Repeater** | Main product grid |
| `resultCount` | Text | "X products" |
| `sortDropdown` | Dropdown | Sort by options |

**↳ Inside `productGridRepeater`:**
| Child ID | Wix Element |
|---|---|
| `gridCard` | Box |
| `gridImage` | Image |
| `gridName` | Text |
| `gridPrice` | Text |
| `gridOrigPrice` | Text |
| `gridSaleBadge` | Text |
| `gridBadge` | Text |
| `gridBrand` | Text |
| `gridRibbon` | Text |
| `gridFabricBadge` | Text |
| `gridLifestyleBadge` | Text |
| `gridCompareBtn` | Button |
| `quickViewBtn` | Button |
| `gridSwatchPreview` | Box |

### Quick View Modal
| Element ID | Wix Element | Notes |
|---|---|---|
| `quickViewModal` | Box | Hidden modal |
| `qvImage` | Image | Product image |
| `qvName` | Text | Product name |
| `qvPrice` | Text | Price |
| `qvDescription` | Text | Description |
| `qvAddToCart` | Button | Add to cart |
| `qvViewFull` | Button | View full product |
| `qvClose` | Button | Close X |
| `qvSizeSelect` | Dropdown | Size options |

### Filters
| Element ID | Wix Element | Notes |
|---|---|---|
| `filterCategory` | Dropdown | Category filter |
| `filterBrand` | Dropdown | Brand filter |
| `filterPrice` | Dropdown | Price range filter |
| `filterSize` | Dropdown | Size filter |
| `clearFilters` | Button | Clear all filters |
| `filterMaterial` | Dropdown | Material filter |
| `filterColor` | Dropdown | Color filter |
| `filterFeatures` | CheckboxGroup | Feature filters |
| `filterPriceRange` | Dropdown | Price range |
| `filterComfortLevel` | Dropdown | Comfort filter |
| `filterWidthMin` | Input | Min width |
| `filterWidthMax` | Input | Max width |
| `filterDepthMin` | Input | Min depth |
| `filterDepthMax` | Input | Max depth |
| `filterResultCount` | Text | Filter result count |
| `filterLoadingIndicator` | Box | Loading spinner |
| `filterChipsText` | Text | Fallback filter chips text |
| `clearAllFilters` | Button | Clear all |
| `clearAllFiltersChip` | Button | Clear chip |
| `activeFilterChips` | Box | Chips container |
| `filterChipRepeater` | **Repeater** | Active filter chips |

**↳ Inside `filterChipRepeater`:** `chipLabel` (Text), `chipRemove` (Button)

### Mobile Filter Drawer
| Element ID | Wix Element | Notes |
|---|---|---|
| `filterToggleBtn` | Button | Open filter drawer |
| `filterDrawer` | Box | Drawer panel |
| `filterDrawerOverlay` | Box | Background overlay |
| `filterDrawerApply` | Button | Apply filters |
| `mobileSortBar` | Box | Mobile sort bar |

### Empty States
| Element ID | Wix Element | Notes |
|---|---|---|
| `emptyStateSection` | Section | No products |
| `emptyStateTitle` | Text | "No Products" heading |
| `emptyStateMessage` | Text | Helpful message |
| `emptyStateIllustration` | Image | Illustration |
| `noMatchesSection` | Section | No filter matches |
| `noMatchesTitle` | Text | Heading |
| `noMatchesMessage` | Text | Message |
| `noMatchesSuggestion` | Text | Suggestion |

### Compare Bar ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `compareBar` | Box | Sticky compare bar |
| `compareRepeater` | **Repeater** | Compare thumbnails |
| `compareViewBtn` | Button | View comparison |

**↳ Inside `compareRepeater`:** `compareThumb` (Image), `compareName` (Text), `comparePrice` (Text), `compareRemove` (Button)

### Recently Viewed
| Element ID | Wix Element | Notes |
|---|---|---|
| `recentlyViewedTitle` | Text | Section heading |

### SEO
`categorySchemaHtml` (HtmlComponent), `categoryBreadcrumbSchemaHtml` (HtmlComponent), `categoryOgHtml` (HtmlComponent)

---

## CART PAGE (`Cart Page.mqi5m.js`)

### Cart Data
| Element ID | Wix Element | Notes |
|---|---|---|
| `cartDataset` | Dataset | Cart dataset |

### Empty Cart
| Element ID | Wix Element | Notes |
|---|---|---|
| `emptyCartSection` | Section | Shown when cart empty |
| `emptyCartTitle` | Text | "Your Cart is Empty" |
| `emptyCartMessage` | Text | Helpful message |
| `continueShoppingBtn` | Button | Back to shop |

### Shipping Progress
| Element ID | Wix Element | Notes |
|---|---|---|
| `shippingProgressBar` | ProgressBar | Free shipping progress |
| `shippingProgressText` | Text | Progress text |
| `shippingProgressIcon` | Image | Truck icon |

### Tier Discount
| Element ID | Wix Element | Notes |
|---|---|---|
| `tierProgressBar` | ProgressBar | Tier discount progress |
| `tierProgressText` | Text | Progress text |

### Cart Items ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `cartItemsRepeater` | **Repeater** | Cart line items |

**↳ Inside:** `cartItemName` (Text), `cartItemPrice` (Text), `qtyMinus` (Button), `qtyPlus` (Button), `qtyInput` (Input), `removeItem` (Button), `saveForLaterBtn` (Button)

### Cart Totals
`cartSubtotal` (Text), `cartShipping` (Text), `cartTotal` (Text)

### Cross-Sell ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `suggestionsSection` | Section | Collapsible |
| `suggestionsHeading` | Text | Heading |
| `suggestionsSubheading` | Text | Subheading |
| `sugSavingsBadge` | Text | Savings badge |
| `suggestionsRepeater` | **Repeater** | Suggested products |
| `sugBundlePrice` | Text | Bundle price |
| `sugOriginalPrice` | Text | Original price |

**↳ Inside:** `sugImage` (Image), `sugName` (Text), `sugPrice` (Text), `sugAddBtn` (Button)

### Recently Viewed ⚠️ REPEATER
`cartRecentSection` (Section), `cartRecentRepeater` (Repeater)
**↳ Inside:** `cartRecentImage` (Image), `cartRecentName` (Text), `cartRecentPrice` (Text)

### Financing
`cartFinancingSection` (Section), `financingThreshold` (Text), `cartFinancingTeaser` (Text), `cartAfterpayMessage` (Text)

### Delivery
`cartDeliverySection` (Section)

---

## CHECKOUT (`Checkout.psuom.js`)

### Progress ⚠️ REPEATER
`checkoutProgressNav` (Box), `checkoutProgressRepeater` (Repeater)
**↳ Inside:** `progressStepLabel` (Text), `progressStepNumber` (Text), `progressStepDot` (Box), `progressStepCheck` (Image), `progressStepContainer` (Box)

### Trust Signals ⚠️ REPEATER
`trustRepeater` (Repeater)
**↳ Inside:** `trustText` (Text), `trustIcon` (Image)

### Order Notes
`orderNotesToggle` (Button), `orderNotesField` (TextBox)

### Checkout Summary
`checkoutFreeShipping` (Text), `checkoutItemCount` (Text)

### Payment Methods ⚠️ REPEATER
`paymentMethodsRepeater` (Repeater)
**↳ Inside:** `paymentMethodName` (Text), `paymentMethodIcon` (Image), `paymentBrands` (Text)

### Afterpay / Financing
`checkoutAfterpay` (Section), `afterpayMessage` (Text), `afterpayInstallment` (Text), `checkoutFinancing` (Section), `financingMessage` (Text), `checkoutShippingMessage` (Text)

### Shipping Options ⚠️ REPEATER
`shippingOptionsRepeater` (Repeater)
**↳ Inside:** `shippingOptionLabel` (Text), `shippingOptionPrice` (Text), `shippingOptionDesc` (Text), `shippingOptionDays` (Text), `shippingOptionRadio` (RadioButton)

### Address Validation
`validateAddressBtn` (Button), `addressFullName` (Input), `addressLine1` (Input), `addressCity` (Input), `addressState` (Input), `addressZip` (Input), `addressFullNameError` (Text), `addressLine1Error` (Text), `addressCityError` (Text), `addressStateError` (Text), `addressZipError` (Text), `addressErrors` (Text), `addressSuccess` (Text)

### Delivery Estimate
`checkoutDeliveryEstimate` (Text)

### Order Summary Sidebar ⚠️ REPEATER
`orderSummarySidebar` (Box), `orderSummaryItemsRepeater` (Repeater), `orderSummarySubtotal` (Text), `orderSummaryShipping` (Text), `orderSummaryTax` (Text), `orderSummaryTotal` (Text), `orderSummarySavings` (Text), `orderSummaryStoreCredit` (Text), `orderSummaryStoreCreditRow` (Box)
**↳ Inside:** `summaryItemName` (Text), `summaryItemQty` (Text), `summaryItemPrice` (Text)

### Express Checkout
`expressCheckoutSection` (Section), `expressCheckoutBtn` (Button), `expressSummaryTotal` (Text), `expressSummaryShipping` (Text), `expressSummaryAddress` (Text), `expressSummarySection` (Box)

### Store Credit
`storeCreditApplyBtn` (Button), `storeCreditAppliedAmount` (Text), `storeCreditAppliedSection` (Box)

### Protection Plans ⚠️ NESTED REPEATER
`protectionPlanSection` (Section), `protectionPlanTitle` (Text), `protectionPlanSubtitle` (Text), `protectionPlanRepeater` (Repeater)
**↳ Inside:** `protPlanProductName` (Text), `protPlanProductPrice` (Text), `protPlanTierRepeater` (Repeater — NESTED), `protPlanDecline` (Button)
**↳↳ Inside nested:** `tierName` (Text), `tierPrice` (Text), `tierDuration` (Text), `tierCoverage` (Text), `tierCard` (Box), `tierSelectBtn` (Button), `tierCurrentBadge` (Text)

---

## SIDE CART (`Side Cart.ego5s.js`)

### Panel
`sideCartPanel` (Box), `sideCartTitle` (Text), `sideCartClose` (Button), `sideCartOverlay` (Box), `sideCartEmpty` (Box), `sideCartItems` (Box), `sideCartFooter` (Box), `sideCartSubtotal` (Text), `sideCartCheckout` (Button), `viewFullCart` (Button), `cartIcon` (Image), `cartBadge` (Text), `justAddedHighlight` (Box)

### Items ⚠️ REPEATER
`sideCartRepeater` (Repeater)
**↳ Inside:** `sideItemImage` (Image), `sideItemName` (Text), `sideItemPrice` (Text), `sideItemQty` (Text), `sideQtyMinus` (Button), `sideQtyPlus` (Button), `sideItemLineTotal` (Text), `sideItemVariant` (Text), `sideItemRemove` (Button), `sideSaveForLater` (Button)

### Progress Bars
`sideShippingBar` (ProgressBar), `sideShippingText` (Text), `sideTierBar` (ProgressBar), `sideTierText` (Text)

### Cross-Sell ⚠️ REPEATER
`sideCartSuggestion` (Section), `sideSugLabel` (Text), `sideSugSubheading` (Text), `sideSugSavingsBadge` (Text), `sideSugRepeater` (Repeater), `sideSugBundlePrice` (Text), `sideSugOriginalPrice` (Text)
**↳ Inside:** `sideSugImage` (Image), `sideSugName` (Text), `sideSugPrice` (Text), `sideSugAdd` (Button)

---

## SEARCH RESULTS (`Search Results.evr2j.js`)

### Search Controls
`searchInput` (Input), `searchBtn` (Button), `searchQuery` (Text), `resultCount` (Text), `loadMoreBtn` (Button), `loadingIndicator` (Box)

### Results Grid ⚠️ REPEATER
`searchRepeater` (Repeater)
**↳ Inside:** `searchImage` (Image), `searchName` (Text), `searchPrice` (Text), `searchDesc` (Text), `searchRibbon` (Text), `searchOrigPrice` (Text), `searchAddBtn` (Button), `searchSwatchPreview` (Box), `searchSwatchDot1`–`searchSwatchDot4` (Box)

### Suggestions ⚠️ REPEATER
`suggestionsBox` (Box), `suggestionsRepeater` (Repeater)
**↳ Inside:** `suggestionText` (Text), `suggestionType` (Text)

### Filters
`categoryFilter` (Dropdown), `priceFilter` (Dropdown), `materialFilter` (Dropdown), `colorFilter` (Dropdown), `sortDropdown` (Dropdown), `filterToggleBtn` (Button), `filterSidebar` (Box), `clearFiltersBtn` (Button), `filterBadge` (Text)

### No Results
`noResultsBox` (Box), `noResultsText` (Text), `searchChipsRepeater` (Repeater)
**↳ Inside:** `chipLabel` (Text)

---

## MEMBER PAGE (`Member Page.f00pg.js`)

### Dashboard
`memberWelcome` (Text), `memberOrderCount` (Text), `memberWishCount` (Text), `memberPointsDisplay` (Text), `memberTierDisplay` (Text), `memberErrorFallback` (Box), `memberErrorText` (Text)

### Quick Links
`dashQuickOrders` (Button), `dashQuickWishlist` (Button), `dashQuickSettings` (Button)

### Loyalty ⚠️ REPEATER
`tierProgressBar` (ProgressBar), `tierProgressText` (Text), `loyaltyMilestone` (Text), `tierComparisonRepeater` (Repeater)
**↳ Inside:** `tierName` (Text), `tierMinPoints` (Text), `tierBenefits` (Text), `tierCard` (Box), `tierCurrentBadge` (Text)

### Rewards ⚠️ REPEATER
`rewardsRepeater` (Repeater), `rewardsSection` (Section), `rewardsEmpty` (Text)
**↳ Inside:** `rewardName` (Text), `rewardDescription` (Text), `rewardCost` (Text), `redeemBtn` (Button), `rewardCouponCode` (Text)

### Order History ⚠️ REPEATER
`ordersRepeater` (Repeater), `orderFilterDropdown` (Dropdown), `ordersLoadMoreBtn` (Button), `ordersRetryBtn` (Button), `ordersLoader` (Box), `ordersError` (Text), `ordersEmpty` (Box), `startReturnBtn` (Button)
**↳ Inside:** `orderNumber` (Text), `orderDate` (Text), `orderTotal` (Text), `orderItemCount` (Text), `orderStatusBadge` (Text), `orderStatus` (Text), `orderDeliveryEta` (Text), `orderTrackBtn` (Button), `orderReorderBtn` (Button), `orderStartReturnBtn` (Button), `orderItemsGallery` (Gallery)

### Wishlist ⚠️ REPEATER
`wishlistRepeater` (Repeater), `wishlistEmpty` (Box), `wishSortDropdown` (Dropdown), `wishShareBtn` (Button), `wishSharePinterest` (Button), `wishShareEmail` (Button), `wishShareFacebook` (Button), `wishAlertHistorySection` (Section), `wishAlertHistoryRepeater` (Repeater)
**↳ Inside `wishlistRepeater`:** `wishImage` (Image), `wishName` (Text), `wishPrice` (Text), `wishStockStatus` (Text), `wishSalePrice` (Text), `wishAddToCartBtn` (Button), `wishViewBtn` (Button), `wishAlertToggle` (Toggle), `wishRemoveBtn` (Button), `wishCard` (Box)
**↳ Inside `wishAlertHistoryRepeater`:** `alertTypeLabel` (Text), `alertProductName` (Text), `alertMessage` (Text), `alertDate` (Text)

### Account / Address / Prefs
`logoutBtn` (Button), `accountSettings` (Section), `addressBook` (Box), `addressRepeater` (Repeater), `addressEmptyState` (Box), `commPrefs` (Box), `prefNewsletter` (Toggle), `prefSaleAlerts` (Toggle), `prefBackInStock` (Toggle)
**↳ Inside `addressRepeater`:** `addressText` (Text)

---

## CONTACT (`Contact.k14wx.js`)

### Contact Form
`contactName` (Input), `contactEmail` (Input), `contactPhone` (Input), `contactSubject` (Input), `contactMessage` (TextBox), `contactSubmit` (Button), `contactSuccess` (Box), `contactForm` (Box), `contactError` (Text), `contactNameError` (Text), `contactEmailError` (Text), `contactMessageError` (Text), `contactPhoneError` (Text)

### Business Info
`infoAddress` (Text), `infoPhone` (Text), `infoPhoneLink` (Button), `directionsBtn` (Button), `contactFaqLink` (Button), `contactFeatures` (Repeater)
**↳ Inside:** `featureItem` (Text)

### Hours ⚠️ REPEATER
`todayStatus` (Text), `hoursRepeater` (Repeater)
**↳ Inside:** `hourDay` (Text), `hourTime` (Text)

### Appointment ⚠️ FORM
`appointmentBookBtn` (Button), `appointmentName` (Input), `appointmentEmail` (Input), `appointmentPhone` (Input), `appointmentVisitType` (Dropdown), `appointmentDate` (Dropdown), `appointmentTimeSlot` (Dropdown), `appointmentInterests` (TextBox), `appointmentError` (Text), `appointmentConfirmation` (Text), `appointmentForm` (Box), `appointmentSuccess` (Box)

### Social Proof ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `contactTestimonials` | **Repeater** | Customer testimonials |

**↳ Inside `contactTestimonials`:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `testimonialQuote` | Text | Quote text |
| `testimonialAuthor` | Text | Author name |
| `testimonialStars` | Text | Star rating |

### Schema
`contactSchemaHtml` (HtmlComponent), `contactMetaHtml` (HtmlComponent)

---

## ABOUT (`About.gar3e.js`)

`aboutTitle` (Text), `aboutSubtitle` (Text)

### Repeaters
- `brandStoryRepeater` → `storyHeading` (Text), `storyBody` (Text), `storyImage` (Image)
- `teamRepeater` → `teamName` (Text), `teamRole` (Text), `teamBio` (Text)
- `teamGallery` → `polaroidImage` (Image), `polaroidCaption` (Text)
- `timelineRepeater` → `timelineYear` (Text), `timelineTitle` (Text), `timelineDesc` (Text)
- `showroomFeatures` → `featureText` (Text)
- `aboutTestimonials` → `testimonialQuote` (Text), `testimonialAuthor` (Text), `testimonialStars` (Text)

### Showroom Info
`aboutAddress` (Text), `aboutPhone` (Text), `aboutTodayHours` (Text), `aboutDirectionsBtn` (Button)

### Visit CTA
`aboutVisitTitle` (Text), `aboutVisitBody` (Text), `aboutVisitBtn` (Button), `aboutBookBtn` (Button), `aboutFaqLink` (Button), `aboutSchemaHtml` (HtmlComponent)

---

## FAQ (`FAQ.s2c5g.js`)

`faqTitle` (Text), `faqSubtitle` (Text), `faqSearchInput` (Input), `faqNoResults` (Text)

### Category Filters ⚠️ REPEATER
`faqCategoryRepeater` (Repeater) → `categoryLabel` (Text)

### FAQ Accordion ⚠️ REPEATER
`faqRepeater` (Repeater) → `faqQuestion` (Text), `faqAnswer` (Text), `faqToggle` (Text)

### Contact CTA
`faqContactTitle` (Text), `faqContactBody` (Text), `faqContactBtn` (Button), `faqPhoneBtn` (Button)

---

## THANK YOU PAGE (`Thank You Page.dk9x8.js`)

### Order Summary
`thankYouTitle` (Text), `orderNumber` (Text), `thankYouMessage` (Text), `orderContactInfo` (Text)

### Brenda's Message
`brendaMessageSection` (Section), `brendaTitle` (Text), `brendaMessage` (Text)

### Delivery Timeline
`deliveryTimeline` (Section), `deliveryEstimateText` (Text), `step1`–`step4` (Text)

### Social Sharing
`shareText` (Text), `shareFacebook` (Button), `sharePinterest` (Button), `shareInstagram` (Button), `shareTwitter` (Button)

### Newsletter
`newsletterPrompt` (Text), `newsletterEmail` (Input), `newsletterSignup` (Button), `newsletterSuccess` (Text), `newsletterError` (Text)

### Referral
`referralSection` (Section), `referralTitle` (Text), `referralMessage` (Text), `referralCopyBtn` (Button), `referralEmailBtn` (Button)

### Post-Purchase ⚠️ REPEATER
`postPurchaseHeading` (Text), `postPurchaseRepeater` (Repeater)
**↳ Inside:** `ppImage` (Image), `ppName` (Text), `ppPrice` (Text)

### Care / Assembly / Review
`careSequenceInfo` (Section), `careSequenceText` (Text), `assemblyGuideSection` (Section), `assemblyGuideTitle` (Text), `assemblyGuideText` (Text), `assemblyGuideBtn` (Button), `testimonialSection` (Section), `testimonialTitle` (Text), `testimonialPrompt` (Text), `testimonialNameInput` (Input), `testimonialStoryInput` (TextBox), `testimonialSubmitBtn` (Button), `testimonialError` (Text), `testimonialSuccess` (Text), `reviewSection` (Section), `reviewTitle` (Text), `reviewPrompt` (Text), `reviewStar1`–`reviewStar5` (Button), `reviewRating` (Text), `reviewBodyInput` (TextBox), `reviewSubmitBtn` (Button), `reviewSuccess` (Text), `reviewError` (Text)

---

## SHIPPING POLICY (`Shipping Policy.ype8c.js`)

### Calculator
`shippingZipInput` (Input), `shippingCalcBtn` (Button), `shippingResult` (Text)

### Delivery Methods ⚠️ REPEATER
`deliveryRepeater` (Repeater) → `deliveryTitle` (Text), `deliveryDesc` (Text)
`assemblyTips` (Text)

### Assembly Guides ⚠️ REPEATER
`assemblyGuidesRepeater` (Repeater) → `guideTitle` (Text), `guideTime` (Text), `guideTools` (Text), `guideSteps` (Text), `guideExpandBtn` (Button)

### Care Tips ⚠️ REPEATER
`careCategoryDropdown` (Dropdown), `careTipsRepeater` (Repeater) → `careTipTitle` (Text), `careTipSummary` (Text), `careTipSteps` (Text), `careTipVideoLink` (Button)

### Delivery Prep
`deliveryTierDropdown` (Dropdown), `deliveryPrepInstructions` (Text), `deliveryPrepTips` (Text)

### Scheduling
`nextAvailableSlot` (Text), `scheduleDeliveryBtn` (Button)

### Schema
`shippingSchemaHtml` (HtmlComponent)

---

## FULLSCREEN / PRODUCT VIDEOS (`Fullscreen Page.vu50r.js`)

`videoPageTitle` (Text), `videoPageSubtitle` (Text), `videoPlayer` (Video), `nowPlayingTitle` (Text), `videoPlayerContainer` (Section), `videoProductLink` (Button), `videoNoResults` (Text)

### Video Grid ⚠️ REPEATER
`videosRepeater` (Repeater) → `videoTitle` (Text), `videoDescription` (Text), `videoThumb` (Image), `videoCategoryBadge` (Text)

### Category Filters ⚠️ REPEATER
`videoCategoryRepeater` (Repeater) → `categoryLabel` (Text)

---

## PRIVACY POLICY (`Privacy Policy.pcvmd.js`)

`policyTitle` (Text), `policyEffectiveDate` (Text), `policyIntro` (Text)
`policyRepeater` (Repeater) → `sectionTitle` (Text), `sectionContent` (Text), `sectionToggle` (Text)
`policyTocRepeater` (Repeater) → `tocLink` (Text)
Anchor sections: `policyCollect`, `policyUse`, `policySharing`, `policyCookies`, `policyRights`, `policySecurity`, `policyChildren`, `policyChanges`, `policyContact` (Sections)

---

## TERMS & CONDITIONS (`Terms & Conditions.z0xvf.js`)

`termsTitle` (Text), `termsEffectiveDate` (Text), `termsIntro` (Text)
`termsRepeater` (Repeater) → `sectionTitle` (Text), `sectionContent` (Text), `sectionToggle` (Text)
`termsTocRepeater` (Repeater) → `tocLink` (Text)
Anchors: `termsAcceptance`, `termsProducts`, `termsOrders`, `termsShipping`, `termsReturns`, `termsWarranties`, `termsIP`, `termsLiability`, `termsGoverning`, `termsContact` (Sections)

---

## REFUND POLICY (`Refund Policy.jmwgj.js`)

`policyRepeater` (Repeater) → `policyTitle` (Text), `policyContent` (Text), `policyToggle` (Text)

---

## SEARCH SUGGESTIONS BOX (`Search Suggestions Box.gg5mx.js`)

`searchInput` (Input), `suggestionsBox` (Box), `suggestionsRepeater` (Repeater)
**↳ Inside:** `sugImage` (Image), `sugName` (Text), `sugPrice` (Text)

---

## MODULES ON EXISTING PAGES (no new page needed)

### Returns Portal — on Member Page (`src/public/ReturnsPortal.js`)

Add these elements to the **Member Page** in the editor:

| Element ID | Wix Element | Notes |
|---|---|---|
| `returnFlowSection` | Box | Return flow container, shown/hidden |
| `returnNoOrders` | Text | "No orders" message |
| `returnOrderDropdown` | Dropdown | Select order to return |
| `returnReasonDropdown` | Dropdown | Return reason |
| `returnWindowInfo` | Text | Return window status |
| `returnDetailsInput` | TextBox | Additional details |
| `returnError` | Text | Error message |
| `returnSuccess` | Text | Success message |
| `submitReturnBtn` | Button | Submit return request |
| `cancelReturnBtn` | Button | Cancel return flow |
| `returnsListSection` | Box | Return history container |

**`returnItemsRepeater`** ⚠️ REPEATER — returnable items:

| Child ID | Wix Element | Notes |
|---|---|---|
| `returnItemName` | Text | Item name |
| `returnItemQty` | Text | Quantity |
| `returnItemPrice` | Text | Price |
| `returnItemImage` | Image | Item image |
| `returnItemCheckbox` | CheckboxGroup | Select item to return |
| `returnItemBlockReason` | Text | Why item can't be returned |

**`returnsListRepeater`** ⚠️ REPEATER — return request history:

| Child ID | Wix Element | Notes |
|---|---|---|
| `returnRma` | Text | RMA number |
| `returnOrderNum` | Text | Order number |
| `returnDate` | Text | Request date |
| `returnReason` | Text | Reason |
| `returnStatusBadge` | Text | Status badge |
| `returnTimeline` | Text | Timeline (multiline) |

### Product Financing Widget — on Product Page (`src/public/ProductFinancing.js`)

Add these elements to the **Product Page** in the editor:

| Element ID | Wix Element | Notes |
|---|---|---|
| `financingSection` | Box | Financing section container |
| `financingTeaser` | Text | "As low as $X/mo" |
| `afterpayMessage` | Text | Afterpay message |
| `financingLearnMore` | Button | "Learn more" link |
| `financingModal` | Box | Modal dialog |
| `financingOverlay` | Box | Modal overlay bg |
| `financingClose` | Button | Close modal |

**`financingRepeater`** ⚠️ REPEATER — financing plans:

| Child ID | Wix Element | Notes |
|---|---|---|
| `planLabel` | Text | Plan label |
| `planMonthly` | Text | Monthly payment |
| `planDescription` | Text | Plan description |
| `planInterest` | Text | Interest/APR |

**`financingDetailRepeater`** ⚠️ REPEATER — modal detail view:

| Child ID | Wix Element | Notes |
|---|---|---|
| `detailLabel` | Text | Detail label |
| `detailMonthly` | Text | Monthly amount |
| `detailApr` | Text | APR display |
| `detailInterest` | Text | Interest amount |

---

## PAGES THAT NEED CREATING (no frontend code yet)

These have **backend code only** — frontend pages must be built from scratch:

| Page | Backend File | What It Does | Clone Candidate |
|---|---|---|---|
| Style Quiz | `styleQuiz.web.js` | 60-second product recommendation quiz | FAQ page (repeater + progress) |
| Blog | `blogContent.js` | 8 SEO pillar posts, FAQ schema | Privacy/Terms (repeater + TOC) |
| Compare Page | `comparisonService.web.js` | Side-by-side product comparison (max 4) | Category page (grid + filters) |
| Room Planner | `roomPlanner.web.js` | Virtual room layout tool | New page (unique UI) |

---

## Design Tokens (for manual color/font reference)

| Token | Value | Usage |
|---|---|---|
| Espresso | `#3A2518` | Headers, trust bar bg, primary dark |
| Mountain Blue | `#5B8FA8` | Accents, links, CTA secondary |
| Coral | `#E8845C` | Sale badges, urgency, CTA primary |
| Sand Light | `#FAF7F2` | Page backgrounds |
| Sand Medium | `#F5F0E8` | Card backgrounds |
| Cream | `#FFF8F0` | Alternate section bg |
| Charcoal | `#2C2C2C` | Body text |
