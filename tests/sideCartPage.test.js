import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w mock ──────────────────────────────────────────────────────────
const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', backgroundColor: '' },
    accessibility: {},
    hidden: false,
    htmlElement: null,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
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

// ── Module mocks ─────────────────────────────────────────────────────
vi.mock('backend/productRecommendations.web', () => ({
  getCompletionSuggestions: vi.fn().mockResolvedValue([]),
}));

vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn().mockResolvedValue(null),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  removeCartItem: vi.fn(),
  onCartChanged: vi.fn(),
  getShippingProgress: vi.fn().mockReturnValue({ remaining: 50, progressPct: 50, qualifies: false }),
  getTierProgress: vi.fn().mockReturnValue({ tier: { label: (r) => 'Add $' + r + ' for 5% off' }, remaining: 100, progressPct: 20 }),
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10,
  safeMultiply: vi.fn((a, b) => a * b),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/SaveForLater.js', () => ({
  saveForLater: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn().mockReturnValue(false),
  collapseOnMobile: vi.fn(),
}));

vi.mock('public/cartStyles.js', () => ({
  getCartItemStyles: vi.fn().mockReturnValue({ nameColor: '#333', priceColor: '#666', removeColor: '#e74c3c' }),
  getProgressBarStyles: vi.fn().mockReturnValue({ trackColor: '#eee', fillColor: '#4CAF50', textColor: '#333' }),
  getSideCartPanelStyles: vi.fn().mockReturnValue({ panelBackground: '#fff', headerColor: '#333', viewCartLinkColor: '#2c5f8a' }),
  getCheckoutButtonStyles: vi.fn().mockReturnValue({ background: '#e8694a', textColor: '#fff' }),
  getQuantitySpinnerStyles: vi.fn().mockReturnValue({ buttonColor: '#2c5f8a' }),
}));

vi.mock('public/crossSellWidget.js', () => ({
  buildRoomBundles: vi.fn().mockReturnValue([]),
  initCrossSellWidget: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

// ── Import source (triggers $w.onReady registration) ─────────────────
beforeAll(async () => {
  elements.clear();
  await import('../src/pages/Side Cart.js');
});

beforeEach(() => {
  elements.clear();
});

describe('Side Cart Page', () => {
  // ── 1. ARIA dialog attributes ────────────────────────────────────
  describe('initSideCart ARIA dialog', () => {
    it('sets role, ariaModal, and ariaLabel on #sideCartPanel', async () => {
      await onReadyHandler();
      const panel = getEl('#sideCartPanel');
      expect(panel.accessibility.role).toBe('dialog');
      expect(panel.accessibility.ariaModal).toBe(true);
      expect(panel.accessibility.ariaLabel).toBe('Shopping cart');
    });
  });

  // ── 2. ARIA live regions ─────────────────────────────────────────
  describe('ARIA live regions', () => {
    it('sets ariaLive and role on #sideCartSubtotal', async () => {
      await onReadyHandler();
      const el = getEl('#sideCartSubtotal');
      expect(el.accessibility.ariaLive).toBe('polite');
      expect(el.accessibility.role).toBe('status');
    });

    it('sets ariaLive and role on #sideTierText', async () => {
      await onReadyHandler();
      const el = getEl('#sideTierText');
      expect(el.accessibility.ariaLive).toBe('polite');
      expect(el.accessibility.role).toBe('status');
    });

    it('sets ariaLive and role on #cartBadge', async () => {
      await onReadyHandler();
      const el = getEl('#cartBadge');
      expect(el.accessibility.ariaLive).toBe('polite');
      expect(el.accessibility.role).toBe('status');
    });
  });

  // ── 3. Close button ──────────────────────────────────────────────
  describe('close button (#sideCartClose)', () => {
    it('registers onClick handler', async () => {
      await onReadyHandler();
      expect(getEl('#sideCartClose').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label to "Close cart"', async () => {
      await onReadyHandler();
      expect(getEl('#sideCartClose').accessibility.ariaLabel).toBe('Close cart');
    });
  });

  // ── 4. Overlay click ────────────────────────────────────────────
  describe('overlay (#sideCartOverlay)', () => {
    it('registers onClick handler', async () => {
      await onReadyHandler();
      expect(getEl('#sideCartOverlay').onClick).toHaveBeenCalled();
    });
  });

  // ── 5. View full cart ────────────────────────────────────────────
  describe('view full cart (#viewFullCart)', () => {
    it('registers onClick handler', async () => {
      await onReadyHandler();
      expect(getEl('#viewFullCart').onClick).toHaveBeenCalled();
    });
  });

  // ── 6. Checkout button ──────────────────────────────────────────
  describe('checkout button (#sideCartCheckout)', () => {
    it('registers onClick handler', async () => {
      await onReadyHandler();
      expect(getEl('#sideCartCheckout').onClick).toHaveBeenCalled();
    });

    it('applies brand styling (coral background, white text)', async () => {
      await onReadyHandler();
      const el = getEl('#sideCartCheckout');
      expect(el.style.backgroundColor).toBe('#e8694a');
      expect(el.style.color).toBe('#fff');
    });
  });

  // ── 7. Repeater onItemReady registered ──────────────────────────
  describe('side cart repeater', () => {
    it('registers onItemReady on #sideCartRepeater', async () => {
      await onReadyHandler();
      expect(getEl('#sideCartRepeater').onItemReady).toHaveBeenCalled();
    });
  });

  // ── 8–12. Repeater onItemReady item setup ───────────────────────
  describe('repeater onItemReady item rendering', () => {
    const itemData = {
      _id: 'item-1',
      name: 'Carolina Futon',
      price: 299.99,
      quantity: 2,
      image: 'https://example.com/futon.jpg',
      lineTotal: 599.98,
      variantDetails: 'Size: Queen',
    };

    let $item;

    beforeEach(async () => {
      elements.clear();
      await onReadyHandler();

      // Extract the onItemReady callback and invoke it with a mock $item
      const onItemReadyCall = getEl('#sideCartRepeater').onItemReady.mock.calls[0];
      const onItemReadyCb = onItemReadyCall[0];

      const itemElements = new Map();
      $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };

      onItemReadyCb($item, itemData);
    });

    // 8. Image, name, price
    it('sets item image src and alt', () => {
      expect($item('#sideItemImage').src).toBe('https://example.com/futon.jpg');
      expect($item('#sideItemImage').alt).toBe('Carolina Futon');
    });

    it('sets item name text', () => {
      expect($item('#sideItemName').text).toBe('Carolina Futon');
    });

    it('sets item price text formatted', () => {
      expect($item('#sideItemPrice').text).toBe('$299.99');
    });

    // 9. Quantity display with ARIA
    it('sets quantity display with ARIA attributes', () => {
      expect($item('#sideItemQty').text).toBe('2');
      expect($item('#sideItemQty').accessibility.ariaLabel).toBe('Quantity of Carolina Futon');
      expect($item('#sideItemQty').accessibility.role).toBe('status');
      expect($item('#sideItemQty').accessibility.ariaLive).toBe('polite');
    });

    // 10. Quantity minus/plus ARIA labels
    it('registers quantity minus with ARIA label', () => {
      expect($item('#sideQtyMinus').onClick).toHaveBeenCalled();
      expect($item('#sideQtyMinus').accessibility.ariaLabel).toBe('Decrease quantity of Carolina Futon');
    });

    it('registers quantity plus with ARIA label', () => {
      expect($item('#sideQtyPlus').onClick).toHaveBeenCalled();
      expect($item('#sideQtyPlus').accessibility.ariaLabel).toBe('Increase quantity of Carolina Futon');
    });

    // 11. Remove button ARIA label
    it('registers remove button with ARIA label', () => {
      expect($item('#sideItemRemove').onClick).toHaveBeenCalled();
      expect($item('#sideItemRemove').accessibility.ariaLabel).toBe('Remove Carolina Futon from cart');
    });

    // 12. Save for later ARIA label
    it('registers save for later with ARIA label', () => {
      expect($item('#sideSaveForLater').onClick).toHaveBeenCalled();
      expect($item('#sideSaveForLater').accessibility.ariaLabel).toBe('Save Carolina Futon for later');
    });
  });

  // ── 13. onCartChanged registered ────────────────────────────────
  describe('onCartChanged', () => {
    it('registers a callback via onCartChanged', async () => {
      const { onCartChanged } = await import('public/cartService');
      await onReadyHandler();
      expect(onCartChanged).toHaveBeenCalled();
    });
  });

  // ── 14. collapseOnMobile for suggestions ────────────────────────
  describe('collapseOnMobile', () => {
    it('calls collapseOnMobile for #sideCartSuggestion', async () => {
      const { collapseOnMobile } = await import('public/mobileHelpers');
      await onReadyHandler();
      expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#sideCartSuggestion']);
    });
  });
});
