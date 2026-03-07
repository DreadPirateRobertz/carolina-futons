/**
 * @module InventoryDisplay
 * Product page inventory/stock status display and per-variant stock indicators.
 */
import { getStockStatus } from 'backend/inventoryService.web';
import { colors } from 'public/designTokens.js';

/**
 * Fetch and display product stock status and per-variant inventory indicators.
 * Shows overall status badge and optional variant-level repeater with
 * in-stock/low-stock/out-of-stock states.
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} state - Shared product page state
 * @param {Object} state.product - Current product object with _id
 * @returns {Promise<void>}
 */
export async function initInventoryDisplay($w, state) {
  try {
    if (!state.product?._id) return;

    const stockInfo = await getStockStatus(state.product._id);

    // Stock status badge
    try {
      const badge = $w('#stockStatus');
      if (badge) {
        if (stockInfo.preOrder) {
          badge.text = 'Pre-Order Available';
          badge.style.color = colors.mountainBlue;
        } else if (stockInfo.status === 'out_of_stock') {
          badge.text = 'Out of Stock';
          badge.style.color = colors.error;
        } else if (stockInfo.status === 'low_stock') {
          badge.text = 'Low Stock — Order Soon';
          badge.style.color = colors.sunsetCoral;
        } else {
          badge.text = 'In Stock';
          badge.style.color = colors.success;
        }
        try { badge.accessibility.ariaLabel = `Stock status: ${badge.text}`; } catch (e) {}
        try { badge.accessibility.ariaLive = 'polite'; } catch (e) {}
      }
    } catch (e) {}

    // Variant stock indicators
    if (stockInfo.variants.length > 0) {
      try {
        const variantRepeater = $w('#variantStockRepeater');
        if (variantRepeater) {
          variantRepeater.data = stockInfo.variants.map(v => ({
            _id: v.variantId,
            ...v,
          }));
          variantRepeater.onItemReady(($item, itemData) => {
            try { $item('#variantStockLabel').text = itemData.variantLabel; } catch (e) {}
            try {
              const statusEl = $item('#variantStockStatus');
              if (statusEl) {
                statusEl.text = itemData.status === 'out_of_stock' ? 'Sold Out'
                  : itemData.status === 'low_stock' ? `Only ${itemData.quantity} left`
                  : 'Available';
                statusEl.style.color = itemData.status === 'out_of_stock' ? colors.error
                  : itemData.status === 'low_stock' ? colors.sunsetCoral
                  : colors.success;
              }
            } catch (e) {}
          });
        }
      } catch (e) {}
    }
  } catch (e) {}
}
