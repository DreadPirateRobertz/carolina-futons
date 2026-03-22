// CartRecentlyViewed.js — Cart Page "You Were Looking At..." cross-sell shelf
//
// Standalone module — do NOT import from RecentlyViewedWidget.js.
// Reads session-storage browse history, filters out items already in cart,
// populates a 4-slot horizontal repeater below the cart line items.
//
// Usage:
//   1. Call initCartRecentlyViewed($w, cartItems) ONCE at page load.
//      This registers the onItemReady handler and does the first data load.
//   2. Call updateCartRecentlyViewed($w, cartItems) on each onCartChanged.
//      This only updates data/visibility — never re-registers the handler.
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
 * One-time initialisation — call ONCE at page load.
 *
 * Registers the repeater's onItemReady handler (which wires up images,
 * text, and Add to Cart buttons), then performs the first data load by
 * delegating to updateCartRecentlyViewed.
 *
 * @param {Function} $w       - Wix element selector
 * @param {Array}    cartItems - Current cart line items. Each item is checked
 *                              for `.productId` first, then `._id` as a
 *                              fallback (Wix Stores line-item objects use `._id`).
 */
export function initCartRecentlyViewed($w, cartItems = []) {
  const repeater = $w('#cartRecentlyViewedRepeater');

  // Register handler ONCE before any .data assignment (Wix Velo requirement).
  // Calling onItemReady again on subsequent cart changes stacks handlers,
  // causing multiple addToCart calls per click — use updateCartRecentlyViewed instead.
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
        btn.label = DEFAULT_LABEL;
        btn.enable();
      }
    });
  });

  updateCartRecentlyViewed($w, cartItems);
}

/**
 * Refresh the shelf data — call on every onCartChanged.
 *
 * Updates section visibility and repeater data only. Does NOT register
 * onItemReady — that must only happen once via initCartRecentlyViewed.
 *
 * @param {Function} $w       - Wix element selector
 * @param {Array}    cartItems - Current cart line items (.productId or ._id)
 */
export function updateCartRecentlyViewed($w, cartItems = []) {
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
  $w('#cartRecentlyViewedRepeater').data = filtered.map(p => ({
    _id: p._id,
    name: p.name,
    formattedPrice: p.formattedPrice || '',
    mainMedia: p.mainMedia || '',
  }));
}
