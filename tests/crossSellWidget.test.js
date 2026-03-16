import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildRoomBundles,
  calculateBundleSavings,
  getRoomContext,
  getCrossWidgetStyles,
  initCrossSellWidget,
  BUNDLE_DISCOUNT_RATE,
} from '../src/public/crossSellWidget.js';

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

  it('returns empty array for non-array input', () => {
    expect(buildRoomBundles('not-array', 0)).toEqual([]);
    expect(buildRoomBundles(123, 0)).toEqual([]);
  });

  it('handles products without collections', () => {
    const suggestions = [{
      heading: 'Add',
      products: [{ _id: 'p1', name: 'Thing', price: 100, formattedPrice: '$100.00', mainMedia: '' }],
    }];
    const bundles = buildRoomBundles(suggestions, 200);
    expect(bundles[0].roomContext).toBe('living-room');
  });

  it('handles products with empty price (defaults to 0)', () => {
    const suggestions = [{
      heading: 'Free stuff',
      products: [{ _id: 'p1', name: 'Free', formattedPrice: '$0.00', mainMedia: '', collections: [] }],
    }];
    const bundles = buildRoomBundles(suggestions, 500);
    expect(bundles[0].originalTotal).toBe(500);
  });
});

// ── getCrossWidgetStyles ────────────────────────────────────────────

describe('getCrossWidgetStyles', () => {
  it('returns all expected style properties', () => {
    const styles = getCrossWidgetStyles();
    expect(styles).toHaveProperty('sectionBackground');
    expect(styles).toHaveProperty('headingColor');
    expect(styles).toHaveProperty('subheadingColor');
    expect(styles).toHaveProperty('savingsBadgeBackground');
    expect(styles).toHaveProperty('savingsBadgeText');
    expect(styles).toHaveProperty('cardBackground');
    expect(styles).toHaveProperty('nameColor');
    expect(styles).toHaveProperty('priceColor');
    expect(styles).toHaveProperty('addBtnBackground');
    expect(styles).toHaveProperty('addBtnText');
    expect(styles).toHaveProperty('addedColor');
    expect(styles).toHaveProperty('bundlePriceColor');
    expect(styles).toHaveProperty('originalPriceColor');
  });

  it('returns string values for all properties', () => {
    const styles = getCrossWidgetStyles();
    for (const value of Object.values(styles)) {
      expect(typeof value).toBe('string');
    }
  });
});

// ── initCrossSellWidget ─────────────────────────────────────────────

describe('initCrossSellWidget', () => {
  const elements = {
    section: '#csSection',
    heading: '#csHeading',
    subheading: '#csSubheading',
    savingsBadge: '#csSavings',
    repeater: '#csRepeater',
    bundlePrice: '#csBundlePrice',
    originalPrice: '#csOriginalPrice',
  };

  const cardElements = {
    image: '#csImage',
    name: '#csName',
    price: '#csPrice',
    addBtn: '#csAddBtn',
  };

  function mock$w() {
    const store = {};
    const $w = (selector) => {
      if (!store[selector]) {
        store[selector] = {
          id: selector, text: '', style: {},
          expand: vi.fn(), collapse: vi.fn(), show: vi.fn(), hide: vi.fn(),
          onClick: vi.fn(), onItemReady: vi.fn(),
          data: null, src: '', alt: '',
          accessibility: {},
          disable: vi.fn(), enable: vi.fn(), label: '',
        };
      }
      return store[selector];
    };
    $w._store = store;
    return $w;
  }

  it('collapses section when no bundles provided', () => {
    const $w = mock$w();
    initCrossSellWidget($w, { bundles: [], addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });
    expect($w._store['#csSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when bundles is null', () => {
    const $w = mock$w();
    initCrossSellWidget($w, { bundles: null, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });
    expect($w._store['#csSection'].collapse).toHaveBeenCalled();
  });

  it('expands section and sets heading/subheading from first bundle', () => {
    const $w = mock$w();
    const bundles = [{
      heading: 'Complete the Room',
      subheading: 'Add a Mattress',
      formattedSavings: '$42.40',
      formattedBundlePrice: '$805.60',
      originalTotal: 848,
      savings: 42.4,
      products: [{ _id: 'p1', name: 'Mattress', formattedPrice: '$349.00', mainMedia: 'img.jpg' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });
    expect($w._store['#csSection'].expand).toHaveBeenCalled();
    expect($w._store['#csHeading'].text).toBe('Complete the Room');
    expect($w._store['#csSubheading'].text).toBe('Add a Mattress');
  });

  it('sets savings badge text and shows it', () => {
    const $w = mock$w();
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$10.00', formattedBundlePrice: '$190.00',
      originalTotal: 200, savings: 10,
      products: [{ _id: 'p1', name: 'P', formattedPrice: '$100', mainMedia: '' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });
    expect($w._store['#csSavings'].text).toBe('Save $10.00');
    expect($w._store['#csSavings'].show).toHaveBeenCalled();
  });

  it('sets bundle price and original price', () => {
    const $w = mock$w();
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$10.00', formattedBundlePrice: '$190.00',
      originalTotal: 200, savings: 10,
      products: [{ _id: 'p1', name: 'P', formattedPrice: '$100', mainMedia: '' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });
    expect($w._store['#csBundlePrice'].text).toBe('$190.00');
  });

  it('registers onItemReady handler on the repeater', () => {
    const $w = mock$w();
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$5.00', formattedBundlePrice: '$95.00',
      originalTotal: 100, savings: 5,
      products: [{ _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: 'img.jpg' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });
    expect($w._store['#csRepeater'].onItemReady).toHaveBeenCalled();
  });

  it('sets repeater data to bundle products', () => {
    const $w = mock$w();
    const products = [
      { _id: 'p1', name: 'A', formattedPrice: '$100', mainMedia: 'a.jpg' },
      { _id: 'p2', name: 'B', formattedPrice: '$200', mainMedia: 'b.jpg' },
    ];
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$15.00', formattedBundlePrice: '$285.00',
      originalTotal: 300, savings: 15,
      products,
    }];
    initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });
    expect($w._store['#csRepeater'].data).toHaveLength(2);
  });

  it('onItemReady sets product image, name, and price', () => {
    const $w = mock$w();
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$5.00', formattedBundlePrice: '$95.00',
      originalTotal: 100, savings: 5,
      products: [{ _id: 'p1', name: 'Mattress', formattedPrice: '$349.00', mainMedia: 'mat.jpg' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });

    // Simulate onItemReady callback
    const onItemReadyFn = $w._store['#csRepeater'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    const product = { _id: 'p1', name: 'Mattress', formattedPrice: '$349.00', mainMedia: 'mat.jpg' };
    onItemReadyFn($item, product);

    expect($item._store['#csImage'].src).toBe('mat.jpg');
    expect($item._store['#csImage'].alt).toContain('Mattress');
    expect($item._store['#csName'].text).toBe('Mattress');
    expect($item._store['#csPrice'].text).toBe('$349.00');
  });

  it('onItemReady registers add-to-cart button click handler', () => {
    const $w = mock$w();
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$5.00', formattedBundlePrice: '$95.00',
      originalTotal: 100, savings: 5,
      products: [{ _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements });

    const onItemReadyFn = $w._store['#csRepeater'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    onItemReadyFn($item, { _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' });
    expect($item._store['#csAddBtn'].onClick).toHaveBeenCalled();
  });

  it('add-to-cart click calls addToCart and shows Added! on success', async () => {
    const $w = mock$w();
    const addToCart = vi.fn().mockResolvedValue(undefined);
    const announce = vi.fn();
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$5.00', formattedBundlePrice: '$95.00',
      originalTotal: 100, savings: 5,
      products: [{ _id: 'p1', name: 'Widget', formattedPrice: '$50', mainMedia: '' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart, announce, elements, cardElements });

    const onItemReadyFn = $w._store['#csRepeater'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    onItemReadyFn($item, { _id: 'p1', name: 'Widget', formattedPrice: '$50', mainMedia: '' });

    const clickHandler = $item._store['#csAddBtn'].onClick.mock.calls[0][0];
    await clickHandler();

    expect(addToCart).toHaveBeenCalledWith('p1');
    expect($item._store['#csAddBtn'].label).toBe('Added!');
    expect(announce).toHaveBeenCalledWith($w, 'Widget added to cart');
  });

  it('add-to-cart click shows Error on failure', async () => {
    const $w = mock$w();
    const addToCart = vi.fn().mockRejectedValue(new Error('cart fail'));
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$5.00', formattedBundlePrice: '$95.00',
      originalTotal: 100, savings: 5,
      products: [{ _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart, announce: vi.fn(), elements, cardElements });

    const onItemReadyFn = $w._store['#csRepeater'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    onItemReadyFn($item, { _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' });

    const clickHandler = $item._store['#csAddBtn'].onClick.mock.calls[0][0];
    await clickHandler();

    expect($item._store['#csAddBtn'].label).toBe('Error');
    expect($item._store['#csAddBtn'].enable).toHaveBeenCalled();
  });

  it('calls onProductClick when image clicked', () => {
    const $w = mock$w();
    const onProductClick = vi.fn();
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$5.00', formattedBundlePrice: '$95.00',
      originalTotal: 100, savings: 5,
      products: [{ _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements, onProductClick });

    const onItemReadyFn = $w._store['#csRepeater'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    const product = { _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' };
    onItemReadyFn($item, product);

    // Image click handler
    const imgClickHandler = $item._store['#csImage'].onClick.mock.calls[0][0];
    imgClickHandler();
    expect(onProductClick).toHaveBeenCalledWith(product);

    // Name click handler
    const nameClickHandler = $item._store['#csName'].onClick.mock.calls[0][0];
    nameClickHandler();
    expect(onProductClick).toHaveBeenCalledTimes(2);
  });

  it('calls onAdded callback after successful add', async () => {
    const $w = mock$w();
    const onAdded = vi.fn();
    const addToCart = vi.fn().mockResolvedValue(undefined);
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$5.00', formattedBundlePrice: '$95.00',
      originalTotal: 100, savings: 5,
      products: [{ _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' }],
    }];
    initCrossSellWidget($w, { bundles, addToCart, announce: vi.fn(), elements, cardElements, onAdded });

    const onItemReadyFn = $w._store['#csRepeater'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    const product = { _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' };
    onItemReadyFn($item, product);

    const clickHandler = $item._store['#csAddBtn'].onClick.mock.calls[0][0];
    await clickHandler();

    expect(onAdded).toHaveBeenCalledWith(product);
  });

  it('returns early when repeater element is null', () => {
    const $w = (selector) => {
      if (selector === '#csRepeater') return null;
      return {
        id: selector, text: '', style: {},
        expand: vi.fn(), collapse: vi.fn(), show: vi.fn(),
      };
    };
    const bundles = [{
      heading: 'H', subheading: 'S',
      formattedSavings: '$5.00', formattedBundlePrice: '$95.00',
      originalTotal: 100, savings: 5,
      products: [{ _id: 'p1', name: 'P', formattedPrice: '$50', mainMedia: '' }],
    }];
    expect(() => initCrossSellWidget($w, { bundles, addToCart: vi.fn(), announce: vi.fn(), elements, cardElements })).not.toThrow();
  });
});
