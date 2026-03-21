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
 *  - createWelcomeCoupon writes to MemberCoupons
 *  - createBirthdayCoupon writes to MemberCoupons
 *  - createTierUpgradeCoupon writes to MemberCoupons
 *  - generateRecoveryCoupon writes to MemberCoupons (new cart)
 *  - createCartRecoveryCoupon writes to MemberCoupons
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
    createCoupon: vi.fn().mockResolvedValue({ code: 'TEST-ABCDEF', _id: 'coupon-id-1' }),
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
  __seed('MemberCoupons', records.map((r, i) => ({
    _id: `coupon-${i}`,
    memberEmail: email,
    code: r.code,
    displayName: r.displayName || r.type,
    percentOffRate: r.percentOffRate || 0,
    moneyOffAmount: r.moneyOffAmount || 0,
    expirationTime: r.expirationTime || r.expiresAt || '2099-01-01T00:00:00.000Z',
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
  mockCreateCoupon.mockResolvedValue({ code: 'TEST-ABCDEF', _id: 'coupon-id-1' });
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
    __seed('MemberCoupons', [
      { _id: 'coupon-alice', memberEmail: 'alice@example.com', code: 'WELCOME-ALICE', displayName: 'Welcome 10% Off', percentOffRate: 10, moneyOffAmount: 0, active: true, expirationTime: '2099-01-01T00:00:00.000Z' },
      { _id: 'coupon-bob', memberEmail: 'bob@example.com', code: 'WELCOME-BOB', displayName: 'Welcome 10% Off', percentOffRate: 10, moneyOffAmount: 0, active: true, expirationTime: '2099-01-01T00:00:00.000Z' },
    ]);

    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('WELCOME-ALICE');
    const codes = result.map(c => c.code);
    expect(codes).not.toContain('WELCOME-BOB');
  });

  it('maps CMS fields correctly (code → code, displayName → name, percentOffRate → discount)', async () => {
    mockGetMember.mockResolvedValue(makeMember('alice@example.com'));
    seedCoupons('alice@example.com', [
      { code: 'BDAY-XYZ', displayName: 'Birthday 15% Off', percentOffRate: 15, expirationTime: '2099-06-01T00:00:00.000Z' },
    ]);

    const result = await getActiveCoupons();
    expect(result[0].code).toBe('BDAY-XYZ');
    expect(result[0].name).toBe('Birthday 15% Off');
    expect(result[0].discount).toBe('15% off');
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
// Creation functions — write to MemberCoupons
// ─────────────────────────────────────────────────────────────────────

describe('createWelcomeCoupon — writes MemberCoupons record', () => {
  it('inserts a MemberCoupons record for the email', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createWelcomeCoupon('welcome@example.com');

    const cms = inserted.filter(i => i.col === 'MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.memberEmail).toBe('welcome@example.com');
    expect(cms[0].item.code).toBe('TEST-ABCDEF');
    expect(cms[0].item.displayName).toBe('Welcome 10% Off');
    expect(cms[0].item.percentOffRate).toBe(10);
    expect(cms[0].item.active).toBe(true);
  });
});

describe('createBirthdayCoupon — writes MemberCoupons record', () => {
  it('inserts a MemberCoupons record for the email', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createBirthdayCoupon('bday@example.com', 'Alice');

    const cms = inserted.filter(i => i.col === 'MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.memberEmail).toBe('bday@example.com');
    expect(cms[0].item.displayName).toBe('Happy Birthday Alice! 15% Off');
    expect(cms[0].item.percentOffRate).toBe(15);
  });
});

describe('createTierUpgradeCoupon — writes MemberCoupons record', () => {
  it('inserts a MemberCoupons record for Silver tier', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createTierUpgradeCoupon('silver@example.com', 'Silver');

    const cms = inserted.filter(i => i.col === 'MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.displayName).toBe('Silver Tier Welcome - 10% Off');
    expect(cms[0].item.percentOffRate).toBe(10);
  });

  it('inserts a MemberCoupons record for Gold tier with 20% discount', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createTierUpgradeCoupon('gold@example.com', 'Gold');

    const cms = inserted.filter(i => i.col === 'MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.displayName).toBe('Gold Tier Welcome - 20% Off');
    expect(cms[0].item.percentOffRate).toBe(20);
  });
});

describe('generateRecoveryCoupon — writes MemberCoupons record', () => {
  it('inserts a MemberCoupons record for a new cart', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await generateRecoveryCoupon({ cartId: 'cart-abc', email: 'recover@example.com' });

    const cms = inserted.filter(i => i.col === 'MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.memberEmail).toBe('recover@example.com');
    expect(cms[0].item.displayName).toBe('Cart Recovery 10% Off');
    expect(cms[0].item.percentOffRate).toBe(10);
  });
});

describe('createCartRecoveryCoupon — writes MemberCoupons record', () => {
  it('inserts a MemberCoupons record', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));

    await createCartRecoveryCoupon('cartrec@example.com');

    const cms = inserted.filter(i => i.col === 'MemberCoupons');
    expect(cms).toHaveLength(1);
    expect(cms[0].item.memberEmail).toBe('cartrec@example.com');
    expect(cms[0].item.displayName).toBe('Cart Recovery 10% Off');
  });
});

// ─────────────────────────────────────────────────────────────────────
// MemberCoupons insert failure is non-blocking
// ─────────────────────────────────────────────────────────────────────

describe('MemberCoupons insert failure is non-blocking', () => {
  it('createWelcomeCoupon still returns success when MemberCoupons insert fails', async () => {
    __onInsert((col) => {
      if (col === 'MemberCoupons') throw new Error('DB down');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await createWelcomeCoupon('fail@example.com');

    expect(result.success).toBe(true);
    expect(result.code).toBe('TEST-ABCDEF');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('MemberCoupons insert failed'),
      expect.stringContaining('DB down'),
    );
    warnSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────
// generateRecoveryCoupon — idempotency path
// ─────────────────────────────────────────────────────────────────────

describe('generateRecoveryCoupon — idempotency', () => {
  it('returns existing code without calling createCoupon when cartId already exists', async () => {
    // Seed an existing RecoveryCoupons record for this cart
    __seed('RecoveryCoupons', [{
      _id: 'rc-1',
      cartId: 'cart-existing',
      email: 'recover@example.com',
      code: 'RECOVER-EXISTING',
      discountPercent: 10,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }]);

    const result = await generateRecoveryCoupon({ cartId: 'cart-existing', email: 'recover@example.com' });

    expect(result.success).toBe(true);
    expect(result.code).toBe('RECOVER-EXISTING');
    expect(mockCreateCoupon).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Input validation guards on creation functions
// ─────────────────────────────────────────────────────────────────────

describe('createWelcomeCoupon — input validation', () => {
  it('rejects missing email', async () => {
    const result = await createWelcomeCoupon('');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/email/i);
  });

  it('rejects invalid email', async () => {
    const result = await createWelcomeCoupon('not-an-email');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/invalid/i);
  });
});

describe('createBirthdayCoupon — input validation', () => {
  it('rejects missing email', async () => {
    const result = await createBirthdayCoupon('');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const result = await createBirthdayCoupon('bad-email');
    expect(result.success).toBe(false);
  });
});

describe('createTierUpgradeCoupon — edge cases', () => {
  it('rejects missing email', async () => {
    const result = await createTierUpgradeCoupon('', 'Gold');
    expect(result.success).toBe(false);
  });

  it('defaults to 10% for unrecognized tier', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    const result = await createTierUpgradeCoupon('test@example.com', 'Platinum');
    expect(result.success).toBe(true);
    const cms = inserted.filter(i => i.col === 'MemberCoupons');
    expect(cms[0].item.percentOffRate).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────
// getActiveCoupons — contactDetails.emails fallback
// ─────────────────────────────────────────────────────────────────────

describe('getActiveCoupons — email fallback', () => {
  it('uses contactDetails.emails[0].address when loginEmail is absent', async () => {
    mockGetMember.mockResolvedValue({
      loginEmail: '',
      contactDetails: { emails: [{ address: 'contact@example.com' }] },
    });
    __seed('MemberCoupons', [{
      _id: 'c-contact',
      memberEmail: 'contact@example.com',
      code: 'BDAY-CONTACT',
      displayName: 'Birthday 15% Off',
      percentOffRate: 15,
      moneyOffAmount: 0,
      active: true,
      expirationTime: '2099-01-01T00:00:00.000Z',
    }]);

    const result = await getActiveCoupons();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('BDAY-CONTACT');
  });
});
