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
 * @param {Function} $w - Wix Velo selector function (card scope or page)
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
      badge.show();
    } else {
      badge.hide();
    }
  } catch (e) {
    try { $w('#inventoryBadge').hide(); } catch (_) {}
  }
}

/**
 * Show urgency banner on PDP below Add to Cart.
 * Uses #inventoryUrgencyBanner (Box) + #urgencyText (Text) + #urgencyIcon (Image).
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
    if (urgency.level === 'out') {
      urgencyText.text = 'Out of stock';
      urgencyText.accessibility = { ariaLabel: 'Out of stock' };
      banner.show();
    } else if (urgency.level === 'low' || urgency.level === 'just_restocked') {
      urgencyText.text = urgency.message;
      urgencyText.accessibility = { ariaLabel: urgency.message };
      banner.show();
    } else {
      banner.hide();
    }
  } catch (e) {
    try { $w('#inventoryUrgencyBanner').hide(); } catch (_) {}
  }
}
