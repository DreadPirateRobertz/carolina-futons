// crossSell.js - Related Products, Collection Products, Bundle Suggestions
// Cross-category recommendations, same-collection products,
// and "Frequently Bought Together" bundle with discount.

import { getRelatedProducts, getSameCollection, getBundleSuggestion } from 'backend/productRecommendations.web';
import { addToCart } from 'public/cartService';
import { trackCartAdd } from 'public/engagementTracker';
import { formatCurrency } from 'public/product/variantSelector.js';
import { buildGridAlt } from 'public/product/productSchema.js';
import { makeClickable } from 'public/a11yHelpers.js';
import { isCallForPrice } from 'public/productPageUtils.js';

/**
 * Load "You Might Also Like" cross-category recommendations.
 */
export async function loadRelatedProducts($w, product) {
  try {
    if (!product) return;

    const category = product.collections?.[0] || '';
    const related = (await getRelatedProducts(product._id, category, 4))
      .filter(p => !isCallForPrice(p));

    const repeater = $w('#relatedRepeater');
    if (!repeater || related.length === 0) {
      try { $w('#relatedSection').collapse(); } catch (e) {}
      return;
    }

    repeater.onItemReady(($item, itemData) => {
      $item('#relatedImage').src = itemData.mainMedia;
      $item('#relatedImage').alt = buildGridAlt(itemData);
      $item('#relatedName').text = itemData.name;
      $item('#relatedPrice').text = itemData.formattedPrice;

      if (itemData.ribbon) {
        try {
          $item('#relatedBadge').text = itemData.ribbon;
          $item('#relatedBadge').show();
        } catch (e) {}
      }

      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      makeClickable($item('#relatedImage'), navigateToProduct, { ariaLabel: `View ${itemData.name}`, role: 'link' });
      makeClickable($item('#relatedName'), navigateToProduct, { ariaLabel: `View ${itemData.name}`, role: 'link' });
    });
    repeater.data = related;
  } catch (err) {
    console.error('Error loading related products:', err);
  }
}

/**
 * Load "More From This Collection" section.
 */
export async function loadCollectionProducts($w, product) {
  try {
    if (!product || !product.collections) return;

    const collectionProducts = (await getSameCollection(
      product._id,
      product.collections,
      6
    )).filter(p => !isCallForPrice(p));

    const repeater = $w('#collectionRepeater');
    if (!repeater || collectionProducts.length === 0) {
      try { $w('#collectionSection').collapse(); } catch (e) {}
      return;
    }

    repeater.onItemReady(($item, itemData) => {
      $item('#collectionImage').src = itemData.mainMedia;
      $item('#collectionImage').alt = buildGridAlt(itemData);
      $item('#collectionName').text = itemData.name;
      $item('#collectionPrice').text = itemData.formattedPrice;

      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#collectionImage').onClick(navigateToProduct);
      $item('#collectionName').onClick(navigateToProduct);
    });
    repeater.data = collectionProducts;
  } catch (err) {
    console.error('Error loading collection products:', err);
  }
}

/**
 * Initialize "Frequently Bought Together" bundle section.
 * @param {Object} [options]
 * @param {Function} [options.getQuantity] - Returns current selected quantity
 */
export async function initBundleSection($w, product, { getQuantity } = {}) {
  try {
    if (!product) return;

    const bundle = await getBundleSuggestion(product._id);
    if (!bundle || !bundle.product) {
      try { $w('#bundleSection').collapse(); } catch (e) {}
      return;
    }

    try {
      $w('#bundleSection').expand();
      $w('#bundleImage').src = bundle.product.mainMedia;
      $w('#bundleImage').alt = bundle.product.name + ' — bundle suggestion';
      $w('#bundleName').text = bundle.product.name;
      $w('#bundlePrice').text = formatCurrency(bundle.bundlePrice);
      $w('#bundleSavings').text = `Save ${formatCurrency(bundle.savings)}`;
    } catch (e) {}

    try {
      let crossSellMainAdded = false;
      $w('#addBundleBtn').onClick(async () => {
        try {
          $w('#addBundleBtn').disable();
          $w('#addBundleBtn').label = 'Adding...';
          const qty = getQuantity ? getQuantity() : 1;
          // Only add main product if not already added (prevents double-add on retry)
          if (!crossSellMainAdded) {
            await addToCart(product._id, qty);
            crossSellMainAdded = true;
          }
          await addToCart(bundle.product._id, 1);
          $w('#addBundleBtn').label = 'Bundle Added!';
          crossSellMainAdded = false; // Reset for next fresh click
          trackCartAdd(product, qty);
        } catch (err) {
          console.error('Error adding bundle to cart:', err);
          $w('#addBundleBtn').label = 'Error — Try Again';
        }
        setTimeout(() => {
          try {
            $w('#addBundleBtn').label = 'Add Both to Cart';
            $w('#addBundleBtn').enable();
          } catch (e) {}
        }, 3000);
      });
    } catch (e) {}

    // Click bundle image/name to navigate to that product
    const navigateToBundle = () => {
      import('wix-location-frontend').then(({ to }) => {
        to(`/product-page/${bundle.product.slug}`);
      });
    };
    try { $w('#bundleImage').onClick(navigateToBundle); } catch (e) {}
    try { $w('#bundleName').onClick(navigateToBundle); } catch (e) {}
  } catch (err) {
    console.error('Error loading bundle section:', err);
  }
}
