/**
 * @file achievementService.test.js
 * @description TDD tests for cf-7sb: streak achievement system.
 *
 * Covers:
 *  - checkStreakAchievements: milestone detection, boundary conditions
 *  - insertStreakAchievement: insert + idempotency guard
 *  - getMyAchievements webMethod: returns badgeLabel map, rate limit (20/min)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __reset, __seed, __onInsert } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';

// ── Hoisted mock refs ──────────────────────────────────────────────────────────

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: rateLimitMock.checkRateLimit,
}));

beforeEach(() => {
  __reset();
  resetMembers();
  vi.clearAllMocks();
  rateLimitMock.checkRateLimit.mockResolvedValue({ allowed: true });
  __setMember({ _id: 'mem-1', loginEmail: 'jane@test.com' });
});

// ── checkStreakAchievements ────────────────────────────────────────────────────

describe('checkStreakAchievements', () => {
  it('returns empty array when streak is below first milestone (7)', async () => {
    __seed('StreakAchievements', []);
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 6);
    expect(result).toEqual([]);
  });

  it('returns [7] when streak hits exactly 7 and no prior achievement', async () => {
    __seed('StreakAchievements', []);
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 7);
    expect(result).toEqual([7]);
  });

  it('returns [7, 14] when streak is 14 and no achievements yet', async () => {
    __seed('StreakAchievements', []);
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 14);
    expect(result).toEqual([7, 14]);
  });

  it('returns only new milestones when some are already recorded', async () => {
    __seed('StreakAchievements', [
      { memberId: 'mem-1', milestone: 7 },
      { memberId: 'mem-1', milestone: 14 },
    ]);
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 30);
    expect(result).toEqual([30]);
  });

  it('returns all milestones up to 100 for streak=100 with no prior achievements', async () => {
    __seed('StreakAchievements', []);
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 100);
    expect(result).toEqual([7, 14, 30, 60, 100]);
  });

  it('returns [365] when all lower milestones already recorded', async () => {
    __seed('StreakAchievements', [
      { memberId: 'mem-1', milestone: 7 },
      { memberId: 'mem-1', milestone: 14 },
      { memberId: 'mem-1', milestone: 30 },
      { memberId: 'mem-1', milestone: 60 },
      { memberId: 'mem-1', milestone: 100 },
    ]);
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 365);
    expect(result).toEqual([365]);
  });

  it('returns empty array when all milestones already earned', async () => {
    __seed('StreakAchievements', [
      { memberId: 'mem-1', milestone: 7 },
      { memberId: 'mem-1', milestone: 14 },
      { memberId: 'mem-1', milestone: 30 },
      { memberId: 'mem-1', milestone: 60 },
      { memberId: 'mem-1', milestone: 100 },
      { memberId: 'mem-1', milestone: 365 },
    ]);
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 365);
    expect(result).toEqual([]);
  });

  it('does not return achievements for a different member', async () => {
    // mem-2 has the 7-day milestone, so 7 is new for mem-1
    __seed('StreakAchievements', [{ memberId: 'mem-2', milestone: 7 }]);
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 7);
    expect(result).toEqual([7]);
  });

  it('returns empty array on DB query error (fail-open)', async () => {
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setQueryError('StreakAchievements', new Error('DB error'));
    const { checkStreakAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await checkStreakAchievements('mem-1', 30);
    expect(result).toEqual([]);
  });
});

// ── insertStreakAchievement ───────────────────────────────────────────────────

describe('insertStreakAchievement', () => {
  it('inserts a new StreakAchievements record', async () => {
    __seed('StreakAchievements', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));
    const { insertStreakAchievement } = await import('../src/backend/loyaltyService.web.js');
    await insertStreakAchievement('mem-1', 30, 30);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].memberId).toBe('mem-1');
    expect(inserts[0].milestone).toBe(30);
    expect(inserts[0].streakDays).toBe(30);
    expect(inserts[0].notified).toBe(false);
    expect(inserts[0].earnedAt).toBeInstanceOf(Date);
  });

  it('is idempotent — does not insert if record already exists', async () => {
    __seed('StreakAchievements', [
      { memberId: 'mem-1', milestone: 30, streakDays: 30, earnedAt: new Date(), notified: false },
    ]);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));
    const { insertStreakAchievement } = await import('../src/backend/loyaltyService.web.js');
    await insertStreakAchievement('mem-1', 30, 30);
    expect(inserts).toHaveLength(0);
  });

  it('inserts for same milestone for a different member', async () => {
    __seed('StreakAchievements', [
      { memberId: 'mem-2', milestone: 14, streakDays: 14, earnedAt: new Date(), notified: false },
    ]);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));
    const { insertStreakAchievement } = await import('../src/backend/loyaltyService.web.js');
    await insertStreakAchievement('mem-1', 14, 14);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].memberId).toBe('mem-1');
  });

  it('re-throws when wixData.insert() fails', async () => {
    const { __setInsertError } = await import('./__mocks__/wix-data.js');
    __seed('StreakAchievements', []);
    __setInsertError('StreakAchievements', new Error('Insert failed'));
    const { insertStreakAchievement } = await import('../src/backend/loyaltyService.web.js');
    await expect(insertStreakAchievement('mem-1', 30, 30)).rejects.toThrow('Insert failed');
  });
});

// ── getMyAchievements webMethod ───────────────────────────────────────────────

describe('getMyAchievements', () => {
  it('returns achievements with badgeLabel for the current member', async () => {
    __seed('StreakAchievements', [
      { memberId: 'mem-1', milestone: 7,  streakDays: 7,  earnedAt: new Date('2026-03-01'), notified: false },
      { memberId: 'mem-1', milestone: 30, streakDays: 30, earnedAt: new Date('2026-03-15'), notified: false },
    ]);
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result.achievements).toHaveLength(2);
    const week = result.achievements.find(a => a.milestone === 7);
    const monthly = result.achievements.find(a => a.milestone === 30);
    expect(week.badgeLabel).toBe('Week Warrior');
    expect(monthly.badgeLabel).toBe('Monthly Master');
  });

  it('acceptance: 30-day streak earns Monthly Master badge', async () => {
    __seed('StreakAchievements', [
      { memberId: 'mem-1', milestone: 30, streakDays: 30, earnedAt: new Date(), notified: false },
    ]);
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result.achievements[0].badgeLabel).toBe('Monthly Master');
  });

  it('returns all badge labels correctly', async () => {
    const milestones = [7, 14, 30, 60, 100, 365];
    const labels = ['Week Warrior', 'Fortnight Fighter', 'Monthly Master', 'Two Month Titan', 'Century Club', 'Year-Round Legend'];
    __seed('StreakAchievements', milestones.map((m, i) => ({
      memberId: 'mem-1', milestone: m, streakDays: m, earnedAt: new Date(), notified: i % 2 === 0,
    })));
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result.achievements).toHaveLength(6);
    milestones.forEach((m, i) => {
      const a = result.achievements.find(x => x.milestone === m);
      expect(a.badgeLabel).toBe(labels[i]);
    });
  });

  it('returns empty array when member has no achievements', async () => {
    __seed('StreakAchievements', []);
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result).toEqual({ achievements: [] });
  });

  it('does not return achievements belonging to other members', async () => {
    __seed('StreakAchievements', [
      { memberId: 'mem-2', milestone: 7, streakDays: 7, earnedAt: new Date(), notified: false },
    ]);
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result.achievements).toHaveLength(0);
  });

  it('returns achievements with milestone, streakDays, and earnedAt fields', async () => {
    const earned = new Date('2026-03-10');
    __seed('StreakAchievements', [
      { memberId: 'mem-1', milestone: 14, streakDays: 14, earnedAt: earned, notified: false },
    ]);
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    const a = result.achievements[0];
    expect(a.milestone).toBe(14);
    expect(a.streakDays).toBe(14);
    expect(a.earnedAt).toEqual(earned);
    expect(a.badgeLabel).toBe('Fortnight Fighter');
  });

  it('rate limits at 20/min per member', async () => {
    rateLimitMock.checkRateLimit.mockResolvedValue({ allowed: false });
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result).toEqual({ error: 'Rate limit exceeded' });
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      'AchievementsRateLimit', 'mem-1', { max: 20, windowMs: 60_000 }
    );
  });

  it('returns empty achievements on DB error (fail-open)', async () => {
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setQueryError('StreakAchievements', new Error('DB error'));
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result).toEqual({ achievements: [] });
  });

  it('returns empty achievements when member is not authenticated', async () => {
    __setMember(null);
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result).toEqual({ achievements: [] });
  });

  it('returns empty achievements when getMember() throws (fail-open)', async () => {
    const { currentMember } = await import('./__mocks__/wix-members-backend.js');
    currentMember.getMember.mockImplementation(() => { throw new Error('auth error'); });
    const { getMyAchievements } = await import('../src/backend/loyaltyService.web.js');
    const result = await getMyAchievements();
    expect(result).toEqual({ achievements: [] });
  });
});
