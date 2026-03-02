# Size Guide Enhancements Design (cf-c66a)

## Gap Analysis

Existing code (`ProductSizeGuide.js`, `sizeGuide.web.js`) already provides:
- Dimension display with in/cm toggle
- "Will It Fit?" room fit calculator
- Size comparison table vs similar products
- Full test coverage, accessibility, error handling, responsive behavior

### New Work Required

**1. Dimension Overlay on Gallery Images**
Add dimension callout lines (L x W x H) on product images. SVG overlay rendered on top of the main gallery image, showing measurement arrows with labeled values. Uses dimensions from `state.dimensions` (already loaded by `initDimensionDisplay`). Toggle on/off with a "Show Dimensions" button. Collapses on mobile to a simpler text-below-image format (touch targets too small for overlay arrows on phone screens).

**2. Standard Doorway Preset Buttons**
Enhance `initRoomFitChecker` with quick-check buttons for standard US door sizes: 30", 32", 36" wide (all 80" high). Clicking a preset auto-fills doorway fields and triggers the check. Reduces friction for the primary "will it fit through my door?" question.

**3. Shipping (Box) vs Assembled Dimensions**
Extend `ProductDimensions` CMS collection with shipping fields: `shippingWidth`, `shippingDepth`, `shippingHeight`, `shippingWeight`. Backend `getProductDimensions` returns these as a `shipping` object alongside `closed`/`open`. Frontend renders a third dimension row: "Shipping (Boxed)" showing the folded/boxed measurements. This directly addresses the "shipped folded vs assembled" requirement.

**4. Visual Size Comparison with Reference Objects**
SVG-based scale diagram showing the product silhouette next to a 6ft person outline and/or a standard 84" couch outline. All drawn to the same scale using the product's `closed.height` and `closed.width`. Pure client-side SVG generation — no external assets needed. Uses design token colors (espresso outline on sand background). Renders inside a dedicated `#sizeComparisonVisual` container below dimensions.

## Architecture

All new features extend existing modules — no new files needed.

### Frontend Changes (`ProductSizeGuide.js`)
- `initDimensionOverlay($w, state)` — SVG overlay on gallery image
- `initDoorwayPresets($w)` — preset buttons for standard door sizes
- `initShippingDimensions($w, state)` — shipping/box dimension row
- `initVisualSizeComparison($w, state)` — SVG scale diagram

### Backend Changes (`sizeGuide.web.js`)
- Extend `getProductDimensions` to include `shipping` object from new CMS fields
- No new webMethods needed

### Product Page Integration (`Product Page.js`)
- Add `initDimensionOverlay`, `initShippingDimensions`, `initVisualSizeComparison` to parallel init array
- `initDoorwayPresets` called within `initRoomFitChecker` (internal enhancement)

## Element IDs (Wix Studio)

New elements required in Wix Studio editor:
- `#dimensionOverlayBtn` — toggle button for gallery overlay
- `#dimensionOverlaySvg` — SVG container positioned over gallery
- `#doorPreset30`, `#doorPreset32`, `#doorPreset36` — preset buttons
- `#shippingDimsLabel`, `#shippingDims` — shipping dimension text
- `#sizeComparisonVisual` — SVG container for scale diagram

## Test Plan

TDD: write tests first for each new function. Test file: extend `tests/productSizeGuide.test.js`.

Coverage requirements:
- Happy path: overlay renders with correct measurements
- Missing data: shipping dims null → row hidden, no overlay without dims
- Preset buttons: fill correct values and trigger check
- Visual comparison: SVG contains person/product outlines at correct scale
- Mobile: overlay simplified, presets stack vertically
- Error: backend failure → graceful degradation
- Accessibility: overlay toggle has ARIA, presets have labels, SVG has role="img" + aria-label
