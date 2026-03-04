/**
 * Currency Service — Exchange rates and multi-currency conversion.
 * Uses Open Exchange Rates API with in-memory caching.
 * Fallback rates are provided when the API is unavailable.
 */

import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { supportedCurrencies, defaultCurrency } from 'public/sharedTokens.js';
import { sanitize } from 'backend/utils/sanitize';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let _cachedRates = null;
let _cachedAt = 0;

/** @internal Reset cache — for testing only. */
export function __resetCache() {
  _cachedRates = null;
  _cachedAt = 0;
}

// Fallback rates (approximate, updated periodically)
const FALLBACK_RATES = {
  USD: 1, CAD: 1.36, GBP: 0.79, EUR: 0.92, AUD: 1.54, JPY: 149.50,
};

/**
 * Fetch current exchange rates (base USD).
 * Returns cached rates within TTL, falls back to static rates on API failure.
 * @returns {{ success: boolean, rates: Object, fallback?: boolean }}
 */
export const getExchangeRates = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      // Return cached rates if still fresh
      if (_cachedRates && (Date.now() - _cachedAt) < CACHE_TTL_MS) {
        return { success: true, rates: _cachedRates };
      }

      let apiKey;
      try {
        apiKey = await getSecret('EXCHANGE_RATE_API_KEY');
      } catch {
        // No API key configured — use fallback
        return { success: true, rates: { ...FALLBACK_RATES }, fallback: true };
      }

      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(apiKey)}&base=USD`,
        { method: 'GET' }
      );

      if (!response.ok) {
        console.error('Exchange rate API error:', response.status);
        return { success: true, rates: { ...FALLBACK_RATES }, fallback: true };
      }

      const data = await response.json();
      // Filter to only supported currencies
      const rates = {};
      for (const code of Object.keys(supportedCurrencies)) {
        rates[code] = data.rates?.[code] ?? FALLBACK_RATES[code] ?? 1;
      }

      _cachedRates = rates;
      _cachedAt = Date.now();

      return { success: true, rates };
    } catch (err) {
      console.error('getExchangeRates error:', err);
      return { success: true, rates: { ...FALLBACK_RATES }, fallback: true };
    }
  }
);

/**
 * Convert a price from one currency to another.
 * @param {number} amount - Amount to convert.
 * @param {string} fromCurrency - Source currency code (e.g., 'USD').
 * @param {string} toCurrency - Target currency code (e.g., 'CAD').
 * @returns {{ success: boolean, convertedAmount?: number, currency?: string, error?: string }}
 */
export const convertPrice = webMethod(
  Permissions.Anyone,
  async (amount, fromCurrency, toCurrency) => {
    try {
      if (typeof amount !== 'number' || isNaN(amount)) {
        return { success: false, error: 'Invalid amount' };
      }

      const cleanedAmount = Math.max(0, amount);

      const from = sanitize(String(fromCurrency || ''), 3).toUpperCase();
      const to = sanitize(String(toCurrency || ''), 3).toUpperCase();

      if (!supportedCurrencies[from]) {
        return { success: false, error: `Unsupported source currency: ${from}` };
      }
      if (!supportedCurrencies[to]) {
        return { success: false, error: `Unsupported target currency: ${to}` };
      }

      if (from === to) {
        return { success: true, convertedAmount: cleanedAmount, currency: to };
      }

      const ratesResult = await getExchangeRates();
      const rates = ratesResult.rates;

      // Convert via USD base: amount / fromRate * toRate
      const fromRate = rates[from] || 1;
      const toRate = rates[to] || 1;
      const usdAmount = cleanedAmount / fromRate;
      const converted = usdAmount * toRate;

      // Round to 2 decimal places (0 for JPY)
      const decimals = to === 'JPY' ? 0 : 2;
      const rounded = Number(converted.toFixed(decimals));

      return { success: true, convertedAmount: rounded, currency: to };
    } catch (err) {
      console.error('convertPrice error:', err);
      return { success: false, error: 'Currency conversion failed' };
    }
  }
);

/**
 * Format a price with locale-appropriate currency formatting.
 * @param {number} amount - Amount to format.
 * @param {string} currencyCode - Currency code (e.g., 'USD', 'GBP').
 * @returns {{ success: boolean, formatted?: string, error?: string }}
 */
export const formatLocalizedPrice = webMethod(
  Permissions.Anyone,
  async (amount, currencyCode) => {
    try {
      const code = sanitize(String(currencyCode || ''), 3).toUpperCase();
      const currencyInfo = supportedCurrencies[code];

      if (!currencyInfo) {
        return { success: false, error: `Unsupported currency: ${code}` };
      }

      const numAmount = Number(amount) || 0;
      const formatted = new Intl.NumberFormat(currencyInfo.locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: code === 'JPY' ? 0 : 2,
        maximumFractionDigits: code === 'JPY' ? 0 : 2,
      }).format(numAmount);

      return { success: true, formatted };
    } catch (err) {
      console.error('formatLocalizedPrice error:', err);
      return { success: false, error: 'Price formatting failed' };
    }
  }
);

/**
 * Get list of supported currencies.
 * @returns {{ success: boolean, currencies: Array<{ code: string, symbol: string, name: string }> }}
 */
export const getSupportedCurrencies = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const currencies = Object.values(supportedCurrencies).map(c => ({
        code: c.code,
        symbol: c.symbol,
        name: c.name,
      }));
      return { success: true, currencies };
    } catch (err) {
      console.error('getSupportedCurrencies error:', err);
      return { success: false, error: 'Failed to get supported currencies' };
    }
  }
);
