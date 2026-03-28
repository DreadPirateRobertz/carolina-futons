/**
 * @file shippingThresholdExperiment.test.js
 * @description Tests for the shipping threshold A/B experiment (cf-u0w8).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import { _reset as resetAbExperiments } from '../src/public/abExperiments.js';
import {
  EXPERIMENT_NAME,
  VARIANT_THRESHOLDS,
  initShippingThresholdTest,
  getActiveThreshold,
  qualifiesForFreeShipping,
  getShippingProgress,
  getThresholdDisplayText,
} from '../src/public/shippingThresholdExperiment.js';

beforeEach(() => {
  __reset();
  resetAbExperiments();
  __seed('AbTests', [
    {
      _id: 'test-ship', testName: 'shipping_threshold_test', active: true,
      variants: JSON.stringify([
        { id: 'A', name: '$999 threshold' },
        { id: 'B', name: '$799 threshold' },
        { id: 'C', name: '$599 threshold' },
      ]),
      trafficPercent: 100,
    },
  ]);
  __seed('AbEvents', []);
});

// ── Constants ───────────────────────────────────────────────────────

describe('experiment constants', () => {
  it('experiment name is shipping_threshold_test', () => {
    expect(EXPERIMENT_NAME).toBe('shipping_threshold_test');
  });

  it('defines 3 variant thresholds', () => {
    expect(VARIANT_THRESHOLDS.A).toBe(999);
    expect(VARIANT_THRESHOLDS.B).toBe(799);
    expect(VARIANT_THRESHOLDS.C).toBe(599);
  });
});

// ── Initialization ──────────────────────────────────────────────────

describe('initShippingThresholdTest', () => {
  it('returns a valid threshold from experiment', async () => {
    const result = await initShippingThresholdTest('Cart');
    expect(result.experimentActive).toBe(true);
    expect(result.variantId).toMatch(/^[ABC]$/);
    expect([999, 799, 599]).toContain(result.threshold);
  });

  it('returns default (disabled) threshold when test not found', async () => {
    __seed('AbTests', []);
    const result = await initShippingThresholdTest('Cart');
    expect(result.experimentActive).toBe(false);
    expect(result.threshold).toBe(999999);
  });
});

// ── getActiveThreshold ──────────────────────────────────────────────

describe('getActiveThreshold', () => {
  it('returns default before initialization', () => {
    expect(getActiveThreshold()).toBe(999999);
  });

  it('returns experiment threshold after init', async () => {
    await initShippingThresholdTest('Cart');
    const threshold = getActiveThreshold();
    expect([999, 799, 599]).toContain(threshold);
  });
});

// ── qualifiesForFreeShipping ────────────────────────────────────────

describe('qualifiesForFreeShipping', () => {
  it('returns false below threshold', async () => {
    await initShippingThresholdTest('Cart');
    // Even at $598, at least variant C ($599) requires more
    expect(qualifiesForFreeShipping(0)).toBe(false);
  });

  it('returns true at or above threshold', async () => {
    await initShippingThresholdTest('Cart');
    // $1000 qualifies for all variants
    expect(qualifiesForFreeShipping(1000)).toBe(true);
  });

  it('returns false when experiment not initialized (threshold disabled)', () => {
    expect(qualifiesForFreeShipping(5000)).toBe(false);
  });
});

// ── getShippingProgress ─────────────────────────────────────────────

describe('getShippingProgress', () => {
  it('shows progress toward threshold', async () => {
    await initShippingThresholdTest('Cart');
    const threshold = getActiveThreshold();
    const progress = getShippingProgress(threshold / 2);

    expect(progress.threshold).toBe(threshold);
    expect(progress.progressPct).toBeCloseTo(50, 0);
    expect(progress.qualifies).toBe(false);
    expect(progress.message).toContain('FREE shipping');
  });

  it('shows qualified when at threshold', async () => {
    await initShippingThresholdTest('Cart');
    const threshold = getActiveThreshold();
    const progress = getShippingProgress(threshold);

    expect(progress.qualifies).toBe(true);
    expect(progress.progressPct).toBe(100);
    expect(progress.message).toContain('qualify');
  });

  it('returns empty message when disabled', () => {
    const progress = getShippingProgress(500);
    expect(progress.message).toBe('');
    expect(progress.progressPct).toBe(0);
  });

  it('shows remaining dollar amount', async () => {
    await initShippingThresholdTest('Cart');
    const threshold = getActiveThreshold();
    const progress = getShippingProgress(threshold - 100);
    expect(progress.remaining).toBeCloseTo(100, 0);
    expect(progress.message).toContain('$100');
  });
});

// ── getThresholdDisplayText ─────────────────────────────────────────

describe('getThresholdDisplayText', () => {
  it('returns empty when disabled', () => {
    expect(getThresholdDisplayText()).toBe('');
  });

  it('returns formatted threshold after init', async () => {
    await initShippingThresholdTest('Cart');
    const text = getThresholdDisplayText();
    expect(text).toMatch(/^\$\d+\+$/);
  });
});
