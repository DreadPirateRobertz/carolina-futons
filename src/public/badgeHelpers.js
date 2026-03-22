/**
 * @module badgeHelpers
 * @description Velo consumers for the CMS-driven product badge system.
 * Wires getProductBadges / getBatchProductBadges (from badgeService.web)
 * into PDP and category card elements.
 *
 * Element nicknames:
 *  - #pdpBadgeContainer  — Box element on PDP that wraps the badge text
 *  - #productBadgeRepeater — Text element inside each category card repeater item
 *
 * @requires backend/badgeService.web
 */

import { getProductBadges, getBatchProductBadges } from 'backend/badgeService.web';

// ── PDP consumer ─────────────────────────────────────────────────────

/**
 * Fetch and render the CMS badge for the current product on the PDP.
 * Targets #pdpBadgeContainer (Box) containing a Text child element.
 * Hides the container when no badge is active.
 *
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} state - Shared product page state
 * @param {Object} state.product - Current Wix Stores product object
 * @returns {Promise<void>}
 */
export async function initCmsBadgePDP($w, state) {
  try {
    if (!state?.product?._id) return;

    const result = await getProductBadges(state.product._id, {
      comparePrice: state.product.comparePrice,
      quantityInStock: state.product.quantityInStock,
    });

    const container = $w('#pdpBadgeContainer');
    if (!container) return;

    if (!result.success || !result.badge) {
      try { container.hide(); } catch (e) {}
      return;
    }

    const { label, bgColor, textColor } = result.badge;
    try { container.style.backgroundColor = bgColor; } catch (e) {}
    try {
      const textEl = $w('#pdpBadgeText');
      if (textEl) {
        textEl.text = label;
        try { textEl.style.color = textColor; } catch (e) {}
      } else {
        // Fallback: container itself is the text element
        container.text = label;
      }
    } catch (e) {}
    try { container.show(); } catch (e) {}
  } catch (e) {
    try { $w('#pdpBadgeContainer').hide(); } catch (_) {}
  }
}

// ── Category card consumer ────────────────────────────────────────────

/**
 * Batch-load CMS badges for a list of products before the category repeater renders.
 * Returns a Map<productId, badge|null> for use in onItemReady handlers.
 *
 * Usage in Category Page:
 *   const badgeMap = await batchLoadCmsBadges(products);
 *   repeater.onItemReady(($item, itemData) => {
 *     renderCardCmsBadge($item('#productBadgeRepeater'), badgeMap.get(itemData._id));
 *   });
 *
 * @param {Array<{_id: string, comparePrice?: number, quantityInStock?: number}>} products
 * @returns {Promise<Map<string, {type: string, label: string, bgColor: string, textColor: string} | null>>}
 */
export async function batchLoadCmsBadges(products) {
  const empty = new Map();
  try {
    if (!Array.isArray(products) || products.length === 0) return empty;

    const productIds = products.map(p => p._id).filter(Boolean);
    if (productIds.length === 0) return empty;

    // Build productDataMap for computed fallback badges
    const productDataMap = {};
    for (const p of products) {
      if (p._id) productDataMap[p._id] = { comparePrice: p.comparePrice, quantityInStock: p.quantityInStock };
    }

    const result = await getBatchProductBadges(productIds, productDataMap);
    if (!result.success) return empty;

    const map = new Map();
    for (const [id, badge] of Object.entries(result.badges)) {
      map.set(id, badge);
    }
    return map;
  } catch (e) {
    return empty;
  }
}

/**
 * Render a CMS badge into a category card repeater item element.
 * Hides the element when no badge is active.
 *
 * @param {Object} $el - Wix element (e.g., $item('#productBadgeRepeater'))
 * @param {{ type: string, label: string, bgColor: string, textColor: string } | null} badge
 * @returns {void}
 */
export function renderCardCmsBadge($el, badge) {
  if (!$el) return;
  try {
    if (!badge) { $el.hide(); return; }
    $el.text = badge.label;
    try { $el.style.backgroundColor = badge.bgColor; } catch (e) {}
    try { $el.style.color = badge.textColor; } catch (e) {}
    $el.show();
  } catch (e) {}
}
