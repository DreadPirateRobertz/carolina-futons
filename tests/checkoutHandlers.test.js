/**
 * Tests for pages/Checkout.js — page-level handler coverage.
 * Covers: initPageSeo, collapseOnMobile, initBackToTop, trust signals,
 * order notes, delivery estimate, checkout progress, free shipping,
 * trackCheckoutStart, fireInitiateCheckout, order summary sidebar,
 * express checkout init, protection plan section, store credit, gift card.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '', backgroundColor: '', borderColor: '' },
    accessibility: {},
    hidden: false, collapsed: false, checked: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(), onBlur: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
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
  getCurrentCart: vi.fn(() => Promise.resolve({
    totals: { subtotal: 500 },
    lineItems: [{ name: 'Futon', price: 500, quantity: 1, productId: 'p1' }],
  })),
  FREE_SHIPPING_THRESHOLD: 999,
  getShippingProgress: vi.fn(() => ({ remaining: 499 })),
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
    success: '#28a745',
    error: '#dc3545',
    mountainBlue: '#4A7C8B',
    sandDark: '#C2B59B',
    mutedBrown: '#8B7355',
    sunsetCoral: '#E8725C',
    espresso: '#3E2723',
    white: '#FFFFFF',
  },
}));

vi.mock('public/cartStyles.js', () => ({
  getCheckoutButtonStyles: vi.fn(() => ({ background: '#E8725C', textColor: '#fff' })),
}));

vi.mock('public/checkoutProgress.js', () => ({
  getCheckoutSteps: vi.fn(() => [
    { id: 'info', number: 1, label: 'Information' },
    { id: 'shipping', number: 2, label: 'Shipping' },
  ]),
  getStepAriaAttributes: vi.fn(() => ({
    state: 'active', ariaLabel: 'Step 1', ariaCurrent: 'step',
  })),
}));

vi.mock('public/checkoutValidation.js', () => ({
  validateAddressField: vi.fn(() => ({ valid: true })),
  getFieldValidationState: vi.fn(() => 'valid'),
  applyAutocompleteHints: vi.fn(),
}));

vi.mock('backend/paymentOptions.web', () => ({
  getCheckoutPaymentSummary: vi.fn(() => Promise.resolve({
    success: true,
    summary: {
      payNow: { methods: [{ id: 'credit-card', name: 'Credit Card', brands: ['Visa'] }] },
      afterpay: null,
      financing: null,
      shippingMessage: '',
    },
  })),
}));

vi.mock('backend/checkoutOptimization.web', () => ({
  validateShippingAddress: vi.fn(),
  getShippingOptions: vi.fn(() => Promise.resolve({
    success: true,
    options: [{
      id: 'standard', label: 'Standard', price: 0,
      description: 'Free', estimatedDays: { min: 5, max: 10 },
    }],
  })),
  getDeliveryEstimate: vi.fn(),
  calculateOrderSummary: vi.fn(() => Promise.resolve({
    success: true,
    data: { subtotal: 500, shipping: { amount: 0 }, tax: 35, total: 535, savings: 0, itemCount: 1 },
  })),
  getExpressCheckoutSummary: vi.fn(),
}));

vi.mock('backend/protectionPlan.web', () => ({
  getProtectionPlans: vi.fn(() => Promise.resolve({ success: true, plans: [] })),
  addProtectionPlan: vi.fn(),
  removeProtectionPlan: vi.fn(),
  PLAN_TIERS: {},
}));

vi.mock('public/storeCreditHelpers.js', () => ({
  initCheckoutStoreCredit: vi.fn(() => Promise.resolve({ available: false })),
  formatCreditBalance: vi.fn(() => '$0'),
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
  onBeforeUnload: vi.fn(),
}));

// ── Import after mocks ─────────────────────────────────────────────

import { trackCheckoutStart } from 'public/engagementTracker';
import { fireInitiateCheckout } from 'public/ga4Tracking';
import { getCurrentCart, getShippingProgress } from 'public/cartService';
import { collapseOnMobile, initBackToTop } from 'public/mobileHelpers';
import { applyFocusRing } from 'public/a11yHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';
import { getCheckoutSteps, getStepAriaAttributes } from 'public/checkoutProgress.js';
import { getShippingOptions, calculateOrderSummary } from 'backend/checkoutOptimization.web';
import { getCheckoutPaymentSummary } from 'backend/paymentOptions.web';
import { getProtectionPlans } from 'backend/protectionPlan.web';
import { initCheckoutStoreCredit } from 'public/storeCreditHelpers.js';
import { initCheckoutGiftCard, resetCheckoutGiftCard } from 'public/giftCardHelpers.js';
import { applyAutocompleteHints } from 'public/checkoutValidation.js';
import { getCheckoutButtonStyles } from 'public/cartStyles.js';

describe('Checkout Page Handlers', () => {
  beforeEach(() => {
    elements.clear();
    onReadyHandler = null;
    vi.clearAllMocks();
  });

  async function loadAndRun() {
    // Re-import to re-trigger $w.onReady registration
    vi.resetModules();

    // Re-register mocks cleared by resetModules — done via dynamic import
    // Since vi.mock is hoisted, they persist. Just re-import the page.
    await import('../src/pages/Checkout.js');

    expect(onReadyHandler).toBeTruthy();
    await onReadyHandler();
  }

  // ── 1. initPageSeo ──────────────────────────────────────────────────

  describe('Page initialization', () => {
    it('calls initPageSeo with "checkout"', async () => {
      await loadAndRun();
      expect(initPageSeo).toHaveBeenCalledWith('checkout');
    });

    it('calls collapseOnMobile with correct selectors', async () => {
      await loadAndRun();
      expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#checkoutFinancing', '#expressCheckoutSection']);
    });

    it('calls initBackToTop', async () => {
      await loadAndRun();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('runs all 10 section inits via Promise.allSettled without throwing', async () => {
      await loadAndRun();
      // If we got here without error, allSettled handled everything
      expect(initPageSeo).toHaveBeenCalled();
    });
  });

  // ── 4. Trust Signals ───────────────────────────────────────────────

  describe('Trust signals', () => {
    it('sets repeater data with trust messages', async () => {
      await loadAndRun();
      const repeater = getEl('#trustRepeater');
      expect(repeater.data.length).toBeGreaterThanOrEqual(3);
      expect(repeater.data[0]).toHaveProperty('text');
      expect(repeater.data[0]).toHaveProperty('icon');
    });

    it('registers onItemReady on trust repeater', async () => {
      await loadAndRun();
      const repeater = getEl('#trustRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('trust onItemReady sets text on trustText element', async () => {
      await loadAndRun();
      const repeater = getEl('#trustRepeater');
      const handler = repeater.onItemReady.mock.calls[0][0];
      const mockItem = createMockElement();
      const $item = (sel) => {
        if (!mockItem._children) mockItem._children = new Map();
        if (!mockItem._children.has(sel)) mockItem._children.set(sel, createMockElement());
        return mockItem._children.get(sel);
      };
      handler($item, { text: 'Secure SSL Checkout', icon: 'lock' });
      expect($item('#trustText').text).toBe('Secure SSL Checkout');
    });
  });

  // ── 5. Order Notes ─────────────────────────────────────────────────

  describe('Order notes', () => {
    it('collapses orderNotesField on init', async () => {
      await loadAndRun();
      const notesField = getEl('#orderNotesField');
      expect(notesField.collapse).toHaveBeenCalled();
      expect(notesField.collapsed).toBe(true);
    });

    it('sets ARIA attributes on toggle', async () => {
      await loadAndRun();
      const toggle = getEl('#orderNotesToggle');
      expect(toggle.accessibility.ariaLabel).toBe('Toggle order notes');
      expect(toggle.accessibility.ariaExpanded).toBe(false);
    });

    it('registers onClick on order notes toggle', async () => {
      await loadAndRun();
      const toggle = getEl('#orderNotesToggle');
      expect(toggle.onClick).toHaveBeenCalled();
    });

    it('toggle click expands collapsed notes field', async () => {
      await loadAndRun();
      const toggle = getEl('#orderNotesToggle');
      const notesField = getEl('#orderNotesField');

      // notesField is collapsed after init
      expect(notesField.collapsed).toBe(true);

      // Simulate click
      const clickHandler = toggle.onClick.mock.calls[0][0];
      clickHandler();

      expect(notesField.expand).toHaveBeenCalled();
      expect(toggle.text).toBe('Hide order notes');
      expect(toggle.accessibility.ariaExpanded).toBe(true);
    });

    it('toggle click collapses expanded notes field', async () => {
      await loadAndRun();
      const toggle = getEl('#orderNotesToggle');
      const notesField = getEl('#orderNotesField');

      // Expand first
      const clickHandler = toggle.onClick.mock.calls[0][0];
      clickHandler();
      expect(notesField.collapsed).toBe(false);

      // Click again to collapse
      clickHandler();
      expect(notesField.collapse).toHaveBeenCalledTimes(2); // init + second click
      expect(toggle.text).toBe('Add order notes');
      expect(toggle.accessibility.ariaExpanded).toBe(false);
    });
  });

  // ── 6. Delivery Estimate ──────────────────────────────────────────

  describe('Delivery estimate', () => {
    it('sets estimated delivery text with date range', async () => {
      await loadAndRun();
      const el = getEl('#checkoutDeliveryEstimate');
      expect(el.text).toMatch(/^Estimated delivery:/);
      expect(el.text).toMatch(/–/); // en-dash between dates
    });

    it('sets ARIA role status on delivery estimate', async () => {
      await loadAndRun();
      const el = getEl('#checkoutDeliveryEstimate');
      expect(el.accessibility.role).toBe('status');
    });

    it('sets ariaLabel matching text', async () => {
      await loadAndRun();
      const el = getEl('#checkoutDeliveryEstimate');
      expect(el.accessibility.ariaLabel).toBe(el.text);
    });

    it('calls show on delivery estimate element', async () => {
      await loadAndRun();
      const el = getEl('#checkoutDeliveryEstimate');
      expect(el.show).toHaveBeenCalled();
    });
  });

  // ── 7. Checkout Progress ──────────────────────────────────────────

  describe('Checkout progress', () => {
    it('sets repeater data from getCheckoutSteps', async () => {
      await loadAndRun();
      const repeater = getEl('#checkoutProgressRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0]._id).toBe('info');
      expect(repeater.data[1]._id).toBe('shipping');
    });

    it('registers onItemReady on progress repeater', async () => {
      await loadAndRun();
      const repeater = getEl('#checkoutProgressRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('sets ARIA navigation role on progressNav', async () => {
      await loadAndRun();
      const nav = getEl('#checkoutProgressNav');
      expect(nav.accessibility.role).toBe('navigation');
      expect(nav.accessibility.ariaLabel).toBe('Checkout progress');
    });
  });

  // ── 8. Free Shipping ─────────────────────────────────────────────

  describe('Free shipping messaging', () => {
    it('shows "add more" message when subtotal below threshold', async () => {
      await loadAndRun();
      const el = getEl('#checkoutFreeShipping');
      // subtotal=500, threshold=999, remaining=499
      expect(el.text).toContain('499');
      expect(el.text).toContain('free shipping');
      expect(el.show).toHaveBeenCalled();
    });

    it('shows qualifying message when subtotal >= threshold', async () => {
      getCurrentCart.mockResolvedValueOnce({
        totals: { subtotal: 1200 },
        lineItems: [{ name: 'Sofa', price: 1200, quantity: 1, productId: 'p2' }],
      });
      await loadAndRun();
      const el = getEl('#checkoutFreeShipping');
      expect(el.text).toContain('qualifies for FREE shipping');
      expect(el.show).toHaveBeenCalled();
    });
  });

  // ── 9 & 10. Engagement & GA4 Tracking ────────────────────────────

  describe('Checkout tracking', () => {
    it('calls trackCheckoutStart with subtotal and item count', async () => {
      await loadAndRun();
      expect(trackCheckoutStart).toHaveBeenCalledWith(500, 1);
    });

    it('calls fireInitiateCheckout with line items and subtotal', async () => {
      await loadAndRun();
      expect(fireInitiateCheckout).toHaveBeenCalledWith(
        [{ name: 'Futon', price: 500, quantity: 1, productId: 'p1' }],
        500,
      );
    });
  });

  // ── Order Summary Sidebar ──────────────────────────────────────────

  describe('Order summary sidebar', () => {
    it('calls calculateOrderSummary', async () => {
      await loadAndRun();
      expect(calculateOrderSummary).toHaveBeenCalled();
    });

    it('shows sidebar after loading', async () => {
      await loadAndRun();
      const sidebar = getEl('#orderSummarySidebar');
      expect(sidebar.show).toHaveBeenCalled();
    });
  });

  // ── Express Checkout ───────────────────────────────────────────────

  describe('Express checkout', () => {
    it('disables express checkout button initially', async () => {
      await loadAndRun();
      const btn = getEl('#expressCheckoutBtn');
      expect(btn.disable).toHaveBeenCalled();
    });

    it('styles express checkout button with coral CTA', async () => {
      await loadAndRun();
      const btn = getEl('#expressCheckoutBtn');
      expect(btn.style.backgroundColor).toBe('#E8725C');
      expect(btn.style.color).toBe('#fff');
    });

    it('shows express checkout section', async () => {
      await loadAndRun();
      const section = getEl('#expressCheckoutSection');
      expect(section.show).toHaveBeenCalled();
    });
  });

  // ── Focus Indicators ──────────────────────────────────────────────

  describe('Focus indicators', () => {
    it('applies focus ring to interactive checkout elements', async () => {
      await loadAndRun();
      // initCheckoutFocusIndicators applies to 9 elements
      expect(applyFocusRing).toHaveBeenCalled();
      const calls = applyFocusRing.mock.calls.map(c => c[0]);
      // Verify a subset of known IDs were passed
      expect(calls).toContainEqual(getEl('#validateAddressBtn'));
      expect(calls).toContainEqual(getEl('#expressCheckoutBtn'));
    });
  });

  // ── Gift Card & Store Credit ──────────────────────────────────────

  describe('Gift card section', () => {
    it('calls initCheckoutGiftCard', async () => {
      await loadAndRun();
      expect(initCheckoutGiftCard).toHaveBeenCalled();
    });
  });

  describe('Store credit section', () => {
    it('calls initCheckoutStoreCredit', async () => {
      await loadAndRun();
      expect(initCheckoutStoreCredit).toHaveBeenCalled();
    });
  });

  // ── Payment Options ───────────────────────────────────────────────

  describe('Payment options', () => {
    it('calls getCheckoutPaymentSummary', async () => {
      await loadAndRun();
      expect(getCheckoutPaymentSummary).toHaveBeenCalled();
    });

    it('sets payment methods repeater data', async () => {
      await loadAndRun();
      const repeater = getEl('#paymentMethodsRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0]._id).toBe('credit-card');
    });
  });

  // ── Shipping Options ──────────────────────────────────────────────

  describe('Shipping options', () => {
    it('calls getShippingOptions', async () => {
      await loadAndRun();
      expect(getShippingOptions).toHaveBeenCalled();
    });

    it('sets shipping options repeater data', async () => {
      await loadAndRun();
      const repeater = getEl('#shippingOptionsRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0]._id).toBe('standard');
    });
  });

  // ── Address Validation ────────────────────────────────────────────

  describe('Address validation', () => {
    it('applies autocomplete hints', async () => {
      await loadAndRun();
      expect(applyAutocompleteHints).toHaveBeenCalledWith($w);
    });

    it('styles validate button with checkout CTA colors', async () => {
      await loadAndRun();
      const btn = getEl('#validateAddressBtn');
      expect(btn.style.backgroundColor).toBe('#E8725C');
      expect(btn.style.color).toBe('#fff');
    });
  });
});
