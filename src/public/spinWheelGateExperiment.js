/**
 * @module spinWheelGateExperiment
 * @description A/B test for spin-to-win email gate — gate vs no-gate.
 *
 * Hypothesis: Removing the email gate from the spin wheel will increase
 * engagement (more spins) but decrease email capture rate. Net effect on
 * downstream conversions (email → purchase) determines winner.
 *
 * Experiment: 'spin_wheel_gate_test'
 * Variant A: email-gate (control — email required before spinning)
 * Variant B: no-gate (spin immediately, email collected on prize claim)
 *
 * Success metric: Email capture rate AND spin-to-purchase conversion.
 * Primary KPI: emails captured / unique spin widget impressions.
 * Secondary KPI: prize redemption rate (coupon used at checkout).
 * Sample size: ~3,000 spin impressions per variant (MDE 8%, α=0.05, β=0.2).
 *
 * CF-8ush
 */

import { initExperiment, trackConversion, getActiveVariant } from 'public/abExperiments';

export const EXPERIMENT_NAME = 'spin_wheel_gate_test';

export const VARIANTS = {
  A: { id: 'A', name: 'Email gate (control)', requireEmail: true },
  B: { id: 'B', name: 'No gate (claim gate)', requireEmail: false },
};

/**
 * Initialize the spin wheel gate experiment.
 * Call when spin widget loads.
 *
 * @returns {Promise<{requireEmail: boolean, variantId: string|null, experimentActive: boolean}>}
 */
export async function initSpinWheelGateTest() {
  try {
    const variant = await initExperiment(EXPERIMENT_NAME, 'SpinWheel');
    if (!variant) {
      return { requireEmail: true, variantId: null, experimentActive: false };
    }
    const config = VARIANTS[variant.id] || VARIANTS.A;
    return { requireEmail: config.requireEmail, variantId: variant.id, experimentActive: true };
  } catch (_) {
    return { requireEmail: true, variantId: null, experimentActive: false };
  }
}

/**
 * Get whether email is required before spin (cached).
 * @returns {boolean}
 */
export function isEmailRequiredForSpin() {
  const variant = getActiveVariant(EXPERIMENT_NAME);
  if (!variant) return true;
  return VARIANTS[variant.id]?.requireEmail ?? true;
}

/**
 * Track spin completion.
 * @param {boolean} emailCaptured
 * @param {string} [prize] - Prize won (if any)
 */
export async function trackSpinComplete(emailCaptured, prize) {
  await trackConversion(EXPERIMENT_NAME, 'spin_completed', {
    emailCaptured,
    prize: prize || 'none',
  });
}

/**
 * Track prize redemption (coupon used at checkout).
 */
export async function trackPrizeRedemption() {
  await trackConversion(EXPERIMENT_NAME, 'prize_redeemed', {});
}
