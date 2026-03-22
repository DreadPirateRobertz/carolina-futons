// CartRecentlyViewed.js — Cart Page "You Were Looking At..." cross-sell shelf
//
// Standalone module — do NOT import from RecentlyViewedWidget.js.
// Reads session-storage browse history, filters out items already in cart,
// populates a 4-slot horizontal repeater below the cart line items.
//
// Element nicknames (Cart Page):
//   #cartRecentlyViewedSection  — Container wrapping the whole shelf
//   #cartRecentlyViewedRepeater — Repeater, up to 4 items
//   #crvProductImage            — Image per item
//   #crvProductName             — Text per item
//   #crvProductPrice            — Text per item
//   #crvAddToCartBtn            — Button per item
//
// CF-kk52

import { getViewHistory } from 'public/recentlyViewed';
import { addToCart } from 'public/cartService';

const MAX_ITEMS = 4;
const SUCCESS_LABEL = '✓ Added';
const DEFAULT_LABEL = 'Add to Cart';
const SUCCESS_DURATION_MS = 1500;

/**
 * Initialise the recently-viewed shelf on the Cart Page.
 *
 * Call once on page load with the current cart items, and again inside
 * the onCartChanged callback to re-filter after inline Add to Cart.
 *
 * @param {Function} $w - Wix element selector
 * @param {Array}    cartItems - Current cart line items (each has .productId)
 */
export function initCartRecentlyViewed($w, cartItems = []) {
  const inCart = new Set(
    (cartItems || []).map(item => item.productId || item._id).filter(Boolean)
  );

  const filtered = getViewHistory()
    .filter(p => !inCart.has(p._id))
    .slice(0, MAX_ITEMS);

  if (filtered.length === 0) {
    $w('#cartRecentlyViewedSection').collapse();
    return;
  }

  $w('#cartRecentlyViewedSection').expand();

  const repeater = $w('#cartRecentlyViewedRepeater');
  repeater.data = filtered.map(p => ({
    _id: p._id,
    name: p.name,
    formattedPrice: p.formattedPrice || '',
    mainMedia: p.mainMedia || '',
  }));

  repeater.onItemReady(($item, itemData) => {
    $item('#crvProductImage').src = itemData.mainMedia;
    $item('#crvProductName').text = itemData.name;
    $item('#crvProductPrice').text = itemData.formattedPrice;

    const btn = $item('#crvAddToCartBtn');
    btn.onClick(async () => {
      btn.disable();
      try {
        await addToCart(itemData._id, 1);
        btn.label = SUCCESS_LABEL;
        setTimeout(() => {
          btn.label = DEFAULT_LABEL;
          btn.enable();
        }, SUCCESS_DURATION_MS);
      } catch (err) {
        console.error('[CartRecentlyViewed] addToCart failed', err);
        btn.enable();
      }
    });
  });
}
