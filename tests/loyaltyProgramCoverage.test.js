/**
 * Tests for loyaltyService.web.js, loyaltyTiers.web.js, loyaltyBonusPoints.web.js
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

// ── loyaltyTiers ──────────────────────────────────────────────────────
import {
  getTier,
  updateTier,
  calculateRewards,
  getAllTiers,
  getCustomerTierHistory,
} from 'backend/loyaltyTiers.web';

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
// loyaltyTiers.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('loyaltyTiers — getTier', () => {
  it('returns error when not authenticated', async () => {
    __setMember(null);
    const result = await getTier();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not authenticated');
  });

  it('creates Bronze record for new customer', async () => {
    __setMember({ _id: 'member-1' });
    // Empty LoyaltyTiers → uses defaults, empty CustomerTierHistory → creates new record
    const result = await getTier();
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Bronze');
    expect(result.data.lifetimeSpend).toBe(0);
    expect(result.data.nextTier).toBe('Silver');
    expect(result.data.spendToNext).toBe(500);
  });

  it('returns existing tier for customer with history', async () => {
    __setMember({ _id: 'member-2' });
    __seed('CustomerTierHistory', [{
      _id: 'h1',
      memberId: 'member-2',
      lifetimeSpend: 800,
      currentTier: 'Silver',
      previousTier: 'Bronze',
      tierChangedAt: new Date('2025-01-01'),
    }]);
    const result = await getTier();
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Silver');
    expect(result.data.lifetimeSpend).toBe(800);
    expect(result.data.discountPercent).toBe(5);
    expect(result.data.nextTier).toBe('Gold');
    expect(result.data.spendToNext).toBe(700); // 1500 - 800
  });

  it('returns null nextTier for Platinum', async () => {
    __setMember({ _id: 'member-3' });
    __seed('LoyaltyTiers', [
      { name: 'Bronze', minSpend: 0, discountPercent: 0, freeShippingThreshold: 150, earlyAccess: false, sortOrder: 0 },
      { name: 'Platinum', minSpend: 3000, discountPercent: 15, freeShippingThreshold: 0, earlyAccess: true, sortOrder: 3 },
    ]);
    __seed('CustomerTierHistory', [{
      _id: 'h2',
      memberId: 'member-3',
      lifetimeSpend: 5000,
      currentTier: 'Platinum',
    }]);
    const result = await getTier();
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Platinum');
    expect(result.data.nextTier).toBeNull();
    expect(result.data.spendToNext).toBe(0);
  });

  it('uses CMS tier definitions when available', async () => {
    __setMember({ _id: 'member-4' });
    __seed('LoyaltyTiers', [
      { name: 'Starter', minSpend: 0, discountPercent: 0, freeShippingThreshold: 200, earlyAccess: false, sortOrder: 0 },
      { name: 'VIP', minSpend: 1000, discountPercent: 20, freeShippingThreshold: 0, earlyAccess: true, sortOrder: 1 },
    ]);
    __seed('CustomerTierHistory', [{
      _id: 'h3',
      memberId: 'member-4',
      lifetimeSpend: 0,
      currentTier: 'Starter',
    }]);
    const result = await getTier();
    expect(result.success).toBe(true);
    expect(result.data.freeShippingThreshold).toBe(200);
    expect(result.data.nextTier).toBe('VIP');
  });

  it('falls back to first tier if current tier name not found', async () => {
    __setMember({ _id: 'member-5' });
    __seed('CustomerTierHistory', [{
      _id: 'h4',
      memberId: 'member-5',
      lifetimeSpend: 100,
      currentTier: 'NonExistent',
    }]);
    // Default tiers will be used; 'NonExistent' won't match, falls back to tiers[0]
    const result = await getTier();
    expect(result.success).toBe(true);
    expect(result.data.discountPercent).toBe(0); // Bronze defaults
  });
});

describe('loyaltyTiers — updateTier', () => {
  it('rejects invalid memberId', async () => {
    const result = await updateTier(null, 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid member ID');
  });

  it('rejects non-string memberId', async () => {
    const result = await updateTier(123, 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid member ID');
  });

  it('rejects negative order amount', async () => {
    const result = await updateTier('member-1', -50);
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-negative');
  });

  it('rejects non-number order amount', async () => {
    const result = await updateTier('member-1', 'fifty');
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-negative');
  });

  it('creates new record and stays Bronze for small order', async () => {
    const result = await updateTier('member-new', 100);
    expect(result.success).toBe(true);
    expect(result.data.lifetimeSpend).toBe(100);
    expect(result.data.currentTier).toBe('Bronze');
    expect(result.data.tierChanged).toBe(false);
  });

  it('upgrades from Bronze to Silver at 500 spend', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h1',
      memberId: 'member-upgrade',
      lifetimeSpend: 400,
      currentTier: 'Bronze',
      previousTier: null,
      tierChangedAt: new Date('2025-06-01'),
    }]);
    const result = await updateTier('member-upgrade', 200);
    expect(result.success).toBe(true);
    expect(result.data.lifetimeSpend).toBe(600);
    expect(result.data.currentTier).toBe('Silver');
    expect(result.data.previousTier).toBe('Bronze');
    expect(result.data.tierChanged).toBe(true);
    expect(result.data.discountPercent).toBe(5);
  });

  it('no tier change when spending within same tier', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h2',
      memberId: 'member-same',
      lifetimeSpend: 200,
      currentTier: 'Bronze',
      previousTier: null,
      tierChangedAt: new Date('2025-01-01'),
    }]);
    const result = await updateTier('member-same', 100);
    expect(result.success).toBe(true);
    expect(result.data.tierChanged).toBe(false);
    expect(result.data.currentTier).toBe('Bronze');
  });

  it('jumps multiple tiers in single large order', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h3',
      memberId: 'member-jump',
      lifetimeSpend: 0,
      currentTier: 'Bronze',
      previousTier: null,
    }]);
    const result = await updateTier('member-jump', 3500);
    expect(result.success).toBe(true);
    expect(result.data.currentTier).toBe('Platinum');
    expect(result.data.tierChanged).toBe(true);
    expect(result.data.discountPercent).toBe(15);
  });

  it('handles zero order amount', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h4',
      memberId: 'member-zero',
      lifetimeSpend: 500,
      currentTier: 'Silver',
    }]);
    const result = await updateTier('member-zero', 0);
    expect(result.success).toBe(true);
    expect(result.data.lifetimeSpend).toBe(500);
    expect(result.data.tierChanged).toBe(false);
  });
});

describe('loyaltyTiers — calculateRewards', () => {
  it('rejects non-number order total', async () => {
    const result = await calculateRewards('fifty');
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-negative');
  });

  it('rejects negative order total', async () => {
    const result = await calculateRewards(-10);
    expect(result.success).toBe(false);
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const result = await calculateRewards(100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not authenticated');
  });

  it('returns Bronze defaults for member with no history', async () => {
    __setMember({ _id: 'member-new' });
    const result = await calculateRewards(200);
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Bronze');
    expect(result.data.discountPercent).toBe(0);
    expect(result.data.discountAmount).toBe(0);
    expect(result.data.finalTotal).toBe(200);
    expect(result.data.freeShipping).toBe(false);
  });

  it('calculates Silver tier discount correctly', async () => {
    __setMember({ _id: 'member-silver' });
    __seed('CustomerTierHistory', [{
      _id: 'h1',
      memberId: 'member-silver',
      lifetimeSpend: 800,
      currentTier: 'Silver',
    }]);
    const result = await calculateRewards(200);
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Silver');
    expect(result.data.discountPercent).toBe(5);
    expect(result.data.discountAmount).toBe(10); // 200 * 5%
    expect(result.data.finalTotal).toBe(190);
    expect(result.data.freeShipping).toBe(true); // 200 >= 100 threshold
  });

  it('calculates Gold tier with free shipping and early access', async () => {
    __setMember({ _id: 'member-gold' });
    __seed('CustomerTierHistory', [{
      _id: 'h2',
      memberId: 'member-gold',
      lifetimeSpend: 2000,
      currentTier: 'Gold',
    }]);
    const result = await calculateRewards(100);
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Gold');
    expect(result.data.discountAmount).toBe(10); // 100 * 10%
    expect(result.data.finalTotal).toBe(90);
    expect(result.data.freeShipping).toBe(true); // 100 >= 50
    expect(result.data.earlyAccess).toBe(true);
  });

  it('no free shipping when below threshold', async () => {
    __setMember({ _id: 'member-bronze' });
    __seed('CustomerTierHistory', [{
      _id: 'h3',
      memberId: 'member-bronze',
      lifetimeSpend: 100,
      currentTier: 'Bronze',
    }]);
    const result = await calculateRewards(50);
    expect(result.success).toBe(true);
    expect(result.data.freeShipping).toBe(false); // 50 < 150
  });

  it('handles zero order total', async () => {
    __setMember({ _id: 'member-zero' });
    __seed('CustomerTierHistory', [{
      _id: 'h4',
      memberId: 'member-zero',
      lifetimeSpend: 500,
      currentTier: 'Silver',
    }]);
    const result = await calculateRewards(0);
    expect(result.success).toBe(true);
    expect(result.data.discountAmount).toBe(0);
    expect(result.data.finalTotal).toBe(0);
  });
});

describe('loyaltyTiers — getAllTiers', () => {
  it('returns default tiers when collection is empty', async () => {
    const result = await getAllTiers();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(4); // Bronze, Silver, Gold, Platinum
    expect(result.data[0].name).toBe('Bronze');
    expect(result.data[3].name).toBe('Platinum');
  });

  it('returns CMS tiers when seeded', async () => {
    __seed('LoyaltyTiers', [
      { name: 'Basic', minSpend: 0, discountPercent: 0, freeShippingThreshold: 200, earlyAccess: false, sortOrder: 0 },
      { name: 'Premium', minSpend: 1000, discountPercent: 12, freeShippingThreshold: 0, earlyAccess: true, sortOrder: 1 },
    ]);
    const result = await getAllTiers();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('Basic');
    expect(result.data[1].discountPercent).toBe(12);
  });

  it('maps earlyAccess correctly', async () => {
    const result = await getAllTiers();
    expect(result.data[0].earlyAccess).toBe(false); // Bronze
    expect(result.data[2].earlyAccess).toBe(true); // Gold
  });
});

describe('loyaltyTiers — getCustomerTierHistory', () => {
  it('rejects null memberId', async () => {
    const result = await getCustomerTierHistory(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid member ID');
  });

  it('rejects non-string memberId', async () => {
    const result = await getCustomerTierHistory(42);
    expect(result.success).toBe(false);
  });

  it('returns error when customer not found', async () => {
    const result = await getCustomerTierHistory('nonexistent-member');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns full history for existing customer', async () => {
    const changedAt = new Date('2025-06-15');
    __seed('CustomerTierHistory', [{
      _id: 'h1',
      memberId: 'member-hist',
      lifetimeSpend: 1200,
      currentTier: 'Silver',
      previousTier: 'Bronze',
      tierChangedAt: changedAt,
      _createdDate: new Date('2025-01-01'),
    }]);
    const result = await getCustomerTierHistory('member-hist');
    expect(result.success).toBe(true);
    expect(result.data.memberId).toBe('member-hist');
    expect(result.data.lifetimeSpend).toBe(1200);
    expect(result.data.currentTier).toBe('Silver');
    expect(result.data.previousTier).toBe('Bronze');
    expect(result.data.discountPercent).toBe(5);
    expect(result.data.freeShippingThreshold).toBe(100);
    expect(result.data.tierChangedAt).toEqual(changedAt);
  });

  it('falls back to first tier definition for unknown tier name', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h2',
      memberId: 'member-unknown',
      lifetimeSpend: 0,
      currentTier: 'NonExistent',
    }]);
    const result = await getCustomerTierHistory('member-unknown');
    expect(result.success).toBe(true);
    expect(result.data.discountPercent).toBe(0); // Falls back to Bronze
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
