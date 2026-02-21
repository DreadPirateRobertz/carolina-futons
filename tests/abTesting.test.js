/**
 * Tests for abTesting.web.js — A/B testing framework
 *
 * Covers: variant assignment, event tracking, test results with significance,
 * test creation, conclusion, edge cases, deterministic hashing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  getVariant,
  trackEvent,
  getTestResults,
  concludeTest,
  createTest,
  simpleHash,
  assignVariant,
  calculateSignificance,
  parseVariants,
} from '../src/backend/abTesting.web.js';

// ── Test Data ───────────────────────────────────────────────────────

const TEST_VARIANTS = [
  { id: 'control', name: 'Free shipping at $999', weight: 50 },
  { id: 'variant-a', name: 'Free shipping at $799', weight: 50 },
];

function seedTest(overrides = {}) {
  const test = {
    _id: 'test-1',
    testName: 'free-shipping-threshold',
    variants: JSON.stringify(TEST_VARIANTS),
    trafficPercent: 100,
    active: true,
    winnerVariant: '',
    createdAt: new Date(),
    ...overrides,
  };
  __seed('AbTests', [test]);
  return test;
}

// ── simpleHash ──────────────────────────────────────────────────────

describe('simpleHash', () => {
  it('returns a number for any string', () => {
    expect(typeof simpleHash('test')).toBe('number');
  });

  it('returns same hash for same input', () => {
    expect(simpleHash('hello')).toBe(simpleHash('hello'));
  });

  it('returns different hash for different inputs', () => {
    expect(simpleHash('hello')).not.toBe(simpleHash('world'));
  });

  it('handles empty string', () => {
    expect(typeof simpleHash('')).toBe('number');
  });
});

// ── parseVariants ───────────────────────────────────────────────────

describe('parseVariants', () => {
  it('parses JSON string', () => {
    const result = parseVariants(JSON.stringify(TEST_VARIANTS));
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('control');
  });

  it('returns array as-is', () => {
    expect(parseVariants(TEST_VARIANTS)).toBe(TEST_VARIANTS);
  });

  it('returns empty array for null', () => {
    expect(parseVariants(null)).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseVariants('not-json')).toEqual([]);
  });
});

// ── assignVariant ───────────────────────────────────────────────────

describe('assignVariant', () => {
  it('always returns same variant for same visitor', () => {
    const v1 = assignVariant('test', 'visitor-1', TEST_VARIANTS);
    const v2 = assignVariant('test', 'visitor-1', TEST_VARIANTS);
    expect(v1.id).toBe(v2.id);
  });

  it('distributes across variants', () => {
    const assignments = new Set();
    for (let i = 0; i < 100; i++) {
      const v = assignVariant('test', `visitor-${i}`, TEST_VARIANTS);
      assignments.add(v.id);
    }
    // With 100 visitors and 50/50 weight, both variants should appear
    expect(assignments.size).toBe(2);
  });

  it('returns first variant as fallback', () => {
    const v = assignVariant('test', 'visitor-1', [TEST_VARIANTS[0]]);
    expect(v.id).toBe('control');
  });
});

// ── calculateSignificance ───────────────────────────────────────────

describe('calculateSignificance', () => {
  it('detects significant difference with large sample', () => {
    // 10% vs 20% conversion with 1000 samples each = significant
    const result = calculateSignificance(1000, 100, 1000, 200);
    expect(result.significant).toBe(true);
    expect(result.zScore).toBeGreaterThan(1.96);
  });

  it('reports not significant with small sample', () => {
    const result = calculateSignificance(10, 1, 10, 2);
    expect(result.significant).toBe(false);
  });

  it('handles zero impressions', () => {
    const result = calculateSignificance(0, 0, 100, 10);
    expect(result.significant).toBe(false);
    expect(result.pValue).toBe(1);
  });

  it('handles zero conversions', () => {
    const result = calculateSignificance(100, 0, 100, 0);
    expect(result.significant).toBe(false);
  });

  it('returns confidence as percentage', () => {
    const result = calculateSignificance(1000, 100, 1000, 200);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
});

// ── getVariant ──────────────────────────────────────────────────────

describe('getVariant', () => {
  it('returns variant for active test', async () => {
    seedTest();

    const result = await getVariant('free-shipping-threshold', 'visitor-123');
    expect(result.success).toBe(true);
    expect(result.variant).toBeTruthy();
    expect(['control', 'variant-a']).toContain(result.variant.id);
    expect(result.testActive).toBe(true);
  });

  it('returns same variant for same visitor (deterministic)', async () => {
    seedTest();

    const r1 = await getVariant('free-shipping-threshold', 'visitor-abc');
    const r2 = await getVariant('free-shipping-threshold', 'visitor-abc');
    expect(r1.variant.id).toBe(r2.variant.id);
  });

  it('returns winner variant when test is disabled', async () => {
    seedTest({ active: false, winnerVariant: 'variant-a' });

    const result = await getVariant('free-shipping-threshold', 'visitor-123');
    expect(result.success).toBe(true);
    expect(result.variant.id).toBe('variant-a');
    expect(result.testActive).toBe(false);
  });

  it('returns first variant when test disabled with no winner', async () => {
    seedTest({ active: false, winnerVariant: '' });

    const result = await getVariant('free-shipping-threshold', 'visitor-123');
    expect(result.variant.id).toBe('control');
    expect(result.testActive).toBe(false);
  });

  it('returns error for non-existent test', async () => {
    const result = await getVariant('nonexistent', 'visitor-123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error for missing inputs', async () => {
    const result = await getVariant('', '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('respects traffic percentage', async () => {
    seedTest({ trafficPercent: 0 }); // 0% traffic = no one in test

    const result = await getVariant('free-shipping-threshold', 'visitor-123');
    expect(result.success).toBe(true);
    expect(result.testActive).toBe(false); // Outside test
  });
});

// ── trackEvent ──────────────────────────────────────────────────────

describe('trackEvent', () => {
  it('tracks impression event', async () => {
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'AbEvents') inserted = item;
    });

    const result = await trackEvent('test-1', 'control', 'visitor-1', 'impression', '/product');
    expect(result.success).toBe(true);
    expect(inserted.testName).toBe('test-1');
    expect(inserted.variantId).toBe('control');
    expect(inserted.eventType).toBe('impression');
    expect(inserted.page).toBe('/product');
  });

  it('tracks conversion event', async () => {
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'AbEvents') inserted = item;
    });

    const result = await trackEvent('test-1', 'control', 'visitor-1', 'conversion');
    expect(result.success).toBe(true);
    expect(inserted.eventType).toBe('conversion');
  });

  it('rejects invalid event type', async () => {
    const result = await trackEvent('test-1', 'control', 'visitor-1', 'invalid');
    expect(result.success).toBe(false);
  });

  it('returns false for missing parameters', async () => {
    expect((await trackEvent('', '', '', '')).success).toBe(false);
  });

  it('normalizes event type to lowercase', async () => {
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'AbEvents') inserted = item;
    });

    await trackEvent('test-1', 'control', 'visitor-1', 'IMPRESSION');
    expect(inserted.eventType).toBe('impression');
  });
});

// ── getTestResults ──────────────────────────────────────────────────

describe('getTestResults', () => {
  it('returns results with conversion rates', async () => {
    seedTest();
    __seed('AbEvents', [
      { _id: 'e1', testName: 'free-shipping-threshold', variantId: 'control', eventType: 'impression' },
      { _id: 'e2', testName: 'free-shipping-threshold', variantId: 'control', eventType: 'impression' },
      { _id: 'e3', testName: 'free-shipping-threshold', variantId: 'control', eventType: 'conversion' },
      { _id: 'e4', testName: 'free-shipping-threshold', variantId: 'variant-a', eventType: 'impression' },
      { _id: 'e5', testName: 'free-shipping-threshold', variantId: 'variant-a', eventType: 'conversion' },
    ]);

    const result = await getTestResults('free-shipping-threshold');
    expect(result.success).toBe(true);
    expect(result.results.variants).toHaveLength(2);

    const control = result.results.variants.find(v => v.id === 'control');
    expect(control.impressions).toBe(2);
    expect(control.conversions).toBe(1);
    expect(control.conversionRate).toBe(50);
  });

  it('includes significance calculation', async () => {
    seedTest();
    __seed('AbEvents', []);

    const result = await getTestResults('free-shipping-threshold');
    expect(result.results.significance).toBeTruthy();
  });

  it('returns error for non-existent test', async () => {
    const result = await getTestResults('nonexistent');
    expect(result.success).toBe(false);
  });

  it('returns error for missing test name', async () => {
    const result = await getTestResults('');
    expect(result.success).toBe(false);
  });
});

// ── concludeTest ────────────────────────────────────────────────────

describe('concludeTest', () => {
  it('disables test and sets winner', async () => {
    seedTest();
    let updated = null;
    __onUpdate((collection, item) => {
      if (collection === 'AbTests') updated = item;
    });

    const result = await concludeTest('free-shipping-threshold', 'variant-a');
    expect(result.success).toBe(true);
    expect(updated.active).toBe(false);
    expect(updated.winnerVariant).toBe('variant-a');
  });

  it('returns error for non-existent test', async () => {
    const result = await concludeTest('nonexistent', 'variant-a');
    expect(result.success).toBe(false);
  });

  it('returns error for missing inputs', async () => {
    const result = await concludeTest('', '');
    expect(result.success).toBe(false);
  });
});

// ── createTest ──────────────────────────────────────────────────────

describe('createTest', () => {
  it('creates test with variants', async () => {
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'AbTests') inserted = item;
    });

    const result = await createTest({
      testName: 'new-test',
      variants: [
        { id: 'a', name: 'Version A' },
        { id: 'b', name: 'Version B' },
      ],
    });

    expect(result.success).toBe(true);
    expect(inserted.testName).toBe('new-test');
    expect(inserted.active).toBe(true);
    expect(inserted.trafficPercent).toBe(100);
  });

  it('rejects test with fewer than 2 variants', async () => {
    const result = await createTest({
      testName: 'bad-test',
      variants: [{ id: 'a', name: 'Only one' }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 2');
  });

  it('rejects duplicate test name', async () => {
    seedTest();

    const result = await createTest({
      testName: 'free-shipping-threshold',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('clamps traffic percent to 0-100', async () => {
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'AbTests') inserted = item;
    });

    await createTest({
      testName: 'clamped-test',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      trafficPercent: 150,
    });
    expect(inserted.trafficPercent).toBe(100);
  });

  it('returns error for missing inputs', async () => {
    const result = await createTest({});
    expect(result.success).toBe(false);
  });
});
