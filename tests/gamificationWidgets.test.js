/**
 * @file gamificationWidgets.test.js
 * @description Direct tests for gamificationWidgets.web.js webMethods.
 * Covers all 7 endpoints + branch paths.
 *
 * CF-jz4r
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';

// ── Mock dependencies ────────────────────────────────────────────────

const mockFindMemberRecord = vi.fn();
const mockComputeTierInfo = vi.fn();
const mockGetActiveChallenges = vi.fn();

vi.mock('backend/gamificationCore.web', () => ({
  findMemberRecord: mockFindMemberRecord,
  computeTierInfo: mockComputeTierInfo,
  getActiveChallenges: mockGetActiveChallenges,
  MEMBER_POINTS_COLLECTION: 'MemberPoints',
  MEMBER_BADGES_COLLECTION: 'MemberBadges',
  CHALLENGE_PROGRESS_COLLECTION: 'ChallengeProgress',
}));

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

const {
  getGamificationStats,
  checkMilestoneProximity,
  getRecentAchievements,
  getDailyQuests,
  getShareableProgress,
  getMilestones,
  getWeeklyChallenge,
} = await import('../src/backend/gamificationWidgets.web.js');

beforeEach(() => {
  __reset();
  __setMember({ _id: 'member-1' });
  vi.clearAllMocks();
  mockComputeTierInfo.mockReturnValue({ tierName: 'Trail Blazer' });
});

// ── getGamificationStats ─────────────────────────────────────────────

describe('getGamificationStats', () => {
  it('returns null when caller does not match memberId', async () => {
    __setMember({ _id: 'member-2' });
    const result = await getGamificationStats('member-1');
    expect(result).toBeNull();
  });

  it('returns null when member is unauthenticated', async () => {
    __setMember(null);
    const result = await getGamificationStats('member-1');
    expect(result).toBeNull();
  });

  it('returns stats with rank based on sorted leaderboard', async () => {
    __setMember({ _id: 'member-1' });
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 350, currentStreakDays: 5 });
    // Seed badge + quest + leaderboard data
    __seed('MemberBadges', [{ memberId: 'member-1', _id: 'b1' }, { memberId: 'member-1', _id: 'b2' }]);
    __seed('ChallengeProgress', [{ memberId: 'member-1', _id: 'q1', completed: true }]);
    __seed('MemberPoints', [
      { memberId: 'other', _id: 'r1', totalPoints: 500 },
      { memberId: 'member-1', _id: 'r2', totalPoints: 350 },
    ]);
    const result = await getGamificationStats('member-1');
    expect(result).not.toBeNull();
    expect(result.totalPoints).toBe(350);
    expect(result.currentTier).toBe('Trail Blazer');
    expect(result.currentStreak).toBe(5);
    expect(result.rank).toBe(2);
  });

  it('returns rank = total+1 when member not in leaderboard', async () => {
    __setMember({ _id: 'member-1' });
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 100, currentStreakDays: 0 });
    __seed('MemberPoints', [
      { memberId: 'other-a', _id: 'r1', totalPoints: 900 },
      { memberId: 'other-b', _id: 'r2', totalPoints: 800 },
    ]);
    const result = await getGamificationStats('member-1');
    expect(result.rank).toBe(3);
  });

  it('uses 0 defaults for missing record fields', async () => {
    __setMember({ _id: 'member-1' });
    mockFindMemberRecord.mockResolvedValue(null);
    const result = await getGamificationStats('member-1');
    expect(result.totalPoints).toBe(0);
    expect(result.currentStreak).toBe(0);
  });
});

// ── checkMilestoneProximity ──────────────────────────────────────────

describe('checkMilestoneProximity', () => {
  it('returns empty when member is at 0 points (not near any tier)', async () => {
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 0, currentStreakDays: 0 });
    const nudges = await checkMilestoneProximity('member-1');
    expect(Array.isArray(nudges)).toBe(true);
    expect(nudges.length).toBe(0);
  });

  it('returns tier nudge when near next tier threshold (>=80%)', async () => {
    // Mountain Guide is 500pts. At 420pts = 84% progress from 0→500
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 420, currentStreakDays: 0 });
    const nudges = await checkMilestoneProximity('member-1');
    const tierNudge = nudges.find(n => n.type === 'tier');
    expect(tierNudge).toBeDefined();
    expect(tierNudge.milestone).toBe('Mountain Guide');
    expect(tierNudge.remaining).toBe(80);
  });

  it('does not return tier nudge when below 80% of next threshold', async () => {
    // At 100pts = 20% of Mountain Guide (500)
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 100, currentStreakDays: 0 });
    const nudges = await checkMilestoneProximity('member-1');
    const tierNudge = nudges.find(n => n.type === 'tier');
    expect(tierNudge).toBeUndefined();
  });

  it('returns streak nudge when near milestone (>=80%)', async () => {
    // 7-day milestone at 80% = need 5.6 days. At streak=6 = 85.7%
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 0, currentStreakDays: 6 });
    const nudges = await checkMilestoneProximity('member-1');
    const streakNudge = nudges.find(n => n.type === 'streak');
    expect(streakNudge).toBeDefined();
    expect(streakNudge.milestone).toBe('7-day streak');
  });

  it('does not return streak nudge when below 80% of milestone', async () => {
    // At streak=3: 3/7 = 42.8% — below threshold
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 0, currentStreakDays: 3 });
    const nudges = await checkMilestoneProximity('member-1');
    const streakNudge = nudges.find(n => n.type === 'streak');
    expect(streakNudge).toBeUndefined();
  });

  it('returns both tier and streak nudges when both near thresholds', async () => {
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 420, currentStreakDays: 6 });
    const nudges = await checkMilestoneProximity('member-1');
    expect(nudges.some(n => n.type === 'tier')).toBe(true);
    expect(nudges.some(n => n.type === 'streak')).toBe(true);
  });

  it('handles null record gracefully', async () => {
    mockFindMemberRecord.mockResolvedValue(null);
    const nudges = await checkMilestoneProximity('member-1');
    expect(Array.isArray(nudges)).toBe(true);
  });
});

// ── getRecentAchievements ────────────────────────────────────────────

describe('getRecentAchievements', () => {
  it('returns empty array when no achievements', async () => {
    const result = await getRecentAchievements(5);
    expect(result).toEqual([]);
  });

  it('maps achievements with parsed JSON payload', async () => {
    __seed('AnalyticsEvents', [{
      _id: 'e1',
      memberId: 'member-1',
      eventType: 'badge_earned',
      payload: JSON.stringify({ badgeLabel: 'First Purchase' }),
      timestamp: new Date('2026-03-01').toISOString(),
    }]);
    __seed('MemberPoints', [{ _id: 'mp1', memberId: 'member-1', displayName: 'Jane D.' }]);
    const result = await getRecentAchievements(5);
    expect(result[0].achievementName).toBe('First Purchase');
    expect(result[0].memberNickname).toBe('Jane D.');
    expect(result[0].achievementType).toBe('badge_earned');
  });

  it('uses object payload when not a string', async () => {
    __seed('AnalyticsEvents', [{
      _id: 'e2',
      memberId: 'member-2',
      eventType: 'tier_upgraded',
      payload: { newTier: 'Summit Master' },
      timestamp: null,
    }]);
    const result = await getRecentAchievements(5);
    expect(result[0].achievementName).toBe('Summit Master');
    expect(result[0].timestamp).toBeNull();
  });

  it('falls back to "A member" for unknown member', async () => {
    __seed('AnalyticsEvents', [{
      _id: 'e3',
      memberId: 'unknown',
      eventType: 'badge_earned',
      payload: {},
      timestamp: new Date().toISOString(),
    }]);
    const result = await getRecentAchievements(5);
    expect(result[0].memberNickname).toBe('A member');
  });

  it('skips member lookup when no memberIds in results', async () => {
    __seed('AnalyticsEvents', [{
      _id: 'e4',
      memberId: null,
      eventType: 'badge_earned',
      payload: {},
      timestamp: null,
    }]);
    const result = await getRecentAchievements(5);
    expect(result[0].memberNickname).toBe('A member');
  });
});

// ── getDailyQuests ───────────────────────────────────────────────────

describe('getDailyQuests', () => {
  it('returns error when memberId is missing', async () => {
    const result = await getDailyQuests(null);
    expect(result.error).toBe('missing_member_id');
  });

  it('returns quests mapped from getActiveChallenges', async () => {
    mockGetActiveChallenges.mockResolvedValue({
      challenges: [{
        challengeId: 'c1',
        title: 'Buy Something',
        description: 'Make a purchase',
        progressValue: 1,
        targetCount: 1,
        rewardPoints: 50,
        completedAt: '2026-03-01',
        expiresAt: '2026-03-31',
      }],
    });
    const result = await getDailyQuests('member-1');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].questId).toBe('c1');
    expect(result[0].isComplete).toBe(true);
    expect(result[0].pointsReward).toBe(50);
  });

  it('returns upstream error when getActiveChallenges fails', async () => {
    mockGetActiveChallenges.mockResolvedValue({ error: 'db_error' });
    const result = await getDailyQuests('member-1');
    expect(result.error).toBe('db_error');
  });

  it('returns rate_limited when status is 429', async () => {
    mockGetActiveChallenges.mockResolvedValue({ status: 429 });
    const result = await getDailyQuests('member-1');
    expect(result.error).toBe('rate_limited');
  });

  it('uses defaults for missing challenge fields', async () => {
    mockGetActiveChallenges.mockResolvedValue({
      challenges: [{ challengeId: 'c2', title: 'Quest' }],
    });
    const result = await getDailyQuests('member-1');
    expect(result[0].currentProgress).toBe(0);
    expect(result[0].targetProgress).toBe(1);
    expect(result[0].description).toBeNull();
    expect(result[0].isComplete).toBe(false);
    expect(result[0].expiresAt).toBeNull();
  });

  it('returns service_unavailable on thrown error', async () => {
    mockGetActiveChallenges.mockRejectedValue(new Error('crash'));
    const result = await getDailyQuests('member-1');
    expect(result.error).toBe('service_unavailable');
  });
});

// ── getShareableProgress ─────────────────────────────────────────────

describe('getShareableProgress', () => {
  it('returns auth_required when no member', async () => {
    __setMember(null);
    const result = await getShareableProgress();
    expect(result.error).toBe('auth_required');
  });

  it('returns share data for authenticated member with streak', async () => {
    __setMember({ _id: 'member-1' });
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 750, currentStreakDays: 14 });
    mockComputeTierInfo.mockReturnValue({ tierName: 'Mountain Guide' });
    __seed('MemberBadges', [{ _id: 'b1', memberId: 'member-1', badgeName: 'First Purchase', earnedDate: new Date() }]);
    const result = await getShareableProgress();
    expect(result.tierName).toBe('Mountain Guide');
    expect(result.totalPoints).toBe(750);
    expect(result.streak).toBe(14);
    expect(result.shareText).toContain('14-day streak');
    expect(result.shareUrl).toContain('member-1');
  });

  it('shareText omits streak section when streak is 0', async () => {
    __setMember({ _id: 'member-1' });
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 200, currentStreakDays: 0 });
    const result = await getShareableProgress();
    expect(result.shareText).not.toContain('streak');
  });

  it('uses badge fallback names when badgeName is absent', async () => {
    __setMember({ _id: 'member-1' });
    mockFindMemberRecord.mockResolvedValue({ totalPoints: 100, currentStreakDays: 0 });
    __seed('MemberBadges', [{ _id: 'b2', memberId: 'member-1', badgeId: 'badge-001', earnedDate: new Date() }]);
    const result = await getShareableProgress();
    expect(result.topBadges[0]).toBe('badge-001');
  });
});

// ── getMilestones ────────────────────────────────────────────────────

describe('getMilestones', () => {
  it('returns empty when caller does not match memberId', async () => {
    __setMember({ _id: 'member-2' });
    const result = await getMilestones('member-1');
    expect(result).toEqual([]);
  });

  it('returns milestone progress for authenticated member', async () => {
    __setMember({ _id: 'member-1' });
    mockFindMemberRecord.mockResolvedValue({ orderCount: 1, longestStreak: 5 });
    __seed('AnalyticsEvents', [
      { _id: 'r1', memberId: 'member-1', eventType: 'review' },
      { _id: 'r2', memberId: 'member-1', eventType: 'review' },
    ]);
    const result = await getMilestones('member-1');
    const firstPurchase = result.find(m => m.milestoneId === 'first-purchase');
    expect(firstPurchase.isUnlocked).toBe(true);
    expect(firstPurchase.currentValue).toBe(1);
  });

  it('caps currentValue at targetValue', async () => {
    __setMember({ _id: 'member-1' });
    // 10 orders when target is 5 — should be capped at 5
    mockFindMemberRecord.mockResolvedValue({ orderCount: 10, longestStreak: 0 });
    const result = await getMilestones('member-1');
    const loyalCustomer = result.find(m => m.milestoneId === 'loyal-customer');
    expect(loyalCustomer.currentValue).toBe(5);
    expect(loyalCustomer.isUnlocked).toBe(true);
  });

  it('handles null record with 0 defaults', async () => {
    __setMember({ _id: 'member-1' });
    mockFindMemberRecord.mockResolvedValue(null);
    const result = await getMilestones('member-1');
    result.forEach(m => expect(m.currentValue).toBe(0));
  });
});

// ── getWeeklyChallenge ───────────────────────────────────────────────

describe('getWeeklyChallenge', () => {
  it('returns null when no active weekly challenge', async () => {
    // Empty Challenges collection
    const result = await getWeeklyChallenge();
    expect(result).toBeNull();
  });

  it('returns challenge with aggregated progress', async () => {
    __seed('Challenges', [{
      _id: 'ch1',
      challengeId: 'weekly-2026-13',
      title: 'Spring Sale Sprint',
      description: 'Buy together',
      active: true,
      scope: 'weekly',
      targetCount: 100,
      rewardPoints: 500,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    }]);
    __seed('ChallengeProgress', [
      { _id: 'p1', challengeId: 'weekly-2026-13', progressValue: 30 },
      { _id: 'p2', challengeId: 'weekly-2026-13', progressValue: 20 },
      { _id: 'p3', challengeId: 'weekly-2026-13', progressValue: 0 }, // not counted
    ]);
    const result = await getWeeklyChallenge();
    expect(result).not.toBeNull();
    expect(result.currentTotal).toBe(50);
    expect(result.contributorCount).toBe(2);
    expect(result.isComplete).toBe(false);
  });

  it('uses _id as fallback when challengeId is absent', async () => {
    __seed('Challenges', [{
      _id: 'ch-fallback',
      title: 'No ChallengeId',
      active: true,
      scope: 'weekly',
      targetCount: 10,
      rewardPoints: 100,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }]);
    const result = await getWeeklyChallenge();
    expect(result.challengeId).toBe('ch-fallback');
  });

  it('marks isComplete true when currentTotal >= targetCount', async () => {
    __seed('Challenges', [{
      _id: 'ch2',
      challengeId: 'done-challenge',
      title: 'Done!',
      active: true,
      scope: 'weekly',
      targetCount: 50,
      rewardPoints: 100,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }]);
    __seed('ChallengeProgress', [
      { _id: 'pp1', challengeId: 'done-challenge', progressValue: 60 },
    ]);
    const result = await getWeeklyChallenge();
    expect(result.isComplete).toBe(true);
  });

  it('uses null for description when absent', async () => {
    __seed('Challenges', [{
      _id: 'ch4',
      challengeId: 'no-desc',
      title: 'No Desc',
      active: true,
      scope: 'weekly',
      targetCount: 5,
      rewardPoints: 50,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }]);
    const result = await getWeeklyChallenge();
    expect(result.description).toBeNull();
  });

  it('returns service_unavailable on error', async () => {
    __setQueryError('Challenges', new Error('DB error'));
    const result = await getWeeklyChallenge();
    expect(result.error).toBe('service_unavailable');
  });
});
