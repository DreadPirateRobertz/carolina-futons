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
  getTopEarners,
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

// ── getTopEarners — pagination ────────────────────────────────────────────────

function makeTopEarner(overrides = {}) {
  return {
    memberId:         overrides.memberId         || 'mem-1',
    displayName:      overrides.displayName      || 'Alice',
    totalPoints:      overrides.totalPoints      ?? 100,
    tier:             overrides.tier             || 'Silver',
    leaderboardOptIn: overrides.leaderboardOptIn ?? true,
    lastActivityAt:   overrides.lastActivityAt   || '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeEarnerPool(count) {
  return Array.from({ length: count }, (_, i) => makeTopEarner({
    memberId:      `mem-${String(i + 1).padStart(3, '0')}`,
    displayName:   `Member ${i + 1}`,
    totalPoints:   (count - i) * 100,
    lastActivityAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  }));
}

describe('getTopEarners — pagination', () => {
  it('returns first page with correct entries and ranks', async () => {
    __seed('MemberPoints', makeEarnerPool(20));
    const result = await getTopEarners(5, 0);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(5);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[4].rank).toBe(5);
    const points = result.entries.map(e => e.totalPoints);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it('page 2 returns correct slice and ranks starting at offset+1', async () => {
    __seed('MemberPoints', makeEarnerPool(20));
    const page1 = await getTopEarners(5, 0);
    const page2 = await getTopEarners(5, 5);
    expect(page2.success).toBe(true);
    expect(page2.entries).toHaveLength(5);
    expect(page2.entries[0].rank).toBe(6);
    expect(page2.entries[4].rank).toBe(10);
    // No overlap between pages
    const ids1 = new Set(page1.entries.map(e => e.memberId));
    expect(page2.entries.every(e => !ids1.has(e.memberId))).toBe(true);
    // Page 2 max points < page 1 min points
    const maxPts2 = Math.max(...page2.entries.map(e => e.totalPoints));
    const minPts1 = Math.min(...page1.entries.map(e => e.totalPoints));
    expect(maxPts2).toBeLessThan(minPts1);
  });

  it('returns empty entries when offset exceeds total', async () => {
    __seed('MemberPoints', makeEarnerPool(5));
    const result = await getTopEarners(10, 100);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(0);
  });

  it('reports total count of all matching opted-in members', async () => {
    __seed('MemberPoints', makeEarnerPool(15));
    const result = await getTopEarners(5, 0);
    expect(result.total).toBe(15);
  });

  it('each entry includes rank, memberId, displayName, totalPoints, tier, lastActivityAt', async () => {
    __seed('MemberPoints', makeEarnerPool(3));
    const result = await getTopEarners(3, 0);
    for (const entry of result.entries) {
      expect(entry).toHaveProperty('rank');
      expect(entry).toHaveProperty('memberId');
      expect(entry).toHaveProperty('displayName');
      expect(entry).toHaveProperty('totalPoints');
      expect(entry).toHaveProperty('tier');
      expect(entry).toHaveProperty('lastActivityAt');
    }
  });

  it('uses default limit=10 offset=0 when called with no arguments', async () => {
    __seed('MemberPoints', makeEarnerPool(20));
    const result = await getTopEarners();
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(10);
    expect(result.entries[0].rank).toBe(1);
  });
});

// ── getTopEarners — tie-breaking ──────────────────────────────────────────────

describe('getTopEarners — tie-breaking', () => {
  it('breaks ties by lastActivityAt ascending (earlier activity ranks higher)', async () => {
    __seed('MemberPoints', [
      makeTopEarner({ memberId: 'mem-late',  totalPoints: 500, lastActivityAt: '2026-03-15T00:00:00.000Z' }),
      makeTopEarner({ memberId: 'mem-early', totalPoints: 500, lastActivityAt: '2026-01-01T00:00:00.000Z' }),
      makeTopEarner({ memberId: 'mem-mid',   totalPoints: 500, lastActivityAt: '2026-02-10T00:00:00.000Z' }),
    ]);
    const result = await getTopEarners(3, 0);
    expect(result.success).toBe(true);
    expect(result.entries[0].memberId).toBe('mem-early');
    expect(result.entries[1].memberId).toBe('mem-mid');
    expect(result.entries[2].memberId).toBe('mem-late');
  });

  it('primary sort is totalPoints desc — tie-break only applies among equal-points members', async () => {
    __seed('MemberPoints', [
      makeTopEarner({ memberId: 'mem-a', totalPoints: 1000, lastActivityAt: '2026-03-01T00:00:00.000Z' }),
      makeTopEarner({ memberId: 'mem-b', totalPoints: 500,  lastActivityAt: '2026-01-01T00:00:00.000Z' }),
      makeTopEarner({ memberId: 'mem-c', totalPoints: 500,  lastActivityAt: '2026-02-01T00:00:00.000Z' }),
    ]);
    const result = await getTopEarners(3, 0);
    expect(result.entries[0].memberId).toBe('mem-a');
    expect(result.entries[1].memberId).toBe('mem-b');
    expect(result.entries[2].memberId).toBe('mem-c');
  });

  it('tie-breaking is stable across page boundaries', async () => {
    __seed('MemberPoints', [
      makeTopEarner({ memberId: 'mem-d', totalPoints: 500, lastActivityAt: '2026-04-01T00:00:00.000Z' }),
      makeTopEarner({ memberId: 'mem-a', totalPoints: 500, lastActivityAt: '2026-01-01T00:00:00.000Z' }),
      makeTopEarner({ memberId: 'mem-c', totalPoints: 500, lastActivityAt: '2026-03-01T00:00:00.000Z' }),
      makeTopEarner({ memberId: 'mem-b', totalPoints: 500, lastActivityAt: '2026-02-01T00:00:00.000Z' }),
    ]);
    const page1 = await getTopEarners(2, 0);
    const page2 = await getTopEarners(2, 2);
    expect(page1.entries[0].memberId).toBe('mem-a');
    expect(page1.entries[1].memberId).toBe('mem-b');
    expect(page2.entries[0].memberId).toBe('mem-c');
    expect(page2.entries[1].memberId).toBe('mem-d');
  });
});

// ── getTopEarners — input validation ─────────────────────────────────────────

describe('getTopEarners — input validation', () => {
  it('rejects limit=0', async () => {
    __seed('MemberPoints', makeEarnerPool(5));
    const result = await getTopEarners(0, 0);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/limit/i);
  });

  it('rejects negative limit', async () => {
    __seed('MemberPoints', makeEarnerPool(5));
    const result = await getTopEarners(-5, 0);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/limit/i);
  });

  it('clamps limit to max 100', async () => {
    __seed('MemberPoints', makeEarnerPool(200));
    const result = await getTopEarners(999, 0);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(100);
  });

  it('rejects negative offset', async () => {
    __seed('MemberPoints', makeEarnerPool(5));
    const result = await getTopEarners(10, -1);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/offset/i);
  });

  it('clamps offset to max 10000 — beyond total returns empty', async () => {
    __seed('MemberPoints', makeEarnerPool(5));
    const result = await getTopEarners(10, 99999);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(0);
  });
});

// ── getTopEarners — error handling / opt-in filter ────────────────────────────

describe('getTopEarners — error handling', () => {
  it('returns success:false when wixData query throws', async () => {
    __setQueryError('MemberPoints', new Error('DB unavailable'));
    const result = await getTopEarners(10, 0);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('excludes members who have opted out of the leaderboard', async () => {
    __seed('MemberPoints', [
      makeTopEarner({ memberId: 'mem-in',  totalPoints: 500, leaderboardOptIn: true  }),
      makeTopEarner({ memberId: 'mem-out', totalPoints: 900, leaderboardOptIn: false }),
    ]);
    const result = await getTopEarners(10, 0);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].memberId).toBe('mem-in');
  });

  it('returns empty entries when no members have opted in', async () => {
    __seed('MemberPoints', [
      makeTopEarner({ memberId: 'mem-1', leaderboardOptIn: false }),
    ]);
    const result = await getTopEarners(10, 0);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
