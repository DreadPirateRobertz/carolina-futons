/**
 * @module bundleBuilder
 * @description Smart bundle builder: cart-aware cross-sell with dynamic pricing.
 * Analyzes cart contents, purchase history, and co-purchase patterns to recommend
 * frame+mattress+cover bundles with real-time discount pricing. Integrates with
 * existing bundleAnalytics for tracking and productRecommendations for cross-sell.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `BundleTemplates` with fields:
 *   name (Text) - Bundle display name (e.g., "Complete College Futon Set")
 *   productIds (Tags) - Array of product IDs in the bundle
 *   categories (Tags) - Category slugs this bundle targets
 *   basePrice (Number) - Sum of individual product prices
 *   bundlePrice (Number) - Discounted bundle price
 *   discountPercent (Number) - Discount percentage (e.g., 10 for 10%)
 *   occasion (Text) - 'back_to_school'|'guest_room'|'small_space'|'outdoor'|'general'
 *   tier (Text) - 'starter'|'essentials'|'premium'|'deluxe'
 *   isActive (Boolean) - Whether bundle is available
 *   priority (Number) - Display priority (lower = shown first)
 *   imageUrl (Text) - Bundle hero image URL
 *   minItems (Number) - Minimum items to qualify (default 2)
 *   createdAt (Date) - Creation timestamp
 *
 * Create CMS collection `CoPurchasePatterns` with fields:
 *   productA (Text, indexed) - First product ID
 *   productB (Text, indexed) - Second product ID
 *   coCount (Number) - Number of times bought together
 *   lastUpdated (Date)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

// Category relationships for smart bundling
const BUNDLE_RULES = {
  'futon-frames': {
    complementary: ['mattresses', 'casegoods-accessories'],
    bundleName: 'Complete Futon Set',
    discountPercent: 10,
  },
  'mattresses': {
    complementary: ['futon-frames'],
    bundleName: 'Frame + Mattress Bundle',
    discountPercent: 8,
  },
  'murphy-cabinet-beds': {
    complementary: ['casegoods-accessories', 'platform-beds'],
    bundleName: 'Bedroom Suite',
    discountPercent: 10,
  },
  'platform-beds': {
    complementary: ['mattresses', 'casegoods-accessories'],
    bundleName: 'Platform Bed Bundle',
    discountPercent: 8,
  },
  'outdoor-furniture': {
    complementary: ['casegoods-accessories'],
    bundleName: 'Outdoor Living Set',
    discountPercent: 7,
  },
};

// Tier definitions for upselling
const TIERS = {
  starter: { maxPrice: 500, label: 'Starter Bundle', badgeColor: '#5B8FA8' },
  essentials: { maxPrice: 1000, label: 'Essentials Bundle', badgeColor: '#E8845C' },
  premium: { maxPrice: 1500, label: 'Premium Bundle', badgeColor: '#3A2518' },
  deluxe: { maxPrice: Infinity, label: 'Deluxe Bundle', badgeColor: '#C9A0A0' },
};

/**
 * Get smart bundle recommendations based on current cart contents.
 * Analyzes what's in the cart and suggests complementary products
 * with dynamic bundle pricing.
 *
 * @function getBundleRecommendations
 * @param {string[]} cartProductIds - Array of product IDs currently in cart
 * @param {string} [sessionId] - Session ID for anonymous tracking
 * @returns {Promise<{bundles: Array, savings: number}>}
 * @permission Anyone
 */
export const getBundleRecommendations = webMethod(
  Permissions.Anyone,
  async (cartProductIds, sessionId) => {
    try {
      if (!cartProductIds || cartProductIds.length === 0) {
        return { bundles: [], savings: 0 };
      }

      const cleanIds = cartProductIds
        .slice(0, 10)
        .map(id => sanitize(id, 50))
        .filter(Boolean);

      // Get cart product details
      const cartProducts = await getProductsByIds(cleanIds);
      if (cartProducts.length === 0) return { bundles: [], savings: 0 };

      // Determine which categories are in the cart
      const cartCategories = new Set();
      for (const product of cartProducts) {
        const collections = product.collections || [];
        collections.forEach(c => cartCategories.add(c));
      }

      // Find complementary categories NOT in cart
      const missingCategories = new Set();
      for (const category of cartCategories) {
        const rule = BUNDLE_RULES[category];
        if (rule) {
          rule.complementary.forEach(comp => {
            if (!cartCategories.has(comp)) {
              missingCategories.add(comp);
            }
          });
        }
      }

      // Fetch complementary products
      const bundles = [];
      let totalSavings = 0;

      if (missingCategories.size > 0) {
        const complementaryProducts = await wixData.query('Stores/Products')
          .hasSome('collections', [...missingCategories])
          .limit(8)
          .ascending('price')
          .find();

        // Group by tier
        for (const product of complementaryProducts.items) {
          const cartTotal = cartProducts.reduce((sum, p) => sum + (p.price || 0), 0);
          const bundleBasePrice = cartTotal + (product.price || 0);
          const discountPercent = getDiscountPercent(cartCategories, product.collections);
          const bundlePrice = bundleBasePrice * (1 - discountPercent / 100);
          const savings = bundleBasePrice - bundlePrice;
          const tier = getTierForPrice(bundlePrice);

          bundles.push({
            recommendedProduct: {
              _id: product._id,
              name: product.name,
              slug: product.slug,
              price: product.price,
              formattedPrice: product.formattedPrice,
              mainMedia: product.mainMedia,
            },
            bundleName: getBundleName(cartCategories, product.collections),
            bundleBasePrice: Math.round(bundleBasePrice * 100) / 100,
            bundlePrice: Math.round(bundlePrice * 100) / 100,
            savings: Math.round(savings * 100) / 100,
            discountPercent,
            tier: tier.label,
            tierBadgeColor: tier.badgeColor,
            reason: getRecommendationReason(cartCategories, product.collections),
          });

          totalSavings = Math.max(totalSavings, savings);
        }

        // Sort by savings descending (best deals first)
        bundles.sort((a, b) => b.savings - a.savings);
      }

      // Also check for predefined bundle templates
      const templates = await getMatchingTemplates(cleanIds, cartCategories);
      for (const template of templates) {
        bundles.unshift({
          templateId: template._id,
          bundleName: template.name,
          bundleBasePrice: template.basePrice,
          bundlePrice: template.bundlePrice,
          savings: Math.round((template.basePrice - template.bundlePrice) * 100) / 100,
          discountPercent: template.discountPercent,
          tier: getTierForPrice(template.bundlePrice).label,
          tierBadgeColor: getTierForPrice(template.bundlePrice).badgeColor,
          productIds: template.productIds,
          occasion: template.occasion,
          reason: `Curated ${template.occasion || 'bundle'} deal`,
          imageUrl: template.imageUrl || '',
        });
      }

      return {
        bundles: bundles.slice(0, 6),
        savings: Math.round(totalSavings * 100) / 100,
      };
    } catch (err) {
      console.error('Error getting bundle recommendations:', err);
      return { bundles: [], savings: 0 };
    }
  }
);

/**
 * Calculate dynamic bundle price for a specific set of products.
 *
 * @function calculateBundlePrice
 * @param {string[]} productIds - Product IDs to bundle
 * @returns {Promise<{basePrice: number, bundlePrice: number, savings: number, discountPercent: number, tier: string}>}
 * @permission Anyone
 */
export const calculateBundlePrice = webMethod(
  Permissions.Anyone,
  async (productIds) => {
    try {
      if (!productIds || productIds.length < 2) {
        return { basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '' };
      }

      const cleanIds = productIds.slice(0, 10).map(id => sanitize(id, 50)).filter(Boolean);
      const products = await getProductsByIds(cleanIds);

      if (products.length < 2) {
        return { basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '' };
      }

      const basePrice = products.reduce((sum, p) => sum + (p.price || 0), 0);
      const categories = new Set();
      products.forEach(p => (p.collections || []).forEach(c => categories.add(c)));

      // More categories in bundle = higher discount
      let discountPercent = 5; // base 5%
      if (categories.size >= 2) discountPercent = 8;
      if (categories.size >= 3) discountPercent = 10;
      if (products.length >= 4) discountPercent = 12;

      // Check for predefined template with better discount
      const templateMatch = await wixData.query('BundleTemplates')
        .eq('isActive', true)
        .find();

      for (const tpl of templateMatch.items) {
        const tplIds = new Set(tpl.productIds || []);
        const matchCount = cleanIds.filter(id => tplIds.has(id)).length;
        if (matchCount >= Math.min(tplIds.size, cleanIds.length) && tpl.discountPercent > discountPercent) {
          discountPercent = tpl.discountPercent;
        }
      }

      const bundlePrice = basePrice * (1 - discountPercent / 100);
      const savings = basePrice - bundlePrice;
      const tier = getTierForPrice(bundlePrice);

      return {
        basePrice: Math.round(basePrice * 100) / 100,
        bundlePrice: Math.round(bundlePrice * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        discountPercent,
        tier: tier.label,
      };
    } catch (err) {
      console.error('Error calculating bundle price:', err);
      return { basePrice: 0, bundlePrice: 0, savings: 0, discountPercent: 0, tier: '' };
    }
  }
);

/**
 * Get co-purchase patterns: products frequently bought together.
 * Used to generate data-driven bundle recommendations.
 *
 * @function getCoPurchasePatterns
 * @param {string} productId - Product to find co-purchase patterns for
 * @param {number} [limit=5] - Max patterns to return
 * @returns {Promise<Array<{productId: string, productName: string, coCount: number}>>}
 * @permission Anyone
 */
export const getCoPurchasePatterns = webMethod(
  Permissions.Anyone,
  async (productId, limit = 5) => {
    try {
      if (!productId) return [];

      const cleanId = sanitize(productId, 50);
      const safeLimit = Math.min(Math.max(1, limit), 20);

      // Find all co-purchase records for this product
      const resultA = await wixData.query('CoPurchasePatterns')
        .eq('productA', cleanId)
        .descending('coCount')
        .limit(safeLimit)
        .find();

      const resultB = await wixData.query('CoPurchasePatterns')
        .eq('productB', cleanId)
        .descending('coCount')
        .limit(safeLimit)
        .find();

      // Merge and deduplicate
      const patterns = new Map();
      for (const item of [...resultA.items, ...resultB.items]) {
        const partnerId = item.productA === cleanId ? item.productB : item.productA;
        if (!patterns.has(partnerId) || patterns.get(partnerId).coCount < item.coCount) {
          patterns.set(partnerId, { productId: partnerId, coCount: item.coCount });
        }
      }

      // Enrich with product names
      const enriched = [];
      for (const [partnerId, data] of patterns) {
        try {
          const product = await wixData.get('Stores/Products', partnerId);
          enriched.push({
            productId: partnerId,
            productName: product?.name || '',
            coCount: data.coCount,
            price: product?.price || 0,
            mainMedia: product?.mainMedia || null,
          });
        } catch (e) {
          enriched.push({ productId: partnerId, productName: '', coCount: data.coCount, price: 0, mainMedia: null });
        }
      }

      return enriched.sort((a, b) => b.coCount - a.coCount).slice(0, safeLimit);
    } catch (err) {
      console.error('Error getting co-purchase patterns:', err);
      return [];
    }
  }
);

/**
 * Record a co-purchase event when an order contains multiple products.
 * Should be called from wixEcom_onOrderCreated event handler.
 *
 * @function recordCoPurchase
 * @param {string[]} productIds - Product IDs from a single order
 * @returns {Promise<{success: boolean, pairsRecorded: number}>}
 * @permission Admin
 */
export const recordCoPurchase = webMethod(
  Permissions.Admin,
  async (productIds) => {
    try {
      if (!productIds || productIds.length < 2) return { success: false, pairsRecorded: 0 };

      const cleanIds = productIds.slice(0, 20).map(id => sanitize(id, 50)).filter(Boolean);
      let pairsRecorded = 0;

      // Record all pairs
      for (let i = 0; i < cleanIds.length; i++) {
        for (let j = i + 1; j < cleanIds.length; j++) {
          const [a, b] = [cleanIds[i], cleanIds[j]].sort();

          // Check if pair exists
          const existing = await wixData.query('CoPurchasePatterns')
            .eq('productA', a)
            .eq('productB', b)
            .find();

          if (existing.items.length > 0) {
            await wixData.update('CoPurchasePatterns', {
              ...existing.items[0],
              coCount: (existing.items[0].coCount || 0) + 1,
              lastUpdated: new Date(),
            });
          } else {
            await wixData.insert('CoPurchasePatterns', {
              productA: a,
              productB: b,
              coCount: 1,
              lastUpdated: new Date(),
            });
          }
          pairsRecorded++;
        }
      }

      return { success: true, pairsRecorded };
    } catch (err) {
      console.error('Error recording co-purchase:', err);
      return { success: false, pairsRecorded: 0 };
    }
  }
);

/**
 * Get all active bundle templates for admin management.
 *
 * @function getBundleTemplates
 * @param {string} [occasion] - Filter by occasion
 * @returns {Promise<Array>}
 * @permission Admin
 */
export const getBundleTemplates = webMethod(
  Permissions.Admin,
  async (occasion) => {
    try {
      let query = wixData.query('BundleTemplates').eq('isActive', true);
      if (occasion) {
        query = query.eq('occasion', sanitize(occasion, 50));
      }

      const result = await query.ascending('priority').find();
      return result.items;
    } catch (err) {
      console.error('Error fetching bundle templates:', err);
      return [];
    }
  }
);

/**
 * Create or update a bundle template.
 *
 * @function saveBundleTemplate
 * @param {Object} template - Bundle template data
 * @returns {Promise<{success: boolean, templateId: string}>}
 * @permission Admin
 */
export const saveBundleTemplate = webMethod(
  Permissions.Admin,
  async (template) => {
    try {
      if (!template || !template.name || !template.productIds || template.productIds.length < 2) {
        return { success: false, templateId: '' };
      }

      const data = {
        name: sanitize(template.name, 200),
        productIds: template.productIds.slice(0, 10).map(id => sanitize(id, 50)),
        categories: (template.categories || []).map(c => sanitize(c, 100)),
        basePrice: Number(template.basePrice) || 0,
        bundlePrice: Number(template.bundlePrice) || 0,
        discountPercent: Math.min(Math.max(Number(template.discountPercent) || 0, 0), 50),
        occasion: sanitize(template.occasion || 'general', 50),
        tier: sanitize(template.tier || 'essentials', 50),
        isActive: template.isActive !== false,
        priority: Number(template.priority) || 10,
        imageUrl: sanitize(template.imageUrl || '', 500),
        minItems: Number(template.minItems) || 2,
        createdAt: new Date(),
      };

      let result;
      if (template._id) {
        data._id = template._id;
        result = await wixData.update('BundleTemplates', data);
      } else {
        result = await wixData.insert('BundleTemplates', data);
      }

      return { success: true, templateId: result._id };
    } catch (err) {
      console.error('Error saving bundle template:', err);
      return { success: false, templateId: '' };
    }
  }
);

/**
 * Get bundle performance stats from analytics data.
 *
 * @function getBundlePerformance
 * @param {number} [days=30] - Lookback window
 * @returns {Promise<{totalImpressions: number, totalClicks: number, totalPurchases: number, conversionRate: number, topBundles: Array}>}
 * @permission Admin
 */
export const getBundlePerformance = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await wixData.query('BundleAnalytics')
        .ge('timestamp', since)
        .find();

      const stats = {};
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalPurchases = 0;
      let totalRevenue = 0;

      for (const item of result.items) {
        const bundleId = item.bundleId || 'unknown';
        if (!stats[bundleId]) {
          stats[bundleId] = { bundleId, bundleName: item.bundleName || '', impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
        }

        if (item.event === 'impression') { stats[bundleId].impressions++; totalImpressions++; }
        if (item.event === 'click') { stats[bundleId].clicks++; totalClicks++; }
        if (item.event === 'purchase') { stats[bundleId].purchases++; totalPurchases++; stats[bundleId].revenue += item.revenue || 0; totalRevenue += item.revenue || 0; }
      }

      const topBundles = Object.values(stats)
        .map(s => ({
          ...s,
          clickRate: s.impressions > 0 ? Math.round((s.clicks / s.impressions) * 10000) / 100 : 0,
          conversionRate: s.impressions > 0 ? Math.round((s.purchases / s.impressions) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return {
        totalImpressions,
        totalClicks,
        totalPurchases,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        conversionRate: totalImpressions > 0 ? Math.round((totalPurchases / totalImpressions) * 10000) / 100 : 0,
        topBundles,
      };
    } catch (err) {
      console.error('Error getting bundle performance:', err);
      return { totalImpressions: 0, totalClicks: 0, totalPurchases: 0, totalRevenue: 0, conversionRate: 0, topBundles: [] };
    }
  }
);

// ── Internal Helpers ──────────────────────────────────────────────────

async function getProductsByIds(ids) {
  if (ids.length === 0) return [];

  const results = [];
  for (const id of ids) {
    try {
      const product = await wixData.get('Stores/Products', id);
      if (product) results.push(product);
    } catch (e) {
      // Product not found, skip
    }
  }
  return results;
}

function getDiscountPercent(cartCategories, productCollections) {
  let maxDiscount = 5;
  for (const category of cartCategories) {
    const rule = BUNDLE_RULES[category];
    if (rule) {
      const hasComplement = (productCollections || []).some(c => rule.complementary.includes(c));
      if (hasComplement && rule.discountPercent > maxDiscount) {
        maxDiscount = rule.discountPercent;
      }
    }
  }
  return maxDiscount;
}

function getBundleName(cartCategories, productCollections) {
  for (const category of cartCategories) {
    const rule = BUNDLE_RULES[category];
    if (rule) {
      const hasComplement = (productCollections || []).some(c => rule.complementary.includes(c));
      if (hasComplement) return rule.bundleName;
    }
  }
  return 'Custom Bundle';
}

function getRecommendationReason(cartCategories, productCollections) {
  if (cartCategories.has('futon-frames') && (productCollections || []).includes('mattresses')) {
    return 'Complete your futon — add a mattress and save';
  }
  if (cartCategories.has('mattresses') && (productCollections || []).includes('futon-frames')) {
    return 'Pair with a frame for the perfect setup';
  }
  if (cartCategories.has('platform-beds') && (productCollections || []).includes('mattresses')) {
    return 'Add a mattress to complete your bedroom';
  }
  return 'Frequently bought together — save with a bundle';
}

function getTierForPrice(price) {
  for (const [key, tier] of Object.entries(TIERS)) {
    if (price <= tier.maxPrice) return tier;
  }
  return TIERS.deluxe;
}

async function getMatchingTemplates(productIds, cartCategories) {
  try {
    const result = await wixData.query('BundleTemplates')
      .eq('isActive', true)
      .ascending('priority')
      .limit(10)
      .find();

    return result.items.filter(tpl => {
      const tplCategories = new Set(tpl.categories || []);
      return [...cartCategories].some(c => tplCategories.has(c));
    });
  } catch (e) {
    return [];
  }
}

// Export for testing
export const _BUNDLE_RULES = BUNDLE_RULES;
export const _TIERS = TIERS;
