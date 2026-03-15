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

    it('minus button decrements from 2 to 1', () => {
      initQuantitySelector($w, state);
      state.selectedQuantity = 2;
      const minusCb = $w('#quantityMinus').onClick.mock.calls[0][0];
      minusCb();
      expect(state.selectedQuantity).toBe(1);
      expect($w('#quantityInput').value).toBe('1');
    });

    it('registers onInput handler for manual entry', () => {
      initQuantitySelector($w, state);
      expect($w('#quantityInput').onInput).toHaveBeenCalled();
    });

    it('sets minus/plus aria labels', () => {
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

    it('calls addToCart with product ID and quantity on click', async () => {
      const { addToCart } = await import('public/cartService');
      addToCart.mockClear();
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      expect(addToCart).toHaveBeenCalledWith('prod-1', 1);
    });

    it('disables button and shows "Adding..." during cart add', async () => {
      const { addToCart } = await import('public/cartService');
      addToCart.mockImplementationOnce(() => new Promise(r => setTimeout(r, 10)));
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      const promise = clickCb();
      expect($w('#addToCartButton').disable).toHaveBeenCalled();
      await promise;
    });

    it('shows "Added!" on successful cart add', async () => {
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      expect($w('#addToCartButton').label).toBe('Added!');
    });

    it('shows error label when addToCart fails', async () => {
      const { addToCart } = await import('public/cartService');
      addToCart.mockRejectedValueOnce(new Error('Cart error'));
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      expect($w('#addToCartButton').label).toContain('Error');
    });

    it('fires tracking events on successful add', async () => {
      const { trackCartAdd } = await import('public/engagementTracker');
      trackCartAdd.mockClear();
      initAddToCartEnhancements($w, state);
      const clickCb = $w('#addToCartButton').onClick.mock.calls[0][0];
      await clickCb();
      expect(trackCartAdd).toHaveBeenCalled();
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
      expect($w('#bundleImage').alt).toContain('Bundle Mattress');
    });

    it('displays savings text', async () => {
      await initBundleSection($w, state);
      expect($w('#bundleSavings').text).toContain('$50.00');
    });

    it('displays bundle price', async () => {
      await initBundleSection($w, state);
      expect($w('#bundlePrice').text).toBe('$799.00');
    });

    it('stores bundle product on state', async () => {
      await initBundleSection($w, state);
      expect(state.bundleProduct._id).toBe('bundle-1');
    });

    it('registers click handlers on bundle image and name for navigation', async () => {
      await initBundleSection($w, state);
      expect($w('#bundleImage').onClick).toHaveBeenCalled();
      expect($w('#bundleName').onClick).toHaveBeenCalled();
    });

    it('returns early when product is null', async () => {
      state.product = null;
      await initBundleSection($w, state);
      expect($w('#bundleSection').expand).not.toHaveBeenCalled();
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

    it('adds pulse animation for critical stock (≤2)', async () => {
      state.product.quantityInStock = 2;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').text).toContain('Only 2 left');
      expect($w('#stockUrgency').style.animation).toContain('pulse');
    });

    it('hides urgency when stock is 0 (out of stock)', async () => {
      state.product.quantityInStock = 0;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').hide).toHaveBeenCalled();
    });

    it('returns early when product is null', async () => {
      state.product = null;
      await initStockUrgency($w, state);
      expect($w('#stockUrgency').show).not.toHaveBeenCalled();
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

    it('registers size dropdown change listener', async () => {
      await initBackInStockNotification($w, state);
      expect($w('#sizeDropdown').onChange).toHaveBeenCalled();
    });

    it('registers finish dropdown change listener', async () => {
      await initBackInStockNotification($w, state);
      expect($w('#finishDropdown').onChange).toHaveBeenCalled();
    });
  });

  describe('initWishlistButton', () => {
    it('registers click handler on wishlist button', async () => {
      await initWishlistButton($w, state);
      expect($w('#wishlistBtn').onClick).toHaveBeenCalled();
    });

    it('returns early when product is null', async () => {
      state.product = null;
      await initWishlistButton($w, state);
      expect($w('#wishlistBtn').onClick).not.toHaveBeenCalled();
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
