/**
 * @module inventoryUrgency
 * Live inventory urgency badges for product cards and PDP.
 * Drives 'Only X left!' and 'Just restocked!' conversion signals.
 *
 * CF-cf77: Live inventory urgency badges
 */
import { getInventoryUrgency } from 'backend/inventoryService.web';

/**
 * Show urgency badge on a product card (category/collection grids).
 * Calls getInventoryUrgency and shows/hides #inventoryBadge element.
 * NOTE: Pass scoped $w from repeater onItemReady — page-level $w will
 * set the same badge text on every card.
 * 'out' level hides the card badge — out-of-stock messaging is handled at
 * PDP level via initUrgencyBanner.
 * @param {Function} $w - Scoped Wix Velo selector (from repeater onItemReady)
 * @param {string} productId
 * @returns {Promise<void>}
 */
export async function showUrgencyBadge($w, productId) {
  try {
    if (!productId) return;
    const urgency = await getInventoryUrgency(productId);
    const badge = $w('#inventoryBadge');
    if (!badge) return;
    if (urgency.level === 'low' || urgency.level === 'just_restocked') {
      badge.text = urgency.message;
      badge.accessibility = { ariaLabel: urgency.message };
      badge.show();
    } else {
      badge.hide();
    }
  } catch (e) {
    console.warn('[inventoryUrgency] showUrgencyBadge failed:', e?.message ?? e);
    try { $w('#inventoryBadge').hide(); } catch (hideErr) {
      console.warn('[inventoryUrgency] Could not hide badge after error:', hideErr?.message ?? hideErr);
    }
  }
}

/**
 * Show urgency banner in the PDP urgency banner area (#inventoryUrgencyBanner).
 * Uses #inventoryUrgencyBanner (Box) + #urgencyText (Text).
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} state - { product: { _id } }
 * @returns {Promise<void>}
 */
export async function initUrgencyBanner($w, state) {
  try {
    if (!state?.product?._id) return;
    const urgency = await getInventoryUrgency(state.product._id);
    const banner = $w('#inventoryUrgencyBanner');
    const urgencyText = $w('#urgencyText');
    if (!banner || !urgencyText) return;
    if (urgency.level === 'none') {
      banner.hide();
    } else {
      urgencyText.text = urgency.message;
      urgencyText.accessibility = { ariaLabel: urgency.message };
      banner.show();
    }
  } catch (e) {
    console.warn('[inventoryUrgency] initUrgencyBanner failed:', e?.message ?? e);
    try { $w('#inventoryUrgencyBanner').hide(); } catch (hideErr) {
      console.warn('[inventoryUrgency] Could not hide banner after error:', hideErr?.message ?? hideErr);
    }
  }
}
