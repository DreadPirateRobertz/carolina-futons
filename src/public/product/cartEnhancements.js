// cartEnhancements.js - Add to Cart, Quantity Selector, Sticky Cart Bar
// Override default add-to-cart to support quantity selection,
// success feedback, and a fixed bottom bar for scroll-past scenarios.

import { addToCart, onCartChanged } from 'public/cartService';
import { trackCartAdd } from 'public/engagementTracker';
import { formatCurrency } from 'public/product/variantSelector.js';
import wixWindowFrontend from 'wix-window-frontend';

let selectedQuantity = 1;

/**
 * Returns the currently selected quantity.
 */
export function getSelectedQuantity() {
  return selectedQuantity;
}

/**
 * Initialize quantity selector (+/- buttons).
 */
export function initQuantitySelector($w) {
  try {
    const qtyInput = $w('#quantityInput');
    const qtyMinus = $w('#quantityMinus');
    const qtyPlus = $w('#quantityPlus');
    if (!qtyInput) return;

    qtyInput.value = '1';
    selectedQuantity = 1;

    try { qtyInput.accessibility.ariaLabel = 'Product quantity'; } catch (e) {}
    try { qtyMinus.accessibility.ariaLabel = 'Decrease quantity'; } catch (e) {}
    try { qtyPlus.accessibility.ariaLabel = 'Increase quantity'; } catch (e) {}

    qtyInput.onInput(() => {
      const val = parseInt(qtyInput.value, 10);
      if (val > 0 && val <= 99) {
        selectedQuantity = val;
      } else {
        selectedQuantity = 1;
        qtyInput.value = '1';
      }
    });

    if (qtyMinus) {
      qtyMinus.onClick(() => {
        if (selectedQuantity > 1) {
          selectedQuantity--;
          qtyInput.value = String(selectedQuantity);
        }
      });
    }

    if (qtyPlus) {
      qtyPlus.onClick(() => {
        if (selectedQuantity < 99) {
          selectedQuantity++;
          qtyInput.value = String(selectedQuantity);
        }
      });
    }
  } catch (e) {
    // Quantity selector elements may not exist — default to 1
  }
}

/**
 * Initialize add-to-cart button with success feedback.
 */
export function initAddToCartEnhancements($w, product) {
  try {
    const addToCartBtn = $w('#addToCartButton');
    if (!addToCartBtn) return;

    addToCartBtn.onClick(async () => {
      if (!product) return;
      try {
        addToCartBtn.disable();
        addToCartBtn.label = 'Adding...';
        await addToCart(product._id, selectedQuantity);
        trackCartAdd(product, selectedQuantity);
        addToCartBtn.label = 'Added!';
      } catch (err) {
        console.error('Error adding to cart:', err);
        addToCartBtn.label = 'Error — Try Again';
      }
      setTimeout(() => {
        try {
          addToCartBtn.label = 'Add to Cart';
          addToCartBtn.enable();
        } catch (e) {}
      }, 3000);
    });

    onCartChanged(() => {
      showAddToCartSuccess($w);
    });
  } catch (e) {}
}

function showAddToCartSuccess($w) {
  try {
    const successBox = $w('#addToCartSuccess');
    if (successBox) {
      successBox.show('fade', { duration: 300 });
      setTimeout(() => {
        successBox.hide('fade', { duration: 300 });
      }, 4000);
    }
  } catch (e) {}
}

/**
 * Update sticky cart bar price when variant changes.
 */
export function updateStickyPrice($w, variant) {
  try {
    if (variant && variant.price) {
      $w('#stickyPrice').text = formatCurrency(variant.price);
    }
  } catch (e) {}
}

/**
 * Initialize sticky add-to-cart bar that appears when main button scrolls out of view.
 */
export function initStickyCartBar($w, product) {
  try {
    const stickyBar = $w('#stickyCartBar');
    if (!stickyBar) return;

    stickyBar.hide();

    if (product) {
      try { $w('#stickyProductName').text = product.name; } catch (e) {}
      try { $w('#stickyPrice').text = product.formattedPrice; } catch (e) {}
    }

    try {
      $w('#stickyAddBtn').onClick(async () => {
        try {
          $w('#stickyAddBtn').disable();
          $w('#stickyAddBtn').label = 'Adding...';
          await addToCart(product._id, selectedQuantity);
          trackCartAdd(product, selectedQuantity);
          $w('#stickyAddBtn').label = 'Added!';
        } catch (err) {
          $w('#stickyAddBtn').label = 'Error — Try Again';
        }
        setTimeout(() => {
          try {
            $w('#stickyAddBtn').label = 'Add to Cart';
            $w('#stickyAddBtn').enable();
          } catch (e) {}
        }, 3000);
      });
    } catch (e) {}

    // Monitor scroll to show/hide sticky bar (throttled to prevent mobile jank)
    let stickyVisible = false;
    let scrollTicking = false;
    wixWindowFrontend.onScroll(() => {
      if (scrollTicking) return;
      scrollTicking = true;
      (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : setTimeout)(async () => {
        try {
          const btnBounds = await $w('#addToCartButton').getBoundingRect();
          const shouldShow = btnBounds.top < 0;

          if (shouldShow && !stickyVisible) {
            stickyVisible = true;
            stickyBar.show('slide', { direction: 'bottom', duration: 250 });
          } else if (!shouldShow && stickyVisible) {
            stickyVisible = false;
            stickyBar.hide('slide', { direction: 'bottom', duration: 250 });
          }
        } catch (e) {}
        scrollTicking = false;
      });
    });
  } catch (e) {}
}
