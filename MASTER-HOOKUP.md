# Carolina Futons — MASTER HOOKUP GUIDE

> **The one file that tells you everything about connecting this codebase to a live Wix website.**
> Last updated: 2026-03-14 by miquella (Temp Lead)
> **Consolidated from**: FRONTEND-HOOKUP-GUIDE.md + 5 hookup audit files (homepage, product, browse, commerce, content)
> **Codebase stats**: 41 pages | 232 public helpers | 191 backend modules | 12,993+ tests passing

---

## Table of Contents

### Part 1: Deployment & Setup
1. [How This All Works (ELI5)](#how-this-all-works)
2. [What is a CDN and Why You Don't Need to Worry](#cdn-explained)
3. [The 10-Step Hookup Checklist](#hookup-checklist)
4. [Step 1: Deploy Backend Code](#step-1-deploy-backend-code)
5. [Step 2: Deploy Page Code](#step-2-deploy-page-code)
6. [Step 3: Deploy Frontend Utilities](#step-3-deploy-frontend-utilities)
7. [Step 4: Create CMS Collections](#step-4-create-cms-collections)
8. [Step 5: Configure Secrets](#step-5-configure-secrets)
9. [Step 6: Install Plugins & Tracking](#step-6-install-plugins)
10. [Step 7: Import Product Catalog](#step-7-import-product-catalog)
11. [Step 8: Set Up Email Templates](#step-8-email-templates)
12. [Step 9: Configure Scheduled Jobs](#step-9-scheduled-jobs)
13. [Step 10: Publish & Verify](#step-10-publish-verify)

### Part 2: Feature-Specific Hookup
14. [Fabric Swatch System Hookup](#swatch-hookup)
15. [Social Media Platform Hookup](#social-media-hookup)
16. [Room Planner Hookup](#room-planner-hookup)
17. [Wishlist Alerts Hookup](#wishlist-alerts-hookup)
18. [Store Credit Hookup](#store-credit-hookup)

### Part 3: Frontend Element Wiring (consolidated from audit files)
19. [Frontend Element Wiring Guide](#frontend-element-wiring-guide)
20. [Page-by-Page Element Reference](#page-by-page-element-reference)

### Part 4: Reference
21. [Backend Services](#backend-services-already-built)
22. [Complete Module Reference](#module-reference)
23. [CMS Collection Reference](#cms-reference)
24. [Troubleshooting](#troubleshooting)

---

## How This All Works

Think of the Carolina Futons website like a restaurant:

- **The dining room** = what customers see (pages, images, buttons). This is the **frontend**.
- **The kitchen** = where the work happens (calculating shipping, sending emails, tracking orders). This is the **backend**.
- **The walk-in fridge** = where the data lives (products, prices, customer info). This is the **CMS** (Content Management System).
- **The recipes** = the instructions that tell the kitchen what to do. These are the **code modules**.

**What we built:** 191 kitchen recipes (backend modules), 41 dining room layouts (pages), 232 shared tools (utilities), and a complete inventory list (88 products).

**What you need to do:** Put the recipes in the kitchen, set up the fridge, and open the doors.

### How Wix Studio Works

Wix Studio is like a website builder (think Squarespace) but with a secret developer mode called **Velo**. When you turn on Velo, you get:

1. A **code editor** where you paste our JavaScript files
2. A **CMS** where you create database tables and add content
3. A **Secrets Manager** where you store API keys (like the UPS shipping password)
4. A **page editor** where you drag and drop elements and connect them to data

You don't need to set up servers, databases, or hosting. Wix handles all of that.

---

## CDN Explained

### What is a CDN?

CDN stands for **Content Delivery Network**. Imagine you have one copy of a photo stored in a warehouse in Virginia. Every time someone in California wants to see it, the photo has to travel across the entire country. That's slow.

A CDN makes copies of that photo and puts them in warehouses all over the world — California, Texas, London, Tokyo. Now when someone in California wants the photo, they get it from the California warehouse. Fast.

### Do You Need to Set Up a CDN?

**No. Wix does this automatically. You don't touch it.**

Here's what happens behind the scenes when you publish your Wix site:

1. **Your product images** → Wix automatically uploads them to their CDN (powered by Fastly/Cloudflare). Every image URL that starts with `static.wixstatic.com` is already on the CDN. When you upload a product photo in the Wix Media Manager, it's instantly available worldwide.

2. **Your JavaScript code** (all 64 backend modules + 23 pages) → When you hit "Publish" in Wix Studio, Wix bundles your code, minifies it, and deploys it to their edge servers worldwide. You don't configure this.

3. **Your page HTML/CSS** → Wix generates this from your editor layout and serves it from their CDN. The design tokens (colors, fonts, spacing) in our `designTokens.js` get baked into the CSS automatically.

4. **Your CMS data** (products, FAQs, blog posts) → Served from Wix's database servers with edge caching. When a customer loads a product page, the product data comes from the nearest Wix data center.

### What About the Product Images from carolinafutons.com?

The MCP scrape pulled image URLs like `static.wixstatic.com/media/...`. These are **already on Wix's CDN** because your current site is hosted on Wix. When we import the product catalog, those same image URLs will work on the new site — no re-uploading needed.

### The Only CDN Thing You Might Touch

If you ever want to use a **custom domain** (carolinafutons.com instead of username.wixsite.com/sitename), Wix handles the CDN routing automatically when you connect the domain in Dashboard > Settings > Domains. They issue the SSL certificate, set up the CDN routing, and handle HTTPS — you just point your domain's DNS to Wix.

### Bottom Line on CDN

| Question | Answer |
|----------|--------|
| Do I need to buy a CDN? | No. Wix includes it. |
| Do I need to configure a CDN? | No. It's automatic. |
| Are my images on a CDN? | Yes, already. Every `static.wixstatic.com` URL is CDN-served. |
| Is my code on a CDN? | Yes. Wix deploys it to edge servers on publish. |
| Will it be fast? | Yes. Wix uses Fastly/Cloudflare infrastructure. |
| What about mobile? | Same CDN, same speed. Wix optimizes images for mobile automatically. |

---

## Hookup Checklist

Print this out and check off as you go:

```
[ ] 1. Deploy 191 backend .web.js/.js files to Wix Velo backend/
[ ] 2. Deploy 41 page .js files to Wix page code editor
[ ] 3. Deploy 232 public utility .js files to Wix public/
[ ] 4. Create 16 priority CMS collections in Dashboard
[ ] 5. Verify 8 secrets in Secrets Manager
[ ] 6. Install 7 free plugins (GA4, Meta Pixel, etc.)
[ ] 7. Import 88-product catalog via catalogImport
[ ] 8. Create 12 email templates in Triggered Emails
[ ] 9. Set up 4 scheduled jobs (cart recovery, etc.)
[ ] 10. Connect domain, publish, verify 14-point checklist
```

### What's Ready vs. In Progress (Mar 14 status)

**SHIPPED (merged to main, ready to deploy) — 50+ PRs merged:**
- Homepage hero overhaul (full-bleed lifestyle, gradient overlay, staggered animations)
- Announcement bar (rotating messages, dark espresso bg)
- 5-icon trust bar (white-glove, financing, handcrafted, swatches, guarantee)
- Product card grid (names, prices, sale strikethrough, color swatches, Quick View)
- Category showcase cards (lifestyle images, "Shop Now" overlays)
- Brand palette enforced (Sand/Espresso/Blue/Coral — pink killed)
- Product page modernization (delivery estimate by ZIP, swatch CTA, accordion)
- Email capture popup (exit-intent, WELCOME10, session gating, ARIA)
- Financing calculator + BNPL display (monthly payments, Afterpay)
- offWhite token (#FAF7F2) replacing pink backgrounds
- Footer redesign (4-column links, newsletter signup, social icons, trust badges, payment methods)
- Cart Page ARIA live regions + keyboard navigation
- Side Cart ARIA live regions
- Checkout visible focus rings on all interactive elements
- Category Page SSR breadcrumbs + structured data + keyboard nav
- FAQ page structured data JSON-LD via SSR
- Product Page structured data JSON-LD via SSR + OG brand detection
- Category Page SSR Open Graph + Twitter Card meta tags
- LocalBusiness SSR structured data (Contact + Store Locator)
- Brand detection consolidation (3 duplicate functions -> 1 canonical in productPageUtils)
- Store credit integration (Member Page + Checkout auto-apply)
- Wishlist price drop email notifications (best-effort pattern)
- Room Planner full interactive hookup (dimension inputs, presets, canvas, save/share)
- Buying Guides page (category filtering + reading time)
- Illustration pipeline: 6 Figma SVGs processed (mountain-skyline, timeline, contact-hero, contact-showroom, footer-divider, team-portrait)
- v0.4.0: Color scheme shift (template beige/salmon → CF blue branding)
- v0.4.1: Security hardening (cron secrets, rate limiting)
- v0.5.0: CSS v5 unprefixed selectors fix (deployed to stage3-velo)
- PR #312: Filter call-for-price products from recommendations
- PR #315: bannerMessage bug fix + comment accuracy
- PR #317: Test coverage for 4 untested public helpers (60 tests)
- PRs #313, #314: Getting It Home + Sale pages
- Category card photos set in Wix Dashboard (CF-pipx)

**IN PROGRESS (crew working now):**
- Page-level test coverage — 240 tests (PR #320 — miquella)
- Mobile responsiveness audit (CF-f0wn — radahn, PR #319 merged)
- Staging nav missing pages (CF-3c6y — rennala)
- Delete hidden template sections (CF-ozp8 — melania, browser)
- Blog 404 fix (CF-r2lm — melania, browser)

**IN PROGRESS (polecats):**
- Team portrait illustration rework (CF-3qt — atom)
- Contact showroom illustration rework (CF-6ds — brahmin)

**READY QUEUE (38 beads, prioritized):**
- Member: wishlist management (CF-wpfs)
- Engagement: Pinterest Rich Pins, Thank You social, social proof toasts, UGC gallery, referral, exit-intent
- Product: financing calc, swatch request, video, Q&A, size guide, 360 viewer
- Cart/Checkout: cross-sell, delivery dates, address autocomplete, order summary, debounce, coupon UX
- Performance: prioritizeSections, CLS prevention, filter optimization, JS deferral, import budgets, lazy loading
- A11y: alt text audit, CTA contrast audit
- SEO: canonical URLs + Twitter Cards
- CI: coverage thresholds, test reorg, coverage reporting

---

## Step 1: Deploy Backend Code

These are the "kitchen recipes" — the server-side logic. All files go in the Wix Velo `backend/` directory.

### How to Do It

1. Open your Wix site in the Editor (wix.com > My Sites > Edit Site)
2. Click the **{ } Dev Mode** toggle in the top menu bar (if you don't see it, go to Settings > Dev Mode > Enable)
3. In the left sidebar, you'll see a file tree. Click `backend/`
4. For each file below: click the **+** button > New .web.js file > name it exactly as shown > paste the code from `src/backend/`

### Complete Backend Module List (64 files)

**Core Commerce — paste these first:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 1 | `catalogImport.web.js` | 12KB | Imports 88 products from JSON into Wix Stores |
| 2 | `ups-shipping.web.js` | 19KB | UPS rate quotes, label creation, tracking |
| 3 | `shipping-rates-plugin.js` | 7KB | Wix checkout shipping rate hook (SPI) |
| 4 | `fulfillment.web.js` | 9KB | Order fulfillment & UPS shipment management |
| 5 | `cartRecovery.web.js` | 7KB | Abandoned cart detection & recovery emails |
| 6 | `productRecommendations.web.js` | 12KB | Cross-sell engine ("Complete Your Futon") |
| 7 | `analyticsHelpers.web.js` | 11KB | GA4 event tracking, product view counting |
| 8 | `catalogContent.web.js` | 16KB | Content enrichment for product pages |
| 9 | `searchService.web.js` | 11KB | Full-text search with autocomplete |

**Customer Engagement:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 10 | `emailAutomation.web.js` | 26KB | Welcome/post-purchase/re-engagement sequences |
| 11 | `emailService.web.js` | 8KB | Contact form & order notification emails |
| 12 | `browseAbandonment.web.js` | 17KB | Browse recovery ("Still thinking about it?") |
| 13 | `loyaltyService.web.js` | 6KB | Loyalty program basics |
| 14 | `loyaltyTiers.web.js` | 11KB | Bronze/Silver/Gold/Platinum tier management |
| 15 | `referralService.web.js` | 15KB | Two-sided referral program |
| 16 | `reviewsService.web.js` | 14KB | Customer review system |
| 17 | `testimonialService.web.js` | 10KB | Testimonial management |
| 18 | `notificationService.web.js` | 12KB | Price drop & back-in-stock alerts |
| 19 | `contactSubmissions.web.js` | 3KB | Contact form data handling |

**Product & Catalog:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 20 | `categorySearch.web.js` | 15KB | Category filtering & faceted search |
| 21 | `comparisonService.web.js` | 13KB | Product comparison (up to 3) |
| 22 | `productQA.web.js` | 12KB | Customer Q&A on product pages |
| 23 | `productVideos.web.js` | 10KB | Product video catalog (YouTube embeds) |
| 24 | `seoContentHub.web.js` | 14KB | SEO content topics |
| 25 | `topicClusters.web.js` | 24KB | Topic cluster organization |
| 26 | `seoHelpers.web.js` | 32KB | JSON-LD schema (Product, LocalBusiness, FAQ) |

**Order & Fulfillment:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 27 | `checkoutOptimization.web.js` | 14KB | Checkout funnel optimization |
| 28 | `deliveryExperience.web.js` | 17KB | Delivery tracking & experience |
| 29 | `deliveryScheduling.web.js` | 6KB | White-glove delivery scheduling (Wed-Sat) |
| 30 | `orderTracking.web.js` | 12KB | Customer order lookup & UPS timeline |
| 31 | `returnsService.web.js` | 12KB | Returns management |

**Product Features:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 32 | `assemblyGuides.web.js` | 5KB | Assembly instructions & videos per product |
| 33 | `giftCards.web.js` | 7KB | Gift card purchase & redemption |
| 34 | `giftRegistry.web.js` | 15KB | Gift registry system |
| 35 | `inventoryService.web.js` | 14KB | Stock tracking |
| 36 | `inventoryAlerts.web.js` | 16KB | Low stock alerts |
| 37 | `mediaGallery.web.js` | 17KB | Product images & Wix Media Manager |
| 38 | `photoReviews.web.js` | 10KB | Photo reviews with moderation |
| 39 | `sizeGuide.web.js` | 10KB | Dimension & size guides |
| 40 | `swatchService.web.js` | 3KB | Fabric swatch queries (see Swatch Hookup) |

**Shopping Features:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 41 | `bundleBuilder.web.js` | 21KB | Bundle suggestions (frame + mattress) |
| 42 | `bundleAnalytics.web.js` | 12KB | Bundle performance tracking |
| 43 | `couponsService.web.js` | 6KB | Discount coupon management |
| 44 | `paymentOptions.web.js` | 12KB | Financing & Afterpay display |
| 45 | `financingService.web.js` | 5KB | Monthly payment calculator |
| 46 | `promotions.web.js` | 2KB | Campaign management |
| 47 | `wishlistAlerts.web.js` | 12KB | Wishlist price drop/restock alerts |

**Design & Content:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 48 | `buyingGuides.web.js` | 92KB | Buying guides by category |
| 49 | `postPurchaseCare.web.js` | 13KB | Care guide sequences |
| 50 | `roomPlanner.web.js` | 13KB | Room planner tool |
| 51 | `storeLocatorService.web.js` | 12KB | Showroom info & directions |
| 52 | `styleQuiz.web.js` | 9KB | Style quiz / product recommender |

**Data & Admin:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 53 | `accountDashboard.web.js` | 13KB | Member portal (orders, wishlist, loyalty) |
| 54 | `coreWebVitals.web.js` | 19KB | Performance tracking |
| 55 | `dataService.web.js` | 17KB | General data operations |
| 56 | `errorMonitoring.web.js` | 15KB | Error tracking & logging |
| 57 | `liveChat.web.js` | 13KB | Live chat system |
| 58 | `liveChatService.web.js` | 11KB | Live chat management |
| 59 | `sustainability.web.js` | 11KB | Eco-badge management |
| 60 | `sustainabilityService.web.js` | 20KB | Sustainability scoring |
| 61 | `abTesting.web.js` | 14KB | A/B test framework |

**New in Sprint 2 (Feb 27-28):**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 65 | `comfortService.web.js` | 8KB | Comfort story card data & rating scales |
| 66 | `accessibility.web.js` | 10KB | WCAG AA compliance backend helpers |
| 67 | `analyticsDashboard.web.js` | 12KB | Analytics dashboard data |
| 68 | `contentImport.web.js` | 9KB | Content migration tools |
| 69 | `emailTemplates.web.js` | 7KB | Email template management |
| 70 | `financingCalc.web.js` | 5KB | BNPL monthly payment calculations |
| 71 | `imageAltText.web.js` | 6KB | Auto alt text generation |
| 72 | `imageAudit.web.js` | 8KB | Image optimization audit |
| 73 | `inventoryService.web.js` | 14KB | Stock tracking |
| 74 | `orderHistory.web.js` | 11KB | Customer order history |
| 75 | `reviewSummary.web.js` | 9KB | Review aggregation & summaries |
| 76 | `searchIndex.web.js` | 10KB | Search index management |
| 77 | `socialProofService.web.js` | 7KB | Real-time social proof events |

**New in Design Sprint (Feb 28 afternoon — PRs #75-#83):**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 78 | `newsletterService.web.js` | 5KB | Newsletter subscription (email validation, dedup, Bronze loyalty auto-enroll, WELCOME10 discount code) |

**Feed & Social:**

| # | File | Size | What It Does |
|---|------|------|-------------|
| 62 | `googleMerchantFeed.web.js` | 9KB | Google Shopping product feed |
| 63 | `pinterestRichPins.web.js` | 11KB | Pinterest metadata |
| 64 | `http-functions.js` | 18KB | Public API endpoints (feeds, webhooks) |

**Also deploy:**

| File | Location | Purpose |
|------|----------|---------|
| `blogContent.js` | `backend/` | Blog post content data (92KB) |
| `utils/sanitize.js` | `backend/utils/` | Input sanitization (required by all modules) |
| `permissions.json` | `backend/` | Backend permissions config |

**New since Sprint 2 (Mar 1-7):**

| # | File | What It Does |
|---|------|-------------|
| 79 | `storeCreditService.web.js` | Store credit balance, FIFO application, expiration tracking |
| 80 | `wishlistAlerts.web.js` | Wishlist price drop/back-in-stock/low-stock alerts + email notifications |
| 81 | `customizationService.web.js` | Product customization options |
| 82 | `dynamicPricing.web.js` | Dynamic pricing engine |
| 83 | `affiliateProgram.web.js` | Affiliate tracking & commissions |
| 84 | `currencyService.web.js` | Multi-currency support |
| 85 | `customsEstimator.web.js` | International customs estimates |
| 86 | `internationalShipping.web.js` | International shipping rates |
| 87 | `pinterestCatalogSync.web.js` | Pinterest catalog synchronization |
| 88 | `productReviews.web.js` | Product review management |
| 89 | `promotionsEngine.web.js` | Advanced promotions logic |
| 90 | `protectionPlan.web.js` | Tiered warranty/protection plans |
| 91 | `smsService.web.js` | SMS notifications |
| 92 | `socialMediaKit.web.js` | Social media content toolkit |
| 93 | `subscriptionService.web.js` | Subscription/recurring orders |
| 94 | `ugcService.web.js` | User-generated content management |
| 95 | `virtualConsultation.web.js` | Virtual design consultation booking |
| 96 | `warrantyService.web.js` | Warranty management |
| 97 | `tradeProgram.web.js` | Trade/designer program |
| 98 | `loadCatalogMaster.web.js` | Master catalog loader |

**Total: 95+ backend files**

---

## Step 2: Deploy Page Code

Each page in your Wix Editor has a code panel at the bottom. Click the `{ }` icon on any page to open it.

### How to Do It

1. Open a page in the Wix Editor
2. Click the code icon `{ }` at the bottom of the editor
3. Paste the corresponding code from `src/pages/`
4. Repeat for each page

### Page Code Files (39 files)

**Main Pages (Revenue Pipeline):**

| Page | File | What It Does |
|------|------|-------------|
| Homepage | `Home.js` | Hero, 6 category cards, featured products, testimonials, video, quiz CTA |
| Product Page | `Product Page.js` | Gallery, variants, swatches, cross-sell, reviews, wishlist, bundles, JSON-LD SSR |
| Category Page | `Category Page.js` | Filters (brand/price/size/color), product grid, quick view, compare bar, SSR breadcrumbs |
| Cart | `Cart Page.js` | Cart items, shipping progress, loyalty tier, cross-sell, ARIA live regions |
| Side Cart | `Side Cart.js` | Slide-out mini cart, ARIA live regions |
| Checkout | `Checkout.js` | Trust signals, order notes, delivery estimate, store credit, focus rings |
| Thank You | `Thank You Page.js` | Confirmation, delivery timeline, social sharing, referral |
| Master Page | `masterPage.js` | Global header, footer, nav, announcement bar, schema injection |

**Content Pages:**

| Page | File | Notes |
|------|------|-------|
| About | `About.js` | Brand story, team, showroom, testimonials |
| Contact | `Contact.js` | Contact form, appointment booking, LocalBusiness SSR |
| FAQ | `FAQ.js` | FAQ listing, JSON-LD structured data SSR |
| Blog | `Blog.js` | Blog listing, category filters |
| Blog Post | `Blog Post.js` | Individual article renderer |
| Newsletter | `Newsletter.js` | Newsletter signup page |
| Sustainability | `Sustainability.js` | Eco-badge, sustainability info |
| Assembly Guides | `Assembly Guides.js` | Product assembly documentation |
| Buying Guides | `Buying Guides.js` | **NEW** — Category filtering + reading time |
| Buying Guide | `Buying Guide.js` | **NEW** — Individual guide detail |

**Feature Pages:**

| Page | File | Notes |
|------|------|-------|
| Member Page | `Member Page.js` | Orders, wishlist, loyalty, store credit, returns |
| Search Results | `Search Results.js` | Search results with filters |
| Search Suggestions | `Search Suggestions Box.js` | Autocomplete dropdown |
| Compare | `Compare Page.js` | Side-by-side product specs |
| Room Planner | `Room Planner.js` | **NEW** — Interactive room layout with save/share |
| Style Quiz | `Style Quiz.js` | Style preference quiz |
| Store Locator | `Store Locator.js` | Showroom finder, LocalBusiness SSR |
| Financing | `Financing.js` | Financing calculator page |
| Gift Cards | `Gift Cards.js` | Gift card purchase/redemption |
| UGC Gallery | `UGC Gallery.js` | User-generated content gallery |
| Referral Page | `Referral Page.js` | Referral program page |
| Order Tracking | `Order Tracking.js` | Order status/tracking |
| Returns | `Returns.js` | Self-service returns portal |
| Admin Returns | `Admin Returns.js` | Admin returns management |
| Fullscreen Page | `Fullscreen Page.js` | Full-screen modal container |

**Static/Legal:**

| Page | File |
|------|------|
| Accessibility Statement | `Accessibility Statement.js` |
| Privacy Policy | `Privacy Policy.js` |
| Terms & Conditions | `Terms & Conditions.js` |
| Refund Policy | `Refund Policy.js` |
| Shipping Policy | `Shipping Policy.js` |
| Price Match Guarantee | `Price Match Guarantee.js` |

---

## Step 3: Deploy Frontend Utilities

These go in the Wix Velo `public/` directory (visible to both frontend and backend).

### How to Do It

1. In the Wix Editor file tree, click `public/`
2. Create each file and paste the code from `src/public/`

### Public Utility Files (98 files)

| File | Size | What It Does |
|------|------|-------------|
| `designTokens.js` | 9KB | Colors (#E8D5B7 Sand, #3A2518 Espresso, #5B8FA8 Mountain Blue, #E8845C Coral), fonts (Playfair Display, Source Sans 3), spacing |
| `sharedTokens.js` | 3KB | Shared design constants |
| `AddToCart.js` | 12KB | Add to cart button component |
| `ProductDetails.js` | 10KB | Product details display |
| `ProductFinancing.js` | 6KB | Financing calculator display |
| `ProductGallery.js` | 4KB | Image gallery component |
| `ProductOptions.js` | 10KB | Size/finish/variant selector with swatch integration |
| `ProductReviews.js` | 11KB | Reviews display component |
| `ReturnsPortal.js` | 13KB | Self-service returns UI |
| `LiveChat.js` | 9KB | Live chat widget |
| `a11yHelpers.js` | 11KB | Accessibility utilities (ARIA, keyboard nav) |
| `mobileHelpers.js` | 8KB | Mobile-specific touch handling |
| `galleryHelpers.js` | 16KB | Recently viewed, compare bar, product badges |
| `galleryConfig.js` | 3KB | Gallery configuration |
| `engagementTracker.js` | 9KB | Event tracking, analytics |
| `cartService.js` | 5KB | Cart operations |
| `productPageUtils.js` | 4KB | Product page utilities |
| `timeConstants.js` | 3KB | Date/time constants |
| `touchHelpers.js` | 4KB | Touch event handling |
| `safeInit.js` | 3KB | Safe element initialization |
| `placeholderImages.js` | 8KB | Placeholder image URLs |
| `productCache.js` | 3KB | Product data caching |
| `pwaHelpers.js` | 2KB | Progressive Web App support |
| `testProducts.js` | 12KB | Test product data (dev only) |

**New in AR Sprint (Mar 1):**

| File | Size | What It Does |
|------|------|-------------|
| `models3d.js` | 5KB | 3D model catalog — 11 products (futons, frames, murphy beds) with GLB + USDZ URLs, dimensions in meters, content hashes. CDN base: `cdn.carolinafutons.com/models` |
| `arSupport.js` | 2KB | Web AR detection — checks `customElements` support, product eligibility (futons/frames/murphy-beds + in stock + has 3D model) |
| `ProductARViewer.js` | 3KB | AR viewer init — sends model data to Wix HtmlComponent via `postMessage`, shows/hides "View in Room" button, returns `{ destroy }` cleanup |

**New in Sprint 2 (Feb 27-28):**

| File | Size | What It Does |
|------|------|-------------|
| `ComfortStoryCards.js` | 8KB | Illustrated comfort rating cards (Plush/Firm/Medium) |
| `SwatchRequestFlow.js` | 10KB | Free swatch request form with email confirmation |
| `emptyStates.js` | 6KB | Mountain-themed empty states (no results, empty cart) |
| `navigationHelpers.js` | 9KB | Mobile nav, mega menu, search autocomplete |
| `socialProofToast.js` | 5KB | Real-time "X just purchased" toasts |
| `ga4Tracking.js` | 4KB | GA4 ecommerce event helpers |
| `validators.js` | 3KB | Form input validation |
| `ReturnsAdmin.js` | 8KB | Admin returns management UI |

**New in Design Sprint (Feb 28 — PRs #75-#83):**

| File | Size | What It Does |
|------|------|-------------|
| `exitIntentCapture.js` | 6KB | Exit-intent email capture popup (session gating, page exclusions, ARIA, email validation) |
| `FooterSection.js` | 8KB | Extracted footer component (4-column links, newsletter, social icons, trust badges, payment methods) |
| `ProductFinancing.js` | 6KB | Updated: financing calculator with BNPL monthly payments modal |

**New in Mar 1-7 sprints:**

| File | What It Does |
|------|-------------|
| `localBusinessSeo.js` | SSR injection of LocalBusiness/FurnitureStore structured data (Contact + Store Locator) |
| `storeCreditHelpers.js` | Store credit dashboard + checkout auto-apply |
| `roomPlannerHelpers.js` | Room dimension formatting, scale calculation, placement labels |
| `buyingGuidesHelpers.js` | Buying guide category filtering + reading time |
| `faqSeo.js` | FAQ page structured data helpers |
| `categoryFilterHelpers.js` | Category page filter optimization |
| `MountainSkylineFigma.js` | Figma-pipeline header skyline (replaces MountainSkyline.js) |
| `CartIllustrationsFigma.js` | Figma-pipeline cart illustrations |
| `OnboardingIllustrationsFigma.js` | Figma-pipeline onboarding illustrations |
| `aboutContactHelpers.js` | About/Contact page shared helpers |
| `affiliateHelpers.js` | Affiliate program frontend |
| `consultationHelpers.js` | Virtual consultation booking |
| `financingPageHelpers.js` | Financing page calculator helpers |
| `flashSaleHelpers.js` | Flash sale countdown + urgency |
| `footerContent.js` | Footer content data |
| `loyaltyHelpers.js` | Loyalty tier display helpers |
| `schedulerHelpers.js` | Delivery scheduling frontend |
| `sustainabilityHelpers.js` | Sustainability page helpers |
| `tradeHelpers.js` | Trade program frontend |
| `ugcVoting.js` | UGC gallery voting |
| `WishlistCardButton.js` | Wishlist heart button component |
| `performanceHelpers.js` | Performance monitoring helpers |
| `checkoutProgress.js` | Checkout step progress indicator |
| `checkoutValidation.js` | Checkout form validation |

**Also deploy `public/product/` subdirectory with:**

| File | What It Does |
|------|-------------|
| `swatchSelector.js` | Fabric swatch selection UI, gallery lightbox, "Request Free Swatches" form |
| `variantSelector.js` | Size/Finish variant pricing & image switching |
| `cartEnhancements.js` | Urgency badges, progress bar, cross-sell in cart |
| `crossSell.js` | "Complete the Set" product recommendations |
| `productDetails.js` | Tabbed details (Description, Specs, Care, Shipping) |
| `productGallery.js` | Multi-image gallery with zoom & fullscreen |
| `productSchema.js` | Product page JSON-LD schema generation |
| `socialWishlist.js` | Social sharing & wishlist integration |

---

## Step 4: Create CMS Collections

### What is a CMS Collection?

Think of it as a spreadsheet in the cloud. You define columns (fields), then add rows (items). Your website reads from these spreadsheets to display dynamic content.

**Example:** The "Products" collection has columns for Name, Price, Description, Images. Each row is a product. When someone visits `/products/bali`, the Product Page reads the "Bali" row and displays it.

### How to Create a Collection

1. Go to **Wix Dashboard** (not the Editor)
2. Click **CMS** in the left sidebar (or "Content Manager")
3. Click **+ Create Collection**
4. Name it exactly as shown below (spelling matters!)
5. Add each field with the correct type
6. Set Permissions: "Site content" for most, "Form submissions" for ContactSubmissions

### Priority Collections (create these 16 first)

| # | Collection Name | Fields | Used By |
|---|----------------|--------|---------|
| 1 | `ContactSubmissions` | email (Text, indexed), name, phone, subject, message (Rich Text), submittedAt (Date, indexed), status, source, notes, productId, productName | Contact form, newsletter, swatch requests |
| 2 | `ProductAnalytics` | productId (Text, indexed), productName, category, viewCount (Number, default 0), lastViewed (Date), addToCartCount (Number), purchaseCount (Number) | Product tracking, recommendations |
| 3 | `Promotions` | title, subtitle, theme, heroImage (Image), startDate (Date), endDate (Date), discountCode, discountPercent (Number), ctaUrl, ctaText, isActive (Boolean, indexed) | Homepage banners, sale pages |
| 4 | `EmailQueue` | recipientEmail (indexed), recipientName, sequenceType, step (Number), status (indexed), scheduledFor (Date, indexed), sentAt, templateId, variables (Rich Text), openedAt, clickedAt, errorMessage, retryCount, lastRetryAt | Email automation |
| 5 | `Unsubscribes` | email (Text, indexed), unsubscribedAt (Date), source | Email opt-out |
| 6 | `AbandonedCarts` | checkoutId (indexed), buyerEmail (indexed), cartTotal (Number), abandonedAt (Date, indexed), status (indexed), recoveryEmailSent (Boolean), lastEmailSent (Date) | Cart recovery |
| 7 | `Fulfillments` | orderId (indexed), trackingNumber (indexed), carrier, serviceType, labelUrl, labelCreatedDate, estimatedDelivery, status (indexed), lastStatusUpdate, shipFromAddress, shipToAddress, packageWeight, packageDimensions | Order tracking |
| 8 | `GiftCards` | code (Text, indexed), balance (Number), originalBalance (Number), purchaserEmail, recipientEmail, status (indexed), expirationDate (Date, indexed), createdDate | Gift cards |
| 9 | `DeliverySchedule` | orderId (indexed), date (Date, indexed), timeWindow, type (indexed), status (indexed), customerName, address | White-glove delivery |
| 10 | `AssemblyGuides` | sku (Text, indexed), title, instructions (Rich Text), videoUrl (URL), difficulty, estimatedTime, category (indexed) | Assembly help |
| 11 | `FabricSwatches` | swatchId (Text, unique), swatchName, swatchImage (Image), colorFamily (indexed), colorHex, material, careInstructions, availableForProducts (Tags, indexed), sortOrder (Number) | Swatch system |
| 12 | `ProductBundles` | bundleId (indexed), bundleName, primaryProductId (indexed), bundledProductIds, discountPercent (Number), isActive (Boolean, indexed) | Bundle pricing |
| 13 | `CustomerEngagement` | memberId (indexed), eventType (indexed), eventData, timestamp (Date, indexed), source, productId | Engagement tracking |
| 14 | `ReviewRequests` | orderId, buyerEmail, productId, scheduledDate (Date, indexed), sentAt, status (indexed) | Post-purchase review asks |
| 15 | `ReferralCodes` | code (Text, indexed), memberId (indexed), referrerCredit (Number), friendDiscount (Number), usedBy, usedAt (Date), status | Referral program |
| 16 | `Videos` | title, url (URL), productId (indexed), category (indexed), viewCount (Number), isFeatured (Boolean), thumbnailUrl | Product videos |

### Auto-Created Collections (50+)

These are created automatically by the backend code on first use. You don't need to make them manually:

Wishlist, WishlistAlertPrefs, WishlistAlertsSent, PriceHistory, BackInStockSignups, BrowseSessions, BrowseRecoveryEmails, EmailEvents, SupportTickets, ChatMessages, Testimonials, PhotoReviews, DeliveryTracking, DeliverySurveys, RoomLayouts, AbTests, AbEvents, CheckoutAnalytics, CompareHistory, InventoryLog, NotificationLog, MemberPreferences, CoPurchasePatterns, BundleAnalytics, ProductMedia, LoyaltyAccounts, Coupons, and more.

---

## Step 5: Configure Secrets

Secrets are passwords/API keys that your code needs but shouldn't be visible in the code itself. Wix stores them encrypted.

### How to Do It

1. Go to **Wix Dashboard > Settings > Secrets Manager**
2. Click **+ New Secret**
3. Name it exactly as shown, paste the value

### Required Secrets (8)

| Secret Name | What It Is | Where to Get It |
|-------------|-----------|-----------------|
| `UPS_CLIENT_ID` | UPS API OAuth client ID | [developer.ups.com](https://developer.ups.com) — register for API access |
| `UPS_CLIENT_SECRET` | UPS API OAuth secret | Same UPS developer portal |
| `UPS_ACCOUNT_NUMBER` | Your UPS shipper account number | Your UPS account settings |
| `UPS_SANDBOX` | Set to `"true"` for testing, `"false"` for live | You choose |
| `SITE_OWNER_CONTACT_ID` | Brenda's Wix contact UUID | Dashboard > Contacts > click Brenda > copy ID from URL |
| `WIX_BACKEND_KEY` | Backend API authentication key | Dashboard > Settings > API Keys |
| `WELCOME_DISCOUNT_CODE` | 10% welcome email discount code (e.g., "WELCOME10") | You create in Dashboard > Marketing > Coupons |
| `RECOVERY_DISCOUNT_CODE` | Cart recovery incentive code (e.g., "COMEBACK15") | You create in Dashboard > Marketing > Coupons |

---

## Step 6: Install Plugins

### Dashboard Plugins (5 minutes each, all free)

**Click-path: Dashboard > Marketing & SEO > Marketing Integrations**

| Plugin | How to Install | What It Does |
|--------|---------------|-------------|
| **Google Analytics 4** | Marketing Integrations > Connect Google Analytics > paste Measurement ID (G-XXXXXXXXX) | Tracks page views, product clicks, purchases. Our `analyticsHelpers.web.js` fires events that GA4 captures automatically |
| **Meta Pixel (Facebook)** | Tracking & Analytics > + New Tool > Facebook Pixel > paste Pixel ID | Tracks visitors for Facebook/Instagram retargeting ads |
| **Pinterest Tag** | Tracking & Analytics > + New Tool > Pinterest Tag > paste Tag ID | Tracks conversions for Pinterest ads, pairs with our Rich Pin meta tags |

**Click-path: Dashboard > Settings**

| Plugin | How to Install | What It Does |
|--------|---------------|-------------|
| **Wix Chat** | Settings > toggle ON (or App Market > Wix Chat) | Live chat bubble on every page. Zero code needed |
| **Wix Bookings** | App Market > Wix Bookings > Add to Site | Showroom appointment scheduling for Hendersonville |

**Click-path: Dashboard > App Market (search bar)**

| Plugin | How to Install | What It Does |
|--------|---------------|-------------|
| **Klaviyo** | App Market > search "Klaviyo" > Add to Site > connect account | Advanced email/SMS marketing, replaces basic emails. Free up to 250 contacts |
| **Stamped.io** | App Market > search "Stamped" > Add to Site | Visual product reviews with photo upload. Free tier available |

### Connect Product Feeds

| Feed | URL to Connect | Where |
|------|---------------|-------|
| **Google Merchant Center** | `https://carolinafutons.com/_functions/googleMerchantFeed` | Google Merchant Center dashboard > Feeds > add URL feed |
| **Facebook Catalog** | `https://carolinafutons.com/_functions/facebookCatalogFeed` | Facebook Commerce Manager > Catalog > Data Sources > add URL |

### Do NOT Install

These are handled by our code — installing plugins would duplicate/conflict:

- SEO plugins (we have `seoHelpers.web.js`)
- Cookie consent (Wix built-in)
- Image optimization (Wix native)
- Shipping calculator apps (we have `shipping-rates-plugin.js`)
- Product recommendation apps (we have `productRecommendations.web.js`)

---

## Step 7: Import Product Catalog

### The Easy Way

After deploying `catalogImport.web.js` to backend/:

1. Open your site in the Wix Editor with Dev Mode on
2. Open any page's code panel
3. In the bottom console, run:

```javascript
import { importProducts, validateImportData } from 'backend/catalogImport.web.js';

// Load your catalog data (from content/catalog-MASTER.json)
const catalogData = /* paste the JSON array here or fetch from URL */;

// Step 1: Validate (checks for errors without importing)
const validation = await validateImportData(catalogData);
console.log('Validation:', validation);

// Step 2: Dry run (simulates import, shows what would happen)
const dryRun = await importProducts(catalogData, { dryRun: true });
console.log('Dry run:', dryRun);

// Step 3: Live import (actually creates/updates products)
const result = await importProducts(catalogData, { dryRun: false, updateExisting: true });
console.log('Import result:', result);
```

### What Gets Imported

88 products across 7 categories:

| Category | Count | Price Range |
|----------|-------|-------------|
| Futon Frames | 26 | $529–$859 |
| Platform Beds | 18 | $224–$420 |
| Futon Mattresses | 16 | $0 (contact) – $759 |
| Murphy Cabinet Beds | 9 | $1,399–$2,978 |
| Bedroom Furniture | 9 | $343–$1,098 |
| Accessories | 8 | $35–$269 |
| Log Futon Frames | 2 | $903–$1,031 |

### Pricing Decision Needed

14 products show $0.00 (all Otis Bed mattresses — Yuma, Cambridge, Sedona, etc.). These are "Contact for availability" items. Options:

1. **Add real prices** in the catalog JSON before importing
2. **Keep $0 and show "Request Quote" button** — the Product Page code already supports this

---

## Step 8: Email Templates

### How Wix Triggered Emails Work

1. Go to **Dashboard > Marketing > Triggered Emails**
2. Click **+ Create New**
3. Design the email using Wix's drag-and-drop email editor
4. Add **merge variables** (dynamic content) using the `{variable}` syntax
5. Save with the exact Template ID shown below

### Templates to Create (priority order)

**P0 — Create before launch (site breaks without these):**

| Template ID | Subject Line | Merge Variables |
|------------|-------------|-----------------|
| `contact_form_submission` | New Contact Form: {subject} | customerName, customerEmail, customerPhone, subject, message, submittedAt |
| `new_order_notification` | New Order #{orderNumber} | orderNumber, customerName, total, itemCount |

**P1 — Create first week (fires on member signup):**

| Template ID | Subject Line | Merge Variables |
|------------|-------------|-----------------|
| `welcome_series_1` | Welcome to Carolina Futons! | firstName, discountCode |
| `welcome_series_2` | Your Futon Buying Guide | firstName |
| `welcome_series_3` | See What Our Customers Say | firstName |

**P2 — Create when ready (fires on order):**

| Template ID | Subject Line | Merge Variables |
|------------|-------------|-----------------|
| `swatch_confirmation` | Your Free Swatches Are On Their Way! | customerName, productName, swatchList, estimatedArrival |
| `post_purchase_1` | Your Order is Confirmed! | firstName, orderNumber, total, productNames |
| `post_purchase_2` | Assembly Tips for Your New Futon | firstName, productNames |
| `post_purchase_3` | How's Your New Futon? | firstName |

**P3 — Cart recovery (requires scheduled job):**

| Template ID | Subject Line | Merge Variables |
|------------|-------------|-----------------|
| `cart_recovery_1` | You left something behind! | buyerName, cartTotal, itemSummary |
| `cart_recovery_2` | Still thinking it over? | buyerName, cartTotal, itemSummary |
| `cart_recovery_3` | Last chance — 10% off your cart | buyerName, cartTotal, discountCode |

**P4+ — Later:**

`browse_recovery_1/2/3`, `price_drop_alert`, `back_in_stock_alert`, `reengagement_1`

### Email Design Colors

Use these to match the site brand:
- Background: Sand #E8D5B7
- Text: Espresso #3A2518
- Buttons: Mountain Blue #5B8FA8
- Accents: Sunset Coral #E8845C

---

## Step 9: Scheduled Jobs

### What Are Scheduled Jobs?

They're tasks that run automatically on a timer — like a dishwasher that starts every night at midnight. These power our automated email sequences.

### How to Set Up

Create a file called `jobs.config` in the Wix `backend/` directory:

```json
{
  "jobs": [
    {
      "functionLocation": "/cartRecovery.web.js",
      "functionName": "processAbandonedCarts",
      "description": "Check for abandoned carts and send recovery emails",
      "executionConfig": {
        "cronExpression": "*/30 * * * *"
      }
    },
    {
      "functionLocation": "/browseAbandonment.web.js",
      "functionName": "processBrowseRecovery",
      "description": "Send browse abandonment recovery emails",
      "executionConfig": {
        "cronExpression": "0 * * * *"
      }
    },
    {
      "functionLocation": "/emailAutomation.web.js",
      "functionName": "processEmailQueue",
      "description": "Process queued emails (welcome, post-purchase, etc.)",
      "executionConfig": {
        "cronExpression": "*/5 * * * *"
      }
    },
    {
      "functionLocation": "/inventoryAlerts.web.js",
      "functionName": "checkLowStock",
      "description": "Check inventory levels and alert on low stock",
      "executionConfig": {
        "cronExpression": "0 * * * *"
      }
    }
  ]
}
```

| Job | Runs | What It Does |
|-----|------|-------------|
| Cart Recovery | Every 30 min | Finds carts abandoned >1 hour, sends recovery email |
| Browse Recovery | Every hour | Finds browse sessions that didn't add to cart, sends nudge |
| Email Queue | Every 5 min | Processes queued welcome/post-purchase/win-back emails |
| Inventory Alerts | Every hour | Checks stock levels, alerts on low inventory |

---

## Step 10: Publish & Verify

### Publishing

1. In the Wix Editor, click **Publish** (top-right blue button)
2. Choose "Latest commit from default branch"
3. Wait for confirmation
4. Your site is now live on Wix's CDN worldwide

### Domain Connection

1. Go to **Dashboard > Settings > Domains**
2. Click **Connect a Domain**
3. Enter `carolinafutons.com`
4. Wix will tell you exactly what DNS records to set (usually just changing nameservers)
5. SSL certificate is automatic — Wix handles HTTPS

### Verification Checklist

Test each of these after publishing:

```
[ ] Homepage loads — hero image, 6 category cards, featured products visible
[ ] Category page — click "Futon Frames", verify grid shows products with prices
[ ] Filters work — select a price range, verify grid updates
[ ] Product page — click any product, verify gallery, description, price, variants
[ ] Add to Cart — click "Add to Cart", verify side cart opens with item
[ ] Shipping calculator — enter ZIP code in cart, verify UPS rates appear
[ ] Checkout — proceed through checkout with test payment
[ ] Thank You page — verify confirmation, delivery timeline, social share buttons
[ ] Member signup — create account, verify welcome email triggers
[ ] Account dashboard — verify order history, wishlist, loyalty points
[ ] Cart abandonment — add item, leave site, verify email arrives after 1 hour
[ ] Search — type "murphy bed" in search bar, verify results
[ ] Order tracking — enter a test order number, verify tracking page
[ ] Mobile — test all above on phone
[ ] AR viewer — on Asheville Full product page, click "View in Room", verify 3D model loads
[ ] AR viewer — hidden on products without 3D models (covers, accessories)
[ ] AR viewer — iOS Safari: tap AR icon → Quick Look opens
[ ] AR viewer — out-of-stock product hides "View in Room" button
```

---

## Swatch Hookup

### What the Swatch System Does

Customers can browse fabric/wood finish options for each product. They see color swatches (colored dots) on category pages, a full swatch gallery on product pages, and can request free physical swatches mailed to them.

### Architecture

```
FabricSwatches CMS Collection
        ↓
swatchService.web.js (4 API methods)
        ↓
swatchSelector.js (frontend UI)
        ↓
Product Page (swatch gallery, color dots, request form)
```

### Step-by-Step

1. **Create the FabricSwatches collection** (see Step 4 above — collection #11)

2. **Add swatch data** — each swatch needs:
   - `swatchId`: unique identifier (e.g., "cherry", "chocolate-twill")
   - `swatchName`: display name (e.g., "Cherry", "Chocolate Twill")
   - `swatchImage`: square photo (~300x300px) uploaded to Wix Media Manager
   - `colorFamily`: for the filter dropdown (e.g., "Browns", "Reds", "Blues")
   - `colorHex`: hex color code for dot preview (e.g., "#8B4513")
   - `material`: fabric/wood type (e.g., "Cotton Twill", "Solid Hardwood")
   - `availableForProducts`: which products can use this swatch — enter product IDs separated by commas, or "all" for universal swatches
   - `sortOrder`: display order (1 = first)

3. **Current finishes on the live site** (28 colors from the MCP scrape):
   Antique Blue, Bakar, Black Walnut, Brushed Driftwood, Buttercream, Charcoal, Cherry, Chocolate, Clear, Dark Cherry, Espresso, Gray, Harvest Brown, Honey Pine, Natural, Normandy, Provence, Red, Seafoam, Skye, Stonewash Gray, Teal, Vintage White, Warm Cherry, White, White Bark, Wildwood Brown, Wildwood Vintage White

   These are **wood finishes** (for frames). Fabric swatches for futon covers would come from Night & Day or other suppliers.

4. **The code is deployed** — once you create the CMS collection and add data, the swatch selector on the Product Page will automatically query `swatchService.web.js` and display available swatches.

5. **"Request Free Swatches"** — customers can select swatches and enter their mailing address. The form calls `emailService.web.js → submitSwatchRequest()`, which saves to the ContactSubmissions collection with `status: 'swatch_request'` and emails you the request. **A confirmation email is also sent to the customer** via the `swatch_confirmation` triggered email template (see Step 8).

6. **Swatch Request Flow UI** — `SwatchRequestFlow.js` in `public/` provides the full frontend swatch request form. It handles swatch selection, address input, and submission. The flow clears previous selections on init to prevent stale state.

### API Methods (already built)

```javascript
// Get all swatches available for a product
const swatches = await getProductSwatches('product-id', 'Blues', 50);

// Get color family names for filter dropdown
const families = await getAllSwatchFamilies(); // ['Blues', 'Browns', 'Reds', ...]

// Get swatch count
const count = await getSwatchCount('product-id'); // 24

// Get preview dots for category grid cards
const dots = await getSwatchPreviewColors('product-id', 4);
// [{ colorHex: '#8B4513', swatchName: 'Cherry' }, ...]
```

---

## Social Media Platform Hookup

Everything you need to connect Pinterest, Instagram, Facebook, Google Shopping, and TikTok. Our code already generates the product feeds and meta tags — you just need to connect the accounts.

### Pinterest (Highest Priority for Furniture)

**Why first:** Pinterest is #1 for furniture discovery. Pins last months. Users actively search for room ideas.

**Step 1: Create Pinterest Business Account**
1. Go to [business.pinterest.com](https://business.pinterest.com) > Create Account (or convert personal)
2. Claim your website: Settings > Claim > enter `carolinafutons.com`
3. Pinterest will ask you to add an HTML tag or DNS record — choose DNS (TXT record)

**Step 2: Enable Rich Pins**
1. Our code (`seoHelpers.web.js` + `pinterestRichPins.web.js`) already injects Open Graph meta tags on every product page
2. Go to [Pinterest Rich Pin Validator](https://developers.pinterest.com/tools/url-debugger/) > paste any product page URL
3. Click "Validate" — should show Product Rich Pin with price, availability, title
4. Click "Apply" to enable Rich Pins site-wide

**Step 3: Connect Product Catalog Feed**
1. Pinterest Business > Catalogs > + Add data source
2. Feed URL: `https://carolinafutons.com/_functions/pinterestProductFeed`
3. Format: XML (auto-detected)
4. Refresh: Daily automatic
5. Pinterest will ingest all 88 products and create shoppable pins automatically

**Step 4: Install Pinterest Tag (Conversion Tracking)**
1. Wix Dashboard > Marketing & SEO > Tracking & Analytics > + New Tool
2. Select Pinterest Tag > paste your Tag ID (from Pinterest Ads Manager > Conversions)
3. Our `analyticsHelpers.web.js` fires `trackEvent()` events that the tag captures

**Step 5: Create Boards**
- Futon Living Rooms (3-4 pins/week)
- Small Space Solutions (2-3 pins/week)
- Mountain Home Inspiration (2-3 pins/week)
- Before & After (1-2 pins/week)
- Bedroom Makeovers (2-3 pins/week)
- Shop Our Products (auto-sync from catalog feed)

### Instagram / Facebook (Shared Commerce Setup)

Instagram Shopping and Facebook Shop use the same catalog. Set up once, works on both.

**Step 1: Create Facebook Business Page** (if not already)
1. [business.facebook.com](https://business.facebook.com) > Create Page
2. Business name: Carolina Futons
3. Complete: address, phone (828) 252-9449, hours Wed-Sat 10am-5pm, category: Furniture Store
4. CTA button: "Shop Now" > carolinafutons.com

**Step 2: Connect Facebook Catalog**
1. Go to Facebook Commerce Manager > Catalog > Data Sources
2. Click "Add Items" > "Use Data Feed"
3. Feed URL: `https://carolinafutons.com/_functions/facebookCatalogFeed`
4. Schedule: Daily refresh
5. This auto-populates both Facebook Shop and Instagram Shopping

**Step 3: Install Meta Pixel (Conversion Tracking)**
1. Wix Dashboard > Marketing & SEO > Tracking & Analytics > + New Tool
2. Select Facebook Pixel > paste your Pixel ID (from Meta Events Manager)
3. Events automatically tracked: PageView, ViewContent, AddToCart, Purchase

**Step 4: Enable Instagram Shopping**
1. Instagram app > Settings > Business > Set up Instagram Shopping
2. Connect your Facebook Catalog (from step 2)
3. Submit for review (takes 1-3 days)
4. Once approved: tag products in feed posts, Stories, and Reels

**Step 5: Facebook/Instagram Ads (Retargeting)**
- The Meta Pixel tracks every visitor automatically
- In Ads Manager > Audiences > create Custom Audience from website visitors
- Start with retargeting: people who viewed products but didn't buy
- Budget: $10-15/day initially, carousel ads showing viewed products

### Google Shopping / Merchant Center

**Step 1: Set Up Google Merchant Center**
1. Go to [merchants.google.com](https://merchants.google.com) > Create Account
2. Verify your website (DNS or HTML tag method)
3. Business info: Carolina Futons, 824 Locust St Ste 200, Hendersonville NC 28792

**Step 2: Connect Product Feed**
1. Merchant Center > Products > Feeds > + Create Feed
2. Country: US, Language: English
3. Feed type: "Scheduled fetch" (URL)
4. Feed URL: `https://carolinafutons.com/_functions/googleMerchantFeed`
5. Fetch schedule: Daily
6. Feed includes all 88 products with: title, description, price, image, availability, category, brand

**Step 3: Install GA4 (Required for Shopping Ads)**
1. Wix Dashboard > Marketing Integrations > Connect Google Analytics
2. Paste your GA4 Measurement ID (G-XXXXXXXXX)
3. Our `analyticsHelpers.web.js` fires ecommerce events (view_item, add_to_cart, purchase) that GA4 captures

**Step 4: Link to Google Ads**
1. In Merchant Center > Settings > Linked accounts > Google Ads
2. Start with Shopping campaigns targeting top 10 products
3. Budget: $30-50/day, target Western NC + 200-mile radius
4. Performance Max later (after 30+ conversions for smart bidding)

### TikTok (Optional — If Targeting Younger Audience)

**Step 1: TikTok Business Account**
1. Create a TikTok Business account at [ads.tiktok.com](https://ads.tiktok.com)
2. Install TikTok Pixel via Wix: Dashboard > Tracking & Analytics > + New Tool > Custom > paste TikTok Pixel code

**Step 2: Content Strategy**
- Room transformations (before/after reveals)
- Assembly time-lapses
- "Futons in 2026 are NOT what you remember" myth-busting
- Day-in-the-life at the showroom
- 3-5 videos/week, best times: 7-9am, 12-3pm, 7-11pm EST

### Social Feed URLs Summary

| Platform | Feed URL | What It Powers |
|----------|----------|---------------|
| Google Merchant | `/_functions/googleMerchantFeed` | Shopping ads, free product listings |
| Facebook/Instagram | `/_functions/facebookCatalogFeed` | FB Shop, IG Shopping, dynamic ads |
| Pinterest | `/_functions/pinterestProductFeed` | Rich Pins, shoppable pins, catalog |

All three feeds are generated by `http-functions.js` and `googleMerchantFeed.web.js` / `pinterestRichPins.web.js`. They auto-update when products change in Wix Stores.

---

## Web AR "View in Room" Hookup

### What It Does

Customers can view 3D models of futons, frames, and murphy beds right on the product page. Click "View in Room" and a 3D viewer appears using Google `<model-viewer>`. On iOS, it opens AR Quick Look (place furniture in your room via camera). On Android, it opens Scene Viewer. On desktop, you get a 3D preview you can rotate and zoom.

**Zero page load impact** — the viewer only loads when the customer clicks the button.

### Architecture

```
Product Page loads
  → arSupport.isProductAREnabled(product) checks:
      1. Is product in AR category? (futons, frames, murphy-beds)
      2. Is product in stock?
      3. Does it have a 3D model in models3d.js catalog?
  → YES: Show "View in Room" button
  → Customer clicks button:
      → models3d.getModel3DForProduct(id) gets GLB + USDZ URLs
      → ProductARViewer sends model data to HtmlComponent via postMessage
      → HtmlComponent loads <model-viewer> with the 3D model
```

### Step-by-Step Wix Studio Setup

**1. Create elements on the Product Page:**

| Element | Type | ID | Notes |
|---------|------|----|-------|
| View in Room Button | Button | `#viewInRoomBtn` | Place below product gallery. Text: "View in Room" or "View in AR". Style: Mountain Blue bg, white text. Add a 3D/AR icon if available. |
| AR Viewer Container | Box | `#arViewerContainer` | Place below the button (or wherever you want the 3D viewer). Set to **Collapsed on Load** in the Properties panel. Size: 100% width, 400px height recommended. |
| AR Viewer | HtmlComponent | `#productARViewer` | Drag an "HTML iframe" element inside `#arViewerContainer`. This is where `<model-viewer>` renders. |

**2. Configure the HtmlComponent (`#productARViewer`):**

In the Wix Editor, click on the HtmlComponent and paste this HTML into the "Enter Code" section:

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; overflow: hidden; }
    model-viewer {
      width: 100%;
      height: 100%;
      --poster-color: transparent;
    }
  </style>
</head>
<body>
  <model-viewer id="viewer"
    camera-controls
    touch-action="pan-y"
    ar
    ar-modes="webxr scene-viewer quick-look"
    shadow-intensity="1"
    style="width: 100%; height: 400px;">
  </model-viewer>

  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
  <script>
    window.addEventListener('message', (event) => {
      if (event.data.type === 'loadModel') {
        const viewer = document.getElementById('viewer');
        viewer.src = event.data.glbUrl;
        viewer.setAttribute('ios-src', event.data.usdzUrl);
        viewer.setAttribute('alt', event.data.title + ' — 3D View');
      }
    });
  </script>
</body>
</html>
```

**3. That's it for Wix Studio.** The code handles everything else:
- Button visibility (auto-hides if product doesn't have a 3D model)
- Model loading on click
- Container expand/collapse
- Cleanup on page navigation

### Products with 3D Models (11 total)

| Product ID | Product | Category | Has Fabric Variants |
|-----------|---------|----------|-------------------|
| `prod-murphy-queen-vertical` | Murphy Queen Vertical | Murphy Beds | No |
| `prod-murphy-full-horizontal` | Murphy Full Horizontal | Murphy Beds | No |
| `prod-murphy-queen-bookcase` | Murphy Queen Bookcase | Murphy Beds | No |
| `prod-murphy-twin-cabinet` | Murphy Twin Cabinet | Murphy Beds | No |
| `prod-murphy-queen-desk` | Murphy Queen w/ Desk | Murphy Beds | No |
| `prod-murphy-full-storage` | Murphy Full Storage | Murphy Beds | No |
| `prod-asheville-full` | Asheville Full Futon | Futons | Yes |
| `prod-blue-ridge-queen` | Blue Ridge Queen Futon | Futons | Yes |
| `prod-pisgah-twin` | Pisgah Twin Futon | Futons | Yes |
| `prod-biltmore-loveseat` | Biltmore Loveseat Futon | Futons | Yes |
| `prod-hardwood-frame` | Hardwood Frame | Frames | No |

**Important:** The `productId` in this table must match the product's `_id` field in the Wix Stores collection. If your Wix product IDs are different, update `src/public/models3d.js` to match.

### 3D Model Assets (CDN Setup)

The code expects GLB and USDZ model files hosted at `https://cdn.carolinafutons.com/models/`.

**For initial testing:** The Asheville Full model uses a public Khronos sample model (SheenChair.glb) — this will work immediately without any CDN setup. All other models point to `cdn.carolinafutons.com` which will need real 3D model files uploaded.

**To get real 3D models:**
1. Commission 3D scans from a service (e.g., CGTrader, TurboSquid) or photograph products for photogrammetry
2. Export in GLB format (for web/Android) and USDZ format (for iOS AR Quick Look)
3. Upload to your CDN at the paths defined in `models3d.js`
4. Update content hashes if file content changes

### Verification Checklist (AR Feature)

```
[ ] #viewInRoomBtn visible on Asheville Full product page (the one with the sample model)
[ ] #viewInRoomBtn hidden on products without AR models (e.g., covers, accessories)
[ ] Click "View in Room" — 3D model appears in the embedded viewer
[ ] Rotate model with mouse/touch drag
[ ] Zoom with scroll/pinch
[ ] iOS Safari: tap AR icon → AR Quick Look opens (places model in real room)
[ ] Android Chrome: tap AR icon → Scene Viewer opens
[ ] Navigate away from product page → viewer collapses (no memory leak)
[ ] Out-of-stock product → "View in Room" button hidden even if model exists
[ ] Page load speed unchanged (model-viewer loads only on button click)
```

### SEO Social Tags (Already Built)

Our code automatically generates these meta tags on every page (via `seoHelpers.web.js` + `masterPage.js`):

| Tag Type | Purpose | Status |
|----------|---------|--------|
| Open Graph (`og:title`, `og:image`, etc.) | Facebook/LinkedIn sharing previews | Built |
| Twitter Cards (`twitter:card`, `twitter:image`) | Twitter/X sharing previews | Built |
| Pinterest Rich Pins (`product:price:amount`, etc.) | Product Rich Pin data | Built |
| JSON-LD Product schema | Google rich results (price, rating, availability) | Built |
| JSON-LD LocalBusiness schema | Google Maps, knowledge panel | Built |

## Room Planner Hookup

**Backend:** `roomPlanner.web.js` — CRUD for room layouts, dimension validation, furniture placement
**Frontend:** `roomPlannerHelpers.js` — Canvas interactions, drag/drop, measurement display
**Page:** `Room Planner.js` — Full interactive page (merged PR #207)
**CMS:** `RoomLayouts` collection — stores saved room designs per member

### Wix Studio Setup

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Room Canvas | HtmlComponent | `#roomCanvas` | Main interactive area. 100% width, 600px min height. |
| Dimension Inputs | Input | `#roomWidth`, `#roomLength` | Number inputs for room dimensions (feet). Min 5, max 50. |
| Furniture Palette | Repeater | `#furniturePalette` | Draggable product thumbnails from catalog. |
| Save Layout Button | Button | `#saveLayoutBtn` | Requires member login. Saves to RoomLayouts CMS. |
| Reset Button | Button | `#resetRoomBtn` | Clears canvas to empty room state. |
| Screenshot Button | Button | `#screenshotBtn` | Captures canvas as PNG for sharing/saving. |

### Verification Checklist

```
[ ] Room dimensions accept valid range (5-50 ft), reject invalid
[ ] Furniture items drag from palette to canvas
[ ] Placed items can be rotated, resized, and deleted
[ ] Save requires member login (redirect to login if logged out)
[ ] Saved layouts appear in Member Page "My Room Plans" section
[ ] Reset clears all placed items
[ ] Mobile: touch drag works, palette scrolls horizontally
```

---

## Wishlist Alerts Hookup

**Backend:** `wishlistAlerts.web.js` — Price drop, back-in-stock, and low-stock email notifications
**Frontend:** `WishlistCardButton.js` — Heart toggle on product cards
**Page Integration:** `Member Page.js` — Wishlist management tab (merged PR #211)
**CMS:** `Wishlist`, `WishlistAlertPrefs` collections

### Wix Studio Setup

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Wishlist Heart | Button | `#wishlistHeart` | On every product card. Toggle adds/removes from wishlist. |
| Alert Preferences | Repeater | `#alertPrefsRepeater` | In Member Page. Shows per-item alert toggles (price drop, back-in-stock). |
| Wishlist Grid | Repeater | `#wishlistGrid` | In Member Page. Shows all wishlisted products with current price and status. |
| Move to Cart | Button | `#moveToCartBtn` | Per-item button in wishlist grid. Adds to cart and removes from wishlist. |

### Email Triggers

| Trigger | Backend Method | Template |
|---------|---------------|----------|
| Price drops ≥10% | `checkPriceDropAlerts()` | `PriceDropAlert` triggered email |
| Item back in stock | `checkBackInStockAlerts()` | `BackInStockAlert` triggered email |
| Low stock (≤5 units) | `checkLowStockAlerts()` | `LowStockAlert` triggered email |

### Verification Checklist

```
[ ] Heart button toggles on product cards (filled = wishlisted)
[ ] Wishlisted items appear in Member Page wishlist tab
[ ] Alert preferences toggle per-item (price drop, back-in-stock)
[ ] Move to Cart transfers item correctly
[ ] Price drop email fires when product price decreases ≥10%
[ ] Back-in-stock email fires when inventory goes from 0 to >0
[ ] imageUrl validated as http/https only (no javascript: or data: URIs)
[ ] Missing price stored as null (not 0) to prevent false alerts
```

---

## Store Credit Hookup

**Backend:** `storeCreditService.web.js` — Issue, redeem, check balance, transaction history
**Frontend:** `storeCreditHelpers.js` — Balance display, redemption UI, status colors
**Page Integration:** `Member Page.js` (balance display), `Checkout.js` (redemption), `Thank You Page.js` (earning)
**CMS:** `StoreCredits` collection — balance, transactions, expiry per member

### Wix Studio Setup

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Credit Balance | Text | `#storeCreditBalance` | In Member Page header. Shows current balance formatted as currency. |
| Transaction History | Repeater | `#creditHistoryRepeater` | In Member Page. Lists earned/spent/expired transactions with dates. |
| Apply Credit Toggle | Checkbox | `#applyStoreCredit` | In Checkout. Toggles store credit application to order total. |
| Credit Applied Amount | Text | `#creditAppliedAmount` | In Checkout. Shows amount being applied. |

### How Credits Are Earned

| Action | Credit Amount | Backend Method |
|--------|-------------|---------------|
| Referral signup | Configurable | `issueReferralCredit()` |
| Product review | Configurable | `issueReviewCredit()` |
| Return refund (store credit option) | Order amount | `issueReturnCredit()` |
| Promotion/gift | Variable | `issuePromoCredit()` |

### Verification Checklist

```
[ ] Member Page shows current store credit balance
[ ] Transaction history lists all credit events with dates
[ ] Checkout "Apply Store Credit" reduces order total
[ ] Credits cannot exceed order total (partial application)
[ ] Zero balance hides the apply option in checkout
[ ] Credits have expiry dates, expired credits are excluded
[ ] Credit issuance requires valid member authentication
```

---

## Module Reference (Quick Lookup)

### By Capability

| Capability | Backend Module | Frontend Module | CMS Collection |
|-----------|---------------|----------------|----------------|
| **Product catalog** | catalogImport, catalogContent | ProductDetails, ProductOptions | Stores/Products |
| **Shopping cart** | — (Wix native) | cartService, AddToCart, Side Cart | — |
| **Checkout** | checkoutOptimization, shipping-rates-plugin | — | — |
| **Shipping rates** | ups-shipping, shipping-rates-plugin | — | — |
| **Order fulfillment** | fulfillment, deliveryExperience | — | Fulfillments |
| **Order tracking** | orderTracking | — | — |
| **Delivery scheduling** | deliveryScheduling | — | DeliverySchedule |
| **Product search** | searchService | Search Results page | — |
| **Category filtering** | categorySearch | Category Page | — |
| **Product comparison** | comparisonService | galleryHelpers (compare bar) | CompareHistory |
| **Fabric swatches** | swatchService | swatchSelector | FabricSwatches |
| **Product reviews** | reviewsService, photoReviews | ProductReviews | ReviewRequests |
| **Customer Q&A** | productQA | Product Page | — |
| **Product videos** | productVideos | Fullscreen Page | Videos |
| **Bundles** | bundleBuilder, bundleAnalytics | Product Page | ProductBundles |
| **Wishlist** | wishlistAlerts | galleryHelpers | Wishlist, WishlistAlertPrefs |
| **Gift cards** | giftCards | — | GiftCards |
| **Coupons** | couponsService | — | — (Wix native) |
| **Loyalty program** | loyaltyService, loyaltyTiers | — | LoyaltyAccounts |
| **Referral program** | referralService | Thank You Page | ReferralCodes |
| **Email automation** | emailAutomation, emailService | — | EmailQueue |
| **Cart recovery** | cartRecovery | — | AbandonedCarts |
| **Browse recovery** | browseAbandonment | — | BrowseSessions |
| **Notifications** | notificationService | — | NotificationLog |
| **Analytics/tracking** | analyticsHelpers | engagementTracker | ProductAnalytics |
| **SEO** | seoHelpers, topicClusters, seoContentHub | — | — |
| **Social feeds** | googleMerchantFeed, pinterestRichPins, http-functions | — | — |
| **A/B testing** | abTesting | — | AbTests, AbEvents |
| **Assembly guides** | assemblyGuides | — | AssemblyGuides |
| **Size guides** | sizeGuide | — | — |
| **Room planner** | roomPlanner | — | RoomLayouts |
| **Style quiz** | styleQuiz | — | — |
| **Buying guides** | buyingGuides | — | — |
| **Store locator** | storeLocatorService | — | — |
| **Live chat** | liveChat, liveChatService | LiveChat | ChatMessages |
| **Contact form** | contactSubmissions | Contact Page | ContactSubmissions |
| **Member dashboard** | accountDashboard | Member Page | MemberPreferences |
| **Returns** | returnsService | ReturnsPortal | — |
| **Sustainability** | sustainability, sustainabilityService | — | — |
| **AR viewer** | — | models3d, arSupport, ProductARViewer | — |
| **Performance** | coreWebVitals, errorMonitoring | — | — |
| **Promotions** | promotions | Home Page | Promotions |
| **Financing** | financingService, financingCalc, paymentOptions | ProductFinancing | — |
| **Comfort ratings** | comfortService | ComfortStoryCards | — |
| **Swatch request** | emailService (submitSwatchRequest) | SwatchRequestFlow | ContactSubmissions |
| **Empty states** | — | emptyStates | — |
| **Navigation** | — | navigationHelpers | — |
| **Social proof** | socialProofService | socialProofToast | — |
| **Returns admin** | returnsService | ReturnsAdmin, ReturnsPortal | — |
| **Newsletter/email capture** | newsletterService | exitIntentCapture | ContactSubmissions |
| **Footer** | — | FooterSection | — |
| **Store credit** | storeCreditService | storeCreditHelpers | StoreCredits |
| **Protection plans** | protectionPlan | Checkout.js | — |
| **Room planner** | roomPlanner | roomPlannerHelpers | RoomLayouts |
| **Buying guides** | buyingGuides | buyingGuidesHelpers | — |
| **LocalBusiness SEO** | seoHelpers, storeLocatorService | localBusinessSeo | — |
| **Illustrations** | — | *Illustrations.js (7 modules) | — |
| **Brand detection** | — | productPageUtils (canonical) | — |

---

## Business Constants (Hardcoded in Code)

| Constant | Value |
|----------|-------|
| Free shipping threshold | DISABLED ($999,999 — code intact, threshold unreachable) |
| Bundle discount | 5% (frame + mattress) |
| Tiered discount | 5% over $500, 10% over $1,000 |
| White-glove local | $149 (ZIP 287-289) |
| White-glove regional | $249 (ZIP 270-399) |
| White-glove free | DISABLED ($999,999 — code intact, threshold unreachable) |
| Store hours | Wed-Sat 10am-5pm, Mon-Tue by appointment |
| Store address | 824 Locust St Ste 200, Hendersonville NC 28792 |
| Phone | (828) 252-9449 |
| Email | carolinafutons@gmail.com |
| Loyalty tiers | Bronze (0pts), Silver (500pts), Gold (1000pts), Platinum (2500pts) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Module not found" error | Check file is in `backend/` not `public/`. `.web.js` files must be in backend. |
| CMS collection doesn't exist | Backend will auto-create most collections on first use. Only the 16 priority ones need manual creation. |
| UPS rates not showing | Check Secrets Manager: UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_ACCOUNT_NUMBER must be set. Set UPS_SANDBOX to "true" for testing. |
| Emails not sending | Create the Triggered Email template with the exact Template ID. Check SITE_OWNER_CONTACT_ID secret. |
| Products not importing | Run `validateImportData()` first. Check console for field validation errors. |
| Images not loading | Product images from `static.wixstatic.com` work automatically. Custom images need upload to Wix Media Manager first. |
| Search returns nothing | Products must be in the Stores/Products collection (not just CMS). Use `catalogImport` to add them properly. |
| Mobile layout broken | Check `mobileHelpers.js` is deployed to `public/`. All pages have mobile breakpoints in the CSS. |
| Checkout shows no shipping | `shipping-rates-plugin.js` must be in `backend/` (not `.web.js`). It's a Wix SPI, deployed differently. |
| Scheduled jobs not running | Create `jobs.config` in `backend/` root. Verify the cron expressions. Jobs only run on published sites. |

---

## Test Suite

If you need to verify the code works before deploying, run from the repo root:

```bash
npx vitest run
```

**Current status:** 12,993+ tests across 326 files — all passing, zero failures.

---

## Hookup Readiness Summary

| Category | Pages | Code IDs | In Spec | Missing | % Ready |
|----------|-------|----------|---------|---------|---------|
| Commerce (8 pages) | Cart, Side Cart, Checkout, Thank You, Member, Order Tracking, Gift Cards, Financing | 371 | 216 | 154 | 58% |
| Browse (5 pages) | Category, Search, FAQ, Style Quiz, Compare | 158 | 126 | 32 | 80% |
| Content (5 pages) | Blog, Blog Post, Newsletter, About, Contact | 100 | 40 | 60 | 40% |
| Homepage (1 page) | Home | 74 | 31 | 43 | 42% |
| Product (1 page) | Product Page | 34+ | 17 | 14+ | 50% |
| **TOTAL** | **20 audited** | **737** | **430** | **307** | **58%** |

**Production-ready pages (100% spec match):** Order Tracking, Blog

**Critical gaps (entire pages missing from spec):** Returns (51 IDs), Admin Returns (57 IDs), Style Quiz (25 IDs), Compare (24 IDs), Newsletter (14 IDs)

**Not yet audited (10 pages):** Room Planner, Buying Guides, Buying Guide, Store Locator, Sustainability, Gift Cards, Financing, Referral Page, UGC Gallery, Assembly Guides

---

## Illustration Assets

### Figma Pipeline SVGs (src/assets/illustrations/)

| Asset | Description | Pipeline Status |
|-------|-------------|----------------|
| `mountain-skyline-figma` | Header skyline silhouette | .svg -> .optimized -> .tokenized -> .wix.html |
| `blue-ridge-timeline` | About page timeline | Complete |
| `contact-hero` | Contact page hero scene | Complete |
| `contact-showroom` | Showroom building illustration | Complete (rework in progress) |
| `footer-mountain-divider` | Footer decorative divider | Complete |
| `team-portrait` | Team illustration | Complete (rework in progress) |

### Illustration JS Modules (src/public/)

| Module | Scenes | Status |
|--------|--------|--------|
| `comfortIllustrations.js` | 3 (plush/medium/firm) | Active (JS template — migration pending) |
| `CartIllustrations.js` | 3 (skyline/empty/progress) | Active (Figma variant exists) |
| `emptyStateIllustrations.js` | 8 empty states | Active (migration pending) |
| `aboutIllustrations.js` | Brand story scenes | Active (migration pending) |
| `contactIllustrations.js` | Hero + showroom | Active (Figma SVGs exist) |
| `onboardingIllustrations.js` | Onboarding scenes | Active (Figma variant exists) |
| `MountainSkyline.js` | Header skyline | Active (Figma variant exists) |

---

*Generated by melania (Production Manager) — Carolina Futons cfutons rig*
*Source files: refinery/rig/src/ (canonical codebase)*
*Last verified: 2026-03-14 (test count 12,993+, 41 pages, 232 helpers, 191 backend modules)*
