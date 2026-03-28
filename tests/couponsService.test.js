import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWelcomeCoupon,
  getActiveCoupons,
  createBirthdayCoupon,
  createTierUpgradeCoupon,
} from '../src/backend/couponsService.web.js';
<<<<<<< HEAD
import { coupons } from './__mocks__/wix-marketing-backend.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
<<<<<<< HEAD
import { __seed, __reset as resetWixData, __getInserted, __setInsertError } from './__mocks__/wix-data.js';
=======
import { __reset as __resetData, __seed } from './__mocks__/wix-data.js';
>>>>>>> origin/hotfix-coupons-test-idor
=======
import { __setCoupons, coupons } from './__mocks__/wix-marketing-backend.js';
import { __reset as __resetMember, __setMember } from './__mocks__/wix-members-backend.js';
>>>>>>> origin/cf-ld8w-referral-ui

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
<<<<<<< HEAD
  const TEST_EMAIL = 'test@example.com';
  const OTHER_EMAIL = 'other@example.com';

  beforeEach(() => {
<<<<<<< HEAD
    resetWixData();
    coupons.queryAllCoupons.mockClear();
    __setMember({ _id: 'member-1', loginEmail: TEST_EMAIL });
  });

  it('returns active coupons with percent-off formatting', async () => {
    __seed('MemberCoupons', [
      { _id: 'mc-1', memberEmail: TEST_EMAIL, code: 'WELCOME-ABC123', displayName: 'Welcome 10% Off', percentOffRate: 10, active: true },
=======
    __resetData();
    __setMember({ _id: 'member-1', loginEmail: TEST_EMAIL });
  });

  it('returns active coupons with percent-off discount', async () => {
    __seed('Members/MemberCoupons', [
      { _id: 'c-1', memberEmail: TEST_EMAIL, couponCode: 'WELCOME-ABC123', couponType: 'Welcome', discount: '10%', active: true, expiresAt: '2099-01-01T00:00:00.000Z' },
>>>>>>> origin/hotfix-coupons-test-idor
=======
  beforeEach(() => {
    __resetMember();
    __setMember({ _id: 'member-123', loginEmail: 'member@test.com' });
  });

  it('returns active coupons with percent-off formatting', async () => {
    __setCoupons([
      { _id: 'c-1', code: 'WELCOME-ABC123', name: 'Welcome 10% Off - member@test.com', percentOffRate: 10, active: true },
>>>>>>> origin/cf-ld8w-referral-ui
    ]);
    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('WELCOME-ABC123');
    expect(result[0].discount).toBe('10%');
  });

<<<<<<< HEAD
  it('formats money-off coupons correctly', async () => {
<<<<<<< HEAD
    __seed('MemberCoupons', [
      { _id: 'mc-2', memberEmail: TEST_EMAIL, code: 'SAVE25', displayName: '$25 Off', moneyOffAmount: 25, active: true },
=======
  it('returns discount string as stored in CMS', async () => {
    __seed('Members/MemberCoupons', [
      { _id: 'c-2', memberEmail: TEST_EMAIL, couponCode: 'SAVE25', couponType: 'Cart Recovery', discount: '$25 off', active: true, expiresAt: '2099-01-01T00:00:00.000Z' },
>>>>>>> origin/hotfix-coupons-test-idor
=======
    __setCoupons([
      { _id: 'c-2', code: 'SAVE25', name: '$25 Off - member@test.com', moneyOffAmount: 25, active: true },
>>>>>>> origin/cf-ld8w-referral-ui
    ]);
    const result = await getActiveCoupons();
    expect(result[0].discount).toBe('$25 off');
  });

<<<<<<< HEAD
  it('defaults moneyOffAmount to 0 when missing', async () => {
<<<<<<< HEAD
    __seed('MemberCoupons', [
      { _id: 'mc-3', memberEmail: TEST_EMAIL, code: 'NOAMT', displayName: 'No Amount Coupon', active: true },
=======
  it('returns coupon with any discount string stored at creation time', async () => {
    __seed('Members/MemberCoupons', [
      { _id: 'c-3', memberEmail: TEST_EMAIL, couponCode: 'SPECIAL', couponType: 'Welcome', discount: '0%', active: true, expiresAt: '2099-01-01T00:00:00.000Z' },
>>>>>>> origin/hotfix-coupons-test-idor
=======
    __setCoupons([
      { _id: 'c-3', code: 'NOAMT', name: 'No Amount - member@test.com', active: true },
>>>>>>> origin/cf-ld8w-referral-ui
    ]);
    const result = await getActiveCoupons();
    expect(result[0].discount).toBe('0%');
  });

  it('returns only specified fields (no internal data leak)', async () => {
<<<<<<< HEAD
    __seed('MemberCoupons', [{
      _id: 'mc-4',
      memberEmail: TEST_EMAIL,
      code: 'FIELDS',
<<<<<<< HEAD
      displayName: 'Test Coupon',
=======
      name: 'Test - member@test.com',
>>>>>>> origin/cf-ld8w-referral-ui
      percentOffRate: 5,
=======
    __seed('Members/MemberCoupons', [{
      _id: 'c-4',
      memberEmail: TEST_EMAIL,
      couponCode: 'FIELDS',
      couponType: 'Welcome',
      discount: '5%',
>>>>>>> origin/hotfix-coupons-test-idor
      active: true,
      minimumSubtotal: 50,
      expiresAt: new Date().toISOString(),
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
    expect(result[0]).not.toHaveProperty('memberEmail');
  });

<<<<<<< HEAD
  it('returns empty array when member has no coupons', async () => {
    __seed('MemberCoupons', []);
=======
  it('returns empty array when no coupons', async () => {
>>>>>>> origin/hotfix-coupons-test-idor
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

<<<<<<< HEAD
  // ── IDOR security gates ──────────────────────────────────────────────

  it('IDOR gate: returns empty array when no member session', async () => {
    __setMember(null);
    __seed('MemberCoupons', [
      { _id: 'mc-5', memberEmail: OTHER_EMAIL, code: 'OTHER-COUPON', displayName: 'Other Coupon', percentOffRate: 10, active: true },
=======
  it('returns empty array when member has no email', async () => {
    __setMember({ _id: 'member-no-email' });
    __setCoupons([
      { _id: 'c-1', code: 'WELCOME-ABC', name: 'Welcome 10%', percentOffRate: 10, active: true },
>>>>>>> origin/cf-ld8w-referral-ui
    ]);
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

<<<<<<< HEAD
  it('IDOR gate: wrong member gets empty array (cannot see other members coupons)', async () => {
    __seed('MemberCoupons', [
      { _id: 'mc-6', memberEmail: OTHER_EMAIL, code: 'NOT-YOURS', displayName: 'Not Your Coupon', percentOffRate: 15, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

  it('IDOR gate: correct member gets only their own coupons', async () => {
    __seed('MemberCoupons', [
      { _id: 'mc-7', memberEmail: TEST_EMAIL, code: 'MINE', displayName: 'My Coupon', percentOffRate: 10, active: true },
      { _id: 'mc-8', memberEmail: OTHER_EMAIL, code: 'THEIRS', displayName: 'Their Coupon', percentOffRate: 15, active: true },
    ]);
    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('MINE');
    expect(result.some(c => c.code === 'THEIRS')).toBe(false);
  });

  it('does not return inactive coupons', async () => {
    __seed('MemberCoupons', [
      { _id: 'mc-9', memberEmail: TEST_EMAIL, code: 'INACTIVE', displayName: 'Old Coupon', percentOffRate: 5, active: false },
=======
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
>>>>>>> origin/cf-ld8w-referral-ui
    ]);
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

<<<<<<< HEAD
  it('does not call queryAllCoupons — confirms DB-level member scoping', async () => {
    __seed('MemberCoupons', []);
    await getActiveCoupons();
    expect(coupons.queryAllCoupons).not.toHaveBeenCalled();
  });

  it('returns displayName not raw coupon name (no PII in name field)', async () => {
    __seed('MemberCoupons', [{
      _id: 'mc-10',
      memberEmail: TEST_EMAIL,
      code: 'DISPLAY',
      displayName: 'Welcome 10% Off',
      percentOffRate: 10,
      active: true,
    }]);
    const result = await getActiveCoupons();
    expect(result[0].name).toBe('Welcome 10% Off');
    expect(result[0].name).not.toContain(TEST_EMAIL);
  });
});

// ── MemberCoupons write-through ──────────────────────────────────────

describe('createWelcomeCoupon — MemberCoupons tracking', () => {
  beforeEach(() => resetWixData());

  it('inserts into MemberCoupons with correct memberEmail and displayName', async () => {
    await createWelcomeCoupon('track@example.com');
    const records = __getInserted('MemberCoupons');
    expect(records).toHaveLength(1);
    expect(records[0].memberEmail).toBe('track@example.com');
    expect(records[0].displayName).toBe('Welcome 10% Off');
    expect(records[0].percentOffRate).toBe(10);
    expect(records[0].active).toBe(true);
  });

  it('still returns success if MemberCoupons insert fails', async () => {
    __setInsertError('MemberCoupons', new Error('DB down'));
    const result = await createWelcomeCoupon('resilient@example.com');
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^WELCOME-/);
  });
});

describe('createBirthdayCoupon — MemberCoupons tracking', () => {
  beforeEach(() => resetWixData());

  it('inserts into MemberCoupons with memberEmail and percentOffRate 15', async () => {
    await createBirthdayCoupon('bday@example.com', 'Jane');
    const records = __getInserted('MemberCoupons');
    expect(records).toHaveLength(1);
    expect(records[0].memberEmail).toBe('bday@example.com');
    expect(records[0].percentOffRate).toBe(15);
    expect(records[0].active).toBe(true);
  });
});

describe('createTierUpgradeCoupon — MemberCoupons tracking', () => {
  beforeEach(() => resetWixData());

  it('inserts into MemberCoupons with correct discount for Gold tier', async () => {
    await createTierUpgradeCoupon('gold@example.com', 'Gold');
    const records = __getInserted('MemberCoupons');
    expect(records).toHaveLength(1);
    expect(records[0].memberEmail).toBe('gold@example.com');
    expect(records[0].percentOffRate).toBe(20);
    expect(records[0].active).toBe(true);
=======
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
>>>>>>> origin/cf-ld8w-referral-ui
  });
});
