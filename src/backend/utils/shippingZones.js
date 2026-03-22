/**
 * @module shippingZones
 * @description Shared zone-matching utilities for local delivery and terrain surcharge.
 *
 * Extracted from shipping-rates-plugin.js and shippingIntelligence.web.js to eliminate
 * duplicate implementations of matchLocalZone and getTerrainSurcharge. Both consumers
 * import from here.
 *
 * @requires public/sharedTokens.js - Zone config and terrain surcharge data
 */

import { shippingConfig } from 'public/sharedTokens.js';

const { localZones } = shippingConfig;
const terrainSurcharge = shippingConfig.whiteGlove.terrainSurcharge;

/**
 * Determine which local delivery zone matches a destination, if any.
 * Evaluation order: exact zip match → zip3 prefix + state match → next zone.
 *
 * @param {string} postalCode - 5-digit US ZIP code
 * @param {string} stateCode  - 2-letter state code (US-XX stripped to XX)
 * @returns {Object|null} Matched zone config from shippingConfig.localZones, or null
 */
export function matchLocalZone(postalCode, stateCode) {
  const zip3 = parseInt((postalCode || '').substring(0, 3), 10);
  for (const zone of localZones) {
    // 1. Exact ZIP match (highest precision — zone1 and mountain towns)
    if (zone.zips && zone.zips.includes(postalCode)) return zone;
    // 2. ZIP-3 prefix AND state match
    if (
      zone.zip3Prefixes && zone.zip3Prefixes.includes(zip3) &&
      zone.states && zone.states.includes(stateCode)
    ) return zone;
  }
  return null;
}

/**
 * Calculate the terrain surcharge for white-glove delivery.
 * Mountain communities with steep/winding road access carry an additional fee.
 *
 * @param {string} postalCode - 5-digit US ZIP code
 * @returns {number} Surcharge amount in USD (0 if not applicable)
 */
export function getTerrainSurcharge(postalCode) {
  if (!terrainSurcharge || !terrainSurcharge.zips) return 0;
  return terrainSurcharge.zips.includes(postalCode) ? (terrainSurcharge.amount ?? 0) : 0;
}
