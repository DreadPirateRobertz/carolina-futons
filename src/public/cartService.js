// cartService.js - Centralized Cart Operations
// Abstracts wix-stores-frontend cart API into a single module.
// When Wix migrates to wix-ecom-frontend, update only this file.
//
// Exports:
//   addToCart(productId, quantity, options)   - Add item to cart
//   getCurrentCart()                         - Get full cart object
//   getCartItemCount()                       - Get total item quantity
//   updateCartItemQuantity(cartItemId, qty)  - Update line item quantity
//   removeCartItem(cartItemId)               - Remove line item from cart
//   onCartChanged(callback)                  - Register cart change listener
//   getProductVariants(productId, choices)   - Get product variant pricing
//   FREE_SHIPPING_THRESHOLD                  - $999 threshold
//   TIER_THRESHOLDS                          - Tiered discount brackets

import wixStoresFrontend from 'wix-stores-frontend';

// ── Constants ────────────────────────────────────────────────────────
// Single source of truth — previously duplicated in Cart Page and Side Cart

export const FREE_SHIPPING_THRESHOLD = 999;

export const TIER_THRESHOLDS = [
  { min: 0, max: 500, discount: 5, label: pct => `Spend $${pct} more for 5% off your order` },
  { min: 500, max: 1000, discount: 10, label: pct => `Spend $${pct} more for 10% off your order` },
  { min: 1000, max: Infinity, discount: 10, label: () => 'You qualify for 10% off — applied at checkout!' },
];

// ── Cart Operations ──────────────────────────────────────────────────

/**
 * Add one or more products to the cart.
 * @param {string} productId - Wix product ID
 * @param {number} [quantity=1] - Quantity to add
 * @param {Object} [options] - Variant options (e.g., { variantId: '...' })
 * @returns {Promise<Object>} Cart response
 */
export async function addToCart(productId, quantity = 1, options = {}) {
  const item = { productId, quantity, ...options };
  return wixStoresFrontend.cart.addProducts([item]);
}

/**
 * Get the current cart with line items and totals.
 * @returns {Promise<Object|null>} Cart object or null
 */
export async function getCurrentCart() {
  return wixStoresFrontend.cart.getCurrentCart();
}

/**
 * Get total number of items in cart (sum of all quantities).
 * @returns {Promise<number>} Item count
 */
export async function getCartItemCount() {
  try {
    const cart = await getCurrentCart();
    if (!cart || !cart.lineItems) return 0;
    return cart.lineItems.reduce((sum, item) => sum + item.quantity, 0);
  } catch {
    return 0;
  }
}

/**
 * Register a callback for cart change events.
 * @param {Function} callback - Called whenever cart contents change
 */
export function onCartChanged(callback) {
  wixStoresFrontend.onCartChanged(callback);
}

/**
 * Update the quantity of a specific line item in the cart.
 * @param {string} cartItemId - The cart line item ID
 * @param {number} quantity - New quantity (must be >= 1)
 * @returns {Promise<Object>} Updated cart
 */
export async function updateCartItemQuantity(cartItemId, quantity) {
  return wixStoresFrontend.cart.updateLineItemQuantity(cartItemId, quantity);
}

/**
 * Remove a line item from the cart.
 * @param {string} cartItemId - The cart line item ID to remove
 * @returns {Promise<Object>} Updated cart
 */
export async function removeCartItem(cartItemId) {
  return wixStoresFrontend.cart.removeProduct(cartItemId);
}

// ── Product Variant Lookup ───────────────────────────────────────────

/**
 * Get variant pricing/availability for a product with given choices.
 * @param {string} productId - Wix product ID
 * @param {Object} choices - Selected variant choices (e.g., { Size: 'Queen' })
 * @returns {Promise<Array>} Variant data
 */
export async function getProductVariants(productId, choices) {
  return wixStoresFrontend.getProductVariants(productId, { choices });
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Calculate shipping progress toward free shipping threshold.
 * @param {number} subtotal - Current cart subtotal
 * @returns {{ remaining: number, progressPct: number, qualifies: boolean }}
 */
export function getShippingProgress(subtotal) {
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const progressPct = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  return { remaining, progressPct, qualifies: remaining <= 0 };
}

/**
 * Determine which tier discount applies for a given subtotal.
 * @param {number} subtotal - Current cart subtotal
 * @returns {{ tier: Object, remaining: number, progressPct: number }}
 */
export function getTierProgress(subtotal) {
  const tier = TIER_THRESHOLDS.find(t => subtotal >= t.min && subtotal < t.max)
    || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];

  const remaining = tier.max === Infinity ? 0 : (tier.max - subtotal);
  const progressPct = tier.max === Infinity
    ? 100
    : Math.min((subtotal / tier.max) * 100, 100);

  return { tier, remaining, progressPct };
}
