// Backend web module for product recommendations
// Handles cross-sell, related products, and "Complete Your Futon" bundles
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// Get related products for cross-selling on product pages
// Returns products from complementary categories
export const getRelatedProducts = webMethod(
  Permissions.Anyone,
  async (productId, categorySlug, limit = 4) => {
    try {
      const crossSellCategories = {
        'futon-frames': ['mattresses', 'casegoods-accessories'],
        'mattresses': ['futon-frames'],
        'murphy-cabinet-beds': ['casegoods-accessories', 'platform-beds'],
        'platform-beds': ['casegoods-accessories', 'mattresses'],
        'casegoods-accessories': ['platform-beds', 'futon-frames'],
      };

      const relatedCategories = crossSellCategories[categorySlug] || [];
      if (relatedCategories.length === 0) return [];

      const results = await wixData.query('Stores/Products')
        .hasSome('collections', relatedCategories)
        .ne('_id', productId)
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
        .ne('_id', productId)
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
        .gt('discount', 0)
        .descending('discount')
        .limit(limit)
        .find();

      return results.items.map(formatProduct);
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
      const product = await wixData.get('Stores/Products', productId);
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
        .ne('_id', productId)
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
