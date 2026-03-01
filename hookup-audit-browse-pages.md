# Hookup Audit: Browse Pages (Category, Search, FAQ, Style Quiz, Compare)

**Auditor:** radahn | **Date:** 2026-03-01 | **Bead:** cf-ydqu

---

## Summary

| Page | IDs in Code | IDs in Spec | Missing from Spec | Missing from Code | Backend Imports | Dead Code |
|------|-------------|-------------|-------------------|-------------------|-----------------|-----------|
| Category Page | 68 unique | 61 | 7 | 0 | All resolve | None |
| Search Results | 33 unique | 7 | 26 | 0 | All resolve | None |
| FAQ | 8 unique | 5 | 3 | 0 | All resolve | None |
| Style Quiz | 25 unique | 0 (no page section) | **25 (entire page)** | N/A | All resolve | 1 bug |
| Compare Page | 24 unique | 0 (no page section) | **24 (entire page)** | N/A | All resolve | None |

**Critical findings:**
1. **Style Quiz page** and **Compare Page** have NO sections in WIX-STUDIO-BUILD-SPEC.md — the entire element tables are missing
2. **Search Results** spec is severely incomplete — only 7 of 33 IDs documented (filters, autocomplete, sorting, load-more, chips all missing)
3. Category Page is well-documented — only 7 IDs missing from spec (mostly active filter chips and review stars)

---

## 1. Category Page (`src/pages/Category Page.js`)

### 1a. Code → Spec Mapping (All IDs Match)

Every `$w('#id')` in code mapped to its BUILD-SPEC entry:

| ID | In Spec? | Spec Section |
|----|----------|-------------|
| `#categoryHeroSection` | YES | Hero Section |
| `#categoryHeroTitle` | YES | Hero Section |
| `#categoryHeroSubtitle` | YES | Hero Section |
| `#breadcrumbHome` | YES | Breadcrumbs |
| `#breadcrumbCurrent` | YES | Breadcrumbs |
| `#sortDropdown` | YES | Filter Bar (Basic) |
| `#filterBrand` | YES | Filter Bar (Basic) |
| `#filterPrice` | YES | Filter Bar (Basic) |
| `#filterSize` | YES | Filter Bar (Basic) |
| `#clearFilters` | YES | Filter Bar (Basic) |
| `#resultCount` | YES | Filter Bar (Basic) |
| `#categoryDataset` | YES | Product Grid |
| `#productGridRepeater` | YES | Product Grid |
| `#gridImage` | YES | Product Grid (repeater) |
| `#gridName` | YES | Product Grid (repeater) |
| `#gridPrice` | YES | Product Grid (repeater) |
| `#gridOrigPrice` | YES | Product Grid (repeater) |
| `#gridSaleBadge` | YES | Product Grid (repeater) |
| `#gridBrand` | YES | Product Grid (repeater) |
| `#gridRibbon` | YES | Product Grid (repeater) |
| `#quickViewBtn` | YES | Product Grid (repeater) |
| `#gridBadge` | YES | Product Grid (repeater) |
| `#gridFabricBadge` | YES | Product Grid (repeater) |
| `#gridCompareBtn` | YES | Product Grid (repeater) |
| `#gridSwatchPreview` | YES | Product Grid (repeater) |
| `#swatchDot1`–`#swatchDot4` | YES | Product Grid (repeater) |
| `#quickViewModal` | YES | Quick View Modal |
| `#qvImage` | YES | Quick View Modal |
| `#qvName` | YES | Quick View Modal |
| `#qvPrice` | YES | Quick View Modal |
| `#qvDescription` | YES | Quick View Modal |
| `#qvViewFull` | YES | Quick View Modal |
| `#qvAddToCart` | YES | Quick View Modal |
| `#qvClose` | YES | Quick View Modal |
| `#emptyStateSection` | YES | Empty State |
| `#emptyStateTitle` | YES | Empty State |
| `#emptyStateMessage` | YES | Empty State |
| `#emptyStateIllustration` | YES | Empty State |
| `#noMatchesSection` | YES | No-Matches State |
| `#noMatchesTitle` | YES | No-Matches State |
| `#noMatchesMessage` | YES | No-Matches State |
| `#noMatchesSuggestion` | YES | No-Matches State |
| `#recentlyViewedSection` | YES | Recently Viewed |
| `#recentlyViewedTitle` | YES | Recently Viewed |
| `#recentlyViewedRepeater` | YES | Recently Viewed |
| `#recentImage` | YES | Recently Viewed (repeater) |
| `#recentName` | YES | Recently Viewed (repeater) |
| `#recentPrice` | YES | Recently Viewed (repeater) |
| `#compareBar` | YES | Product Comparison Bar |
| `#compareRepeater` | YES | Product Comparison Bar |
| `#compareThumb` | YES | Product Comparison Bar (repeater) |
| `#compareName` | YES | Product Comparison Bar (repeater) |
| `#comparePrice` | YES | Product Comparison Bar (repeater) |
| `#compareRemove` | YES | Product Comparison Bar (repeater) |
| `#filterMaterial` | YES | Advanced Faceted Filters |
| `#filterColor` | YES | Advanced Faceted Filters |
| `#filterFeatures` | YES | Advanced Faceted Filters |
| `#filterPriceRange` | YES | Advanced Faceted Filters |
| `#filterWidthMin` | YES | Advanced Faceted Filters |
| `#filterWidthMax` | YES | Advanced Faceted Filters |
| `#filterDepthMin` | YES | Advanced Faceted Filters |
| `#filterDepthMax` | YES | Advanced Faceted Filters |
| `#filterResultCount` | YES | Advanced Faceted Filters |
| `#clearAllFilters` | YES | Advanced Faceted Filters |
| `#filterLoadingIndicator` | YES | Advanced Faceted Filters |
| `#filterToggleBtn` | YES | Mobile Filter Drawer |
| `#filterDrawer` | YES | Mobile Filter Drawer |
| `#filterDrawerOverlay` | YES | Mobile Filter Drawer |
| `#filterDrawerApply` | YES | Mobile Filter Drawer |
| `#categorySchemaHtml` | YES | Schema Elements |
| `#categoryBreadcrumbSchemaHtml` | YES | Schema Elements |
| `#categoryOgHtml` | YES | Schema Elements |

### 1b. IDs in Code MISSING from Spec

| ID | Used In | Purpose | Action Needed |
|----|---------|---------|---------------|
| `#filterComfortLevel` | `initAdvancedFilters()` line 903 | Comfort level filter (Firm/Medium/Plush) | Add to Advanced Faceted Filters table |
| `#mobileSortBar` | `initFilterDrawer()` line 1361 | Sticky sort bar on mobile | Add to Mobile Filter Drawer table |
| `#activeFilterChips` | `renderFilterChips()` line 1101 | Container for active filter chip badges | Add new "Active Filter Chips" section |
| `#filterChipRepeater` | `renderFilterChips()` line 1127 | Repeater showing removable filter chips | Add to Active Filter Chips section |
| `#chipLabel` | Repeater item, line 1131 | Label text on each filter chip | Add to Active Filter Chips section |
| `#chipRemove` | Repeater item, line 1133 | Remove button on each filter chip | Add to Active Filter Chips section |
| `#filterChipsText` | `renderFilterChips()` line 1144 | Fallback text summary of active filters | Add to Active Filter Chips section |
| `#clearAllFiltersChip` | `renderFilterChips()` line 1121/1148 | "Clear All" chip button | Add to Active Filter Chips section |
| `#compareViewBtn` | `refreshCompareBarUI()` line 1443 | "Compare X Items" button in compare bar | Add to Product Comparison Bar table |
| `#gridReviewStars` | `initGridReviewStars()` line 584 | Star rating display on product card | Add to Product Grid repeater table |
| `#gridReviewCount` | `initGridReviewStars()` line 585 | Review count "(X)" on product card | Add to Product Grid repeater table |

### 1c. IDs in Spec MISSING from Code

None — all spec IDs are referenced in code.

### 1d. Wix Studio Editor Elements Needed

All 72 elements from spec + 11 missing elements above = **83 total elements** to create in editor.

### 1e. Backend Imports

| Import | Source | Resolves? |
|--------|--------|-----------|
| `getCollectionSchema`, `getBreadcrumbSchema`, `getCategoryMetaDescription`, `getCategoryOgTags`, `getCanonicalUrl` | `backend/seoHelpers.web` | YES |
| `getProductBadge`, `getRecentlyViewed`, `addToCompare`, `removeFromCompare`, `getCompareList` | `public/galleryHelpers` | YES |
| `getProductFallbackImage` | `public/placeholderImages.js` | YES |
| `getSwatchPreviewColors` | `backend/swatchService.web` | YES |
| `searchProducts`, `getFilterValues` | `backend/searchService.web` | YES |
| `suggestFilterRelaxation` | `backend/categorySearch.web` | YES |
| `isMobile`, `initBackToTop` | `public/mobileHelpers` | YES |
| `trackEvent` | `public/engagementTracker` | YES |
| `colors` | `public/designTokens.js` | YES |
| `getRecentlyViewed` (as `getCachedRecentlyViewed`) | `public/productCache` | YES |
| `enableSwipe` | `public/touchHelpers` | YES |
| `announce`, `makeClickable` | `public/a11yHelpers.js` | YES |
| `initCategorySocialProof` | `public/socialProofToast` | YES |
| `initCardWishlistButton`, `batchCheckWishlistStatus` | `public/WishlistCardButton` | YES |
| `getCategoryReviewSummaries` | `backend/reviewsService.web` (dynamic import) | YES |
| `addToCart` | `public/cartService` (dynamic import) | YES |

### 1f. Dead Code

None found.

---

## 2. Search Results (`src/pages/Search Results.js`)

### 2a. Code → Spec Mapping

| ID | In Spec? | Notes |
|----|----------|-------|
| `#searchQuery` | YES | |
| `#resultCount` | YES | |
| `#searchRepeater` | YES | |
| `#searchImage` | YES | Repeater item |
| `#searchName` | YES | Repeater item |
| `#searchPrice` | YES | Repeater item |
| `#searchDesc` | YES | Repeater item |
| `#noResultsBox` | YES | |
| `#noResultsText` | YES | |
| `#searchAddBtn` | YES | Repeater item |

### 2b. IDs in Code MISSING from Spec (26 elements!)

| ID | Used In | Purpose | Action Needed |
|----|---------|---------|---------------|
| `#searchInput` | `setupAutocomplete()` line 280 | Main search input field | Add to spec |
| `#searchBtn` | `setupAutocomplete()` line 316 | Search submit button | Add to spec |
| `#loadMoreBtn` | `performSearch()` line 94 | "Load More" pagination button | Add to spec |
| `#loadingIndicator` | `hideSkeletonGrid()` line 234 | Loading spinner | Add to spec |
| `#suggestionsBox` | `showSuggestions()` line 375 | Autocomplete dropdown container | Add to spec |
| `#suggestionsRepeater` | `showSuggestions()` line 376 | Repeater for suggestion items | Add to spec |
| `#suggestionText` | Repeater item, line 383 | Suggestion label text | Add to spec |
| `#suggestionType` | Repeater item, line 386 | "Category" / "Trending" / "Product" type label | Add to spec |
| `#categoryFilter` | `setupFilters()` line 416 | Category filter dropdown | Add to spec |
| `#priceFilter` | `setupFilters()` line 426 | Price range filter dropdown | Add to spec |
| `#materialFilter` | `setupFilters()` line 436 | Material filter dropdown | Add to spec |
| `#colorFilter` | `setupFilters()` line 446 | Color filter dropdown | Add to spec |
| `#filterToggleBtn` | `setupFilters()` line 456 | Mobile filter sidebar toggle | Add to spec |
| `#filterSidebar` | `setupFilters()` line 458 | Mobile filter sidebar panel | Add to spec |
| `#clearFiltersBtn` | `setupFilters()` line 471 | Clear all filters button | Add to spec |
| `#filterBadge` | `updateFilterBadge()` line 525 | Active filter count badge | Add to spec |
| `#sortDropdown` | `setupSorting()` line 539 | Sort by dropdown | Add to spec |
| `#searchRibbon` | Repeater item, line 133 | Product badge overlay in results | Add to spec |
| `#searchOrigPrice` | Repeater item, line 143 | Strikethrough original price | Add to spec |
| `#searchSwatchPreview` | `initGridSwatchPreview()` line 239 | Swatch color dots container | Add to spec |
| `#searchSwatchDot1`–`#searchSwatchDot4` | `initGridSwatchPreview()` line 259 | Color preview dots | Add to spec |
| `#searchChipsRepeater` | `loadPopularChips()` line 583 | Popular search chips repeater | Add to spec |
| `#chipLabel` | Repeater item, line 587 | Chip text label | Add to spec |

### 2c. IDs in Spec MISSING from Code

None.

### 2d. Wix Studio Editor Elements Needed

Spec lists 10 elements. Code requires **36 total elements**. The following sections need to be added to the spec:
- **Search Input & Button** (2 elements)
- **Autocomplete Suggestions** (suggestionsBox, suggestionsRepeater + 2 repeater items = 4 elements)
- **Filter Bar** (categoryFilter, priceFilter, materialFilter, colorFilter, filterToggleBtn, filterSidebar, clearFiltersBtn, filterBadge = 8 elements)
- **Sorting** (sortDropdown = 1 element)
- **Load More & Loading** (loadMoreBtn, loadingIndicator = 2 elements)
- **Repeater extras** (searchRibbon, searchOrigPrice, searchSwatchPreview + 4 dots = 7 elements)
- **Popular Search Chips** (searchChipsRepeater + chipLabel = 2 elements)

### 2e. Backend Imports

| Import | Source | Resolves? |
|--------|--------|-----------|
| `fullTextSearch`, `getAutocompleteSuggestions`, `getPopularSearches`, `getFilterValues` | `backend/searchService.web` | YES |
| `trackEvent` | `public/engagementTracker` | YES |
| `addToCart` | `public/cartService` | YES |
| `limitForViewport`, `initBackToTop`, `getViewport` | `public/mobileHelpers` | YES |
| `announce`, `makeClickable` | `public/a11yHelpers.js` | YES |
| `batchCheckWishlistStatus`, `initCardWishlistButton` | `public/WishlistCardButton.js` | YES |
| `buildProductBadgeOverlay` | `public/galleryHelpers` | YES |
| `getSwatchPreviewColors` | `backend/swatchService.web` | YES |
| `buildSkeletonData`, `getActiveFilterCount`, `buildSearchChips` | `public/SearchResultsHelpers.js` | YES |

### 2f. Dead Code

None found.

---

## 3. FAQ (`src/pages/FAQ.js`)

### 3a. Code → Spec Mapping

| ID | In Spec? |
|----|----------|
| `#faqSearchInput` | YES |
| `#faqRepeater` | YES |
| `#faqQuestion` | YES (repeater item) |
| `#faqAnswer` | YES (repeater item) |
| `#faqToggle` | YES (repeater item) |
| `#faqNoResults` | YES |
| `#faqSchemaHtml` | YES |

### 3b. IDs in Code MISSING from Spec

| ID | Used In | Purpose | Action Needed |
|----|---------|---------|---------------|
| `#faqCategoryRepeater` | `initCategoryFilters()` line 34 | Category filter tabs (All, Shipping, Returns, Products, Financing, Showroom) | Add to spec |
| `#categoryLabel` | Repeater item, line 45 | Text label for each category tab | Add to spec |
| `#faqMetaHtml` | `injectFaqMeta()` line 184 | Hidden HtmlComponent for meta tags | Add to spec |

### 3c. IDs in Spec MISSING from Code

None.

### 3d. Wix Studio Editor Elements Needed

Spec lists 7 elements. Code requires **10 total elements**:
- Add `#faqCategoryRepeater` (Repeater) — category filter tabs
- Add `#categoryLabel` (Text) — repeater item for category name
- Add `#faqMetaHtml` (HtmlComponent) — hidden, for page meta injection

### 3e. Backend Imports

| Import | Source | Resolves? |
|--------|--------|-----------|
| `getFaqSchema`, `getPageTitle`, `getCanonicalUrl`, `getPageMetaDescription` | `backend/seoHelpers.web` | YES |
| `trackEvent` | `public/engagementTracker` | YES |
| `initBackToTop` | `public/mobileHelpers` | YES |
| `announce` | `public/a11yHelpers` | YES |
| `getFaqData`, `getFaqCategories`, `filterFaqsByCategory`, `searchFaqs`, `buildFaqSchemaData` | `public/faqHelpers.js` | YES |

### 3f. Dead Code

None found.

---

## 4. Style Quiz (`src/pages/Style Quiz.js`)

### 4a. ENTIRE PAGE MISSING FROM SPEC

The BUILD-SPEC has a "Style Quiz CTA Section" on the **Home page** (line 237) but **no dedicated Style Quiz page section**. All 25 element IDs are undocumented.

### 4b. All IDs in Code (need new spec section)

**Page-level elements:**

| ID | Type Needed | Purpose |
|----|-------------|---------|
| `#quizSection` | Section/Box | Main quiz container (visible during quiz) |
| `#quizProgressBar` | ProgressBar/Slider | Visual progress indicator (0-100%) |
| `#quizProgressText` | Text | "Step X of 5" |
| `#quizStepTitle` | Text (H2) | Current step question title |
| `#quizStepSubtitle` | Text | Current step subtitle/description |
| `#quizOptionsRepeater` | Repeater | Grid of answer option cards |
| `#quizNextBtn` | Button | "Next" / "See My Recommendations" |
| `#quizBackBtn` | Button | Back to previous step |
| `#quizRestartBtn` | Button | Start over |
| `#quizValidation` | Text | "Please select an option" — hidden default |
| `#quizLoadingState` | Section/Box | Loading state container — hidden default |
| `#quizLoadingText` | Text | "Finding your perfect match..." |
| `#quizResults` | Section/Box | Results container — hidden default |
| `#resultsTitle` | Text (H2) | "Your Top X Matches" |
| `#resultsSubtitle` | Text | Description text |
| `#resultsRepeater` | Repeater | Recommendation product cards |
| `#resultsBrowseBtn` | Button | "Browse full collection" fallback — hidden default |

**Repeater items (`#quizOptionsRepeater`):**

| ID | Type Needed | Purpose |
|----|-------------|---------|
| `#optionContainer` | Box | Clickable option card — highlight on select |
| `#optionLabel` | Text | Option name |
| `#optionDescription` | Text | Option description |

**Repeater items (`#resultsRepeater`):**

| ID | Type Needed | Purpose |
|----|-------------|---------|
| `#resultProductImage` | Image | Recommended product image |
| `#resultProductName` | Text (H3) | Product name |
| `#resultProductPrice` | Text | Formatted price |
| `#resultMatchReason` | Text | Why this product was recommended |
| `#resultMatchBadge` | Text/Box | "Top Pick" / "Great Match" / "Good Option" |
| `#resultViewBtn` | Button | Navigate to product page |

### 4c. Backend Imports

| Import | Source | Resolves? |
|--------|--------|-----------|
| `getQuizRecommendations`, `getQuizOptions` | `backend/styleQuiz.web` | YES |
| `trackEvent` | `public/engagementTracker` | YES |
| `initBackToTop` | `public/mobileHelpers` | YES |
| `announce` | `public/a11yHelpers` | YES |

### 4d. Dead Code / Bugs

**Bug on line 249:** `$w('#resultViewBtn').target = '_self'` uses page-level `$w` instead of `$item` inside a repeater `onItemReady`. This targets a global element instead of the specific repeater item. Should be `$item('#resultViewBtn').target = '_self'` (or removed — `.target` may not be needed since navigation uses `wixLocationFrontend.to()`).

---

## 5. Compare Page (`src/pages/Compare Page.js`)

### 5a. ENTIRE PAGE MISSING FROM SPEC

No "Compare Page" section exists in the BUILD-SPEC. All 24+ element IDs are undocumented.

### 5b. All IDs in Code (need new spec section)

**Page-level elements:**

| ID | Type Needed | Purpose |
|----|-------------|---------|
| `#compareLoading` | Box/Image | Loading spinner — hidden default |
| `#compareContent` | Section/Box | Main comparison content — hidden until loaded |
| `#compareEmptyState` | Section/Box | Empty state when <2 products — hidden default |
| `#emptyStateTitle` | Text (H2) | "Compare Products" |
| `#emptyStateText` | Text | Instructions to add products |
| `#browseProductsBtn` | Button | Navigate to category page |
| `#comparePageTitle` | Text (H1) | "Comparing X Products" |
| `#comparisonRowRepeater` | Repeater | Spec comparison rows |
| `#shareCompareBtn` | Button | Copy shareable link to clipboard |
| `#shareUrlText` | Text | Displays copied URL — hidden default |
| `#addProductBtn` | Button | "Add another product" — hidden when 4 products |

**Dynamic column elements (1–4):**

| ID Pattern | Type Needed | Purpose |
|------------|-------------|---------|
| `#compareCol1`–`#compareCol4` | Box | Product column container |
| `#compareImage1`–`#compareImage4` | Image | Product image |
| `#compareName1`–`#compareName4` | Text (H3) | Product name |
| `#comparePrice1`–`#comparePrice4` | Text | Product price |
| `#compareBadge1`–`#compareBadge4` | Text/Box | Ribbon badge — hidden default |
| `#winnerBadge1`–`#winnerBadge4` | Text/Box | "Best Value" / "Best Rated" — hidden default |
| `#removeProduct1`–`#removeProduct4` | Button | Remove from comparison |

**Repeater items (`#comparisonRowRepeater`):**

| ID | Type Needed | Purpose |
|----|-------------|---------|
| `#rowLabel` | Text | Spec attribute name (e.g., "Material", "Weight") |
| `#rowCell1`–`#rowCell4` | Text | Value for each product column |

### 5c. Backend Imports

| Import | Source | Resolves? |
|--------|--------|-----------|
| `getComparisonData`, `buildShareableUrl`, `trackComparison` | `backend/comparisonService.web` | YES |
| `getCompareList`, `removeFromCompare`, `addToCompare` | `public/galleryHelpers.js` | YES |
| `colors` | `public/designTokens.js` | YES |
| `collapseOnMobile`, `initBackToTop`, `isMobile` | `public/mobileHelpers` | YES |
| `trackProductPageView` | `public/engagementTracker` | YES |
| `announce`, `makeClickable` | `public/a11yHelpers` | YES |

### 5d. Dead Code

None found.

---

## Action Items

### P0 — Spec sections to CREATE (entire pages missing)

1. **Add `## Page: STYLE QUIZ` section** to BUILD-SPEC with all 25 element IDs documented above
2. **Add `## Page: COMPARE PAGE` section** to BUILD-SPEC with all 24+ element IDs (including dynamic 1–4 columns)

### P1 — Spec sections to UPDATE (missing elements)

3. **Search Results** — Add 26 missing elements: search input, search button, autocomplete box, filter dropdowns (category, price, material, color), sort dropdown, load more button, filter sidebar, popular chips repeater, swatch preview dots, ribbon badge, original price
4. **FAQ** — Add 3 missing elements: `#faqCategoryRepeater`, `#categoryLabel`, `#faqMetaHtml`
5. **Category Page** — Add 11 missing elements: comfort level filter, mobile sort bar, active filter chips section (container + repeater + chipLabel + chipRemove + chipsText + clearAllChip), compare view button, grid review stars + count

### P2 — Code bug to fix

6. **Style Quiz line 249**: `$w('#resultViewBtn').target = '_self'` should be `$item('#resultViewBtn')` (wrong scope inside repeater `onItemReady`)

### Total Wix Studio Elements Needed

| Page | Elements |
|------|----------|
| Category Page | ~83 |
| Search Results | ~36 |
| FAQ | ~10 |
| Style Quiz | ~25 |
| Compare Page | ~39 (11 static + 28 dynamic columns) |
| **Total** | **~193** |
