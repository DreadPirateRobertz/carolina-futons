/**
 * @module quizGateExperiment
 * @description A/B test for style quiz gate — required vs optional.
 *
 * Hypothesis: Making the quiz optional (gate removed) will increase quiz
 * completion rate by reducing friction, BUT may decrease lead capture rate
 * since users can skip directly to results.
 *
 * Experiment: 'quiz_gate_test'
 * Variant A: required (control — quiz must be completed to see recommendations)
 * Variant B: optional (quiz is suggested but "Skip to browse" link is visible)
 *
 * Success metric: Lead capture rate (email collected) AND quiz completion rate.
 * Primary KPI: quiz_completed events / unique quiz page views.
 * Secondary KPI: email capture rate from quiz flow.
 * Sample size: ~2,000 quiz page visitors per variant (MDE 10%, α=0.05, β=0.2).
 *
 * CF-8ush
 */

import { initExperiment, trackConversion, getActiveVariant } from 'public/abExperiments';

export const EXPERIMENT_NAME = 'quiz_gate_test';

export const VARIANTS = {
  A: { id: 'A', name: 'Required (control)', gateRequired: true },
  B: { id: 'B', name: 'Optional (skip link)', gateRequired: false },
};

/**
 * Initialize the quiz gate experiment.
 * Call on Style Quiz page $w.onReady.
 *
 * @returns {Promise<{gateRequired: boolean, variantId: string|null, experimentActive: boolean}>}
 */
export async function initQuizGateTest() {
  try {
    const variant = await initExperiment(EXPERIMENT_NAME, 'StyleQuiz');
    if (!variant) {
      return { gateRequired: true, variantId: null, experimentActive: false };
    }
    const config = VARIANTS[variant.id] || VARIANTS.A;
    return { gateRequired: config.gateRequired, variantId: variant.id, experimentActive: true };
  } catch (_) {
    return { gateRequired: true, variantId: null, experimentActive: false };
  }
}

/**
 * Get whether the quiz gate is required (cached).
 * @returns {boolean}
 */
export function isQuizGateRequired() {
  const variant = getActiveVariant(EXPERIMENT_NAME);
  if (!variant) return true; // default: required
  return VARIANTS[variant.id]?.gateRequired ?? true;
}

/**
 * Track quiz completion as a conversion event.
 * @param {boolean} emailCaptured - Whether email was collected
 */
export async function trackQuizCompletion(emailCaptured = false) {
  await trackConversion(EXPERIMENT_NAME, 'quiz_completed', {
    emailCaptured,
  });
}

/**
 * Track quiz skip (variant B only — user clicked "Skip to browse").
 */
export async function trackQuizSkip() {
  await trackConversion(EXPERIMENT_NAME, 'quiz_skipped', {});
}
