/**
 * @file spinWheel.test.js
 * @description TDD tests for CF-ecs: spin wheel webMethods.
 *
 * Covers:
 *  - getSpinEligibility: eligible daily, ineligible (already spun), bonus spin eligible
 *  - spinWheel: DAILY vs BONUS spinType, weighted draw, fallback prize (25 pts)
 *  - Inactive prizes never drawn
 *  - awardPoints: MemberPoints update/insert
 *  - awardNonPointsPrize: MemberPendingPrizes insert, DISCOUNT_PCT prizeValue
 *  - decrementBonusSpin: conditional −1 on BONUS, no decrement on DAILY
 *  - SpinHistory write fields (memberId, spinDate, spinType, eventId, createdAt instanceof Date)
 *  - Rate limiting (20/hr)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
} from './__mocks__/wix-data.js';
import { spinWheel, getSpinEligibility } from '../src/backend/spinWheel.web.js';

// Compute today's ET date the same way the implementation does
const TODAY_ET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ── getSpinEligibility ───────────────────────────────────────────────────────

describe('getSpinEligibility', () => {
  it('returns eligible:true, spinType:DAILY when member has not spun today', async () => {
    const result = await getSpinEligibility('mem-1');
    expect(result.eligible).toBe(true);
    expect(result.spinType).toBe('DAILY');
    expect(result.nextETMidnightMs).toBeGreaterThan(0);
  });

  it('returns eligible:false, reason:ALREADY_SPUN when daily spin used and no bonus', async () => {
    __seed('SpinHistory', [{
      _id: 'sh-1', memberId: 'mem-1', spinDate: TODAY_ET, spinType: 'DAILY',
      createdAt: new Date(),
    }]);
    const result = await getSpinEligibility('mem-1');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('ALREADY_SPUN');
    expect(result.nextETMidnightMs).toBeGreaterThan(0);
  });

  it('returns eligible:true, spinType:BONUS when daily used but bonus spins available', async () => {
    __seed('SpinHistory', [{
      _id: 'sh-1', memberId: 'mem-1', spinDate: TODAY_ET, spinType: 'DAILY',
      createdAt: new Date(),
    }]);
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer',
      bonusSpinsAvailable: 3,
    }]);
    const result = await getSpinEligibility('mem-1');
    expect(result.eligible).toBe(true);
    expect(result.spinType).toBe('BONUS');
    expect(result.bonusSpinsRemaining).toBe(3);
  });

  it('returns eligible:false, reason:NO_MEMBER when memberId is missing', async () => {
    const result = await getSpinEligibility(null);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('NO_MEMBER');
  });
});

// ── spinWheel — DAILY vs BONUS spinType ──────────────────────────────────────

describe('spinWheel — spinType resolution', () => {
  it('resolves spinType DAILY when member has not spun today', async () => {
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 50, label: '50 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(true);
    expect(result.spinType).toBe('DAILY');
  });

  it('resolves spinType BONUS when daily used but bonus available', async () => {
    __seed('SpinHistory', [{
      _id: 'sh-1', memberId: 'mem-1', spinDate: TODAY_ET, spinType: 'DAILY',
      createdAt: new Date(),
    }]);
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer',
      bonusSpinsAvailable: 2,
    }]);
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 25, label: '25 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(true);
    expect(result.spinType).toBe('BONUS');
  });

  it('returns NOT_ELIGIBLE when daily used and no bonus spins', async () => {
    __seed('SpinHistory', [{
      _id: 'sh-1', memberId: 'mem-1', spinDate: TODAY_ET, spinType: 'DAILY',
      createdAt: new Date(),
    }]);
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('NOT_ELIGIBLE');
  });

  it('returns error for missing memberId', async () => {
    const result = await spinWheel(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('memberId is required');
  });
});

// ── spinWheel — weighted draw & inactive filter ──────────────────────────────

describe('spinWheel — weighted draw', () => {
  it('inactive prizes are never drawn', async () => {
    __seed('SpinPrizes', [
      { _id: 'sp-active', active: true, weight: 1, prizeType: 'POINTS', pointsAwarded: 10, label: 'Active Prize' },
      { _id: 'sp-inactive', active: false, weight: 9999, prizeType: 'POINTS', pointsAwarded: 999, label: 'Inactive Prize' },
    ]);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(true);
    expect(result.prize.label).toBe('Active Prize');
    expect(result.prize.pointsAwarded).toBe(10);
  });

  it('returns fallback 25 pts when prize pool is empty', async () => {
    // No SpinPrizes seeded → empty pool
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(true);
    expect(result.isFallback).toBe(true);
    expect(result.prize.type).toBe('POINTS');
    expect(result.prize.pointsAwarded).toBe(25);
  });

  it('returns fallback 25 pts when only inactive prizes exist', async () => {
    __seed('SpinPrizes', [
      { _id: 'sp-1', active: false, weight: 10, prizeType: 'POINTS', pointsAwarded: 100, label: 'Inactive' },
    ]);
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(true);
    expect(result.isFallback).toBe(true);
    expect(result.prize.pointsAwarded).toBe(25);
  });
});

// ── spinWheel — points award (MemberPoints update/insert) ────────────────────

describe('spinWheel — points award', () => {
  it('inserts a new MemberPoints record for a first-time member', async () => {
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 75, label: '75 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await spinWheel('mem-new');
    const inserted = __getInserted('MemberPoints');
    const record = inserted.find(r => r.memberId === 'mem-new');
    expect(record).toBeDefined();
    expect(record.totalPoints).toBe(75);
    expect(record.tier).toBe('Trail Blazer');
  });

  it('updates existing MemberPoints for a returning member', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer',
    }]);
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 50, label: '50 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await spinWheel('mem-1');
    const updated = __getUpdated('MemberPoints');
    expect(updated.length).toBeGreaterThanOrEqual(1);
    const pointsUpdate = updated.find(u => u.memberId === 'mem-1');
    expect(pointsUpdate.totalPoints).toBe(150);
  });
});

// ── spinWheel — non-points prize (MemberPendingPrizes) ───────────────────────

describe('spinWheel — non-points prize', () => {
  it('inserts into MemberPendingPrizes for non-POINTS prize', async () => {
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'FREE_SHIPPING',
      pointsAwarded: 0, prizeValue: 1, label: 'Free Shipping',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(true);
    expect(result.prize.type).toBe('FREE_SHIPPING');
    const pending = __getInserted('MemberPendingPrizes');
    const record = pending.find(r => r.memberId === 'mem-1');
    expect(record).toBeDefined();
    expect(record.prizeType).toBe('FREE_SHIPPING');
    expect(record.prizeLabel).toBe('Free Shipping');
    expect(record.spinHistoryId).toBe(result.historyId);
    expect(record.eventId).toBe(result.eventId);
  });

  it('stores correct prizeValue for DISCOUNT_PCT prize', async () => {
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'DISCOUNT_PCT',
      pointsAwarded: 0, prizeValue: 15, label: '15% Off',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(true);
    expect(result.prize.type).toBe('DISCOUNT_PCT');
    expect(result.prize.prizeValue).toBe(15);
    const pending = __getInserted('MemberPendingPrizes');
    const record = pending.find(r => r.memberId === 'mem-1');
    expect(record.prizeType).toBe('DISCOUNT_PCT');
    expect(record.prizeValue).toBe(15);
  });
});

// ── spinWheel — bonus decrement ──────────────────────────────────────────────

describe('spinWheel — bonus decrement', () => {
  it('decrements bonusSpinsAvailable after BONUS spin', async () => {
    __seed('SpinHistory', [{
      _id: 'sh-1', memberId: 'mem-1', spinDate: TODAY_ET, spinType: 'DAILY',
      createdAt: new Date(),
    }]);
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer',
      bonusSpinsAvailable: 3,
    }]);
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 10, label: '10 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await spinWheel('mem-1');
    const updated = __getUpdated('MemberPoints');
    const decremented = updated.find(u => u.bonusSpinsAvailable === 2);
    expect(decremented).toBeDefined();
  });

  it('does NOT decrement bonusSpinsAvailable after DAILY spin', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer',
      bonusSpinsAvailable: 5,
    }]);
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 10, label: '10 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await spinWheel('mem-1');
    const updated = __getUpdated('MemberPoints');
    // awardPoints updates MemberPoints, but should preserve bonusSpinsAvailable
    expect(updated.every(u => u.bonusSpinsAvailable === 5)).toBe(true);
  });
});

// ── spinWheel — SpinHistory write fields ─────────────────────────────────────

describe('spinWheel — SpinHistory write fields', () => {
  it('writes memberId, spinDate, spinType, eventId, createdAt (instanceof Date) to SpinHistory', async () => {
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 50, label: '50 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = await spinWheel('mem-1');
    expect(result.success).toBe(true);

    const history = __getInserted('SpinHistory');
    const entry = history.find(h => h.memberId === 'mem-1');
    expect(entry).toBeDefined();
    expect(entry.memberId).toBe('mem-1');
    expect(entry.spinDate).toBe(TODAY_ET);
    expect(entry.spinType).toBe('DAILY');
    expect(typeof entry.eventId).toBe('string');
    expect(entry.eventId.length).toBeGreaterThan(0);
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('captures insertedHistory._id in the response', async () => {
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 50, label: '50 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = await spinWheel('mem-1');
    expect(result.historyId).toBeDefined();
    expect(typeof result.historyId).toBe('string');
  });
});

// ── spinWheel — rate limiting (20/hr) ────────────────────────────────────────

describe('spinWheel — rate limiting', () => {
  it('blocks spin when 20 spins occurred in the last hour', async () => {
    const recentSpins = Array.from({ length: 20 }, (_, i) => ({
      _id: `sh-rate-${i}`,
      memberId: 'mem-rate',
      spinDate: TODAY_ET,
      spinType: i === 0 ? 'DAILY' : 'BONUS',
      createdAt: new Date(), // within the last hour
    }));
    __seed('SpinHistory', recentSpins);
    const result = await spinWheel('mem-rate');
    expect(result.success).toBe(false);
    expect(result.error).toBe('RATE_LIMITED');
  });

  it('allows spin when under 20 spins in the last hour', async () => {
    const recentSpins = Array.from({ length: 19 }, (_, i) => ({
      _id: `sh-rate-${i}`,
      memberId: 'mem-rate',
      spinDate: TODAY_ET,
      spinType: i === 0 ? 'DAILY' : 'BONUS',
      createdAt: new Date(),
    }));
    __seed('SpinHistory', recentSpins);
    __seed('MemberPoints', [{
      _id: 'mp-rate', memberId: 'mem-rate', totalPoints: 0, tier: 'Trail Blazer',
      bonusSpinsAvailable: 10,
    }]);
    __seed('SpinPrizes', [{
      _id: 'sp-1', active: true, weight: 10, prizeType: 'POINTS',
      pointsAwarded: 10, label: '10 Points',
    }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // Already has a DAILY spin, so this is a BONUS spin
    const result = await spinWheel('mem-rate');
    expect(result.success).toBe(true);
  });

  it('rate limit also triggers on getSpinEligibility', async () => {
    const recentSpins = Array.from({ length: 20 }, (_, i) => ({
      _id: `sh-rate-${i}`,
      memberId: 'mem-rate',
      spinDate: TODAY_ET,
      spinType: i === 0 ? 'DAILY' : 'BONUS',
      createdAt: new Date(),
    }));
    __seed('SpinHistory', recentSpins);
    const result = await getSpinEligibility('mem-rate');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('RATE_LIMITED');
  });
});
