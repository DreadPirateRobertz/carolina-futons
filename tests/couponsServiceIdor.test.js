/**
 * @file couponsServiceIdor.test.js
 * @description Security tests for CF-env4: IDOR fix in couponsService.web.js
 *
 * Verifies:
 *  - getActiveCoupons returns only the current member's coupons (IDOR gate)
 *  - Non-member (no getMember result) gets empty array
 *  - Member with no email gets empty array
 *  - Member with no matching CMS records gets empty array
 *  - getActiveCoupons does NOT call coupons.queryAllCoupons / queryV2 (no cross-member data)
 *  - createWelcomeCoupon writes to Members/MemberCoupons
 *  - createBirthdayCoupon writes to Members/MemberCoupons
 *  - createTierUpgradeCoupon writes to Members/MemberCoupons
 *  - generateRecoveryCoupon writes to Members/MemberCoupons (new cart)
 *  - createCartRecoveryCoupon writes to Members/MemberCoupons
 *  - MemberCoupons insert failure is non-blocking (best-effort)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset as __resetData, __seed, __onInsert } from './__mocks__/wix-data.js';

// ── Mock wix-members-backend ──────────────────────────────────────────

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn() },
}));

// ── Mock wix-marketing-backend ────────────────────────────────────────

vi.mock('wix-marketing-backend', () => ({
  coupons: {
    createCoupon: vi.fn().mockResolvedValue({ code: 'TEST-ABCDEF' }),
    queryV2: vi.fn(() => ({
      eq: () => ({ limit: () => ({ find: async () => ({ items: [] }) }) }),
    })),
    queryAllCoupons: vi.fn(), // should NEVER be called by getActiveCoupons
  },
}));

// ── Mock sanitize ─────────────────────────────────────────────────────

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => String(val || '').slice(0, max),
  validateEmail: (v) => /^[^@]+@[^@]+\.[^@]+$/.test(v),
}));

// ── Import SUT ────────────────────────────────────────────────────────

import {
  getActiveCoupons,
  createWelcomeCoupon,
  createBirthdayCoupon,
  createTierUpgradeCoupon,
  generateRecoveryCoupon,
  createCartRecoveryCoupon,
} from '../src/backend/couponsService.web.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeMember(loginEmail) {
  return { loginEmail, contactDetails: {} };
}

function seedCoupons(email, records) {
  __seed('Members/MemberCoupons', records.map((r, i) => ({
    _id: `coupon-${i}`,
    memberEmail: email,
    couponCode: r.code,
    couponType: r.type,
    discount: r.discount,
    expiresAt: r.expiresAt || '2099-01-01T00:00:00.000Z',
    active: true,
    ...r,
  })));
}

let mockGetMember;
let mockCreateCoupon;

beforeEach(async () => {
  __resetData();
  vi.clearAllMocks();

  const membersMod = await import('wix-members-backend');
  mockGetMember = membersMod.currentMember.getMember;

  const mktMod = await import('wix-marketing-backend');
  mockCreateCoupon = mktMod.coupons.createCoupon;
  mockCreateCoupon.mockResolvedValue({ code: 'TEST-ABCDEF' });
});

// ─────────────────────────────────────────────────────────────────────
// getActiveCoupons — IDOR gate
// ─────────────────────────────────────────────────────────────────────

describe('getActiveCoupons — IDOR gate', () => {
  it('returns empty array when getMember returns null (non-member)', async () => {
    mockGetMember.mockResolvedValue(null);
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

  it('returns empty array when member has no email', async () => {
    mockGetMember.mockResolvedValue({ loginEmail: '', contactDetails: {} });
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

  it('returns empty array when member has no MemberCoupons records', async () => {
    mockGetMember.mockResolvedValue(makeMember('alice@example.com'));
    // No __seed — wixData returns empty items
    const result = await getActiveCoupons();
    expect(result).toEqual([]);
  });

  it('returns only the current member\'s coupons (IDOR: other member\'s records excluded at DB level)', async () => {
    mockGetMember.mockResolvedValue(makeMember('alice@example.com'));
    // Seed both members' coupons together — DB query must filter by memberEmail
    __seed('Members/MemberCoupons', [
      { _id: 'coupon-alice', memberEmail: 'alice@example.com', couponCode: 'WELCOME-ALICE', couponType: 'Welcome', discount: '10%', active: true, expiresAt: '2099-01-01T00:00:00.000Z' },
      { _id: 'coupon-bob', memberEmail: 'bob@example.com', couponCode: 'WELCOME-BOB', couponType: 'Welcome', discount: '10%', active: true, expiresAt: '2099-01-01T00:00:00.000Z' },
    ]);

    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('WELCOME-ALICE');
    const codes = result.map(c => c.code);
    expect(codes).not.toContain('WELCOME-BOB');
  });

  it('maps CMS fields correctly (couponCode → code, couponType → name)', async () => {
    mockGetMember.mockResolvedValue(makeMember('alice@example.com'));
    seedCoupons('alice@example.com', [
      { code: 'BDAY-XYZ', type: 'Birthday', discount: '15%', expiresAt: '2099-06-01T00:00:00.000Z' },
    ]);

    const result = await getActiveCoupons();
    expect(result[0].code).toBe('BDAY-XYZ');
    expect(result[0].name).toBe('Birthday');
    expect(result[0].discount).toBe('15%');
    expect(result[0].expirationTime).toBe('2099-06-01T00:00:00.000Z');
    expect(result[0].active).toBe(true);
  });

  it('does NOT call coupons.queryAllCoupons (no cross-member data transit)', async () => {
    mockGetMember.mockResolvedValue(makeMember('alice@example.com'));
    await getActiveCoupons();
    const mktMod = await import('wix-marketing-backend');
    expect(mktMod.coupons.queryAllCoupons).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Creation functions — write to Members/MemberCoupons
// ─────────────────────────────────────────────────────────────────────

describe('createWelcomeCoupon — writes MemberCoupons record', () => {
  it('inserts a Members/MemberCoupons record for the email', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createWelcomeCoupon('welcome@example.com');

    const cms = inserted.filter(i => i.col === 'Members/MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.memberEmail).toBe('welcome@example.com');
    expect(cms[0].item.couponCode).toBe('TEST-ABCDEF');
    expect(cms[0].item.couponType).toBe('Welcome');
    expect(cms[0].item.discount).toBe('10%');
    expect(cms[0].item.active).toBe(true);
  });
});

describe('createBirthdayCoupon — writes MemberCoupons record', () => {
  it('inserts a Members/MemberCoupons record for the email', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createBirthdayCoupon('bday@example.com', 'Alice');

    const cms = inserted.filter(i => i.col === 'Members/MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.memberEmail).toBe('bday@example.com');
    expect(cms[0].item.couponType).toBe('Birthday');
    expect(cms[0].item.discount).toBe('15%');
  });
});

describe('createTierUpgradeCoupon — writes MemberCoupons record', () => {
  it('inserts a Members/MemberCoupons record for Silver tier', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createTierUpgradeCoupon('silver@example.com', 'Silver');

    const cms = inserted.filter(i => i.col === 'Members/MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.couponType).toBe('Silver Tier');
    expect(cms[0].item.discount).toBe('10%');
  });

  it('inserts a Members/MemberCoupons record for Gold tier with 20% discount', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createTierUpgradeCoupon('gold@example.com', 'Gold');

    const cms = inserted.filter(i => i.col === 'Members/MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.couponType).toBe('Gold Tier');
    expect(cms[0].item.discount).toBe('20%');
  });
});

describe('generateRecoveryCoupon — writes MemberCoupons record', () => {
  it('inserts a Members/MemberCoupons record for a new cart', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await generateRecoveryCoupon({ cartId: 'cart-abc', email: 'recover@example.com' });

    const cms = inserted.filter(i => i.col === 'Members/MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.memberEmail).toBe('recover@example.com');
    expect(cms[0].item.couponType).toBe('Cart Recovery');
    expect(cms[0].item.discount).toBe('10%');
  });
});

describe('createCartRecoveryCoupon — writes MemberCoupons record', () => {
  it('inserts a Members/MemberCoupons record', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createCartRecoveryCoupon('cartrec@example.com');

    const cms = inserted.filter(i => i.col === 'Members/MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.memberEmail).toBe('cartrec@example.com');
    expect(cms[0].item.couponType).toBe('Cart Recovery');
  });
});

// ─────────────────────────────────────────────────────────────────────
// _insertMemberCouponRecord failure is non-blocking
// ─────────────────────────────────────────────────────────────────────

describe('MemberCoupons insert failure is non-blocking', () => {
  it('createWelcomeCoupon still returns success when MemberCoupons insert fails', async () => {
    // Override insert to throw for MemberCoupons
    __onInsert((col) => {
      if (col === 'Members/MemberCoupons') throw new Error('DB down');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await createWelcomeCoupon('fail@example.com');

    expect(result.success).toBe(true);
    expect(result.code).toBe('TEST-ABCDEF');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('MemberCoupons insert failed'),
      expect.anything(),
      expect.stringContaining(':'),
      expect.stringContaining('DB down'),
    );
    warnSpy.mockRestore();
  });
});
