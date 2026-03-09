# Category Page — Wix Studio Build Spec

> **For radahn**: Build these elements in Wix Studio editor via Playwright.
> Source: `src/pages/Category Page.js` (60 element IDs)
> Page: Create new page called "Category Page" in Wix Studio

---

## Build Order

Build sections top-to-bottom matching page scroll order. Each element needs:
1. Add element of correct type
2. Set element ID (Properties panel > ID field)
3. Position within parent container
4. Set placeholder content

---

## Section 1: Category Hero (above fold)

**Container**: `categoryHeroSection` — full-width Section, sand background

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 1 | `categoryHeroSection` | Section (full-width) | bg: `#E8D5B7` (sand) | Top of page, holds hero content |
| 2 | `categoryHeroTitle` | Text (H1) | "Futon Frames" | Playfair Display, 36px, `#3A2518` espresso |
| 3 | `categoryHeroSubtitle` | Text (paragraph) | "Handcrafted frames for every room" | Source Sans 3, 18px, `#3A2518` |
| 4 | `breadcrumbHome` | Text (small) | "Home" | 14px, clickable, inline with breadcrumbCurrent |
| 5 | `breadcrumbCurrent` | Text (small) | "Futon Frames" | 14px, bold, after " > " separator |
| 6 | `flashSaleBanner` | Container (Box) | "Flash Sale — 20% Off" | Coral bg `#E8845C`, white text, collapsible, below hero title |

---

## Section 2: Sort Bar & Result Count (above fold)

**Container**: Horizontal box below hero, flex row, space-between

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 7 | `resultCount` | Text | "24 products" | Left-aligned, 14px |
| 8 | `sortDropdown` | Dropdown | Options: Best Selling, Name A-Z, Name Z-A, Price Low-High, Price High-Low, Newest, Highest Rated | Right-aligned, default "Best Selling" |
| 9 | `mobileSortBar` | Container (Box) | Contains mobile sort controls | Hidden on desktop, shown on mobile. Full-width |

---

## Section 3: Filter Sidebar (left column, 280px)

**Layout**: 2-column layout — filters left (280px), product grid right (remaining).
Use a Container/Box as the sidebar parent.

### Basic Filters

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 10 | `filterBrand` | Dropdown | "All Brands" + Night & Day, Strata, Wall Hugger, KD Frames, Unfinished, Otis Bed | aria-label: "Filter by brand" |
| 11 | `filterPrice` | Dropdown | "All Prices" + Under $300, $300-500, $500-800, $800-1200, Over $1200 | aria-label: "Filter by price range" |
| 12 | `filterSize` | Dropdown | "All Sizes" + Full, Queen, Twin | aria-label: "Filter by size" |
| 13 | `clearFilters` | Text/Button | "Clear Filters" | Clickable text, below basic filters |

### Advanced Filters

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 14 | `filterMaterial` | Dropdown or RadioGroup | Material options | Dynamic options from backend |
| 15 | `filterColor` | Dropdown or RadioGroup | Color options | Dynamic options from backend |
| 16 | `filterFeatures` | CheckboxGroup | Feature checkboxes | Multi-select, dynamic options |
| 17 | `filterPriceRange` | Dropdown | Price range buckets | Alternative to basic price filter |
| 18 | `filterComfortLevel` | Dropdown or RadioGroup | Comfort level options | Plush/Medium/Firm |
| 19 | `filterWidthMin` | TextInput | "" | Number input, placeholder "Min width" |
| 20 | `filterWidthMax` | TextInput | "" | Number input, placeholder "Max width" |
| 21 | `filterDepthMin` | TextInput | "" | Number input, placeholder "Min depth" |
| 22 | `filterDepthMax` | TextInput | "" | Number input, placeholder "Max depth" |
| 23 | `filterResultCount` | Text | "24 products" | Shows count in filter panel |
| 24 | `clearAllFilters` | Text/Button | "Clear All" | Clickable, clears all advanced filters |
| 25 | `filterLoadingIndicator` | Container/Box | Loading spinner | Hidden by default, shown during filter apply |

### Filter Chips (below filters, above grid)

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 26 | `activeFilterChips` | Container (Box) | Holds active filter chips | Horizontal flex, wrap |
| 27 | `filterChipRepeater` | Repeater | Individual chip items | Each chip: label + X remove button |
| 28 | `filterChipsText` | Text | "Brand: Night & Day · Size: Queen" | Fallback text display of active filters |
| 29 | `clearAllFiltersChip` | Text/Button | "Clear All" | Inside chips area, hidden when no filters |

### Mobile Filter Drawer

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 30 | `filterToggleBtn` | Button | "Filters" | Mobile only, opens filter drawer |
| 31 | `filterDrawer` | Container (Box) | Contains all filter controls | Full-screen overlay on mobile, hidden default |
| 32 | `filterDrawerApply` | Button | "Apply Filters" | Inside drawer, coral bg `#E8845C` |
| 33 | `filterDrawerOverlay` | Container (Box) | Semi-transparent backdrop | Click to close drawer |

---

## Section 4: Product Grid (right column)

**Container**: Right side of 2-column layout

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 34 | `categoryDataset` | Dataset | Connected to Stores/Products | WixData dataset, not visual |
| 35 | `productGridRepeater` | Repeater | 3-col grid (desktop), 2-col (tablet), 1-col (mobile) | 24px gap between cards |

### Repeater Item Template (inside productGridRepeater)

Each repeater item contains these elements. IDs use `$item('#id')` pattern — set these IDs on elements INSIDE the repeater item template:

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| — | `gridCard` | Container (Box) | White bg, 12px radius, shadow | Card wrapper |
| — | `gridImage` | Image | Product photo | 4:3 aspect ratio, cover fit |
| — | `gridName` | Text | "Product Name" | 16px, bold, espresso |
| — | `gridPrice` | Text | "$499" | 16px, coral `#E8845C` |
| — | `gridOrigPrice` | Text | "$599" | 14px, strikethrough, gray (for sale items) |
| — | `gridSaleBadge` | Text/Container | "SALE" | Small badge, coral bg, white text |
| — | `gridBadge` | Text/Container | "New" / "Bestseller" | Blue bg for New/Bestseller, coral for Sale |
| — | `gridBrand` | Text | "Night & Day Furniture" | 12px, gray, hidden by default |
| — | `gridRibbon` | Text/Container | "Featured" | Ribbon badge, hidden by default |
| — | `gridFabricBadge` | Text | "Available in 700+ fabrics" | 12px, hidden by default |
| — | `gridSwatchPreview` | Container (Box) | Color dots row | Horizontal flex, collapsible |
| — | `swatchDot1` | Container (Box) | Colored circle | 16px x 16px, round, hidden default |
| — | `swatchDot2` | Container (Box) | Colored circle | 16px x 16px, round, hidden default |
| — | `swatchDot3` | Container (Box) | Colored circle | 16px x 16px, round, hidden default |
| — | `swatchDot4` | Container (Box) | Colored circle | 16px x 16px, round, hidden default |
| — | `quickViewBtn` | Button | "Quick View" | Appears on card hover |
| — | `gridCompareBtn` | Button | "Compare" | Small text button below card |
| — | `gridLifestyleBadge` | Text | "See It In a Room" | Small overlay badge, hidden default |

---

## Section 5: Quick View Modal (overlay)

**Container**: `quickViewModal` — Lightbox/modal overlay, hidden by default

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 36 | `quickViewModal` | Container (Box) | Modal overlay | Fixed position, hidden, z-index high, white bg, centered |
| 37 | `qvImage` | Image | Product photo | Left side of modal, large |
| 38 | `qvName` | Text (H3) | "Product Name" | Bold, espresso |
| 39 | `qvPrice` | Text | "$499" | Coral, 20px |
| 40 | `qvDescription` | Text (paragraph) | "Product description..." | 14px, max 2000 chars |
| 41 | `qvSizeSelect` | Dropdown | Twin/Full/Queen/King | Hidden when product has no size option |
| 42 | `qvAddToCart` | Button | "Add to Cart" | Coral bg `#E8845C`, white text, aria-label |
| 43 | `qvViewFull` | Button | "View Full Details" | Secondary/outline style, aria-label |
| 44 | `qvClose` | Button | "X" | Top-right corner, aria-label "Close quick view" |

---

## Section 6: Empty State (hidden by default)

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 45 | `emptyStateSection` | Container (Box) | Centered content | Hidden by default, shown when 0 products |
| 46 | `emptyStateTitle` | Text (H3) | "No products found" | Centered |
| 47 | `emptyStateMessage` | Text | "We're updating our collection..." | Centered, 16px |
| 48 | `emptyStateIllustration` | Image/Container | Mountain illustration | Decorative, hidden default |

---

## Section 7: No Matches State (hidden by default)

Shown when advanced filters return zero results (different from empty category).

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 49 | `noMatchesSection` | Container (Box) | Filter-specific empty state | Hidden by default |
| 50 | `noMatchesTitle` | Text (H3) | "No products match" | Centered |
| 51 | `noMatchesMessage` | Text | "Try adjusting your filters..." | Centered |
| 52 | `noMatchesSuggestion` | Text | "Try adjusting your price range..." | Dynamic suggestion text |

---

## Section 8: Recently Viewed (below grid)

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 53 | `recentlyViewedSection` | Container (Box) | Full-width section | Hidden by default, shown when user has history |
| 54 | `recentlyViewedTitle` | Text (H3) | "Recently Viewed" | Left-aligned |
| 55 | `recentlyViewedRepeater` | Repeater | Horizontal scroll, product cards | 4 items max, same card style as grid |

---

## Section 9: Compare Bar (sticky bottom)

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 56 | `compareBar` | Container (Box) | Sticky bottom bar | Hidden until items added to compare. White bg, shadow-up |
| 57 | `compareRepeater` | Repeater | Horizontal, product thumbnails | Max 4 items, small cards |
| 58 | `compareViewBtn` | Button | "Compare (2)" | Coral bg, right side of bar |

---

## Section 10: SEO (hidden HTML elements)

These are HtmlComponent elements for injecting structured data. Place them anywhere, collapsed/hidden.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 59 | `categorySchemaHtml` | HtmlComponent | empty | For CollectionPage JSON-LD |
| 60 | `categoryBreadcrumbSchemaHtml` | HtmlComponent | empty | For BreadcrumbList JSON-LD |
| 61 | `categoryOgHtml` | HtmlComponent | empty | For OG meta tags |

---

## Design Tokens Reference

| Token | Value | Usage |
|-------|-------|-------|
| Sand | `#E8D5B7` | Hero bg, card hover |
| Espresso | `#3A2518` | All text |
| Mountain Blue | `#5B8FA8` | New/Bestseller badges |
| Coral | `#E8845C` | CTAs, sale badges, prices |
| Off-White | `#FAF7F2` | Page background |
| Sand Light | `#F2E8D5` | Filter sidebar bg |
| Heading font | Playfair Display | H1-H3 |
| Body font | Source Sans 3 | All body text |

## Responsive Breakpoints

| Breakpoint | Grid Columns | Notes |
|-----------|-------------|-------|
| Desktop (1024px+) | 3-col product grid | Filter sidebar visible |
| Tablet (768px) | 2-col grid | Filter sidebar collapses to drawer |
| Mobile (< 768px) | 1-col grid | Filter drawer via `filterToggleBtn` |

---

## Execution Checklist

1. [ ] Create "Category Page" in Pages panel
2. [ ] Build Section 1: Hero (6 elements)
3. [ ] Build Section 2: Sort bar (3 elements)
4. [ ] Build Section 3: Filter sidebar (24 elements)
5. [ ] Build Section 4: Product grid repeater + card template (17+ elements)
6. [ ] Build Section 5: Quick View modal (9 elements)
7. [ ] Build Section 6: Empty state (4 elements)
8. [ ] Build Section 7: No matches state (4 elements)
9. [ ] Build Section 8: Recently viewed (3 elements)
10. [ ] Build Section 9: Compare bar (3 elements)
11. [ ] Build Section 10: SEO HTML components (3 elements)
12. [ ] Verify all 60+ IDs set correctly in Properties panel
13. [ ] Save and publish
