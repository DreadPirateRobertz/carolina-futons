/**
 * Tests for pages/Side Cart.js
 * Covers: panel init, repeater items, quantity controls, remove, refresh, shipping/tier progress.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockElement } from './helpers/wixMocks.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/productRecommendations.web', () => ({
  getCompletionSuggestions: vi.fn(),
}));

vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn(),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  removeCartItem: vi.fn(),
  onCartChanged: vi.fn(),
  getShippingProgress: vi.fn(() => ({ remaining: 100, progressPct: 50, qualifies: false })),
  getTierProgress: vi.fn(() => ({
    tier: { label: (r) => `$${r} to next tier` },
    remaining: 50,
    progressPct: 60,
  })),
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10,
  safeMultiply: vi.fn((a, b) => a * b),
  isFreeShippingEnabled: vi.fn(() => false),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/SaveForLater.js', () => ({
  saveForLater: vi.fn(),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  collapseOnMobile: vi.fn(),
}));

vi.mock('public/cartStyles.js', () => ({
  getCartItemStyles: vi.fn(() => ({ nameColor: '#333', priceColor: '#1E3A5F', removeColor: '#DC2626' })),
  getProgressBarStyles: vi.fn(() => ({ trackColor: '#E5E7EB', fillColor: '#5B8FA8', textColor: '#333' })),
  getSideCartPanelStyles: vi.fn(() => ({
    panelBackground: '#FFFFFF',
    headerColor: '#1E3A5F',
    viewCartLinkColor: '#5B8FA8',
  })),
  getCheckoutButtonStyles: vi.fn(() => ({ background: '#E07A5F', textColor: '#FFFFFF' })),
  getQuantitySpinnerStyles: vi.fn(() => ({ buttonColor: '#5B8FA8' })),
}));

vi.mock('public/crossSellWidget.js', () => ({
  buildRoomBundles: vi.fn(() => []),
  initCrossSellWidget: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

// ── Load Page ───────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

async function loadPage() {
  await import('../src/pages/Side Cart.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Panel Initialization ────────────────────────────────────────────

describe('initSideCart', () => {
  it('sets ARIA dialog attributes on side cart panel', async () => {
    await loadPage();
    const panel = getEl('#sideCartPanel');
    expect(panel.accessibility.role).toBe('dialog');
    expect(panel.accessibility.ariaModal).toBe(true);
    expect(panel.accessibility.ariaLabel).toBe('Shopping cart');
  });

  it('applies brand panel styles', async () => {
    await loadPage();
    expect(getEl('#sideCartPanel').style.backgroundColor).toBe('#FFFFFF');
    expect(getEl('#sideCartTitle').style.color).toBe('#1E3A5F');
  });

  it('sets ARIA live regions for dynamic content', async () => {
    await loadPage();
    expect(getEl('#sideCartSubtotal').accessibility.ariaLive).toBe('polite');
    expect(getEl('#sideTierText').accessibility.ariaLive).toBe('polite');
    expect(getEl('#cartBadge').accessibility.ariaLive).toBe('polite');
  });

  it('wires close button with ARIA label', async () => {
    await loadPage();
    expect(getEl('#sideCartClose').onClick).toHaveBeenCalled();
    expect(getEl('#sideCartClose').accessibility.ariaLabel).toBe('Close cart');
  });

  it('close button hides panel and announces', async () => {
    await loadPage();
    const closeFn = getEl('#sideCartClose').onClick.mock.calls[0][0];
    closeFn();

    expect(getEl('#sideCartPanel').hide).toHaveBeenCalled();
    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith($w, 'Cart closed');
    expect(getEl('#cartIcon').focus).toHaveBeenCalled();
  });

  it('wires overlay click to close', async () => {
    await loadPage();
    expect(getEl('#sideCartOverlay').onClick).toHaveBeenCalled();
  });

  it('wires checkout button with coral CTA styles', async () => {
    await loadPage();
    const checkout = getEl('#sideCartCheckout');
    expect(checkout.style.backgroundColor).toBe('#E07A5F');
    expect(checkout.style.color).toBe('#FFFFFF');
    expect(checkout.onClick).toHaveBeenCalled();
  });

  it('wires view full cart link with mountain blue', async () => {
    await loadPage();
    expect(getEl('#viewFullCart').style.color).toBe('#5B8FA8');
    expect(getEl('#viewFullCart').onClick).toHaveBeenCalled();
  });

  it('registers onCartChanged listener', async () => {
    await loadPage();
    const { onCartChanged } = await import('public/cartService');
    expect(onCartChanged).toHaveBeenCalled();
  });

  it('calls collapseOnMobile for suggestions section', async () => {
    await loadPage();
    const { collapseOnMobile } = await import('public/mobileHelpers');
    expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#sideCartSuggestion']);
  });
});

// ── Side Cart Repeater ──────────────────────────────────────────────

describe('initSideCartRepeater', () => {
  const mockItem = {
    _id: 'item-1',
    name: 'Clover Murphy Bed',
    price: 2598,
    quantity: 2,
    image: 'https://example.com/clover.jpg',
    lineTotal: 5196,
    variantDetails: 'Size: Queen · Finish: Cherry',
    variantName: 'Queen, Cherry',
  };

  async function getItemReadyFn() {
    await loadPage();
    const repeater = getEl('#sideCartRepeater');
    return repeater.onItemReady.mock.calls[0][0];
  }

  function createItemScope() {
    const itemElements = new Map();
    return (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
  }

  it('registers onItemReady on the repeater', async () => {
    await loadPage();
    expect(getEl('#sideCartRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets item image, name, and price', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();

    itemReadyFn($item, mockItem);

    expect($item('#sideItemImage').src).toBe('https://example.com/clover.jpg');
    expect($item('#sideItemName').text).toBe('Clover Murphy Bed');
    expect($item('#sideItemPrice').text).toBe('$2598.00');
  });

  it('sets quantity text with ARIA attributes', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();

    itemReadyFn($item, mockItem);

    expect($item('#sideItemQty').text).toBe('2');
    expect($item('#sideItemQty').accessibility.ariaLabel).toContain('Clover Murphy Bed');
    expect($item('#sideItemQty').accessibility.role).toBe('status');
  });

  it('sets line total', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();

    itemReadyFn($item, mockItem);

    expect($item('#sideItemLineTotal').text).toBe('$5196.00');
  });

  it('shows variant details when present', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();

    itemReadyFn($item, mockItem);

    expect($item('#sideItemVariant').text).toBe('Size: Queen · Finish: Cherry');
    expect($item('#sideItemVariant').show).toHaveBeenCalled();
  });

  it('falls back to variantName when variantDetails is empty', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();

    itemReadyFn($item, { ...mockItem, variantDetails: '', variantName: 'Queen' });

    expect($item('#sideItemVariant').text).toBe('Queen');
    expect($item('#sideItemVariant').show).toHaveBeenCalled();
  });

  it('minus button decreases quantity and calls updateCartItemQuantity', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    const { updateCartItemQuantity } = await import('public/cartService');
    updateCartItemQuantity.mockResolvedValue();

    const minusFn = $item('#sideQtyMinus').onClick.mock.calls[0][0];
    await minusFn();

    expect(updateCartItemQuantity).toHaveBeenCalledWith('item-1', 1); // 2 - 1
    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('decreased to 1'));
  });

  it('minus button does nothing at MIN_QUANTITY', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, { ...mockItem, quantity: 1 });

    const { updateCartItemQuantity } = await import('public/cartService');
    updateCartItemQuantity.mockClear();
    const minusFn = $item('#sideQtyMinus').onClick.mock.calls[0][0];
    await minusFn();

    expect(updateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('plus button increases quantity and calls updateCartItemQuantity', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    const { updateCartItemQuantity } = await import('public/cartService');
    updateCartItemQuantity.mockResolvedValue();

    const plusFn = $item('#sideQtyPlus').onClick.mock.calls[0][0];
    await plusFn();

    expect(updateCartItemQuantity).toHaveBeenCalledWith('item-1', 3); // 2 + 1
  });

  it('plus button does nothing at MAX_QUANTITY', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, { ...mockItem, quantity: 10 });

    const { updateCartItemQuantity } = await import('public/cartService');
    updateCartItemQuantity.mockClear();
    const plusFn = $item('#sideQtyPlus').onClick.mock.calls[0][0];
    await plusFn();

    expect(updateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('remove button calls removeCartItem and announces', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    const { removeCartItem } = await import('public/cartService');
    removeCartItem.mockResolvedValue();

    const removeFn = $item('#sideItemRemove').onClick.mock.calls[0][0];
    await removeFn();

    expect(removeCartItem).toHaveBeenCalledWith('item-1');
    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith($w, 'Clover Murphy Bed removed from cart');
  });

  it('remove button applies slide animation before removal', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    const { removeCartItem } = await import('public/cartService');
    removeCartItem.mockResolvedValue();

    const removeFn = $item('#sideItemRemove').onClick.mock.calls[0][0];
    await removeFn();

    expect($item('#sideItemImage').hide).toHaveBeenCalled();
    expect($item('#sideItemName').hide).toHaveBeenCalled();
  });

  it('remove button sets ARIA label', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    expect($item('#sideItemRemove').accessibility.ariaLabel).toBe('Remove Clover Murphy Bed from cart');
  });

  it('save for later calls saveForLater and announces on success', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    const { saveForLater } = await import('public/SaveForLater.js');
    saveForLater.mockResolvedValue({ success: true });

    const saveFn = $item('#sideSaveForLater').onClick.mock.calls[0][0];
    await saveFn();

    expect(saveForLater).toHaveBeenCalled();
    expect($item('#sideSaveForLater').disable).toHaveBeenCalled();
    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('saved to your wishlist'));
  });

  it('save for later shows auth message when not logged in', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    const { saveForLater } = await import('public/SaveForLater.js');
    saveForLater.mockResolvedValue({ success: false, reason: 'not_authenticated' });

    const saveFn = $item('#sideSaveForLater').onClick.mock.calls[0][0];
    await saveFn();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith($w, 'Please log in to save items for later');
    expect($item('#sideSaveForLater').enable).toHaveBeenCalled();
  });
});

// ── refreshSideCart ─────────────────────────────────────────────────

describe('refreshSideCart', () => {
  async function triggerRefresh(cartData) {
    const { getCurrentCart, onCartChanged } = await import('public/cartService');
    getCurrentCart.mockResolvedValue(cartData);

    await loadPage();

    // Trigger the onCartChanged listener
    const cartChangedFn = onCartChanged.mock.calls[0][0];
    await cartChangedFn();
  }

  it('shows empty state when cart is empty', async () => {
    await triggerRefresh({ lineItems: [], totals: { subtotal: 0 } });

    expect(getEl('#sideCartEmpty').show).toHaveBeenCalled();
    expect(getEl('#sideCartItems').hide).toHaveBeenCalled();
    expect(getEl('#sideCartFooter').hide).toHaveBeenCalled();
    expect(getEl('#cartBadge').hide).toHaveBeenCalled();
  });

  it('shows empty state when cart is null', async () => {
    await triggerRefresh(null);

    expect(getEl('#sideCartEmpty').show).toHaveBeenCalled();
  });

  it('shows items when cart has line items', async () => {
    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [] }],
      totals: { subtotal: 499 },
    });

    expect(getEl('#sideCartEmpty').hide).toHaveBeenCalled();
    expect(getEl('#sideCartItems').show).toHaveBeenCalled();
    expect(getEl('#sideCartFooter').show).toHaveBeenCalled();
  });

  it('updates cart badge with total item count', async () => {
    await triggerRefresh({
      lineItems: [
        { _id: 'i1', name: 'Frame', price: 499, quantity: 2, options: [] },
        { _id: 'i2', name: 'Cover', price: 99, quantity: 1, options: [] },
      ],
      totals: { subtotal: 1097 },
    });

    expect(getEl('#cartBadge').text).toBe('3'); // 2 + 1
    expect(getEl('#cartBadge').show).toHaveBeenCalled();
  });

  it('sets repeater data with formatted line items', async () => {
    await triggerRefresh({
      lineItems: [{
        _id: 'i1',
        name: 'Clover',
        price: 499,
        quantity: 2,
        options: [{ option: 'Size', value: 'Queen' }],
        mediaItem: { src: 'https://img.com/clover.jpg' },
      }],
      totals: { subtotal: 998 },
    });

    const data = getEl('#sideCartRepeater').data;
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Clover');
    expect(data[0].variantDetails).toBe('Size: Queen');
  });

  it('updates subtotal text', async () => {
    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [] }],
      totals: { subtotal: 499 },
    });

    expect(getEl('#sideCartSubtotal').text).toBe('$499.00');
  });

  it('hides shipping bar and text when free shipping is disabled', async () => {
    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [] }],
      totals: { subtotal: 499 },
    });

    expect(getEl('#sideShippingBar').hide).toHaveBeenCalled();
    expect(getEl('#sideShippingText').hide).toHaveBeenCalled();
  });

  it('calls getCompletionSuggestions for cross-sell', async () => {
    const { getCompletionSuggestions } = await import('backend/productRecommendations.web');
    getCompletionSuggestions.mockResolvedValue([]);

    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [], productId: 'p1' }],
      totals: { subtotal: 499 },
    });

    expect(getCompletionSuggestions).toHaveBeenCalledWith(['p1']);
  });

  it('collapses suggestion section when no suggestions', async () => {
    const { getCompletionSuggestions } = await import('backend/productRecommendations.web');
    getCompletionSuggestions.mockResolvedValue([]);

    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [], productId: 'p1' }],
      totals: { subtotal: 499 },
    });

    expect(getEl('#sideCartSuggestion').collapse).toHaveBeenCalled();
  });

  it('calls initCrossSellWidget when suggestions exist', async () => {
    const { getCompletionSuggestions } = await import('backend/productRecommendations.web');
    const { buildRoomBundles, initCrossSellWidget } = await import('public/crossSellWidget.js');
    const mockSuggestions = [{ _id: 's1', name: 'Cover', slug: 'cover', price: 99 }];
    const mockBundles = [{ name: 'Room Bundle', items: mockSuggestions, totalPrice: 99 }];
    getCompletionSuggestions.mockResolvedValue(mockSuggestions);
    buildRoomBundles.mockReturnValue(mockBundles);

    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [], productId: 'p1' }],
      totals: { subtotal: 499 },
    });

    expect(buildRoomBundles).toHaveBeenCalledWith(mockSuggestions, 499);
    expect(initCrossSellWidget).toHaveBeenCalledWith($w, expect.objectContaining({
      bundles: mockBundles,
    }));
  });

  it('limits suggestions to 2 on mobile', async () => {
    const { getCompletionSuggestions } = await import('backend/productRecommendations.web');
    const { buildRoomBundles, initCrossSellWidget } = await import('public/crossSellWidget.js');
    const { isMobile } = await import('public/mobileHelpers');
    isMobile.mockReturnValue(true);

    const manySuggestions = Array.from({ length: 5 }, (_, i) => ({
      _id: `s${i}`, name: `Item ${i}`, slug: `item-${i}`, price: 50,
    }));
    getCompletionSuggestions.mockResolvedValue(manySuggestions);
    buildRoomBundles.mockReturnValue([{ name: 'Bundle', items: [] }]);

    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [], productId: 'p1' }],
      totals: { subtotal: 499 },
    });

    // buildRoomBundles should receive only 2 suggestions on mobile
    expect(buildRoomBundles).toHaveBeenCalledWith(manySuggestions.slice(0, 2), 499);
  });

  it('collapses suggestion section when bundles are empty', async () => {
    const { getCompletionSuggestions } = await import('backend/productRecommendations.web');
    const { buildRoomBundles } = await import('public/crossSellWidget.js');
    getCompletionSuggestions.mockResolvedValue([{ _id: 's1', name: 'Cover' }]);
    buildRoomBundles.mockReturnValue([]);

    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [], productId: 'p1' }],
      totals: { subtotal: 499 },
    });

    expect(getEl('#sideCartSuggestion').collapse).toHaveBeenCalled();
  });

  it('updates tier progress bar and text', async () => {
    const { getTierProgress } = await import('public/cartService');
    getTierProgress.mockReturnValue({
      tier: { label: (r) => `$${r} to 10% off` },
      remaining: 75,
      progressPct: 40,
    });

    await triggerRefresh({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 499, quantity: 1, options: [] }],
      totals: { subtotal: 499 },
    });

    expect(getEl('#sideTierBar').value).toBe(40);
    expect(getEl('#sideTierText').text).toBe('$75.00 to 10% off');
  });

  it('formats variant details from options array', async () => {
    await triggerRefresh({
      lineItems: [{
        _id: 'i1',
        name: 'Frame',
        price: 499,
        quantity: 1,
        options: [{ option: 'Size', value: 'Queen' }, { option: 'Finish', value: 'Walnut' }],
      }],
      totals: { subtotal: 499 },
    });

    const data = getEl('#sideCartRepeater').data;
    expect(data[0].variantDetails).toBe('Size: Queen · Finish: Walnut');
    expect(data[0].variantName).toBe('Queen, Walnut');
  });

  it('handles line items with no options', async () => {
    await triggerRefresh({
      lineItems: [{
        _id: 'i1',
        name: 'Frame',
        price: 499,
        quantity: 1,
        options: undefined,
      }],
      totals: { subtotal: 499 },
    });

    const data = getEl('#sideCartRepeater').data;
    expect(data[0].variantDetails).toBe('');
    expect(data[0].variantName).toBe('');
  });

  it('uses mediaItem.src for image when available', async () => {
    await triggerRefresh({
      lineItems: [{
        _id: 'i1',
        name: 'Frame',
        price: 499,
        quantity: 1,
        options: [],
        mediaItem: { src: 'https://img.com/frame-hires.jpg' },
      }],
      totals: { subtotal: 499 },
    });

    const data = getEl('#sideCartRepeater').data;
    expect(data[0].image).toBe('https://img.com/frame-hires.jpg');
  });

  it('falls back to empty string for image when no mediaItem', async () => {
    await triggerRefresh({
      lineItems: [{
        _id: 'i1',
        name: 'Frame',
        price: 499,
        quantity: 1,
        options: [],
      }],
      totals: { subtotal: 499 },
    });

    const data = getEl('#sideCartRepeater').data;
    expect(data[0].image).toBe('');
  });
});

// ── Escape Key & Swipe ──────────────────────────────────────────────

describe('keyboard and touch interactions', () => {
  let mockDocument;

  beforeEach(() => {
    mockDocument = { addEventListener: vi.fn() };
    globalThis.document = mockDocument;
  });

  afterEach(() => {
    delete globalThis.document;
  });

  it('registers escape key listener on document', async () => {
    await loadPage();
    expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('escape key closes visible panel', async () => {
    await loadPage();

    const keydownHandler = mockDocument.addEventListener.mock.calls.find(c => c[0] === 'keydown')[1];
    getEl('#sideCartPanel').hidden = false;
    keydownHandler({ key: 'Escape' });

    expect(getEl('#sideCartPanel').hide).toHaveBeenCalled();
  });

  it('escape key does nothing when panel is hidden', async () => {
    await loadPage();

    const keydownHandler = mockDocument.addEventListener.mock.calls.find(c => c[0] === 'keydown')[1];
    getEl('#sideCartPanel').hidden = true;
    getEl('#sideCartPanel').hide.mockClear();
    keydownHandler({ key: 'Escape' });

    expect(getEl('#sideCartPanel').hide).not.toHaveBeenCalled();
  });

  it('calls enableSwipe on panel htmlElement', async () => {
    const mockHtmlEl = { style: {} };
    getEl('#sideCartPanel').htmlElement = mockHtmlEl;
    await loadPage();

    const { enableSwipe } = await import('public/touchHelpers');
    expect(enableSwipe).toHaveBeenCalledWith(
      mockHtmlEl,
      expect.any(Function),
      { threshold: 50, maxTime: 400 },
    );
  });
});

// ── Navigation ──────────────────────────────────────────────────────

describe('navigation buttons', () => {
  it('checkout button navigates to /checkout', async () => {
    await loadPage();
    const checkoutFn = getEl('#sideCartCheckout').onClick.mock.calls[0][0];
    checkoutFn();

    await new Promise(r => setTimeout(r, 50));
    const { to } = await import('wix-location-frontend');
    expect(to).toHaveBeenCalledWith('/checkout');
  });

  it('view full cart button navigates to /cart-page', async () => {
    await loadPage();
    const viewCartFn = getEl('#viewFullCart').onClick.mock.calls[0][0];
    viewCartFn();

    await new Promise(r => setTimeout(r, 50));
    const { to } = await import('wix-location-frontend');
    expect(to).toHaveBeenCalledWith('/cart-page');
  });
});

// ── Repeater Edge Cases ─────────────────────────────────────────────

describe('repeater edge cases', () => {
  const mockItem = {
    _id: 'item-1',
    name: 'Clover Murphy Bed',
    price: 2598,
    quantity: 2,
    image: 'https://example.com/clover.jpg',
    lineTotal: 5196,
    variantDetails: '',
    variantName: '',
  };

  async function getItemReadyFn() {
    await loadPage();
    return getEl('#sideCartRepeater').onItemReady.mock.calls[0][0];
  }

  function createItemScope() {
    const itemElements = new Map();
    return (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
  }

  it('sets alt text on item image', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    expect($item('#sideItemImage').alt).toBe('Clover Murphy Bed');
  });

  it('applies brand colors to item name and price', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    expect($item('#sideItemName').style.color).toBe('#333');
    expect($item('#sideItemPrice').style.color).toBe('#1E3A5F');
  });

  it('applies mountain blue color to spinner buttons', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    expect($item('#sideQtyMinus').style.color).toBe('#5B8FA8');
    expect($item('#sideQtyPlus').style.color).toBe('#5B8FA8');
  });

  it('minus button sets ARIA label with product name', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    expect($item('#sideQtyMinus').accessibility.ariaLabel).toBe('Decrease quantity of Clover Murphy Bed');
    expect($item('#sideQtyPlus').accessibility.ariaLabel).toBe('Increase quantity of Clover Murphy Bed');
  });

  it('save for later re-enables button on error', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, { ...mockItem, variantDetails: 'Size: Queen' });

    const { saveForLater } = await import('public/SaveForLater.js');
    saveForLater.mockRejectedValue(new Error('Network error'));

    const saveFn = $item('#sideSaveForLater').onClick.mock.calls[0][0];
    await saveFn();

    expect($item('#sideSaveForLater').enable).toHaveBeenCalled();
  });

  it('save for later passes correct product data', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    const itemWithMedia = {
      ...mockItem,
      productId: 'prod-123',
      mediaItem: { src: 'https://img.com/hires.jpg' },
    };
    itemReadyFn($item, itemWithMedia);

    const { saveForLater } = await import('public/SaveForLater.js');
    saveForLater.mockResolvedValue({ success: true });

    const saveFn = $item('#sideSaveForLater').onClick.mock.calls[0][0];
    await saveFn();

    expect(saveForLater).toHaveBeenCalledWith({
      _id: 'item-1',
      productId: 'prod-123',
      name: 'Clover Murphy Bed',
      price: 2598,
      image: 'https://img.com/hires.jpg',
    });
  });

  it('does not show variant when both variantDetails and variantName are empty', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, { ...mockItem, variantDetails: '', variantName: '' });

    expect($item('#sideItemVariant').show).not.toHaveBeenCalled();
  });

  it('applies coral accent to remove button', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    expect($item('#sideItemRemove').style.color).toBe('#DC2626');
  });

  it('sets save for later ARIA label', async () => {
    const itemReadyFn = await getItemReadyFn();
    const $item = createItemScope();
    itemReadyFn($item, mockItem);

    expect($item('#sideSaveForLater').accessibility.ariaLabel).toBe('Save Clover Murphy Bed for later');
  });
});
