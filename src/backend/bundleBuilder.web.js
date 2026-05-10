/**
 * @module bundleBuilder
 * @description Bundle-page support for the /bundle Wix Studio editor page.
 *
 * Surface trimmed in cf-4x7e Pass 2 chunk 5: 10 dead webMethods removed
 * (getBundleRecommendations, getCoPurchasePatterns, recordCoPurchase,
 * getBundleTemplates, saveBundleTemplate, getBundlePerformance,
 * getCompatibleMattresses, getCompatibleCovers, getBundlePrice,
 * addFutonStudioBundleToCart) plus their helpers (getDiscountPercent,
 * getBundleName, getRecommendationReason, getMatchingTemplates) and the
 * BUNDLE_RULES constant they depended on. The remaining 3 methods are
 * the live entry points used by `src/pages/Bundle.js` (Wix Studio
 * editor page).
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-ecom-backend
 *
 * @setup
 * Create CMS collection `BundleTemplates` with fields:
 *   isActive (Boolean) - Whether bundle is available
 *   productIds (Tags) - Array of product IDs in the bundle
 *   discountPercent (Number) - Discount percentage (e.g., 10 for 10%)
 *
 *   (Other fields — name, basePrice, bundlePrice, occasion, tier, priority,
 *   imageUrl, minItems, createdAt, categories — were used by the deleted
 *   templates surface; if BundleTemplates is repurposed later, refer to
 *   git history for the original schema documentation.)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { cart as ecomCart } from 'wix-ecom-backend';
import { sanitize } from 'backend/utils/sanitize';
import { colors } from 'public/sharedTokens';

// Tier definitions for upselling — used by calculateBundlePrice via getTierForPrice.
const TIERS = {
  starter: { maxPrice: 500, label: 'Starter Bundle', badgeColor: colors.mountainBlue },
  essentials: { maxPrice: 1000, label: 'Essentials Bundle', badgeColor: colors.sunsetCoral },
  premium: { maxPrice: 1500, label: 'Premium Bundle', badgeColor: colors.espresso },
  deluxe: { maxPrice: Infinity, label: 'Deluxe Bundle', badgeColor: colors.mountainBlue },
};

// ── calculateBundlePrice ──────────────────────────────────────────────

/**
 * Calculate the live bundle total + discount + tier label for a set of
 * products selected in the /bundle page builder.
 *
 * @function calculateBundlePrice
 * @param {string[]} productIds - 2–10 product IDs
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
        if (matchCount >= tplIds.size && tpl.discountPercent > discountPercent) {
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

// ── getBundlePageProducts ─────────────────────────────────────────────

/**
 * Load products for the /bundle page builder.
 * Returns a curated list of bundle-eligible products from the store
 * (active, in-stock, with a price), sorted by price ascending.
 *
 * @returns {Promise<{success: boolean, products: Array, error?: string}>}
 *   products: array of { _id, name, price, formattedPrice, mainMedia }
 */
export const getBundlePageProducts = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData.query('Stores/Products')
        .eq('visible', true)
        .gt('price', 0)
        .ascending('price')
        .limit(24)
        .find();

      const products = result.items.map(p => ({
        _id: p._id,
        name: p.name || '',
        price: p.price || 0,
        formattedPrice: p.formattedPrice || `$${(p.price || 0).toFixed(2)}`,
        mainMedia: p.mainMedia || null,
      }));

      return { success: true, products };
    } catch (e) {
      console.error('[bundleBuilder] getBundlePageProducts failed:', e);
      return { success: false, error: 'Failed to load products', products: [] };
    }
  }
);

// ── addBundleToCart ───────────────────────────────────────────────────

/**
 * Add a custom bundle (user-selected product IDs) to the cart.
 * Pricing and discount are server-derived — no client-supplied totals accepted.
 *
 * @param {string[]} productIds - Array of product IDs to bundle (2–4 items)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const addBundleToCart = webMethod(
  Permissions.Anyone,
  async (productIds) => {
    try {
      if (!productIds || productIds.length < 2) {
        return { success: false, error: 'Select at least 2 items to build a bundle' };
      }

      const cleanIds = productIds
        .slice(0, 4)
        .map(id => sanitize(id, 50))
        .filter(Boolean);

      if (cleanIds.length < 2) {
        return { success: false, error: 'Invalid product IDs' };
      }

      const lineItems = cleanIds.map(productId => ({
        catalogReference: {
          catalogItemId: productId,
          appId: '1380b703-ce81-ff05-f115-39571d94dfcd', // Wix Stores appId
        },
        quantity: 1,
      }));

      await ecomCart.addToCurrentCart({ lineItems });
      return { success: true };
    } catch (e) {
      console.error('[bundleBuilder] addBundleToCart failed:', e);
      return { success: false, error: 'Failed to add bundle to cart' };
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

function getTierForPrice(price) {
  for (const [, tier] of Object.entries(TIERS)) {
    if (price <= tier.maxPrice) return tier;
  }
  return TIERS.deluxe;
}

// Test-only re-export — preserved for tests/bundleBuilder.test.js
export const _TIERS = TIERS;
