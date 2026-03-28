/**
 * @module abExperiments
 * @description A/B experiment definitions and mobile-friendly variant assignment.
 * Defines 5 initial experiments for Wave 30 conversion optimization and
 * provides getExperimentVariant() as the cross-rig API for dallas mobile.
 *
 * Experiments:
 *   1. free-shipping-threshold — $999 vs $799 vs $599
 *   2. bundle-discount-type — 5% off vs 10% off vs free cover
 *   3. style-quiz-gate — required vs optional registration
 *   4. spin-to-win-gate — email-first vs spin-first
 *   5. gamification-tour — auto-show vs opt-in
 *
 * @requires wix-web-module
 * @requires wix-data
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';
import { logError } from 'backend/utils/errorHandler';

// ── Experiment Definitions ──────────────────────────────────────────

export const EXPERIMENTS = {
  'free-shipping-threshold': {
    testName: 'free-shipping-threshold',
    description: 'Free shipping threshold: $999 vs $799 vs $599 (PREREQUISITE: re-enable free shipping in cartService — disabled in PR #422)',
    hypothesis: 'Lowering from $999 to $799 increases checkout completion without destroying margin',
    metric: 'checkout_completion_rate',
    secondaryMetric: 'aov',
    variants: [
      { id: 'control', name: '$999 threshold', weight: 34 },
      { id: 'variant-b', name: '$799 threshold', weight: 33 },
      { id: 'variant-c', name: '$599 threshold', weight: 33 },
    ],
    trafficPercent: 100,
    pages: ['Cart Page', 'Side Cart', 'Shipping Policy'],
  },

  'bundle-discount-type': {
    testName: 'bundle-discount-type',
    description: 'Bundle discount: flat % off vs free cover accessory',
    hypothesis: '"Free cover with frame+mattress" outperforms flat 5% discount',
    metric: 'bundle_attach_rate',
    secondaryMetric: 'aov',
    variants: [
      { id: 'control', name: '5% off bundle', weight: 34 },
      { id: 'variant-b', name: '10% off bundle', weight: 33 },
      { id: 'variant-c', name: 'Free cover accessory', weight: 33 },
    ],
    trafficPercent: 100,
    pages: ['Product Page', 'Cart suggestions'],
  },

  'style-quiz-gate': {
    testName: 'style-quiz-gate',
    description: 'Style quiz: require vs optional registration after quiz',
    hypothesis: 'Requiring registration after quiz captures emails without killing completion',
    metric: 'quiz_completion_rate',
    secondaryMetric: 'email_capture_rate',
    variants: [
      { id: 'control', name: 'Registration required', weight: 50 },
      { id: 'variant-b', name: 'Optional registration', weight: 50 },
    ],
    trafficPercent: 100,
    pages: ['Style Quiz', 'StyleQuizResult'],
  },

  'spin-to-win-gate': {
    testName: 'spin-to-win-gate',
    description: 'Spin-to-Win: email gate before vs after spin',
    hypothesis: 'Email gate before spin captures more emails than ungated',
    metric: 'email_capture_rate',
    secondaryMetric: 'coupon_redemption_rate',
    variants: [
      { id: 'control', name: 'Email required before spin', weight: 50 },
      { id: 'variant-b', name: 'Spin first, email to claim', weight: 50 },
    ],
    trafficPercent: 100,
    pages: ['masterPage'],
  },

  'gamification-tour': {
    testName: 'gamification-tour',
    description: 'Gamification tour: auto-show on first login vs opt-in button',
    hypothesis: 'Auto-showing tour improves engagement without increasing bounce',
    metric: 'feature_adoption_rate',
    secondaryMetric: 'bounce_rate',
    variants: [
      { id: 'control', name: 'Auto-show tour', weight: 50 },
      { id: 'variant-b', name: 'Opt-in button in dashboard', weight: 50 },
    ],
    trafficPercent: 100,
    pages: ['Member Page', 'masterPage'],
  },
};

// ── Seed Experiments (Admin) ────────────────────────────────────────

/**
 * Seed all 5 experiments into the AbTests CMS collection.
 * Idempotent — skips experiments that already exist.
 *
 * @returns {Promise<{success: boolean, created: string[], skipped: string[], error?: string}>}
 * @permission Admin
 */
export const seedExperiments = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const created = [];
      const skipped = [];

      for (const [key, experiment] of Object.entries(EXPERIMENTS)) {
        const existing = await wixData.query('AbTests')
          .eq('testName', experiment.testName)
          .find();

        if (existing.items.length > 0) {
          skipped.push(key);
          continue;
        }

        await wixData.insert('AbTests', {
          testName: experiment.testName,
          variants: JSON.stringify(experiment.variants),
          trafficPercent: experiment.trafficPercent,
          active: false, // Start inactive — activate when ready
          winnerVariant: '',
          createdAt: new Date(),
          description: experiment.description,
          hypothesis: experiment.hypothesis,
          metric: experiment.metric,
          secondaryMetric: experiment.secondaryMetric ?? '',
          pages: JSON.stringify(experiment.pages),
        });

        created.push(key);
      }

      logAuditEvent('AbTests', 'seed_experiments', 'admin', { created: created.length, skipped: skipped.length });
      return { success: true, created, skipped };
    } catch (err) {
      logError('abExperiments.seedExperiments', err);
      return { success: false, error: 'Failed to seed experiments' };
    }
  }
);

// ── Get Experiment Variant (cross-rig API) ──────────────────────────

/**
 * Get the assigned variant for an experiment. Mobile-friendly wrapper
 * around abTesting.getVariant with experiment metadata.
 *
 * Returns the variant assignment plus experiment context (what the variant
 * means for the calling page). This is the canonical API for dallas mobile.
 *
 * @param {string} experimentId - One of the EXPERIMENTS keys
 * @param {string} userId - Member ID or device ID for deterministic assignment
 * @returns {Promise<{success: boolean, experimentId?: string, variant?: Object,
 *   active?: boolean, config?: Object, error?: string}>}
 * @permission Anyone — mobile clients call without member auth for anonymous users
 */
export const getExperimentVariant = webMethod(
  Permissions.Anyone,
  async (experimentId, userId) => {
    try {
      if (!experimentId || !userId) {
        return { success: false, error: 'experimentId and userId are required' };
      }

      const cleanId = sanitize(experimentId, 100);
      const cleanUser = sanitize(userId, 100);

      const { allowed } = await checkRateLimit('ExperimentVariantRateLimit', cleanUser, { max: 30, windowMs: 60_000 });
      if (!allowed) return { success: false, error: 'Too many requests. Please try again later.' };

      // Look up experiment in CMS
      const result = await wixData.query('AbTests')
        .eq('testName', cleanId)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Experiment not found' };
      }

      const test = result.items[0];
      const variants = parseVariants(test.variants);

      if (variants.length === 0) {
        return { success: false, error: 'Experiment has no variants' };
      }

      // Inactive: return winner or control
      if (!test.active) {
        const winner = test.winnerVariant
          ? variants.find(v => v.id === test.winnerVariant) ?? variants[0]
          : variants[0];
        return {
          success: true,
          experimentId: cleanId,
          variant: { id: winner.id, name: winner.name },
          active: false,
          config: buildVariantConfig(cleanId, winner.id),
        };
      }

      // Deterministic assignment
      const variant = assignVariant(cleanId, cleanUser, variants);

      return {
        success: true,
        experimentId: cleanId,
        variant: { id: variant.id, name: variant.name },
        active: true,
        config: buildVariantConfig(cleanId, variant.id),
      };
    } catch (err) {
      logError('abExperiments.getExperimentVariant', err);
      return { success: false, error: 'Unable to get experiment variant' };
    }
  }
);

// ── List All Experiments ────────────────────────────────────────────

/**
 * List all available experiments with their current status.
 * Mobile uses this to know which experiments to check.
 *
 * @returns {Promise<{success: boolean, experiments?: Array}>}
 * @permission Anyone
 */
export const listExperiments = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData.query('AbTests')
        .find();

      const experiments = result.items.map(t => ({
        id: t.testName,
        active: t.active,
        description: t.description || '',
        variantCount: parseVariants(t.variants).length,
      }));

      return { success: true, experiments };
    } catch (err) {
      logError('abExperiments.listExperiments', err);
      return { success: false, error: 'Unable to list experiments' };
    }
  }
);

// ── Variant Config Builder ──────────────────────────────────────────

/**
 * Build experiment-specific configuration for a variant.
 * This tells the calling page what values to use for each variant.
 */
function buildVariantConfig(experimentId, variantId) {
  const configs = {
    'free-shipping-threshold': {
      'control': { threshold: 999 },
      'variant-b': { threshold: 799 },
      'variant-c': { threshold: 599 },
    },
    'bundle-discount-type': {
      'control': { discountType: 'percentage', discountValue: 5 },
      'variant-b': { discountType: 'percentage', discountValue: 10 },
      'variant-c': { discountType: 'free_cover', discountValue: 0 },
    },
    'style-quiz-gate': {
      'control': { registrationRequired: true },
      'variant-b': { registrationRequired: false },
    },
    'spin-to-win-gate': {
      'control': { emailBeforeSpin: true },
      'variant-b': { emailBeforeSpin: false },
    },
    'gamification-tour': {
      'control': { autoShow: true },
      'variant-b': { autoShow: false },
    },
  };

  return configs[experimentId]?.[variantId] ?? {};
}

// ── Internal Helpers (duplicated from abTesting for module independence) ─

function parseVariants(variantsField) {
  if (!variantsField) return [];
  if (Array.isArray(variantsField)) return variantsField;
  try {
    return JSON.parse(variantsField);
  } catch (err) {
    logError('abExperiments.parseVariants', err);
    return [];
  }
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function assignVariant(testName, visitorId, variants) {
  const hash = simpleHash(`${testName}:${visitorId}`);
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight ?? 50), 0);
  let bucket = hash % totalWeight;
  for (const variant of variants) {
    bucket -= (variant.weight ?? 50);
    if (bucket < 0) return variant;
  }
  return variants[0];
}

// ── Exports for testing ─────────────────────────────────────────────
export { buildVariantConfig as _buildVariantConfig };
export { assignVariant as _assignVariant };
