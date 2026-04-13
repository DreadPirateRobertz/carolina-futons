/**
 * @file leaderboardByPeriod.test.js
 * @description Tests for getLeaderboardByPeriod and getMyRank in leaderboardService.web.js.
 *
 * Covers:
 *  - getLeaderboardByPeriod allTime: ranks by totalPoints desc, maps to {rank,memberId,displayName,points,tier}
 *  - getLeaderboardByPeriod allTime: respects limit (1–50)
 *  - getLeaderboardByPeriod allTime: excludes non-opted-in members
 *  - getLeaderboardByPeriod allTime: returns [] on empty collection
 *  - getLeaderboardByPeriod allTime: returns [] on query error
 *  - getLeaderboardByPeriod weekly: aggregates from MemberPointsLedger, looks up MemberPoints for name/tier
 *  - getLeaderboardByPeriod weekly: only includes leaderboardOptIn members
 *  - getLeaderboardByPeriod weekly: returns [] when no ledger entries this week
 *  - getLeaderboardByPeriod: rejects invalid period
 *  - getMyRank: returns {rank, points, tier} for a known member
 *  - getMyRank: rank 1 when no one has more points
 *  - getMyRank: rank N+1 when N members have more points
 *  - getMyRank: returns null for unknown memberId
 *  - getMyRank: returns null when memberId is falsy
 *
 * cf-73p
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __setQueryError } from 'wix-data';
import { getLeaderboardByPeriod, getMyRank } from '../src/backend/leaderboardService.web.js';

const NOW = new Date('2026-04-13T12:00:00.000Z');
const WEEK_START = new Date('2026-04-12T00:00:00.000Z'); // Sunday before 2026-04-13 (Monday)

function makeMember(overrides = {}) {
  return {
    _id:              overrides._id              ?? `mp-${overrides.memberId ?? 'def'}`,
    memberId:         overrides.memberId         ?? 'mem-1',
    displayName:      overrides.displayName      ?? 'Alice',
    totalPoints:      overrides.totalPoints      ?? 100,
    tier:             overrides.tier             ?? 'Trail Blazer',
    leaderboardOptIn: overrides.leaderboardOptIn ?? true,
    ...overrides,
  };
}

function makeLedgerEntry(memberId, delta, timestamp) {
  return { memberId, delta, timestamp, operationType: 'earn', previousBalance: 0, newBalance: delta };
}

beforeEach(() => {
  __reset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

// ── getLeaderboardByPeriod — allTime ─────────────────────────────────────────

describe('getLeaderboardByPeriod allTime', () => {
  it('returns empty array when MemberPoints is empty', async () => {
    __seed('MemberPoints', []);
    __seed('MemberPointsLedger', []);
    const result = await getLeaderboardByPeriod('allTime', 20);
    expect(result).toEqual([]);
  });

  it('returns [] on query error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await getLeaderboardByPeriod('allTime', 20);
    expect(result).toEqual([]);
  });

  it('maps to {rank, memberId, displayName, points, tier}', async () => {
    __seed('MemberPoints', [makeMember({ memberId: 'mem-a', displayName: 'Alice', totalPoints: 500, tier: 'Summit Master' })]);
    __seed('MemberPointsLedger', []);
    const [entry] = await getLeaderboardByPeriod('allTime', 20);
    expect(entry).toMatchObject({ rank: 1, memberId: 'mem-a', displayName: 'Alice', points: 500, tier: 'Summit Master' });
  });

  it('ranks by totalPoints descending', async () => {
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-c', totalPoints: 50 }),
      makeMember({ memberId: 'mem-a', totalPoints: 500 }),
      makeMember({ memberId: 'mem-b', totalPoints: 200 }),
    ]);
    __seed('MemberPointsLedger', []);
    const result = await getLeaderboardByPeriod('allTime', 20);
    expect(result[0].memberId).toBe('mem-a');
    expect(result[1].memberId).toBe('mem-b');
    expect(result[2].memberId).toBe('mem-c');
  });

  it('excludes members without leaderboardOptIn', async () => {
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-in',  totalPoints: 100, leaderboardOptIn: true }),
      makeMember({ memberId: 'mem-out', totalPoints: 999, leaderboardOptIn: false }),
    ]);
    __seed('MemberPointsLedger', []);
    const result = await getLeaderboardByPeriod('allTime', 20);
    expect(result).toHaveLength(1);
    expect(result[0].memberId).toBe('mem-in');
  });

  it('respects limit', async () => {
    const members = Array.from({ length: 30 }, (_, i) =>
      makeMember({ memberId: `mem-${i}`, totalPoints: 1000 - i })
    );
    __seed('MemberPoints', members);
    __seed('MemberPointsLedger', []);
    const result = await getLeaderboardByPeriod('allTime', 5);
    expect(result).toHaveLength(5);
  });

  it('defaults null fields', async () => {
    __seed('MemberPoints', [{ _id: 'mp-x', leaderboardOptIn: true }]);
    __seed('MemberPointsLedger', []);
    const [entry] = await getLeaderboardByPeriod('allTime', 20);
    expect(entry.memberId).toBeNull();
    expect(entry.displayName).toBeNull();
    expect(entry.points).toBe(0);
    expect(entry.tier).toBeNull();
  });
});

// ── getLeaderboardByPeriod — weekly ──────────────────────────────────────────

describe('getLeaderboardByPeriod weekly', () => {
  it('returns [] when no ledger entries for this week', async () => {
    __seed('MemberPointsLedger', []);
    __seed('MemberPoints', [makeMember({ memberId: 'mem-a' })]);
    const result = await getLeaderboardByPeriod('weekly', 20);
    expect(result).toEqual([]);
  });

  it('aggregates ledger deltas and ranks by weekly points', async () => {
    __seed('MemberPointsLedger', [
      makeLedgerEntry('mem-a', 200, new Date('2026-04-13T08:00:00Z')),
      makeLedgerEntry('mem-b', 50,  new Date('2026-04-13T09:00:00Z')),
      makeLedgerEntry('mem-a', 100, new Date('2026-04-13T10:00:00Z')),
    ]);
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-a', displayName: 'Alice', tier: 'Gold' }),
      makeMember({ memberId: 'mem-b', displayName: 'Bob',   tier: 'Silver' }),
    ]);
    const result = await getLeaderboardByPeriod('weekly', 20);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ rank: 1, memberId: 'mem-a', points: 300, displayName: 'Alice', tier: 'Gold' });
    expect(result[1]).toMatchObject({ rank: 2, memberId: 'mem-b', points: 50,  displayName: 'Bob',   tier: 'Silver' });
  });

  it('excludes non-opted-in members from weekly results', async () => {
    __seed('MemberPointsLedger', [
      makeLedgerEntry('mem-in',  100, new Date('2026-04-13T08:00:00Z')),
      makeLedgerEntry('mem-out', 500, new Date('2026-04-13T08:00:00Z')),
    ]);
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-in',  leaderboardOptIn: true }),
      makeMember({ memberId: 'mem-out', leaderboardOptIn: false }),
    ]);
    const result = await getLeaderboardByPeriod('weekly', 20);
    expect(result).toHaveLength(1);
    expect(result[0].memberId).toBe('mem-in');
  });
});

// ── getLeaderboardByPeriod — invalid period ───────────────────────────────────

describe('getLeaderboardByPeriod — invalid period', () => {
  it('returns success:false for invalid period', async () => {
    __seed('MemberPoints', []);
    __seed('MemberPointsLedger', []);
    const result = await getLeaderboardByPeriod('monthly', 20);
    expect(result).toMatchObject({ success: false });
    expect(result.error).toMatch(/period/i);
  });
});

// ── getMyRank ─────────────────────────────────────────────────────────────────

describe('getMyRank', () => {
  it('returns null for falsy memberId', async () => {
    expect(await getMyRank(null)).toBeNull();
    expect(await getMyRank('')).toBeNull();
  });

  it('returns null when member has no MemberPoints record', async () => {
    __seed('MemberPoints', []);
    const result = await getMyRank('mem-unknown');
    expect(result).toBeNull();
  });

  it('returns rank 1 when member has the most points', async () => {
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-top', totalPoints: 1000, leaderboardOptIn: true }),
      makeMember({ memberId: 'mem-low', totalPoints: 100,  leaderboardOptIn: true }),
    ]);
    const result = await getMyRank('mem-top');
    expect(result).toMatchObject({ rank: 1, points: 1000 });
  });

  it('returns correct rank when others have more points', async () => {
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-1', totalPoints: 900, leaderboardOptIn: true }),
      makeMember({ memberId: 'mem-2', totalPoints: 700, leaderboardOptIn: true }),
      makeMember({ memberId: 'mem-me', totalPoints: 300, leaderboardOptIn: true }),
    ]);
    const result = await getMyRank('mem-me');
    expect(result).toMatchObject({ rank: 3, points: 300 });
  });

  it('includes tier in the result', async () => {
    __seed('MemberPoints', [makeMember({ memberId: 'mem-a', tier: 'Mountain Guide', totalPoints: 500, leaderboardOptIn: true })]);
    const result = await getMyRank('mem-a');
    expect(result.tier).toBe('Mountain Guide');
  });

  it('returns null on query error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await getMyRank('mem-a');
    expect(result).toBeNull();
  });
});
