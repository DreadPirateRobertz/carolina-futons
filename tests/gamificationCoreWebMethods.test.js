/**
 * gamificationCoreWebMethods.test.js
 * CF-i5bi — Branch coverage for getStreakData, getLeaderboard, getMemberTier, getActivityFeed
 *
 * These 4 webMethods in gamificationCore.web.js have 27 [0,0] branches
 * that need at least one execution path to move branch coverage up.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory collections ────────────────────────────────────────────

let _collections = {};

function seed(collection, items) {
  _collections[collection] = items.map((item, i) => ({ _id: `id-${i}`, ...item }));
}

function buildQueryChain(collection) {
  let filters = [];
  let sortField = null;
  let sortDir = 'asc';
  let limitVal = 50;

  const chain = {
    eq: (f, v) => { filters.push({ f, op: 'eq', v }); return chain; },
    gt: (f, v) => { filters.push({ f, op: 'gt', v }); return chain; },
    descending: (f) => { sortField = f; sortDir = 'desc'; return chain; },
    limit: (n) => { limitVal = n; return chain; },
    find: async () => {
      let items = (_collections[collection] || []).filter(item =>
        filters.every(({ f, op, v }) => {
          if (op === 'eq') return item[f] === v;
          if (op === 'gt') return item[f] > v;
          return true;
        })
      );
      if (sortField) {
        items.sort((a, b) => sortDir === 'desc'
          ? (b[sortField] ?? 0) - (a[sortField] ?? 0)
          : (a[sortField] ?? 0) - (b[sortField] ?? 0));
      }
      items = items.slice(0, limitVal);
      return { items, totalCount: items.length };
    },
    count: async () => {
      const items = (_collections[collection] || []).filter(item =>
        filters.every(({ f, op, v }) => {
          if (op === 'eq') return item[f] === v;
          if (op === 'gt') return item[f] > v;
          return true;
        })
      );
      return items.length;
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (col) => buildQueryChain(col),
    get: async (col, id) => (_collections[col] || []).find(i => i._id === id) || null,
    insert: async (col, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(record);
      return record;
    },
    update: async (col, item) => item,
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let __mockMemberId = null;
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(__mockMemberId ? { _id: __mockMemberId } : null)),
  },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(() => Promise.resolve('test-secret')),
}));

// ── Import after mocks ──────────────────────────────────────────────

import {
  getStreakData,
  getLeaderboard,
  getMemberTier,
  getActivityFeed,
  getActiveChallenges,
  getActiveChallengeOfWeek,
  computeTierInfo,
} from '../src/backend/gamificationCore.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  __mockMemberId = null;
});

// ── getStreakData ────────────────────────────────────────────────────

describe('getStreakData', () => {
  it('returns zeros when member has no record', async () => {
    const result = await getStreakData('nonexistent');
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.lastActivityDate).toBeNull();
  });

  it('returns streak data from member record', async () => {
    seed('MemberPoints', [{
      memberId: 'mem-1',
      currentStreakDays: 7,
      longestStreakDays: 14,
      lastActivityDate: '2026-03-20',
      totalPoints: 500,
    }]);

    const result = await getStreakData('mem-1');
    expect(result.currentStreak).toBe(7);
    expect(result.longestStreak).toBe(14);
    expect(result.lastActivityDate).toBe('2026-03-20');
  });

  it('falls back currentStreak to longestStreak when longestStreakDays is null', async () => {
    seed('MemberPoints', [{
      memberId: 'mem-2',
      currentStreakDays: 5,
      longestStreakDays: undefined,
      lastActivityDate: null,
      totalPoints: 100,
    }]);

    const result = await getStreakData('mem-2');
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(5); // falls back to currentStreak
    expect(result.lastActivityDate).toBeNull();
  });
});

// ── getLeaderboard ──────────────────────────────────────────────────

describe('getLeaderboard', () => {
  it('returns sorted leaderboard entries', async () => {
    seed('MemberPoints', [
      { memberId: 'a', displayName: 'Alice', totalPoints: 300, leaderboardOptIn: true, avatarUrl: null },
      { memberId: 'b', displayName: 'Bob', totalPoints: 500, leaderboardOptIn: true, avatarUrl: 'bob.jpg' },
      { memberId: 'c', displayName: null, totalPoints: 100, leaderboardOptIn: true, avatarUrl: null },
    ]);

    const result = await getLeaderboard(10);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].nickname).toBe('Bob');
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].totalPoints).toBe(500);
    expect(result.entries[2].nickname).toBe('Anonymous'); // null displayName fallback
  });

  it('calculates current user rank when in top N', async () => {
    seed('MemberPoints', [
      { memberId: 'a', displayName: 'Alice', totalPoints: 500, leaderboardOptIn: true },
      { memberId: 'b', displayName: 'Bob', totalPoints: 300, leaderboardOptIn: true },
    ]);

    const result = await getLeaderboard(10, 'a');
    expect(result.currentUserRank).toBe(1);
  });

  it('calculates current user rank when NOT in top N', async () => {
    seed('MemberPoints', [
      { memberId: 'top1', displayName: 'Top1', totalPoints: 1000, leaderboardOptIn: true },
      { memberId: 'top2', displayName: 'Top2', totalPoints: 900, leaderboardOptIn: true },
      { memberId: 'user', displayName: 'User', totalPoints: 50, leaderboardOptIn: true },
    ]);

    const result = await getLeaderboard(2, 'user'); // only top 2 returned
    expect(result.currentUserRank).toBe(3);
    expect(result.pointsToTopTen).toBeGreaterThan(0);
  });

  it('returns null rank when no memberId provided', async () => {
    seed('MemberPoints', [
      { memberId: 'a', displayName: 'Alice', totalPoints: 500, leaderboardOptIn: true },
    ]);

    const result = await getLeaderboard(10);
    expect(result.currentUserRank).toBeNull();
  });
});

// ── getMemberTier ───────────────────────────────────────────────────

describe('getMemberTier', () => {
  it('returns lowest tier for member with no record', async () => {
    const result = await getMemberTier('nonexistent');
    expect(result.tierName).toBeDefined();
    expect(result.pointsInTier).toBe(0);
  });

  it('returns correct tier for member with points', async () => {
    seed('MemberPoints', [{ memberId: 'mem-1', totalPoints: 2500 }]);

    const result = await getMemberTier('mem-1');
    expect(result.tierName).toBeDefined();
    expect(result.benefits).toBeInstanceOf(Array);
    expect(result.currentTier).toBeTruthy();
  });
});

// ── computeTierInfo ─────────────────────────────────────────────────

describe('computeTierInfo', () => {
  it('returns Trail Blazer for 0 points', () => {
    const info = computeTierInfo(0);
    expect(info.tierName).toBe('Trail Blazer');
    expect(info.benefits).toContain('1x points');
    expect(info.nextTierName).toBeTruthy();
    expect(info.pointsToNextTier).toBeGreaterThan(0);
  });

  it('returns highest tier for very high points', () => {
    const info = computeTierInfo(100000);
    expect(info.tierName).toBe('Blue Ridge Legend');
    expect(info.nextTierName).toBeNull();
    expect(info.pointsToNextTier).toBe(0);
    expect(info.nextTierBenefits).toBeNull();
  });

  it('handles null/undefined points', () => {
    const info = computeTierInfo(null);
    expect(info.tierName).toBe('Trail Blazer');

    const info2 = computeTierInfo(undefined);
    expect(info2.tierName).toBe('Trail Blazer');
  });

  it('returns mid-tier for moderate points', () => {
    const info = computeTierInfo(1500);
    // Should be Mountain Guide or Summit Master depending on thresholds
    expect(info.currentTier).toBeTruthy();
    expect(info.pointsInTier).toBeGreaterThanOrEqual(0);
  });
});

// ── getActivityFeed ─────────────────────────────────────────────────

describe('getActivityFeed', () => {
  it('returns empty when caller is not the requested member', async () => {
    __mockMemberId = 'other-member';
    const result = await getActivityFeed('mem-1');
    expect(result).toEqual([]);
  });

  it('returns activity feed for authenticated member', async () => {
    __mockMemberId = 'mem-1';
    seed('AnalyticsEvents', [
      { memberId: 'mem-1', eventType: 'purchase', timestamp: '2026-03-20T10:00:00Z', payload: JSON.stringify({ description: 'Bought Sedona Frame', pointsEarned: 100 }) },
      { memberId: 'mem-1', eventType: 'review', timestamp: '2026-03-19T10:00:00Z', payload: { description: 'Left a review', pointsEarned: 50 } },
      { memberId: 'mem-1', eventType: 'streak', timestamp: '2026-03-18T10:00:00Z', payload: null },
    ]);

    const result = await getActivityFeed('mem-1', 10);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('purchase');
    expect(result[0].pointsEarned).toBe(100);
    expect(result[0].iconType).toBe('cart');
    expect(result[1].iconType).toBe('star');
    expect(result[2].iconType).toBe('fire');
    expect(result[2].description).toBe('streak'); // fallback from eventType
  });

  it('returns empty when no member is authenticated', async () => {
    __mockMemberId = null;
    const result = await getActivityFeed('mem-1');
    expect(result).toEqual([]);
  });
});

// ── cf-1y7: silent null-member guard observability (cf-2ag cascade) ───

describe('cf-1y7 null-member guard cascade', () => {
  describe('getStreakData', () => {
    it('returns zero-streak baseline + error: auth_required + warns when memberId is null', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await getStreakData(null);
      expect(result).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        error: 'auth_required',
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[gamificationCore] getStreakData: no memberId on session'),
      );
      warnSpy.mockRestore();
    });

    it('returns zero-streak baseline + error: auth_required + warns when memberId is undefined', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await getStreakData();
      expect(result.error).toBe('auth_required');
      expect(result.currentStreak).toBe(0);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('omits error field on successful authenticated read', async () => {
      seed('MemberPoints', [{ memberId: 'mem-ok', currentStreakDays: 3 }]);
      const result = await getStreakData('mem-ok');
      expect(result.error).toBeUndefined();
      expect(result.currentStreak).toBe(3);
    });
  });

  describe('getMemberTier', () => {
    it('returns lowest-tier baseline + error: auth_required + warns when memberId is null', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await getMemberTier(null);
      expect(result.tierName).toBe('Trail Blazer'); // computeTierInfo(0) baseline preserved
      expect(result.error).toBe('auth_required');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[gamificationCore] getMemberTier: no memberId on session'),
      );
      warnSpy.mockRestore();
    });

    it('omits error field on successful authenticated read', async () => {
      seed('MemberPoints', [{ memberId: 'mem-ok', totalPoints: 500 }]);
      const result = await getMemberTier('mem-ok');
      expect(result.error).toBeUndefined();
    });
  });

  describe('getActiveChallenges', () => {
    it('returns { challenges: [], error: auth_required } + warns when memberId is null', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await getActiveChallenges(null);
      expect(result).toEqual({ challenges: [], error: 'auth_required' });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[gamificationCore] getActiveChallenges: no memberId on session'),
      );
      warnSpy.mockRestore();
    });

    it('omits error field on successful authenticated call', async () => {
      // Valid call path — no seeded ActiveChallenges, so empty but error-free
      const result = await getActiveChallenges('mem-ok');
      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.challenges)).toBe(true);
    });

    // cf-tlt: catch-all must surface error:'internal_error' instead of bare
    // { challenges: [] }, so callers can distinguish a DB failure from a
    // legitimate empty-but-authed result (was the cf-1y7 silent-failure
    // masquerade class). Uses the project-wide `internal_error` convention.
    it('returns { challenges: [], error: "internal_error" } when the Challenges query throws', async () => {
      const wixData = (await import('wix-data')).default;
      const origQuery = wixData.query;
      wixData.query = (col) => {
        if (col === 'Challenges') {
          return {
            eq() { return this; },
            find() { throw new Error('connection reset'); },
          };
        }
        return origQuery(col);
      };
      try {
        const result = await getActiveChallenges('mem-db-fail');
        expect(result).toEqual({ challenges: [], error: 'internal_error' });
      } finally {
        wixData.query = origQuery;
      }
    });
  });

  describe('getActivityFeed (Array-return, warn-only observability)', () => {
    // Consumer compat: this handler returns Array, so error-object shape would
    // be a breaking change. We preserve Array return but add dev-only warns at
    // the two silent branches so auth/IDOR leaks surface in Wix runtime logs.
    it('warns distinctly when no member is authenticated (auth_required)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      __mockMemberId = null;
      const result = await getActivityFeed('mem-1');
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[gamificationCore] getActivityFeed: no member on session (auth_required)'),
      );
      warnSpy.mockRestore();
    });

    it('warns distinctly when caller does not match memberId (forbidden)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      __mockMemberId = 'other-member';
      const result = await getActivityFeed('mem-1');
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[gamificationCore] getActivityFeed: caller/memberId mismatch (forbidden)'),
      );
      warnSpy.mockRestore();
    });

    it('does NOT warn on legitimate authenticated call', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      __mockMemberId = 'mem-1';
      await getActivityFeed('mem-1');
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});

// ── cf-16h getActiveChallengeOfWeek ─────────────────────────────────────────

describe('getActiveChallengeOfWeek (cf-16h: discriminable progressStatus)', () => {
  const FUTURE_ISO = new Date(Date.now() + 86_400_000).toISOString();

  beforeEach(() => {
    seed('Challenges', [{
      _id: 'chall-db-1',
      challengeId: 'chall-1',
      title: 'Weekly walk',
      description: '10k steps',
      conditionType: 'steps',
      targetCount: 10000,
      rewardPoints: 50,
      active: true,
      isFeatured: true,
      expiresAt: FUTURE_ISO,
      ctaUrl: '/walk',
    }]);
  });

  it('returns null when no featured challenge is active', async () => {
    _collections = {};
    const result = await getActiveChallengeOfWeek();
    expect(result).toBeNull();
  });

  it('returns visitor status with zero progress for unauthenticated caller', async () => {
    __mockMemberId = null;
    const result = await getActiveChallengeOfWeek();
    expect(result).not.toBeNull();
    expect(result.challengeId).toBe('chall-1');
    expect(result.progressValue).toBe(0);
    expect(result.completedAt).toBeNull();
    expect(result.progressStatus).toBe('visitor');
  });

  it('returns member status + real progress when the member has a record', async () => {
    __mockMemberId = 'mem-7';
    seed('MemberChallengeProgress', [{
      memberId: 'mem-7',
      challengeId: 'chall-1',
      progressValue: 4200,
      completedAt: null,
    }]);
    const result = await getActiveChallengeOfWeek();
    expect(result.progressValue).toBe(4200);
    expect(result.progressStatus).toBe('member');
  });

  it('returns member status with zero progress when member has no progress row', async () => {
    __mockMemberId = 'mem-new';
    const result = await getActiveChallengeOfWeek();
    expect(result.progressValue).toBe(0);
    expect(result.progressStatus).toBe('member');
  });

  it('reports unavailable when the progress query throws for an authenticated member', async () => {
    __mockMemberId = 'mem-broken';
    const wixData = (await import('wix-data')).default;
    const origQuery = wixData.query;
    let call = 0;
    wixData.query = (col) => {
      call += 1;
      if (col === 'MemberChallengeProgress') {
        return {
          eq() { return this; },
          gt() { return this; },
          descending() { return this; },
          limit() { return this; },
          find() { throw new Error('connection reset'); },
        };
      }
      return origQuery(col);
    };
    try {
      const result = await getActiveChallengeOfWeek();
      expect(result.progressValue).toBe(0);
      expect(result.progressStatus).toBe('unavailable');
    } finally {
      wixData.query = origQuery;
      void call;
    }
  });

  it('does not spam the console for the expected visitor path', async () => {
    __mockMemberId = null;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await getActiveChallengeOfWeek();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  // cf-n54: a member-lookup that *throws* (not just resolves null) must not be
  // mis-classified as a visitor — it's a backend failure, not an unauth caller.
  it('classifies member-lookup throw as "unavailable", not "visitor"', async () => {
    const membersMod = await import('wix-members-backend');
    const origGetMember = membersMod.currentMember.getMember;
    membersMod.currentMember.getMember = vi.fn(() =>
      Promise.reject(new Error('wix-members-backend transient failure')),
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await getActiveChallengeOfWeek();
      expect(result.progressStatus).toBe('unavailable');
      expect(result.progressValue).toBe(0);
      // errorHandler silent-mute downgrades to console.warn (cf-n54)
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      membersMod.currentMember.getMember = origGetMember;
      warnSpy.mockRestore();
    }
  });
});
