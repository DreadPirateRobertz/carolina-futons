/**
 * Tests for Cart Page element hookup — CF-03jx
 * Covers: #cartFinancingSection, #financingThreshold, #cartFinancingTeaser,
 * #cartAfterpayMessage — show/hide states, threshold messaging, edge cases
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
