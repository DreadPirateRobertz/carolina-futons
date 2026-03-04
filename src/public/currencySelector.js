/**
 * Currency Selector — Frontend helper for multi-currency display.
 * Provides currency options, formatting, and country-to-currency mapping.
 */

import { supportedCurrencies, defaultCurrency } from 'public/sharedTokens.js';

// Country → Currency mapping for common destinations
const COUNTRY_CURRENCY_MAP = {
  US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', JP: 'JPY',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR',
  SE: 'EUR', NZ: 'AUD', // NZ uses AUD as closest supported
};

/**
 * Get currency dropdown options, USD first.
 * @returns {Array<{ label: string, value: string }>}
 */
export function getCurrencyOptions() {
  const entries = Object.values(supportedCurrencies);
  // USD first, then alphabetical by code
  entries.sort((a, b) => {
    if (a.code === defaultCurrency) return -1;
    if (b.code === defaultCurrency) return 1;
    return a.code.localeCompare(b.code);
  });

  return entries.map(c => ({
    label: `${c.symbol} ${c.code} — ${c.name}`,
    value: c.code,
  }));
}

/**
 * Format a price for display in a given currency using Intl.NumberFormat.
 * @param {number} amount - Amount to format.
 * @param {string} currencyCode - Currency code (e.g., 'USD', 'GBP').
 * @returns {string} Formatted price string.
 */
export function formatPriceForCurrency(amount, currencyCode) {
  const code = String(currencyCode || '').toUpperCase();
  const info = supportedCurrencies[code];
  const locale = info?.locale || 'en-US';
  const currency = info ? code : 'USD';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(Number(amount) || 0);
  } catch {
    // Fallback to basic USD formatting
    return `$${(Number(amount) || 0).toFixed(2)}`;
  }
}

/**
 * Get the default currency code for a country.
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code.
 * @returns {string} Currency code (defaults to 'USD').
 */
export function getDefaultCurrencyFromCountry(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return defaultCurrency;
  const code = countryCode.toUpperCase().trim();
  return COUNTRY_CURRENCY_MAP[code] || defaultCurrency;
}

/**
 * Validate a currency code against supported currencies.
 * @param {*} currencyCode - Currency code to validate.
 * @returns {boolean} True if supported.
 */
export function validateCurrencyCode(currencyCode) {
  if (!currencyCode || typeof currencyCode !== 'string') return false;
  const code = currencyCode.toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(code)) return false;
  return code in supportedCurrencies;
}
