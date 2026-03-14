# Product Page Phase 1 — Template→Code ID Mapping

**Bead:** test-7kc
**Date:** 2026-03-13
**Author:** rennala
**Workflow:** Option C — create mapping doc, prepare remap.json, verify connectivity

---

## Context

The Furniture Store #3563 template (My Site 3) ships with a Product Page that has ~15
core elements covering ~70% of our Phase 1 BUILD-SPEC. This document maps each
template element to the BUILD-SPEC/code ID, documents the current connectivity
status, and specifies the action needed in Wix Studio.

**Sources used:**
- `TEMPLATE-ELEMENT-AUDIT.md` — template element descriptions
- `WIX-STUDIO-BUILD-SPEC.md` (lines 343-633) — spec IDs
- `ELEMENT_CONNECTIVITY_REPORT.md` — current connectivity (10/14 checked: 71.4%)
- `src/pages/Product Page.js` + component modules — code IDs

---

## Phase 1 Must-Have Elements

These are the elements that MUST be connected before the page is considered
Phase 1 complete. Deferred elements (swatch selector, full reviews form,
financing, wishlist, social share, back-in-stock, bundle, sticky bar, browse
abandonment popup) are NOT required for Phase 1.

### 1. Product Gallery

| Template Element | Description | Code ID | Build-Spec ID | Status | Action |
|-----------------|-------------|---------|---------------|--------|--------|
| Main image | Large zoomable product image | `#productMainImage` | `#productMainImage` | ✅ FOUND | — |
| Thumbnail gallery | Thumbnail strip / gallery element | `#productGallery` | `#productGallery` | ✅ FOUND (inferred) | — |

**Notes:**
- Template has 3 thumbnail buttons + main image display (aria: "product gallery" region)
- `#productGallery` is a Wix Gallery element; clicking a thumbnail updates `#productMainImage`
- Code in `src/public/ProductGallery.js` handles gallery→main image sync

### 2. Product Details

| Template Element | Description | Code ID | Build-Spec ID | Status | Action |
|-----------------|-------------|---------|---------------|--------|--------|
| Product title (H5) | "MODO" — product name | `#productName` | `#productName` | ✅ FOUND | — |
| Price (H6) | "$1,200.00" | `#productPrice` | `#productPrice` | ✅ FOUND | — |
| Compare price | Strikethrough original price | `#productComparePrice` | `#productComparePrice` | ⚠️ UNKNOWN | ADD or RENAME |
| Description | Product description text | `#productDescription` | `#productDescription` | ✅ FOUND (inferred) | — |
| Stock status | "In Stock" / "Special Order" | `#stockStatus` | `#stockStatus` | ✅ FOUND (inferred) | — |
| Product dataset | Wix Stores dataset connection | `#productDataset` | `#productDataset` | ✅ FOUND (inferred) | — |
| Product SKU | SKU text display | `#productSku` | — | ⚠️ NOT IN SPEC | Code doesn't use — skip |

**Notes:**
- `#productDescription` in code is used for "not found" fallback only; main description is dataset-bound (no ID needed)
- `#productSku` is not referenced in code or spec — skip for Phase 1

### 3. Variant Selection

| Template Element | Description | Code ID | Build-Spec ID | Status | Action |
|-----------------|-------------|---------|---------------|--------|--------|
| Color variants | Radio button list (Yellow/Purple/Green) | `#sizeDropdown` or `#finishDropdown` | `#sizeDropdown` | ⚠️ UNKNOWN | RENAME template element |
| Frame/finish dropdown | Dropdown for frame finish | `#finishDropdown` | `#finishDropdown` | ⚠️ UNKNOWN | ADD (template may not have) |

**Notes:**
- Template has a "Color variant selector" (radio buttons). This maps to our `#sizeDropdown` (Dropdown type in spec).
- If template uses a different element type (Checkbox vs Dropdown), code may need adjustment.
- `#sizeDropdown` and `#finishDropdown` are used in `src/public/ProductOptions.js`

### 4. Quantity Selector

| Template Element | Description | Code ID | Build-Spec ID | Status | Action |
|-----------------|-------------|---------|---------------|--------|--------|
| Quantity number input | Spinbutton "1" | `#quantityInput` | `#quantityInput` | ✅ FOUND (inferred) | RENAME if needed |
| Minus button | "Remove one" | `#quantityMinus` | `#quantityMinus` | ✅ FOUND (inferred) | RENAME if needed |
| Plus button | "Add one" | `#quantityPlus` | `#quantityPlus` | ✅ FOUND (inferred) | RENAME if needed |

**Notes:**
- Template has native Wix Stores quantity selector. Wix may assign its own IDs.
- The template's spinbutton aria roles suggest it might be a native Wix element.
- If it's a native Wix Stores `wix-stores-frontend` quantity selector, our code's
  `#quantityInput`/`#quantityMinus`/`#quantityPlus` need to be custom elements instead.

### 5. Add to Cart

| Template Element | Description | Code ID | Build-Spec ID | Status | Action |
|-----------------|-------------|---------|---------------|--------|--------|
| "Add to Cart" button | Primary CTA | `#addToCartButton` | `#addToCartButton` | ✅ FOUND (inferred) | — |
| Add success toast | Success notification, hidden | `#addToCartSuccess` | `#addToCartSuccess` | ⚠️ UNKNOWN | ADD |

**Notes:**
- Template has "Add to Cart" button. ID likely already matches per connectivity report.
- Template also has "Buy Now" button — not in our spec for Phase 1, can be deferred.

### 6. Breadcrumbs

| Template Element | Description | Code ID | Build-Spec ID | Status | Action |
|-----------------|-------------|---------|---------------|--------|--------|
| Breadcrumb 1 | "Home" link | `#breadcrumb1` | `#breadcrumb1` | ⚠️ UNKNOWN | RENAME |
| Breadcrumb 2 | Category name link | `#breadcrumb2` | `#breadcrumb2` | ⚠️ UNKNOWN | RENAME |
| Breadcrumb 3 | Product name (no link) | `#breadcrumb3` | `#breadcrumb3` | ⚠️ UNKNOWN | RENAME |
| Breadcrumb schema | Hidden HtmlComponent | `#breadcrumbSchemaHtml` | `#breadcrumbSchemaHtml` | ⚠️ UNKNOWN | ADD |

**Notes:**
- Template has "Home > MODO" breadcrumb nav. Wix may auto-assign IDs like `text1`, `text2`.
- All 3 must be renamed in editor to `breadcrumb1`, `breadcrumb2`, `breadcrumb3`.
- `#breadcrumbSchemaHtml` must be ADDED as a hidden HtmlComponent.

### 7. Cross-Sell ("You Might Also Like")

| Template Element | Description | Code ID | Build-Spec ID | Status | Action |
|-----------------|-------------|---------|---------------|--------|--------|
| Section container | Collapsible section | `#relatedSection` | `#relatedSection` | ⚠️ MISSING | RENAME template section |
| Repeater | 4-col product grid | `#relatedRepeater` | `#relatedRepeater` | ❌ MISSING | RENAME template carousel |
| → Image | Product image | `#relatedImage` | `#relatedImage` | ❌ MISSING | RENAME in repeater |
| → Name | Product name text | `#relatedName` | `#relatedName` | ❌ MISSING | RENAME in repeater |
| → Price | Product price text | `#relatedPrice` | `#relatedPrice` | ❌ MISSING | RENAME in repeater |
| → Badge | Ribbon/badge text, hidden | `#relatedBadge` | `#relatedBadge` | ❌ MISSING | ADD in repeater |

**Notes:**
- Template "You Might Also Like" carousel with 16 products maps to `#relatedRepeater`.
- The template carousel is likely a `Gallery` or `Repeater` element.
- Wix Gallery elements use `.items` not `.data` — if template uses Gallery, code may need patching.
- The connectivity report confirmed `relatedRepeater` as MISSING — template carousel needs rename.

---

## Phase 1 Deferred Elements (Do NOT add these yet)

Per bead description, the following are explicitly deferred to Phase 3:

| Element Group | IDs | Reason |
|---------------|-----|--------|
| Fabric swatch selector | `#swatchSection`, `#swatchGrid`, etc. | Phase 3 |
| Full review form | `#reviewForm`, `#reviewRatingInput`, etc. | Phase 3 |
| Financing section | `#financingSection`, `#financingRepeater`, etc. | Phase 3 |
| Wishlist button | `#wishlistBtn`, `#wishlistIcon` | Phase 3 |
| Social share | `#shareFacebook`, `#sharePinterest`, `#shareEmail`, `#shareCopyLink` | Phase 3 |
| Back-in-stock | `#backInStockSection`, `#backInStockEmail`, etc. | Phase 3 |
| Frequently bought together | `#bundleSection`, `#bundleImage`, etc. | Phase 3 |
| Browse abandonment popup | `#remindMePopup`, `#remindMeTitle`, etc. | Phase 3 |
| Sticky add-to-cart bar | `#stickyCartBar`, `#stickyProductName`, etc. | Phase 3 |

---

## Editor Action Plan

### Step 1: Rename existing template elements

In Wix Studio editor → Product Page → select each element → Properties & Events → ID field:

| Current template ID (discover via Layers panel) | Rename to |
|------------------------------------------------|-----------|
| *breadcrumb "Home" text* | `breadcrumb1` |
| *breadcrumb category text* | `breadcrumb2` |
| *breadcrumb product text* | `breadcrumb3` |
| *color variant radio/dropdown* | `sizeDropdown` |
| *"You Might Also Like" section* | `relatedSection` |
| *"You Might Also Like" repeater/carousel* | `relatedRepeater` |
| *related product image (in repeater)* | `relatedImage` |
| *related product name (in repeater)* | `relatedName` |
| *related product price (in repeater)* | `relatedPrice` |

### Step 2: Add missing elements

These elements must be ADDED to the page (template does not have them):

| Element | Type | ID | Section | Default |
|---------|------|----|---------|---------|
| Add to cart success toast | Box | `#addToCartSuccess` | Near add-to-cart button | Hidden |
| Breadcrumb schema | HtmlComponent | `#breadcrumbSchemaHtml` | Bottom of breadcrumb section | Hidden |
| Related product badge | Text | `#relatedBadge` | Inside `#relatedRepeater` item | Hidden |
| Frame/finish dropdown | Dropdown | `#finishDropdown` | Variant section | Visible |
| Compare price | Text | `#productComparePrice` | Near `#productPrice` | Hidden |

### Step 3: Verify with remap script (dry run)

After editor work, run connectivity check:
```bash
# Check which Phase 1 IDs are now connected
node scripts/verify-connectivity.js --page=product --phase=1
```

Or use `scripts/remap-element-ids.js product-page-remap.json` (dry run, no --apply)
to confirm there are no remaining code-side ID mismatches.

---

## Remap.json Summary

See `product-page-remap.json` in repo root. This file is for use with
`scripts/remap-element-ids.js` if any code-side renaming is required.

**Current assessment:** Code IDs match BUILD-SPEC IDs. No code-side remapping
needed for Phase 1 elements. The remap.json covers known historical mismatches
that were already fixed (retained for reference).

---

## Verification Checklist (Phase 1 AC)

After editor hookup and real product data loaded:

- [ ] `#productName` — shows real product name
- [ ] `#productPrice` — shows formatted price
- [ ] `#productMainImage` — shows real product image
- [ ] `#productGallery` — clicking thumbnail changes main image
- [ ] `#sizeDropdown` — shows product size options (Full/Queen/Twin)
- [ ] `#finishDropdown` — shows finish options (Natural Oak, Espresso, etc.)
- [ ] Variant change → `#productPrice` and `#productMainImage` update
- [ ] `#quantityInput` — starts at 1, numeric only
- [ ] `#quantityMinus` — decreases qty, min 1
- [ ] `#quantityPlus` — increases qty, max 99
- [ ] `#addToCartButton` — adds to cart, opens side cart, updates cart badge
- [ ] `#breadcrumb1` — "Home", navigates to home
- [ ] `#breadcrumb2` — category name, navigates to category
- [ ] `#breadcrumb3` — product name (no navigation)
- [ ] `#relatedRepeater` — shows 4 real related products
- [ ] Gallery stacks above details on mobile (375px)
- [ ] All touch targets ≥ 44px on mobile
- [ ] Screenshots saved (desktop 1280px + mobile 375px)
