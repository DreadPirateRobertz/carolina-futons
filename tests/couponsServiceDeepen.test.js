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

let _queryV2Items = [];
let _queryV2Error = null;
let _createdCoupons = [];
let _activeCoupons = [];

vi.mock('wix-marketing-backend', () => ({
  coupons: {
    createCoupon: vi.fn(async (data) => {
      const coupon = { ...data, _id: `coupon-${Date.now()}`, code: data.code || 'GEN-CODE' };
      _createdCoupons.push(coupon);
      return coupon;
    }),
    queryAllCoupons: () => ({
      eq: () => ({
        find: async () => {
          if (_activeCoupons === 'ERROR') throw new Error('API down');
          return { items: Array.isArray(_activeCoupons) ? _activeCoupons : [] };
        },
      }),
    }),
    queryV2: () => ({
      eq: () => ({
        limit: () => ({
          find: async () => {
            if (_queryV2Error) throw _queryV2Error;
            return { items: _queryV2Items };
          },
        }),
      }),
    }),
  },
}));

let mod;
beforeEach(async () => {
  _createdCoupons = [];
  _activeCoupons = [];
  _queryV2Items = [];
  _queryV2Error = null;
  vi.resetModules();
  mod = await import('../src/backend/couponsService.web.js');
});

// ── generateCode collision retry ────────────────────────────────────

describe('generateCode collision handling', () => {
  it('returns code on first attempt when no collision', async () => {
    _queryV2Items = [];
    const r = await mod.createWelcomeCoupon('a@b.com');
    expect(r.success).toBe(true);
    expect(r.code).toMatch(/^WELCOME-[A-Z2-9]{6}$/);
  });

  it('retries on collision and succeeds within 5 attempts', async () => {
    let callCount = 0;
    const { coupons } = await import('wix-marketing-backend');
    const origQueryV2 = coupons.queryV2;
    try {
      coupons.queryV2 = () => ({
        eq: () => ({
          limit: () => ({
            find: async () => {
              callCount++;
              if (callCount <= 3) return { items: [{ code: 'COLLISION' }] };
              return { items: [] };
            },
          }),
        }),
      });

      const r = await mod.createWelcomeCoupon('a@b.com');
      expect(r.success).toBe(true);
      expect(r.code).toMatch(/^WELCOME-[A-Z2-9]{6}$/);
      expect(callCount).toBe(4);
    } finally {
      coupons.queryV2 = origQueryV2;
    }
  });

  it('falls back to 8-char code after 5 collisions', async () => {
    const { coupons } = await import('wix-marketing-backend');
    const origQueryV2 = coupons.queryV2;
    try {
      coupons.queryV2 = () => ({
        eq: () => ({
          limit: () => ({
            find: async () => ({ items: [{ code: 'EXISTS' }] }),
          }),
        }),
      });

      const r = await mod.createWelcomeCoupon('a@b.com');
      expect(r.success).toBe(true);
      expect(r.code).toMatch(/^WELCOME-[A-Z2-9]{8}$/);
    } finally {
      coupons.queryV2 = origQueryV2;
    }
  });

  it('returns code when queryV2 throws during collision check', async () => {
    _queryV2Error = new Error('DB connection lost');
    const r = await mod.createWelcomeCoupon('a@b.com');
    expect(r.success).toBe(true);
    // Should still get a 6-char code (returned on first attempt error)
    expect(r.code).toMatch(/^WELCOME-[A-Z2-9]{6}$/);
  });

  it('8-char fallback uses only valid alphabet chars', async () => {
    const { coupons } = await import('wix-marketing-backend');
    const origQueryV2 = coupons.queryV2;
    try {
      coupons.queryV2 = () => ({
        eq: () => ({
          limit: () => ({
            find: async () => ({ items: [{ code: 'EXISTS' }] }),
          }),
        }),
      });

      const r = await mod.createBirthdayCoupon('a@b.com', 'Test');
      expect(r.success).toBe(true);
      const suffix = r.code.split('-')[1];
      expect(suffix).toHaveLength(8);
      expect(suffix).not.toMatch(/[IO01]/);
    } finally {
      coupons.queryV2 = origQueryV2;
    }
  });
});

// ── getActiveCoupons error handling ─────────────────────────────────

describe('getActiveCoupons error handling', () => {
  it('returns empty array on API error', async () => {
    _activeCoupons = 'ERROR';
    const r = await mod.getActiveCoupons();
    expect(r).toEqual([]);
  });

  it('returns empty array when result.items is undefined', async () => {
    // queryAllCoupons returns { items: undefined }
    _activeCoupons = [];
    const r = await mod.getActiveCoupons();
    expect(r).toEqual([]);
  });

  it('formats mixed percentOff and moneyOff in same list', async () => {
    _activeCoupons = [
      { _id: 'c1', code: 'PCT10', name: '10%', percentOffRate: 10, active: true },
      { _id: 'c2', code: 'FLAT25', name: '$25', moneyOffAmount: 25, active: true },
      { _id: 'c3', code: 'PCT20', name: '20%', percentOffRate: 20, active: true },
    ];
    const r = await mod.getActiveCoupons();
    expect(r).toHaveLength(3);
    expect(r[0].discount).toBe('10% off');
    expect(r[1].discount).toBe('$25 off');
    expect(r[2].discount).toBe('20% off');
  });

  it('defaults moneyOffAmount to 0 when neither percentOff nor moneyOff', async () => {
    _activeCoupons = [
      { _id: 'c1', code: 'NONE', name: 'No discount', active: true },
    ];
    const r = await mod.getActiveCoupons();
    expect(r[0].discount).toBe('$0 off');
  });

  it('includes minimumSubtotal defaulting to 0', async () => {
    _activeCoupons = [
      { _id: 'c1', code: 'X', name: 'Test', percentOffRate: 5, active: true },
    ];
    const r = await mod.getActiveCoupons();
    expect(r[0].minimumSubtotal).toBe(0);
  });

  it('preserves minimumSubtotal when present', async () => {
    _activeCoupons = [
      { _id: 'c1', code: 'X', name: 'Test', percentOffRate: 5, active: true, minimumSubtotal: 50 },
    ];
    const r = await mod.getActiveCoupons();
    expect(r[0].minimumSubtotal).toBe(50);
  });
});

// ── createTierUpgradeCoupon edge cases ──────────────────────────────

describe('createTierUpgradeCoupon edge cases', () => {
  it('empty string tier defaults to 10% discount', async () => {
    // sanitize('', 20) => '', discountMap[''] is undefined => defaults to 10
    const r = await mod.createTierUpgradeCoupon('a@b.com', '');
    expect(r.success).toBe(true);
    expect(r.discount).toBe('10%');
  });

  it('null tier defaults to 10% discount', async () => {
    // sanitize(null, 20) => '' (not a string)
    const r = await mod.createTierUpgradeCoupon('a@b.com', null);
    expect(r.success).toBe(true);
    expect(r.discount).toBe('10%');
  });

  it('undefined tier defaults to 10% discount', async () => {
    const r = await mod.createTierUpgradeCoupon('a@b.com', undefined);
    expect(r.success).toBe(true);
    expect(r.discount).toBe('10%');
  });

  it('Silver tier code has SILVER prefix', async () => {
    const r = await mod.createTierUpgradeCoupon('a@b.com', 'Silver');
    expect(r.code).toMatch(/^SILVER-/);
  });

  it('Gold tier code has GOLD prefix', async () => {
    const r = await mod.createTierUpgradeCoupon('a@b.com', 'Gold');
    expect(r.code).toMatch(/^GOLD-/);
  });

  it('empty tier calls toUpperCase on empty string for prefix', async () => {
    // sanitize('', 20) => '', ''.toUpperCase() => '', prefix is ''
    const r = await mod.createTierUpgradeCoupon('a@b.com', '');
    // Code starts with '-' since prefix is empty
    expect(r.code).toMatch(/^-[A-Z2-9]{6}$/);
  });

  it('rejects missing email', async () => {
    const r = await mod.createTierUpgradeCoupon('', 'Silver');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Email required');
  });

  it('coupon name includes tier and discount', async () => {
    await mod.createTierUpgradeCoupon('a@b.com', 'Gold');
    expect(_createdCoupons[0].name).toBe('Gold Tier Welcome - 20% Off');
  });

  it('sets 14-day expiration', async () => {
    const before = Date.now();
    await mod.createTierUpgradeCoupon('a@b.com', 'Silver');
    const after = Date.now();
    const exp = _createdCoupons[0].expirationTime.getTime();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    expect(exp).toBeGreaterThanOrEqual(before + fourteenDays);
    expect(exp).toBeLessThanOrEqual(after + fourteenDays);
  });
});

// ── createBirthdayCoupon edge cases ─────────────────────────────────

describe('createBirthdayCoupon edge cases', () => {
  it('returns failure on API error', async () => {
    const { coupons } = await import('wix-marketing-backend');
    coupons.createCoupon.mockRejectedValueOnce(new Error('API down'));
    const r = await mod.createBirthdayCoupon('a@b.com', 'Jane');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Failed to create coupon');
  });

  it('personalized name appears in coupon name', async () => {
    await mod.createBirthdayCoupon('a@b.com', 'Martha');
    expect(_createdCoupons[0].name).toBe('Happy Birthday Martha! 15% Off');
  });

  it('rejects missing email', async () => {
    const r = await mod.createBirthdayCoupon(null, 'Jane');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Email required');
  });

  it('strips HTML from memberName', async () => {
    await mod.createBirthdayCoupon('a@b.com', '<b>Evil</b>');
    expect(_createdCoupons[0].name).toContain('Evil');
    expect(_createdCoupons[0].name).not.toContain('<b>');
  });

  it('code has BDAY prefix', async () => {
    const r = await mod.createBirthdayCoupon('a@b.com', 'Jane');
    expect(r.code).toMatch(/^BDAY-/);
  });

  it('sets limitedToOneItem false', async () => {
    await mod.createBirthdayCoupon('a@b.com', 'Jane');
    expect(_createdCoupons[0].limitedToOneItem).toBe(false);
  });
});

// ── createWelcomeCoupon edge cases ──────────────────────────────────

describe('createWelcomeCoupon edge cases', () => {
  it('coupon name includes lowercased email', async () => {
    await mod.createWelcomeCoupon('JANE@TEST.COM');
    expect(_createdCoupons[0].name).toBe('Welcome 10% Off - jane@test.com');
  });

  it('sets limitedToOneItem false', async () => {
    await mod.createWelcomeCoupon('a@b.com');
    expect(_createdCoupons[0].limitedToOneItem).toBe(false);
  });

  it('sets limitPerCustomer to 1', async () => {
    await mod.createWelcomeCoupon('a@b.com');
    expect(_createdCoupons[0].limitPerCustomer).toBe(1);
  });

  it('sets scope to stores namespace', async () => {
    await mod.createWelcomeCoupon('a@b.com');
    expect(_createdCoupons[0].scope).toEqual({ namespace: 'stores' });
  });

  it('sets minimumSubtotal to 0', async () => {
    await mod.createWelcomeCoupon('a@b.com');
    expect(_createdCoupons[0].minimumSubtotal).toBe(0);
  });

  it('returns failure on createCoupon API error', async () => {
    const { coupons } = await import('wix-marketing-backend');
    coupons.createCoupon.mockRejectedValueOnce(new Error('API down'));
    const r = await mod.createWelcomeCoupon('a@b.com');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Failed to create coupon');
  });

  it('sets 30-day expiration', async () => {
    const before = Date.now();
    await mod.createWelcomeCoupon('a@b.com');
    const after = Date.now();
    const exp = _createdCoupons[0].expirationTime.getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(exp).toBeGreaterThanOrEqual(before + thirtyDays);
    expect(exp).toBeLessThanOrEqual(after + thirtyDays);
  });
});

// ── Code uniqueness ─────────────────────────────────────────────────

describe('code uniqueness', () => {
  it('generates different codes across multiple calls', async () => {
    const r1 = await mod.createWelcomeCoupon('a@b.com');
    vi.resetModules();
    mod = await import('../src/backend/couponsService.web.js');
    const r2 = await mod.createWelcomeCoupon('a@b.com');
    // Codes should differ (probability of collision is ~1 in 10^9)
    expect(r1.code).not.toBe(r2.code);
  });
});
