/**
 * @module SizeGuide
 * @description Product page size guide modal. Opens a modal with a repeater
 * showing futon size dimensions. Static data — no API call required.
 *
 * CF-z64j
 *
 * Elements expected on the Product Page:
 *   #sizeGuideBtn      — Button near product title that opens the modal
 *   #sizeGuideModal    — Modal element
 *   Inside modal:
 *     #sizeGuideTitle    — Text element: 'Futon Size Guide'
 *     #sizeGuideRepeater — Repeater with one row per size
 *     #sizeGuideClose    — Button that closes the modal
 *
 * Repeater item elements:
 *   #sizeGuideName    — size name (Full / Queen / Twin)
 *   #sizeGuideWidth   — mattress width
 *   #sizeGuideLength  — mattress length
 *   #sizeGuideFoldedH — sofa height (folded)
 *   #sizeGuideOpenH   — bed height (open/flat)
 */

const SIZE_DATA = [
  { name: 'Full',  width: '54"', length: '75"', foldedH: '~35"', openH: '~16"' },
  { name: 'Queen', width: '60"', length: '80"', foldedH: '~37"', openH: '~18"' },
  { name: 'Twin',  width: '39"', length: '75"', foldedH: '~35"', openH: '~16"' },
];

// ── safeGet ──────────────────────────────────────────────────────────────────

function safeGet($wFn, sel) {
  try {
    return $wFn(sel) || null;
  } catch (err) {
    const msg = err?.message ?? '';
    if (!msg.includes('not found') && !msg.includes('Cannot read'))
      console.warn('[SizeGuide] safeGet unexpected error:', sel, msg);
    return null;
  }
}

// ── initSizeGuide ─────────────────────────────────────────────────────────────

export function initSizeGuide($wFn) {
  const titleEl = safeGet($wFn, '#sizeGuideTitle');
  if (titleEl) titleEl.text = 'Futon Size Guide';

  const modal = safeGet($wFn, '#sizeGuideModal');

  const btn = safeGet($wFn, '#sizeGuideBtn');
  if (btn) {
    btn.accessibility.ariaLabel = 'Open size guide';
    btn.onClick(() => modal?.open());
  }

  const closeBtn = safeGet($wFn, '#sizeGuideClose');
  if (closeBtn) {
    closeBtn.accessibility.ariaLabel = 'Close size guide';
    closeBtn.onClick(() => modal?.close());
  }

  const repeater = safeGet($wFn, '#sizeGuideRepeater');
  if (!repeater) return;

  // onItemReady MUST be registered before setting .data
  repeater.onItemReady(($item, itemData) => {
    try {
      const set = (sel, val) => { const el = $item(sel); if (el) el.text = val; };
      set('#sizeGuideName',    itemData.name);
      set('#sizeGuideWidth',   itemData.width);
      set('#sizeGuideLength',  itemData.length);
      set('#sizeGuideFoldedH', itemData.foldedH);
      set('#sizeGuideOpenH',   itemData.openH);
    } catch (err) {
      console.warn('[SizeGuide] onItemReady error:', err?.message);
    }
  });

  repeater.data = SIZE_DATA.map((row, idx) => ({ _id: `size-${idx}`, ...row }));
}
