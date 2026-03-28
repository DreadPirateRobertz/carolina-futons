/**
 * Tests for CF-8bbu: initRecommendationsCarousel frontend module.
 * Covers repeater wiring, collapse paths, and item rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/productRecommendations.web', () => ({
  getRecommendations: vi.fn(),
  getRelatedProducts: vi.fn().mockResolvedValue([]),
  getCompletionSuggestions: vi.fn().mockResolvedValue([]),
  getSameCollection: vi.fn().mockResolvedValue([]),
  getFeaturedProducts: vi.fn().mockResolvedValue([]),
  getSaleProducts: vi.fn().mockResolvedValue([]),
  getBundleSuggestion: vi.fn().mockResolvedValue(null),
  getBestsellers: vi.fn().mockResolvedValue([]),
  trackRecentlyViewed: vi.fn().mockResolvedValue({ success: true }),
  getRecentlyViewed: vi.fn().mockResolvedValue({ success: true, products: [] }),
  getSimilarProducts: vi.fn().mockResolvedValue({ success: true, products: [] }),
  getCustomersAlsoBought: vi.fn().mockResolvedValue({ success: true, products: [] }),
}));

vi.mock('public/productPageUtils.js', () => ({
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
  formatCurrency: vi.fn(v => `$${v}`),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  default: { to: vi.fn() },
  to: vi.fn(),
}));

import { getRecommendations as mockGetRecommendations } from 'backend/productRecommendations.web';
import { initRecommendationsCarousel } from '../src/public/ProductRecommendations.js';

function makeEl() {
  return {
    text: '',
    src: '',
    data: [],
    show: vi.fn(),
    hide: vi.fn(),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    focus: vi.fn(),
  };
}

function make$w() {
  const map = new Map();
  return (sel) => {
    if (!map.has(sel)) map.set(sel, makeEl());
    return map.get(sel);
  };
}

function makeProduct(overrides = {}) {
  return {
    _id: 'rec-1',
    name: 'Recommended Product',
    slug: 'recommended-product',
    price: 499,
    formattedPrice: '$499.00',
    mainMedia: 'https://example.com/rec.jpg',
    collections: ['futon-frames'],
    ...overrides,
  };
}

describe('initRecommendationsCarousel', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
  });

  it('collapses section when no productId in state', async () => {
    await initRecommendationsCarousel($w, { product: null });
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  it('calls getRecommendations with productId', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, products: [makeProduct()] });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });
    expect(mockGetRecommendations).toHaveBeenCalledWith('prod-1', 6);
  });

  it('populates repeater data with returned products', async () => {
    const products = [makeProduct({ _id: 'r1' }), makeProduct({ _id: 'r2' })];
    mockGetRecommendations.mockResolvedValueOnce({ success: true, products });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });
    expect($w('#recommendationsRepeater').data).toHaveLength(2);
    expect($w('#recommendationsRepeater').data[0]._id).toBe('r1');
  });

  it('collapses section when products array is empty', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, products: [] });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when getRecommendations returns success:false', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: false, products: [] });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when getRecommendations throws', async () => {
    mockGetRecommendations.mockRejectedValueOnce(new Error('Network error'));
    await expect(initRecommendationsCarousel($w, { product: { _id: 'prod-1' } })).resolves.not.toThrow();
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
  });

  it('registers onItemReady on the repeater', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, products: [makeProduct()] });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });
    expect($w('#recommendationsRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets product name in repeater item', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, products: [makeProduct({ name: 'Test Futon' })] });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });

    const callback = $w('#recommendationsRepeater').onItemReady.mock.calls[0][0];
    const $item = make$w();
    callback($item, makeProduct({ name: 'Test Futon' }));

    expect($item('#recProductName').text).toBe('Test Futon');
  });

  it('sets formatted price in repeater item', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, products: [makeProduct()] });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });

    const callback = $w('#recommendationsRepeater').onItemReady.mock.calls[0][0];
    const $item = make$w();
    callback($item, makeProduct({ formattedPrice: '$499.00' }));

    expect($item('#recProductPrice').text).toBe('$499.00');
  });

  it('sets image src in repeater item', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, products: [makeProduct()] });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });

    const callback = $w('#recommendationsRepeater').onItemReady.mock.calls[0][0];
    const $item = make$w();
    callback($item, makeProduct({ mainMedia: 'https://img.test/photo.jpg' }));

    expect($item('#recProductImage').src).toBe('https://img.test/photo.jpg');
  });

  it('wires recViewBtn onClick for navigation', async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, products: [makeProduct()] });
    await initRecommendationsCarousel($w, { product: { _id: 'prod-1' } });

    const callback = $w('#recommendationsRepeater').onItemReady.mock.calls[0][0];
    const $item = make$w();
    callback($item, makeProduct());

    expect($item('#recViewBtn').onClick).toHaveBeenCalled();
  });

  it('handles state.product being undefined gracefully', async () => {
    await expect(initRecommendationsCarousel($w, {})).resolves.not.toThrow();
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
  });
});
