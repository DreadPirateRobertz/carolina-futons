/**
 * Tests for src/public/YouMightAlsoLike.js — CF-e50.
 * "You might also like" 4-item grid on PDP.
 * Covers: collapse on missing state, empty results, error fallback,
 * happy-path grid population, call-for-price formatting, image/name/price,
 * and view-button navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('public/productPageUtils.js', () => ({
  isCallForPrice: vi.fn((p) => p.price <= 1),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));

vi.mock('wix-location-frontend', () => ({
  default: { to: vi.fn() },
  to: vi.fn(),
}));

const { initYouMightAlsoLike } = await import('../src/public/YouMightAlsoLike.js');

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  const id = overrides._id ?? `prod-${Math.random().toString(36).slice(2, 7)}`;
  return {
    _id: id,
    name: 'Test Futon Frame',
    slug: 'test-futon-frame',
    price: 499,
    formattedPrice: '$499.00',
    mainMedia: 'https://example.com/frame.jpg',
    collections: ['futon-frames'],
    material: 'hardwood',
    ...overrides,
  };
}

function makeEl() {
  return {
    text: '',
    src: '',
    html: '',
    _data: null,
    _visible: true,
    _onItemReady: null,
    show: vi.fn().mockImplementation(function () { this._visible = true; }),
    hide: vi.fn().mockImplementation(function () { this._visible = false; }),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    get data() { return this._data; },
    set data(v) { this._data = v; },
    onItemReady: vi.fn().mockImplementation(function (cb) { this._onItemReady = cb; }),
  };
}

function make$w() {
  const els = {};
  const $w = vi.fn((id) => {
    if (!els[id]) els[id] = makeEl();
    return els[id];
  });
  $w._els = els;
  return $w;
}

function makeState(overrides = {}) {
  return {
    product: {
      _id: 'prod-frame-001',
      collections: ['futon-frames'],
      material: 'hardwood',
      price: 499,
      ...overrides,
    },
  };
}

// ── Collapse paths ────────────────────────────────────────────────────────────

describe('initYouMightAlsoLike — collapse paths', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('collapses section when state is null', async () => {
    await initYouMightAlsoLike($w, null);
    expect($w('#youMightAlsoLikeSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when product is missing', async () => {
    await initYouMightAlsoLike($w, {});
    expect($w('#youMightAlsoLikeSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when product has no _id', async () => {
    await initYouMightAlsoLike($w, { product: { collections: ['futon-frames'] } });
    expect($w('#youMightAlsoLikeSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when getSimilarProducts returns success:false', async () => {
    const getSimilarProducts = vi.fn().mockResolvedValue({ success: false, products: [] });
    await initYouMightAlsoLike($w, makeState(), { getSimilarProducts });
    expect($w('#youMightAlsoLikeSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when products array is empty', async () => {
    const getSimilarProducts = vi.fn().mockResolvedValue({ success: true, products: [] });
    await initYouMightAlsoLike($w, makeState(), { getSimilarProducts });
    expect($w('#youMightAlsoLikeSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when getSimilarProducts throws', async () => {
    const getSimilarProducts = vi.fn().mockRejectedValue(new Error('backend down'));
    await initYouMightAlsoLike($w, makeState(), { getSimilarProducts });
    expect($w('#youMightAlsoLikeSection').collapse).toHaveBeenCalled();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('initYouMightAlsoLike — happy path', () => {
  let $w;
  const products = [
    makeProduct({ _id: 'p1', name: 'Frame A', formattedPrice: '$399.00', price: 399 }),
    makeProduct({ _id: 'p2', name: 'Frame B', formattedPrice: '$499.00', price: 499 }),
    makeProduct({ _id: 'p3', name: 'Mattress C', formattedPrice: '$199.00', price: 199 }),
    makeProduct({ _id: 'p4', name: 'Frame D', formattedPrice: '$599.00', price: 599 }),
  ];

  beforeEach(() => { $w = make$w(); });

  it('expands section when products are available', async () => {
    const getSimilarProducts = vi.fn().mockResolvedValue({ success: true, products });
    await initYouMightAlsoLike($w, makeState(), { getSimilarProducts });
    expect($w('#youMightAlsoLikeSection').expand).toHaveBeenCalled();
  });

  it('sets repeater data with up to 4 products', async () => {
    const getSimilarProducts = vi.fn().mockResolvedValue({ success: true, products });
    await initYouMightAlsoLike($w, makeState(), { getSimilarProducts });
    const data = $w('#youMightAlsoLikeGrid').data;
    expect(data).toHaveLength(4);
  });

  it('caps grid at 4 items even when more products returned', async () => {
    const moreProducts = Array.from({ length: 8 }, (_, i) =>
      makeProduct({ _id: `p${i}`, name: `Product ${i}`, price: 300 + i * 50 })
    );
    const getSimilarProducts = vi.fn().mockResolvedValue({ success: true, products: moreProducts });
    await initYouMightAlsoLike($w, makeState(), { getSimilarProducts });
    expect($w('#youMightAlsoLikeGrid').data).toHaveLength(4);
  });

  it('passes productId to getSimilarProducts', async () => {
    const getSimilarProducts = vi.fn().mockResolvedValue({ success: true, products });
    await initYouMightAlsoLike($w, makeState({ _id: 'prod-abc' }), { getSimilarProducts });
    expect(getSimilarProducts).toHaveBeenCalledWith('prod-abc', expect.objectContaining({ limit: 4 }));
  });

  it('registers onItemReady before setting data (Wix requirement)', async () => {
    const getSimilarProducts = vi.fn().mockResolvedValue({ success: true, products });
    const callOrder = [];
    const grid = make$w()('#youMightAlsoLikeGrid');
    grid.onItemReady = vi.fn().mockImplementation(() => { callOrder.push('onItemReady'); });
    Object.defineProperty(grid, 'data', {
      set: () => callOrder.push('data'),
      get: () => null,
    });
    const $w2 = vi.fn((id) => id === '#youMightAlsoLikeGrid' ? grid : make$w()(id));
    await initYouMightAlsoLike($w2, makeState(), { getSimilarProducts });
    expect(callOrder.indexOf('onItemReady')).toBeLessThan(callOrder.indexOf('data'));
  });
});

// ── onItemReady rendering ─────────────────────────────────────────────────────

describe('initYouMightAlsoLike — onItemReady', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  async function runAndGetHandler(productOverrides = {}) {
    const product = makeProduct({ _id: 'p1', ...productOverrides });
    const getSimilarProducts = vi.fn().mockResolvedValue({ success: true, products: [product] });
    await initYouMightAlsoLike($w, makeState(), { getSimilarProducts });
    return $w('#youMightAlsoLikeGrid')._onItemReady;
  }

  it('sets product name in onItemReady', async () => {
    const handler = await runAndGetHandler({ name: 'Comfy Frame' });
    const $item = make$w();
    handler($item, { _id: 'p1', name: 'Comfy Frame', formattedPrice: '$399.00', price: 399, mainMedia: null, slug: 'comfy-frame' });
    expect($item('#ymItem_name').text).toBe('Comfy Frame');
  });

  it('sets formatted price in onItemReady', async () => {
    const handler = await runAndGetHandler({ price: 599 });
    const $item = make$w();
    handler($item, { _id: 'p1', name: 'Frame', formattedPrice: '$599.00', price: 599, mainMedia: null, slug: 'frame' });
    expect($item('#ymItem_price').text).toBe('$599.00');
  });

  it('shows Call for Price for call-for-price products', async () => {
    const handler = await runAndGetHandler({ price: 0 });
    const $item = make$w();
    handler($item, { _id: 'p1', name: 'Frame', formattedPrice: '$0.00', price: 0, mainMedia: null, slug: 'frame' });
    expect($item('#ymItem_price').text).toBe('Call for Price');
  });

  it('sets image src when mainMedia present', async () => {
    const handler = await runAndGetHandler({ mainMedia: 'https://cdn.example.com/frame.jpg' });
    const $item = make$w();
    handler($item, { _id: 'p1', name: 'Frame', formattedPrice: '$499.00', price: 499, mainMedia: 'https://cdn.example.com/frame.jpg', slug: 'frame' });
    expect($item('#ymItem_image').src).toBe('https://cdn.example.com/frame.jpg');
  });

  it('does not set image src when mainMedia is null', async () => {
    const handler = await runAndGetHandler({ mainMedia: null });
    const $item = make$w();
    handler($item, { _id: 'p1', name: 'Frame', formattedPrice: '$499.00', price: 499, mainMedia: null, slug: 'frame' });
    expect($item('#ymItem_image').src).toBe(''); // unchanged
  });
});
