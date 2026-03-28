/**
 * @module gamificationTourExperiment
 * @description A/B test for gamification tour trigger — auto vs opt-in.
 *
 * Hypothesis: Auto-triggering the gamification tour on first visit will
 * increase loyalty enrollment by 15%+, but may annoy users who aren't
 * ready to engage. Opt-in (subtle CTA) produces higher-quality enrollments
 * with better 30-day retention.
 *
 * Experiment: 'gamification_tour_test'
 * Variant A: auto (control — tour auto-shows on first member page visit)
 * Variant B: opt-in (tour CTA button visible, user chooses to start)
 *
 * Success metric: Loyalty enrollment rate AND 30-day point activity.
 * Primary KPI: loyalty_enrolled events / unique member page visits.
 * Secondary KPI: % of enrolled members with >0 points at Day 30.
 * Sample size: ~1,500 new member page visitors per variant (MDE 12%, α=0.05, β=0.2).
 *
 * CF-8ush
 */

import { initExperiment, trackConversion, getActiveVariant } from 'public/abExperiments';

export const EXPERIMENT_NAME = 'gamification_tour_test';

export const VARIANTS = {
  A: { id: 'A', name: 'Auto-trigger (control)', autoShow: true },
  B: { id: 'B', name: 'Opt-in CTA', autoShow: false },
};

/**
 * Initialize the gamification tour experiment.
 * Call on Member Page $w.onReady.
 *
 * @returns {Promise<{autoShow: boolean, variantId: string|null, experimentActive: boolean}>}
 */
export async function initGamificationTourTest() {
  try {
    const variant = await initExperiment(EXPERIMENT_NAME, 'MemberPage');
    if (!variant) {
      return { autoShow: true, variantId: null, experimentActive: false };
    }
    const config = VARIANTS[variant.id] || VARIANTS.A;
    return { autoShow: config.autoShow, variantId: variant.id, experimentActive: true };
  } catch (_) {
    return { autoShow: true, variantId: null, experimentActive: false };
  }
}

/**
 * Get whether tour should auto-show (cached).
 * @returns {boolean}
 */
export function shouldAutoShowTour() {
  const variant = getActiveVariant(EXPERIMENT_NAME);
  if (!variant) return true;
  return VARIANTS[variant.id]?.autoShow ?? true;
}

/**
 * Track tour completion.
 * @param {boolean} enrolled - Whether user enrolled in loyalty program
 */
export async function trackTourCompletion(enrolled) {
  await trackConversion(EXPERIMENT_NAME, 'tour_completed', { enrolled });
}

/**
 * Track opt-in CTA click (variant B only).
 */
export async function trackTourOptIn() {
  await trackConversion(EXPERIMENT_NAME, 'tour_opt_in_clicked', {});
}
