/**
 * recentlyViewedWidget.test.js
 *
 * Unit tests for src/public/RecentlyViewedWidget.js
 *
 * Covers:
 *  - trackView: stores entry, dedup (move to front), max-8 cap
 *  - trackView: localStorage unavailable — no throw
 *  - trackView: missing/invalid productId — no throw
 *  - renderWidget: empty history → section collapsed
 *  - renderWidget: items present → getProduct fetched, onItemReady BEFORE .data
 *  - renderWidget: sets image, name, price, link onClick
 *  - renderWidget: getProduct returns null → item filtered out
 *  - renderWidget: getProduct throws → item skipped gracefully
 *  - renderWidget: all items null → section collapsed
 *  - renderWidget: excludeCurrentId — current product excluded
 *  - renderWidget: title set to 'Recently Viewed'
 *  - renderWidget: clear button wired
 *  - clearHistory: localStorage cleared, section collapsed
 *  - destroy: cleanup — no throw
 *  - max-8 cap enforced in trackView
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('wix-stores-frontend', () => ({
  default: {
    products: {
      getProduct: vi.fn(),
    },
  },
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

import {
  trackView,
  renderWidget,
  clearHistory,
  destroy,
} from '../src/public/RecentlyViewedWidget.js';
import wixStoresFrontend from 'wix-stores-frontend';
import { to } from 'wix-location-frontend';

const getProduct = wixStoresFrontend.products.getProduct;

// ── Helpers ────────────────────────────────────────────────────────────────

const LS_KEY = 'cf_recently_viewed';

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Sedona Futon Frame',
    slug: 'sedona-futon-frame',
    formattedPrice: '$599.00',
    mainMedia: 'https://example.com/sedona.jpg',
    ...overrides,
  };
}

function createMockElement() {
  return {
    text: '', src: '', alt: '', data: [],
    accessibility: { ariaLabel: '', role: '' },
    expand: vi.fn(), collapse: vi.fn(),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
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

function getLSHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { return []; }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('RecentlyViewedWidget', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    $w = create$w();
    getProduct.mockResolvedValue(makeProduct());
  });

  afterEach(() => {
    localStorage.clear();
    destroy();
  });

  // ── trackView ────────────────────────────────────────────────────

  describe('trackView', () => {
    it('stores productId in localStorage', () => {
      trackView('prod-1');
      const history = getLSHistory();
      expect(history[0]).toBe('prod-1');
    });

    it('stores newest entry at index 0', () => {
      trackView('prod-1');
      trackView('prod-2');
      expect(getLSHistory()[0]).toBe('prod-2');
    });

    it('deduplicates — moves existing entry to front', () => {
      trackView('prod-1');
      trackView('prod-2');
      trackView('prod-1');
      const history = getLSHistory();
      expect(history[0]).toBe('prod-1');
      expect(history.filter(id => id === 'prod-1')).toHaveLength(1);
    });

    it('caps at 8 entries', () => {
      for (let i = 1; i <= 12; i++) trackView(`prod-${i}`);
      expect(getLSHistory()).toHaveLength(8);
    });

    it('keeps the 8 most recent after cap', () => {
      for (let i = 1; i <= 10; i++) trackView(`prod-${i}`);
      const history = getLSHistory();
      expect(history[0]).toBe('prod-10');
      expect(history).not.toContain('prod-1');
      expect(history).not.toContain('prod-2');
    });

    it('does not throw when productId is null', () => {
      expect(() => trackView(null)).not.toThrow();
    });

    it('does not throw when productId is undefined', () => {
      expect(() => trackView(undefined)).not.toThrow();
    });

    it('does not store null or undefined productId', () => {
      trackView(null);
      trackView(undefined);
      expect(getLSHistory()).toHaveLength(0);
    });

    it('does not throw when localStorage.setItem throws', () => {
      const orig = localStorage.setItem.bind(localStorage);
      Object.defineProperty(localStorage, 'setItem', { value: () => { throw new Error('QuotaExceededError'); }, configurable: true });
      expect(() => trackView('prod-1')).not.toThrow();
      Object.defineProperty(localStorage, 'setItem', { value: orig, configurable: true });
    });

    it('does not throw when localStorage.getItem throws', () => {
      const orig = localStorage.getItem.bind(localStorage);
      Object.defineProperty(localStorage, 'getItem', { value: () => { throw new Error('SecurityError'); }, configurable: true });
      expect(() => trackView('prod-1')).not.toThrow();
      Object.defineProperty(localStorage, 'getItem', { value: orig, configurable: true });
    });
  });

  // ── renderWidget ─────────────────────────────────────────────────

  describe('renderWidget', () => {
    it('collapses section when history is empty', async () => {
      await renderWidget($w);
      expect($w('#recentlyViewedSection').collapse).toHaveBeenCalled();
    });

    it('does not call getProduct when history is empty', async () => {
      await renderWidget($w);
      expect(getProduct).not.toHaveBeenCalled();
    });

    it('calls getProduct for each stored productId', async () => {
      trackView('prod-1');
      trackView('prod-2');
      await renderWidget($w);
      expect(getProduct).toHaveBeenCalledWith('prod-1');
      expect(getProduct).toHaveBeenCalledWith('prod-2');
      expect(getProduct).toHaveBeenCalledTimes(2);
    });

    it('registers onItemReady BEFORE assigning .data', async () => {
      trackView('prod-1');
      const callOrder = [];
      $w('#recentlyViewedRepeater').onItemReady = vi.fn(() => callOrder.push('onItemReady'));
      Object.defineProperty($w('#recentlyViewedRepeater'), 'data', {
        set() { callOrder.push('data'); },
        get() { return []; },
        configurable: true,
      });
      await renderWidget($w);
      expect(callOrder.indexOf('onItemReady')).toBeLessThan(callOrder.indexOf('data'));
    });

    it('expands section when products are fetched', async () => {
      trackView('prod-1');
      getProduct.mockResolvedValueOnce(makeProduct({ _id: 'prod-1' }));
      await renderWidget($w);
      expect($w('#recentlyViewedSection').expand).toHaveBeenCalled();
    });

    it('sets section title to "Recently Viewed"', async () => {
      trackView('prod-1');
      await renderWidget($w);
      expect($w('#recentlyViewedTitle').text).toBe('Recently Viewed');
    });

    it('collapses section when all getProduct calls return null', async () => {
      trackView('prod-1');
      trackView('prod-2');
      getProduct.mockResolvedValue(null);
      await renderWidget($w);
      expect($w('#recentlyViewedSection').collapse).toHaveBeenCalled();
      expect($w('#recentlyViewedSection').expand).not.toHaveBeenCalled();
    });

    it('skips null getProduct results — only valid products in .data', async () => {
      trackView('prod-1');
      trackView('prod-2');
      getProduct
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeProduct({ _id: 'prod-2' }));
      await renderWidget($w);
      const data = $w('#recentlyViewedRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]._id).toBe('prod-2');
    });

    it('skips products where getProduct throws', async () => {
      trackView('prod-1');
      trackView('prod-2');
      getProduct
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(makeProduct({ _id: 'prod-2' }));
      await renderWidget($w);
      const data = $w('#recentlyViewedRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]._id).toBe('prod-2');
    });

    it('excludes current product when excludeCurrentId given', async () => {
      trackView('prod-1');
      trackView('prod-2');
      getProduct
        .mockResolvedValueOnce(makeProduct({ _id: 'prod-2' }))
        .mockResolvedValueOnce(makeProduct({ _id: 'prod-1' }));
      await renderWidget($w, { excludeCurrentId: 'prod-1' });
      const data = $w('#recentlyViewedRepeater').data;
      expect(data.map(p => p._id)).not.toContain('prod-1');
    });

    it('sets aria-label on recentlyViewedClear button', async () => {
      trackView('prod-1');
      await renderWidget($w);
      expect($w('#recentlyViewedClear').accessibility.ariaLabel).toBe('Clear recently viewed items');
    });

    it('wires the clear button onClick', async () => {
      trackView('prod-1');
      await renderWidget($w);
      expect($w('#recentlyViewedClear').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('clicking clear button collapses section', async () => {
      trackView('prod-1');
      await renderWidget($w);
      const clearHandler = $w('#recentlyViewedClear').onClick.mock.calls[0][0];
      clearHandler();
      expect($w('#recentlyViewedSection').collapse).toHaveBeenCalled();
    });

    it('clicking clear button empties localStorage', async () => {
      trackView('prod-1');
      await renderWidget($w);
      const clearHandler = $w('#recentlyViewedClear').onClick.mock.calls[0][0];
      clearHandler();
      expect(getLSHistory()).toHaveLength(0);
    });

    it('does not throw when localStorage is unavailable during render', async () => {
      const orig = localStorage.getItem.bind(localStorage);
      Object.defineProperty(localStorage, 'getItem', { value: () => { throw new Error('SecurityError'); }, configurable: true });
      await expect(renderWidget($w)).resolves.not.toThrow();
      Object.defineProperty(localStorage, 'getItem', { value: orig, configurable: true });
    });

    it('does not expand section when excludeCurrentId removes all items', async () => {
      trackView('prod-1');
      getProduct.mockResolvedValueOnce(makeProduct({ _id: 'prod-1' }));
      await renderWidget($w, { excludeCurrentId: 'prod-1' });
      expect($w('#recentlyViewedSection').expand).not.toHaveBeenCalled();
    });
  });

  // ── onItemReady callbacks ────────────────────────────────────────

  describe('onItemReady item wiring', () => {
    async function getItemReadyCb() {
      trackView('prod-1');
      getProduct.mockResolvedValueOnce(makeProduct({
        _id: 'prod-1',
        name: 'Sedona Frame',
        formattedPrice: '$599.00',
        mainMedia: 'https://example.com/sedona.jpg',
        slug: 'sedona-futon-frame',
      }));
      await renderWidget($w);
      return $w('#recentlyViewedRepeater').onItemReady.mock.calls[0][0];
    }

    it('sets src on recentItemImage', async () => {
      const cb = await getItemReadyCb();
      const $item = create$w();
      cb($item, makeProduct({ mainMedia: 'https://example.com/sedona.jpg' }));
      expect($item('#recentItemImage').src).toBe('https://example.com/sedona.jpg');
    });

    it('sets alt to product name on recentItemImage', async () => {
      const cb = await getItemReadyCb();
      const $item = create$w();
      cb($item, makeProduct({ name: 'Sedona Frame' }));
      expect($item('#recentItemImage').alt).toBe('Sedona Frame');
    });

    it('sets recentItemName text', async () => {
      const cb = await getItemReadyCb();
      const $item = create$w();
      cb($item, makeProduct({ name: 'Sedona Frame' }));
      expect($item('#recentItemName').text).toBe('Sedona Frame');
    });

    it('sets recentItemPrice text from formattedPrice', async () => {
      const cb = await getItemReadyCb();
      const $item = create$w();
      cb($item, makeProduct({ formattedPrice: '$599.00' }));
      expect($item('#recentItemPrice').text).toBe('$599.00');
    });

    it('wires recentItemLink onClick', async () => {
      const cb = await getItemReadyCb();
      const $item = create$w();
      cb($item, makeProduct());
      expect($item('#recentItemLink').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('recentItemLink onClick navigates to product page', async () => {
      const cb = await getItemReadyCb();
      const $item = create$w();
      cb($item, makeProduct({ slug: 'sedona-futon-frame' }));
      const handler = $item('#recentItemLink').onClick.mock.calls[0][0];
      handler();
      expect(to).toHaveBeenCalledWith('/product-page/sedona-futon-frame');
    });
  });

  // ── clearHistory ─────────────────────────────────────────────────

  describe('clearHistory', () => {
    it('clears localStorage', () => {
      trackView('prod-1');
      clearHistory($w);
      expect(getLSHistory()).toHaveLength(0);
    });

    it('collapses section', () => {
      clearHistory($w);
      expect($w('#recentlyViewedSection').collapse).toHaveBeenCalled();
    });

    it('does not throw when $w is null', () => {
      expect(() => clearHistory(null)).not.toThrow();
    });

    it('does not throw when localStorage.removeItem throws', () => {
      const orig = localStorage.removeItem.bind(localStorage);
      Object.defineProperty(localStorage, 'removeItem', { value: () => { throw new Error('SecurityError'); }, configurable: true });
      expect(() => clearHistory($w)).not.toThrow();
      Object.defineProperty(localStorage, 'removeItem', { value: orig, configurable: true });
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('does not throw', () => {
      expect(() => destroy()).not.toThrow();
    });

    it('can be called multiple times without error', () => {
      expect(() => { destroy(); destroy(); destroy(); }).not.toThrow();
    });
  });
});
