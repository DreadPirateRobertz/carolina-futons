/**
 * @file zipLeaderboard.test.js
 * Tests for getZipLeaderboard webMethod (cf-lx5).
 *
 * Leaderboard: rank members in the same 3-digit ZIP prefix by totalPoints desc.
 * MemberPoints must have a zipCode field; prefix = zipCode.slice(0, 3).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';
import { getZipLeaderboard } from '../src/backend/zipLeaderboard.web.js';

beforeEach(() => {
  __reset();
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('getZipLeaderboard — input validation', () => {
  it('returns { leaderboard: [], myRank: null } when memberId is null', async () => {
    const result = await getZipLeaderboard(null);
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
  });

  it('returns { leaderboard: [], myRank: null } when memberId is empty string', async () => {
    const result = await getZipLeaderboard('');
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
  });

  it('returns { leaderboard: [], myRank: null } when member has no MemberPoints record', async () => {
    const result = await getZipLeaderboard('mem-ghost');
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
  });

  it('returns { leaderboard: [], myRank: null } when member has no zipCode', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, zipCode: null }]);
    const result = await getZipLeaderboard('mem-1');
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
  });

  it('returns { leaderboard: [], myRank: null } when zipCode is too short', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, zipCode: '28' }]);
    const result = await getZipLeaderboard('mem-1');
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
  });
});

// ── Leaderboard ranking ───────────────────────────────────────────────────────

describe('getZipLeaderboard — ranking', () => {
  beforeEach(() => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 1000, zipCode: '28201', displayName: 'Alice' },
      { _id: 'mp-2', memberId: 'mem-2', totalPoints:  750, zipCode: '28215', displayName: 'Bob' },
      { _id: 'mp-3', memberId: 'mem-3', totalPoints:  500, zipCode: '28244', displayName: 'Carol' },
      { _id: 'mp-4', memberId: 'mem-4', totalPoints: 1200, zipCode: '28234', displayName: 'Dave' },
      // Different prefix — must be excluded
      { _id: 'mp-5', memberId: 'mem-5', totalPoints: 9999, zipCode: '90210', displayName: 'Eve' },
    ]);
  });

  it('returns only members with matching 3-digit ZIP prefix', async () => {
    const result = await getZipLeaderboard('mem-1');
    const memberIds = result.leaderboard.map(e => e.memberId);
    expect(memberIds).not.toContain('mem-5');
    expect(memberIds).toContain('mem-1');
    expect(memberIds).toContain('mem-2');
  });

  it('sorts leaderboard by totalPoints descending', async () => {
    const result = await getZipLeaderboard('mem-1');
    const points = result.leaderboard.map(e => e.totalPoints);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it('sets rank as 1-based position', async () => {
    const result = await getZipLeaderboard('mem-4'); // Dave has most points in 282
    expect(result.leaderboard[0].rank).toBe(1);
    expect(result.leaderboard[1].rank).toBe(2);
  });

  it('marks the requesting member with isMe: true', async () => {
    const result = await getZipLeaderboard('mem-1');
    const alice = result.leaderboard.find(e => e.memberId === 'mem-1');
    expect(alice.isMe).toBe(true);
    const others = result.leaderboard.filter(e => e.memberId !== 'mem-1');
    for (const o of others) expect(o.isMe).toBe(false);
  });

  it('returns myRank equal to requesting member\'s rank position', async () => {
    const result = await getZipLeaderboard('mem-1'); // Alice: 1000 pts, rank 2 (Dave is 1st)
    expect(result.myRank).toBe(2);
  });

  it('returns myRank: 1 when member has highest points in prefix', async () => {
    const result = await getZipLeaderboard('mem-4'); // Dave: 1200 pts, rank 1
    expect(result.myRank).toBe(1);
  });

  it('includes displayName in each entry', async () => {
    const result = await getZipLeaderboard('mem-1');
    for (const entry of result.leaderboard) {
      expect(typeof entry.displayName).toBe('string');
    }
  });

  it('hoists zipPrefix to response level (not per-entry)', async () => {
    const result = await getZipLeaderboard('mem-1');
    expect(result.zipPrefix).toBe('282');
    // zipPrefix should NOT be duplicated on every entry
    for (const entry of result.leaderboard) {
      expect(entry.zipPrefix).toBeUndefined();
    }
  });

  it('falls back displayName to empty string when field is missing', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-a', memberId: 'mem-a', totalPoints: 200, zipCode: '28201' }, // no displayName
    ]);
    const result = await getZipLeaderboard('mem-a');
    expect(result.leaderboard[0].displayName).toBe('');
  });

  it('falls back totalPoints to 0 when field is null/undefined', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-a', memberId: 'mem-a', totalPoints: undefined, zipCode: '28201', displayName: 'Alice' },
    ]);
    const result = await getZipLeaderboard('mem-a');
    expect(result.leaderboard[0].totalPoints).toBe(0);
  });
});

// ── Cap at 10 ─────────────────────────────────────────────────────────────────

describe('getZipLeaderboard — cap at 10', () => {
  it('returns exactly 10 entries when more than 10 members share prefix', async () => {
    const members = Array.from({ length: 15 }, (_, i) => ({
      _id: `mp-${i}`, memberId: `mem-${i}`,
      totalPoints: (15 - i) * 100,
      zipCode: `282${String(i).padStart(2, '0')}`, // all share '282' prefix
      displayName: `Member ${i}`,
    }));
    __seed('MemberPoints', members);
    const result = await getZipLeaderboard('mem-0');
    expect(result.leaderboard).toHaveLength(10);
  });

  it('returns myRank: null when requesting member falls outside top 10', async () => {
    const members = Array.from({ length: 11 }, (_, i) => ({
      _id: `mp-${i}`, memberId: `mem-${i}`,
      totalPoints: (11 - i) * 100, // mem-0=1100pts (rank 1) … mem-10=100pts (rank 11)
      zipCode: `282${String(i).padStart(2, '0')}`,
      displayName: `Member ${i}`,
    }));
    __seed('MemberPoints', members);
    // mem-10 has 100 pts, ranks 11th — outside top 10
    const result = await getZipLeaderboard('mem-10');
    expect(result.leaderboard).toHaveLength(10);
    expect(result.myRank).toBeNull();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('getZipLeaderboard — error handling', () => {
  it('returns { leaderboard: [], myRank: null } gracefully on DB error', async () => {
    __setQueryError(new Error('DB down'));
    const result = await getZipLeaderboard('mem-1');
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
  });
});
