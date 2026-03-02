// Side Cart.js - Slide-Out Mini Cart
// Modern slide-out cart panel with tiered incentives, multiple cross-sell
// suggestions, enhanced item display, and animated interactions
import { getCompletionSuggestions } from 'backend/productRecommendations.web';
import {
  getCurrentCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  onCartChanged,
  getShippingProgress,
  getTierProgress,
  clampQuantity,
  FREE_SHIPPING_THRESHOLD,
  MIN_QUANTITY,
  MAX_QUANTITY,
  safeMultiply,
} from 'public/cartService';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { addSwipeHandler } from 'public/mobileHelpers';
import {
  getCartItemStyles,
  getProgressBarStyles,
  getSideCartPanelStyles,
  getCheckoutButtonStyles,
  getQuantitySpinnerStyles,
  getCrossSellCardStyles,
} from 'public/cartStyles.js';

let currentSideSugProduct = null;
let _legacySugHandlerRegistered = false;
let _repeaterInitialized = false;
let _sideCartEscapeRegistered = false;

$w.onReady(function () {
  initSideCart();
});

function initSideCart() {
  const panelStyles = getSideCartPanelStyles();
  const btnStyles = getCheckoutButtonStyles();

  // Listen for cart changes to update the side cart
  onCartChanged(async () => {
    await refreshSideCart();
  });

  // Set ARIA dialog attributes and brand styling on side cart panel
  try {
    $w('#sideCartPanel').accessibility.role = 'dialog';
    $w('#sideCartPanel').accessibility.ariaModal = true;
    $w('#sideCartPanel').accessibility.ariaLabel = 'Shopping cart';
    $w('#sideCartPanel').style.backgroundColor = panelStyles.panelBackground;
  } catch (e) {}

  // Brand-styled header
  try {
    $w('#sideCartTitle').style.color = panelStyles.headerColor;
  } catch (e) {}

  // Close button
  try {
    $w('#sideCartClose').onClick(() => {
      $w('#sideCartPanel').hide('slide', { direction: 'right', duration: 300 });
      announce($w, 'Cart closed');
    });
    $w('#sideCartClose').accessibility.ariaLabel = 'Close cart';
  } catch (e) {}

  // Overlay click to close
  try {
    $w('#sideCartOverlay').onClick(() => {
      $w('#sideCartPanel').hide('slide', { direction: 'right', duration: 300 });
      announce($w, 'Cart closed');
    });
  } catch (e) {}

  // Escape key closes side cart (guarded to prevent listener accumulation on SPA re-nav)
  if (typeof document !== 'undefined' && !_sideCartEscapeRegistered) {
    _sideCartEscapeRegistered = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        try {
          const panel = $w('#sideCartPanel');
          if (!panel.hidden) {
            panel.hide('slide', { direction: 'right', duration: 300 });
            announce($w, 'Cart closed');
          }
        } catch (e2) {}
      }
    });
  }

  // View full cart button
  try {
    $w('#viewFullCart').onClick(() => {
      import('wix-location-frontend').then(({ to }) => to('/cart-page'));
    });
  } catch (e) {}

  // Checkout button — coral CTA
  try {
    $w('#sideCartCheckout').style.backgroundColor = btnStyles.background;
    $w('#sideCartCheckout').style.color = btnStyles.textColor;
    $w('#sideCartCheckout').onClick(() => {
      import('wix-location-frontend').then(({ to }) => to('/checkout'));
    });
  } catch (e) {}

  // View full cart link — mountain blue
  try {
    $w('#viewFullCart').style.color = panelStyles.viewCartLinkColor;
  } catch (e) {}

  // Swipe right to close side cart on mobile
  try {
    addSwipeHandler($w('#sideCartPanel'), {
      onRight: () => {
        $w('#sideCartPanel').hide('slide', { direction: 'right', duration: 300 });
        announce($w, 'Cart closed');
      },
    });
  } catch (e) {}

  // Register repeater handlers once (not on every refresh)
  initSideCartRepeater();
}

// Register repeater item handlers once to avoid accumulation
function initSideCartRepeater() {
  try {
    const repeater = $w('#sideCartRepeater');
    if (!repeater) return;

    const itemStyles = getCartItemStyles();
    const spinnerStyles = getQuantitySpinnerStyles();

    repeater.onItemReady(($item, itemData) => {
      $item('#sideItemImage').src = itemData.image;
      try { $item('#sideItemImage').alt = `${itemData.name}`; } catch (e) {}
      $item('#sideItemName').text = itemData.name;
      try { $item('#sideItemName').style.color = itemStyles.nameColor; } catch (e) {}
      $item('#sideItemPrice').text = `$${Number(itemData.price).toFixed(2)}`;
      try { $item('#sideItemPrice').style.color = itemStyles.priceColor; } catch (e) {}

      // Quantity spinner: −/qty/+ controls
      try {
        $item('#sideItemQty').text = String(itemData.quantity);
        $item('#sideItemQty').accessibility.ariaLabel = `Quantity of ${itemData.name}`;
        $item('#sideItemQty').accessibility.role = 'status';
      } catch (e) {}

      // Minus button — mountain blue
      try {
        $item('#sideQtyMinus').style.color = spinnerStyles.buttonColor;
        $item('#sideQtyMinus').accessibility.ariaLabel = `Decrease quantity of ${itemData.name}`;
        $item('#sideQtyMinus').onClick(async () => {
          const currentQty = itemData.quantity || MIN_QUANTITY;
          if (currentQty <= MIN_QUANTITY) return;
          const newQty = currentQty - 1;
          try {
            await updateCartItemQuantity(itemData._id, newQty);
            announce($w, `${itemData.name} quantity decreased to ${newQty}`);
          } catch (err) {
            console.error('Error updating side cart quantity:', err);
          }
          setTimeout(() => refreshSideCart(), 200);
        });
      } catch (e) {}

      // Plus button — mountain blue
      try {
        $item('#sideQtyPlus').style.color = spinnerStyles.buttonColor;
        $item('#sideQtyPlus').accessibility.ariaLabel = `Increase quantity of ${itemData.name}`;
        $item('#sideQtyPlus').onClick(async () => {
          const currentQty = itemData.quantity || MIN_QUANTITY;
          if (currentQty >= MAX_QUANTITY) return;
          const newQty = currentQty + 1;
          try {
            await updateCartItemQuantity(itemData._id, newQty);
            announce($w, `${itemData.name} quantity increased to ${newQty}`);
          } catch (err) {
            console.error('Error updating side cart quantity:', err);
          }
          setTimeout(() => refreshSideCart(), 200);
        });
      } catch (e) {}

      // Line item total (price × qty)
      try {
        $item('#sideItemLineTotal').text = `$${Number(itemData.lineTotal).toFixed(2)}`;
      } catch (e) {}

      // Variant details (e.g., "Size: Queen · Finish: Honey Oak")
      if (itemData.variantDetails) {
        try {
          $item('#sideItemVariant').text = itemData.variantDetails;
          $item('#sideItemVariant').show();
        } catch (e) {}
      } else if (itemData.variantName) {
        try {
          $item('#sideItemVariant').text = itemData.variantName;
          $item('#sideItemVariant').show();
        } catch (e) {}
      }

      // Remove button — coral accent
      try { $item('#sideItemRemove').style.color = itemStyles.removeColor; } catch (e) {}
      try { $item('#sideItemRemove').accessibility.ariaLabel = `Remove ${itemData.name} from cart`; } catch (e) {}

      // Remove: animated slide-out + actual cart removal
      $item('#sideItemRemove').onClick(async () => {
        try {
          $item('#sideItemImage').hide('slide', { direction: 'right', duration: 200 });
          $item('#sideItemName').hide('fade', { duration: 200 });
        } catch (e) {}
        try {
          await removeCartItem(itemData._id);
          announce($w, `${itemData.name} removed from cart`);
        } catch (err) {
          console.error('Error removing item from cart:', err);
        }
        setTimeout(() => refreshSideCart(), 250);
      });
    });
  } catch (e) {}
}

async function refreshSideCart() {
  try {
    const currentCart = await getCurrentCart();
    if (!currentCart || !Array.isArray(currentCart.lineItems) || currentCart.lineItems.length === 0) {
      try {
        $w('#sideCartEmpty').show();
        $w('#sideCartItems').hide();
        $w('#sideCartFooter').hide();
      } catch (e) {}
      try { $w('#cartBadge').hide(); } catch (e) {}
      return;
    }

    try {
      $w('#sideCartEmpty').hide();
      $w('#sideCartItems').show();
      $w('#sideCartFooter').show();
    } catch (e) {}

    // Update item count badge
    const itemCount = currentCart.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    try {
      $w('#cartBadge').text = String(itemCount);
      $w('#cartBadge').show();
    } catch (e) {}

    // Update repeater data (handler registered once in initSideCartRepeater)
    const repeater = $w('#sideCartRepeater');
    if (repeater) {
      repeater.data = currentCart.lineItems.map(item => {
        const opts = Array.isArray(item.options) ? item.options : [];
        const variantDetails = opts.map(o => `${o.option}: ${o.value}`).join(' · ');
        return {
          _id: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.mediaItem?.src || '',
          lineTotal: safeMultiply(item.price, item.quantity),
          variantName: opts.map(o => o.value).join(', '),
          variantDetails,
        };
      });
    }

    // Update totals
    if (currentCart.totals) {
      try {
        $w('#sideCartSubtotal').text = `$${Number(currentCart.totals.subtotal).toFixed(2)}`;
      } catch (e) {}
    }

    const subtotal = currentCart.totals?.subtotal || 0;

    // Shipping progress
    updateSideCartShipping(subtotal);

    // Tiered discount incentive
    updateSideTierProgress(subtotal);

    // Multiple cross-sell suggestions
    await loadSideCartSuggestions(currentCart.lineItems);
  } catch (err) {
    console.error('Error refreshing side cart:', err);
  }
}

function updateSideCartShipping(subtotal) {
  const { remaining, progressPct, qualifies } = getShippingProgress(subtotal);
  const barStyles = getProgressBarStyles('shipping', qualifies);

  try {
    const bar = $w('#sideShippingBar');
    const text = $w('#sideShippingText');

    if (bar) {
      bar.value = progressPct;
      try { bar.style.backgroundColor = barStyles.trackColor; } catch (e) {}
      try { bar.style.color = barStyles.fillColor; } catch (e) {}
    }

    if (text) {
      if (!qualifies) {
        text.text = `$${remaining.toFixed(2)} away from free shipping`;
      } else {
        text.text = 'FREE shipping!';
      }
      try { text.style.color = barStyles.textColor; } catch (e) {}
      try { text.accessibility.ariaLive = 'polite'; } catch (e) {}
      try { text.accessibility.role = 'status'; } catch (e) {}
    }
  } catch (e) {}
}

// ── Tiered Discount Progress (Side Cart) ────────────────────────────

function updateSideTierProgress(subtotal) {
  try {
    const { tier, remaining, progressPct } = getTierProgress(subtotal);
    const barStyles = getProgressBarStyles('tier');

    const bar = $w('#sideTierBar');
    const text = $w('#sideTierText');

    if (bar) {
      bar.value = progressPct;
      try { bar.style.backgroundColor = barStyles.trackColor; } catch (e) {}
      try { bar.style.color = barStyles.fillColor; } catch (e) {}
    }

    if (text) {
      text.text = tier.label(remaining.toFixed(2));
      try { text.style.color = barStyles.textColor; } catch (e) {}
    }
  } catch (e) {}
}

// ── Multiple Cross-Sell Suggestions (up to 3) ───────────────────────

async function loadSideCartSuggestions(lineItems) {
  try {
    const productIds = lineItems.map(item => item.productId);
    const suggestions = await getCompletionSuggestions(productIds);

    if (!suggestions || suggestions.length === 0) {
      try { $w('#sideCartSuggestion').collapse(); } catch (e) {}
      return;
    }

    const topSuggestion = suggestions[0];
    if (!topSuggestion.products || topSuggestion.products.length === 0) {
      try { $w('#sideCartSuggestion').collapse(); } catch (e) {}
      return;
    }

    // Show the suggestion heading
    try {
      $w('#sideSugLabel').text = topSuggestion.heading;
      $w('#sideCartSuggestion').expand();
    } catch (e) {}

    // Populate up to 3 suggestions in the repeater
    const sugRepeater = $w('#sideSugRepeater');
    if (sugRepeater) {
      const products = topSuggestion.products.slice(0, 3);

      // Register onItemReady ONCE to prevent handler accumulation (CF-1b86)
      if (!_repeaterInitialized) {
        _repeaterInitialized = true;
        const crossSellStyles = getCrossSellCardStyles();
        sugRepeater.onItemReady(($item, product) => {
          try { $item('#sideSugImage').src = product.mainMedia; } catch (e) {}
          try { $item('#sideSugImage').alt = `${product.name} - add to cart`; } catch (e) {}
          try { $item('#sideSugName').text = product.name; } catch (e) {}
          try { $item('#sideSugName').style.color = crossSellStyles.nameColor; } catch (e) {}
          try { $item('#sideSugPrice').text = product.formattedPrice; } catch (e) {}
          try { $item('#sideSugPrice').style.color = crossSellStyles.priceColor; } catch (e) {}

          try {
            $item('#sideSugAdd').onClick(async () => {
              try {
                $item('#sideSugAdd').disable();
                $item('#sideSugAdd').label = 'Adding...';
                await addToCart(product._id);
                $item('#sideSugAdd').label = 'Added!';
              } catch (err) {
                console.error('Error adding suggestion:', err);
                $item('#sideSugAdd').label = 'Error';
                $item('#sideSugAdd').enable();
              }
            });
          } catch (e) {}

          // Click image/name to navigate to product
          const navigate = () => {
            import('wix-location-frontend').then(({ to }) => {
              to(`/product-page/${product.slug}`);
            });
          };
          try { makeClickable($item('#sideSugImage'), navigate, { ariaLabel: `View ${product.name}` }); } catch (e) {}
          try { makeClickable($item('#sideSugName'), navigate, { ariaLabel: `View ${product.name} details` }); } catch (e) {}
        });
      }

      sugRepeater.data = products.map(p => ({ ...p, _id: p._id }));
    } else {
      // Fallback: if no repeater, show single suggestion in legacy elements
      const product = topSuggestion.products[0];
      currentSideSugProduct = product;
      try {
        $w('#sideSugImage').src = product.mainMedia;
        $w('#sideSugName').text = product.name;
        $w('#sideSugPrice').text = product.formattedPrice;
        $w('#sideSugAdd').enable();
        $w('#sideSugAdd').label = 'Add to Cart';
        $w('#sideCartSuggestion').expand();

        // Register onClick ONCE to prevent handler accumulation (CF-1b86)
        if (!_legacySugHandlerRegistered) {
          _legacySugHandlerRegistered = true;
          $w('#sideSugAdd').onClick(async () => {
            try {
              $w('#sideSugAdd').disable();
              $w('#sideSugAdd').label = 'Adding...';
              await addToCart(currentSideSugProduct._id);
              $w('#sideSugAdd').label = 'Added!';
            } catch (err) {
              console.error('Error adding suggestion:', err);
              $w('#sideSugAdd').label = 'Error';
              $w('#sideSugAdd').enable();
            }
          });
        }
      } catch (e) {}
    }
  } catch (e) {}
}
