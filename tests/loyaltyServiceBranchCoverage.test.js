/**
 * loyaltyServiceBranchCoverage.test.js — CF-hgcl
 * Targets uncovered branches in loyaltyService.web.js to push branch coverage
 * from ~70% to ≥80%.
 *
 * Covered areas:
 *   - getMyStreakData: no _id, no record, record with real (non-null) values
 *   - getLeaderboard: explicit limit, actual nickname/points/tier on entries
 *   - getChallengeCatalog: no _id, rate-limit window reset
 *   - checkStreakAchievements: streak below first milestone → []
 *   - insertStreakAchievement: already exists → early return
 *   - getMyAchievements: no _id, unknown-milestone badge label fallback
 *   - recordStreakMilestoneEvent: deduplicated, unlabelled milestone, duplicate DB error, non-dup rethrow
 *   - recordChallengeCompletionEvent: invalid inputs, deduplicated, duplicate DB error
 *   - getChallengeLeaderboard: rate-limit window reset, completedAt as Date object vs string
 *   - getMyBurnRate: points reduce with real values, cheapest-reward with actual name
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wixData, {
  __reset as resetData,
  __seed,
  __setInsertError,
  __setUniqueField,
} from 'wix-data';
import { __setMember, __reset as resetMembers } from 'wix-members-backend';
import { __setAccount, __setRewards, __reset as resetLoyalty } from 'wix-loyalty.v2';

// ── vi.mock() calls must appear before imports of the module under test ────────

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('backend/utils/rateLimit', () => rateLimitMock);

// loyaltyService imports getGamePrefsForMember but only uses the import for
// possible future use — the symbol is declared but never called in current code.
// Mock it to satisfy the import without side-effects.
vi.mock('backend/memberGamePreferences.web', () => ({
  getGamePrefsForMember: vi.fn().mockResolvedValue({ cfPlus: false }),
}));

import {
  getMyStreakData,
  getLeaderboard,
  getChallengeCatalog,
  checkStreakAchievements,
  insertStreakAchievement,
  getMyAchievements,
  recordStreakMilestoneEvent,
  recordChallengeCompletionEvent,
  getChallengeLeaderboard,
  getMyBurnRate,
  _resetChallengeCatalogRateLimit,
  _resetChallengeLeaderboardRateLimit,
} from 'backend/loyaltyService.web';

const MEMBER_ID = 'branch-member-001';

beforeEach(() => {
  resetData();
  resetLoyalty();
  resetMembers();
  rateLimitMock.checkRateLimit.mockResolvedValue({ allowed: true });
  _resetChallengeCatalogRateLimit();
  _resetChallengeLeaderboardRateLimit();
  __setMember({ _id: MEMBER_ID, loginEmail: 'branch@test.com' });
});

// ── getMyStreakData ────────────────────────────────────────────────────────────

describe('getMyStreakData — branch coverage', () => {
  it('returns defaults when member has no _id (line 211 arm 0)', async () => {
    __setMember({}); // member object without _id
    const result = await getMyStreakData();
    expect(result.currentStreakDays).toBe(0);
    expect(result.streakMultiplier).toBe(1);
    expect(result.totalPoints).toBe(0);
  });

  it('returns defaults when no MemberPoints record exists (line 217 arm 0)', async () => {
    __seed('MemberPoints', []); // no records
    const result = await getMyStreakData();
    expect(result.currentStreakDays).toBe(0);
    expect(result.streakStartDate).toBeNull();
  });

  it('returns actual values when record has non-null fields (lines 219-224 arm 1)', async () => {
    __seed('MemberPoints', [{
      memberId: MEMBER_ID,
      currentStreakDays: 14,
      streakMultiplier: 1.5,
      streakStartDate: '2026-03-01',
      lastActivityDate: '2026-04-03',
      totalPoints: 350,
      lastStreakRecoveryDate: '2026-03-15',
    }]);
    const result = await getMyStreakData();
    expect(result.currentStreakDays).toBe(14);
    expect(result.streakMultiplier).toBe(1.5);
    expect(result.streakStartDate).toBe('2026-03-01');
    expect(result.lastActivityDate).toBe('2026-04-03');
    expect(result.totalPoints).toBe(350);
    expect(result.lastStreakRecoveryDate).toBe('2026-03-15');
  });
});

// ── getLeaderboard ────────────────────────────────────────────────────────────

describe('getLeaderboard — branch coverage', () => {
  it('uses provided limit and returns entries with actual field values (lines 246, 287-289 arm 1)', async () => {
    __seed('LoyaltyAccounts', [
      { memberId: 'lb-m1', points: 800, nickname: 'TopDog', tier: 'Gold',  lastActivityDate: null },
      { memberId: 'lb-m2', points: 200, nickname: 'Runner', tier: 'Silver', lastActivityDate: null },
    ]);
    __seed('MemberGamificationPreferences', [
      { memberId: 'lb-m1', leaderboardOptIn: true },
      { memberId: 'lb-m2', leaderboardOptIn: true },
    ]);

    const result = await getLeaderboard({ limit: 5 });
    expect(result.entries).toHaveLength(2);
    // nickname ?? '' — arm 1: nickname is present
    expect(result.entries[0].nickname).toBe('TopDog');
    // points ?? 0 — arm 1: points is present
    expect(result.entries[0].points).toBe(800);
    // tier ?? 'Bronze' — arm 1: tier is present
    expect(result.entries[0].tier).toBe('Gold');
  });

  it('member._id ?? null — arm 1: marks current user entry', async () => {
    __seed('LoyaltyAccounts', [
      { memberId: MEMBER_ID, points: 500, nickname: 'Me', tier: 'Silver', lastActivityDate: null },
    ]);
    __seed('MemberGamificationPreferences', [
      { memberId: MEMBER_ID, leaderboardOptIn: true },
    ]);

    const result = await getLeaderboard({});
    expect(result.entries[0].isCurrentUser).toBe(true);
  });
});

// ── getChallengeCatalog ───────────────────────────────────────────────────────

describe('getChallengeCatalog — branch coverage', () => {
  it('returns {challenges:[]} when member has no _id (line 320 arm 0)', async () => {
    __setMember({}); // member without _id
    const result = await getChallengeCatalog();
    expect(result).toEqual({ challenges: [] });
  });

  it('resets rate-limit window after CATALOG_WINDOW_MS expires (line 326 arm 0)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T10:00:00.000Z'));

    __seed('ChallengeDefinitions', []);
    __seed('ChallengeProgress', []);
    __seed('CFPlusMembers', []);

    // First call establishes the rate-limit window
    await getChallengeCatalog();

    // Advance time beyond CATALOG_WINDOW_MS (60_000 ms)
    vi.advanceTimersByTime(65_000);

    // Second call: windowStart is in the past — window should reset, count back to 1
    const result = await getChallengeCatalog();
    // If window reset correctly the call succeeds (no 429)
    expect(result).not.toHaveProperty('status', 429);

    vi.useRealTimers();
  });
});

// ── checkStreakAchievements ───────────────────────────────────────────────────

describe('checkStreakAchievements — branch coverage', () => {
  it('returns [] immediately when no milestones reached (line 577 arm 0)', async () => {
    const result = await checkStreakAchievements(MEMBER_ID, 3); // below milestone 7
    expect(result).toEqual([]);
  });

  it('returns only new milestones (not already earned)', async () => {
    __seed('StreakAchievements', [
      { memberId: MEMBER_ID, milestone: 7 },
    ]);
    const result = await checkStreakAchievements(MEMBER_ID, 14); // reached 7 and 14
    expect(result).toContain(14);
    expect(result).not.toContain(7); // already earned
  });
});

// ── insertStreakAchievement ───────────────────────────────────────────────────

describe('insertStreakAchievement — branch coverage', () => {
  it('returns without inserting when achievement already recorded (line 605 arm 0)', async () => {
    __seed('StreakAchievements', [
      { memberId: MEMBER_ID, milestone: 7, streakDays: 8, earnedAt: new Date(), notified: false },
    ]);
    // Should not throw and should not insert a duplicate
    await expect(insertStreakAchievement(MEMBER_ID, 7, 8)).resolves.toBeUndefined();
    // Store has 1 item (the seeded one, no extra insert)
    const items = (await wixData.query('StreakAchievements').find()).items;
    expect(items).toHaveLength(1);
  });
});

// ── getMyAchievements ─────────────────────────────────────────────────────────

describe('getMyAchievements — branch coverage', () => {
  it('returns {achievements:[]} when member has no _id (line 633 arm 0)', async () => {
    __setMember({});
    const result = await getMyAchievements();
    expect(result).toEqual({ achievements: [] });
  });

  it('uses fallback badgeLabel for unknown milestone (line 646 arm 1)', async () => {
    __seed('StreakAchievements', [{
      memberId: MEMBER_ID,
      milestone: 999, // not in BADGE_LABELS
      streakDays: 999,
      earnedAt: new Date(),
    }]);
    const result = await getMyAchievements();
    expect(result.achievements[0].badgeLabel).toBe('999-day streak');
  });

  it('uses BADGE_LABELS entry for known milestone (line 646 arm 0)', async () => {
    __seed('StreakAchievements', [{
      memberId: MEMBER_ID,
      milestone: 7,
      streakDays: 7,
      earnedAt: new Date(),
    }]);
    const result = await getMyAchievements();
    expect(result.achievements[0].badgeLabel).toBe('Week Warrior');
  });
});

// ── recordStreakMilestoneEvent ────────────────────────────────────────────────

describe('recordStreakMilestoneEvent — branch coverage', () => {
  it('returns early when ledger entry already exists (line 710 arm 0)', async () => {
    __seed('PointsLedger', [{
      memberId: MEMBER_ID,
      milestone: 7,
      type: 'streak_milestone',
    }]);
    await expect(recordStreakMilestoneEvent(MEMBER_ID, 7, 14)).resolves.toBeUndefined();
    // Only the seeded item; no new insert
    const items = (await wixData.query('PointsLedger').find()).items;
    expect(items).toHaveLength(1);
  });

  it('uses fallback description when milestone has no BADGE_LABELS entry (line 713 arm 1)', async () => {
    __seed('PointsLedger', []);
    let insertedItem = null;
    // eslint-disable-next-line
    const origInsert = wixData.insert;
    vi.spyOn(wixData, 'insert').mockImplementationOnce(async (col, item, opts) => {
      insertedItem = item;
      return item;
    });
    await recordStreakMilestoneEvent(MEMBER_ID, 999, 10);
    expect(insertedItem.description).toBe('999-day streak'); // fallback, no label
  });

  it('swallows duplicate-key DB error on concurrent insert (line 728 arm 0)', async () => {
    __seed('PointsLedger', []);
    const dupErr = new Error('WDE0025: duplicate key value violates unique constraint');
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(dupErr);
    // Should resolve without throwing
    await expect(recordStreakMilestoneEvent(MEMBER_ID, 30, 60)).resolves.toBeUndefined();
  });

  it('rethrows non-duplicate DB error', async () => {
    __seed('PointsLedger', []);
    const otherErr = new Error('Connection timeout');
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(otherErr);
    await expect(recordStreakMilestoneEvent(MEMBER_ID, 30, 60)).rejects.toThrow('Connection timeout');
  });

  it('isDuplicateKeyError handles non-string err.message (line 673 arm 0)', async () => {
    __seed('PointsLedger', []);
    // Error with a non-string message — should not be treated as duplicate
    const weirdErr = { message: 42, stack: '' };
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(weirdErr);
    await expect(recordStreakMilestoneEvent(MEMBER_ID, 30, 60)).rejects.toEqual(weirdErr);
  });
});

// ── recordChallengeCompletionEvent ────────────────────────────────────────────

describe('recordChallengeCompletionEvent — branch coverage', () => {
  it('throws TypeError for invalid memberId', async () => {
    await expect(recordChallengeCompletionEvent('', 'ch-1', 50))
      .rejects.toThrow(TypeError);
  });

  it('throws TypeError for invalid challengeId', async () => {
    await expect(recordChallengeCompletionEvent(MEMBER_ID, '', 50))
      .rejects.toThrow(TypeError);
  });

  it('throws TypeError for non-finite points', async () => {
    await expect(recordChallengeCompletionEvent(MEMBER_ID, 'ch-1', -5))
      .rejects.toThrow(TypeError);
  });

  it('returns early when ledger entry already exists (line 809 arm 0)', async () => {
    __seed('PointsLedger', [{
      memberId: MEMBER_ID,
      challengeId: 'ch-dup',
      type: 'challenge_completion',
    }]);
    await expect(recordChallengeCompletionEvent(MEMBER_ID, 'ch-dup', 100))
      .resolves.toBeUndefined();
    const items = (await wixData.query('PointsLedger').find()).items;
    expect(items).toHaveLength(1);
  });

  it('swallows duplicate-key DB error on concurrent insert (line 823 arm 0)', async () => {
    __seed('PointsLedger', []);
    const dupErr = new Error('duplicate key value violates unique constraint');
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(dupErr);
    await expect(recordChallengeCompletionEvent(MEMBER_ID, 'ch-new', 50))
      .resolves.toBeUndefined();
  });
});

// ── getChallengeLeaderboard ───────────────────────────────────────────────────

describe('getChallengeLeaderboard — branch coverage', () => {
  it('resets rate-limit window after CHALLENGE_LEADERBOARD_WINDOW_MS (line 1039)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T12:00:00.000Z'));

    __seed('ChallengeProgress', []);

    await getChallengeLeaderboard('ch-test');

    // Jump past 1-minute window
    vi.advanceTimersByTime(65_000);

    const result = await getChallengeLeaderboard('ch-test');
    expect(result).not.toHaveProperty('status', 429);

    vi.useRealTimers();
  });

  it('converts Date completedAt to ISO string (line 1070 arm 0)', async () => {
    const completedDate = new Date('2026-03-15T09:00:00.000Z');
    __seed('ChallengeProgress', [{
      memberId: MEMBER_ID,
      challengeId: 'ch-iso',
      completedAt: completedDate,
    }]);

    const result = await getChallengeLeaderboard('ch-iso');
    expect(result.leaderboard[0].completedAt).toBe('2026-03-15T09:00:00.000Z');
  });

  it('passes through string completedAt unchanged (line 1070 arm 1)', async () => {
    __seed('ChallengeProgress', [{
      memberId: MEMBER_ID,
      challengeId: 'ch-str',
      completedAt: '2026-03-20T10:00:00.000Z',
    }]);

    const result = await getChallengeLeaderboard('ch-str');
    expect(result.leaderboard[0].completedAt).toBe('2026-03-20T10:00:00.000Z');
  });
});

// ── getMyBurnRate ─────────────────────────────────────────────────────────────

describe('getMyBurnRate — branch coverage', () => {
  it('computes avgMonthlyPoints from ledger items with real points values (line 956 arm 1)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T12:00:00.000Z'));

    __setAccount({ points: { balance: 200 } });
    __setRewards([{
      _id: 'rw-1',
      active: true,
      name: 'Free Pillow',
      requiredPoints: 300,
    }]);

    __seed('PointsLedger', [
      {
        memberId: MEMBER_ID,
        points: 100,
        earnedAt: new Date('2026-03-20T00:00:00.000Z'), // within last 30 days
        type: 'purchase',
      },
      {
        memberId: MEMBER_ID,
        points: 50,
        earnedAt: new Date('2026-03-25T00:00:00.000Z'),
        type: 'bonus',
      },
    ]);

    const result = await getMyBurnRate();
    // avgMonthlyPoints = 100 + 50 = 150; nearestRewardCost = 300; balance = 200
    expect(result.avgMonthlyPoints).toBe(150);
    expect(result.nearestRewardCost).toBe(300);
    expect(result.nearestRewardName).toBe('Free Pillow'); // arm 1: name is truthy
    expect(result.daysTill).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('returns message "You have enough" when balance >= nearestRewardCost', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T12:00:00.000Z'));

    __setAccount({ points: { balance: 500 } });
    __setRewards([{
      _id: 'rw-enough',
      active: true,
      name: 'Blanket',
      requiredPoints: 300,
    }]);
    __seed('PointsLedger', []);

    const result = await getMyBurnRate();
    expect(result.daysTill).toBe(0);
    expect(result.message).toMatch(/enough/i);

    vi.useRealTimers();
  });

  it('returns null message/daysTill when avgMonthlyPoints is 0 and cannot reach reward', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T12:00:00.000Z'));

    __setAccount({ points: { balance: 0 } });
    __setRewards([{
      _id: 'rw-far',
      active: true,
      name: 'Big Reward',
      requiredPoints: 1000,
    }]);
    __seed('PointsLedger', []); // no recent points

    const result = await getMyBurnRate();
    expect(result.daysTill).toBeNull();
    expect(result.message).toBeNull();

    vi.useRealTimers();
  });
});
