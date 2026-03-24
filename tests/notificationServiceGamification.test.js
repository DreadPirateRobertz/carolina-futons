/**
 * @file notificationServiceGamification.test.js
 * @description TDD tests for CF-5vf: gamification push notification triggers.
 * Covers sendStreakMilestoneNotification, sendQuestCompleteNotification,
 * and getMyNotifications webMethod.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __getInserted, __setQueryError, __setInsertError } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import {
  sendStreakMilestoneNotification,
  sendQuestCompleteNotification,
  getMyNotifications,
  _resetGetMyNotificationsRateLimit,
} from '../src/backend/notificationService.web.js';

const NOTIFICATIONS_COLLECTION = 'Notifications';

beforeEach(() => {
  resetData();
  resetMembers();
  _resetGetMyNotificationsRateLimit();
});

// ── sendStreakMilestoneNotification ──────────────────────────────────

describe('sendStreakMilestoneNotification', () => {
  it('inserts a Notifications record with correct fields', async () => {
    await sendStreakMilestoneNotification('mem-1', 7, 'Week Warrior');
    const inserted = __getInserted(NOTIFICATIONS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe('mem-1');
    expect(inserted[0].type).toBe('streak_milestone');
    expect(inserted[0].message).toBe('You earned the Week Warrior badge! 🔥 7-day streak!');
    expect(inserted[0].read).toBe(false);
    expect(inserted[0].createdAt).toBeInstanceOf(Date);
  });

  it('is idempotent — skips insert when notification already exists for memberId+milestone', async () => {
    __seed(NOTIFICATIONS_COLLECTION, [
      { _id: 'n-1', memberId: 'mem-1', type: 'streak_milestone', milestone: 7, read: false },
    ]);
    await sendStreakMilestoneNotification('mem-1', 7, 'Week Warrior');
    // Only 1 record (seeded) — no new insert
    expect(__getInserted(NOTIFICATIONS_COLLECTION)).toHaveLength(1);
    expect(__getInserted(NOTIFICATIONS_COLLECTION)[0]._id).toBe('n-1');
  });

  it('inserts for a different milestone on the same member', async () => {
    __seed(NOTIFICATIONS_COLLECTION, [
      { _id: 'n-1', memberId: 'mem-1', type: 'streak_milestone', milestone: 7, read: false },
    ]);
    await sendStreakMilestoneNotification('mem-1', 14, 'Fortnight Fighter');
    // 2 items: 1 seeded + 1 new
    expect(__getInserted(NOTIFICATIONS_COLLECTION)).toHaveLength(2);
  });

  it('returns without inserting when memberId is empty', async () => {
    await sendStreakMilestoneNotification('', 7, 'Week Warrior');
    expect(__getInserted(NOTIFICATIONS_COLLECTION)).toHaveLength(0);
  });

  it('stores the milestone value on the record', async () => {
    await sendStreakMilestoneNotification('mem-1', 30, 'Monthly Master');
    const inserted = __getInserted(NOTIFICATIONS_COLLECTION);
    expect(inserted[0].milestone).toBe(30);
  });

  it('does not throw when Notifications query errors', async () => {
    __setQueryError(NOTIFICATIONS_COLLECTION, new Error('DB error'));
    await expect(sendStreakMilestoneNotification('mem-1', 7, 'Week Warrior')).resolves.not.toThrow();
  });
});

// ── sendQuestCompleteNotification ────────────────────────────────────

describe('sendQuestCompleteNotification', () => {
  it('inserts a Notifications record with correct fields', async () => {
    await sendQuestCompleteNotification('mem-1', 'Place an order today', 50);
    const inserted = __getInserted(NOTIFICATIONS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe('mem-1');
    expect(inserted[0].type).toBe('daily_quest');
    expect(inserted[0].message).toBe('Daily quest complete: Place an order today. +50 pts! ✅');
    expect(inserted[0].read).toBe(false);
    expect(inserted[0].createdAt).toBeInstanceOf(Date);
  });

  it('returns without inserting when memberId is empty', async () => {
    await sendQuestCompleteNotification('', 'Place an order today', 50);
    expect(__getInserted(NOTIFICATIONS_COLLECTION)).toHaveLength(0);
  });

  it('allows multiple quest notifications for the same member (no dedup)', async () => {
    await sendQuestCompleteNotification('mem-1', 'Place an order today', 50);
    await sendQuestCompleteNotification('mem-1', 'Write a product review', 30);
    expect(__getInserted(NOTIFICATIONS_COLLECTION)).toHaveLength(2);
  });

  it('does not throw when Notifications insert errors', async () => {
    __setInsertError(NOTIFICATIONS_COLLECTION, new Error('DB error'));
    await expect(sendQuestCompleteNotification('mem-1', 'Place an order today', 50)).resolves.not.toThrow();
  });
});

// ── getMyNotifications ────────────────────────────────────────────────

describe('getMyNotifications', () => {
  it('returns notifications for the current member', async () => {
    __setMember({ _id: 'mem-1' });
    __seed(NOTIFICATIONS_COLLECTION, [
      { _id: 'n-1', memberId: 'mem-1', type: 'streak_milestone', message: 'msg1', read: false, createdAt: new Date('2026-03-20') },
      { _id: 'n-2', memberId: 'mem-1', type: 'daily_quest', message: 'msg2', read: true, createdAt: new Date('2026-03-21') },
      { _id: 'n-3', memberId: 'mem-2', type: 'streak_milestone', message: 'other', read: false, createdAt: new Date('2026-03-21') },
    ]);
    const result = await getMyNotifications({});
    expect(result.notifications).toHaveLength(2);
  });

  it('returns correct response shape', async () => {
    __setMember({ _id: 'mem-1' });
    __seed(NOTIFICATIONS_COLLECTION, [
      { _id: 'n-1', memberId: 'mem-1', type: 'streak_milestone', message: 'msg', read: false, createdAt: new Date() },
    ]);
    const result = await getMyNotifications({});
    expect(result.notifications).toBeDefined();
    const n = result.notifications[0];
    expect(n).toMatchObject({ id: 'n-1', type: 'streak_milestone', message: 'msg', read: false });
    expect(n.createdAt).toBeDefined();
  });

  it('filters to unread only when unreadOnly=true', async () => {
    __setMember({ _id: 'mem-1' });
    __seed(NOTIFICATIONS_COLLECTION, [
      { _id: 'n-1', memberId: 'mem-1', type: 'streak_milestone', message: 'msg1', read: false, createdAt: new Date() },
      { _id: 'n-2', memberId: 'mem-1', type: 'daily_quest', message: 'msg2', read: true, createdAt: new Date() },
    ]);
    const result = await getMyNotifications({ unreadOnly: true });
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].id).toBe('n-1');
  });

  it('respects limit parameter, capped at 50', async () => {
    __setMember({ _id: 'mem-1' });
    const items = Array.from({ length: 60 }, (_, i) => ({
      _id: `n-${i}`, memberId: 'mem-1', type: 'daily_quest', message: `msg${i}`,
      read: false, createdAt: new Date(),
    }));
    __seed(NOTIFICATIONS_COLLECTION, items);
    const result = await getMyNotifications({ limit: 100 }); // cap at 50
    expect(result.notifications.length).toBeLessThanOrEqual(50);
  });

  it('returns 401 when member not authenticated', async () => {
    const result = await getMyNotifications({});
    expect(result).toEqual({ status: 401, error: 'Unauthenticated' });
  });

  it('returns 429 after 20 calls per minute', async () => {
    __setMember({ _id: 'mem-rl' });
    for (let i = 0; i < 20; i++) {
      await getMyNotifications({});
    }
    const result = await getMyNotifications({});
    expect(result).toEqual({ status: 429, error: 'Rate limit exceeded' });
  });
});

// ── CF-thb: sendChallengeReminder preference gates ───────────────────────────

describe('sendChallengeReminder', () => {
  // Will import sendChallengeReminder after it exists
  let sendChallengeReminder;

  beforeEach(async () => {
    ({ sendChallengeReminder } = await import('../src/backend/notificationService.web.js'));
  });

  it('writes a challenge_reminder notification when prefs allow it', async () => {
    __seed('MemberGamificationPreferences', [{
      _id: 'pref-1', memberId: 'mem-1',
      notificationsEnabled: true, challengeReminders: 'daily',
    }]);
    await sendChallengeReminder('mem-1', 'Complete your daily quest');
    const inserted = __getInserted(NOTIFICATIONS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].type).toBe('challenge_reminder');
    expect(inserted[0].memberId).toBe('mem-1');
  });

  it('does not write notification when notificationsEnabled is false', async () => {
    __seed('MemberGamificationPreferences', [{
      _id: 'pref-2', memberId: 'mem-2',
      notificationsEnabled: false, challengeReminders: 'daily',
    }]);
    await sendChallengeReminder('mem-2', 'Complete your daily quest');
    const inserted = __getInserted(NOTIFICATIONS_COLLECTION);
    expect(inserted).toHaveLength(0);
  });

  it('does not write notification when challengeReminders is never', async () => {
    __seed('MemberGamificationPreferences', [{
      _id: 'pref-3', memberId: 'mem-3',
      notificationsEnabled: true, challengeReminders: 'never',
    }]);
    await sendChallengeReminder('mem-3', 'Complete your daily quest');
    const inserted = __getInserted(NOTIFICATIONS_COLLECTION);
    expect(inserted).toHaveLength(0);
  });

  it('writes notification when member has no prefs record (defaults: enabled + daily)', async () => {
    // No MemberGamificationPreferences record → defaults (notificationsEnabled: true, challengeReminders: 'daily')
    await sendChallengeReminder('mem-no-prefs', 'Check your challenges!');
    const inserted = __getInserted(NOTIFICATIONS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].type).toBe('challenge_reminder');
  });

  it('writes notification when challengeReminders is weekly', async () => {
    __seed('MemberGamificationPreferences', [{
      _id: 'pref-4', memberId: 'mem-4',
      notificationsEnabled: true, challengeReminders: 'weekly',
    }]);
    await sendChallengeReminder('mem-4', 'Weekly challenge available!');
    const inserted = __getInserted(NOTIFICATIONS_COLLECTION);
    expect(inserted).toHaveLength(1);
  });
});
