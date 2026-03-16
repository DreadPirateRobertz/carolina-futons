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
  validateId: (id) => {
    if (!id || typeof id !== 'string') return '';
    return id.replace(/[^a-zA-Z0-9_-]/g, '');
  },
}));

let _account = null;
let _rewards = [];
let _redeemResult = {};

vi.mock('wix-loyalty.v2', () => ({
  accounts: {
    getMyAccount: vi.fn(async () => _account),
  },
  rewards: {
    listRewards: vi.fn(async () => ({ rewards: _rewards })),
    redeemReward: vi.fn(async () => _redeemResult),
  },
}));

let mod;
beforeEach(async () => {
  _account = null;
  _rewards = [];
  _redeemResult = {};
  vi.resetModules();
  mod = await import('../src/backend/loyaltyService.web.js');
});

describe('getMyLoyaltyAccount', () => {
  it('returns defaults when no account', async () => {
    _account = null;
    const r = await mod.getMyLoyaltyAccount();
    expect(r.points).toBe(0);
    expect(r.tier).toBe('Bronze');
    expect(r.nextTier).toBe('Silver');
    expect(r.pointsToNext).toBe(500);
  });

  it('returns Bronze for low points', async () => {
    _account = { _id: 'acc1', points: { balance: 100 } };
    const r = await mod.getMyLoyaltyAccount();
    expect(r.tier).toBe('Bronze');
    expect(r.nextTier).toBe('Silver');
    expect(r.pointsToNext).toBe(400);
  });

  it('returns Silver for 500+ points', async () => {
    _account = { _id: 'acc1', points: { balance: 800 } };
    const r = await mod.getMyLoyaltyAccount();
    expect(r.tier).toBe('Silver');
    expect(r.tierDiscount).toBe(5);
    expect(r.nextTier).toBe('Gold');
  });

  it('returns Gold for 1500+ points', async () => {
    _account = { _id: 'acc1', points: { balance: 2000 } };
    const r = await mod.getMyLoyaltyAccount();
    expect(r.tier).toBe('Gold');
    expect(r.tierDiscount).toBe(10);
    expect(r.nextTier).toBeNull();
    expect(r.progress).toBe(100);
  });
});

describe('getAvailableRewards', () => {
  it('returns empty when no rewards', async () => {
    _rewards = [];
    const r = await mod.getAvailableRewards();
    expect(r).toEqual([]);
  });

  it('filters to active rewards only', async () => {
    _rewards = [
      { _id: 'r1', name: '$5 Off', active: true, requiredPoints: 100, type: 'discount' },
      { _id: 'r2', name: 'Old Reward', active: false, requiredPoints: 50 },
    ];
    const r = await mod.getAvailableRewards();
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('$5 Off');
    expect(r[0].pointsCost).toBe(100);
  });
});

describe('redeemReward', () => {
  it('rejects empty rewardId', async () => {
    const r = await mod.redeemReward('');
    expect(r.success).toBe(false);
  });

  it('rejects when no account', async () => {
    _account = null;
    const r = await mod.redeemReward('r1');
    expect(r.success).toBe(false);
    expect(r.message).toContain('account not found');
  });

  it('rejects when not enough points', async () => {
    _account = { _id: 'acc1', points: { balance: 10 } };
    _rewards = [{ _id: 'r1', name: '$5 Off', active: true, requiredPoints: 100 }];
    const r = await mod.redeemReward('r1');
    expect(r.success).toBe(false);
    expect(r.message).toContain('Not enough points');
  });

  it('succeeds with enough points', async () => {
    _account = { _id: 'acc1', points: { balance: 500 } };
    _rewards = [{ _id: 'r1', name: '$5 Off', active: true, requiredPoints: 100 }];
    _redeemResult = { couponCode: 'LOYALTY5' };
    const r = await mod.redeemReward('r1');
    expect(r.success).toBe(true);
    expect(r.couponCode).toBe('LOYALTY5');
  });
});

describe('getLoyaltyTiers', () => {
  it('returns 3 tiers', async () => {
    const r = await mod.getLoyaltyTiers();
    expect(r).toHaveLength(3);
    expect(r[0].name).toBe('Bronze');
    expect(r[1].name).toBe('Silver');
    expect(r[2].name).toBe('Gold');
    expect(r[2].minPoints).toBe(1500);
  });
});
