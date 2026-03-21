/**
 * couponsServiceCartRecovery.test.js — unit tests for createCartRecoveryCoupon.
 *
 * Tests the new webMethod added to couponsService for single-use cart-recovery
 * coupons (RECOVER prefix, 10% off, 48-hour expiry). No module-level mock on
 * couponsService itself — tests the real function via wix-marketing-backend mock.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createCartRecoveryCoupon } from '../src/backend/couponsService.web.js';
import { coupons } from './__mocks__/wix-marketing-backend.js';

beforeEach(() => {
  coupons.createCoupon.mockClear();
  coupons.createCoupon.mockResolvedValue({ code: 'RECOVER-ABCDEF', _id: 'coupon-1' });
});

// ── Happy-path ────────────────────────────────────────────────────────────────

describe('createCartRecoveryCoupon — happy path', () => {
  it('returns success:true with a RECOVER-prefixed code', async () => {
    const result = await createCartRecoveryCoupon('buyer@example.com');
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^RECOVER-/);
  });

  it('returns discount "10%"', async () => {
    const result = await createCartRecoveryCoupon('buyer@example.com');
    expect(result.discount).toBe('10%');
  });

  it('returns expiresIn "48 hours"', async () => {
    const result = await createCartRecoveryCoupon('buyer@example.com');
    expect(result.expiresIn).toBe('48 hours');
  });

  it('passes percentOffRate:10 to coupons API', async () => {
    await createCartRecoveryCoupon('buyer@example.com');
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ percentOffRate: 10 })
    );
  });

  it('passes scope { namespace: "stores" } to coupons API', async () => {
    await createCartRecoveryCoupon('buyer@example.com');
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { namespace: 'stores' } })
    );
  });

  it('passes limitPerCustomer:1 to coupons API', async () => {
    await createCartRecoveryCoupon('buyer@example.com');
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ limitPerCustomer: 1 })
    );
  });

  it('passes usageLimit:1 to coupons API (globally single-use)', async () => {
    await createCartRecoveryCoupon('buyer@example.com');
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ usageLimit: 1 })
    );
  });

  it('passes active:true to coupons API', async () => {
    await createCartRecoveryCoupon('buyer@example.com');
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ active: true })
    );
  });

  it('passes limitedToOneItem:false to coupons API', async () => {
    await createCartRecoveryCoupon('buyer@example.com');
    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ limitedToOneItem: false })
    );
  });

  it('sets a 48-hour expiration time (±5s tolerance)', async () => {
    const before = Date.now();
    await createCartRecoveryCoupon('buyer@example.com');
    const after = Date.now();

    const [[callArg]] = coupons.createCoupon.mock.calls;
    const expiry = callArg.expirationTime.getTime();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;

    expect(expiry).toBeGreaterThanOrEqual(before + fortyEightHoursMs - 5000);
    expect(expiry).toBeLessThanOrEqual(after + fortyEightHoursMs + 5000);
  });

  it('includes buyer email in coupon name', async () => {
    await createCartRecoveryCoupon('buyer@example.com');
    const [[callArg]] = coupons.createCoupon.mock.calls;
    expect(callArg.name).toContain('buyer@example.com');
  });

  it('normalises email to lowercase before creating coupon', async () => {
    await createCartRecoveryCoupon('BUYER@EXAMPLE.COM');
    const [[callArg]] = coupons.createCoupon.mock.calls;
    expect(callArg.name).toContain('buyer@example.com');
    expect(callArg.name).not.toContain('BUYER@EXAMPLE.COM');
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('createCartRecoveryCoupon — input validation', () => {
  it('returns success:false when email is null', async () => {
    const result = await createCartRecoveryCoupon(null);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email required');
  });

  it('returns success:false when email is empty string', async () => {
    const result = await createCartRecoveryCoupon('');
    expect(result.success).toBe(false);
  });

  it('returns success:false for invalid email format', async () => {
    const result = await createCartRecoveryCoupon('not-an-email');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email');
  });

  it('strips HTML tags from email before embedding in coupon name', async () => {
    // sanitize() strips tags: '<b>buyer</b>@example.com' → 'buyer@example.com'
    await createCartRecoveryCoupon('<b>buyer</b>@example.com');
    const [[callArg]] = coupons.createCoupon.mock.calls;
    expect(callArg.name).not.toContain('<b>');
    expect(callArg.name).toContain('buyer@example.com');
  });

  it('does not call coupons API when email is invalid', async () => {
    await createCartRecoveryCoupon('bad-email');
    expect(coupons.createCoupon).not.toHaveBeenCalled();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('createCartRecoveryCoupon — error handling', () => {
  it('returns success:false when coupons.createCoupon throws', async () => {
    coupons.createCoupon.mockRejectedValueOnce(new Error('API unavailable'));
    const result = await createCartRecoveryCoupon('buyer@example.com');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to create coupon');
  });

  it('does not throw when coupons.createCoupon rejects', async () => {
    coupons.createCoupon.mockRejectedValueOnce(new Error('network error'));
    await expect(createCartRecoveryCoupon('buyer@example.com')).resolves.not.toThrow();
  });
});
