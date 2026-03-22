// SizeGuide.js — Static Futon Mattress Size Chart Modal
// Shows a size reference chart for Twin/Full/Queen futon mattresses.
// Static data only — no backend calls. State not required (see CF-nmi2).
//
// Element nicknames:
//   sizeGuideBtn          — Button: 'Size Guide' trigger near product title
//   sizeGuideModal        — Box: modal overlay, collapsed by default
//   sizeGuideClose        — Button: X/close inside modal
//   sizeChartRepeater     — Repeater: one row per mattress size
//
//   Inside repeater:
//   sizeChartName         — Text: size name (Twin / Full / Queen)
//   sizeChartDims         — Text: width × length
//   sizeChartFolded       — Text: folded height (sofa position)
//   sizeChartOpen         — Text: open height (sleeping position)

// ── Static size data ──────────────────────────────────────────────────────

const SIZES = [
  { _id: 'twin',  size: 'Twin',  dims: '39"W × 75"L', folded: '9"', open: '4.5"' },
  { _id: 'full',  size: 'Full',  dims: '54"W × 75"L', folded: '9"', open: '4.5"' },
  { _id: 'queen', size: 'Queen', dims: '60"W × 80"L', folded: '9"', open: '5"'   },
];

// ── initSizeGuide ─────────────────────────────────────────────────────────

/**
 * Initialize the static futon size guide modal.
 * Wires open/close buttons and populates the size chart repeater.
 *
 * @param {Function} $w - Wix selector function ($w('#id') returns element)
 */
export async function initSizeGuide($w) {
  // Collapse modal on load
  try { $w('#sizeGuideModal').collapse(); } catch { /* noop */ }

  // Accessible label on trigger button
  try { $w('#sizeGuideBtn').accessibility.ariaLabel = 'Open size guide'; } catch { /* noop */ }

  // Open modal
  try {
    $w('#sizeGuideBtn').onClick(() => {
      try { $w('#sizeGuideModal').expand(); } catch { /* noop */ }
    });
  } catch { /* noop */ }

  // Close modal
  try {
    $w('#sizeGuideClose').onClick(() => {
      try { $w('#sizeGuideModal').collapse(); } catch { /* noop */ }
    });
  } catch { /* noop */ }

  // Populate size chart repeater
  try {
    $w('#sizeChartRepeater').onItemReady(($item, itemData) => {
      try { $item('#sizeChartName').text   = itemData.size;   } catch { /* noop */ }
      try { $item('#sizeChartDims').text   = itemData.dims;   } catch { /* noop */ }
      try { $item('#sizeChartFolded').text = itemData.folded; } catch { /* noop */ }
      try { $item('#sizeChartOpen').text   = itemData.open;   } catch { /* noop */ }
    });
    $w('#sizeChartRepeater').data = SIZES;
  } catch { /* noop */ }
}
