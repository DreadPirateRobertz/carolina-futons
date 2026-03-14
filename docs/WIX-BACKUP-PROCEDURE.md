# Wix Dashboard Backup Procedure

**Purpose:** Complete backup of all Wix site data before making CMS, template, or
dashboard modifications. This ensures full restore capability if changes cause issues.

**Site ID:** `461379f5-91e2-43c5-8ca6-3f13767cd57a`

---

## Pre-Modification Checklist

Before ANY dashboard changes, complete every section below. Check off each item
as you go. Do not proceed with modifications until all exports are confirmed.

---

## 1. Code Backup (Git)

The Velo codebase is already version-controlled in this repo.

```bash
# Ensure you're on a clean state before modifications
git status
git stash   # if needed

# Create a backup tag with today's date
git tag backup/pre-modification-YYYY-MM-DD

# Push tag to remote
git push origin backup/pre-modification-YYYY-MM-DD
```

- [ ] All local changes committed or stashed
- [ ] Backup tag created and pushed
- [ ] Verified tag exists on remote: `git ls-remote --tags origin`

---

## 2. Product Catalog Export

### 2a. Products (Wix Stores)

1. Go to **Wix Dashboard → Store Products → Products**
2. Select **All Products** (use "Select All" checkbox)
3. Click **More Actions → Export**
4. Export format: **CSV**
5. Save as: `backup/products-YYYY-MM-DD.csv`

Exported fields include: name, handle/slug, SKU, price, compare-at price,
weight, inventory, images, description, variants, collections, product type,
tags, visibility status.

- [ ] Products CSV exported
- [ ] Verified row count matches dashboard product count

### 2b. Product Media

Product images are hosted by Wix and referenced by URL in the CSV export.
For a complete backup:

1. Open the exported CSV
2. Copy all image URLs from the `images` column
3. Download each image to `backup/product-images/`

Alternatively, if using Wix CLI:
```bash
# Wix media is accessible via the Media Manager API
# Document image filenames and their product associations
```

- [ ] Product image URLs documented
- [ ] Critical product images downloaded locally (optional but recommended)

---

## 3. Collections Export

1. Go to **Wix Dashboard → Store Products → Collections**
2. Document each collection:
   - Collection name
   - Collection slug/URL
   - Products in collection (names or SKUs)
   - Sort order
   - Collection image

Save as: `backup/collections-YYYY-MM-DD.md` or `.csv`

Current known collections (from site structure):
- Futon Frames (`/futon-frames`)
- Mattresses (`/mattresses`)
- Murphy/Cabinet Beds (`/murphy-cabinet-beds`)
- Platform Beds (`/platform-beds`)
- Casegoods & Accessories (`/casegoods-accessories`)
- Sale items (`/sales`)

- [ ] All collections documented with member products
- [ ] Collection images noted/saved

---

## 4. CMS Collections Export

Export each custom CMS collection created for this site.

### 4a. ProductAnalytics

1. Go to **Wix Dashboard → CMS (Content Manager) → ProductAnalytics**
2. Click **Export** (top right) → CSV
3. Save as: `backup/cms-product-analytics-YYYY-MM-DD.csv`

Fields: productId, productName, category, viewCount, lastViewed,
addToCartCount, purchaseCount

### 4b. ContactSubmissions

1. Go to **CMS → ContactSubmissions**
2. Export → CSV
3. Save as: `backup/cms-contact-submissions-YYYY-MM-DD.csv`

Fields: name, email, phone, subject, message, submittedAt, status

### 4c. Wishlist

1. Go to **CMS → Wishlist**
2. Export → CSV
3. Save as: `backup/cms-wishlist-YYYY-MM-DD.csv`

Fields: memberId, productId, productName, productSlug, mainMedia,
formattedPrice, addedAt

### 4d. Any Other Custom Collections

Check CMS for additional collections not listed above and export them.

- [ ] ProductAnalytics exported
- [ ] ContactSubmissions exported
- [ ] Wishlist exported
- [ ] All other custom collections exported
- [ ] Verified row counts match dashboard

---

## 5. Site Pages & Structure

### 5a. Page List

Document all site pages and their Wix page IDs:

| Page | Page ID | URL Path |
|------|---------|----------|
| Home | c1dmp | / |
| Product Page | ve2z7 | /product-page/* |
| Category Page | u0gn0 | /shop/* |
| Cart Page | mqi5m | /cart |
| Side Cart | ego5s | (lightbox/panel) |
| About | gar3e | /about |
| Contact | k14wx | /contact |
| FAQ | s2c5g | /faq |
| Search Results | evr2j | /search |
| Shipping / Getting It Home | ype8c | /getting-it-home |
| Product Videos | vu50r | /product-videos |
| Checkout | psuom | /checkout |
| Thank You | dk9x8 | /thank-you |
| Accessibility Statement | di5bl | /accessibility |
| Privacy Policy | pcvmd | /privacy-policy |
| Refund Policy | jmwgj | /refund-policy |
| Terms & Conditions | z0xvf | /terms-conditions |
| Member Page | f00pg | /member |

### 5b. Menu/Navigation Structure

1. Go to **Wix Dashboard → Site Menu**
2. Screenshot or document the full menu hierarchy
3. Note any dropdown sub-menus (Shop dropdown with subcategories)

- [ ] All pages documented with IDs and URLs
- [ ] Navigation/menu structure documented
- [ ] Screenshots of menu editor saved

---

## 6. Site Design & Theme Settings

### 6a. Design Tokens

Current design tokens are documented in `WIX-STUDIO-BUILD-SPEC.md` and
implemented in `src/public/designTokens.js`. Verify they match the live site.

### 6b. Theme Settings Export

1. Go to **Wix Studio Editor → Site Design** (or Theme panel)
2. Document/screenshot:
   - Color palette (10 swatches — see build spec)
   - Typography settings (Playfair Display, Source Sans 3)
   - Button styles
   - Default spacing/layout values

### 6c. Page Layouts

For each page, take a full-page screenshot (desktop AND mobile views):

```
backup/screenshots/
├── home-desktop.png
├── home-mobile.png
├── product-page-desktop.png
├── product-page-mobile.png
├── category-desktop.png
├── category-mobile.png
├── cart-desktop.png
├── cart-mobile.png
├── about-desktop.png
├── contact-desktop.png
├── faq-desktop.png
└── ...
```

- [ ] Color palette verified against build spec
- [ ] Typography verified against build spec
- [ ] Desktop screenshots for all pages
- [ ] Mobile screenshots for all pages

---

## 7. Site Settings

### 7a. General Settings

1. Go to **Wix Dashboard → Settings → General Info**
2. Document:
   - Business name: Carolina Futons
   - Business address
   - Phone: (828) 252-9449
   - Business hours: Wed-Sat 10am-5pm
   - Site favicon
   - Social media links (Facebook, Instagram, Pinterest)

### 7b. SEO Settings

1. Go to **Dashboard → Marketing & SEO → SEO**
2. Document:
   - Homepage meta title and description
   - Default SEO patterns for products/collections
   - Sitemap settings
   - robots.txt customizations
   - Any structured data/schema overrides

### 7c. Domain & Routing

1. Go to **Dashboard → Settings → Domains**
2. Document:
   - Primary domain
   - Any redirects configured
   - SSL certificate status

- [ ] General business info documented
- [ ] SEO settings documented
- [ ] Domain/routing settings documented

---

## 8. Store Settings

### 8a. Store Configuration

1. Go to **Dashboard → Store Settings**
2. Document:
   - Currency (USD)
   - Weight unit
   - Tax settings and tax regions
   - Shipping rules and rates
   - Payment methods configured

### 8b. Shipping Configuration

The site uses custom shipping logic (see `src/backend/shipping-rates-plugin.js`
and `src/backend/ups-shipping.web.js`). Document:

- Shipping zones and rate tables
- Free shipping threshold ($999 per code)
- UPS API credentials reference (DO NOT export actual secrets)
- Fulfillment settings

### 8c. Orders

1. Go to **Dashboard → Store Orders**
2. Export recent orders (last 90 days) as CSV
3. Save as: `backup/orders-YYYY-MM-DD.csv`

- [ ] Store currency/tax/payment settings documented
- [ ] Shipping zones and rules documented
- [ ] Recent orders exported

---

## 9. Marketing & Automations

### 9a. Triggered Emails

1. Go to **Dashboard → Marketing → Triggered Emails**
2. Document each template:
   - `contact_form_submission` — variables: customerName, customerEmail,
     customerPhone, subject, message, submittedAt
   - `new_order_notification` — variables: orderNumber, customerName,
     total, itemCount
3. Export or screenshot each email template design

### 9b. Automations

1. Go to **Dashboard → Automations**
2. Document each automation:
   - Trigger condition
   - Actions
   - Active/inactive status

### 9c. Marketing Integrations

Document any connected services:
- Google Analytics ID
- Facebook Pixel
- Any other tracking codes

- [ ] Triggered email templates documented
- [ ] Automations listed and documented
- [ ] Marketing integrations/tracking codes noted

---

## 10. Contacts & Members

1. Go to **Dashboard → Contacts**
2. Export all contacts as CSV
3. Save as: `backup/contacts-YYYY-MM-DD.csv`

4. Go to **Dashboard → Members**
5. Export member list if applicable
6. Save as: `backup/members-YYYY-MM-DD.csv`

- [ ] Contacts exported
- [ ] Members exported (if applicable)

---

## 11. Media Manager

1. Go to **Dashboard → Media Manager**
2. Document folder structure
3. Download critical media assets (logo, illustrations, hero images)
4. Save to: `backup/media/`

Key assets to prioritize:
- Site logo (`#siteLogo`, `#footerLogo`)
- Mountain ridgeline header illustration
- Hero background illustration
- Category card images (6 cards)
- Illustrated map (contact page)

- [ ] Media folder structure documented
- [ ] Logo files downloaded
- [ ] Hero/illustration assets downloaded

---

## 12. Permissions & Roles (Backend)

The backend permissions are defined in `src/backend/permissions.json`. Verify
the file in git matches the live site configuration.

- [ ] `permissions.json` verified current

---

## Restore Checklist

If modifications cause issues and you need to restore:

### Priority 1: Code Rollback (Fastest)
```bash
# Revert to pre-modification code state
git checkout backup/pre-modification-YYYY-MM-DD

# Or revert specific commits
git revert <commit-hash>

# Push reverted code (Wix syncs from main branch)
git push origin main
```

### Priority 2: CMS Data Restore
1. Go to **CMS → [Collection Name]**
2. Delete current data (if corrupted)
3. Import from backup CSV
4. Verify row counts and data integrity

### Priority 3: Product Catalog Restore
1. Go to **Store Products → Import**
2. Upload `backup/products-YYYY-MM-DD.csv`
3. Map CSV columns to Wix product fields
4. Verify all products, prices, and images restored
5. Reassign products to collections manually if needed

### Priority 4: Settings Restore
1. Re-enter business info, SEO, and store settings from documentation
2. Reconfigure shipping rules from backup notes
3. Re-upload media assets from `backup/media/`

### Priority 5: Email Templates & Automations
1. Recreate triggered email templates from screenshots/documentation
2. Recreate automations from documentation

### Verification After Restore
- [ ] Homepage loads correctly
- [ ] Product pages display with images and prices
- [ ] Category pages show correct product grids
- [ ] Cart functionality works (add, remove, quantity change)
- [ ] Checkout flow completes
- [ ] Contact form submits successfully
- [ ] Search returns results
- [ ] Mobile layout renders correctly
- [ ] SEO meta tags present on all pages
- [ ] Shipping calculator functional
- [ ] Newsletter signup works

---

## Backup Storage

Store all backup files in a `backup/` directory (gitignored to avoid bloating
the repo with large CSVs and images):

```
backup/
├── products-YYYY-MM-DD.csv
├── collections-YYYY-MM-DD.md
├── orders-YYYY-MM-DD.csv
├── contacts-YYYY-MM-DD.csv
├── members-YYYY-MM-DD.csv
├── cms-product-analytics-YYYY-MM-DD.csv
├── cms-contact-submissions-YYYY-MM-DD.csv
├── cms-wishlist-YYYY-MM-DD.csv
├── screenshots/
│   ├── home-desktop.png
│   ├── home-mobile.png
│   └── ...
├── media/
│   ├── logo.png
│   ├── footer-logo.png
│   └── ...
└── settings/
    ├── seo-settings.md
    ├── store-settings.md
    ├── shipping-rules.md
    └── automations.md
```

Also keep a copy of this backup outside the repo (e.g., shared drive or cloud
storage) for redundancy.
