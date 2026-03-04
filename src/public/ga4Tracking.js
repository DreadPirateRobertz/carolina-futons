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
  buildViewItemListEvent,
  buildSearchEvent,
  buildViewCartEvent,
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
    if (!eventName || typeof eventName !== 'string') return;
    // Sanitize event name: only alphanumeric and underscores
    const sanitized = eventName.replace(/[^a-zA-Z0-9_]/g, '');
    if (!sanitized) return;

    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    ww.trackEvent('CustomEvent', {
      event: sanitized,
      ...params,
    });
  } catch (e) {}
}

/**
 * Fire a GA4 view_item_list event for category/collection page impressions.
 * @param {Array} items - Array of product objects in the list
 * @param {string} listName - Category or list name
 */
export async function fireViewItemList(items, listName) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    const payload = await buildViewItemListEvent(items, listName);
    if (payload && payload.items) {
      ww.trackEvent('CustomEvent', {
        event: 'view_item_list',
        ...payload,
      });
    }
  } catch (e) {}
}

/**
 * Fire a GA4 search event when a user performs a search.
 * @param {string} query - Search query string
 * @param {number} resultCount - Number of results
 */
export async function fireSearch(query, resultCount) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    const payload = await buildSearchEvent(query, resultCount);
    if (payload) {
      ww.trackEvent('CustomEvent', {
        event: 'search',
        ...payload,
      });
    }
  } catch (e) {}
}

/**
 * Fire a GA4 view_cart event for cart funnel tracking.
 * @param {Array} cartItems - Array of cart line items
 * @param {number} cartTotal - Cart subtotal
 */
export async function fireViewCart(cartItems, cartTotal) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    const payload = await buildViewCartEvent(cartItems, cartTotal);
    if (payload) {
      ww.trackEvent('CustomEvent', {
        event: 'view_cart',
        ...payload,
      });
    }
  } catch (e) {}
}

/**
 * Initialize scroll depth tracking. Fires GA4 events at 25%, 50%, 75%, 100%.
 * @returns {Function} Cleanup function to remove the scroll listener
 */
export function initScrollDepthTracking() {
  const thresholds = [25, 50, 75, 100];
  const fired = new Set();

  function handleScroll() {
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight <= 0) return;

      const pct = Math.round((scrollTop / docHeight) * 100);

      for (const threshold of thresholds) {
        if (pct >= threshold && !fired.has(threshold)) {
          fired.add(threshold);
          getWixWindow().then(ww => {
            if (ww?.trackEvent) {
              ww.trackEvent('CustomEvent', {
                event: 'scroll_depth',
                percent_scrolled: threshold,
                page: (typeof window !== 'undefined' && window.location?.pathname) || '/',
              });
            }
          }).catch(() => {});
        }
      }
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    try {
      window.addEventListener('scroll', handleScroll, { passive: true });
    } catch (e) {}
  }

  return function cleanup() {
    if (typeof window !== 'undefined') {
      try {
        window.removeEventListener('scroll', handleScroll);
      } catch (e) {}
    }
  };
}
