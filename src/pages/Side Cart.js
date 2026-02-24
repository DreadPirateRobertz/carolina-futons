// Side Cart.js - Slide-Out Mini Cart
// Modern slide-out cart panel with tiered incentives, multiple cross-sell
// suggestions, enhanced item display, and animated interactions
import { getCompletionSuggestions } from 'backend/productRecommendations.web';
import {
  getCurrentCart,
  addToCart,
  removeCartItem,
  onCartChanged,
  getShippingProgress,
  getTierProgress,
  FREE_SHIPPING_THRESHOLD,
} from 'public/cartService';
import { announce, makeClickable } from 'public/a11yHelpers.js';

let currentSideSugProduct = null;

$w.onReady(function () {
  initSideCart();
});

function initSideCart() {
  // Listen for cart changes to update the side cart
  onCartChanged(async () => {
    await refreshSideCart();
  });

  // Set ARIA dialog attributes on side cart panel
  try {
    $w('#sideCartPanel').accessibility.role = 'dialog';
    $w('#sideCartPanel').accessibility.ariaModal = true;
    $w('#sideCartPanel').accessibility.ariaLabel = 'Shopping cart';
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

  // Escape key closes side cart
  if (typeof document !== 'undefined') {
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

  // Checkout button
  try {
    $w('#sideCartCheckout').onClick(() => {
      import('wix-location-frontend').then(({ to }) => to('/checkout'));
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

    repeater.onItemReady(($item, itemData) => {
      $item('#sideItemImage').src = itemData.image;
      $item('#sideItemName').text = itemData.name;
      $item('#sideItemPrice').text = `$${Number(itemData.price).toFixed(2)}`;
      $item('#sideItemQty').text = `Qty: ${itemData.quantity}`;

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

      // ARIA label for remove button
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
        const variantDetails = item.options?.map(o => `${o.option}: ${o.value}`).join(' · ') || '';
        return {
          _id: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.mediaItem?.src || '',
          lineTotal: (item.price || 0) * (item.quantity || 1),
          variantName: item.options?.map(o => o.value).join(', ') || '',
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

  try {
    const bar = $w('#sideShippingBar');
    const text = $w('#sideShippingText');

    if (bar) {
      bar.value = progressPct;
    }

    if (text) {
      if (!qualifies) {
        text.text = `$${remaining.toFixed(2)} away from free shipping`;
      } else {
        text.text = 'FREE shipping!';
      }
      try { text.accessibility.ariaLive = 'polite'; } catch (e) {}
      try { text.accessibility.role = 'status'; } catch (e) {}
    }
  } catch (e) {}
}

// ── Tiered Discount Progress (Side Cart) ────────────────────────────

function updateSideTierProgress(subtotal) {
  try {
    const { tier, remaining, progressPct } = getTierProgress(subtotal);

    const bar = $w('#sideTierBar');
    const text = $w('#sideTierText');

    if (bar) {
      bar.value = progressPct;
    }

    if (text) {
      text.text = tier.label(remaining.toFixed(2));
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
      sugRepeater.data = products.map(p => ({ ...p, _id: p._id }));

      sugRepeater.onItemReady(($item, product) => {
        try { $item('#sideSugImage').src = product.mainMedia; } catch (e) {}
        try { $item('#sideSugImage').alt = `${product.name} - add to cart`; } catch (e) {}
        try { $item('#sideSugName').text = product.name; } catch (e) {}
        try { $item('#sideSugPrice').text = product.formattedPrice; } catch (e) {}

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
    } else {
      // Fallback: if no repeater, show single suggestion in legacy elements
      const product = topSuggestion.products[0];
      currentSideSugProduct = product;
      try {
        currentSideSugProduct = product;
        $w('#sideSugImage').src = product.mainMedia;
        $w('#sideSugName').text = product.name;
        $w('#sideSugPrice').text = product.formattedPrice;
        $w('#sideSugAdd').enable();
        $w('#sideSugAdd').label = 'Add to Cart';
        $w('#sideCartSuggestion').expand();

        $w('#sideSugAdd').onClick(async () => {
          try {
            $w('#sideSugAdd').disable();
            $w('#sideSugAdd').label = 'Adding...';
            await addToCart(product._id);
            $w('#sideSugAdd').label = 'Added!';
          } catch (err) {
            console.error('Error adding suggestion:', err);
            $w('#sideSugAdd').label = 'Error';
            $w('#sideSugAdd').enable();
          }
        });
      } catch (e) {}
    }
  } catch (e) {}
}
