# CF-z5tk: Search Results Page Polish

## Problem
Search Results page has basic product cards (image, name, price, add-to-cart) while Category Page has richer cards (swatches, wishlist hearts, badges, review stars). Loading state is a simple show/hide indicator. Filters are inline dropdowns rather than a sidebar.

## Changes

### 1. Product cards with swatches
- Import `swatchService.web.js` for color swatch data
- Import `WishlistCardButton.js` for heart toggle
- Import `galleryHelpers.getProductBadge()` for Sale/New/Featured badges
- Bind swatch dots (max 4), wishlist button, and badge in `onItemReady`
- Batch wishlist status check via `batchCheckWishlistStatus()`

### 2. Loading skeleton
- Replace `#loadingIndicator` with skeleton card grid
- 6-8 placeholder cards with CSS pulse animation
- Show on initial search, filter changes, and load-more
- Skeleton uses design system colors (Sand light `#F2E8D5` on Offwhite `#FAF7F2`)

### 3. Filters sidebar
- Restructure inline dropdowns into sidebar column
- Add material and color filters from `getFilterValues()`
- Active filter count badge on mobile filter toggle
- Collapsible panel on mobile (slide-in from left)
- Desktop: persistent sidebar, content area adjusts

### 4. Empty state polish
- Richer no-results: popular search chips (clickable), category browse links
- Empty query state: trending searches, featured categories

### 5. Grid layout
- Design system grid: 3-col desktop (24px gap), 2-col tablet (20px gap), 1-col mobile (16px gap)
- Card hover: shadow transition (card → cardHover, 300ms ease)

### 6. Mobile responsive
- Touch-friendly filter panel toggle
- Swipe-to-dismiss filter sidebar
- Viewport-aware card count via `limitForViewport()`

## Architecture
- Extend existing `Search Results.js` (don't rewrite)
- New helper: `src/public/SearchResultsHelpers.js` (skeleton, filter panel)
- TDD: Write tests first per quality gate

## Files
| File | Action |
|------|--------|
| `tests/searchResults.test.js` | Create (TDD) |
| `tests/searchResultsHelpers.test.js` | Create (TDD) |
| `src/public/SearchResultsHelpers.js` | Create |
| `src/pages/Search Results.js` | Modify |
