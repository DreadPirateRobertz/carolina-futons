import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addToCart,
  getCurrentCart,
  getCartItemCount,
  updateCartItemQuantity,
  removeCartItem,
  onCartChanged,
  getProductVariants,
  getShippingProgress,
  getTierProgress,
  clampQuantity,
  safeMultiply,
  FREE_SHIPPING_THRESHOLD,
  TIER_THRESHOLDS,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from '../src/public/cartService.js';
import wixStoresFrontend, { __reset, __setVariantsResponse, __triggerCartChanged, __setUpdateShouldFail } from './__mocks__/wix-stores-frontend.js';

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

// ── Validation Constants ─────────────────────────────────────────────

describe('validation constants', () => {
  it('MIN_QUANTITY is 1', () => {
    expect(MIN_QUANTITY).toBe(1);
  });

  it('MAX_QUANTITY is 99', () => {
    expect(MAX_QUANTITY).toBe(99);
  });
});

// ── clampQuantity ────────────────────────────────────────────────────

describe('clampQuantity', () => {
  it('returns the value for valid quantities', () => {
    expect(clampQuantity(5)).toBe(5);
    expect(clampQuantity(1)).toBe(1);
    expect(clampQuantity(99)).toBe(99);
    expect(clampQuantity(50)).toBe(50);
  });

  it('clamps 0 to MIN_QUANTITY', () => {
    expect(clampQuantity(0)).toBe(MIN_QUANTITY);
  });

  it('clamps negative numbers to MIN_QUANTITY', () => {
    expect(clampQuantity(-1)).toBe(MIN_QUANTITY);
    expect(clampQuantity(-100)).toBe(MIN_QUANTITY);
    expect(clampQuantity(-Infinity)).toBe(MIN_QUANTITY);
  });

  it('clamps values above MAX_QUANTITY to MAX_QUANTITY', () => {
    expect(clampQuantity(100)).toBe(MAX_QUANTITY);
    expect(clampQuantity(999)).toBe(MAX_QUANTITY);
    expect(clampQuantity(1000000)).toBe(MAX_QUANTITY);
  });

  it('handles NaN/undefined/null input', () => {
    expect(clampQuantity(NaN)).toBe(MIN_QUANTITY);
    expect(clampQuantity(undefined)).toBe(MIN_QUANTITY);
    expect(clampQuantity(null)).toBe(MIN_QUANTITY);
  });

  it('handles string input by parsing integers', () => {
    expect(clampQuantity('5')).toBe(5);
    expect(clampQuantity('0')).toBe(MIN_QUANTITY);
    expect(clampQuantity('-3')).toBe(MIN_QUANTITY);
    expect(clampQuantity('abc')).toBe(MIN_QUANTITY);
    expect(clampQuantity('99')).toBe(99);
    expect(clampQuantity('100')).toBe(MAX_QUANTITY);
  });

  it('truncates floats to integers', () => {
    expect(clampQuantity(3.7)).toBe(3);
    expect(clampQuantity(1.1)).toBe(1);
    expect(clampQuantity(99.9)).toBe(99);
  });

  it('handles Infinity', () => {
    expect(clampQuantity(Infinity)).toBe(MIN_QUANTITY);
    expect(clampQuantity(-Infinity)).toBe(MIN_QUANTITY);
  });
});

// ── safeMultiply ─────────────────────────────────────────────────────

describe('safeMultiply', () => {
  it('multiplies price * quantity correctly', () => {
    expect(safeMultiply(10, 3)).toBe(30);
    expect(safeMultiply(100, 1)).toBe(100);
  });

  it('rounds to 2 decimal places avoiding floating-point drift', () => {
    // 19.99 * 3 = 59.97 (not 59.96999...)
    expect(safeMultiply(19.99, 3)).toBe(59.97);
    // 0.1 + 0.2 type issue
    expect(safeMultiply(0.1, 3)).toBe(0.3);
    expect(safeMultiply(33.33, 3)).toBe(99.99);
  });

  it('handles zero price or quantity', () => {
    expect(safeMultiply(0, 5)).toBe(0);
    expect(safeMultiply(25.99, 0)).toBe(0);
    expect(safeMultiply(0, 0)).toBe(0);
  });

  it('handles null/undefined inputs', () => {
    expect(safeMultiply(null, 3)).toBe(0);
    expect(safeMultiply(10, null)).toBe(0);
    expect(safeMultiply(undefined, undefined)).toBe(0);
  });

  it('handles large values without overflow', () => {
    expect(safeMultiply(9999.99, 99)).toBe(989999.01);
  });
});

// ── Cart Operations ──────────────────────────────────────────────────

describe('addToCart', () => {
  it('calls wix-stores-frontend cart.addProducts with default quantity', async () => {
    const result = await addToCart('prod-1');
    expect(result).toEqual({ items: [{ productId: 'prod-1', quantity: 1 }] });
  });

  it('passes custom quantity', async () => {
    const result = await addToCart('prod-2', 3);
    expect(result.items[0].quantity).toBe(3);
  });

  it('clamps negative quantity to MIN_QUANTITY', async () => {
    const result = await addToCart('prod-3', -5);
    expect(result.items[0].quantity).toBe(MIN_QUANTITY);
  });

  it('clamps zero quantity to MIN_QUANTITY', async () => {
    const result = await addToCart('prod-4', 0);
    expect(result.items[0].quantity).toBe(MIN_QUANTITY);
  });

  it('clamps excessive quantity to MAX_QUANTITY', async () => {
    const result = await addToCart('prod-5', 1000);
    expect(result.items[0].quantity).toBe(MAX_QUANTITY);
  });

  it('clamps NaN quantity to MIN_QUANTITY', async () => {
    const result = await addToCart('prod-6', NaN);
    expect(result.items[0].quantity).toBe(MIN_QUANTITY);
  });
});

describe('updateCartItemQuantity', () => {
  it('updates quantity for a valid cart item', async () => {
    const result = await updateCartItemQuantity('item-1', 5);
    expect(result).toEqual({ cartItemId: 'item-1', quantity: 5 });
  });

  it('clamps negative quantity to MIN_QUANTITY', async () => {
    const result = await updateCartItemQuantity('item-1', -3);
    expect(result.quantity).toBe(MIN_QUANTITY);
  });

  it('clamps zero quantity to MIN_QUANTITY', async () => {
    const result = await updateCartItemQuantity('item-1', 0);
    expect(result.quantity).toBe(MIN_QUANTITY);
  });

  it('clamps excessive quantity to MAX_QUANTITY', async () => {
    const result = await updateCartItemQuantity('item-1', 500);
    expect(result.quantity).toBe(MAX_QUANTITY);
  });

  it('propagates API errors', async () => {
    __setUpdateShouldFail(true);
    await expect(updateCartItemQuantity('item-1', 5)).rejects.toThrow('Update failed');
  });
});

describe('removeCartItem', () => {
  it('removes a cart item', async () => {
    const result = await removeCartItem('item-1');
    expect(result).toEqual({ removed: 'item-1' });
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
