# cfutons (Carolina Futons) — Report to Human

**Last Updated:** 2026-02-22 16:45 MST (melania, Production Manager)
**Repo:** git@github.com:DreadPirateRobertz/carolina-futons.git
**Beads DB:** ONLINE (290 total | 218 closed | 6 ready | 0 in-progress)

---

## Health: GREEN — ALL WORKERS IDLE, LAUNCH READY

| Metric | Value |
|--------|-------|
| Tests | 3,526 vitest tests across 96 files (**all green**) |
| Backend Modules | 62+ `.web.js` modules ready |
| Page Code | 23 page JS files with $w bindings |
| Frontend Utils | 24 public JS modules |
| CMS Collections | 16 defined (need creation in Dashboard) |
| Secrets Manager | 8 secrets configured (incl. WIX_BACKEND_KEY) |
| Payments | Wix Payments — Credit, Apple Pay, Google Pay, Afterpay |
| Product Catalog | 88 products enriched (74 priced, 14 contact-for-price) |
| MCP Scrape | COMPLETE — 88 products + 70 pages pulled via Wix MCP API |

---

## WHAT YOU (HUMAN) NEED TO DO — Priority Order

### Immediate (15 min, all free)

1. **Install GA4** — Wix Dashboard > Marketing Integrations > paste your GA4 Measurement ID
2. **Install Meta Pixel** — Dashboard > Tracking & Analytics > paste Facebook Pixel ID
3. **Install Pinterest Tag** — Dashboard > Tracking & Analytics > paste Pinterest Tag ID
4. **Connect Google Merchant Center** — connect feed URL: `/_functions/googleMerchantFeed`
5. **Enable Wix Chat** — Dashboard > toggle on (one click)

### This Week (30 min)

6. **Create CMS Collections** — 16 collections needed. Full schema in `CMS-SETUP-GUIDE.md`. Priority order:
   - ContactSubmissions, ProductAnalytics, Promotions, EmailQueue, Unsubscribes
   - AbandonedCarts, Fulfillments, GiftCards, DeliverySchedule, AssemblyGuides
   - **FabricSwatches** (see Swatch Hookup below), ProductBundles
   - CustomerEngagement, ReviewRequests, ReferralCodes, Videos
7. **Enable Wix Loyalty** — Dashboard toggle (code in `loyaltyService.web.js` ready)
8. **Enable Wix Automations** — powers post-purchase sequences
9. **Enable Wix Bookings** — for showroom appointment scheduling (Hendersonville)
10. **Verify Secrets Manager** — login halworker85@gmail.com, confirm 8 secrets present

### Before Marketing Push

11. **Install Klaviyo** — App Market (free up to 250 contacts). Replaces basic CRM emails with advanced automation
12. **Install Stamped.io** — App Market (free tier). Product reviews with photos
13. **Create Triggered Email Templates** — Wix Automations for: welcome, cart recovery, order confirmation, review request, swatch request confirmation
14. **Commission illustration/lifestyle assets** — for homepage hero, category headers

### Pricing Decisions Needed

14 products show $0.00 ("Contact for availability") — all Otis Bed mattresses:
- Yuma, Northampton, Cambridge, Sedona, Mountainaire, Mesa 5000/3000/1000, Maricopa, Gemini II, Flagstaff, Chandler, Asheville, Alpine
- **Decision:** Display real prices, or add "Request Quote" button? Code supports both.

---

## FABRIC SWATCH SYSTEM — How to Hook It Up

The swatch system is **fully built** (code, tests, import pipeline, UI). Here's how to activate it:

### What's Built

| Component | File | Status |
|-----------|------|--------|
| Backend API (4 methods) | `swatchService.web.js` | Done, tested |
| Frontend selector UI | `product/swatchSelector.js` | Done |
| Swatch request email | `emailService.web.js` → `submitSwatchRequest()` | Done, tested |
| Bulk import script | `scripts/importSwatches.js` | Done |
| Product page integration | `ProductOptions.js` + `variantSelector.js` | Done |

### API Methods Available

```javascript
import { getProductSwatches, getAllSwatchFamilies, getSwatchCount, getSwatchPreviewColors } from 'backend/swatchService.web.js';

// Get swatches for a product (with optional color family filter)
const swatches = await getProductSwatches('product-id', 'Blues', 50);

// Get all color family names for filter dropdown
const families = await getAllSwatchFamilies();

// Get swatch count for "Showing X of Y"
const count = await getSwatchCount('product-id');

// Get 4 preview dots for category grid cards
const dots = await getSwatchPreviewColors('product-id', 4);
```

### Step-by-Step Hookup

**Step 1: Create FabricSwatches CMS Collection**
In Wix Dashboard > CMS > Create Collection > "FabricSwatches" with fields:
| Field | Type | Required |
|-------|------|----------|
| swatchId | Text | Yes (unique) |
| swatchName | Text | Yes |
| swatchImage | Image | Yes |
| colorFamily | Text | Yes (e.g., Blues, Reds, Neutrals) |
| colorHex | Text | Yes (#RRGGBB) |
| material | Text | Yes |
| careInstructions | Text | No |
| availableForProducts | Tags | Yes (product IDs or "all") |
| sortOrder | Number | Yes |

**Step 2: Populate with swatch data**
Option A (manual): Add swatches via Dashboard CMS editor
Option B (bulk): Use `importSwatches.js` script — accepts JSON array, batch-processes 50 at a time, deduplicates on swatchId

**Step 3: Upload swatch images**
Upload fabric photos to Wix Media Manager. Each swatch needs a square photo (~300x300px). Use the `wix://` URL in the `swatchImage` field.

**Step 4: Deploy code**
The code is already in `swatchService.web.js` (backend) and `swatchSelector.js` (frontend). Deploy to Wix Velo and it connects automatically.

### Current Finish/Color Data from Live Site (28 colors across 71 products)

Finishes already on products: Antique Blue, Bakar, Black Walnut, Brushed Driftwood, Buttercream, Charcoal, Cherry, Chocolate, Clear, Dark Cherry, Espresso, Gray, Harvest Brown, Honey Pine, Natural, Normandy, Provence, Red, Seafoam, Skye, Stonewash Gray, Teal, Vintage White, Warm Cherry, White, White Bark, Wildwood Brown, Wildwood Vintage White

These are **wood finishes**, not fabric swatches. Fabric swatch data (for futon covers/mattress covers) needs to come from Night & Day or other fabric suppliers. The CMS is ready to receive it.

---

## MCP Scrape — COMPLETE

Successfully connected to `carolinafutons.com/_api/mcp` and extracted:

| Content | Count |
|---------|-------|
| Products (descriptions, prices, images, variants, stock status) | 88 |
| Content pages (home, about, FAQ, blog, shipping, sales, contact, etc.) | 16 |
| Product pages with full text | 54 |
| Business details (address, phone, email, coordinates) | 1 |
| Product options/variants (colors, sizes, series) | 71 products |

**Output files:** `data/mcp-scrape/`
- `carolinafutons-complete.json` (325KB) — everything combined
- `products-full.json` (237KB) — 88 products with HTML + plain text descriptions
- `site-pages.json` (84KB) — all page content
- `product-options-swatches.json` — variant/option data per product

**Inventory snapshot:** 18 in stock, 32 partially out, 38 out of stock.

---

## Crew Status — ALL IDLE

| Member | Role | Status | Last Work |
|--------|------|--------|-----------|
| melania | Production Manager | ACTIVE | MCP scrape, beads alignment, reporting |
| architect | Tech Lead | IDLE | contentImport.web.js (uncommitted — needs merge) |
| caesar | Executor | IDLE | Advanced search, comparison guides (uncommitted) |
| radahn | Executor | IDLE | MD docs cleanup, deployment guide updates |
| brainstorm | Executor | IDLE | CMS import scripts |

### Uncommitted Work (needs commit/merge)

| Crew | Files | Action Needed |
|------|-------|---------------|
| architect | `contentImport.web.js` (576 lines) + tests (628 lines) | Commit and merge to refinery |
| caesar | `comparison-guides.json`, `night-and-day-products.json` | Commit content data |
| All crew | `state.json` files | Stale, can be .gitignored |
| All crew | Duplicate `catalog-*.json`, `scraped-products-*.json` | Canonical copy is in `refinery/rig/content/` |

---

## Backlog — 6 Ready P2 Stories

| Bead | Title |
|------|-------|
| cf-5js | WCAG 2.1 AA accessibility audit and remediation |
| cf-dhu | Customer reviews with photo upload and star ratings |
| cf-dth | Self-service returns and exchanges portal |
| cf-ist | Financing calculator with monthly payment estimates and BNPL |
| cf-q2w | Product size and dimension guide with room fit visualization |
| cf-zk7 | Recently viewed products and personalized recommendations |

---

## Marketing Mission (melania's strategic role)

### Delivered
- **MARKETING-STRATEGY.md** — $15K/month revenue in 3 months, full channel/budget/KPI breakdown
- **SOCIAL-MEDIA-STRATEGY.md** — Pinterest/Instagram/Facebook playbook
- **PLUGIN-RECOMMENDATIONS.md** — prioritized Wix plugin install order

### Active Marketing Infrastructure (code-ready)
- Google Merchant feed endpoint (`/_functions/googleMerchantFeed`) — LIVE
- Facebook product feed (`/_functions/facebookCatalogFeed`) — LIVE
- Pinterest Rich Pins meta tags — built into `seoHelpers.web.js`
- GA4 event tracking — built into `analyticsHelpers.web.js`
- Email automation — `emailService.web.js`, `cartRecovery.web.js`, `browseAbandonment.web.js`
- Loyalty program — `loyaltyService.web.js` (Bronze/Silver/Gold tiers)
- Referral system — `referralService.web.js`
- Exit-intent popup — built into page code
- Newsletter signup — `contactSubmissions.web.js`

### Next Marketing Actions (post-launch)
1. Submit Google Merchant feed for Shopping ads
2. Set up Facebook/Instagram Shop (connect feed)
3. Create Pinterest business account + enable Rich Pins
4. Launch Klaviyo abandoned cart sequence (3-email flow)
5. Set up GA4 enhanced ecommerce funnel tracking
6. First social media posts with product photography

---

## cfutons_mobile — Next Up

| Bead | Priority | Title |
|------|----------|-------|
| cm-88d | P2 | AR Camera Feature: Augmented Reality Product Visualization |

**Status:** Waiting for cfutons to reach stable idle. All cfutons workers are now idle. Ready to start cfutons_mobile when you give the word.

---

## CMS Hookup Quick Reference

### How Wix CMS Works
Wix CMS = database + visual editor. Define Collections (tables), bind them to page elements. Site reads data dynamically.

### Import Product Catalog
```javascript
import { importProducts, validateImportData } from 'backend/catalogImport.web.js';
const validation = await validateImportData(catalogData);
const result = await importProducts(catalogData, { dryRun: false, updateExisting: true });
```
Max 500 products per batch. Admin role required. Supports dry-run mode.

### Create Dynamic Pages
1. Add Page > Dynamic Page > connect to Products collection
2. URL becomes `/products/{slug}` — one page renders ALL products
3. Bind elements to collection fields (no code needed)

---

## Test Suite

| Checkpoint | Tests | Files |
|------------|-------|-------|
| Current (2026-02-22) | **3,526** | **96** |
| Previous session | 3,200 | 88 |
| Sprint 1 end | 2,394 | 70 |

---

*Production Manager: melania | cfutons GREEN — ALL IDLE, LAUNCH READY*
*Next: Human does Dashboard setup (plugins, CMS collections, secrets). Then fire cfutons_mobile for AR camera.*
