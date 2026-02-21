/**
 * @module abTesting
 * @description Lightweight A/B testing framework. Manages test variants,
 * assigns visitors deterministically, tracks impressions/conversions,
 * and calculates statistical significance.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * 1. Create `AbTests` CMS collection with fields:
 *    testName (text, unique), variants (text, JSON array of {id, name, weight}),
 *    trafficPercent (number, 0-100), active (boolean),
 *    winnerVariant (text), createdAt (dateTime)
 *
 * 2. Create `AbEvents` CMS collection with fields:
 *    testName (text), variantId (text), visitorId (text),
 *    eventType (text: impression|conversion), timestamp (dateTime),
 *    page (text), metadata (text)
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// Z-score for 95% confidence (p < 0.05, two-tailed)
const Z_95 = 1.96;

// ── Get Variant Assignment ──────────────────────────────────────────

/**
 * Assign a visitor to a test variant. Deterministic: same visitorId always
 * gets the same variant. Returns the winner variant if test is disabled.
 *
 * @function getVariant
 * @param {string} testName - Test identifier
 * @param {string} visitorId - Persistent visitor ID (from cookie)
 * @returns {Promise<{success: boolean, variant?: {id: string, name: string}, testActive?: boolean}>}
 * @permission Anyone
 */
export const getVariant = webMethod(
  Permissions.Anyone,
  async (testName, visitorId) => {
    try {
      if (!testName || !visitorId) {
        return { success: false, error: 'Test name and visitor ID required' };
      }

      const cleanTest = sanitize(testName, 100);
      const cleanVisitor = sanitize(visitorId, 100);

      const result = await wixData.query('AbTests')
        .eq('testName', cleanTest)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Test not found' };
      }

      const test = result.items[0];
      const variants = parseVariants(test.variants);

      if (variants.length === 0) {
        return { success: false, error: 'Test has no variants' };
      }

      // Disabled test: show winner or first variant
      if (!test.active) {
        const winner = test.winnerVariant
          ? variants.find(v => v.id === test.winnerVariant) || variants[0]
          : variants[0];
        return { success: true, variant: { id: winner.id, name: winner.name }, testActive: false };
      }

      // Check traffic allocation
      if (test.trafficPercent < 100) {
        const hash = simpleHash(`${cleanTest}:traffic:${cleanVisitor}`);
        if ((hash % 100) >= test.trafficPercent) {
          // Not in test — show control (first variant)
          return { success: true, variant: { id: variants[0].id, name: variants[0].name }, testActive: false };
        }
      }

      // Deterministic assignment based on visitor hash
      const variant = assignVariant(cleanTest, cleanVisitor, variants);

      return { success: true, variant: { id: variant.id, name: variant.name }, testActive: true };
    } catch (err) {
      console.error('[AbTesting] Error getting variant:', err);
      return { success: false, error: 'Unable to get variant' };
    }
  }
);

// ── Track Event ─────────────────────────────────────────────────────

/**
 * Track an impression or conversion event for an A/B test.
 *
 * @function trackEvent
 * @param {string} testName - Test identifier
 * @param {string} variantId - Variant ID
 * @param {string} visitorId - Visitor ID
 * @param {string} eventType - 'impression' or 'conversion'
 * @param {string} [page] - Page where event occurred
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone
 */
export const trackEvent = webMethod(
  Permissions.Anyone,
  async (testName, variantId, visitorId, eventType, page = '') => {
    try {
      if (!testName || !variantId || !visitorId || !eventType) {
        return { success: false };
      }

      const validEvents = ['impression', 'conversion'];
      const cleanEvent = sanitize(eventType, 20).toLowerCase();
      if (!validEvents.includes(cleanEvent)) {
        return { success: false };
      }

      await wixData.insert('AbEvents', {
        testName: sanitize(testName, 100),
        variantId: sanitize(variantId, 50),
        visitorId: sanitize(visitorId, 100),
        eventType: cleanEvent,
        timestamp: new Date(),
        page: sanitize(page, 200),
      });

      return { success: true };
    } catch (err) {
      // Silent — tracking failures should not affect user experience
      console.error('[AbTesting] Event tracking error:', err?.message);
      return { success: false };
    }
  }
);

// ── Get Test Results (Admin) ────────────────────────────────────────

/**
 * Get A/B test results with conversion rates and significance.
 *
 * @function getTestResults
 * @param {string} testName - Test identifier
 * @returns {Promise<{success: boolean, results?: Object}>}
 * @permission Admin
 */
export const getTestResults = webMethod(
  Permissions.Admin,
  async (testName) => {
    try {
      if (!testName) return { success: false, error: 'Test name required' };

      const cleanTest = sanitize(testName, 100);

      // Get test config
      const testResult = await wixData.query('AbTests')
        .eq('testName', cleanTest)
        .find();

      if (testResult.items.length === 0) {
        return { success: false, error: 'Test not found' };
      }

      const test = testResult.items[0];
      const variants = parseVariants(test.variants);

      // Count impressions per variant
      const variantResults = [];

      for (const variant of variants) {
        const impressions = await wixData.query('AbEvents')
          .eq('testName', cleanTest)
          .eq('variantId', variant.id)
          .eq('eventType', 'impression')
          .count();

        const conversions = await wixData.query('AbEvents')
          .eq('testName', cleanTest)
          .eq('variantId', variant.id)
          .eq('eventType', 'conversion')
          .count();

        const rate = impressions > 0 ? conversions / impressions : 0;

        variantResults.push({
          id: variant.id,
          name: variant.name,
          impressions,
          conversions,
          conversionRate: Math.round(rate * 10000) / 100, // percent with 2 decimals
        });
      }

      // Calculate significance between first two variants
      let significance = null;
      if (variantResults.length >= 2) {
        significance = calculateSignificance(
          variantResults[0].impressions,
          variantResults[0].conversions,
          variantResults[1].impressions,
          variantResults[1].conversions,
        );
      }

      // Determine winner
      let winner = null;
      if (significance && significance.significant) {
        winner = variantResults[0].conversionRate > variantResults[1].conversionRate
          ? variantResults[0].id
          : variantResults[1].id;
      }

      return {
        success: true,
        results: {
          testName: test.testName,
          active: test.active,
          variants: variantResults,
          significance,
          winner,
          winnerVariant: test.winnerVariant || null,
        },
      };
    } catch (err) {
      console.error('[AbTesting] Error getting results:', err);
      return { success: false, error: 'Unable to get test results' };
    }
  }
);

// ── Conclude Test ───────────────────────────────────────────────────

/**
 * Disable a test and set the winner variant.
 *
 * @function concludeTest
 * @param {string} testName - Test identifier
 * @param {string} winnerVariantId - Winner variant ID
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 */
export const concludeTest = webMethod(
  Permissions.Admin,
  async (testName, winnerVariantId) => {
    try {
      if (!testName || !winnerVariantId) {
        return { success: false, error: 'Test name and winner variant required' };
      }

      const cleanTest = sanitize(testName, 100);

      const result = await wixData.query('AbTests')
        .eq('testName', cleanTest)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Test not found' };
      }

      const test = result.items[0];
      await wixData.update('AbTests', {
        ...test,
        active: false,
        winnerVariant: sanitize(winnerVariantId, 50),
      });

      return { success: true };
    } catch (err) {
      console.error('[AbTesting] Error concluding test:', err);
      return { success: false, error: 'Unable to conclude test' };
    }
  }
);

// ── Create Test (Admin) ─────────────────────────────────────────────

/**
 * Create a new A/B test.
 *
 * @function createTest
 * @param {Object} params
 * @param {string} params.testName - Unique test identifier
 * @param {Array<{id: string, name: string, weight?: number}>} params.variants - Test variants
 * @param {number} [params.trafficPercent=100] - Percent of traffic in test
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 */
export const createTest = webMethod(
  Permissions.Admin,
  async ({ testName, variants, trafficPercent = 100 } = {}) => {
    try {
      if (!testName || !variants || variants.length < 2) {
        return { success: false, error: 'Test name and at least 2 variants required' };
      }

      const cleanTest = sanitize(testName, 100);

      // Check for existing test
      const existing = await wixData.query('AbTests')
        .eq('testName', cleanTest)
        .find();

      if (existing.items.length > 0) {
        return { success: false, error: 'Test already exists' };
      }

      const safeTraffic = Math.min(100, Math.max(0, trafficPercent));

      const cleanVariants = variants.map(v => ({
        id: sanitize(v.id, 50),
        name: sanitize(v.name, 100),
        weight: v.weight || 50,
      }));

      await wixData.insert('AbTests', {
        testName: cleanTest,
        variants: JSON.stringify(cleanVariants),
        trafficPercent: safeTraffic,
        active: true,
        winnerVariant: '',
        createdAt: new Date(),
      });

      return { success: true };
    } catch (err) {
      console.error('[AbTesting] Error creating test:', err);
      return { success: false, error: 'Unable to create test' };
    }
  }
);

// ── Internal Helpers ────────────────────────────────────────────────

function parseVariants(variantsField) {
  if (!variantsField) return [];
  if (Array.isArray(variantsField)) return variantsField;
  try {
    return JSON.parse(variantsField);
  } catch (e) {
    return [];
  }
}

/**
 * Simple deterministic hash for consistent variant assignment.
 * Not cryptographic — just needs to be consistent and well-distributed.
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Assign a visitor to a variant based on weighted random using their hash.
 */
function assignVariant(testName, visitorId, variants) {
  const hash = simpleHash(`${testName}:${visitorId}`);
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 50), 0);
  let bucket = hash % totalWeight;

  for (const variant of variants) {
    bucket -= (variant.weight || 50);
    if (bucket < 0) return variant;
  }

  return variants[0]; // fallback
}

/**
 * Calculate statistical significance using a two-proportion z-test.
 * Returns whether the difference is significant at p < 0.05.
 */
function calculateSignificance(n1, c1, n2, c2) {
  if (n1 === 0 || n2 === 0) {
    return { significant: false, zScore: 0, pValue: 1, confidence: 0 };
  }

  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pPooled = (c1 + c2) / (n1 + n2);

  if (pPooled === 0 || pPooled === 1) {
    return { significant: false, zScore: 0, pValue: 1, confidence: 0 };
  }

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
  if (se === 0) {
    return { significant: false, zScore: 0, pValue: 1, confidence: 0 };
  }

  const z = Math.abs(p1 - p2) / se;

  // Approximate p-value from z-score (good enough for our purposes)
  const pValue = 2 * (1 - normalCDF(z));
  const significant = z >= Z_95;
  const confidence = Math.round((1 - pValue) * 10000) / 100;

  return {
    significant,
    zScore: Math.round(z * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
    confidence,
  };
}

/**
 * Approximate standard normal CDF using Abramowitz and Stegun formula.
 */
function normalCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

// Export internals for testing
export { simpleHash, assignVariant, calculateSignificance, parseVariants };
