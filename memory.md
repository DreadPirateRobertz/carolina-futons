# Carolina Futons - Project Memory

**Last updated**: 2026-02-20 (sprint session: 6 new backend modules, 3 page updates, 372 tests green)
**Repo**: `git@github.com:DreadPirateRobertz/carolina-futons.git`
**Local path**: `/Users/hal/Projects/carolina-futons/`
**Gas Town rig**: `cfutons` (prefix: `cf`)
**Wix site**: Experiment_2 (NOT the live site)
**Wix login**: `halworker85@gmail.com` (Google login) — creds in `wix.conf` (gitignored)
**Design reference**: `design.jpeg` in repo root — 6-page mockup (committed `015cf57`)
**Wix Studio AI tools**: Available as halworker — illustrative AI agents within Wix Studio for generating on-brand artwork

---

## Project Overview

Full redesign of CarolinaFutons.com — a family-owned furniture store at
824 Locust St, Ste 200, Hendersonville, NC 28792. Owner: Brenda Deal.
Phone: (828) 252-9449. Hours: Wed-Sat 10am-5pm.

**Stack**: Wix Studio + Wix Velo (JavaScript), UPS REST API, Wix Stores,
Wix CRM, Wix Secrets Manager.

**Design System**: Blue Ridge Mountain aesthetic — sand/espresso/mountain blue/
sunset coral palette. Playfair Display headings, Source Sans 3 body.
See `src/public/designTokens.js` and `WIX-STUDIO-BUILD-SPEC.md` for full tokens.

---

## Codebase Structure (43+ source files)

```
src/
├── backend/                              # Server-side Velo web modules (20 files)
│   ├── analyticsHelpers.web.js           # Product view/cart tracking + GA4 event builders
│   ├── assemblyGuides.web.js             # Per-SKU assembly guides + category care tips (NEW)
│   ├── cartRecovery.web.js               # Abandoned cart event handlers + recovery stats (NEW)
│   ├── contactSubmissions.web.js          # Lead capture → ContactSubmissions CMS
│   ├── couponsService.web.js             # Marketing coupons: welcome, birthday, tier (NEW)
│   ├── dataService.web.js                # Centralized CMS data service (+1054 lines)
│   ├── deliveryScheduling.web.js         # Slot-based delivery scheduling Wed-Sat (NEW)
│   ├── emailService.web.js               # Contact form + order notifications + swatch requests
│   ├── fulfillment.web.js                # Order fulfillment: UPS shipments, labels, tracking
│   ├── giftCards.web.js                  # Custom gift card system: codes, balance, redeem (NEW)
│   ├── googleMerchantFeed.web.js         # Google Merchant Center XML feed
│   ├── http-functions.js                 # HTTP endpoints: merchant feed, sitemap, FB/Pinterest feeds
│   ├── loyaltyService.web.js             # Bronze/Silver/Gold loyalty tiers + rewards (NEW)
│   ├── productRecommendations.web.js     # Cross-sell engine, featured/sale, bundles (all 8 cats)
│   ├── promotions.web.js                 # Holiday/event promotional lightbox engine
│   ├── seoHelpers.web.js                 # JSON-LD schemas + Open Graph + Pinterest Rich Pin meta
│   ├── shipping-rates-plugin.js          # Wix eCommerce SPI: checkout + white-glove delivery
│   ├── styleQuiz.web.js                  # "Find Your Perfect Futon" recommendation engine
│   ├── swatchService.web.js              # Fabric swatch queries (FabricSwatches CMS)
│   └── ups-shipping.web.js              # UPS REST API: OAuth, rates, labels, tracking, validation
│
├── pages/                                # One JS file per Wix page (22 files)
│   ├── masterPage.js                     # Global: nav, announcement, search, SEO, exit-intent,
│   │                                     #   side cart auto-open, compare bar, promo lightbox
│   ├── Home.js                           # Hero, 8 categories, featured, sale, recently viewed,
│   │                                     #   trust signals, testimonials, smooth scroll
│   ├── Product Page.js                   # PDP: variants, gallery, lightbox, zoom, swatch visualizer,
│   │                                     #   cross-sell, bundles, sticky cart, urgency, delivery
│   │                                     #   estimate, wishlist, back-in-stock, breadcrumbs
│   ├── Category Page.js                  # PLP: all 8 category heroes, filters, sort, grid, badges,
│   │                                     #   swatch preview dots, quick view, compare, recently viewed
│   ├── Cart Page.js                      # Cart: shipping progress, tiered discounts, recently viewed,
│   │                                     #   intelligent cross-sell, qty controls
│   ├── Side Cart.js                      # Slide-out: auto-open, tiered incentives, multi-suggest,
│   │                                     #   variant details, animated removal
│   ├── Checkout.js                       # Checkout: address validation, trust signals
│   ├── Thank You Page.js                 # Post-purchase: social share, newsletter, referral,
│   │                                     #   care sequence enrollment, assembly guides
│   ├── Member Page.js                    # Account: dashboard, orders, wishlist (sort/share 4 channels),
│   │                                     #   loyalty points, address book, comm prefs
│   ├── Blog.js                           # Blog: SEO schema, product sidebar, social share, newsletter (NEW)
│   ├── About.js                          # Our Story: timeline, team gallery, JSON-LD
│   ├── Contact.js                        # Contact form with validation → emailService backend
│   ├── FAQ.js                            # Accordion FAQ with FAQPage schema
│   ├── Search Results.js                 # Product search with no-results handling
│   ├── Search Suggestions Box.js         # Live search autocomplete
│   ├── Fullscreen Page.js                # Product video gallery with category filters
│   ├── Shipping Policy.js                # Shipping calculator + delivery zones
│   ├── Accessibility Statement.js
│   ├── Privacy Policy.js
│   ├── Refund Policy.js
│   └── Terms & Conditions.js
│
└── public/                               # Shared frontend modules (3 files)
    ├── designTokens.js                   # Colors, typography, spacing, shadows
    ├── galleryHelpers.js                 # Lightbox, zoom, badges, recently viewed, lazy-load,
    │                                     #   comparison bar, product tracking
    └── placeholderImages.js              # wix:image:// Media Manager URIs for all non-product
                                          #   images (heroes, cards, about, contact, decorative)
```

**Tests** (53 files in `tests/`): Vitest + Wix mocks. **1,395 tests passing** as of 2026-02-21.
Recent additions: financingService (33), productFinancing (23), returnsService (34), fulfillment expanded (13→33), productCache (12→29), emailService (13→29), loyaltyService (12→42), analyticsHelpers (12→69), couponsService (9→27), cartRecovery (11→28).

---

## Key Architecture Decisions

1. **Cross-sell engine**: `productRecommendations.web.js` powers all product suggestions.
   Frame + mattress pairing for all 8 categories. Cart analysis for "Complete Your Futon" bundles.
   `getBundleSuggestion()` offers 5% bundle discount.

2. **Two-layer shipping**: Plugin layer (Wix SPI for checkout) + fulfillment layer
   (post-purchase UPS label generation and tracking). Both share `ups-shipping.web.js`.

3. **SEO schema injection**: JSON-LD via hidden HtmlComponent on every page.
   Product, LocalBusiness (FurnitureStore), BreadcrumbList, FAQPage, WebSite schemas.

4. **UPS integration**: OAuth 2.0 client credentials flow. Rating API v2403,
   Shipping API, Tracking API, Address Validation. Sandbox mode via `UPS_SANDBOX` secret.

5. **Free shipping threshold**: $999 — hardcoded in `ups-shipping.web.js`,
   `shipping-rates-plugin.js`, `Cart Page`, `Side Cart`.

6. **Tiered discount incentives**: 5% off over $500, 10% off over $1000.
   Implemented in both Cart Page and Side Cart with progress bars.

7. **Fabric swatch system**: `swatchService.web.js` queries FabricSwatches CMS.
   Product Page has full swatch selector with color family filter, tint overlay,
   and swatch gallery lightbox. Category grid shows swatch preview dots.

8. **Image system**: `placeholderImages.js` uses `wix:image://` format for all
   non-product images. Product images come from Wix Stores `mainMedia`.
   Includes `getTransformedImageUrl()` for dynamic resizing.

9. **Promotional lightbox**: `promotions.web.js` queries Promotions CMS for active
   campaigns with countdown timer, product carousel, discount code copy, email capture.

10. **Error handling**: Silent catch for non-critical UI (analytics, badges, swatches).
    User-facing messages with phone fallback for critical ops (email, checkout).
    Flat-rate fallback for UPS API failures.

---

## Design Reference (`design.jpeg`)

6-page mockup showing the full visual identity. Key design elements:

1. **Illustrated cabin/wood frame** — THE signature element. Hero content sits inside a hand-drawn wooden cabin/A-frame illustration. Mountain ridgeline with sunrise (coral/blue gradient) spans the header.
2. **Warm sand palette** — Sand (#E8D5B7) backgrounds throughout, espresso (#3A2518) text, coral (#E8845C) CTAs.
3. **Polaroid-style team photos** — About/Our Story page uses tilted polaroid frames for team images.
4. **Hand-drawn map** — Contact page features an illustrated map of Hendersonville area.
5. **Clean product grid** — Category pages use consistent card layout with images, names, prices.
6. **Modern cart** — Summary sidebar with subtotal/shipping/total, Checkout + G-Pay buttons.
7. **Mountain header decoration** — Blue Ridge mountain silhouette runs behind/above nav on every page.
8. **Nav bar**: Home, Shop, Product Videos, Sale, Getting It Home, Contact, FAQ, About, Blog.

**Illustration strategy**: Use Wix Studio's built-in AI illustration tools (available as halworker85) to generate on-brand mountain/cabin artwork. Supplement with custom SVGs per ILLUSTRATION-ASSET-SPEC.md.

**Video content strategy**: Weave product demo videos throughout — Product Videos page coded (Fullscreen Page.js), video embeds planned for product pages and homepage.

---

## Wix Secrets Manager (Required)

| Secret Key | Value | Status |
|------------|-------|--------|
| `UPS_CLIENT_ID` | `jCCpc3zaoI38UqGqE482TG4JbaRFGzyAdUADjGZbXykATm4O` | NEEDS STORING |
| `UPS_CLIENT_SECRET` | (in `ups_shiiping_and_label_printing.conf`) | NEEDS STORING |
| `UPS_ACCOUNT_NUMBER` | `R055G4` | NEEDS STORING |
| `UPS_SANDBOX` | `true` | NEEDS STORING |
| `SITE_OWNER_CONTACT_ID` | (find in Wix Dashboard > Contacts) | NEEDS FINDING + STORING |

**IMPORTANT**: Credential files (`*.conf`) exist locally but are gitignored and
were NEVER committed. Must store in Wix Secrets Manager then DELETE local files.

---

## CMS Collections (Need Creation in Wix Dashboard)

| Collection | Fields | Used By |
|------------|--------|---------|
| `ProductAnalytics` | productId, productName, category, viewCount, lastViewed, addToCartCount, purchaseCount, weekSales | analyticsHelpers.web.js, Product Page (popularity badge) |
| `ContactSubmissions` | name, email, phone, subject, message, submittedAt, status, source, notes, productId, productName | emailService.web.js, masterPage (exit-intent), Product Page (back-in-stock) |
| `Wishlist` | memberId, productId, productName, productImage, addedDate | Product Page, Member Page |
| `Fulfillments` | orderId, orderNumber, trackingNumber, carrier, service, labelUrl, status, createdAt, updatedAt, estimatedDelivery, deliveredAt | fulfillment.web.js |
| `FabricSwatches` | swatchId, swatchName, swatchImage, colorFamily, colorHex, material, careInstructions, availableForProducts, sortOrder | swatchService.web.js |
| `Promotions` | title, subtitle, theme, heroImage, startDate, endDate, discountCode, discountPercent, ctaUrl, ctaText, productIds, isActive | promotions.web.js |
| `MemberPreferences` | memberId, newsletter, saleAlerts, backInStock | Member Page |
| `AbandonedCarts` | checkoutId, buyerEmail, cartTotal, itemCount, status, abandonedAt, recoveredAt | cartRecovery.web.js |
| `DeliverySchedule` | orderId, date, timeWindow, type, status, notes | deliveryScheduling.web.js |
| `AssemblyGuides` | sku, title, pdfUrl, videoUrl, estimatedTime, category | assemblyGuides.web.js |
| `GiftCards` | code, initialBalance, currentBalance, purchaserEmail, recipientEmail, status, expiresAt | giftCards.web.js |

---

## Triggered Email Templates (Need Creation in Wix Dashboard)

1. **`contact_form_submission`**: Variables: customerName, customerEmail, customerPhone, subject, message, submittedAt
2. **`new_order_notification`**: Variables: orderNumber, customerName, total, itemCount

---

## Completed Convoys (All merged to main)

### Convoy 1: Gallery & Category Beautification (hq-cv-rrz7y) — 5/5 COMPLETE

| Bead | Polecat | Commit | What Was Done |
|------|---------|--------|---------------|
| cf-vw0 | thunder | `d8861eb` | +284 lines: lightbox, zoom, badge overlay, recently-viewed, lazy-load, comparison bar |
| cf-qom | dust | `449122c` | +110 lines: Product Page gallery overhaul |
| cf-rmz | scavenger | `ba0e751` | +204 lines: Category Page all 8 categories with hero content |
| cf-1xd | radrat | `f7a3284` | +190 lines: Home page beauty pass, trust signals, testimonials |
| cf-dlx | ghoul | `8024ba1` | Test suite: gallery, category, home page |

### Convoy 2: Customer Engagement & Conversion (hq-cv-qoikg) — 9/9 COMPLETE

| Bead | Polecat | Commit | What Was Done |
|------|---------|--------|---------------|
| cf-pfk | mutant | — | Photo gallery placeholders (Unsplash URLs, superseded by brotherhood) |
| cf-rbu | raider | `9776024` | Product Page engagement: bundles, sticky cart, urgency, delivery estimate, wishlist |
| cf-ovl | vault | `0c9ce8b` | Smart cart & side cart: auto-open, tiered incentives, multi-suggest |
| cf-exz | pipboy | `ea0d491` | Member Page: dashboard, orders, wishlist, address book, comm prefs |
| cf-iuw | nuka | `12059a0` | Exit-intent popup, back-in-stock alerts, abandoned browse tracking |
| cf-8vr | brahmin | `e81db05` | Fabric swatch request form and product comparison UI |
| cf-387 | mirelurk | `f726bb4` | Promotional lightbox system for holiday/event campaigns |
| cf-6zx | deathclaw | — | Session completed without new commits (Thank You page basic post-purchase already coded) |
| cf-no5 | minuteman | — | Session completed without new commits (style quiz not yet implemented) |

### Convoy 3: CMS Data Architecture (hq-cv-327xm) — 1/1 COMPLETE

| Bead | Polecat | Commit | What Was Done |
|------|---------|--------|---------------|
| cf-7sr | institute | `5b2a5fe` | Centralized CMS data service (+1054 lines) |

### Convoy 4: Wix Media Format (hq-cv-bhmv6) — 1/1 COMPLETE

| Bead | Polecat | Commit | What Was Done |
|------|---------|--------|---------------|
| cf-vq8 | brotherhood | `3ed50fe` | Converted all images to wix:image:// format |

### Convoy 5: Swatch Visualizer (hq-cv-gvgtc) — 1/1 COMPLETE

| Bead | Polecat | Commit | What Was Done |
|------|---------|--------|---------------|
| cf-4nc | enclave | `414e788` | Interactive fabric swatch visualizer + swatchService.web.js |

### Earlier Beads (pre-convoy)

| Bead | Title | What Was Done |
|------|-------|---------------|
| cf-v00 | Second pass bug audit | 8 bugs fixed across Velo files |
| cf-f1d | Cross-file consistency review | Dead imports removed, newsletter signup fixed |
| cf-n40 | Wix Dashboard backup procedure | `WIX-BACKUP-PROCEDURE.md` (457-line checklist) |
| cf-z3e | SEO refinement | Enhanced schemas, keyword-rich alt text, category SEO |
| cf-46t | Google Merchant Center feed | `googleMerchantFeed.web.js` + `http-functions.js` |
| cf-zdc | Code comments + API docs | `API-REFERENCE.md`, `ARCHITECTURE.md` |
| cf-543 | TDD framework | Vitest + test suites + Wix mocks |
| cf-0u7 | Social media strategy | Pinterest + Instagram strategy |

---

## Open Beads (Remaining Code Work) — 10 beads

| Bead | Priority | Title | Status |
|------|----------|-------|--------|
| cf-f2z | P1 | Advanced search & filtering engine | IN_PROGRESS — caesar |
| cf-qq9 | P1 | Order tracking page with UPS integration | IN_PROGRESS — radahn |
| cf-cz4 | P2 | Self-service returns portal | IN_PROGRESS — backend done (34 tests), needs frontend |
| cf-cmi | P2 | EmailQueue ISO strings bug | IN_PROGRESS — radahn |
| cf-6es | P2 | Error monitoring dashboard | OPEN |
| cf-7t5 | P2 | Live chat customer support widget | OPEN |
| cf-8su | P2 | Product dimension/size guide | OPEN |
| cf-yuc | P2 | WCAG 2.1 AA accessibility audit | OPEN |
| cf-514 | P3 | Extract time duration constants | OPEN |
| cf-g7e | P3 | AbandonedCarts JSON string issue | OPEN |

### Wix Dashboard Items (can't do in code)
- cf-6ub (P0): Store secrets in Wix Secrets Manager
- cf-69b (P1): Wix Editor visual layout buildout
- cf-xv3 (P1): Create 11 CMS collections
- cf-8gu (P1): Set up UPS Developer Portal credentials
- cf-e3o (P1): Commission illustration assets
- cf-1ur (P2): Create Triggered Email templates

### Features Completed This Session (2026-02-20 — Sprint)

**Previous session work:**
- **contactSubmissions.web.js** — Lead capture backend (was import error)
- **styleQuiz.web.js** — "Find Your Perfect Futon" recommendation engine
- **Enhanced Thank You page** — Order summary, Brenda's message, delivery timeline, referral
- **Video embeds** — Product Page + Home page video showcase
- **Wishlist SVG hearts** — Inline SVGs replacing broken wixstatic.com URLs
- **getBestsellers()** — Added to productRecommendations.web.js

**Sprint session (8-hour sprint):**
- **Security remediation** — `backend/utils/sanitize.js`, admin auth checks, rate limiting (38 tests)
- **loyaltyService.web.js** — Bronze/Silver/Gold tier system, points, rewards
- **couponsService.web.js** — Welcome, birthday, tier upgrade coupons
- **cartRecovery.web.js** — Abandoned cart event handlers, recovery stats
- **deliveryScheduling.web.js** — Slot-based delivery scheduling (Wed-Sat)
- **assemblyGuides.web.js** — Per-SKU guides + category care tips
- **giftCards.web.js** — Custom gift card codes, balance tracking, redemption
- **analyticsHelpers.web.js** — GA4 enhanced e-commerce event builders (ViewContent, AddToCart, etc.)
- **shipping-rates-plugin.js** — White-glove delivery tier ($149 local, $249 regional, free >$1999)
- **http-functions.js** — Facebook catalog feed + Pinterest product feed endpoints
- **seoHelpers.web.js** — Open Graph, Pinterest Rich Pin, Twitter Card meta generators
- **Blog.js** — New page: SEO schema, product sidebar, social share, newsletter
- **Member Page.js** — Wishlist share (link/Pinterest/Facebook/Email), loyalty points display
- **Thank You Page.js** — Post-purchase care sequence, assembly guide links
- **PLUGIN-RECOMMENDATIONS.md** — Comprehensive Wix App Market plugin guide
- **SOCIAL-MEDIA-STRATEGY.md** — Multi-platform social media playbook

### Feed Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/_functions/googleShoppingFeed` | Google Merchant Center XML |
| `/_functions/facebookCatalogFeed` | Facebook/Instagram Commerce TSV |
| `/_functions/pinterestProductFeed` | Pinterest Catalogs TSV |
| `/_functions/productSitemap` | Dynamic XML sitemap |
| `/_functions/health` | Health check |

### Features Not Yet Implemented

- **App development** (Wix Branded App)
- **Wix Automations** — Email trigger configuration for care sequence (Day 3/7/30)

---

## Critical Rules

1. **ASK BEFORE touching Wix Dashboard** — user explicitly required this
2. **Backup BEFORE modifying** — WIX-BACKUP-PROCEDURE.md must be followed
3. **Site is Experiment_2** — NOT the live site
4. **Never commit secrets** — .gitignore blocks `*.conf`, `*.env`, `*.secret`, `credentials*`
5. **Stay secure** — intentionality and attention to detail in all operations
6. **Well-commented code** — user wants comprehensive code comments and markdown API docs
7. **Test-driven development** — Vitest test harness with Wix mocks
8. **Use wix:image:// format** — all non-product images must use Wix Media Manager URIs
9. **gt sling needs `--hook-raw-bead`** — mol-polecat-work formula missing in cfutons rig
10. **gt session start** required after sling — sessions don't always auto-start
11. **All workers MUST update memory before death or kill** — no exceptions

---

## Reference Documents in Repo

| File | Purpose |
|------|---------|
| `WIX-STUDIO-BUILD-SPEC.md` | Full build spec: element IDs, page layouts, editor config |
| `ILLUSTRATION-ASSET-SPEC.md` | Illustrator brief: 7 asset types, color palette, dimensions |
| `WIX-BACKUP-PROCEDURE.md` | Pre-modification backup checklist |
| `API-REFERENCE.md` | Backend API documentation (all web methods) |
| `ARCHITECTURE.md` | System architecture guide |
| `PLUGIN-RECOMMENDATIONS.md` | Wix App Market plugin guide (Must/Should/Nice-to-Have) |
| `SOCIAL-MEDIA-STRATEGY.md` | Pinterest, Instagram, Facebook, TikTok playbook |
| `report_to_human.md` | Sprint progress report |
| `design.jpeg` | 6-page visual mockup |

---

## IMMEDIATE PRIORITIES (Next Session)

### 1. Live Wix Deployment Test (MORNING — TOP PRIORITY)
User plans to publish to Wix and debug integration issues. Testing strategy:

**Pre-Publish Checklist:**
- [ ] Copy all `src/backend/*.js` files to Wix Velo backend (Code Panel → Backend)
- [ ] Copy all `src/pages/*.js` files to corresponding page code files in Wix Studio
- [ ] Copy all `src/public/*.js` files to Wix Velo public folder
- [ ] Verify `permissions.json` allows correct access levels

**CMS Collections to Create First (cf-xv3):**
These collections MUST exist before code will work:
1. `ProductAnalytics` — Product Page popularity badge, analytics tracking
2. `ContactSubmissions` — Contact form, exit-intent popup, back-in-stock
3. `Wishlist` — Product Page heart button, Member Page wishlist
4. `FabricSwatches` — Swatch visualizer on PDP and category grid dots
5. `Promotions` — Holiday/event lightbox system
6. `MemberPreferences` — Member Page communication toggles

**Testing Order (incremental — test each layer before adding the next):**
1. **Layer 1 — Core pages**: masterPage.js → Home → Category Page → Product Page
   - Verify nav links work, announcement bar rotates, search redirects
   - Verify category showcase loads with product counts
   - Verify product grid renders with badges, sort, filter
   - Verify PDP variant selection updates price
2. **Layer 2 — Cart flow**: Add to Cart → Side Cart auto-open → Cart Page → Checkout
   - Verify shipping threshold progress bar
   - Verify tiered discount progress bar
   - Verify cross-sell suggestions load
3. **Layer 3 — Engagement features**: Exit-intent → Swatch visualizer → Compare bar
   - These depend on CMS collections existing
4. **Layer 4 — Member features**: Login → Member Page → Wishlist → Orders
   - Requires at least one test member account

**Expected Issues:**
- CMS collections not yet created → swatches, promotions, analytics will silently fail (safe)
- UPS secrets not stored → shipping calculator will use flat-rate fallback (safe)
- Missing editor elements → try/catch blocks will suppress errors (safe)
- `swatchService.web.js` import will fail if FabricSwatches collection doesn't exist
- `contactSubmissions.web` — module now exists (created 2026-02-20)

### 2. Store Secrets (cf-6ub — P0)
Store UPS credentials in Wix Secrets Manager, then DELETE local .conf files.

### 3. Create CMS Collections (cf-xv3 — P1)
Must happen before most engagement features work. See collection schemas above.

### 4. Editor Layout Buildout (cf-69b — P1)
All the Velo code references specific element IDs (e.g., `#productMainImage`, `#categoryHeroTitle`).
These elements must be created in Wix Studio editor with matching IDs.
Reference: `WIX-STUDIO-BUILD-SPEC.md` has the complete element ID spec.

---

## Known Issues & What Needs Improvement

1. ~~**Missing backend module**: contactSubmissions.web~~ **FIXED** (2026-02-20) — Created `contactSubmissions.web.js`
2. ~~**Thank You page is basic**~~ **FIXED** (2026-02-20) — Enhanced with order summary, Brenda's message, delivery timeline, referral, Instagram share
3. ~~**Style quiz not implemented**~~ **FIXED** (2026-02-20) — Created `styleQuiz.web.js` with recommendation engine + quiz CTA on Home page
4. ~~**Video content not integrated**~~ **FIXED** (2026-02-20) — Video embeds on Product Page (if product has video media) + video showcase on Home page
5. ~~**Wishlist heart icon**~~ **FIXED** (2026-02-20) — Replaced wixstatic.com URLs with inline SVG data URIs using design system colors
6. **placeholderImages.js URIs are synthetic**: The `wix:image://v1/cf0000_...` file IDs are
   placeholder patterns — actual images need to be uploaded to Wix Media Manager and the
   real URIs swapped in.
7. **Mobile responsiveness**: No mobile-specific code yet (cf-mnh bead). Wix Studio handles
   some responsive behavior but needs testing and tuning.
8. **wix-stores-frontend API**: Some cart operations may need migration to newer `wix-ecom`
   API (cf-295 bead). Test current implementation first.
9. ~~**getBestsellers()**~~ **FIXED** (2026-02-20) — Added to `productRecommendations.web.js` with 3-tier fallback

---

## Session Pickup Checklist

When resuming work on this project:

1. `cd /Users/hal/Projects/carolina-futons && git pull`
2. Read this `memory.md` for full context
3. Check `bd list` in the cfutons rig for open beads
4. Check polecat status: `gt polecat list cfutons`
5. FIRST: Create CMS collections (cf-xv3) so engagement features work
6. THEN: Store secrets (cf-6ub) so shipping works
7. THEN: Live test — publish to Wix, test incrementally per Testing Order above
8. Remember: Experiment_2 site, ask before dashboard changes, backup first
9. All polecats are DONE — no active workers
10. Remaining code work: wix-stores-frontend→wix-ecom migration, mobile responsive, metric tracking
