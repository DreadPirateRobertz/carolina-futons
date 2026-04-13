/**
 * @module abTestResults
 * @description A/B test results aggregation with chi-squared statistical
 * significance. Reads from the existing AbTests/AbEvents collections and
 * cross-references FunnelEvents purchase rows to compute revenue per variant.
 *
 * Designed to complement abTestDashboard.web.js (which uses a two-proportion
 * z-test). This module uses the chi-squared 2×2 contingency-table test as
 * specified for Wave 32.
 *
 * CF-wave32 (Wave 32 — blaidd)
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

const TESTS_COLLECTION  = 'AbTests';
const EVENTS_COLLECTION = 'AbEvents';
const FUNNEL_COLLECTION = 'FunnelEvents';

// Chi-squared critical value for df=1, p=0.05 (two-tailed)
const CHI_SQ_95 = 3.841;

// ── chiSquaredSignificance ─────────────────────────────────────────

/**
 * Compute chi-squared significance for a 2×2 contingency table.
 *
 * Table layout:
 *   | converted | not converted |
 *   |    c1     |   n1 - c1     |   variant 1
 *   |    c2     |   n2 - c2     |   variant 2
 *
 * Uses standard Pearson chi-squared (no Yates' continuity correction).
 * Appropriate for n ≥ 30 per cell; expected cell count should be ≥ 5.
 *
 * @param {number} n1 - Impressions for variant 1
 * @param {number} c1 - Conversions for variant 1
 * @param {number} n2 - Impressions for variant 2
 * @param {number} c2 - Conversions for variant 2
 * @returns {{ significant: boolean, chiSquared: number, pValue: number, confidence: number }}
 */
export function chiSquaredSignificance(n1, c1, n2, c2) {
  if (n1 === 0 || n2 === 0) {
    return { significant: false, chiSquared: 0, pValue: 1, confidence: 0 };
  }

  // 2×2 contingency table cells
  const a = c1,        b = n1 - c1;
  const c = c2,        d = n2 - c2;
  const N = a + b + c + d;

  if (N === 0) return { significant: false, chiSquared: 0, pValue: 1, confidence: 0 };

  // Degenerate: all conversions or all non-conversions — chi-squared undefined
  if ((a + c) === 0 || (b + d) === 0) {
    return { significant: false, chiSquared: 0, pValue: 1, confidence: 0 };
  }

  // Expected cell counts
  const eA = (a + b) * (a + c) / N;
  const eB = (a + b) * (b + d) / N;
  const eC = (c + d) * (a + c) / N;
  const eD = (c + d) * (b + d) / N;

  if (eA === 0 || eB === 0 || eC === 0 || eD === 0) {
    return { significant: false, chiSquared: 0, pValue: 1, confidence: 0 };
  }

  // Standard Pearson chi-squared (no Yates correction — adequate for n≥30)
  const cell = (obs, exp) => Math.pow(obs - exp, 2) / exp;
  const chiSq = cell(a, eA) + cell(b, eB) + cell(c, eC) + cell(d, eD);

  const pValue = 1 - chiSquaredCDF(chiSq, 1);
  const significant = chiSq >= CHI_SQ_95;
  const confidence = Math.round((1 - pValue) * 10000) / 100;

  return {
    significant,
    chiSquared: Math.round(chiSq * 1000) / 1000,
    pValue: Math.round(pValue * 100000) / 100000,
    confidence,
  };
}

/**
 * Approximate chi-squared CDF for df=1 using the regularised incomplete
 * gamma function via the Wilson-Hilferty cube-root normal approximation.
 * Sufficient accuracy for p-value display (±0.001).
 */
function chiSquaredCDF(x, df) {
  if (x <= 0) return 0;
  // For df=1: CDF(x) = erf(sqrt(x/2))
  return erf(Math.sqrt(x / 2));
}

function erf(x) {
  // Abramowitz & Stegun approximation 7.1.26, max error 1.5e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592
    + t * (-0.284496736
    + t * (1.421413741
    + t * (-1.453152027
    + t * 1.061405429))));
  const result = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? result : -result;
}

// ── getAbTestResults ───────────────────────────────────────────────

/**
 * Get detailed results for a single A/B experiment including chi-squared
 * significance and revenue per variant (from FunnelEvents purchase rows).
 *
 * @param {string} testName
 * @returns {Promise<{success: boolean, results: Object|null}>}
 * @permission Admin
 */
export const getAbTestResults = webMethod(
  Permissions.Admin,
  async (testName) => {
    try {
      const cleanName = sanitize(testName || '', 100);
      if (!cleanName) return { success: false, results: null, error: 'testName is required' };

      const testResult = await wixData.query(TESTS_COLLECTION)
        .eq('testName', cleanName)
        .find();

      if (testResult.items.length === 0) {
        return { success: false, results: null, error: `Test "${cleanName}" not found` };
      }

      const test = testResult.items[0];
      const variants = parseVariants(test.variants);

      // Aggregate impressions + conversions per variant
      const variantStats = await Promise.all(variants.map(async (v) => {
        const impressions = await wixData.query(EVENTS_COLLECTION)
          .eq('testName', cleanName)
          .eq('variantId', v.id)
          .eq('eventType', 'impression')
          .count();

        const conversions = await wixData.query(EVENTS_COLLECTION)
          .eq('testName', cleanName)
          .eq('variantId', v.id)
          .eq('eventType', 'conversion')
          .count();

        // Revenue: paginate purchase rows to avoid 500-row cap undercounting high-traffic variants
        let revenue = 0;
        let revOffset = 0;
        while (true) {
          const batch = await wixData.query(FUNNEL_COLLECTION)
            .eq('stage', 'purchase')
            .eq('experimentId', cleanName)
            .eq('variantId', v.id)
            .limit(500)
            .skip(revOffset)
            .find({ suppressAuth: true });
          revenue += batch.items.reduce((sum, r) => sum + (r.revenue || 0), 0);
          if (batch.items.length < 500) break;
          revOffset += 500;
        }

        const rate = impressions > 0 ? (conversions / impressions) * 100 : 0;

        return {
          id: v.id,
          name: v.name || v.id,
          impressions,
          conversions,
          conversionRate: Math.round(rate * 100) / 100,
          revenue: Math.round(revenue * 100) / 100,
        };
      }));

      // Chi-squared significance between the first two variants
      const significance = variantStats.length >= 2
        ? chiSquaredSignificance(
          variantStats[0].impressions, variantStats[0].conversions,
          variantStats[1].impressions, variantStats[1].conversions,
        )
        : null;

      return {
        success: true,
        results: {
          testName: cleanName,
          active: test.active,
          variants: variantStats,
          significance,
        },
      };
    } catch (err) {
      logError('abTestResults.getAbTestResults', err);
      return { success: false, results: null, error: 'Failed to fetch A/B test results' };
    }
  }
);

// ── getAllAbTestResults ────────────────────────────────────────────

/**
 * Retrieve results for all A/B tests (active and concluded).
 *
 * @param {Object} [options]
 * @param {number} [options.limit=50]
 * @returns {Promise<{success: boolean, experiments: Array}>}
 * @permission Admin
 */
export const getAllAbTestResults = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const limit = Math.min(50, Math.max(1, options.limit || 50));
      const testsResult = await wixData.query(TESTS_COLLECTION)
        .limit(limit)
        .find();

      const experiments = await Promise.all(
        testsResult.items.map(async (test) => {
          const r = await getAbTestResults(test.testName);
          return r.success ? r.results : { testName: test.testName, error: r.error };
        })
      );

      return { success: true, experiments };
    } catch (err) {
      logError('abTestResults.getAllAbTestResults', err);
      return { success: false, experiments: [], error: 'Failed to fetch all A/B test results' };
    }
  }
);

// ── Helpers ───────────────────────────────────────────────────────

function parseVariants(variantsField) {
  if (!variantsField) return [];
  if (Array.isArray(variantsField)) return variantsField;
  try {
    const parsed = JSON.parse(variantsField);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
