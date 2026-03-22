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
import { shouldUseLTL, getLTLRates, getLTLFallbackRates, requiresLiftgate } from 'backend/wwex-freight.web';
import { business, shippingConfig, internationalShippingConfig } from 'public/sharedTokens.js';
import { logError } from 'backend/utils/errorHandler';
import { matchLocalZone, getTerrainSurcharge } from 'backend/utils/shippingZones';
import { applyOverrides } from 'backend/shippingOverrides.web';
import wixData from 'wix-data';

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

    // Batch-fetch all shipping profiles upfront (prevent N+1 CMS queries per item)
    const productIds = lineItems
      .map(item => item.catalogReference?.catalogItemId)
      .filter(Boolean);
    const profileMap = await batchFetchProfiles(productIds);

    for (const item of lineItems) {
      const quantity = item.quantity || 1;
      const price = Math.max(0, parseFloat(item.price) || 0);
      orderSubtotal += price * quantity;

      // Resolve category from pre-fetched profile map; fall back to name matching.
      const productId = item.catalogReference?.catalogItemId;
      const profile = profileMap.get(productId);
      const category = resolveCategory(item, profile);
      const dims = await getPackageDimensions(category);

      // Murphy beds and platform beds always require freight regardless of weight
      const requiresFreight = category === 'murphy-bed' || category === 'platform-bed';

      // One package per unit for furniture items
      for (let i = 0; i < quantity; i++) {
        packages.push({
          length: dims.length,
          width: dims.width,
          height: dims.height,
          weight: item.physicalProperties?.weight || dims.weight,
          category,
          requiresFreight,
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

    // ── Carrier routing: LTL freight takes priority over UPS parcel ──────────
    // Murphy beds, platform beds, and multi-item heavy orders exceed UPS parcel
    // limits and must ship via WWEX LTL freight.
    // Note: local delivery options are still appended below for local-zone ZIPs —
    // customers near Hendersonville see both freight rates AND local delivery.
    const needsFreight = packages.some(p => p.requiresFreight || p.requiresPallet) || shouldUseLTL(packages);
    let shippingRates;

    if (needsFreight) {
      const ltlResult = await getLTLRates('28792', destination.postalCode, packages);
      const ltlRates = ltlResult.success ? ltlResult.rates : getLTLFallbackRates(destination.postalCode, packages);
      const needsLiftgate = requiresLiftgate(packages);

      shippingRates = ltlRates.map(rate => ({
        code: rate.code,
        title: rate.title,
        logistics: {
          deliveryTime: rate.estimatedDays || rate.estimatedDelivery || '5-10 business days',
          instructions: needsLiftgate
            ? 'Large item freight delivery. Liftgate service included. We will call to schedule your delivery window.'
            : 'Large item freight delivery. We will call to schedule your delivery window.',
        },
        cost: {
          price: String((Number(rate.cost) || 0).toFixed(2)),
          currency: rate.currency || 'USD',
          additionalCharges: [],
        },
      }));
    } else {
      // Get live UPS rates (parcel — items that passed the freight threshold check above)
      const rates = await getUPSRates(destination, packages, orderSubtotal);

      shippingRates = rates.map(rate => ({
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
    }

    // ── Local delivery zone matching ──────────────────────────────────────
    const zip3 = parseInt((destination.postalCode || '').substring(0, 3), 10);
    // Wix subdivisions may be 'NC' or 'US-NC' — normalise to 2-letter code
    const stateCode = (destination.state || '').replace(/^US-/, '');
    if (!stateCode && destination.postalCode) {
      logError('shipping-rates-plugin', new Error(`No state code for ZIP ${destination.postalCode} — local delivery options suppressed`), { silent: true });
    }

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

    // ── Override rules (CMS-driven, fail-open) ───────────────────────────
    const products = [...productIds.map(id => ({ productId: id }))];
    const overrideContext = { zip: destination.postalCode, products, orderSubtotal, memberId: null };
    // applyOverrides expects {cost: number} — adapt Wix format in/out
    const internalRates = shippingRates.map(r => ({ ...r, cost: parseFloat(r.cost.price) || 0 }));
    const overridden = await applyOverrides(internalRates, overrideContext);
    // Use Map for O(1) lookup and correctness when duplicate codes exist
    const ratesByCode = new Map(shippingRates.map(r => [r.code, r]));
    const finalRates = overridden.map(r => ({
      ...r,
      cost: { ...(ratesByCode.get(r.code)?.cost || {}), price: r.cost.toFixed(2) },
    }));

    return { shippingRates: finalRates };

  } catch (err) {
    logError('shipping-rates-plugin.getShippingRates', err);

    // Return conservative flat rates as fallback when UPS API is unavailable.
    // Rates are deliberately set above typical ground rates (CF avg: ~$38 ground,
    // ~$72 express) so the store does not under-collect. Titles include "(Estimated)"
    // to signal to the customer that these are not live-calculated rates.
    // Alternative: return { shippingRates: [] } to block checkout on UPS failure —
    // rejected because it prevents customers from completing orders during outages.
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
 * Batch-fetch ProductShippingProfiles for a set of product IDs.
 * Returns a Map<productId, profile> for O(1) lookup in the item loop.
 * Fails open (empty Map) on CMS error — caller falls back to name matching.
 *
 * @param {string[]} productIds
 * @returns {Promise<Map<string, Object>>}
 */
async function batchFetchProfiles(productIds) {
  if (!productIds.length) return new Map();
  try {
    const result = await wixData.query('ProductShippingProfiles')
      .hasSome('productId', productIds)
      .limit(productIds.length)
      .find({ suppressAuth: true });
    return new Map(result.items.map(p => [p.productId, p]));
  } catch {
    return new Map();
  }
}

/**
 * Resolve product category from a pre-fetched CMS profile (if available)
 * or fall back to name/SKU keyword matching.
 *
 * @param {Object} item    - Wix line item with name field
 * @param {Object|undefined} profile - CMS profile from batchFetchProfiles (may be undefined)
 * @returns {string} Category key matching PACKAGE_DEFAULTS in ups-shipping.web
 */
function resolveCategory(item, profile) {
  if (profile?.category) return profile.category;

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
