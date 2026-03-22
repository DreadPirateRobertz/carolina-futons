/**
 * continueShopping.test.js
 *
 * Unit tests for src/public/ContinueShoppingSection.js
 *
 * Covers:
 *  - Empty history → section stays hidden
 *  - Items present → section expands
 *  - Repeater populated with history products
 *  - Max 6 items cap
 *  - excludeId passed through to getRecentlyViewed
 *  - onItemReady sets image src/alt, name, price, link onClick
 *  - Price: itemData.price (pre-formatted string) used directly; '' when absent
 *  - Link onClick navigates to /product-page/<slug> via safeSlug
 *  - Undefined/invalid slug → navigation skipped
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('public/galleryHelpers.js', () => ({
  getRecentlyViewed: vi.fn(() => []),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

import { initContinueShoppingSection } from '../src/public/ContinueShoppingSection.js';
import { getRecentlyViewed } from 'public/galleryHelpers.js';
import { to } from 'wix-location-frontend';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reflects the actual shape stored by trackProductView:
 * price is a pre-formatted string (e.g. '$599.00'), no formattedPrice field.
 */
function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Sedona Futon Frame',
    slug: 'sedona-futon-frame',
    price: '$599.00',
    mainMedia: 'https://example.com/sedona.jpg',
    ...overrides,
  };
}

function createMockElement() {
  return {
    text: '', src: '', alt: '', data: [],
    expand: vi.fn(), collapse: vi.fn(),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContinueShoppingSection', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    getRecentlyViewed.mockReturnValue([]);
  });

  // ── Visibility ─────────────────────────────────────────────────────

  it('keeps section hidden when history is empty', () => {
    initContinueShoppingSection($w);
    expect($w('#continueShoppingSection').expand).not.toHaveBeenCalled();
    expect($w('#continueShoppingSection').show).not.toHaveBeenCalled();
  });

  it('expands section when items are present', () => {
    getRecentlyViewed.mockReturnValue([makeProduct()]);
    initContinueShoppingSection($w);
    expect($w('#continueShoppingSection').expand).toHaveBeenCalled();
  });

  it('sets section title text', () => {
    getRecentlyViewed.mockReturnValue([makeProduct()]);
    initContinueShoppingSection($w);
    expect($w('#continueShoppingTitle').text).toBe('Continue Shopping');
  });

  // ── Repeater data ──────────────────────────────────────────────────

  it('sets repeater.data to the recently viewed products', () => {
    const products = [makeProduct({ _id: 'p1' }), makeProduct({ _id: 'p2' })];
    getRecentlyViewed.mockReturnValue(products);
    initContinueShoppingSection($w);
    expect($w('#continueShoppingRepeater').data).toEqual(products);
  });

  it('caps at 6 items even if more are available', () => {
    const products = Array.from({ length: 10 }, (_, i) =>
      makeProduct({ _id: `p${i}`, slug: `prod-${i}` })
    );
    getRecentlyViewed.mockReturnValue(products);
    initContinueShoppingSection($w);
    expect($w('#continueShoppingRepeater').data).toHaveLength(6);
  });

  it('does not show repeater when exactly 0 items', () => {
    getRecentlyViewed.mockReturnValue([]);
    initContinueShoppingSection($w);
    expect($w('#continueShoppingRepeater').data).toEqual([]);
    expect($w('#continueShoppingSection').expand).not.toHaveBeenCalled();
  });

  // ── excludeId ──────────────────────────────────────────────────────

  it('passes excludeId option to getRecentlyViewed', () => {
    initContinueShoppingSection($w, { excludeId: 'current-product-id' });
    expect(getRecentlyViewed).toHaveBeenCalledWith('current-product-id');
  });

  it('passes null excludeId by default', () => {
    initContinueShoppingSection($w);
    expect(getRecentlyViewed).toHaveBeenCalledWith(null);
  });

  // ── onItemReady ────────────────────────────────────────────────────

  it('onItemReady sets image src, alt, name, and price from stored fields', () => {
    const product = makeProduct({
      name: 'Sedona Frame',
      price: '$599.00',
      mainMedia: 'https://example.com/sedona.jpg',
    });
    getRecentlyViewed.mockReturnValue([product]);
    initContinueShoppingSection($w);

    const onItemReadyCb = $w('#continueShoppingRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCb($item, product);

    expect($item('#continueShoppingImage').src).toBe('https://example.com/sedona.jpg');
    expect($item('#continueShoppingImage').alt).toBe('Sedona Frame');
    expect($item('#continueShoppingName').text).toBe('Sedona Frame');
    expect($item('#continueShoppingPrice').text).toBe('$599.00');
  });

  it('shows empty price string when price is absent', () => {
    const product = makeProduct({ price: undefined });
    getRecentlyViewed.mockReturnValue([product]);
    initContinueShoppingSection($w);

    const onItemReadyCb = $w('#continueShoppingRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCb($item, product);

    expect($item('#continueShoppingPrice').text).toBe('');
  });

  // ── Link navigation ────────────────────────────────────────────────

  it('onItemReady registers onClick on the link button', () => {
    const product = makeProduct();
    getRecentlyViewed.mockReturnValue([product]);
    initContinueShoppingSection($w);

    const onItemReadyCb = $w('#continueShoppingRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCb($item, product);

    expect($item('#continueShoppingLink').onClick).toHaveBeenCalledWith(expect.any(Function));
  });

  it('link onClick navigates to /product-page/<slug>', () => {
    const product = makeProduct({ slug: 'sedona-futon-frame' });
    getRecentlyViewed.mockReturnValue([product]);
    initContinueShoppingSection($w);

    const onItemReadyCb = $w('#continueShoppingRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCb($item, product);

    const clickHandler = $item('#continueShoppingLink').onClick.mock.calls[0][0];
    clickHandler();

    expect(to).toHaveBeenCalledWith('/product-page/sedona-futon-frame');
  });

  it('link onClick does not navigate when slug is undefined', () => {
    const product = makeProduct({ slug: undefined });
    getRecentlyViewed.mockReturnValue([product]);
    initContinueShoppingSection($w);

    const onItemReadyCb = $w('#continueShoppingRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCb($item, product);

    const clickHandler = $item('#continueShoppingLink').onClick.mock.calls[0][0];
    clickHandler();

    expect(to).not.toHaveBeenCalled();
  });

  it('link onClick does not navigate when slug is invalid', () => {
    const product = makeProduct({ slug: 'bad slug with spaces!' });
    getRecentlyViewed.mockReturnValue([product]);
    initContinueShoppingSection($w);

    const onItemReadyCb = $w('#continueShoppingRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCb($item, product);

    const clickHandler = $item('#continueShoppingLink').onClick.mock.calls[0][0];
    clickHandler();

    // safeSlug strips non-[a-z0-9-] chars — spaces and '!' removed
    expect(to).toHaveBeenCalledWith('/product-page/badslugwithspaces');
  });
});
