// Cart Page.js - Shopping Cart
// Modern cart with cross-sell suggestions, shipping threshold,
// tiered discount incentives, recently viewed, financing, and "Complete Your Futon" bundling
import { getCompletionSuggestions } from 'backend/productRecommendations.web';
import { getCartFinancing } from 'backend/financingCalc.web';
import { getRecentlyViewed } from 'public/galleryHelpers';
import {
  getCurrentCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  onCartChanged,
  getShippingProgress,
  getTierProgress,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from 'public/cartService';
import { initBackToTop, collapseOnMobile, limitForViewport } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { fireViewCart } from 'public/ga4Tracking';
import { announce, makeClickable } from 'public/a11yHelpers';
import {
  getCartItemStyles,
  getProgressBarStyles,
  getEmptyCartStyles,
  getCheckoutButtonStyles,
  getQuantitySpinnerStyles,
} from 'public/cartStyles.js';
import { buildRoomBundles, initCrossSellWidget } from 'public/crossSellWidget.js';

$w.onReady(async function () {
  await initCartPage();
});

async function initCartPage() {
  try {
    await $w('#cartDataset').onReady();
    const cart = await getCurrentCart();

    // Empty cart state
    if (!cart || !cart.lineItems || cart.lineItems.length === 0) {
      showEmptyCart();
      trackEvent('page_view', { page: 'cart', empty: true });
      initBackToTop($w);
      return;
    }

    trackEvent('page_view', { page: 'cart', itemCount: cart.lineItems.length });

    // Fire GA4 view_cart for funnel drop-off tracking (Cart→Checkout)
    try {
      const subtotal = cart.totals?.subtotal || 0;
      fireViewCart(cart.lineItems, subtotal).catch(() => {});
    } catch (e) {}

    // Collapse non-essential sections on mobile for faster paint
    collapseOnMobile($w, ['#cartRecentSection', '#cartFinancingSection']);

    // Pass fetched cart to avoid redundant API calls
    updateShippingProgressFromCart(cart);
    updateTierProgressFromCart(cart);
    updateCartFinancingFromCart(cart);
    await loadCartSuggestions(cart);
    loadRecentlyViewedFromCart(cart);
    initQuantityControls();
    initCartListeners();
    initBackToTop($w);
  } catch (err) {
    console.error('Error initializing cart page:', err);
  }
}

function showEmptyCart() {
  const emptyStyles = getEmptyCartStyles();
  const btnStyles = getCheckoutButtonStyles();
  try {
    try { $w('#emptyCartSection').expand(); } catch (e) {}
    try {
      $w('#emptyCartTitle').text = 'Your cart is empty';
      $w('#emptyCartTitle').style.color = emptyStyles.headingColor;
      $w('#emptyCartTitle').accessibility.role = 'heading';
    } catch (e) {}
    try {
      $w('#emptyCartMessage').text = 'Browse our collection to find the perfect futon for your home.';
      $w('#emptyCartMessage').style.color = emptyStyles.messageColor;
    } catch (e) {}
    try {
      $w('#continueShoppingBtn').style.backgroundColor = btnStyles.background;
      $w('#continueShoppingBtn').style.color = btnStyles.textColor;
      $w('#continueShoppingBtn').accessibility.ariaLabel = 'Continue shopping — browse our collection';
      $w('#continueShoppingBtn').onClick(() => {
        import('wix-location-frontend').then(({ to }) => to('/'));
      });
    } catch (e) {}
    // Collapse sections that don't apply for empty carts
    try { $w('#suggestionsSection').collapse(); } catch (e) {}
    try { $w('#cartRecentSection').collapse(); } catch (e) {}
    try { $w('#cartFinancingSection').collapse(); } catch (e) {}
    try { $w('#shippingProgressBar').hide(); } catch (e) {}
    try { $w('#shippingProgressText').hide(); } catch (e) {}
    try { $w('#tierProgressBar').hide(); } catch (e) {}
    try { $w('#tierProgressText').hide(); } catch (e) {}
  } catch (e) {}
}

// ── Shipping Threshold Progress Bar ─────────────────────────────────
// "You're $X away from free shipping!" with visual progress bar

// Accept optional cart param to avoid redundant getCurrentCart() calls
async function updateShippingProgress(cart) {
  try {
    const currentCart = cart || await getCurrentCart();
    if (!currentCart) return;
    updateShippingProgressFromCart(currentCart);
  } catch (e) {}
}

function updateShippingProgressFromCart(currentCart) {
  try {
    const subtotal = currentCart.totals?.subtotal || 0;
    const { remaining, progressPct, qualifies } = getShippingProgress(subtotal);
    const barStyles = getProgressBarStyles('shipping', qualifies);

    const progressBar = $w('#shippingProgressBar');
    const progressText = $w('#shippingProgressText');

    if (progressBar) {
      progressBar.value = progressPct;
      try { progressBar.style.backgroundColor = barStyles.trackColor; } catch (e) {}
      try { progressBar.style.color = barStyles.fillColor; } catch (e) {}
    }

    if (progressText) {
      if (!qualifies) {
        progressText.text = `You're $${remaining.toFixed(2)} away from free shipping!`;
      } else {
        progressText.text = 'You qualify for FREE shipping!';
        try {
          $w('#shippingProgressIcon').show();
        } catch (e) {}
      }
      try { progressText.style.color = barStyles.textColor; } catch (e) {}
      try { progressText.accessibility.ariaLive = 'polite'; } catch (e) {}
      try { progressText.accessibility.role = 'status'; } catch (e) {}
    }

    // ARIA label for progress bar
    try { progressBar.accessibility.ariaLabel = `Free shipping progress: ${progressPct}%`; } catch (e) {}
    try { progressBar.accessibility.ariaValueNow = progressPct; } catch (e) {}
    try { progressBar.accessibility.ariaValueMin = 0; } catch (e) {}
    try { progressBar.accessibility.ariaValueMax = 100; } catch (e) {}
  } catch (e) {}
}

// ── Tiered Discount Progress Bar ────────────────────────────────────
// "Spend $X more for Y% off!" with coral progress bar

async function updateTierProgress(cart) {
  try {
    const currentCart = cart || await getCurrentCart();
    if (!currentCart) return;
    updateTierProgressFromCart(currentCart);
  } catch (e) {}
}

function updateTierProgressFromCart(currentCart) {
  try {
    const subtotal = currentCart.totals?.subtotal || 0;
    const { tier, remaining, progressPct } = getTierProgress(subtotal);
    const barStyles = getProgressBarStyles('tier');

    const progressBar = $w('#tierProgressBar');
    const progressText = $w('#tierProgressText');

    if (progressBar) {
      progressBar.value = progressPct;
      try { progressBar.style.backgroundColor = barStyles.trackColor; } catch (e) {}
      try { progressBar.style.color = barStyles.fillColor; } catch (e) {}
    }

    if (progressText) {
      progressText.text = tier.label(remaining.toFixed(2));
      try { progressText.style.color = barStyles.textColor; } catch (e) {}
      try { progressText.accessibility.ariaLive = 'polite'; } catch (e) {}
      try { progressText.accessibility.role = 'status'; } catch (e) {}
    }

    // ARIA label for tier progress bar
    try { progressBar.accessibility.ariaLabel = `Discount tier progress: ${progressPct}%`; } catch (e) {}
    try { progressBar.accessibility.ariaValueNow = progressPct; } catch (e) {}
    try { progressBar.accessibility.ariaValueMin = 0; } catch (e) {}
    try { progressBar.accessibility.ariaValueMax = 100; } catch (e) {}
  } catch (e) {}
}

// ── Recently Viewed Products ────────────────────────────────────────
// Horizontal scroll of products the user has viewed this session

function loadRecentlyViewedFromCart(cart) {
  try {
    loadRecentlyViewed(cart);
  } catch (e) {}
}

async function loadRecentlyViewed(cart) {
  try {
    const currentCart = cart || await getCurrentCart();
    const cartProductIds = currentCart?.lineItems?.map(item => item.productId) || [];

    // Get recently viewed, excluding items already in cart
    let recentProducts = getRecentlyViewed();
    recentProducts = recentProducts.filter(p => !cartProductIds.includes(p._id));

    const section = $w('#cartRecentSection');
    const repeater = $w('#cartRecentRepeater');

    if (!recentProducts || recentProducts.length === 0) {
      if (section) section.collapse();
      return;
    }

    if (section) section.expand();

    if (repeater) {
      repeater.data = recentProducts.map(p => ({ ...p, _id: p._id }));
      repeater.onItemReady(($item, itemData) => {
        try { $item('#cartRecentImage').src = itemData.mainMedia; } catch (e) {}
        try { $item('#cartRecentImage').alt = `${itemData.name} - recently viewed`; } catch (e) {}
        try { $item('#cartRecentImage').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
        try { $item('#cartRecentName').text = itemData.name; } catch (e) {}
        try { $item('#cartRecentPrice').text = itemData.price; } catch (e) {}

        const navigate = () => {
          import('wix-location-frontend').then(({ to }) => {
            to(`/product-page/${itemData.slug}`);
          });
        };
        try { makeClickable($item('#cartRecentImage'), navigate, { ariaLabel: `View ${itemData.name}` }); } catch (e) {}
        try { makeClickable($item('#cartRecentName'), navigate, { ariaLabel: `View ${itemData.name} details` }); } catch (e) {}
      });
    }
  } catch (e) {}
}

// ── Intelligent Cross-Sell ("Complete the Room") ──────────────────
// Analyzes cart contents and suggests complementary products with bundle savings

async function loadCartSuggestions(cart) {
  try {
    const currentCart = cart || await getCurrentCart();
    if (!currentCart || !currentCart.lineItems || currentCart.lineItems.length === 0) {
      try { $w('#suggestionsSection').collapse(); } catch (e) {}
      return;
    }

    const productIds = currentCart.lineItems.map(item => item.productId);
    const suggestions = await getCompletionSuggestions(productIds);

    if (!suggestions || suggestions.length === 0) {
      try { $w('#suggestionsSection').collapse(); } catch (e) {}
      return;
    }

    const cartSubtotal = currentCart.totals?.subtotal || 0;
    const bundles = buildRoomBundles(suggestions, cartSubtotal);

    // Limit displayed products per viewport (mobile: 2, tablet: 3, desktop: 4)
    const viewportBundles = bundles.map(b => ({
      ...b,
      products: limitForViewport(b.products, { mobile: 2, tablet: 3, desktop: 4 }),
    }));

    initCrossSellWidget($w, {
      bundles: viewportBundles,
      addToCart,
      announce,
      elements: {
        section: '#suggestionsSection',
        heading: '#suggestionsHeading',
        subheading: '#suggestionsSubheading',
        savingsBadge: '#sugSavingsBadge',
        repeater: '#suggestionsRepeater',
        bundlePrice: '#sugBundlePrice',
        originalPrice: '#sugOriginalPrice',
      },
      cardElements: {
        image: '#sugImage',
        name: '#sugName',
        price: '#sugPrice',
        addBtn: '#sugAddBtn',
      },
      onProductClick: (product) => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${product.slug}`);
        });
      },
      onAdded: () => {
        setTimeout(() => {
          updateShippingProgress();
          loadCartSuggestions();
        }, 1000);
      },
    });
  } catch (err) {
    console.error('Error loading cart suggestions:', err);
  }
}

// ── Financing Options Display ──────────────────────────────────────
// Shows BNPL and monthly payment options based on cart total

async function updateCartFinancing(cart) {
  try {
    const currentCart = cart || await getCurrentCart();
    if (!currentCart) return;
    updateCartFinancingFromCart(currentCart);
  } catch (e) {}
}

async function updateCartFinancingFromCart(currentCart) {
  try {
    const subtotal = currentCart.totals?.subtotal || 0;
    const section = $w('#cartFinancingSection');
    if (!section) return;

    if (subtotal <= 0) { section.collapse(); return; }

    const result = await getCartFinancing(subtotal);
    if (!result.success) { section.collapse(); return; }

    section.expand();

    // Threshold message (e.g., "Add $50 more to unlock financing")
    try {
      const thresholdEl = $w('#financingThreshold');
      if (thresholdEl && result.thresholdMessage) {
        thresholdEl.text = result.thresholdMessage;
        thresholdEl.show();
      } else if (thresholdEl) {
        thresholdEl.hide();
      }
    } catch (e) {}

    // Lowest monthly teaser
    try {
      const teaserEl = $w('#cartFinancingTeaser');
      if (teaserEl && result.financing.lowestMonthly) {
        teaserEl.text = result.financing.lowestMonthly;
        teaserEl.show();
      } else if (teaserEl) {
        teaserEl.hide();
      }
    } catch (e) {}

    // Afterpay message
    try {
      const afterpayEl = $w('#cartAfterpayMessage');
      if (afterpayEl && result.afterpay.eligible) {
        afterpayEl.text = result.afterpay.message;
        afterpayEl.show();
      } else if (afterpayEl) {
        afterpayEl.hide();
      }
    } catch (e) {}
  } catch (e) {}
}

// ── Quantity Controls ───────────────────────────────────────────────
// +/- buttons for quantity adjustment

function initQuantityControls() {
  try {
    const cartRepeater = $w('#cartItemsRepeater');
    if (!cartRepeater) return;

    const itemStyles = getCartItemStyles();
    const spinnerStyles = getQuantitySpinnerStyles();

    cartRepeater.onItemReady(($item, itemData) => {
      // Brand-consistent styling for cart items
      try { $item('#cartItemName').style.color = itemStyles.nameColor; } catch (e) {}
      try { $item('#cartItemPrice').style.color = itemStyles.priceColor; } catch (e) {}

      // Quantity spinner styling — mountain blue buttons
      try { $item('#qtyMinus').style.color = spinnerStyles.buttonColor; } catch (e) {}
      try { $item('#qtyPlus').style.color = spinnerStyles.buttonColor; } catch (e) {}
      try { $item('#qtyInput').style.color = spinnerStyles.valueColor; } catch (e) {}

      // Remove button — coral accent
      try { $item('#removeItem').style.color = itemStyles.removeColor; } catch (e) {}

      // ARIA labels for cart item controls
      try { $item('#qtyMinus').accessibility.ariaLabel = `Decrease quantity of ${itemData.name}`; } catch (e) {}
      try { $item('#qtyPlus').accessibility.ariaLabel = `Increase quantity of ${itemData.name}`; } catch (e) {}
      try { $item('#qtyInput').accessibility.ariaLabel = `Quantity of ${itemData.name}`; } catch (e) {}
      try { $item('#qtyInput').accessibility.role = 'spinbutton'; } catch (e) {}
      try { $item('#qtyInput').accessibility.ariaValueMin = MIN_QUANTITY; } catch (e) {}
      try { $item('#qtyInput').accessibility.ariaValueMax = MAX_QUANTITY; } catch (e) {}
      try { $item('#qtyInput').accessibility.ariaValueNow = parseInt($item('#qtyInput').value) || MIN_QUANTITY; } catch (e) {}
      try { $item('#removeItem').accessibility.ariaLabel = `Remove ${itemData.name} from cart`; } catch (e) {}

      try {
        $item('#qtyMinus').onClick(async () => {
          const currentQty = parseInt($item('#qtyInput').value) || MIN_QUANTITY;
          if (currentQty > MIN_QUANTITY) {
            const newQty = currentQty - 1;
            try {
              await updateCartItemQuantity(itemData._id, newQty);
              $item('#qtyInput').value = String(newQty);
              try { $item('#qtyInput').accessibility.ariaValueNow = newQty; } catch (e) {}
              announce($w, `${itemData.name} quantity updated to ${newQty}`);
            } catch (err) {
              console.error('Error updating quantity:', err);
            }
            try { await refreshCartTotals(); } catch (e) {}
          }
        });

        $item('#qtyPlus').onClick(async () => {
          const currentQty = parseInt($item('#qtyInput').value) || MIN_QUANTITY;
          if (currentQty >= MAX_QUANTITY) return;
          const newQty = currentQty + 1;
          try {
            await updateCartItemQuantity(itemData._id, newQty);
            $item('#qtyInput').value = String(newQty);
            try { $item('#qtyInput').accessibility.ariaValueNow = newQty; } catch (e) {}
            announce($w, `${itemData.name} quantity updated to ${newQty}`);
          } catch (err) {
            console.error('Error updating quantity:', err);
          }
          try { await refreshCartTotals(); } catch (e) {}
        });

        $item('#removeItem').onClick(async () => {
          try {
            await removeCartItem(itemData._id);
            announce($w, `${itemData.name} removed from cart`);
          } catch (err) {
            console.error('Error removing item:', err);
          }
          try { await refreshCartTotals(); } catch (e) {}
        });
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Cart Change Listeners ───────────────────────────────────────────

function initCartListeners() {
  let cartChangeTimer;
  onCartChanged(() => {
    // Debounce to prevent 5 redundant API calls per rapid cart change
    clearTimeout(cartChangeTimer);
    cartChangeTimer = setTimeout(async () => {
      try {
        // Single getCurrentCart() call shared by all listeners
        const cart = await getCurrentCart();
        updateShippingProgress(cart);
        updateTierProgress(cart);
        updateCartFinancing(cart);
        loadCartSuggestions(cart);
        loadRecentlyViewed(cart);
      } catch (e) {}
    }, 300);
  });
}

async function refreshCartTotals() {
  try {
    const currentCart = await getCurrentCart();
    if (currentCart && currentCart.totals) {
      const fmt = (n) => `$${Number(n).toFixed(2)}`;
      const itemStyles = getCartItemStyles();
      try { $w('#cartSubtotal').text = fmt(currentCart.totals.subtotal); $w('#cartSubtotal').style.color = itemStyles.nameColor; } catch (e) {}
      try { $w('#cartShipping').text = currentCart.totals.shipping > 0 ? fmt(currentCart.totals.shipping) : 'Calculated at checkout'; } catch (e) {}
      try { $w('#cartTotal').text = fmt(currentCart.totals.total); $w('#cartTotal').style.color = itemStyles.nameColor; $w('#cartTotal').style.fontWeight = 'bold'; } catch (e) {}
    }
    await updateShippingProgress();
    await updateCartFinancing();
  } catch (e) {}
}
