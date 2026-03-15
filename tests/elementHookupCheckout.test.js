/**
 * Tests for Checkout page element hookup — CF-03jx
 * Covers: #paymentMethodsRepeater, #paymentMethodName, #paymentMethodIcon,
 * #paymentBrands, #trustIcon, #trustText, #checkoutAfterpay, #afterpayMessage,
 * #afterpayInstallment, #checkoutFinancing, #financingMessage,
 * #checkoutShippingMessage, #shippingOptionsRepeater, #shippingOptionLabel,
 * #shippingOptionPrice, #shippingOptionDesc, #shippingOptionDays,
 * #shippingOptionRadio, #validateAddressBtn, #addressFullName, #addressLine1,
 * #addressCity, #addressState, #addressZip, #addressErrors, #addressSuccess,
 * #checkoutProgressNav, #checkoutProgressRepeater, #progressStepLabel,
 * #progressStepNumber, #progressStepDot, #progressStepContainer,
 * #orderNotesToggle, #orderNotesField, #checkoutFreeShipping,
 * #checkoutItemCount, #orderSummarySidebar, #orderSummarySubtotal,
 * #orderSummaryShipping, #orderSummaryTax, #orderSummaryTotal,
 * #expressCheckoutSection, #expressCheckoutBtn
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
    hidden: false,
    style: { color: '', backgroundColor: '', borderColor: '', fontWeight: '' },
    accessibility: {
      ariaLabel: '', ariaLive: '', role: '', ariaHidden: false,
      ariaExpanded: false, ariaRequired: false, ariaCurrent: '',
    },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
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
    sand: '#E8D5B7', sandDark: '#C4A882', espresso: '#3A2518',
    mountainBlue: '#5B8FA8', coral: '#E8845C', sunsetCoral: '#E8845C',
    success: '#28a745', error: '#dc3545', mutedBrown: '#8B7355', white: '#fff',
  },
}));

vi.mock('public/cartStyles.js', () => ({
  getCheckoutButtonStyles: vi.fn(() => ({ background: '#E8845C', textColor: '#fff' })),
}));

vi.mock('public/checkoutProgress.js', () => ({
  getCheckoutSteps: vi.fn(() => [
    { id: 'info', label: 'Information', number: 1 },
    { id: 'shipping', label: 'Shipping', number: 2 },
    { id: 'payment', label: 'Payment', number: 3 },
    { id: 'review', label: 'Review', number: 4 },
  ]),
  getStepAriaAttributes: vi.fn((stepIndex, activeIndex, label) => ({
    state: stepIndex < activeIndex ? 'completed' : stepIndex === activeIndex ? 'active' : 'upcoming',
    ariaLabel: `Step ${stepIndex + 1}: ${label}`,
    ariaCurrent: stepIndex === activeIndex ? 'step' : null,
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
  getProtectionPlans: vi.fn(() => Promise.resolve({ success: false, plans: [] })),
  addProtectionPlan: vi.fn(),
  removeProtectionPlan: vi.fn(),
  PLAN_TIERS: {},
}));

vi.mock('public/storeCreditHelpers.js', () => ({
  initCheckoutStoreCredit: vi.fn(() => Promise.resolve({ available: false })),
  formatCreditBalance: vi.fn((n) => `$${n.toFixed(2)}`),
}));

vi.mock('public/giftCardHelpers.js', () => ({
  initCheckoutGiftCard: vi.fn(() => Promise.resolve()),
  finalizeGiftCardRedemption: vi.fn(),
  resetCheckoutGiftCard: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-window-frontend', () => ({
  default: { onBeforeUnload: vi.fn() },
}));

// ── Helpers ─────────────────────────────────────────────────────────

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

async function loadPage(overrides = {}) {
  elements.clear();
  onReadyHandler = null;

  const { getCurrentCart } = await import('public/cartService');
  getCurrentCart.mockResolvedValue(overrides.cart ?? {
    lineItems: [{ _id: 'i1', productId: 'p1', name: 'Frame', price: 549.99, quantity: 1 }],
    totals: { subtotal: 549.99, total: 549.99 },
  });

  const { getCheckoutPaymentSummary } = await import('backend/paymentOptions.web');
  getCheckoutPaymentSummary.mockResolvedValue(overrides.payment ?? {
    success: true,
    summary: {
      payNow: {
        methods: [
          { id: 'credit-card', name: 'Credit Card', brands: ['Visa', 'Mastercard', 'Amex'] },
          { id: 'apple-pay', name: 'Apple Pay' },
        ],
      },
      afterpay: overrides.afterpay ?? { message: 'Pay in 4', installmentAmount: 137.50 },
      financing: overrides.financing ?? { message: 'As low as $29/mo' },
      shippingMessage: overrides.shippingMessage ?? 'Free curbside delivery on this order',
    },
  });

  const { getShippingOptions } = await import('backend/checkoutOptimization.web');
  getShippingOptions.mockResolvedValue(overrides.shipping ?? {
    success: true,
    options: [
      {
        id: 'standard',
        label: 'Standard Curbside',
        price: 0,
        description: 'Free curbside delivery to your door',
        estimatedDays: { min: 5, max: 10 },
      },
      {
        id: 'white-glove',
        label: 'White Glove',
        price: 149.99,
        description: 'In-home setup and old furniture removal',
        estimatedDays: { min: 7, max: 14 },
      },
    ],
  });

  const { calculateOrderSummary } = await import('backend/checkoutOptimization.web');
  calculateOrderSummary.mockResolvedValue({
    success: true,
    data: { subtotal: 549.99, shipping: { amount: 0 }, tax: 38.50, total: 588.49, itemCount: 1, savings: 0 },
  });

  vi.resetModules();
  await import('../src/pages/Checkout.js');
  if (onReadyHandler) await onReadyHandler();
  // Allow allSettled to resolve
  await new Promise(r => setTimeout(r, 50));
}

// ── Payment Method Repeater Children ────────────────────────────────

describe('Checkout — #paymentMethodsRepeater children', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('populates payment methods repeater with data', async () => {
    await loadPage();
    const repeater = getEl('#paymentMethodsRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0].name).toBe('Credit Card');
    expect(repeater.data[1].name).toBe('Apple Pay');
  });

  it('sets #paymentMethodName text from method data', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#paymentMethodsRepeater', {
      _id: 'credit-card', id: 'credit-card', name: 'Credit Card', brands: ['Visa', 'Mastercard'],
    });
    expect($item).not.toBeNull();

    expect($item('#paymentMethodName').text).toBe('Credit Card');
  });

  it('sets #paymentMethodIcon alt text from method name', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#paymentMethodsRepeater', {
      _id: 'apple-pay', id: 'apple-pay', name: 'Apple Pay',
    });
    expect($item).not.toBeNull();

    expect($item('#paymentMethodIcon').alt).toBe('Apple Pay');
    expect($item('#paymentMethodIcon').accessibility.ariaHidden).toBe(true);
  });

  it('shows #paymentBrands for credit card method', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#paymentMethodsRepeater', {
      _id: 'credit-card', id: 'credit-card', name: 'Credit Card', brands: ['Visa', 'Mastercard', 'Amex'],
    });
    expect($item).not.toBeNull();

    expect($item('#paymentBrands').text).toBe('Visa · Mastercard · Amex');
    expect($item('#paymentBrands').show).toHaveBeenCalled();
  });

  it('does not show #paymentBrands for non-credit-card methods', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#paymentMethodsRepeater', {
      _id: 'apple-pay', id: 'apple-pay', name: 'Apple Pay',
    });
    expect($item).not.toBeNull();

    expect($item('#paymentBrands').show).not.toHaveBeenCalled();
  });
});

// ── Trust Signal Icon ───────────────────────────────────────────────

describe('Checkout — #trustIcon in trust repeater', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ariaHidden on trust icons', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#trustRepeater', {
      _id: '0', icon: 'lock', text: 'Secure SSL Checkout',
    });
    expect($item).not.toBeNull();

    expect($item('#trustIcon').accessibility.ariaHidden).toBe(true);
    expect($item('#trustIcon').alt).toBe('');
  });

  it('sets trust text content', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#trustRepeater', {
      _id: '1', icon: 'shield', text: '30-Day Money-Back Guarantee',
    });
    expect($item).not.toBeNull();

    expect($item('#trustText').text).toBe('30-Day Money-Back Guarantee');
  });
});

// ── Afterpay Section ────────────────────────────────────────────────

describe('Checkout — #afterpayMessage/#afterpayInstallment', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows afterpay message and installment amount', async () => {
    await loadPage({
      afterpay: { message: 'Pay in 4 interest-free installments', installmentAmount: 137.50 },
    });

    expect(getEl('#afterpayMessage').text).toBe('Pay in 4 interest-free installments');
    expect(getEl('#afterpayInstallment').text).toBe('4 payments of $137.50');
    expect(getEl('#checkoutAfterpay').expand).toHaveBeenCalled();
  });

  it('collapses afterpay section when afterpay is null', async () => {
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
});

// ── Financing Section ───────────────────────────────────────────────

describe('Checkout — #financingMessage/#checkoutFinancing', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows financing message when available', async () => {
    await loadPage({
      financing: { message: 'As low as $29/mo with Affirm' },
    });

    expect(getEl('#financingMessage').text).toBe('As low as $29/mo with Affirm');
    expect(getEl('#checkoutFinancing').expand).toHaveBeenCalled();
  });

  it('collapses financing when not available', async () => {
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
});

// ── Shipping Message ────────────────────────────────────────────────

describe('Checkout — #checkoutShippingMessage', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets shipping message text and ARIA role', async () => {
    await loadPage({
      shippingMessage: 'Free curbside delivery included',
    });

    expect(getEl('#checkoutShippingMessage').text).toBe('Free curbside delivery included');
    expect(getEl('#checkoutShippingMessage').accessibility.role).toBe('status');
  });
});

// ── Shipping Options Repeater Children ──────────────────────────────

describe('Checkout — shipping options repeater children', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('populates shipping options repeater', async () => {
    await loadPage();
    const repeater = getEl('#shippingOptionsRepeater');
    expect(repeater.data).toHaveLength(2);
  });

  it('sets #shippingOptionDesc description text', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#shippingOptionsRepeater', {
      _id: 'white-glove',
      id: 'white-glove',
      label: 'White Glove',
      price: 149.99,
      description: 'In-home setup and old furniture removal',
      estimatedDays: { min: 7, max: 14 },
    });
    expect($item).not.toBeNull();

    expect($item('#shippingOptionDesc').text).toBe('In-home setup and old furniture removal');
  });

  it('sets #shippingOptionDays estimated delivery text', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#shippingOptionsRepeater', {
      _id: 'standard', id: 'standard', label: 'Standard',
      price: 0, description: 'Curbside', estimatedDays: { min: 5, max: 10 },
    });
    expect($item).not.toBeNull();

    expect($item('#shippingOptionDays').text).toBe('5–10 business days');
  });

  it('shows FREE for zero-price shipping option', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#shippingOptionsRepeater', {
      _id: 'standard', id: 'standard', label: 'Standard Curbside',
      price: 0, description: 'Free curbside', estimatedDays: { min: 5, max: 10 },
    });
    expect($item).not.toBeNull();

    expect($item('#shippingOptionPrice').text).toBe('FREE');
  });

  it('shows price for paid shipping option', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#shippingOptionsRepeater', {
      _id: 'white-glove', id: 'white-glove', label: 'White Glove',
      price: 149.99, description: 'Setup', estimatedDays: { min: 7, max: 14 },
    });
    expect($item).not.toBeNull();

    expect($item('#shippingOptionPrice').text).toBe('$149.99');
  });

  it('sets ARIA label on #shippingOptionRadio', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#shippingOptionsRepeater', {
      _id: 'white-glove', id: 'white-glove', label: 'White Glove',
      price: 149.99, description: 'In-home setup', estimatedDays: { min: 7, max: 14 },
    });
    expect($item).not.toBeNull();

    expect($item('#shippingOptionRadio').accessibility.ariaLabel).toBe('White Glove - In-home setup');
  });

  it('registers click handler on #shippingOptionRadio', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#shippingOptionsRepeater', {
      _id: 'white-glove', id: 'white-glove', label: 'White Glove',
      price: 149.99, description: 'Setup', estimatedDays: { min: 7, max: 14 },
    });
    expect($item).not.toBeNull();

    expect($item('#shippingOptionRadio').onClick).toHaveBeenCalled();
  });

  it('applies focus ring to #shippingOptionRadio', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#shippingOptionsRepeater', {
      _id: 'standard', id: 'standard', label: 'Standard',
      price: 0, description: 'Free', estimatedDays: { min: 5, max: 10 },
    });
    expect($item).not.toBeNull();

    const { applyFocusRing } = await import('public/a11yHelpers.js');
    expect(applyFocusRing).toHaveBeenCalled();
  });

  it('sets #shippingOptionLabel text from option label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#shippingOptionsRepeater', {
      _id: 'standard', id: 'standard', label: 'Standard Curbside',
      price: 0, description: 'Free delivery', estimatedDays: { min: 5, max: 10 },
    });
    expect($item).not.toBeNull();

    expect($item('#shippingOptionLabel').text).toBe('Standard Curbside');
  });
});

// ── Address Validation Elements ─────────────────────────────────────

describe('Checkout — address validation elements', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA labels on all address fields', async () => {
    await loadPage();

    expect(getEl('#addressFullName').accessibility.ariaLabel).toBe('Full name');
    expect(getEl('#addressLine1').accessibility.ariaLabel).toBe('Street address');
    expect(getEl('#addressCity').accessibility.ariaLabel).toBe('City');
    expect(getEl('#addressState').accessibility.ariaLabel).toBe('State (2-letter code)');
    expect(getEl('#addressZip').accessibility.ariaLabel).toBe('ZIP code');
  });

  it('marks all address fields as required', async () => {
    await loadPage();

    expect(getEl('#addressFullName').accessibility.ariaRequired).toBe(true);
    expect(getEl('#addressLine1').accessibility.ariaRequired).toBe(true);
    expect(getEl('#addressCity').accessibility.ariaRequired).toBe(true);
    expect(getEl('#addressState').accessibility.ariaRequired).toBe(true);
    expect(getEl('#addressZip').accessibility.ariaRequired).toBe(true);
  });

  it('shows success message on valid address', async () => {
    await loadPage();

    const { validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({ valid: true });

    // Set address field values
    getEl('#addressFullName').value = 'John Doe';
    getEl('#addressLine1').value = '123 Main St';
    getEl('#addressCity').value = 'Hendersonville';
    getEl('#addressState').value = 'NC';
    getEl('#addressZip').value = '28739';

    const clickHandler = getEl('#validateAddressBtn').onClick.mock.calls[0]?.[0];
    if (clickHandler) await clickHandler();

    expect(getEl('#addressSuccess').text).toBe('Address verified');
    expect(getEl('#addressSuccess').show).toHaveBeenCalled();
    expect(getEl('#addressErrors').hide).toHaveBeenCalled();
  });

  it('shows error messages on invalid address', async () => {
    await loadPage();

    const { validateShippingAddress } = await import('backend/checkoutOptimization.web');
    validateShippingAddress.mockResolvedValue({
      valid: false,
      errors: ['Invalid ZIP code', 'State not recognized'],
    });

    getEl('#addressFullName').value = 'John';
    getEl('#addressLine1').value = '123 Main';
    getEl('#addressCity').value = 'City';
    getEl('#addressState').value = 'XX';
    getEl('#addressZip').value = '00000';

    const clickHandler = getEl('#validateAddressBtn').onClick.mock.calls[0]?.[0];
    if (clickHandler) await clickHandler();

    expect(getEl('#addressErrors').text).toContain('Invalid ZIP code');
    expect(getEl('#addressErrors').show).toHaveBeenCalled();
    expect(getEl('#addressSuccess').hide).toHaveBeenCalled();
  });
});

// ── Checkout Progress Nav ───────────────────────────────────────────

describe('Checkout — #checkoutProgressNav element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets navigation role and ARIA label on progress nav', async () => {
    await loadPage();
    const nav = getEl('#checkoutProgressNav');
    expect(nav.accessibility.role).toBe('navigation');
    expect(nav.accessibility.ariaLabel).toBe('Checkout progress');
  });

  it('populates progress repeater with 4 steps', async () => {
    await loadPage();
    const repeater = getEl('#checkoutProgressRepeater');
    expect(repeater.data).toHaveLength(4);
    expect(repeater.data[0].label).toBe('Information');
  });

  it('sets step label and number on repeater items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#checkoutProgressRepeater', {
      _id: 'info', id: 'info', label: 'Information', number: 1,
    });
    expect($item).not.toBeNull();

    expect($item('#progressStepLabel').text).toBe('Information');
    expect($item('#progressStepNumber').text).toBe('1');
  });

  it('styles active step with mountain blue', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#checkoutProgressRepeater', {
      _id: 'info', id: 'info', label: 'Information', number: 1,
    });
    expect($item).not.toBeNull();

    expect($item('#progressStepDot').style.backgroundColor).toBe('#5B8FA8');
    expect($item('#progressStepLabel').style.color).toBe('#5B8FA8');
  });

  it('sets ARIA attributes on step container', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#checkoutProgressRepeater', {
      _id: 'info', id: 'info', label: 'Information', number: 1,
    });
    expect($item).not.toBeNull();

    expect($item('#progressStepContainer').accessibility.ariaLabel).toContain('Information');
    expect($item('#progressStepContainer').accessibility.ariaCurrent).toBe('step');
  });
});

// ── Order Notes ─────────────────────────────────────────────────────

describe('Checkout — #orderNotesToggle / #orderNotesField element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('collapses notes field initially', async () => {
    await loadPage();
    expect(getEl('#orderNotesField').collapse).toHaveBeenCalled();
  });

  it('sets ARIA labels on toggle and field', async () => {
    await loadPage();
    expect(getEl('#orderNotesToggle').accessibility.ariaLabel).toBe('Toggle order notes');
    expect(getEl('#orderNotesToggle').accessibility.ariaExpanded).toBe(false);
    expect(getEl('#orderNotesField').accessibility.ariaLabel).toBe('Special delivery instructions');
  });

  it('registers click handler on notes toggle', async () => {
    await loadPage();
    expect(getEl('#orderNotesToggle').onClick).toHaveBeenCalled();
  });

  it('expands notes field on toggle click', async () => {
    await loadPage();
    // Set collapsed state that the handler checks
    getEl('#orderNotesField').collapsed = true;

    const toggleHandler = getEl('#orderNotesToggle').onClick.mock.calls[0]?.[0];
    expect(toggleHandler).toBeDefined();

    toggleHandler();

    expect(getEl('#orderNotesField').expand).toHaveBeenCalled();
    expect(getEl('#orderNotesToggle').text).toBe('Hide order notes');
    expect(getEl('#orderNotesToggle').accessibility.ariaExpanded).toBe(true);
  });
});

// ── Free Shipping / Item Count ──────────────────────────────────────

describe('Checkout — #checkoutFreeShipping / #checkoutItemCount', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows remaining for free shipping when below threshold', async () => {
    await loadPage();
    const el = getEl('#checkoutFreeShipping');
    expect(el.text).toContain('$450.00');
    expect(el.show).toHaveBeenCalled();
  });

  it('shows qualifying message when above threshold', async () => {
    await loadPage({
      cart: {
        lineItems: [{ _id: 'i1', name: 'Expensive Frame', price: 1200, quantity: 1 }],
        totals: { subtotal: 1200, total: 1200 },
      },
    });
    const el = getEl('#checkoutFreeShipping');
    expect(el.text).toContain('FREE shipping');
    expect(el.show).toHaveBeenCalled();
  });

  it('sets item count text', async () => {
    await loadPage();
    expect(getEl('#checkoutItemCount').text).toBe('1 item in your order');
  });

  it('pluralizes item count for multiple items', async () => {
    await loadPage({
      cart: {
        lineItems: [
          { _id: 'i1', name: 'Frame', price: 500, quantity: 2 },
          { _id: 'i2', name: 'Mattress', price: 300, quantity: 1 },
        ],
        totals: { subtotal: 1300, total: 1300 },
      },
    });
    expect(getEl('#checkoutItemCount').text).toBe('3 items in your order');
  });
});

// ── Order Summary Sidebar ───────────────────────────────────────────

describe('Checkout — #orderSummarySidebar element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows order summary sidebar', async () => {
    await loadPage();
    expect(getEl('#orderSummarySidebar').show).toHaveBeenCalled();
  });

  it('sets subtotal, shipping, tax, and total text', async () => {
    await loadPage();
    expect(getEl('#orderSummarySubtotal').text).toBe('$549.99');
    expect(getEl('#orderSummaryShipping').text).toBe('FREE');
    expect(getEl('#orderSummaryTax').text).toBe('$38.50');
    expect(getEl('#orderSummaryTotal').text).toBe('$588.49');
  });

  it('styles total with bold font weight', async () => {
    await loadPage();
    expect(getEl('#orderSummaryTotal').style.fontWeight).toBe('bold');
  });

  it('sets ARIA label on sidebar with total', async () => {
    await loadPage();
    expect(getEl('#orderSummarySidebar').accessibility.ariaLabel).toContain('$588.49');
  });
});

// ── Express Checkout ────────────────────────────────────────────────

describe('Checkout — #expressCheckoutSection / #expressCheckoutBtn', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('styles express checkout button with coral CTA', async () => {
    await loadPage();
    const btn = getEl('#expressCheckoutBtn');
    expect(btn.style.backgroundColor).toBe('#E8845C');
    expect(btn.style.color).toBe('#fff');
  });

  it('disables express checkout button by default', async () => {
    await loadPage();
    expect(getEl('#expressCheckoutBtn').disable).toHaveBeenCalled();
  });

  it('sets ARIA label on express checkout button', async () => {
    await loadPage();
    expect(getEl('#expressCheckoutBtn').accessibility.ariaLabel).toContain('Express checkout');
  });

  it('registers click handler on express checkout button', async () => {
    await loadPage();
    expect(getEl('#expressCheckoutBtn').onClick).toHaveBeenCalled();
  });

  it('shows express checkout section', async () => {
    await loadPage();
    expect(getEl('#expressCheckoutSection').show).toHaveBeenCalled();
  });
});

// ── Delivery Estimate ───────────────────────────────────────────────

describe('Checkout — #checkoutDeliveryEstimate element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets delivery estimate text with date range', async () => {
    await loadPage();
    const el = getEl('#checkoutDeliveryEstimate');
    expect(el.text).toContain('Estimated delivery');
    expect(el.text).toContain('–');
  });

  it('sets ARIA attributes on delivery estimate', async () => {
    await loadPage();
    const el = getEl('#checkoutDeliveryEstimate');
    expect(el.accessibility.role).toBe('status');
    expect(el.accessibility.ariaLabel).toContain('Estimated delivery');
  });

  it('shows delivery estimate element', async () => {
    await loadPage();
    expect(getEl('#checkoutDeliveryEstimate').show).toHaveBeenCalled();
  });
});

// ── Order Summary Repeater Children ─────────────────────────────────

describe('Checkout — #orderSummaryItemsRepeater children', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('populates order summary items repeater', async () => {
    await loadPage();
    const repeater = getEl('#orderSummaryItemsRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('sets item name, qty, and price on repeater items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#orderSummaryItemsRepeater', {
      _id: '0', name: 'Kodiak Frame', quantity: 2, lineTotal: '1099.98',
    });
    expect($item).not.toBeNull();

    expect($item('#summaryItemName').text).toBe('Kodiak Frame');
    expect($item('#summaryItemQty').text).toBe('×2');
    expect($item('#summaryItemPrice').text).toBe('$1099.98');
  });
});
