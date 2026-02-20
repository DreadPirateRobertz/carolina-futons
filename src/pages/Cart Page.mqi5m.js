// Cart Page.mqi5m.js - Shopping Cart
// Modern cart with cross-sell suggestions, shipping threshold,
// tiered discount incentives, recently viewed, and "Complete Your Futon" bundling
import { getCompletionSuggestions } from 'backend/productRecommendations.web';
import { getRecentlyViewed } from 'public/galleryHelpers';
import wixStoresFrontend from 'wix-stores-frontend';

const FREE_SHIPPING_THRESHOLD = 999;

// Tiered discount thresholds
const TIER_THRESHOLDS = [
  { min: 0, max: 500, discount: 5, label: pct => `Spend $${pct} more for 5% off your order` },
  { min: 500, max: 1000, discount: 10, label: pct => `Spend $${pct} more for 10% off your order` },
  { min: 1000, max: Infinity, discount: 10, label: () => 'You qualify for 10% off — applied at checkout!' },
];

$w.onReady(async function () {
  await initCartPage();
});

async function initCartPage() {
  try {
    await $w('#cartDataset').onReady();
    await updateShippingProgress();
    await updateTierProgress();
    await loadCartSuggestions();
    await loadRecentlyViewed();
    initQuantityControls();
    initCartListeners();
  } catch (err) {
    console.error('Error initializing cart page:', err);
  }
}

// ── Shipping Threshold Progress Bar ─────────────────────────────────
// "You're $X away from free shipping!" with visual progress bar

async function updateShippingProgress() {
  try {
    const currentCart = await wixStoresFrontend.cart.getCurrentCart();
    if (!currentCart) return;

    const subtotal = currentCart.totals?.subtotal || 0;
    const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
    const progressPct = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);

    const progressBar = $w('#shippingProgressBar');
    const progressText = $w('#shippingProgressText');

    if (progressBar) {
      progressBar.value = progressPct;
    }

    if (progressText) {
      if (remaining > 0) {
        progressText.text = `You're $${remaining.toFixed(2)} away from free shipping!`;
      } else {
        progressText.text = 'You qualify for FREE shipping!';
        try {
          $w('#shippingProgressIcon').show();
        } catch (e) {}
      }
    }
  } catch (e) {}
}

// ── Tiered Discount Progress Bar ────────────────────────────────────
// "Spend $X more for Y% off!" with coral progress bar

async function updateTierProgress() {
  try {
    const currentCart = await wixStoresFrontend.cart.getCurrentCart();
    if (!currentCart) return;

    const subtotal = currentCart.totals?.subtotal || 0;
    const tier = TIER_THRESHOLDS.find(t => subtotal >= t.min && subtotal < t.max)
      || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];

    const progressBar = $w('#tierProgressBar');
    const progressText = $w('#tierProgressText');

    if (progressBar) {
      // Progress within current tier toward next threshold
      if (tier.max === Infinity) {
        progressBar.value = 100;
      } else {
        progressBar.value = Math.min((subtotal / tier.max) * 100, 100);
      }
    }

    if (progressText) {
      const remaining = tier.max === Infinity ? 0 : (tier.max - subtotal);
      progressText.text = tier.label(remaining.toFixed(2));
    }
  } catch (e) {}
}

// ── Recently Viewed Products ────────────────────────────────────────
// Horizontal scroll of products the user has viewed this session

async function loadRecentlyViewed() {
  try {
    const currentCart = await wixStoresFrontend.cart.getCurrentCart();
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
        try { $item('#cartRecentName').text = itemData.name; } catch (e) {}
        try { $item('#cartRecentPrice').text = itemData.price; } catch (e) {}

        const navigate = () => {
          import('wix-location').then(({ to }) => {
            to(`/product-page/${itemData.slug}`);
          });
        };
        try { $item('#cartRecentImage').onClick(navigate); } catch (e) {}
        try { $item('#cartRecentName').onClick(navigate); } catch (e) {}
      });
    }
  } catch (e) {}
}

// ── Intelligent Cross-Sell ("Complete Your Futon") ──────────────────
// Analyzes cart contents and suggests complementary products

async function loadCartSuggestions() {
  try {
    const currentCart = await wixStoresFrontend.cart.getCurrentCart();
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

    // Display first suggestion group
    const suggestion = suggestions[0];
    try {
      $w('#suggestionsHeading').text = suggestion.heading;
    } catch (e) {}

    const repeater = $w('#suggestionsRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#sugImage').src = itemData.mainMedia;
      $item('#sugImage').alt = `${itemData.name} - add to cart`;
      $item('#sugName').text = itemData.name;
      $item('#sugPrice').text = itemData.formattedPrice;

      // Quick add to cart button
      $item('#sugAddBtn').onClick(async () => {
        try {
          await wixStoresFrontend.cart.addProducts([{
            productId: itemData._id,
            quantity: 1,
          }]);
          $item('#sugAddBtn').label = 'Added!';
          $item('#sugAddBtn').disable();
          setTimeout(() => {
            updateShippingProgress();
            loadCartSuggestions();
          }, 1000);
        } catch (err) {
          console.error('Error adding suggestion to cart:', err);
        }
      });

      // Click image/name to view product
      const navigate = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#sugImage').onClick(navigate);
      $item('#sugName').onClick(navigate);
    });
    repeater.data = suggestion.products;
  } catch (err) {
    console.error('Error loading cart suggestions:', err);
  }
}

// ── Quantity Controls ───────────────────────────────────────────────
// +/- buttons for quantity adjustment

function initQuantityControls() {
  try {
    const cartRepeater = $w('#cartItemsRepeater');
    if (!cartRepeater) return;

    cartRepeater.onItemReady(($item, itemData) => {
      try {
        $item('#qtyMinus').onClick(async () => {
          const currentQty = parseInt($item('#qtyInput').value) || 1;
          if (currentQty > 1) {
            $item('#qtyInput').value = String(currentQty - 1);
            await refreshCartTotals();
          }
        });

        $item('#qtyPlus').onClick(async () => {
          const currentQty = parseInt($item('#qtyInput').value) || 1;
          $item('#qtyInput').value = String(currentQty + 1);
          await refreshCartTotals();
        });

        $item('#removeItem').onClick(async () => {
          await refreshCartTotals();
        });
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Cart Change Listeners ───────────────────────────────────────────

function initCartListeners() {
  wixStoresFrontend.onCartChanged(() => {
    updateShippingProgress();
    updateTierProgress();
    loadCartSuggestions();
    loadRecentlyViewed();
  });
}

async function refreshCartTotals() {
  try {
    const currentCart = await wixStoresFrontend.cart.getCurrentCart();
    if (currentCart && currentCart.totals) {
      const fmt = (n) => `$${Number(n).toFixed(2)}`;
      try { $w('#cartSubtotal').text = fmt(currentCart.totals.subtotal); } catch (e) {}
      try { $w('#cartShipping').text = currentCart.totals.shipping > 0 ? fmt(currentCart.totals.shipping) : 'Calculated at checkout'; } catch (e) {}
      try { $w('#cartTotal').text = fmt(currentCart.totals.total); } catch (e) {}
    }
    await updateShippingProgress();
  } catch (e) {}
}
