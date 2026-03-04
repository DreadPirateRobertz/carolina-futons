// facebookCatalog.web.js - Meta/Facebook Catalog & CAPI Backend
// Provides server-side Conversions API event building, product set params
// for DPA retargeting, enhanced catalog fields, and customer audience export.
//
// Used by:
// - metaPixel.js (client-side) for DPA retargeting params
// - http-functions.js for enhanced catalog feed columns
// - Custom audience export endpoint

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { getImageUrl } from 'backend/utils/mediaHelpers';

// ── Constants ───────────────────────────────────────────────────────

const VALID_EVENTS = new Set([
  'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase',
  'Search', 'CompleteRegistration', 'AddToWishlist', 'Lead',
]);

// ── Internal Helpers ────────────────────────────────────────────────

/**
 * Normalize user data for Meta Pixel advanced matching / CAPI user_data.
 * @param {Object} userData
 * @returns {Object} Normalized user_data object
 */
function normalizeUserData(userData) {
  if (!userData || typeof userData !== 'object') return {};

  const result = {};

  if (userData.email && typeof userData.email === 'string') {
    const v = userData.email.toLowerCase().trim();
    if (v) result.em = v;
  }
  if (userData.phone && typeof userData.phone === 'string') {
    const v = userData.phone.replace(/\D/g, '');
    if (v) result.ph = v;
  }
  if (userData.firstName && typeof userData.firstName === 'string') {
    const v = userData.firstName.toLowerCase().trim();
    if (v) result.fn = v;
  }
  if (userData.lastName && typeof userData.lastName === 'string') {
    const v = userData.lastName.toLowerCase().trim();
    if (v) result.ln = v;
  }
  if (userData.city && typeof userData.city === 'string') {
    const v = userData.city.toLowerCase().trim();
    if (v) result.ct = v;
  }
  if (userData.state && typeof userData.state === 'string') {
    const v = userData.state.toLowerCase().trim();
    if (v) result.st = v;
  }
  if (userData.zip && typeof userData.zip === 'string') {
    const v = userData.zip.trim();
    if (v) result.zp = v;
  }

  return result;
}

/**
 * Strip HTML tags from a string.
 * @param {string} str
 * @returns {string}
 */
function stripHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Detect brand from product data.
 * @param {Object} product
 * @returns {string}
 */
function detectBrand(product) {
  if (!product) return 'Night & Day Furniture';
  if (product.brand) return product.brand;

  const name = (product.name || '').toLowerCase();
  const collections = (product.collections || []).map(c =>
    (typeof c === 'string' ? c : c.id || '').toLowerCase()
  );

  if (collections.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (collections.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (collections.some(c => c.includes('mattress'))) return 'Otis Bed';
  if (name.includes('murphy') || name.includes('cabinet bed')) return 'Arason Enterprises';
  return 'Night & Day Furniture';
}

/**
 * Detect product type from collections.
 * @param {Object} product
 * @returns {string}
 */
function detectProductType(product) {
  if (!product) return 'Bedroom > Futon Frames';
  const collections = (product.collections || []).map(c =>
    (typeof c === 'string' ? c : c.id || '').toLowerCase()
  );

  if (collections.some(c => c.includes('murphy'))) return 'Bedroom > Murphy Cabinet Beds';
  if (collections.some(c => c.includes('mattress'))) return 'Bedroom > Futon Mattresses';
  if (collections.some(c => c.includes('platform'))) return 'Bedroom > Platform Beds';
  if (collections.some(c => c.includes('casegood'))) return 'Bedroom > Casegoods & Accessories';
  return 'Bedroom > Futon Frames';
}

/**
 * Get price bucket label for DPA custom_label_0.
 * @param {number} price
 * @returns {string}
 */
function getPriceBucket(price) {
  const p = Number(price) || 0;
  if (p < 200) return 'under-200';
  if (p <= 500) return '200-500';
  if (p <= 1000) return '500-1000';
  return 'over-1000';
}

// ── Exported Functions ──────────────────────────────────────────────

/**
 * Build a Meta Conversions API (CAPI) event payload.
 * Returns a structured event object ready to send to Meta's Graph API.
 * @param {string} eventName - Meta standard event name
 * @param {Object} data - Event-specific data
 * @param {Object} [data.product] - Product object (ViewContent, AddToCart, AddToWishlist)
 * @param {Object} [data.order] - Order object (Purchase)
 * @param {Array} [data.cartItems] - Cart items (InitiateCheckout)
 * @param {number} [data.cartTotal] - Cart total (InitiateCheckout)
 * @param {number} [data.quantity] - Quantity (AddToCart)
 * @param {string} [data.query] - Search query (Search)
 * @param {number} [data.resultCount] - Search result count (Search)
 * @param {string} [data.url] - Page URL
 * @param {Object} [data.userInfo] - User data for advanced matching
 * @returns {Object|null} CAPI event payload or null if invalid
 */
export function buildCapiEvent(eventName, data) {
  if (!eventName || typeof eventName !== 'string' || !VALID_EVENTS.has(eventName)) {
    return null;
  }

  const eventData = data || {};
  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: eventData.url || '',
    user_data: normalizeUserData(eventData.userInfo),
    custom_data: {},
  };

  switch (eventName) {
    case 'ViewContent': {
      const product = eventData.product;
      if (!product) return null;
      event.custom_data = {
        content_ids: [product._id || ''],
        content_type: (product.variants && product.variants.length > 1) ? 'product_group' : 'product',
        content_name: stripHtml(product.name || ''),
        content_category: (product.collections || [])[0] || '',
        value: Math.max(0, product.discountedPrice || product.price || 0),
        currency: 'USD',
      };
      break;
    }

    case 'AddToCart': {
      const product = eventData.product;
      if (!product) return null;
      event.custom_data = {
        content_ids: [product._id || ''],
        content_type: (product.variants && product.variants.length > 1) ? 'product_group' : 'product',
        content_name: stripHtml(product.name || ''),
        value: Math.max(0, product.discountedPrice || product.price || 0),
        currency: 'USD',
        num_items: Math.max(1, eventData.quantity || 1),
      };
      break;
    }

    case 'InitiateCheckout': {
      const items = Array.isArray(eventData.cartItems) ? eventData.cartItems : [];
      event.custom_data = {
        content_ids: items.map(i => i.productId || i._id || '').filter(Boolean),
        content_type: 'product',
        value: Math.max(0, eventData.cartTotal || 0),
        currency: 'USD',
        num_items: items.length,
      };
      break;
    }

    case 'Purchase': {
      const order = eventData.order;
      if (!order) return null;
      const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];

      // Extract user data from order if not provided
      if (Object.keys(event.user_data).length === 0) {
        event.user_data = normalizeUserData({
          email: order.buyerInfo?.email,
          firstName: order.billingInfo?.firstName,
          lastName: order.billingInfo?.lastName,
          phone: order.billingInfo?.phone,
        });
      }

      event.custom_data = {
        content_ids: lineItems.map(i => i.productId || i.sku || i._id || '').filter(Boolean),
        content_type: 'product',
        value: Math.max(0, order.totals?.total || 0),
        currency: 'USD',
        num_items: lineItems.length,
        order_id: order._id || order.number || '',
      };
      break;
    }

    case 'Search': {
      event.custom_data = {
        search_string: stripHtml(eventData.query || ''),
        content_type: 'product',
      };
      break;
    }

    case 'CompleteRegistration': {
      event.custom_data = {
        content_name: stripHtml(eventData.contentName || ''),
        status: true,
      };
      break;
    }

    case 'AddToWishlist': {
      const product = eventData.product;
      if (!product) return null;
      event.custom_data = {
        content_ids: [product._id || ''],
        content_name: stripHtml(product.name || ''),
        value: Math.max(0, product.discountedPrice || product.price || 0),
        currency: 'USD',
      };
      break;
    }

    case 'Lead': {
      event.custom_data = {
        content_name: stripHtml(eventData.contentName || ''),
        content_category: stripHtml(eventData.contentCategory || ''),
        value: Math.max(0, eventData.value || 0),
        currency: 'USD',
      };
      break;
    }
  }

  return event;
}

/**
 * Build product set parameters for DPA retargeting pixel events.
 * Returns content_ids and content_type for dynamic ad matching.
 * @param {Object} product - Wix product object
 * @param {string} eventName - Event name for context
 * @returns {Object|null} Product set params or null if invalid
 */
export function buildProductSetParams(product, eventName) {
  if (!product || typeof product !== 'object' || !product._id) return null;

  return {
    content_ids: [product._id],
    content_type: (product.variants && product.variants.length > 1) ? 'product_group' : 'product',
  };
}

/**
 * Get enhanced catalog fields for Facebook DPA feed.
 * Returns additional columns beyond the basic catalog: custom_label_0-4,
 * product_type, color, material, additional_image_link.
 * @param {Object} product - Wix product object
 * @returns {Object} Enhanced field values keyed by column name
 */
export function getEnhancedCatalogFields(product) {
  if (!product || typeof product !== 'object') return {};

  const price = product.discountedPrice || product.price || 0;
  const brand = detectBrand(product);
  const collections = (product.collections || []).map(c =>
    (typeof c === 'string' ? c : c.id || '').toLowerCase()
  );

  const fields = {
    product_type: detectProductType(product),
    color: (product.color || product.options?.color || '').toLowerCase(),
    material: (product.material || '').toLowerCase(),
    // custom_label_0: price bucket for bid segmentation
    custom_label_0: getPriceBucket(price),
    // custom_label_1: brand for brand-specific campaigns
    custom_label_1: brand,
    // custom_label_2: primary collection/category
    custom_label_2: collections[0] || 'uncategorized',
    // custom_label_3: sale status for promotional targeting
    custom_label_3: product.discountedPrice ? 'on-sale' : 'full-price',
    // custom_label_4: stock status for availability filtering
    custom_label_4: product.inStock !== false ? 'in-stock' : 'out-of-stock',
  };

  // Additional images (up to 10 per Meta spec)
  const mediaItems = Array.isArray(product.mediaItems) ? product.mediaItems : [];
  if (mediaItems.length > 0) {
    const urls = mediaItems
      .slice(0, 10)
      .map(m => getImageUrl(m.src || m))
      .filter(Boolean);
    if (urls.length > 0) {
      fields.additional_image_link = urls.join(',');
    }
  }

  return fields;
}

/**
 * Export customer audience data for Meta Custom Audiences / Lookalike Audiences.
 * Queries orders and aggregates customer data (deduplicated by email).
 * Returns normalized fields per Meta's audience upload format.
 * @returns {Promise<Object>} { success, customers: Array }
 */
export const exportCustomerAudienceData = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const PAGE_SIZE = 1000;
      let allOrders = [];
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await wixData.query('Stores/Orders')
          .limit(PAGE_SIZE)
          .skip(skip)
          .find();
        allOrders = allOrders.concat(result.items);
        skip += PAGE_SIZE;
        hasMore = result.items.length === PAGE_SIZE;
      }

      // Deduplicate and aggregate by email
      const customerMap = new Map();

      for (const order of allOrders) {
        const email = order.buyerInfo?.email;
        if (!email || typeof email !== 'string') continue;

        const normalizedEmail = email.toLowerCase().trim();
        if (!normalizedEmail) continue;

        const existing = customerMap.get(normalizedEmail);
        const orderValue = Math.max(0, order.totals?.total || 0);

        if (existing) {
          existing.value += orderValue;
        } else {
          const billing = order.billingInfo || {};
          const address = order.shippingInfo?.shipmentDetails?.address || {};

          customerMap.set(normalizedEmail, {
            email: normalizedEmail,
            fn: (billing.firstName || '').toLowerCase().trim() || '',
            ln: (billing.lastName || '').toLowerCase().trim() || '',
            phone: (billing.phone || '').replace(/\D/g, ''),
            ct: (address.city || '').toLowerCase().trim() || '',
            st: (address.subdivision || '').toLowerCase().trim() || '',
            zip: (address.postalCode || '').trim() || '',
            country: (address.country || 'US').toUpperCase(),
            value: orderValue,
          });
        }
      }

      return {
        success: true,
        customers: Array.from(customerMap.values()),
      };
    } catch (err) {
      console.error('exportCustomerAudienceData error:', err);
      return { success: false, customers: [], error: 'Failed to export audience data' };
    }
  }
);
