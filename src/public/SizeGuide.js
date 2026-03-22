// SizeGuide.js — Static Futon Mattress Size Chart Modal
// Shows a simple size reference chart for Full/Queen/Twin futon mattresses.
// Static data only — no backend calls.
//
// Element nicknames:
//   sizeGuideBtn          — Button: 'Size Guide' trigger near product title
//   sizeGuideModal        — Box: modal overlay, collapsed by default
//   sizeGuideClose        — Button: X/close inside modal
//   sizeChartRepeater     — Repeater: one row per mattress size
//
//   Inside repeater:
//   sizeChartName         — Text: size name (Twin / Full / Queen)
//   sizeChartSofa         — Text: sofa (closed) dimensions
//   sizeChartBed          — Text: bed (open) dimensions

// ── Static size data ──────────────────────────────────────────────────────

const SIZES = [
  { _id: 'twin',  size: 'Twin',  sofa: '39"W × 75"L', bed: '39"W × 75"L' },
  { _id: 'full',  size: 'Full',  sofa: '54"W × 75"L', bed: '54"W × 75"L' },
  { _id: 'queen', size: 'Queen', sofa: '60"W × 80"L', bed: '60"W × 80"L' },
];

// ── initSizeGuide ─────────────────────────────────────────────────────────

/**
 * Initialize the static futon size guide modal.
 * Wires open/close buttons and populates the size chart repeater.
 *
 * @param {Function} $w - Wix selector function
 */
export function initSizeGuide($w) {
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
      try { $item('#sizeChartName').text = itemData.size; } catch { /* noop */ }
      try { $item('#sizeChartSofa').text = itemData.sofa; } catch { /* noop */ }
      try { $item('#sizeChartBed').text  = itemData.bed;  } catch { /* noop */ }
    });
    $w('#sizeChartRepeater').data = SIZES;
  } catch { /* noop */ }
}
