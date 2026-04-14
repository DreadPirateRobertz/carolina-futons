/**
 * @file leaderboardPreview.test.js
 * @description TDD tests for getLeaderboardPreview in leaderboardService.web.js.
 *
 * Covers:
 *  - returns [] when MemberPoints is empty
 *  - returns [] on query error
 *  - returns up to 3 entries sorted by totalPoints desc
 *  - maps fields: rank, displayName, points, tier, avatarUrl
 *  - defaults null/missing fields correctly
 *  - excludes members without leaderboardOptIn
 *  - returns at most 3 entries even if more exist
 *
 * cf-xmt
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from 'wix-data';
import { getLeaderboardPreview } from '../src/backend/leaderboardService.web.js';

function makeMember(overrides = {}) {
  return {
    _id:              overrides._id              ?? `mp-${overrides.memberId ?? 'def'}`,
    memberId:         overrides.memberId         ?? 'mem-1',
    displayName:      overrides.displayName      ?? 'Alice',
    totalPoints:      overrides.totalPoints      ?? 100,
    tier:             overrides.tier             ?? 'Trail Blazer',
    avatarUrl:        overrides.avatarUrl        ?? null,
    leaderboardOptIn: overrides.leaderboardOptIn ?? true,
    ...overrides,
  };
}

beforeEach(() => {
  __reset();
});

describe('getLeaderboardPreview', () => {
  it('returns [] when MemberPoints is empty', async () => {
    __seed('MemberPoints', []);
    const result = await getLeaderboardPreview();
    expect(result).toEqual([]);
  });

  it('returns [] on query error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await getLeaderboardPreview();
    expect(result).toEqual([]);
  });

  it('returns entries with rank, displayName, points, tier, avatarUrl', async () => {
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-a', displayName: 'Alice', totalPoints: 500, tier: 'Summit Master', avatarUrl: 'https://example.com/alice.jpg' }),
    ]);
    const [entry] = await getLeaderboardPreview();
    expect(entry).toMatchObject({
      rank: 1,
      displayName: 'Alice',
      points: 500,
      tier: 'Summit Master',
      avatarUrl: 'https://example.com/alice.jpg',
    });
  });

  it('defaults null/missing fields', async () => {
    __seed('MemberPoints', [{ _id: 'mp-x', leaderboardOptIn: true }]);
    const [entry] = await getLeaderboardPreview();
    expect(entry.displayName).toBeNull();
    expect(entry.points).toBe(0);
    expect(entry.tier).toBeNull();
    expect(entry.avatarUrl).toBeNull();
  });

  it('sorts by totalPoints descending', async () => {
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-c', totalPoints: 50 }),
      makeMember({ memberId: 'mem-a', totalPoints: 500 }),
      makeMember({ memberId: 'mem-b', totalPoints: 200 }),
    ]);
    const result = await getLeaderboardPreview();
    expect(result[0].points).toBe(500);
    expect(result[1].points).toBe(200);
    expect(result[2].points).toBe(50);
  });

  it('returns at most 3 entries', async () => {
    const members = Array.from({ length: 10 }, (_, i) =>
      makeMember({ memberId: `mem-${i}`, totalPoints: 1000 - i * 10 })
    );
    __seed('MemberPoints', members);
    const result = await getLeaderboardPreview();
    expect(result).toHaveLength(3);
  });

  it('assigns rank starting at 1', async () => {
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-a', totalPoints: 300 }),
      makeMember({ memberId: 'mem-b', totalPoints: 200 }),
      makeMember({ memberId: 'mem-c', totalPoints: 100 }),
    ]);
    const result = await getLeaderboardPreview();
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
  });

  it('excludes members without leaderboardOptIn', async () => {
    __seed('MemberPoints', [
      makeMember({ memberId: 'mem-in',  totalPoints: 100, leaderboardOptIn: true }),
      makeMember({ memberId: 'mem-out', totalPoints: 999, leaderboardOptIn: false }),
    ]);
    const result = await getLeaderboardPreview();
    expect(result).toHaveLength(1);
    expect(result[0].points).toBe(100);
  });
});
