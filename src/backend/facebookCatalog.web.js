/** @module facebookCatalog - Meta/Facebook Catalog and Conversions API (CAPI) backend.
 *
 * Provides server-side Conversions API event building for all standard Meta events
 * (ViewContent, AddToCart, InitiateCheckout, Purchase, Search, CompleteRegistration,
 * AddToWishlist, Lead), Dynamic Product Ad (DPA) retargeting parameters,
 * enhanced catalog feed fields (custom_label_0-4, product_type, additional images),
 * and customer audience export for Custom/Lookalike Audiences.
 *
 * Used by: metaPixel.js (client-side DPA params), http-functions.js (catalog feed),
 * and admin audience export endpoint.
 *
 * buildCapiEvent, buildProductSetParams, and getEnhancedCatalogFields are pure
 * functions (not webMethods). exportCustomerAudienceData uses Permissions.Admin.
 *
 * Dependencies: wix-web-module, wix-data, backend/utils/sanitize, backend/utils/mediaHelpers.
 */
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

// ── Feed Validation ─────────────────────────────────────────────────

/**
 * Meta API rate limits — requests per hour per access token.
 * These are informational for callers to implement backoff.
 */
const META_RATE_LIMITS = {
  catalogBatchApi: 4800,     // Batch API: 4800/hr
  conversionsApi: 100000,    // CAPI: ~100k events/hr
  audienceApi: 700,          // Custom Audiences: 700/hr
};

/**
 * Validate a product for Meta Commerce catalog feed requirements.
 * Returns { valid, errors, warnings } for the product.
 *
 * @param {Object} product - Wix product object
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateFeedProduct(product) {
  if (!product || typeof product !== 'object') {
    return { valid: false, errors: ['Product object is required'], warnings: [] };
  }

  const errors = [];
  const warnings = [];

  // Required: product ID
  if (!product._id) {
    errors.push('Missing product ID (_id)');
  }

  // Required: title (name)
  if (!product.name || !stripHtml(product.name).trim()) {
    errors.push('Missing or empty product title (name)');
  } else if (stripHtml(product.name).length > 200) {
    warnings.push('Product title exceeds 200 chars — may be truncated in ads');
  }

  // Required: price
  const price = Number(product.price);
  if (!price || price <= 0) {
    errors.push('Missing or invalid price — must be positive number');
  }

  // Required: image
  const imageUrl = getImageUrl(product.mainMedia || product.image || '');
  if (!imageUrl) {
    errors.push('Missing product image — required for catalog');
  } else if (!imageUrl.startsWith('https://')) {
    warnings.push('Image URL is not HTTPS — Meta requires HTTPS for catalog images');
  }

  // Required: availability
  if (product.inStock === undefined && product.inventoryStatus === undefined) {
    warnings.push('No explicit stock status — defaulting to in stock');
  }

  // Required: link (slug-based)
  if (!product.slug) {
    errors.push('Missing product slug — required for product link');
  }

  // Optional but recommended: description
  if (!product.description) {
    warnings.push('Missing description — reduces ad quality');
  }

  // Optional: brand detection
  const brand = detectBrand(product);
  if (brand === 'Night & Day Furniture' && !product.brand) {
    warnings.push('No explicit brand — using default');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Normalize a Wix media URL for Meta catalog feed.
 * Ensures HTTPS, proper dimensions for DPA ads (min 600x600 recommended).
 *
 * @param {string|Object} media - Wix media reference
 * @param {Object} [options]
 * @param {number} [options.width=1200] - Target width
 * @param {number} [options.height=1200] - Target height
 * @param {string} [options.format='jpg'] - Image format
 * @returns {string} Normalized HTTPS URL
 */
export function normalizeImageUrl(media, options = {}) {
  const baseUrl = getImageUrl(media);
  if (!baseUrl) return '';

  const { width = 1200, height = 1200, format = 'jpg' } = options;

  // Wix static URLs support resize via /v1/fill/ path segment
  if (baseUrl.includes('static.wixstatic.com/media/')) {
    const mediaId = baseUrl.split('/media/')[1]?.split(/[?#]/)[0];
    if (mediaId) {
      return `https://static.wixstatic.com/media/${mediaId}/v1/fill/w_${width},h_${height},al_c,q_85,enc_auto/${mediaId}.${format}`;
    }
  }

  return baseUrl;
}

/**
 * Process a batch of products for catalog feed with partial-failure recovery.
 * Validates each product, generates enhanced fields, continues on failure.
 *
 * @param {Array<Object>} products - Array of Wix product objects
 * @returns {Object} { success, processed, failed, results, errors }
 */
export function buildCatalogBatch(products) {
  if (!Array.isArray(products)) {
    return { success: false, processed: 0, failed: 0, results: [], errors: ['Input must be an array'] };
  }

  const results = [];
  const errors = [];
  let processed = 0;
  let failed = 0;

  for (const product of products) {
    try {
      const validation = validateFeedProduct(product);

      if (!validation.valid) {
        failed++;
        errors.push({
          productId: product?._id || 'unknown',
          productName: stripHtml(product?.name || ''),
          errors: validation.errors,
          warnings: validation.warnings,
        });
        continue;
      }

      const enhanced = getEnhancedCatalogFields(product);
      const imageUrl = normalizeImageUrl(product.mainMedia || product.image);

      results.push({
        id: product._id,
        title: stripHtml(product.name || ''),
        description: stripHtml(product.description || ''),
        availability: product.inStock !== false ? 'in stock' : 'out of stock',
        condition: 'new',
        price: `${(product.discountedPrice || product.price || 0).toFixed(2)} USD`,
        link: `https://www.carolinafutons.com/product-page/${sanitize(product.slug, 100)}`,
        image_link: imageUrl,
        brand: enhanced.custom_label_1 || 'Carolina Futons',
        ...enhanced,
        _warnings: validation.warnings,
      });
      processed++;
    } catch (err) {
      console.error('[facebookCatalog] buildCatalogBatch product error:', err);
      failed++;
      errors.push({
        productId: product?._id || 'unknown',
        productName: stripHtml(product?.name || ''),
        errors: [`Unexpected error: ${err.message}`],
      });
    }
  }

  return {
    success: products.length === 0 || failed < products.length,
    processed,
    failed,
    total: products.length,
    results,
    errors,
  };
}

/**
 * Get Meta API rate limit configuration.
 * @returns {Object} Rate limit info per API endpoint
 */
export function getMetaRateLimits() {
  return { ...META_RATE_LIMITS };
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
