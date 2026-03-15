/**
 * Tests for Cart Page element hookup — CF-03jx
 * Covers: #cartFinancingSection, #financingThreshold, #cartFinancingTeaser,
 * #cartAfterpayMessage, #emptyCartSection, #emptyCartTitle, #emptyCartMessage,
 * #continueShoppingBtn, #shippingProgressBar, #shippingProgressText,
 * #tierProgressBar, #tierProgressText, #cartSubtotal, #cartTotal,
 * #cartItemsRepeater, #cartItemName, #cartItemPrice, #qtyMinus, #qtyPlus,
 * #qtyInput, #removeItem, #saveForLaterBtn
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    alt: '',
    data: [],
    collapsed: false,
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: { ariaLabel: '', ariaLive: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
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

vi.mock('backend/financingCalc.web', () => ({
  getCartFinancing: vi.fn(() => Promise.resolve({ success: false })),
}));

vi.mock('public/galleryHelpers', () => ({
  getRecentlyViewed: vi.fn(() => []),
}));

vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn(),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(() => Promise.resolve()),
  removeCartItem: vi.fn(() => Promise.resolve()),
  onCartChanged: vi.fn(),
  getShippingProgress: vi.fn(() => ({ remaining: 50, progressPct: 60, qualifies: false })),
  getTierProgress: vi.fn(() => ({
    tier: { label: (r) => `Spend $${r} more for 10% off!` },
    remaining: 100,
    progressPct: 40,
  })),
  FREE_SHIPPING_THRESHOLD: 199,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10,
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  collapseOnMobile: vi.fn(),
  limitForViewport: vi.fn((p) => p),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireViewCart: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/cartStyles.js', () => ({
  getCartItemStyles: vi.fn(() => ({ nameColor: '#3A2518', priceColor: '#5B8FA8', removeColor: '#E8845C' })),
  getProgressBarStyles: vi.fn(() => ({ trackColor: '#ddd', fillColor: '#5B8FA8', textColor: '#3A2518' })),
  getEmptyCartStyles: vi.fn(() => ({ headingColor: '#3A2518', messageColor: '#8B7355' })),
  getCheckoutButtonStyles: vi.fn(() => ({ background: '#E8845C', textColor: '#fff' })),
  getQuantitySpinnerStyles: vi.fn(() => ({ buttonColor: '#5B8FA8', valueColor: '#3A2518' })),
}));

vi.mock('public/crossSellWidget.js', () => ({
  buildRoomBundles: vi.fn(() => []),
  initCrossSellWidget: vi.fn(),
}));

vi.mock('public/SaveForLater.js', () => ({
  saveForLater: vi.fn(),
}));

vi.mock('public/cartDeliveryEstimate.js', () => ({
  initCartDeliveryEstimate: vi.fn(() => Promise.resolve()),
  updateCartDeliveryEstimate: vi.fn(),
}));

vi.mock('public/CouponCodeInput.js', () => ({
  initCouponCodeInput: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

async function loadPage(overrides = {}) {
  elements.clear();
  onReadyHandler = null;

  const { getCurrentCart } = await import('public/cartService');
  getCurrentCart.mockResolvedValue(overrides.cart ?? {
    lineItems: [{ _id: 'item-1', productId: 'p1', name: 'Frame', price: 549.99, quantity: 1 }],
    totals: { subtotal: 549.99, shipping: 0, total: 549.99 },
  });

  const { getCartFinancing } = await import('backend/financingCalc.web');
  getCartFinancing.mockResolvedValue(overrides.financing ?? { success: false });

  vi.resetModules();
  await import('../src/pages/Cart Page.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── #financingThreshold Tests ───────────────────────────────────────

describe('Cart Page — #financingThreshold element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows threshold message when financing response includes thresholdMessage', async () => {
    await loadPage({
      financing: {
        success: true,
        thresholdMessage: 'Add $50 more to unlock financing',
        financing: { lowestMonthly: null },
        afterpay: { eligible: false },
      },
    });

    const el = getEl('#financingThreshold');
    expect(el.text).toBe('Add $50 more to unlock financing');
    expect(el.show).toHaveBeenCalled();
  });

  it('hides threshold element when thresholdMessage is null', async () => {
    await loadPage({
      financing: {
        success: true,
        thresholdMessage: null,
        financing: { lowestMonthly: '$45/mo' },
        afterpay: { eligible: false },
      },
    });

    const el = getEl('#financingThreshold');
    expect(el.hide).toHaveBeenCalled();
  });

  it('hides financing teaser when lowestMonthly is null', async () => {
    await loadPage({
      financing: {
        success: true,
        thresholdMessage: 'Add $100 more',
        financing: { lowestMonthly: null },
        afterpay: { eligible: false },
      },
    });

    const teaser = getEl('#cartFinancingTeaser');
    expect(teaser.hide).toHaveBeenCalled();
  });

  it('hides afterpay message when not eligible', async () => {
    await loadPage({
      financing: {
        success: true,
        thresholdMessage: null,
        financing: { lowestMonthly: '$45/mo' },
        afterpay: { eligible: false },
      },
    });

    const afterpay = getEl('#cartAfterpayMessage');
    expect(afterpay.hide).toHaveBeenCalled();
  });

  it('shows all financing elements when fully populated', async () => {
    await loadPage({
      financing: {
        success: true,
        thresholdMessage: 'Spend $100 more for 0% APR',
        financing: { lowestMonthly: '$29/mo' },
        afterpay: { eligible: true, message: '4 payments of $137.49' },
      },
    });

    expect(getEl('#financingThreshold').text).toBe('Spend $100 more for 0% APR');
    expect(getEl('#financingThreshold').show).toHaveBeenCalled();
    expect(getEl('#cartFinancingTeaser').text).toBe('$29/mo');
    expect(getEl('#cartFinancingTeaser').show).toHaveBeenCalled();
    expect(getEl('#cartAfterpayMessage').text).toBe('4 payments of $137.49');
    expect(getEl('#cartAfterpayMessage').show).toHaveBeenCalled();
  });

  it('collapses entire financing section when cart subtotal is zero', async () => {
    await loadPage({
      cart: {
        lineItems: [{ _id: 'item-1', name: 'Free Item', price: 0, quantity: 1 }],
        totals: { subtotal: 0, total: 0 },
      },
      financing: { success: true },
    });

    expect(getEl('#cartFinancingSection').collapse).toHaveBeenCalled();
  });
});

// ── Empty Cart State Tests ──────────────────────────────────────────

describe('Cart Page — empty cart element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('expands empty cart section and sets title/message text', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0, total: 0 } } });

    expect(getEl('#emptyCartSection').expand).toHaveBeenCalled();
    expect(getEl('#emptyCartTitle').text).toBe('Your cart is empty');
    expect(getEl('#emptyCartMessage').text).toContain('Browse our collection');
  });

  it('styles empty cart title with heading color', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0, total: 0 } } });

    expect(getEl('#emptyCartTitle').style.color).toBe('#3A2518');
  });

  it('styles empty cart message with muted color', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0, total: 0 } } });

    expect(getEl('#emptyCartMessage').style.color).toBe('#8B7355');
  });

  it('styles continue shopping button with coral CTA colors', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0, total: 0 } } });

    const btn = getEl('#continueShoppingBtn');
    expect(btn.style.backgroundColor).toBe('#E8845C');
    expect(btn.style.color).toBe('#fff');
  });

  it('sets ARIA label on continue shopping button', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0, total: 0 } } });

    expect(getEl('#continueShoppingBtn').accessibility.ariaLabel).toContain('Continue shopping');
  });

  it('registers click handler on continue shopping button', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0, total: 0 } } });

    expect(getEl('#continueShoppingBtn').onClick).toHaveBeenCalled();
  });

  it('hides shipping and tier progress bars for empty cart', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0, total: 0 } } });

    expect(getEl('#shippingProgressBar').hide).toHaveBeenCalled();
    expect(getEl('#shippingProgressText').hide).toHaveBeenCalled();
    expect(getEl('#tierProgressBar').hide).toHaveBeenCalled();
    expect(getEl('#tierProgressText').hide).toHaveBeenCalled();
  });

  it('collapses suggestions and recent sections for empty cart', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0, total: 0 } } });

    expect(getEl('#suggestionsSection').collapse).toHaveBeenCalled();
    expect(getEl('#cartRecentSection').collapse).toHaveBeenCalled();
    expect(getEl('#cartFinancingSection').collapse).toHaveBeenCalled();
  });
});

// ── Tier Progress Bar Tests ─────────────────────────────────────────

describe('Cart Page — #tierProgressBar / #tierProgressText hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets tier progress bar value from getTierProgress', async () => {
    await loadPage();

    const bar = getEl('#tierProgressBar');
    expect(bar.value).toBe(40);
  });

  it('sets tier text from tier label function', async () => {
    await loadPage();

    const text = getEl('#tierProgressText');
    expect(text.text).toBe('Spend $100.00 more for 10% off!');
  });

  it('styles tier progress bar with brand colors', async () => {
    await loadPage();

    const bar = getEl('#tierProgressBar');
    expect(bar.style.backgroundColor).toBe('#ddd');
    expect(bar.style.color).toBe('#5B8FA8');
  });

  it('sets ARIA attributes on tier progress bar', async () => {
    await loadPage();

    const bar = getEl('#tierProgressBar');
    expect(bar.accessibility.ariaLabel).toContain('Discount tier progress');
    expect(bar.accessibility.ariaValueNow).toBe(40);
  });
});

// ── Cart Subtotal / Total ARIA Tests ───────────────────────────────

describe('Cart Page — #cartSubtotal / #cartTotal ARIA hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA live regions on cart subtotal and total', async () => {
    await loadPage();

    expect(getEl('#cartSubtotal').accessibility.ariaLive).toBe('polite');
    expect(getEl('#cartSubtotal').accessibility.role).toBe('status');
    expect(getEl('#cartTotal').accessibility.ariaLive).toBe('polite');
    expect(getEl('#cartTotal').accessibility.role).toBe('status');
  });
});

// ── Cart Items Repeater Tests ───────────────────────────────────────

function simulateCartRepeaterItem(itemData) {
  const repeater = getEl('#cartItemsRepeater');
  if (repeater.onItemReady.mock.calls.length === 0) return null;
  const handler = repeater.onItemReady.mock.calls[0][0];
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  // Set initial value for qtyInput
  $item('#qtyInput').value = String(itemData.quantity || 1);
  handler($item, itemData);
  return $item;
}

describe('Cart Page — #cartItemsRepeater child element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onItemReady on cart items repeater', async () => {
    await loadPage();
    expect(getEl('#cartItemsRepeater').onItemReady).toHaveBeenCalled();
  });

  it('styles cart item name and price with brand colors', async () => {
    await loadPage();
    const itemData = { _id: 'item-1', name: 'Kodiak Frame', price: 549.99, quantity: 1 };
    const $item = simulateCartRepeaterItem(itemData);
    expect($item).not.toBeNull();

    expect($item('#cartItemName').style.color).toBe('#3A2518');
    expect($item('#cartItemPrice').style.color).toBe('#5B8FA8');
  });

  it('styles qty buttons with mountain blue', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'i1', name: 'Frame', price: 500, quantity: 2 });
    expect($item).not.toBeNull();

    expect($item('#qtyMinus').style.color).toBe('#5B8FA8');
    expect($item('#qtyPlus').style.color).toBe('#5B8FA8');
  });

  it('styles remove button with coral accent', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'i1', name: 'Frame', price: 500, quantity: 1 });
    expect($item).not.toBeNull();

    expect($item('#removeItem').style.color).toBe('#E8845C');
  });

  it('sets ARIA labels on qty controls with product name', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'i1', name: 'Vienna Futon Frame', price: 500, quantity: 2 });
    expect($item).not.toBeNull();

    expect($item('#qtyMinus').accessibility.ariaLabel).toBe('Decrease quantity of Vienna Futon Frame');
    expect($item('#qtyPlus').accessibility.ariaLabel).toBe('Increase quantity of Vienna Futon Frame');
    expect($item('#qtyInput').accessibility.ariaLabel).toBe('Quantity of Vienna Futon Frame');
    expect($item('#removeItem').accessibility.ariaLabel).toBe('Remove Vienna Futon Frame from cart');
  });

  it('sets spinbutton role and value attributes on qty input', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'i1', name: 'Frame', price: 500, quantity: 3 });
    expect($item).not.toBeNull();

    expect($item('#qtyInput').accessibility.role).toBe('spinbutton');
    expect($item('#qtyInput').accessibility.ariaValueMin).toBe(1);
    expect($item('#qtyInput').accessibility.ariaValueMax).toBe(10);
  });

  it('registers click handlers on qty buttons and remove', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'i1', name: 'Frame', price: 500, quantity: 2 });
    expect($item).not.toBeNull();

    expect($item('#qtyMinus').onClick).toHaveBeenCalled();
    expect($item('#qtyPlus').onClick).toHaveBeenCalled();
    expect($item('#removeItem').onClick).toHaveBeenCalled();
  });

  it('minus button calls updateCartItemQuantity with decremented value', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'item-1', name: 'Frame', price: 500, quantity: 3 });
    expect($item).not.toBeNull();

    const minusHandler = $item('#qtyMinus').onClick.mock.calls[0][0];
    expect(minusHandler).toBeDefined();

    const { updateCartItemQuantity } = await import('public/cartService');
    await minusHandler();

    expect(updateCartItemQuantity).toHaveBeenCalledWith('item-1', 2);
  });

  it('plus button calls updateCartItemQuantity with incremented value', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'item-1', name: 'Frame', price: 500, quantity: 2 });
    expect($item).not.toBeNull();

    const plusHandler = $item('#qtyPlus').onClick.mock.calls[0][0];
    expect(plusHandler).toBeDefined();

    const { updateCartItemQuantity } = await import('public/cartService');
    await plusHandler();

    expect(updateCartItemQuantity).toHaveBeenCalledWith('item-1', 3);
  });

  it('remove button calls removeCartItem', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'item-1', name: 'Frame', price: 500, quantity: 1 });
    expect($item).not.toBeNull();

    const removeHandler = $item('#removeItem').onClick.mock.calls[0][0];
    expect(removeHandler).toBeDefined();

    const { removeCartItem } = await import('public/cartService');
    await removeHandler();

    expect(removeCartItem).toHaveBeenCalledWith('item-1');
  });

  it('sets ARIA label on save for later button', async () => {
    await loadPage();
    const $item = simulateCartRepeaterItem({ _id: 'i1', name: 'Kodiak Frame', price: 500, quantity: 1 });
    expect($item).not.toBeNull();

    expect($item('#saveForLaterBtn').accessibility.ariaLabel).toBe('Save Kodiak Frame for later');
  });
});
