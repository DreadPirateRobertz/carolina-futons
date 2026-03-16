/**
 * Tests for pages/Checkout.js
 * Covers: page init, checkout progress, trust signals, order notes,
 * checkout summary, payment options, shipping options, address validation,
 * delivery estimate, order summary sidebar, express checkout,
 * protection plans, gift card, focus indicators.
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
    style: { color: '', backgroundColor: '', borderColor: '', fontWeight: '' },
    accessibility: {
      ariaLabel: '', ariaLive: '', role: '', ariaHidden: false,
      ariaExpanded: false, ariaRequired: false, ariaCurrent: '',
      ariaValueNow: 0, ariaValueMin: 0, ariaValueMax: 0,
    },
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
    onInput: vi.fn(),
    onBlur: vi.fn(),
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

vi.mock('public/engagementTracker', () => ({
  trackCheckoutStart: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireInitiateCheckout: vi.fn(),
}));

vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn(),
  FREE_SHIPPING_THRESHOLD: 999,
  getShippingProgress: vi.fn(() => ({ remaining: 450, progressPct: 55 })),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  applyFocusRing: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    success: '#4A7C59', error: '#DC2626', mountainBlue: '#2D5F7C',
    sandDark: '#C4B5A3', mutedBrown: '#8B7355', sunsetCoral: '#E07A5F',
    espresso: '#1E3A5F', white: '#FFFFFF',
  },
}));

vi.mock('public/cartStyles.js', () => ({
  getCheckoutButtonStyles: vi.fn(() => ({ background: '#E07A5F', textColor: '#FFFFFF' })),
}));

vi.mock('public/checkoutProgress.js', () => ({
  getCheckoutSteps: vi.fn(() => [
    { id: 'info', number: 1, label: 'Information' },
    { id: 'shipping', number: 2, label: 'Shipping' },
    { id: 'payment', number: 3, label: 'Payment' },
    { id: 'review', number: 4, label: 'Review' },
  ]),
  getStepAriaAttributes: vi.fn((stepIdx, activeIdx, label) => ({
    state: stepIdx < activeIdx ? 'completed' : stepIdx === activeIdx ? 'active' : 'pending',
    ariaLabel: `${label}: ${stepIdx === activeIdx ? 'current step' : stepIdx < activeIdx ? 'completed' : 'upcoming'}`,
    ariaCurrent: stepIdx === activeIdx ? 'step' : null,
  })),
}));

vi.mock('public/checkoutValidation.js', () => ({
  validateAddressField: vi.fn(() => ({ valid: true })),
  getFieldValidationState: vi.fn(() => 'valid'),
  applyAutocompleteHints: vi.fn(),
}));

vi.mock('backend/paymentOptions.web', () => ({
  getCheckoutPaymentSummary: vi.fn(),
}));

vi.mock('backend/checkoutOptimization.web', () => ({
  validateShippingAddress: vi.fn(),
  getShippingOptions: vi.fn(),
  getDeliveryEstimate: vi.fn(),
  calculateOrderSummary: vi.fn(),
  getExpressCheckoutSummary: vi.fn(),
}));

vi.mock('backend/protectionPlan.web', () => ({
  getProtectionPlans: vi.fn(),
  addProtectionPlan: vi.fn(),
  removeProtectionPlan: vi.fn(),
  PLAN_TIERS: {},
}));

vi.mock('public/storeCreditHelpers.js', () => ({
  initCheckoutStoreCredit: vi.fn(() => ({ available: false })),
  formatCreditBalance: vi.fn((amt) => `$${Number(amt).toFixed(2)}`),
}));

vi.mock('public/giftCardHelpers.js', () => ({
  initCheckoutGiftCard: vi.fn(),
  finalizeGiftCardRedemption: vi.fn(),
  resetCheckoutGiftCard: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

vi.mock('wix-window-frontend', () => ({
  onBeforeUnload: vi.fn(),
}));

// ── Test Data ───────────────────────────────────────────────────────

const mockCart = {
  lineItems: [
    { _id: 'item-1', productId: 'prod-1', name: 'Futon Frame', price: 499.99, quantity: 1 },
    { _id: 'item-2', productId: 'prod-2', name: 'Mattress', price: 149.99, quantity: 2 },
  ],
  totals: { subtotal: 799.97 },
  appliedCoupon: null,
};

const mockPaymentSummary = {
  success: true,
  summary: {
    payNow: {
      methods: [
        { id: 'credit-card', name: 'Credit Card', brands: ['Visa', 'Mastercard'] },
        { id: 'apple-pay', name: 'Apple Pay' },
      ],
    },
    afterpay: { message: 'Pay in 4', installmentAmount: 199.99 },
    financing: { message: 'As low as $35/mo' },
    shippingMessage: 'Free shipping on orders $999+',
  },
};

const mockShippingOptions = {
  success: true,
  options: [
    { id: 'standard', label: 'Standard', price: 0, description: 'Free ground shipping', estimatedDays: { min: 5, max: 10 } },
    { id: 'express', label: 'Express', price: 49.99, description: '2-3 day delivery', estimatedDays: { min: 2, max: 3 } },
  ],
};

const mockOrderSummary = {
  success: true,
  data: {
    subtotal: 799.97,
    shipping: { amount: 0 },
    tax: 56.00,
    total: 855.97,
    savings: 0,
    itemCount: 3,
  },
};

// ── Load Page ───────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

function applyMock(mockFn, value, fallback) {
  if (value instanceof Error) {
    mockFn.mockRejectedValue(value);
  } else {
    mockFn.mockResolvedValue(value ?? fallback);
  }
}

async function loadPage(overrides = {}) {
  const { getCurrentCart } = await import('public/cartService');
  applyMock(getCurrentCart, overrides.cart, mockCart);

  const { getCheckoutPaymentSummary } = await import('backend/paymentOptions.web');
  applyMock(getCheckoutPaymentSummary, overrides.payment, mockPaymentSummary);

  const { getShippingOptions, calculateOrderSummary } = await import('backend/checkoutOptimization.web');
  applyMock(getShippingOptions, overrides.shipping, mockShippingOptions);
  applyMock(calculateOrderSummary, overrides.orderSummary, mockOrderSummary);

  const { getProtectionPlans } = await import('backend/protectionPlan.web');
  applyMock(getProtectionPlans, overrides.protectionPlans, { success: false, plans: [] });

  await import('../src/pages/Checkout.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Page Init ───────────────────────────────────────────────────────

describe('page init', () => {
  it('calls initPageSeo with checkout', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('checkout');
  });

  it('initializes all sections via Promise.allSettled', async () => {
    await loadPage();
    const { trackCheckoutStart } = await import('public/engagementTracker');
    expect(trackCheckoutStart).toHaveBeenCalled();
  });

  it('calls collapseOnMobile and initBackToTop', async () => {
    await loadPage();
    const { collapseOnMobile, initBackToTop } = await import('public/mobileHelpers');
    expect(collapseOnMobile).toHaveBeenCalled();
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('applies focus rings on checkout elements', async () => {
    await loadPage();
    const { applyFocusRing } = await import('public/a11yHelpers.js');
    expect(applyFocusRing).toHaveBeenCalled();
  });
});

// ── Checkout Progress ───────────────────────────────────────────────

describe('checkout progress', () => {
  it('populates progress steps repeater', async () => {
    await loadPage();
    const repeater = getEl('#checkoutProgressRepeater');
    expect(repeater.data).toHaveLength(4);
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('renders step labels and numbers', async () => {
    await loadPage();
    const repeater = getEl('#checkoutProgressRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, { id: 'info', number: 1, label: 'Information' });
    expect($item('#progressStepLabel').text).toBe('Information');
    expect($item('#progressStepNumber').text).toBe('1');
  });
});

// ── Trust Signals ───────────────────────────────────────────────────

describe('trust signals', () => {
  it('populates trust repeater with messages', async () => {
    await loadPage();
    const repeater = getEl('#trustRepeater');
    expect(repeater.data.length).toBeGreaterThanOrEqual(3);
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('renders trust text in item ready', async () => {
    await loadPage();
    const repeater = getEl('#trustRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, { text: 'Secure SSL Checkout', icon: 'lock' });
    expect($item('#trustText').text).toBe('Secure SSL Checkout');
  });
});

// ── Order Notes ─────────────────────────────────────────────────────

describe('order notes', () => {
  it('collapses notes field initially', async () => {
    await loadPage();
    expect(getEl('#orderNotesField').collapse).toHaveBeenCalled();
  });

  it('toggles notes field on click', async () => {
    await loadPage();
    const toggle = getEl('#orderNotesToggle');
    const handler = toggle.onClick.mock.calls[0][0];

    // First click — expand
    handler();
    expect(getEl('#orderNotesField').expand).toHaveBeenCalled();
    expect(toggle.text).toBe('Hide order notes');

    // Second click — collapse
    handler();
    expect(toggle.text).toBe('Add order notes');
  });
});

// ── Checkout Summary ────────────────────────────────────────────────

describe('checkout summary', () => {
  it('tracks checkout start with subtotal and item count', async () => {
    await loadPage();
    const { trackCheckoutStart } = await import('public/engagementTracker');
    expect(trackCheckoutStart).toHaveBeenCalledWith(799.97, 3);
  });

  it('fires GA4 initiate checkout', async () => {
    await loadPage();
    const { fireInitiateCheckout } = await import('public/ga4Tracking');
    expect(fireInitiateCheckout).toHaveBeenCalled();
  });

  it('shows shipping progress when under threshold', async () => {
    await loadPage();
    expect(getEl('#checkoutFreeShipping').text).toContain('$450.00');
    expect(getEl('#checkoutFreeShipping').show).toHaveBeenCalled();
  });

  it('shows free shipping badge when qualifying', async () => {
    await loadPage({ cart: { ...mockCart, totals: { subtotal: 1200 } } });
    expect(getEl('#checkoutFreeShipping').text).toContain('FREE shipping');
  });

  it('shows item count summary', async () => {
    await loadPage();
    expect(getEl('#checkoutItemCount').text).toBe('3 items in your order');
  });

  it('redirects to cart on empty order', async () => {
    await loadPage({ cart: { lineItems: [], totals: { subtotal: 0 } } });
    const { to } = await import('wix-location-frontend');
    expect(to).toHaveBeenCalledWith('/cart-page');
  });
});

// ── Payment Options ─────────────────────────────────────────────────

describe('payment options', () => {
  it('populates payment methods repeater', async () => {
    await loadPage();
    const repeater = getEl('#paymentMethodsRepeater');
    expect(repeater.data).toHaveLength(2);
  });

  it('expands afterpay section with installment info', async () => {
    await loadPage();
    expect(getEl('#checkoutAfterpay').expand).toHaveBeenCalled();
    expect(getEl('#afterpayInstallment').text).toContain('199.99');
  });

  it('expands financing section', async () => {
    await loadPage();
    expect(getEl('#checkoutFinancing').expand).toHaveBeenCalled();
    expect(getEl('#financingMessage').text).toBe('As low as $35/mo');
  });
});

// ── Shipping Options ────────────────────────────────────────────────

describe('shipping options', () => {
  it('populates shipping options repeater', async () => {
    await loadPage();
    const repeater = getEl('#shippingOptionsRepeater');
    expect(repeater.data).toHaveLength(2);
  });

  it('renders shipping option details', async () => {
    await loadPage();
    const repeater = getEl('#shippingOptionsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockShippingOptions.options[0]);

    expect($item('#shippingOptionLabel').text).toBe('Standard');
    expect($item('#shippingOptionPrice').text).toBe('FREE');
    expect($item('#shippingOptionDays').text).toBe('5–10 business days');
  });
});

// ── Address Validation ──────────────────────────────────────────────

describe('address validation', () => {
  it('applies autocomplete hints', async () => {
    await loadPage();
    const { applyAutocompleteHints } = await import('public/checkoutValidation.js');
    expect(applyAutocompleteHints).toHaveBeenCalled();
  });

  it('sets ARIA labels on address fields', async () => {
    await loadPage();
    expect(getEl('#addressFullName').accessibility.ariaLabel).toBe('Full name');
    expect(getEl('#addressZip').accessibility.ariaLabel).toBe('ZIP code');
  });

  it('shows success on valid address', async () => {
    await loadPage();
    const { validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: true });

    getEl('#addressFullName').value = 'John Doe';
    getEl('#addressLine1').value = '123 Main St';
    getEl('#addressCity').value = 'Hendersonville';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '28739';

    const handler = getEl('#validateAddressBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#addressSuccess').text).toBe('Address verified');
    expect(getEl('#addressSuccess').show).toHaveBeenCalled();
    expect(getEl('#expressCheckoutBtn').enable).toHaveBeenCalled();
  });

  it('shows errors on invalid address', async () => {
    await loadPage();
    const { validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: false, errors: ['Invalid ZIP code'] });

    getEl('#addressFullName').value = 'John';
    getEl('#addressLine1').value = '123 Main';
    getEl('#addressCity').value = 'City';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = 'bad';

    const handler = getEl('#validateAddressBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#addressErrors').text).toBe('Invalid ZIP code');
    expect(getEl('#expressCheckoutBtn').disable).toHaveBeenCalled();
  });
});

// ── Delivery Estimate ───────────────────────────────────────────────

describe('delivery estimate', () => {
  it('shows estimated delivery date range', async () => {
    await loadPage();
    expect(getEl('#checkoutDeliveryEstimate').text).toContain('Estimated delivery:');
    expect(getEl('#checkoutDeliveryEstimate').show).toHaveBeenCalled();
  });
});

// ── Order Summary Sidebar ───────────────────────────────────────────

describe('order summary sidebar', () => {
  it('shows sidebar with totals', async () => {
    await loadPage();
    expect(getEl('#orderSummarySidebar').show).toHaveBeenCalled();
    expect(getEl('#orderSummarySubtotal').text).toBe('$799.97');
    expect(getEl('#orderSummaryShipping').text).toBe('FREE');
    expect(getEl('#orderSummaryTax').text).toBe('$56.00');
    expect(getEl('#orderSummaryTotal').text).toBe('$855.97');
  });

  it('populates items repeater in sidebar', async () => {
    await loadPage();
    const repeater = getEl('#orderSummaryItemsRepeater');
    expect(repeater.data).toHaveLength(2);
  });
});

// ── Express Checkout ────────────────────────────────────────────────

describe('express checkout', () => {
  it('disables express button by default', async () => {
    await loadPage();
    expect(getEl('#expressCheckoutBtn').disable).toHaveBeenCalled();
  });

  it('shows express checkout section', async () => {
    await loadPage();
    expect(getEl('#expressCheckoutSection').show).toHaveBeenCalled();
  });
});

// ── Protection Plan Upsell ──────────────────────────────────────────

describe('protection plan', () => {
  const mockPlans = {
    success: true,
    plans: [{
      productId: 'prod-1',
      productName: 'Futon Frame',
      productPrice: 499.99,
      selectedTier: null,
      tiers: [
        { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'] },
        { id: 'premium', name: 'Premium', price: 59.99, durationYears: 3, coverage: ['Defects', 'Accidental'] },
      ],
    }],
  };

  it('shows protection plan section when plans available', async () => {
    await loadPage({ protectionPlans: mockPlans });
    expect(getEl('#protectionPlanTitle').text).toBe('Protect Your Furniture');
    expect(getEl('#protectionPlanSection').show).toHaveBeenCalled();
  });

  it('populates plan repeater with product data', async () => {
    await loadPage({ protectionPlans: mockPlans });
    const repeater = getEl('#protectionPlanRepeater');
    expect(repeater.data).toHaveLength(1);
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('does not show section when no plans', async () => {
    await loadPage({ protectionPlans: { success: false, plans: [] } });
    expect(getEl('#protectionPlanSection').show).not.toHaveBeenCalled();
  });
});

// ── Gift Card ───────────────────────────────────────────────────────

describe('gift card', () => {
  it('initializes gift card section', async () => {
    await loadPage();
    const { initCheckoutGiftCard } = await import('public/giftCardHelpers.js');
    expect(initCheckoutGiftCard).toHaveBeenCalled();
  });
});

// ── Error / Rejection Paths ─────────────────────────────────────────

describe('network error handling', () => {
  it('handles cart fetch rejection gracefully', async () => {
    await loadPage({ cart: new Error('network error') });
    // Page should still render without crashing
    const { trackCheckoutStart } = await import('public/engagementTracker');
    expect(trackCheckoutStart).toHaveBeenCalled();
  });

  it('handles payment summary rejection gracefully', async () => {
    await loadPage({ payment: new Error('timeout') });
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('checkout');
  });

  it('handles shipping options rejection gracefully', async () => {
    await loadPage({ shipping: new Error('service down') });
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('checkout');
  });

  it('handles order summary rejection gracefully', async () => {
    await loadPage({ orderSummary: new Error('500') });
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('checkout');
  });
});

// ── onBeforeUnload ──────────────────────────────────────────────────

describe('cleanup', () => {
  it('registers onBeforeUnload to reset gift card', async () => {
    await loadPage();
    const wixWindow = await import('wix-window-frontend');
    expect(wixWindow.onBeforeUnload).toHaveBeenCalled();
  });
});

// ── Checkout Progress ARIA ──────────────────────────────────────────

describe('checkout progress ARIA', () => {
  it('sets navigation role on progress nav', async () => {
    await loadPage();
    expect(getEl('#checkoutProgressNav').accessibility.role).toBe('navigation');
  });

  it('sets ariaLabel on progress nav', async () => {
    await loadPage();
    expect(getEl('#checkoutProgressNav').accessibility.ariaLabel).toBe('Checkout progress');
  });

  it('sets active step styling for first step', async () => {
    await loadPage();
    const repeater = getEl('#checkoutProgressRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    // Step 1 at index 0, activeIndex 0 → state 'active'
    itemReadyFn($item, { id: 'info', number: 1, label: 'Information' });
    // Active step should have mountainBlue color
    expect($item('#progressStepDot').style.backgroundColor).toBeTruthy();
  });
});

// ── Trust Signals ARIA ──────────────────────────────────────────────

describe('trust signals ARIA', () => {
  it('sets ariaHidden on trust icons', async () => {
    await loadPage();
    const repeater = getEl('#trustRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, { text: 'Secure SSL Checkout', icon: 'lock' });
    expect($item('#trustIcon').accessibility.ariaHidden).toBe(true);
  });
});

// ── Order Notes ARIA ────────────────────────────────────────────────

describe('order notes ARIA', () => {
  it('sets ariaLabel on notes toggle', async () => {
    await loadPage();
    expect(getEl('#orderNotesToggle').accessibility.ariaLabel).toBe('Toggle order notes');
  });

  it('sets ariaExpanded false initially', async () => {
    await loadPage();
    expect(getEl('#orderNotesToggle').accessibility.ariaExpanded).toBe(false);
  });

  it('sets ariaLabel on notes field', async () => {
    await loadPage();
    expect(getEl('#orderNotesField').accessibility.ariaLabel).toBe('Special delivery instructions');
  });

  it('updates ariaExpanded on toggle', async () => {
    await loadPage();
    const handler = getEl('#orderNotesToggle').onClick.mock.calls[0][0];
    handler(); // expand
    expect(getEl('#orderNotesToggle').accessibility.ariaExpanded).toBe(true);
    handler(); // collapse
    expect(getEl('#orderNotesToggle').accessibility.ariaExpanded).toBe(false);
  });
});

// ── Payment Options Details ─────────────────────────────────────────

describe('payment options details', () => {
  it('renders card brands for credit card method', async () => {
    await loadPage();
    const repeater = getEl('#paymentMethodsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, { id: 'credit-card', name: 'Credit Card', brands: ['Visa', 'Mastercard'] });
    expect($item('#paymentBrands').text).toBe('Visa · Mastercard');
    expect($item('#paymentBrands').show).toHaveBeenCalled();
  });

  it('sets afterpay message text', async () => {
    await loadPage();
    expect(getEl('#afterpayMessage').text).toBe('Pay in 4');
  });

  it('sets shipping message', async () => {
    await loadPage();
    expect(getEl('#checkoutShippingMessage').text).toBe('Free shipping on orders $999+');
  });
});

// ── Shipping Options ARIA ───────────────────────────────────────────

describe('shipping options ARIA', () => {
  it('sets ariaLabel on shipping radio', async () => {
    await loadPage();
    const repeater = getEl('#shippingOptionsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockShippingOptions.options[0]);
    expect($item('#shippingOptionRadio').accessibility.ariaLabel).toContain('Standard');
  });

  it('renders express shipping price', async () => {
    await loadPage();
    const repeater = getEl('#shippingOptionsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockShippingOptions.options[1]);
    expect($item('#shippingOptionPrice').text).toBe('$49.99');
    expect($item('#shippingOptionDays').text).toBe('2–3 business days');
  });
});

// ── Address Validation Inline ───────────────────────────────────────

describe('address validation inline', () => {
  it('sets ariaRequired on address fields', async () => {
    await loadPage();
    expect(getEl('#addressFullName').accessibility.ariaRequired).toBe(true);
    expect(getEl('#addressLine1').accessibility.ariaRequired).toBe(true);
    expect(getEl('#addressCity').accessibility.ariaRequired).toBe(true);
  });

  it('wires onInput for real-time validation', async () => {
    await loadPage();
    expect(getEl('#addressFullName').onInput).toHaveBeenCalled();
    expect(getEl('#addressZip').onInput).toHaveBeenCalled();
  });

  it('wires onBlur for lazy validation', async () => {
    await loadPage();
    expect(getEl('#addressFullName').onBlur).toHaveBeenCalled();
    expect(getEl('#addressState').onBlur).toHaveBeenCalled();
  });

  it('hides inline error elements initially', async () => {
    await loadPage();
    expect(getEl('#addressFullNameError').hide).toHaveBeenCalled();
    expect(getEl('#addressLine1Error').hide).toHaveBeenCalled();
  });

  it('sets role=alert on error elements', async () => {
    await loadPage();
    expect(getEl('#addressFullNameError').accessibility.role).toBe('alert');
  });
});

// ── Delivery Estimate ARIA ──────────────────────────────────────────

describe('delivery estimate ARIA', () => {
  it('sets role=status on delivery estimate', async () => {
    await loadPage();
    expect(getEl('#checkoutDeliveryEstimate').accessibility.role).toBe('status');
  });

  it('sets ariaLabel matching text', async () => {
    await loadPage();
    const el = getEl('#checkoutDeliveryEstimate');
    expect(el.accessibility.ariaLabel).toContain('Estimated delivery');
    expect(el.accessibility.ariaLabel).toBe(el.text);
  });
});

// ── Order Summary Sidebar Details ───────────────────────────────────

describe('order summary sidebar details', () => {
  it('sets bold fontWeight on total', async () => {
    await loadPage();
    expect(getEl('#orderSummaryTotal').style.fontWeight).toBe('bold');
  });

  it('sets ariaLabel on sidebar with item count and total', async () => {
    await loadPage();
    expect(getEl('#orderSummarySidebar').accessibility.ariaLabel).toContain('3 items');
    expect(getEl('#orderSummarySidebar').accessibility.ariaLabel).toContain('$855.97');
  });

  it('hides savings when zero', async () => {
    await loadPage();
    expect(getEl('#orderSummarySavings').hide).toHaveBeenCalled();
  });
});

// ── Express Checkout Details ────────────────────────────────────────

describe('express checkout details', () => {
  it('sets ariaLabel on express checkout button', async () => {
    await loadPage();
    expect(getEl('#expressCheckoutBtn').accessibility.ariaLabel).toContain('Express checkout');
  });

  it('styles button with Coral CTA colors', async () => {
    await loadPage();
    expect(getEl('#expressCheckoutBtn').style.backgroundColor).toBe('#E07A5F');
    expect(getEl('#expressCheckoutBtn').style.color).toBe('#FFFFFF');
  });
});

// ── Store Credit ────────────────────────────────────────────────────

describe('store credit', () => {
  it('calls initCheckoutStoreCredit', async () => {
    await loadPage();
    const { initCheckoutStoreCredit } = await import('public/storeCreditHelpers.js');
    expect(initCheckoutStoreCredit).toHaveBeenCalled();
  });
});
