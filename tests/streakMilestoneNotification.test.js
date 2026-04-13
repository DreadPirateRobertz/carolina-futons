/**
 * streakMilestoneNotification.test.js
 * CF-tcqq — Day 7 streak milestone push notification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
} from './__mocks__/wix-data.js';
import { __reset as crmReset, __getEmailLog } from './__mocks__/wix-crm-backend.js';

import { checkStreakMilestoneNotifications } from '../src/backend/gamificationNotifs.web.js';

const MEM_7 = 'mem-streak-7';
const MEM_6 = 'mem-streak-6';
const MEM_8 = 'mem-streak-8';

beforeEach(() => {
  __reset();
  crmReset();
  vi.clearAllMocks();
});

describe('checkStreakMilestoneNotifications (CF-tcqq)', () => {
  it('enqueues EmailQueue row for member at exactly day 7', async () => {
    __seed('MemberPoints', [
      { _id: 'mp1', memberId: MEM_7, currentStreakDays: 7 },
    ]);
    __seed('StreakMilestoneNotifications', []);
    __seed('MemberNotificationPrefs', [
      { memberId: MEM_7, streakReminders: true },
    ]);

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);

    // cf-cin / GH #991: queue-based dispatch replaces inline triggeredEmails.emailMember
    const queued = __getInserted('EmailQueue');
    expect(queued.length).toBe(1);
    expect(queued[0].templateId).toBe('streak_milestone_day7');
    expect(queued[0].recipientContactId).toBe(MEM_7);
    expect(queued[0].sequenceType).toBe('streak_milestone');
    expect(__getEmailLog().length).toBe(0);
  });

  it('does not send to members at day 6 or day 8', async () => {
    __seed('MemberPoints', [
      { _id: 'mp2', memberId: MEM_6, currentStreakDays: 6 },
      { _id: 'mp3', memberId: MEM_8, currentStreakDays: 8 },
    ]);

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(0);
    expect(__getInserted('EmailQueue').length).toBe(0);
  });

  it('does not double-send to member already notified', async () => {
    __seed('MemberPoints', [
      { _id: 'mp1', memberId: MEM_7, currentStreakDays: 7 },
    ]);
    __seed('StreakMilestoneNotifications', [
      { memberId: MEM_7, milestone: 7, sentAt: '2026-03-23T10:00:00Z' },
    ]);
    __seed('MemberNotificationPrefs', [
      { memberId: MEM_7, streakReminders: true },
    ]);

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(__getInserted('EmailQueue').length).toBe(0);
  });

  it('respects streakReminders: false preference', async () => {
    __seed('MemberPoints', [
      { _id: 'mp1', memberId: MEM_7, currentStreakDays: 7 },
    ]);
    __seed('StreakMilestoneNotifications', []);
    __seed('MemberNotificationPrefs', [
      { memberId: MEM_7, streakReminders: false },
    ]);

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('defaults to sending if no prefs record exists (opt-out model)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp1', memberId: MEM_7, currentStreakDays: 7 },
    ]);
    __seed('StreakMilestoneNotifications', []);
    __seed('MemberNotificationPrefs', []); // no prefs record

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(1);
  });

  it('records notification in StreakMilestoneNotifications after sending', async () => {
    __seed('MemberPoints', [
      { _id: 'mp1', memberId: MEM_7, currentStreakDays: 7 },
    ]);
    __seed('StreakMilestoneNotifications', []);
    __seed('MemberNotificationPrefs', []);

    await checkStreakMilestoneNotifications();
    const inserted = __getInserted('StreakMilestoneNotifications');
    expect(inserted.length).toBe(1);
    expect(inserted[0].memberId).toBe(MEM_7);
    expect(inserted[0].milestone).toBe(7);
  });

  it('returns { sent: 0, skipped: 0, errors: 0 } when no day-7 members', async () => {
    __seed('MemberPoints', []);
    const result = await checkStreakMilestoneNotifications();
    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
  });

  it('includes streak message in queued email variables', async () => {
    __seed('MemberPoints', [
      { _id: 'mp1', memberId: MEM_7, currentStreakDays: 7 },
    ]);
    __seed('StreakMilestoneNotifications', []);
    __seed('MemberNotificationPrefs', []);

    await checkStreakMilestoneNotifications();
    const queued = __getInserted('EmailQueue');
    expect(queued[0].variables.streakDays).toBe('7');
    expect(queued[0].variables.message).toContain('7-day streak');
    expect(queued[0].variables.message).toContain('2x points');
  });
});
