/**
 * @module FreightUpsellBanner
 * @description Freight consolidation upsell banner for Wix Cart and Side Cart.
 * When the cart contains a freight (LTL) item — Murphy bed or platform bed —
 * a green banner appears above the cart summary: "You're already paying for
 * freight — add more items at no extra shipping cost!" with a carousel of
 * complementary products (mattresses, accessories) and quick-add buttons.
 *
 * Wix element nicknames expected on the page:
 *   #freightUpsellBanner     — collapsible container (Box/Section)
 *   #freightUpsellText       — banner message text element
 *   #upsellProductRepeater   — Repeater for product cards
 *     Per-item: #freightUpsellImage, #freightUpsellName,
 *               #freightUpsellPrice, #freightUpsellAddBtn
 *
 * Usage:
 *   import { initFreightUpsellBanner, updateFreightUpsellBanner } from 'public/FreightUpsellBanner';
 *   // on page ready:
 *   await initFreightUpsellBanner($w, cart, { addToCart, trackEvent });
 *   // in onCartChanged:
 *   await updateFreightUpsellBanner($w, cart, { addToCart, trackEvent });
 *
 * @requires backend/productRecommendations.web — getFreightComplementProducts
 * @requires public/engagementTracker           — trackEvent
 */

import { getFreightComplementProducts } from 'backend/productRecommendations.web';

export const BANNER_MESSAGE =
  "You're already paying for freight — add more items at no extra shipping cost!";

/**
 * LTL category slugs (mirror of shipping-rates-plugin.js resolveCategory).
 * Items in these categories always require freight shipping.
 * @type {string[]}
 */
export const LTL_CATEGORIES = ['murphy-bed', 'platform-bed'];

/**
 * Determine if a single cart line item triggers LTL freight.
 * Matches on category (from Wix product name) using the same heuristic as
 * shipping-rates-plugin.js resolveCategory().
 *
 * @param {{ name?: string }} item - Wix cart line item
 * @returns {boolean}
 */
export function isLTLItem(item) {
  const name = (item?.name || '').toLowerCase();
  if (name.includes('murphy') || name.includes('cabinet bed')) return true;
  if (
    name.includes('platform') ||
    name.includes('nomad') ||
    name.includes('lexington') ||
    name.includes('charleston') ||
    name.includes('ekko')
  ) return true;
  return false;
}

/**
 * Return true if any item in the cart triggers LTL freight.
 *
 * @param {Array<Object>} lineItems - Wix cart line items
 * @returns {boolean}
 */
export function hasLTLItemInCart(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return false;
  return lineItems.some(isLTLItem);
}

/**
 * Initialise the freight upsell banner. Call once on page ready.
 * Registers onItemReady ONCE to avoid Velo handler stacking.
 *
 * @param {Function}   $w
 * @param {Object|null} cart        - Current cart (from getCurrentCart)
 * @param {Object}     deps
 * @param {Function}   deps.addToCart   - cartService.addToCart(productId, qty)
 * @param {Function}   deps.trackEvent  - engagementTracker.trackEvent(name, data)
 */
export async function initFreightUpsellBanner($w, cart, { addToCart, trackEvent }) {
  // Register onItemReady once — Velo stacks handlers on repeated calls.
  try {
    $w('#upsellProductRepeater').onItemReady(($item, itemData) => {
      try { $item('#freightUpsellImage').src = itemData.mainMedia || ''; } catch (e) {}
      try { $item('#freightUpsellImage').alt = itemData.name || ''; } catch (e) {}
      try { $item('#freightUpsellName').text = itemData.name || ''; } catch (e) {}
      try {
        $item('#freightUpsellPrice').text = itemData.price
          ? `$${Number(itemData.price).toFixed(2)}`
          : '';
      } catch (e) {}

      try {
        $item('#freightUpsellAddBtn').onClick(async () => {
          try {
            await addToCart(itemData._id, 1);
            trackEvent('web_bundle_upsell_add', { productId: itemData._id });
          } catch (err) {
            console.warn('[FreightUpsellBanner] addToCart failed:', err?.message ?? err);
          }
        });
      } catch (e) {}
    });
  } catch (e) {}

  await updateFreightUpsellBanner($w, cart, { addToCart, trackEvent });
}

/**
 * Show or hide the freight upsell banner based on current cart contents.
 * Call from onCartChanged to keep the banner in sync.
 *
 * @param {Function}   $w
 * @param {Object|null} cart        - Current cart (from getCurrentCart)
 */
export async function updateFreightUpsellBanner($w, cart) {
  try {
    const lineItems = cart?.lineItems || [];

    if (!hasLTLItemInCart(lineItems)) {
      _hideBanner($w);
      return;
    }

    // Fetch complement products, excluding items already in cart
    const cartProductIds = lineItems
      .map(item => item.catalogReference?.catalogItemId)
      .filter(Boolean);

    const result = await getFreightComplementProducts(cartProductIds, 4);
    if (!result?.success || !result.products?.length) {
      _hideBanner($w);
      return;
    }

    // Populate repeater and show banner
    try {
      $w('#freightUpsellText').text = BANNER_MESSAGE;
    } catch (e) {}

    try {
      $w('#upsellProductRepeater').data = result.products.map(p => ({ _id: p._id, ...p }));
    } catch (e) {}

    _showBanner($w);
  } catch (err) {
    console.warn('[FreightUpsellBanner] updateFreightUpsellBanner error:', err?.message ?? err);
    _hideBanner($w);
  }
}

function _showBanner($w) {
  try { $w('#freightUpsellBanner').expand(); } catch (e) {}
}

function _hideBanner($w) {
  try { $w('#freightUpsellBanner').collapse(); } catch (e) {}
}
