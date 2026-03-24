import { describe, it, expect, beforeEach } from 'vitest';
import { __setAccount, __setRewards, accounts, rewards } from './__mocks__/wix-loyalty.v2.js';
import { __reset as resetData, __seed, __setQueryError, __getInserted, __getLastFindOptions } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import {
  getMyLoyaltyAccount,
  getAvailableRewards,
  redeemReward,
  getLoyaltyTiers,
  getLeaderboard,
  getChallengeCatalog,
  _resetChallengeCatalogCache,
  _resetChallengeCatalogRateLimit,
  recordChallengeCompleteEvent,
  getMyBurnRate,
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
    __seed('MemberGamificationPreferences', [
      { _id: 'p-a', memberId: 'mem-a', leaderboardOptIn: true },
      { _id: 'p-b', memberId: 'mem-b', leaderboardOptIn: true },
      { _id: 'p-c', memberId: 'mem-c', leaderboardOptIn: true },
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
    __seed('MemberGamificationPreferences', [
      { _id: 'p-a', memberId: 'mem-a', leaderboardOptIn: true },
      { _id: 'p-b', memberId: 'mem-b', leaderboardOptIn: true },
      { _id: 'p-c', memberId: 'mem-c', leaderboardOptIn: true },
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
    __seed('MemberGamificationPreferences', [
      { _id: 'p-a', memberId: 'mem-a', leaderboardOptIn: true },
      { _id: 'p-b', memberId: 'mem-b', leaderboardOptIn: true },
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
    __seed('MemberGamificationPreferences', items.map((item, i) => ({
      _id: `p-${i}`, memberId: item.memberId, leaderboardOptIn: true,
    })));
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
    __seed('MemberGamificationPreferences', [
      { _id: 'p-a', memberId: 'mem-a', leaderboardOptIn: true },
      { _id: 'p-b', memberId: 'mem-b', leaderboardOptIn: true },
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

// ── getChallengeCatalog ──────────────────────────────────────────────

describe('getChallengeCatalog', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    _resetChallengeCatalogCache();
    _resetChallengeCatalogRateLimit();
  });

  it('returns active challenges merged with member progress', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('ChallengeDefinitions', [
      { _id: 'def-1', active: true, title: 'Order 3 Times', description: 'Place 3 orders', goal: 3, unit: 'orders', pointReward: 100, expiresAt: null },
      { _id: 'def-2', active: true, title: 'Leave a Review', description: 'Write review', goal: 1, unit: 'reviews', pointReward: 50, expiresAt: null },
    ]);
    __seed('ChallengeProgress', [
      { memberId: 'mem-1', challengeId: 'def-1', completedCount: 2, completedAt: null },
    ]);
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(2);
    const order = result.challenges.find(c => c.id === 'def-1');
    expect(order.progress).toBe(2);
    expect(order.completed).toBe(false);
    const review = result.challenges.find(c => c.id === 'def-2');
    expect(review.progress).toBe(0);
    expect(review.completed).toBe(false);
  });

  it('filters out inactive challenges', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('ChallengeDefinitions', [
      { _id: 'def-1', active: true, title: 'Active', goal: 1, unit: 'x', pointReward: 10, expiresAt: null },
      { _id: 'def-2', active: false, title: 'Inactive', goal: 1, unit: 'x', pointReward: 10, expiresAt: null },
    ]);
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].id).toBe('def-1');
  });

  it('filters out expired challenges (expiresAt in the past)', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('ChallengeDefinitions', [
      { _id: 'def-1', active: true, title: 'Valid', goal: 1, unit: 'x', pointReward: 10, expiresAt: new Date(Date.now() + 86400000) },
      { _id: 'def-2', active: true, title: 'Expired', goal: 1, unit: 'x', pointReward: 10, expiresAt: new Date(Date.now() - 1000) },
    ]);
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].id).toBe('def-1');
  });

  it('includes challenges with null expiresAt (permanent)', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('ChallengeDefinitions', [
      { _id: 'def-1', active: true, title: 'Permanent', goal: 5, unit: 'orders', pointReward: 200, expiresAt: null },
    ]);
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].expiresAt).toBeNull();
  });

  it('marks completed: true when progress >= goal', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('ChallengeDefinitions', [
      { _id: 'def-1', active: true, title: 'Done', goal: 3, unit: 'orders', pointReward: 100, expiresAt: null },
    ]);
    const completedAt = new Date('2026-03-20');
    __seed('ChallengeProgress', [
      { memberId: 'mem-1', challengeId: 'def-1', completedCount: 3, completedAt },
    ]);
    const result = await getChallengeCatalog();
    expect(result.challenges[0].completed).toBe(true);
    expect(result.challenges[0].completedAt).toBe(completedAt.toISOString());
  });

  it('returns correct response shape for each challenge', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('ChallengeDefinitions', [
      { _id: 'def-1', active: true, title: 'Shape', description: 'Desc', goal: 5, unit: 'reviews', pointReward: 150, expiresAt: null },
    ]);
    const result = await getChallengeCatalog();
    expect(result.challenges[0]).toMatchObject({
      id: 'def-1', title: 'Shape', description: 'Desc',
      goal: 5, unit: 'reviews', pointReward: 150,
      expiresAt: null, progress: 0, completed: false, completedAt: null,
    });
  });

  it('returns cached result on second call within 5min', async () => {
    __setMember({ _id: 'mem-cache' });
    __seed('ChallengeDefinitions', [
      { _id: 'def-1', active: true, title: 'Cached', goal: 1, unit: 'x', pointReward: 10, expiresAt: null },
    ]);
    await getChallengeCatalog();
    __seed('ChallengeDefinitions', []); // mutate store — cache should shield this
    const result2 = await getChallengeCatalog();
    expect(result2.challenges).toHaveLength(1);
  });

  it('returns 429 after 30 calls per minute', async () => {
    __setMember({ _id: 'mem-rl' });
    for (let i = 0; i < 30; i++) {
      _resetChallengeCatalogCache();
      await getChallengeCatalog();
    }
    _resetChallengeCatalogCache();
    const result = await getChallengeCatalog();
    expect(result).toEqual({ status: 429, error: 'Rate limit exceeded' });
  });

  it('handles empty ChallengeDefinitions gracefully', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await getChallengeCatalog();
    expect(result.challenges).toEqual([]);
  });

  it('returns empty challenges on query error', async () => {
    __setMember({ _id: 'mem-1' });
    __setQueryError('ChallengeDefinitions', new Error('DB error'));
    const result = await getChallengeCatalog();
    expect(result.challenges).toEqual([]);
  });
});

// ── recordChallengeCompleteEvent ─────────────────────────────────────

const BASE_CHALLENGE_FOR_LEDGER = {
  _id: 'ch-1', challengeId: 'ch-1', title: 'Order 3 Times',
  conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50,
  active: true, expiresAt: null,
};

describe('recordChallengeCompleteEvent', () => {
  beforeEach(() => { resetData(); resetMembers(); });

  it('inserts a PointsLedger record with correct fields', async () => {
    __seed('Challenges', [BASE_CHALLENGE_FOR_LEDGER]);
    await recordChallengeCompleteEvent('mem-1', 'ch-1', 50);
    const ledger = __getInserted('PointsLedger');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].memberId).toBe('mem-1');
    expect(ledger[0].type).toBe('challenge_complete');
    expect(ledger[0].challengeId).toBe('ch-1');
    expect(ledger[0].description).toBe('Order 3 Times completed');
    expect(ledger[0].points).toBe(50);
    expect(ledger[0].earnedAt).toBeInstanceOf(Date);
  });

  it('is idempotent — does not insert when PointsLedger record already exists', async () => {
    __seed('Challenges', [BASE_CHALLENGE_FOR_LEDGER]);
    __seed('PointsLedger', [
      { _id: 'pl-1', memberId: 'mem-1', type: 'challenge_complete', challengeId: 'ch-1', points: 50 },
    ]);
    await recordChallengeCompleteEvent('mem-1', 'ch-1', 50);
    // __getInserted returns seeded + newly inserted items.
    // 1 seeded + 0 new inserts = 1 total confirms idempotency.
    const ledger = __getInserted('PointsLedger');
    expect(ledger).toHaveLength(1);
    expect(ledger[0]._id).toBe('pl-1'); // original record unchanged
  });

  it('throws TypeError for invalid memberId', async () => {
    __seed('Challenges', [BASE_CHALLENGE_FOR_LEDGER]);
    await expect(recordChallengeCompleteEvent('', 'ch-1', 50)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompleteEvent(null, 'ch-1', 50)).rejects.toThrow(TypeError);
    expect(__getInserted('PointsLedger')).toHaveLength(0);
  });

  it('throws TypeError for invalid challengeId', async () => {
    await expect(recordChallengeCompleteEvent('mem-1', '', 50)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompleteEvent('mem-1', null, 50)).rejects.toThrow(TypeError);
    expect(__getInserted('PointsLedger')).toHaveLength(0);
  });

  it('throws TypeError for non-positive or non-finite points', async () => {
    __seed('Challenges', [BASE_CHALLENGE_FOR_LEDGER]);
    await expect(recordChallengeCompleteEvent('mem-1', 'ch-1', NaN)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompleteEvent('mem-1', 'ch-1', Infinity)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompleteEvent('mem-1', 'ch-1', -1)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompleteEvent('mem-1', 'ch-1', 0)).rejects.toThrow(TypeError);
  });

  it('uses challengeId as fallback description when challenge title not found', async () => {
    await recordChallengeCompleteEvent('mem-1', 'unknown-ch', 25);
    const ledger = __getInserted('PointsLedger');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].description).toBe('unknown-ch completed');
  });
});

// ── CF-thb: getLeaderboard — leaderboardOptIn preference gate ────────────────

describe('getLeaderboard — leaderboardOptIn gate', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
  });

  it('excludes members where leaderboardOptIn is false', async () => {
    __setMember({ _id: 'mem-viewer' });
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-a', nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
      { memberId: 'mem-b', nickname: 'Bob',   points: 300, tier: 'Bronze', lastActivityDate: new Date() },
    ]);
    __seed('MemberGamificationPreferences', [
      { _id: 'pref-a', memberId: 'mem-a', leaderboardOptIn: true },
      { _id: 'pref-b', memberId: 'mem-b', leaderboardOptIn: false },
    ]);
    const result = await getLeaderboard();
    const ids = result.entries.map(e => e.memberId);
    expect(ids).toContain('mem-a');
    expect(ids).not.toContain('mem-b');
  });

  it('excludes members with no preferences record (default leaderboardOptIn: false)', async () => {
    __setMember({ _id: 'mem-viewer' });
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-opt-in',  nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
      { memberId: 'mem-no-pref', nickname: 'Bob',   points: 300, tier: 'Bronze', lastActivityDate: new Date() },
    ]);
    // Only mem-opt-in has a preferences record with leaderboardOptIn: true
    __seed('MemberGamificationPreferences', [
      { _id: 'pref-1', memberId: 'mem-opt-in', leaderboardOptIn: true },
    ]);
    const result = await getLeaderboard();
    const ids = result.entries.map(e => e.memberId);
    expect(ids).toContain('mem-opt-in');
    expect(ids).not.toContain('mem-no-pref');
  });

  it('returns empty entries when no members have opted in', async () => {
    __setMember({ _id: 'mem-viewer' });
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-a', nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
    ]);
    // No MemberGamificationPreferences → default is opt-out
    const result = await getLeaderboard();
    expect(result.entries).toHaveLength(0);
  });

  it('includes all opted-in members and assigns sequential ranks', async () => {
    __setMember({ _id: 'mem-viewer' });
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-a', nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
      { memberId: 'mem-b', nickname: 'Bob',   points: 300, tier: 'Bronze', lastActivityDate: new Date() },
      { memberId: 'mem-c', nickname: 'Carol', points: 100, tier: 'Bronze', lastActivityDate: new Date() },
    ]);
    __seed('MemberGamificationPreferences', [
      { _id: 'pref-a', memberId: 'mem-a', leaderboardOptIn: true },
      { _id: 'pref-b', memberId: 'mem-b', leaderboardOptIn: true },
      // mem-c has no prefs → excluded
    ]);
    const result = await getLeaderboard();
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].memberId).toBe('mem-a');
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[1].memberId).toBe('mem-b');
    expect(result.entries[1].rank).toBe(2);
  });
});

// ── getMyBurnRate ──────────────────────────────────────────────────────────────

describe('getMyBurnRate', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    __setAccount(null);
    __setRewards([]);
  });

  it('returns 401 when no member is authenticated', async () => {
    const result = await getMyBurnRate();
    expect(result).toEqual({ status: 401, error: 'Unauthenticated' });
  });

  it('returns 401 when member has no _id', async () => {
    __setMember({});
    const result = await getMyBurnRate();
    expect(result).toEqual({ status: 401, error: 'Unauthenticated' });
  });

  it('returns zero avgMonthlyPoints when no ledger entries exist', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 50 } });
    const result = await getMyBurnRate();
    expect(result.avgMonthlyPoints).toBe(0);
    expect(result.currentBalance).toBe(50);
  });

  it('sums points from PointsLedger entries in the last 30 days', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    const recent = new Date(Date.now() - 5 * 86400000); // 5 days ago
    __seed('PointsLedger', [
      { _id: 'pl-1', memberId: 'mem-1', points: 100, earnedAt: recent },
      { _id: 'pl-2', memberId: 'mem-1', points: 50, earnedAt: recent },
    ]);
    const result = await getMyBurnRate();
    expect(result.avgMonthlyPoints).toBe(150);
  });

  it('excludes entries older than 30 days', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    const old = new Date(Date.now() - 31 * 86400000);
    const recent = new Date(Date.now() - 5 * 86400000);
    __seed('PointsLedger', [
      { _id: 'pl-1', memberId: 'mem-1', points: 999, earnedAt: old },
      { _id: 'pl-2', memberId: 'mem-1', points: 40, earnedAt: recent },
    ]);
    const result = await getMyBurnRate();
    expect(result.avgMonthlyPoints).toBe(40);
  });

  it('only counts ledger entries for the authenticated member', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    const recent = new Date(Date.now() - 5 * 86400000);
    __seed('PointsLedger', [
      { _id: 'pl-1', memberId: 'mem-1', points: 30, earnedAt: recent },
      { _id: 'pl-2', memberId: 'mem-2', points: 999, earnedAt: recent },
    ]);
    const result = await getMyBurnRate();
    expect(result.avgMonthlyPoints).toBe(30);
  });

  it('returns null reward fields when no rewards exist', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 100 } });
    const result = await getMyBurnRate();
    expect(result.nearestRewardCost).toBeNull();
    expect(result.nearestRewardName).toBeNull();
    expect(result.projectedRewardDate).toBeNull();
    expect(result.daysTill).toBeNull();
  });

  it('returns daysTill 0 and redeem message when balance >= nearest reward cost', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 200 } });
    __setRewards([{ _id: 'rw-1', name: 'Free Shipping', requiredPoints: 100, active: true }]);
    const result = await getMyBurnRate();
    expect(result.daysTill).toBe(0);
    expect(result.nearestRewardCost).toBe(100);
    expect(result.nearestRewardName).toBe('Free Shipping');
    expect(result.message).toMatch(/redeem/i);
  });

  it('projects reward date from burn rate', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    const recent = new Date(Date.now() - 5 * 86400000);
    // 300 pts in last 30 days → 10 pts/day; need 100 → daysTill 10
    __seed('PointsLedger', [
      { _id: 'pl-1', memberId: 'mem-1', points: 300, earnedAt: recent },
    ]);
    __setRewards([{ _id: 'rw-1', name: 'Discount', requiredPoints: 100, active: true }]);
    const result = await getMyBurnRate();
    expect(result.daysTill).toBe(10);
    expect(result.projectedRewardDate).toBeTruthy();
  });

  it('selects the cheapest active reward from multiple', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    __setRewards([
      { _id: 'rw-1', name: 'Expensive', requiredPoints: 500, active: true },
      { _id: 'rw-2', name: 'Cheap', requiredPoints: 100, active: true },
      { _id: 'rw-3', name: 'Middle', requiredPoints: 250, active: true },
    ]);
    const result = await getMyBurnRate();
    expect(result.nearestRewardName).toBe('Cheap');
    expect(result.nearestRewardCost).toBe(100);
  });

  it('ignores inactive rewards', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    __setRewards([
      { _id: 'rw-1', name: 'Inactive Cheap', requiredPoints: 50, active: false },
      { _id: 'rw-2', name: 'Active', requiredPoints: 200, active: true },
    ]);
    const result = await getMyBurnRate();
    expect(result.nearestRewardName).toBe('Active');
    expect(result.nearestRewardCost).toBe(200);
  });

  it('uses suppressAuth: true when querying PointsLedger', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    await getMyBurnRate();
    expect(__getLastFindOptions('PointsLedger')).toMatchObject({ suppressAuth: true });
  });

  it('returns zero defaults when wixData query throws', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    __setQueryError('PointsLedger', new Error('DB error'));
    const result = await getMyBurnRate();
    expect(result.avgMonthlyPoints).toBe(0);
    expect(result.projectedRewardDate).toBeNull();
  });

  it('returns currentBalance 0 when getMyAccount returns null', async () => {
    __setMember({ _id: 'mem-1' });
    __setAccount(null);
    const result = await getMyBurnRate();
    expect(result.currentBalance).toBe(0);
  });

  it('returns 429 after 30 calls per minute', async () => {
    __setMember({ _id: 'mem-rl' });
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    for (let i = 0; i < 30; i++) await getMyBurnRate();
    const result = await getMyBurnRate();
    expect(result).toEqual({ status: 429, error: 'Rate limit exceeded' });
  });
});
