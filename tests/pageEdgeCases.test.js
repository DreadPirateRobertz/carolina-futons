import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── validators.js Tests ──────────────────────────────────────────────

import { validateEmail, validateDimension } from '../src/public/validators.js';

describe('validators', () => {
  describe('validateEmail', () => {
    it('accepts valid emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('first.last@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@gmail.com')).toBe(true);
      expect(validateEmail('name@sub.domain.org')).toBe(true);
    });

    it('rejects emails without domain extension', () => {
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user@domain')).toBe(false);
    });

    it('rejects emails without @', () => {
      expect(validateEmail('userdomain.com')).toBe(false);
    });

    it('rejects empty and non-string inputs', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
      expect(validateEmail(123)).toBe(false);
    });

    it('rejects emails with spaces', () => {
      expect(validateEmail('user @example.com')).toBe(false);
      expect(validateEmail('user@ example.com')).toBe(false);
    });

    it('rejects emails with angle brackets (XSS vector)', () => {
      expect(validateEmail('<script>@evil.com')).toBe(false);
      expect(validateEmail('user@<script>.com')).toBe(false);
    });

    it('trims whitespace before validating', () => {
      expect(validateEmail('  user@example.com  ')).toBe(true);
    });

    it('rejects multiple @ symbols', () => {
      expect(validateEmail('user@@example.com')).toBe(false);
    });
  });

  describe('validateDimension', () => {
    it('accepts valid positive dimensions', () => {
      expect(validateDimension(36)).toBe(true);
      expect(validateDimension(72.5)).toBe(true);
      expect(validateDimension(1)).toBe(true);
      expect(validateDimension(600)).toBe(true);
    });

    it('rejects zero', () => {
      expect(validateDimension(0)).toBe(false);
    });

    it('rejects negative values', () => {
      expect(validateDimension(-1)).toBe(false);
      expect(validateDimension(-100)).toBe(false);
    });

    it('rejects values above max', () => {
      expect(validateDimension(601)).toBe(false);
      expect(validateDimension(1000)).toBe(false);
    });

    it('rejects NaN and non-number inputs', () => {
      expect(validateDimension(NaN)).toBe(false);
      expect(validateDimension(undefined)).toBe(false);
      expect(validateDimension(null)).toBe(false);
      expect(validateDimension('36')).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(validateDimension(Infinity)).toBe(false);
      expect(validateDimension(-Infinity)).toBe(false);
    });

    it('uses custom min/max when provided', () => {
      // Doorway width: 1-120 inches
      expect(validateDimension(120, 1, 120)).toBe(true);
      expect(validateDimension(121, 1, 120)).toBe(false);
      expect(validateDimension(0.5, 1, 120)).toBe(false);
    });

    it('accepts boundary values exactly at min and max', () => {
      expect(validateDimension(1, 1, 600)).toBe(true);
      expect(validateDimension(600, 1, 600)).toBe(true);
    });
  });
});

// ── cartService null lineItems Tests ────────────────────────────────

vi.mock('wix-stores-frontend', () => {
  let cartData = null;
  return {
    default: {
      cart: {
        getCurrentCart: vi.fn(() => Promise.resolve(cartData)),
        addProducts: vi.fn(() => Promise.resolve({})),
        updateLineItemQuantity: vi.fn(() => Promise.resolve({})),
        removeProduct: vi.fn(() => Promise.resolve({})),
      },
      getProductVariants: vi.fn(() => Promise.resolve([])),
      onCartChanged: vi.fn(),
    },
    __setCartData: (data) => { cartData = data; },
  };
});

import { getCartItemCount } from '../src/public/cartService.js';
import { __setCartData } from 'wix-stores-frontend';

describe('cartService edge cases', () => {
  describe('getCartItemCount', () => {
    it('returns 0 when cart is null', async () => {
      __setCartData(null);
      expect(await getCartItemCount()).toBe(0);
    });

    it('returns 0 when lineItems is null', async () => {
      __setCartData({ totals: { subtotal: 100 }, lineItems: null });
      expect(await getCartItemCount()).toBe(0);
    });

    it('returns 0 when lineItems is undefined', async () => {
      __setCartData({ totals: { subtotal: 100 } });
      expect(await getCartItemCount()).toBe(0);
    });

    it('returns 0 when lineItems is empty array', async () => {
      __setCartData({ lineItems: [] });
      expect(await getCartItemCount()).toBe(0);
    });

    it('sums quantities correctly', async () => {
      __setCartData({ lineItems: [{ quantity: 2 }, { quantity: 3 }] });
      expect(await getCartItemCount()).toBe(5);
    });

    it('handles items with missing quantity as 0', async () => {
      __setCartData({ lineItems: [{ quantity: 2 }, { name: 'no-qty' }] });
      expect(await getCartItemCount()).toBe(2);
    });

    it('returns 0 when lineItems is not an array (string)', async () => {
      __setCartData({ lineItems: 'not-an-array' });
      expect(await getCartItemCount()).toBe(0);
    });

    it('returns 0 when lineItems is a number', async () => {
      __setCartData({ lineItems: 42 });
      expect(await getCartItemCount()).toBe(0);
    });
  });
});

// ── productCache staleness Tests ────────────────────────────────────

vi.mock('wix-storage-frontend', () => {
  const store = {};
  return {
    local: {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, val) => { store[key] = val; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
    },
    __store: store,
    __clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
});

import { cacheProduct, getCachedProduct, clearCache } from '../src/public/productCache.js';
import { __clear as clearStorage } from 'wix-storage-frontend';

describe('productCache staleness', () => {
  beforeEach(() => {
    clearStorage();
    clearCache();
  });

  it('returns _cachedAt timestamp with cached product', () => {
    const product = {
      _id: 'p1', name: 'Test Futon', slug: 'test-futon',
      price: 499, formattedPrice: '$499.00', mainMedia: 'img.jpg',
    };
    cacheProduct(product);
    const cached = getCachedProduct('test-futon');
    expect(cached).not.toBeNull();
    expect(cached._cachedAt).toBeDefined();
    expect(typeof cached._cachedAt).toBe('number');
    expect(cached._cachedAt).toBeLessThanOrEqual(Date.now());
    expect(cached._cachedAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('returns null for non-existent slug', () => {
    expect(getCachedProduct('nonexistent')).toBeNull();
  });

  it('returns null for empty slug', () => {
    expect(getCachedProduct('')).toBeNull();
    expect(getCachedProduct(null)).toBeNull();
  });
});

// ── AddToCart popularity badge edge cases ────────────────────────────

describe('AddToCart popularity badge safety', () => {
  it('Number(0) is falsy — badge hides when weekSales is 0', () => {
    const weekSales = 0;
    const safeWeekSales = Number(weekSales);
    // The condition: weekSales > 0 && isFinite(weekSales)
    expect(safeWeekSales > 0 && isFinite(safeWeekSales)).toBe(false);
  });

  it('handles weekSales as undefined gracefully', () => {
    const weekSales = undefined;
    const safeWeekSales = Number(weekSales);
    expect(safeWeekSales > 0 && isFinite(safeWeekSales)).toBe(false);
  });

  it('handles weekSales as null gracefully', () => {
    const weekSales = null;
    const safeWeekSales = Number(weekSales);
    expect(safeWeekSales > 0 && isFinite(safeWeekSales)).toBe(false);
  });

  it('handles weekSales as NaN gracefully', () => {
    const weekSales = NaN;
    const safeWeekSales = Number(weekSales);
    expect(safeWeekSales > 0 && isFinite(safeWeekSales)).toBe(false);
  });

  it('handles weekSales as string number', () => {
    const weekSales = '5';
    const safeWeekSales = Number(weekSales);
    expect(safeWeekSales > 0 && isFinite(safeWeekSales)).toBe(true);
  });

  it('handles weekSales as Infinity', () => {
    const weekSales = Infinity;
    const safeWeekSales = Number(weekSales);
    expect(safeWeekSales > 0 && isFinite(safeWeekSales)).toBe(false);
  });
});

// ── Checkout lineItems edge cases ───────────────────────────────────

describe('Checkout lineItems safety', () => {
  it('Array.isArray guards against null lineItems', () => {
    const cart = { totals: { subtotal: 500 }, lineItems: null };
    const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
    const itemCount = lineItems.reduce((s, i) => s + (i.quantity || 0), 0);
    expect(itemCount).toBe(0);
  });

  it('Array.isArray guards against undefined lineItems', () => {
    const cart = { totals: { subtotal: 500 } };
    const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
    const itemCount = lineItems.reduce((s, i) => s + (i.quantity || 0), 0);
    expect(itemCount).toBe(0);
  });

  it('handles lineItems with missing quantity', () => {
    const cart = { totals: { subtotal: 500 }, lineItems: [{ name: 'Futon' }, { name: 'Pillow', quantity: 2 }] };
    const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
    const itemCount = lineItems.reduce((s, i) => s + (i.quantity || 0), 0);
    expect(itemCount).toBe(2);
  });

  it('handles empty lineItems array', () => {
    const cart = { totals: { subtotal: 0 }, lineItems: [] };
    const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
    const itemCount = lineItems.reduce((s, i) => s + (i.quantity || 0), 0);
    expect(itemCount).toBe(0);
  });

  it('handles lineItems as non-array type', () => {
    const cart = { totals: { subtotal: 500 }, lineItems: 'corrupted' };
    const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
    expect(lineItems).toEqual([]);
  });
});

// ── Side Cart lineItems guard ───────────────────────────────────────

describe('Side Cart lineItems guard', () => {
  it('Array.isArray(null) returns false', () => {
    expect(Array.isArray(null)).toBe(false);
  });

  it('Array.isArray(undefined) returns false', () => {
    expect(Array.isArray(undefined)).toBe(false);
  });

  it('Array.isArray([]) returns true', () => {
    expect(Array.isArray([])).toBe(true);
  });

  it('handles cart with no lineItems property', () => {
    const cart = { totals: { subtotal: 100 } };
    const isEmpty = !cart || !Array.isArray(cart.lineItems) || cart.lineItems.length === 0;
    expect(isEmpty).toBe(true);
  });

  it('handles cart with null lineItems', () => {
    const cart = { lineItems: null };
    const isEmpty = !cart || !Array.isArray(cart.lineItems) || cart.lineItems.length === 0;
    expect(isEmpty).toBe(true);
  });

  it('treats empty array as empty cart', () => {
    const cart = { lineItems: [] };
    const isEmpty = !cart || !Array.isArray(cart.lineItems) || cart.lineItems.length === 0;
    expect(isEmpty).toBe(true);
  });

  it('does not treat populated cart as empty', () => {
    const cart = { lineItems: [{ _id: '1', name: 'Futon', quantity: 1 }] };
    const isEmpty = !cart || !Array.isArray(cart.lineItems) || cart.lineItems.length === 0;
    expect(isEmpty).toBe(false);
  });
});

// ── Room Dimension Validation Integration ───────────────────────────

describe('Room dimension validation (integration)', () => {
  it('rejects doorway width of 0', () => {
    expect(validateDimension(0, 1, 120)).toBe(false);
  });

  it('rejects negative doorway height', () => {
    expect(validateDimension(-5, 1, 120)).toBe(false);
  });

  it('accepts typical doorway: 36 x 80 inches', () => {
    expect(validateDimension(36, 1, 120)).toBe(true);
    expect(validateDimension(80, 1, 120)).toBe(true);
  });

  it('rejects unrealistic doorway: 200 inches wide', () => {
    expect(validateDimension(200, 1, 120)).toBe(false);
  });

  it('accepts typical hallway width: 42 inches', () => {
    expect(validateDimension(42, 1, 240)).toBe(true);
  });

  it('rejects hallway width above max', () => {
    expect(validateDimension(241, 1, 240)).toBe(false);
  });

  it('accepts typical room: 144 x 168 inches (12x14 ft)', () => {
    expect(validateDimension(144, 1, 600)).toBe(true);
    expect(validateDimension(168, 1, 600)).toBe(true);
  });

  it('rejects parseFloat edge case: NaN from empty string', () => {
    const val = parseFloat('');
    expect(validateDimension(val, 1, 120)).toBe(false);
  });

  it('rejects parseFloat edge case: NaN from text', () => {
    const val = parseFloat('abc');
    expect(validateDimension(val, 1, 120)).toBe(false);
  });

  it('handles parseFloat partial parse (e.g. "36abc" → 36)', () => {
    const val = parseFloat('36abc');
    expect(validateDimension(val, 1, 120)).toBe(true);
  });
});
