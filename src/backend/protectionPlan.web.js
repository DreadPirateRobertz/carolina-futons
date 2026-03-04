/**
 * @module protectionPlan
 * @description Protection plan upsell service for furniture warranty add-ons.
 * Offers tiered warranty plans (basic/extended/premium) calculated as a
 * percentage of each product's price. Selections are stored per session
 * in the ProtectionPlanSelections CMS collection and surfaced during checkout.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create CMS collection `ProtectionPlanSelections` with fields:
 *   sessionId (Text, indexed) - Browser session identifier
 *   productId (Text, indexed) - Product the plan covers
 *   productName (Text) - Product display name
 *   tier (Text) - 'basic'|'extended'|'premium'
 *   price (Number) - Calculated plan price
 *   durationYears (Number) - Coverage duration
 *   createdAt (Date)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';

const SELECTIONS_COLLECTION = 'ProtectionPlanSelections';

/**
 * Protection plan tier definitions.
 * Price is calculated as pricePercent of the product price.
 */
export const PLAN_TIERS = {
  basic: {
    name: '1-Year Basic Protection',
    durationYears: 1,
    pricePercent: 6,
    coverage: [
      'Manufacturing defects',
      'Structural failures',
      'Hardware malfunctions',
    ],
  },
  extended: {
    name: '3-Year Extended Protection',
    durationYears: 3,
    pricePercent: 12,
    coverage: [
      'Manufacturing defects',
      'Structural failures',
      'Hardware malfunctions',
      'Accidental damage (stains, rips, burns)',
      'Mechanism failures',
    ],
  },
  premium: {
    name: '5-Year Premium Protection',
    durationYears: 5,
    pricePercent: 18,
    coverage: [
      'Manufacturing defects',
      'Structural failures',
      'Hardware malfunctions',
      'Accidental damage (stains, rips, burns)',
      'Mechanism failures',
      'Normal wear and tear',
      'Fabric pilling and fading',
      'In-home service calls',
    ],
  },
};

/**
 * Get available protection plans for a set of products.
 * Returns tier options with calculated prices for each eligible product.
 *
 * @function getProtectionPlans
 * @param {string[]} productIds - Product IDs to get plans for
 * @param {string} [sessionId] - Session ID to check for existing selections
 * @returns {Promise<{success: boolean, plans: Array}>}
 * @permission Anyone
 */
export const getProtectionPlans = webMethod(
  Permissions.Anyone,
  async (productIds, sessionId) => {
    try {
      if (!productIds || productIds.length === 0) {
        return { success: true, plans: [] };
      }

      const cleanIds = productIds
        .slice(0, 10)
        .map(id => validateId(id))
        .filter(Boolean);

      if (cleanIds.length === 0) {
        return { success: true, plans: [] };
      }

      // Fetch existing selections for this session
      let existingSelections = new Map();
      if (sessionId) {
        const cleanSession = sanitize(sessionId, 100);
        const selResult = await wixData.query(SELECTIONS_COLLECTION)
          .eq('sessionId', cleanSession)
          .find();
        for (const sel of selResult.items) {
          existingSelections.set(sel.productId, sel.tier);
        }
      }

      const plans = [];
      for (const id of cleanIds) {
        try {
          const product = await wixData.get('Stores/Products', id);
          if (!product || !product.price || product.price <= 0) continue;

          const tiers = Object.entries(PLAN_TIERS).map(([tierId, tier]) => ({
            id: tierId,
            name: tier.name,
            durationYears: tier.durationYears,
            price: Math.round(product.price * (tier.pricePercent / 100) * 100) / 100,
            coverage: tier.coverage,
          }));

          plans.push({
            productId: product._id,
            productName: product.name,
            productPrice: product.price,
            tiers,
            selectedTier: existingSelections.get(product._id) || null,
          });
        } catch (e) {
          // Product not found, skip
        }
      }

      return { success: true, plans };
    } catch (err) {
      console.error('[protectionPlan] getProtectionPlans error:', err);
      return { success: false, plans: [] };
    }
  }
);

/**
 * Add or update a protection plan selection for a product.
 *
 * @function addProtectionPlan
 * @param {string} productId - Product to protect
 * @param {string} tier - Plan tier: 'basic'|'extended'|'premium'
 * @param {string} [sessionId] - Session identifier
 * @returns {Promise<{success: boolean, data?: Object}>}
 * @permission Anyone
 */
export const addProtectionPlan = webMethod(
  Permissions.Anyone,
  async (productId, tier, sessionId) => {
    try {
      if (!productId || !tier) {
        return { success: false };
      }

      const cleanId = validateId(productId);
      if (!cleanId) return { success: false };

      const cleanTier = sanitize(tier, 20);
      if (!PLAN_TIERS[cleanTier]) return { success: false };

      const cleanSession = sanitize(sessionId || '', 100);

      // Verify product exists and get price
      const product = await wixData.get('Stores/Products', cleanId);
      if (!product) return { success: false };

      const planPrice = Math.round(product.price * (PLAN_TIERS[cleanTier].pricePercent / 100) * 100) / 100;

      const selectionData = {
        sessionId: cleanSession,
        productId: cleanId,
        productName: product.name || '',
        tier: cleanTier,
        price: planPrice,
        durationYears: PLAN_TIERS[cleanTier].durationYears,
        createdAt: new Date(),
      };

      // Check for existing selection for this product+session
      const existing = await wixData.query(SELECTIONS_COLLECTION)
        .eq('sessionId', cleanSession)
        .eq('productId', cleanId)
        .find();

      if (existing.items.length > 0) {
        selectionData._id = existing.items[0]._id;
        await wixData.update(SELECTIONS_COLLECTION, selectionData);
      } else {
        await wixData.insert(SELECTIONS_COLLECTION, selectionData);
      }

      return {
        success: true,
        data: {
          productId: cleanId,
          productName: product.name,
          tier: cleanTier,
          price: planPrice,
          durationYears: PLAN_TIERS[cleanTier].durationYears,
          planName: PLAN_TIERS[cleanTier].name,
        },
      };
    } catch (err) {
      console.error('[protectionPlan] addProtectionPlan error:', err);
      return { success: false };
    }
  }
);

/**
 * Remove a protection plan selection for a product.
 *
 * @function removeProtectionPlan
 * @param {string} productId - Product to remove protection from
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone
 */
export const removeProtectionPlan = webMethod(
  Permissions.Anyone,
  async (productId, sessionId) => {
    try {
      if (!productId) return { success: false };

      const cleanId = validateId(productId);
      if (!cleanId) return { success: false };

      const cleanSession = sanitize(sessionId || '', 100);

      const existing = await wixData.query(SELECTIONS_COLLECTION)
        .eq('sessionId', cleanSession)
        .eq('productId', cleanId)
        .find();

      for (const item of existing.items) {
        await wixData.remove(SELECTIONS_COLLECTION, item._id);
      }

      return { success: true };
    } catch (err) {
      console.error('[protectionPlan] removeProtectionPlan error:', err);
      return { success: false };
    }
  }
);

/**
 * Get a summary of all protection plan selections for a session.
 * Used in the checkout order summary to display protection costs.
 *
 * @function getProtectionPlanSummary
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{success: boolean, data: {selections: Array, totalProtectionCost: number}}>}
 * @permission Anyone
 */
export const getProtectionPlanSummary = webMethod(
  Permissions.Anyone,
  async (sessionId) => {
    try {
      if (!sessionId) {
        return { success: true, data: { selections: [], totalProtectionCost: 0 } };
      }

      const cleanSession = sanitize(sessionId, 100);

      const result = await wixData.query(SELECTIONS_COLLECTION)
        .eq('sessionId', cleanSession)
        .find();

      const selections = result.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        tier: item.tier,
        price: item.price || 0,
        durationYears: item.durationYears,
        planName: PLAN_TIERS[item.tier]?.name || item.tier,
      }));

      const totalProtectionCost = selections.reduce((sum, s) => sum + s.price, 0);

      return {
        success: true,
        data: {
          selections,
          totalProtectionCost: Math.round(totalProtectionCost * 100) / 100,
        },
      };
    } catch (err) {
      console.error('[protectionPlan] getProtectionPlanSummary error:', err);
      return { success: false, data: { selections: [], totalProtectionCost: 0 } };
    }
  }
);
