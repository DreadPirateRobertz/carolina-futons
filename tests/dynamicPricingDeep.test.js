/**
 * Deep coverage tests for dynamicPricing.web.js — edge cases in price
 * calculation, geographic adjustment, clearance evaluation, bundle
 * discounting, demand signal recording, and pricing rule management.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  calculateDynamicPrice,
  getGeographicAdjustment,
  evaluateClearanceCandidates,
  calculateBundleDiscount,
  recordDemandSignal,
  getDemandMetrics,
  getClearanceQueue,
  updatePricingRule,
  _DEMAND_MULTIPLIERS,
  _GEOGRAPHIC_ZONES,
  _CLEARANCE_THRESHOLDS,
  _BUNDLE_TIERS,
} from '../src/backend/dynamicPricing.web.js';

beforeEach(() => {
  __seed('Stores/Products', []);
  __seed('ProductDemandMetrics', []);
  __seed('DynamicPricingRules', []);
  __seed('ClearanceQueue', []);
});

// ── calculateDynamicPrice — NaN/Infinity/coercion edge cases ─────────

describe('calculateDynamicPrice — invalid & coerced inputs', () => {
  it('returns invalid_input for undefined productId', async () => {
    const result = await calculateDynamicPrice(undefined);
    expect(result.reason).toBe('invalid_input');
    expect(result.adjustedPrice).toBe(0);
  });

  it('returns invalid_input for numeric 0 productId (falsy)', async () => {
    const result = await calculateDynamicPrice(0);
    expect(result.reason).toBe('invalid_input');
  });

  it('returns invalid_input for boolean false productId', async () => {
    const result = await calculateDynamicPrice(false);
    expect(result.reason).toBe('invalid_input');
  });

  it('returns product_not_found for valid but nonexistent ID', async () => {
    const result = await calculateDynamicPrice('a0b1c2d3-e4f5-6789-abcd-ef0123456789');
    expect(result.reason).toBe('product_not_found');
  });

  it('returns no_price when product has zero price', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000001', name: 'Free Item', price: 0, collections: [] },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000001');
    expect(result.reason).toBe('no_price');
    expect(result.basePrice).toBe(0);
  });

  it('returns no_price when product has negative price', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000002', name: 'Neg', price: -50, collections: [] },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000002');
    expect(result.reason).toBe('no_price');
  });

  it('returns no_price when product.price is null', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000003', name: 'Null Price', price: null, collections: [] },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000003');
    expect(result.reason).toBe('no_price');
  });

  it('applies veryLow multiplier for demand score of 0', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000010', name: 'Dead Item', price: 1000, collections: [] },
    ]);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1c2d3-0000-0000-0000-000000000010', demandScore: 0 },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000010');
    expect(result.demandMultiplier).toBe(_DEMAND_MULTIPLIERS.veryLow.multiplier);
    expect(result.reason).toContain('very_low_demand');
  });

  it('applies medium multiplier at exact boundary score 40', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000011', name: 'Mid', price: 500, collections: [] },
    ]);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1c2d3-0000-0000-0000-000000000011', demandScore: 40 },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000011');
    expect(result.demandMultiplier).toBe(_DEMAND_MULTIPLIERS.medium.multiplier);
  });

  it('applies high multiplier at exact boundary score 75', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000012', name: 'Hot', price: 500, collections: [] },
    ]);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1c2d3-0000-0000-0000-000000000012', demandScore: 75 },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000012');
    expect(result.demandMultiplier).toBe(_DEMAND_MULTIPLIERS.high.multiplier);
  });

  it('applies low multiplier at exact boundary score 10', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000013', name: 'Slow', price: 500, collections: [] },
    ]);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1c2d3-0000-0000-0000-000000000013', demandScore: 10 },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000013');
    expect(result.demandMultiplier).toBe(_DEMAND_MULTIPLIERS.low.multiplier);
  });

  it('rounds adjustedPrice to two decimal places', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000014', name: 'Odd', price: 333.33, collections: [] },
    ]);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1c2d3-0000-0000-0000-000000000014', demandScore: 85 },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000014');
    // 333.33 * 1.05 = 349.9965 → should round to 349.9965 → 350.00
    const decimalPlaces = (result.adjustedPrice.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  it('rounds geoAdjustment to two decimal places', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-000000000015', name: 'Geo', price: 333.33, collections: [] },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-000000000015', { zipCode: '28801' });
    const decimalPlaces = (result.geoAdjustment.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});

// ── calculateDynamicPrice — discount stacking ────────────────────────

describe('calculateDynamicPrice — discount stacking & guard rails', () => {
  it('stacks demand + rule + clearance discounts but enforces floor', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-aaa000000001', name: 'Stack Test', price: 1000, collections: ['outdoor-furniture'] },
    ]);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1c2d3-0000-0000-0000-aaa000000001', demandScore: 5 },
    ]);
    __seed('DynamicPricingRules', [
      { _id: 'rule-1', name: 'Big Sale', type: 'seasonal', isActive: true, discountPercent: 50, startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000), categories: ['outdoor-furniture'], priority: 1 },
    ]);
    __seed('ClearanceQueue', [
      { productId: 'a0b1c2d3-0000-0000-0000-aaa000000001', clearancePercent: 40, isActive: true },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-aaa000000001', { includeClearance: true });
    // Floor is 50% of base = 500
    expect(result.adjustedPrice).toBeGreaterThanOrEqual(500);
  });

  it('does not apply clearance when includeClearance is false', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-aaa000000002', name: 'No Clear', price: 800, collections: [] },
    ]);
    __seed('ClearanceQueue', [
      { productId: 'a0b1c2d3-0000-0000-0000-aaa000000002', clearancePercent: 30, isActive: true },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-aaa000000002');
    expect(result.clearanceDiscount).toBe(0);
  });

  it('joins multiple reasons with + separator', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-aaa000000003', name: 'Multi', price: 500, collections: ['futon-frames'] },
    ]);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1c2d3-0000-0000-0000-aaa000000003', demandScore: 85 },
    ]);
    __seed('DynamicPricingRules', [
      { _id: 'rule-2', name: 'Rule', type: 'seasonal', isActive: true, discountPercent: 5, startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000), categories: [], priority: 1 },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-aaa000000003', { zipCode: '90210' });
    expect(result.reason).toContain('+');
    expect(result.reason).toContain('pricing_rule');
    expect(result.reason).toContain('geographic');
  });

  it('returns base_price reason when no adjustments apply', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-aaa000000004', name: 'Plain', price: 500, collections: [] },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-aaa000000004');
    expect(result.reason).toBe('base_price');
    expect(result.adjustedPrice).toBe(500);
  });

  it('pricing rule matches when rule has empty categories array (applies to all)', async () => {
    __seed('Stores/Products', [
      { _id: 'a0b1c2d3-0000-0000-0000-aaa000000005', name: 'Any Cat', price: 400, collections: ['mattresses'] },
    ]);
    __seed('DynamicPricingRules', [
      { _id: 'rule-3', name: 'Global', type: 'demand', isActive: true, discountPercent: 10, startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000), categories: [], priority: 1 },
    ]);

    const result = await calculateDynamicPrice('a0b1c2d3-0000-0000-0000-aaa000000005');
    expect(result.adjustedPrice).toBeLessThan(400);
    expect(result.reason).toContain('pricing_rule');
  });
});

// ── getGeographicAdjustment — deeper edge cases ─────────────────────

describe('getGeographicAdjustment — deeper edge cases', () => {
  it('returns no_zip for numeric input (not a string)', () => {
    const result = getGeographicAdjustment(28801, 500);
    expect(result.zone).toBe('unknown');
    expect(result.reason).toBe('no_zip');
  });

  it('strips non-digit characters and uses first 3 digits', () => {
    const result = getGeographicAdjustment('288-01', 500);
    expect(result.zone).toBe('local');
  });

  it('handles zip with spaces', () => {
    const result = getGeographicAdjustment('2 8 8 0 1', 500);
    expect(result.zone).toBe('local');
  });

  it('returns adjustment proportional to basePrice for local zone', () => {
    const r100 = getGeographicAdjustment('28801', 100);
    const r1000 = getGeographicAdjustment('28801', 1000);
    // Both should be -3% of their base
    expect(r1000.adjustment).toBe(r100.adjustment * 10);
  });

  it('returns positive adjustment for national zone', () => {
    const result = getGeographicAdjustment('90210', 500);
    expect(result.adjustment).toBeGreaterThan(0);
    expect(result.zone).toBe('national');
  });

  it('returns 0 adjustment for regional zone', () => {
    const result = getGeographicAdjustment('30301', 500);
    expect(result.adjustment).toBe(0);
    expect(result.zone).toBe('regional');
  });

  it('handles very large basePrice without overflow', () => {
    const result = getGeographicAdjustment('28801', 999999.99);
    expect(Number.isFinite(result.adjustment)).toBe(true);
  });

  it('handles zip with only digits after stripping to exactly 3 chars', () => {
    const result = getGeographicAdjustment('288', 500);
    expect(result.zone).toBe('local');
  });
});

// ── evaluateClearanceCandidates — deeper edge cases ──────────────────

describe('evaluateClearanceCandidates — deeper edge cases', () => {
  it('uses current time for items with null listedDate', async () => {
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1-0001', productName: 'No Date', demandScore: 5, listedDate: null },
    ]);

    const result = await evaluateClearanceCandidates();
    // listedDate = null → falls back to now → daysListed = 0 → below threshold
    expect(result.candidates).toHaveLength(0);
    expect(result.evaluated).toBe(1);
  });

  it('assigns long_shelf_life reason for items over 365 days old', async () => {
    const veryOld = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1-0002', productName: 'Ancient', demandScore: 3, salesCount30d: 1, listedDate: veryOld },
    ]);

    const result = await evaluateClearanceCandidates();
    expect(result.candidates[0].reason).toBe('long_shelf_life');
  });

  it('assigns no_recent_sales reason for 0 sales over 180 days', async () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1-0003', productName: 'No Sales', demandScore: 10, salesCount30d: 0, listedDate: old },
    ]);

    const result = await evaluateClearanceCandidates();
    expect(result.candidates[0].reason).toBe('no_recent_sales');
  });

  it('assigns slow_mover for products just over 90 days with some sales', async () => {
    const date = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1-0004', productName: 'Slow', demandScore: 10, salesCount30d: 2, listedDate: date },
    ]);

    const result = await evaluateClearanceCandidates();
    expect(result.candidates[0].reason).toBe('slow_mover');
  });

  it('sorts candidates by suggestedDiscount descending', async () => {
    const old = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
    const veryOld = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1-0005', productName: 'Newer', demandScore: 14, salesCount30d: 1, listedDate: old },
      { productId: 'a0b1-0006', productName: 'Oldest', demandScore: 0, salesCount30d: 0, listedDate: veryOld },
    ]);

    const result = await evaluateClearanceCandidates();
    expect(result.candidates.length).toBe(2);
    expect(result.candidates[0].suggestedDiscount).toBeGreaterThanOrEqual(result.candidates[1].suggestedDiscount);
  });

  it('uses empty string for missing productName', async () => {
    const old = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1-0007', demandScore: 5, listedDate: old },
    ]);

    const result = await evaluateClearanceCandidates();
    expect(result.candidates[0].productName).toBe('');
  });

  it('defaults demandScore to 0 when missing from item', async () => {
    const old = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
    __seed('ProductDemandMetrics', [
      { productId: 'a0b1-0008', productName: 'No Score', listedDate: old },
    ]);

    const result = await evaluateClearanceCandidates();
    expect(result.candidates[0].demandScore).toBe(0);
  });
});

// ── calculateBundleDiscount — coercion & edge cases ──────────────────

describe('calculateBundleDiscount — coercion & edge cases', () => {
  it('returns insufficient_items for undefined input', async () => {
    const result = await calculateBundleDiscount(undefined);
    expect(result.reason).toBe('insufficient_items');
  });

  it('returns insufficient_items for a string input', async () => {
    const result = await calculateBundleDiscount('not-an-array');
    expect(result.reason).toBe('insufficient_items');
  });

  it('filters out items with negative prices', async () => {
    const result = await calculateBundleDiscount([
      { productId: 'p1', price: -100, category: 'futon-frames' },
      { productId: 'p2', price: -50, category: 'mattresses' },
    ]);
    expect(result.discountPercent).toBe(0);
  });

  it('filters out items with NaN prices', async () => {
    const result = await calculateBundleDiscount([
      { productId: 'p1', price: NaN, category: 'futon-frames' },
      { productId: 'p2', price: 200, category: 'mattresses' },
    ]);
    // Only 1 valid item → insufficient
    expect(result.discountPercent).toBe(0);
  });

  it('filters out items with string prices', async () => {
    const result = await calculateBundleDiscount([
      { productId: 'p1', price: '100', category: 'futon-frames' },
      { productId: 'p2', price: 200, category: 'mattresses' },
    ]);
    // '100' is typeof string, not number → filtered out → only 1 valid item
    expect(result.discountPercent).toBe(0);
  });

  it('ignores null items in the array', async () => {
    const result = await calculateBundleDiscount([
      null,
      { productId: 'p1', price: 400, category: 'futon-frames' },
      undefined,
      { productId: 'p2', price: 200, category: 'mattresses' },
    ]);
    expect(result.discountPercent).toBeGreaterThan(0);
  });

  it('does not count items without category toward categoryCount', async () => {
    const result = await calculateBundleDiscount([
      { productId: 'p1', price: 400 },
      { productId: 'p2', price: 200 },
    ]);
    // 2 valid items, 0 categories → still matches tier[0] (minCategories: 1 fails, but fallback applies)
    expect(result.discountPercent).toBe(5);
  });

  it('caps complementary bonus at 15% total', async () => {
    // 4 items, 3 categories → Ultimate Bundle (15%) + complementary would be 17% → capped at 15
    const result = await calculateBundleDiscount([
      { productId: 'p1', price: 1000, category: 'futon-frames' },
      { productId: 'p2', price: 800, category: 'mattresses' },
      { productId: 'p3', price: 600, category: 'casegoods-accessories' },
      { productId: 'p4', price: 400, category: 'futon-frames' },
    ]);
    expect(result.discountPercent).toBeLessThanOrEqual(15);
  });

  it('includes complementary bonus label in reason', async () => {
    const result = await calculateBundleDiscount([
      { productId: 'p1', price: 400, category: 'futon-frames' },
      { productId: 'p2', price: 200, category: 'mattresses' },
    ]);
    expect(result.reason).toContain('complementary bonus');
  });

  it('calculates discountAmount correctly based on total price', async () => {
    const result = await calculateBundleDiscount([
      { productId: 'p1', price: 400, category: 'casegoods-accessories' },
      { productId: 'p2', price: 600, category: 'casegoods-accessories' },
    ]);
    // Same category, 2 items → 5%, total = 1000
    expect(result.discountAmount).toBe(50); // 1000 * 5% = 50
  });
});

// ── recordDemandSignal — edge cases ─────────────────────────────────

describe('recordDemandSignal — edge cases', () => {
  it('rejects undefined signalType', async () => {
    const result = await recordDemandSignal('a0b1c2d3-0000-0000-0000-000000000001', undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signal');
  });

  it('rejects null signalType', async () => {
    const result = await recordDemandSignal('a0b1c2d3-0000-0000-0000-000000000001', null);
    expect(result.success).toBe(false);
  });

  it('rejects signal type with wrong case (VIEW instead of view)', async () => {
    const result = await recordDemandSignal('a0b1c2d3-0000-0000-0000-000000000001', 'VIEW');
    expect(result.success).toBe(false);
  });

  it('initializes new metrics with correct field for cart_add', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'ProductDemandMetrics') insertedItem = item;
    });

    await recordDemandSignal('a0b1c2d3-0000-0000-0000-bbb000000001', 'cart_add');
    expect(insertedItem.cartAdds30d).toBe(1);
    expect(insertedItem.viewCount30d).toBe(0);
    expect(insertedItem.salesCount30d).toBe(0);
  });

  it('initializes new metrics with correct field for purchase', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'ProductDemandMetrics') insertedItem = item;
    });

    await recordDemandSignal('a0b1c2d3-0000-0000-0000-bbb000000002', 'purchase');
    expect(insertedItem.salesCount30d).toBe(1);
    expect(insertedItem.viewCount30d).toBe(0);
    expect(insertedItem.cartAdds30d).toBe(0);
  });

  it('handles missing count fields on existing metrics (defaults to 0)', async () => {
    __seed('ProductDemandMetrics', [
      { _id: 'met-1', productId: 'a0b1c2d3-0000-0000-0000-bbb000000003' },
    ]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'ProductDemandMetrics') updatedItem = item;
    });

    await recordDemandSignal('a0b1c2d3-0000-0000-0000-bbb000000003', 'view');
    expect(updatedItem.viewCount30d).toBe(1);
  });

  it('computes and stores demandScore on new record', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'ProductDemandMetrics') insertedItem = item;
    });

    await recordDemandSignal('a0b1c2d3-0000-0000-0000-bbb000000004', 'purchase');
    expect(typeof insertedItem.demandScore).toBe('number');
    expect(insertedItem.demandScore).toBeGreaterThanOrEqual(0);
  });

  it('updates demandScore on existing record after signal', async () => {
    __seed('ProductDemandMetrics', [
      { _id: 'met-2', productId: 'a0b1c2d3-0000-0000-0000-bbb000000005', viewCount30d: 100, cartAdds30d: 10, salesCount30d: 5, demandScore: 50 },
    ]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'ProductDemandMetrics') updatedItem = item;
    });

    await recordDemandSignal('a0b1c2d3-0000-0000-0000-bbb000000005', 'purchase');
    expect(updatedItem.demandScore).toBeGreaterThanOrEqual(0);
    expect(updatedItem.salesCount30d).toBe(6);
  });
});

// ── getDemandMetrics — edge cases ───────────────────────────────────

describe('getDemandMetrics — edge cases', () => {
  it('returns empty for empty string productId', async () => {
    const result = await getDemandMetrics('');
    expect(result.demandScore).toBe(0);
    expect(result.updatedAt).toBeNull();
  });

  it('defaults missing fields to 0 on stored record', async () => {
    __seed('ProductDemandMetrics', [
      { _id: 'met-x', productId: 'a0b1c2d3-0000-0000-0000-ccc000000001' },
    ]);

    const result = await getDemandMetrics('a0b1c2d3-0000-0000-0000-ccc000000001');
    expect(result.viewCount30d).toBe(0);
    expect(result.cartAdds30d).toBe(0);
    expect(result.salesCount30d).toBe(0);
    expect(result.demandScore).toBe(0);
  });
});

// ── getClearanceQueue — edge cases ──────────────────────────────────

describe('getClearanceQueue — edge cases', () => {
  it('defaults missing fields on clearance items', async () => {
    __seed('ClearanceQueue', [
      { _id: 'cq-1', productId: 'a0b1-cq01', isActive: true },
    ]);

    const result = await getClearanceQueue();
    expect(result.items[0].productName).toBe('');
    expect(result.items[0].clearancePercent).toBe(0);
    expect(result.items[0].reason).toBe('');
    expect(result.items[0].addedAt).toBeNull();
  });

  it('excludes inactive clearance items', async () => {
    __seed('ClearanceQueue', [
      { _id: 'cq-2', productId: 'a0b1-cq02', isActive: false, clearancePercent: 20 },
    ]);

    const result = await getClearanceQueue();
    expect(result.items).toHaveLength(0);
  });
});

// ── updatePricingRule — edge cases ──────────────────────────────────

describe('updatePricingRule — edge cases', () => {
  it('rejects null rule', async () => {
    const result = await updatePricingRule(null);
    expect(result.success).toBe(false);
  });

  it('rejects undefined rule', async () => {
    const result = await updatePricingRule(undefined);
    expect(result.success).toBe(false);
  });

  it('coerces NaN discountPercent to 0', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'DynamicPricingRules') insertedItem = item;
    });

    await updatePricingRule({ name: 'NaN Test', type: 'seasonal', discountPercent: NaN });
    expect(insertedItem.discountPercent).toBe(0);
  });

  it('coerces string discountPercent via Number()', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'DynamicPricingRules') insertedItem = item;
    });

    await updatePricingRule({ name: 'Str Test', type: 'seasonal', discountPercent: '25' });
    expect(insertedItem.discountPercent).toBe(25);
  });

  it('defaults isActive to true when not explicitly false', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'DynamicPricingRules') insertedItem = item;
    });

    await updatePricingRule({ name: 'Active Test', type: 'demand' });
    expect(insertedItem.isActive).toBe(true);
  });

  it('sets isActive to false only when explicitly false', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'DynamicPricingRules') insertedItem = item;
    });

    await updatePricingRule({ name: 'Inactive', type: 'demand', isActive: false });
    expect(insertedItem.isActive).toBe(false);
  });

  it('coerces non-numeric priority to default 10', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'DynamicPricingRules') insertedItem = item;
    });

    await updatePricingRule({ name: 'Prio', type: 'seasonal', priority: 'high' });
    expect(insertedItem.priority).toBe(10);
  });

  it('sanitizes category entries', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'DynamicPricingRules') insertedItem = item;
    });

    await updatePricingRule({
      name: 'Cat Test', type: 'seasonal',
      categories: ['futon-frames', '<script>alert(1)</script>'],
    });
    expect(insertedItem.categories).toHaveLength(2);
    // Second category should have HTML stripped
    expect(insertedItem.categories[1]).not.toContain('<script>');
  });

  it('provides default endDate one year from now when omitted', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'DynamicPricingRules') insertedItem = item;
    });

    const before = Date.now();
    await updatePricingRule({ name: 'Default End', type: 'seasonal' });
    const after = Date.now();

    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    expect(insertedItem.endDate.getTime()).toBeGreaterThanOrEqual(before + oneYearMs - 1000);
    expect(insertedItem.endDate.getTime()).toBeLessThanOrEqual(after + oneYearMs + 1000);
  });

  it('handles empty categories array', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'DynamicPricingRules') insertedItem = item;
    });

    await updatePricingRule({ name: 'No Cats', type: 'clearance', categories: [] });
    expect(insertedItem.categories).toEqual([]);
  });
});
