/**
 * @file zipLeaderboard.test.js
 * Tests for getZipLeaderboard webMethod (cf-lx5).
 *
 * Leaderboard: rank opted-in members in the same 3-digit ZIP prefix by totalPoints desc.
 * Caller identity resolved server-side via currentMember.getMember() — no memberId param.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError, __getLastFindOptions } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { getZipLeaderboard, _resetRateLimit } from '../src/backend/zipLeaderboard.web.js';

beforeEach(() => {
  __reset();
  _resetRateLimit();
  __setMember({ _id: 'mem-1' });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('getZipLeaderboard — input validation', () => {
  it('returns empty result when currentMember resolves to null', async () => {
    __setMember(null);
    const result = await getZipLeaderboard();
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
    expect(result.zipPrefix).toBeNull();
  });

  it('returns empty result when member has no MemberPoints record', async () => {
    // __reset() clears seeds — no MemberPoints record for mem-1
    const result = await getZipLeaderboard();
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
    expect(result.zipPrefix).toBeNull();
  });

  it('returns empty result when member has no zipCode', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, zipCode: null }]);
    const result = await getZipLeaderboard();
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
    expect(result.zipPrefix).toBeNull();
  });

  it('returns empty result when zipCode is too short', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, zipCode: '28' }]);
    const result = await getZipLeaderboard();
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
    expect(result.zipPrefix).toBeNull();
  });
});

// ── leaderboardOptIn gate ─────────────────────────────────────────────────────

describe('getZipLeaderboard — leaderboardOptIn gate', () => {
  it('excludes members with leaderboardOptIn: false', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 300, zipCode: '28201', displayName: 'Alice', leaderboardOptIn: true },
      { _id: 'mp-2', memberId: 'mem-2', totalPoints: 999, zipCode: '28215', displayName: 'Bob',   leaderboardOptIn: false },
    ]);
    const result = await getZipLeaderboard();
    const memberIds = result.leaderboard.map(e => e.memberId);
    expect(memberIds).not.toContain('mem-2');
    expect(memberIds).toContain('mem-1');
  });

  it('excludes members with leaderboardOptIn absent (default off)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 300, zipCode: '28201', displayName: 'Alice', leaderboardOptIn: true },
      { _id: 'mp-2', memberId: 'mem-2', totalPoints: 999, zipCode: '28215', displayName: 'Bob' }, // no field
    ]);
    const result = await getZipLeaderboard();
    const memberIds = result.leaderboard.map(e => e.memberId);
    expect(memberIds).not.toContain('mem-2');
  });

  it('returns empty leaderboard when no opted-in members in ZIP prefix', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, zipCode: '28201', leaderboardOptIn: false },
    ]);
    const result = await getZipLeaderboard();
    expect(result.leaderboard).toEqual([]);
  });

  it('returns leaderboard with myRank: null when caller is not opted in', async () => {
    // Caller (mem-1) not opted in — still gets leaderboard view, but myRank is null
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 300, zipCode: '28201', leaderboardOptIn: false },
      { _id: 'mp-2', memberId: 'mem-2', totalPoints: 500, zipCode: '28215', displayName: 'Bob', leaderboardOptIn: true },
    ]);
    const result = await getZipLeaderboard();
    expect(result.myRank).toBeNull();
    expect(result.leaderboard.map(e => e.memberId)).toContain('mem-2');
    expect(result.leaderboard.map(e => e.memberId)).not.toContain('mem-1');
  });
});

// ── Leaderboard ranking ───────────────────────────────────────────────────────

describe('getZipLeaderboard — ranking', () => {
  beforeEach(() => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 1000, zipCode: '28201', displayName: 'Alice', leaderboardOptIn: true },
      { _id: 'mp-2', memberId: 'mem-2', totalPoints:  750, zipCode: '28215', displayName: 'Bob',   leaderboardOptIn: true },
      { _id: 'mp-3', memberId: 'mem-3', totalPoints:  500, zipCode: '28244', displayName: 'Carol', leaderboardOptIn: true },
      { _id: 'mp-4', memberId: 'mem-4', totalPoints: 1200, zipCode: '28234', displayName: 'Dave',  leaderboardOptIn: true },
      // Different prefix — must be excluded
      { _id: 'mp-5', memberId: 'mem-5', totalPoints: 9999, zipCode: '90210', displayName: 'Eve',   leaderboardOptIn: true },
    ]);
  });

  it('returns only members with matching 3-digit ZIP prefix', async () => {
    const result = await getZipLeaderboard();
    const memberIds = result.leaderboard.map(e => e.memberId);
    expect(memberIds).not.toContain('mem-5');
    expect(memberIds).toContain('mem-1');
    expect(memberIds).toContain('mem-2');
  });

  it('sorts leaderboard by totalPoints descending', async () => {
    const result = await getZipLeaderboard();
    const points = result.leaderboard.map(e => e.totalPoints);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it('sets rank as 1-based position', async () => {
    __setMember({ _id: 'mem-4' }); // Dave has most points in 282
    const result = await getZipLeaderboard();
    expect(result.leaderboard[0].rank).toBe(1);
    expect(result.leaderboard[1].rank).toBe(2);
  });

  it('marks the caller with isMe: true', async () => {
    const result = await getZipLeaderboard(); // mem-1 is caller
    const alice = result.leaderboard.find(e => e.memberId === 'mem-1');
    expect(alice.isMe).toBe(true);
    const others = result.leaderboard.filter(e => e.memberId !== 'mem-1');
    for (const o of others) expect(o.isMe).toBe(false);
  });

  it('returns myRank equal to caller\'s rank position', async () => {
    const result = await getZipLeaderboard(); // Alice: 1000 pts, rank 2 (Dave is 1st)
    expect(result.myRank).toBe(2);
  });

  it('returns myRank: 1 when caller has highest points in prefix', async () => {
    __setMember({ _id: 'mem-4' }); // Dave: 1200 pts, rank 1
    const result = await getZipLeaderboard();
    expect(result.myRank).toBe(1);
  });

  it('includes displayName in each entry', async () => {
    const result = await getZipLeaderboard();
    for (const entry of result.leaderboard) {
      expect(typeof entry.displayName).toBe('string');
    }
  });

  it('hoists zipPrefix to response level (not per-entry)', async () => {
    const result = await getZipLeaderboard();
    expect(result.zipPrefix).toBe('282');
    for (const entry of result.leaderboard) {
      expect(entry.zipPrefix).toBeUndefined();
    }
  });

  it('falls back displayName to empty string when field is missing', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-a', memberId: 'mem-1', totalPoints: 200, zipCode: '28201', leaderboardOptIn: true }, // no displayName
    ]);
    const result = await getZipLeaderboard();
    expect(result.leaderboard[0].displayName).toBe('');
  });

  it('falls back totalPoints to 0 when field is null/undefined', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-a', memberId: 'mem-1', totalPoints: undefined, zipCode: '28201', displayName: 'Alice', leaderboardOptIn: true },
    ]);
    const result = await getZipLeaderboard();
    expect(result.leaderboard[0].totalPoints).toBe(0);
  });
});

// ── Cap at 10 ─────────────────────────────────────────────────────────────────

describe('getZipLeaderboard — cap at 10', () => {
  it('returns exactly 10 entries when more than 10 opted-in members share prefix', async () => {
    const members = Array.from({ length: 15 }, (_, i) => ({
      _id: `mp-${i}`, memberId: `mem-${i}`,
      totalPoints: (15 - i) * 100,
      zipCode: `282${String(i).padStart(2, '0')}`,
      displayName: `Member ${i}`,
      leaderboardOptIn: true,
    }));
    __seed('MemberPoints', members);
    const result = await getZipLeaderboard();
    expect(result.leaderboard).toHaveLength(10);
  });

  it('returns myRank: null when caller falls outside top 10', async () => {
    const members = Array.from({ length: 11 }, (_, i) => ({
      _id: `mp-${i}`, memberId: `mem-${i}`,
      totalPoints: (11 - i) * 100, // mem-0=1100 (rank 1) … mem-10=100 (rank 11)
      zipCode: `282${String(i).padStart(2, '0')}`,
      displayName: `Member ${i}`,
      leaderboardOptIn: true,
    }));
    __seed('MemberPoints', members);
    __setMember({ _id: 'mem-10' }); // rank 11 — outside top 10
    const result = await getZipLeaderboard();
    expect(result.leaderboard).toHaveLength(10);
    expect(result.myRank).toBeNull();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('getZipLeaderboard — error handling', () => {
  it('returns empty result gracefully on DB error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await getZipLeaderboard();
    expect(result.leaderboard).toEqual([]);
    expect(result.myRank).toBeNull();
  });
});

// ── suppressAuth assertions ───────────────────────────────────────────────────

describe('getZipLeaderboard — suppressAuth', () => {
  it('passes suppressAuth: true on the self-lookup query', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 300, zipCode: '28201', displayName: 'Alice', leaderboardOptIn: true },
    ]);
    await getZipLeaderboard();
    const opts = __getLastFindOptions('MemberPoints');
    expect(opts).toEqual({ suppressAuth: true });
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('getZipLeaderboard — rate limiting', () => {
  it('returns 429 after 10 calls within the rate limit window', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 300, zipCode: '28201', displayName: 'Alice', leaderboardOptIn: true },
    ]);
    // Exhaust the 10-call limit
    for (let i = 0; i < 10; i++) {
      await getZipLeaderboard();
    }
    const result = await getZipLeaderboard(); // 11th call
    expect(result.status).toBe(429);
  });

  it('allows calls again after rate limit reset', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 300, zipCode: '28201', displayName: 'Alice', leaderboardOptIn: true },
    ]);
    for (let i = 0; i < 10; i++) await getZipLeaderboard();
    _resetRateLimit();
    const result = await getZipLeaderboard();
    expect(result.status).toBeUndefined(); // not rate-limited
    expect(result.leaderboard).toBeDefined();
  });

  it('rate limits per member independently', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 300, zipCode: '28201', displayName: 'Alice', leaderboardOptIn: true },
      { _id: 'mp-2', memberId: 'mem-2', totalPoints: 200, zipCode: '28201', displayName: 'Bob', leaderboardOptIn: true },
    ]);
    // Exhaust mem-1's limit
    for (let i = 0; i < 10; i++) await getZipLeaderboard(); // mem-1
    const mem1Result = await getZipLeaderboard(); // 11th for mem-1
    expect(mem1Result.status).toBe(429);

    // mem-2 should still be allowed
    __setMember({ _id: 'mem-2' });
    const mem2Result = await getZipLeaderboard();
    expect(mem2Result.status).toBeUndefined();
  });
});
