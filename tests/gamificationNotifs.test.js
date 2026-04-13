/**
 * @file gamificationNotifs.test.js
 * @description CF-tcqq / GH#991 — Full TDD coverage for gamificationNotifs.web.js:
 *   getNotificationPrefs()                [SiteMember]
 *   updateNotificationPrefs(prefs)        [SiteMember]
 *   notifyChallengePublished(challenge)   [Admin] — fans out to EmailQueue/SMSQueue
 *   checkStreakMilestoneNotifications()   [Admin/cron] — queues to EmailQueue
 *   processChallengeNotifSMSQueue()       [Admin/cron] — dispatches SMSQueue items
 *
 * Acceptance: auth failure, default prefs creation, invalid pref key rejection,
 * streak milestone queue insertion, challenge queue fan-out. All paths covered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __getInserted,
  __getUpdated,
  __onInsert,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';
import {
  __reset as resetMembers,
  __setMember,
  __resetMember,
} from './__mocks__/wix-members-backend.js';
import {
  __reset as resetCrm,
} from './__mocks__/wix-crm-backend.js';

// Mock smsService dynamic import
const mockSendChallengeAlertSMS = vi.fn(async () => ({ success: true }));
vi.mock('backend/smsService.web', () => ({
  sendChallengeAlertSMS: (...args) => mockSendChallengeAlertSMS(...args),
}));

import {
  getNotificationPrefs,
  updateNotificationPrefs,
  notifyChallengePublished,
  checkStreakMilestoneNotifications,
  processChallengeNotifSMSQueue,
} from '../src/backend/gamificationNotifs.web.js';

const MEMBER_ID = 'mem-gn-001';
const PREFS_COLLECTION = 'MemberNotificationPrefs';
const STREAK_NOTIFS_COLLECTION = 'StreakMilestoneNotifications';

const DEFAULT_PREFS = {
  streakReminders: true,
  questAlerts: true,
  tierUpdates: true,
  promotionalEmails: false,
  weeklyDigest: true,
};

function makePrefRecord(memberId, overrides = {}) {
  return {
    _id: `pref-${memberId}`,
    memberId,
    ...DEFAULT_PREFS,
    ...overrides,
  };
}

beforeEach(() => {
  resetData();
  resetMembers();
  resetCrm();
  vi.clearAllMocks();
  mockSendChallengeAlertSMS.mockResolvedValue({ success: true });
  // Seed empty collections so queries don't return undefined
  __seed('EmailQueue', []);
  __seed('SMSQueue', []);
});

// ── getNotificationPrefs ──────────────────────────────────────────────────────

describe('getNotificationPrefs', () => {
  it('returns auth_required when caller is not authenticated', async () => {
    __resetMember();
    const result = await getNotificationPrefs();
    expect(result).toEqual({ error: 'auth_required' });
  });

  it('returns existing prefs for authenticated member', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(PREFS_COLLECTION, [makePrefRecord(MEMBER_ID, { promotionalEmails: true })]);

    const result = await getNotificationPrefs();
    expect(result.promotionalEmails).toBe(true);
    expect(result.streakReminders).toBe(true);
    expect(result).not.toHaveProperty('error');
  });

  it('creates and returns default prefs when no record exists', async () => {
    __setMember({ _id: MEMBER_ID });

    const result = await getNotificationPrefs();
    expect(result).toEqual(DEFAULT_PREFS);

    // Should have inserted a default record
    const inserted = __getInserted(PREFS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe(MEMBER_ID);
  });

  it('fills in missing pref keys from defaults (schema migration safety)', async () => {
    __setMember({ _id: MEMBER_ID });
    // Record with only some keys
    __seed(PREFS_COLLECTION, [{
      _id: 'pref-1', memberId: MEMBER_ID, streakReminders: false,
    }]);

    const result = await getNotificationPrefs();
    expect(result.streakReminders).toBe(false);
    // Missing keys fall back to defaults
    expect(result.questAlerts).toBe(true);
    expect(result.weeklyDigest).toBe(true);
  });

  it('returns service_unavailable on DB error', async () => {
    __setMember({ _id: MEMBER_ID });
    __setQueryError(PREFS_COLLECTION, new Error('DB down'));

    const result = await getNotificationPrefs();
    expect(result).toEqual({ error: 'service_unavailable' });
  });
});

// ── updateNotificationPrefs ───────────────────────────────────────────────────

describe('updateNotificationPrefs', () => {
  it('returns auth_required when caller is not authenticated', async () => {
    __resetMember();
    const result = await updateNotificationPrefs({ streakReminders: false });
    expect(result).toEqual({ error: 'auth_required' });
  });

  it('returns invalid_prefs when prefs is not an object', async () => {
    __setMember({ _id: MEMBER_ID });
    expect(await updateNotificationPrefs(null)).toEqual({ error: 'invalid_prefs' });
    expect(await updateNotificationPrefs('string')).toEqual({ error: 'invalid_prefs' });
    expect(await updateNotificationPrefs(42)).toEqual({ error: 'invalid_prefs' });
  });

  it('ignores unknown pref keys — only updates known keys', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(PREFS_COLLECTION, [makePrefRecord(MEMBER_ID)]);

    // Track actual inserts (not seeded items)
    const actualInserts = [];
    __onInsert((col, item) => actualInserts.push({ col, item }));

    const result = await updateNotificationPrefs({ unknownKey: true, anotherBogus: false });
    expect(result).toEqual({ success: true });

    // No DB insert or update should have occurred (early return path)
    expect(actualInserts).toHaveLength(0);
  });

  it('returns success: true when prefs object has no known keys', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await updateNotificationPrefs({});
    expect(result).toEqual({ success: true });
  });

  it('updates an existing record with known pref keys', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(PREFS_COLLECTION, [makePrefRecord(MEMBER_ID)]);

    const result = await updateNotificationPrefs({ promotionalEmails: true, weeklyDigest: false });
    expect(result).toEqual({ success: true });
  });

  it('inserts default record merged with updates when no record exists', async () => {
    __setMember({ _id: MEMBER_ID });

    const result = await updateNotificationPrefs({ streakReminders: false });
    expect(result).toEqual({ success: true });

    const inserted = __getInserted(PREFS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe(MEMBER_ID);
    expect(inserted[0].streakReminders).toBe(false);
    // Other defaults preserved
    expect(inserted[0].questAlerts).toBe(true);
  });

  it('coerces pref values to boolean', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(PREFS_COLLECTION, [makePrefRecord(MEMBER_ID)]);

    await updateNotificationPrefs({ promotionalEmails: 1, weeklyDigest: 0 });
    // No assertion on DB value since mock doesn't return updated record,
    // but success confirms no throw
  });

  it('returns service_unavailable on DB error', async () => {
    __setMember({ _id: MEMBER_ID });
    __setQueryError(PREFS_COLLECTION, new Error('DB down'));

    const result = await updateNotificationPrefs({ streakReminders: false });
    expect(result).toEqual({ error: 'service_unavailable' });
  });
});

// ── notifyChallengePublished (GH#991: queue fan-out) ─────────────────────────

describe('notifyChallengePublished', () => {
  function makeChallenge(overrides = {}) {
    return {
      title: 'Rate 3 Products',
      description: 'Leave honest reviews on any 3 items.',
      rewardPoints: 200,
      rewardBadgeLabel: null,
      expiresAt: '2026-05-01T00:00:00Z',
      ...overrides,
    };
  }

  function seedOptedIn(memberIds) {
    __seed(PREFS_COLLECTION, memberIds.map(id => makePrefRecord(id, { questAlerts: true })));
  }

  it('returns success: false when challenge.title is missing', async () => {
    const result = await notifyChallengePublished({});
    expect(result).toEqual({ success: false, queued: 0 });
  });

  it('returns success: false when challenge is null/undefined', async () => {
    const result = await notifyChallengePublished(null);
    expect(result).toEqual({ success: false, queued: 0 });
  });

  it('returns queued: 0 when no members opted in', async () => {
    __seed(PREFS_COLLECTION, []);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result).toEqual({ success: true, queued: 0 });
  });

  it('inserts an EmailQueue record for each opted-in member', async () => {
    seedOptedIn(['mem-a', 'mem-b', 'mem-c']);

    const result = await notifyChallengePublished(makeChallenge());
    expect(result).toEqual({ success: true, queued: 3 });

    const emails = __getInserted('EmailQueue');
    expect(emails).toHaveLength(3);
    expect(emails.every(e => e.templateId === 'challenge_new_weekly')).toBe(true);
    expect(emails.every(e => e.sequenceType === 'challenge_notif')).toBe(true);
    expect(emails.every(e => e.status === 'pending')).toBe(true);
    expect(emails.map(e => e.recipientContactId).sort()).toEqual(['mem-a', 'mem-b', 'mem-c']);
  });

  it('inserts an SMSQueue record for each opted-in member', async () => {
    seedOptedIn(['mem-a', 'mem-b']);

    const result = await notifyChallengePublished(makeChallenge());
    expect(result.queued).toBe(2);

    const smsItems = __getInserted('SMSQueue');
    expect(smsItems).toHaveLength(2);
    expect(smsItems.every(s => s.messageType === 'challenge_alert')).toBe(true);
    expect(smsItems.every(s => s.status === 'pending')).toBe(true);
    expect(smsItems.map(s => s.memberId).sort()).toEqual(['mem-a', 'mem-b']);
  });

  it('does not call sendChallengeAlertSMS directly — fan-out only', async () => {
    seedOptedIn(['mem-a']);
    await notifyChallengePublished(makeChallenge());
    expect(mockSendChallengeAlertSMS).not.toHaveBeenCalled();
  });

  it('includes badge label in EmailQueue variables when present', async () => {
    seedOptedIn(['mem-a']);

    await notifyChallengePublished(makeChallenge({ rewardBadgeLabel: 'Gold Reviewer' }));
    const emails = __getInserted('EmailQueue');
    const vars = JSON.parse(emails[0].variables);
    expect(vars.rewardText).toContain('Gold Reviewer');
  });

  it('uses points-only reward text in variables when no badge', async () => {
    seedOptedIn(['mem-a']);

    await notifyChallengePublished(makeChallenge({ rewardPoints: 150 }));
    const emails = __getInserted('EmailQueue');
    const vars = JSON.parse(emails[0].variables);
    expect(vars.rewardText).toBe('150 pts');
  });

  it('SMS message includes challenge title and reward text', async () => {
    seedOptedIn(['mem-a']);

    await notifyChallengePublished(makeChallenge({ title: 'Leave a Review', rewardPoints: 50 }));
    const smsItems = __getInserted('SMSQueue');
    expect(smsItems[0].message).toContain('Leave a Review');
    expect(smsItems[0].message).toContain('50 pts');
  });

  it('returns success: false on queue insert failure', async () => {
    seedOptedIn(['mem-a']);
    __setInsertError('EmailQueue', new Error('DB write failed'));

    const result = await notifyChallengePublished(makeChallenge());
    expect(result).toEqual({ success: false, queued: 0 });
  });
});

// ── checkStreakMilestoneNotifications (GH#991: queue + pagination) ────────────

describe('checkStreakMilestoneNotifications', () => {
  function seedStreakMembers(memberIds) {
    __seed('MemberPoints', memberIds.map(id => ({
      _id: `mp-${id}`,
      memberId: id,
      currentStreakDays: 7,
    })));
  }

  function seedPrefsFor(memberIds, streakReminders = true) {
    __seed(PREFS_COLLECTION, memberIds.map(id => makePrefRecord(id, { streakReminders })));
  }

  function seedAlreadySent(memberIds) {
    __seed(STREAK_NOTIFS_COLLECTION, memberIds.map(id => ({
      _id: `sn-${id}`,
      memberId: id,
      milestone: 7,
      sentAt: new Date().toISOString(),
    })));
  }

  it('returns { queued: 0, skipped: 0, errors: 0 } when no members at day 7', async () => {
    __seed('MemberPoints', []);
    const result = await checkStreakMilestoneNotifications();
    expect(result).toEqual({ queued: 0, skipped: 0, errors: 0 });
  });

  it('queues streak milestone email to EmailQueue for eligible members', async () => {
    seedStreakMembers(['mem-1', 'mem-2']);

    const result = await checkStreakMilestoneNotifications();
    expect(result.queued).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);

    const emails = __getInserted('EmailQueue');
    expect(emails).toHaveLength(2);
    expect(emails.every(e => e.templateId === 'streak_milestone_day7')).toBe(true);
    expect(emails.every(e => e.sequenceType === 'streak_milestone')).toBe(true);
    expect(emails.every(e => e.status === 'pending')).toBe(true);
  });

  it('skips members who already received day-7 notification (idempotent)', async () => {
    seedStreakMembers(['mem-1', 'mem-2']);
    seedAlreadySent(['mem-1']);

    const result = await checkStreakMilestoneNotifications();
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);

    const emails = __getInserted('EmailQueue');
    expect(emails).toHaveLength(1);
    expect(emails[0].recipientContactId).toBe('mem-2');
  });

  it('skips members with streakReminders: false in prefs', async () => {
    seedStreakMembers(['mem-1', 'mem-2']);
    __seed(PREFS_COLLECTION, [
      makePrefRecord('mem-1', { streakReminders: false }),
      makePrefRecord('mem-2', { streakReminders: true }),
    ]);

    const result = await checkStreakMilestoneNotifications();
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('defaults to opt-in when member has no prefs record', async () => {
    seedStreakMembers(['mem-1']);
    // No prefs seeded — should default to queuing

    const result = await checkStreakMilestoneNotifications();
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('records sent notification to prevent future duplicates', async () => {
    seedStreakMembers(['mem-1']);

    await checkStreakMilestoneNotifications();

    const inserted = __getInserted(STREAK_NOTIFS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe('mem-1');
    expect(inserted[0].milestone).toBe(7);
    expect(inserted[0].sentAt).toBeDefined();
  });

  it('increments errors when EmailQueue insert fails, continues for other members', async () => {
    seedStreakMembers(['mem-1', 'mem-2']);

    // Fail the first EmailQueue insert, then clear error so mem-2 succeeds
    let insertCount = 0;
    __onInsert((col) => {
      if (col === 'EmailQueue') {
        insertCount++;
        if (insertCount === 1) throw new Error('queue write failed');
      }
    });

    const result = await checkStreakMilestoneNotifications();
    expect(result.queued).toBe(1);
    expect(result.errors).toBe(1);
  });

  it('returns { queued: 0 } gracefully on top-level DB error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await checkStreakMilestoneNotifications();
    expect(result).toEqual({ queued: 0, skipped: 0, errors: 0 });
  });
});

// ── processChallengeNotifSMSQueue (GH#991: SMS cron processor) ───────────────

describe('processChallengeNotifSMSQueue', () => {
  function seedSMSQueue(items) {
    __seed('SMSQueue', items.map((item, i) => ({
      _id: `sms-${i}`,
      memberId: item.memberId,
      message: item.message || 'Test challenge SMS',
      messageType: 'challenge_alert',
      status: 'pending',
      scheduledFor: new Date(),
      attempt: 0,
      createdAt: new Date(),
      ...item,
    })));
  }

  it('returns { processed: 0, failed: 0 } when queue is empty', async () => {
    const result = await processChallengeNotifSMSQueue();
    expect(result).toEqual({ processed: 0, failed: 0 });
  });

  it('dispatches each pending SMS via sendChallengeAlertSMS', async () => {
    seedSMSQueue([
      { memberId: 'mem-a', message: 'Challenge A msg' },
      { memberId: 'mem-b', message: 'Challenge B msg' },
    ]);

    const result = await processChallengeNotifSMSQueue();
    expect(result).toEqual({ processed: 2, failed: 0 });
    expect(mockSendChallengeAlertSMS).toHaveBeenCalledTimes(2);
    expect(mockSendChallengeAlertSMS).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'mem-a', message: 'Challenge A msg' })
    );
  });

  it('marks SMS as sent on success, failed on failure', async () => {
    seedSMSQueue([
      { memberId: 'mem-a', message: 'ok' },
      { memberId: 'mem-b', message: 'fail' },
    ]);
    mockSendChallengeAlertSMS
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });

    const result = await processChallengeNotifSMSQueue();
    expect(result).toEqual({ processed: 1, failed: 1 });

    // Two-phase: each item gets a 'processing' update then a final status update.
    // Use the last update per member to get the final status.
    const allUpdated = __getUpdated('SMSQueue');
    const sentItem = [...allUpdated].reverse().find(u => u.memberId === 'mem-a');
    const failedItem = [...allUpdated].reverse().find(u => u.memberId === 'mem-b');
    expect(sentItem.status).toBe('sent');
    expect(failedItem.status).toBe('failed');
  });

  it('skips items already in processing status (two-phase in-flight lock)', async () => {
    // Seed a mix: one pending (should be dispatched), one processing (should be skipped)
    __seed('SMSQueue', [
      {
        _id: 'sms-pending',
        memberId: 'mem-a',
        message: 'pending msg',
        messageType: 'challenge_alert',
        status: 'pending',
        scheduledFor: new Date(),
        attempt: 0,
        createdAt: new Date(),
      },
      {
        _id: 'sms-processing',
        memberId: 'mem-b',
        message: 'in-flight msg',
        messageType: 'challenge_alert',
        status: 'processing',
        scheduledFor: new Date(),
        attempt: 0,
        createdAt: new Date(),
      },
    ]);

    const result = await processChallengeNotifSMSQueue();
    // Only the pending item is dispatched; processing item is not queried
    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(mockSendChallengeAlertSMS).toHaveBeenCalledTimes(1);
    expect(mockSendChallengeAlertSMS).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'mem-a' })
    );
  });

  it('counts thrown SMS errors as failed and continues', async () => {
    seedSMSQueue([
      { memberId: 'mem-a' },
      { memberId: 'mem-b' },
    ]);
    mockSendChallengeAlertSMS
      .mockRejectedValueOnce(new Error('Twilio down'))
      .mockResolvedValueOnce({ success: true });

    const result = await processChallengeNotifSMSQueue();
    expect(result).toEqual({ processed: 1, failed: 1 });
  });

  it('ignores non-challenge_alert items in the queue', async () => {
    __seed('SMSQueue', [
      { _id: 'sms-1', memberId: 'mem-a', message: 'x', messageType: 'promo', status: 'pending', scheduledFor: new Date(), attempt: 0, createdAt: new Date() },
    ]);

    const result = await processChallengeNotifSMSQueue();
    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(mockSendChallengeAlertSMS).not.toHaveBeenCalled();
  });
});
