import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateEmail: (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },
}));

let _createdCoupons = [];
vi.mock('wix-marketing-backend', () => ({
  coupons: {
    createCoupon: vi.fn(async (data) => {
      const coupon = { ...data, _id: `coupon-${Date.now()}`, code: data.code || 'GEN-CODE' };
      _createdCoupons.push(coupon);
      return coupon;
    }),
    queryAllCoupons: () => ({
      eq: () => ({
        find: async () => ({ items: [] }),
      }),
    }),
    queryV2: () => ({
      eq: () => ({
        limit: () => ({
          find: async () => ({ items: [] }),
        }),
      }),
    }),
  },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'test@example.com' })),
  },
}));


let mod;
let wixDataMock;
beforeEach(async () => {
  _createdCoupons = [];
  vi.resetModules();
  mod = await import('../src/backend/couponsService.web.js');
  wixDataMock = await import('wix-data');
});

// ── createWelcomeCoupon ──────────────────────────────────────────

describe('createWelcomeCoupon', () => {
  it('rejects missing email', async () => {
    const r = await mod.createWelcomeCoupon('');
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const r = await mod.createWelcomeCoupon('bad');
    expect(r.success).toBe(false);
  });

  it('creates 10% welcome coupon', async () => {
    const r = await mod.createWelcomeCoupon('jane@test.com');
    expect(r.success).toBe(true);
    expect(r.discount).toBe('10%');
    expect(r.expiresIn).toBe('30 days');
    expect(r.code).toBeTruthy();
    expect(_createdCoupons).toHaveLength(1);
    expect(_createdCoupons[0].percentOffRate).toBe(10);
  });
});

// ── createBirthdayCoupon ─────────────────────────────────────────

describe('createBirthdayCoupon', () => {
  it('creates 15% birthday coupon', async () => {
    const r = await mod.createBirthdayCoupon('jane@test.com', 'Jane');
    expect(r.success).toBe(true);
    expect(r.discount).toBe('15%');
    expect(r.expiresIn).toBe('7 days');
    expect(_createdCoupons[0].name).toContain('Happy Birthday Jane');
  });

  it('uses default name when empty', async () => {
    const r = await mod.createBirthdayCoupon('jane@test.com', '');
    expect(r.success).toBe(true);
    expect(_createdCoupons[0].name).toContain('Valued Customer');
  });
});

// ── createTierUpgradeCoupon ──────────────────────────────────────

describe('createTierUpgradeCoupon', () => {
  it('creates 10% Silver tier coupon', async () => {
    const r = await mod.createTierUpgradeCoupon('jane@test.com', 'Silver');
    expect(r.success).toBe(true);
    expect(r.discount).toBe('10%');
    expect(r.expiresIn).toBe('14 days');
  });

  it('creates 20% Gold tier coupon', async () => {
    const r = await mod.createTierUpgradeCoupon('jane@test.com', 'Gold');
    expect(r.success).toBe(true);
    expect(r.discount).toBe('20%');
  });

  it('defaults to 10% for unknown tier', async () => {
    const r = await mod.createTierUpgradeCoupon('jane@test.com', 'Bronze');
    expect(r.success).toBe(true);
    expect(r.discount).toBe('10%');
  });
});

// ── getActiveCoupons ─────────────────────────────────────────────

describe('getActiveCoupons', () => {
  it('returns empty for no coupons', async () => {
    const r = await mod.getActiveCoupons();
    expect(r).toEqual([]);
  });

  it('returns active coupons with discount from CMS', async () => {
    wixDataMock.__seed('Members/MemberCoupons', [
      { _id: 'c1', memberEmail: 'test@example.com', couponCode: 'WELCOME-ABC', couponType: 'Welcome', discount: '10%', active: true, expiresAt: '2099-01-01T00:00:00.000Z' },
      { _id: 'c2', memberEmail: 'test@example.com', couponCode: 'BDAY-XYZ', couponType: 'Birthday', discount: '15%', active: true, expiresAt: '2099-01-01T00:00:00.000Z' },
    ]);
    const r = await mod.getActiveCoupons();
    expect(r).toHaveLength(2);
    expect(r[0].discount).toBe('10%');
    expect(r[1].discount).toBe('15%');
  });

  it('returns money-off discount as stored in CMS', async () => {
    wixDataMock.__seed('Members/MemberCoupons', [
      { _id: 'c1', memberEmail: 'test@example.com', couponCode: 'FLAT50', couponType: 'Cart Recovery', discount: '$50 off', active: true, expiresAt: '2099-01-01T00:00:00.000Z' },
    ]);
    const r = await mod.getActiveCoupons();
    expect(r[0].discount).toBe('$50 off');
  });
});
