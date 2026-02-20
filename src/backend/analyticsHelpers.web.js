/**
 * @module analyticsHelpers
 * @description Backend web module for product analytics and engagement tracking.
 * Tracks product views, add-to-cart events, and provides data for "popular
 * products" and "trending" sections. All data is stored in the custom
 * `ProductAnalytics` CMS collection.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

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
      // Check if we already have an analytics record for this product
      const existing = await wixData.query('ProductAnalytics')
        .eq('productId', productId)
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
          productId,
          productName,
          category,
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
        .eq('productId', productId)
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

      // Merge product data with view counts, preserving viewCount sort order
      const productMap = new Map(products.items.map(item => [item._id, item]));
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

      // Preserve trending sort order by iterating analytics first
      const productMap = new Map(products.items.map(item => [item._id, item]));
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
