// Side Cart.ego5s.js - Slide-Out Mini Cart
// Modern slide-out cart panel that appears when items are added
// Shows items, subtotal, shipping progress, and quick checkout
import { getCompletionSuggestions } from 'backend/productRecommendations.web';
import wixStoreFrontend from 'wix-stores-frontend';

const FREE_SHIPPING_THRESHOLD = 999;

$w.onReady(function () {
  initSideCart();
});

function initSideCart() {
  // Listen for cart changes to update the side cart
  wixStoreFrontend.onCartChanged(async () => {
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
    const cart = wixStoreFrontend.getCurrentCart();
    if (!cart || !cart.lineItems || cart.lineItems.length === 0) {
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
    const itemCount = cart.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    try {
      $w('#cartBadge').text = String(itemCount);
      $w('#cartBadge').show();
    } catch (e) {}

    // Update cart items in repeater
    const repeater = $w('#sideCartRepeater');
    if (repeater) {
      repeater.data = cart.lineItems.map(item => ({
        _id: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.mediaItem?.src || '',
        variantName: item.options?.map(o => o.value).join(', ') || '',
      }));

      repeater.onItemReady(($item, itemData) => {
        $item('#sideItemImage').src = itemData.image;
        $item('#sideItemName').text = itemData.name;
        $item('#sideItemPrice').text = `$${Number(itemData.price).toFixed(2)}`;
        $item('#sideItemQty').text = `Qty: ${itemData.quantity}`;
        if (itemData.variantName) {
          try {
            $item('#sideItemVariant').text = itemData.variantName;
            $item('#sideItemVariant').show();
          } catch (e) {}
        }

        $item('#sideItemRemove').onClick(async () => {
          await wixStoreFrontend.removeFromCart(itemData._id);
        });
      });
    }

    // Update totals
    if (cart.totals) {
      try {
        $w('#sideCartSubtotal').text = `$${Number(cart.totals.subtotal).toFixed(2)}`;
      } catch (e) {}
    }

    // Shipping progress
    updateSideCartShipping(cart.totals?.subtotal || 0);

    // Quick cross-sell suggestion
    await loadSideCartSuggestion(cart.lineItems);
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

async function loadSideCartSuggestion(lineItems) {
  try {
    const productIds = lineItems.map(item => item.productId);
    const suggestions = await getCompletionSuggestions(productIds);

    if (!suggestions || suggestions.length === 0) {
      try { $w('#sideCartSuggestion').collapse(); } catch (e) {}
      return;
    }

    const topSuggestion = suggestions[0];
    if (topSuggestion.products.length > 0) {
      const product = topSuggestion.products[0];
      try {
        $w('#sideSugLabel').text = topSuggestion.heading;
        $w('#sideSugImage').src = product.mainMedia;
        $w('#sideSugName').text = product.name;
        $w('#sideSugPrice').text = product.formattedPrice;
        $w('#sideCartSuggestion').expand();

        $w('#sideSugAdd').onClick(async () => {
          await wixStoreFrontend.addToCart(product._id, 1);
          $w('#sideSugAdd').label = 'Added!';
          $w('#sideSugAdd').disable();
        });
      } catch (e) {}
    }
  } catch (e) {}
}
