/**
 * Tests for public/CartRecentlyViewed.js
 * CF-kk52: Cart Page recently-viewed cross-sell shelf
 *
 * 6 required cases from spec:
 * 1. 0 history → section hidden
 * 2. 5 history items, 2 already in cart → shows 3 items
 * 3. All history items in cart → section hidden
 * 4. addToCart success → button shows success state
 * 5. addToCart failure → console.error logged, button re-enabled
 * 6. Empty cartItems array → shows full history up to 4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────

const { mockGetViewHistory, mockAddToCart } = vi.hoisted(() => ({
  mockGetViewHistory: vi.fn(),
  mockAddToCart: vi.fn(),
}));

vi.mock('public/recentlyViewed', () => ({
  getViewHistory: mockGetViewHistory,
}));

vi.mock('public/cartService', () => ({
  addToCart: mockAddToCart,
}));

import { initCartRecentlyViewed, updateCartRecentlyViewed } from '../src/public/CartRecentlyViewed.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeProduct(id, overrides = {}) {
  return {
    _id: id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    price: 299,
    formattedPrice: '$299.00',
    mainMedia: `https://example.com/${id}.jpg`,
    ...overrides,
  };
}

function makeCartItem(productId) {
  return { productId };
}

function createEl() {
  return {
    text: '',
    label: 'Add to Cart',
    src: '',
    data: null,
    collapsed: false,
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    show: vi.fn(),
    hide: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createEl());
    return els.get(sel);
  };
  $w._get = (sel) => els.get(sel);
  return $w;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('CartRecentlyViewed', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Case 1 ─────────────────────────────────────────────────────────
  it('hides section when history is empty', () => {
    mockGetViewHistory.mockReturnValue([]);

    initCartRecentlyViewed($w, [makeCartItem('p1')]);

    expect($w('#cartRecentlyViewedSection').collapse).toHaveBeenCalled();
    expect($w('#cartRecentlyViewedSection').expand).not.toHaveBeenCalled();
  });

  // Case 2 ─────────────────────────────────────────────────────────
  it('shows up to MAX items after filtering out cart products', () => {
    const history = [
      makeProduct('a'),
      makeProduct('b'),
      makeProduct('c'),
      makeProduct('d'),
      makeProduct('e'),
    ];
    mockGetViewHistory.mockReturnValue(history);

    const cartItems = [makeCartItem('b'), makeCartItem('d')];
    initCartRecentlyViewed($w, cartItems);

    expect($w('#cartRecentlyViewedSection').expand).toHaveBeenCalled();

    // Repeater should have 3 items (a, c, e) — max 4 so all 3 fit
    const repeaterData = $w('#cartRecentlyViewedRepeater').data;
    expect(repeaterData).toHaveLength(3);
    expect(repeaterData.map(r => r._id)).toEqual(['a', 'c', 'e']);
  });

  // Case 3 ─────────────────────────────────────────────────────────
  it('hides section when all history items are already in cart', () => {
    const history = [makeProduct('x'), makeProduct('y')];
    mockGetViewHistory.mockReturnValue(history);

    const cartItems = [makeCartItem('x'), makeCartItem('y')];
    initCartRecentlyViewed($w, cartItems);

    expect($w('#cartRecentlyViewedSection').collapse).toHaveBeenCalled();
    expect($w('#cartRecentlyViewedSection').expand).not.toHaveBeenCalled();
  });

  // Case 4 ─────────────────────────────────────────────────────────
  it('shows success state on addToCart success then re-enables button', async () => {
    vi.useFakeTimers();
    mockGetViewHistory.mockReturnValue([makeProduct('p1')]);
    mockAddToCart.mockResolvedValue({ success: true });

    initCartRecentlyViewed($w, []);

    // Simulate onItemReady callback
    const repeater = $w('#cartRecentlyViewedRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();

    // Build a mock $item for the repeater slot
    const $item = create$w();
    const itemData = { _id: 'p1', name: 'Product p1', formattedPrice: '$299.00', mainMedia: 'img.jpg' };

    // Fire the onItemReady handler
    const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
    onItemReadyCb($item, itemData);

    // Simulate button click
    const btn = $item('#crvAddToCartBtn');
    const onClickCb = btn.onClick.mock.calls[0][0];
    const clickPromise = onClickCb();

    expect(btn.disable).toHaveBeenCalled();
    await clickPromise;

    // Button should show success label
    expect(btn.label).toBe('✓ Added');

    // After timeout, label resets and button re-enables
    vi.runAllTimers();
    expect(btn.label).toBe('Add to Cart');
    expect(btn.enable).toHaveBeenCalled();

  });

  // Case 5 ─────────────────────────────────────────────────────────
  it('logs error and re-enables button on addToCart failure', async () => {
    mockGetViewHistory.mockReturnValue([makeProduct('p2')]);
    mockAddToCart.mockRejectedValue(new Error('Stores error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    initCartRecentlyViewed($w, []);

    const repeater = $w('#cartRecentlyViewedRepeater');
    const $item = create$w();
    const itemData = { _id: 'p2', name: 'Product p2', formattedPrice: '$199.00', mainMedia: 'img2.jpg' };

    const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
    onItemReadyCb($item, itemData);

    const btn = $item('#crvAddToCartBtn');
    const onClickCb = btn.onClick.mock.calls[0][0];
    await onClickCb();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CartRecentlyViewed]'),
      expect.any(Error),
    );
    expect(btn.enable).toHaveBeenCalled();
    expect(btn.label).toBe('Add to Cart');

    consoleSpy.mockRestore();
  });

  // Case 6 ─────────────────────────────────────────────────────────
  it('shows full history up to 4 when cartItems is empty', () => {
    const history = [
      makeProduct('1'),
      makeProduct('2'),
      makeProduct('3'),
      makeProduct('4'),
      makeProduct('5'),
    ];
    mockGetViewHistory.mockReturnValue(history);

    initCartRecentlyViewed($w, []);

    expect($w('#cartRecentlyViewedSection').expand).toHaveBeenCalled();
    const data = $w('#cartRecentlyViewedRepeater').data;
    expect(data).toHaveLength(4);
    expect(data.map(r => r._id)).toEqual(['1', '2', '3', '4']);
  });

  // updateCartRecentlyViewed: does NOT re-register onItemReady (no stacking)
  it('updateCartRecentlyViewed updates data without calling onItemReady again', () => {
    mockGetViewHistory.mockReturnValue([makeProduct('r1'), makeProduct('r2')]);

    initCartRecentlyViewed($w, []);

    const repeater = $w('#cartRecentlyViewedRepeater');
    const callsAfterInit = repeater.onItemReady.mock.calls.length;
    expect(callsAfterInit).toBe(1);

    // Cart changes — r1 added to cart
    mockGetViewHistory.mockReturnValue([makeProduct('r1'), makeProduct('r2')]);
    updateCartRecentlyViewed($w, [makeCartItem('r1')]);

    // onItemReady must NOT be called again — still exactly 1 registration
    expect(repeater.onItemReady).toHaveBeenCalledTimes(1);
    expect(repeater.data).toHaveLength(1);
    expect(repeater.data[0]._id).toBe('r2');
  });

  // updateCartRecentlyViewed: collapses section when all in cart
  it('updateCartRecentlyViewed collapses section when filtered list is empty', () => {
    mockGetViewHistory.mockReturnValue([makeProduct('s1')]);
    initCartRecentlyViewed($w, []);

    mockGetViewHistory.mockReturnValue([makeProduct('s1')]);
    updateCartRecentlyViewed($w, [makeCartItem('s1')]);

    expect($w('#cartRecentlyViewedSection').collapse).toHaveBeenCalled();
  });

  // _id fallback — Wix Stores line-item shape uses ._id not .productId
  it('filters correctly when cart items use ._id instead of .productId', () => {
    const history = [makeProduct('alpha'), makeProduct('beta')];
    mockGetViewHistory.mockReturnValue(history);

    // Cart items shaped like Wix Stores line items (._id, no .productId)
    const cartItems = [{ _id: 'alpha' }];
    initCartRecentlyViewed($w, cartItems);

    expect($w('#cartRecentlyViewedSection').expand).toHaveBeenCalled();
    const data = $w('#cartRecentlyViewedRepeater').data;
    expect(data).toHaveLength(1);
    expect(data[0]._id).toBe('beta');
  });

  // Extra: populate repeater item fields
  it('populates repeater item image, name, and price', () => {
    const product = makeProduct('q1');
    mockGetViewHistory.mockReturnValue([product]);

    initCartRecentlyViewed($w, []);

    const repeater = $w('#cartRecentlyViewedRepeater');
    const $item = create$w();
    const itemData = repeater.data[0];

    const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
    onItemReadyCb($item, itemData);

    expect($item('#crvProductImage').src).toBe(product.mainMedia);
    expect($item('#crvProductName').text).toBe(product.name);
    expect($item('#crvProductPrice').text).toBe(product.formattedPrice);
  });
});
