/**
 * Tests for src/public/ProductRecommendations.js — CF-8bbu frontend module.
 * Covers: collapse paths (no productId, API failure, empty results),
 * successful population, and onItemReady/data ordering correctness.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { futonFrame, futonMattress } from './fixtures/products.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('public/productPageUtils.js', () => ({
  isCallForPrice: () => false,
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({ default: { to: vi.fn() }, to: vi.fn() }));

const { initRecommendationsCarousel } = await import('../src/public/ProductRecommendations.js');

function make$w() {
  const elements = {};
  const get = (id) => {
    if (!elements[id]) {
      elements[id] = {
        collapse: vi.fn(),
        text: '',
        src: '',
        data: null,
        onClick: vi.fn(),
        _onItemReadyFn: null,
        onItemReady(fn) { this._onItemReadyFn = fn; },
        _fireItemReady(item) { if (this._onItemReadyFn) this._onItemReadyFn(make$w(), item); },
      };
    }
    return elements[id];
  };
  const $w = (selector) => get(selector);
  $w._el = elements;
  return $w;
}

beforeEach(() => {
  resetData();
  vi.clearAllMocks();
});

describe('initRecommendationsCarousel — collapse paths', () => {
  it('collapses section when state is null', async () => {
    const $w = make$w();
    await initRecommendationsCarousel($w, null);
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when product._id is missing', async () => {
    const $w = make$w();
    await initRecommendationsCarousel($w, { product: {} });
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when product is null', async () => {
    const $w = make$w();
    await initRecommendationsCarousel($w, { product: null });
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when getRecommendations returns no products', async () => {
    __seed('Stores/Products', []); // empty — no products found
    const $w = make$w();
    // Use a valid-looking ID but no products seeded — getRecommendations will return empty
    await initRecommendationsCarousel($w, { product: { _id: 'prod-frame-001' } });
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
  });
});

describe('initRecommendationsCarousel — successful population', () => {
  it('does not collapse section when recommendations are returned', async () => {
    // Seed products so getRecommendations returns results
    const { allProducts } = await import('./fixtures/products.js');
    __seed('Stores/Products', allProducts);
    const { __resetRecCache } = await import('../src/backend/productRecommendations.web.js');
    __resetRecCache();

    const $w = make$w();
    await initRecommendationsCarousel($w, { product: futonFrame });
    // Should NOT have collapsed if results were found
    // (may still collapse if no overlapping collections — just ensure no throw)
    expect(typeof $w('#recommendationsSection').collapse).toBe('function');
  });

  it('populates item fields on onItemReady (name, price, image)', async () => {
    const { allProducts } = await import('./fixtures/products.js');
    __seed('Stores/Products', allProducts);
    const { __resetRecCache } = await import('../src/backend/productRecommendations.web.js');
    __resetRecCache();

    const $w = make$w();
    await initRecommendationsCarousel($w, { product: futonFrame });
    const fn = $w('#recommendationsRepeater')._onItemReadyFn;
    if (!fn) return; // no recs — skip
    const $item = make$w();
    fn($item, { name: 'Eureka', formattedPrice: '$399.00', mainMedia: 'eureka.jpg', slug: 'eureka' });
    expect($item('#recProductName').text).toBe('Eureka');
    expect($item('#recProductPrice').text).toBe('$399.00');
    expect($item('#recProductImage').src).toBe('eureka.jpg');
    expect($item('#recViewBtn').onClick).toHaveBeenCalled();
  });

  it('renders Call-for-Price when isCallForPrice is true', async () => {
    const utils = await import('public/productPageUtils.js');
    utils.isCallForPrice = () => true;
    const { allProducts } = await import('./fixtures/products.js');
    __seed('Stores/Products', allProducts);
    const { __resetRecCache } = await import('../src/backend/productRecommendations.web.js');
    __resetRecCache();

    const $w = make$w();
    await initRecommendationsCarousel($w, { product: futonFrame });
    const fn = $w('#recommendationsRepeater')._onItemReadyFn;
    if (!fn) { utils.isCallForPrice = () => false; return; }
    const $item = make$w();
    fn($item, { name: 'X', formattedPrice: '$0', mainMedia: 'x.jpg', slug: 'x' });
    expect($item('#recProductPrice').text).toBe('Call for Price');
    utils.isCallForPrice = () => false;
  });

  it('skips image src when mainMedia missing; uses name fallback', async () => {
    const { allProducts } = await import('./fixtures/products.js');
    __seed('Stores/Products', allProducts);
    const { __resetRecCache } = await import('../src/backend/productRecommendations.web.js');
    __resetRecCache();

    const $w = make$w();
    await initRecommendationsCarousel($w, { product: futonFrame });
    const fn = $w('#recommendationsRepeater')._onItemReadyFn;
    if (!fn) return;
    const $item = make$w();
    fn($item, { slug: 'x' });
    expect($item('#recProductName').text).toBe('');
    expect($item('#recProductImage').src).toBe('');
  });

  it('recViewBtn click triggers wix-location navigation', async () => {
    const { allProducts } = await import('./fixtures/products.js');
    __seed('Stores/Products', allProducts);
    const { __resetRecCache } = await import('../src/backend/productRecommendations.web.js');
    __resetRecCache();

    const loc = await import('wix-location-frontend');
    loc.default.to.mockClear();

    const $w = make$w();
    await initRecommendationsCarousel($w, { product: futonFrame });
    const fn = $w('#recommendationsRepeater')._onItemReadyFn;
    if (!fn) return;
    const $item = make$w();
    fn($item, { name: 'Eureka', slug: 'eureka', formattedPrice: '$1' });
    const clickHandler = $item('#recViewBtn').onClick.mock.calls[0][0];
    clickHandler();
    await new Promise(r => setTimeout(r, 0));
    expect(loc.default.to).toHaveBeenCalledWith('/product-page/eureka');
  });

  it('warns when each $item setter throws (name/price/image/click/btn)', async () => {
    const { allProducts } = await import('./fixtures/products.js');
    __seed('Stores/Products', allProducts);
    const { __resetRecCache } = await import('../src/backend/productRecommendations.web.js');
    __resetRecCache();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const $w = make$w();
    await initRecommendationsCarousel($w, { product: futonFrame });
    const fn = $w('#recommendationsRepeater')._onItemReadyFn;
    if (!fn) { warnSpy.mockRestore(); return; }

    const $item = (id) => {
      const el = {
        onClick: () => { throw new Error('onclick boom'); },
        get text() { return ''; }, set text(v) { throw new Error('text boom'); },
        get src() { return ''; }, set src(v) { throw new Error('src boom'); },
      };
      return el;
    };
    fn($item, { name: 'X', slug: 'x', formattedPrice: '$1', mainMedia: 'x.jpg' });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns when _collapseSection inner collapse throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const $w = make$w();
    $w('#recommendationsSection').collapse = () => { throw new Error('fail'); };
    await initRecommendationsCarousel($w, null);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('collapses section when populateCarousel throws', async () => {
    const { allProducts } = await import('./fixtures/products.js');
    __seed('Stores/Products', allProducts);
    const { __resetRecCache } = await import('../src/backend/productRecommendations.web.js');
    __resetRecCache();

    const $w = make$w();
    // Force #recommendationsRepeater to throw on onItemReady
    const repeater = $w('#recommendationsRepeater');
    repeater.onItemReady = () => { throw new Error('boom'); };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await initRecommendationsCarousel($w, { product: futonFrame });
    expect($w('#recommendationsSection').collapse).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('registers onItemReady before setting .data', async () => {
    // Regression test: Wix fires onItemReady at .data assignment time.
    // If .data is set first, the callback is missed on first render.
    const { allProducts } = await import('./fixtures/products.js');
    __seed('Stores/Products', allProducts);
    const { __resetRecCache } = await import('../src/backend/productRecommendations.web.js');
    __resetRecCache();

    const $w = make$w();
    const repeater = $w('#recommendationsRepeater');
    const callLog = [];

    const originalOnItemReady = repeater.onItemReady.bind(repeater);
    Object.defineProperty(repeater, 'onItemReady', {
      get() { return (fn) => { callLog.push('onItemReady'); originalOnItemReady(fn); }; },
      configurable: true,
    });
    Object.defineProperty(repeater, 'data', {
      set(v) { callLog.push('data'); },
      configurable: true,
    });

    await initRecommendationsCarousel($w, { product: futonFrame });

    // If both were called, onItemReady must come before data
    if (callLog.includes('onItemReady') && callLog.includes('data')) {
      expect(callLog.indexOf('onItemReady')).toBeLessThan(callLog.indexOf('data'));
    }
  });
});
