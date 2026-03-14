/**
 * @module DeliveryEstimator
 * Delivery estimate logic for Product Page widget.
 * Calls UPS backend for live rates, falls back to static zone-based estimates.
 * Handles white-glove pricing tiers (local $149, regional $249, free >$1,999).
 */
import { getUPSRates, getPackageDimensions } from 'backend/ups-shipping.web';
import { shippingConfig, business } from 'public/sharedTokens.js';

/**
 * Determine shipping zone from a 5-digit US ZIP code.
 * @param {string} rawZip - ZIP code (may contain non-digits)
 * @returns {'local'|'regional'|'national'|null} Zone or null if invalid
 */
export function getShippingZone(rawZip) {
  if (!rawZip) return null;
  const zip = String(rawZip).replace(/[^0-9]/g, '').slice(0, 5);
  if (zip.length < 5) return null;
  const prefix = parseInt(zip.slice(0, 3), 10);
  if (isNaN(prefix)) return null;

  const { zones } = shippingConfig;
  if (prefix >= zones.local.prefixMin && prefix <= zones.local.prefixMax) return 'local';
  if (prefix >= zones.regional.prefixMin && prefix <= zones.regional.prefixMax) return 'regional';
  return 'national';
}

/**
 * Check if a product qualifies for white-glove delivery.
 * Large furniture (>50 lbs or in furniture collections) qualifies.
 * @param {Object} product - Wix Stores product object
 * @returns {boolean}
 */
function isLargeItem(product) {
  if (!product) return false;
  if (product.weight > 50) return true;
  const collections = product.collections || [];
  return collections.some(c => /murphy|platform|futon|frame/i.test(c));
}

/**
 * Get static fallback shipping estimate when UPS API is unavailable.
 * @param {string} zone - Shipping zone
 * @returns {{ cost: number, days: string }}
 */
function getFallbackEstimate(zone) {
  switch (zone) {
    case 'local': return { cost: 29.99, days: '3-5 business days' };
    case 'regional': return { cost: 39.99, days: '5-8 business days' };
    default: return { cost: 49.99, days: '7-12 business days' };
  }
}

/**
 * Format a delivery estimate result for display.
 * @param {Object} params
 * @param {string} params.zone - Shipping zone
 * @param {number} params.shippingCost - Shipping cost in USD
 * @param {string} params.estimatedDays - Delivery time description
 * @param {Object|null} params.whiteGlove - White-glove info or null
 * @returns {{ deliveryText: string, shippingText: string, whiteGloveText: string|null }}
 */
export function formatDeliveryEstimate({ zone, shippingCost, estimatedDays, whiteGlove }) {
  const deliveryText = `Estimated delivery: ${estimatedDays}`;
  const shippingText = shippingCost === 0
    ? 'FREE shipping'
    : `Shipping: $${shippingCost.toFixed(2)}`;
  const whiteGloveText = whiteGlove
    ? `White-glove delivery available ($${whiteGlove.price}) \u2014 call ${business.phone}`
    : null;

  return { deliveryText, shippingText, whiteGloveText };
}

/**
 * Get a delivery estimate for a product to a given ZIP code.
 * Calls UPS API for live rates, falls back to static estimates on failure.
 * @param {string} rawZip - Destination ZIP code
 * @param {Object} product - Wix Stores product object
 * @returns {Promise<Object>} Estimate result with success, zone, costs, display text
 */
export async function estimateDelivery(rawZip, product) {
  if (!product) return { success: false, error: 'Product data required' };

  const zip = String(rawZip || '').replace(/[^0-9]/g, '').slice(0, 5);
  if (zip.length !== 5) return { success: false, error: 'Please enter a valid 5-digit zip code' };

  const zone = getShippingZone(zip);
  const large = isLargeItem(product);

  // Determine white-glove eligibility
  let whiteGlove = null;
  if (large && zone === 'local') {
    whiteGlove = { price: shippingConfig.whiteGlove.localPrice, label: 'White-glove delivery' };
  } else if (large && zone === 'regional') {
    whiteGlove = { price: shippingConfig.whiteGlove.regionalPrice, label: 'White-glove delivery' };
  }

  // Try live UPS rates
  try {
    const category = (product.collections || [])[0] || 'default';
    const dims = getPackageDimensions(category);
    const address = {
      postalCode: zip,
      country: 'US',
    };
    const orderSubtotal = product.price || 0;
    const rates = await getUPSRates(address, [dims], orderSubtotal);

    if (rates && rates.length > 0) {
      const cheapest = rates[0]; // already sorted by cost ascending
      const formatted = formatDeliveryEstimate({
        zone,
        shippingCost: cheapest.cost,
        estimatedDays: cheapest.estimatedDelivery,
        whiteGlove,
      });

      return {
        success: true,
        zone,
        shippingCost: cheapest.cost,
        estimatedDays: cheapest.estimatedDelivery,
        whiteGlove,
        allRates: rates,
        isEstimate: !!cheapest.isEstimate,
        ...formatted,
      };
    }
  } catch (e) {
    // Fall through to static estimate
  }

  // Fallback: static zone-based estimate
  const fallback = getFallbackEstimate(zone);
  const formatted = formatDeliveryEstimate({
    zone,
    shippingCost: fallback.cost,
    estimatedDays: fallback.days,
    whiteGlove,
  });

  return {
    success: true,
    zone,
    shippingCost: fallback.cost,
    estimatedDays: fallback.days,
    whiteGlove,
    allRates: [],
    isEstimate: true,
    ...formatted,
  };
}
