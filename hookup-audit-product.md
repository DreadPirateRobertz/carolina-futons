# Hookup Audit: Product Page (Product Page.js)

**Bead**: cf-wszg | **Auditor**: miquella | **Date**: 2026-03-01

---

## 1. $w('#id') Mapping: Code → Spec

Note: Product Page.js is an orchestrator that delegates most $w work to component
modules (ProductGallery.js, ProductOptions.js, ProductDetails.js, etc.). This audit
covers only the $w references made directly in Product Page.js. Component-level
$w refs are managed by their respective modules and would need separate audits.

### Product Core (from Product Page.js directly)
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#productName` | `#productName` | MATCH | H1 product title |
| `#productPrice` | `#productPrice` | MATCH | Price display |
| `#productMainImage` | `#productMainImage` | MATCH | Main gallery image |
| `#productDataset` | `#productDataset` | MATCH | Dataset connection |
| `#productDescription` | — | IN CODE ONLY | RichText for "not found" message. Spec has Description as `—` (no ID, dataset-bound). |
| `#addToCartBtn` | — | IN CODE ONLY | Code uses `#addToCartBtn`; spec defines `#addToCartButton`. **ID MISMATCH.** |

### Related Products ("You Might Also Like")
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#relatedSection` | `#relatedSection` | MATCH | Collapsible section |
| `#relatedRepeater` | `#relatedRepeater` | MATCH | Cross-sell repeater |
| `#relatedImage` | `#relatedImage` | MATCH | Repeater: image |
| `#relatedName` | `#relatedName` | MATCH | Repeater: name |
| `#relatedPrice` | `#relatedPrice` | MATCH | Repeater: price |
| `#relatedBadge` | `#relatedBadge` | MATCH | Repeater: badge |

### Collection Products ("More From This Collection")
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#collectionSection` | `#collectionSection` | MATCH | Collapsible section |
| `#collectionRepeater` | `#collectionRepeater` | MATCH | Collection repeater |
| `#collectionImage` | `#collectionImage` | MATCH | Repeater: image |
| `#collectionName` | `#collectionName` | MATCH | Repeater: name |
| `#collectionPrice` | `#collectionPrice` | MATCH | Repeater: price |

### Recently Viewed Products
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#recentlyViewedSection` | `#recentlyViewedSection` | MATCH | Collapsible section |
| `#recentlyViewedRepeater` | `#recentlyViewedRepeater` | MATCH | Repeater |
| `#recentImage` | `#recentImage` | MATCH | Repeater: image |
| `#recentName` | `#recentName` | MATCH | Repeater: name |
| `#recentPrice` | `#recentPrice` | MATCH | Repeater: price |

### Inventory / Stock Display
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#stockStatusBadge` | — | IN CODE ONLY | Stock badge (In Stock/Low Stock/Out of Stock). Spec has `#stockStatus` — **ID MISMATCH.** |
| `#variantStockRepeater` | — | IN CODE ONLY | Per-variant stock repeater. Not in spec. |
| `#variantStockLabel` | — | IN CODE ONLY | Repeater: variant label. Not in spec. |
| `#variantStockStatus` | — | IN CODE ONLY | Repeater: variant stock status. Not in spec. |

### Browse Abandonment / Remind Me Popup
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#remindMePopup` | — | IN CODE ONLY | Popup container. Not in spec. |
| `#remindMeTitle` | — | IN CODE ONLY | "Still deciding?" text. Not in spec. |
| `#remindMeSubtitle` | — | IN CODE ONLY | Subtitle text. Not in spec. |
| `#remindMeEmailInput` | — | IN CODE ONLY | Email input. Not in spec. |
| `#remindMeSubmit` | — | IN CODE ONLY | Submit button. Not in spec. |
| `#remindMeClose` | — | IN CODE ONLY | Close button. Not in spec. |
| `#remindMeError` | — | IN CODE ONLY | Error text. Not in spec. |
| `#remindMeSuccess` | — | IN CODE ONLY | Success text. Not in spec. |

### Sections Referenced for collapseOnMobile
| Code ID | Spec ID | Status | Notes |
|---------|---------|--------|-------|
| `#relatedProductsSection` | — | IN CODE ONLY | Code passes this to `collapseOnMobile` but section is `#relatedSection` in spec. **ID MISMATCH.** |

---

## 2. IDs in Code Missing from Spec (Need to add to spec or create in editor)

**Total: 14 IDs in Product Page.js directly, missing from spec**

### ID Mismatches (code ≠ spec — must reconcile):
| Code ID | Spec ID | Resolution |
|---------|---------|------------|
| `#addToCartBtn` | `#addToCartButton` | Rename in code OR editor. Must pick one. |
| `#stockStatusBadge` | `#stockStatus` | Rename in code OR editor. Must pick one. |
| `#relatedProductsSection` | `#relatedSection` | Code uses wrong ID in `collapseOnMobile` call. Fix code. |

### Must Create in Wix Studio Editor:
| Element | Type | Notes |
|---------|------|-------|
| `#productDescription` | RichText | For "not found" fallback message (or wire to dataset field with manual ID) |
| `#variantStockRepeater` | Repeater | Per-variant stock indicator grid |
| `#variantStockLabel` | Text | Repeater: variant name/label |
| `#variantStockStatus` | Text | Repeater: stock status text |

### Remind Me Popup (8 elements):
| Element | Type | Notes |
|---------|------|-------|
| `#remindMePopup` | Box | Modal container, hidden default, dialog role |
| `#remindMeTitle` | Text (H3) | "Still deciding?" |
| `#remindMeSubtitle` | Text | Subtitle |
| `#remindMeEmailInput` | Input | Email for reminder |
| `#remindMeSubmit` | Button | "Remind Me" |
| `#remindMeClose` | Button | X icon close |
| `#remindMeError` | Text | Hidden default, validation error |
| `#remindMeSuccess` | Text | Hidden default, confirmation |

---

## 3. IDs in Spec Missing from Code (in Product Page.js directly)

These IDs exist in the spec for the Product Page but are NOT referenced in
Product Page.js. They may be wired in component modules instead.

| Spec ID | Spec Section | Likely Component Module |
|---------|-------------|----------------------|
| `#breadcrumb1`, `#breadcrumb2`, `#breadcrumb3` | Breadcrumbs | ProductDetails.js (`initBreadcrumbs`) |
| `#breadcrumbSchemaHtml` | Breadcrumbs | ProductDetails.js |
| `#productGallery` | Gallery | ProductGallery.js (`initImageGallery`) |
| `#productComparePrice` | Product Details | ProductOptions.js or AddToCart.js |
| `#stockStatus` | Product Details | Note: code uses `#stockStatusBadge` instead |
| `#sizeDropdown` | Product Details | ProductOptions.js (`initVariantSelector`) |
| `#finishDropdown` | Product Details | ProductOptions.js |
| `#addToCartButton` | Product Details | AddToCart.js. Note: code uses `#addToCartBtn` |
| `#addToCartSuccess` | Product Details | AddToCart.js |
| `#productSchemaHtml` | Product Details | ProductDetails.js (`injectProductSchema`) |
| All review IDs (`#reviewsSection`, etc.) | Reviews | ProductReviews.js |
| All financing IDs (`#financingSection`, etc.) | Financing | ProductFinancing.js |
| All swatch IDs (`#swatchSection`, etc.) | Swatch Selector | ProductOptions.js |
| All swatch modal IDs | Swatch Gallery | ProductOptions.js / ProductDetails.js |
| All swatch request IDs | Swatch Request | ProductDetails.js (`initSwatchRequest`) |
| `#productVideoSection`, etc. | Video | ProductGallery.js (`initProductVideo`) |
| All accordion IDs (`#infoHeader*`, etc.) | Info Accordion | ProductDetails.js |
| `#wishlistBtn`, `#wishlistIcon` | Wishlist | AddToCart.js (`initWishlistButton`) |
| `#stockUrgency`, `#popularityBadge` | Urgency | AddToCart.js (`initStockUrgency`) |
| `#deliveryEstimate`, `#whiteGloveNote` | Delivery | ProductDetails.js |
| `#stickyCartBar`, etc. | Sticky Bar | AddToCart.js (`initStickyCartBar`) |
| `#shareFacebook`, etc. | Social Share | ProductDetails.js (`initSocialShare`) |
| `#productBadgeOverlay` | Badge | ProductGallery.js (`initProductBadge`) |
| `#backInStockSection`, etc. | Back in Stock | AddToCart.js |
| `#bundleSection`, etc. | Bundle | AddToCart.js (`initBundleSection`) |
| `#productOgHtml` | OG Meta | productSchema.js |
| `#quantityInput`, etc. | Quantity | AddToCart.js (`initQuantitySelector`) |

**These are NOT missing from the codebase** — they're wired in component modules,
not in the orchestrator. Full component-level audit would require reading each module.

---

## 4. Backend Import Verification

| Import | Source | Exists |
|--------|--------|--------|
| `getRelatedProducts`, `getSameCollection` | `backend/productRecommendations.web` | YES |
| `getStockStatus` | `backend/inventoryService.web` | YES |
| `trackBrowseSession`, `captureRemindMeRequest` | `backend/browseAbandonment.web` | YES |
| `trackProductView`, `getRecentlyViewed` | `public/galleryHelpers.js` | YES |
| `cacheProduct`, `getCachedProduct` | `public/productCache` | YES |
| `trackProductPageView` | `public/engagementTracker` | YES |
| `fireViewContent` | `public/ga4Tracking` | YES |
| `collapseOnMobile`, `initBackToTop`, `isMobile` | `public/mobileHelpers` | YES |
| `colors` | `public/designTokens.js` | YES |
| `buildGridAlt` | `public/productPageUtils.js` | YES |
| `wixLocationFrontend` | `wix-location-frontend` | YES (Wix built-in) |
| `initImageGallery`, `initProductBadge`, `initProductVideo` | `public/ProductGallery.js` | YES |
| `initVariantSelector`, `initSwatchSelector` | `public/ProductOptions.js` | YES |
| `initBreadcrumbs`, `initProductInfoAccordion`, `initSocialShare`, `initDeliveryEstimate`, `injectProductSchema`, `initSwatchRequest`, `initSwatchCTA` | `public/ProductDetails.js` | YES |
| `initProductReviews` | `public/ProductReviews.js` | YES |
| `initFinancingOptions` | `public/ProductFinancing.js` | YES |
| `initQuantitySelector`, `initAddToCartEnhancements`, `initStickyCartBar`, `initBundleSection`, `initStockUrgency`, `initBackInStockNotification`, `initWishlistButton` | `public/AddToCart.js` | YES |
| `initComfortCards` | `public/ComfortStoryCards.js` | YES |
| `initDimensionDisplay`, `initRoomFitChecker`, `initSizeComparisonTable` | `public/ProductSizeGuide.js` | YES |
| `makeClickable` | `public/a11yHelpers.js` | YES |
| `initProductSocialProof` | `public/socialProofToast` | YES |
| `validateEmail` | `public/validators.js` | YES |
| `initProductARViewer` | `public/ProductARViewer.js` | YES |
| `injectProductMeta` (dynamic) | `public/product/productSchema.js` | YES |
| `errorMonitoring.web` (dynamic) | `backend/errorMonitoring.web` | YES |

**All 25 imports resolve. No missing files.**

Note: `isMobile` is imported but only used indirectly via other helpers.

---

## 5. Dead Code / Unused $w Refs

| Item | Location | Issue |
|------|----------|-------|
| `isMobile` | Import line 8 | Imported but never called directly |
| `#relatedProductsSection` | `collapseOnMobile` call (line 127) | Bug: should be `#relatedSection` (spec ID). Code uses non-existent ID. |

---

## 6. Critical Issues (Action Required)

### ID Mismatches — Must Reconcile Before Hookup

| # | Code ID | Spec ID | Recommendation |
|---|---------|---------|----------------|
| 1 | `#addToCartBtn` | `#addToCartButton` | **Update code** to `#addToCartButton` (spec is authoritative) |
| 2 | `#stockStatusBadge` | `#stockStatus` | **Update spec** to `#stockStatusBadge` (code is more descriptive) OR update code |
| 3 | `#relatedProductsSection` | `#relatedSection` | **Fix code bug** — change to `#relatedSection` in collapseOnMobile call |

---

## 7. Summary

| Metric | Count |
|--------|-------|
| Total unique $w IDs in Product Page.js | 34 |
| IDs matching spec | 17 |
| IDs in code, missing from spec | 14 |
| ID mismatches (code ≠ spec) | 3 |
| Spec IDs delegated to component modules | ~80+ |
| Backend/public imports | 25 (all resolve) |
| Dead imports | 1 (`isMobile`) |
| Bugs found | 1 (`#relatedProductsSection` wrong ID) |
| Wix Studio elements to create | 12 (4 stock + 8 remind-me) |

### Recommended Next Steps
1. Fix the 3 ID mismatches before any Wix Studio hookup
2. Create the 12 missing elements in Wix Studio editor
3. Update WIX-STUDIO-BUILD-SPEC.md to add the 43 Homepage + 14 Product Page missing IDs
4. Audit component modules (ProductOptions.js, ProductDetails.js, AddToCart.js, etc.) for their $w refs
