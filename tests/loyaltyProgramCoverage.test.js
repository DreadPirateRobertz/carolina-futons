/**
 * Tests for loyaltyService.web.js + loyaltyBonusPoints.web.js (loyaltyTiers.web.js retired in cf-4x7e.B3)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetData, __seed } from 'wix-data';
import { __setAccount, __setRewards, __reset as resetLoyalty, accounts, rewards } from 'wix-loyalty.v2';
import { __setMember, __reset as resetMembers } from 'wix-members-backend';

// ── loyaltyService ────────────────────────────────────────────────────
import {
  getMyLoyaltyAccount,
  getAvailableRewards,
  redeemReward,
  getLoyaltyTiers,
} from 'backend/loyaltyService.web';

// ── loyaltyBonusPoints ────────────────────────────────────────────────
import {
  getEarningConfig,
  awardBonusPoints,
  BONUS_POINTS,
} from 'backend/loyaltyBonusPoints.web';

beforeEach(() => {
  resetData();
  resetLoyalty();
  resetMembers();
});

// ═══════════════════════════════════════════════════════════════════════
// loyaltyService.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('loyaltyService — getMyLoyaltyAccount', () => {
  it('returns Bronze defaults when no account exists', async () => {
    __setAccount(null);
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.points).toBe(0);
    expect(result.nextTier).toBe('Silver');
    expect(result.progress).toBe(0);
    expect(result.pointsToNext).toBe(500);
  });

  it('returns Bronze tier for 0 points', async () => {
    __setAccount({ _id: 'a1', points: { balance: 0 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.nextTier).toBe('Silver');
    expect(result.pointsToNext).toBe(500);
    expect(result.progress).toBe(0);
    expect(result.accountId).toBe('a1');
  });

  it('returns Silver tier for 500 points', async () => {
    __setAccount({ _id: 'a2', points: { balance: 500 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Silver');
    expect(result.tierDiscount).toBe(5);
    expect(result.nextTier).toBe('Gold');
    expect(result.pointsToNext).toBe(1000);
    expect(result.progress).toBe(33); // 500/1500 * 100 ≈ 33
  });

  it('returns Gold tier for 1500+ points with no next tier', async () => {
    __setAccount({ _id: 'a3', points: { balance: 2000 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Gold');
    expect(result.tierDiscount).toBe(10);
    expect(result.nextTier).toBeNull();
    expect(result.pointsToNext).toBe(0);
    expect(result.progress).toBe(100);
  });

  it('handles account with missing points object', async () => {
    __setAccount({ _id: 'a4' }); // no points field
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.points).toBe(0);
  });

  it('returns Bronze defaults on API error', async () => {
    accounts.getMyAccount.mockRejectedValueOnce(new Error('API down'));
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.points).toBe(0);
  });

  it('calculates progress correctly at boundary', async () => {
    __setAccount({ _id: 'a5', points: { balance: 499 } });
    const result = await getMyLoyaltyAccount();
    expect(result.tier).toBe('Bronze');
    expect(result.progress).toBe(100); // 499/500 * 100 = 99.8 → rounds to 100, capped at 100
  });
});

describe('loyaltyService — getAvailableRewards', () => {
  it('returns empty array when no rewards exist', async () => {
    __setRewards([]);
    const result = await getAvailableRewards();
    expect(result).toEqual([]);
  });

  it('filters out inactive rewards', async () => {
    __setRewards([
      { _id: 'r1', name: 'Free Shipping', active: true, requiredPoints: 100, type: 'shipping' },
      { _id: 'r2', name: 'Old Reward', active: false, requiredPoints: 50 },
    ]);
    const result = await getAvailableRewards();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Free Shipping');
    expect(result[0].pointsCost).toBe(100);
    expect(result[0].type).toBe('shipping');
  });

  it('defaults description to empty and type to discount', async () => {
    __setRewards([{ _id: 'r3', name: 'Basic', active: true }]);
    const result = await getAvailableRewards();
    expect(result[0].description).toBe('');
    expect(result[0].pointsCost).toBe(0);
    expect(result[0].type).toBe('discount');
  });

  it('returns empty array on API error', async () => {
    rewards.listRewards.mockRejectedValueOnce(new Error('API error'));
    const result = await getAvailableRewards();
    expect(result).toEqual([]);
  });
});

describe('loyaltyService — redeemReward', () => {
  it('rejects missing rewardId', async () => {
    const result = await redeemReward(null);
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('rejects invalid rewardId format', async () => {
    const result = await redeemReward('not a valid id!!!');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid');
  });

  it('fails when no loyalty account found', async () => {
    __setAccount(null);
    const result = await redeemReward('abc123def456');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails when reward not found in list', async () => {
    __setAccount({ _id: 'a1', points: { balance: 1000 } });
    __setRewards([{ _id: 'other-reward', name: 'Other', requiredPoints: 50 }]);
    const result = await redeemReward('abc123def456');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Reward not found');
  });

  it('fails when not enough points', async () => {
    __setAccount({ _id: 'a1', points: { balance: 50 } });
    __setRewards([{ _id: 'abc123def456', name: '10% Off', requiredPoints: 200 }]);
    const result = await redeemReward('abc123def456');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Not enough points');
  });

  it('succeeds and returns coupon code', async () => {
    __setAccount({ _id: 'a1', points: { balance: 500 } });
    __setRewards([{ _id: 'abc123def456', name: '10% Off', requiredPoints: 200 }]);
    const result = await redeemReward('abc123def456');
    expect(result.success).toBe(true);
    expect(result.couponCode).toBe('REWARD-TEST123');
    expect(result.message).toContain('10% Off');
  });

  it('handles reward with 0 required points', async () => {
    __setAccount({ _id: 'a1', points: { balance: 0 } });
    __setRewards([{ _id: 'abc123def456', name: 'Welcome Gift' }]); // requiredPoints undefined → 0
    const result = await redeemReward('abc123def456');
    expect(result.success).toBe(true);
  });

  it('returns null couponCode when redemption has none', async () => {
    __setAccount({ _id: 'a1', points: { balance: 500 } });
    __setRewards([{ _id: 'abc123def456', name: 'Free Item', requiredPoints: 100 }]);
    rewards.redeemReward.mockResolvedValueOnce({}); // no couponCode
    const result = await redeemReward('abc123def456');
    expect(result.success).toBe(true);
    expect(result.couponCode).toBeNull();
  });

  it('handles API error during redemption', async () => {
    __setAccount({ _id: 'a1', points: { balance: 500 } });
    __setRewards([{ _id: 'abc123def456', name: 'Reward', requiredPoints: 100 }]);
    rewards.redeemReward.mockRejectedValueOnce(new Error('Network error'));
    const result = await redeemReward('abc123def456');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to redeem reward');
  });
});

describe('loyaltyService — getLoyaltyTiers', () => {
  it('returns three tiers with correct structure', async () => {
    const tiers = await getLoyaltyTiers();
    expect(tiers).toHaveLength(3);
    expect(tiers[0].name).toBe('Bronze');
    expect(tiers[0].minPoints).toBe(0);
    expect(tiers[1].name).toBe('Silver');
    expect(tiers[1].minPoints).toBe(500);
    expect(tiers[2].name).toBe('Gold');
    expect(tiers[2].minPoints).toBe(1500);
  });

  it('each tier has benefits array', async () => {
    const tiers = await getLoyaltyTiers();
    for (const tier of tiers) {
      expect(Array.isArray(tier.benefits)).toBe(true);
      expect(tier.benefits.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// loyaltyBonusPoints.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('loyaltyBonusPoints — getEarningConfig', () => {
  it('returns correct point values', async () => {
    const config = await getEarningConfig();
    expect(config.pointsPerDollar).toBe(2);
    expect(config.bonusPoints.review).toBe(100);
    expect(config.bonusPoints.photoReview).toBe(150);
    expect(config.bonusPoints.referralComplete).toBe(500);
    expect(config.bonusPoints.accountCreation).toBe(50);
    expect(config.bonusPoints.birthday).toBe(200);
  });

  it('returns tier multipliers', async () => {
    const config = await getEarningConfig();
    expect(config.tierMultipliers.Bronze).toBe(1);
    expect(config.tierMultipliers.Gold).toBe(1.5);
    expect(config.tierMultipliers.Platinum).toBe(2);
  });

  it('returns a copy of multipliers (not the original object)', async () => {
    const config = await getEarningConfig();
    config.tierMultipliers.Bronze = 999;
    const config2 = await getEarningConfig();
    expect(config2.tierMultipliers.Bronze).toBe(1);
  });
});

describe('loyaltyBonusPoints — awardBonusPoints', () => {
  it('rejects missing accountId', async () => {
    const result = await awardBonusPoints(null, 'review');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Account ID is required');
  });

  it('rejects empty accountId', async () => {
    const result = await awardBonusPoints('', 'review');
    expect(result.success).toBe(false);
  });

  it('rejects invalid accountId format', async () => {
    const result = await awardBonusPoints('not!valid!id', 'review');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid account ID');
  });

  it('rejects unknown activity type', async () => {
    const result = await awardBonusPoints('abc123def456', 'unknownActivity');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown activity type');
  });

  it('truncates long unknown activity type in error message', async () => {
    const longType = 'a'.repeat(100);
    const result = await awardBonusPoints('abc123def456', longType);
    expect(result.success).toBe(false);
    // Should be sliced to 50 chars
    expect(result.message.length).toBeLessThan(120);
  });

  it('awards default review points', async () => {
    const result = await awardBonusPoints('abc123def456', 'review');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(BONUS_POINTS.REVIEW);
    expect(result.reason).toBe('review');
    expect(accounts.earnPoints).toHaveBeenCalledWith('abc123def456', expect.objectContaining({
      points: 100,
      description: 'Bonus: product review submitted',
      appId: 'cf-loyalty-bonus',
    }));
  });

  it('awards photo review points', async () => {
    const result = await awardBonusPoints('abc123def456', 'photoReview');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(150);
  });

  it('awards referral complete points', async () => {
    const result = await awardBonusPoints('abc123def456', 'referralComplete');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(500);
  });

  it('awards account creation points', async () => {
    const result = await awardBonusPoints('abc123def456', 'accountCreation');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(50);
  });

  it('awards birthday points', async () => {
    const result = await awardBonusPoints('abc123def456', 'birthday');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(200);
  });

  it('allows custom point override', async () => {
    const result = await awardBonusPoints('abc123def456', 'review', { points: 75 });
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(75);
  });

  it('rejects zero custom points', async () => {
    const result = await awardBonusPoints('abc123def456', 'review', { points: 0 });
    expect(result.success).toBe(false);
    expect(result.message).toContain('positive number');
  });

  it('rejects negative custom points', async () => {
    const result = await awardBonusPoints('abc123def456', 'review', { points: -10 });
    expect(result.success).toBe(false);
    expect(result.message).toContain('positive number');
  });

  it('rejects non-number custom points', async () => {
    const result = await awardBonusPoints('abc123def456', 'review', { points: 'fifty' });
    expect(result.success).toBe(false);
  });

  it('handles API error during earnPoints', async () => {
    accounts.earnPoints.mockRejectedValueOnce(new Error('Loyalty API down'));
    const result = await awardBonusPoints('abc123def456', 'review');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to award bonus points');
  });

  it('generates unique idempotency key per call', async () => {
    await awardBonusPoints('abc123def456', 'review');
    await awardBonusPoints('abc123def456', 'review');
    const call1 = accounts.earnPoints.mock.calls[0][1];
    const call2 = accounts.earnPoints.mock.calls[1][1];
    expect(call1.idempotencyKey).toBeDefined();
    expect(call2.idempotencyKey).toBeDefined();
    expect(call1.idempotencyKey).not.toBe(call2.idempotencyKey);
  });

  it('exported BONUS_POINTS constants are correct', () => {
    expect(BONUS_POINTS.REVIEW).toBe(100);
    expect(BONUS_POINTS.PHOTO_REVIEW).toBe(150);
    expect(BONUS_POINTS.REFERRAL_COMPLETE).toBe(500);
    expect(BONUS_POINTS.ACCOUNT_CREATION).toBe(50);
    expect(BONUS_POINTS.BIRTHDAY).toBe(200);
  });
});
