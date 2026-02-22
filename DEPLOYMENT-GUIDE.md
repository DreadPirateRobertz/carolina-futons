# Carolina Futons — Wix Studio Deployment Guide

**Author:** melania (Production Manager)
**Bead:** cf-0fm
**Date:** 2026-02-21
**Purpose:** Step-by-step guide for tonight's live test and future deployments

---

## Quick Start: Tonight's Live Test

### Prerequisites
1. Node.js >= 20.11 installed
2. Wix CLI: `npm install -g @wix/cli`
3. GitHub repo connected to Wix site (DreadPirateRobertz/carolina-futons)
4. Wix Premium plan active on experiment_2 site

### Deploy in 3 Steps

```bash
# 1. Ensure code is pushed to main
cd /Users/hal/gt/cfutons/mayor/rig
git status  # should be clean, up to date with origin/main

# 2. Start local dev for testing
wix dev
# → Opens Local Editor in browser at localhost:4321
# → Hot-reloads code changes

# 3. When ready to go live
wix publish
# → Choose "Latest commit from default branch"
# → Confirm with 'y'
# → Get published site URL
```

---

## What Gets Deployed

| Component | Location in Repo | Deployed By |
|-----------|-----------------|-------------|
| Backend web modules | `src/backend/*.web.js` (63 modules) | `wix publish` |
| Page code | `src/pages/*.js` (24 pages) | `wix publish` |
| Public utilities | `src/public/*.js` | `wix publish` |
| CMS collection data | Created via Dashboard or code | Manual setup |
| API secrets (UPS, etc.) | Wix Secrets Manager | Manual setup |
| Design elements | Wix Editor visual layout | Manual setup |

---

## Dashboard Setup Checklist (Before Live Test)

### 1. CMS Collections (Wix Dashboard > CMS)

Create these collections — the backend code references them:

| Collection | Used By | Key Fields |
|------------|---------|------------|
| Products | Multiple services | title, price, category, variants, images |
| Orders | orderTracking, cartRecovery | orderId, status, items, shipping |
| LoyaltyAccounts | loyaltyService | memberId, points, tier |
| Coupons | couponsService | code, discount, expiry, usageLimit |
| CartRecovery | cartRecovery | sessionId, items, email, status |
| DeliverySchedule | deliveryScheduling | orderId, date, timeSlot, type |
| AssemblyGuides | assemblyGuides | productCategory, steps, tools |
| GiftCards | giftCards | code, balance, purchaseDate |
| BlogPosts | blogService | title, content, category, seoMeta |
| Testimonials | testimonialService | name, story, product, status, featured |
| Inventory | inventoryService | productId, variantId, stockLevel, threshold |

### 2. Secrets Manager (Dashboard > Developer Tools > Secrets)

| Secret Name | Purpose | Where Used |
|-------------|---------|------------|
| `ups-api-key` | UPS shipping rate calculations | ups-shipping.web.js |
| `ups-client-id` | UPS OAuth authentication | ups-shipping.web.js |
| `ups-client-secret` | UPS OAuth authentication | ups-shipping.web.js |

### 3. Dashboard Toggles

| Setting | Location | Action |
|---------|----------|--------|
| Wix Chat | Dashboard > Chat | Enable toggle |
| Wix Loyalty | Dashboard > Loyalty | Enable |
| Wix Automations | Dashboard > Automations | Create email triggers |
| Google Analytics 4 | Dashboard > Marketing Integrations | Connect |
| Meta Pixel | Dashboard > Tracking & Analytics | Add pixel ID |
| Pinterest Tag | Dashboard > Tracking & Analytics | Add tag |

### 4. Feed URLs (Connect in External Platforms)

| Platform | Feed URL | Configure In |
|----------|----------|-------------|
| Google Merchant Center | `/_functions/googleMerchantFeed` | merchant.google.com |
| Facebook Business | `/_functions/facebookCatalogFeed` | business.facebook.com |
| Pinterest | `/_functions/pinterestProductFeed` | business.pinterest.com |

---

## Local Development (`wix dev`)

```bash
wix dev                    # Start on default port 4321
wix dev --port 5000        # Custom port
wix dev --https            # HTTPS mode (for CORS testing)
```

- Opens Local Editor in browser automatically
- Hot-reloads `.web.js` and page code changes
- Press `C` to reassign dev site, `Ctrl+C` to stop
- Backend functions callable immediately from frontend

### Testing Backend Functions Locally

In the Local Editor browser console:
```javascript
import { myFunction } from 'backend/myModule.web';
const result = await myFunction(args);
console.log(result);
```

---

## Publishing (`wix publish`)

```bash
wix publish
```

1. Choose deployment source:
   - **"Latest commit from default branch"** (recommended — stays in sync with repo)
   - "Local code" (use only for quick testing — goes out of sync)
2. Confirm with `y`
3. Get published site URL + log links

**Always push to GitHub first, then publish from the default branch.**

---

## Web Module Pattern (`.web.js`)

Our backend modules use this pattern:

```javascript
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

export const getProductData = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const result = await wixData.get('Products', productId);
    return result;
  }
);
```

**Permissions:**
- `Permissions.Anyone` — public (product pages, search)
- `Permissions.SiteMember` — logged-in users (wishlist, orders)
- `Permissions.Admin` — admin only (inventory alerts, analytics)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `wix dev` won't start | Check Node.js >= 20.11, try `--port 5000` |
| Changes not reflecting | Restart `wix dev`, clear browser cache |
| Publish fails | Ensure all changes pushed to main: `git status` |
| Secrets not working | Verify secret name matches code exactly (case-sensitive) |
| CMS data missing | Create collection in Dashboard first, then query |
| `$w('#element')` returns null | Element doesn't exist in Editor — create it per WIX-STUDIO-BUILD-SPEC.md |
| CORS errors on API calls | Move logic to `.web.js` backend module |
| 3,535+ tests but site blank | Editor elements need manual creation — code only runs when elements exist |

---

## Architecture Reference

```
src/
├── backend/           ← 63 .web.js modules (server-side, deployed)
│   ├── analyticsHelpers.web.js
│   ├── cartRecovery.web.js
│   ├── couponsService.web.js
│   ├── emailService.web.js
│   ├── inventoryService.web.js
│   ├── loyaltyService.web.js
│   ├── ups-shipping.web.js
│   └── ... (63 total)
├── pages/             ← 24 page files (Velo $w bindings)
│   ├── Home.js
│   ├── Product Page.js
│   ├── Category Page.js
│   ├── Cart Page.js
│   └── ... (24 total)
├── public/            ← Shared utilities (frontend-accessible)
│   ├── designTokens.js
│   ├── galleryHelpers.js
│   ├── touchHelpers.js
│   └── ...
tests/                 ← 97 test files, 3,535+ tests (vitest)
```

**Test suite:** `npx vitest run` — must pass before any publish.
