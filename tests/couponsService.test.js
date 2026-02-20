import { describe, it, expect } from 'vitest';
import {
  createWelcomeCoupon,
  getActiveCoupons,
  createBirthdayCoupon,
  createTierUpgradeCoupon,
} from '../src/backend/couponsService.web.js';
import { __setCoupons } from './__mocks__/wix-marketing-backend.js';

// ── createWelcomeCoupon ──────────────────────────────────────────────

describe('createWelcomeCoupon', () => {
  it('creates a 10% welcome coupon for valid email', async () => {
    const result = await createWelcomeCoupon('newuser@example.com');
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^WELCOME-/);
    expect(result.discount).toBe('10%');
    expect(result.expiresIn).toBe('30 days');
  });

  it('rejects missing email', async () => {
    const result = await createWelcomeCoupon(null);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const result = await createWelcomeCoupon('not-an-email');
    expect(result.success).toBe(false);
  });
});

// ── createBirthdayCoupon ─────────────────────────────────────────────

describe('createBirthdayCoupon', () => {
  it('creates a 15% birthday coupon', async () => {
    const result = await createBirthdayCoupon('birthday@example.com', 'Jane');
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^BDAY-/);
    expect(result.discount).toBe('15%');
    expect(result.expiresIn).toBe('7 days');
  });

  it('uses default name when not provided', async () => {
    const result = await createBirthdayCoupon('birthday@example.com');
    expect(result.success).toBe(true);
  });
});

// ── createTierUpgradeCoupon ──────────────────────────────────────────

describe('createTierUpgradeCoupon', () => {
  it('creates 10% coupon for Silver tier upgrade', async () => {
    const result = await createTierUpgradeCoupon('silver@example.com', 'Silver');
    expect(result.success).toBe(true);
    expect(result.discount).toBe('10%');
    expect(result.expiresIn).toBe('14 days');
  });

  it('creates 20% coupon for Gold tier upgrade', async () => {
    const result = await createTierUpgradeCoupon('gold@example.com', 'Gold');
    expect(result.success).toBe(true);
    expect(result.discount).toBe('20%');
  });
});

// ── getActiveCoupons ─────────────────────────────────────────────────

describe('getActiveCoupons', () => {
  it('returns active coupons', async () => {
    __setCoupons([
      { _id: 'c-1', code: 'WELCOME-ABC123', name: 'Welcome 10%', percentOffRate: 10, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('WELCOME-ABC123');
    expect(result[0].discount).toBe('10% off');
  });

  it('returns empty array when no coupons', async () => {
    __setCoupons([]);
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });
});
