/** @module miniCartDrawer - Persistent mini-cart drawer, visible from any page.
 *
 * Shopify-style slide-in cart drawer mounted in masterPage so it is available
 * on every page without a navigation event. On desktop it slides in from the
 * right; on mobile it rises as a bottom sheet.
 *
 * Triggers: cart icon click (wired in masterPage) and add-to-cart events
 * (via the exported openMiniCart function called from initSideCartAutoOpen).
 *
 * Required elements (masterPage editor):
 *   #miniCartDrawer   Box/LightBox — the drawer container
 *   #miniCartOverlay  Box — darkened backdrop
 *   #miniCartClose    Button — × close button
 *   #miniCartRepeater Repeater — one slot per line item
 *   #miniCartSubtotal Text — running subtotal
 *   #miniCartCheckoutBtn Button — 'Proceed to Checkout' CTA
 *   #miniCartViewBtn  Button — 'View Cart' link
 *   #miniCartEmpty    Box — empty-state message
 *   #cartItemCount    Text — item-count badge in header
 *
 *   Inside each repeater slot:
 *   #cartItemImage  Image
 *   #cartItemName   Text
 *   #cartItemPrice  Text  (price × qty)
 *   #cartItemQty    NumberInput
 *   #cartItemRemove Button
 *
 * Dependencies: public/cartService, public/a11yHelpers.js, public/mobileHelpers,
 *               wix-location-frontend.
 */

import { getCurrentCart, updateCartItemQuantity, removeCartItem, safeMultiply, clampQuantity } from 'public/cartService';
import { announce } from 'public/a11yHelpers.js';
import { isMobile } from 'public/mobileHelpers';
import wixLocationFrontend from 'wix-location-frontend';

// ── Internal State ───────────────────────────────────────────────────

// Cached $w reference so re-render helpers can reach the page scope
let _$w = null;

/**
 * Reset all internal state. Called in tests via clearAll() before each case.
 */
export function clearAll() {
  _$w = null;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Wire up the mini-cart drawer. Call once from masterPage $w.onReady.
 * Sets ARIA attributes, hides drawer/overlay, and registers click handlers.
 *
 * @param {Function} $w - Wix $w page selector
 */
export function initMiniCartDrawer($w) {
  _$w = $w;

  // Initial state: hidden
  try { $w('#miniCartDrawer').hide(); } catch (e) {}
  try { $w('#miniCartOverlay').hide(); } catch (e) {}

  // ARIA
  try {
    const drawer = $w('#miniCartDrawer');
    drawer.accessibility.role = 'dialog';
    drawer.accessibility.ariaModal = true;
    drawer.accessibility.ariaLabel = 'Shopping cart';
  } catch (e) {}

  try {
    $w('#miniCartSubtotal').accessibility.ariaLive = 'polite';
  } catch (e) {}

  // Close button
  try {
    const closeBtn = $w('#miniCartClose');
    closeBtn.accessibility.ariaLabel = 'Close cart';
    closeBtn.onClick(() => closeMiniCart($w));
  } catch (e) {}

  // Overlay click closes drawer
  try {
    $w('#miniCartOverlay').onClick(() => closeMiniCart($w));
  } catch (e) {}

  // Checkout button
  try {
    const checkoutBtn = $w('#miniCartCheckoutBtn');
    checkoutBtn.accessibility.ariaLabel = 'Proceed to checkout';
    checkoutBtn.onClick(() => {
      try { wixLocationFrontend.to('/checkout'); } catch (e) {}
    });
  } catch (e) {}

  // View Cart button
  try {
    $w('#miniCartViewBtn').onClick(() => {
      try { wixLocationFrontend.to('/cart'); } catch (e) {}
    });
  } catch (e) {}
}

/**
 * Open the mini-cart drawer and populate it from a cart object.
 *
 * @param {Function} $w - Wix $w page selector
 * @param {Object} cart - Cart object with lineItems array
 */
export function openMiniCart($w, cart) {
  _$w = $w;
  const lineItems = cart?.lineItems || [];

  // Populate content before showing
  renderCartItems($w, lineItems);
  _updateSubtotal($w, lineItems);

  const totalQty = lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  updateCartCount($w, totalQty);

  // Show with animation
  const mobile = isMobile();
  const openOpts = mobile
    ? { direction: 'bottom', duration: 300 }
    : { direction: 'right', duration: 300 };

  try { $w('#miniCartDrawer').show('slide', openOpts); } catch (e) {}
  try { $w('#miniCartOverlay').show(); } catch (e) {}

  // Accessibility
  announce($w, `Cart opened with ${totalQty} item${totalQty !== 1 ? 's' : ''}`);
  try { $w('#miniCartClose').focus(); } catch (e) {}
}

/**
 * Close the mini-cart drawer.
 *
 * @param {Function} $w - Wix $w page selector
 */
export function closeMiniCart($w) {
  _$w = $w;
  const mobile = isMobile();
  const closeOpts = mobile
    ? { direction: 'bottom', duration: 250 }
    : { direction: 'right', duration: 250 };

  try { $w('#miniCartDrawer').hide('slide', closeOpts); } catch (e) {}
  try { $w('#miniCartOverlay').hide(); } catch (e) {}

  announce($w, 'Cart closed');
}

/**
 * Populate the repeater from a line items array.
 * Shows empty state when array is empty; shows repeater + CTA buttons otherwise.
 *
 * @param {Function} $w - Wix $w page selector
 * @param {Array} lineItems - Cart line items
 */
export function renderCartItems($w, lineItems) {
  _$w = $w;
  const hasItems = Array.isArray(lineItems) && lineItems.length > 0;

  if (!hasItems) {
    try { $w('#miniCartRepeater').hide(); } catch (e) {}
    try { $w('#miniCartEmpty').show(); } catch (e) {}
    try { $w('#miniCartCheckoutBtn').hide(); } catch (e) {}
    try { $w('#miniCartViewBtn').hide(); } catch (e) {}
    return;
  }

  try { $w('#miniCartEmpty').hide(); } catch (e) {}
  try { $w('#miniCartRepeater').show(); } catch (e) {}
  try { $w('#miniCartCheckoutBtn').show(); } catch (e) {}
  try { $w('#miniCartViewBtn').show(); } catch (e) {}

  // Build repeater data (each item needs a unique _id for Wix)
  const repeaterData = lineItems.map(item => ({ ...item, _id: item._id || item.cartItemId }));

  try {
    $w('#miniCartRepeater').onItemReady(($item, itemData) => {
      _bindRepeaterItem($w, $item, itemData);
    });
    $w('#miniCartRepeater').data = repeaterData;
  } catch (e) {}
}

/**
 * Update the cart count badge in the header.
 *
 * @param {Function} $w - Wix $w page selector
 * @param {number} count - Total item quantity
 */
export function updateCartCount($w, count) {
  try {
    const badge = $w('#cartItemCount');
    badge.text = String(count);
    if (count > 0) {
      badge.show();
    } else {
      badge.hide();
    }
  } catch (e) {}
}

// ── Internal Helpers ─────────────────────────────────────────────────

/**
 * Bind a single repeater item's child elements.
 * @private
 */
function _bindRepeaterItem($w, $item, itemData) {
  const { _id, quantity, product, priceData } = itemData;
  const name = product?.name || '';
  const imgSrc = product?.mediaItems?.[0]?.src || '';
  const price = priceData?.price ?? 0;
  const lineTotal = safeMultiply(price, quantity);

  // Image
  try {
    $item('#cartItemImage').src = imgSrc;
    $item('#cartItemImage').alt = name;
  } catch (e) {}

  // Name
  try { $item('#cartItemName').text = name; } catch (e) {}

  // Price (line total)
  try { $item('#cartItemPrice').text = `$${lineTotal.toFixed(2)}`; } catch (e) {}

  // Qty input
  try { $item('#cartItemQty').value = quantity; } catch (e) {}

  // Qty change → update cart
  try {
    $item('#cartItemQty').onChange(async (event) => {
      const newQty = clampQuantity(event.target?.value ?? $item('#cartItemQty').value);
      if (newQty === quantity) return;
      try {
        await updateCartItemQuantity(_id, newQty);
        const updatedCart = await getCurrentCart();
        if (_$w) {
          renderCartItems(_$w, updatedCart?.lineItems || []);
          _updateSubtotal(_$w, updatedCart?.lineItems || []);
          const newTotal = (updatedCart?.lineItems || []).reduce((s, i) => s + (i.quantity || 0), 0);
          updateCartCount(_$w, newTotal);
        }
      } catch (err) {
        console.error('[miniCartDrawer] qty update failed:', err.message);
      }
    });
  } catch (e) {}

  // Remove button
  try {
    const removeBtn = $item('#cartItemRemove');
    removeBtn.accessibility.ariaLabel = `Remove ${name} from cart`;
    removeBtn.onClick(async () => {
      try {
        await removeCartItem(_id);
        announce($w, `${name} removed from cart`);
        const updatedCart = await getCurrentCart();
        if (_$w) {
          renderCartItems(_$w, updatedCart?.lineItems || []);
          _updateSubtotal(_$w, updatedCart?.lineItems || []);
          const newTotal = (updatedCart?.lineItems || []).reduce((s, i) => s + (i.quantity || 0), 0);
          updateCartCount(_$w, newTotal);
        }
      } catch (err) {
        console.error('[miniCartDrawer] remove failed:', err.message);
      }
    });
  } catch (e) {}
}

/**
 * Compute and render the subtotal from line items.
 * @private
 */
function _updateSubtotal($w, lineItems) {
  const subtotal = (lineItems || []).reduce((sum, item) => {
    const price = item.priceData?.price ?? 0;
    return sum + safeMultiply(price, item.quantity || 0);
  }, 0);

  try {
    $w('#miniCartSubtotal').text = `$${subtotal.toFixed(2)}`;
  } catch (e) {}
}
