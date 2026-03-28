/**
 * @module bundleDiscountExperiment
 * @description A/B test for bundle discount strategy — 3 variants testing
 * percentage discount vs free accessory to optimize bundle conversion.
 *
 * Experiment: 'bundle_discount_test'
 * Variant A: 5% off bundle price (control — conservative margin)
 * Variant B: 10% off bundle price (aggressive — tests price sensitivity)
 * Variant C: Free accessory (e.g., pillow or cover — perceived value play)
 *
 * CF-fb99
 */

import { initExperiment, trackConversion, getActiveVariant } from 'public/abExperiments';

export const EXPERIMENT_NAME = 'bundle_discount_test';

export const VARIANTS = {
  A: { id: 'A', type: 'percent_off', discountPercent: 5, label: '5% Off Bundle', badgeText: 'SAVE 5%' },
  B: { id: 'B', type: 'percent_off', discountPercent: 10, label: '10% Off Bundle', badgeText: 'SAVE 10%' },
  C: { id: 'C', type: 'free_accessory', discountPercent: 0, label: 'Free Accessory', badgeText: 'FREE GIFT', accessoryName: 'Premium Futon Cover', accessoryValue: 49.99 },
};

/**
 * Initialize the bundle discount experiment.
 *
 * @param {string} [page='Bundle']
 * @returns {Promise<{variant: Object|null, experimentActive: boolean}>}
 */
export async function initBundleDiscountTest(page) {
  try {
    const assigned = await initExperiment(EXPERIMENT_NAME, page || 'Bundle');
    if (!assigned) return { variant: null, experimentActive: false };

    const variant = VARIANTS[assigned.id] || null;
    return { variant, experimentActive: true };
  } catch (e) {
    return { variant: null, experimentActive: false };
  }
}

/**
 * Get the active variant config (cached, no backend call).
 *
 * @returns {Object|null}
 */
export function getActiveBundleVariant() {
  const assigned = getActiveVariant(EXPERIMENT_NAME);
  if (!assigned) return null;
  return VARIANTS[assigned.id] || null;
}

/**
 * Calculate the bundle discount for the active variant.
 *
 * @param {number} bundlePrice - Original bundle total
 * @returns {{type: string, discountAmount: number, finalPrice: number, freeAccessory: string|null, badgeText: string}}
 */
export function calculateBundleDiscount(bundlePrice) {
  const variant = getActiveBundleVariant();

  if (!variant || bundlePrice <= 0) {
    return {
      type: 'none',
      discountAmount: 0,
      finalPrice: bundlePrice || 0,
      freeAccessory: null,
      badgeText: '',
    };
  }

  if (variant.type === 'percent_off') {
    const discountAmount = Math.round(bundlePrice * (variant.discountPercent / 100) * 100) / 100;
    return {
      type: 'percent_off',
      discountAmount,
      finalPrice: Math.round((bundlePrice - discountAmount) * 100) / 100,
      freeAccessory: null,
      badgeText: variant.badgeText,
    };
  }

  if (variant.type === 'free_accessory') {
    return {
      type: 'free_accessory',
      discountAmount: variant.accessoryValue,
      finalPrice: bundlePrice,
      freeAccessory: variant.accessoryName,
      badgeText: variant.badgeText,
    };
  }

  return { type: 'none', discountAmount: 0, finalPrice: bundlePrice, freeAccessory: null, badgeText: '' };
}

/**
 * Get display data for the bundle offer badge/banner.
 *
 * @param {number} bundlePrice
 * @returns {{show: boolean, badgeText: string, savingsText: string, detailText: string}}
 */
export function getBundleOfferDisplay(bundlePrice) {
  const variant = getActiveBundleVariant();
  if (!variant) return { show: false, badgeText: '', savingsText: '', detailText: '' };

  const discount = calculateBundleDiscount(bundlePrice);

  if (variant.type === 'percent_off') {
    return {
      show: true,
      badgeText: variant.badgeText,
      savingsText: `Save $${discount.discountAmount.toFixed(2)}`,
      detailText: `${variant.discountPercent}% off when you buy the bundle`,
    };
  }

  if (variant.type === 'free_accessory') {
    return {
      show: true,
      badgeText: variant.badgeText,
      savingsText: `Free ${variant.accessoryName} ($${variant.accessoryValue})`,
      detailText: 'Includes a free accessory with your bundle',
    };
  }

  return { show: false, badgeText: '', savingsText: '', detailText: '' };
}

/**
 * Track bundle purchase conversion.
 *
 * @param {string} [page='ThankYou']
 */
export async function trackBundleConversion(page) {
  await trackConversion(EXPERIMENT_NAME, page || 'ThankYou');
}
