/**
 * @module YouMightAlsoLike
 * @description "You might also like" 4-item product grid for the Product Detail Page.
 * Renders a repeater grid of similar products. Delegates similarity lookup to
 * `backend/productRecommendations.web`. Collapses the section for missing state,
 * errors, or empty results so there is no blank space on the PDP.
 *
 * Elements:
 *   #youMightAlsoLikeSection — Box/Strip wrapper; collapsed when no products
 *   #youMightAlsoLikeGrid    — Repeater; receives up to 4 product items
 *   #ymItem_image            — Image; product main media (only set when mainMedia is present)
 *   #ymItem_name             — Text; product name
 *   #ymItem_price            — Text; formatted price or "Call for Price"
 *
 * CF-e50
 */
import { getSimilarProducts as _defaultGetSimilarProducts } from 'backend/productRecommendations.web';
import { to as wixLocationTo } from 'wix-location-frontend';
import { isCallForPrice, CALL_FOR_PRICE_TEXT } from 'public/productPageUtils.js';

/**
 * Initialise the "You might also like" grid on the Product Detail Page.
 * Call once per page load from $w.onReady.
 *
 * @param {Function} $w    - Wix element selector
 * @param {Object}   state - Page state. If state.product._id is absent the section
 *                           collapses gracefully and no grid is rendered.
 * @param {Object}  [opts] - Injectable overrides for testing
 * @param {Function} [opts.getSimilarProducts] - Overrides the backend call.
 *   Must return `Promise<{ success: boolean, products: Array }>`.
 * @returns {Promise<void>}
 */
export async function initYouMightAlsoLike($w, state, opts = {}) {
  const getSimilarProducts = opts.getSimilarProducts ?? _defaultGetSimilarProducts;

  const section = $w('#youMightAlsoLikeSection');
  const productId = state?.product?._id;
  if (!productId) {
    section.collapse();
    return;
  }

  let products;
  try {
    const result = await getSimilarProducts(productId, { limit: 4 });
    if (!result?.success) {
      console.warn('[YouMightAlsoLike] getSimilarProducts returned success:false for productId:', productId);
      section.collapse();
      return;
    }
    if (!result.products?.length) {
      section.collapse();
      return;
    }
    products = result.products.slice(0, 4); // defensive cap — backend may ignore limit
  } catch (err) {
    console.warn('[YouMightAlsoLike] getSimilarProducts failed:', err?.message ?? err);
    section.collapse();
    return;
  }

  const grid = $w('#youMightAlsoLikeGrid');

  // Must register onItemReady BEFORE setting .data — Wix fires the callback per-item
  // on assignment; registering after means items render without fields populated.
  grid.onItemReady(($item, itemData) => {
    try {
      $item('#ymItem_name').text = itemData.name;
    } catch (err) {
      console.warn('[YouMightAlsoLike] ymItem_name set failed:', err?.message ?? err);
    }
    try {
      $item('#ymItem_price').text = isCallForPrice(itemData)
        ? CALL_FOR_PRICE_TEXT
        : itemData.formattedPrice;
    } catch (err) {
      console.warn('[YouMightAlsoLike] ymItem_price set failed:', err?.message ?? err);
    }
    try {
      if (itemData.mainMedia) {
        $item('#ymItem_image').src = itemData.mainMedia;
      }
      $item('#ymItem_image').onClick(() => {
        wixLocationTo(`/${itemData.slug}`).catch(e =>
          console.warn('[YouMightAlsoLike] navigation failed:', e?.message ?? e)
        );
      });
    } catch (err) {
      console.warn('[YouMightAlsoLike] ymItem_image wiring failed:', err?.message ?? err);
    }
  });

  grid.data = products;
  section.expand();
}
