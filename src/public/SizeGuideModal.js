// SizeGuideModal.js - Modal wrapper for product size guide sections
// Opens a dialog with dimensions, room fit checker, comparison table,
// and other size guide components from ProductSizeGuide.js.

import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';

/**
 * Initialize the size guide modal on a product page.
 * Lazy-loads ProductSizeGuide components on first open.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state (must have state.product._id)
 */
export async function initSizeGuideModal($w, state) {
  try {
    try { $w('#sizeGuideModal').collapse(); } catch (e) { console.warn('[SizeGuideModal] collapse failed:', e?.message); }

    const hasProduct = state?.product?._id;

    if (!hasProduct) {
      try { $w('#sizeGuideBtn').hide(); } catch (e) { console.warn('[SizeGuideModal] hide btn failed:', e?.message); }
      return;
    }

    // ARIA attributes
    try { $w('#sizeGuideBtn').accessibility.ariaLabel = 'Open size guide'; } catch (e) { console.warn('[SizeGuideModal] ARIA label failed:', e?.message); }
    try { $w('#sizeGuideModal').accessibility.role = 'dialog'; } catch (e) { console.warn('[SizeGuideModal] ARIA role failed:', e?.message); }
    try { $w('#sizeGuideModal').accessibility.ariaModal = true; } catch (e) { console.warn('[SizeGuideModal] ARIA modal failed:', e?.message); }

    // Set up accessible dialog (handles focus trap, escape, close button)
    const dialog = setupAccessibleDialog($w, {
      panelId: '#sizeGuideModal',
      closeId: '#sizeGuideClose',
      titleId: '#sizeGuideTitle',
      focusableIds: [
        '#sizeGuideClose',
        '#unitToggle',
        '#roomWidthInput',
        '#roomDepthInput',
        '#doorwayWidthInput',
        '#doorwayHeightInput',
        '#hallwayWidthInput',
        '#checkFitBtn',
      ],
      onClose: () => {
        announce($w, 'Size guide closed');
      },
    });

    let initialized = false;

    $w('#sizeGuideBtn').onClick(async () => {
      try {
        if (!initialized) {
          await loadSizeGuideComponents($w, state);
          initialized = true;
        }
        announce($w, 'Size guide opened');
        dialog.open();
      } catch (e) {
        console.error('[SizeGuideModal] onClick failed:', e?.message || e);
      }
    });
  } catch (e) {
    console.error('[SizeGuideModal] Init failed:', e?.message || e);
  }
}

/**
 * Lazy-load all ProductSizeGuide component initializers.
 * Each init is wrapped in try/catch so one failure doesn't block others.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state
 */
async function loadSizeGuideComponents($w, state) {
  const m = await import('public/ProductSizeGuide.js');

  const inits = [
    () => m.initDimensionDisplay($w, state),
    () => m.initRoomFitChecker($w, state),
    () => m.initSizeComparisonTable($w, state),
    () => m.initDimensionOverlay($w, state),
    () => m.initDoorwayPresets($w),
    () => m.initShippingDimensions($w, state),
    () => m.initVisualSizeComparison($w, state),
  ];

  for (const init of inits) {
    try { await init(); } catch (e) {
      console.error('[SizeGuideModal] Component init failed:', e?.message || e);
    }
  }
}
