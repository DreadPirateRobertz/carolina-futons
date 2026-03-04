/**
 * @module dynamicPricing
 * @description Dynamic pricing engine: demand-based pricing, geographic adjustments,
 * clearance automation, and bundle discounting rules. Calculates real-time adjusted
 * prices based on demand signals, customer location, product age, and bundle composition.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collection `ProductDemandMetrics` with fields:
 *   productId (Text, indexed) - Product ID
 *   viewCount30d (Number) - Page views in last 30 days
 *   cartAdds30d (Number) - Cart additions in last 30 days
 *   salesCount30d (Number) - Purchases in last 30 days
 *   demandScore (Number) - Computed 0-100 score
 *   listedDate (Date) - When product was first listed
 *   updatedAt (Date) - Last metric update
 *
 * Create CMS collection `DynamicPricingRules` with fields:
 *   name (Text) - Rule display name
 *   type (Text) - 'seasonal'|'demand'|'clearance'|'geographic'
 *   discountPercent (Number) - Discount percentage 0-50
 *   startDate (Date) - Rule start date
 *   endDate (Date) - Rule end date
 *   categories (Tags) - Applicable product categories
 *   isActive (Boolean) - Whether rule is active
 *   priority (Number) - Rule priority (lower = higher priority)
 *
 * Create CMS collection `ClearanceQueue` with fields:
 *   productId (Text, indexed) - Product ID
 *   productName (Text) - Product name
 *   clearancePercent (Number) - Discount percentage
 *   reason (Text) - 'slow_mover'|'overstock'|'seasonal'|'discontinued'
 *   addedAt (Date) - When added to clearance
 *   isActive (Boolean) - Whether clearance is active
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { shippingConfig } from 'public/sharedTokens.js';

// ── Constants ────────────────────────────────────────────────────────

/** Demand-based price multipliers */
const DEMAND_MULTIPLIERS = {
  high: { minScore: 75, multiplier: 1.05 },   // +5% for high demand
  medium: { minScore: 40, multiplier: 1.0 },   // no change for medium
  low: { minScore: 10, multiplier: 0.95 },     // -5% for low demand
  veryLow: { minScore: 0, multiplier: 0.90 },  // -10% for very low demand
};

/** Geographic pricing zones based on shippingConfig */
const GEOGRAPHIC_ZONES = {
  local: {
    prefixMin: shippingConfig.zones.local.prefixMin,
    prefixMax: shippingConfig.zones.local.prefixMax,
    name: shippingConfig.zones.local.name,
    adjustmentPercent: -3, // 3% local discount
  },
  regional: {
    prefixMin: shippingConfig.zones.regional.prefixMin,
    prefixMax: shippingConfig.zones.regional.prefixMax,
    name: shippingConfig.zones.regional.name,
    adjustmentPercent: 0, // base price for regional
  },
  national: {
    name: 'National',
    adjustmentPercent: 2, // 2% surcharge for national shipping cost offset
  },
};

/** Clearance automation thresholds */
const CLEARANCE_THRESHOLDS = {
  daysUntilClearance: 90,   // Products listed 90+ days with low demand
  velocityThreshold: 15,     // Demand score below this triggers clearance evaluation
  minDiscountPercent: 10,    // Minimum clearance discount
  maxDiscountPercent: 50,    // Maximum clearance discount
  ageFactor: 0.1,            // Additional % per 30 days over threshold
};

/** Bundle discount tiers */
const BUNDLE_TIERS = [
  { minItems: 2, minCategories: 1, discountPercent: 5, label: 'Starter Bundle' },
  { minItems: 2, minCategories: 2, discountPercent: 8, label: 'Combo Deal' },
  { minItems: 3, minCategories: 2, discountPercent: 10, label: 'Complete Set' },
  { minItems: 3, minCategories: 3, discountPercent: 12, label: 'Full Room' },
  { minItems: 4, minCategories: 3, discountPercent: 15, label: 'Ultimate Bundle' },
];

/** Complementary category pairs that earn bonus discounts */
const COMPLEMENTARY_PAIRS = {
  'futon-frames': ['mattresses', 'casegoods-accessories'],
  'mattresses': ['futon-frames', 'platform-beds'],
  'platform-beds': ['mattresses', 'casegoods-accessories'],
  'murphy-cabinet-beds': ['casegoods-accessories', 'platform-beds'],
  'outdoor-furniture': ['casegoods-accessories'],
};

/** Price guard rails */
const PRICE_FLOOR_PERCENT = 50;    // Never below 50% of base price
const PRICE_CEILING_PERCENT = 115; // Never above 115% of base price
const VALID_SIGNAL_TYPES = ['view', 'cart_add', 'purchase'];

// ── calculateDynamicPrice ────────────────────────────────────────────

/**
 * Calculate the dynamic adjusted price for a product based on demand,
 * geography, and clearance status.
 *
 * @function calculateDynamicPrice
 * @param {string} productId - Product ID to price
 * @param {Object} [options] - { zipCode, includeClearance }
 * @returns {Promise<{adjustedPrice: number, basePrice: number, demandMultiplier: number, geoAdjustment: number, clearanceDiscount: number, reason: string}>}
 * @permission Anyone
 */
export const calculateDynamicPrice = webMethod(
  Permissions.Anyone,
  async (productId, options = {}) => {
    const empty = {
      adjustedPrice: 0, basePrice: 0, demandMultiplier: 1,
      geoAdjustment: 0, clearanceDiscount: 0, reason: 'invalid_input',
    };

    try {
      if (!productId) return empty;

      const cleanId = sanitize(productId, 50);
      if (!cleanId) return empty;

      // Fetch product
      const product = await wixData.get('Stores/Products', cleanId);
      if (!product) return { ...empty, reason: 'product_not_found' };

      const basePrice = product.price || 0;
      if (basePrice <= 0) return { ...empty, basePrice, reason: 'no_price' };

      // 1. Get demand metrics
      let demandMultiplier = 1;
      let demandReason = '';

      const metricsResult = await wixData.query('ProductDemandMetrics')
        .eq('productId', cleanId)
        .limit(1)
        .find();

      if (metricsResult.items.length > 0) {
        const metrics = metricsResult.items[0];
        const score = metrics.demandScore || 0;

        if (score >= DEMAND_MULTIPLIERS.high.minScore) {
          demandMultiplier = DEMAND_MULTIPLIERS.high.multiplier;
          demandReason = 'high_demand';
        } else if (score >= DEMAND_MULTIPLIERS.medium.minScore) {
          demandMultiplier = DEMAND_MULTIPLIERS.medium.multiplier;
          demandReason = 'normal_demand';
        } else if (score >= DEMAND_MULTIPLIERS.low.minScore) {
          demandMultiplier = DEMAND_MULTIPLIERS.low.multiplier;
          demandReason = 'low_demand';
        } else {
          demandMultiplier = DEMAND_MULTIPLIERS.veryLow.multiplier;
          demandReason = 'very_low_demand';
        }
      }

      // 2. Check for active pricing rules
      const rulesResult = await wixData.query('DynamicPricingRules')
        .eq('isActive', true)
        .le('startDate', new Date())
        .ge('endDate', new Date())
        .ascending('priority')
        .limit(5)
        .find();

      let ruleDiscount = 0;
      for (const rule of rulesResult.items) {
        const ruleCategories = rule.categories || [];
        const productCategories = product.collections || [];
        if (ruleCategories.length === 0 || ruleCategories.some(c => productCategories.includes(c))) {
          ruleDiscount = Math.max(ruleDiscount, rule.discountPercent || 0);
        }
      }

      // 3. Geographic adjustment
      let geoAdjustment = 0;
      if (options.zipCode) {
        const geoResult = getGeographicAdjustment(options.zipCode, basePrice);
        geoAdjustment = geoResult.adjustment;
      }

      // 4. Clearance discount
      let clearanceDiscount = 0;
      if (options.includeClearance) {
        const clearanceResult = await wixData.query('ClearanceQueue')
          .eq('productId', cleanId)
          .eq('isActive', true)
          .limit(1)
          .find();

        if (clearanceResult.items.length > 0) {
          clearanceDiscount = clearanceResult.items[0].clearancePercent || 0;
        }
      }

      // Calculate final price
      let adjustedPrice = basePrice * demandMultiplier;
      adjustedPrice += geoAdjustment;
      adjustedPrice *= (1 - ruleDiscount / 100);
      adjustedPrice *= (1 - clearanceDiscount / 100);

      // Apply guard rails
      const floor = basePrice * (PRICE_FLOOR_PERCENT / 100);
      const ceiling = basePrice * (PRICE_CEILING_PERCENT / 100);
      adjustedPrice = Math.max(floor, Math.min(ceiling, adjustedPrice));
      adjustedPrice = Math.round(adjustedPrice * 100) / 100;

      const reasons = [demandReason];
      if (ruleDiscount > 0) reasons.push('pricing_rule');
      if (geoAdjustment !== 0) reasons.push('geographic');
      if (clearanceDiscount > 0) reasons.push('clearance');

      return {
        adjustedPrice,
        basePrice,
        demandMultiplier,
        geoAdjustment: Math.round(geoAdjustment * 100) / 100,
        clearanceDiscount,
        reason: reasons.filter(Boolean).join('+') || 'base_price',
      };
    } catch (err) {
      console.error('Error calculating dynamic price:', err);
      return { ...empty, reason: 'error' };
    }
  }
);

// ── getGeographicAdjustment ──────────────────────────────────────────

/**
 * Calculate price adjustment based on customer ZIP code.
 * Local customers get a discount, national customers see a small surcharge
 * to offset higher shipping costs.
 *
 * @function getGeographicAdjustment
 * @param {string} zipCode - Customer's 5-digit ZIP code
 * @param {number} basePrice - Product base price
 * @returns {{adjustment: number, zone: string, reason: string}}
 */
export function getGeographicAdjustment(zipCode, basePrice) {
  if (!zipCode || typeof zipCode !== 'string') {
    return { adjustment: 0, zone: 'unknown', reason: 'no_zip' };
  }

  const cleaned = zipCode.replace(/\D/g, '');
  if (cleaned.length < 3) {
    return { adjustment: 0, zone: 'unknown', reason: 'invalid_zip' };
  }

  if (basePrice <= 0) {
    return { adjustment: 0, zone: 'unknown', reason: 'no_price' };
  }

  const prefix = parseInt(cleaned.substring(0, 3), 10);
  if (isNaN(prefix)) {
    return { adjustment: 0, zone: 'unknown', reason: 'invalid_zip' };
  }

  // Determine zone
  if (prefix >= GEOGRAPHIC_ZONES.local.prefixMin && prefix <= GEOGRAPHIC_ZONES.local.prefixMax) {
    const adjustment = Math.round(basePrice * (GEOGRAPHIC_ZONES.local.adjustmentPercent / 100) * 100) / 100;
    return { adjustment, zone: 'local', reason: `${GEOGRAPHIC_ZONES.local.name} local discount` };
  }

  if (prefix >= GEOGRAPHIC_ZONES.regional.prefixMin && prefix <= GEOGRAPHIC_ZONES.regional.prefixMax) {
    const adjustment = Math.round(basePrice * (GEOGRAPHIC_ZONES.regional.adjustmentPercent / 100) * 100) / 100;
    return { adjustment, zone: 'regional', reason: `${GEOGRAPHIC_ZONES.regional.name} base pricing` };
  }

  // National
  const adjustment = Math.round(basePrice * (GEOGRAPHIC_ZONES.national.adjustmentPercent / 100) * 100) / 100;
  return { adjustment, zone: 'national', reason: 'National pricing' };
}

// ── evaluateClearanceCandidates ──────────────────────────────────────

/**
 * Evaluate products for automatic clearance based on listing age and demand.
 * Returns candidates with suggested discount percentages.
 *
 * @function evaluateClearanceCandidates
 * @returns {Promise<{candidates: Array<{productId: string, productName: string, daysListed: number, demandScore: number, suggestedDiscount: number, reason: string}>, evaluated: number}>}
 * @permission Admin
 */
export const evaluateClearanceCandidates = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query('ProductDemandMetrics')
        .le('demandScore', CLEARANCE_THRESHOLDS.velocityThreshold)
        .find();

      const candidates = [];
      const now = Date.now();

      for (const item of result.items) {
        // Double-check demand score (defensive — query should have filtered)
        if ((item.demandScore || 0) > CLEARANCE_THRESHOLDS.velocityThreshold) continue;

        const listedDate = item.listedDate ? new Date(item.listedDate).getTime() : now;
        const daysListed = Math.floor((now - listedDate) / (24 * 60 * 60 * 1000));

        if (daysListed < CLEARANCE_THRESHOLDS.daysUntilClearance) continue;

        // Calculate suggested discount based on age and demand score
        const ageOverThreshold = daysListed - CLEARANCE_THRESHOLDS.daysUntilClearance;
        const ageBonusMonths = Math.floor(ageOverThreshold / 30);
        const ageDiscount = ageBonusMonths * CLEARANCE_THRESHOLDS.ageFactor * 100;

        // Lower demand = higher discount
        const demandPenalty = Math.max(0, CLEARANCE_THRESHOLDS.velocityThreshold - (item.demandScore || 0));
        const demandDiscount = demandPenalty * 0.5;

        let suggestedDiscount = CLEARANCE_THRESHOLDS.minDiscountPercent + ageDiscount + demandDiscount;
        suggestedDiscount = Math.min(suggestedDiscount, CLEARANCE_THRESHOLDS.maxDiscountPercent);
        suggestedDiscount = Math.round(suggestedDiscount * 100) / 100;

        let reason = 'slow_mover';
        if (daysListed > 365) reason = 'long_shelf_life';
        if ((item.salesCount30d || 0) === 0 && daysListed > 180) reason = 'no_recent_sales';

        candidates.push({
          productId: item.productId,
          productName: item.productName || '',
          daysListed,
          demandScore: item.demandScore || 0,
          suggestedDiscount,
          reason,
        });
      }

      // Sort by suggested discount descending (highest priority first)
      candidates.sort((a, b) => b.suggestedDiscount - a.suggestedDiscount);

      return { candidates, evaluated: result.items.length };
    } catch (err) {
      console.error('Error evaluating clearance candidates:', err);
      return { candidates: [], evaluated: 0 };
    }
  }
);

// ── calculateBundleDiscount ──────────────────────────────────────────

/**
 * Calculate the bundle discount for a set of items based on count,
 * category diversity, and complementary pairings.
 *
 * @function calculateBundleDiscount
 * @param {Array<{productId: string, price: number, category: string}>} items
 * @returns {Promise<{discountPercent: number, discountAmount: number, tier: string, reason: string}>}
 * @permission Anyone
 */
export const calculateBundleDiscount = webMethod(
  Permissions.Anyone,
  async (items) => {
    const empty = { discountPercent: 0, discountAmount: 0, tier: '', reason: 'insufficient_items' };

    try {
      if (!items || !Array.isArray(items)) return empty;

      // Filter to valid items with positive prices
      const validItems = items.filter(i => i && typeof i.price === 'number' && i.price > 0);
      if (validItems.length < 2) return empty;

      const totalPrice = validItems.reduce((sum, i) => sum + i.price, 0);
      const categories = new Set(validItems.map(i => i.category).filter(Boolean));
      const categoryCount = categories.size;

      // Check for complementary pairings
      let hasComplementary = false;
      for (const cat of categories) {
        const complements = COMPLEMENTARY_PAIRS[cat] || [];
        if (complements.some(c => categories.has(c))) {
          hasComplementary = true;
          break;
        }
      }

      // Find the best matching tier
      let bestTier = null;
      let bestDiscount = 0;

      for (const tier of BUNDLE_TIERS) {
        if (validItems.length >= tier.minItems && categoryCount >= tier.minCategories) {
          if (tier.discountPercent > bestDiscount) {
            bestDiscount = tier.discountPercent;
            bestTier = tier;
          }
        }
      }

      if (!bestTier) {
        // Fallback: 2+ items same category = base 5% (already tier[0], but safety check)
        if (validItems.length >= 2) {
          bestDiscount = 5;
          bestTier = BUNDLE_TIERS[0];
        } else {
          return empty;
        }
      }

      // Apply complementary bonus (+2%)
      let discountPercent = bestDiscount;
      if (hasComplementary && categoryCount >= 2) {
        discountPercent = Math.min(discountPercent + 2, 15);
      }

      const discountAmount = Math.round(totalPrice * (discountPercent / 100) * 100) / 100;

      let reason = bestTier.label;
      if (hasComplementary) reason += ' + complementary bonus';

      return {
        discountPercent,
        discountAmount,
        tier: bestTier.label,
        reason,
      };
    } catch (err) {
      console.error('Error calculating bundle discount:', err);
      return { discountPercent: 0, discountAmount: 0, tier: '', reason: 'error' };
    }
  }
);

// ── recordDemandSignal ───────────────────────────────────────────────

/**
 * Record a demand signal (view, cart_add, purchase) for a product.
 * Used by frontend event handlers to feed the demand scoring engine.
 *
 * @function recordDemandSignal
 * @param {string} productId - Product ID
 * @param {string} signalType - 'view' | 'cart_add' | 'purchase'
 * @returns {Promise<{success: boolean, error?: string}>}
 * @permission Anyone
 */
export const recordDemandSignal = webMethod(
  Permissions.Anyone,
  async (productId, signalType) => {
    try {
      if (!productId) return { success: false, error: 'Product ID required' };

      const cleanId = sanitize(productId, 50);
      if (!cleanId) return { success: false, error: 'Product ID required' };

      if (!VALID_SIGNAL_TYPES.includes(signalType)) {
        return { success: false, error: `Invalid signal type. Must be: ${VALID_SIGNAL_TYPES.join(', ')}` };
      }

      // Find existing metrics
      const existing = await wixData.query('ProductDemandMetrics')
        .eq('productId', cleanId)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        const metrics = existing.items[0];

        if (signalType === 'view') metrics.viewCount30d = (metrics.viewCount30d || 0) + 1;
        if (signalType === 'cart_add') metrics.cartAdds30d = (metrics.cartAdds30d || 0) + 1;
        if (signalType === 'purchase') metrics.salesCount30d = (metrics.salesCount30d || 0) + 1;

        metrics.demandScore = computeDemandScore(metrics);
        metrics.updatedAt = new Date();

        await wixData.update('ProductDemandMetrics', metrics);
      } else {
        const newMetrics = {
          productId: cleanId,
          viewCount30d: signalType === 'view' ? 1 : 0,
          cartAdds30d: signalType === 'cart_add' ? 1 : 0,
          salesCount30d: signalType === 'purchase' ? 1 : 0,
          demandScore: 0,
          listedDate: new Date(),
          updatedAt: new Date(),
        };
        newMetrics.demandScore = computeDemandScore(newMetrics);

        await wixData.insert('ProductDemandMetrics', newMetrics);
      }

      return { success: true };
    } catch (err) {
      console.error('Error recording demand signal:', err);
      return { success: false, error: 'Failed to record signal' };
    }
  }
);

// ── getDemandMetrics ─────────────────────────────────────────────────

/**
 * Get demand metrics for a specific product.
 *
 * @function getDemandMetrics
 * @param {string} productId - Product ID
 * @returns {Promise<{viewCount30d: number, cartAdds30d: number, salesCount30d: number, demandScore: number, updatedAt: Date|null}>}
 * @permission Anyone
 */
export const getDemandMetrics = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const empty = { viewCount30d: 0, cartAdds30d: 0, salesCount30d: 0, demandScore: 0, updatedAt: null };

    try {
      if (!productId) return empty;

      const cleanId = sanitize(productId, 50);
      if (!cleanId) return empty;

      const result = await wixData.query('ProductDemandMetrics')
        .eq('productId', cleanId)
        .limit(1)
        .find();

      if (result.items.length === 0) return empty;

      const m = result.items[0];
      return {
        viewCount30d: m.viewCount30d || 0,
        cartAdds30d: m.cartAdds30d || 0,
        salesCount30d: m.salesCount30d || 0,
        demandScore: m.demandScore || 0,
        updatedAt: m.updatedAt || null,
      };
    } catch (err) {
      console.error('Error getting demand metrics:', err);
      return empty;
    }
  }
);

// ── getClearanceQueue ────────────────────────────────────────────────

/**
 * Get all products currently in the clearance queue.
 *
 * @function getClearanceQueue
 * @returns {Promise<{items: Array}>}
 * @permission Admin
 */
export const getClearanceQueue = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query('ClearanceQueue')
        .eq('isActive', true)
        .descending('clearancePercent')
        .find();

      return {
        items: result.items.map(item => ({
          productId: item.productId,
          productName: item.productName || '',
          clearancePercent: item.clearancePercent || 0,
          reason: item.reason || '',
          addedAt: item.addedAt || null,
        })),
      };
    } catch (err) {
      console.error('Error getting clearance queue:', err);
      return { items: [] };
    }
  }
);

// ── updatePricingRule ────────────────────────────────────────────────

/**
 * Create or update a dynamic pricing rule.
 *
 * @function updatePricingRule
 * @param {Object} rule - Rule data
 * @param {string} rule.name - Rule name
 * @param {string} rule.type - 'seasonal'|'demand'|'clearance'|'geographic'
 * @param {number} rule.discountPercent - Discount percentage 0-50
 * @param {Date} [rule.startDate] - Rule start date
 * @param {Date} [rule.endDate] - Rule end date
 * @param {string[]} [rule.categories] - Applicable categories
 * @param {boolean} [rule.isActive=true] - Whether active
 * @returns {Promise<{success: boolean, ruleId?: string}>}
 * @permission Admin
 */
export const updatePricingRule = webMethod(
  Permissions.Admin,
  async (rule) => {
    try {
      if (!rule || !rule.name || !rule.type) {
        return { success: false, error: 'Name and type required' };
      }

      const data = {
        name: sanitize(rule.name, 200),
        type: sanitize(rule.type, 50),
        discountPercent: Math.min(Math.max(Number(rule.discountPercent) || 0, 0), 50),
        startDate: rule.startDate || new Date(),
        endDate: rule.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        categories: (rule.categories || []).map(c => sanitize(c, 100)),
        isActive: rule.isActive !== false,
        priority: Number(rule.priority) || 10,
        updatedAt: new Date(),
      };

      let result;
      if (rule._id) {
        data._id = rule._id;
        result = await wixData.update('DynamicPricingRules', data);
      } else {
        result = await wixData.insert('DynamicPricingRules', data);
      }

      return { success: true, ruleId: result._id };
    } catch (err) {
      console.error('Error updating pricing rule:', err);
      return { success: false, error: 'Failed to save rule' };
    }
  }
);

// ── Internal Helpers ─────────────────────────────────────────────────

/**
 * Compute a 0-100 demand score from raw metrics.
 * Weights: views (20%), cart adds (30%), purchases (50%).
 */
function computeDemandScore(metrics) {
  const views = metrics.viewCount30d || 0;
  const carts = metrics.cartAdds30d || 0;
  const sales = metrics.salesCount30d || 0;

  // Normalize each metric to a 0-100 scale using logarithmic scaling
  const viewScore = Math.min(100, Math.log1p(views) / Math.log1p(500) * 100);
  const cartScore = Math.min(100, Math.log1p(carts) / Math.log1p(50) * 100);
  const saleScore = Math.min(100, Math.log1p(sales) / Math.log1p(20) * 100);

  // Weighted average
  const score = viewScore * 0.2 + cartScore * 0.3 + saleScore * 0.5;
  return Math.round(Math.min(100, Math.max(0, score)));
}

// Exports for testing
export const _DEMAND_MULTIPLIERS = DEMAND_MULTIPLIERS;
export const _GEOGRAPHIC_ZONES = GEOGRAPHIC_ZONES;
export const _CLEARANCE_THRESHOLDS = CLEARANCE_THRESHOLDS;
export const _BUNDLE_TIERS = BUNDLE_TIERS;
