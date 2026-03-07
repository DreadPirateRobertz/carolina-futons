/** @module metaPixel - Client-side Meta Pixel (fbq) event helper.
 *
 * Fires Meta-standard events (ViewContent, AddToCart, InitiateCheckout, Purchase,
 * Search, CompleteRegistration, AddToWishlist, Lead) via wixWindow.trackEvent()
 * for Dynamic Product Ads (DPA) retargeting, custom audiences, and conversion
 * optimization. Also provides buildEnhancedMatchParams for advanced matching
 * (user data normalization per Meta's requirements).
 *
 * This module complements ga4Tracking.js with Meta-specific event parameters.
 * All event fires are non-critical and wrapped in try/catch to never break the page.
 *
 * Setup: Enable Meta Pixel in Wix Dashboard > Marketing Integrations.
 * The pixel ID is configured there — no hardcoded IDs in code.
 *
 * Dependencies: wix-window-frontend (lazy-loaded).
 */

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
 * Sanitize a string for safe use in pixel event parameters.
 * Strips HTML tags and trims whitespace.
 * @param {string} str
 * @returns {string}
 */
function sanitizeParam(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Build enhanced matching parameters for Meta Pixel advanced matching.
 * Normalizes user data per Meta's requirements (lowercase, trim, digits-only phone).
 * @param {Object} userData - User data object
 * @param {string} [userData.email] - Email address
 * @param {string} [userData.phone] - Phone number
 * @param {string} [userData.firstName] - First name
 * @param {string} [userData.lastName] - Last name
 * @param {string} [userData.city] - City
 * @param {string} [userData.state] - State/region
 * @param {string} [userData.zip] - Postal code
 * @returns {Object} Normalized params for fbq advanced matching
 */
export function buildEnhancedMatchParams(userData) {
  if (!userData || typeof userData !== 'object') return {};

  const params = {};

  if (userData.email && typeof userData.email === 'string') {
    const normalized = userData.email.toLowerCase().trim();
    if (normalized) params.em = normalized;
  }

  if (userData.phone && typeof userData.phone === 'string') {
    const digits = userData.phone.replace(/\D/g, '');
    if (digits) params.ph = digits;
  }

  if (userData.firstName && typeof userData.firstName === 'string') {
    const normalized = userData.firstName.toLowerCase().trim();
    if (normalized) params.fn = normalized;
  }

  if (userData.lastName && typeof userData.lastName === 'string') {
    const normalized = userData.lastName.toLowerCase().trim();
    if (normalized) params.ln = normalized;
  }

  if (userData.city && typeof userData.city === 'string') {
    const normalized = userData.city.toLowerCase().trim();
    if (normalized) params.ct = normalized;
  }

  if (userData.state && typeof userData.state === 'string') {
    const normalized = userData.state.toLowerCase().trim();
    if (normalized) params.st = normalized;
  }

  if (userData.zip && typeof userData.zip === 'string') {
    const normalized = userData.zip.trim();
    if (normalized) params.zp = normalized;
  }

  return params;
}

/**
 * Fire a Meta Pixel ViewContent event for product page views.
 * Includes DPA-specific params (content_ids, content_type, content_name).
 * @param {Object} product - Wix product object
 */
export async function fireMetaViewContent(product) {
  try {
    if (!product || typeof product !== 'object') return;
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;

    ww.trackEvent('ViewContent', {
      content_ids: [product._id || ''],
      content_type: (product.variants && product.variants.length > 1) ? 'product_group' : 'product',
      content_name: sanitizeParam(product.name),
      content_category: (product.collections || [])[0] || '',
      value: Math.max(0, product.discountedPrice || product.price || 0),
      currency: 'USD',
    });
  } catch (e) {
    // Meta pixel tracking is non-critical
  }
}

/**
 * Fire a Meta Pixel AddToCart event.
 * @param {Object} product - Wix product object
 * @param {number} [quantity=1] - Quantity added
 */
export async function fireMetaAddToCart(product, quantity = 1) {
  try {
    if (!product || typeof product !== 'object') return;
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;

    ww.trackEvent('AddToCart', {
      content_ids: [product._id || ''],
      content_type: (product.variants && product.variants.length > 1) ? 'product_group' : 'product',
      content_name: sanitizeParam(product.name),
      value: Math.max(0, product.discountedPrice || product.price || 0),
      currency: 'USD',
      num_items: Math.max(0, quantity || 1),
    });
  } catch (e) {}
}

/**
 * Fire a Meta Pixel InitiateCheckout event.
 * @param {Array} cartItems - Array of cart line items
 * @param {number} cartTotal - Cart subtotal
 */
export async function fireMetaInitiateCheckout(cartItems, cartTotal) {
  try {
    const items = Array.isArray(cartItems) ? cartItems : [];
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;

    const contentIds = items
      .map(item => item.productId || item._id || '')
      .filter(Boolean);

    ww.trackEvent('InitiateCheckout', {
      content_ids: contentIds,
      content_type: 'product',
      value: Math.max(0, cartTotal || 0),
      currency: 'USD',
      num_items: items.length,
    });
  } catch (e) {}
}

/**
 * Fire a Meta Pixel Purchase event.
 * @param {Object} order - Wix order object
 */
export async function fireMetaPurchase(order) {
  try {
    if (!order || typeof order !== 'object') return;
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;

    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    const contentIds = lineItems
      .map(item => item.productId || item._id || item.sku || '')
      .filter(Boolean);

    ww.trackEvent('Purchase', {
      content_ids: contentIds,
      content_type: 'product',
      value: Math.max(0, order.totals?.total || 0),
      currency: 'USD',
      num_items: lineItems.length,
      order_id: order._id || order.number || '',
    });
  } catch (e) {}
}

/**
 * Fire a Meta Pixel Search event.
 * @param {string} query - Search query string
 * @param {number} resultCount - Number of results
 */
export async function fireMetaSearch(query, resultCount) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;

    ww.trackEvent('Search', {
      search_string: sanitizeParam(query || ''),
      content_type: 'product',
      num_items: Math.max(0, resultCount || 0),
    });
  } catch (e) {}
}

/**
 * Fire a Meta Pixel CompleteRegistration event (newsletter, account signup).
 * @param {Object} [params={}] - Registration details
 * @param {string} [params.method] - Registration method (email, social, etc.)
 * @param {string} [params.content_name] - Registration context
 */
export async function fireMetaCompleteRegistration(params) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;

    const data = params && typeof params === 'object' ? params : {};
    ww.trackEvent('CompleteRegistration', {
      content_name: sanitizeParam(data.content_name || ''),
      status: true,
      method: sanitizeParam(data.method || ''),
    });
  } catch (e) {}
}

/**
 * Fire a Meta Pixel AddToWishlist event.
 * @param {Object} product - Wix product object
 */
export async function fireMetaAddToWishlist(product) {
  try {
    if (!product || typeof product !== 'object') return;
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;

    ww.trackEvent('AddToWishlist', {
      content_ids: [product._id || ''],
      content_name: sanitizeParam(product.name),
      content_category: (product.collections || [])[0] || '',
      value: Math.max(0, product.discountedPrice || product.price || 0),
      currency: 'USD',
    });
  } catch (e) {}
}

/**
 * Fire a Meta Pixel Lead event (consultation booking, quote request).
 * @param {Object} [params={}] - Lead details
 * @param {string} [params.content_name] - Lead context
 * @param {string} [params.content_category] - Lead category
 * @param {number} [params.value] - Lead value
 */
export async function fireMetaLead(params) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;

    const data = params && typeof params === 'object' ? params : {};
    ww.trackEvent('Lead', {
      content_name: sanitizeParam(data.content_name || ''),
      content_category: sanitizeParam(data.content_category || ''),
      value: Math.max(0, data.value || 0),
      currency: 'USD',
    });
  } catch (e) {}
}
