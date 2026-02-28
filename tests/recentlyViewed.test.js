/**
 * Tests for recentlyViewed.js — Shared recently viewed carousel
 * and "Customers Also Bought" cross-sell section.
 *
 * CF-78g2: Recently viewed + personalized recommendations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('public/productCache', () => ({
  getRecentlyViewed: vi.fn(() => []),
  cacheProduct: vi.fn(),
}));

vi.mock('backend/productRecommendations.web', () => ({
  getSimilarProducts: vi.fn().mockResolvedValue({ success: true, products: [] }),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

import {
  initRecentlyViewedCarousel,
  initAlsoBoughtSection,
  trackProductView,
  getViewHistory,
  clearViewHistory,
} from '../src/public/recentlyViewed.js';

import { getRecentlyViewed, cacheProduct } from 'public/productCache';
import { getSimilarProducts } from 'backend/productRecommendations.web';
import { makeClickable } from 'public/a11yHelpers.js';

// ── $w mock ──────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement(id) {
  return {
    _id: id,
    text: '',
    src: '',
    alt: '',
    html: '',
    data: [],
    hidden: false,
    collapsed: false,
    accessibility: { ariaLabel: '', role: undefined },
    show: vi.fn(function () { this.hidden = false; return Promise.resolve(); }),
    hide: vi.fn(function () { this.hidden = true; return Promise.resolve(); }),
    expand: vi.fn(function () { this.collapsed = false; }),
    collapse: vi.fn(function () { this.collapsed = true; }),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
  };
}

function $w(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement(sel));
  return elements.get(sel);
}

// ── Test Data ────────────────────────────────────────────────────────

const mockProducts = [
  { _id: 'p1', name: 'Oak Futon Frame', slug: 'oak-futon-frame', price: 499, formattedPrice: '$499.00', mainMedia: '/oak.jpg' },
  { _id: 'p2', name: 'Cotton Mattress', slug: 'cotton-mattress', price: 299, formattedPrice: '$299.00', mainMedia: '/cotton.jpg' },
  { _id: 'p3', name: 'Pine Frame', slug: 'pine-frame', price: 399, formattedPrice: '$399.00', mainMedia: '/pine.jpg' },
  { _id: 'p4', name: 'Wool Mattress', slug: 'wool-mattress', price: 349, formattedPrice: '$349.00', mainMedia: '/wool.jpg' },
];

const mockSimilar = [
  { _id: 's1', name: 'Maple Frame', slug: 'maple-frame', price: 549, formattedPrice: '$549.00', mainMedia: '/maple.jpg' },
  { _id: 's2', name: 'Cherry Frame', slug: 'cherry-frame', price: 599, formattedPrice: '$599.00', mainMedia: '/cherry.jpg' },
];

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  globalThis.sessionStorage.clear();
});

// ── trackProductView ─────────────────────────────────────────────────

describe('trackProductView', () => {
  it('stores product in session history', () => {
    trackProductView(mockProducts[0]);
    const history = getViewHistory();
    expect(history).toHaveLength(1);
    expect(history[0].slug).toBe('oak-futon-frame');
  });

  it('also caches product via productCache', () => {
    trackProductView(mockProducts[0]);
    expect(cacheProduct).toHaveBeenCalledWith(mockProducts[0]);
  });

  it('deduplicates by slug (most recent first)', () => {
    trackProductView(mockProducts[0]);
    trackProductView(mockProducts[1]);
    trackProductView(mockProducts[0]); // revisit
    const history = getViewHistory();
    expect(history).toHaveLength(2);
    expect(history[0].slug).toBe('oak-futon-frame'); // most recent
    expect(history[1].slug).toBe('cotton-mattress');
  });

  it('caps at 20 items', () => {
    for (let i = 0; i < 25; i++) {
      trackProductView({
        _id: `p${i}`, name: `Product ${i}`, slug: `product-${i}`,
        price: 100, formattedPrice: '$100.00', mainMedia: '/img.jpg',
      });
    }
    expect(getViewHistory()).toHaveLength(20);
  });

  it('ignores null/undefined product', () => {
    trackProductView(null);
    trackProductView(undefined);
    expect(getViewHistory()).toHaveLength(0);
  });

  it('ignores product without slug', () => {
    trackProductView({ _id: 'x', name: 'No Slug' });
    expect(getViewHistory()).toHaveLength(0);
  });
});

// ── getViewHistory ───────────────────────────────────────────────────

describe('getViewHistory', () => {
  it('returns empty array when no history', () => {
    expect(getViewHistory()).toEqual([]);
  });

  it('respects limit parameter', () => {
    mockProducts.forEach(p => trackProductView(p));
    expect(getViewHistory(2)).toHaveLength(2);
  });

  it('handles corrupted sessionStorage gracefully', () => {
    globalThis.sessionStorage.setItem('cf_session_viewed', 'not-json');
    expect(getViewHistory()).toEqual([]);
  });
});

// ── clearViewHistory ─────────────────────────────────────────────────

describe('clearViewHistory', () => {
  it('removes all session history', () => {
    trackProductView(mockProducts[0]);
    clearViewHistory();
    expect(getViewHistory()).toEqual([]);
  });
});

// ── initRecentlyViewedCarousel ───────────────────────────────────────

describe('initRecentlyViewedCarousel', () => {
  it('populates repeater with recently viewed products', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w);

    const repeater = $w('#recentlyViewedRepeater');
    expect(repeater.data).toEqual(mockProducts);
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('expands section when products exist', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w);

    expect($w('#recentlyViewedSection').expand).toHaveBeenCalled();
  });

  it('collapses section when no products', () => {
    getRecentlyViewed.mockReturnValue([]);

    initRecentlyViewedCarousel($w);

    expect($w('#recentlyViewedSection').collapse).toHaveBeenCalled();
  });

  it('sets section title', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w);

    expect($w('#recentlyViewedTitle').text).toBe('Recently Viewed');
  });

  it('accepts custom title', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w, { title: 'You Recently Browsed' });

    expect($w('#recentlyViewedTitle').text).toBe('You Recently Browsed');
  });

  it('accepts custom limit', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w, { limit: 2 });

    expect(getRecentlyViewed).toHaveBeenCalledWith(2);
  });

  it('uses default limit of 6', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w);

    expect(getRecentlyViewed).toHaveBeenCalledWith(6);
  });

  it('excludes current product by slug', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w, { excludeSlug: 'oak-futon-frame' });

    const repeater = $w('#recentlyViewedRepeater');
    expect(repeater.data.length).toBe(3);
    expect(repeater.data.every(p => p.slug !== 'oak-futon-frame')).toBe(true);
  });

  it('wires onItemReady with image, name, price, and makeClickable', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w);

    const repeater = $w('#recentlyViewedRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    // Simulate onItemReady call with a local element cache
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement(sel));
      return itemEls.get(sel);
    };
    onItemReadyFn($item, mockProducts[0]);

    expect(itemEls.get('#recentImage').src).toBe('/oak.jpg');
    expect(itemEls.get('#recentImage').alt).toContain('Oak Futon Frame');
    expect(itemEls.get('#recentName').text).toBe('Oak Futon Frame');
    expect(itemEls.get('#recentPrice').text).toBe('$499.00');
    expect(makeClickable).toHaveBeenCalled();
  });

  it('sets ARIA landmark on section', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w);

    expect($w('#recentlyViewedSection').accessibility.ariaLabel).toBe('Recently Viewed Products');
    expect($w('#recentlyViewedSection').accessibility.role).toBe('region');
  });

  it('accepts custom element selectors', () => {
    getRecentlyViewed.mockReturnValue(mockProducts);

    initRecentlyViewedCarousel($w, {
      sectionId: '#mySection',
      repeaterId: '#myRepeater',
      titleId: '#myTitle',
    });

    expect($w('#myTitle').text).toBe('Recently Viewed');
    expect($w('#myRepeater').data).toEqual(mockProducts);
    expect($w('#mySection').expand).toHaveBeenCalled();
  });
});

// ── initAlsoBoughtSection ────────────────────────────────────────────

describe('initAlsoBoughtSection', () => {
  it('fetches similar products and populates repeater', async () => {
    getSimilarProducts.mockResolvedValue({ success: true, products: mockSimilar });

    await initAlsoBoughtSection($w, mockProducts[0]);

    const repeater = $w('#alsoBoughtRepeater');
    expect(repeater.data).toEqual(mockSimilar);
    expect(getSimilarProducts).toHaveBeenCalledWith('p1', { limit: 4 });
  });

  it('expands section when recommendations exist', async () => {
    getSimilarProducts.mockResolvedValue({ success: true, products: mockSimilar });

    await initAlsoBoughtSection($w, mockProducts[0]);

    expect($w('#alsoBoughtSection').expand).toHaveBeenCalled();
  });

  it('collapses section when no recommendations', async () => {
    getSimilarProducts.mockResolvedValue({ success: true, products: [] });

    await initAlsoBoughtSection($w, mockProducts[0]);

    expect($w('#alsoBoughtSection').collapse).toHaveBeenCalled();
  });

  it('collapses section on API failure', async () => {
    getSimilarProducts.mockResolvedValue({ success: false, products: [] });

    await initAlsoBoughtSection($w, mockProducts[0]);

    expect($w('#alsoBoughtSection').collapse).toHaveBeenCalled();
  });

  it('sets section title', async () => {
    getSimilarProducts.mockResolvedValue({ success: true, products: mockSimilar });

    await initAlsoBoughtSection($w, mockProducts[0]);

    expect($w('#alsoBoughtTitle').text).toBe('Customers Also Bought');
  });

  it('handles null product gracefully', async () => {
    await initAlsoBoughtSection($w, null);
    expect(getSimilarProducts).not.toHaveBeenCalled();
    expect($w('#alsoBoughtSection').collapse).toHaveBeenCalled();
  });

  it('handles exception from getSimilarProducts', async () => {
    getSimilarProducts.mockRejectedValue(new Error('network error'));

    await initAlsoBoughtSection($w, mockProducts[0]);

    expect($w('#alsoBoughtSection').collapse).toHaveBeenCalled();
  });

  it('wires onItemReady with product card data', async () => {
    getSimilarProducts.mockResolvedValue({ success: true, products: mockSimilar });

    await initAlsoBoughtSection($w, mockProducts[0]);

    const repeater = $w('#alsoBoughtRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement(sel));
      return itemEls.get(sel);
    };
    onItemReadyFn($item, mockSimilar[0]);

    expect(itemEls.get('#alsoBoughtImage').src).toBe('/maple.jpg');
    expect(itemEls.get('#alsoBoughtName').text).toBe('Maple Frame');
    expect(itemEls.get('#alsoBoughtPrice').text).toBe('$549.00');
    expect(makeClickable).toHaveBeenCalled();
  });

  it('sets ARIA landmark on section', async () => {
    getSimilarProducts.mockResolvedValue({ success: true, products: mockSimilar });

    await initAlsoBoughtSection($w, mockProducts[0]);

    expect($w('#alsoBoughtSection').accessibility.ariaLabel).toBe('Customers Also Bought');
    expect($w('#alsoBoughtSection').accessibility.role).toBe('region');
  });

  it('accepts custom limit', async () => {
    getSimilarProducts.mockResolvedValue({ success: true, products: mockSimilar });

    await initAlsoBoughtSection($w, mockProducts[0], { limit: 8 });

    expect(getSimilarProducts).toHaveBeenCalledWith('p1', { limit: 8 });
  });
});
