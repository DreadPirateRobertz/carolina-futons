# Carolina Futons — Wix Studio Hookup Guide

> How to connect all backend services to the live Wix site.
> Generated 2026-02-21 by melania, updated 2026-02-22

## Prerequisites (Confirmed Done by Overseer)

- [x] Wix Secrets Manager — 8+ secrets configured
- [x] CMS Collections — 16+ collections created
- [x] WIX_BACKEND_KEY — added to secrets
- [x] Wix Payments — Credit, Apple Pay, Google Pay, Afterpay active

---

## Step 1: Deploy Backend Modules

All 62 `.web.js` files in `src/backend/` (plus `shipping-rates-plugin.js`, `http-functions.js`, and `blogContent.js`) must be copied to the Wix Velo editor under `backend/`. In Wix Studio:

1. Open your site in the Wix Editor
2. Turn on **Dev Mode** (toggle in top bar)
3. In the file tree sidebar, navigate to `backend/`
4. For each file in `src/backend/*.web.js`, create a corresponding file in the Wix `backend/` directory and paste the code

**Key modules to deploy (in order):**

| Module | File | Purpose |
|--------|------|---------|
| Catalog Import | `catalogImport.web.js` | Bulk product import from JSON |
| Shipping | `ups-shipping.web.js` | UPS rate calculator |
| Fulfillment | `fulfillment.web.js` | Order fulfillment tracking |
| Cart Recovery | `cartRecovery.web.js` | Abandoned cart emails |
| Email Automation | `emailAutomation.web.js` | Transactional emails |
| Loyalty | `loyaltyTiers.web.js` | Bronze/Silver/Gold/Platinum |
| Product Q&A | `productQA.web.js` | Customer questions on product pages |
| Inventory | `inventoryService.web.js` | Stock tracking & alerts |
| Reviews | `testimonialService.web.js` | Customer testimonials |
| Photo Reviews | `photoReviews.web.js` | Photo review moderation |
| SEO | `seoHelpers.web.js` | Schema markup, OG tags |
| Topic Clusters | `topicClusters.web.js` | SEO content hub |
| Analytics | `analyticsHelpers.web.js` | GA4 event tracking |
| Bundle Builder | `bundleBuilder.web.js` | Cross-sell bundles |
| Sustainability | `sustainabilityService.web.js` | Eco badges |
| Comparison | `comparisonService.web.js` | Product compare |
| Checkout | `checkoutOptimization.web.js` | Checkout flow |
| Media Gallery | `mediaGallery.web.js` | Product images |
| Core Web Vitals | `coreWebVitals.web.js` | Performance tracking |
| Browse Abandonment | `browseAbandonment.web.js` | Browse recovery |
| Delivery | `deliveryExperience.web.js` | Delivery tracking |
| Store Locator | `storeLocatorService.web.js` | Showroom info |
| Wishlist Alerts | `wishlistAlerts.web.js` | Price drop notifications |
| Gift Cards | `giftCards.web.js` | Gift card management |
| Promotions | `promotions.web.js` | Campaign management |
| A/B Testing | `abTesting.web.js` | A/B test framework |
| Account Dashboard | `accountDashboard.web.js` | Member portal |
| Order Tracking | `orderTracking.web.js` | Customer order lookup & UPS tracking |

## Step 2: Deploy Utility Modules

These go in `backend/utils/`:

| File | Purpose |
|------|---------|
| `sanitize.js` | Input sanitization (required by all modules) |

## Step 3: Deploy Page Code

Page-specific JavaScript goes in the Wix page code editor. For each page:

1. Open the page in the Wix Editor
2. Click the page code icon (bottom of editor)
3. Paste the corresponding code from `src/pages/`

| Page | File | Key Features |
|------|------|-------------|
| Product Page | `Product Page.js` | Q&A, reviews, gallery, compare, bundles |
| Thank You Page | `Thank You Page.js` | Post-purchase flow, social sharing |
| Master Page | `masterPage.js` | Global nav, cart, analytics |
| Order Tracking | `Order Tracking.js` | Order lookup, UPS timeline, notifications |
| Member Page | `Member Page.js` | Account dashboard, order history, wishlist |

## Step 4: Configure Secrets

In **Wix Dashboard > Settings > Secrets Manager**, verify these are set:

| Secret Key | Purpose | Status |
|-----------|---------|--------|
| `UPS_CLIENT_ID` | UPS API auth | Set |
| `UPS_CLIENT_SECRET` | UPS API auth | Set |
| `UPS_ACCOUNT_NUMBER` | UPS shipping account | Set |
| `SENDGRID_API_KEY` | Email delivery | Set |
| `GA4_MEASUREMENT_ID` | Google Analytics | Set |
| `GA4_API_SECRET` | GA4 server-side | Set |
| `RECAPTCHA_SECRET` | Form protection | Set |
| `WIX_BACKEND_KEY` | Backend API auth | Set |

## Step 5: Create CMS Collections

Most collections are auto-created by the backend modules on first use. But these should exist:

**Already created by overseer (16 collections)** — verify in Wix Dashboard > CMS.

**Additional collections created by backend (auto-populated):**
See `CMS-COLLECTION-SCHEMAS.md` for the full list of 66 collections with field definitions.

## Step 6: Import Product Catalog

Once `catalog-MASTER.json` is enriched with prices:

1. Open your site's Wix Dashboard
2. Navigate to the admin panel or use the dev console
3. Call `catalogImport.importProducts()` with the product array
4. Use `catalogImport.validateImportData()` first for a dry run
5. Check `catalogImport.getImportHistory()` to verify results

**Import command (from Wix dev console):**
```javascript
import { importProducts, validateImportData } from 'backend/catalogImport.web.js';

// Step 1: Validate
const validation = await validateImportData(catalogData);
console.log(validation);

// Step 2: Dry run
const dryRun = await importProducts(catalogData, { dryRun: true });
console.log(dryRun);

// Step 3: Live import
const result = await importProducts(catalogData, { dryRun: false, updateExisting: true });
console.log(result);
```

## Step 7: Configure Scheduled Jobs (Cron)

In `backend/jobs.config` or via Wix scheduled jobs:

| Job | Schedule | Function |
|-----|----------|----------|
| Cart Recovery | Every 30 min | `cartRecovery.processAbandonedCarts()` |
| Browse Recovery | Every 1 hour | `browseAbandonment.processBrowseRecovery()` |
| Email Queue | Every 5 min | `emailAutomation.processEmailQueue()` |
| Inventory Alerts | Every 1 hour | `inventoryService.checkLowStock()` |

## Step 8: Connect Domain & Publish

1. In Wix Dashboard > Settings > Domains — Wix handles DNS
2. Click **Publish** in the top-right of the Editor
3. Verify all pages load correctly
4. Test checkout flow end-to-end
5. Verify UPS shipping rates display on cart

## Verification Checklist

After deployment, test these flows:

- [ ] Homepage loads with product grid
- [ ] Category pages filter correctly
- [ ] Product page shows images, Q&A, reviews
- [ ] Add to cart works
- [ ] Shipping calculator returns UPS rates
- [ ] Checkout completes with test payment
- [ ] Thank You page displays correctly
- [ ] Member login/registration works
- [ ] Account dashboard shows order history
- [ ] Cart abandonment email triggers (30 min delay)
- [ ] Admin can import products via catalogImport
- [ ] Search returns relevant products
- [ ] Order tracking page returns tracking for known order
- [ ] Mobile responsive on all pages

---

*Guide by: melania (Production Manager) | Carolina Futons cfutons rig*
