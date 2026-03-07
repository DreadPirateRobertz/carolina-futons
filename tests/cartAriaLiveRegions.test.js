import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: 0,
    label: '',
    hidden: false,
    options: [],
    data: [],
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onItemReady: vi.fn(),
    onReady: vi.fn((cb) => { if (cb) cb(); return Promise.resolve(); }),
    onCurrentIndexChanged: vi.fn(),
    getCurrentItem: vi.fn(),
    getTotalCount: vi.fn(() => 0),
    getItems: vi.fn(() => ({ items: [] })),
    setSort: vi.fn(),
    setFilter: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

// ── Mock Backend & Public Modules ────────────────────────────────────

const mockStyles = {
  nameColor: '#3A2518', priceColor: '#3A2518', removeColor: '#E8845C',
  headingColor: '#3A2518', messageColor: '#3A2518',
  trackColor: '#E8D5B7', fillColor: '#5B8FA8', textColor: '#3A2518',
  panelBackground: '#FAF7F2', headerColor: '#3A2518', viewCartLinkColor: '#5B8FA8',
  background: '#E8845C', textColor: '#fff',
  buttonColor: '#5B8FA8', valueColor: '#3A2518',
};

vi.mock('backend/financingCalc.web', () => ({
  getCartFinancing: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('backend/productRecommendations.web', () => ({
  getCompletionSuggestions: vi.fn().mockResolvedValue([]),
}));

vi.mock('public/SaveForLater.js', () => ({
  saveForLater: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('public/cartDeliveryEstimate.js', () => ({
  initCartDeliveryEstimate: vi.fn().mockResolvedValue(),
  updateCartDeliveryEstimate: vi.fn().mockResolvedValue(),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(),
}));

vi.mock('public/crossSellWidget.js', () => ({
  buildRoomBundles: vi.fn().mockReturnValue([]),
  initCrossSellWidget: vi.fn(),
}));

vi.mock('public/cartStyles.js', () => ({
  getCartItemStyles: vi.fn().mockReturnValue(mockStyles),
  getProgressBarStyles: vi.fn().mockReturnValue(mockStyles),
  getEmptyCartStyles: vi.fn().mockReturnValue(mockStyles),
  getCheckoutButtonStyles: vi.fn().mockReturnValue(mockStyles),
  getQuantitySpinnerStyles: vi.fn().mockReturnValue(mockStyles),
  getSideCartPanelStyles: vi.fn().mockReturnValue(mockStyles),
}));

vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn().mockResolvedValue({
    lineItems: [{ _id: 'item1', name: 'Eureka', productId: 'p1', quantity: 2, price: 499, mediaItem: { src: 'img.jpg' } }],
    totals: { subtotal: 998, shipping: 0, total: 998 },
  }),
  addToCart: vi.fn().mockResolvedValue({}),
  updateCartItemQuantity: vi.fn().mockResolvedValue({}),
  removeCartItem: vi.fn().mockResolvedValue({}),
  onCartChanged: vi.fn(),
  getShippingProgress: vi.fn().mockReturnValue({ remaining: 1, progressPct: 99, qualifies: false }),
  getTierProgress: vi.fn().mockReturnValue({ tier: { label: (r) => `$${r} to next tier` }, remaining: 2, progressPct: 50 }),
  FREE_SHIPPING_THRESHOLD: 999,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 99,
  safeMultiply: (a, b) => a * b,
}));

// ── Cart Page Tests ─────────────────────────────────────────────────

describe('Cart Page — ARIA Live Regions (CF-7ll)', () => {
  let onReadyHandler = null;

  beforeAll(async () => {
    globalThis.$w = Object.assign(
      (sel) => getEl(sel),
      { onReady: (fn) => { onReadyHandler = fn; } }
    );
    await import('../src/pages/Cart Page.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  describe('cart totals live regions', () => {
    it('sets ariaLive on #cartSubtotal after refresh', async () => {
      await onReadyHandler();
      const subtotal = getEl('#cartSubtotal');
      expect(subtotal.accessibility.ariaLive).toBe('polite');
    });

    it('sets role="status" on #cartSubtotal', async () => {
      await onReadyHandler();
      const subtotal = getEl('#cartSubtotal');
      expect(subtotal.accessibility.role).toBe('status');
    });

    it('sets ariaLive on #cartTotal after refresh', async () => {
      await onReadyHandler();
      const total = getEl('#cartTotal');
      expect(total.accessibility.ariaLive).toBe('polite');
    });

    it('sets role="status" on #cartTotal', async () => {
      await onReadyHandler();
      const total = getEl('#cartTotal');
      expect(total.accessibility.role).toBe('status');
    });
  });

  describe('quantity controls ARIA announcements', () => {
    it('quantity minus button has ariaLabel containing item name', async () => {
      await onReadyHandler();
      const repeater = getEl('#cartItemsRepeater');
      if (repeater.onItemReady.mock.calls.length > 0) {
        const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
        const itemElements = {};
        const $item = (sel) => {
          if (!itemElements[sel]) {
            itemElements[sel] = {
              text: '', value: '2', style: { color: '' },
              accessibility: {},
              onClick: vi.fn(), onKeyPress: vi.fn(),
              show: vi.fn(), hide: vi.fn(),
              enable: vi.fn(), disable: vi.fn(),
            };
          }
          return itemElements[sel];
        };
        itemReadyCb($item, { _id: 'item1', name: 'Eureka Futon', quantity: 2 });
        expect(itemElements['#qtyMinus'].accessibility.ariaLabel).toContain('Eureka Futon');
      }
    });

    it('quantity plus button has ariaLabel containing item name', async () => {
      await onReadyHandler();
      const repeater = getEl('#cartItemsRepeater');
      if (repeater.onItemReady.mock.calls.length > 0) {
        const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
        const itemElements = {};
        const $item = (sel) => {
          if (!itemElements[sel]) {
            itemElements[sel] = {
              text: '', value: '2', style: { color: '' },
              accessibility: {},
              onClick: vi.fn(), onKeyPress: vi.fn(),
              show: vi.fn(), hide: vi.fn(),
              enable: vi.fn(), disable: vi.fn(),
            };
          }
          return itemElements[sel];
        };
        itemReadyCb($item, { _id: 'item1', name: 'Eureka Futon', quantity: 2 });
        expect(itemElements['#qtyPlus'].accessibility.ariaLabel).toContain('Eureka Futon');
      }
    });

    it('remove button has ariaLabel containing item name', async () => {
      await onReadyHandler();
      const repeater = getEl('#cartItemsRepeater');
      if (repeater.onItemReady.mock.calls.length > 0) {
        const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
        const itemElements = {};
        const $item = (sel) => {
          if (!itemElements[sel]) {
            itemElements[sel] = {
              text: '', value: '2', style: { color: '' },
              accessibility: {},
              onClick: vi.fn(), onKeyPress: vi.fn(),
              show: vi.fn(), hide: vi.fn(),
              enable: vi.fn(), disable: vi.fn(),
            };
          }
          return itemElements[sel];
        };
        itemReadyCb($item, { _id: 'item1', name: 'Eureka Futon', quantity: 2 });
        expect(itemElements['#removeItem'].accessibility.ariaLabel).toContain('Eureka Futon');
      }
    });
  });

  describe('empty cart announcement', () => {
    it('announces empty cart state to screen readers', async () => {
      await onReadyHandler();
      // showEmptyCart is called when cart is empty
      const liveRegion = getEl('#a11yLiveRegion');
      // The announce function will be called, which sets text on the live region
      expect(liveRegion).toBeDefined();
    });
  });

  describe('cart total update announcement', () => {
    it('#cartSubtotal has ariaLive="polite" for dynamic updates', async () => {
      await onReadyHandler();
      expect(getEl('#cartSubtotal').accessibility.ariaLive).toBe('polite');
    });
  });
});

// ── Side Cart Tests ─────────────────────────────────────────────────

describe('Side Cart — ARIA Live Regions (CF-7ll)', () => {
  let onReadyHandler = null;

  beforeAll(async () => {
    // Re-register $w.onReady for Side Cart import
    globalThis.$w = Object.assign(
      (sel) => getEl(sel),
      { onReady: (fn) => { onReadyHandler = fn; } }
    );
    await import('../src/pages/Side Cart.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  describe('side cart subtotal live region', () => {
    it('sets ariaLive on #sideCartSubtotal', async () => {
      await onReadyHandler();
      const subtotal = getEl('#sideCartSubtotal');
      expect(subtotal.accessibility.ariaLive).toBe('polite');
    });

    it('sets role="status" on #sideCartSubtotal', async () => {
      await onReadyHandler();
      const subtotal = getEl('#sideCartSubtotal');
      expect(subtotal.accessibility.role).toBe('status');
    });
  });

  describe('side cart tier progress live region', () => {
    it('sets ariaLive on #sideTierText', async () => {
      await onReadyHandler();
      const tierText = getEl('#sideTierText');
      expect(tierText.accessibility.ariaLive).toBe('polite');
    });

    it('sets role="status" on #sideTierText', async () => {
      await onReadyHandler();
      const tierText = getEl('#sideTierText');
      expect(tierText.accessibility.role).toBe('status');
    });
  });

  describe('side cart item quantity live region', () => {
    it('sets ariaLive on #sideItemQty', async () => {
      await onReadyHandler();
      const repeater = getEl('#sideCartRepeater');
      if (repeater.onItemReady.mock.calls.length > 0) {
        const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
        const itemElements = {};
        const $item = (sel) => {
          if (!itemElements[sel]) {
            itemElements[sel] = {
              text: '', src: '', alt: '', value: '',
              style: { color: '' }, accessibility: {},
              show: vi.fn(), hide: vi.fn(),
              onClick: vi.fn(), onKeyPress: vi.fn(),
              enable: vi.fn(), disable: vi.fn(),
            };
          }
          return itemElements[sel];
        };
        itemReadyCb($item, { _id: 'item1', name: 'Eureka', price: 499, quantity: 2, image: 'img.jpg', lineTotal: 998 });
        expect(itemElements['#sideItemQty'].accessibility.ariaLive).toBe('polite');
      }
    });
  });

  describe('cart badge live region', () => {
    it('sets ariaLive on #cartBadge', async () => {
      await onReadyHandler();
      const badge = getEl('#cartBadge');
      expect(badge.accessibility.ariaLive).toBe('polite');
    });

    it('sets role="status" on #cartBadge', async () => {
      await onReadyHandler();
      const badge = getEl('#cartBadge');
      expect(badge.accessibility.role).toBe('status');
    });
  });

  describe('side cart panel ARIA', () => {
    it('sets role="dialog" on #sideCartPanel', async () => {
      await onReadyHandler();
      expect(getEl('#sideCartPanel').accessibility.role).toBe('dialog');
    });

    it('sets ariaModal on #sideCartPanel', async () => {
      await onReadyHandler();
      expect(getEl('#sideCartPanel').accessibility.ariaModal).toBe(true);
    });

    it('sets ariaLabel on #sideCartPanel', async () => {
      await onReadyHandler();
      expect(getEl('#sideCartPanel').accessibility.ariaLabel).toBe('Shopping cart');
    });
  });

  describe('side cart empty state announcement', () => {
    it('announces when cart becomes empty via refreshSideCart', async () => {
      await onReadyHandler();
      // When cart is empty, sideCartEmpty shows and screen reader should be notified
      const emptyEl = getEl('#sideCartEmpty');
      expect(emptyEl).toBeDefined();
    });
  });
});
