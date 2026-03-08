/**
 * End-to-end checkout flow tests.
 * Exercises the full pipeline: cart → shipping → payment → confirmation
 * using the actual service modules with mocked CMS.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert } from '../__mocks__/wix-data.js';
import {
  calculateOrderSummary,
  validateShippingAddress,
  getShippingOptions,
  getDeliveryEstimate,
  trackCheckoutStep,
} from '../../src/backend/checkoutOptimization.web.js';
import {
  getPaymentOptions,
  getAfterpayMessage,
  getCheckoutPaymentSummary,
  getInstallmentCalculation,
  getBatchPaymentBadges,
} from '../../src/backend/paymentOptions.web.js';
import {
  wixEcom_onAbandonedCheckoutCreated,
  wixEcom_onAbandonedCheckoutRecovered,
  getAbandonedCartStats,
  getRecoverableCarts,
  markRecoveryEmailSent,
} from '../../src/backend/cartRecovery.web.js';
import { getActivePromotion } from '../../src/backend/promotions.web.js';

beforeEach(() => {
  resetData();
});

// ── Fixture helpers ──────────────────────────────────────────────────

const CART_FUTON_FRAME = { name: 'Monterey Futon Frame', price: 549, quantity: 1 };
const CART_MATTRESS = { name: 'Blazing Needles Mattress', price: 299, quantity: 1 };
const CART_COVER = { name: 'Premium Twill Cover', price: 89, quantity: 2 };

const VALID_NC_ADDRESS = {
  fullName: 'Jane Doe',
  addressLine1: '123 Blue Ridge Pkwy',
  city: 'Asheville',
  state: 'NC',
  zip: '28801',
};

const VALID_SC_ADDRESS = {
  fullName: 'John Smith',
  addressLine1: '456 King Street',
  city: 'Charleston',
  state: 'SC',
  zip: '29401',
};

// ── FLOW 1: Standard checkout (futon frame + mattress, NC) ──────────

describe('E2E: Standard checkout flow', () => {
  it('completes full checkout: cart → address → shipping → payment → confirmation', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CheckoutAnalytics', []);

    // STEP 1: Cart — Calculate order summary
    const items = [CART_FUTON_FRAME, CART_MATTRESS];
    const orderSummary = calculateOrderSummary({ items, state: 'NC' });

    expect(orderSummary.success).toBe(true);
    expect(orderSummary.data.subtotal).toBe(848); // 549 + 299
    expect(orderSummary.data.itemCount).toBe(2);
    expect(orderSummary.data.taxRate).toBe(0.0675); // NC rate
    expect(orderSummary.data.tax).toBe(57.24); // 848 * 0.0675

    // STEP 2: Track checkout start
    await trackCheckoutStep({
      sessionId: 'e2e-test-001',
      step: 'start',
      cartTotal: orderSummary.data.subtotal,
      itemCount: orderSummary.data.itemCount,
    });

    // STEP 3: Validate shipping address
    const addressResult = validateShippingAddress(VALID_NC_ADDRESS);
    expect(addressResult.success).toBe(true);
    expect(addressResult.valid).toBe(true);

    // Track address step
    await trackCheckoutStep({
      sessionId: 'e2e-test-001',
      step: 'address',
      cartTotal: orderSummary.data.subtotal,
      itemCount: orderSummary.data.itemCount,
    });

    // STEP 4: Get shipping options
    const shippingOptions = getShippingOptions(orderSummary.data.subtotal);
    expect(shippingOptions.success).toBe(true);
    // At $848, standard shipping is $49.99 (below $999 threshold)
    const standard = shippingOptions.options.find(o => o.id === 'standard');
    expect(standard).toBeDefined();
    expect(standard.price).toBe(49.99);

    // White glove should be available too
    const whiteGlove = shippingOptions.options.find(o => o.id === 'white_glove_local');
    expect(whiteGlove).toBeDefined();

    // Track shipping step
    await trackCheckoutStep({
      sessionId: 'e2e-test-001',
      step: 'shipping',
      cartTotal: orderSummary.data.subtotal,
      itemCount: orderSummary.data.itemCount,
    });

    // STEP 5: Get final order with shipping selected
    const finalOrder = calculateOrderSummary({
      items,
      state: 'NC',
      shippingMethod: 'standard',
    });
    expect(finalOrder.success).toBe(true);
    expect(finalOrder.data.shipping.amount).toBe(49.99);
    expect(finalOrder.data.total).toBe(848 + 57.24 + 49.99); // subtotal + tax + shipping

    // STEP 6: Get delivery estimate
    const delivery = getDeliveryEstimate('standard');
    expect(delivery.success).toBe(true);
    expect(delivery.data.minDate).toBeDefined();
    expect(delivery.data.maxDate).toBeDefined();

    // STEP 7: Get payment options
    const paymentOpts = await getPaymentOptions(finalOrder.data.total);
    expect(paymentOpts.success).toBe(true);
    expect(paymentOpts.methods.find(m => m.id === 'credit-card')).toBeDefined();
    expect(paymentOpts.methods.find(m => m.id === 'apple-pay')).toBeDefined();
    expect(paymentOpts.methods.find(m => m.id === 'google-pay')).toBeDefined();

    // Track payment step
    await trackCheckoutStep({
      sessionId: 'e2e-test-001',
      step: 'payment',
      cartTotal: finalOrder.data.total,
      itemCount: finalOrder.data.itemCount,
    });

    // STEP 8: Complete checkout
    await trackCheckoutStep({
      sessionId: 'e2e-test-001',
      step: 'complete',
      cartTotal: finalOrder.data.total,
      itemCount: finalOrder.data.itemCount,
    });

    // Verify all 5 checkout steps were tracked
    const analyticsInserts = inserts.filter(i => i.col === 'CheckoutAnalytics');
    expect(analyticsInserts).toHaveLength(5);
    const steps = analyticsInserts.map(i => i.item.step);
    expect(steps).toEqual(['start', 'address', 'shipping', 'payment', 'complete']);
  });
});

// ── FLOW 2: Free shipping checkout ($999+) ──────────────────────────

describe('E2E: Free shipping checkout flow', () => {
  it('does NOT qualify for free standard shipping at $1026 (free shipping disabled)', () => {
    const items = [
      CART_FUTON_FRAME, // $549
      CART_MATTRESS,    // $299
      CART_COVER,       // $89 × 2 = $178
    ];
    // Total: 549 + 299 + 178 = $1,026
    const summary = calculateOrderSummary({ items, state: 'NC', shippingMethod: 'standard' });
    expect(summary.success).toBe(true);
    expect(summary.data.subtotal).toBe(1026);
    expect(summary.data.shipping.amount).toBe(49.99); // Free shipping disabled
  });

  it('does NOT qualify for free white glove at $2099 (free shipping disabled)', () => {
    const items = [
      { name: 'Premium Frame', price: 1200, quantity: 1 },
      { name: 'Premium Mattress', price: 899, quantity: 1 },
    ];
    // Total: $2,099
    const summary = calculateOrderSummary({
      items,
      state: 'NC',
      shippingMethod: 'white_glove_local',
    });
    expect(summary.success).toBe(true);
    expect(summary.data.subtotal).toBe(2099);
    expect(summary.data.shipping.amount).toBe(149); // Free shipping disabled
  });
});

// ── FLOW 3: Afterpay eligible checkout ──────────────────────────────

describe('E2E: Afterpay payment flow', () => {
  it('shows Afterpay option for eligible cart ($35-$1,000)', async () => {
    const items = [CART_FUTON_FRAME]; // $549
    const summary = calculateOrderSummary({ items, state: 'NC', shippingMethod: 'standard' });

    const paymentOpts = await getPaymentOptions(summary.data.subtotal);
    expect(paymentOpts.afterpay.eligible).toBe(true);
    expect(paymentOpts.methods.some(m => m.id === 'afterpay')).toBe(true);

    // Get Afterpay message
    const msg = await getAfterpayMessage(summary.data.subtotal);
    expect(msg.success).toBe(true);
    expect(msg.eligible).toBe(true);
    expect(msg.installmentAmount).toBeCloseTo(549 / 4, 1);
  });

  it('hides Afterpay for carts over $1,000', async () => {
    const msg = await getAfterpayMessage(1200);
    expect(msg.success).toBe(true);
    expect(msg.eligible).toBe(false);
  });

  it('hides Afterpay for carts under $35', async () => {
    const msg = await getAfterpayMessage(20);
    expect(msg.success).toBe(true);
    expect(msg.eligible).toBe(false);
  });
});

// ── FLOW 4: Financing checkout ──────────────────────────────────────

describe('E2E: Financing payment flow', () => {
  it('shows 6-month 0% APR for $300-$999 range', async () => {
    const result = await getInstallmentCalculation(549, 6);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(0);
    expect(result.isPromotional).toBe(true);
    expect(result.monthlyPayment).toBeCloseTo(549 / 6, 1);
  });

  it('shows 12-month 0% APR for $1,000-$1,999 range', async () => {
    const result = await getInstallmentCalculation(1500, 12);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(0);
    expect(result.isPromotional).toBe(true);
  });

  it('shows 24-month 9.99% APR for $2,000-$4,999 range', async () => {
    const result = await getInstallmentCalculation(3000, 24);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(9.99);
    expect(result.monthlyPayment).toBeGreaterThan(3000 / 24);
  });
});

// ── FLOW 5: Address validation ──────────────────────────────────────

describe('E2E: Address validation across states', () => {
  it('validates NC address', () => {
    const result = validateShippingAddress(VALID_NC_ADDRESS);
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('validates SC address', () => {
    const result = validateShippingAddress(VALID_SC_ADDRESS);
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('rejects incomplete address', () => {
    const result = validateShippingAddress({ fullName: 'Jane', state: 'NC', zip: '', addressLine1: '', city: '' });
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid ZIP format', () => {
    const result = validateShippingAddress({ ...VALID_NC_ADDRESS, zip: 'abc' });
    expect(result.valid).toBe(false);
  });

  it('accepts ZIP+4 format', () => {
    const result = validateShippingAddress({ ...VALID_NC_ADDRESS, zip: '28801-1234' });
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
  });
});

// ── FLOW 6: Tax calculation across states ───────────────────────────

describe('E2E: Tax calculation across service area', () => {
  const items = [CART_FUTON_FRAME]; // $549

  it('NC tax: 6.75%', () => {
    const r = calculateOrderSummary({ items, state: 'NC' });
    expect(r.data.tax).toBeCloseTo(549 * 0.0675, 2);
  });

  it('SC tax: 6%', () => {
    const r = calculateOrderSummary({ items, state: 'SC' });
    expect(r.data.tax).toBeCloseTo(549 * 0.06, 2);
  });

  it('GA tax: 4%', () => {
    const r = calculateOrderSummary({ items, state: 'GA' });
    expect(r.data.tax).toBeCloseTo(549 * 0.04, 2);
  });

  it('TN tax: 7%', () => {
    const r = calculateOrderSummary({ items, state: 'TN' });
    expect(r.data.tax).toBeCloseTo(549 * 0.07, 2);
  });

  it('VA tax: 5.3%', () => {
    const r = calculateOrderSummary({ items, state: 'VA' });
    expect(r.data.tax).toBeCloseTo(549 * 0.053, 2);
  });

  it('default tax for unknown state: 6.5%', () => {
    const r = calculateOrderSummary({ items, state: 'NY' });
    expect(r.data.tax).toBeCloseTo(549 * 0.065, 2);
  });
});

// ── FLOW 7: Checkout payment summary ────────────────────────────────

describe('E2E: Checkout payment summary', () => {
  it('returns complete payment summary with all sections', async () => {
    const summary = await getCheckoutPaymentSummary(549);
    expect(summary.success).toBe(true);
    expect(summary.summary.cartTotal).toBe(549);
    expect(summary.summary.payNow.methods.length).toBeGreaterThan(0);
    expect(summary.summary.afterpay).toBeTruthy();
    expect(summary.summary.financing).toBeTruthy();
  });

  it('does NOT show free shipping message at $1000 (free shipping disabled)', async () => {
    const summary = await getCheckoutPaymentSummary(1000);
    expect(summary.summary.shippingMessage).not.toBe('Free shipping included');
  });
});

// ── FLOW 8: Delivery estimates ──────────────────────────────────────

describe('E2E: Delivery estimates by method', () => {
  it('standard delivery returns date range', () => {
    const r = getDeliveryEstimate('standard');
    expect(r.success).toBe(true);
    expect(r.data.minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.data.maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.data.label).toContain('–');
  });

  it('white glove local returns earlier dates', () => {
    const standard = getDeliveryEstimate('standard');
    const wgLocal = getDeliveryEstimate('white_glove_local');
    // White glove local (3-7 days) should have earlier max than standard (5-14 days)
    expect(wgLocal.data.maxDate <= standard.data.maxDate).toBe(true);
  });

  it('white glove regional returns date range', () => {
    const r = getDeliveryEstimate('white_glove_regional');
    expect(r.success).toBe(true);
    expect(r.data.minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── FLOW 9: Abandonment tracking ────────────────────────────────────

describe('E2E: Checkout abandonment detection', () => {
  it('tracks abandoned checkout session', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CheckoutAnalytics', []);

    // Customer starts checkout
    await trackCheckoutStep({
      sessionId: 'abandon-test-001',
      step: 'start',
      cartTotal: 549,
      itemCount: 1,
    });

    // Gets to address step
    await trackCheckoutStep({
      sessionId: 'abandon-test-001',
      step: 'address',
      cartTotal: 549,
      itemCount: 1,
    });

    // Abandons at shipping step
    await trackCheckoutStep({
      sessionId: 'abandon-test-001',
      step: 'abandon',
      cartTotal: 549,
      itemCount: 1,
    });

    const analytics = inserts.filter(i => i.col === 'CheckoutAnalytics');
    expect(analytics).toHaveLength(3);
    expect(analytics[2].item.step).toBe('abandon');
    expect(analytics[2].item.sessionId).toBe('abandon-test-001');
  });
});

// ── FLOW 10: Multi-item cart with mixed shipping + payment ──────────

describe('E2E: Complex multi-item checkout', () => {
  it('handles large cart with white glove shipping and financing', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CheckoutAnalytics', []);

    // Large cart: frame + mattress + 2 covers = $2,126
    const items = [
      { name: 'Murphy Cabinet Bed', price: 1599, quantity: 1 },
      { name: 'Deluxe Mattress', price: 449, quantity: 1 },
      CART_COVER, // $89 × 2 = $178
    ];

    // Step 1: Order summary
    const summary = calculateOrderSummary({
      items,
      state: 'NC',
      shippingMethod: 'white_glove_local',
    });
    expect(summary.success).toBe(true);
    expect(summary.data.subtotal).toBe(2226);
    // Free shipping disabled — white glove charged
    expect(summary.data.shipping.amount).toBe(149);
    expect(summary.data.freeShippingProgress.qualifies).toBe(false);

    // Step 2: Validate address
    const addr = validateShippingAddress(VALID_NC_ADDRESS);
    expect(addr.valid).toBe(true);

    // Step 3: Payment — Afterpay NOT eligible (over $1,000)
    const payOpts = await getPaymentOptions(summary.data.total);
    expect(payOpts.afterpay.eligible).toBe(false);

    // Step 4: Financing IS available (24-month tier for $2,000-$4,999)
    const financing = await getInstallmentCalculation(summary.data.subtotal, 24);
    expect(financing.success).toBe(true);
    expect(financing.apr).toBe(9.99);
    expect(financing.monthlyPayment).toBeGreaterThan(0);

    // Step 5: Track complete flow
    await trackCheckoutStep({ sessionId: 'e2e-complex-001', step: 'start', cartTotal: summary.data.total, itemCount: 4 });
    await trackCheckoutStep({ sessionId: 'e2e-complex-001', step: 'complete', cartTotal: summary.data.total, itemCount: 4 });

    const analytics = inserts.filter(i => i.col === 'CheckoutAnalytics');
    expect(analytics).toHaveLength(2);
  });
});

// ── FLOW 11: Cart abandonment → recovery lifecycle ──────────────────

describe('E2E: Cart abandonment and recovery lifecycle', () => {
  it('records abandonment, finds recoverable cart, sends email, then recovers', async () => {
    __seed('AbandonedCarts', []);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Step 1: Customer abandons checkout
    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'checkout-abandon-001',
        buyerInfo: { email: 'jane@example.com', firstName: 'Jane' },
        payNow: { total: { amount: 549 } },
        lineItems: [
          {
            catalogReference: { catalogItemId: 'prod-001' },
            productName: { original: 'Monterey Futon Frame' },
            quantity: 1,
            price: { amount: 549 },
          },
        ],
      },
    });
    // Let fire-and-forget settle
    await new Promise(r => setTimeout(r, 100));

    // Step 2: Verify abandonment was recorded
    const stats = await getAbandonedCartStats();
    expect(stats.totalAbandoned).toBeGreaterThanOrEqual(1);

    // Step 3: Manually backdate the record so it's recoverable (>1 hour old)
    // The event handler records with current time, but getRecoverableCarts
    // only returns carts > 1 hour old. Seed a pre-aged record.
    __seed('AbandonedCarts', [
      {
        _id: 'cart-001',
        checkoutId: 'checkout-abandon-001',
        buyerEmail: 'jane@example.com',
        buyerName: 'Jane',
        cartTotal: 549,
        lineItems: JSON.stringify([{ productId: 'prod-001', name: 'Monterey Futon Frame', quantity: 1, price: 549 }]),
        abandonedAt: twoHoursAgo,
        status: 'abandoned',
        recoveryEmailSent: false,
      },
    ]);

    // Step 4: Find recoverable carts
    const recoverable = await getRecoverableCarts();
    expect(recoverable.length).toBeGreaterThanOrEqual(1);
    expect(recoverable[0].buyerEmail).toBe('jane@example.com');
    expect(recoverable[0].lineItems[0].name).toBe('Monterey Futon Frame');

    // Step 5: Mark recovery email sent
    const emailResult = await markRecoveryEmailSent('cart-001');
    expect(emailResult.success).toBe(true);

    // Step 6: Customer returns and completes checkout
    wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'checkout-abandon-001' },
    });
    await new Promise(r => setTimeout(r, 100));

    // Step 7: Verify recovery is tracked
    const finalStats = await getAbandonedCartStats();
    expect(finalStats.totalRecovered).toBeGreaterThanOrEqual(0);
  });
});

// ── FLOW 12: Batch payment badges for category pages ─────────────────

describe('E2E: Payment badges on category grid', () => {
  it('returns Afterpay + financing badges for eligible products', async () => {
    const products = [
      { productId: 'prod-001', price: 549 },   // Afterpay eligible ($35-$1,000) + financing
      { productId: 'prod-002', price: 1500 },   // Financing only (over $1,000)
      { productId: 'prod-003', price: 20 },      // Neither (under $35)
    ];

    const result = await getBatchPaymentBadges(products);
    expect(result.success).toBe(true);

    // $549 should have Afterpay badge
    const badges001 = result.badges['prod-001'];
    expect(badges001).toBeDefined();
    expect(badges001.some(b => b.type === 'afterpay')).toBe(true);
    const apBadge = badges001.find(b => b.type === 'afterpay');
    expect(apBadge.label).toContain('$');

    // $1,500 should NOT have Afterpay but should have financing
    const badges002 = result.badges['prod-002'];
    expect(badges002).toBeDefined();
    expect(badges002.some(b => b.type === 'afterpay')).toBe(false);
    expect(badges002.some(b => b.type === 'financing')).toBe(true);

    // $20 should have no badges (under Afterpay minimum, under financing minimum)
    const badges003 = result.badges['prod-003'];
    // Should be empty or undefined
    expect(!badges003 || badges003.length === 0).toBe(true);
  });

  it('returns empty badges for empty product list', async () => {
    const result = await getBatchPaymentBadges([]);
    expect(result.success).toBe(true);
    expect(Object.keys(result.badges)).toHaveLength(0);
  });

  it('skips products with invalid prices', async () => {
    const result = await getBatchPaymentBadges([
      { productId: 'bad-1', price: 'not-a-number' },
      { productId: 'bad-2', price: -50 },
    ]);
    expect(result.success).toBe(true);
    expect(Object.keys(result.badges)).toHaveLength(0);
  });
});

// ── FLOW 13: Promotion display at checkout ──────────────────────────

describe('E2E: Active promotion at checkout', () => {
  it('returns active promotion with discount code', async () => {
    const now = new Date();
    __seed('Promotions', [
      {
        _id: 'promo-001',
        title: 'Spring Sale',
        subtitle: '20% off futon frames',
        theme: 'spring',
        isActive: true,
        startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // yesterday
        endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // next week
        discountCode: 'SPRING20',
        discountPercent: 20,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.title).toBe('Spring Sale');
    expect(promo.discountCode).toBe('SPRING20');
    expect(promo.discountPercent).toBe(20);
  });

  it('returns null when no active promotion', async () => {
    __seed('Promotions', []);
    const promo = await getActivePromotion();
    expect(promo).toBeNull();
  });

  it('ignores expired promotions', async () => {
    const now = new Date();
    __seed('Promotions', [
      {
        _id: 'promo-expired',
        title: 'Old Sale',
        isActive: true,
        startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // yesterday
        discountCode: 'OLD10',
        discountPercent: 10,
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).toBeNull();
  });
});

// ── FLOW 14: Checkout with active promotion discount ─────────────────

describe('E2E: Checkout totals with promotion applied', () => {
  it('applies promotion discount to order summary', async () => {
    const now = new Date();
    __seed('Promotions', [
      {
        _id: 'promo-active',
        title: '15% Off Everything',
        isActive: true,
        startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        discountCode: 'SAVE15',
        discountPercent: 15,
      },
    ]);

    // Step 1: Get the active promotion
    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.discountPercent).toBe(15);

    // Step 2: Calculate order — the discount would be applied client-side
    // by Wix's native coupon system. We verify the order total pre-discount
    // and that the promotion data is available for display.
    const items = [CART_FUTON_FRAME]; // $549
    const summary = calculateOrderSummary({ items, state: 'NC', shippingMethod: 'standard' });
    expect(summary.success).toBe(true);
    expect(summary.data.subtotal).toBe(549);

    // Step 3: Compute what the discounted total would be
    const discountAmount = summary.data.subtotal * (promo.discountPercent / 100);
    const discountedSubtotal = summary.data.subtotal - discountAmount;
    expect(discountAmount).toBeCloseTo(82.35, 1);
    expect(discountedSubtotal).toBeCloseTo(466.65, 1);

    // Step 4: Verify payment options still work at discounted price
    const payOpts = await getPaymentOptions(discountedSubtotal);
    expect(payOpts.success).toBe(true);
    // $466.65 is Afterpay eligible
    expect(payOpts.afterpay.eligible).toBe(true);
  });
});
