// ga4Tracking.js - GA4 & Meta Pixel Event Bridge
// Fires enhanced e-commerce events via wixWindow.trackEvent() which sends
// to both Google Analytics 4 and Facebook Pixel when enabled in Dashboard.
//
// Setup: Enable GA4 and/or Meta Pixel in Wix Dashboard > Marketing Integrations.
// No code changes needed — wixWindow.trackEvent() routes to all enabled platforms.

import {
  buildViewContentEvent,
  buildAddToCartEvent,
  buildCheckoutEvent,
  buildPurchaseEvent,
  buildWishlistEvent,
} from 'backend/analyticsHelpers.web';

let _wixWindow = null;

async function getWixWindow() {
  if (!_wixWindow) {
    try {
      _wixWindow = await import('wix-window-frontend');
    } catch (e) {
      _wixWindow = null;
    }
  }
  return _wixWindow;
}

/**
 * Fire a GA4/Meta Pixel ViewContent event for a product page view.
 * @param {Object} product - Wix product object
 */
export async function fireViewContent(product) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    const payload = await buildViewContentEvent(product);
    if (payload && Object.keys(payload).length > 0) {
      ww.trackEvent('ViewContent', payload);
    }
  } catch (e) {
    // GA4 tracking is non-critical
  }
}

/**
 * Fire a GA4/Meta Pixel AddToCart event.
 * @param {Object} product - Wix product object
 * @param {number} [quantity=1] - Quantity added
 */
export async function fireAddToCart(product, quantity = 1) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    const payload = await buildAddToCartEvent(product, quantity);
    if (payload && Object.keys(payload).length > 0) {
      ww.trackEvent('AddToCart', payload);
    }
  } catch (e) {}
}

/**
 * Fire a GA4/Meta Pixel InitiateCheckout event.
 * @param {Array} cartItems - Array of cart line items
 * @param {number} cartTotal - Cart subtotal
 */
export async function fireInitiateCheckout(cartItems, cartTotal) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    const payload = await buildCheckoutEvent(cartItems, cartTotal);
    if (payload && Object.keys(payload).length > 0) {
      ww.trackEvent('InitiateCheckout', payload);
    }
  } catch (e) {}
}

/**
 * Fire a GA4/Meta Pixel Purchase event.
 * @param {Object} order - Wix order object or order-like data
 */
export async function firePurchase(order) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    const payload = await buildPurchaseEvent(order);
    if (payload && Object.keys(payload).length > 0) {
      ww.trackEvent('Purchase', payload);
    }
  } catch (e) {}
}

/**
 * Fire a GA4/Meta Pixel AddToWishlist event.
 * @param {Object} product - Wix product object
 */
export async function fireAddToWishlist(product) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    const payload = await buildWishlistEvent(product);
    if (payload && Object.keys(payload).length > 0) {
      ww.trackEvent('AddToWishlist', payload);
    }
  } catch (e) {}
}

/**
 * Fire a custom GA4 event (for non-standard events like newsletter signup).
 * @param {string} eventName - Custom event name
 * @param {Object} [params={}] - Event parameters
 */
export async function fireCustomEvent(eventName, params = {}) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    ww.trackEvent('CustomEvent', {
      event: eventName,
      ...params,
    });
  } catch (e) {}
}
