/**
 * rewardsStore.test.js
 * CF-n932 — RewardsStore backend: catalog, redemption, history
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wixData ─────────────────────────────────────────────────────────────

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(),
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
} = await import('../src/backend/rewardsStore.web.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-store-1';

function mockQueryResult(items) {
  wixData.query.mockImplementation(() => ({
    eq: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    find: vi.fn().mockResolvedValue({ items }),
  }));
}

/**
 * Mock for redeemReward flow. Query order:
 * (1) member points read, (2) TOCTOU verify read, (3) coupon collision check.
 * Tracks wixData.update to return correct post-deduction balance on verify.
 */
function mockMemberPoints(totalPoints) {
  let updatedBalance = null;
  let queryCount = 0;
  wixData.update.mockImplementation(async (_coll, data) => {
    if (data.totalPoints !== undefined) updatedBalance = data.totalPoints;
    return data;
  });
  wixData.query.mockImplementation(() => ({
    eq: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    find: vi.fn().mockImplementation(async () => {
      queryCount++;
      if (queryCount === 1) {
        return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints }] };
      }
      if (queryCount === 2) {
        // Verify read — return updated balance so TOCTOU check passes
        return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: updatedBalance ?? totalPoints }] };
      }
      // Coupon collision check — no collision
      return { items: [] };
    }),
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
    expect(result.error).toBe('missing_member_id');
  });

  it('returns error when rewardId is invalid', async () => {
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'NONEXISTENT');
    expect(result.error).toBe('invalid_reward_id');
  });

  it('rejects rewardId with special characters', async () => {
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5"; DROP TABLE');
    expect(result.error).toBe('invalid_reward_id');
  });

  it('rejects non-string rewardId', async () => {
    const result = await redeemReward(MEMBER_ID, { toString: () => 'DISCOUNT_5' });
    expect(result.error).toBe('invalid_reward_id');
  });

  it('returns error when caller is not the member', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'different-member' });
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('forbidden');
  });

  it('returns error with required/current when points are insufficient', async () => {
    mockMemberPoints(100);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('insufficient_points');
    expect(result.required).toBe(500);
    expect(result.current).toBe(100);
  });

  it('returns error when no member record found', async () => {
    mockQueryResult([]);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('no_member_record');
  });

  it('deducts points on successful redemption', async () => {
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(500);
    expect(wixData.update).toHaveBeenCalled();
  });

  it('returns a coupon code matching CF-XXXXXXXX format', async () => {
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.couponCode).toMatch(/^CF-[A-HJ-NP-Z2-9]{8}$/);
  });

  it('inserts a redemption record into RewardRedemptions', async () => {
    mockMemberPoints(1000);
    await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    const insertCalls = wixData.insert.mock.calls;
    const redemptionInsert = insertCalls.find(c => c[0] === 'RewardRedemptions');
    expect(redemptionInsert).toBeDefined();
    expect(redemptionInsert[1]).toMatchObject({
      memberId: MEMBER_ID,
      rewardId: 'DISCOUNT_5',
      status: 'active',
    });
  });

  it('inserts a ledger entry for the burn', async () => {
    mockMemberPoints(1000);
    await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(insertLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: MEMBER_ID,
        operationType: 'burn',
        delta: -500,
        reason: 'reward_redemption:DISCOUNT_5',
      }),
    );
  });

  it('returns correct newBalance for DISCOUNT_15', async () => {
    mockMemberPoints(2000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_15');
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(800);
  });

  it('returns rewardName on success', async () => {
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.rewardName).toBe('$5 Off Your Next Order');
  });

  it('does not throw on service error', async () => {
    wixData.query.mockImplementation(() => { throw new Error('DB down'); });
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('service_unavailable');
  });

  it('detects TOCTOU race condition and returns concurrent_modification', async () => {
    // Query order: (1) member points read, (2) TOCTOU verify read, (3+) coupon check
    let queryCount = 0;
    wixData.update.mockResolvedValue({});
    wixData.insert.mockResolvedValue({});
    wixData.query.mockImplementation(() => ({
      eq: vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockImplementation(async () => {
        queryCount++;
        if (queryCount === 1) {
          return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: 500 }] };
        }
        // Query 2 is the verify read — return different balance (race detected)
        return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: 200 }] };
      }),
    }));
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('concurrent_modification');
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('TOCTOU'));
  });

  it('rolls back points when redemption insert fails', async () => {
    // Rollback re-reads fresh record before restoring, so query order is:
    // (1) balance read, (2) TOCTOU verify, (3) coupon check, (4) rollback fresh read
    let queryCount = 0;
    let updatedBalance = null;
    wixData.update.mockImplementation(async (_coll, data) => {
      if (data.totalPoints !== undefined) updatedBalance = data.totalPoints;
      return data;
    });
    wixData.query.mockImplementation(() => ({
      eq: vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockImplementation(async () => {
        queryCount++;
        if (queryCount === 1) return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: 1000 }] };
        if (queryCount === 2) return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: updatedBalance ?? 500 }] };
        if (queryCount === 3) return { items: [] }; // coupon check
        // Query 4: rollback fresh read — returns current (deducted) balance
        return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: updatedBalance ?? 500 }] };
      }),
    }));
    wixData.insert.mockRejectedValue(new Error('Insert failed'));
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('redemption_failed');
    // Verify rollback: update called twice (deduct + add-back)
    expect(wixData.update).toHaveBeenCalledTimes(2);
    // Second update should add back pointsCost to the fresh-read balance
    const rollbackCall = wixData.update.mock.calls[1];
    expect(rollbackCall[1].totalPoints).toBe(1000); // 500 + 500
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('rolling back points'),
      expect.any(Error),
    );
  });

  it('returns success even when ledger insert fails', async () => {
    mockMemberPoints(1000);
    wixData.insert.mockResolvedValue({}); // redemption insert succeeds
    insertLedgerEntry.mockRejectedValue(new Error('Ledger down'));
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.success).toBe(true);
    expect(result.couponCode).toMatch(/^CF-/);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('ledger insert failed'),
      expect.any(Error),
    );
  });

  it('returns forbidden when getMember resolves to null', async () => {
    currentMember.getMember.mockResolvedValue(null);
    mockMemberPoints(1000);
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('forbidden');
  });

  it('logs CRITICAL when rollback fails after redemption insert failure', async () => {
    // Queries: (1) balance read, (2) TOCTOU verify, (3) coupon check, (4) rollback fresh read
    let queryCount = 0;
    let updatedBalance = null;
    let updateCount = 0;
    wixData.update.mockImplementation(async (_coll, data) => {
      updateCount++;
      if (data.totalPoints !== undefined) updatedBalance = data.totalPoints;
      // First update = deduct (succeeds), second = rollback (fails)
      if (updateCount === 2) throw new Error('Rollback also failed');
      return data;
    });
    wixData.query.mockImplementation(() => ({
      eq: vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockImplementation(async () => {
        queryCount++;
        if (queryCount === 1) return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: 1000 }] };
        if (queryCount === 2) return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: updatedBalance ?? 500 }] };
        if (queryCount === 3) return { items: [] }; // coupon check
        // Query 4: rollback fresh read — return record so rollback update is attempted
        return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: updatedBalance ?? 500 }] };
      }),
    }));
    wixData.insert.mockRejectedValue(new Error('Insert failed'));
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('redemption_failed');
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL: rollback failed'),
      expect.any(Error),
    );
  });

  it('logs CRITICAL when TOCTOU restore fails', async () => {
    let queryCount = 0;
    let updateCount = 0;
    wixData.update.mockImplementation(async () => {
      updateCount++;
      if (updateCount === 2) throw new Error('Restore failed');
      return {};
    });
    wixData.insert.mockResolvedValue({});
    wixData.query.mockImplementation(() => ({
      eq: vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockImplementation(async () => {
        queryCount++;
        if (queryCount === 1) {
          return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: 500 }] };
        }
        // Verify read returns different balance — triggers TOCTOU
        return { items: [{ _id: 'mp-1', memberId: MEMBER_ID, totalPoints: 200 }] };
      }),
    }));
    const result = await redeemReward(MEMBER_ID, 'DISCOUNT_5');
    expect(result.error).toBe('concurrent_modification');
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL: TOCTOU restore failed'),
      expect.any(Error),
    );
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
    expect(result.error).toBe('missing_member_id');
  });

  it('returns empty array when no redemptions', async () => {
    mockQueryResult([]);
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result).toEqual([]);
  });

  it('returns formatted redemption history', async () => {
    mockQueryResult([
      { _id: 'r1', rewardId: 'DISCOUNT_5', redeemedAt: '2026-03-24T10:00:00Z', couponCode: 'CF-ABC12345', status: 'active', pointsSpent: 500, rewardType: 'DISCOUNT_5' },
    ]);
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      rewardId: 'DISCOUNT_5',
      couponCode: 'CF-ABC12345',
      status: 'active',
      pointsSpent: 500,
    });
  });

  it('returns error when caller is not the member', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'different-member' });
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result.error).toBe('forbidden');
  });

  it('does not throw on service error', async () => {
    wixData.query.mockImplementation(() => { throw new Error('DB down'); });
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result.error).toBe('service_unavailable');
  });

  it('returns forbidden when getMember resolves to null', async () => {
    currentMember.getMember.mockResolvedValue(null);
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result.error).toBe('forbidden');
  });

  it('applies defaults for missing status, pointsSpent, and rewardType', async () => {
    mockQueryResult([
      { _id: 'r1', rewardId: 'DISCOUNT_5', redeemedAt: '2026-03-24', couponCode: 'CF-X' },
    ]);
    const result = await getRedemptionHistory(MEMBER_ID);
    expect(result[0].status).toBe('active');
    expect(result[0].pointsSpent).toBe(0);
    expect(result[0].rewardType).toBe('DISCOUNT_5');
  });
});
