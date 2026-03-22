/**
 * @module shipping-rates-plugin
 * @description Wix eCommerce Shipping Rates SPI (Service Provider Interface).
 * Hooks into the Wix checkout flow to return real-time UPS rates, local
 * pickup/delivery options, white-glove delivery, and international shipping.
 * Wix calls `getShippingRates` automatically during checkout — the function
 * name and export are mandatory per the SPI contract.
 *
 * Key responsibilities:
 * - Resolve package dimensions from product category via ups-shipping.web
 * - Route international destinations to internationalShipping.web
 * - Offer in-store pickup for Hendersonville-area ZIP prefixes
 * - Offer local delivery + white-glove for localZones (zone1–zone4)
 *   using state-based eligibility, not raw ZIP prefix ranges
 * - Apply terrain surcharge to white-glove for mountain-access ZIPs
 * - Return gamification metadata (badge, icon, upsellMessage) for cart UI
 * - Fall back to flat estimated rates when UPS API is unavailable
 *
 * No CMS collections — reads shipping config from sharedTokens.js.
 *
 * @requires backend/ups-shipping.web     - Live UPS rate lookup
 * @requires backend/internationalShipping.web - Non-US rate lookup
 * @requires public/sharedTokens.js       - Business address, shipping zones, thresholds
 *
 * @see https://dev.wix.com/docs/develop-websites/articles/code-tutorials/wix-e-commerce-stores/e-commerce-shipping-rates-service-plugin
 */

import { getUPSRates, getPackageDimensions } from 'backend/ups-shipping.web';
import { getInternationalShippingRates } from 'backend/internationalShipping.web';
import { business, shippingConfig, internationalShippingConfig } from 'public/sharedTokens.js';
import { logError } from 'backend/utils/errorHandler';
import { matchLocalZone, getTerrainSurcharge } from 'backend/utils/shippingZones';

const { freeThreshold: FREE_SHIPPING_THRESHOLD, whiteGlove, zones } = shippingConfig;
const { freeThreshold: WHITE_GLOVE_FREE_THRESHOLD } = whiteGlove;

/**
 * Calculate available shipping rates for the current checkout.
 * Wix calls this automatically — the function name is mandated by the SPI.
 *
 * Flow: build destination → size packages by category → check international →
 * fetch UPS rates → match local zone → append pickup / delivery / white-glove.
 *
 * @param {Object} options - Wix-provided checkout context
 * @param {Array}  options.lineItems - Cart line items with name, sku, price, quantity, physicalProperties
 * @param {Object} options.shippingDestination - Buyer address with contactDetails + address fields
 * @param {Object} options.shippingOrigin - Store origin address (not used; we hardcode from sharedTokens)
 * @returns {Promise<{shippingRates: Array<{code: string, title: string, logistics: Object, cost: Object}>}>}
 *   Wix-formatted shipping rates array. Returns flat fallback rates on error.
 */
export const getShippingRates = async (options) => {
  const { lineItems, shippingDestination } = options;

  try {
    // Build destination address from Wix checkout data
    const destination = {
      name: shippingDestination?.contactDetails?.firstName
        ? `${shippingDestination.contactDetails.firstName} ${shippingDestination.contactDetails.lastName || ''}`
        : 'Customer',
      addressLine1: shippingDestination?.address?.addressLine || '',
      city: shippingDestination?.address?.city || '',
      // Wix can return 'US-NC' or 'NC' — normalise to 2-letter code
      state: (shippingDestination?.address?.subdivision || '').replace(/^US-/, ''),
      postalCode: shippingDestination?.address?.postalCode || '',
      country: shippingDestination?.address?.country || 'US',
    };

    // Calculate total order value for free shipping check
    let orderSubtotal = 0;
    const packages = [];

    for (const item of lineItems) {
      const quantity = item.quantity || 1;
      const price = Math.max(0, parseFloat(item.price) || 0);
      orderSubtotal += price * quantity;

      // Determine package dimensions based on product category
      // In Wix Stores, lineItems don't include physical dimensions,
      // so we map from product data or use category defaults
      const category = detectCategory(item);
      // getPackageDimensions is a webMethod (async) - must await
      const dims = await getPackageDimensions(category);

      // One package per unit for furniture items
      for (let i = 0; i < quantity; i++) {
        packages.push({
          length: dims.length,
          width: dims.width,
          height: dims.height,
          weight: item.physicalProperties?.weight || dims.weight,
          description: item.name || 'Furniture',
        });
      }
    }

    if (!destination.postalCode) {
      // Can't calculate without a postal code
      return { shippingRates: [] };
    }

    // International shipping: route to international service for non-US destinations
    if (destination.country && destination.country !== 'US') {
      const restricted = internationalShippingConfig.restrictedCountries || [];
      if (restricted.includes(destination.country)) {
        return { shippingRates: [] };
      }

      const intlResult = await getInternationalShippingRates(destination, packages, orderSubtotal);
      if (intlResult.success && intlResult.rates) {
        const intlRates = intlResult.rates.map(rate => ({
          code: rate.code,
          title: rate.title,
          logistics: {
            deliveryTime: rate.estimatedDays || '',
          },
          cost: {
            price: String(rate.cost.toFixed(2)),
            currency: rate.currency || 'USD',
            additionalCharges: [],
          },
        }));
        return { shippingRates: intlRates };
      }

      // Fallback: return flat international rate
      return {
        shippingRates: [{
          code: 'intl-flat',
          title: 'International Shipping (Estimated)',
          logistics: { deliveryTime: '14-28 business days' },
          cost: { price: '199.99', currency: 'USD', additionalCharges: [] },
        }],
      };
    }

    // Get live UPS rates
    const rates = await getUPSRates(destination, packages, orderSubtotal);

    // Transform to Wix shipping rates format
    const shippingRates = rates.map(rate => ({
      code: rate.code,
      title: rate.title,
      logistics: {
        deliveryTime: rate.estimatedDelivery || '',
      },
      cost: {
        price: String(rate.cost.toFixed(2)),
        currency: rate.currency || 'USD',
        additionalCharges: [],
      },
    }));

    // ── Local delivery zone matching ──────────────────────────────────────
    const zip3 = parseInt((destination.postalCode || '').substring(0, 3), 10);
    const stateCode = destination.state;

    // In-store pickup — local (WNC) zone only
    if (zip3 >= zones.local.prefixMin && zip3 <= zones.local.prefixMax) {
      shippingRates.push({
        code: 'local-pickup',
        title: 'In-Store Pickup (Free) 🏪',
        logistics: {
          deliveryTime: 'Ready in 1-2 business days',
          instructions: `Pick up at ${business.address.street}, ${business.address.city}, ${business.address.state} ${business.address.zip}. ${business.hours}.`,
        },
        cost: {
          price: '0.00',
          currency: 'USD',
          additionalCharges: [],
        },
      });
    }

    // CF truck local delivery — zone-based match
    const zone = matchLocalZone(destination.postalCode, stateCode);
    if (zone) {
      const terrainFee = getTerrainSurcharge(destination.postalCode);

      // Local delivery option
      const deliveryPrice = orderSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : zone.delivery;
      const deliveryTitle = [
        zone.icon || '🚚',
        deliveryPrice === 0 ? `${zone.name} Delivery (Free)` : `${zone.name} Delivery`,
      ].join(' ');

      const deliveryRate = {
        code: `local-delivery-${zone.code}`,
        title: deliveryTitle,
        logistics: {
          deliveryTime: zone.deliveryDays,
          instructions: `Curbside delivery. Call ${business.phone} to schedule.`,
        },
        cost: {
          price: String(deliveryPrice.toFixed(2)),
          currency: 'USD',
          additionalCharges: [],
        },
      };
      // Attach gamification metadata for cart UI
      if (zone.badge) {
        deliveryRate.badge = zone.badge;
        deliveryRate.badgeStyle = zone.badgeStyle || 'default';
      }
      if (zone.upsellMessage) deliveryRate.upsellMessage = zone.upsellMessage;
      deliveryRate.highlight = zone.highlight || false;
      shippingRates.push(deliveryRate);

      // White-glove option
      const whiteGloveBase = zone.whiteGlove;
      const whiteGlovePrice = orderSubtotal >= WHITE_GLOVE_FREE_THRESHOLD
        ? 0
        : whiteGloveBase + terrainFee;
      const whiteGloveLabel = [
        zone.whiteGloveIcon || '✨',
        whiteGlovePrice === 0
          ? (zone.whiteGloveBadge ? `${zone.whiteGloveBadge} (Free)` : 'White Glove Delivery (Free)')
          : (zone.whiteGloveBadge || 'White Glove Delivery — In-Home Setup'),
      ].join(' ');

      const wgInstructions = terrainFee > 0
        ? `Includes in-home placement, packaging removal, and basic assembly. Mountain area surcharge $${terrainFee} applied. We'll call to schedule a delivery window (Wed-Sat, 9am-5pm).`
        : `Includes in-home placement, packaging removal, and basic assembly. We'll call to schedule a delivery window (Wed-Sat, 9am-5pm).`;

      // White-glove is an upgrade add-on to local delivery, not a standalone rate.
      // Attach it as an additionalCharge on the delivery rate so the customer sees
      // one option with an optional upgrade — not two competing shipping choices.
      const whiteGloveCharge = {
        code: 'white-glove',
        title: whiteGloveLabel,
        price: String(whiteGlovePrice.toFixed(2)),
        currency: 'USD',
      };
      if (terrainFee > 0) whiteGloveCharge.terrainSurcharge = terrainFee;
      deliveryRate.cost.additionalCharges = [whiteGloveCharge];
      deliveryRate.whiteGloveInstructions = wgInstructions;
    }

    return { shippingRates };

  } catch (err) {
    logError('shipping-rates-plugin.getShippingRates', err);

    // Return conservative flat rates as fallback when UPS API is unavailable.
    // Rates are deliberately above typical ground rates so the store does not
    // under-collect. Titles include "(Estimated)" to signal non-live rates.
    return {
      shippingRates: [
        {
          code: 'flat-ground',
          title: 'Standard Shipping (Estimated)',
          logistics: { deliveryTime: '5-10 business days' },
          cost: { price: '49.99', currency: 'USD', additionalCharges: [] },
        },
        {
          code: 'flat-express',
          title: 'Express Shipping (Estimated)',
          logistics: { deliveryTime: '2-3 business days' },
          cost: { price: '89.99', currency: 'USD', additionalCharges: [] },
        },
      ],
    };
  }
};

/**
 * Detect product category from line item data for package sizing.
 * Uses name/SKU (Stock Keeping Unit) keyword matching because Wix checkout
 * line items don't carry a structured category field.
 *
 * @param {Object} item - Wix line item with name and sku fields
 * @returns {string} Category key matching PACKAGE_DEFAULTS in ups-shipping.web
 */
function detectCategory(item) {
  const name = (item.name || '').toLowerCase();

  if (name.includes('murphy') || name.includes('cabinet bed')) return 'murphy-bed';
  if (name.includes('platform') || name.includes('nomad') || name.includes('lexington') ||
      name.includes('charleston') || name.includes('ekko')) return 'platform-bed';
  if (name.includes('mattress') || name.includes('futon foam') || name.includes('moonshadow') ||
      name.includes('pulsar') || name.includes('haley')) return 'futon-mattress';
  if (name.includes('frame') || name.includes('futon') || name.includes('wall hugger') ||
      name.includes('lounger')) return 'futon-frame';
  if (name.includes('dresser') || name.includes('chest') || name.includes('nightstand') ||
      name.includes('drawer') || name.includes('trundle')) return 'casegoods';

  return 'default';
}
