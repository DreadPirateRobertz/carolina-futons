/**
 * @module CartDeliveryEstimates
 * Per-item delivery estimate display for cart repeaters (Side Cart + Cart Page).
 *
 * Determines which of four delivery states applies to each cart item and sets
 * the corresponding text on the repeater item's elements:
 *   - no-zip:  'Enter your zip for delivery estimate'
 *   - local:   'Local delivery: 3-5 business days'
 *   - freight: 'Freight: 10-14 business days (carrier will call to schedule)'
 *   - parcel:  'Est. arrival: [zone-based days]'
 *
 * Calls getShippingZone from DeliveryEstimator.js for zone detection.
 *
 * @requires public/DeliveryEstimator.js
 * @requires public/sharedTokens.js
 */

import { getShippingZone } from 'public/DeliveryEstimator.js';
import { shippingConfig } from 'public/sharedTokens.js';

/** Origin city shown on all per-item delivery rows. */
const ORIGIN_TEXT = 'Ships from Hendersonville, NC';

/** Freight message shown for oversized items requiring LTL. */
const FREIGHT_TEXT = 'Freight: 10-14 business days (carrier will call to schedule)';

/** No-zip prompt shown when destination ZIP is unknown. */
const NO_ZIP_TEXT = 'Enter your zip for delivery estimate';

/** Product names matching this pattern are routed to freight. */
const FREIGHT_NAME_PATTERN = /murphy|platform bed|bunk bed/i;

/**
 * Returns true if the cart item requires freight (LTL) shipping based on
 * product name matching.
 * @param {{ name?: string }} item
 * @returns {boolean}
 */
function isFreightItem(item) {
  return FREIGHT_NAME_PATTERN.test(item?.name || '');
}

/**
 * Returns the delivery days string for a given zone from shippingConfig.
 * @param {'local'|'regional'|'national'} zone
 * @returns {string}
 */
function deliveryDaysForZone(zone) {
  return shippingConfig?.zones?.[zone]?.deliveryDays
    || (zone === 'local' ? '3-5 business days'
      : zone === 'regional' ? '5-8 business days'
      : '7-12 business days');
}

/**
 * Set delivery estimate text on a single repeater item element pair.
 * @param {Function} $item  - Wix repeater $item selector
 * @param {{ name?: string }} itemData
 * @param {'local'|'regional'|'national'|null} zone  - null means no valid zip
 */
function setItemText($item, itemData, zone) {
  try {
    const estimateEl = $item('#deliveryEstimateText');
    const zoneEl = $item('#deliveryZoneText');

    if (!zone) {
      estimateEl.text = NO_ZIP_TEXT;
      zoneEl.text = '';
      return;
    }

    zoneEl.text = ORIGIN_TEXT;

    if (zone === 'local') {
      estimateEl.text = `Local delivery: ${deliveryDaysForZone('local')}`;
      return;
    }

    if (isFreightItem(itemData)) {
      estimateEl.text = FREIGHT_TEXT;
      return;
    }

    estimateEl.text = `Est. arrival: ${deliveryDaysForZone(zone)}`;
  } catch (e) {
    // Element not present in this layout — skip silently
  }
}

/**
 * Initialise per-item delivery estimates in a cart repeater.
 * Iterates existing rendered items via forEachItem and sets delivery state text.
 *
 * @param {Function} $w          - Wix $w selector
 * @param {Array<Object>} cartItems - Cart line items (must be non-empty array)
 * @param {string|null} zip      - 5-digit US ZIP code, or null/undefined if unknown
 * @param {{ repeaterSelector?: string }} [opts]
 *   repeaterSelector defaults to '#sideCartRepeater'; pass '#cartItemsRepeater'
 *   for the full Cart Page.
 */
export function initCartDelivery($w, cartItems, zip, opts = {}) {
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) return;

  const selector = opts.repeaterSelector || '#sideCartRepeater';
  const zone = zip && /^\d{5}$/.test(zip) ? getShippingZone(zip) : null;

  try {
    const repeater = $w(selector);
    if (!repeater) return;
    repeater.forEachItem(($item, itemData) => {
      setItemText($item, itemData, zone);
    });
  } catch (e) {
    // Repeater not available in this layout — skip silently
  }
}
