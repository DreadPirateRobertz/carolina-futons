# Carolina Futons - Project Memory

**Last updated**: 2026-02-20 (2 convoys active)
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
824 Locust St, Ste 200, Hendersonville, NC 28792. Owner: Brenda.
Phone: (828) 252-9449. Hours: Wed-Sat 10am-5pm.

**Stack**: Wix Studio + Wix Velo (JavaScript), UPS REST API, Wix Stores,
Wix CRM, Wix Secrets Manager.

**Design System**: Blue Ridge Mountain aesthetic — sand/espresso/mountain blue/
sunset coral palette. Playfair Display headings, Source Sans 3 body.
See `src/public/designTokens.js` and `WIX-STUDIO-BUILD-SPEC.md` for full tokens.

---

## Codebase Structure

```
src/
├── backend/                          # Server-side Velo web modules
│   ├── analyticsHelpers.web.js       # Product view/cart tracking → ProductAnalytics CMS
│   ├── emailService.web.js           # Contact form + order notifications via Triggered Emails
│   ├── fulfillment.web.js            # Order fulfillment: UPS shipments, labels, tracking
│   ├── productRecommendations.web.js # Cross-sell engine, featured/sale products
│   ├── seoHelpers.web.js             # JSON-LD schemas (Product, LocalBusiness, FAQ, Breadcrumb)
│   ├── shipping-rates-plugin.js      # Wix eCommerce SPI: checkout shipping options
│   ├── ups-shipping.web.js           # UPS REST API: OAuth, rates, labels, tracking, validation
│   └── permissions.json              # Backend permissions config
│
├── pages/                            # One JS file per Wix page
│   ├── masterPage.js                 # Global: nav, announcement bar, search, SEO schema
│   ├── Home.c1dmp.js                 # Hero, featured products, category cards, newsletter
│   ├── Product Page.ve2z7.js         # PDP: variants, gallery, cross-sell, schema, breadcrumbs
│   ├── Category Page.u0gn0.js        # PLP: filters (brand/price/size), sort, grid, quick view
│   ├── Cart Page.mqi5m.js            # Cart: shipping threshold bar, completion suggestions
│   ├── Side Cart.ego5s.js            # Slide-out mini cart panel
│   ├── Checkout.psuom.js             # Checkout: address validation, trust signals
│   ├── Thank You Page.dk9x8.js       # Post-purchase: sharing, newsletter, recommendations
│   ├── About.gar3e.js                # Our Story: timeline, team, JSON-LD
│   ├── Contact.k14wx.js              # Contact form with validation → emailService backend
│   ├── FAQ.s2c5g.js                  # Accordion FAQ with FAQPage schema
│   ├── Search Results.evr2j.js       # Product search with no-results handling
│   ├── Search Suggestions Box.gg5mx.js  # Live search autocomplete
│   ├── Fullscreen Page.vu50r.js      # Product video gallery
│   ├── Shipping Policy.ype8c.js      # Shipping calculator + delivery zones
│   ├── Member Page.f00pg.js          # Account: orders, wishlist, profile
│   ├── Accessibility Statement.di5bl.js
│   ├── Privacy Policy.pcvmd.js
│   ├── Refund Policy.jmwgj.js
│   └── Terms & Conditions.z0xvf.js
│
└── public/                           # Shared frontend modules
    ├── designTokens.js               # Colors, typography, spacing, shadows
    └── galleryHelpers.js             # Recently viewed, compare, product badges
```

**Total**: 7 backend modules + 21 page scripts + 2 public modules = 30 files

---

## Key Architecture Decisions

1. **Cross-sell engine**: `productRecommendations.web.js` powers all product suggestions.
   Frame + mattress pairing logic. Cart analysis for "Complete Your Futon" bundles.

2. **Two-layer shipping**: Plugin layer (Wix SPI for checkout) + fulfillment layer
   (post-purchase UPS label generation and tracking). Both share `ups-shipping.web.js`.

3. **SEO schema injection**: JSON-LD via hidden HtmlComponent on every page.
   Product, LocalBusiness (FurnitureStore), BreadcrumbList, FAQPage schemas.

4. **UPS integration**: OAuth 2.0 client credentials flow. Rating API v2403,
   Shipping API, Tracking API, Address Validation. Sandbox mode via `UPS_SANDBOX` secret.

5. **Free shipping threshold**: $999 — hardcoded in `ups-shipping.web.js`,
   `shipping-rates-plugin.js`, `Cart Page`, `Side Cart`.

6. **Error handling**: Silent catch for non-critical UI (analytics, badges).
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

**Video content strategy**: Weave product demo videos throughout — Product Videos page already coded (Fullscreen Page.vu50r.js), need video embeds on product pages, category hero sections, and homepage.

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
| `ProductAnalytics` | productId, productName, category, viewCount, lastViewed, addToCartCount, purchaseCount | analyticsHelpers.web.js |
| `ContactSubmissions` | name, email, phone, subject, message, submittedAt, status | emailService.web.js |
| `Wishlist` | memberId, productId, productName, productSlug, mainMedia, formattedPrice, addedAt | Member Page |
| `Fulfillments` | orderId, orderNumber, trackingNumber, carrier, service, labelUrl, status, createdAt, updatedAt, estimatedDelivery, deliveredAt | fulfillment.web.js |

---

## Triggered Email Templates (Need Creation in Wix Dashboard)

1. **`contact_form_submission`**: Variables: customerName, customerEmail, customerPhone,
   subject, message, submittedAt
2. **`new_order_notification`**: Variables: orderNumber, customerName, total, itemCount

---

## Completed Work (Git History)

| Commit | Description |
|--------|-------------|
| `4a49fda` | Initial redesign: full Velo codebase and design system (27 files, 3,807 lines) |
| `6d2140b` | UPS shipping integration + first-pass bug fixes (7 bugs) |
| `90f52c2` | Cross-file consistency: remove dead imports, fix newsletter signup |
| `45a6f4f` | Second-pass bug audit: fix 8 more bugs across Velo files |
| `998dee1` | Illustration asset spec + secure .gitignore |

### Bug Fixes Applied (12 total across 8 files)

- `emailService.web.js`: Dynamic import namespace → static import; emailMembers → emailContact
- `Category Page`: Quick view addToCart wrong API and import pattern
- `Fullscreen Page`: `require()` not supported in Velo → static import
- `Member Page`: Dynamic import namespace access → `mod.default.remove()`
- `Product Page`: `wixStoreFrontend` typo (missing 's') in 2 locations
- `Cart Page`: Import naming collision and incorrect cart API
- `Side Cart`: Same import/API fixes as Cart Page
- `productRecommendations.web.js`: Invalid `.hasSome().not()` query + nonexistent field

---

## Completed Beads (Merged to Main)

| Bead | Title | What Was Done |
|------|-------|---------------|
| cf-v00 | Second pass bug audit | 8 bugs fixed across Velo files |
| cf-f1d | Cross-file consistency review | Dead imports removed, newsletter signup fixed |
| cf-n40 | Wix Dashboard backup procedure | `WIX-BACKUP-PROCEDURE.md` (457-line checklist) |
| cf-z3e | SEO refinement | Enhanced schemas, keyword-rich alt text, category SEO (6 files) |
| cf-46t | Google Merchant Center feed | `googleMerchantFeed.web.js` + `http-functions.js` |
| cf-zdc | Code comments + API docs | `API-REFERENCE.md`, `ARCHITECTURE.md`, commented code |
| cf-543 | TDD framework | Vitest + 7 test suites + Wix mocks in `tests/` |
| cf-0u7 | Social media strategy | Pinterest + Instagram strategy |

All merged in commit `1a5414f` on 2026-02-20.

---

## Convoy 1: Gallery & Category Beautification (hq-cv-rrz7y)

Status: 4/5 polecats COMPLETED, ghoul (tests) still grinding.

| Bead | Polecat | Status | Commit |
|------|---------|--------|--------|
| cf-vw0 | thunder | DONE | `a8b0c38` +284 lines to galleryHelpers.js |
| cf-qom | dust | DONE | `ff3dde1` +110 lines to Product Page |
| cf-rmz | scavenger | DONE | `688aa4d` +204 lines across 4 files |
| cf-1xd | radrat | DONE | `2b3888a` +190 lines to Home page |
| cf-dlx | ghoul | WORKING | Writing test suite |

Awaiting refinery merge to main.

---

## Convoy 2: Customer Engagement & Conversion (hq-cv-qoikg)

9 beads, 4 polecats active:

| Bead | Priority | Polecat | Title |
|------|----------|---------|-------|
| cf-pfk | P0 | mutant | Photo gallery placeholders for layout testing |
| cf-rbu | P0 | raider | Product Page engagement: bundles, sticky cart, urgency, wishlist |
| cf-ovl | P0 | vault | Smart cart & side cart: auto-open, tiered incentives |
| cf-exz | P0 | pipboy | Member/Account page for Velo integration |
| cf-iuw | P1 | — | Exit-intent popup, back-in-stock alerts |
| cf-8vr | P1 | — | Fabric swatch request + product comparison UI |
| cf-6zx | P1 | — | Post-purchase: Thank You, reviews, referral |
| cf-387 | P1 | — | Holiday/event promotional lightboxes |
| cf-no5 | P2 | — | Style quiz + social proof notifications |

---

## Open Beads (Remaining Work)

| Bead | Priority | Title | Status |
|------|----------|-------|--------|
| cf-6ub | P0 | Store secrets in Wix Secrets Manager + delete .conf files | NOT STARTED — ask user first |
| cf-69b | P1 | Wix Editor visual layout buildout | NOT STARTED |
| cf-xv3 | P1 | Create CMS collections in Wix Dashboard | NOT STARTED — blocked on backup |
| cf-8gu | P1 | Set up UPS Developer Portal credentials | NOT STARTED |
| cf-e3o | P1 | Commission illustration assets | Spec ready (`ILLUSTRATION-ASSET-SPEC.md`) |
| cf-1ur | P2 | Create Triggered Email templates | NOT STARTED — needs dashboard access |
| cf-6wc | P2 | Metric tracking + customer engagement strategy | NOT STARTED |

---

## Critical Rules

1. **ASK BEFORE touching Wix Dashboard** — user explicitly required this
2. **Backup BEFORE modifying** — WIX-BACKUP-PROCEDURE.md must be followed
3. **Site is Experiment_2** — NOT the live site
4. **Never commit secrets** — .gitignore blocks `*.conf`, `*.env`, `*.secret`, `credentials*`
5. **Stay secure** — intentionality and attention to detail in all operations
6. **Well-commented code** — user wants comprehensive code comments and markdown API docs
7. **Test-driven development** — test harness being built (vitest)

---

## Reference Documents in Repo

| File | Purpose |
|------|---------|
| `WIX-STUDIO-BUILD-SPEC.md` | Full build spec: element IDs, page layouts, editor config |
| `ILLUSTRATION-ASSET-SPEC.md` | Illustrator brief: 7 asset types, color palette, dimensions |
| `WIX-BACKUP-PROCEDURE.md` | Pre-modification backup checklist |
| `API-REFERENCE.md` | Backend API documentation (all web methods) |
| `ARCHITECTURE.md` | System architecture guide |

---

## Session Pickup Checklist

When resuming work on this project:

1. `cd /Users/hal/Projects/carolina-futons && git pull`
2. Read this `memory.md` for full context
3. Check `bd list` in the cfutons rig for open beads
4. Check polecat status: `gt polecat list cfutons`
5. Priority: store secrets (cf-6ub, P0) → create CMS collections (cf-xv3) → UPS portal (cf-8gu)
6. Remember: Experiment_2 site, ask before dashboard changes, backup first
