/** @module productRecommendations - Backend product recommendation engine.
 *
 * Powers cross-sell ("Complete Your Futon"), related products, same-collection
 * suggestions, featured/bestselling/sale product queries, bundle pricing,
 * server-side recently-viewed tracking (CMS-backed for logged-in members),
 * similar-product matching by price range, and co-purchase ("Customers Also Bought")
 * analysis from order history.
 *
 * All exports use the webMethod pattern. Most use Permissions.Anyone;
 * member-specific endpoints (trackRecentlyViewed, getRecentlyViewed) use
 * Permissions.SiteMember.
 *
 * Dependencies: wix-web-module, wix-data, wix-members-backend, backend/utils/sanitize.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateSlug, validateId } from 'backend/utils/sanitize';

const RECENTLY_VIEWED_COLLECTION = 'RecentlyViewed';
/** Call-for-price products use $0 or $1.00 placeholder prices. Exclude from recommendations.
 *  Keep in sync with CALL_FOR_PRICE_THRESHOLD in public/productPageUtils.js */
const CALL_FOR_PRICE_THRESHOLD = 1;
const MAX_RECENTLY_VIEWED = 20;

/**
 * Get related products from complementary categories for cross-selling on product pages.
 * Maps each category to its logical complement (e.g., frames suggest mattresses).
 * @param {string} productId - Current product ID to exclude from results
 * @param {string} categorySlug - Current product's category slug
 * @param {number} [limit=4] - Maximum products to return
 * @returns {Promise<Array<Object>>} Formatted product summaries
 * @permission Anyone
 */
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
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
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

/**
 * Get "Complete Your Futon" suggestions based on current cart contents.
 * Analyzes cart categories to identify missing complements (frame without mattress,
 * Murphy bed without casegoods, etc.) and returns headed suggestion groups.
 * Falls back to bestsellers if no specific match is found.
 * @param {Array<string>} cartProductIds - Product IDs currently in the cart
 * @returns {Promise<Array<{heading: string, products: Array<Object>}>>} Suggestion groups
 * @permission Anyone
 */
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
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
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
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
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
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
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
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
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
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
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

/**
 * Get products in the same collection or finish family.
 * Used for the "More in this Collection" section on product pages.
 * @param {string} productId - Current product ID to exclude
 * @param {Array<string>} collections - Collection slugs to match
 * @param {number} [limit=6] - Maximum products to return
 * @returns {Promise<Array<Object>>} Formatted product summaries
 * @permission Anyone
 */
export const getSameCollection = webMethod(
  Permissions.Anyone,
  async (productId, collections, limit = 6) => {
    try {
      if (!collections || collections.length === 0) return [];

      const results = await wixData.query('Stores/Products')
        .hasSome('collections', collections)
        .ne('_id', sanitize(productId, 50))
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
        .limit(limit)
        .find();

      return results.items.map(formatProduct);
    } catch (err) {
      console.error('Error fetching same collection:', err);
      return [];
    }
  }
);

/**
 * Get featured products for the homepage hero section.
 * Prioritizes products with a "Featured" ribbon; falls back to newest products.
 * @param {number} [limit=8] - Maximum products to return
 * @returns {Promise<Array<Object>>} Formatted product summaries
 * @permission Anyone
 */
export const getFeaturedProducts = webMethod(
  Permissions.Anyone,
  async (limit = 8) => {
    try {
      // First try to get products marked with a "featured" ribbon
      let results = await wixData.query('Stores/Products')
        .eq('ribbon', 'Featured')
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
        .limit(limit)
        .find();

      // Fallback: get newest products
      if (results.items.length === 0) {
        results = await wixData.query('Stores/Products')
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
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

/**
 * Get sale/clearance products sorted by largest discount first.
 * Queries products with a discounted price and ranks by savings amount.
 * @param {number} [limit=12] - Maximum products to return
 * @returns {Promise<Array<Object>>} Formatted product summaries sorted by discount
 * @permission Anyone
 */
export const getSaleProducts = webMethod(
  Permissions.Anyone,
  async (limit = 12) => {
    try {
      const results = await wixData.query('Stores/Products')
        .gt('discountedPrice', 0)
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
        .limit(limit)
        .find();

      // Sort by discount amount (price - discountedPrice) descending
      return results.items
        .map(formatProduct)
        .sort((a, b) => {
          const discountA = (a.price || 0) - (a.discountedPrice != null ? a.discountedPrice : (a.price || 0));
          const discountB = (b.price || 0) - (b.discountedPrice != null ? b.discountedPrice : (b.price || 0));
          return discountB - discountA;
        });
    } catch (err) {
      console.error('Error fetching sale products:', err);
      return [];
    }
  }
);

/**
 * Get a bundle suggestion for a product on the Product Detail Page (PDP).
 * Pairs frames with the lowest-priced mattress (and vice versa), Murphy beds
 * with casegoods, platform beds with accessories. Calculates a 5% bundle discount.
 * @param {string} productId - Current product ID
 * @returns {Promise<{heading: string, product: Object, originalTotal: number, bundlePrice: number, savings: number}|null>} Bundle offer or null
 * @permission Anyone
 */
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
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
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

/**
 * Get bestselling products based on analytics data.
 * Tries ProductAnalytics CMS collection (weekSales descending) first,
 * then falls back to "Bestseller" ribbon, then newest products.
 * @param {number} [limit=4] - Maximum products to return
 * @returns {Promise<Array<Object>>} Formatted product summaries
 * @permission Anyone
 */
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
            .gt('price', CALL_FOR_PRICE_THRESHOLD)
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
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
        .limit(limit)
        .find();

      if (results.items.length > 0) {
        return results.items.map(formatProduct);
      }

      // Final fallback: newest products
      results = await wixData.query('Stores/Products')
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
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
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
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

/**
 * Get "Customers Also Bought" products based on co-purchase data.
 * Queries orders containing the given product and ranks other products
 * by how frequently they appear in those same orders.
 * Falls back to category-based related products if no order data exists.
 *
 * @param {string} productId - Source product ID.
 * @param {number} [limit=4] - Max products to return.
 * @returns {Promise<{success: boolean, products: Array}>}
 */
export const getCustomersAlsoBought = webMethod(
  Permissions.Anyone,
  async (productId, limit = 4) => {
    try {
      const pid = validateId(productId);
      if (!pid) return { success: false, products: [] };

      const safeLimit = Math.max(1, Math.min(12, Math.round(limit)));

      // Find orders containing this product
      // lineItems is a nested array of objects, so we fetch recent orders
      // and filter client-side since hasSome doesn't support nested fields
      const orders = await wixData.query('Stores/Orders')
        .limit(100)
        .find();

      const matchingOrders = orders.items.filter(order =>
        order.lineItems && order.lineItems.some(li => li.productId === pid)
      );

      if (matchingOrders.length === 0) {
        // Fallback: use category-based related products
        const product = await wixData.get('Stores/Products', pid);
        if (!product) return { success: true, products: [] };

        const collections = Array.isArray(product.collections)
          ? product.collections
          : product.collections ? [product.collections] : [];

        if (collections.length === 0) return { success: true, products: [] };

        const related = await wixData.query('Stores/Products')
          .hasSome('collections', collections)
          .ne('_id', pid)
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
          .limit(safeLimit)
          .find();

        return { success: true, products: related.items.map(formatProduct) };
      }

      // Count co-purchase frequency for each product
      const frequency = {};
      for (const order of matchingOrders) {
        for (const li of order.lineItems) {
          if (li.productId && li.productId !== pid) {
            frequency[li.productId] = (frequency[li.productId] || 0) + 1;
          }
        }
      }

      // Sort by frequency descending
      const ranked = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, safeLimit)
        .map(([id]) => id);

      if (ranked.length === 0) return { success: true, products: [] };

      // Fetch full product details
      const products = await wixData.query('Stores/Products')
        .hasSome('_id', ranked)
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
        .find();

      // Maintain frequency order
      const productMap = new Map(products.items.map(p => [p._id, p]));
      const ordered = ranked
        .map(id => productMap.get(id))
        .filter(Boolean)
        .map(formatProduct);

      return { success: true, products: ordered };
    } catch (err) {
      console.error('[productRecommendations] getCustomersAlsoBought error:', err);
      return { success: false, products: [] };
    }
  }
);

/**
 * Batch-fetch current prices for a list of product slugs.
 * Used by recently viewed sections to detect stale cached prices.
 * Returns a map of slug → { price, formattedPrice, formattedDiscountedPrice }.
 *
 * @param {string[]} slugs - Product slugs to check (max 20)
 * @returns {Promise<{success: boolean, prices: Object}>}
 */
export const getBatchCurrentPrices = webMethod(
  Permissions.Anyone,
  async (slugs) => {
    try {
      if (!Array.isArray(slugs) || slugs.length === 0) {
        return { success: true, prices: {} };
      }
      const safeSlugs = slugs.slice(0, 20).filter(s => typeof s === 'string' && validateSlug(s));
      if (safeSlugs.length === 0) return { success: true, prices: {} };

      const result = await wixData.query('Stores/Products')
        .hasSome('slug', safeSlugs)
        .fields('slug', 'price', 'formattedPrice', 'formattedDiscountedPrice')
        .limit(20)
        .find();

      const prices = {};
      for (const item of result.items) {
        prices[item.slug] = {
          price: item.price,
          formattedPrice: item.formattedPrice,
          formattedDiscountedPrice: item.formattedDiscountedPrice || null,
        };
      }
      return { success: true, prices };
    } catch (err) {
      console.error('[productRecommendations] getBatchCurrentPrices error:', err?.message);
      return { success: false, prices: {} };
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
    color: item.color || null,
    productOptions: item.productOptions || [],
  };
}

// ── getRecommendations ─────────────────────────────────────────────
// In-memory cache: key=productId → {products, expires}. 30-min TTL.
// Per-instance (serverless cold starts reset cache — acceptable trade-off).
const _recCache = new Map();
const REC_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Get "Customers Also Love" recommendations for a product.
 * Scores candidates by collection overlap (2pts each) + price band ±20% (1pt).
 * Results ranked by overlap score, cached 30min per productId.
 *
 * @param {string} productId - Source product ID
 * @param {number} [limit=6] - Max recommendations to return
 * @returns {Promise<{success: boolean, products: Array}>}
 * @permission Anyone
 */
export const getRecommendations = webMethod(
  Permissions.Anyone,
  async (productId, limit = 6) => {
    try {
      const pid = validateId(productId);
      if (!pid) return { success: false, products: [] };

      const safeLimit = Math.max(1, Math.min(12, Math.round(limit)));

      // Return cached result if still fresh
      const cached = _recCache.get(pid);
      if (cached && cached.expires > Date.now()) {
        return { success: true, products: cached.products.slice(0, safeLimit) };
      }

      // Load source product
      const source = await wixData.get('Stores/Products', pid);
      if (!source) return { success: false, products: [] };

      const sourceCollections = Array.isArray(source.collections)
        ? source.collections
        : source.collections ? [source.collections] : [];

      const sourcePrice = source.price || 0;
      const minPrice = sourcePrice * 0.8;
      const maxPrice = sourcePrice * 1.2;

      // Fetch candidates: products sharing ≥1 collection, exclude source + call-for-price
      let candidates = [];
      if (sourceCollections.length > 0) {
        const collResult = await wixData.query('Stores/Products')
          .hasSome('collections', sourceCollections)
          .ne('_id', pid)
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
          .limit(50)
          .find();
        candidates = collResult.items;
      }

      // Score each candidate: 2pts per shared collection, +1 if in price band
      const scored = candidates.map(item => {
        const itemColls = Array.isArray(item.collections)
          ? item.collections
          : item.collections ? [item.collections] : [];
        const sharedColls = itemColls.filter(c => sourceCollections.includes(c)).length;
        const inPriceBand = item.price >= minPrice && item.price <= maxPrice ? 1 : 0;
        return { item, score: sharedColls * 2 + inPriceBand };
      });

      // Sort by score descending, format for return
      const ranked = scored
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => formatProduct(item));

      // Cache full ranked list (up to 12) to serve different limit values
      _recCache.set(pid, { products: ranked.slice(0, 12), expires: Date.now() + REC_CACHE_TTL_MS });

      return { success: true, products: ranked.slice(0, safeLimit) };
    } catch (err) {
      console.error('[productRecommendations] getRecommendations error:', err);
      return { success: false, products: [] };
    }
  }
);

/** @testing Clear the recommendations cache. */
export function __resetRecCache() { _recCache.clear(); }

/**
 * Get complementary products to show in the freight bundle upsell banner.
 * Returns mattresses and accessories suited to pair with a freight item
 * (Murphy bed or platform bed) already in the cart.
 *
 * @param {string[]} excludeProductIds - Product IDs already in cart (excluded from results)
 * @param {number}   [limit=4]         - Max products to return
 * @returns {Promise<{success: boolean, products: Array<Object>}>}
 * @permission Anyone
 */
export const getFreightComplementProducts = webMethod(
  Permissions.Anyone,
  async (excludeProductIds = [], limit = 4) => {
    try {
      const safeLimit = Math.min(Math.max(1, limit), 12);
      const safeExclude = Array.isArray(excludeProductIds) ? excludeProductIds.slice(0, 50) : [];

      // Prioritise mattresses and accessories — best pairings for freight items
      const results = await wixData.query('Stores/Products')
        .hasSome('collections', ['mattresses', 'casegoods-accessories'])
        .not(wixData.query('Stores/Products').hasSome('_id', safeExclude))
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
        .ascending('price')
        .limit(safeLimit)
        .find();

      return { success: true, products: results.items.map(formatProduct) };
    } catch (err) {
      console.error('[productRecommendations] getFreightComplementProducts error:', err);
      return { success: false, products: [] };
    }
  }
);

// ── getProductRecommendations (cf-e1h) ───────────────────────────────

const MEMBER_BROWSE_HISTORY_COLLECTION = 'MemberBrowseHistory';

/**
 * Get personalized product recommendations based on browse + purchase history.
 * Authenticated member identity is resolved server-side via currentMember.getMember();
 * guests fall back to a validated sessionId. Falls back to category-based
 * recommendations when no history exists.
 *
 * @param {string} productId - Current product on PDP (excluded from results)
 * @param {Object} [options]
 * @param {string} [options.sessionId] - Guest session ID (fallback, validated server-side)
 * @param {number} [options.limit=4] - Max products to return
 * @returns {Promise<{success: boolean, products: Array<{productId, title, price, imageUrl, slug}>, source: 'history'|'category'}>}
 * @permission Anyone
 */
export const getProductRecommendations = webMethod(
  Permissions.Anyone,
  async (productId, options = {}) => {
    try {
      const pid = validateId(productId);
      if (!pid) return { success: false, products: [], source: 'category' };

      const { sessionId, limit = 4 } = options;
      const safeLimit = Math.max(1, Math.min(12, Math.round(limit)));

      // Resolve member identity server-side — never trust client-supplied IDs.
      let resolvedMemberId = null;
      try {
        const member = await currentMember.getMember();
        resolvedMemberId = member?._id ?? null;
      } catch { /* guest caller — leave as null */ }

      // Only use sessionId for guests, and only after validation.
      const safeSessionId = resolvedMemberId ? null : validateId(sessionId);
      const sessionKey = resolvedMemberId
        ? `member_${resolvedMemberId}`
        : safeSessionId
          ? `session_${safeSessionId}`
          : null;

      const frequency = {};
      const purchasedProductIds = new Set();

      if (sessionKey) {
        const browseResults = await wixData
          .query(MEMBER_BROWSE_HISTORY_COLLECTION)
          .eq('sessionKey', sessionKey)
          .ne('productId', pid)
          .limit(100)
          .find({ suppressAuth: true });

        for (const record of browseResults.items) {
          if (record.productId && record.productId !== pid) {
            frequency[record.productId] = (frequency[record.productId] || 0) + 1;
          }
        }
      }

      if (resolvedMemberId) {
        const orders = await wixData
          .query('Stores/Orders')
          .eq('buyerInfo.memberId', resolvedMemberId)
          .limit(100)
          .find({ suppressAuth: true });

        for (const order of orders.items) {
          if (!order.lineItems) continue;
          const orderProductIds = order.lineItems
            .map(li => li.productId)
            .filter(Boolean);

          for (const opid of orderProductIds) {
            purchasedProductIds.add(opid);
          }

          if (orderProductIds.includes(pid)) {
            for (const opid of orderProductIds) {
              if (opid !== pid) {
                frequency[opid] = (frequency[opid] || 0) + 2;
              }
            }
          }
        }
      }

      purchasedProductIds.delete(pid);
      for (const purchasedId of purchasedProductIds) {
        delete frequency[purchasedId];
      }

      const rankedIds = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, safeLimit)
        .map(([id]) => id);

      if (rankedIds.length > 0) {
        const products = await wixData
          .query('Stores/Products')
          .hasSome('_id', rankedIds)
          .gt('price', CALL_FOR_PRICE_THRESHOLD)
          .find({ suppressAuth: true });

        const productMap = new Map(products.items.map(p => [p._id, p]));
        const ordered = rankedIds
          .map(id => productMap.get(id))
          .filter(Boolean)
          .map(p => ({
            productId: p._id,
            title: p.name,
            price: p.price,
            imageUrl: p.mainMedia?.src || p.mainMedia || null,
            slug: p.slug,
          }));

        if (ordered.length > 0) {
          return { success: true, products: ordered, source: 'history' };
        }
      }

      const sourceProduct = await wixData.get('Stores/Products', pid, { suppressAuth: true });
      if (!sourceProduct) return { success: true, products: [], source: 'category' };

      const collections = Array.isArray(sourceProduct.collections)
        ? sourceProduct.collections
        : sourceProduct.collections ? [sourceProduct.collections] : [];

      if (collections.length === 0) {
        return { success: true, products: [], source: 'category' };
      }

      const excludeIds = [pid, ...purchasedProductIds];
      const categoryResults = await wixData
        .query('Stores/Products')
        .hasSome('collections', collections)
        .not(wixData.query('Stores/Products').hasSome('_id', excludeIds))
        .gt('price', CALL_FOR_PRICE_THRESHOLD)
        .limit(safeLimit)
        .find({ suppressAuth: true });

      const categoryProducts = categoryResults.items.map(p => ({
        productId: p._id,
        title: p.name,
        price: p.price,
        imageUrl: p.mainMedia?.src || p.mainMedia || null,
        slug: p.slug,
      }));

      return { success: true, products: categoryProducts, source: 'category' };
    } catch (err) {
      console.error('[productRecommendations] getProductRecommendations error:', err);
      return { success: false, products: [], source: 'category' };
    }
  }
);
