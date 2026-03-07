/** @module customizationService - Backend product customization builder.
 *
 * Powers the "Customize Your Futon" feature: fetches available fabric swatches
 * and pricing tiers from CMS, calculates surcharges (percentage or flat) for
 * premium/luxury fabrics, and persists/retrieves saved configurations for
 * logged-in members.
 *
 * CMS collections: FabricSwatches, CustomizationPricing, SavedCustomizations.
 * calculateCustomizationPrice is a pure function (not a webMethod) so it can
 * run on either client or server.
 *
 * Dependencies: wix-web-module, wix-data, backend/utils/sanitize.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';

/**
 * Get customization options (swatches + pricing rules) for a product.
 * @param {string} productId - Wix product ID
 * @returns {Promise<{swatches: Array, pricingRules: Array}>}
 */
export const getCustomizationOptions = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const empty = { swatches: [], pricingRules: [] };
    try {
      const cleanId = validateId(productId);
      if (!cleanId) return empty;

      const [swatchResult, pricingResult] = await Promise.all([
        wixData.query('FabricSwatches')
          .or(
            wixData.query('FabricSwatches').contains('availableForProducts', cleanId),
            wixData.query('FabricSwatches').eq('availableForProducts', 'all')
          )
          .ascending('sortOrder')
          .limit(100)
          .find(),
        wixData.query('CustomizationPricing')
          .ascending('sortOrder')
          .find(),
      ]);

      return {
        swatches: (swatchResult.items || []).map(item => ({
          _id: item._id,
          swatchName: item.swatchName,
          swatchImage: item.swatchImage,
          colorFamily: item.colorFamily,
          colorHex: item.colorHex,
          material: item.material,
          priceTier: item.priceTier || 'standard',
          careInstructions: item.careInstructions,
        })),
        pricingRules: (pricingResult.items || []).map(rule => ({
          tier: rule.tier,
          surchargePercent: rule.surchargePercent || 0,
          surchargeFlat: rule.surchargeFlat || 0,
          label: rule.label || rule.tier,
        })),
      };
    } catch (err) {
      console.error('Error fetching customization options:', err);
      return empty;
    }
  }
);

/**
 * Calculate customization price with fabric surcharges.
 * Pure function — no async, no side effects.
 * @param {number} basePrice - Product base price
 * @param {string} priceTier - Fabric price tier (standard/premium/luxury)
 * @param {Array} pricingRules - Pricing rules from getCustomizationOptions
 * @returns {{basePrice: number, surcharge: number, totalPrice: number, surchargeLabel: string}}
 */
export const calculateCustomizationPrice = (basePrice, priceTier, pricingRules) => {
  const safeBase = typeof basePrice === 'number' && basePrice > 0 ? basePrice : 0;
  const defaultResult = { basePrice: safeBase, surcharge: 0, totalPrice: safeBase, surchargeLabel: '' };

  if (!pricingRules || !Array.isArray(pricingRules) || pricingRules.length === 0) {
    return defaultResult;
  }

  const rule = pricingRules.find(r => r.tier === priceTier);
  if (!rule) return defaultResult;

  let surcharge = 0;
  if (rule.surchargePercent > 0) {
    surcharge = Math.round(safeBase * (rule.surchargePercent / 100) * 100) / 100;
  } else if (rule.surchargeFlat > 0) {
    surcharge = rule.surchargeFlat;
  }

  return {
    basePrice: safeBase,
    surcharge,
    totalPrice: Math.round((safeBase + surcharge) * 100) / 100,
    surchargeLabel: rule.label || rule.tier,
  };
};

/**
 * Save a customization configuration for a logged-in member.
 * @param {Object} config - Configuration to save
 * @returns {Promise<Object>} Saved config with _id, or error object
 */
export const saveConfiguration = webMethod(
  Permissions.SiteMember,
  async (config) => {
    try {
      if (!config || !config.productId || !config.memberId) {
        return { error: 'Missing required fields' };
      }

      const record = {
        productId: validateId(config.productId),
        memberId: validateId(config.memberId),
        configName: sanitize(config.configName || 'Untitled Configuration', 200),
        fabricSwatchId: validateId(config.fabricSwatchId || ''),
        fabricName: sanitize(config.fabricName || '', 100),
        fabricColorHex: sanitize(config.fabricColorHex || '', 10),
        finishOption: sanitize(config.finishOption || '', 100),
        totalPrice: typeof config.totalPrice === 'number' ? config.totalPrice : 0,
        _createdDate: new Date(),
      };

      const result = await wixData.insert('SavedCustomizations', record);
      return result;
    } catch (err) {
      console.error('Error saving customization config:', err);
      return { error: 'Failed to save configuration' };
    }
  }
);

/**
 * Get saved configurations for a member and product.
 * @param {string} productId - Wix product ID
 * @param {string} memberId - Wix member ID
 * @returns {Promise<Array>} Saved configurations
 */
export const getSavedConfigurations = webMethod(
  Permissions.SiteMember,
  async (productId, memberId) => {
    try {
      const cleanProductId = validateId(productId);
      const cleanMemberId = validateId(memberId);
      if (!cleanProductId || !cleanMemberId) return [];

      const result = await wixData.query('SavedCustomizations')
        .eq('productId', cleanProductId)
        .eq('memberId', cleanMemberId)
        .descending('_createdDate')
        .limit(20)
        .find();

      return (result.items || []).map(item => ({
        _id: item._id,
        configName: item.configName,
        fabricSwatchId: item.fabricSwatchId,
        fabricName: item.fabricName,
        fabricColorHex: item.fabricColorHex,
        finishOption: item.finishOption,
        totalPrice: item.totalPrice,
        _createdDate: item._createdDate,
      }));
    } catch (err) {
      console.error('Error fetching saved configurations:', err);
      return [];
    }
  }
);

/**
 * Get a single configuration by ID.
 * @param {string} configId - Configuration ID
 * @returns {Promise<Object|null>} Configuration or null
 */
export const getConfigurationById = webMethod(
  Permissions.SiteMember,
  async (configId) => {
    try {
      const cleanId = validateId(configId);
      if (!cleanId) return null;

      const result = await wixData.get('SavedCustomizations', cleanId);
      return result || null;
    } catch (err) {
      console.error('Error fetching configuration:', err);
      return null;
    }
  }
);
