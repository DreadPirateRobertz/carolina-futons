/**
 * rewardsStore.test.js
 * CF-n932 — RewardsStore backend: catalog, redemption, history
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wixData ─────────────────────────────────────────────────────────────

const mockQuery = {
  eq: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn().mockResolvedValue({ items: [] }),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQuery, eq: vi.fn().mockReturnThis(), descending: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), find: mockQuery.find })),
    insert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: {
    Anyone: { allowedRoles: [] },
    SiteMember: { allowedRoles: [] },
    Admin: { allowedRoles: [] },
  },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue({ _id: 'mem-store-1' }),
  },
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

vi.mock('backend/utils/memberPointsLedger', () => ({
  insertLedgerEntry: vi.fn().mockResolvedValue({}),
}));

const { default: wixData } = await import('wix-data');
const { currentMember } = await import('wix-members-backend');
const { logError } = await import('backend/utils/errorHandler');
const { insertLedgerEntry } = await import('backend/utils/memberPointsLedger');

const {
  getRewardsCatalog,
  redeemReward,
  getRedemptionHistory,
  REWARD_CATALOG,
} = await import('../src/backend/rewardsStore.web.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-store-1';

function mockMemberPoints(totalPoints) {
  wixData.query.mockImplementation(() => {
    const q = {
      eq: vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockResolvedValue({
        items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints }],
      }),
    };
    return q;
  });
}

function mockNoMemberPoints() {
  wixData.query.mockImplementation(() => ({
    eq: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    find: vi.fn().mockResolvedValue({ items: [] }),
  }));
}

function mockRedemptionHistory(items = []) {
  wixData.query.mockImplementation(() => ({
    eq: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    find: vi.fn().mockResolvedValue({ items }),
  }));
}

// ── getRewardsCatalog ────────────────────────────────────────────────────────

describe('getRewardsCatalog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all 5 reward types', async () => {
    const result = await getRewardsCatalog();
    expect(result).toHaveLength(5);
  });

  it('each reward has required fields', async () => {
    const result = await getRewardsCatalog();
    for (const reward of result) {
      expect(reward).toHaveProperty('rewardId');
      expect(reward).toHaveProperty('name');
      expect(reward).toHaveProperty('description');
      expect(reward).toHaveProperty('pointsCost');
      expect(reward).toHaveProperty('type');
      expect(typeof reward.pointsCost).toBe('number');
    }
  });

  it('includes DISCOUNT_5 at 500 points', async () => {
    const result = await getRewardsCatalog();
    const d5 = result.find(r => r.type === 'DISCOUNT_5');
    expect(d5).toBeDefined();
    expect(d5.pointsCost).toBe(500);
  });

  it('includes FREE_SHIPPING at 800 points', async () => {
    const result = await getRewardsCatalog();
    const fs = result.find(r => r.type === 'FREE_SHIPPING');
    expect(fs).toBeDefined();
    expect(fs.pointsCost).toBe(800);
  });
});

// ── redeemReward ─────────────────────────────────────────────────────────────

describe('redeemReward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMember.getMember.mockResolvedValue({ _id: MEMBER_ID });
  });

  it('returns error when memberId is missing', async () => {
    const result = await redeemReward(null, 'DISCOUNT_5');
    expect(result.error).toBeDefined();
  });

  it('returns error when rewardId is invalid', async () => {
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'NONEXISTENT');
    expect(result.error).toMatch(/invalid/i);
  });

  it('returns error when caller is not the member', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'different-member' });
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toMatch(/forbidden/i);
  });

  it('returns error when points are insufficient', async () => {
    mockMemberPoints(100);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toMatch(/insufficient/i);
  });

  it('returns error when no member record found', async () => {
    mockNoMemberPoints();
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBeDefined();
  });

  it('deducts points on successful redemption', async () => {
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(500);
    expect(wixData.update).toHaveBeenCalled();
  });

  it('returns a coupon code on success', async () => {
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.couponCode).toBeDefined();
    expect(typeof result.couponCode).toBe('string');
    expect(result.couponCode.length).toBeGreaterThan(0);
  });

  it('inserts a redemption record', async () => {
    mockMemberPoints(1000);
    await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(wixData.insert).toHaveBeenCalled();
    const insertCall = wixData.insert.mock.calls[0];
    expect(insertCall[0]).toBe('RewardRedemptions');
  });

  it('inserts a ledger entry for the burn', async () => {
    mockMemberPoints(1000);
    await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(insertLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: MEMBER_ID,
        operationType: 'burn',
        delta: -500,
      }),
    );
  });

  it('returns correct newBalance for DISCOUNT_15', async () => {
    mockMemberPoints(2000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_15');
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(800);
  });

  it('does not throw on service error', async () => {
    wixData.query.mockImplementation(() => { throw new Error('DB down'); });
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBeDefined();
  });
});

// ── getRedemptionHistory ─────────────────────────────────────────────────────

describe('getRedemptionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMember.getMember.mockResolvedValue({ _id: MEMBER_ID });
  });

  it('returns error when memberId is missing', async () => {
    const result = await getRedemptionHistory(null);
    expect(result.error).toBeDefined();
  });

  it('returns empty array when no redemptions', async () => {
    mockRedemptionHistory([]);
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result).toEqual([]);
  });

  it('returns formatted redemption history', async () => {
    mockRedemptionHistory([
      { _id: 'r1', rewardId: 'DISCOUNT_5', redeemedAt: '2026-03-24T10:00:00Z', couponCode: 'CF-ABC123', status: 'active' },
    ]);
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      rewardId: 'DISCOUNT_5',
      couponCode: 'CF-ABC123',
      status: 'active',
    });
  });

  it('returns error when caller is not the member', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'different-member' });
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result.error).toMatch(/forbidden/i);
  });

  it('does not throw on service error', async () => {
    wixData.query.mockImplementation(() => { throw new Error('DB down'); });
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result.error).toBeDefined();
  });
});
