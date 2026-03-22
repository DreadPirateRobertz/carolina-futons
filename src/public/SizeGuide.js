/**
 * @module SizeGuide
 * @description Product page size guide modal. Opens a lightbox with a repeater
 * showing futon size dimensions. Static data — no API call required.
 *
 * CF-z64j
 *
 * Elements expected on the Product Page:
 *   #sizeGuideBtn      — Button near product title that opens the modal
 *   #sizeGuideModal    — Lightbox / modal element
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

export async function initSizeGuide($wFn) {
  const titleEl = safeGet($wFn, '#sizeGuideTitle');
  if (titleEl) titleEl.text = 'Futon Size Guide';

  const btn = safeGet($wFn, '#sizeGuideBtn');
  if (btn) {
    btn.accessibility.ariaLabel = 'Open size guide';
    btn.onClick(() => safeGet($wFn, '#sizeGuideModal')?.open());
  }

  const closeBtn = safeGet($wFn, '#sizeGuideClose');
  if (closeBtn) {
    closeBtn.accessibility.ariaLabel = 'Close size guide';
    closeBtn.onClick(() => safeGet($wFn, '#sizeGuideModal')?.close());
  }

  const repeater = safeGet($wFn, '#sizeGuideRepeater');
  if (!repeater) return;

  // onItemReady MUST be registered before setting .data
  repeater.onItemReady(($item, itemData) => {
    const set = (sel, val) => { const el = $item(sel); if (el) el.text = val; };
    set('#sizeGuideName',    itemData.name);
    set('#sizeGuideWidth',   itemData.width);
    set('#sizeGuideLength',  itemData.length);
    set('#sizeGuideFoldedH', itemData.foldedH);
    set('#sizeGuideOpenH',   itemData.openH);
  });

  repeater.data = SIZE_DATA.map((row, idx) => ({ _id: `size-${idx}`, ...row }));
}
