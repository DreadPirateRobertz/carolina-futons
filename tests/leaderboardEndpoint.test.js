/**
 * TDD tests for POST /_functions/getLeaderboard
 *
 * Mobile LeaderboardScreen calls this endpoint via wixClient.getLeaderboard().
 * Bead: cfutons_mobile-rm5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __setMember, __reset as __resetMember } from './__mocks__/wix-members-backend.js';
import { __seed, __reset as __resetData, __setQueryError } from './__mocks__/wix-data.js';
import { post_getLeaderboard } from '../src/backend/leaderboard-http.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body = {}) {
  return { body: JSON.stringify(body) };
}

const MEMBER_A = { _id: 'mem-aaa', memberId: 'mem-aaa', displayName: 'Alice', totalPoints: 1200, tier: 'Summit Master', leaderboardOptIn: true };
const MEMBER_B = { _id: 'mem-bbb', memberId: 'mem-bbb', displayName: 'Bob',   totalPoints: 900,  tier: 'Mountain Guide', leaderboardOptIn: true };
const MEMBER_C = { _id: 'mem-ccc', memberId: 'mem-ccc', displayName: 'Carol', totalPoints: 600,  tier: 'Trail Blazer',   leaderboardOptIn: true };
const CURRENT  = { _id: 'mem-me',  memberId: 'mem-me',  displayName: 'Me',    totalPoints: 450,  tier: 'Trail Blazer',   leaderboardOptIn: true };

beforeEach(() => {
  __resetMember();
  __resetData();
  __setMember({ _id: CURRENT._id });
  __seed('MemberPoints', [MEMBER_A, MEMBER_B, MEMBER_C, CURRENT]);
  __seed('MemberGamificationPreferences', [
    { memberId: 'mem-aaa', leaderboardOptIn: true },
    { memberId: 'mem-bbb', leaderboardOptIn: true },
    { memberId: 'mem-ccc', leaderboardOptIn: true },
    { memberId: 'mem-me',  leaderboardOptIn: true },
  ]);
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('POST /getLeaderboard — auth', () => {
  it('returns 401 when no member session', async () => {
    __setMember(null);
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    expect(res.status).toBe(401);
  });

  it('returns JSON error body on 401', async () => {
    __setMember(null);
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    const body = JSON.parse(res.body);
    expect(body.error).toBeTruthy();
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('POST /getLeaderboard — validation', () => {
  it('returns 400 for invalid period', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'monthly', limit: 20 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit > 50', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 51 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit < 1', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 0 }));
    expect(res.status).toBe(400);
  });
});

// ── 200 — success ─────────────────────────────────────────────────────────────

describe('POST /getLeaderboard — 200 success (allTime)', () => {
  it('returns 200', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    expect(res.status).toBe(200);
  });

  it('response body has entries array', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it('entries include required fields', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    const { entries } = JSON.parse(res.body);
    expect(entries.length).toBeGreaterThan(0);
    const first = entries[0];
    expect(first).toHaveProperty('memberId');
    expect(first).toHaveProperty('displayName');
    expect(first).toHaveProperty('points');
    expect(first).toHaveProperty('tier');
    expect(first).toHaveProperty('rank');
  });

  it('entries are sorted descending by points (rank 1 = most points)', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    const { entries } = JSON.parse(res.body);
    expect(entries[0].memberId).toBe('mem-aaa'); // 1200 pts
    expect(entries[1].memberId).toBe('mem-bbb'); // 900 pts
    expect(entries[0].rank).toBe(1);
    expect(entries[1].rank).toBe(2);
  });

  it('response body has currentUserRank as number when current user is in entries', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    const body = JSON.parse(res.body);
    expect(typeof body.currentUserRank).toBe('number');
    expect(body.currentUserRank).toBe(4); // CURRENT has 450pts, rank 4
  });

  it('currentUserRank is null when current user not in results (below limit)', async () => {
    // Seed 20 members all above CURRENT's points so CURRENT falls below limit=3
    const topMembers = Array.from({ length: 3 }, (_, i) => ({
      _id: `top-${i}`,
      memberId: `top-${i}`,
      displayName: `Top${i}`,
      totalPoints: 5000 - i * 100,
      tier: 'Summit Master',
      leaderboardOptIn: true,
    }));
    __resetData();
    __seed('MemberPoints', [...topMembers, CURRENT]);
    __seed('MemberGamificationPreferences', [
      ...topMembers.map(m => ({ memberId: m.memberId, leaderboardOptIn: true })),
      { memberId: CURRENT.memberId, leaderboardOptIn: true },
    ]);
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 3 }));
    const body = JSON.parse(res.body);
    expect(body.currentUserRank).toBeNull();
  });
});

// ── Weekly period ─────────────────────────────────────────────────────────────

describe('POST /getLeaderboard — weekly period', () => {
  it('returns 200 for weekly period', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'weekly', limit: 20 }));
    expect(res.status).toBe(200);
  });
});

// ── Defaults ──────────────────────────────────────────────────────────────────

describe('POST /getLeaderboard — defaults', () => {
  it('defaults period to allTime when not provided', async () => {
    const res = await post_getLeaderboard(makeRequest({ limit: 20 }));
    expect(res.status).toBe(200);
  });

  it('defaults limit to 20 when not provided', async () => {
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime' }));
    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.entries.length).toBeLessThanOrEqual(20);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('POST /getLeaderboard — error handling', () => {
  it('returns 500 on data query failure', async () => {
    __setQueryError('MemberPoints', new Error('DB timeout'));
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    expect(res.status).toBe(500);
  });

  it('returns JSON error body on 500', async () => {
    __setQueryError('MemberPoints', new Error('DB timeout'));
    const res = await post_getLeaderboard(makeRequest({ period: 'allTime', limit: 20 }));
    const body = JSON.parse(res.body);
    expect(body.error).toBeTruthy();
  });
});
