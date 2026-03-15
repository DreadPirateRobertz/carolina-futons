/**
 * Tests for Side Cart element hookup — CF-03jx
 * Covers: #cartBadge, #sideCartPanel, #sideCartTitle, #sideCartSubtotal,
 * #sideTierText, #sideCartClose, #sideCartOverlay, #sideCartCheckout,
 * #viewFullCart, #sideCartRepeater, #sideQtyMinus, #sideQtyPlus,
 * #sideItemImage, #sideItemName, #sideItemPrice, #sideItemQty,
 * #sideItemLineTotal, #sideItemVariant, #sideItemRemove, #sideSaveForLater,
 * #sideCartEmpty, #sideCartItems, #sideCartFooter, #sideShippingBar,
 * #sideShippingText, #sideTierBar
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
    expect($item).not.toBeNull();

    expect($item('#sideQtyMinus').style.color).toBe('#5B8FA8');
    expect($item('#sideQtyPlus').style.color).toBe('#5B8FA8');
  });

  it('sets ARIA labels with product name on qty buttons', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Vienna Futon Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideQtyMinus').accessibility.ariaLabel).toBe('Decrease quantity of Vienna Futon Frame');
    expect($item('#sideQtyPlus').accessibility.ariaLabel).toBe('Increase quantity of Vienna Futon Frame');
  });

  it('registers click handlers on qty buttons', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideQtyMinus').onClick).toHaveBeenCalled();
    expect($item('#sideQtyPlus').onClick).toHaveBeenCalled();
  });

  it('minus button calls updateCartItemQuantity with decremented value', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 3, image: 'frame.jpg', lineTotal: 1500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

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
    expect($item).not.toBeNull();

    const minusHandler = $item('#sideQtyMinus').onClick.mock.calls[0][0];
    const { updateCartItemQuantity } = await import('public/cartService');

    await minusHandler();

    expect(updateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('plus button calls updateCartItemQuantity with incremented value', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

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
    expect($item).not.toBeNull();

    const plusHandler = $item('#sideQtyPlus').onClick.mock.calls[0][0];
    const { updateCartItemQuantity } = await import('public/cartService');

    await plusHandler();

    expect(updateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('announces quantity change via a11y helper', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Kodiak Frame', price: 500, quantity: 2, image: 'frame.jpg', lineTotal: 1000 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    const plusHandler = $item('#sideQtyPlus').onClick.mock.calls[0][0];
    const { getCurrentCart } = await import('public/cartService');
    getCurrentCart.mockResolvedValue({ lineItems: [], totals: { subtotal: 0 } });

    await plusHandler();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Kodiak Frame'));
  });
});

// ── Side Cart Panel & ARIA Tests ────────────────────────────────────

describe('Side Cart — #sideCartPanel ARIA + styling hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA dialog role and modal on side cart panel', async () => {
    await loadPage();
    const panel = getEl('#sideCartPanel');
    expect(panel.accessibility.role).toBe('dialog');
    expect(panel.accessibility.ariaModal).toBe(true);
    expect(panel.accessibility.ariaLabel).toBe('Shopping cart');
  });

  it('styles panel with brand background color', async () => {
    await loadPage();
    expect(getEl('#sideCartPanel').style.backgroundColor).toBe('#FDF6EC');
  });

  it('styles header title with espresso color', async () => {
    await loadPage();
    expect(getEl('#sideCartTitle').style.color).toBe('#3A2518');
  });

  it('sets ARIA live regions on subtotal and tier text', async () => {
    await loadPage();
    expect(getEl('#sideCartSubtotal').accessibility.ariaLive).toBe('polite');
    expect(getEl('#sideCartSubtotal').accessibility.role).toBe('status');
    expect(getEl('#sideTierText').accessibility.ariaLive).toBe('polite');
    expect(getEl('#sideTierText').accessibility.role).toBe('status');
  });
});

describe('Side Cart — close/checkout/viewFullCart element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers click handler on close button', async () => {
    await loadPage();
    expect(getEl('#sideCartClose').onClick).toHaveBeenCalled();
  });

  it('sets ARIA label on close button', async () => {
    await loadPage();
    expect(getEl('#sideCartClose').accessibility.ariaLabel).toBe('Close cart');
  });

  it('registers click handler on overlay', async () => {
    await loadPage();
    expect(getEl('#sideCartOverlay').onClick).toHaveBeenCalled();
  });

  it('styles checkout button with coral CTA', async () => {
    await loadPage();
    const btn = getEl('#sideCartCheckout');
    expect(btn.style.backgroundColor).toBe('#E8845C');
    expect(btn.style.color).toBe('#fff');
  });

  it('registers click handler on checkout button', async () => {
    await loadPage();
    expect(getEl('#sideCartCheckout').onClick).toHaveBeenCalled();
  });

  it('styles view full cart link with mountain blue', async () => {
    await loadPage();
    expect(getEl('#viewFullCart').style.color).toBe('#5B8FA8');
  });

  it('registers click handler on view full cart', async () => {
    await loadPage();
    expect(getEl('#viewFullCart').onClick).toHaveBeenCalled();
  });
});

// ── Repeater Item Detail Tests ──────────────────────────────────────

describe('Side Cart — repeater item details hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets image src and alt on repeater items', async () => {
    await loadPage();
    const itemData = { _id: 'i1', name: 'Kodiak Frame', price: 500, quantity: 1, image: 'kodiak.jpg', lineTotal: 500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideItemImage').src).toBe('kodiak.jpg');
    expect($item('#sideItemImage').alt).toBe('Kodiak Frame');
  });

  it('sets name and price with brand styling', async () => {
    await loadPage();
    const itemData = { _id: 'i1', name: 'Kodiak Frame', price: 549.99, quantity: 1, image: 'k.jpg', lineTotal: 549.99 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideItemName').text).toBe('Kodiak Frame');
    expect($item('#sideItemName').style.color).toBe('#3A2518');
    expect($item('#sideItemPrice').text).toBe('$549.99');
    expect($item('#sideItemPrice').style.color).toBe('#5B8FA8');
  });

  it('sets quantity text and ARIA attributes', async () => {
    await loadPage();
    const itemData = { _id: 'i1', name: 'Vienna Frame', price: 400, quantity: 3, image: 'v.jpg', lineTotal: 1200 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideItemQty').text).toBe('3');
    expect($item('#sideItemQty').accessibility.ariaLabel).toBe('Quantity of Vienna Frame');
    expect($item('#sideItemQty').accessibility.role).toBe('status');
    expect($item('#sideItemQty').accessibility.ariaLive).toBe('polite');
  });

  it('sets line total text', async () => {
    await loadPage();
    const itemData = { _id: 'i1', name: 'Frame', price: 250, quantity: 2, image: 'f.jpg', lineTotal: 500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideItemLineTotal').text).toBe('$500.00');
  });

  it('styles remove button with coral accent and sets ARIA label', async () => {
    await loadPage();
    const itemData = { _id: 'i1', name: 'Kodiak Frame', price: 500, quantity: 1, image: 'k.jpg', lineTotal: 500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideItemRemove').style.color).toBe('#E8845C');
    expect($item('#sideItemRemove').accessibility.ariaLabel).toBe('Remove Kodiak Frame from cart');
  });

  it('registers click handler on remove button', async () => {
    await loadPage();
    const itemData = { _id: 'i1', name: 'Frame', price: 500, quantity: 1, image: 'f.jpg', lineTotal: 500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideItemRemove').onClick).toHaveBeenCalled();
  });

  it('sets ARIA label on save for later button', async () => {
    await loadPage();
    const itemData = { _id: 'i1', name: 'Kodiak Frame', price: 500, quantity: 1, image: 'k.jpg', lineTotal: 500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideSaveForLater').accessibility.ariaLabel).toBe('Save Kodiak Frame for later');
  });

  it('registers click handler on save for later button', async () => {
    await loadPage();
    const itemData = { _id: 'i1', name: 'Frame', price: 500, quantity: 1, image: 'f.jpg', lineTotal: 500 };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideSaveForLater').onClick).toHaveBeenCalled();
  });
});

// ── Empty/Populated State Tests ─────────────────────────────────────

describe('Side Cart — empty/populated state element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows empty state and hides items/footer when cart is empty', async () => {
    await loadPage();
    await refreshSideCart({ lineItems: [], totals: { subtotal: 0 } });

    expect(getEl('#sideCartEmpty').show).toHaveBeenCalled();
    expect(getEl('#sideCartItems').hide).toHaveBeenCalled();
    expect(getEl('#sideCartFooter').hide).toHaveBeenCalled();
  });

  it('hides empty state and shows items/footer when cart has items', async () => {
    await loadPage();
    await refreshSideCart({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 500, quantity: 1 }],
      totals: { subtotal: 500 },
    });

    expect(getEl('#sideCartEmpty').hide).toHaveBeenCalled();
    expect(getEl('#sideCartItems').show).toHaveBeenCalled();
    expect(getEl('#sideCartFooter').show).toHaveBeenCalled();
  });

  it('updates subtotal text on refresh', async () => {
    await loadPage();
    await refreshSideCart({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 549.99, quantity: 1 }],
      totals: { subtotal: 549.99 },
    });

    expect(getEl('#sideCartSubtotal').text).toBe('$549.99');
  });
});

// ── Shipping / Tier Progress After Refresh ──────────────────────────

describe('Side Cart — #sideShippingBar / #sideShippingText after refresh', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets shipping progress bar and text on cart refresh', async () => {
    await loadPage();
    await refreshSideCart({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 500, quantity: 1 }],
      totals: { subtotal: 500 },
    });

    const bar = getEl('#sideShippingBar');
    expect(bar.value).toBe(50); // from mock
    expect(bar.style.backgroundColor).toBeDefined();

    const text = getEl('#sideShippingText');
    expect(text.text).toContain('$100.00');
    expect(text.text).toContain('free shipping');
  });

  it('sets ARIA live on shipping text', async () => {
    await loadPage();
    await refreshSideCart({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 500, quantity: 1 }],
      totals: { subtotal: 500 },
    });

    expect(getEl('#sideShippingText').accessibility.ariaLive).toBe('polite');
    expect(getEl('#sideShippingText').accessibility.role).toBe('status');
  });
});

describe('Side Cart — #sideTierBar / #sideTierText after refresh', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets tier progress bar and text on cart refresh', async () => {
    await loadPage();
    await refreshSideCart({
      lineItems: [{ _id: 'i1', name: 'Frame', price: 500, quantity: 1 }],
      totals: { subtotal: 500 },
    });

    const bar = getEl('#sideTierBar');
    expect(bar.value).toBe(60); // from mock
    const text = getEl('#sideTierText');
    expect(text.text).toContain('$50.00');
  });
});

// ── Variant Display Tests ───────────────────────────────────────────

describe('Side Cart — #sideItemVariant display logic', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows variant details when present', async () => {
    await loadPage();
    const itemData = {
      _id: 'i1', name: 'Frame', price: 500, quantity: 1, image: 'f.jpg', lineTotal: 500,
      variantDetails: 'Size: Queen · Finish: Honey Oak',
    };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideItemVariant').text).toBe('Size: Queen · Finish: Honey Oak');
    expect($item('#sideItemVariant').show).toHaveBeenCalled();
  });

  it('shows variant name as fallback when variantDetails is absent', async () => {
    await loadPage();
    const itemData = {
      _id: 'i1', name: 'Frame', price: 500, quantity: 1, image: 'f.jpg', lineTotal: 500,
      variantName: 'Queen / Honey Oak',
    };
    const $item = simulateRepeaterItem('#sideCartRepeater', itemData);
    expect($item).not.toBeNull();

    expect($item('#sideItemVariant').text).toBe('Queen / Honey Oak');
    expect($item('#sideItemVariant').show).toHaveBeenCalled();
  });
});
