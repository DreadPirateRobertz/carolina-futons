/**
 * cartRecoveryCoupon.test.js — Unit tests for generateRecoveryCoupon.
 *
 * Tests idempotency-by-cartId, discount shape, expiry window,
 * validation, and API parameter correctness.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateRecoveryCoupon } from '../src/backend/couponsService.web.js';
import { coupons } from './__mocks__/wix-marketing-backend.js';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';

beforeEach(() => {
  __reset();
  coupons.createCoupon.mockClear();
  coupons.createCoupon.mockResolvedValue({ code: 'RECOVER-ABCDEF', _id: 'coupon-mock-1' });
});

// ── Happy path ──────────────────────────────────────────────────────────────

describe('generateRecoveryCoupon — success shape', () => {
  it('returns success: true', async () => {
    const result = await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(result.success).toBe(true);
  });

  it('returns code with RECOVER- prefix', async () => {
    const result = await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(result.code).toMatch(/^RECOVER-/);
  });

  it('returns discountPercent of 10', async () => {
    const result = await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(result.discountPercent).toBe(10);
  });

  it('returns expiresAt as an ISO string', async () => {
    const result = await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(result.expiresAt).toBeDefined();
    expect(() => new Date(result.expiresAt)).not.toThrow();
  });

  it('expiresAt is ~48 hours from now (±60s)', async () => {
    const before = Date.now();
    const result = await generateRecoveryCoupon({ cartId: 'cart-2', email: 'buyer@example.com' });
    const after = Date.now();
    const expiresMs = new Date(result.expiresAt).getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(before + fortyEightHours - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + fortyEightHours + 1000);
  });
});

// ── Coupon API parameters ────────────────────────────────────────────────────

describe('generateRecoveryCoupon — createCoupon parameters', () => {
  it('calls coupons.createCoupon once', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(coupons.createCoupon).toHaveBeenCalledOnce();
  });

  it('passes percentOffRate: 10', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ percentOffRate: 10 })
    );
  });

  it('passes scope.namespace: stores', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { namespace: 'stores' } })
    );
  });

  it('passes limitPerCustomer: 1', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ limitPerCustomer: 1 })
    );
  });

  it('passes active: true', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ active: true })
    );
  });

  it('passes limitedToOneItem: false', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ limitedToOneItem: false })
    );
  });

  it('includes buyer email in coupon name', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'Buyer@Example.COM' });
    const callArg = coupons.createCoupon.mock.calls[0][0];
    expect(callArg.name).toContain('buyer@example.com');
  });
});

// ── RecoveryCoupons data store ───────────────────────────────────────────────

describe('generateRecoveryCoupon — stores record for idempotency', () => {
  it('inserts into RecoveryCoupons collection', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-abc', email: 'shopper@example.com' });
    const records = __getInserted('RecoveryCoupons');
    expect(records.length).toBe(1);
    expect(records[0].cartId).toBe('cart-abc');
    expect(records[0].code).toBe('RECOVER-ABCDEF');
  });

  it('stores lowercase email in RecoveryCoupons', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-abc', email: 'SHOPPER@Example.COM' });
    const records = __getInserted('RecoveryCoupons');
    expect(records[0].email).toBe('shopper@example.com');
  });

  it('stores expiresAt in RecoveryCoupons', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-abc', email: 'shopper@example.com' });
    const records = __getInserted('RecoveryCoupons');
    expect(records[0].expiresAt).toBeDefined();
    expect(new Date(records[0].expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

// ── Idempotency ──────────────────────────────────────────────────────────────

describe('generateRecoveryCoupon — idempotency', () => {
  it('returns existing coupon code without creating a new one', async () => {
    __seed('RecoveryCoupons', [{
      _id: 'rc-1',
      cartId: 'cart-existing',
      email: 'buyer@example.com',
      code: 'RECOVER-CACHED',
      expiresAt: new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),
    }]);

    const result = await generateRecoveryCoupon({ cartId: 'cart-existing', email: 'buyer@example.com' });
    expect(result.success).toBe(true);
    expect(result.code).toBe('RECOVER-CACHED');
    expect(coupons.createCoupon).not.toHaveBeenCalled();
  });

  it('returns discountPercent: 10 for cached coupon', async () => {
    __seed('RecoveryCoupons', [{
      _id: 'rc-1',
      cartId: 'cart-existing',
      email: 'buyer@example.com',
      code: 'RECOVER-CACHED',
      expiresAt: new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),
    }]);

    const result = await generateRecoveryCoupon({ cartId: 'cart-existing', email: 'buyer@example.com' });
    expect(result.discountPercent).toBe(10);
  });

  it('returns stored expiresAt for cached coupon', async () => {
    const storedExpiry = new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString();
    __seed('RecoveryCoupons', [{
      _id: 'rc-1',
      cartId: 'cart-existing',
      email: 'buyer@example.com',
      code: 'RECOVER-CACHED',
      expiresAt: storedExpiry,
    }]);

    const result = await generateRecoveryCoupon({ cartId: 'cart-existing', email: 'buyer@example.com' });
    expect(result.expiresAt).toBe(storedExpiry);
  });

  it('different cartIds each get their own coupon', async () => {
    coupons.createCoupon
      .mockResolvedValueOnce({ code: 'RECOVER-AAA111', _id: 'c1' })
      .mockResolvedValueOnce({ code: 'RECOVER-BBB222', _id: 'c2' });

    const r1 = await generateRecoveryCoupon({ cartId: 'cart-A', email: 'a@example.com' });
    const r2 = await generateRecoveryCoupon({ cartId: 'cart-B', email: 'b@example.com' });

    expect(r1.code).toBe('RECOVER-AAA111');
    expect(r2.code).toBe('RECOVER-BBB222');
    expect(coupons.createCoupon).toHaveBeenCalledTimes(2);
  });
});

// ── Input validation ─────────────────────────────────────────────────────────

describe('generateRecoveryCoupon — validation', () => {
  it('returns error when cartId is missing', async () => {
    const result = await generateRecoveryCoupon({ email: 'buyer@example.com' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/cart id/i);
  });

  it('returns error when cartId is empty string', async () => {
    const result = await generateRecoveryCoupon({ cartId: '', email: 'buyer@example.com' });
    expect(result.success).toBe(false);
  });

  it('returns error when email is missing', async () => {
    const result = await generateRecoveryCoupon({ cartId: 'cart-1' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/email/i);
  });

  it('returns error when email is empty string', async () => {
    const result = await generateRecoveryCoupon({ cartId: 'cart-1', email: '' });
    expect(result.success).toBe(false);
  });

  it('returns error for invalid email format', async () => {
    const result = await generateRecoveryCoupon({ cartId: 'cart-1', email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/invalid email/i);
  });

  it('normalizes email to lowercase', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'BUYER@EXAMPLE.COM' });
    const callArg = coupons.createCoupon.mock.calls[0][0];
    expect(callArg.name).toContain('buyer@example.com');
  });

  it('does not call createCoupon on invalid email', async () => {
    await generateRecoveryCoupon({ cartId: 'cart-1', email: 'bad-email' });
    expect(coupons.createCoupon).not.toHaveBeenCalled();
  });

  it('returns error when called with no arguments', async () => {
    const result = await generateRecoveryCoupon({});
    expect(result.success).toBe(false);
  });
});

// ── Error handling ───────────────────────────────────────────────────────────

describe('generateRecoveryCoupon — error handling', () => {
  it('returns failure when createCoupon throws', async () => {
    coupons.createCoupon.mockRejectedValueOnce(new Error('Marketing API down'));
    const result = await generateRecoveryCoupon({ cartId: 'cart-1', email: 'buyer@example.com' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/failed/i);
  });

  it('logs error with cartId on createCoupon failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    coupons.createCoupon.mockRejectedValueOnce(new Error('timeout'));
    await generateRecoveryCoupon({ cartId: 'cart-err-123', email: 'buyer@example.com' });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[couponsService]'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });
});
