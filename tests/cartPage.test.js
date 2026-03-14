/**
 * Tests for pages/Cart Page.js
 * Covers: page init, empty cart, shipping progress, tier progress,
 * quantity controls, cart listeners, financing, recently viewed,
 * cross-sell suggestions, ARIA live regions, cart mutation errors.
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
    options: [],
    collapsed: false,
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: { ariaLabel: '', ariaLive: '', role: '', ariaValueNow: 0, ariaValueMin: 0, ariaValueMax: 0 },
    background: { src: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    focus: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onItemReady: vi.fn(),
    forEachItem: vi.fn(),
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
  getCompletionSuggestions: vi.fn(),
}));

vi.mock('backend/financingCalc.web', () => ({
  getCartFinancing: vi.fn(),
}));

vi.mock('public/galleryHelpers', () => ({
  getRecentlyViewed: vi.fn(() => []),
}));

vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn(),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  removeCartItem: vi.fn(),
  onCartChanged: vi.fn(),
  getShippingProgress: vi.fn(() => ({ remaining: 50, progressPct: 60, qualifies: false })),
  getTierProgress: vi.fn(() => ({
    tier: { label: (r) => `Spend $${r} more for 10% off!` },
    remaining: 100,
    progressPct: 40,
  })),
  FREE_SHIPPING_THRESHOLD: 199,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 99,
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  collapseOnMobile: vi.fn(),
  limitForViewport: vi.fn((arr) => arr),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireViewCart: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) el.accessibility.ariaLabel = opts.ariaLabel;
  }),
}));

vi.mock('public/cartStyles.js', () => ({
  getCartItemStyles: vi.fn(() => ({ nameColor: '#1E3A5F', priceColor: '#2D5F7C', removeColor: '#E07A5F' })),
  getProgressBarStyles: vi.fn(() => ({ trackColor: '#E8E0D5', fillColor: '#4A7C59', textColor: '#1E3A5F' })),
  getEmptyCartStyles: vi.fn(() => ({ headingColor: '#1E3A5F', messageColor: '#5B8FA8' })),
  getCheckoutButtonStyles: vi.fn(() => ({ background: '#1E3A5F', textColor: '#FFFFFF' })),
  getQuantitySpinnerStyles: vi.fn(() => ({ buttonColor: '#2D5F7C', valueColor: '#1E3A5F' })),
}));

vi.mock('public/crossSellWidget.js', () => ({
  buildRoomBundles: vi.fn(() => []),
  initCrossSellWidget: vi.fn(),
}));

vi.mock('public/SaveForLater.js', () => ({
  saveForLater: vi.fn(),
}));

vi.mock('public/cartDeliveryEstimate.js', () => ({
  initCartDeliveryEstimate: vi.fn(),
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

// ── Test Data ───────────────────────────────────────────────────────

const mockCart = {
  lineItems: [
    { _id: 'item-1', productId: 'prod-1', name: 'Futon Frame', price: 249.99, quantity: 1, mediaItem: { src: 'frame.jpg' } },
    { _id: 'item-2', productId: 'prod-2', name: 'Mattress', price: 149.99, quantity: 2, mediaItem: { src: 'mattress.jpg' } },
  ],
  totals: { subtotal: 549.97, shipping: 0, total: 549.97 },
  appliedCoupon: null,
};

// ── Load Page ───────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

async function loadPage(overrides = {}) {
  const { getCurrentCart } = await import('public/cartService');
  getCurrentCart.mockResolvedValue(overrides.cart ?? mockCart);

  const { getCompletionSuggestions } = await import('backend/productRecommendations.web');
  getCompletionSuggestions.mockResolvedValue(overrides.suggestions ?? []);

  const { getCartFinancing } = await import('backend/financingCalc.web');
  getCartFinancing.mockResolvedValue(overrides.financing ?? { success: false });

  await import('../src/pages/Cart Page.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Page Init ───────────────────────────────────────────────────────

describe('page init', () => {
  it('calls initPageSeo with cart', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('cart');
  });

  it('tracks page_view with item count', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    const viewCall = trackEvent.mock.calls.find(c => c[0] === 'page_view');
    expect(viewCall[1]).toEqual({ page: 'cart', itemCount: 2 });
  });

  it('fires GA4 view_cart event', async () => {
    await loadPage();
    const { fireViewCart } = await import('public/ga4Tracking');
    expect(fireViewCart).toHaveBeenCalledWith(mockCart.lineItems, 549.97);
  });

  it('collapses non-essential sections on mobile', async () => {
    await loadPage();
    const { collapseOnMobile } = await import('public/mobileHelpers');
    expect(collapseOnMobile).toHaveBeenCalled();
  });

  it('registers cart change listener', async () => {
    await loadPage();
    const { onCartChanged } = await import('public/cartService');
    expect(onCartChanged).toHaveBeenCalled();
  });

  it('initializes coupon code input', async () => {
    await loadPage();
    const { initCouponCodeInput } = await import('public/CouponCodeInput.js');
    expect(initCouponCodeInput).toHaveBeenCalled();
  });
});

// ── Empty Cart ──────────────────────────────────────────────────────

describe('empty cart', () => {
  it('shows empty cart state when no items', async () => {
    await loadPage({ cart: { lineItems: [] } });

    expect(getEl('#emptyCartSection').expand).toHaveBeenCalled();
    expect(getEl('#emptyCartTitle').text).toBe('Your cart is empty');
  });

  it('collapses suggestion and recent sections for empty cart', async () => {
    await loadPage({ cart: { lineItems: [] } });

    expect(getEl('#suggestionsSection').collapse).toHaveBeenCalled();
    expect(getEl('#cartRecentSection').collapse).toHaveBeenCalled();
  });

  it('tracks page_view with empty flag', async () => {
    const { trackEvent } = await import('public/engagementTracker');
    const callsBefore = trackEvent.mock.calls.length;
    await loadPage({ cart: { lineItems: [] } });
    const viewCall = trackEvent.mock.calls.slice(callsBefore).find(c => c[0] === 'page_view');
    expect(viewCall[1]).toEqual({ page: 'cart', empty: true });
  });

  it('wires continue shopping button', async () => {
    await loadPage({ cart: { lineItems: [] } });
    expect(getEl('#continueShoppingBtn').onClick).toHaveBeenCalled();
  });
});

// ── Shipping Progress ───────────────────────────────────────────────

describe('shipping progress', () => {
  it('updates shipping progress bar from cart', async () => {
    await loadPage();
    const { getShippingProgress } = await import('public/cartService');
    expect(getShippingProgress).toHaveBeenCalledWith(549.97);
  });

  it('sets ARIA attributes on progress bar', async () => {
    await loadPage();
    const bar = getEl('#shippingProgressBar');
    expect(bar.value).toBe(60);
  });

  it('shows remaining amount text', async () => {
    await loadPage();
    expect(getEl('#shippingProgressText').text).toContain('$50.00');
  });
});

// ── Tier Progress ───────────────────────────────────────────────────

describe('tier progress', () => {
  it('updates tier progress bar from cart', async () => {
    await loadPage();
    const { getTierProgress } = await import('public/cartService');
    expect(getTierProgress).toHaveBeenCalledWith(549.97);
  });

  it('sets tier progress bar value', async () => {
    await loadPage();
    expect(getEl('#tierProgressBar').value).toBe(40);
  });

  it('renders tier label text', async () => {
    await loadPage();
    expect(getEl('#tierProgressText').text).toContain('100.00');
  });
});

// ── Quantity Controls ───────────────────────────────────────────────

describe('quantity controls', () => {
  it('sets up item repeater with ARIA labels', async () => {
    await loadPage();
    const repeater = getEl('#cartItemsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();

    // Simulate onItemReady
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    $item('#qtyInput').value = '2';
    itemReadyFn($item, mockCart.lineItems[0]);

    expect($item('#qtyMinus').accessibility.ariaLabel).toContain('Futon Frame');
    expect($item('#qtyPlus').accessibility.ariaLabel).toContain('Futon Frame');
    expect($item('#removeItem').accessibility.ariaLabel).toContain('Remove Futon Frame');
  });

  it('decrements quantity on minus click', async () => {
    await loadPage();
    const { updateCartItemQuantity } = await import('public/cartService');
    updateCartItemQuantity.mockResolvedValue();

    const repeater = getEl('#cartItemsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    $item('#qtyInput').value = '3';
    itemReadyFn($item, mockCart.lineItems[0]);

    const minusHandler = $item('#qtyMinus').onClick.mock.calls[0][0];
    await minusHandler();

    expect(updateCartItemQuantity).toHaveBeenCalledWith('item-1', 2);
    expect($item('#qtyInput').value).toBe('2');
  });

  it('does not go below MIN_QUANTITY', async () => {
    await loadPage();
    const { updateCartItemQuantity } = await import('public/cartService');

    const repeater = getEl('#cartItemsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    $item('#qtyInput').value = '1';
    itemReadyFn($item, mockCart.lineItems[0]);

    updateCartItemQuantity.mockClear();
    const minusHandler = $item('#qtyMinus').onClick.mock.calls[0][0];
    await minusHandler();

    expect(updateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('increments quantity on plus click', async () => {
    await loadPage();
    const { updateCartItemQuantity } = await import('public/cartService');
    updateCartItemQuantity.mockResolvedValue();

    const repeater = getEl('#cartItemsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    $item('#qtyInput').value = '1';
    itemReadyFn($item, mockCart.lineItems[0]);

    const plusHandler = $item('#qtyPlus').onClick.mock.calls[0][0];
    await plusHandler();

    expect(updateCartItemQuantity).toHaveBeenCalledWith('item-1', 2);
  });

  it('removes item on remove click', async () => {
    await loadPage();
    const { removeCartItem } = await import('public/cartService');
    removeCartItem.mockResolvedValue();

    const repeater = getEl('#cartItemsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockCart.lineItems[0]);

    const removeHandler = $item('#removeItem').onClick.mock.calls[0][0];
    await removeHandler();

    expect(removeCartItem).toHaveBeenCalledWith('item-1');
  });

  it('save for later disables button and calls service', async () => {
    await loadPage();
    const { saveForLater } = await import('public/SaveForLater.js');
    saveForLater.mockResolvedValue({ success: true });

    const repeater = getEl('#cartItemsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockCart.lineItems[0]);

    const saveHandler = $item('#saveForLaterBtn').onClick.mock.calls[0][0];
    await saveHandler();

    expect($item('#saveForLaterBtn').disable).toHaveBeenCalled();
    expect(saveForLater).toHaveBeenCalled();
  });
});

// ── Cart Suggestions ────────────────────────────────────────────────

describe('cart suggestions', () => {
  it('collapses suggestions when none returned', async () => {
    await loadPage({ suggestions: [] });
    expect(getEl('#suggestionsSection').collapse).toHaveBeenCalled();
  });

  it('initializes cross-sell widget when suggestions exist', async () => {
    const suggestions = [{ _id: 'sug-1', name: 'Cover', slug: 'cover', price: 59.99 }];
    const { buildRoomBundles } = await import('public/crossSellWidget.js');
    buildRoomBundles.mockReturnValue([{ products: suggestions }]);

    await loadPage({ suggestions });

    const { initCrossSellWidget } = await import('public/crossSellWidget.js');
    expect(initCrossSellWidget).toHaveBeenCalled();
  });
});

// ── Financing ───────────────────────────────────────────────────────

describe('financing', () => {
  it('expands financing section on success', async () => {
    await loadPage({
      financing: {
        success: true,
        thresholdMessage: null,
        financing: { lowestMonthly: '$45/mo' },
        afterpay: { eligible: true, message: '4 payments of $137.49' },
      },
    });

    expect(getEl('#cartFinancingSection').expand).toHaveBeenCalled();
    expect(getEl('#cartFinancingTeaser').text).toBe('$45/mo');
    expect(getEl('#cartAfterpayMessage').text).toBe('4 payments of $137.49');
  });

  it('collapses financing section on failure', async () => {
    await loadPage({ financing: { success: false } });
    expect(getEl('#cartFinancingSection').collapse).toHaveBeenCalled();
  });
});

// ── Recently Viewed ─────────────────────────────────────────────────

describe('recently viewed', () => {
  it('collapses section when no recent products', async () => {
    await loadPage();
    expect(getEl('#cartRecentSection').collapse).toHaveBeenCalled();
  });

  it('populates recently viewed repeater', async () => {
    const { getRecentlyViewed } = await import('public/galleryHelpers');
    getRecentlyViewed.mockReturnValue([
      { _id: 'rv-1', name: 'Side Table', slug: 'side-table', mainMedia: 'table.jpg', price: '$79.99' },
    ]);

    await loadPage();

    const repeater = getEl('#cartRecentRepeater');
    expect(repeater.data).toHaveLength(1);
  });
});

// ── ARIA Live Regions ───────────────────────────────────────────────

describe('ARIA live regions', () => {
  it('sets ariaLive on cart totals', async () => {
    await loadPage();
    expect(getEl('#cartSubtotal').accessibility.ariaLive).toBe('polite');
    expect(getEl('#cartTotal').accessibility.ariaLive).toBe('polite');
  });
});

// ── Cart Mutation Error Paths ───────────────────────────────────────

describe('cart mutation errors', () => {
  it('handles updateCartItemQuantity rejection without crashing', async () => {
    await loadPage();
    const { updateCartItemQuantity } = await import('public/cartService');
    updateCartItemQuantity.mockRejectedValue(new Error('network error'));

    const repeater = getEl('#cartItemsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockCart.lineItems[0]);

    $item('#qtyInput').value = '1';
    const plusHandler = $item('#qtyPlus').onClick.mock.calls[0][0];
    await plusHandler();
    expect(updateCartItemQuantity).toHaveBeenCalled();
  });

  it('handles removeCartItem rejection without crashing', async () => {
    await loadPage();
    const { removeCartItem } = await import('public/cartService');
    removeCartItem.mockRejectedValue(new Error('network error'));

    const repeater = getEl('#cartItemsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockCart.lineItems[0]);

    const removeHandler = $item('#removeItem').onClick.mock.calls[0][0];
    await removeHandler();
    expect(removeCartItem).toHaveBeenCalled();
  });
});
