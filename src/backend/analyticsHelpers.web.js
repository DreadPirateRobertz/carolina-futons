/**
 * @module analyticsHelpers
 * @description Backend web module for product analytics and engagement tracking.
 * Tracks product views, add-to-cart events, and provides data for "popular
 * products" and "trending" sections. All data is stored in the custom
 * `ProductAnalytics` CMS collection.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * GA4 Enhanced E-Commerce Events (fired client-side via wixWindow.trackEvent):
 * - ViewContent: Product page view
 * - AddToCart: Item added to cart
 * - InitiateCheckout: Checkout started
 * - Purchase: Order completed
 * - AddToWishlist: Saved to wishlist
 * These fire to both GA4 and Facebook Pixel when those integrations are enabled.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

/**
 * Track a product page view for analytics and "popular products" features.
 * Creates a new analytics record if none exists for the product, or increments
 * the existing view count and updates the last-viewed timestamp.
 *
 * @function trackProductView
 * @param {string} productId - The Wix product `_id` from Stores/Products.
 * @param {string} productName - The product's display name (stored for quick lookups).
 * @param {string} category - The product's category slug (e.g., 'futon-frames').
 * @returns {Promise<void>} Resolves silently — analytics tracking is non-critical.
 * @permission Anyone — no authentication required.
 *
 * @example
 * // From a page file:
 * import { trackProductView } from 'backend/analyticsHelpers.web';
 * await trackProductView(product._id, product.name, 'futon-frames');
 */
export const trackProductView = webMethod(
  Permissions.Anyone,
  async (productId, productName, category) => {
    try {
      const cleanId = sanitize(productId, 50);
      const cleanName = sanitize(productName, 200);
      const cleanCategory = sanitize(category, 100);

      // Check if we already have an analytics record for this product
      const existing = await wixData.query('ProductAnalytics')
        .eq('productId', cleanId)
        .find();

      if (existing.items.length > 0) {
        // Update existing record: increment view count, update timestamp
        const record = existing.items[0];
        record.viewCount = (record.viewCount || 0) + 1;
        record.lastViewed = new Date();
        await wixData.update('ProductAnalytics', record);
      } else {
        // Create new analytics record for first-time viewed product
        await wixData.insert('ProductAnalytics', {
          productId: cleanId,
          productName: cleanName,
          category: cleanCategory,
          viewCount: 1,
          lastViewed: new Date(),
          addToCartCount: 0,
          purchaseCount: 0,
        });
      }
    } catch (err) {
      // Analytics tracking is non-critical — log but don't throw
      console.error('Analytics tracking error:', err);
    }
  }
);

/**
 * Track an add-to-cart event for a product.
 * Increments the `addToCartCount` field in the product's analytics record.
 * No-ops silently if the product has no existing analytics record.
 *
 * @function trackAddToCart
 * @param {string} productId - The Wix product `_id`.
 * @returns {Promise<void>} Resolves silently.
 * @permission Anyone
 */
export const trackAddToCart = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const existing = await wixData.query('ProductAnalytics')
        .eq('productId', sanitize(productId, 50))
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        record.addToCartCount = (record.addToCartCount || 0) + 1;
        await wixData.update('ProductAnalytics', record);
      }
    } catch (err) {
      console.error('Cart tracking error:', err);
    }
  }
);

/**
 * Track a social share event for a product.
 * Increments the `shareCount` field and records the platform.
 *
 * @function trackSocialShare
 * @param {string} productId - The Wix product `_id`.
 * @param {string} platform - Social platform name (e.g., 'facebook', 'pinterest').
 * @returns {Promise<void>} Resolves silently.
 * @permission Anyone
 */
export const trackSocialShare = webMethod(
  Permissions.Anyone,
  async (productId, platform) => {
    try {
      const cleanId = sanitize(productId, 50);
      const cleanPlatform = sanitize(platform || '', 50);

      const existing = await wixData.query('ProductAnalytics')
        .eq('productId', cleanId)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        record.shareCount = (record.shareCount || 0) + 1;
        record.lastSharePlatform = cleanPlatform;
        await wixData.update('ProductAnalytics', record);
      }
    } catch (err) {
      console.error('Social share tracking error:', err);
    }
  }
);

/**
 * Get the most-viewed products across all time.
 * Joins analytics data with the Stores/Products collection to return
 * full product info sorted by view count.
 *
 * @function getMostViewedProducts
 * @param {number} [limit=8] - Maximum number of products to return.
 * @returns {Promise<Array<{_id: string, name: string, slug: string, price: number, formattedPrice: string, mainMedia: string, viewCount: number}>>}
 *   Array of product summaries with view counts, sorted by viewCount descending.
 *   Returns empty array on error.
 * @permission Anyone
 */
export const getMostViewedProducts = webMethod(
  Permissions.Anyone,
  async (limit = 8) => {
    try {
      // Get top analytics records by view count
      const analytics = await wixData.query('ProductAnalytics')
        .descending('viewCount')
        .limit(limit)
        .find();

      if (analytics.items.length === 0) return [];

      // Fetch the actual product data for the top-viewed products
      const productIds = analytics.items.map(a => a.productId);
      const products = await wixData.query('Stores/Products')
        .hasSome('_id', productIds)
        .find();

      // Build a lookup map for quick product access
      const productMap = new Map(products.items.map(p => [p._id, p]));

      // Merge product data with view counts, preserving analytics sort order
      return analytics.items
        .map(a => {
          const item = productMap.get(a.productId);
          if (!item) return null;
          return {
            _id: item._id,
            name: item.name,
            slug: item.slug,
            price: item.price,
            formattedPrice: item.formattedPrice,
            mainMedia: item.mainMedia,
            viewCount: a.viewCount || 0,
          };
        })
        .filter(Boolean);
    } catch (err) {
      console.error('Error fetching most viewed:', err);
      return [];
    }
  }
);

/**
 * Get products trending in the last 7 days.
 * Filters analytics records to only those with views in the past week,
 * then returns the corresponding product data.
 *
 * @function getTrendingProducts
 * @param {number} [limit=6] - Maximum number of products to return.
 * @returns {Promise<Array<{_id: string, name: string, slug: string, formattedPrice: string, mainMedia: string}>>}
 *   Array of product summaries for recently popular items. Returns empty array on error.
 * @permission Anyone
 */
export const getTrendingProducts = webMethod(
  Permissions.Anyone,
  async (limit = 6) => {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Only consider products viewed within the last 7 days
      const analytics = await wixData.query('ProductAnalytics')
        .ge('lastViewed', weekAgo)
        .descending('viewCount')
        .limit(limit)
        .find();

      if (analytics.items.length === 0) return [];

      const productIds = analytics.items.map(a => a.productId);
      const products = await wixData.query('Stores/Products')
        .hasSome('_id', productIds)
        .find();

      // Build a lookup map and preserve analytics sort order
      const productMap = new Map(products.items.map(p => [p._id, p]));

      return analytics.items
        .map(a => {
          const item = productMap.get(a.productId);
          if (!item) return null;
          return {
            _id: item._id,
            name: item.name,
            slug: item.slug,
            formattedPrice: item.formattedPrice,
            mainMedia: item.mainMedia,
          };
        })
        .filter(Boolean);
    } catch (err) {
      console.error('Error fetching trending:', err);
      return [];
    }
  }
);

// ══════════════════════════════════════════════════════════════════════
// GA4 Enhanced E-Commerce Event Helpers
// These are CLIENT-SIDE helpers imported by page files.
// They use wixWindow.trackEvent() which fires to GA4 + Facebook Pixel.
// ══════════════════════════════════════════════════════════════════════

/**
 * Build GA4 enhanced e-commerce event payload for a product view.
 * Call from page: `wixWindow.trackEvent('ViewContent', buildViewContentEvent(product))`
 *
 * @function buildViewContentEvent
 * @param {Object} product - Wix product object
 * @returns {Object} GA4-compatible event payload
 * @permission Anyone
 */
export const buildViewContentEvent = webMethod(
  Permissions.Anyone,
  async (product) => {
    if (!product) return {};
    return {
      content_name: sanitize(product.name || '', 200),
      content_ids: [product._id || ''],
      content_type: 'product',
      value: product.price || 0,
      currency: 'USD',
      content_category: (product.collections || [])[0] || '',
    };
  }
);

/**
 * Build GA4 event payload for add-to-cart.
 *
 * @function buildAddToCartEvent
 * @param {Object} product - Wix product object
 * @param {number} [quantity=1] - Quantity added
 * @returns {Object} GA4-compatible event payload
 * @permission Anyone
 */
export const buildAddToCartEvent = webMethod(
  Permissions.Anyone,
  async (product, quantity = 1) => {
    if (!product) return {};
    return {
      content_name: sanitize(product.name || '', 200),
      content_ids: [product._id || ''],
      content_type: 'product',
      value: (product.price || 0) * quantity,
      currency: 'USD',
      num_items: quantity,
    };
  }
);

/**
 * Build GA4 event payload for checkout initiation.
 *
 * @function buildCheckoutEvent
 * @param {Array} cartItems - Array of cart line items
 * @param {number} cartTotal - Cart subtotal
 * @returns {Object} GA4-compatible event payload
 * @permission Anyone
 */
export const buildCheckoutEvent = webMethod(
  Permissions.Anyone,
  async (cartItems, cartTotal) => {
    return {
      content_ids: (cartItems || []).map(item => item.productId || item._id || ''),
      content_type: 'product',
      value: cartTotal || 0,
      currency: 'USD',
      num_items: (cartItems || []).reduce((sum, item) => sum + (item.quantity || 1), 0),
    };
  }
);

/**
 * Build GA4 event payload for completed purchase.
 *
 * @function buildPurchaseEvent
 * @param {Object} order - Wix order object
 * @returns {Object} GA4-compatible event payload
 * @permission Anyone
 */
export const buildPurchaseEvent = webMethod(
  Permissions.Anyone,
  async (order) => {
    if (!order) return {};
    return {
      content_ids: (order.lineItems || []).map(item => item.catalogItemId || item.sku || ''),
      content_type: 'product',
      value: order.totals?.total || 0,
      currency: 'USD',
      num_items: (order.lineItems || []).reduce((sum, item) => sum + (item.quantity || 1), 0),
      order_id: order._id || '',
    };
  }
);

/**
 * Build GA4 event payload for wishlist addition.
 *
 * @function buildWishlistEvent
 * @param {Object} product - Wix product object
 * @returns {Object} GA4-compatible event payload
 * @permission Anyone
 */
export const buildWishlistEvent = webMethod(
  Permissions.Anyone,
  async (product) => {
    if (!product) return {};
    return {
      content_name: sanitize(product.name || '', 200),
      content_ids: [product._id || ''],
      content_type: 'product',
      value: product.price || 0,
      currency: 'USD',
    };
  }
);

/**
 * Build GA4 view_item_list event payload for category/collection page impressions.
 *
 * @function buildViewItemListEvent
 * @param {Array} items - Array of product objects displayed in the list
 * @param {string} listName - Category or list name (e.g., 'futon-frames')
 * @returns {Object} GA4-compatible view_item_list payload
 * @permission Anyone
 */
export const buildViewItemListEvent = webMethod(
  Permissions.Anyone,
  async (items, listName) => {
    const products = Array.isArray(items) ? items : [];
    return {
      item_list_name: listName || '',
      items: products.map((p, index) => ({
        item_id: p._id || '',
        item_name: sanitize(p.name || '', 200),
        price: p.price || 0,
        item_category: (p.collections || [])[0] || '',
        index,
      })),
    };
  }
);

/**
 * Build GA4 search event payload.
 *
 * @function buildSearchEvent
 * @param {string} query - Search query string
 * @param {number} resultCount - Number of results returned
 * @returns {Object} GA4-compatible search payload
 * @permission Anyone
 */
export const buildSearchEvent = webMethod(
  Permissions.Anyone,
  async (query, resultCount) => {
    return {
      search_term: sanitize(query || '', 200),
      results_count: resultCount || 0,
    };
  }
);

/**
 * Track a purchase event for a product. Increments purchaseCount in ProductAnalytics.
 *
 * @function trackPurchase
 * @param {string} productId - The Wix product _id
 * @returns {Promise<void>}
 * @permission Anyone
 */
export const trackPurchase = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const existing = await wixData.query('ProductAnalytics')
        .eq('productId', sanitize(productId, 50))
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        record.purchaseCount = (record.purchaseCount || 0) + 1;
        await wixData.update('ProductAnalytics', record);
      }
    } catch (err) {
      console.error('Purchase tracking error:', err);
    }
  }
);

/**
 * Build GA4 view_cart event payload for cart funnel tracking.
 *
 * @function buildViewCartEvent
 * @param {Array} cartItems - Array of cart line items
 * @param {number} cartTotal - Cart subtotal
 * @returns {Object} GA4-compatible view_cart payload
 * @permission Anyone
 */
export const buildViewCartEvent = webMethod(
  Permissions.Anyone,
  async (cartItems, cartTotal) => {
    const items = Array.isArray(cartItems) ? cartItems : [];
    return {
      currency: 'USD',
      value: cartTotal || 0,
      items: items.map(item => ({
        item_id: item._id || item.productId || '',
        item_name: sanitize(item.name || item.productName || '', 200),
        price: item.price || 0,
        quantity: item.quantity || 1,
      })),
    };
  }
);
