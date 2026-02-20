// Backend web module for analytics and tracking
// Tracks product views, cart events, and conversion data
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// Track product view for analytics and "popular products" features
export const trackProductView = webMethod(
  Permissions.Anyone,
  async (productId, productName, category) => {
    try {
      // Increment view count in ProductAnalytics collection
      const existing = await wixData.query('ProductAnalytics')
        .eq('productId', productId)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        record.viewCount = (record.viewCount || 0) + 1;
        record.lastViewed = new Date();
        await wixData.update('ProductAnalytics', record);
      } else {
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
      // Analytics tracking is non-critical
      console.error('Analytics tracking error:', err);
    }
  }
);

// Track add-to-cart events
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

// Get most viewed products (for "Popular Products" sections)
export const getMostViewedProducts = webMethod(
  Permissions.Anyone,
  async (limit = 8) => {
    try {
      const analytics = await wixData.query('ProductAnalytics')
        .descending('viewCount')
        .limit(limit)
        .find();

      if (analytics.items.length === 0) return [];

      const productIds = analytics.items.map(a => a.productId);
      const products = await wixData.query('Stores/Products')
        .hasSome('_id', productIds)
        .find();

      return products.items.map(item => ({
        _id: item._id,
        name: item.name,
        slug: item.slug,
        price: item.price,
        formattedPrice: item.formattedPrice,
        mainMedia: item.mainMedia,
        viewCount: analytics.items.find(a => a.productId === item._id)?.viewCount || 0,
      }));
    } catch (err) {
      console.error('Error fetching most viewed:', err);
      return [];
    }
  }
);

// Get trending products (most views in last 7 days)
export const getTrendingProducts = webMethod(
  Permissions.Anyone,
  async (limit = 6) => {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

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

      return products.items.map(item => ({
        _id: item._id,
        name: item.name,
        slug: item.slug,
        formattedPrice: item.formattedPrice,
        mainMedia: item.mainMedia,
      }));
    } catch (err) {
      console.error('Error fetching trending:', err);
      return [];
    }
  }
);
