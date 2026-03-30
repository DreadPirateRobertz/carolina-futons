/**
 * @module abTestDashboard
 * @description A/B test dashboard — lists all experiments, variant splits,
 * conversion rates, and statistical significance.
 *
 * Aggregates data from abTesting.web.js (product/page tests) and
 * emailAutomation.web.js (email A/B tests) into a unified dashboard view.
 *
 * CF-lne1
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

const TESTS_COLLECTION = 'AbTests';
const EVENTS_COLLECTION = 'AbEvents';

// ── Dashboard Views ─────────────────────────────────────────────────

/**
 * Get all A/B tests with summary stats for the dashboard.
 *
 * @param {Object} [options]
 * @param {string} [options.filter='all'] - 'all' | 'active' | 'concluded'
 * @param {number} [options.page=0]
 * @param {number} [options.pageSize=20]
 * @returns {Promise<{success: boolean, tests: Array, total: number}>}
 * @permission Admin
 */
export const listExperiments = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const filter = options.filter || 'all';
      const page = Math.max(0, options.page || 0);
      const pageSize = Math.min(50, Math.max(1, options.pageSize || 20));

      let query = wixData.query(TESTS_COLLECTION);

      if (filter === 'active') query = query.eq('active', true);
      if (filter === 'concluded') query = query.eq('active', false);

      const result = await query
        .descending('_createdDate')
        .skip(page * pageSize)
        .limit(pageSize)
        .find();

      const tests = [];

      for (const test of result.items) {
        const variants = parseVariants(test.variants);
        const variantStats = await getVariantStats(test.testName, variants);
        const totalImpressions = variantStats.reduce((sum, v) => sum + v.impressions, 0);

        tests.push({
          testName: test.testName,
          active: test.active,
          createdAt: test._createdDate,
          winnerVariant: test.winnerVariant || null,
          variantCount: variants.length,
          totalImpressions,
          variants: variantStats.map(v => ({
            ...v,
            splitPercent: totalImpressions > 0
              ? Math.round((v.impressions / totalImpressions) * 100)
              : Math.round(100 / variants.length),
          })),
          significance: variantStats.length >= 2
            ? calculateSignificance(
              variantStats[0].impressions, variantStats[0].conversions,
              variantStats[1].impressions, variantStats[1].conversions
            )
            : null,
        });
      }

      return { success: true, tests, total: result.totalCount };
    } catch (err) {
      console.error('[abTestDashboard] listExperiments error:', err);
      return { success: false, tests: [], total: 0 };
    }
  }
);

/**
 * Get detailed results for a single experiment.
 *
 * @param {string} testName
 * @returns {Promise<{success: boolean, experiment: Object|null}>}
 * @permission Admin
 */
export const getExperimentDetail = webMethod(
  Permissions.Admin,
  async (testName) => {
    try {
      const cleanName = sanitize(testName, 100);
      if (!cleanName) return { success: false, experiment: null };

      const result = await wixData.query(TESTS_COLLECTION)
        .eq('testName', cleanName)
        .find();

      if (result.items.length === 0) {
        return { success: false, experiment: null };
      }

      const test = result.items[0];
      const variants = parseVariants(test.variants);
      const variantStats = await getVariantStats(cleanName, variants);
      const totalImpressions = variantStats.reduce((sum, v) => sum + v.impressions, 0);

      // Get daily trend for the last 7 days
      const dailyTrend = await getDailyTrend(cleanName, 7);

      const significance = variantStats.length >= 2
        ? calculateSignificance(
          variantStats[0].impressions, variantStats[0].conversions,
          variantStats[1].impressions, variantStats[1].conversions
        )
        : null;

      let winner = null;
      if (significance && significance.significant) {
        winner = variantStats[0].conversionRate > variantStats[1].conversionRate
          ? variantStats[0].id : variantStats[1].id;
      }

      return {
        success: true,
        experiment: {
          testName: test.testName,
          active: test.active,
          createdAt: test._createdDate,
          winnerVariant: test.winnerVariant || null,
          totalImpressions,
          variants: variantStats.map(v => ({
            ...v,
            splitPercent: totalImpressions > 0
              ? Math.round((v.impressions / totalImpressions) * 100)
              : 0,
          })),
          significance,
          winner,
          dailyTrend,
          recommendation: getRecommendation(significance, variantStats),
        },
      };
    } catch (err) {
      console.error('[abTestDashboard] getExperimentDetail error:', err);
      return { success: false, experiment: null };
    }
  }
);

/**
 * Get dashboard summary stats across all experiments.
 *
 * @returns {Promise<{success: boolean, summary: Object}>}
 * @permission Admin
 */
export const getDashboardSummary = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const active = await wixData.query(TESTS_COLLECTION).eq('active', true).count();
      const concluded = await wixData.query(TESTS_COLLECTION).eq('active', false).count();
      const totalEvents = await wixData.query(EVENTS_COLLECTION).count();

      // Find tests with significant results
      const allActive = await wixData.query(TESTS_COLLECTION)
        .eq('active', true)
        .limit(50)
        .find();

      let readyToConclude = 0;
      for (const test of allActive.items) {
        const variants = parseVariants(test.variants);
        if (variants.length < 2) continue;

        const stats = await getVariantStats(test.testName, variants);
        const sig = calculateSignificance(
          stats[0].impressions, stats[0].conversions,
          stats[1].impressions, stats[1].conversions
        );
        if (sig.significant) readyToConclude++;
      }

      return {
        success: true,
        summary: {
          activeExperiments: active,
          concludedExperiments: concluded,
          totalEvents,
          readyToConclude,
        },
      };
    } catch (err) {
      console.error('[abTestDashboard] getDashboardSummary error:', err);
      return { success: false, summary: null };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function parseVariants(variantsField) {
  if (!variantsField) return [];
  if (Array.isArray(variantsField)) return variantsField;
  try {
    return JSON.parse(variantsField);
  } catch (e) {
    logError('abTestDashboard.parseVariants', e);
    return [];
  }
}

async function getVariantStats(testName, variants) {
  const stats = [];
  for (const variant of variants) {
    const impressions = await wixData.query(EVENTS_COLLECTION)
      .eq('testName', testName)
      .eq('variantId', variant.id)
      .eq('eventType', 'impression')
      .count();

    const conversions = await wixData.query(EVENTS_COLLECTION)
      .eq('testName', testName)
      .eq('variantId', variant.id)
      .eq('eventType', 'conversion')
      .count();

    const rate = impressions > 0 ? conversions / impressions : 0;

    stats.push({
      id: variant.id,
      name: variant.name || variant.id,
      impressions,
      conversions,
      conversionRate: Math.round(rate * 10000) / 100,
    });
  }
  return stats;
}

async function getDailyTrend(testName, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Hard cap at 1000 events — high-traffic experiments may under-count daily totals
  const events = await wixData.query(EVENTS_COLLECTION)
    .eq('testName', testName)
    .ge('_createdDate', since)
    .limit(1000)
    .find();

  const daily = {};
  for (const event of events.items) {
    const day = new Date(event._createdDate).toISOString().split('T')[0];
    if (!daily[day]) daily[day] = { impressions: 0, conversions: 0 };
    if (event.eventType === 'impression') daily[day].impressions++;
    if (event.eventType === 'conversion') daily[day].conversions++;
  }

  return Object.entries(daily)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({
      date,
      impressions: counts.impressions,
      conversions: counts.conversions,
      rate: counts.impressions > 0
        ? Math.round((counts.conversions / counts.impressions) * 10000) / 100
        : 0,
    }));
}

const Z_95 = 1.96;

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

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function getRecommendation(significance, variantStats) {
  if (!significance) return 'Need at least 2 variants to compare.';
  if (!significance.significant) {
    const totalImpressions = variantStats.reduce((sum, v) => sum + v.impressions, 0);
    if (totalImpressions < 100) return 'Not enough data yet. Need more impressions.';
    return 'No significant difference detected. Continue running or consider a larger effect.';
  }
  const winner = variantStats[0].conversionRate > variantStats[1].conversionRate
    ? variantStats[0] : variantStats[1];
  return `Winner: ${winner.name} (${winner.conversionRate}% conversion). Safe to conclude at ${significance.confidence}% confidence.`;
}

// ── Auto-Stop Significant Experiments (Cron) ────────────────────────

/**
 * Check up to 50 active experiments per run and stop any that have reached
 * statistical significance (p < 0.05). Sets the winner variant.
 * Designed to run as a daily cron job.
 *
 * Note: significance is evaluated between the first two variants only.
 * Experiments with 3+ variants are skipped — auto-stop requires exactly 2 variants.
 * On partial failure, successfully stopped experiments are preserved in the
 * return value even if later experiments error.
 *
 * @returns {Promise<{success: boolean, stopped: Array<{testName: string, winner: string}>}>}
 * @permission Admin
 */
export const autoStopSignificantExperiments = webMethod(
  Permissions.Admin,
  async () => {
    const stopped = [];
    try {
      const active = await wixData.query(TESTS_COLLECTION)
        .eq('active', true)
        .limit(50)
        .find();

      for (const test of active.items) {
        const variants = parseVariants(test.variants);
        if (variants.length < 2) continue;

        // Multi-variant experiments: auto-stop only supports 2-variant significance testing
        if (variants.length > 2) {
          console.warn(`[abTestDashboard] autoStop: "${test.testName}" has ${variants.length} variants — skipping (only 2-variant tests supported)`);
          continue;
        }

        try {
          const cleanName = sanitize(test.testName, 100);
          const stats = await getVariantStats(cleanName, variants);
          const sig = calculateSignificance(
            stats[0].impressions, stats[0].conversions,
            stats[1].impressions, stats[1].conversions,
          );

          if (!sig.significant) continue;

          // Skip if rates are exactly equal — no meaningful winner to declare
          if (stats[0].conversionRate === stats[1].conversionRate) continue;

          const winner = stats[0].conversionRate > stats[1].conversionRate
            ? stats[0].id
            : stats[1].id;

          await wixData.update(TESTS_COLLECTION, {
            ...test,
            active: false,
            winnerVariant: winner,
          });

          stopped.push({ testName: cleanName, winner });
          console.log(`[abTestDashboard] Auto-stopped "${cleanName}" — winner: ${winner} (${sig.confidence}% confidence)`);
        } catch (itemErr) {
          logError('abTestDashboard.autoStopSignificantExperiments', itemErr);
        }
      }

      return { success: true, stopped };
    } catch (err) {
      logError('abTestDashboard.autoStopSignificantExperiments', err);
      return { success: false, stopped };
    }
  }
);

export { calculateSignificance as _calculateSignificance };
