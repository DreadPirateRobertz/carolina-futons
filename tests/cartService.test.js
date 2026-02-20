import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addToCart,
  getCurrentCart,
  getCartItemCount,
  onCartChanged,
  getProductVariants,
  getShippingProgress,
  getTierProgress,
  FREE_SHIPPING_THRESHOLD,
  TIER_THRESHOLDS,
} from '../src/public/cartService.js';
import wixStoresFrontend, { __reset, __setVariantsResponse, __triggerCartChanged } from './__mocks__/wix-stores-frontend.js';

beforeEach(() => {
  __reset();
});

// ── Constants ────────────────────────────────────────────────────────

describe('cartService constants', () => {
  it('exports FREE_SHIPPING_THRESHOLD as 999', () => {
    expect(FREE_SHIPPING_THRESHOLD).toBe(999);
  });

  it('exports TIER_THRESHOLDS with 3 tiers', () => {
    expect(TIER_THRESHOLDS).toHaveLength(3);
    expect(TIER_THRESHOLDS[0].min).toBe(0);
    expect(TIER_THRESHOLDS[0].discount).toBe(5);
    expect(TIER_THRESHOLDS[1].min).toBe(500);
    expect(TIER_THRESHOLDS[1].discount).toBe(10);
    expect(TIER_THRESHOLDS[2].min).toBe(1000);
  });

  it('TIER_THRESHOLDS labels return strings', () => {
    expect(TIER_THRESHOLDS[0].label('100.00')).toContain('100.00');
    expect(TIER_THRESHOLDS[2].label()).toContain('10% off');
  });
});

// ── getShippingProgress ──────────────────────────────────────────────

describe('getShippingProgress', () => {
  it('returns 0% progress for $0 subtotal', () => {
    const result = getShippingProgress(0);
    expect(result.remaining).toBe(999);
    expect(result.progressPct).toBe(0);
    expect(result.qualifies).toBe(false);
  });

  it('returns 50% progress for ~$500 subtotal', () => {
    const result = getShippingProgress(499.5);
    expect(result.progressPct).toBeCloseTo(50, 0);
    expect(result.qualifies).toBe(false);
  });

  it('returns 100% and qualifies at $999', () => {
    const result = getShippingProgress(999);
    expect(result.remaining).toBe(0);
    expect(result.progressPct).toBe(100);
    expect(result.qualifies).toBe(true);
  });

  it('returns 100% for amounts over threshold', () => {
    const result = getShippingProgress(1500);
    expect(result.progressPct).toBe(100);
    expect(result.qualifies).toBe(true);
    expect(result.remaining).toBe(0);
  });
});

// ── getTierProgress ──────────────────────────────────────────────────

describe('getTierProgress', () => {
  it('returns tier 1 (5% off) for $0-$500', () => {
    const result = getTierProgress(250);
    expect(result.tier.discount).toBe(5);
    expect(result.remaining).toBe(250);
  });

  it('returns tier 2 (10% off) for $500-$1000', () => {
    const result = getTierProgress(750);
    expect(result.tier.discount).toBe(10);
    expect(result.remaining).toBe(250);
  });

  it('returns max tier at $1000+', () => {
    const result = getTierProgress(1200);
    expect(result.tier.discount).toBe(10);
    expect(result.remaining).toBe(0);
    expect(result.progressPct).toBe(100);
  });

  it('at $500 boundary enters tier 2 with 50% progress toward $1000', () => {
    const result = getTierProgress(500);
    expect(result.tier.discount).toBe(10);
    expect(result.progressPct).toBe(50);
  });
});

// ── Cart Operations ──────────────────────────────────────────────────

describe('addToCart', () => {
  it('calls wix-stores-frontend cart.addProducts', async () => {
    const result = await addToCart('prod-1');
    expect(result).toEqual({ items: [{ productId: 'prod-1', quantity: 1 }] });
  });

  it('passes custom quantity', async () => {
    const result = await addToCart('prod-2', 3);
    expect(result.items[0].quantity).toBe(3);
  });
});

describe('onCartChanged', () => {
  it('registers a callback that fires on cart change', () => {
    const cb = vi.fn();
    onCartChanged(cb);
    __triggerCartChanged();
    expect(cb).toHaveBeenCalled();
  });
});

describe('getProductVariants', () => {
  it('returns variants from wix-stores-frontend', async () => {
    __setVariantsResponse([{ _id: 'v1', price: 299 }]);
    const result = await getProductVariants('prod-1', { Size: 'Queen' });
    expect(result).toEqual([{ _id: 'v1', price: 299 }]);
  });

  it('returns empty array when no variants set', async () => {
    const result = await getProductVariants('prod-1', {});
    expect(result).toEqual([]);
  });
});
