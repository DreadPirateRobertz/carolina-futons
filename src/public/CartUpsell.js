/**
 * @module CartUpsell
 * @description Slide-in upsell drawer triggered when a customer adds an item to cart.
 * Fetches 3 related product recommendations and presents them in a side panel.
 * Auto-dismisses after 8s or immediately on close. Tracks GA4 upsell events.
 *
 * Wix element nicknames (all on masterPage):
 *   #upsellDrawer        — slide-in container panel
 *   #upsellDrawerTitle   — title text element
 *   #upsellDrawerClose   — dismiss (X) button
 *   #upsellRepeater      — repeater for 3 product cards
 *     Per-item: #upsellItemImage, #upsellItemName, #upsellItemPrice, #upsellAddBtn
 *
 * Called from masterPage.js initCartUpsell section.
 *
 * @requires backend/productRecommendations.web — getRecommendations
 * @requires public/cartService               — addToCart, onCartChanged, getCurrentCart
 * @requires public/engagementTracker         — trackEvent
 * @requires public/ga4Tracking               — fireCustomEvent
 */

import { getRecommendations } from 'backend/productRecommendations.web';
import { addToCart, onCartChanged, getCurrentCart } from 'public/cartService';
import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';

const AUTO_DISMISS_MS = 8000;
const UPSELL_COUNT = 3;

// Module-level state — reset on each page init via initCartUpsell
let _prevCount = null;
let _prevItems = [];
let _dismissTimer = null;

/**
 * Initialise the cart upsell drawer. Call once from masterPage.js.
 * Registers an onCartChanged listener; on each item addition fetches
 * recommendations for the added product and shows the drawer.
 *
 * @param {Function} $w - Wix element selector
 */
export function initCartUpsell($w) {
  _prevCount = null;
  _prevItems = [];
  _dismissTimer = null;

  onCartChanged(async () => {
    try {
      const cart = await getCurrentCart();
      const items = cart?.lineItems || [];
      const count = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

      if (_prevCount !== null && count > _prevCount) {
        const added = _findAddedItem(items, _prevItems);
        const productId = added?.catalogReference?.catalogItemId;
        if (productId) await _showUpsellDrawer($w, productId);
      }

      _prevCount = count;
      _prevItems = items;
    } catch (e) {
      console.warn('[CartUpsell] onCartChanged handler error:', e?.message ?? e);
    }
  });
}

/**
 * Fetch recommendations and render the upsell drawer.
 *
 * @param {Function} $w
 * @param {string}   sourceProductId - The product just added to cart
 */
async function _showUpsellDrawer($w, sourceProductId) {
  try {
    const result = await getRecommendations(sourceProductId, UPSELL_COUNT);
    if (!result?.success || !result.products?.length) return;

    const products = result.products.slice(0, UPSELL_COUNT);

    // Populate repeater
    const repeater = $w('#upsellRepeater');
    repeater.data = products.map(p => ({ _id: p._id, ...p }));
    repeater.onItemReady(($item, itemData) => {
      $item('#upsellItemImage').src = itemData.mainMedia || '';
      $item('#upsellItemImage').alt = itemData.name || '';
      $item('#upsellItemName').text = itemData.name || '';
      $item('#upsellItemPrice').text = itemData.price ? `$${Number(itemData.price).toFixed(2)}` : '';

      $item('#upsellAddBtn').onClick(async () => {
        try {
          await addToCart(itemData._id, 1);
          trackEvent('upsell_add_to_cart', {
            upsellProductId: itemData._id,
            sourceProductId,
          });
          await fireCustomEvent('upsell_conversion', {
            upsellProductId: itemData._id,
            sourceProductId,
          });
        } catch (e) {
          console.warn('[CartUpsell] upsellAddBtn addToCart failed:', e?.message ?? e);
        }
      });
    });

    // Show drawer
    try {
      $w('#upsellDrawer').show('slide', { direction: 'right', duration: 300 });
    } catch (_) {
      $w('#upsellDrawer').show();
    }

    trackEvent('upsell_shown', { sourceProductId, count: products.length });

    // Wire close button
    $w('#upsellDrawerClose').onClick(() => _dismissUpsell($w));

    // Auto-dismiss after 8s, replacing any existing timer
    if (_dismissTimer) clearTimeout(_dismissTimer);
    _dismissTimer = setTimeout(() => _dismissUpsell($w), AUTO_DISMISS_MS);
  } catch (e) {
    console.warn('[CartUpsell] showUpsellDrawer error:', e?.message ?? e);
  }
}

/**
 * Hide the upsell drawer and cancel any pending auto-dismiss.
 *
 * @param {Function} $w
 */
function _dismissUpsell($w) {
  if (_dismissTimer) {
    clearTimeout(_dismissTimer);
    _dismissTimer = null;
  }
  try {
    $w('#upsellDrawer').hide('slide', { direction: 'right', duration: 300 });
  } catch (_) {
    $w('#upsellDrawer').hide();
  }
}

/**
 * Identify the line item that was just added or incremented.
 * Returns the first item whose quantity exceeds the previous cart,
 * or the first brand-new item.
 *
 * @param {Array} newItems
 * @param {Array} prevItems
 * @returns {Object|undefined}
 */
function _findAddedItem(newItems, prevItems) {
  return newItems.find(newItem => {
    const pid = newItem?.catalogReference?.catalogItemId;
    const prev = prevItems.find(
      p => p?.catalogReference?.catalogItemId === pid
    );
    return !prev || newItem.quantity > prev.quantity;
  });
}
