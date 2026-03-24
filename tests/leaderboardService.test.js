/**
 * @file leaderboardService.test.js
 * @description Tests for leaderboardService — getLeaderboard + snapshotLeaderboard.
 *
 * Covers:
 *  - getLeaderboard returns top-10 sorted by totalPoints desc with rank 1-based
 *  - getLeaderboard returns empty array when collection is empty
 *  - getLeaderboard returns empty array when query throws
 *  - getLeaderboard maps fields correctly (memberId, displayName, totalPoints, tier)
 *  - getLeaderboard handles null/missing fields with defaults
 *  - snapshotLeaderboard writes correct shape to LeaderboardSnapshots
 *  - snapshotLeaderboard returns success:true with snapshotDate
 *  - snapshotLeaderboard returns success:false when query throws
 *  - snapshotLeaderboard returns success:false when insert throws
 *  - snapshotLeaderboard entries is JSON-stringified array
 *
 * CF-9t0w
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted, __setQueryError, __setInsertError } from 'wix-data';
import {
  getLeaderboard,
  snapshotLeaderboard,
} from '../src/backend/leaderboardService.web.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeEntry(overrides = {}) {
  return {
    _id:              overrides._id              || 'pt-1',
    memberId:         overrides.memberId         || 'mem-1',
    displayName:      overrides.displayName      || 'Alice',
    totalPoints:      overrides.totalPoints      ?? 100,
    tier:             overrides.tier             || 'Silver',
    leaderboardOptIn: overrides.leaderboardOptIn ?? true,
    ...overrides,
  };
}

beforeEach(() => {
  __reset();
});

// ── getLeaderboard ───────────────────────────────────────────────────────────

describe('getLeaderboard', () => {
  it('returns empty array when MemberPoints is empty', async () => {
    __seed('MemberPoints', []);
    const result = await getLeaderboard();
    expect(result).toEqual([]);
  });

  it('returns empty array when query throws', async () => {
    __setQueryError('MemberPoints', new Error('DB unavailable'));
    const result = await getLeaderboard();
    expect(result).toEqual([]);
  });

  it('returns entries with rank starting at 1', async () => {
    __seed('MemberPoints', [makeEntry({ totalPoints: 200 }), makeEntry({ _id: 'pt-2', memberId: 'mem-2', totalPoints: 100 })]);
    const result = await getLeaderboard();
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  it('sorts by totalPoints descending', async () => {
    __seed('MemberPoints', [
      makeEntry({ _id: 'pt-a', memberId: 'mem-a', displayName: 'Charlie', totalPoints: 50 }),
      makeEntry({ _id: 'pt-b', memberId: 'mem-b', displayName: 'Bob',     totalPoints: 300 }),
      makeEntry({ _id: 'pt-c', memberId: 'mem-c', displayName: 'Alice',   totalPoints: 150 }),
    ]);
    const result = await getLeaderboard();
    expect(result[0].totalPoints).toBe(300);
    expect(result[1].totalPoints).toBe(150);
    expect(result[2].totalPoints).toBe(50);
  });

  it('limits to 10 entries', async () => {
    const entries = Array.from({ length: 15 }, (_, i) =>
      makeEntry({ _id: `pt-${i}`, memberId: `mem-${i}`, totalPoints: 1000 - i })
    );
    __seed('MemberPoints', entries);
    const result = await getLeaderboard();
    expect(result).toHaveLength(10);
  });

  it('maps all fields correctly', async () => {
    __seed('MemberPoints', [makeEntry({ memberId: 'mem-x', displayName: 'Xena', totalPoints: 999, tier: 'Gold' })]);
    const [entry] = await getLeaderboard();
    expect(entry).toMatchObject({ rank: 1, memberId: 'mem-x', displayName: 'Xena', totalPoints: 999, tier: 'Gold' });
  });

  it('defaults null fields', async () => {
    __seed('MemberPoints', [{ _id: 'pt-null', leaderboardOptIn: true }]);
    const [entry] = await getLeaderboard();
    expect(entry.memberId).toBeNull();
    expect(entry.displayName).toBeNull();
    expect(entry.totalPoints).toBe(0);
    expect(entry.tier).toBeNull();
  });

  it('excludes members who have not opted in to leaderboard', async () => {
    __seed('MemberPoints', [
      makeEntry({ _id: 'pt-in',  memberId: 'mem-in',  leaderboardOptIn: true,  totalPoints: 500 }),
      makeEntry({ _id: 'pt-out', memberId: 'mem-out', leaderboardOptIn: false, totalPoints: 999 }),
    ]);
    const result = await getLeaderboard();
    expect(result).toHaveLength(1);
    expect(result[0].memberId).toBe('mem-in');
  });
});

// ── snapshotLeaderboard ──────────────────────────────────────────────────────

describe('snapshotLeaderboard', () => {
  it('returns success:true with a snapshotDate string', async () => {
    __seed('MemberPoints', [makeEntry()]);
    const result = await snapshotLeaderboard();
    expect(result.success).toBe(true);
    expect(result.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('writes one record to LeaderboardSnapshots', async () => {
    __seed('MemberPoints', [makeEntry()]);
    await snapshotLeaderboard();
    const inserted = __getInserted('LeaderboardSnapshots');
    expect(inserted).toHaveLength(1);
  });

  it('snapshot record has snapshotDate, entries, and createdAt', async () => {
    __seed('MemberPoints', [makeEntry()]);
    await snapshotLeaderboard();
    const [record] = __getInserted('LeaderboardSnapshots');
    expect(record.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof record.entries).toBe('string');
    expect(typeof record.createdAt).toBe('string');
  });

  it('entries is a JSON array containing the top-10 shape', async () => {
    __seed('MemberPoints', [makeEntry({ memberId: 'mem-1', totalPoints: 500, tier: 'Gold' })]);
    await snapshotLeaderboard();
    const [record] = __getInserted('LeaderboardSnapshots');
    const entries = JSON.parse(record.entries);
    expect(Array.isArray(entries)).toBe(true);
    expect(entries[0]).toMatchObject({ rank: 1, memberId: 'mem-1', totalPoints: 500, tier: 'Gold' });
  });

  it('returns success:false when MemberPoints query throws', async () => {
    __setQueryError('MemberPoints', new Error('DB error'));
    const result = await snapshotLeaderboard();
    expect(result.success).toBe(false);
    expect(result.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not insert when query fails', async () => {
    __setQueryError('MemberPoints', new Error('DB error'));
    await snapshotLeaderboard();
    expect(__getInserted('LeaderboardSnapshots')).toHaveLength(0);
  });

  it('returns success:false when insert throws', async () => {
    __seed('MemberPoints', [makeEntry()]);
    __setInsertError('LeaderboardSnapshots', new Error('Write error'));
    const result = await snapshotLeaderboard();
    expect(result.success).toBe(false);
  });

  it('snapshot stores entries for empty leaderboard as empty JSON array', async () => {
    __seed('MemberPoints', []);
    await snapshotLeaderboard();
    const [record] = __getInserted('LeaderboardSnapshots');
    expect(JSON.parse(record.entries)).toEqual([]);
  });
});
