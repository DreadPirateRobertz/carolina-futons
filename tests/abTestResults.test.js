/**
 * @file abTestResults.test.js
 * @description TDD tests for abTestResults.web.js — Wave 32, CF-wave32 blaidd
 *
 * Covers:
 *  - chiSquaredSignificance: 2×2 chi-squared stat test
 *  - getAbTestResults: variant aggregation, revenue, significance
 *  - getAllAbTestResults: summary across all tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';
import {
  chiSquaredSignificance,
  getAbTestResults,
  getAllAbTestResults,
} from '../src/backend/abTestResults.web.js';

beforeEach(() => __reset());

const NOW = new Date();
const YESTERDAY = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

// ── chiSquaredSignificance ─────────────────────────────────────────

describe('chiSquaredSignificance', () => {
  it('detects significant difference with large samples (control 10%, variant 20%)', () => {
    // control: 10/100, variant: 20/100 — known to be significant
    const result = chiSquaredSignificance(100, 10, 100, 20);
    expect(result.significant).toBe(true);
    expect(result.chiSquared).toBeGreaterThan(3.841); // df=1, p=0.05 threshold
    expect(result.pValue).toBeLessThan(0.05);
  });

  it('returns not significant for small samples', () => {
    const result = chiSquaredSignificance(10, 1, 10, 2);
    expect(result.significant).toBe(false);
  });

  it('returns not significant when rates are identical', () => {
    const result = chiSquaredSignificance(100, 15, 100, 15);
    expect(result.significant).toBe(false);
    expect(result.chiSquared).toBe(0);
  });

  it('handles zero impressions in first variant', () => {
    const result = chiSquaredSignificance(0, 0, 100, 10);
    expect(result.significant).toBe(false);
    expect(result.chiSquared).toBe(0);
  });

  it('handles zero impressions in second variant', () => {
    const result = chiSquaredSignificance(100, 10, 0, 0);
    expect(result.significant).toBe(false);
  });

  it('handles zero conversions in both variants', () => {
    const result = chiSquaredSignificance(100, 0, 100, 0);
    expect(result.significant).toBe(false);
    expect(result.chiSquared).toBe(0);
  });

  it('handles 100% conversion in both (degenerate table)', () => {
    const result = chiSquaredSignificance(100, 100, 100, 100);
    expect(result.significant).toBe(false);
  });

  it('returns confidence as a percentage (0–100)', () => {
    const result = chiSquaredSignificance(100, 10, 100, 20);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it('always returns { significant, chiSquared, pValue, confidence } shape', () => {
    const result = chiSquaredSignificance(50, 5, 50, 8);
    expect(result).toHaveProperty('significant');
    expect(result).toHaveProperty('chiSquared');
    expect(result).toHaveProperty('pValue');
    expect(result).toHaveProperty('confidence');
  });
});

// ── getAbTestResults ───────────────────────────────────────────────

// Build sample AbEvents: control 10/100, variant-b 20/100
function makeEvents(testName, variantId, impressions, conversions) {
  return [
    ...Array.from({ length: impressions }, (_, i) => ({
      testName, variantId,
      visitorId: `${variantId}-imp-${i}`,
      eventType: 'impression',
      _createdDate: YESTERDAY,
    })),
    ...Array.from({ length: conversions }, (_, i) => ({
      testName, variantId,
      visitorId: `${variantId}-conv-${i}`,
      eventType: 'conversion',
      _createdDate: YESTERDAY,
    })),
  ];
}

const SAMPLE_TEST = [
  {
    testName: 'hero-cta',
    variants: JSON.stringify([
      { id: 'control', name: 'Shop Now' },
      { id: 'variant-b', name: 'Browse Futons' },
    ]),
    active: true,
  },
];

const SAMPLE_EVENTS = [
  ...makeEvents('hero-cta', 'control', 100, 10),
  ...makeEvents('hero-cta', 'variant-b', 100, 20),
];

describe('getAbTestResults', () => {
  it('returns variant impressions and conversions', async () => {
    __seed('AbTests', SAMPLE_TEST);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await getAbTestResults('hero-cta');
    expect(result.success).toBe(true);

    const control = result.results.variants.find(v => v.id === 'control');
    expect(control.impressions).toBe(100);
    expect(control.conversions).toBe(10);
  });

  it('computes conversion rates per variant', async () => {
    __seed('AbTests', SAMPLE_TEST);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await getAbTestResults('hero-cta');
    const control = result.results.variants.find(v => v.id === 'control');
    const varB   = result.results.variants.find(v => v.id === 'variant-b');

    expect(control.conversionRate).toBeCloseTo(10.0, 1);
    expect(varB.conversionRate).toBeCloseTo(20.0, 1);
  });

  it('includes chi-squared significance block', async () => {
    __seed('AbTests', SAMPLE_TEST);
    __seed('AbEvents', SAMPLE_EVENTS);

    const result = await getAbTestResults('hero-cta');
    expect(result.results.significance).toBeDefined();
    expect(result.results.significance.significant).toBe(true);
    expect(result.results.significance.chiSquared).toBeGreaterThan(3.841);
  });

  it('aggregates revenue per variant from FunnelEvents purchase rows', async () => {
    __seed('AbTests', SAMPLE_TEST);
    __seed('AbEvents', SAMPLE_EVENTS);
    __seed('FunnelEvents', [
      { stage: 'purchase', experimentId: 'hero-cta', variantId: 'control',   revenue: 899,  sessionId: 's1' },
      { stage: 'purchase', experimentId: 'hero-cta', variantId: 'control',   revenue: 1199, sessionId: 's2' },
      { stage: 'purchase', experimentId: 'hero-cta', variantId: 'variant-b', revenue: 799,  sessionId: 's3' },
    ]);

    const result = await getAbTestResults('hero-cta');
    const control = result.results.variants.find(v => v.id === 'control');
    const varB   = result.results.variants.find(v => v.id === 'variant-b');

    expect(control.revenue).toBeCloseTo(2098, 0);
    expect(varB.revenue).toBeCloseTo(799, 0);
  });

  it('returns revenue 0 when no FunnelEvents purchases exist', async () => {
    __seed('AbTests', SAMPLE_TEST);
    __seed('AbEvents', SAMPLE_EVENTS);
    __seed('FunnelEvents', []);

    const result = await getAbTestResults('hero-cta');
    for (const v of result.results.variants) {
      expect(v.revenue).toBe(0);
    }
  });

  it('returns { success: false } for unknown test name', async () => {
    __seed('AbTests', []);
    const result = await getAbTestResults('nonexistent');
    expect(result.success).toBe(false);
    expect(result.results).toBeNull();
  });

  it('returns { success: false } for missing/empty test name', async () => {
    const result = await getAbTestResults('');
    expect(result.success).toBe(false);
  });

  it('includes testName in results', async () => {
    __seed('AbTests', SAMPLE_TEST);
    __seed('AbEvents', SAMPLE_EVENTS);
    const result = await getAbTestResults('hero-cta');
    expect(result.results.testName).toBe('hero-cta');
  });

  it('returns { success: false } on DB error', async () => {
    __setQueryError('AbTests', new Error('db down'));
    const result = await getAbTestResults('hero-cta');
    expect(result.success).toBe(false);
  });
});

// ── getAllAbTestResults ─────────────────────────────────────────────

describe('getAllAbTestResults', () => {
  const TWO_TESTS = [
    {
      testName: 'hero-cta',
      variants: JSON.stringify([{ id: 'control', name: 'Shop Now' }, { id: 'variant-b', name: 'Browse' }]),
      active: true,
    },
    {
      testName: 'price-display',
      variants: JSON.stringify([{ id: 'control', name: 'MSRP' }, { id: 'variant-b', name: 'Sale Price' }]),
      active: false,
    },
  ];

  it('returns results for all tests', async () => {
    __seed('AbTests', TWO_TESTS);
    __seed('AbEvents', [
      ...makeEvents('hero-cta', 'control', 50, 5),
      ...makeEvents('hero-cta', 'variant-b', 50, 10),
      ...makeEvents('price-display', 'control', 80, 8),
      ...makeEvents('price-display', 'variant-b', 80, 12),
    ]);
    __seed('FunnelEvents', []);

    const result = await getAllAbTestResults();
    expect(result.success).toBe(true);
    expect(result.experiments).toHaveLength(2);
    expect(result.experiments.map(e => e.testName)).toContain('hero-cta');
    expect(result.experiments.map(e => e.testName)).toContain('price-display');
  });

  it('returns success:true with empty array when no tests exist', async () => {
    __seed('AbTests', []);
    __seed('AbEvents', []);
    __seed('FunnelEvents', []);
    const result = await getAllAbTestResults();
    expect(result.success).toBe(true);
    expect(result.experiments).toEqual([]);
  });

  it('handles DB error gracefully', async () => {
    __setQueryError('AbTests', new Error('timeout'));
    const result = await getAllAbTestResults();
    expect(result.success).toBe(false);
  });
});
