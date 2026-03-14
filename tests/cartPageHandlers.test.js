import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: {},
    hidden: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    setFilter: vi.fn(), setSort: vi.fn(),
    focus: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Backend Modules ────────────────────────────────────────────

const mockCart = {
  lineItems: [
    { _id: 'li-1', productId: 'prod-1', name: 'Asheville Futon', price: 599, quantity: 1, mediaItem: { src: 'https://img/ash.jpg' } },
    { _id: 'li-2', productId: 'prod-2', name: 'Futon Mattress', price: 199, quantity: 2, mediaItem: { src: 'https://img/mat.jpg' } },
  ],
  totals: { subtotal: 997, shipping: 0, total: 997 },
  appliedCoupon: null,
};

vi.mock('backend/productRecommendations.web', () => ({
  getCompletionSuggestions: vi.fn().mockResolvedValue([]),
}));

vi.mock('backend/financingCalc.web', () => ({
  getCartFinancing: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('public/galleryHelpers', () => ({
  getRecentlyViewed: vi.fn().mockReturnValue([]),
}));

vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn().mockResolvedValue(mockCart),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn().mockResolvedValue({}),
  removeCartItem: vi.fn().mockResolvedValue({}),
  onCartChanged: vi.fn(),
  getShippingProgress: vi.fn().mockReturnValue({ remaining: 50, progressPct: 50, qualifies: false }),
  getTierProgress: vi.fn().mockReturnValue({
    tier: { label: (r) => `Add $${r} for 5% off` },
    remaining: 100,
    progressPct: 20,
  }),
  FREE_SHIPPING_THRESHOLD: 100000,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10,
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  collapseOnMobile: vi.fn(),
  limitForViewport: vi.fn((items) => items),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireViewCart: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el._clickHandler = handler;
    el._a11yOpts = opts;
  }),
}));

vi.mock('public/cartStyles.js', () => ({
  getCartItemStyles: vi.fn().mockReturnValue({ nameColor: '#333', priceColor: '#666', removeColor: '#e74c3c' }),
  getProgressBarStyles: vi.fn().mockReturnValue({ trackColor: '#eee', fillColor: '#4CAF50', textColor: '#333' }),
  getEmptyCartStyles: vi.fn().mockReturnValue({ headingColor: '#3A2518', messageColor: '#666' }),
  getCheckoutButtonStyles: vi.fn().mockReturnValue({ background: '#E8845C', textColor: '#fff' }),
  getQuantitySpinnerStyles: vi.fn().mockReturnValue({ buttonColor: '#5B8FA8', valueColor: '#333' }),
}));

vi.mock('public/crossSellWidget.js', () => ({
  buildRoomBundles: vi.fn().mockReturnValue([]),
  initCrossSellWidget: vi.fn(),
}));

vi.mock('public/SaveForLater.js', () => ({
  saveForLater: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('public/cartDeliveryEstimate.js', () => ({
  initCartDeliveryEstimate: vi.fn().mockResolvedValue(undefined),
  updateCartDeliveryEstimate: vi.fn(),
}));

vi.mock('public/CouponCodeInput.js', () => ({
  initCouponCodeInput: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

const { getCurrentCart, updateCartItemQuantity, removeCartItem, onCartChanged } = await import('public/cartService');
const { trackEvent } = await import('public/engagementTracker');
const { announce } = await import('public/a11yHelpers');
const { saveForLater } = await import('public/SaveForLater.js');
const { initPageSeo } = await import('public/pageSeo.js');

// ── Import Page ─────────────────────────────────────────────────────

describe('Cart Page — handler behavior', () => {
  beforeAll(async () => {
    await import('../src/pages/Cart Page.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    getCurrentCart.mockResolvedValue(mockCart);
  });

  // ── onReady ─────────────────────────────────────────────────────

  describe('onReady', () => {
    it('calls initPageSeo with cart', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('cart');
    });

    it('tracks page_view with item count for populated cart', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'cart', itemCount: 2 });
    });
  });

  // ── Empty cart state ────────────────────────────────────────────

  describe('empty cart state', () => {
    beforeEach(() => {
      getCurrentCart.mockResolvedValue({ lineItems: [], totals: { subtotal: 0 } });
    });

    it('expands emptyCartSection when cart is empty', async () => {
      await onReadyHandler();
      expect(getEl('#emptyCartSection').expand).toHaveBeenCalled();
    });

    it('sets empty cart title text', async () => {
      await onReadyHandler();
      expect(getEl('#emptyCartTitle').text).toBe('Your cart is empty');
    });

    it('sets empty cart title role to heading', async () => {
      await onReadyHandler();
      expect(getEl('#emptyCartTitle').accessibility.role).toBe('heading');
    });

    it('sets continue shopping button styling', async () => {
      await onReadyHandler();
      expect(getEl('#continueShoppingBtn').style.backgroundColor).toBe('#E8845C');
      expect(getEl('#continueShoppingBtn').style.color).toBe('#fff');
    });

    it('collapses suggestions, recent, and financing sections', async () => {
      await onReadyHandler();
      expect(getEl('#suggestionsSection').collapse).toHaveBeenCalled();
      expect(getEl('#cartRecentSection').collapse).toHaveBeenCalled();
      expect(getEl('#cartFinancingSection').collapse).toHaveBeenCalled();
    });

    it('tracks page_view with empty=true', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'cart', empty: true });
    });
  });

  // ── Quantity controls ───────────────────────────────────────────

  describe('quantity controls — minus button', () => {
    async function getItemReadyCb() {
      await onReadyHandler();
      return getEl('#cartItemsRepeater').onItemReady.mock.calls[0][0];
    }

    function createItemScope() {
      const itemElements = new Map();
      return (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
    }

    it('decreases quantity and calls updateCartItemQuantity', async () => {
      const cb = await getItemReadyCb();
      const $item = createItemScope();
      $item('#qtyInput').value = '3';
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const minusClickCb = $item('#qtyMinus').onClick.mock.calls[0][0];
      await minusClickCb();

      expect(updateCartItemQuantity).toHaveBeenCalledWith('li-1', 2);
    });

    it('updates quantity display after decrease', async () => {
      const cb = await getItemReadyCb();
      const $item = createItemScope();
      $item('#qtyInput').value = '3';
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const minusClickCb = $item('#qtyMinus').onClick.mock.calls[0][0];
      await minusClickCb();

      expect($item('#qtyInput').value).toBe('2');
    });

    it('announces quantity change to screen readers', async () => {
      const cb = await getItemReadyCb();
      const $item = createItemScope();
      $item('#qtyInput').value = '3';
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const minusClickCb = $item('#qtyMinus').onClick.mock.calls[0][0];
      await minusClickCb();

      expect(announce).toHaveBeenCalledWith($w, 'Asheville Futon quantity updated to 2');
    });

    it('does NOT decrease below MIN_QUANTITY (1)', async () => {
      const cb = await getItemReadyCb();
      const $item = createItemScope();
      $item('#qtyInput').value = '1';
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const minusClickCb = $item('#qtyMinus').onClick.mock.calls[0][0];
      await minusClickCb();

      expect(updateCartItemQuantity).not.toHaveBeenCalled();
    });
  });

  describe('quantity controls — plus button', () => {
    async function getItemReadyCb() {
      await onReadyHandler();
      return getEl('#cartItemsRepeater').onItemReady.mock.calls[0][0];
    }

    function createItemScope() {
      const itemElements = new Map();
      return (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
    }

    it('increases quantity and calls updateCartItemQuantity', async () => {
      const cb = await getItemReadyCb();
      const $item = createItemScope();
      $item('#qtyInput').value = '2';
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const plusClickCb = $item('#qtyPlus').onClick.mock.calls[0][0];
      await plusClickCb();

      expect(updateCartItemQuantity).toHaveBeenCalledWith('li-1', 3);
    });

    it('does NOT increase above MAX_QUANTITY (10)', async () => {
      const cb = await getItemReadyCb();
      const $item = createItemScope();
      $item('#qtyInput').value = '10';
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const plusClickCb = $item('#qtyPlus').onClick.mock.calls[0][0];
      await plusClickCb();

      expect(updateCartItemQuantity).not.toHaveBeenCalled();
    });

    it('updates ariaValueNow after increase', async () => {
      const cb = await getItemReadyCb();
      const $item = createItemScope();
      $item('#qtyInput').value = '2';
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const plusClickCb = $item('#qtyPlus').onClick.mock.calls[0][0];
      await plusClickCb();

      expect($item('#qtyInput').accessibility.ariaValueNow).toBe(3);
    });
  });

  // ── Remove item ─────────────────────────────────────────────────

  describe('remove item from cart', () => {
    it('calls removeCartItem with item ID', async () => {
      await onReadyHandler();
      const cb = getEl('#cartItemsRepeater').onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const removeClickCb = $item('#removeItem').onClick.mock.calls[0][0];
      await removeClickCb();

      expect(removeCartItem).toHaveBeenCalledWith('li-1');
    });

    it('announces removal to screen readers', async () => {
      await onReadyHandler();
      const cb = getEl('#cartItemsRepeater').onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      cb($item, { _id: 'li-1', name: 'Asheville Futon', price: 599 });

      const removeClickCb = $item('#removeItem').onClick.mock.calls[0][0];
      await removeClickCb();

      expect(announce).toHaveBeenCalledWith($w, 'Asheville Futon removed from cart');
    });
  });

  // ── Save for later ──────────────────────────────────────────────

  describe('save for later', () => {
    async function clickSaveForLater(itemData) {
      await onReadyHandler();
      const cb = getEl('#cartItemsRepeater').onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      cb($item, itemData);
      const saveCb = $item('#saveForLaterBtn').onClick.mock.calls[0][0];
      await saveCb();
      return $item;
    }

    it('calls saveForLater with item data', async () => {
      await clickSaveForLater({ _id: 'li-1', productId: 'prod-1', name: 'Asheville Futon', price: 599, mediaItem: { src: 'img.jpg' } });
      expect(saveForLater).toHaveBeenCalledWith({
        _id: 'li-1',
        productId: 'prod-1',
        name: 'Asheville Futon',
        price: 599,
        image: 'img.jpg',
      });
    });

    it('announces success when save succeeds', async () => {
      saveForLater.mockResolvedValue({ success: true });
      await clickSaveForLater({ _id: 'li-1', productId: 'prod-1', name: 'Asheville Futon', price: 599, mediaItem: { src: 'img.jpg' } });
      expect(announce).toHaveBeenCalledWith($w, 'Asheville Futon saved to your wishlist');
    });

    it('announces login prompt when not authenticated', async () => {
      saveForLater.mockResolvedValue({ success: false, reason: 'not_authenticated' });
      await clickSaveForLater({ _id: 'li-1', productId: 'prod-1', name: 'Asheville Futon', price: 599, mediaItem: { src: 'img.jpg' } });
      expect(announce).toHaveBeenCalledWith($w, 'Please log in to save items for later');
    });

    it('disables save button before calling saveForLater', async () => {
      await onReadyHandler();
      const cb = getEl('#cartItemsRepeater').onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      cb($item, { _id: 'li-1', productId: 'prod-1', name: 'Test', price: 100, mediaItem: { src: 'i.jpg' } });
      const saveCb = $item('#saveForLaterBtn').onClick.mock.calls[0][0];
      await saveCb();
      expect($item('#saveForLaterBtn').disable).toHaveBeenCalled();
    });
  });

  // ── ARIA attributes ─────────────────────────────────────────────

  describe('ARIA attributes on cart items', () => {
    it('sets ariaLabel on qtyMinus, qtyPlus, and removeItem', async () => {
      await onReadyHandler();
      const cb = getEl('#cartItemsRepeater').onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      cb($item, { _id: 'li-1', name: 'Sedona Futon', price: 799 });

      expect($item('#qtyMinus').accessibility.ariaLabel).toBe('Decrease quantity of Sedona Futon');
      expect($item('#qtyPlus').accessibility.ariaLabel).toBe('Increase quantity of Sedona Futon');
      expect($item('#removeItem').accessibility.ariaLabel).toBe('Remove Sedona Futon from cart');
    });

    it('sets spinbutton role on qtyInput', async () => {
      await onReadyHandler();
      const cb = getEl('#cartItemsRepeater').onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      cb($item, { _id: 'li-1', name: 'Test', price: 100 });

      expect($item('#qtyInput').accessibility.role).toBe('spinbutton');
      expect($item('#qtyInput').accessibility.ariaValueMin).toBe(1);
      expect($item('#qtyInput').accessibility.ariaValueMax).toBe(10);
    });
  });

  // ── Cart change listener ────────────────────────────────────────

  describe('cart change listener', () => {
    it('registers onCartChanged callback', async () => {
      await onReadyHandler();
      expect(onCartChanged).toHaveBeenCalled();
    });
  });
});
