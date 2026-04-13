/**
 * @module YouMightAlsoLike
 * @description "You might also like" 4-item product grid for the Product Detail Page.
 * Queries similar products by category/material and renders a repeater grid.
 * Collapses the section for guests, errors, or empty results.
 *
 * Elements:
 *   #youMightAlsoLikeSection — Box/Strip wrapper; collapsed when no products
 *   #youMightAlsoLikeGrid    — Repeater; receives up to 4 product items
 *   #ymItem_image            — Image; product main media
 *   #ymItem_name             — Text; product name
 *   #ymItem_price            — Text; formatted price or "Call for Price"
 *
 * CF-e50
 */
import { getSimilarProducts as _defaultGetSimilarProducts } from 'backend/productRecommendations.web';
import { isCallForPrice, CALL_FOR_PRICE_TEXT } from 'public/productPageUtils.js';

/**
 * Initialise the "You might also like" grid on the Product Detail Page.
 *
 * @param {Function} $w    - Wix element selector
 * @param {Object}   state - Page state; must contain state.product._id
 * @param {Object}  [opts] - Injectable overrides for testing
 * @param {Function} [opts.getSimilarProducts] - Backend getSimilarProducts(productId, options)
 * @returns {Promise<void>}
 */
export async function initYouMightAlsoLike($w, state, opts = {}) {
  const getSimilarProducts = opts.getSimilarProducts ?? _defaultGetSimilarProducts;

  const productId = state?.product?._id;
  if (!productId) {
    $w('#youMightAlsoLikeSection').collapse();
    return;
  }

  let products;
  try {
    const result = await getSimilarProducts(productId, { limit: 4 });
    if (!result?.success || !result.products?.length) {
      $w('#youMightAlsoLikeSection').collapse();
      return;
    }
    products = result.products.slice(0, 4);
  } catch (_) {
    $w('#youMightAlsoLikeSection').collapse();
    return;
  }

  // Register onItemReady BEFORE setting data (Wix repeater requirement).
  $w('#youMightAlsoLikeGrid').onItemReady(($item, itemData) => {
    $item('#ymItem_name').text = itemData.name;
    $item('#ymItem_price').text = isCallForPrice(itemData)
      ? CALL_FOR_PRICE_TEXT
      : itemData.formattedPrice;
    if (itemData.mainMedia) {
      $item('#ymItem_image').src = itemData.mainMedia;
    }
  });

  $w('#youMightAlsoLikeGrid').data = products;
  $w('#youMightAlsoLikeSection').expand();
}
