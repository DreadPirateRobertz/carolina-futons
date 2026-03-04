import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fireMetaViewContent,
  fireMetaAddToCart,
  fireMetaInitiateCheckout,
  fireMetaPurchase,
  fireMetaSearch,
  fireMetaCompleteRegistration,
  fireMetaAddToWishlist,
  fireMetaLead,
  buildEnhancedMatchParams,
} from '../src/public/metaPixel.js';

// ── fireMetaViewContent ─────────────────────────────────────────────

describe('fireMetaViewContent', () => {
  it('does not throw with valid product', async () => {
    await expect(fireMetaViewContent({
      _id: 'p1',
      name: 'Kodiak Futon Frame',
      price: 899,
      collections: ['futon-frames'],
    })).resolves.not.toThrow();
  });

  it('does not throw with null product', async () => {
    await expect(fireMetaViewContent(null)).resolves.not.toThrow();
  });

  it('does not throw with undefined', async () => {
    await expect(fireMetaViewContent(undefined)).resolves.not.toThrow();
  });

  it('does not throw with empty object', async () => {
    await expect(fireMetaViewContent({})).resolves.not.toThrow();
  });

  it('handles product without collections', async () => {
    await expect(fireMetaViewContent({
      _id: 'p1',
      name: 'Test',
      price: 100,
    })).resolves.not.toThrow();
  });

  it('handles zero price', async () => {
    await expect(fireMetaViewContent({
      _id: 'p1',
      name: 'Free Item',
      price: 0,
    })).resolves.not.toThrow();
  });

  it('handles negative price gracefully', async () => {
    await expect(fireMetaViewContent({
      _id: 'p1',
      name: 'Bad Price',
      price: -50,
    })).resolves.not.toThrow();
  });
});

// ── fireMetaAddToCart ───────────────────────────────────────────────

describe('fireMetaAddToCart', () => {
  it('does not throw with valid product and quantity', async () => {
    await expect(fireMetaAddToCart({
      _id: 'p1',
      name: 'Monterey Frame',
      price: 699,
    }, 2)).resolves.not.toThrow();
  });

  it('does not throw with null product', async () => {
    await expect(fireMetaAddToCart(null)).resolves.not.toThrow();
  });

  it('defaults quantity to 1', async () => {
    await expect(fireMetaAddToCart({
      _id: 'p1',
      name: 'Test',
      price: 100,
    })).resolves.not.toThrow();
  });

  it('handles zero quantity', async () => {
    await expect(fireMetaAddToCart({
      _id: 'p1',
      name: 'Test',
      price: 100,
    }, 0)).resolves.not.toThrow();
  });

  it('handles missing price', async () => {
    await expect(fireMetaAddToCart({
      _id: 'p1',
      name: 'No Price',
    })).resolves.not.toThrow();
  });
});

// ── fireMetaInitiateCheckout ────────────────────────────────────────

describe('fireMetaInitiateCheckout', () => {
  it('does not throw with cart items and total', async () => {
    await expect(fireMetaInitiateCheckout(
      [{ productId: 'p1', quantity: 1, price: 499 }, { productId: 'p2', quantity: 2, price: 299 }],
      1097
    )).resolves.not.toThrow();
  });

  it('does not throw with empty cart', async () => {
    await expect(fireMetaInitiateCheckout([], 0)).resolves.not.toThrow();
  });

  it('does not throw with null values', async () => {
    await expect(fireMetaInitiateCheckout(null, null)).resolves.not.toThrow();
  });

  it('handles items without productId', async () => {
    await expect(fireMetaInitiateCheckout(
      [{ _id: 'item1', quantity: 1 }],
      500
    )).resolves.not.toThrow();
  });
});

// ── fireMetaPurchase ────────────────────────────────────────────────

describe('fireMetaPurchase', () => {
  it('does not throw with valid order', async () => {
    await expect(fireMetaPurchase({
      _id: 'order-001',
      number: '10042',
      totals: { total: 877.99 },
      lineItems: [
        { productId: 'p1', name: 'Frame', price: 499, quantity: 1 },
      ],
    })).resolves.not.toThrow();
  });

  it('does not throw with null order', async () => {
    await expect(fireMetaPurchase(null)).resolves.not.toThrow();
  });

  it('does not throw with empty order', async () => {
    await expect(fireMetaPurchase({})).resolves.not.toThrow();
  });

  it('handles order without lineItems', async () => {
    await expect(fireMetaPurchase({
      _id: 'order-002',
      totals: { total: 100 },
    })).resolves.not.toThrow();
  });

  it('handles order without totals', async () => {
    await expect(fireMetaPurchase({
      _id: 'order-003',
      lineItems: [{ productId: 'p1', price: 100 }],
    })).resolves.not.toThrow();
  });
});

// ── fireMetaSearch ──────────────────────────────────────────────────

describe('fireMetaSearch', () => {
  it('does not throw with valid query', async () => {
    await expect(fireMetaSearch('futon frame', 12)).resolves.not.toThrow();
  });

  it('does not throw with empty query', async () => {
    await expect(fireMetaSearch('', 0)).resolves.not.toThrow();
  });

  it('does not throw with null values', async () => {
    await expect(fireMetaSearch(null, null)).resolves.not.toThrow();
  });

  it('sanitizes XSS in search query', async () => {
    await expect(fireMetaSearch('<script>alert(1)</script>', 0)).resolves.not.toThrow();
  });
});

// ── fireMetaCompleteRegistration ────────────────────────────────────

describe('fireMetaCompleteRegistration', () => {
  it('does not throw with valid data', async () => {
    await expect(fireMetaCompleteRegistration({
      method: 'email',
      content_name: 'Newsletter Signup',
    })).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireMetaCompleteRegistration(null)).resolves.not.toThrow();
  });

  it('does not throw with empty object', async () => {
    await expect(fireMetaCompleteRegistration({})).resolves.not.toThrow();
  });
});

// ── fireMetaAddToWishlist ───────────────────────────────────────────

describe('fireMetaAddToWishlist', () => {
  it('does not throw with valid product', async () => {
    await expect(fireMetaAddToWishlist({
      _id: 'p1',
      name: 'Test Product',
      price: 499,
    })).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireMetaAddToWishlist(null)).resolves.not.toThrow();
  });
});

// ── fireMetaLead ────────────────────────────────────────────────────

describe('fireMetaLead', () => {
  it('does not throw with valid data', async () => {
    await expect(fireMetaLead({
      content_name: 'Room Consultation',
      content_category: 'consultation',
      value: 0,
    })).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireMetaLead(null)).resolves.not.toThrow();
  });
});

// ── buildEnhancedMatchParams ────────────────────────────────────────

describe('buildEnhancedMatchParams', () => {
  it('returns empty object for null input', () => {
    expect(buildEnhancedMatchParams(null)).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(buildEnhancedMatchParams(undefined)).toEqual({});
  });

  it('returns empty object for empty object', () => {
    expect(buildEnhancedMatchParams({})).toEqual({});
  });

  it('lowercases and trims email', () => {
    const result = buildEnhancedMatchParams({ email: '  Jane@Example.COM  ' });
    expect(result.em).toBe('jane@example.com');
  });

  it('normalizes phone to digits only', () => {
    const result = buildEnhancedMatchParams({ phone: '(828) 555-1234' });
    expect(result.ph).toBe('8285551234');
  });

  it('lowercases and trims first name', () => {
    const result = buildEnhancedMatchParams({ firstName: ' Jane ' });
    expect(result.fn).toBe('jane');
  });

  it('lowercases and trims last name', () => {
    const result = buildEnhancedMatchParams({ lastName: ' Smith ' });
    expect(result.ln).toBe('smith');
  });

  it('handles city', () => {
    const result = buildEnhancedMatchParams({ city: 'Asheville' });
    expect(result.ct).toBe('asheville');
  });

  it('handles state', () => {
    const result = buildEnhancedMatchParams({ state: 'NC' });
    expect(result.st).toBe('nc');
  });

  it('handles zip code', () => {
    const result = buildEnhancedMatchParams({ zip: '28801' });
    expect(result.zp).toBe('28801');
  });

  it('skips empty string values', () => {
    const result = buildEnhancedMatchParams({ email: '', phone: '' });
    expect(result).toEqual({});
  });

  it('combines multiple fields', () => {
    const result = buildEnhancedMatchParams({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '8285551234',
    });
    expect(result.em).toBe('jane@example.com');
    expect(result.fn).toBe('jane');
    expect(result.ln).toBe('smith');
    expect(result.ph).toBe('8285551234');
  });

  it('ignores unknown fields', () => {
    const result = buildEnhancedMatchParams({ ssn: '123-45-6789', email: 'a@b.com' });
    expect(result).toEqual({ em: 'a@b.com' });
    expect(result.ssn).toBeUndefined();
  });

  it('handles non-string inputs gracefully', () => {
    const result = buildEnhancedMatchParams({ email: 12345, phone: true });
    expect(result).toEqual({});
  });
});
