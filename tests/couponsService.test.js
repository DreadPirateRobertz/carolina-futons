import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWelcomeCoupon,
  getActiveCoupons,
  createBirthdayCoupon,
  createTierUpgradeCoupon,
} from '../src/backend/couponsService.web.js';
import { __setCoupons, coupons } from './__mocks__/wix-marketing-backend.js';
import { __reset as __resetMember, __setMember } from './__mocks__/wix-members-backend.js';

// ── createWelcomeCoupon ──────────────────────────────────────────────

describe('createWelcomeCoupon', () => {
  it('creates a 10% welcome coupon for valid email', async () => {
    const result = await createWelcomeCoupon('newuser@example.com');
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^WELCOME-/);
    expect(result.discount).toBe('10%');
    expect(result.expiresIn).toBe('30 days');
  });

  it('generates 6-char alphanumeric code after prefix', async () => {
    const result = await createWelcomeCoupon('code@test.com');
    // Format: WELCOME-XXXXXX (prefix + dash + 6 chars)
    expect(result.code).toMatch(/^WELCOME-[A-Z2-9]{6}$/);
    // Should not contain ambiguous chars I, O, 0, 1
    const suffix = result.code.split('-')[1];
    expect(suffix).not.toMatch(/[IO01]/);
  });

  it('rejects missing email', async () => {
    const result = await createWelcomeCoupon(null);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email required');
  });

  it('rejects empty string email', async () => {
    const result = await createWelcomeCoupon('');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const result = await createWelcomeCoupon('not-an-email');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email');
  });

  it('passes correct parameters to coupons API', async () => {
    await createWelcomeCoupon('api@test.com');

    expect(coupons.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        percentOffRate: 10,
        scope: { namespace: 'stores' },
        limitPerCustomer: 1,
        active: true,
      })
    );
  });

  it('sets 30-day expiration on welcome coupon', async () => {
    const before = Date.now();
    await createWelcomeCoupon('expiry@test.com');

    const call = coupons.createCoupon.mock.calls[0][0];
    const expirationTime = new Date(call.expirationTime).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    expect(expirationTime).toBeGreaterThanOrEqual(before + thirtyDays - 1000);
    expect(expirationTime).toBeLessThan(before + thirtyDays + 5000);
  });

  it('lowercases email in coupon name', async () => {
    await createWelcomeCoupon('MiXeD@TeSt.CoM');

    const call = coupons.createCoupon.mock.calls[0][0];
    expect(call.name).toContain('mixed@test.com');
  });

  it('returns failure message when API throws', async () => {
    coupons.createCoupon.mockRejectedValueOnce(new Error('API down'));

    const result = await createWelcomeCoupon('fail@test.com');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to create coupon');
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
    await createBirthdayCoupon('birthday@example.com');

    const call = coupons.createCoupon.mock.calls[0][0];
    expect(call.name).toContain('Valued Customer');
  });

  it('sanitizes XSS in member name', async () => {
    await createBirthdayCoupon('xss@test.com', '<script>alert("xss")</script>');

    const call = coupons.createCoupon.mock.calls[0][0];
    expect(call.name).not.toContain('<script>');
  });

  it('rejects invalid email', async () => {
    const result = await createBirthdayCoupon('bad-email', 'Jane');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email');
  });

  it('rejects missing email', async () => {
    const result = await createBirthdayCoupon(null, 'Jane');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email required');
  });

  it('sets 7-day expiration', async () => {
    const before = Date.now();
    await createBirthdayCoupon('expiry@test.com', 'Test');

    const call = coupons.createCoupon.mock.calls[0][0];
    const expirationTime = new Date(call.expirationTime).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(expirationTime).toBeGreaterThanOrEqual(before + sevenDays - 1000);
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

  it('defaults to 10% for unknown tier', async () => {
    const result = await createTierUpgradeCoupon('unknown@test.com', 'Platinum');
    expect(result.success).toBe(true);
    expect(result.discount).toBe('10%');
  });

  it('uses tier name in coupon code prefix', async () => {
    const result = await createTierUpgradeCoupon('prefix@test.com', 'Gold');
    expect(result.code).toMatch(/^GOLD-/);
  });

  it('rejects missing email', async () => {
    const result = await createTierUpgradeCoupon(null, 'Silver');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email required');
  });

  it('sets 14-day expiration', async () => {
    const before = Date.now();
    await createTierUpgradeCoupon('expiry@test.com', 'Silver');

    const call = coupons.createCoupon.mock.calls[0][0];
    const expirationTime = new Date(call.expirationTime).getTime();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;

    expect(expirationTime).toBeGreaterThanOrEqual(before + fourteenDays - 1000);
  });

  it('returns failure on API error', async () => {
    coupons.createCoupon.mockRejectedValueOnce(new Error('API down'));

    const result = await createTierUpgradeCoupon('fail@test.com', 'Gold');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to create coupon');
  });
});

// ── getActiveCoupons ─────────────────────────────────────────────────

describe('getActiveCoupons', () => {
  beforeEach(() => {
    __resetMember();
    __setMember({ _id: 'member-123', loginEmail: 'member@test.com' });
  });

  it('returns active coupons with percent-off formatting', async () => {
    __setCoupons([
      { _id: 'c-1', code: 'WELCOME-ABC123', name: 'Welcome 10% Off - member@test.com', percentOffRate: 10, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('WELCOME-ABC123');
    expect(result[0].discount).toBe('10% off');
  });

  it('formats money-off coupons correctly', async () => {
    __setCoupons([
      { _id: 'c-2', code: 'SAVE25', name: '$25 Off - member@test.com', moneyOffAmount: 25, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result[0].discount).toBe('$25 off');
  });

  it('defaults moneyOffAmount to 0 when missing', async () => {
    __setCoupons([
      { _id: 'c-3', code: 'NOAMT', name: 'No Amount - member@test.com', active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result[0].discount).toBe('$0 off');
  });

  it('returns only specified fields (no internal data leak)', async () => {
    __setCoupons([{
      _id: 'c-4',
      code: 'FIELDS',
      name: 'Test - member@test.com',
      percentOffRate: 5,
      active: true,
      minimumSubtotal: 50,
      expirationTime: new Date().toISOString(),
      internalSecret: 'should-not-appear',
    }]);

    const result = await getActiveCoupons();
    expect(result[0]).toHaveProperty('_id');
    expect(result[0]).toHaveProperty('code');
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('discount');
    expect(result[0]).toHaveProperty('minimumSubtotal');
    expect(result[0]).toHaveProperty('expirationTime');
    expect(result[0]).toHaveProperty('active');
    expect(result[0]).not.toHaveProperty('internalSecret');
  });

  it('returns empty array when no coupons', async () => {
    __setCoupons([]);
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

  it('returns empty array when member has no email', async () => {
    __setMember({ _id: 'member-no-email' });
    __setCoupons([
      { _id: 'c-1', code: 'WELCOME-ABC', name: 'Welcome 10%', percentOffRate: 10, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

  it('does not return coupons belonging to other members', async () => {
    __setCoupons([
      { _id: 'c-victim', code: 'BDAY-VICTIM1', name: 'Happy Birthday Victim! 15% Off - victim@other.com', percentOffRate: 15, active: true },
      { _id: 'c-mine', code: 'WELCOME-MINE1', name: 'Welcome 10% Off - member@test.com', percentOffRate: 10, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('WELCOME-MINE1');
    expect(result.find(c => c.code === 'BDAY-VICTIM1')).toBeUndefined();
  });
});

// ── IDOR ownership enforcement (CF-fug9 P0) ──────────────────────────

describe('IDOR ownership enforcement (CF-fug9 P0)', () => {
  beforeEach(() => {
    __resetMember();
  });

  it('getActiveCoupons returns empty when session has no member', async () => {
    __setCoupons([
      { _id: 'c-1', code: 'WELCOME-XYZ', name: 'Welcome 10%', percentOffRate: 10, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

  it('getActiveCoupons prevents attacker harvesting victim coupon codes', async () => {
    __setMember({ _id: 'attacker', loginEmail: 'attacker@evil.com' });
    __setCoupons([
      { _id: 'c-v1', code: 'BDAY-V12345', name: 'Happy Birthday Victim! 15% Off - victim@example.com', percentOffRate: 15, active: true },
      { _id: 'c-v2', code: 'WELCOME-V678', name: 'Welcome 10% Off - victim@example.com', percentOffRate: 10, active: true },
      { _id: 'c-a',  code: 'WELCOME-A123', name: 'Welcome 10% Off - attacker@evil.com', percentOffRate: 10, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('WELCOME-A123');
    const codes = result.map(c => c.code);
    expect(codes).not.toContain('BDAY-V12345');
    expect(codes).not.toContain('WELCOME-V678');
  });

  it('getActiveCoupons allows member to see their own coupons', async () => {
    __setMember({ _id: 'member-ok', loginEmail: 'mine@example.com' });
    __setCoupons([
      { _id: 'c-mine', code: 'RECOVER-MYCODE', name: 'Cart Recovery 10% Off - mine@example.com', percentOffRate: 10, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('RECOVER-MYCODE');
  });
});
