// cartDeliveryEstimate.js — Estimated delivery date display for Cart Page
// Shows "Estimated delivery: Mar 15 – Mar 22" based on standard shipping method.
// Updates on cart changes via updateCartDeliveryEstimate().

import { getDeliveryEstimate } from 'backend/checkoutOptimization.web';
import { announce } from 'public/a11yHelpers';

/**
 * Format a delivery estimate data object into a display label.
 * @param {Object|null} data - Estimate data with { label } from getDeliveryEstimate
 * @returns {string} Formatted label or fallback message
 */
export function formatDeliveryLabel(data) {
  if (!data || !data.label) return 'Delivery estimate unavailable';
  return `Estimated delivery: ${data.label}`;
}

/**
 * Fetch delivery estimate and render into cart UI elements.
 * Shared logic for init and update flows.
 * @param {Function} $w - Wix selector function
 * @param {Object|null} cart - Current cart object
 * @param {string} shippingMethod - Shipping method to estimate
 * @param {Object} options - { setAriaAttrs: boolean, announceUpdate: boolean }
 * @returns {Promise<void>}
 */
async function fetchAndRender($w, cart, shippingMethod, { setAriaAttrs = false, announceUpdate = false } = {}) {
  if (!cart || !cart.lineItems || cart.lineItems.length === 0) {
    try { $w('#cartDeliverySection').collapse(); } catch (e) {}
    return;
  }

  const result = await getDeliveryEstimate(shippingMethod);

  if (!result || !result.success) {
    try { $w('#cartDeliverySection').collapse(); } catch (e) {}
    try { $w('#cartDeliveryIcon').hide(); } catch (e) {}
    return;
  }

  const label = formatDeliveryLabel(result.data);

  try {
    $w('#cartDeliveryEstimate').text = label;
    $w('#cartDeliveryEstimate').accessibility.ariaLabel = label;
    if (setAriaAttrs) {
      $w('#cartDeliveryEstimate').accessibility.role = 'status';
      $w('#cartDeliveryEstimate').accessibility.ariaLive = 'polite';
    }
  } catch (e) {}

  try { $w('#cartDeliverySection').expand(); } catch (e) {}
  try { $w('#cartDeliveryIcon').show(); } catch (e) {}

  if (announceUpdate) {
    announce($w, label);
  }
}

/**
 * Initialize the delivery estimate section on the Cart Page.
 * Fetches estimate for standard shipping and populates UI elements.
 * @param {Function} $w - Wix selector function
 * @param {Object|null} cart - Current cart object
 * @param {string} [shippingMethod='standard'] - Shipping method to estimate
 */
export async function initCartDeliveryEstimate($w, cart, shippingMethod = 'standard') {
  try {
    await fetchAndRender($w, cart, shippingMethod, { setAriaAttrs: true });
  } catch (e) {
    console.error('Delivery estimate init failed:', e);
    try { $w('#cartDeliverySection').collapse(); } catch (e2) {}
    try { $w('#cartDeliveryIcon').hide(); } catch (e2) {}
  }
}

/**
 * Update the delivery estimate display (called on cart changes).
 * @param {Function} $w - Wix selector function
 * @param {Object|null} cart - Current cart object
 * @param {string} [shippingMethod='standard'] - Shipping method to estimate
 */
export async function updateCartDeliveryEstimate($w, cart, shippingMethod = 'standard') {
  try {
    await fetchAndRender($w, cart, shippingMethod, { announceUpdate: true });
  } catch (e) {
    console.error('Delivery estimate update failed:', e);
    try { $w('#cartDeliverySection').collapse(); } catch (e2) {}
    try { $w('#cartDeliveryIcon').hide(); } catch (e2) {}
  }
}
