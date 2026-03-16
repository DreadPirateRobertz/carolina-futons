# CF-5he2 SPIKE: Pop Ups

**Date**: 2026-03-16
**Author**: miquella
**Status**: Complete

## Executive Summary

Pop-up/modal infrastructure is **extensively built** with 13+ modal components, full WCAG 2.4.3
compliance, and 379+ test cases. All modals use a shared `setupAccessibleDialog()` pattern
with focus traps, Escape key handling, and ARIA attributes.

## Existing Code Inventory

### Core Modal Modules

| File | Lines | Modal Element | Purpose |
|------|-------|--------------|---------|
| `SizeGuideModal.js` | 94 | `#sizeGuideModal` | Product dimensions, room fit checker |
| `exitIntentCapture.js` | 106 | `#exitIntentPopup` | Lead capture on exit (10% discount) |
| `BrowseReminder.js` | 221 | `#remindMePopup` | Browse abandonment email capture (2min trigger) |
| `galleryHelpers.js` | 743 | `#lightboxOverlay` | Image lightbox with keyboard nav + zoom |
| `ProductFinancing.js` | 438 | `#financingModal` | BNPL modal with payment calculator |
| `ProductDetails.js` | 421 | `#swatchModal` | Color/pattern swatch selection |
| `CustomizationBuilder.js` | 438 | `#custPreviewOverlay` | Customization preview |
| `navigationHelpers.js` | 500+ | `#mobileMenuOverlay` | Mobile navigation drawer |

### Page-Level Modals (masterPage.js, Category Page.js)
- `#promoLightbox` — promotional campaign lightbox (delayed 3s, countdown + discount)
- `#newsletterModal` — mountain-themed newsletter with 10% offer
- `#quickViewModal` — product quick view with add-to-cart

### Accessibility Foundation (a11yHelpers.js, 598 lines)
- `setupAccessibleDialog()` — ARIA role/modal, focus trap, Escape, focus restoration
- `createFocusTrap()` — Tab cycling implementation
- `announce()` — ARIA live regions for screen reader feedback

### Test Coverage: 379+ tests

| Module | Test File | Tests |
|--------|-----------|-------|
| exitIntentCapture | exitIntentCapture.test.js | 56 |
| productSizeGuide | productSizeGuide.test.js | 84 |
| customizationBuilder | customizationBuilder.test.js | 75 |
| browseReminder | browseReminder.test.js | 46 |
| multiImageGallery | multiImageGallery.test.js | 34 |
| imageLightboxZoom | imageLightboxZoom.test.js | 33 |
| productFinancing | productFinancing.test.js | 33 |
| sizeGuideModal | sizeGuideModal.test.js | 18 |

## Key Patterns
- All modals use `setupAccessibleDialog()` — consistent WCAG compliance
- Session gating prevents re-display (exit intent, browse reminder)
- Mobile-specific: bottom-sheet animations, swipe dismissal, scroll velocity detection

## Gaps
- None significant — modal system is production-ready

## Recommendation
**No new code work needed.** Modal/popup infrastructure is comprehensive and accessible.
