/**
 * @module ProductRecommendations
 * @description "Customers Also Love" carousel for the Product Detail Page.
 *
 * Editor elements:
 *   #recommendationsSection (Section) — wraps the entire carousel
 *   #recommendationsTitle (Text) — "Customers Also Love"
 *   #recommendationsRepeater (Repeater) — product cards
 *     ↳ #recProductImage (Image), #recProductName (Text), #recProductPrice (Text)
 *     ↳ #recViewBtn (Button)
 *
 * CF-8bbu: AI product recommendations carousel
 */
import { getRecommendations } from 'backend/productRecommendations.web';
import { isCallForPrice, CALL_FOR_PRICE_TEXT } from 'public/productPageUtils.js';
import { makeClickable } from 'public/a11yHelpers.js';

/**
 * Initialize the "Customers Also Love" recommendations carousel on the PDP.
 * Collapses #recommendationsSection if no recommendations are returned.
 *
 * @param {Function} $w - Wix Velo selector
 * @param {{ product: Object }} state - Page state with product data
 * @returns {Promise<void>}
 */
export async function initRecommendationsCarousel($w, state) {
  try {
    const productId = state?.product?._id;
    if (!productId) {
      _collapseSection($w);
      return;
    }

    const { success, products } = await getRecommendations(productId, 6);

    if (!success || !products || products.length === 0) {
      _collapseSection($w);
      return;
    }

    _populateCarousel($w, products);
  } catch (e) {
    console.warn('[ProductRecommendations] initRecommendationsCarousel failed:', e?.message ?? e);
    _collapseSection($w);
  }
}

function _collapseSection($w) {
  try { $w('#recommendationsSection').collapse(); } catch (e) {
    console.warn('[ProductRecommendations] section collapse failed:', e?.message ?? e);
  }
}

function _populateCarousel($w, products) {
  try {
    // onItemReady must be registered BEFORE .data is set — Wix fires the callback
    // for each item at the moment .data is assigned.
    $w('#recommendationsRepeater').onItemReady(($item, itemData) => {
      try { $item('#recProductName').text = itemData.name || ''; } catch (e) {
        console.warn('[ProductRecommendations] recProductName set failed:', e?.message ?? e);
      }
      try {
        $item('#recProductPrice').text = isCallForPrice(itemData)
          ? CALL_FOR_PRICE_TEXT
          : (itemData.formattedPrice || '');
      } catch (e) {
        console.warn('[ProductRecommendations] recProductPrice set failed:', e?.message ?? e);
      }
      try {
        if (itemData.mainMedia) $item('#recProductImage').src = itemData.mainMedia;
      } catch (e) {
        console.warn('[ProductRecommendations] recProductImage set failed:', e?.message ?? e);
      }

      const url = `/product-page/${itemData.slug}`;

      try {
        makeClickable($item('#recProductImage'), url, { ariaLabel: `View ${itemData.name}` });
      } catch (e) {
        console.warn('[ProductRecommendations] recProductImage click wiring failed:', e?.message ?? e);
      }

      try {
        $item('#recViewBtn').onClick(() => {
          try {
            import('wix-location-frontend').then(m => {
              (m.default?.to ?? m.to)?.(url);
            }).catch(e => console.warn('[ProductRecommendations] navigation failed:', e?.message ?? e));
          } catch (e) {
            console.warn('[ProductRecommendations] recViewBtn onClick failed:', e?.message ?? e);
          }
        });
      } catch (e) {
        console.warn('[ProductRecommendations] recViewBtn wiring failed:', e?.message ?? e);
      }
    });

    $w('#recommendationsRepeater').data = products.map(p => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      formattedPrice: p.formattedPrice,
      mainMedia: p.mainMedia,
    }));
  } catch (e) {
    console.warn('[ProductRecommendations] populateCarousel failed:', e?.message ?? e);
    _collapseSection($w);
  }
}
