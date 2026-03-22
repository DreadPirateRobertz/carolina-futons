/**
 * @module ContinueShoppingSection
 * @description Homepage section showing recently viewed products as a
 * "Continue Shopping" strip. Hidden on first visit (no history); expands
 * on return visits to show the last 1–6 products the customer viewed.
 *
 * No backend call — reads session-backed product history from galleryHelpers.
 * Register once on page load; safe to call on every page load.
 *
 * Wix element nicknames (Homepage):
 *   #continueShoppingSection  — Section/Box, hidden by default
 *   #continueShoppingTitle    — Text heading ("Continue Shopping")
 *   #continueShoppingRepeater — Repeater (horizontal scroll strip)
 *     Per item:
 *       #continueShoppingImage — Image
 *       #continueShoppingName  — Text
 *       #continueShoppingPrice — Text
 *       #continueShoppingLink  — Button → navigates to product page
 *
 * CF-ku3x: Continue Shopping — homepage recently viewed strip
 *
 * @requires public/galleryHelpers.js — getRecentlyViewed
 * @requires wix-location-frontend   — to (navigation)
 */

import { getRecentlyViewed } from 'public/galleryHelpers.js';
import { to } from 'wix-location-frontend';

const MAX_ITEMS = 6;

/**
 * Initialise the Continue Shopping section on the Homepage.
 * Reads session-backed product history; no backend call required.
 *
 * @param {Function} $w        - Wix element selector
 * @param {Object}   [opts]
 * @param {string}   [opts.excludeId] - Product ID to exclude (use on PDP to
 *                                      hide the current product from the strip)
 */
export function initContinueShoppingSection($w, opts = {}) {
  const { excludeId = null } = opts;

  const products = getRecentlyViewed(excludeId).slice(0, MAX_ITEMS);

  if (!products.length) return; // section stays hidden (collapsed by default)

  $w('#continueShoppingTitle').text = 'Continue Shopping';

  $w('#continueShoppingRepeater').onItemReady(($item, itemData) => {
    $item('#continueShoppingImage').src = itemData.mainMedia || '';
    $item('#continueShoppingImage').alt = itemData.name || '';
    $item('#continueShoppingName').text = itemData.name || '';
    $item('#continueShoppingPrice').text = itemData.formattedPrice ||
      (itemData.price != null ? `$${Number(itemData.price).toFixed(2)}` : '');

    $item('#continueShoppingLink').onClick(() => {
      to(`/product-page/${itemData.slug}`);
    });
  });

  $w('#continueShoppingRepeater').data = products;

  try {
    $w('#continueShoppingSection').expand();
  } catch (_) {
    $w('#continueShoppingSection').show();
  }
}
