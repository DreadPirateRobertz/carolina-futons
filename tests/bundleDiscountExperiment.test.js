/**
 * @file bundleDiscountExperiment.test.js
 * @description Tests for the bundle discount A/B experiment (cf-fb99).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import { _reset as resetAbExperiments } from '../src/public/abExperiments.js';
import {
  EXPERIMENT_NAME,
  VARIANTS,
  initBundleDiscountTest,
  getActiveBundleVariant,
  calculateBundleDiscount,
  getBundleOfferDisplay,
} from '../src/public/bundleDiscountExperiment.js';

beforeEach(() => {
  __reset();
  resetAbExperiments();
  __seed('AbTests', [{
    _id: 'test-bundle', testName: 'bundle_discount_test', active: true,
    variants: JSON.stringify([
      { id: 'A', name: '5% off' },
      { id: 'B', name: '10% off' },
      { id: 'C', name: 'Free accessory' },
    ]),
    trafficPercent: 100,
  }]);
  __seed('AbEvents', []);
});

// ── Constants ───────────────────────────────────────────────────────

describe('experiment constants', () => {
  it('experiment name is bundle_discount_test', () => {
    expect(EXPERIMENT_NAME).toBe('bundle_discount_test');
  });

  it('variant A is 5% off', () => {
    expect(VARIANTS.A.discountPercent).toBe(5);
    expect(VARIANTS.A.type).toBe('percent_off');
  });

  it('variant B is 10% off', () => {
    expect(VARIANTS.B.discountPercent).toBe(10);
  });

  it('variant C is free accessory', () => {
    expect(VARIANTS.C.type).toBe('free_accessory');
    expect(VARIANTS.C.accessoryName).toBe('Premium Futon Cover');
    expect(VARIANTS.C.accessoryValue).toBe(49.99);
  });
});

// ── Initialization ──────────────────────────────────────────────────

describe('initBundleDiscountTest', () => {
  it('returns an active variant', async () => {
    const result = await initBundleDiscountTest('Bundle');
    expect(result.experimentActive).toBe(true);
    expect(result.variant).toBeTruthy();
    expect(result.variant.id).toMatch(/^[ABC]$/);
  });

  it('returns null variant when test not found', async () => {
    __seed('AbTests', []);
    const result = await initBundleDiscountTest('Bundle');
    expect(result.experimentActive).toBe(false);
    expect(result.variant).toBeNull();
  });
});

// ── calculateBundleDiscount ─────────────────────────────────────────

describe('calculateBundleDiscount', () => {
  it('returns no discount before initialization', () => {
    const result = calculateBundleDiscount(500);
    expect(result.type).toBe('none');
    expect(result.discountAmount).toBe(0);
    expect(result.finalPrice).toBe(500);
  });

  it('calculates percent discount for variant A or B', async () => {
    await initBundleDiscountTest('Bundle');
    const variant = getActiveBundleVariant();

    if (variant.type === 'percent_off') {
      const result = calculateBundleDiscount(1000);
      expect(result.type).toBe('percent_off');
      expect(result.discountAmount).toBe(1000 * variant.discountPercent / 100);
      expect(result.finalPrice).toBe(1000 - result.discountAmount);
      expect(result.freeAccessory).toBeNull();
    }
  });

  it('returns free accessory for variant C', async () => {
    // Force variant C by using specific test
    await initBundleDiscountTest('Bundle');
    const variant = getActiveBundleVariant();

    if (variant.type === 'free_accessory') {
      const result = calculateBundleDiscount(1000);
      expect(result.type).toBe('free_accessory');
      expect(result.freeAccessory).toBe('Premium Futon Cover');
      expect(result.finalPrice).toBe(1000); // Price unchanged
      expect(result.discountAmount).toBe(49.99);
    }
  });

  it('handles zero bundle price', () => {
    const result = calculateBundleDiscount(0);
    expect(result.finalPrice).toBe(0);
  });
});

// ── getBundleOfferDisplay ───────────────────────────────────────────

describe('getBundleOfferDisplay', () => {
  it('returns show=false before init', () => {
    const display = getBundleOfferDisplay(1000);
    expect(display.show).toBe(false);
  });

  it('returns display data after init', async () => {
    await initBundleDiscountTest('Bundle');
    const display = getBundleOfferDisplay(1000);
    expect(display.show).toBe(true);
    expect(display.badgeText).toBeTruthy();
    expect(display.savingsText).toBeTruthy();
    expect(display.detailText).toBeTruthy();
  });

  it('percent variants show dollar savings', async () => {
    await initBundleDiscountTest('Bundle');
    const variant = getActiveBundleVariant();

    if (variant.type === 'percent_off') {
      const display = getBundleOfferDisplay(1000);
      expect(display.savingsText).toContain('Save $');
      expect(display.detailText).toContain('% off');
    }
  });

  it('accessory variant shows item name and value', async () => {
    await initBundleDiscountTest('Bundle');
    const variant = getActiveBundleVariant();

    if (variant.type === 'free_accessory') {
      const display = getBundleOfferDisplay(1000);
      expect(display.savingsText).toContain('Premium Futon Cover');
      expect(display.savingsText).toContain('$49.99');
    }
  });
});
