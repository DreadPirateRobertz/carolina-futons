/** @module miniCartDrawer - Persistent mini-cart drawer, visible from any page.
 *
 * Shopify-style slide-in cart drawer mounted in masterPage so it is available
 * on every page without a navigation event. On desktop it slides in from the
 * right; on mobile it rises as a bottom sheet.
 *
 * Triggers: cart icon click (wired in masterPage via initCartIconForMiniCart)
 * and add-to-cart events (via openMiniCart called from initMiniCartAutoOpen).
 *
 * Required elements (masterPage editor — all must be Box type, NOT LightBox):
 *   #miniCartDrawer      Box — the drawer container
 *   #miniCartOverlay     Box — darkened backdrop
 *   #miniCartClose       Button — × close button
 *   #miniCartRepeater    Repeater — one slot per line item
 *   #miniCartSubtotal    Text — running subtotal
 *   #miniCartCheckoutBtn Button — 'Proceed to Checkout' CTA
 *   #miniCartViewBtn     Button — 'View Cart' link
 *   #miniCartEmpty       Box — empty-state message
 *   #cartItemCount       Text — item-count badge in header
 *
 *   Inside each repeater slot:
 *   #cartItemImage  Image
 *   #cartItemName   Text
 *   #cartItemPrice  Text  (price × qty)
 *   #cartItemQty    NumberInput
 *   #cartItemRemove Button
 *
 * Dependencies: public/cartService (getCurrentCart, updateCartItemQuantity,
 *   removeCartItem, safeMultiply, clampQuantity), public/a11yHelpers.js
 *   (announce, createFocusTrap), public/mobileHelpers (isMobile),
 *   wix-location-frontend.
 */

import { getCurrentCart, updateCartItemQuantity, removeCartItem, safeMultiply, clampQuantity } from 'public/cartService';
import { announce, createFocusTrap } from 'public/a11yHelpers.js';
import { isMobile } from 'public/mobileHelpers';
import wixLocationFrontend from 'wix-location-frontend';

// ── Internal State ───────────────────────────────────────────────────

// Cached $w reference so the onItemReady closure and async re-render helpers
// can reach the page scope after init.
let _$w = null;

// Active focus trap handle from createFocusTrap. Created on open, released
// on close. Null when the drawer is closed.
let _trap = null;

// Previously focused element, saved on open and restored on close.
let _savedFocus = null;

// Drawer open state — guards closeMiniCart against spurious Escape-key calls
// from masterPage when the cart is already closed (prevents stray announcements).
let _isOpen = false;

/**
 * Reset all internal state. Called in tests via clearAll() before each case.
 */
export function clearAll() {
  _$w = null;
  _trap = null;
  _savedFocus = null;
  _isOpen = false;
}

/**
 * Returns true if the mini-cart drawer is currently open.
 * Exported for external consumers (e.g. conditional UI updates).
 * Note: closeMiniCart already guards internally via _isOpen.
 *
 * @returns {boolean}
 */
export function isMiniCartOpen() {
  return _isOpen;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Wire up the mini-cart drawer. Call once from masterPage $w.onReady.
 * Sets ARIA attributes, hides drawer/overlay, registers all click handlers,
 * and registers the repeater's onItemReady handler exactly once.
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
      closeMiniCart($w);
      try { wixLocationFrontend.to('/checkout'); } catch (e) {}
    });
  } catch (e) {}

  // View Cart button
  try {
    $w('#miniCartViewBtn').onClick(() => {
      closeMiniCart($w);
      try { wixLocationFrontend.to('/cart'); } catch (e) {}
    });
  } catch (e) {}

  // Register onItemReady ONCE here so re-renders never stack duplicate handlers.
  // The handler always binds to the itemData provided by the repeater at render time.
  try {
    $w('#miniCartRepeater').onItemReady(($item, itemData) => {
      _bindRepeaterItem($item, itemData);
    });
  } catch (e) {}

}

/**
 * Open the mini-cart drawer and populate it from a cart object.
 *
 * @param {Function} $w - Wix $w page selector
 * @param {Object} [cart] - Cart object with lineItems array; null/undefined treated as empty
 */
export function openMiniCart($w, cart) {
  _$w = $w;
  const lineItems = cart?.lineItems || [];

  // Populate content before showing
  renderCartItems($w, lineItems);
  _updateSubtotal($w, lineItems);

  const totalQty = lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  updateCartCount($w, totalQty);

  // Show with animation — desktop slides from right; mobile rises from bottom
  const mobile = isMobile();
  const openOpts = mobile
    ? { direction: 'bottom', duration: 300 }
    : { direction: 'right', duration: 300 };

  try { $w('#miniCartDrawer').show('slide', openOpts); } catch (e) {}
  try { $w('#miniCartOverlay').show(); } catch (e) {}

  announce($w, `Cart opened with ${totalQty} item${totalQty !== 1 ? 's' : ''}`);

  // WCAG 2.1 AA focus management: save active element, create Tab-cycle trap, focus close btn.
  // Release any prior trap before creating a new one (handles rapid re-open).
  _releaseTrap();
  _savedFocus = (typeof document !== 'undefined') ? document.activeElement : null;
  try {
    _trap = createFocusTrap($w, '#miniCartDrawer', ['#miniCartClose', '#miniCartCheckoutBtn', '#miniCartViewBtn']);
  } catch (e) {
    console.error('[miniCartDrawer] focus trap create failed:', e?.message);
  }
  // Focus the close button (first focusable element in the drawer).
  try { $w('#miniCartClose').focus(); } catch (e) {}
  _isOpen = true;
}

/**
 * Close the mini-cart drawer.
 *
 * @param {Function} $w - Wix $w page selector
 */
export function closeMiniCart($w) {
  if (!_isOpen) return; // Guard: no-op when drawer is already closed (prevents spurious announcements)
  _$w = $w;
  _isOpen = false;
  const mobile = isMobile();
  const closeOpts = mobile
    ? { direction: 'bottom', duration: 250 }
    : { direction: 'right', duration: 250 };

  try { $w('#miniCartDrawer').hide('slide', closeOpts); } catch (e) {}
  try { $w('#miniCartOverlay').hide(); } catch (e) {}

  announce($w, 'Cart closed');

  // WCAG 2.1 AA: release Tab-cycle trap and restore focus to the element that triggered open.
  _releaseTrap();
  if (_savedFocus) {
    try { _savedFocus.focus(); } catch (e) {
      console.warn('[miniCartDrawer] focus restore failed:', e?.message);
    }
    _savedFocus = null;
  }
}

/**
 * Populate the repeater from a line items array.
 * Shows empty state when array is empty; shows repeater + CTA buttons otherwise.
 * Safe to call repeatedly — does NOT re-register onItemReady (registered once in init).
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

  // Build repeater data — each entry needs a unique _id for Wix to track slots
  const repeaterData = lineItems.map(item => ({ ...item, _id: item._id || item.cartItemId }));

  try {
    $w('#miniCartRepeater').data = repeaterData;
  } catch (e) {
    console.error('[miniCartDrawer] failed to set repeater data:', e?.message);
  }
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
 * Release the active focus trap (if any) and null it out.
 * @private
 */
function _releaseTrap() {
  if (!_trap) return;
  try { _trap.release(); } catch (e) {
    console.error('[miniCartDrawer] focus trap release failed:', e?.message);
  }
  _trap = null;
}

/**
 * Re-fetch the cart and refresh all drawer state (repeater, subtotal, count).
 * Shared by qty-change and remove handlers to avoid duplication.
 * @private
 */
async function _refreshDrawer() {
  if (!_$w) return;
  try {
    const updatedCart = await getCurrentCart();
    const items = updatedCart?.lineItems || [];
    renderCartItems(_$w, items);
    _updateSubtotal(_$w, items);
    const total = items.reduce((s, i) => s + (i.quantity || 0), 0);
    updateCartCount(_$w, total);
  } catch (err) {
    console.error('[miniCartDrawer] drawer refresh failed:', err?.message);
  }
}

/**
 * Bind a single repeater item's child elements.
 * Called by the onItemReady handler registered once in initMiniCartDrawer.
 *
 * @param {Function} $item - Wix scoped selector for the repeater slot
 * @param {Object} itemData - Line item data: { _id, quantity, product, priceData }
 *   product: { name: string, mediaItems: Array<{ src: string }> }
 *   priceData: { price: number }
 * @private
 */
function _bindRepeaterItem($item, itemData) {
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

  // Price (line total: price × qty)
  try { $item('#cartItemPrice').text = `$${lineTotal.toFixed(2)}`; } catch (e) {}

  // Qty input
  try { $item('#cartItemQty').value = quantity; } catch (e) {}

  // Qty change → update cart, then refresh drawer
  try {
    $item('#cartItemQty').onChange(async (event) => {
      const newQty = clampQuantity(event.target?.value ?? $item('#cartItemQty').value);
      if (newQty === quantity) return;
      try {
        await updateCartItemQuantity(_id, newQty);
        await _refreshDrawer();
      } catch (err) {
        console.error('[miniCartDrawer] qty update failed:', err?.message);
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
        if (_$w) announce(_$w, `${name} removed from cart`);
        await _refreshDrawer();
      } catch (err) {
        console.error('[miniCartDrawer] remove failed:', err?.message);
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
