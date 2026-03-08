import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from '../fixtures/products.js';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('public/cartService', () => ({
  addToCart: vi.fn().mockResolvedValue({}),
  onCartChanged: vi.fn(),
  getProductVariants: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackCartAdd: vi.fn(),
  trackProductPageView: vi.fn(),
}));

vi.mock('public/product/variantSelector.js', () => ({
  formatCurrency: vi.fn((n) => `$${Number(n).toFixed(2)}`),
}));

vi.mock('wix-window-frontend', () => ({
  default: { onScroll: vi.fn() },
}));

import {
  getSelectedQuantity,
  initQuantitySelector,
  initAddToCartEnhancements,
  updateStickyPrice,
  initStickyCartBar,
} from '../../src/public/product/cartEnhancements.js';
import { addToCart, onCartChanged } from 'public/cartService';
import { trackCartAdd } from 'public/engagementTracker';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onInput: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
    getBoundingRect: vi.fn().mockResolvedValue({ top: 100 }),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('cartEnhancements', () => {
  let $w, product;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    product = { ...futonFrame, _id: 'prod-1' };
  });

  describe('getSelectedQuantity', () => {
    it('returns default quantity of 1', () => {
      // After module re-init, quantity resets
      initQuantitySelector($w);
      expect(getSelectedQuantity()).toBe(1);
    });
  });

  describe('initQuantitySelector', () => {
    it('sets initial quantity input to 1', () => {
      initQuantitySelector($w);
      expect($w('#quantityInput').value).toBe('1');
    });

    it('sets aria labels for accessibility', () => {
      initQuantitySelector($w);
      expect($w('#quantityInput').accessibility.ariaLabel).toBe('Product quantity');
      expect($w('#quantityMinus').accessibility.ariaLabel).toBe('Decrease quantity');
      expect($w('#quantityPlus').accessibility.ariaLabel).toBe('Increase quantity');
    });

    it('registers onInput handler on quantity input', () => {
      initQuantitySelector($w);
      expect($w('#quantityInput').onInput).toHaveBeenCalled();
    });

    it('registers onClick on plus button', () => {
      initQuantitySelector($w);
      expect($w('#quantityPlus').onClick).toHaveBeenCalled();
    });

    it('registers onClick on minus button', () => {
      initQuantitySelector($w);
      expect($w('#quantityMinus').onClick).toHaveBeenCalled();
    });

    it('plus button increments quantity', () => {
      initQuantitySelector($w);
      const plusCb = $w('#quantityPlus').onClick.mock.calls[0][0];
      plusCb();
      expect(getSelectedQuantity()).toBe(2);
      expect($w('#quantityInput').value).toBe('2');
    });

    it('plus button caps at 99', () => {
      initQuantitySelector($w);
      const plusCb = $w('#quantityPlus').onClick.mock.calls[0][0];
      // Increment to 99
      for (let i = 0; i < 99; i++) plusCb();
      expect(getSelectedQuantity()).toBe(99);
      // One more should not go beyond 99
      plusCb();
      expect(getSelectedQuantity()).toBe(99);
    });

    it('minus button decrements quantity', () => {
      initQuantitySelector($w);
      const plusCb = $w('#quantityPlus').onClick.mock.calls[0][0];
      const minusCb = $w('#quantityMinus').onClick.mock.calls[0][0];
      plusCb(); // 2
      plusCb(); // 3
      minusCb(); // 2
      expect(getSelectedQuantity()).toBe(2);
      expect($w('#quantityInput').value).toBe('2');
    });

    it('minus button does not go below 1', () => {
      initQuantitySelector($w);
      const minusCb = $w('#quantityMinus').onClick.mock.calls[0][0];
      minusCb();
      minusCb();
      expect(getSelectedQuantity()).toBe(1);
    });

    it('onInput accepts valid numeric values', () => {
      initQuantitySelector($w);
      const inputCb = $w('#quantityInput').onInput.mock.calls[0][0];

      $w('#quantityInput').value = '5';
      inputCb();
      expect(getSelectedQuantity()).toBe(5);
    });

    it('onInput resets to 1 for zero', () => {
      initQuantitySelector($w);
      const inputCb = $w('#quantityInput').onInput.mock.calls[0][0];

      $w('#quantityInput').value = '0';
      inputCb();
      expect(getSelectedQuantity()).toBe(1);
      expect($w('#quantityInput').value).toBe('1');
    });

    it('onInput resets to 1 for negative numbers', () => {
      initQuantitySelector($w);
      const inputCb = $w('#quantityInput').onInput.mock.calls[0][0];

      $w('#quantityInput').value = '-3';
      inputCb();
      expect(getSelectedQuantity()).toBe(1);
    });

    it('onInput resets to 1 for values over 99', () => {
      initQuantitySelector($w);
      const inputCb = $w('#quantityInput').onInput.mock.calls[0][0];

      $w('#quantityInput').value = '100';
      inputCb();
      expect(getSelectedQuantity()).toBe(1);
    });

    it('onInput resets to 1 for non-numeric input', () => {
      initQuantitySelector($w);
      const inputCb = $w('#quantityInput').onInput.mock.calls[0][0];

      $w('#quantityInput').value = 'abc';
      inputCb();
      expect(getSelectedQuantity()).toBe(1);
    });

    it('onInput accepts boundary value 99', () => {
      initQuantitySelector($w);
      const inputCb = $w('#quantityInput').onInput.mock.calls[0][0];

      $w('#quantityInput').value = '99';
      inputCb();
      expect(getSelectedQuantity()).toBe(99);
    });

    it('onInput accepts boundary value 1', () => {
      initQuantitySelector($w);
      const inputCb = $w('#quantityInput').onInput.mock.calls[0][0];

      $w('#quantityInput').value = '1';
      inputCb();
      expect(getSelectedQuantity()).toBe(1);
    });
  });

  describe('initAddToCartEnhancements', () => {
    it('registers click handler on add-to-cart button', () => {
      initAddToCartEnhancements($w, product);
      expect($w('#addToCartButton').onClick).toHaveBeenCalled();
    });

    it('registers cart changed listener', () => {
      initAddToCartEnhancements($w, product);
      expect(onCartChanged).toHaveBeenCalled();
    });

    it('add-to-cart click calls addToCart with product and quantity', async () => {
      initQuantitySelector($w);
      initAddToCartEnhancements($w, product);

      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();

      expect(addToCart).toHaveBeenCalledWith('prod-1', 1);
      expect(trackCartAdd).toHaveBeenCalledWith(product, 1);
    });

    it('add-to-cart click disables button and shows "Adding..."', async () => {
      initAddToCartEnhancements($w, product);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#addToCartButton').disable).toHaveBeenCalled();
      // After success, label becomes "Added!"
      expect($w('#addToCartButton').label).toBe('Added!');
    });

    it('add-to-cart shows error label on failure', async () => {
      addToCart.mockRejectedValueOnce(new Error('Network error'));
      initAddToCartEnhancements($w, product);

      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#addToCartButton').label).toBe('Error — Try Again');
    });

    it('does nothing when product is null', async () => {
      initAddToCartEnhancements($w, null);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();

      expect(addToCart).not.toHaveBeenCalled();
    });

    it('cart changed listener shows success feedback', () => {
      initAddToCartEnhancements($w, product);
      const cartChangedCb = onCartChanged.mock.calls[0][0];
      cartChangedCb();

      expect($w('#addToCartSuccess').show).toHaveBeenCalled();
    });

    it('uses current quantity from quantity selector', async () => {
      initQuantitySelector($w);
      const plusCb = $w('#quantityPlus').onClick.mock.calls[0][0];
      plusCb(); // qty = 2
      plusCb(); // qty = 3

      initAddToCartEnhancements($w, product);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();

      expect(addToCart).toHaveBeenCalledWith('prod-1', 3);
      expect(trackCartAdd).toHaveBeenCalledWith(product, 3);
    });
  });

  describe('updateStickyPrice', () => {
    it('updates sticky price text', () => {
      updateStickyPrice($w, { price: 599 });
      expect($w('#stickyPrice').text).toBe('$599.00');
    });

    it('handles null variant gracefully', () => {
      expect(() => updateStickyPrice($w, null)).not.toThrow();
    });

    it('handles undefined variant gracefully', () => {
      expect(() => updateStickyPrice($w, undefined)).not.toThrow();
    });

    it('handles variant without price gracefully', () => {
      expect(() => updateStickyPrice($w, { name: 'test' })).not.toThrow();
      expect($w('#stickyPrice').text).toBe('');
    });

    it('formats decimal prices correctly', () => {
      updateStickyPrice($w, { price: 149.50 });
      expect($w('#stickyPrice').text).toBe('$149.50');
    });
  });

  describe('initStickyCartBar', () => {
    it('initially hides sticky bar', () => {
      initStickyCartBar($w, product);
      expect($w('#stickyCartBar').hide).toHaveBeenCalled();
    });

    it('sets product name in sticky bar', () => {
      initStickyCartBar($w, product);
      expect($w('#stickyProductName').text).toBe(product.name);
    });

    it('sets product price in sticky bar', () => {
      initStickyCartBar($w, product);
      expect($w('#stickyPrice').text).toBe(product.formattedPrice);
    });

    it('registers click handler on sticky add button', () => {
      initStickyCartBar($w, product);
      expect($w('#stickyAddBtn').onClick).toHaveBeenCalled();
    });

    it('registers scroll listener', async () => {
      const wixWindow = (await import('wix-window-frontend')).default;
      initStickyCartBar($w, product);
      expect(wixWindow.onScroll).toHaveBeenCalled();
    });

    it('sticky add button calls addToCart', async () => {
      initQuantitySelector($w);
      initStickyCartBar($w, product);
      const clickCb = $w('#stickyAddBtn').onClick.mock.calls[0][0];
      await clickCb();

      expect(addToCart).toHaveBeenCalledWith('prod-1', 1);
      expect(trackCartAdd).toHaveBeenCalledWith(product, 1);
      expect($w('#stickyAddBtn').label).toBe('Added!');
    });

    it('sticky add button shows error on failure', async () => {
      addToCart.mockRejectedValueOnce(new Error('Cart error'));
      initStickyCartBar($w, product);
      const clickCb = $w('#stickyAddBtn').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#stickyAddBtn').label).toBe('Error — Try Again');
    });

    it('sticky add button disables during add', async () => {
      initStickyCartBar($w, product);
      const clickCb = $w('#stickyAddBtn').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#stickyAddBtn').disable).toHaveBeenCalled();
    });

    it('does not throw when product is null', () => {
      expect(() => initStickyCartBar($w, null)).not.toThrow();
    });

    it('scroll handler shows sticky bar when add-to-cart scrolls out of view', async () => {
      const wixWindow = (await import('wix-window-frontend')).default;
      initStickyCartBar($w, product);

      const scrollCb = wixWindow.onScroll.mock.calls[0][0];
      // Simulate button scrolled above viewport
      $w('#addToCartButton').getBoundingRect.mockResolvedValue({ top: -50 });

      // Mock requestAnimationFrame
      const origRAF = globalThis.requestAnimationFrame;
      globalThis.requestAnimationFrame = (cb) => cb();

      await scrollCb();

      expect($w('#stickyCartBar').show).toHaveBeenCalled();

      globalThis.requestAnimationFrame = origRAF;
    });

    it('scroll handler hides sticky bar when button is visible', async () => {
      const wixWindow = (await import('wix-window-frontend')).default;
      initStickyCartBar($w, product);

      const scrollCb = wixWindow.onScroll.mock.calls[0][0];

      const origRAF = globalThis.requestAnimationFrame;
      globalThis.requestAnimationFrame = (cb) => cb();

      // First scroll: button out of view → show
      $w('#addToCartButton').getBoundingRect.mockResolvedValue({ top: -50 });
      await scrollCb();
      expect($w('#stickyCartBar').show).toHaveBeenCalled();

      // Second scroll: button back in view → hide
      $w('#addToCartButton').getBoundingRect.mockResolvedValue({ top: 200 });
      await scrollCb();
      expect($w('#stickyCartBar').hide).toHaveBeenCalledTimes(2); // initial hide + scroll hide

      globalThis.requestAnimationFrame = origRAF;
    });

    it('scroll handler throttles via requestAnimationFrame — second scroll ignored while ticking', async () => {
      const wixWindow = (await import('wix-window-frontend')).default;
      initStickyCartBar($w, product);

      const scrollCb = wixWindow.onScroll.mock.calls[0][0];

      const rafCallbacks = [];
      const origRAF = globalThis.requestAnimationFrame;
      globalThis.requestAnimationFrame = (cb) => { rafCallbacks.push(cb); };

      // First scroll queues a RAF
      scrollCb();
      expect(rafCallbacks.length).toBe(1);

      // Second scroll while first RAF is pending — should be dropped
      scrollCb();
      expect(rafCallbacks.length).toBe(1); // still only 1 RAF queued

      // Third scroll — also dropped
      scrollCb();
      expect(rafCallbacks.length).toBe(1);

      // Resolve the single queued RAF
      $w('#addToCartButton').getBoundingRect.mockResolvedValue({ top: 100 });
      await rafCallbacks[0]();

      // After RAF resolves, scrollTicking resets — new scroll should queue again
      scrollCb();
      expect(rafCallbacks.length).toBe(2); // now a second RAF is queued

      globalThis.requestAnimationFrame = origRAF;
    });
  });
});
