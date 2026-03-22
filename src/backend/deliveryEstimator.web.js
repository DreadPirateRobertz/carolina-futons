/**
 * @module deliveryEstimator.web
 * @description webMethod getDeliveryEstimate(zip, productIds) — delivery window
 * estimator for both the web Product Detail Page and cfutons_mobile.
 *
 * Calls the UPS API for live ground delivery estimates. If UPS is unavailable
 * (network error, empty response), falls back to a static '2-5 business days'
 * estimate so callers always receive a usable response.
 *
 * Circuit breaker note: Wix Velo backend is stateless — each serverless
 * invocation starts fresh. The module-level `circuitOpenUntil` provides
 * within-process-instance short-circuit (protects warm instances from hammering
 * a known-down UPS endpoint). For a fully persistent circuit breaker, store
 * state in Wix Cache or a CMS collection.
 *
 * @requires backend/ups-shipping.web  - getUPSRates, getPackageDimensions
 * @requires backend/utils/errorHandler - logError
 */

import { Permissions, webMethod } from 'wix-web-module';
import { getUPSRates, getPackageDimensions } from 'backend/ups-shipping.web';
import { logError } from 'backend/utils/errorHandler';

/** Max products per call — prevents API amplification */
const MAX_PRODUCTS = 10;

/** Fallback estimate text returned when UPS is unavailable */
const FALLBACK_ESTIMATE = '2-5 business days';

/**
 * Circuit breaker state (within-process only).
 * Set to a future timestamp when UPS fails; cleared after CIRCUIT_TIMEOUT_MS.
 */
let circuitOpenUntil = 0;
const CIRCUIT_TIMEOUT_MS = 60_000; // 1 minute per warm instance

/**
 * Parse a UPS estimatedDelivery string into { minDays, maxDays }.
 * Handles formats: '5-7 business days', '1 business day', '3 business days'.
 *
 * @param {string} str
 * @returns {{ minDays: number, maxDays: number }}
 */
function parseDayRange(str) {
  if (!str) return { minDays: 2, maxDays: 5 };
  const rangeMatch = str.match(/(\d+)-(\d+)/);
  if (rangeMatch) return { minDays: parseInt(rangeMatch[1], 10), maxDays: parseInt(rangeMatch[2], 10) };
  const singleMatch = str.match(/^(\d+)/);
  if (singleMatch) {
    const days = parseInt(singleMatch[1], 10);
    return { minDays: days, maxDays: days };
  }
  return { minDays: 2, maxDays: 5 };
}

/**
 * Add business days to a date (skips Sat/Sun).
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/**
 * Build the fallback response when UPS is unavailable.
 * @returns {{ success: true, estimate: string, source: 'fallback', service: null }}
 */
function buildFallback() {
  return {
    success: true,
    estimate: FALLBACK_ESTIMATE,
    source: 'fallback',
    service: null,
  };
}

/**
 * Get a delivery window estimate for one or more products to a US ZIP code.
 *
 * Response shape (success):
 * {
 *   success: true,
 *   estimate: '5-7 business days',   // human-readable
 *   minDays: 5,
 *   maxDays: 7,
 *   minDate: '2026-03-27',           // ISO date
 *   maxDate: '2026-03-29',           // ISO date
 *   source: 'ups' | 'fallback',
 *   service: 'UPS Ground' | null,
 * }
 *
 * Response shape (error):
 * { success: false, error: string }
 *
 * @param {string} zip - 5-digit US ZIP code
 * @param {string[]} [productIds] - Wix catalog product IDs (for dimension lookup)
 * @returns {Promise<Object>}
 */
export const getDeliveryEstimate = webMethod(
  Permissions.Anyone,
  async (zip, productIds) => {
    // ── Zip validation ─────────────────────────────────────────────────────
    if (!zip || !/^\d{5}$/.test(String(zip))) {
      return { success: false, error: 'Valid 5-digit US ZIP required' };
    }

    // ── Circuit breaker: skip UPS if known down ───────────────────────────
    if (Date.now() < circuitOpenUntil) {
      return buildFallback();
    }

    // ── Build packages from productIds ────────────────────────────────────
    const ids = Array.isArray(productIds) ? productIds.slice(0, MAX_PRODUCTS) : [];
    // Use at least one package (default dims) when no productIds supplied
    const effectiveIds = ids.length > 0 ? ids : [null];

    const packages = effectiveIds.map(() => {
      // CMS profile lookup is intentionally omitted here — the delivery window
      // for ground shipping doesn't vary meaningfully by product weight within
      // CF's furniture range. Category-default dims give a good-enough estimate.
      return getPackageDimensions('default');
    });

    // ── UPS API call ──────────────────────────────────────────────────────
    try {
      const rates = await getUPSRates(
        { postalCode: zip, country: 'US' },
        packages,
        0 // no free-shipping threshold for window estimates
      );

      if (!rates || rates.length === 0) {
        logError('deliveryEstimator.getDeliveryEstimate', new Error('UPS returned no rates'), { zip });
        circuitOpenUntil = Date.now() + CIRCUIT_TIMEOUT_MS;
        return buildFallback();
      }

      // Use the first (cheapest/ground) rate for the window estimate
      const rate = rates[0];
      const { minDays, maxDays } = parseDayRange(rate.estimatedDelivery);
      const today = new Date();
      const minDate = addBusinessDays(today, minDays);
      const maxDate = addBusinessDays(today, maxDays);

      return {
        success: true,
        estimate: rate.estimatedDelivery,
        minDays,
        maxDays,
        minDate: minDate.toISOString().split('T')[0],
        maxDate: maxDate.toISOString().split('T')[0],
        source: 'ups',
        service: rate.title || 'UPS Ground',
      };

    } catch (err) {
      logError('deliveryEstimator.getDeliveryEstimate', err, { zip });
      circuitOpenUntil = Date.now() + CIRCUIT_TIMEOUT_MS;
      return buildFallback();
    }
  }
);
