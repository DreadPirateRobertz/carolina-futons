import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildRoomBundles,
  calculateBundleSavings,
  getRoomContext,
  BUNDLE_DISCOUNT_RATE,
} from '../../src/public/crossSellWidget.js';

// ── Constants ────────────────────────────────────────────────────────

describe('crossSellWidget constants', () => {
  it('exports BUNDLE_DISCOUNT_RATE as 0.05 (5%)', () => {
    expect(BUNDLE_DISCOUNT_RATE).toBe(0.05);
  });
});

// ── getRoomContext ──────────────────────────────────────────────────

describe('getRoomContext', () => {
  it('returns "living-room" for futon frame collections', () => {
    expect(getRoomContext(['futon-frames'])).toBe('living-room');
  });

  it('returns "living-room" for wall-hugger collections', () => {
    expect(getRoomContext(['wall-huggers'])).toBe('living-room');
  });

  it('returns "living-room" for unfinished-wood collections', () => {
    expect(getRoomContext(['unfinished-wood'])).toBe('living-room');
  });

  it('returns "bedroom" for murphy-cabinet-beds', () => {
    expect(getRoomContext(['murphy-cabinet-beds'])).toBe('bedroom');
  });

  it('returns "bedroom" for platform-beds', () => {
    expect(getRoomContext(['platform-beds'])).toBe('bedroom');
  });

  it('returns "bedroom" for casegoods-accessories', () => {
    expect(getRoomContext(['casegoods-accessories'])).toBe('bedroom');
  });

  it('returns "living-room" for mattresses (default room)', () => {
    expect(getRoomContext(['mattresses'])).toBe('living-room');
  });

  it('returns "living-room" for empty collections', () => {
    expect(getRoomContext([])).toBe('living-room');
  });

  it('returns "living-room" for null/undefined', () => {
    expect(getRoomContext(null)).toBe('living-room');
    expect(getRoomContext(undefined)).toBe('living-room');
  });

  it('returns first matched room when multiple collections span rooms', () => {
    // futon-frames maps to living-room, checked first
    expect(getRoomContext(['platform-beds', 'futon-frames'])).toBe('living-room');
  });
});

// ── calculateBundleSavings ──────────────────────────────────────────

describe('calculateBundleSavings', () => {
  it('calculates 5% savings on combined cart + suggestion price', () => {
    const result = calculateBundleSavings(500, 300);
    expect(result.originalTotal).toBe(800);
    expect(result.savings).toBeCloseTo(40); // 800 * 0.05
    expect(result.bundlePrice).toBeCloseTo(760);
  });

  it('returns zero savings for zero prices', () => {
    const result = calculateBundleSavings(0, 0);
    expect(result.originalTotal).toBe(0);
    expect(result.savings).toBe(0);
    expect(result.bundlePrice).toBe(0);
  });

  it('handles suggestion price of zero', () => {
    const result = calculateBundleSavings(500, 0);
    expect(result.originalTotal).toBe(500);
    expect(result.savings).toBeCloseTo(25);
    expect(result.bundlePrice).toBeCloseTo(475);
  });

  it('handles negative prices by treating as zero', () => {
    const result = calculateBundleSavings(-100, 200);
    expect(result.originalTotal).toBe(200);
    expect(result.savings).toBeCloseTo(10);
    expect(result.bundlePrice).toBeCloseTo(190);
  });

  it('rounds savings to 2 decimal places', () => {
    // 333 * 0.05 = 16.65
    const result = calculateBundleSavings(100, 233);
    expect(result.savings).toBe(Math.round(333 * 0.05 * 100) / 100);
  });
});

// ── buildRoomBundles ────────────────────────────────────────────────

describe('buildRoomBundles', () => {
  it('returns empty array for empty suggestions', () => {
    expect(buildRoomBundles([], 0)).toEqual([]);
  });

  it('returns empty array for null suggestions', () => {
    expect(buildRoomBundles(null, 0)).toEqual([]);
  });

  it('builds bundles from suggestion groups with room-aware headings', () => {
    const suggestions = [
      {
        heading: 'Complete Your Futon — Add a Mattress',
        products: [
          {
            _id: 'p1',
            name: 'Moonshadow Mattress',
            price: 349,
            formattedPrice: '$349.00',
            mainMedia: 'https://example.com/moon.jpg',
            slug: 'moonshadow',
            collections: ['mattresses'],
          },
        ],
      },
    ];

    const bundles = buildRoomBundles(suggestions, 499);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].roomContext).toBe('living-room');
    expect(bundles[0].heading).toBe('Complete the Room');
    expect(bundles[0].subheading).toContain('Mattress');
    expect(bundles[0].products).toHaveLength(1);
    expect(bundles[0].savings).toBeGreaterThan(0);
    expect(bundles[0].bundlePrice).toBeLessThan(bundles[0].originalTotal);
  });

  it('calculates savings based on cart subtotal + suggestion total', () => {
    const suggestions = [
      {
        heading: 'Complete the Bedroom',
        products: [
          { _id: 'p1', name: 'Nightstand', price: 199, formattedPrice: '$199.00', mainMedia: '', slug: 'ns', collections: ['casegoods-accessories'] },
          { _id: 'p2', name: 'Dresser', price: 399, formattedPrice: '$399.00', mainMedia: '', slug: 'dr', collections: ['casegoods-accessories'] },
        ],
      },
    ];

    const cartSubtotal = 1899;
    const bundles = buildRoomBundles(suggestions, cartSubtotal);
    expect(bundles).toHaveLength(1);

    // Savings calculated on cart subtotal + total suggestion prices
    const suggestionTotal = 199 + 399;
    const combinedTotal = cartSubtotal + suggestionTotal;
    expect(bundles[0].originalTotal).toBe(combinedTotal);
    expect(bundles[0].savings).toBeCloseTo(combinedTotal * 0.05, 1);
  });

  it('handles multiple suggestion groups', () => {
    const suggestions = [
      {
        heading: 'Add a Mattress',
        products: [{ _id: 'p1', name: 'Mattress', price: 349, formattedPrice: '$349.00', mainMedia: '', slug: 'm', collections: ['mattresses'] }],
      },
      {
        heading: 'Add Matching Furniture',
        products: [{ _id: 'p2', name: 'Nightstand', price: 199, formattedPrice: '$199.00', mainMedia: '', slug: 'n', collections: ['casegoods-accessories'] }],
      },
    ];

    const bundles = buildRoomBundles(suggestions, 499);
    expect(bundles).toHaveLength(2);
  });

  it('skips suggestion groups with no products', () => {
    const suggestions = [
      { heading: 'Empty Group', products: [] },
      {
        heading: 'Real Group',
        products: [{ _id: 'p1', name: 'Product', price: 100, formattedPrice: '$100.00', mainMedia: '', slug: 'p', collections: ['mattresses'] }],
      },
    ];

    const bundles = buildRoomBundles(suggestions, 499);
    expect(bundles).toHaveLength(1);
  });

  it('formats savings as currency string', () => {
    const suggestions = [
      {
        heading: 'Complete Your Futon',
        products: [{ _id: 'p1', name: 'Mattress', price: 349, formattedPrice: '$349.00', mainMedia: '', slug: 'm', collections: ['mattresses'] }],
      },
    ];

    const bundles = buildRoomBundles(suggestions, 499);
    expect(bundles[0].formattedSavings).toMatch(/^\$\d+\.\d{2}$/);
    expect(bundles[0].formattedBundlePrice).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  it('uses original suggestion heading as subheading', () => {
    const suggestions = [
      {
        heading: 'Complete Your Futon — Add a Mattress',
        products: [{ _id: 'p1', name: 'M', price: 100, formattedPrice: '$100', mainMedia: '', slug: 'm', collections: ['mattresses'] }],
      },
    ];

    const bundles = buildRoomBundles(suggestions, 500);
    expect(bundles[0].subheading).toBe('Complete Your Futon — Add a Mattress');
  });

  it('determines room context from suggestion product collections', () => {
    const bedroomSuggestions = [
      {
        heading: 'Add Matching Furniture',
        products: [{ _id: 'p1', name: 'Dresser', price: 399, formattedPrice: '$399.00', mainMedia: '', slug: 'd', collections: ['casegoods-accessories'] }],
      },
    ];

    const bundles = buildRoomBundles(bedroomSuggestions, 1899);
    expect(bundles[0].roomContext).toBe('bedroom');
    expect(bundles[0].heading).toBe('Complete the Room');
  });
});
