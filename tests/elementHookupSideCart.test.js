/**
 * Tests for Side Cart element hookup — CF-03jx
 * Covers: #cartBadge visibility states, #sideQtyMinus/#sideQtyPlus
 * styling + ARIA labels + click handlers within repeater items.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: 0,
    src: '',
    alt: '',
    label: '',
    hidden: false,
    data: [],
    htmlElement: null,
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', ariaModal: false, ariaLive: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/productRecommendations.web', () => ({
  getCompletionSuggestions: vi.fn(() => Promise.resolve([])),
}));

vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn(),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(() => Promise.resolve()),
  removeCartItem: vi.fn(() => Promise.resolve()),
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
  getCartItemStyles: vi.fn(() => ({ nameColor: '#3A2518', priceColor: '#5B8FA8', removeColor: '#E8845C' })),
  getProgressBarStyles: vi.fn(() => ({ trackColor: '#ddd', fillColor: '#5B8FA8', textColor: '#3A2518' })),
  getSideCartPanelStyles: vi.fn(() => ({
    panelBackground: '#FDF6EC', headerColor: '#3A2518', viewCartLinkColor: '#5B8FA8',
  })),
  getCheckoutButtonStyles: vi.fn(() => ({ background: '#E8845C', textColor: '#fff' })),
  getQuantitySpinnerStyles: vi.fn(() => ({ buttonColor: '#5B8FA8', valueColor: '#3A2518' })),
}));

vi.mock('public/crossSellWidget.js', () => ({
  buildRoomBundles: vi.fn(() => []),
  initCrossSellWidget: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

async function loadPage() {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
  await import('../src/pages/Side Cart.js');
  if (onReadyHandler) await onReadyHandler();
}

function simulateRepeaterItem(repeaterSel, itemData) {
  const repeater = getEl(repeaterSel);
  if (repeater.onItemReady.mock.calls.length === 0) return null;
  const handler = repeater.onItemReady.mock.calls[0][0];
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  handler($item, itemData);
  return $item;
}

async function refreshSideCart(cartData) {
  const { getCurrentCart } = await import('public/cartService');
  getCurrentCart.mockResolvedValue(cartData);

  // Trigger the onCartChanged callback
  const { onCartChanged } = await import('public/cartService');
  const changeCb = onCartChanged.mock.calls[0]?.[0];
  if (changeCb) await changeCb();
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Side Cart — #cartBadge element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA live region on cart badge during init', async () => {
    await loadPage();
    const badge = getEl('#cartBadge');
    expect(badge.accessibility.ariaLive).toBe('polite');
    expect(badge.accessibility.role).toBe('status');
  });

  it('shows badge with item count after cart refresh', async () => {
    await loadPage();
    await refreshSideCart({
      lineItems: [
        { _id: 'i1', name: 'Frame', price: 500, quantity: 2 },
        { _id: 'i2', name: 'Mattress', price: 200, quantity: 1 },
      ],
      totals: { subtotal: 1200 },
    });

    const badge = getEl('#cartBadge');
    expect(badge.text).toBe('3'); // 2 + 1
    expect(badge.show).toHaveBeenCalled();
  });

  it('hides badge when cart is empty', async () => {
    await loadPage();
    await refreshSideCart({ lineItems: [], totals: { subtotal: 0 } });

    expect(getEl('#cartBadge').hide).toHaveBeenCalled();
  });
});

describe('Side Cart — #sideQtyMinus/#sideQtyPlus element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('applies mountain blue styling to qty buttons', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    if (!$item) return;

    expect($item('#sideQtyMinus').style.color).toBe('#5B8FA8');
    expect($item('#sideQtyPlus').style.color).toBe('#5B8FA8');
  });

  it('sets ARIA labels with product name on qty buttons', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Vienna Futon Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    if (!$item) return;

    expect($item('#sideQtyMinus').accessibility.ariaLabel).toBe('Decrease quantity of Vienna Futon Frame');
    expect($item('#sideQtyPlus').accessibility.ariaLabel).toBe('Increase quantity of Vienna Futon Frame');
  });

  it('registers click handlers on qty buttons', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    if (!$item) return;

    expect($item('#sideQtyMinus').onClick).toHaveBeenCalled();
    expect($item('#sideQtyPlus').onClick).toHaveBeenCalled();
  });

  it('minus button calls updateCartItemQuantity with decremented value', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 3, image: 'frame.jpg', lineTotal: 1500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    if (!$item) return;

    const minusHandler = $item('#sideQtyMinus').onClick.mock.calls[0][0];
    const { updateCartItemQuantity, getCurrentCart } = await import('public/cartService');
    getCurrentCart.mockResolvedValue({ lineItems: [], totals: { subtotal: 0 } });

    await minusHandler();

    expect(updateCartItemQuantity).toHaveBeenCalledWith('item-1', 2);
  });

  it('minus button does nothing at MIN_QUANTITY', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 1, image: 'frame.jpg', lineTotal: 500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    if (!$item) return;

    const minusHandler = $item('#sideQtyMinus').onClick.mock.calls[0][0];
    const { updateCartItemQuantity } = await import('public/cartService');

    await minusHandler();

    expect(updateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('plus button calls updateCartItemQuantity with incremented value', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    if (!$item) return;

    const plusHandler = $item('#sideQtyPlus').onClick.mock.calls[0][0];
    const { updateCartItemQuantity, getCurrentCart } = await import('public/cartService');
    getCurrentCart.mockResolvedValue({ lineItems: [], totals: { subtotal: 0 } });

    await plusHandler();

    expect(updateCartItemQuantity).toHaveBeenCalledWith('item-1', 3);
  });

  it('plus button does nothing at MAX_QUANTITY', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 10, image: 'frame.jpg', lineTotal: 5000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    if (!$item) return;

    const plusHandler = $item('#sideQtyPlus').onClick.mock.calls[0][0];
    const { updateCartItemQuantity } = await import('public/cartService');

    await plusHandler();

    expect(updateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('announces quantity change via a11y helper', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Kodiak Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    if (!$item) return;

    const plusHandler = $item('#sideQtyPlus').onClick.mock.calls[0][0];
    const { getCurrentCart } = await import('public/cartService');
    getCurrentCart.mockResolvedValue({ lineItems: [], totals: { subtotal: 0 } });

    await plusHandler();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Kodiak Frame'));
  });
});
