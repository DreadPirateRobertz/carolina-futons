// variantSelector.js - Variant Selection with Independent Pricing
// Each variant (size + finish combination) has its own price.
// Changing one variant option updates price without affecting others.

import { getProductVariants } from 'public/cartService';
import { colors } from 'public/designTokens.js';

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Initialize variant selector dropdowns.
 * @param {Function} $w - Wix selector
 * @param {Object} product - Current product
 * @param {Object} [options]
 * @param {Function} [options.onVariantChange] - Called with selected variant after change
 */
export function initVariantSelector($w, product, { onVariantChange } = {}) {
  try {
    const sizeDropdown = $w('#sizeDropdown');
    const finishDropdown = $w('#finishDropdown');

    const handleChange = () => handleCustomVariantChange($w, product, onVariantChange);

    if (sizeDropdown) {
      sizeDropdown.onChange(handleChange);
    }
    if (finishDropdown) {
      finishDropdown.onChange(handleChange);
    }
  } catch (e) {
    // Variant elements may not exist for simple products
  }
}

/**
 * Handle custom variant dropdown change. Queries for matching variant
 * and updates price, stock, and image. Exported for use by swatchSelector.
 */
export async function handleCustomVariantChange($w, product, onVariantChange) {
  try {
    const size = $w('#sizeDropdown').value;
    const finish = $w('#finishDropdown').value;

    if (!size && !finish) return;

    const choices = {};
    if (size) choices['Size'] = size;
    if (finish) choices['Finish'] = finish;

    const variant = await getProductVariants(product._id, choices);

    if (variant && variant.length > 0) {
      const selected = variant[0];
      updateVariantPrice($w, selected);
      updateStockStatus($w, selected);
      updateVariantImage($w, product, selected);
      if (onVariantChange) onVariantChange(selected);
    }
  } catch (e) {
    console.error('Error handling variant change:', e);
  }
}

function updateVariantPrice($w, variant) {
  try {
    const priceElement = $w('#productPrice');
    const comparePriceElement = $w('#productComparePrice');

    if (variant.variant && variant.variant.price) {
      priceElement.text = formatCurrency(variant.variant.price);
    }

    if (variant.variant && variant.variant.comparePrice) {
      if (comparePriceElement) {
        comparePriceElement.text = formatCurrency(variant.variant.comparePrice);
        comparePriceElement.show();
      }
    } else {
      if (comparePriceElement) {
        comparePriceElement.hide();
      }
    }
  } catch (e) {
    // Price elements may use default Wix binding
  }
}

function updateStockStatus($w, variant) {
  try {
    const stockBadge = $w('#stockStatus');
    if (!stockBadge) return;

    if (variant.inStock) {
      stockBadge.text = 'In Stock';
      stockBadge.style.color = colors.success;
    } else {
      stockBadge.text = 'Special Order';
      stockBadge.style.color = colors.sunsetCoral;
    }
    stockBadge.show();
  } catch (e) {}
}

function updateVariantImage($w, product, variant) {
  try {
    if (variant.imageSrc) {
      $w('#productMainImage').src = variant.imageSrc;
    }

    if (variant.mediaItems && variant.mediaItems.length > 0) {
      try {
        const gallery = $w('#productGallery');
        if (gallery) {
          gallery.items = variant.mediaItems.map(item => ({
            type: 'image',
            src: item.src || item.url,
            alt: item.alt || product?.name || '',
          }));
        }
      } catch (e) {}
    }
  } catch (e) {}
}
