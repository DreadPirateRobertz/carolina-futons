// Wix eCommerce Shipping Rates Service Plugin
// This file hooks into Wix's checkout flow to display real-time UPS rates
//
// File location: must be registered as a shipping rates plugin in Wix
// See: https://dev.wix.com/docs/develop-websites/articles/code-tutorials/
//      wix-e-commerce-stores/e-commerce-shipping-rates-service-plugin
//
// IMPORTANT: The function name must be exactly "getShippingRates" and
// must be exported. Wix calls this automatically during checkout.

import { getUPSRates, getPackageDimensions } from 'backend/ups-shipping.web';
import { business, shippingConfig } from 'public/sharedTokens.js';

const { freeThreshold: FREE_SHIPPING_THRESHOLD, whiteGlove, zones } = shippingConfig;
const { freeThreshold: WHITE_GLOVE_FREE_THRESHOLD, localPrice: WHITE_GLOVE_LOCAL_PRICE, regionalPrice: WHITE_GLOVE_REGIONAL_PRICE } = whiteGlove;

export const getShippingRates = async (options) => {
  const { lineItems, shippingDestination, shippingOrigin } = options;

  try {
    // Build destination address from Wix checkout data
    const destination = {
      name: shippingDestination?.contactDetails?.firstName
        ? `${shippingDestination.contactDetails.firstName} ${shippingDestination.contactDetails.lastName || ''}`
        : 'Customer',
      addressLine1: shippingDestination?.address?.addressLine || '',
      city: shippingDestination?.address?.city || '',
      state: shippingDestination?.address?.subdivision || '',
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

    // Add local pickup option for Hendersonville area
    const zip3 = parseInt((destination.postalCode || '').substring(0, 3));
    if (zip3 >= zones.local.prefixMin && zip3 <= zones.local.prefixMax) {
      shippingRates.push({
        code: 'local-pickup',
        title: 'In-Store Pickup (Free)',
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

    // Add local delivery option for NC/SC/GA/TN
    if (zip3 >= zones.regional.prefixMin && zip3 <= zones.regional.prefixMax) {
      const localDeliveryPrice = orderSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 49.99;
      shippingRates.push({
        code: 'local-delivery',
        title: localDeliveryPrice === 0 ? 'Local Delivery (Free)' : 'Local Delivery',
        logistics: {
          deliveryTime: '3-7 business days',
          instructions: `Curbside delivery. Call ${business.phone} to schedule.`,
        },
        cost: {
          price: String(localDeliveryPrice.toFixed(2)),
          currency: 'USD',
          additionalCharges: [],
        },
      });

      // White Glove Delivery: in-home placement, packaging removal, basic assembly
      const isLocal = zip3 >= zones.local.prefixMin && zip3 <= zones.local.prefixMax;
      const whiteGloveBase = isLocal ? WHITE_GLOVE_LOCAL_PRICE : WHITE_GLOVE_REGIONAL_PRICE;
      const whiteGlovePrice = orderSubtotal >= WHITE_GLOVE_FREE_THRESHOLD ? 0 : whiteGloveBase;
      const whiteGloveLabel = whiteGlovePrice === 0
        ? 'White Glove Delivery (Free over $1,999)'
        : `White Glove Delivery — In-Home Setup`;

      shippingRates.push({
        code: 'white-glove',
        title: whiteGloveLabel,
        logistics: {
          deliveryTime: isLocal ? '3-5 business days' : '5-10 business days',
          instructions: 'Includes in-home placement, packaging removal, and basic assembly. We\'ll call to schedule a delivery window (Wed-Sat, 9am-5pm).',
        },
        cost: {
          price: String(whiteGlovePrice.toFixed(2)),
          currency: 'USD',
          additionalCharges: [],
        },
      });
    }

    return { shippingRates };

  } catch (err) {
    console.error('Shipping rates plugin error:', err);

    // Return estimated flat rates as fallback
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

// Detect product category from line item data for package sizing
function detectCategory(item) {
  const name = (item.name || '').toLowerCase();
  const sku = (item.sku || '').toLowerCase();

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
