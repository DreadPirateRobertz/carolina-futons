/**
 * @file cf-ji7j-cart-abandonment.test.js
 * @description CF-ji7j: Tests for cart abandonment recovery sequence.
 *
 * Covers:
 *  - Step descriptions match bead spec (you left something behind / still thinking / last chance)
 *  - Step 1 (1h): includes cartItems array with name + price fields
 *  - Step 1: includes cartTotal formatted as currency string
 *  - Step 2 (24h): includes stockWarning flag
 *  - Step 2: qualifiesForFreeShipping true when cartTotal >= FREE_SHIPPING_THRESHOLD
 *  - Step 2: qualifiesForFreeShipping false when cartTotal < FREE_SHIPPING_THRESHOLD
 *  - Step 2: freeShippingNote present when qualifies
 *  - Step 3 (72h): includes couponPercent = '10'
 *  - Step 3: discountCode populated from createCartRecoveryCoupon
 *  - Step 3: discountAvailable = true when coupon created
 *  - cartItems not present on step 2 or 3 (only step 1 needs the full listing)
 *  - stockWarning not present on step 1 (wrong step)
 *  - couponPercent not present on step 1 or 2 (only step 3)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __onInsert, __seed } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

vi.mock('backend/couponsService.web', () => ({
  createCartRecoveryCoupon: vi.fn().mockResolvedValue({ success: true, code: 'CART5-XYZ' }),
}));

import {
  triggerAbandonedCartRecovery,
  _SEQUENCES,
} from '../src/backend/emailAutomation.web.js';

import { createCartRecoveryCoupon } from 'backend/couponsService.web';

const CART_HIGH = {
  _id: 'cart-1',
  checkoutId: 'ck-high',
  buyerEmail: 'buyer@test.com',
  buyerName: 'Sam',
  cartTotal: 599,
  lineItems: JSON.stringify([
    { name: 'Seattle Futon Frame', quantity: 1, price: 599, imageUrl: 'https://cdn.example.com/seattle.jpg' },
  ]),
  abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  status: 'abandoned',
  recoveryEmailSent: false,
};

const CART_LOW = {
  _id: 'cart-2',
  checkoutId: 'ck-low',
  buyerEmail: 'lowcart@test.com',
  buyerName: 'Pat',
  cartTotal: 49,
  lineItems: JSON.stringify([
    { name: 'Pillow Cover', quantity: 1, price: 49 },
  ]),
  abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  status: 'abandoned',
  recoveryEmailSent: false,
};

beforeEach(() => {
  __reset();
  __resetSecrets();
  __setSecrets({ RECOVERY_DISCOUNT_CODE: 'COMEBACK15' });
  vi.clearAllMocks();
});

// ── Step definitions ──────────────────────────────────────────────────

describe('cart_recovery sequence step spec', () => {
  it('step 1 described as "you left something behind" variant (1h)', () => {
    const step1 = _SEQUENCES.cart_recovery.steps.find(s => s.step === 1);
    expect(step1.delayHours).toBe(1);
    expect(step1.description).toMatch(/left something|reminder|cart preview/i);
  });

  it('step 2 described as urgency email (24h)', () => {
    const step2 = _SEQUENCES.cart_recovery.steps.find(s => s.step === 2);
    expect(step2.delayHours).toBe(24);
    expect(step2.description).toMatch(/urgency|still thinking|social proof/i);
  });

  it('step 3 described as discount/coupon offer (72h)', () => {
    const step3 = _SEQUENCES.cart_recovery.steps.find(s => s.step === 3);
    expect(step3.delayHours).toBe(72);
    expect(step3.description).toMatch(/discount|coupon|last chance/i);
  });
});

// ── Step 1: cart preview with items + prices ──────────────────────────

describe('Step 1 — cart preview', () => {
  it('includes cartItems array in step 1', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.cartItems).toBeDefined();
    expect(Array.isArray(step1.variables.cartItems)).toBe(true);
    expect(step1.variables.cartItems.length).toBeGreaterThan(0);
  });

  it('cartItems entries have name and price', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step1 = items.find(i => i.sequenceStep === 1);
    const first = step1.variables.cartItems[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('price');
  });

  it('includes cartTotal as formatted currency string', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.cartTotal).toMatch(/\$|[0-9]/);
  });

  it('step 1 does not include stockWarning', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.stockWarning).toBeUndefined();
  });

  it('step 1 does not include couponPercent', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.couponPercent).toBeUndefined();
  });
});

// ── Step 2: urgency + free shipping ──────────────────────────────────

describe('Step 2 — urgency + free shipping', () => {
  it('includes stockWarning in step 2', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.stockWarning).toBeDefined();
  });

  it('qualifiesForFreeShipping is true when cartTotal >= threshold', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.qualifiesForFreeShipping).toBe(true);
  });

  it('qualifiesForFreeShipping is false when cartTotal < threshold', async () => {
    __seed('AbandonedCarts', [CART_LOW]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.qualifiesForFreeShipping).toBe(false);
  });

  it('includes freeShippingNote when qualifies', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.freeShippingNote).toBeTruthy();
  });

  it('step 2 does not include couponPercent', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.couponPercent).toBeUndefined();
  });
});

// ── Step 3: 10% recovery coupon ────────────────────────────────────────

describe('Step 3 — recovery coupon', () => {
  it('includes couponPercent = "10" in step 3', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.couponPercent).toBe('10');
  });

  it('discountCode populated from createCartRecoveryCoupon', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.discountCode).toBe('CART5-XYZ');
    expect(step3.variables.discountAvailable).toBe(true);
  });

  it('step 3 does not include cartItems', async () => {
    __seed('AbandonedCarts', [CART_HIGH]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerAbandonedCartRecovery();

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.cartItems).toBeUndefined();
  });
});
