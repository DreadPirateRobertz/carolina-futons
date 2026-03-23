/**
 * @module freightTracking.web
 * @description LTL freight tracking utilities for Carolina Futons.
 *
 * Carolina Futons ships large items (murphy beds, platform beds, heavy frames)
 * via WWEX-brokered LTL freight, which typically moves on XPO or Estes Express
 * carriers. Unlike UPS parcel, LTL uses PRO numbers for tracking.
 *
 * Staff workflow: after an LTL shipment is picked up, staff adds the carrier
 * name and PRO number to the Wix order fulfillment via the dashboard. This
 * module detects LTL carriers from the carrier field and constructs the correct
 * tracking URL.
 *
 * Carrier tracking URLs:
 *   XPO:   https://www.xpo.com/track/{proNumber}
 *   Estes: https://www.estes-express.com/tools/tracking?query={proNumber}
 *
 * @requires wix-web-module
 */

import { Permissions, webMethod } from 'wix-web-module';

// ── Carrier detection ────────────────────────────────────────────────────────

/**
 * Canonical carrier keys used in tracking URL dispatch.
 */
export const LTL_CARRIER = {
  XPO: 'xpo',
  ESTES: 'estes',
  UNKNOWN: 'unknown',
};

/**
 * Detect if a carrier name string represents an LTL carrier, and return its
 * canonical key. Matching is case-insensitive and tolerant of spacing variants.
 *
 * Matches:
 *   'xpo', 'xpo logistics', 'xpo freight'           → 'xpo'
 *   'estes', 'estes express', 'estes express lines'  → 'estes'
 *   'wwex', 'wwex freight', 'ups freight'            → 'unknown' (WWEX-brokered but
 *                                                       actual carrier not yet known)
 *
 * @param {string} carrierName
 * @returns {'xpo' | 'estes' | 'unknown' | null}  null = not an LTL carrier
 */
export function detectLTLCarrier(carrierName) {
  const name = (carrierName || '').toLowerCase().trim();
  if (!name) return null;

  if (name.includes('xpo')) return LTL_CARRIER.XPO;
  if (name.includes('estes')) return LTL_CARRIER.ESTES;

  // WWEX-brokered shipments may show 'WWEX', 'WWEX Freight', or 'UPS Freight'
  // (UPS Freight was acquired by TFI International and rebranded; still LTL).
  // Return 'unknown' so caller can show a generic freight message without a link.
  if (name.includes('wwex') || name.includes('ups freight') || name.includes('ltl')) {
    return LTL_CARRIER.UNKNOWN;
  }

  return null; // parcel carrier (UPS, USPS, FedEx, etc.)
}

/**
 * Return true if a shipping option code or title indicates LTL freight.
 * Used by Thank You page to detect freight orders before fulfillment occurs.
 *
 * @param {string} code  - Shipping option code (e.g. 'wwex-ltl-std')
 * @param {string} title - Shipping option display title (e.g. '🚛 LTL Freight (WWEX)')
 * @returns {boolean}
 */
export function isFreightShippingOption(code, title) {
  const c = (code || '').toLowerCase();
  const t = (title || '').toLowerCase();
  return (
    c.includes('ltl') ||
    c.includes('wwex') ||
    c.includes('freight') ||
    t.includes('ltl') ||
    t.includes('wwex') ||
    t.includes('freight')
  );
}

// ── Tracking URL construction ────────────────────────────────────────────────

/**
 * Construct the carrier-specific tracking URL for an LTL PRO number.
 *
 * @param {'xpo' | 'estes' | 'unknown'} carrier  - Canonical carrier key from detectLTLCarrier()
 * @param {string} proNumber                      - Carrier PRO / tracking number
 * @returns {string | null}  Full tracking URL, or null if carrier unknown / proNumber missing
 */
export function buildLTLTrackingUrl(carrier, proNumber) {
  const pro = (proNumber || '').trim().replace(/\s+/g, '');
  if (!pro) return null;

  switch (carrier) {
    case LTL_CARRIER.XPO:
      return `https://www.xpo.com/track/${encodeURIComponent(pro)}`;
    case LTL_CARRIER.ESTES:
      return `https://www.estes-express.com/tools/tracking?query=${encodeURIComponent(pro)}`;
    default:
      // UNKNOWN — return null; caller shows PRO number without a link
      return null;
  }
}

/**
 * Build a structured freight tracking payload from raw fulfillment fields.
 * Returned object is used by email templates and frontend pages.
 *
 * @param {Object} params
 * @param {string} params.carrierName   - Raw carrier string from Wix fulfillment
 * @param {string} params.proNumber     - PRO / tracking number
 * @returns {{
 *   isLTL: boolean,
 *   carrier: string | null,
 *   proNumber: string,
 *   trackingUrl: string | null,
 *   displayCarrier: string,
 * }}
 */
export function buildFreightTrackingPayload({ carrierName, proNumber }) {
  const carrier = detectLTLCarrier(carrierName);
  const pro = (proNumber || '').trim();

  if (!carrier) {
    return { isLTL: false, carrier: null, proNumber: pro, trackingUrl: null, displayCarrier: '' };
  }

  const trackingUrl = buildLTLTrackingUrl(carrier, pro);

  const displayCarrier = carrier === LTL_CARRIER.XPO ? 'XPO Logistics'
    : carrier === LTL_CARRIER.ESTES ? 'Estes Express'
    : 'WWEX Freight';

  return {
    isLTL: true,
    carrier,
    proNumber: pro,
    trackingUrl,
    displayCarrier,
  };
}

// ── webMethod: getFreightTrackingInfo ────────────────────────────────────────

/**
 * Public webMethod: returns freight tracking payload for an order.
 * Called by Order Tracking page to get LTL-specific tracking data.
 *
 * @param {string} carrierName  - Carrier name from fulfillment record
 * @param {string} proNumber    - PRO number from fulfillment record
 * @returns {{ isLTL, carrier, proNumber, trackingUrl, displayCarrier }}
 */
export const getFreightTrackingInfo = webMethod(
  Permissions.Anyone,
  (carrierName, proNumber) => {
    return buildFreightTrackingPayload({ carrierName, proNumber });
  }
);
