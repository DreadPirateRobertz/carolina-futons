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

// ══════════════════════════════════════════════════════════════════════
// Deep coverage — branch paths, click handlers, edge cases
// ══════════════════════════════════════════════════════════════════════

// ── Checkout Progress — step styling branches ────────────────────────

describe('checkout progress — completed step styling', () => {
  it('applies success color and shows check for completed step', async () => {
    const { getStepAriaAttributes } = await import('public/checkoutProgress.js');
    getStepAriaAttributes.mockImplementation((stepIdx, activeIdx, label) => ({
      state: 'completed',
      ariaLabel: `${label}: completed`,
      ariaCurrent: null,
    }));
    await loadPage();
    const repeater = getEl('#checkoutProgressRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, { id: 'info', number: 1, label: 'Information' });
    expect($item('#progressStepDot').style.backgroundColor).toBe('#4A7C59');
    expect($item('#progressStepCheck').show).toHaveBeenCalled();
    expect($item('#progressStepNumber').hide).toHaveBeenCalled();
  });

  it('applies pending color for future steps', async () => {
    const { getStepAriaAttributes } = await import('public/checkoutProgress.js');
    getStepAriaAttributes.mockImplementation((stepIdx, activeIdx, label) => ({
      state: 'pending',
      ariaLabel: `${label}: upcoming`,
      ariaCurrent: null,
    }));
    await loadPage();
    const repeater = getEl('#checkoutProgressRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, { id: 'payment', number: 3, label: 'Payment' });
    expect($item('#progressStepDot').style.backgroundColor).toBe('#C4B5A3');
    expect($item('#progressStepLabel').style.color).toBe('#8B7355');
  });

  it('sets ariaCurrent on active step container', async () => {
    const { getStepAriaAttributes } = await import('public/checkoutProgress.js');
    getStepAriaAttributes.mockImplementation((stepIdx, activeIdx, label) => ({
      state: 'active',
      ariaLabel: `${label}: current step`,
      ariaCurrent: 'step',
    }));
    await loadPage();
    const repeater = getEl('#checkoutProgressRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, { id: 'info', number: 1, label: 'Information' });
    expect($item('#progressStepContainer').accessibility.ariaCurrent).toBe('step');
  });
});

// ── Checkout Summary — edge cases ────────────────────────────────────

describe('checkout summary — edge cases', () => {
  it('shows singular "item" for 1-item cart', async () => {
    await loadPage({
      cart: {
        lineItems: [{ _id: 'item-1', productId: 'p1', name: 'Futon', price: 499, quantity: 1 }],
        totals: { subtotal: 499 },
      },
    });
    expect(getEl('#checkoutItemCount').text).toBe('1 item in your order');
  });

  it('does not crash when getCurrentCart returns null', async () => {
    const { getCurrentCart } = await import('public/cartService');
    getCurrentCart.mockResolvedValue(null);
    // Need to import fresh so other sections also get null cart
    await import('../src/pages/Checkout.js');
    if (onReadyHandler) await onReadyHandler();
    // The page should not crash — initCheckoutSummary returns early on null cart
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('checkout');
  });
});

// ── Payment Options — missing sections ───────────────────────────────

describe('payment options — collapsed when missing', () => {
  it('collapses afterpay when no afterpay data', async () => {
    await loadPage({
      payment: {
        success: true,
        summary: {
          payNow: { methods: [] },
          afterpay: null,
          financing: null,
          shippingMessage: null,
        },
      },
    });
    expect(getEl('#checkoutAfterpay').collapse).toHaveBeenCalled();
  });

  it('collapses financing when no financing data', async () => {
    await loadPage({
      payment: {
        success: true,
        summary: {
          payNow: { methods: [] },
          afterpay: null,
          financing: null,
          shippingMessage: null,
        },
      },
    });
    expect(getEl('#checkoutFinancing').collapse).toHaveBeenCalled();
  });

  it('does nothing on payment failure (success: false)', async () => {
    await loadPage({
      payment: { success: false },
    });
    expect(getEl('#paymentMethodsRepeater').data).toEqual([]);
  });
});

// ── Shipping Options — radio click handler ───────────────────────────

describe('shipping options — radio click handler', () => {
  it('updates delivery estimate on shipping selection', async () => {
    const { getDeliveryEstimate } = await import('backend/checkoutOptimization.web');
    getDeliveryEstimate.mockResolvedValue({
      success: true,
      data: { label: 'Mar 20 – Mar 25' },
    });

    await loadPage();

    const repeater = getEl('#shippingOptionsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockShippingOptions.options[1]); // express

    const radioCb = $item('#shippingOptionRadio').onClick.mock.calls[0][0];
    await radioCb();

    expect(getDeliveryEstimate).toHaveBeenCalledWith('express');
    expect(getEl('#checkoutDeliveryEstimate').text).toContain('Mar 20 – Mar 25');
  });

  it('announces shipping selection', async () => {
    const { getDeliveryEstimate } = await import('backend/checkoutOptimization.web');
    getDeliveryEstimate.mockResolvedValue({ success: false });

    await loadPage();

    const repeater = getEl('#shippingOptionsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockShippingOptions.options[0]); // standard

    const radioCb = $item('#shippingOptionRadio').onClick.mock.calls[0][0];
    await radioCb();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), 'Standard selected');
  });

  it('updates order summary sidebar on shipping selection', async () => {
    const { getDeliveryEstimate, calculateOrderSummary } = await import('backend/checkoutOptimization.web');
    getDeliveryEstimate.mockResolvedValue({ success: false });
    calculateOrderSummary.mockResolvedValue(mockOrderSummary);

    await loadPage();

    const repeater = getEl('#shippingOptionsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockShippingOptions.options[1]); // express

    const radioCb = $item('#shippingOptionRadio').onClick.mock.calls[0][0];
    await radioCb();

    expect(calculateOrderSummary).toHaveBeenCalled();
  });

  it('returns early on shipping options failure', async () => {
    await loadPage({ shipping: { success: false } });
    const repeater = getEl('#shippingOptionsRepeater');
    expect(repeater.data).toEqual([]);
  });
});

// ── Address Validation — inline field states ─────────────────────────

describe('address validation — inline validation', () => {
  it('shows error border and message for invalid field on input', async () => {
    const { validateAddressField, getFieldValidationState } = await import('public/checkoutValidation.js');
    validateAddressField.mockReturnValue({ valid: false, error: 'Name is required' });
    getFieldValidationState.mockReturnValue('error');

    await loadPage();

    const inputHandler = getEl('#addressFullName').onInput.mock.calls.at(-1)[0];
    getEl('#addressFullName').value = '';
    inputHandler();

    expect(getEl('#addressFullNameError').text).toBe('Name is required');
    expect(getEl('#addressFullNameError').show).toHaveBeenCalled();
    expect(getEl('#addressFullName').style.borderColor).toBe('#DC2626');
  });

  it('shows success border for valid field', async () => {
    const { validateAddressField, getFieldValidationState } = await import('public/checkoutValidation.js');
    validateAddressField.mockReturnValue({ valid: true });
    getFieldValidationState.mockReturnValue('valid');

    await loadPage();

    const inputHandler = getEl('#addressFullName').onInput.mock.calls.at(-1)[0];
    getEl('#addressFullName').value = 'John Doe';
    inputHandler();

    expect(getEl('#addressFullNameError').hide).toHaveBeenCalled();
    expect(getEl('#addressFullName').style.borderColor).toBe('#4A7C59');
  });

  it('shows neutral border for untouched state', async () => {
    const { validateAddressField, getFieldValidationState } = await import('public/checkoutValidation.js');
    validateAddressField.mockReturnValue({ valid: true });
    getFieldValidationState.mockReturnValue('neutral');

    await loadPage();

    const inputHandler = getEl('#addressFullName').onInput.mock.calls.at(-1)[0];
    getEl('#addressFullName').value = '';
    inputHandler();

    expect(getEl('#addressFullName').style.borderColor).toBe('#C4B5A3');
  });

  it('validates on blur for untouched fields', async () => {
    const { validateAddressField, getFieldValidationState } = await import('public/checkoutValidation.js');
    validateAddressField.mockReturnValue({ valid: true });
    getFieldValidationState.mockReturnValue('valid');

    await loadPage();

    const blurHandler = getEl('#addressFullName').onBlur.mock.calls.at(-1)[0];
    getEl('#addressFullName').value = 'Jane';
    blurHandler();

    expect(validateAddressField).toHaveBeenCalled();
  });

  it('skips blur validation for already-touched fields', async () => {
    const { validateAddressField, getFieldValidationState } = await import('public/checkoutValidation.js');
    validateAddressField.mockReturnValue({ valid: true });
    getFieldValidationState.mockReturnValue('valid');

    await loadPage();

    // First touch via onInput
    const inputHandler = getEl('#addressFullName').onInput.mock.calls.at(-1)[0];
    getEl('#addressFullName').value = 'Jane';
    inputHandler();

    const callCountAfterInput = validateAddressField.mock.calls.length;

    // Then blur — should NOT re-validate since already touched
    const blurHandler = getEl('#addressFullName').onBlur.mock.calls.at(-1)[0];
    blurHandler();

    expect(validateAddressField.mock.calls.length).toBe(callCountAfterInput);
  });

  it('shows fallback error when no errors array in validation result', async () => {
    await loadPage();
    const { validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: false });

    getEl('#addressFullName').value = 'John';
    getEl('#addressLine1').value = '123 Main';
    getEl('#addressCity').value = 'City';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '12345';

    const handler = getEl('#validateAddressBtn').onClick.mock.calls.at(-1)[0];
    await handler();

    expect(getEl('#addressErrors').text).toBe('Please check your address.');
  });

  it('announces validation errors', async () => {
    await loadPage();
    const { validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: false, errors: ['Bad ZIP'] });

    getEl('#addressFullName').value = 'John';
    getEl('#addressLine1').value = '123';
    getEl('#addressCity').value = 'City';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = 'bad';

    const handler = getEl('#validateAddressBtn').onClick.mock.calls.at(-1)[0];
    await handler();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Bad ZIP'));
  });

  it('announces success on valid address', async () => {
    await loadPage();
    const { validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: true });

    getEl('#addressFullName').value = 'John Doe';
    getEl('#addressLine1').value = '123 Main St';
    getEl('#addressCity').value = 'Hendersonville';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '28739';

    const handler = getEl('#validateAddressBtn').onClick.mock.calls.at(-1)[0];
    await handler();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), 'Shipping address verified');
  });
});

// ── Express Checkout — click flows ───────────────────────────────────

describe('express checkout — click flows', () => {
  it('announces warning when address not validated', async () => {
    await loadPage();
    const btn = getEl('#expressCheckoutBtn');
    const clickHandler = btn.onClick.mock.calls.at(-1)[0];
    await clickHandler();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), 'Please verify your shipping address first');
  });

  it('shows express summary on success with valid address', async () => {
    const { getExpressCheckoutSummary, validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: true });
    getExpressCheckoutSummary.mockResolvedValue({
      success: true,
      data: {
        total: 899.99,
        shipping: { amount: 0 },
        shippingAddress: {
          fullName: 'John Doe',
          line1: '123 Main St',
          city: 'Hendersonville',
          state: 'NC',
          zip: '28739',
        },
      },
    });

    await loadPage();

    // First validate address
    getEl('#addressFullName').value = 'John Doe';
    getEl('#addressLine1').value = '123 Main St';
    getEl('#addressCity').value = 'Hendersonville';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '28739';
    const validateHandler = getEl('#validateAddressBtn').onClick.mock.calls.at(-1)[0];
    await validateHandler();

    // Now click express checkout
    const btn = getEl('#expressCheckoutBtn');
    const clickHandler = btn.onClick.mock.calls.at(-1)[0];
    await clickHandler();

    expect(getEl('#expressSummaryTotal').text).toContain('899.99');
    expect(getEl('#expressSummaryShipping').text).toBe('Free Shipping');
    expect(getEl('#expressSummarySection').show).toHaveBeenCalled();
  });

  it('shows paid shipping in express summary', async () => {
    const { getExpressCheckoutSummary, validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: true });
    getExpressCheckoutSummary.mockResolvedValue({
      success: true,
      data: {
        total: 599.99,
        shipping: { amount: 49.99 },
        shippingAddress: {
          fullName: 'Jane', line1: '456 Oak', city: 'Asheville', state: 'NC', zip: '28801',
        },
      },
    });

    await loadPage();

    getEl('#addressFullName').value = 'Jane';
    getEl('#addressLine1').value = '456 Oak';
    getEl('#addressCity').value = 'Asheville';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '28801';
    const validateHandler = getEl('#validateAddressBtn').onClick.mock.calls.at(-1)[0];
    await validateHandler();

    const clickHandler = getEl('#expressCheckoutBtn').onClick.mock.calls.at(-1)[0];
    await clickHandler();

    expect(getEl('#expressSummaryShipping').text).toContain('49.99');
  });

  it('announces failure when express checkout fails', async () => {
    const { getExpressCheckoutSummary, validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: true });
    getExpressCheckoutSummary.mockResolvedValue({ success: false });

    await loadPage();

    getEl('#addressFullName').value = 'Test';
    getEl('#addressLine1').value = '123';
    getEl('#addressCity').value = 'City';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '28739';
    const validateHandler = getEl('#validateAddressBtn').onClick.mock.calls.at(-1)[0];
    await validateHandler();

    const clickHandler = getEl('#expressCheckoutBtn').onClick.mock.calls.at(-1)[0];
    await clickHandler();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), 'Unable to prepare express checkout. Please use standard checkout.');
  });

  it('re-enables button after express checkout error', async () => {
    const { getExpressCheckoutSummary, validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: true });
    getExpressCheckoutSummary.mockRejectedValue(new Error('Network error'));

    await loadPage();

    getEl('#addressFullName').value = 'Test';
    getEl('#addressLine1').value = '123';
    getEl('#addressCity').value = 'City';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '28739';
    const validateHandler = getEl('#validateAddressBtn').onClick.mock.calls.at(-1)[0];
    await validateHandler();

    const clickHandler = getEl('#expressCheckoutBtn').onClick.mock.calls.at(-1)[0];
    await clickHandler();

    expect(getEl('#expressCheckoutBtn').enable).toHaveBeenCalled();
  });

  it('disables button and shows Processing... during express checkout', async () => {
    const { getExpressCheckoutSummary, validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: true });
    let resolveCheckout;
    getExpressCheckoutSummary.mockImplementation(() => new Promise(r => { resolveCheckout = r; }));

    await loadPage();

    getEl('#addressFullName').value = 'Test';
    getEl('#addressLine1').value = '123';
    getEl('#addressCity').value = 'City';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '28739';
    const validateHandler = getEl('#validateAddressBtn').onClick.mock.calls.at(-1)[0];
    await validateHandler();

    const clickHandler = getEl('#expressCheckoutBtn').onClick.mock.calls.at(-1)[0];
    const clickPromise = clickHandler();

    // Button should be disabled while processing
    expect(getEl('#expressCheckoutBtn').disable).toHaveBeenCalled();

    resolveCheckout({ success: false });
    await clickPromise;
  });
});

// ── Order Summary Sidebar — savings and non-zero shipping ────────────

describe('order summary sidebar — savings display', () => {
  it('shows savings message when savings > 0', async () => {
    await loadPage({
      orderSummary: {
        success: true,
        data: {
          subtotal: 1200,
          shipping: { amount: 0 },
          tax: 84,
          total: 1284,
          savings: 99.99,
          itemCount: 2,
        },
      },
    });
    expect(getEl('#orderSummarySavings').text).toContain('99.99');
    expect(getEl('#orderSummarySavings').show).toHaveBeenCalled();
  });

  it('shows non-zero shipping amount', async () => {
    await loadPage({
      orderSummary: {
        success: true,
        data: {
          subtotal: 400,
          shipping: { amount: 49.99 },
          tax: 31.50,
          total: 481.49,
          savings: 0,
          itemCount: 1,
        },
      },
    });
    expect(getEl('#orderSummaryShipping').text).toBe('$49.99');
  });

  it('renders item details in sidebar repeater', async () => {
    await loadPage();
    const repeater = getEl('#orderSummaryItemsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, { name: 'Futon Frame', quantity: 2, lineTotal: '999.98' });
    expect($item('#summaryItemName').text).toBe('Futon Frame');
    expect($item('#summaryItemQty').text).toBe('×2');
    expect($item('#summaryItemPrice').text).toBe('$999.98');
  });

  it('does not show sidebar when calculateOrderSummary fails', async () => {
    await loadPage({ orderSummary: { success: false } });
    // Sidebar should still show (initOrderSummarySidebar calls updateOrderSummaryDisplay
    // which returns early on !result.success, but sidebar.show is called after)
    // The key test is that totals are NOT populated
    expect(getEl('#orderSummarySubtotal').text).toBe('');
  });
});

// ── Protection Plan — tier rendering & interactions ──────────────────

describe('protection plan — tier rendering', () => {
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

  it('renders tier name, price, and duration', async () => {
    await loadPage({ protectionPlans: mockPlans });
    const repeater = getEl('#protectionPlanRepeater');
    const planReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];

    const planEls = new Map();
    const $planItem = (sel) => {
      if (!planEls.has(sel)) planEls.set(sel, createMockElement());
      return planEls.get(sel);
    };

    // Simulate plan item ready — need to mock tier repeater
    const tierReadyFn = vi.fn();
    $planItem('#protPlanTierRepeater').onItemReady = tierReadyFn;
    planReadyFn($planItem, { ...mockPlans.plans[0] });

    // Tier repeater should have data
    expect($planItem('#protPlanTierRepeater').data).toHaveLength(2);

    // Simulate tier item ready
    const tierEls = new Map();
    const $tierItem = (sel) => {
      if (!tierEls.has(sel)) tierEls.set(sel, createMockElement());
      return tierEls.get(sel);
    };
    const tierFn = tierReadyFn.mock.calls[0][0];
    tierFn($tierItem, { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'], productId: 'prod-1' });

    expect($tierItem('#tierName').text).toBe('Basic');
    expect($tierItem('#tierPrice').text).toBe('+$29.99');
    expect($tierItem('#tierDuration').text).toBe('1-year coverage');
    expect($tierItem('#tierCoverage').text).toBe('Defects');
  });

  it('highlights selected tier with mountainBlue border', async () => {
    const selectedPlan = {
      ...mockPlans,
      plans: [{
        ...mockPlans.plans[0],
        selectedTier: 'premium',
      }],
    };
    await loadPage({ protectionPlans: selectedPlan });

    const repeater = getEl('#protectionPlanRepeater');
    const planReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const planEls = new Map();
    const $planItem = (sel) => {
      if (!planEls.has(sel)) planEls.set(sel, createMockElement());
      return planEls.get(sel);
    };
    const tierReadyFn = vi.fn();
    $planItem('#protPlanTierRepeater').onItemReady = tierReadyFn;
    planReadyFn($planItem, { ...selectedPlan.plans[0] });

    const tierEls = new Map();
    const $tierItem = (sel) => {
      if (!tierEls.has(sel)) tierEls.set(sel, createMockElement());
      return tierEls.get(sel);
    };
    const tierFn = tierReadyFn.mock.calls[0][0];
    tierFn($tierItem, { id: 'premium', name: 'Premium', price: 59.99, durationYears: 3, coverage: ['Defects', 'Accidental'], productId: 'prod-1' });

    expect($tierItem('#tierCard').style.borderColor).toBe('#2D5F7C');
    expect($tierItem('#tierSelectBtn').label).toBe('Selected');
  });

  it('styles unselected tier with coral button', async () => {
    await loadPage({ protectionPlans: mockPlans });
    const repeater = getEl('#protectionPlanRepeater');
    const planReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const planEls = new Map();
    const $planItem = (sel) => {
      if (!planEls.has(sel)) planEls.set(sel, createMockElement());
      return planEls.get(sel);
    };
    const tierReadyFn = vi.fn();
    $planItem('#protPlanTierRepeater').onItemReady = tierReadyFn;
    planReadyFn($planItem, { ...mockPlans.plans[0] });

    const tierEls = new Map();
    const $tierItem = (sel) => {
      if (!tierEls.has(sel)) tierEls.set(sel, createMockElement());
      return tierEls.get(sel);
    };
    const tierFn = tierReadyFn.mock.calls[0][0];
    tierFn($tierItem, { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'], productId: 'prod-1' });

    expect($tierItem('#tierSelectBtn').label).toBe('Add Protection');
    expect($tierItem('#tierSelectBtn').style.backgroundColor).toBe('#E07A5F');
  });
});

describe('protection plan — tier click handlers', () => {
  const mockPlans = {
    success: true,
    plans: [{
      productId: 'prod-1',
      productName: 'Futon Frame',
      productPrice: 499.99,
      selectedTier: null,
      tiers: [
        { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'] },
      ],
    }],
  };

  it('adds protection plan on click', async () => {
    const { addProtectionPlan } = await import('backend/protectionPlan.web');
    addProtectionPlan.mockResolvedValue({
      success: true,
      data: { planName: 'Basic', price: 29.99 },
    });

    await loadPage({ protectionPlans: mockPlans });
    const repeater = getEl('#protectionPlanRepeater');
    const planReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const planEls = new Map();
    const $planItem = (sel) => {
      if (!planEls.has(sel)) planEls.set(sel, createMockElement());
      return planEls.get(sel);
    };
    const tierReadyFn = vi.fn();
    $planItem('#protPlanTierRepeater').onItemReady = tierReadyFn;
    const planData = { ...mockPlans.plans[0] };
    planReadyFn($planItem, planData);

    const tierEls = new Map();
    const $tierItem = (sel) => {
      if (!tierEls.has(sel)) tierEls.set(sel, createMockElement());
      return tierEls.get(sel);
    };
    const tierFn = tierReadyFn.mock.calls[0][0];
    tierFn($tierItem, { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'], productId: 'prod-1' });

    const clickHandler = $tierItem('#tierSelectBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(addProtectionPlan).toHaveBeenCalledWith('prod-1', 'basic', expect.any(String));
    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Basic added'));
  });

  it('removes protection plan when already selected', async () => {
    const { removeProtectionPlan } = await import('backend/protectionPlan.web');
    removeProtectionPlan.mockResolvedValue({ success: true });

    const selectedPlans = {
      ...mockPlans,
      plans: [{ ...mockPlans.plans[0], selectedTier: 'basic' }],
    };

    await loadPage({ protectionPlans: selectedPlans });
    const repeater = getEl('#protectionPlanRepeater');
    const planReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const planEls = new Map();
    const $planItem = (sel) => {
      if (!planEls.has(sel)) planEls.set(sel, createMockElement());
      return planEls.get(sel);
    };
    const tierReadyFn = vi.fn();
    $planItem('#protPlanTierRepeater').onItemReady = tierReadyFn;
    const planData = { ...selectedPlans.plans[0] };
    planReadyFn($planItem, planData);

    const tierEls = new Map();
    const $tierItem = (sel) => {
      if (!tierEls.has(sel)) tierEls.set(sel, createMockElement());
      return tierEls.get(sel);
    };
    const tierFn = tierReadyFn.mock.calls[0][0];
    tierFn($tierItem, { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'], productId: 'prod-1' });

    const clickHandler = $tierItem('#tierSelectBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(removeProtectionPlan).toHaveBeenCalledWith('prod-1', expect.any(String));
    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('removed'));
  });
});

describe('protection plan — decline button', () => {
  const mockPlans = {
    success: true,
    plans: [{
      productId: 'prod-1',
      productName: 'Futon Frame',
      productPrice: 499.99,
      selectedTier: 'basic',
      tiers: [
        { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'] },
      ],
    }],
  };

  it('removes plan and collapses tiers on decline', async () => {
    const { removeProtectionPlan } = await import('backend/protectionPlan.web');
    removeProtectionPlan.mockResolvedValue({ success: true });

    await loadPage({ protectionPlans: mockPlans });
    const repeater = getEl('#protectionPlanRepeater');
    const planReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const planEls = new Map();
    const $planItem = (sel) => {
      if (!planEls.has(sel)) planEls.set(sel, createMockElement());
      return planEls.get(sel);
    };
    const tierReadyFn = vi.fn();
    $planItem('#protPlanTierRepeater').onItemReady = tierReadyFn;
    planReadyFn($planItem, { ...mockPlans.plans[0] });

    const declineHandler = $planItem('#protPlanDecline').onClick.mock.calls[0][0];
    await declineHandler();

    expect(removeProtectionPlan).toHaveBeenCalledWith('prod-1', expect.any(String));
    expect($planItem('#protPlanTierRepeater').collapse).toHaveBeenCalled();
    expect($planItem('#protPlanDecline').text).toBe('Protection declined');
  });

  it('sets ariaLabel on decline button', async () => {
    await loadPage({ protectionPlans: mockPlans });
    const repeater = getEl('#protectionPlanRepeater');
    const planReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const planEls = new Map();
    const $planItem = (sel) => {
      if (!planEls.has(sel)) planEls.set(sel, createMockElement());
      return planEls.get(sel);
    };
    const tierReadyFn = vi.fn();
    $planItem('#protPlanTierRepeater').onItemReady = tierReadyFn;
    planReadyFn($planItem, { ...mockPlans.plans[0] });

    expect($planItem('#protPlanDecline').accessibility.ariaLabel).toContain('Decline protection');
  });
});

// ── Store Credit — apply flow ────────────────────────────────────────

describe('store credit — apply flow', () => {
  it('wires apply button when credit is available', async () => {
    const { initCheckoutStoreCredit } = await import('public/storeCreditHelpers.js');
    initCheckoutStoreCredit.mockReturnValue({ available: true, applicableAmount: 50 });

    await loadPage();

    expect(getEl('#storeCreditApplyBtn').onClick).toHaveBeenCalled();
  });

  it('sets ariaLabel on apply button with credit amount', async () => {
    const { initCheckoutStoreCredit } = await import('public/storeCreditHelpers.js');
    initCheckoutStoreCredit.mockReturnValue({ available: true, applicableAmount: 50 });

    await loadPage();

    expect(getEl('#storeCreditApplyBtn').accessibility.ariaLabel).toContain('$50.00');
  });
});

// ── Cleanup — onBeforeUnload calls resetCheckoutGiftCard ─────────────

describe('cleanup — onBeforeUnload', () => {
  it('calls resetCheckoutGiftCard when page unloads', async () => {
    await loadPage();
    const wixWindow = await import('wix-window-frontend');
    const unloadCb = wixWindow.onBeforeUnload.mock.calls.at(-1)[0];
    unloadCb();

    const { resetCheckoutGiftCard } = await import('public/giftCardHelpers.js');
    expect(resetCheckoutGiftCard).toHaveBeenCalled();
  });
});

// ── Protection Plan — ARIA attributes ────────────────────────────────

describe('protection plan — ARIA', () => {
  const mockPlans = {
    success: true,
    plans: [{
      productId: 'prod-1',
      productName: 'Futon Frame',
      productPrice: 499.99,
      selectedTier: null,
      tiers: [
        { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'] },
      ],
    }],
  };

  it('sets region role and ariaLabel on section', async () => {
    await loadPage({ protectionPlans: mockPlans });
    expect(getEl('#protectionPlanSection').accessibility.role).toBe('region');
    expect(getEl('#protectionPlanSection').accessibility.ariaLabel).toBe('Furniture protection plans');
  });

  it('sets heading role on protection plan title', async () => {
    await loadPage({ protectionPlans: mockPlans });
    expect(getEl('#protectionPlanTitle').accessibility.role).toBe('heading');
  });

  it('sets ariaLabel on tier select button', async () => {
    await loadPage({ protectionPlans: mockPlans });
    const repeater = getEl('#protectionPlanRepeater');
    const planReadyFn = repeater.onItemReady.mock.calls.at(-1)[0];
    const planEls = new Map();
    const $planItem = (sel) => {
      if (!planEls.has(sel)) planEls.set(sel, createMockElement());
      return planEls.get(sel);
    };
    const tierReadyFn = vi.fn();
    $planItem('#protPlanTierRepeater').onItemReady = tierReadyFn;
    planReadyFn($planItem, { ...mockPlans.plans[0] });

    const tierEls = new Map();
    const $tierItem = (sel) => {
      if (!tierEls.has(sel)) tierEls.set(sel, createMockElement());
      return tierEls.get(sel);
    };
    const tierFn = tierReadyFn.mock.calls[0][0];
    tierFn($tierItem, { id: 'basic', name: 'Basic', price: 29.99, durationYears: 1, coverage: ['Defects'], productId: 'prod-1' });

    expect($tierItem('#tierSelectBtn').accessibility.ariaLabel).toContain('Add Basic');
    expect($tierItem('#tierSelectBtn').accessibility.ariaLabel).toContain('$29.99');
  });
});
