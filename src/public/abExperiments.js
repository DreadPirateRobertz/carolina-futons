/**
 * @module abExperiments
 * @description Frontend A/B experiment wiring — assigns variants on page load,
 * applies config, and tracks impressions/conversions.
 *
 * Usage in page files:
 *   import { initExperiment, trackConversion } from 'public/abExperiments';
 *
 *   $w.onReady(async () => {
 *     const variant = await initExperiment('hero_cta_test', 'Home');
 *     if (variant?.id === 'B') {
 *       $w('#heroCTA').label = 'Shop Our Best Sellers';
 *     }
 *   });
 *
 *   // On conversion:
 *   trackConversion('hero_cta_test');
 *
 * CF-c75d
 */

import { getVariant, trackEvent as abTrackEvent } from 'backend/abTesting.web';

let _visitorId = null;
const _activeVariants = {};

/**
 * Get or create a stable visitor ID for A/B assignment.
 * Uses session storage for consistency within a session.
 *
 * @returns {string}
 */
function getVisitorId() {
  if (_visitorId) return _visitorId;

  try {
    const stored = (typeof sessionStorage !== 'undefined')
      ? sessionStorage.getItem('cf_ab_visitor')
      : null;
    if (stored) {
      _visitorId = stored;
      return _visitorId;
    }
  } catch (e) {}

  // Generate a simple random ID
  _visitorId = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('cf_ab_visitor', _visitorId);
    }
  } catch (e) {}

  return _visitorId;
}

/**
 * Initialize an A/B experiment on page load.
 * Assigns a variant deterministically, tracks an impression, and caches
 * the assignment for the session.
 *
 * @param {string} testName - Experiment name (must match AbTests collection)
 * @param {string} [page] - Page name for analytics attribution
 * @returns {Promise<{id: string, name: string}|null>} Assigned variant, or null on error
 */
export async function initExperiment(testName, page) {
  try {
    if (!testName) return null;

    // Return cached variant if already initialized this session
    if (_activeVariants[testName]) {
      return _activeVariants[testName];
    }

    const visitorId = getVisitorId();
    const result = await getVariant(testName, visitorId);

    if (!result || !result.success || !result.variant) {
      return null;
    }

    const variant = result.variant;
    _activeVariants[testName] = variant;

    // Track impression (fire-and-forget)
    if (result.testActive) {
      abTrackEvent(testName, variant.id, visitorId, 'impression', page || '')
        .catch(() => {});
    }

    return variant;
  } catch (e) {
    return null;
  }
}

/**
 * Track a conversion event for an active experiment.
 *
 * @param {string} testName - Experiment name
 * @param {string} [page] - Page where conversion occurred
 * @returns {Promise<void>}
 */
export async function trackConversion(testName, page) {
  try {
    const variant = _activeVariants[testName];
    if (!variant) return;

    const visitorId = getVisitorId();
    await abTrackEvent(testName, variant.id, visitorId, 'conversion', page || '');
  } catch (e) {}
}

/**
 * Get the currently assigned variant for a test (if already initialized).
 * Does NOT call the backend — only returns cached assignment.
 *
 * @param {string} testName
 * @returns {{id: string, name: string}|null}
 */
export function getActiveVariant(testName) {
  return _activeVariants[testName] || null;
}

/**
 * Initialize multiple experiments at once (parallel calls).
 *
 * @param {Array<{testName: string, page?: string}>} experiments
 * @returns {Promise<Object>} Map of testName → variant
 */
export async function initExperiments(experiments) {
  if (!Array.isArray(experiments)) return {};

  const results = await Promise.all(
    experiments.map(exp => initExperiment(exp.testName, exp.page))
  );

  const map = {};
  experiments.forEach((exp, i) => {
    if (results[i]) map[exp.testName] = results[i];
  });

  return map;
}

/**
 * Apply variant config to page elements.
 * Takes a map of variant ID → element changes and applies the matching one.
 *
 * @param {string} testName - Test to check
 * @param {Object} variantConfig - { 'A': (variant) => {...}, 'B': (variant) => {...} }
 * @returns {boolean} True if a variant was applied
 */
export function applyVariant(testName, variantConfig) {
  const variant = _activeVariants[testName];
  if (!variant || !variantConfig) return false;

  const handler = variantConfig[variant.id];
  if (typeof handler === 'function') {
    handler(variant);
    return true;
  }
  return false;
}

// Reset for testing
export function _reset() {
  _visitorId = null;
  for (const key of Object.keys(_activeVariants)) {
    delete _activeVariants[key];
  }
}
