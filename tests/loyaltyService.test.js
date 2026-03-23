import { describe, it, expect, beforeEach } from 'vitest';
import { __setAccount, __setRewards, accounts, rewards } from './__mocks__/wix-loyalty.v2.js';
import { __reset as resetData, __seed, __setQueryError } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import {
  getMyLoyaltyAccount,
  getAvailableRewards,
  redeemReward,
  getLoyaltyTiers,
  getLeaderboard,
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

  it('returns Silver tier at exactly 500 points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Silver');
    expect(result.tierDiscount).toBe(5);
    expect(result.nextTier).toBe('Gold');
  });

  it('returns Silver tier progress toward Gold', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 1000 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Silver');
    expect(result.nextTier).toBe('Gold');
    expect(result.pointsToNext).toBe(500); // 1500 - 1000
    expect(result.progress).toBe(67); // round(1000/1500 * 100)
  });

  it('returns Gold tier at exactly 1500 points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 1500 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Gold');
    expect(result.tierDiscount).toBe(10);
    expect(result.nextTier).toBeNull();
    expect(result.progress).toBe(100);
    expect(result.pointsToNext).toBe(0);
  });

  it('returns Gold tier at 2000+ points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 2000 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Gold');
    expect(result.nextTier).toBeNull();
    expect(result.progress).toBe(100);
  });

  it('returns default Bronze when no account exists', async () => {
    __setAccount(null);
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.points).toBe(0);
    expect(result.nextTier).toBe('Silver');
    expect(result.progress).toBe(0);
    expect(result.pointsToNext).toBe(500);
  });

  it('includes accountId in response', async () => {
    __setAccount({ _id: 'acc-42', points: { balance: 100 } });
    const result = await getMyLoyaltyAccount();
    expect(result.accountId).toBe('acc-42');
  });

  it('handles account with missing points object', async () => {
    __setAccount({ _id: 'acc-1' });
    const result = await getMyLoyaltyAccount();
    expect(result.points).toBe(0);
    expect(result.tier).toBe('Bronze');
  });

  it('returns Bronze fallback on API error', async () => {
    accounts.getMyAccount.mockRejectedValueOnce(new Error('API down'));
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.points).toBe(0);
    expect(result.pointsToNext).toBe(500);
  });

  it('caps progress at 100 for Gold members', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 5000 } });
    const result = await getMyLoyaltyAccount();
    expect(result.progress).toBe(100);
  });

  it('returns 0% progress for zero-point Bronze member', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    const result = await getMyLoyaltyAccount();
    expect(result.progress).toBe(0);
  });

  it('returns Bronze tier discount of 0', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 100 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tierDiscount).toBe(0);
  });
});

// ── getAvailableRewards ──────────────────────────────────────────────

describe('getAvailableRewards', () => {
  it('returns only active rewards', async () => {
    __setRewards([
      { _id: 'r-1', name: '10% Off', description: 'Discount', requiredPoints: 200, active: true, type: 'discount' },
      { _id: 'r-2', name: 'Free Shipping', description: 'Free ship', requiredPoints: 100, active: true, type: 'freeShipping' },
      { _id: 'r-3', name: 'Expired Reward', description: 'Old', requiredPoints: 50, active: false },
    ]);
    const result = await getAvailableRewards();
    expect(result).toHaveLength(2);
    const ids = result.map(r => r._id);
    expect(ids).toContain('r-1');
    expect(ids).toContain('r-2');
    expect(ids).not.toContain('r-3');
  });

  it('maps fields correctly', async () => {
    __setRewards([
      { _id: 'r-1', name: '10% Off', description: 'Get discount', requiredPoints: 200, active: true, type: 'discount' },
    ]);
    const result = await getAvailableRewards();
    expect(result[0]).toEqual({
      _id: 'r-1',
      name: '10% Off',
      description: 'Get discount',
      pointsCost: 200,
      type: 'discount',
    });
  });

  it('defaults description to empty string when missing', async () => {
    __setRewards([
      { _id: 'r-1', name: 'No Desc', requiredPoints: 100, active: true, type: 'discount' },
    ]);
    const result = await getAvailableRewards();
    expect(result[0].description).toBe('');
  });

  it('defaults pointsCost to 0 when requiredPoints missing', async () => {
    __setRewards([
      { _id: 'r-1', name: 'Free Reward', active: true, type: 'discount' },
    ]);
    const result = await getAvailableRewards();
    expect(result[0].pointsCost).toBe(0);
  });

  it('defaults type to discount when missing', async () => {
    __setRewards([
      { _id: 'r-1', name: 'Untyped', active: true, requiredPoints: 50 },
    ]);
    const result = await getAvailableRewards();
    expect(result[0].type).toBe('discount');
  });

  it('returns empty array when no rewards exist', async () => {
    __setRewards([]);
    const result = await getAvailableRewards();
    expect(result).toEqual([]);
  });

  it('returns empty array on API error', async () => {
    rewards.listRewards.mockRejectedValueOnce(new Error('API down'));
    const result = await getAvailableRewards();
    expect(result).toEqual([]);
  });

  it('does not include inactive rewards even with high points', async () => {
    __setRewards([
      { _id: 'r-1', name: 'Inactive High', requiredPoints: 10, active: false },
    ]);
    const result = await getAvailableRewards();
    expect(result).toEqual([]);
  });
});

// ── redeemReward ─────────────────────────────────────────────────────

describe('redeemReward', () => {
  it('returns error for missing reward ID', async () => {
    const result = await redeemReward(null);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Reward ID is required');
  });

  it('returns error for empty string reward ID', async () => {
    const result = await redeemReward('');
    expect(result.success).toBe(false);
  });

  it('redeems reward successfully when member has enough points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    __setRewards([{ _id: 'r-1', name: '10% Off', requiredPoints: 200, active: true }]);
    const result = await redeemReward('r-1');
    expect(result.success).toBe(true);
    expect(result.couponCode).toBe('REWARD-TEST123');
  });

  it('includes reward name in success message', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    __setRewards([{ _id: 'r-1', name: '10% Off', requiredPoints: 200, active: true }]);
    const result = await redeemReward('r-1');
    expect(result.message).toBe('Redeemed: 10% Off');
  });

  it('returns error when member has insufficient points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 50 } });
    __setRewards([{ _id: 'r-1', name: '10% Off', requiredPoints: 200, active: true }]);
    const result = await redeemReward('r-1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Not enough points');
  });

  it('returns error when reward not found', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    __setRewards([]);
    const result = await redeemReward('r-nonexistent');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Reward not found');
  });

  it('returns error when no loyalty account exists', async () => {
    __setAccount(null);
    __setRewards([{ _id: 'r-1', name: '10% Off', requiredPoints: 200, active: true }]);
    const result = await redeemReward('r-1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Loyalty account not found');
  });

  it('calls rewards.redeemReward with sanitized ID', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    __setRewards([{ _id: 'r-1', name: '10% Off', requiredPoints: 200, active: true }]);
    await redeemReward('r-1');
    expect(rewards.redeemReward).toHaveBeenCalledWith('r-1');
  });

  it('returns failure on API error during redemption', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    __setRewards([{ _id: 'r-1', name: '10% Off', requiredPoints: 200, active: true }]);
    rewards.redeemReward.mockRejectedValueOnce(new Error('Redemption failed'));
    const result = await redeemReward('r-1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to redeem reward');
  });

  it('handles reward with zero requiredPoints', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    __setRewards([{ _id: 'r-free', name: 'Free Gift', requiredPoints: 0, active: true }]);
    const result = await redeemReward('r-free');
    expect(result.success).toBe(true);
  });

  it('redeems exactly at point threshold', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 200 } });
    __setRewards([{ _id: 'r-1', name: 'Exact Match', requiredPoints: 200, active: true }]);
    const result = await redeemReward('r-1');
    expect(result.success).toBe(true);
  });

  it('handles couponCode being null in redemption response', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    __setRewards([{ _id: 'r-1', name: 'No Code', requiredPoints: 100, active: true }]);
    rewards.redeemReward.mockResolvedValueOnce({});
    const result = await redeemReward('r-1');
    expect(result.success).toBe(true);
    expect(result.couponCode).toBeNull();
  });
});

// ── getLoyaltyTiers ──────────────────────────────────────────────────

describe('getLoyaltyTiers', () => {
  it('returns three tiers in order', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers).toHaveLength(3);
    expect(tiers.map(t => t.name)).toEqual(['Bronze', 'Silver', 'Gold']);
  });

  it('Bronze tier starts at 0 points', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers[0].minPoints).toBe(0);
  });

  it('Silver tier starts at 500 points', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers[1].minPoints).toBe(500);
  });

  it('Gold tier starts at 1500 points', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers[2].minPoints).toBe(1500);
  });

  it('each tier has a benefits array', async () => {
    const tiers = await getLoyaltyTiers();
    for (const tier of tiers) {
      expect(Array.isArray(tier.benefits)).toBe(true);
      expect(tier.benefits.length).toBeGreaterThan(0);
    }
  });

  it('Silver tier includes 5% member discount', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers[1].benefits).toContain('5% member discount');
  });

  it('Gold tier includes 10% member discount', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers[2].benefits).toContain('10% member discount');
  });

  it('Gold tier includes priority support', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers[2].benefits).toContain('Priority support');
  });

  it('tiers have increasing minPoints thresholds', async () => {
    const tiers = await getLoyaltyTiers();
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].minPoints).toBeGreaterThan(tiers[i - 1].minPoints);
    }
  });
});

// ── getLeaderboard ───────────────────────────────────────────────────

describe('getLeaderboard', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
  });

  it('returns entries sorted by points DESC', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-b', nickname: 'Bob', points: 100, tier: 'Bronze', lastActivityDate: new Date() },
      { memberId: 'mem-a', nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
      { memberId: 'mem-c', nickname: 'Carol', points: 250, tier: 'Bronze', lastActivityDate: new Date() },
    ]);
    const result = await getLeaderboard();
    expect(result.entries.map(e => e.memberId)).toEqual(['mem-a', 'mem-c', 'mem-b']);
  });

  it('returns correct rank numbers', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-a', nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
      { memberId: 'mem-b', nickname: 'Bob', points: 300, tier: 'Bronze', lastActivityDate: new Date() },
      { memberId: 'mem-c', nickname: 'Carol', points: 100, tier: 'Bronze', lastActivityDate: new Date() },
    ]);
    const result = await getLeaderboard();
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[1].rank).toBe(2);
    expect(result.entries[2].rank).toBe(3);
  });

  it('marks current member with isCurrentUser: true', async () => {
    __setMember({ _id: 'mem-b' });
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-a', nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
      { memberId: 'mem-b', nickname: 'Bob', points: 300, tier: 'Bronze', lastActivityDate: new Date() },
    ]);
    const result = await getLeaderboard();
    expect(result.entries.find(e => e.memberId === 'mem-a').isCurrentUser).toBe(false);
    expect(result.entries.find(e => e.memberId === 'mem-b').isCurrentUser).toBe(true);
  });

  it('caps limit at 50 entries', async () => {
    __setMember({ _id: 'mem-0' });
    const items = Array.from({ length: 60 }, (_, i) => ({
      memberId: `mem-${i}`, nickname: `User${i}`,
      points: 1000 - i * 10, tier: 'Bronze', lastActivityDate: new Date(),
    }));
    __seed('LoyaltyAccounts', items);
    const result = await getLeaderboard({ limit: 100 });
    expect(result.entries.length).toBeLessThanOrEqual(50);
  });

  it('weekly period filters by lastActivityDate', async () => {
    __setMember({ _id: 'mem-a' });
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const beforeWeek = new Date(startOfWeek.getTime() - 86400000);

    __seed('LoyaltyAccounts', [
      { memberId: 'mem-a', nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
      { memberId: 'mem-b', nickname: 'Bob', points: 700, tier: 'Gold', lastActivityDate: beforeWeek },
    ]);
    const result = await getLeaderboard({ period: 'weekly' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].memberId).toBe('mem-a');
  });

  it('handles empty collection gracefully', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await getLeaderboard();
    expect(result.entries).toEqual([]);
  });

  it('returns empty entries on query error', async () => {
    __setMember({ _id: 'mem-1' });
    __setQueryError('LoyaltyAccounts', new Error('DB error'));
    const result = await getLeaderboard();
    expect(result.entries).toEqual([]);
  });
});
