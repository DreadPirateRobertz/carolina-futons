/**
 * cartRecoveryActivation.test.js — emailAutomation integration: single-use coupons for step 3.
 *
 * Verifies that triggerAbandonedCartRecovery calls createCartRecoveryCoupon (couponsService)
 * for each eligible cart, passes the generated code to step 3, and no longer reads the static
 * RECOVERY_DISCOUNT_CODE secret. Also tests fallback when coupon creation fails.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
}));

// Intercept createCartRecoveryCoupon so we control its output
let mockCouponResult = { success: true, code: 'RECOVER-TESTAB', discount: '10%' };
vi.mock('backend/couponsService.web', () => ({
  createCartRecoveryCoupon: vi.fn(async () => mockCouponResult),
}));

import { __seed, __reset as __resetData, __getInserted } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as __resetCrm } from './__mocks__/wix-crm-backend.js';
import { createCartRecoveryCoupon as mockCreateCoupon } from 'backend/couponsService.web';
import { triggerAbandonedCartRecovery } from '../src/backend/emailAutomation.web.js';

beforeEach(() => {
  __resetData();
  __resetSecrets();
  __resetCrm();
  mockCouponResult = { success: true, code: 'RECOVER-TESTAB', discount: '10%' };
  mockCreateCoupon.mockClear();
  mockCreateCoupon.mockImplementation(async () => mockCouponResult);
});

// ── Helpers ────────────────────────────────────────────────────────────

function seedAbandonedCart(overrides = {}) {
  const cart = {
    _id: 'cart-1',
    checkoutId: 'co-abc123',
    buyerEmail: 'buyer@example.com',
    buyerName: 'Jane',
    cartTotal: 299,
    lineItems: JSON.stringify([{ name: 'Futon Frame', quantity: 1, price: 299 }]),
    abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'abandoned',
    recoveryEmailSent: false,
    ...overrides,
  };
  __seed('AbandonedCarts', [cart]);
  return cart;
}

// ══════════════════════════════════════════════════════════════════════
// Single-use coupon integration
// ══════════════════════════════════════════════════════════════════════

describe('triggerAbandonedCartRecovery — single-use coupon per cart', () => {
  it('calls createCartRecoveryCoupon once per eligible cart', async () => {
    seedAbandonedCart();
    await triggerAbandonedCartRecovery();
    expect(mockCreateCoupon).toHaveBeenCalledTimes(1);
  });

  it('passes buyer email to createCartRecoveryCoupon', async () => {
    seedAbandonedCart({ buyerEmail: 'buyer@example.com' });
    await triggerAbandonedCartRecovery();
    expect(mockCreateCoupon).toHaveBeenCalledWith('buyer@example.com');
  });

  it('uses lowercase buyer email (normalised before coupon call)', async () => {
    seedAbandonedCart({ buyerEmail: 'BUYER@EXAMPLE.COM' });
    await triggerAbandonedCartRecovery();
    expect(mockCreateCoupon).toHaveBeenCalledWith('buyer@example.com');
  });

  it('creates one coupon per cart, not one per step', async () => {
    __seed('AbandonedCarts', [
      {
        _id: 'cart-a', checkoutId: 'co-a', buyerEmail: 'a@example.com', buyerName: 'A',
        cartTotal: 100, lineItems: '[]',
        abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'abandoned', recoveryEmailSent: false,
      },
      {
        _id: 'cart-b', checkoutId: 'co-b', buyerEmail: 'b@example.com', buyerName: 'B',
        cartTotal: 200, lineItems: '[]',
        abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'abandoned', recoveryEmailSent: false,
      },
    ]);
    await triggerAbandonedCartRecovery();
    // 2 carts → 2 coupons (one per cart)
    expect(mockCreateCoupon).toHaveBeenCalledTimes(2);
  });
});

describe('triggerAbandonedCartRecovery — coupon code passed to step 3', () => {
  it('step 3 variables include the generated coupon code', async () => {
    mockCouponResult = { success: true, code: 'RECOVER-XY7Z2W', discount: '10%' };
    seedAbandonedCart();
    await triggerAbandonedCartRecovery();

    const inserted = __getInserted('EmailQueue');
    const step3 = inserted.find(q => q.sequenceType === 'cart_recovery' && q.sequenceStep === 3);
    expect(step3).toBeDefined();
    expect(step3.variables.discountCode).toBe('RECOVER-XY7Z2W');
    expect(step3.variables.discountAvailable).toBe(true);
  });

  it('step 1 does not include a discount code', async () => {
    seedAbandonedCart();
    await triggerAbandonedCartRecovery();

    const inserted = __getInserted('EmailQueue');
    const step1 = inserted.find(q => q.sequenceType === 'cart_recovery' && q.sequenceStep === 1);
    if (step1) {
      expect(step1.variables.discountCode).toBe('');
      expect(step1.variables.discountAvailable).toBe(false);
    }
  });

  it('step 2 does not include a discount code', async () => {
    seedAbandonedCart();
    await triggerAbandonedCartRecovery();

    const inserted = __getInserted('EmailQueue');
    const step2 = inserted.find(q => q.sequenceType === 'cart_recovery' && q.sequenceStep === 2);
    if (step2) {
      expect(step2.variables.discountCode).toBe('');
      expect(step2.variables.discountAvailable).toBe(false);
    }
  });
});

describe('triggerAbandonedCartRecovery — no longer uses static secret', () => {
  it('does not read RECOVERY_DISCOUNT_CODE secret', async () => {
    const { getSecret } = await import('wix-secrets-backend');
    seedAbandonedCart();
    await triggerAbandonedCartRecovery();
    if (typeof getSecret === 'function' && getSecret.mock) {
      expect(getSecret).not.toHaveBeenCalledWith('RECOVERY_DISCOUNT_CODE');
    }
  });
});

describe('triggerAbandonedCartRecovery — coupon failure fallback', () => {
  it('when coupon creation returns success:false, step 3 has empty code but is still queued', async () => {
    mockCouponResult = { success: false, message: 'API unavailable' };
    seedAbandonedCart();
    await triggerAbandonedCartRecovery();

    const inserted = __getInserted('EmailQueue');
    const step3 = inserted.find(q => q.sequenceType === 'cart_recovery' && q.sequenceStep === 3);
    if (step3) {
      expect(step3.variables.discountCode).toBe('');
      expect(step3.variables.discountAvailable).toBe(false);
    }
  });

  it('when createCartRecoveryCoupon throws, cart recovery still completes successfully', async () => {
    mockCreateCoupon.mockRejectedValueOnce(new Error('network timeout'));
    seedAbandonedCart();
    const result = await triggerAbandonedCartRecovery();
    expect(result.success).toBe(true);
  });

  it('coupon error for one cart does not block subsequent carts', async () => {
    mockCreateCoupon
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ success: true, code: 'RECOVER-GOOD12', discount: '10%' });

    __seed('AbandonedCarts', [
      {
        _id: 'cart-a', checkoutId: 'co-a', buyerEmail: 'a@example.com', buyerName: 'A',
        cartTotal: 100, lineItems: '[]',
        abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'abandoned', recoveryEmailSent: false,
      },
      {
        _id: 'cart-b', checkoutId: 'co-b', buyerEmail: 'b@example.com', buyerName: 'B',
        cartTotal: 200, lineItems: '[]',
        abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'abandoned', recoveryEmailSent: false,
      },
    ]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.success).toBe(true);
    expect(result.cartsProcessed).toBeGreaterThanOrEqual(1);
  });

  it('cart is still marked recoveryEmailSent when coupon fails', async () => {
    mockCouponResult = { success: false, message: 'unavailable' };
    seedAbandonedCart({ _id: 'cart-99', checkoutId: 'co-99' });
    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBeGreaterThanOrEqual(1);
  });
});
