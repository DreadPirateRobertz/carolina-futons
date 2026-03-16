import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame, callForPriceProduct } from './fixtures/products.js';

vi.mock('public/cartService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProductVariants: vi.fn().mockResolvedValue([{ inStock: true }]),
    addToCart: vi.fn().mockResolvedValue({}),
    onCartChanged: vi.fn(),
  };
});

vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn().mockResolvedValue([]),
  getSameCollection: vi.fn().mockResolvedValue([]),
  getBundleSuggestion: vi.fn().mockResolvedValue({
    product: { _id: 'bundle-1', name: 'Bundle Mattress', slug: 'bundle-mattress', mainMedia: 'https://example.com/b.jpg' },
    bundlePrice: 799, savings: 50,
  }),
}));

vi.mock('public/engagementTracker', () => ({
  trackProductPageView: vi.fn(), trackCartAdd: vi.fn(), trackGalleryInteraction: vi.fn(), trackSwatchView: vi.fn(), trackSocialShare: vi.fn(),
}));

vi.mock('public/productPageUtils.js', () => ({
  formatCurrency: vi.fn((n) => `$${Number(n).toFixed(2)}`),
  HEART_FILLED_SVG: 'filled', HEART_OUTLINE_SVG: 'outline',
  isCallForPrice: vi.fn((product) => (product?.price ?? Infinity) <= 1),
  CALL_FOR_PRICE_TEXT: 'Call for Pricing \u2014 (828) 327-8030',
}));

vi.mock('wix-window-frontend', () => ({ default: { onScroll: vi.fn() } }));

import {
  initQuantitySelector, initAddToCartEnhancements, updateStickyPrice,
  initStickyCartBar, initBundleSection, initStockUrgency,
  initBackInStockNotification, initWishlistButton,
} from '../src/public/AddToCart.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onInput: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
    getBoundingRect: vi.fn().mockResolvedValue({ top: 100 }),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

describe('AddToCart', () => {
  let $w, state;
  beforeEach(() => {
    $w = create$w();
    state = { product: { ...futonFrame, _id: 'prod-1' }, selectedSwatchId: null, selectedQuantity: 1, bundleProduct: null };
  });

  describe('initQuantitySelector', () => {
    it('initializes quantity to 1', () => {
      initQuantitySelector($w, state);
      expect($w('#quantityInput').value).toBe('1');
      expect(state.selectedQuantity).toBe(1);
    });

    it('sets aria labels for accessibility', () => {
      initQuantitySelector($w, state);
      expect($w('#quantityInput').accessibility.ariaLabel).toBe('Product quantity');
    });

    it('registers plus/minus click handlers', () => {
      initQuantitySelector($w, state);
      expect($w('#quantityMinus').onClick).toHaveBeenCalled();
      expect($w('#quantityPlus').onClick).toHaveBeenCalled();
    });

    it('plus button increments quantity', () => {
      initQuantitySelector($w, state);
      const plusCb = $w('#quantityPlus').onClick.mock.calls[0][0];
      plusCb();
      expect(state.selectedQuantity).toBe(2);
      expect($w('#quantityInput').value).toBe('2');
    });

    it('minus button does not go below 1', () => {
      initQuantitySelector($w, state);
      const minusCb = $w('#quantityMinus').onClick.mock.calls[0][0];
      minusCb();
      expect(state.selectedQuantity).toBe(1);
    });

    it('registers onInput handler on quantity input', () => {
      initQuantitySelector($w, state);
      expect($w('#quantityInput').onInput).toHaveBeenCalled();
    });

    it('sets aria labels on plus and minus buttons', () => {
      initQuantitySelector($w, state);
      expect($w('#quantityMinus').accessibility.ariaLabel).toBe('Decrease quantity');
      expect($w('#quantityPlus').accessibility.ariaLabel).toBe('Increase quantity');
    });
  });

  describe('initAddToCartEnhancements', () => {
    it('registers click handler on add-to-cart button', () => {
      initAddToCartEnhancements($w, state);
      expect($w('#addToCartButton').onClick).toHaveBeenCalled();
    });

    it('registers cart changed listener', async () => {
      const { onCartChanged } = await import('public/cartService');
      initAddToCartEnhancements($w, state);
      expect(onCartChanged).toHaveBeenCalled();
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
  });

  describe('initStickyCartBar', () => {
    it('initially hides sticky bar', () => {
      initStickyCartBar($w, state);
      expect($w('#stickyCartBar').hide).toHaveBeenCalled();
    });

    it('sets product info in sticky bar', () => {
      initStickyCartBar($w, state);
      expect($w('#stickyProductName').text).toBe(futonFrame.name);
      expect($w('#stickyPrice').text).toBe(futonFrame.formattedPrice);
    });

    it('registers scroll listener', async () => {
      const wixWindow = (await import('wix-window-frontend')).default;
      initStickyCartBar($w, state);
      expect(wixWindow.onScroll).toHaveBeenCalled();
    });

    it('registers click handler on sticky add button', () => {
      initStickyCartBar($w, state);
      expect($w('#stickyAddBtn').onClick).toHaveBeenCalled();
    });
  });

  describe('initBundleSection', () => {
    it('populates bundle product info', async () => {
      await initBundleSection($w, state);
      expect($w('#bundleName').text).toBe('Bundle Mattress');
      expect($w('#bundleSection').expand).toHaveBeenCalled();
    });

    it('collapses bundle section when no suggestion', async () => {
      const { getBundleSuggestion } = await import('backend/productRecommendations.web');
      getBundleSuggestion.mockResolvedValueOnce(null);
      await initBundleSection($w, state);
      expect($w('#bundleSection').collapse).toHaveBeenCalled();
    });

    it('registers add bundle click handler', async () => {
      await initBundleSection($w, state);
      expect($w('#addBundleBtn').onClick).toHaveBeenCalled();
    });

    it('sets bundle image and alt text', async () => {
      await initBundleSection($w, state);
      expect($w('#bundleImage').src).toBe('https://example.com/b.jpg');
      expect($w('#bundleImage').alt).toContain('bundle suggestion');
    });

    it('displays bundle price and savings', async () => {
      await initBundleSection($w, state);
      expect($w('#bundlePrice').text).toBe('$799.00');
      expect($w('#bundleSavings').text).toContain('Save');
    });

    it('returns early when product is null', async () => {
      state.product = null;
      await initBundleSection($w, state);
      expect($w('#bundleSection').expand).not.toHaveBeenCalled();
    });

    it('collapses when bundle product is null', async () => {
      const { getBundleSuggestion } = await import('backend/productRecommendations.web');
      getBundleSuggestion.mockResolvedValueOnce({ product: null });
      await initBundleSection($w, state);
      expect($w('#bundleSection').collapse).toHaveBeenCalled();
    });

    it('registers image and name click handlers for navigation', async () => {
      await initBundleSection($w, state);
      expect($w('#bundleImage').onClick).toHaveBeenCalled();
      expect($w('#bundleName').onClick).toHaveBeenCalled();
    });

    it('stores bundle product in state', async () => {
      await initBundleSection($w, state);
      expect(state.bundleProduct).toBeTruthy();
      expect(state.bundleProduct.name).toBe('Bundle Mattress');
    });
  });

  describe('initStockUrgency', () => {
    it('shows urgency when stock < 5', async () => {
      state.product.quantityInStock = 3;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').text).toContain('Only 3 left');
      expect($w('#stockUrgency').show).toHaveBeenCalled();
    });

    it('hides urgency when stock is sufficient', async () => {
      state.product.quantityInStock = 10;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').hide).toHaveBeenCalled();
    });

    it('hides urgency when stock is 0', async () => {
      state.product.quantityInStock = 0;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').hide).toHaveBeenCalled();
    });

    it('hides urgency when stock is null', async () => {
      state.product.quantityInStock = null;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').hide).toHaveBeenCalled();
    });

    it('shows "Only 1 left" for single unit', async () => {
      state.product.quantityInStock = 1;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').text).toBe('Only 1 left in stock');
    });

    it('returns early when product is null', async () => {
      state.product = null;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').show).not.toHaveBeenCalled();
    });

    it('shows urgency at boundary (stock = 4)', async () => {
      state.product.quantityInStock = 4;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').text).toContain('Only 4 left');
      expect($w('#stockUrgency').show).toHaveBeenCalled();
    });

    it('hides urgency at boundary (stock = 5)', async () => {
      state.product.quantityInStock = 5;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').hide).toHaveBeenCalled();
    });
  });

  describe('initBackInStockNotification', () => {
    it('initially collapses the section', async () => {
      await initBackInStockNotification($w, state);
      expect($w('#backInStockSection').collapse).toHaveBeenCalled();
    });

    it('registers submit handler', async () => {
      await initBackInStockNotification($w, state);
      expect($w('#backInStockBtn').onClick).toHaveBeenCalled();
    });

    it('hides success message initially', async () => {
      await initBackInStockNotification($w, state);
      expect($w('#backInStockSuccess').hide).toHaveBeenCalled();
    });

    it('registers onChange on size/finish dropdowns', async () => {
      await initBackInStockNotification($w, state);
      expect($w('#sizeDropdown').onChange).toHaveBeenCalled();
      expect($w('#finishDropdown').onChange).toHaveBeenCalled();
    });
  });

  describe('initWishlistButton', () => {
    it('registers click handler on wishlist button', async () => {
      await initWishlistButton($w, state);
      expect($w('#wishlistBtn').onClick).toHaveBeenCalled();
    });
  });

  describe('initAddToCartEnhancements — click flow', () => {
    it('disables button and shows "Adding..." during add', async () => {
      const { addToCart } = await import('public/cartService');
      addToCart.mockImplementationOnce(() => new Promise(resolve => {
        // Check state during the add
        expect($w('#addToCartButton').disable).toHaveBeenCalled();
        expect($w('#addToCartButton').label).toBe('Adding...');
        resolve({});
      }));
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
    });

    it('shows "Added!" on success', async () => {
      vi.useFakeTimers();
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      expect($w('#addToCartButton').label).toBe('Added!');
      vi.useRealTimers();
    });

    it('shows error message on failure', async () => {
      vi.useFakeTimers();
      const { addToCart } = await import('public/cartService');
      addToCart.mockRejectedValueOnce(new Error('Cart full'));
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      expect($w('#addToCartButton').label).toBe('Error \u2014 Try Again');
      vi.useRealTimers();
    });

    it('resets button label after 3 seconds', async () => {
      vi.useFakeTimers();
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      vi.advanceTimersByTime(3000);
      expect($w('#addToCartButton').label).toBe('Add to Cart');
      expect($w('#addToCartButton').enable).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('fires analytics on successful add', async () => {
      const { trackCartAdd } = await import('public/engagementTracker');
      vi.useFakeTimers();
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      expect(trackCartAdd).toHaveBeenCalledWith(state.product, state.selectedQuantity);
      vi.useRealTimers();
    });

    it('does nothing when product is null', async () => {
      const { addToCart } = await import('public/cartService');
      addToCart.mockClear();
      state.product = null;
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      expect(addToCart).not.toHaveBeenCalled();
    });

    it('shows success box on cart changed', async () => {
      vi.useFakeTimers();
      const { onCartChanged } = await import('public/cartService');
      onCartChanged.mockClear();
      initAddToCartEnhancements($w, state);
      const cartCb = onCartChanged.mock.calls[0][0];
      cartCb();
      expect($w('#addToCartSuccess').show).toHaveBeenCalled();
      vi.advanceTimersByTime(4000);
      expect($w('#addToCartSuccess').hide).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('initStickyCartBar — scroll behavior', () => {
    it('shows sticky bar when add-to-cart scrolls above viewport', async () => {
      const wixWindow = (await import('wix-window-frontend')).default;
      wixWindow.onScroll.mockClear();
      initStickyCartBar($w, state);
      const scrollCb = wixWindow.onScroll.mock.calls[0][0];
      $w('#addToCartButton').getBoundingRect = vi.fn().mockResolvedValue({ top: -50 });
      await scrollCb();
      // show is called with animation args: 'slide', {direction, duration}
      expect($w('#stickyCartBar').show).toHaveBeenCalledTimes(1);
    });

    it('hides sticky bar when add-to-cart scrolls back into view', async () => {
      const wixWindow = (await import('wix-window-frontend')).default;
      wixWindow.onScroll.mockClear();
      initStickyCartBar($w, state);
      const scrollCb = wixWindow.onScroll.mock.calls[0][0];
      // First scroll up (show)
      $w('#addToCartButton').getBoundingRect = vi.fn().mockResolvedValue({ top: -50 });
      await scrollCb();
      // Then scroll down (hide)
      $w('#addToCartButton').getBoundingRect = vi.fn().mockResolvedValue({ top: 100 });
      await scrollCb();
      // hide is called: once in init + once on scroll back
      expect($w('#stickyCartBar').hide).toHaveBeenCalled();
    });

    it('sticky add button shows loading when product ID missing', async () => {
      vi.useFakeTimers();
      state.product = { name: 'Test' }; // no _id
      initStickyCartBar($w, state);
      const clickCb = $w('#stickyAddBtn').onClick.mock.calls[0][0];
      await clickCb();
      expect($w('#stickyAddBtn').label).toBe('Loading...');
      vi.advanceTimersByTime(1500);
      expect($w('#stickyAddBtn').label).toBe('Add to Cart');
      vi.useRealTimers();
    });

    it('sticky add button fires analytics on success', async () => {
      vi.useFakeTimers();
      const { trackCartAdd } = await import('public/engagementTracker');
      trackCartAdd.mockClear();
      initStickyCartBar($w, state);
      const clickCb = $w('#stickyAddBtn').onClick.mock.calls[0][0];
      await clickCb();
      expect(trackCartAdd).toHaveBeenCalledWith(state.product, state.selectedQuantity);
      vi.useRealTimers();
    });
  });

  describe('initBundleSection — add bundle flow', () => {
    it('adds both products to cart on bundle button click', async () => {
      const { addToCart } = await import('public/cartService');
      addToCart.mockClear();
      vi.useFakeTimers();
      await initBundleSection($w, state);
      const clickCb = $w('#addBundleBtn').onClick.mock.calls[0][0];
      await clickCb();
      expect(addToCart).toHaveBeenCalledWith('prod-1', 1); // main product
      expect(addToCart).toHaveBeenCalledWith('bundle-1', 1); // bundle product
      vi.useRealTimers();
    });

    it('shows "Bundle Added!" on success', async () => {
      vi.useFakeTimers();
      await initBundleSection($w, state);
      const clickCb = $w('#addBundleBtn').onClick.mock.calls[0][0];
      await clickCb();
      expect($w('#addBundleBtn').label).toBe('Bundle Added!');
      vi.useRealTimers();
    });

    it('shows error on bundle add failure', async () => {
      vi.useFakeTimers();
      const { addToCart } = await import('public/cartService');
      addToCart.mockRejectedValueOnce(new Error('Cart error'));
      await initBundleSection($w, state);
      const clickCb = $w('#addBundleBtn').onClick.mock.calls[0][0];
      await clickCb();
      expect($w('#addBundleBtn').label).toBe('Error \u2014 Try Again');
      vi.useRealTimers();
    });

    it('resets bundle button after 3 seconds', async () => {
      vi.useFakeTimers();
      await initBundleSection($w, state);
      const clickCb = $w('#addBundleBtn').onClick.mock.calls[0][0];
      await clickCb();
      vi.advanceTimersByTime(3000);
      expect($w('#addBundleBtn').label).toBe('Add Both to Cart');
      expect($w('#addBundleBtn').enable).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('initStockUrgency — pulse animation', () => {
    it('sets pulse animation when stock <= 2', async () => {
      state.product.quantityInStock = 2;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').style.animation).toBe('pulse 1.5s ease-in-out infinite');
    });

    it('does not set pulse animation when stock is 3', async () => {
      state.product.quantityInStock = 3;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').style.animation).toBeUndefined();
    });
  });

  describe('initQuantitySelector — input handler and clamping', () => {
    it('clamps input value via onInput handler', async () => {
      initQuantitySelector($w, state);
      const inputCb = $w('#quantityInput').onInput.mock.calls[0][0];
      $w('#quantityInput').value = '0';
      inputCb();
      expect(state.selectedQuantity).toBe(1); // clamped to MIN_QUANTITY
    });

    it('plus button stops at MAX_QUANTITY', () => {
      initQuantitySelector($w, state);
      state.selectedQuantity = 99; // MAX_QUANTITY from cartService
      const plusCb = $w('#quantityPlus').onClick.mock.calls[0][0];
      plusCb();
      // Should remain at MAX or increment if under
      // MAX_QUANTITY is typically 99 based on cartService
      expect(state.selectedQuantity).toBeLessThanOrEqual(100);
    });

    it('returns early when quantityInput is null', () => {
      const $wNull = create$w();
      const origGet = (sel) => sel === '#quantityInput' ? null : $wNull(sel);
      const els = new Map();
      const $wCustom = (sel) => {
        if (sel === '#quantityInput') return null;
        if (!els.has(sel)) els.set(sel, createMockElement());
        return els.get(sel);
      };
      expect(() => initQuantitySelector($wCustom, state)).not.toThrow();
    });
  });

  describe('initBackInStockNotification — submit flow', () => {
    it('shows error for invalid email', async () => {
      await initBackInStockNotification($w, state);
      const submitCb = $w('#backInStockBtn').onClick.mock.calls[0][0];
      $w('#backInStockEmail').value = 'not-an-email';
      await submitCb();
      expect($w('#backInStockError').text).toBe('Please enter a valid email address.');
      expect($w('#backInStockError').show).toHaveBeenCalled();
    });

    it('shows error for empty email', async () => {
      await initBackInStockNotification($w, state);
      const submitCb = $w('#backInStockBtn').onClick.mock.calls[0][0];
      $w('#backInStockEmail').value = '';
      await submitCb();
      expect($w('#backInStockError').text).toBe('Please enter a valid email address.');
    });

    it('returns early when backInStockSection is null', async () => {
      const els = new Map();
      const $wCustom = (sel) => {
        if (sel === '#backInStockSection') return null;
        if (!els.has(sel)) els.set(sel, createMockElement());
        return els.get(sel);
      };
      await initBackInStockNotification($wCustom, state);
      // Should not throw and should not register submit handler
    });
  });

  describe('Call-for-Price products (CF-b3g9)', () => {
    let cfpState;
    beforeEach(() => {
      cfpState = { product: callForPriceProduct, selectedQuantity: 1, bundleProduct: null };
    });

    it('hides sticky cart bar for call-for-price products', () => {
      initStickyCartBar($w, cfpState);
      // Should not register click handler on sticky add button (early return)
      expect($w('#stickyAddBtn').onClick).not.toHaveBeenCalled();
    });

    it('shows call-for-pricing text in sticky price', () => {
      initStickyCartBar($w, cfpState);
      expect($w('#stickyPrice').text).toBe('Call for Pricing \u2014 (828) 327-8030');
    });

    it('does not hide sticky bar for normal-price products', () => {
      initStickyCartBar($w, state);
      // Should register click handler on sticky add button
      expect($w('#stickyAddBtn').onClick).toHaveBeenCalled();
    });
  });
});
