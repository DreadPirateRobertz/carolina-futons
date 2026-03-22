/**
 * Tests for src/public/bundleHelpers.js
 *
 * Covers: getBundleTag, extractBundleTag, groupBundleItems,
 * findBrokenBundles, formatBundleSavings.
 *
 * Pure utility functions — no Wix mocks needed.
 * TDD: written before implementation (CF-vtle).
 */
import { describe, it, expect } from 'vitest';
import {
  getBundleTag,
  extractBundleTag,
  groupBundleItems,
  findBrokenBundles,
  formatBundleSavings,
} from '../src/public/bundleHelpers.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(productId, bundleId = null) {
  return {
    productId,
    quantity: 1,
    customTextFields: bundleId
      ? [{ title: 'bundleTag', value: `bundle:${bundleId}` }]
      : [],
  };
}

// ── getBundleTag ──────────────────────────────────────────────────────────────

describe('getBundleTag', () => {
  it('returns bundle:<id> format', () => {
    expect(getBundleTag('bundle-001')).toBe('bundle:bundle-001');
  });

  it('returns bundle:<id> for any string id', () => {
    expect(getBundleTag('abc123')).toBe('bundle:abc123');
  });

  it('with null produces bundle:null (callers must validate before calling)', () => {
    // Documents the known behavior — callers should not pass null
    expect(getBundleTag(null)).toBe('bundle:null');
  });

  it('with undefined produces bundle:undefined', () => {
    expect(getBundleTag(undefined)).toBe('bundle:undefined');
  });
});

// ── extractBundleTag ──────────────────────────────────────────────────────────

describe('extractBundleTag', () => {
  it('returns tag value when bundleTag customTextField is present', () => {
    const item = makeItem('frame-001', 'bundle-001');
    expect(extractBundleTag(item)).toBe('bundle:bundle-001');
  });

  it('returns null for item with no bundleTag field', () => {
    const item = makeItem('standalone-product');
    expect(extractBundleTag(item)).toBeNull();
  });

  it('returns null for item with empty customTextFields', () => {
    expect(extractBundleTag({ productId: 'x', customTextFields: [] })).toBeNull();
  });

  it('returns null for item with no customTextFields property', () => {
    expect(extractBundleTag({ productId: 'x' })).toBeNull();
  });
});

// ── groupBundleItems ──────────────────────────────────────────────────────────

describe('groupBundleItems', () => {
  it('groups items sharing the same bundleTag', () => {
    const items = [
      makeItem('frame-001', 'bundle-001'),
      makeItem('mattress-001', 'bundle-001'),
      makeItem('cover-001', 'bundle-001'),
    ];
    const groups = groupBundleItems(items);
    expect(groups['bundle:bundle-001']).toHaveLength(3);
  });

  it('separates items from different bundles', () => {
    const items = [
      makeItem('frame-001', 'bundle-001'),
      makeItem('frame-002', 'bundle-002'),
    ];
    const groups = groupBundleItems(items);
    expect(groups['bundle:bundle-001']).toHaveLength(1);
    expect(groups['bundle:bundle-002']).toHaveLength(1);
  });

  it('excludes items with no bundleTag', () => {
    const items = [
      makeItem('standalone-product'),
      makeItem('frame-001', 'bundle-001'),
    ];
    const groups = groupBundleItems(items);
    expect(Object.keys(groups)).toHaveLength(1);
    expect(groups['bundle:bundle-001']).toHaveLength(1);
  });

  it('returns empty object for cart with no bundle items', () => {
    const items = [makeItem('product-a'), makeItem('product-b')];
    expect(groupBundleItems(items)).toEqual({});
  });

  it('excludes item with non-bundleTag customTextField (e.g. engraving)', () => {
    const item = {
      productId: 'frame-001',
      customTextFields: [{ title: 'engraving', value: 'Happy Birthday' }],
    };
    expect(groupBundleItems([item])).toEqual({});
  });
});

// ── findBrokenBundles ─────────────────────────────────────────────────────────

describe('findBrokenBundles', () => {
  it('returns empty array when all bundles are complete (3 items each)', () => {
    const items = [
      makeItem('frame-001', 'bundle-001'),
      makeItem('mattress-001', 'bundle-001'),
      makeItem('cover-001', 'bundle-001'),
    ];
    expect(findBrokenBundles(items)).toHaveLength(0);
  });

  it('returns the broken bundleTag when a component is missing', () => {
    const items = [
      makeItem('frame-001', 'bundle-001'),
      makeItem('mattress-001', 'bundle-001'),
      // cover missing
    ];
    const broken = findBrokenBundles(items);
    expect(broken).toHaveLength(1);
    expect(broken[0].bundleTag).toBe('bundle:bundle-001');
  });

  it('reports componentCount and expectedCount', () => {
    const items = [makeItem('frame-001', 'bundle-001')];
    const broken = findBrokenBundles(items);
    expect(broken[0].componentCount).toBe(1);
    expect(broken[0].expectedCount).toBe(3);
  });

  it('returns empty array for empty cart', () => {
    expect(findBrokenBundles([])).toHaveLength(0);
  });
});

// ── formatBundleSavings ───────────────────────────────────────────────────────

describe('formatBundleSavings', () => {
  it('returns exact format: Save $<amount> (<pct>% off)', () => {
    // $75 savings on $549 bundle: original = 624, pct = round(75/624*100) = 12%
    expect(formatBundleSavings({ savings: 75, bundlePrice: 549 })).toBe('Save $75 (12% off)');
  });

  it('calculates percentage correctly for a different bundle', () => {
    // $120 savings on $899 bundle: original = 1019, pct = round(120/1019*100) = 12%
    expect(formatBundleSavings({ savings: 120, bundlePrice: 899 })).toBe('Save $120 (12% off)');
  });

  it('returns "Bundle price" for zero savings', () => {
    expect(formatBundleSavings({ savings: 0, bundlePrice: 300 })).toBe('Bundle price');
  });

  it('returns "Bundle price" for negative savings', () => {
    expect(formatBundleSavings({ savings: -10, bundlePrice: 300 })).toBe('Bundle price');
  });
});
