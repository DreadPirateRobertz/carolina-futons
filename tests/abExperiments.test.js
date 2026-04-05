/**
 * @file abExperiments.test.js
 * @description CF-blhq: Tests for A/B experiment definitions and variant assignment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { hashRateLimitKey } from '../src/backend/utils/rateLimit.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── EXPERIMENTS definitions ─────────────────────────────────────────

describe('EXPERIMENTS', () => {
  let EXPERIMENTS;

  beforeEach(async () => {
    ({ EXPERIMENTS } = await import('../src/backend/abExperiments.web.js'));
  });

  it('defines exactly 5 experiments', () => {
    expect(Object.keys(EXPERIMENTS)).toHaveLength(5);
  });

  it('each experiment has required fields', () => {
    for (const [key, exp] of Object.entries(EXPERIMENTS)) {
      expect(exp.testName).toBe(key);
      expect(exp.description).toBeTruthy();
      expect(exp.hypothesis).toBeTruthy();
      expect(exp.metric).toBeTruthy();
      expect(exp.variants.length).toBeGreaterThanOrEqual(2);
      expect(exp.trafficPercent).toBeGreaterThan(0);
      expect(exp.pages.length).toBeGreaterThan(0);
    }
  });

  it('each variant has id, name, and weight', () => {
    for (const exp of Object.values(EXPERIMENTS)) {
      for (const variant of exp.variants) {
        expect(variant.id).toBeTruthy();
        expect(variant.name).toBeTruthy();
        expect(typeof variant.weight).toBe('number');
      }
    }
  });

  it('variant weights sum to ~100 for each experiment', () => {
    for (const exp of Object.values(EXPERIMENTS)) {
      const totalWeight = exp.variants.reduce((sum, v) => sum + v.weight, 0);
      expect(totalWeight).toBeGreaterThanOrEqual(99);
      expect(totalWeight).toBeLessThanOrEqual(102);
    }
  });
});

// ── _assignVariant ──────────────────────────────────────────────────

describe('_assignVariant', () => {
  let _assignVariant;

  beforeEach(async () => {
    ({ _assignVariant } = await import('../src/backend/abExperiments.web.js'));
  });

  const variants = [
    { id: 'control', name: 'Control', weight: 50 },
    { id: 'variant-b', name: 'Variant B', weight: 50 },
  ];

  it('returns deterministic assignment for same user+test', () => {
    const v1 = _assignVariant('test-1', 'user-abc', variants);
    const v2 = _assignVariant('test-1', 'user-abc', variants);
    expect(v1.id).toBe(v2.id);
  });

  it('distributes across variants for different users', () => {
    const assignments = new Set();
    for (let i = 0; i < 100; i++) {
      const v = _assignVariant('test-1', `user-${i}`, variants);
      assignments.add(v.id);
    }
    // With 100 users and equal weights, both variants should be assigned
    expect(assignments.size).toBe(2);
  });

  it('respects variant weights', () => {
    const weightedVariants = [
      { id: 'heavy', name: 'Heavy', weight: 90 },
      { id: 'light', name: 'Light', weight: 10 },
    ];
    let heavyCount = 0;
    for (let i = 0; i < 1000; i++) {
      const v = _assignVariant('test-weighted', `user-${i}`, weightedVariants);
      if (v.id === 'heavy') heavyCount++;
    }
    // With 90/10 weights, heavy should get ~90% (allow 75-98% range for hash distribution)
    expect(heavyCount).toBeGreaterThan(750);
    expect(heavyCount).toBeLessThan(980);
  });
});

// ── _buildVariantConfig ─────────────────────────────────────────────

describe('_buildVariantConfig', () => {
  let _buildVariantConfig;

  beforeEach(async () => {
    ({ _buildVariantConfig } = await import('../src/backend/abExperiments.web.js'));
  });

  it('returns shipping threshold for free-shipping-threshold variants', () => {
    expect(_buildVariantConfig('free-shipping-threshold', 'control')).toEqual({ threshold: 999 });
    expect(_buildVariantConfig('free-shipping-threshold', 'variant-b')).toEqual({ threshold: 799 });
    expect(_buildVariantConfig('free-shipping-threshold', 'variant-c')).toEqual({ threshold: 599 });
  });

  it('returns bundle config for bundle-discount-type variants', () => {
    expect(_buildVariantConfig('bundle-discount-type', 'control')).toEqual({ discountType: 'percentage', discountValue: 5 });
    expect(_buildVariantConfig('bundle-discount-type', 'variant-c')).toEqual({ discountType: 'free_cover', discountValue: 0 });
  });

  it('returns quiz gate config', () => {
    expect(_buildVariantConfig('style-quiz-gate', 'control')).toEqual({ registrationRequired: true });
    expect(_buildVariantConfig('style-quiz-gate', 'variant-b')).toEqual({ registrationRequired: false });
  });

  it('returns empty object for unknown experiment/variant', () => {
    expect(_buildVariantConfig('nonexistent', 'control')).toEqual({});
    expect(_buildVariantConfig('free-shipping-threshold', 'unknown')).toEqual({});
  });
});

// ── seedExperiments ─────────────────────────────────────────────────

describe('seedExperiments', () => {
  let seedExperiments;

  beforeEach(async () => {
    ({ seedExperiments } = await import('../src/backend/abExperiments.web.js'));
  });

  it('creates all 5 experiments when none exist', async () => {
    const result = await seedExperiments();
    expect(result.success).toBe(true);
    expect(result.created).toHaveLength(5);
    expect(result.skipped).toHaveLength(0);

    const inserted = __getInserted('AbTests');
    expect(inserted).toHaveLength(5);
  });

  it('skips experiments that already exist', async () => {
    __seed('AbTests', [{ testName: 'free-shipping-threshold', active: false }]);

    const result = await seedExperiments();
    expect(result.success).toBe(true);
    expect(result.created).toHaveLength(4);
    expect(result.skipped).toContain('free-shipping-threshold');
  });

  it('seeds experiments as inactive by default', async () => {
    await seedExperiments();
    const inserted = __getInserted('AbTests');
    for (const exp of inserted) {
      expect(exp.active).toBe(false);
    }
  });
});

// ── getExperimentVariant ────────────────────────────────────────────

describe('getExperimentVariant', () => {
  let getExperimentVariant;

  beforeEach(async () => {
    ({ getExperimentVariant } = await import('../src/backend/abExperiments.web.js'));
  });

  it('rejects missing experimentId', async () => {
    const result = await getExperimentVariant('', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('rejects missing userId', async () => {
    const result = await getExperimentVariant('free-shipping-threshold', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('returns error for nonexistent experiment', async () => {
    const result = await getExperimentVariant('nonexistent', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns variant with config for active experiment', async () => {
    __seed('AbTests', [{
      testName: 'free-shipping-threshold',
      variants: JSON.stringify([
        { id: 'control', name: '$999 threshold', weight: 34 },
        { id: 'variant-b', name: '$799 threshold', weight: 33 },
        { id: 'variant-c', name: '$599 threshold', weight: 33 },
      ]),
      trafficPercent: 100,
      active: true,
      winnerVariant: '',
    }]);

    const result = await getExperimentVariant('free-shipping-threshold', 'user-1');
    expect(result.success).toBe(true);
    expect(result.experimentId).toBe('free-shipping-threshold');
    expect(result.variant).toBeDefined();
    expect(result.variant.id).toBeTruthy();
    expect(result.active).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config).toHaveProperty('threshold');
  });

  it('returns winner variant for inactive experiment', async () => {
    __seed('AbTests', [{
      testName: 'style-quiz-gate',
      variants: JSON.stringify([
        { id: 'control', name: 'Required', weight: 50 },
        { id: 'variant-b', name: 'Optional', weight: 50 },
      ]),
      trafficPercent: 100,
      active: false,
      winnerVariant: 'variant-b',
    }]);

    const result = await getExperimentVariant('style-quiz-gate', 'user-1');
    expect(result.success).toBe(true);
    expect(result.active).toBe(false);
    expect(result.variant.id).toBe('variant-b');
    expect(result.config).toEqual({ registrationRequired: false });
  });

  it('rate-limits per userId', async () => {
    __seed('ExperimentVariantRateLimit', [{
      _id: 'rl-1',
      key: hashRateLimitKey('flood-user'),
      count: 30,
      windowStart: new Date(),
    }]);

    const result = await getExperimentVariant('free-shipping-threshold', 'flood-user');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });
});

// ── listExperiments ─────────────────────────────────────────────────

describe('listExperiments', () => {
  let listExperiments;

  beforeEach(async () => {
    ({ listExperiments } = await import('../src/backend/abExperiments.web.js'));
  });

  it('returns all experiments with status', async () => {
    __seed('AbTests', [
      { testName: 'test-1', active: true, variants: JSON.stringify([{ id: 'a' }, { id: 'b' }]) },
      { testName: 'test-2', active: false, variants: JSON.stringify([{ id: 'a' }, { id: 'b' }]) },
    ]);

    const result = await listExperiments();
    expect(result.success).toBe(true);
    expect(result.experiments).toHaveLength(2);
    expect(result.experiments[0]).toMatchObject({ id: 'test-1', active: true, variantCount: 2 });
  });
});
