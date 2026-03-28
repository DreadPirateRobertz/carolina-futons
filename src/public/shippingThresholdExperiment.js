/**
 * @module shippingThresholdExperiment
 * @description A/B test for free shipping threshold — 3 variants testing
 * different price points to optimize conversion vs margin.
 *
 * Experiment: 'shipping_threshold_test'
 * Variant A: $999 threshold (control — premium positioning)
 * Variant B: $799 threshold (mid-range — tests price sensitivity)
 * Variant C: $599 threshold (aggressive — max conversion potential)
 *
 * Wires into cartService.js and cart/checkout display logic.
 *
 * CF-u0w8
 */

import { initExperiment, trackConversion, getActiveVariant } from 'public/abExperiments';

export const EXPERIMENT_NAME = 'shipping_threshold_test';

export const VARIANT_THRESHOLDS = {
  A: 999,
  B: 799,
  C: 599,
};

const DEFAULT_THRESHOLD = 999999; // Disabled (matches current cartService default)

/**
 * Initialize the shipping threshold experiment and return the active threshold.
 * Call this on Cart Page and Checkout page $w.onReady.
 *
 * @param {string} [page='Cart'] - Page name for attribution
 * @returns {Promise<{threshold: number, variantId: string|null, experimentActive: boolean}>}
 */
export async function initShippingThresholdTest(page) {
  try {
    const variant = await initExperiment(EXPERIMENT_NAME, page || 'Cart');

    if (!variant) {
      return { threshold: DEFAULT_THRESHOLD, variantId: null, experimentActive: false };
    }

    const threshold = VARIANT_THRESHOLDS[variant.id] || DEFAULT_THRESHOLD;

    return {
      threshold,
      variantId: variant.id,
      experimentActive: true,
    };
  } catch (e) {
    return { threshold: DEFAULT_THRESHOLD, variantId: null, experimentActive: false };
  }
}

/**
 * Get the current experiment's threshold (cached, no backend call).
 * Returns the default threshold if experiment hasn't been initialized.
 *
 * @returns {number}
 */
export function getActiveThreshold() {
  const variant = getActiveVariant(EXPERIMENT_NAME);
  if (!variant) return DEFAULT_THRESHOLD;
  return VARIANT_THRESHOLDS[variant.id] || DEFAULT_THRESHOLD;
}

/**
 * Check if free shipping is earned at the given subtotal for the active variant.
 *
 * @param {number} subtotal - Cart subtotal
 * @returns {boolean}
 */
export function qualifiesForFreeShipping(subtotal) {
  const threshold = getActiveThreshold();
  return subtotal >= threshold;
}

/**
 * Get shipping progress data for the active variant's threshold.
 *
 * @param {number} subtotal - Cart subtotal
 * @returns {{threshold: number, remaining: number, progressPct: number, qualifies: boolean, message: string}}
 */
export function getShippingProgress(subtotal) {
  const threshold = getActiveThreshold();

  // If threshold is disabled (> $10,000), don't show progress
  if (threshold > 10000) {
    return {
      threshold,
      remaining: 0,
      progressPct: 0,
      qualifies: false,
      message: '',
    };
  }

  const remaining = Math.max(threshold - subtotal, 0);
  const progressPct = Math.min((subtotal / threshold) * 100, 100);
  const qualifies = subtotal >= threshold;

  let message;
  if (qualifies) {
    message = 'You qualify for FREE shipping!';
  } else {
    message = `Add $${remaining.toFixed(2)} more for FREE shipping`;
  }

  return { threshold, remaining, progressPct, qualifies, message };
}

/**
 * Track a purchase conversion for the shipping threshold experiment.
 * Call this on the Thank You page after order completion.
 *
 * @param {string} [page='ThankYou']
 * @returns {Promise<void>}
 */
export async function trackShippingConversion(page) {
  await trackConversion(EXPERIMENT_NAME, page || 'ThankYou');
}

/**
 * Get the formatted threshold text for display.
 *
 * @returns {string} e.g., "$999+" or "" if disabled
 */
export function getThresholdDisplayText() {
  const threshold = getActiveThreshold();
  if (threshold > 10000) return '';
  return `$${threshold}+`;
}
