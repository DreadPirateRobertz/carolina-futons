// ProductInfoModal.js — Product care guide + dimensions modal
// Opens overlay with care instructions, full dimensions
// (width/depth/height/weight), and a room fit calculator.
// Data sourced from ProductSpecs CMS via catalogContent.getProductSpecs.
//
// Element nicknames:
//   careGuideBtn     — trigger button
//   dimensionsModal  — modal/overlay container
//   roomWidthInput   — room width input (inches)
//   roomLengthInput  — room length input (inches)
//   fitResult        — fit result text display

import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import { getProductSpecs } from 'backend/catalogContent.web.js';

// Room fit thresholds (inches clearance on each side)
const CLEARANCE_GOOD = 2;

// ── initProductInfoModal ──────────────────────────────────────────────

/**
 * Initialize the product info modal (care guide + dimensions + room fit).
 * Lazy-loads product specs from CMS on first open.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state (must have state.product.slug)
 */
export async function initProductInfoModal($w, state) {
  try {
    try { $w('#dimensionsModal').collapse(); } catch (e) {
      console.warn('[ProductInfoModal] collapse failed:', e?.message);
    }

    const hasProduct = state?.product?.slug;
    if (!hasProduct) {
      try { $w('#careGuideBtn').hide(); } catch (e) {
        console.warn('[ProductInfoModal] hide btn failed:', e?.message);
      }
      return;
    }

    // ARIA attributes
    try { $w('#careGuideBtn').accessibility.ariaLabel = 'Open care guide and dimensions'; } catch (e) {
      console.warn('[ProductInfoModal] ARIA careGuideBtn failed:', e?.message);
    }
    try { $w('#dimensionsModal').accessibility.role = 'dialog'; } catch (e) {
      console.warn('[ProductInfoModal] ARIA role failed:', e?.message);
    }
    try { $w('#dimensionsModal').accessibility.ariaModal = true; } catch (e) {
      console.warn('[ProductInfoModal] ARIA modal failed:', e?.message);
    }

    const dialog = setupAccessibleDialog($w, {
      panelId: '#dimensionsModal',
      closeId: '#dimensionsModalClose',
      titleId: '#dimensionsModalTitle',
      focusableIds: [
        '#dimensionsModalClose',
        '#roomWidthInput',
        '#roomLengthInput',
        '#checkRoomFitBtn',
      ],
      onClose: () => {
        announce($w, 'Care guide closed');
      },
    });

    let initialized = false;
    let specs = null;

    $w('#careGuideBtn').onClick(async () => {
      try {
        if (!initialized) {
          specs = await _loadSpecs($w, state.product.slug);
          initialized = true;
        }
        announce($w, 'Care guide opened');
        dialog.open();
      } catch (e) {
        console.error('[ProductInfoModal] onClick failed:', e?.message || e);
      }
    });

    // Room fit calculator — wired after dialog is set up
    try {
      $w('#checkRoomFitBtn').onClick(() => {
        try {
          _checkRoomFit($w, specs);
        } catch (e) {
          console.error('[ProductInfoModal] checkRoomFit failed:', e?.message || e);
        }
      });
    } catch (e) {
      console.warn('[ProductInfoModal] checkRoomFitBtn wire failed:', e?.message);
    }
  } catch (e) {
    console.error('[ProductInfoModal] Init failed:', e?.message || e);
  }
}

// ── _loadSpecs ────────────────────────────────────────────────────────

/**
 * Fetch product specs from CMS and populate modal elements.
 * Each DOM write is wrapped in try/catch — partial failure doesn't block render.
 *
 * @param {Function} $w
 * @param {string} slug - Product URL slug
 * @returns {Object|null} Normalized specs object, or null if unavailable
 */
async function _loadSpecs($w, slug) {
  let specs = null;

  try {
    const { success, data } = await getProductSpecs(slug);
    if (success && data) {
      specs = data;
    }
  } catch (e) {
    console.warn('[ProductInfoModal] getProductSpecs failed:', e?.message);
  }

  _renderCareGuide($w, specs?.careGuide || null);
  _renderDimensions($w, specs?.dimensions || null);

  return specs;
}

// ── _renderCareGuide ──────────────────────────────────────────────────

/**
 * Populate the care instructions section of the modal.
 * Shows a fallback message when no care guide is available.
 *
 * @param {Function} $w
 * @param {string|null} careGuide - Care instruction text from CMS
 */
function _renderCareGuide($w, careGuide) {
  const text = careGuide || 'Care instructions not available for this product.';
  try { $w('#careGuideText').text = text; } catch (e) {
    console.warn('[ProductInfoModal] careGuideText render failed:', e?.message);
  }
}

// ── _renderDimensions ─────────────────────────────────────────────────

/**
 * Populate the dimensions section with width, depth, height, and weight.
 * Expects dimensions object from ProductSpecs CMS (parsed JSON).
 *
 * @param {Function} $w
 * @param {Object|null} dims - Dimensions object { width, depth, height, weight, ... }
 */
function _renderDimensions($w, dims) {
  if (!dims) {
    try { $w('#dimensionsText').text = 'Dimensions not available for this product.'; } catch (e) {}
    return;
  }

  const lines = [];
  if (dims.width)  lines.push(`Width:  ${dims.width}"`);
  if (dims.depth)  lines.push(`Depth:  ${dims.depth}"`);
  if (dims.height) lines.push(`Height: ${dims.height}"`);
  if (dims.weight) lines.push(`Weight: ${dims.weight} lbs`);

  const text = lines.length > 0
    ? lines.join('\n')
    : 'Dimensions not available for this product.';

  try { $w('#dimensionsText').text = text; } catch (e) {
    console.warn('[ProductInfoModal] dimensionsText render failed:', e?.message);
  }
}

// ── _checkRoomFit ─────────────────────────────────────────────────────

/**
 * Evaluate whether the product fits in the customer's room and display result.
 * Reads roomWidthInput and roomLengthInput values (inches).
 * Compares against product width + depth from specs.dimensions.
 * Writes result to fitResult element with ARIA live region.
 *
 * Fit categories:
 *   fits    — both dimensions have ≥ CLEARANCE_GOOD inches clearance
 *   tight   — fits but < CLEARANCE_GOOD inches clearance on at least one side
 *   too-big — room too small in at least one dimension
 *
 * @param {Function} $w
 * @param {Object|null} specs - Product specs (may be null if CMS unavailable)
 */
function _checkRoomFit($w, specs) {
  let roomWidth, roomLength;

  try {
    roomWidth = parseFloat($w('#roomWidthInput').value);
    roomLength = parseFloat($w('#roomLengthInput').value);
  } catch (e) {
    console.warn('[ProductInfoModal] reading room inputs failed:', e?.message);
    _setFitResult($w, '⚠ Unable to read room dimensions.', 'unknown');
    return;
  }

  if (!Number.isFinite(roomWidth) || !Number.isFinite(roomLength) ||
      roomWidth <= 0 || roomLength <= 0 || roomWidth > 600 || roomLength > 600) {
    _setFitResult($w, 'Please enter valid room dimensions (1–600 inches).', 'invalid');
    return;
  }

  const dims = specs?.dimensions;
  if (!dims?.width || !dims?.depth) {
    _setFitResult($w, 'Product dimensions not available — cannot calculate fit.', 'unknown');
    return;
  }

  const productWidth = Number(dims.width);
  const productDepth = Number(dims.depth);

  if (!Number.isFinite(productWidth) || !Number.isFinite(productDepth)) {
    _setFitResult($w, 'Product dimensions not available — cannot calculate fit.', 'unknown');
    return;
  }

  const widthClearance = roomWidth - productWidth;
  const lengthClearance = roomLength - productDepth;

  if (widthClearance < 0 || lengthClearance < 0) {
    const dim = widthClearance < 0 ? `width (needs ${productWidth}", room is ${roomWidth}")` : `length (needs ${productDepth}", room is ${roomLength}")`;
    _setFitResult($w, `✗ Too big — product won't fit. Check ${dim}.`, 'too-big');
    return;
  }

  const tight = widthClearance < CLEARANCE_GOOD || lengthClearance < CLEARANCE_GOOD;
  if (tight) {
    _setFitResult($w, `⚠ Tight fit — measure carefully. Less than ${CLEARANCE_GOOD}" clearance on at least one side.`, 'tight');
    return;
  }

  _setFitResult($w, `✓ Great news — this product fits your space!`, 'fits');
}

/**
 * Write the fit result text and update ARIA live region.
 *
 * @param {Function} $w
 * @param {string} message
 * @param {'fits'|'tight'|'too-big'|'invalid'|'unknown'} category
 */
function _setFitResult($w, message, category) {
  try { $w('#fitResult').text = message; } catch (e) {
    console.warn('[ProductInfoModal] fitResult text failed:', e?.message);
  }
  try { $w('#fitResult').accessibility.ariaLive = 'polite'; } catch (e) {}
  try { $w('#fitResult').show(); } catch (e) {
    console.warn('[ProductInfoModal] fitResult show failed:', e?.message);
  }

  // Announce for screen readers
  try {
    const label = `Room fit result: ${category}`;
    $w('#fitResult').accessibility.ariaLabel = label;
  } catch (e) {}
}
