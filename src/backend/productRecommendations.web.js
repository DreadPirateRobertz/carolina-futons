// Backend web module for product recommendations
// Handles cross-sell, related products, recently viewed, and "Complete Your Futon" bundles
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateSlug, validateId } from 'backend/utils/sanitize';

const RECENTLY_VIEWED_COLLECTION = 'RecentlyViewed';
const MAX_RECENTLY_VIEWED = 20;

// Get related products for cross-selling on product pages
// Returns products from complementary categories
export const getRelatedProducts = webMethod(
  Permissions.Anyone,
  async (productId, categorySlug, limit = 4) => {
    try {
      const cleanProductId = sanitize(productId, 50);
      const cleanSlug = validateSlug(categorySlug) || sanitize(categorySlug, 100);

      const crossSellCategories = {
        'futon-frames': ['mattresses', 'casegoods-accessories'],
        'mattresses': ['futon-frames'],
        'murphy-cabinet-beds': ['casegoods-accessories', 'platform-beds'],
        'platform-beds': ['casegoods-accessories', 'mattresses'],
        'casegoods-accessories': ['platform-beds', 'futon-frames'],
        'wall-huggers': ['mattresses', 'casegoods-accessories'],
        'unfinished-wood': ['mattresses', 'casegoods-accessories'],
      };

      const relatedCategories = crossSellCategories[cleanSlug] || [];
      if (relatedCategories.length === 0) return [];

      const results = await wixData.query('Stores/Products')
        .hasSome('collections', relatedCategories)
        .ne('_id', cleanProductId)
        .limit(limit)
        .find();

      return results.items.map(item => ({
        _id: item._id,
        name: item.name,
        slug: item.slug,
        price: item.price,
        formattedPrice: item.formattedPrice,
        mainMedia: item.mainMedia,
        sku: item.sku,
        ribbon: item.ribbon,
      }));
    } catch (err) {
      console.error('Error fetching related products:', err);
      return [];
    }
  }
);

// Get "Complete Your Futon" suggestions based on what's in the cart
// If cart has a frame but no mattress, suggest mattresses and vice versa
export const getCompletionSuggestions = webMethod(
  Permissions.Anyone,
  async (cartProductIds) => {
    try {
      if (!cartProductIds || cartProductIds.length === 0) return [];

      // Query the cart products to understand what categories are present
      const cartProducts = await wixData.query('Stores/Products')
        .hasSome('_id', cartProductIds)
        .find();

      const cartCategories = new Set();
      cartProducts.items.forEach(item => {
        if (item.collections) {
          item.collections.forEach(col => cartCategories.add(col));
        }
      });

      const suggestions = [];

      // Has frame but no mattress? Suggest mattresses
      const hasFrame = cartCategories.has('futon-frames') ||
                       cartCategories.has('front-loading-nesting') ||
                       cartCategories.has('wall-huggers') ||
                       cartCategories.has('unfinished-wood');
      const hasMattress = cartCategories.has('mattresses');

      if (hasFrame && !hasMattress) {
        const mattresses = await wixData.query('Stores/Products')
          .hasSome('collections', ['mattresses'])
          .limit(3)
          .find();
        suggestions.push({
          heading: 'Complete Your Futon — Add a Mattress',
          products: mattresses.items.map(formatProduct),
        });
      }

      // Has mattress but no frame? Suggest frames
      if (hasMattress && !hasFrame) {
        const frames = await wixData.query('Stores/Products')
          .hasSome('collections', ['futon-frames'])
          .limit(3)
          .find();
        suggestions.push({
          heading: 'Complete Your Futon — Choose a Frame',
          products: frames.items.map(formatProduct),
        });
      }

      // Has Murphy bed? Suggest matching casegoods
      const hasMurphy = cartCategories.has('murphy-cabinet-beds');
      const hasCasegoods = cartCategories.has('casegoods-accessories');
      if (hasMurphy && !hasCasegoods) {
        const casegoods = await wixData.query('Stores/Products')
          .hasSome('collections', ['casegoods-accessories'])
          .limit(3)
          .find();
        suggestions.push({
          heading: 'Complete the Bedroom',
          products: casegoods.items.map(formatProduct),
        });
      }

      // Has platform bed? Suggest casegoods
      const hasPlatform = cartCategories.has('platform-beds');
      if (hasPlatform && !hasCasegoods) {
        const casegoods = await wixData.query('Stores/Products')
          .hasSome('collections', ['casegoods-accessories'])
          .limit(3)
          .find();
        suggestions.push({
          heading: 'Add Matching Furniture',
          products: casegoods.items.map(formatProduct),
        });
      }

      // Fallback: suggest bestsellers if no specific match
      if (suggestions.length === 0) {
        const popular = await wixData.query('Stores/Products')
          .not(wixData.query('Stores/Products').hasSome('_id', cartProductIds))
          .limit(4)
          .descending('_createdDate')
          .find();
        if (popular.items.length > 0) {
          suggestions.push({
            heading: 'You Might Also Like',
            products: popular.items.map(formatProduct),
          });
        }
      }

      return suggestions;
    } catch (err) {
      console.error('Error fetching completion suggestions:', err);
      return [];
    }
  }
);

// Get products in the same collection/finish family
// For "More in this collection" section on product pages
export const getSameCollection = webMethod(
  Permissions.Anyone,
  async (productId, collections, limit = 6) => {
    try {
      if (!collections || collections.length === 0) return [];

      const results = await wixData.query('Stores/Products')
        .hasSome('collections', collections)
        .ne('_id', sanitize(productId, 50))
        .limit(limit)
        .find();

      return results.items.map(formatProduct);
    } catch (err) {
      console.error('Error fetching same collection:', err);
      return [];
    }
  }
);

// Get featured/bestselling products for homepage
export const getFeaturedProducts = webMethod(
  Permissions.Anyone,
  async (limit = 8) => {
    try {
      // First try to get products marked with a "featured" ribbon
      let results = await wixData.query('Stores/Products')
        .eq('ribbon', 'Featured')
        .limit(limit)
        .find();

      // Fallback: get newest products
      if (results.items.length === 0) {
        results = await wixData.query('Stores/Products')
          .descending('_createdDate')
          .limit(limit)
          .find();
      }

      return results.items.map(formatProduct);
    } catch (err) {
      console.error('Error fetching featured products:', err);
      return [];
    }
  }
);

// Get sale/clearance products
export const getSaleProducts = webMethod(
  Permissions.Anyone,
  async (limit = 12) => {
    try {
      const results = await wixData.query('Stores/Products')
        .gt('discountedPrice', 0)
        .limit(limit)
        .find();

      // Sort by discount amount (price - discountedPrice) descending
      return results.items
        .map(formatProduct)
        .sort((a, b) => {
          const discountA = (a.price || 0) - (a.discountedPrice || a.price || 0);
          const discountB = (b.price || 0) - (b.discountedPrice || b.price || 0);
          return discountB - discountA;
        });
    } catch (err) {
      console.error('Error fetching sale products:', err);
      return [];
    }
  }
);

// Get bundle suggestion for a product on PDP
// Pairs frames with mattresses, Murphy beds with casegoods
export const getBundleSuggestion = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanProductId = sanitize(productId, 50);
      const product = await wixData.get('Stores/Products', cleanProductId);
      if (!product || !product.collections) return null;

      const colls = Array.isArray(product.collections)
        ? product.collections
        : [product.collections];

      const isFrame = colls.some(c =>
        c.includes('futon') || c.includes('frame') ||
        c.includes('wall-hugger') || c.includes('unfinished') ||
        c.includes('front-loading') || c.includes('nesting')
      );
      const isMattress = colls.some(c => c.includes('mattress'));
      const isMurphy = colls.some(c => c.includes('murphy'));
      const isPlatform = colls.some(c => c.includes('platform'));

      let targetCollections = [];
      let heading = 'Complete Your Futon — Save 5%';

      if (isFrame && !isMurphy && !isPlatform) {
        targetCollections = ['mattresses'];
        heading = 'Complete Your Futon — Save 5%';
      } else if (isMattress) {
        targetCollections = ['futon-frames'];
        heading = 'Complete Your Futon — Save 5%';
      } else if (isMurphy) {
        targetCollections = ['casegoods-accessories'];
        heading = 'Complete the Bedroom — Save 5%';
      } else if (isPlatform) {
        targetCollections = ['casegoods-accessories'];
        heading = 'Add Matching Furniture — Save 5%';
      }

      if (targetCollections.length === 0) return null;

      const results = await wixData.query('Stores/Products')
        .hasSome('collections', targetCollections)
        .ne('_id', cleanProductId)
        .ascending('price')
        .limit(1)
        .find();

      if (results.items.length === 0) return null;

      const bundleItem = results.items[0];
      const combinedPrice = (product.price || 0) + (bundleItem.price || 0);
      const discount = combinedPrice * 0.05;
      const bundlePrice = combinedPrice - discount;

      return {
        heading,
        product: formatProduct(bundleItem),
        originalTotal: combinedPrice,
        bundlePrice,
        savings: discount,
      };
    } catch (err) {
      console.error('Error fetching bundle suggestion:', err);
      return null;
    }
  }
);

// Get bestselling products based on analytics data
// Falls back to featured ribbon, then newest products
export const getBestsellers = webMethod(
  Permissions.Anyone,
  async (limit = 4) => {
    try {
      // Try ProductAnalytics CMS first (weekSales descending)
      try {
        const analytics = await wixData.query('ProductAnalytics')
          .gt('weekSales', 0)
          .descending('weekSales')
          .limit(limit)
          .find();

        if (analytics.items.length > 0) {
          const productIds = analytics.items.map(a => a.productId);
          const products = await wixData.query('Stores/Products')
            .hasSome('_id', productIds)
            .find();

          if (products.items.length > 0) {
            return products.items.map(formatProduct);
          }
        }
      } catch (e) {
        // ProductAnalytics collection may not exist yet — fall through
      }

      // Fallback: products with "Bestseller" ribbon
      let results = await wixData.query('Stores/Products')
        .eq('ribbon', 'Bestseller')
        .limit(limit)
        .find();

      if (results.items.length > 0) {
        return results.items.map(formatProduct);
      }

      // Final fallback: newest products
      results = await wixData.query('Stores/Products')
        .descending('_createdDate')
        .limit(limit)
        .find();

      return results.items.map(formatProduct);
    } catch (err) {
      console.error('Error fetching bestsellers:', err);
      return [];
    }
  }
);

/**
 * Track a recently viewed product for the logged-in member.
 * Stores in RecentlyViewed CMS collection with dedup and cap.
 *
 * @param {string} productId - Product viewed.
 * @returns {Promise<{success: boolean}>}
 *
 * @setup
 * Create CMS collection `RecentlyViewed` with fields:
 *   memberId (Text, indexed), productId (Text, indexed), viewedAt (Date, indexed)
 */
export const trackRecentlyViewed = webMethod(
  Permissions.SiteMember,
  async (productId) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false };

      const pid = validateId(productId);
      if (!pid) return { success: false };

      const memberId = member._id;

      // Remove existing entry for this product (dedup)
      const existing = await wixData.query(RECENTLY_VIEWED_COLLECTION)
        .eq('memberId', memberId)
        .eq('productId', pid)
        .find();

      for (const item of existing.items) {
        await wixData.remove(RECENTLY_VIEWED_COLLECTION, item._id);
      }

      // Insert fresh entry
      await wixData.insert(RECENTLY_VIEWED_COLLECTION, {
        memberId,
        productId: pid,
        viewedAt: new Date(),
      });

      // Trim to max entries
      const all = await wixData.query(RECENTLY_VIEWED_COLLECTION)
        .eq('memberId', memberId)
        .descending('viewedAt')
        .limit(MAX_RECENTLY_VIEWED + 10)
        .find();

      if (all.items.length > MAX_RECENTLY_VIEWED) {
        const toRemove = all.items.slice(MAX_RECENTLY_VIEWED);
        for (const item of toRemove) {
          await wixData.remove(RECENTLY_VIEWED_COLLECTION, item._id);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('[productRecommendations] trackRecentlyViewed error:', err);
      return { success: false };
    }
  }
);

/**
 * Get recently viewed products for the logged-in member.
 *
 * @param {number} [limit=10] - Max products to return.
 * @returns {Promise<{success: boolean, products: Array}>}
 */
export const getRecentlyViewed = webMethod(
  Permissions.SiteMember,
  async (limit = 10) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, products: [] };

      const safeLimit = Math.max(1, Math.min(MAX_RECENTLY_VIEWED, Math.round(limit)));

      const viewed = await wixData.query(RECENTLY_VIEWED_COLLECTION)
        .eq('memberId', member._id)
        .descending('viewedAt')
        .limit(safeLimit)
        .find();

      if (viewed.items.length === 0) return { success: true, products: [] };

      const productIds = viewed.items.map(v => v.productId);
      const products = await wixData.query('Stores/Products')
        .hasSome('_id', productIds)
        .find();

      // Maintain view order
      const productMap = new Map(products.items.map(p => [p._id, p]));
      const ordered = productIds
        .map(id => productMap.get(id))
        .filter(Boolean)
        .map(formatProduct);

      return { success: true, products: ordered };
    } catch (err) {
      console.error('[productRecommendations] getRecentlyViewed error:', err);
      return { success: false, products: [] };
    }
  }
);

/**
 * Get similar products based on same category and price range.
 * Used on product pages for "You may also like" section.
 *
 * @param {string} productId - Source product.
 * @param {Object} [options]
 * @param {number} [options.priceRange=0.3] - Price tolerance (0.3 = +/-30% of source price).
 * @param {number} [options.limit=4] - Max results.
 * @returns {Promise<{success: boolean, products: Array}>}
 */
export const getSimilarProducts = webMethod(
  Permissions.Anyone,
  async (productId, options = {}) => {
    try {
      const pid = validateId(productId);
      if (!pid) return { success: false, products: [] };

      const product = await wixData.get('Stores/Products', pid);
      if (!product) return { success: false, products: [] };

      const { priceRange = 0.3, limit = 4 } = options;
      const safeLimit = Math.max(1, Math.min(12, Math.round(limit)));
      const safePriceRange = Math.max(0.1, Math.min(1, priceRange));

      const price = product.price || 0;
      const minPrice = price * (1 - safePriceRange);
      const maxPrice = price * (1 + safePriceRange);

      const collections = Array.isArray(product.collections)
        ? product.collections
        : product.collections ? [product.collections] : [];

      let query = wixData.query('Stores/Products')
        .ne('_id', pid)
        .ge('price', minPrice)
        .le('price', maxPrice);

      if (collections.length > 0) {
        query = query.hasSome('collections', collections);
      }

      const results = await query.limit(safeLimit).find();

      return {
        success: true,
        products: results.items.map(formatProduct),
      };
    } catch (err) {
      console.error('[productRecommendations] getSimilarProducts error:', err);
      return { success: false, products: [] };
    }
  }
);

function formatProduct(item) {
  return {
    _id: item._id,
    name: item.name,
    slug: item.slug,
    price: item.price,
    formattedPrice: item.formattedPrice,
    discountedPrice: item.discountedPrice,
    formattedDiscountedPrice: item.formattedDiscountedPrice,
    mainMedia: item.mainMedia,
    sku: item.sku,
    ribbon: item.ribbon,
    collections: item.collections,
  };
}
