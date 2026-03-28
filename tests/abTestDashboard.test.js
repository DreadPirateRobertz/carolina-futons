/**
 * @file abTestDashboard.test.js
 * @description Tests for the A/B test dashboard module (cf-lne1).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import {
  listExperiments,
  getExperimentDetail,
  getDashboardSummary,
  _calculateSignificance,
} from '../src/backend/abTestDashboard.web.js';

beforeEach(() => {
  __reset();
});

const SAMPLE_TESTS = [
  {
    _id: 'test-1', testName: 'welcome_subject', active: true,
    variants: JSON.stringify([{ id: 'A', name: 'Variant A' }, { id: 'B', name: 'Variant B' }]),
    _createdDate: new Date(),
  },
  {
    _id: 'test-2', testName: 'cart_cta_color', active: false,
    variants: JSON.stringify([{ id: 'A', name: 'Blue CTA' }, { id: 'B', name: 'Orange CTA' }]),
    winnerVariant: 'B',
    _createdDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

const SAMPLE_EVENTS = [
  { testName: 'welcome_subject', variantId: 'A', eventType: 'impression', _createdDate: new Date() },
  { testName: 'welcome_subject', variantId: 'A', eventType: 'impression', _createdDate: new Date() },
  { testName: 'welcome_subject', variantId: 'A', eventType: 'conversion', _createdDate: new Date() },
  { testName: 'welcome_subject', variantId: 'B', eventType: 'impression', _createdDate: new Date() },
  { testName: 'welcome_subject', variantId: 'B', eventType: 'impression', _createdDate: new Date() },
  { testName: 'welcome_subject', variantId: 'B', eventType: 'impression', _createdDate: new Date() },
  { testName: 'welcome_subject', variantId: 'B', eventType: 'conversion', _createdDate: new Date() },
  { testName: 'welcome_subject', variantId: 'B', eventType: 'conversion', _createdDate: new Date() },
];

// ── List Experiments ────────────────────────────────────────────────

describe('listExperiments', () => {
  it('returns all experiments with variant stats', async () => {
    __seed('AbTests', SAMPLE_TESTS);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await listExperiments();
    expect(result.success).toBe(true);
    expect(result.tests).toHaveLength(2);
    expect(result.tests[0].testName).toBeTruthy();
    expect(result.tests[0].variants).toHaveLength(2);
  });

  it('filters active experiments', async () => {
    __seed('AbTests', SAMPLE_TESTS);
    __seed('AbEvents', []);

    const result = await listExperiments({ filter: 'active' });
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].active).toBe(true);
  });

  it('filters concluded experiments', async () => {
    __seed('AbTests', SAMPLE_TESTS);
    __seed('AbEvents', []);

    const result = await listExperiments({ filter: 'concluded' });
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].active).toBe(false);
  });

  it('computes split percentages', async () => {
    __seed('AbTests', [SAMPLE_TESTS[0]]);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await listExperiments();
    const test = result.tests[0];
    const totalSplit = test.variants.reduce((sum, v) => sum + v.splitPercent, 0);
    expect(totalSplit).toBe(100);
  });

  it('computes conversion rates', async () => {
    __seed('AbTests', [SAMPLE_TESTS[0]]);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await listExperiments();
    const varA = result.tests[0].variants.find(v => v.id === 'A');
    expect(varA.impressions).toBe(2);
    expect(varA.conversions).toBe(1);
    expect(varA.conversionRate).toBe(50);
  });
});

// ── Experiment Detail ───────────────────────────────────────────────

describe('getExperimentDetail', () => {
  it('returns detailed results with daily trend', async () => {
    __seed('AbTests', [SAMPLE_TESTS[0]]);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await getExperimentDetail('welcome_subject');
    expect(result.success).toBe(true);
    expect(result.experiment.testName).toBe('welcome_subject');
    expect(result.experiment.variants).toHaveLength(2);
    expect(result.experiment.dailyTrend).toBeDefined();
    expect(result.experiment.recommendation).toBeTruthy();
  });

  it('includes significance calculation', async () => {
    __seed('AbTests', [SAMPLE_TESTS[0]]);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await getExperimentDetail('welcome_subject');
    expect(result.experiment.significance).toBeDefined();
    expect(result.experiment.significance).toHaveProperty('significant');
    expect(result.experiment.significance).toHaveProperty('confidence');
  });

  it('returns failure for unknown test', async () => {
    __seed('AbTests', []);
    const result = await getExperimentDetail('nonexistent');
    expect(result.success).toBe(false);
  });
});

// ── Dashboard Summary ───────────────────────────────────────────────

describe('getDashboardSummary', () => {
  it('returns experiment counts', async () => {
    __seed('AbTests', SAMPLE_TESTS);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await getDashboardSummary();
    expect(result.success).toBe(true);
    expect(result.summary.activeExperiments).toBe(1);
    expect(result.summary.concludedExperiments).toBe(1);
    expect(result.summary.totalEvents).toBe(8);
  });

  it('handles empty state', async () => {
    __seed('AbTests', []);
    __seed('AbEvents', []);

    const result = await getDashboardSummary();
    expect(result.summary.activeExperiments).toBe(0);
    expect(result.summary.totalEvents).toBe(0);
  });
});

// ── Statistical Significance ────────────────────────────────────────

describe('calculateSignificance', () => {
  it('detects significant difference with large samples', () => {
    // 1000 impressions, 100 conversions (10%) vs 1000 impressions, 150 conversions (15%)
    const result = _calculateSignificance(1000, 100, 1000, 150);
    expect(result.significant).toBe(true);
    expect(result.confidence).toBeGreaterThan(95);
    expect(result.zScore).toBeGreaterThan(1.96);
  });

  it('returns not significant for small samples', () => {
    const result = _calculateSignificance(10, 1, 10, 2);
    expect(result.significant).toBe(false);
  });

  it('handles zero impressions', () => {
    const result = _calculateSignificance(0, 0, 100, 10);
    expect(result.significant).toBe(false);
    expect(result.pValue).toBe(1);
  });

  it('handles zero conversions in both', () => {
    const result = _calculateSignificance(100, 0, 100, 0);
    expect(result.significant).toBe(false);
  });

  it('handles 100% conversion in both', () => {
    const result = _calculateSignificance(100, 100, 100, 100);
    expect(result.significant).toBe(false);
  });
});
