// Side Cart.ego5s.js - Slide-Out Mini Cart
// Modern slide-out cart panel with tiered incentives, multiple cross-sell
// suggestions, enhanced item display, and animated interactions
import { getCompletionSuggestions } from 'backend/productRecommendations.web';
import wixStoresFrontend from 'wix-stores-frontend';

const FREE_SHIPPING_THRESHOLD = 999;

// Tiered discount thresholds (matches Cart Page)
const TIER_THRESHOLDS = [
  { min: 0, max: 500, discount: 5, label: pct => `Spend $${pct} more for 5% off your order` },
  { min: 500, max: 1000, discount: 10, label: pct => `Spend $${pct} more for 10% off your order` },
  { min: 1000, max: Infinity, discount: 10, label: () => 'You qualify for 10% off — applied at checkout!' },
];

$w.onReady(function () {
  initSideCart();
});

function initSideCart() {
  // Listen for cart changes to update the side cart
  wixStoresFrontend.onCartChanged(async () => {
    await refreshSideCart();
  });

  // Close button
  try {
    $w('#sideCartClose').onClick(() => {
      $w('#sideCartPanel').hide('slide', { direction: 'right', duration: 300 });
    });
  } catch (e) {}

  // Overlay click to close
  try {
    $w('#sideCartOverlay').onClick(() => {
      $w('#sideCartPanel').hide('slide', { direction: 'right', duration: 300 });
    });
  } catch (e) {}

  // View full cart button
  try {
    $w('#viewFullCart').onClick(() => {
      import('wix-location').then(({ to }) => to('/cart-page'));
    });
  } catch (e) {}

  // Checkout button
  try {
    $w('#sideCartCheckout').onClick(() => {
      import('wix-location').then(({ to }) => to('/checkout'));
    });
  } catch (e) {}
}

async function refreshSideCart() {
  try {
    const currentCart = await wixStoresFrontend.cart.getCurrentCart();
    if (!currentCart || !currentCart.lineItems || currentCart.lineItems.length === 0) {
      try {
        $w('#sideCartEmpty').show();
        $w('#sideCartItems').hide();
        $w('#sideCartFooter').hide();
      } catch (e) {}
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

    // Update cart items in repeater — enhanced with variant details and line totals
    const repeater = $w('#sideCartRepeater');
    if (repeater) {
      repeater.data = currentCart.lineItems.map(item => ({
        _id: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        lineTotal: item.price * item.quantity,
        image: item.mediaItem?.src || '',
        variantName: item.options?.map(o => o.value).join(', ') || '',
        variantDetails: item.options?.map(o => `${o.option}: ${o.value}`).join(' · ') || '',
      }));

      repeater.onItemReady(($item, itemData) => {
        $item('#sideItemImage').src = itemData.image;
        $item('#sideItemName').text = itemData.name;
        $item('#sideItemPrice').text = `$${Number(itemData.price).toFixed(2)}`;
        $item('#sideItemQty').text = `Qty: ${itemData.quantity}`;

        // Enhanced: show line item total (price × qty)
        try {
          $item('#sideItemLineTotal').text = `$${Number(itemData.lineTotal).toFixed(2)}`;
        } catch (e) {}

        // Enhanced: show variant details prominently (e.g., "Size: Queen · Finish: Honey Oak")
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

        // Animated removal with slide-out effect
        $item('#sideItemRemove').onClick(async () => {
          try {
            // Slide the item out before refreshing
            $item('#sideItemImage').hide('slide', { direction: 'right', duration: 200 });
            $item('#sideItemName').hide('fade', { duration: 200 });
          } catch (e) {}
          // Brief delay for animation, then refresh
          setTimeout(() => refreshSideCart(), 250);
        });
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
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;

  try {
    const bar = $w('#sideShippingBar');
    const text = $w('#sideShippingText');

    if (bar) {
      bar.value = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
    }

    if (text) {
      if (remaining > 0) {
        text.text = `$${remaining.toFixed(2)} away from free shipping`;
      } else {
        text.text = 'FREE shipping!';
      }
    }
  } catch (e) {}
}

// ── Tiered Discount Progress (Side Cart) ────────────────────────────

function updateSideTierProgress(subtotal) {
  try {
    const tier = TIER_THRESHOLDS.find(t => subtotal >= t.min && subtotal < t.max)
      || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];

    const bar = $w('#sideTierBar');
    const text = $w('#sideTierText');

    if (bar) {
      if (tier.max === Infinity) {
        bar.value = 100;
      } else {
        bar.value = Math.min((subtotal / tier.max) * 100, 100);
      }
    }

    if (text) {
      const remaining = tier.max === Infinity ? 0 : (tier.max - subtotal);
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
            await wixStoresFrontend.cart.addProducts([{
              productId: product._id,
              quantity: 1,
            }]);
            $item('#sideSugAdd').label = 'Added!';
            $item('#sideSugAdd').disable();
          });
        } catch (e) {}

        // Click image/name to navigate to product
        const navigate = () => {
          import('wix-location').then(({ to }) => {
            to(`/product-page/${product.slug}`);
          });
        };
        try { $item('#sideSugImage').onClick(navigate); } catch (e) {}
        try { $item('#sideSugName').onClick(navigate); } catch (e) {}
      });
    } else {
      // Fallback: if no repeater, show single suggestion in legacy elements
      const product = topSuggestion.products[0];
      try {
        $w('#sideSugImage').src = product.mainMedia;
        $w('#sideSugName').text = product.name;
        $w('#sideSugPrice').text = product.formattedPrice;

        // Reset button state for new suggestion
        $w('#sideSugAdd').label = 'Add to Cart';
        $w('#sideSugAdd').enable();

        // Remove previous handler before adding new one
        $w('#sideSugAdd').onClick(async () => {
          await wixStoresFrontend.cart.addProducts([{
            productId: product._id,
            quantity: 1,
          }]);
          $w('#sideSugAdd').label = 'Added!';
          $w('#sideSugAdd').disable();
        });
      } catch (e) {}
    }
  } catch (e) {}
}
