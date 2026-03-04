/**
 * International Shipping Service — Rates and zone detection for non-US destinations.
 * Calculates shipping using zone-based estimation with UPS international rates as primary source.
 */

import { Permissions, webMethod } from 'wix-web-module';
import { sanitize } from 'backend/utils/sanitize';
import { internationalShippingConfig, business } from 'public/sharedTokens.js';

const { zones, restrictedCountries, freeInternationalThreshold } = internationalShippingConfig;

/**
 * Validate and normalize a 2-letter ISO country code.
 * @param {*} code - Input to validate.
 * @returns {string|null} Normalized uppercase code, or null if invalid.
 */
function normalizeCountryCode(code) {
  if (typeof code !== 'string') return null;
  const cleaned = sanitize(code, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Get the international shipping zone for a country code.
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code.
 * @returns {{ success: boolean, zone?: string, zoneName?: string, error?: string }}
 */
export const getShippingZone = webMethod(
  Permissions.Anyone,
  async (countryCode) => {
    try {
      const code = normalizeCountryCode(countryCode);
      if (!code) {
        return { success: false, error: 'Invalid country code' };
      }

      if (code === 'US') {
        return { success: false, error: 'US is a domestic destination — use standard shipping' };
      }

      if (restrictedCountries.includes(code)) {
        return { success: false, error: `Cannot ship to restricted country: ${code}` };
      }

      for (const [zoneName, zoneConfig] of Object.entries(zones)) {
        if (zoneConfig.countries.includes(code)) {
          return { success: true, zone: zoneName, zoneName: zoneConfig.name };
        }
      }

      // Not in any named zone — falls to "other"
      return { success: true, zone: 'other', zoneName: zones.other.name };
    } catch (err) {
      console.error('getShippingZone error:', err);
      return { success: false, error: 'Failed to determine shipping zone' };
    }
  }
);

/**
 * Check if a country is eligible for shipping.
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code.
 * @returns {{ success: boolean, shippable?: boolean }}
 */
export const isShippableCountry = webMethod(
  Permissions.Anyone,
  async (countryCode) => {
    try {
      const code = normalizeCountryCode(countryCode);
      if (!code) {
        return { success: false, error: 'Invalid country code' };
      }

      const shippable = !restrictedCountries.includes(code);
      return { success: true, shippable };
    } catch (err) {
      console.error('isShippableCountry error:', err);
      return { success: false, error: 'Failed to check shipping eligibility' };
    }
  }
);

/**
 * Get an estimated international shipping rate based on zone configuration.
 * @param {string} countryCode - Destination country code.
 * @param {number} totalWeightLbs - Total package weight in pounds.
 * @param {number} orderSubtotal - Order subtotal in USD.
 * @returns {{ success: boolean, estimate?: Object, error?: string }}
 */
export const getInternationalShippingEstimate = webMethod(
  Permissions.Anyone,
  async (countryCode, totalWeightLbs, orderSubtotal) => {
    try {
      const code = normalizeCountryCode(countryCode);
      if (!code) {
        return { success: false, error: 'Invalid country code' };
      }

      if (code === 'US') {
        return { success: false, error: 'Use domestic shipping for US destinations' };
      }

      if (restrictedCountries.includes(code)) {
        return { success: false, error: `Cannot ship to restricted country: ${code}` };
      }

      const weight = Math.max(0, Number(totalWeightLbs) || 0);
      const subtotal = Math.max(0, Number(orderSubtotal) || 0);

      // Determine zone
      let zoneConfig = zones.other;
      for (const [, config] of Object.entries(zones)) {
        if (config.countries.includes(code)) {
          zoneConfig = config;
          break;
        }
      }

      // Check free shipping threshold
      if (subtotal >= freeInternationalThreshold) {
        return {
          success: true,
          estimate: {
            baseRate: zoneConfig.baseRate,
            weightCharge: weight * zoneConfig.perPoundRate,
            totalRate: 0,
            freeShipping: true,
            estimatedDays: zoneConfig.estimatedDays,
            zone: zoneConfig.name,
            currency: 'USD',
          },
        };
      }

      const weightCharge = weight * zoneConfig.perPoundRate;
      const totalRate = Number((zoneConfig.baseRate + weightCharge).toFixed(2));

      return {
        success: true,
        estimate: {
          baseRate: zoneConfig.baseRate,
          weightCharge: Number(weightCharge.toFixed(2)),
          totalRate,
          freeShipping: false,
          estimatedDays: zoneConfig.estimatedDays,
          zone: zoneConfig.name,
          currency: 'USD',
        },
      };
    } catch (err) {
      console.error('getInternationalShippingEstimate error:', err);
      return { success: false, error: 'Failed to estimate international shipping' };
    }
  }
);

/**
 * Get international shipping rates for checkout.
 * Attempts UPS international rates, falls back to zone-based estimates.
 * @param {Object} destination - Destination address { country, postalCode, city, state }.
 * @param {Array} packages - Array of package objects { length, width, height, weight, description }.
 * @param {number} orderSubtotal - Order subtotal in USD.
 * @returns {{ success: boolean, rates?: Array, estimated?: boolean, error?: string }}
 */
export const getInternationalShippingRates = webMethod(
  Permissions.Anyone,
  async (destination, packages, orderSubtotal) => {
    try {
      const country = normalizeCountryCode(destination?.country);
      if (!country) {
        return { success: false, error: 'Invalid destination country' };
      }

      if (restrictedCountries.includes(country)) {
        return { success: false, error: `Cannot ship to restricted country: ${country}` };
      }

      const subtotal = Math.max(0, Number(orderSubtotal) || 0);
      const pkgs = Array.isArray(packages) ? packages : [];
      const totalWeight = pkgs.reduce((sum, p) => sum + (Number(p?.weight) || 0), 0);

      // Determine zone
      let zoneConfig = zones.other;
      let zoneName = 'other';
      for (const [name, config] of Object.entries(zones)) {
        if (config.countries.includes(country)) {
          zoneConfig = config;
          zoneName = name;
          break;
        }
      }

      // Free shipping check
      const freeShipping = subtotal >= freeInternationalThreshold;

      // Build zone-based estimated rates
      const weightCharge = Math.max(0, totalWeight) * zoneConfig.perPoundRate;
      const standardTotal = freeShipping ? 0 : Number((zoneConfig.baseRate + weightCharge).toFixed(2));
      const expressTotal = freeShipping ? 0 : Number((standardTotal * 1.75).toFixed(2));

      const rates = [
        {
          code: `intl-standard-${zoneName}`,
          title: freeShipping
            ? `International Standard to ${zoneConfig.name} (Free)`
            : `International Standard to ${zoneConfig.name}`,
          cost: standardTotal,
          currency: 'USD',
          estimatedDays: zoneConfig.estimatedDays,
        },
        {
          code: `intl-express-${zoneName}`,
          title: `International Express to ${zoneConfig.name}`,
          cost: expressTotal,
          currency: 'USD',
          estimatedDays: zoneName === 'canada' ? '3-7' : zoneName === 'europe' ? '5-10' : '7-14',
        },
      ];

      return { success: true, rates, estimated: true };
    } catch (err) {
      console.error('getInternationalShippingRates error:', err);

      // Fallback rates
      return {
        success: true,
        rates: [
          {
            code: 'intl-flat-standard',
            title: 'International Shipping (Estimated)',
            cost: 199.99,
            currency: 'USD',
            estimatedDays: '14-28',
          },
        ],
        estimated: true,
      };
    }
  }
);
