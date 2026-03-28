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
import { renderSimplePrice } from 'public/productCardHelpers.js';

const MAX_ITEMS = 6;
const SLUG_RE = /^[a-z0-9-]+$/;

/** Validate and sanitise a product slug before use in a URL. */
function safeSlug(slug) {
  if (typeof slug !== 'string') return '';
  const cleaned = slug.trim().toLowerCase().slice(0, 100);
  return SLUG_RE.test(cleaned) ? cleaned : cleaned.replace(/[^a-z0-9-]/g, '');
}

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
    renderSimplePrice($item('#continueShoppingPrice'), itemData);

    $item('#continueShoppingLink').onClick(() => {
      const slug = safeSlug(itemData.slug);
      if (!slug) return;
      to(`/product-page/${slug}`);
    });
  });

  $w('#continueShoppingRepeater').data = products;

  try {
    $w('#continueShoppingSection').expand();
  } catch (_) {
    console.warn('[ContinueShoppingSection] expand() unavailable, falling back to show()');
    $w('#continueShoppingSection').show();
  }
}
