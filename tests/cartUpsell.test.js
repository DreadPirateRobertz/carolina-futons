/**
 * cartUpsell.test.js
 *
 * Unit tests for src/public/CartUpsell.js
 *
 * Covers:
 *  - initCartUpsell registers onCartChanged callback
 *  - Drawer shows when cart item count increases
 *  - Drawer does NOT show when count stays same or decreases
 *  - getRecommendations called with the added product's ID
 *  - No drawer if recommendations is empty
 *  - No drawer/crash if getRecommendations throws
 *  - upsellRepeater populated: image, name, price
 *  - upsellAddBtn calls addToCart + tracks GA4 event
 *  - upsellAddBtn handles addToCart failure gracefully
 *  - upsell_shown event tracked on drawer open
 *  - Auto-dismisses after 8s (fake timers)
 *  - Close button dismisses immediately
 *  - Replaces existing auto-dismiss timer on new add
 *  - onItemReady registered once in init, not re-registered on each cart change
 *  - Concurrency guard: overlapping onCartChanged calls are dropped while busy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('public/cartService', () => ({
  addToCart: vi.fn().mockResolvedValue({}),
  onCartChanged: vi.fn(),
  getCurrentCart: vi.fn(),
}));

vi.mock('backend/productRecommendations.web', () => ({
  getRecommendations: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/productCardHelpers.js', () => ({
  renderSimplePrice: vi.fn(($el, product) => {
    if ($el && product) {
      const p = product?.formattedDiscountedPrice || product?.formattedPrice || String(product?.price ?? '');
      try { $el.text = p; } catch (e) {}
    }
  }),
}));

import { initCartUpsell } from '../src/public/CartUpsell.js';
import { addToCart, onCartChanged, getCurrentCart } from 'public/cartService';
import { getRecommendations } from 'backend/productRecommendations.web';
import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    _id: 'rec-prod-1',
    name: 'Sedona Futon Frame',
    mainMedia: 'https://example.com/sedona.jpg',
    price: 599,
    ...overrides,
  };
}

function makeLineItem(productId, quantity = 1) {
  return {
    catalogReference: { catalogItemId: productId },
    quantity,
  };
}

function makeCart(lineItems = []) {
  return { lineItems };
}

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', data: [],
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
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

describe('CartUpsell', () => {
  let $w;
  let cartChangedCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    $w = create$w();

    // Capture the onCartChanged callback when initCartUpsell registers it
    onCartChanged.mockImplementation((cb) => { cartChangedCallback = cb; });

    // Default: cart starts empty
    getCurrentCart.mockResolvedValue(makeCart([]));

    // Default: 3 recommendations
    getRecommendations.mockResolvedValue({
      success: true,
      products: [
        makeProduct({ _id: 'rec-1', name: 'Product A', price: 299 }),
        makeProduct({ _id: 'rec-2', name: 'Product B', price: 399 }),
        makeProduct({ _id: 'rec-3', name: 'Product C', price: 499 }),
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Init ───────────────────────────────────────────────────────────────

  it('registers onCartChanged callback on init', () => {
    initCartUpsell($w);
    expect(onCartChanged).toHaveBeenCalledWith(expect.any(Function));
  });

  // ── Cart change detection ──────────────────────────────────────────────

  it('shows drawer when cart count increases', async () => {
    initCartUpsell($w);

    // First event: empty cart → sets baseline
    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    // Second event: item added
    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    expect(getRecommendations).toHaveBeenCalledWith('prod-1', 3);
    expect($w('#upsellDrawer').show).toHaveBeenCalled();
  });

  it('does NOT show drawer when cart count is unchanged', async () => {
    initCartUpsell($w);

    const cart = makeCart([makeLineItem('prod-1', 1)]);
    getCurrentCart.mockResolvedValue(cart);
    await cartChangedCallback(); // baseline: count=1
    await cartChangedCallback(); // same count=1

    expect(getRecommendations).not.toHaveBeenCalled();
    expect($w('#upsellDrawer').show).not.toHaveBeenCalled();
  });

  it('does NOT show drawer when cart count decreases (item removed)', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1', 2)]));
    await cartChangedCallback(); // baseline: count=2

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1', 1)]));
    await cartChangedCallback(); // count decreased to 1

    expect(getRecommendations).not.toHaveBeenCalled();
    expect($w('#upsellDrawer').show).not.toHaveBeenCalled();
  });

  it('does NOT show drawer on first cart change (baseline capture)', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback(); // first event → just sets baseline

    expect(getRecommendations).not.toHaveBeenCalled();
    expect($w('#upsellDrawer').show).not.toHaveBeenCalled();
  });

  // ── Recommendations ────────────────────────────────────────────────────

  it('calls getRecommendations with the newly added product ID', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('frame-xyz')]));
    await cartChangedCallback();

    expect(getRecommendations).toHaveBeenCalledWith('frame-xyz', 3);
  });

  it('does not show drawer if recommendations are empty', async () => {
    getRecommendations.mockResolvedValue({ success: true, products: [] });
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    expect($w('#upsellDrawer').show).not.toHaveBeenCalled();
  });

  it('does not throw if getRecommendations fails', async () => {
    getRecommendations.mockRejectedValue(new Error('Network error'));
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await expect(cartChangedCallback()).resolves.not.toThrow();
    expect($w('#upsellDrawer').show).not.toHaveBeenCalled();
  });

  // ── Repeater population ────────────────────────────────────────────────

  it('sets repeater.data to the 3 recommendation products', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    const data = $w('#upsellRepeater').data;
    expect(data).toHaveLength(3);
    expect(data[0]._id).toBe('rec-1');
    expect(data[1]._id).toBe('rec-2');
    expect(data[2]._id).toBe('rec-3');
  });

  it('onItemReady sets image src, alt, name, and price on each item element', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    // Get the onItemReady callback that was registered
    const onItemReadyCallback = $w('#upsellRepeater').onItemReady.mock.calls[0][0];
    const itemData = makeProduct({ _id: 'rec-1', name: 'Sedona Frame', price: 599, formattedPrice: '$599.00', mainMedia: 'https://example.com/sedona.jpg' });

    const $item = create$w();
    onItemReadyCallback($item, itemData);

    expect($item('#upsellItemImage').src).toBe('https://example.com/sedona.jpg');
    expect($item('#upsellItemImage').alt).toBe('Sedona Frame');
    expect($item('#upsellItemName').text).toBe('Sedona Frame');
    expect($item('#upsellItemPrice').text).toBe('$599.00');
  });

  it('onItemReady handles missing price gracefully', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    const onItemReadyCallback = $w('#upsellRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCallback($item, makeProduct({ price: undefined }));

    expect($item('#upsellItemPrice').text).toBe('');
  });

  // ── upsellAddBtn ────────────────────────────────────────────────────────

  it('upsellAddBtn calls addToCart with the recommendation product ID', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('source-prod')]));
    await cartChangedCallback();

    const onItemReadyCallback = $w('#upsellRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCallback($item, makeProduct({ _id: 'rec-add-me' }));

    // Simulate click
    const clickHandler = $item('#upsellAddBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(addToCart).toHaveBeenCalledWith('rec-add-me', 1);
  });

  it('upsellAddBtn tracks upsell_add_to_cart event on successful add', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('source-prod')]));
    await cartChangedCallback();

    const onItemReadyCallback = $w('#upsellRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCallback($item, makeProduct({ _id: 'rec-item' }));

    const clickHandler = $item('#upsellAddBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(trackEvent).toHaveBeenCalledWith('upsell_add_to_cart', {
      upsellProductId: 'rec-item',
      sourceProductId: 'source-prod',
    });
    expect(fireCustomEvent).toHaveBeenCalledWith('upsell_add_to_cart', {
      upsellProductId: 'rec-item',
      sourceProductId: 'source-prod',
    });
  });

  it('upsellAddBtn does not throw when addToCart fails', async () => {
    addToCart.mockRejectedValueOnce(new Error('Out of stock'));
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('source-prod')]));
    await cartChangedCallback();

    const onItemReadyCallback = $w('#upsellRepeater').onItemReady.mock.calls[0][0];
    const $item = create$w();
    onItemReadyCallback($item, makeProduct({ _id: 'rec-item' }));

    const clickHandler = $item('#upsellAddBtn').onClick.mock.calls[0][0];
    await expect(clickHandler()).resolves.not.toThrow();
  });

  // ── Tracking ───────────────────────────────────────────────────────────

  it('tracks upsell_shown event when drawer opens', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('source-prod')]));
    await cartChangedCallback();

    expect(trackEvent).toHaveBeenCalledWith('upsell_shown', {
      sourceProductId: 'source-prod',
      count: 3,
    });
  });

  // ── Auto-dismiss ───────────────────────────────────────────────────────

  it('auto-dismisses after 8 seconds', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    expect($w('#upsellDrawer').hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(8000);
    expect($w('#upsellDrawer').hide).toHaveBeenCalled();
  });

  it('does not auto-dismiss before 8 seconds', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    vi.advanceTimersByTime(7999);
    expect($w('#upsellDrawer').hide).not.toHaveBeenCalled();
  });

  // ── Close button ──────────────────────────────────────────────────────

  it('close button dismisses drawer immediately', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    const closeHandler = $w('#upsellDrawerClose').onClick.mock.calls[0][0];
    closeHandler();

    expect($w('#upsellDrawer').hide).toHaveBeenCalled();
  });

  it('close button cancels the auto-dismiss timer', async () => {
    initCartUpsell($w);

    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    const closeHandler = $w('#upsellDrawerClose').onClick.mock.calls[0][0];
    closeHandler(); // dismiss + cancel timer
    const hideCallCount = $w('#upsellDrawer').hide.mock.calls.length;

    vi.advanceTimersByTime(8000); // timer should NOT fire again
    expect($w('#upsellDrawer').hide.mock.calls.length).toBe(hideCallCount);
  });

  it('replaces existing timer on new cart add', async () => {
    initCartUpsell($w);

    // First add — sets baseline + triggers upsell
    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1', 1)]));
    await cartChangedCallback();

    vi.advanceTimersByTime(4000); // half-way through first timer

    // Second add — new item, should reset timer
    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1', 2)]));
    await cartChangedCallback();

    vi.advanceTimersByTime(4000); // first timer would have fired by now
    expect($w('#upsellDrawer').hide).not.toHaveBeenCalled(); // old timer replaced

    vi.advanceTimersByTime(4000); // now the new 8s timer fires
    expect($w('#upsellDrawer').hide).toHaveBeenCalled();
  });

  // ── Single onItemReady registration ───────────────────────────────

  it('upsellDrawerClose onClick is registered exactly once on init, not re-registered on cart events', async () => {
    initCartUpsell($w);

    // Trigger multiple cart adds
    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1', 2)]));
    await cartChangedCallback();

    expect($w('#upsellDrawerClose').onClick).toHaveBeenCalledTimes(1);
  });

  it('onItemReady is registered exactly once on init, not re-registered on cart events', async () => {
    initCartUpsell($w);

    // Trigger multiple cart adds
    getCurrentCart.mockResolvedValueOnce(makeCart([]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1')]));
    await cartChangedCallback();

    getCurrentCart.mockResolvedValueOnce(makeCart([makeLineItem('prod-1', 2)]));
    await cartChangedCallback();

    // onItemReady must have been called exactly once (in initCartUpsell)
    expect($w('#upsellRepeater').onItemReady).toHaveBeenCalledTimes(1);
  });

  // ── Concurrency guard ─────────────────────────────────────────────

  it('concurrency guard drops overlapping onCartChanged calls while busy', async () => {
    // Hold getCurrentCart resolution so we can fire concurrent events
    let resolveCart;
    getCurrentCart.mockImplementationOnce(() => new Promise(r => { resolveCart = r; }));

    initCartUpsell($w);

    // Start first event — it will be pending in getCurrentCart
    const first = cartChangedCallback();

    // Fire second event while first is still in-flight — should be dropped
    const second = cartChangedCallback();
    await second; // resolves immediately (busy guard returns)

    // Now let the first event complete with a baseline cart
    resolveCart(makeCart([]));
    await first;

    // Drawer should NOT have been shown (first event was just baseline)
    expect($w('#upsellDrawer').show).not.toHaveBeenCalled();
    // getRecommendations should NOT have been called
    expect(getRecommendations).not.toHaveBeenCalled();
  });
});
