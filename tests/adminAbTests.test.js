/**
 * @file adminAbTests.test.js
 * @description Tests for A/B test dashboard — autoStopSignificantExperiments
 * and the Admin A-B Tests page helpers (cf-0jk5).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getUpdated, __setQueryError, __setUpdateError } from './__mocks__/wix-data.js';
import {
  listExperiments,
  getDashboardSummary,
  autoStopSignificantExperiments,
  getExperimentDetail,
} from '../src/backend/abTestDashboard.web.js';

beforeEach(() => {
  __reset();
});

// ── Test fixtures ────────────────────────────────────────────────────

const ACTIVE_TEST = {
  _id: 'test-sig',
  testName: 'button_color',
  active: true,
  variants: JSON.stringify([
    { id: 'control', name: 'Blue button', weight: 50 },
    { id: 'variant-b', name: 'Orange button', weight: 50 },
  ]),
  winnerVariant: '',
  _createdDate: new Date(),
};

const ACTIVE_TEST_LOW_DATA = {
  _id: 'test-low',
  testName: 'headline_copy',
  active: true,
  variants: JSON.stringify([
    { id: 'control', name: 'Original', weight: 50 },
    { id: 'variant-b', name: 'New copy', weight: 50 },
  ]),
  winnerVariant: '',
  _createdDate: new Date(),
};

const CONCLUDED_TEST = {
  _id: 'test-done',
  testName: 'shipping_banner',
  active: false,
  variants: JSON.stringify([
    { id: 'control', name: 'Old banner', weight: 50 },
    { id: 'variant-b', name: 'New banner', weight: 50 },
  ]),
  winnerVariant: 'variant-b',
  _createdDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
};

// Generate statistically significant events: control 10%, variant 20% CR
// with n=1000 per variant — well above significance threshold
function makeSignificantEvents(testName) {
  const events = [];
  for (let i = 0; i < 1000; i++) {
    events.push({ testName, variantId: 'control', eventType: 'impression', _createdDate: new Date() });
    if (i < 100) {
      events.push({ testName, variantId: 'control', eventType: 'conversion', _createdDate: new Date() });
    }
  }
  for (let i = 0; i < 1000; i++) {
    events.push({ testName, variantId: 'variant-b', eventType: 'impression', _createdDate: new Date() });
    if (i < 200) {
      events.push({ testName, variantId: 'variant-b', eventType: 'conversion', _createdDate: new Date() });
    }
  }
  return events;
}

// Generate small/inconclusive dataset
function makeInsignificantEvents(testName) {
  return [
    { testName, variantId: 'control', eventType: 'impression', _createdDate: new Date() },
    { testName, variantId: 'control', eventType: 'impression', _createdDate: new Date() },
    { testName, variantId: 'variant-b', eventType: 'impression', _createdDate: new Date() },
    { testName, variantId: 'variant-b', eventType: 'conversion', _createdDate: new Date() },
  ];
}

// ── autoStopSignificantExperiments ───────────────────────────────────

describe('autoStopSignificantExperiments', () => {
  it('stops active experiment with significant results', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', makeSignificantEvents('button_color'));

    const result = await autoStopSignificantExperiments();

    expect(result.success).toBe(true);
    expect(result.stopped).toHaveLength(1);
    expect(result.stopped[0].testName).toBe('button_color');
  });

  it('sets the higher-converting variant as winner', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', makeSignificantEvents('button_color'));

    const result = await autoStopSignificantExperiments();

    // variant-b has 20% CR vs control 10%
    expect(result.stopped[0].winner).toBe('variant-b');
  });

  it('writes active=false and winner to AbTests', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', makeSignificantEvents('button_color'));

    await autoStopSignificantExperiments();

    const updated = __getUpdated('AbTests');
    expect(updated).toHaveLength(1);
    expect(updated[0].active).toBe(false);
    expect(updated[0].winnerVariant).toBe('variant-b');
  });

  it('does not stop experiment with insufficient data', async () => {
    __seed('AbTests', [ACTIVE_TEST_LOW_DATA]);
    __seed('AbEvents', makeInsignificantEvents('headline_copy'));

    const result = await autoStopSignificantExperiments();

    expect(result.success).toBe(true);
    expect(result.stopped).toHaveLength(0);
  });

  it('does not stop already-concluded experiments', async () => {
    __seed('AbTests', [CONCLUDED_TEST]);
    __seed('AbEvents', makeSignificantEvents('shipping_banner'));

    const result = await autoStopSignificantExperiments();

    expect(result.stopped).toHaveLength(0);
  });

  it('stops only significant experiments when multiple are active', async () => {
    __seed('AbTests', [ACTIVE_TEST, ACTIVE_TEST_LOW_DATA]);
    __seed('AbEvents', [
      ...makeSignificantEvents('button_color'),
      ...makeInsignificantEvents('headline_copy'),
    ]);

    const result = await autoStopSignificantExperiments();

    expect(result.stopped).toHaveLength(1);
    expect(result.stopped[0].testName).toBe('button_color');
  });

  it('returns empty stopped list when no active experiments', async () => {
    __seed('AbTests', [CONCLUDED_TEST]);
    __seed('AbEvents', []);

    const result = await autoStopSignificantExperiments();

    expect(result.success).toBe(true);
    expect(result.stopped).toHaveLength(0);
  });

  it('skips tests with fewer than 2 variants', async () => {
    const oneVariantTest = {
      ...ACTIVE_TEST,
      _id: 'test-one',
      testName: 'one_variant_test',
      variants: JSON.stringify([{ id: 'control', name: 'Control', weight: 100 }]),
    };
    __seed('AbTests', [oneVariantTest]);
    __seed('AbEvents', makeSignificantEvents('one_variant_test'));

    const result = await autoStopSignificantExperiments();

    expect(result.stopped).toHaveLength(0);
  });

  it('handles empty events gracefully', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', []);

    const result = await autoStopSignificantExperiments();

    expect(result.success).toBe(true);
    expect(result.stopped).toHaveLength(0);
  });

  it('does not stop when conversion rates are exactly equal despite significance', async () => {
    // Construct equal rates: both variants 100 impressions, 15 conversions (15%)
    // With n=10000 the z-test could reach significance, but equal rates = no winner to declare
    const equalEvents = [];
    for (let i = 0; i < 100; i++) {
      equalEvents.push({ testName: 'button_color', variantId: 'control', eventType: 'impression', _createdDate: new Date() });
      equalEvents.push({ testName: 'button_color', variantId: 'variant-b', eventType: 'impression', _createdDate: new Date() });
      if (i < 15) {
        equalEvents.push({ testName: 'button_color', variantId: 'control', eventType: 'conversion', _createdDate: new Date() });
        equalEvents.push({ testName: 'button_color', variantId: 'variant-b', eventType: 'conversion', _createdDate: new Date() });
      }
    }
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', equalEvents);

    const result = await autoStopSignificantExperiments();

    // Equal rates → no meaningful winner → must not stop regardless of significance
    expect(result.stopped).toHaveLength(0);
  });

  it('skips individual experiment on DB update failure, still returns success: true', async () => {
    // Per-item errors are isolated — the overall cron run is not failed,
    // but the experiment that errored is not added to stopped[].
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', makeSignificantEvents('button_color'));
    __setUpdateError('AbTests', new Error('DB write failure'));

    const result = await autoStopSignificantExperiments();

    expect(result.success).toBe(true);
    expect(result.stopped).toHaveLength(0);
  });

  it('does not process more than 50 experiments (limit boundary)', async () => {
    const manyTests = Array.from({ length: 51 }, (_, i) => ({
      _id: `test-${i}`,
      testName: `exp_${i}`,
      active: true,
      variants: JSON.stringify([
        { id: 'control', name: 'Control', weight: 50 },
        { id: 'variant-b', name: 'Variant B', weight: 50 },
      ]),
      winnerVariant: '',
      _createdDate: new Date(),
    }));

    const allEvents = manyTests.flatMap(t => makeSignificantEvents(t.testName));
    __seed('AbTests', manyTests);
    __seed('AbEvents', allEvents);

    const result = await autoStopSignificantExperiments();

    // The .limit(50) query cap means at most 50 can be stopped in one run
    expect(result.stopped.length).toBeLessThanOrEqual(50);
  });
});

// ── Dashboard integration — readyToConclude count ────────────────────

describe('getDashboardSummary readyToConclude', () => {
  it('counts active experiments that reached significance', async () => {
    __seed('AbTests', [ACTIVE_TEST, ACTIVE_TEST_LOW_DATA, CONCLUDED_TEST]);
    __seed('AbEvents', [
      ...makeSignificantEvents('button_color'),
      ...makeInsignificantEvents('headline_copy'),
    ]);

    const result = await getDashboardSummary();

    expect(result.success).toBe(true);
    expect(result.summary.readyToConclude).toBe(1);
    expect(result.summary.activeExperiments).toBe(2);
    expect(result.summary.concludedExperiments).toBe(1);
  });

  it('returns zero readyToConclude when no experiments are significant', async () => {
    __seed('AbTests', [ACTIVE_TEST_LOW_DATA]);
    __seed('AbEvents', makeInsignificantEvents('headline_copy'));

    const result = await getDashboardSummary();

    expect(result.summary.readyToConclude).toBe(0);
  });

  it('returns failure when DB throws', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __setQueryError('AbEvents', new Error('timeout'));

    const result = await getDashboardSummary();

    expect(result.success).toBe(false);
    expect(result.summary).toBeNull();
  });
});

// ── listExperiments error path ────────────────────────────────────────

describe('listExperiments error handling', () => {
  it('returns empty results on DB failure', async () => {
    __setQueryError('AbTests', new Error('connection refused'));

    const result = await listExperiments();

    expect(result.success).toBe(false);
    expect(result.tests).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ── listExperiments — significance fields ────────────────────────────

describe('listExperiments significance', () => {
  it('includes significance data for experiments with enough events', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', makeSignificantEvents('button_color'));

    const result = await listExperiments({ filter: 'active' });

    expect(result.success).toBe(true);
    const exp = result.tests[0];
    expect(exp.significance).toBeTruthy();
    expect(exp.significance.significant).toBe(true);
    expect(exp.significance.confidence).toBeGreaterThan(95);
  });

  it('includes significance: not significant for small samples', async () => {
    __seed('AbTests', [ACTIVE_TEST_LOW_DATA]);
    __seed('AbEvents', makeInsignificantEvents('headline_copy'));

    const result = await listExperiments();

    const exp = result.tests[0];
    expect(exp.significance.significant).toBe(false);
  });

  it('includes null significance for single-variant tests', async () => {
    const singleVariant = {
      ...ACTIVE_TEST,
      testName: 'sv_test',
      variants: JSON.stringify([{ id: 'control', name: 'Control' }]),
    };
    __seed('AbTests', [singleVariant]);
    __seed('AbEvents', []);

    const result = await listExperiments();

    expect(result.tests[0].significance).toBeNull();
  });

  it('returns winner id when significance reached', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', makeSignificantEvents('button_color'));

    const result = await listExperiments();

    // Winner is whichever variant has higher conversion
    const exp = result.tests[0];
    expect(exp.significance.significant).toBe(true);
    // variant-b (20% CR) should be detectable as better
    const varB = exp.variants.find(v => v.id === 'variant-b');
    const control = exp.variants.find(v => v.id === 'control');
    expect(varB.conversionRate).toBeGreaterThan(control.conversionRate);
  });
});

// ── getExperimentDetail ───────────────────────────────────────────────

describe('getExperimentDetail', () => {
  it('returns experiment with significance and winner for significant results', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', makeSignificantEvents('button_color'));

    const result = await getExperimentDetail('button_color');

    expect(result.success).toBe(true);
    expect(result.experiment.testName).toBe('button_color');
    expect(result.experiment.significance.significant).toBe(true);
    expect(result.experiment.winner).toBe('variant-b');
    expect(result.experiment.recommendation).toContain('Winner');
  });

  it('returns recommendation with no-data message for small samples', async () => {
    __seed('AbTests', [ACTIVE_TEST_LOW_DATA]);
    __seed('AbEvents', makeInsignificantEvents('headline_copy'));

    const result = await getExperimentDetail('headline_copy');

    expect(result.success).toBe(true);
    expect(result.experiment.winner).toBeNull();
    expect(result.experiment.recommendation).toBeTruthy();
  });

  it('returns dailyTrend array', async () => {
    __seed('AbTests', [ACTIVE_TEST]);
    __seed('AbEvents', makeSignificantEvents('button_color'));

    const result = await getExperimentDetail('button_color');

    expect(Array.isArray(result.experiment.dailyTrend)).toBe(true);
  });

  it('returns failure when experiment not found', async () => {
    __seed('AbTests', []);
    __seed('AbEvents', []);

    const result = await getExperimentDetail('nonexistent_test');

    expect(result.success).toBe(false);
    expect(result.experiment).toBeNull();
  });

  it('returns failure on empty testName', async () => {
    const result = await getExperimentDetail('');

    expect(result.success).toBe(false);
    expect(result.experiment).toBeNull();
  });

  it('returns failure on DB error', async () => {
    __setQueryError('AbTests', new Error('DB timeout'));

    const result = await getExperimentDetail('button_color');

    expect(result.success).toBe(false);
    expect(result.experiment).toBeNull();
  });

  it('sets null winner when no significant difference', async () => {
    __seed('AbTests', [ACTIVE_TEST_LOW_DATA]);
    __seed('AbEvents', makeInsignificantEvents('headline_copy'));

    const result = await getExperimentDetail('headline_copy');

    expect(result.experiment.winner).toBeNull();
  });

  it('sets null significance for single-variant experiments', async () => {
    const singleVariant = {
      ...ACTIVE_TEST,
      testName: 'single_variant_detail',
      variants: JSON.stringify([{ id: 'control', name: 'Control' }]),
    };
    __seed('AbTests', [singleVariant]);
    __seed('AbEvents', []);

    const result = await getExperimentDetail('single_variant_detail');

    expect(result.experiment.significance).toBeNull();
    expect(result.experiment.winner).toBeNull();
  });
});

// ── autoStopSignificantExperiments — outer DB failure ─────────────────

describe('autoStopSignificantExperiments outer DB failure', () => {
  it('returns success: false when initial active-tests query throws', async () => {
    __setQueryError('AbTests', new Error('connection refused'));

    const result = await autoStopSignificantExperiments();

    expect(result.success).toBe(false);
    expect(result.stopped).toHaveLength(0);
  });
});

// ── autoStopSignificantExperiments — 3+ variant skip ─────────────────

describe('autoStopSignificantExperiments multi-variant skip', () => {
  it('skips experiments with 3 or more variants', async () => {
    const threeVariantTest = {
      ...ACTIVE_TEST,
      _id: 'test-three',
      testName: 'three_variant_test',
      variants: JSON.stringify([
        { id: 'control', name: 'Control', weight: 33 },
        { id: 'variant-b', name: 'Variant B', weight: 33 },
        { id: 'variant-c', name: 'Variant C', weight: 34 },
      ]),
    };
    __seed('AbTests', [threeVariantTest]);
    __seed('AbEvents', makeSignificantEvents('three_variant_test'));

    const result = await autoStopSignificantExperiments();

    expect(result.success).toBe(true);
    expect(result.stopped).toHaveLength(0);
  });
});
