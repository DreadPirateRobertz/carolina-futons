/**
 * Customs & Duties Estimator — Estimates import duties, VAT/GST, and landed costs.
 * Uses country-specific duty rates and VAT tables from sharedTokens.
 * All estimates are informational — actual duties determined by customs authorities.
 */

import { Permissions, webMethod } from 'wix-web-module';
import { sanitize } from 'backend/utils/sanitize';
import { customsConfig, internationalShippingConfig } from 'public/sharedTokens.js';

const { dutyRates, vatRates, deMinimisUSD } = customsConfig;
const { restrictedCountries } = internationalShippingConfig;

const DEFAULT_DUTY_RATE = 0.05; // 5% default for unknown countries

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
 * Get the VAT/GST rate for a country.
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code.
 * @returns {{ success: boolean, rate?: number, error?: string }}
 */
export const getVATRate = webMethod(
  Permissions.Anyone,
  async (countryCode) => {
    try {
      const code = normalizeCountryCode(countryCode);
      if (!code) {
        return { success: false, error: 'Invalid country code' };
      }

      const rate = vatRates[code] ?? 0;
      return { success: true, rate };
    } catch (err) {
      console.error('getVATRate error:', err);
      return { success: false, error: 'Failed to get VAT rate' };
    }
  }
);

/**
 * Get the import duty rate for a country (for furniture HS code 9403).
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code.
 * @returns {{ success: boolean, rate?: number, description?: string, error?: string }}
 */
export const getDutyRate = webMethod(
  Permissions.Anyone,
  async (countryCode) => {
    try {
      const code = normalizeCountryCode(countryCode);
      if (!code) {
        return { success: false, error: 'Invalid country code' };
      }

      const dutyInfo = dutyRates[code];
      if (dutyInfo) {
        return { success: true, rate: dutyInfo.rate, description: dutyInfo.description };
      }

      return {
        success: true,
        rate: DEFAULT_DUTY_RATE,
        description: `Estimated ~${(DEFAULT_DUTY_RATE * 100).toFixed(0)}% duty on furniture`,
      };
    } catch (err) {
      console.error('getDutyRate error:', err);
      return { success: false, error: 'Failed to get duty rate' };
    }
  }
);

/**
 * Estimate customs duties and taxes for an international shipment.
 * @param {string} countryCode - Destination country code.
 * @param {number} declaredValueUSD - Declared value of goods in USD.
 * @param {number} weightLbs - Total weight in pounds.
 * @returns {{ success: boolean, estimate?: Object, error?: string }}
 */
export const estimateCustomsDuties = webMethod(
  Permissions.Anyone,
  async (countryCode, declaredValueUSD, weightLbs) => {
    try {
      const code = normalizeCountryCode(countryCode);
      if (!code) {
        return { success: false, error: 'Invalid country code' };
      }

      if (code === 'US') {
        return { success: false, error: 'No customs duties for domestic US shipments' };
      }

      const value = Math.max(0, Number(declaredValueUSD) || 0);
      const weight = Math.max(0, Number(weightLbs) || 0);

      if (value === 0) {
        return {
          success: true,
          estimate: {
            declaredValue: 0,
            dutyRate: 0,
            dutyAmount: 0,
            vatRate: vatRates[code] ?? 0,
            vatAmount: 0,
            totalDutiesAndTaxes: 0,
            deMinimisApplied: true,
            currency: 'USD',
            disclaimer: 'Estimates only — actual duties determined by destination customs authority.',
          },
        };
      }

      // Check de minimis threshold
      const deMinimis = deMinimisUSD[code] ?? 0;
      const deMinimisApplied = deMinimis > 0 && value < deMinimis;

      // Get duty rate
      const dutyInfo = dutyRates[code];
      const dutyRate = dutyInfo?.rate ?? DEFAULT_DUTY_RATE;
      const dutyAmount = deMinimisApplied ? 0 : Number((value * dutyRate).toFixed(2));

      // Get VAT/GST rate
      const vatRate = vatRates[code] ?? 0;
      // VAT is typically charged on (value + duty)
      const vatBase = value + dutyAmount;
      const vatAmount = Number((vatBase * vatRate).toFixed(2));

      const totalDutiesAndTaxes = Number((dutyAmount + vatAmount).toFixed(2));

      return {
        success: true,
        estimate: {
          declaredValue: value,
          dutyRate,
          dutyAmount,
          vatRate,
          vatAmount,
          totalDutiesAndTaxes,
          deMinimisApplied,
          hsCode: customsConfig.defaultHSCode,
          currency: 'USD',
          disclaimer: 'Estimates only — actual duties determined by destination customs authority.',
        },
      };
    } catch (err) {
      console.error('estimateCustomsDuties error:', err);
      return { success: false, error: 'Failed to estimate customs duties' };
    }
  }
);

/**
 * Calculate total landed cost (product + shipping + duties + taxes).
 * @param {string} countryCode - Destination country code.
 * @param {number} productCostUSD - Product cost in USD.
 * @param {number} shippingCostUSD - Shipping cost in USD.
 * @param {number} weightLbs - Total weight in pounds.
 * @returns {{ success: boolean, landedCost?: Object, error?: string }}
 */
export const calculateLandedCost = webMethod(
  Permissions.Anyone,
  async (countryCode, productCostUSD, shippingCostUSD, weightLbs) => {
    try {
      const code = normalizeCountryCode(countryCode);
      if (!code) {
        return { success: false, error: 'Invalid country code' };
      }

      if (code === 'US') {
        return { success: false, error: 'Landed cost calculation is for international orders only' };
      }

      const productCost = Math.max(0, Number(productCostUSD) || 0);
      const shippingCost = Math.max(0, Number(shippingCostUSD) || 0);
      const weight = Math.max(0, Number(weightLbs) || 0);

      // Get duty rate
      const dutyInfo = dutyRates[code];
      const dutyRate = dutyInfo?.rate ?? DEFAULT_DUTY_RATE;

      // Check de minimis
      const deMinimis = deMinimisUSD[code] ?? 0;
      const deMinimisApplied = deMinimis > 0 && productCost < deMinimis;
      const dutyAmount = deMinimisApplied ? 0 : Number((productCost * dutyRate).toFixed(2));

      // VAT on (product + shipping + duty) — standard for most countries
      const vatRate = vatRates[code] ?? 0;
      const vatBase = productCost + shippingCost + dutyAmount;
      const vatAmount = Number((vatBase * vatRate).toFixed(2));

      const totalLandedCost = Number((productCost + shippingCost + dutyAmount + vatAmount).toFixed(2));

      return {
        success: true,
        landedCost: {
          productCost,
          shippingCost,
          dutyRate,
          dutyAmount,
          vatRate,
          vatAmount,
          totalLandedCost,
          currency: 'USD',
          disclaimer: 'Estimates only — actual duties and taxes determined by destination customs authority.',
        },
      };
    } catch (err) {
      console.error('calculateLandedCost error:', err);
      return { success: false, error: 'Failed to calculate landed cost' };
    }
  }
);
