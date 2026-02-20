import { describe, it, expect, beforeEach } from 'vitest';
import { __setAccount, __setRewards } from './__mocks__/wix-loyalty.v2.js';
import {
  getMyLoyaltyAccount,
  getAvailableRewards,
  redeemReward,
  getLoyaltyTiers,
} from '../src/backend/loyaltyService.web.js';

// ── getMyLoyaltyAccount ──────────────────────────────────────────────

describe('getMyLoyaltyAccount', () => {
  it('returns Bronze tier with zero points for new member', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.points).toBe(0);
    expect(result.nextTier).toBe('Silver');
    expect(result.pointsToNext).toBe(500);
  });

  it('returns Bronze tier with progress for member with some points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 250 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.points).toBe(250);
    expect(result.progress).toBe(50);
    expect(result.pointsToNext).toBe(250);
  });

  it('returns Silver tier at 500 points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Silver');
    expect(result.tierDiscount).toBe(5);
    expect(result.nextTier).toBe('Gold');
  });

  it('returns Gold tier at 1500+ points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 2000 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Gold');
    expect(result.tierDiscount).toBe(10);
    expect(result.nextTier).toBeNull();
    expect(result.progress).toBe(100);
  });

  it('returns default Bronze when no account exists', async () => {
    __setAccount(null);
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.points).toBe(0);
  });
});

// ── getAvailableRewards ──────────────────────────────────────────────

describe('getAvailableRewards', () => {
  it('returns active rewards', async () => {
    __setRewards([
      { _id: 'r-1', name: '10% Off', description: 'Discount', requiredPoints: 200, active: true, type: 'discount' },
      { _id: 'r-2', name: 'Free Shipping', description: 'Free ship', requiredPoints: 100, active: true, type: 'freeShipping' },
      { _id: 'r-3', name: 'Expired Reward', description: 'Old', requiredPoints: 50, active: false },
    ]);
    const result = await getAvailableRewards();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('10% Off');
    expect(result[0].pointsCost).toBe(200);
  });

  it('returns empty array when no rewards exist', async () => {
    __setRewards([]);
    const result = await getAvailableRewards();
    expect(result).toEqual([]);
  });
});

// ── redeemReward ─────────────────────────────────────────────────────

describe('redeemReward', () => {
  it('returns error for missing reward ID', async () => {
    const result = await redeemReward(null);
    expect(result.success).toBe(false);
  });

  it('redeems reward successfully when member has enough points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    __setRewards([{ _id: 'r-1', name: '10% Off', requiredPoints: 200, active: true }]);
    const result = await redeemReward('r-1');
    expect(result.success).toBe(true);
    expect(result.couponCode).toBe('REWARD-TEST123');
  });

  it('returns error when member has insufficient points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 50 } });
    __setRewards([{ _id: 'r-1', name: '10% Off', requiredPoints: 200, active: true }]);
    const result = await redeemReward('r-1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Not enough points');
  });
});

// ── getLoyaltyTiers ──────────────────────────────────────────────────

describe('getLoyaltyTiers', () => {
  it('returns three tiers', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers).toHaveLength(3);
    expect(tiers.map(t => t.name)).toEqual(['Bronze', 'Silver', 'Gold']);
  });

  it('Gold tier has highest point threshold', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers[2].minPoints).toBe(1500);
    expect(tiers[2].benefits).toContain('10% member discount');
  });
});
