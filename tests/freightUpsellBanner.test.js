/**
 * freightUpsellBanner.test.js
 *
 * Unit tests for src/public/FreightUpsellBanner.js
 *
 * Covers:
 *  - isLTLItem: murphy bed, cabinet bed, platform bed keywords
 *  - isLTLItem: non-LTL items (futon frame, mattress, default)
 *  - hasLTLItemInCart: true when any item is LTL
 *  - hasLTLItemInCart: false with empty / all-parcel cart
 *  - updateFreightUpsellBanner: collapses banner when no LTL item in cart
 *  - updateFreightUpsellBanner: collapses banner when getFreightComplementProducts returns empty
 *  - updateFreightUpsellBanner: collapses banner when getFreightComplementProducts fails
 *  - updateFreightUpsellBanner: shows banner and populates repeater when LTL + products
 *  - updateFreightUpsellBanner: excludes cart product IDs from complement query
 *  - updateFreightUpsellBanner: collapses on null cart
 *  - initFreightUpsellBanner: registers onItemReady once
 *  - initFreightUpsellBanner: calls updateFreightUpsellBanner on init
 *  - onItemReady: sets image, name, price on each product card
 *  - onItemReady: freightUpsellAddBtn calls addToCart with product ID
 *  - onItemReady: freightUpsellAddBtn fires trackEvent('web_bundle_upsell_add', productId)
 *  - onItemReady: freightUpsellAddBtn handles addToCart failure gracefully
 *  - updateFreightUpsellBanner: sets banner message text
 *  - isLTLItem: ekko, nomad, lexington, charleston platform-bed variants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('backend/productRecommendations.web', () => ({
  getFreightComplementProducts: vi.fn(),
}));

import {
  isLTLItem,
  hasLTLItemInCart,
  initFreightUpsellBanner,
  updateFreightUpsellBanner,
  BANNER_MESSAGE,
} from '../src/public/FreightUpsellBanner.js';
import { getFreightComplementProducts } from 'backend/productRecommendations.web';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItem(name, productId = 'prod-1') {
  return { name, catalogReference: { catalogItemId: productId } };
}

function makeProduct(overrides = {}) {
  return {
    _id: 'comp-1',
    name: 'Organic Cotton Futon Mattress',
    mainMedia: 'https://example.com/mattress.jpg',
    price: 199,
    ...overrides,
  };
}

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', data: [],
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

function makeCart(lineItems = []) {
  return { lineItems };
}

// ── isLTLItem ─────────────────────────────────────────────────────────────────

describe('isLTLItem', () => {
  it('returns true for murphy bed', () => {
    expect(isLTLItem(makeItem('Clover Murphy Bed'))).toBe(true);
  });

  it('returns true for cabinet bed', () => {
    expect(isLTLItem(makeItem('Freestanding Cabinet Bed'))).toBe(true);
  });

  it('returns true for platform bed', () => {
    expect(isLTLItem(makeItem('Sedona Platform Bed'))).toBe(true);
  });

  it('returns true for nomad (platform-bed variant)', () => {
    expect(isLTLItem(makeItem('Nomad Platform Bed'))).toBe(true);
  });

  it('returns true for lexington (platform-bed variant)', () => {
    expect(isLTLItem(makeItem('Lexington Bed Frame'))).toBe(true);
  });

  it('returns true for charleston (platform-bed variant)', () => {
    expect(isLTLItem(makeItem('Charleston Platform Frame'))).toBe(true);
  });

  it('returns true for ekko (platform-bed variant)', () => {
    expect(isLTLItem(makeItem('Ekko Slatted Bed'))).toBe(true);
  });

  it('returns false for futon frame', () => {
    expect(isLTLItem(makeItem('Havana Futon Frame'))).toBe(false);
  });

  it('returns false for mattress', () => {
    expect(isLTLItem(makeItem('Innerspring Futon Mattress'))).toBe(false);
  });

  it('returns false for accessory', () => {
    expect(isLTLItem(makeItem('Bolster Pillow Set'))).toBe(false);
  });

  it('returns false for null/missing item', () => {
    expect(isLTLItem(null)).toBe(false);
    expect(isLTLItem({})).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isLTLItem(makeItem('MURPHY BED DELUXE'))).toBe(true);
    expect(isLTLItem(makeItem('PLATFORM BED KING'))).toBe(true);
  });
});

// ── hasLTLItemInCart ──────────────────────────────────────────────────────────

describe('hasLTLItemInCart', () => {
  it('returns true when cart has one LTL item', () => {
    expect(hasLTLItemInCart([makeItem('Clover Murphy Bed')])).toBe(true);
  });

  it('returns true when cart has LTL + non-LTL items', () => {
    expect(hasLTLItemInCart([
      makeItem('Havana Futon Frame'),
      makeItem('Charleston Platform Frame'),
    ])).toBe(true);
  });

  it('returns false when cart has only parcel items', () => {
    expect(hasLTLItemInCart([
      makeItem('Havana Futon Frame'),
      makeItem('Cotton Mattress'),
    ])).toBe(false);
  });

  it('returns false for empty cart', () => {
    expect(hasLTLItemInCart([])).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasLTLItemInCart(null)).toBe(false);
  });
});

// ── updateFreightUpsellBanner ─────────────────────────────────────────────────

describe('updateFreightUpsellBanner', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    getFreightComplementProducts.mockResolvedValue({
      success: true,
      products: [makeProduct()],
    });
  });

  it('collapses banner when cart has no LTL items', async () => {
    const cart = makeCart([makeItem('Havana Futon Frame', 'p1')]);
    await updateFreightUpsellBanner($w, cart);
    expect($w('#freightUpsellBanner').collapse).toHaveBeenCalled();
    expect($w('#freightUpsellBanner').expand).not.toHaveBeenCalled();
  });

  it('collapses banner when cart is null', async () => {
    await updateFreightUpsellBanner($w, null);
    expect($w('#freightUpsellBanner').collapse).toHaveBeenCalled();
  });

  it('collapses banner when getFreightComplementProducts returns empty', async () => {
    getFreightComplementProducts.mockResolvedValueOnce({ success: true, products: [] });
    const cart = makeCart([makeItem('Clover Murphy Bed', 'p1')]);
    await updateFreightUpsellBanner($w, cart);
    expect($w('#freightUpsellBanner').collapse).toHaveBeenCalled();
    expect($w('#freightUpsellBanner').expand).not.toHaveBeenCalled();
  });

  it('collapses banner when getFreightComplementProducts fails', async () => {
    getFreightComplementProducts.mockResolvedValueOnce({ success: false, products: [] });
    const cart = makeCart([makeItem('Clover Murphy Bed', 'p1')]);
    await updateFreightUpsellBanner($w, cart);
    expect($w('#freightUpsellBanner').collapse).toHaveBeenCalled();
  });

  it('collapses banner and logs warn when getFreightComplementProducts throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getFreightComplementProducts.mockRejectedValueOnce(new Error('network error'));
    const cart = makeCart([makeItem('Clover Murphy Bed', 'p1')]);
    await updateFreightUpsellBanner($w, cart);
    expect($w('#freightUpsellBanner').collapse).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('expands banner when LTL item in cart and products returned', async () => {
    const cart = makeCart([makeItem('Sedona Platform Bed', 'p1')]);
    await updateFreightUpsellBanner($w, cart);
    expect($w('#freightUpsellBanner').expand).toHaveBeenCalled();
  });

  it('sets banner message text', async () => {
    const cart = makeCart([makeItem('Sedona Platform Bed', 'p1')]);
    await updateFreightUpsellBanner($w, cart);
    expect($w('#freightUpsellText').text).toBe(BANNER_MESSAGE);
  });

  it('populates repeater with product data', async () => {
    const products = [
      makeProduct({ _id: 'c1', name: 'Mattress A' }),
      makeProduct({ _id: 'c2', name: 'Mattress B' }),
    ];
    getFreightComplementProducts.mockResolvedValueOnce({ success: true, products });
    const cart = makeCart([makeItem('Clover Murphy Bed', 'p1')]);
    await updateFreightUpsellBanner($w, cart);
    const repeaterData = $w('#upsellProductRepeater').data;
    expect(repeaterData).toHaveLength(2);
    expect(repeaterData[0]._id).toBe('c1');
    expect(repeaterData[1]._id).toBe('c2');
  });

  it('excludes cart product IDs from complement query', async () => {
    const cart = makeCart([
      { name: 'Clover Murphy Bed', catalogReference: { catalogItemId: 'murphy-123' } },
      { name: 'Sedona Futon Frame', catalogReference: { catalogItemId: 'frame-456' } },
    ]);
    await updateFreightUpsellBanner($w, cart);
    expect(getFreightComplementProducts).toHaveBeenCalledWith(
      expect.arrayContaining(['murphy-123', 'frame-456']),
      4
    );
  });

  it('handles cart items with missing catalogReference gracefully', async () => {
    const cart = makeCart([{ name: 'Clover Murphy Bed' }]); // no catalogReference
    await updateFreightUpsellBanner($w, cart);
    expect(getFreightComplementProducts).toHaveBeenCalledWith([], 4);
    expect($w('#freightUpsellBanner').expand).toHaveBeenCalled();
  });
});

// ── initFreightUpsellBanner ───────────────────────────────────────────────────

describe('initFreightUpsellBanner', () => {
  let $w;
  let addToCart;
  let trackEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    addToCart = vi.fn().mockResolvedValue({});
    trackEvent = vi.fn();
    getFreightComplementProducts.mockResolvedValue({ success: true, products: [makeProduct()] });
  });

  it('registers onItemReady exactly once', async () => {
    await initFreightUpsellBanner($w, null, { addToCart, trackEvent });
    expect($w('#upsellProductRepeater').onItemReady).toHaveBeenCalledTimes(1);
  });

  it('calls updateFreightUpsellBanner during init (expands banner if LTL in cart)', async () => {
    const cart = makeCart([makeItem('Clover Murphy Bed', 'p1')]);
    await initFreightUpsellBanner($w, cart, { addToCart, trackEvent });
    expect($w('#freightUpsellBanner').expand).toHaveBeenCalled();
  });

  it('collapses banner on init when cart has no LTL item', async () => {
    const cart = makeCart([makeItem('Havana Futon Frame', 'p1')]);
    await initFreightUpsellBanner($w, cart, { addToCart, trackEvent });
    expect($w('#freightUpsellBanner').collapse).toHaveBeenCalled();
  });

  // ── onItemReady handler behaviour ────────────────────────────────────────

  it('onItemReady sets image src and alt', async () => {
    await initFreightUpsellBanner($w, null, { addToCart, trackEvent });
    const [itemReadyCb] = $w('#upsellProductRepeater').onItemReady.mock.calls[0];
    const $item = create$w();
    const itemData = makeProduct({ _id: 'c1', mainMedia: 'https://example.com/img.jpg', name: 'Cotton Mattress' });
    itemReadyCb($item, itemData);
    expect($item('#freightUpsellImage').src).toBe('https://example.com/img.jpg');
    expect($item('#freightUpsellImage').alt).toBe('Cotton Mattress');
  });

  it('onItemReady sets product name and formatted price', async () => {
    await initFreightUpsellBanner($w, null, { addToCart, trackEvent });
    const [itemReadyCb] = $w('#upsellProductRepeater').onItemReady.mock.calls[0];
    const $item = create$w();
    itemReadyCb($item, makeProduct({ name: 'Organic Mattress', price: 249 }));
    expect($item('#freightUpsellName').text).toBe('Organic Mattress');
    expect($item('#freightUpsellPrice').text).toBe('$249.00');
  });

  it('onItemReady shows empty string for missing price', async () => {
    await initFreightUpsellBanner($w, null, { addToCart, trackEvent });
    const [itemReadyCb] = $w('#upsellProductRepeater').onItemReady.mock.calls[0];
    const $item = create$w();
    itemReadyCb($item, makeProduct({ price: null }));
    expect($item('#freightUpsellPrice').text).toBe('');
  });

  it('freightUpsellAddBtn calls addToCart with product ID', async () => {
    await initFreightUpsellBanner($w, null, { addToCart, trackEvent });
    const [itemReadyCb] = $w('#upsellProductRepeater').onItemReady.mock.calls[0];
    const $item = create$w();
    itemReadyCb($item, makeProduct({ _id: 'mattress-999' }));

    // Simulate button click
    const [clickCb] = $item('#freightUpsellAddBtn').onClick.mock.calls[0];
    await clickCb();
    expect(addToCart).toHaveBeenCalledWith('mattress-999', 1);
  });

  it('freightUpsellAddBtn fires trackEvent with productId', async () => {
    await initFreightUpsellBanner($w, null, { addToCart, trackEvent });
    const [itemReadyCb] = $w('#upsellProductRepeater').onItemReady.mock.calls[0];
    const $item = create$w();
    itemReadyCb($item, makeProduct({ _id: 'mattress-999' }));

    const [clickCb] = $item('#freightUpsellAddBtn').onClick.mock.calls[0];
    await clickCb();
    expect(trackEvent).toHaveBeenCalledWith('web_bundle_upsell_add', { productId: 'mattress-999' });
  });

  it('freightUpsellAddBtn handles addToCart failure without throwing', async () => {
    addToCart.mockRejectedValueOnce(new Error('out of stock'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await initFreightUpsellBanner($w, null, { addToCart, trackEvent });
    const [itemReadyCb] = $w('#upsellProductRepeater').onItemReady.mock.calls[0];
    const $item = create$w();
    itemReadyCb($item, makeProduct({ _id: 'mattress-999' }));
    const [clickCb] = $item('#freightUpsellAddBtn').onClick.mock.calls[0];
    await expect(clickCb()).resolves.not.toThrow();
    warnSpy.mockRestore();
  });
});
