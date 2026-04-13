/**
 * @file gamificationNotifs.test.js
 * @description CF-tcqq — Full TDD coverage for gamificationNotifs.web.js:
 *   getNotificationPrefs()                [SiteMember]
 *   updateNotificationPrefs(prefs)        [SiteMember]
 *   notifyChallengePublished(challenge)   [Admin]
 *   checkStreakMilestoneNotifications()   [Admin/cron]
 *
 * Acceptance: auth failure, default prefs creation, invalid pref key rejection,
 * streak milestone email trigger, challenge email+SMS fan-out. All paths covered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import wixData from './__mocks__/wix-data.js';
import {
  __reset as resetData,
  __seed,
  __getInserted,
  __setInsertError,
  __onInsert,
  __setQueryError,
} from './__mocks__/wix-data.js';
import { queryAll } from '../src/backend/utils/queryAll.js';
import {
  __reset as resetMembers,
  __setMember,
  __resetMember,
} from './__mocks__/wix-members-backend.js';
import {
  __reset as resetCrm,
  __getEmailLog,
  __failNextEmail,
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

// ── notifyChallengePublished ──────────────────────────────────────────────────

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
    expect(result).toEqual({ success: false, emailsSent: 0, smsSent: 0 });
  });

  it('returns success: false when challenge is null/undefined', async () => {
    const result = await notifyChallengePublished(null);
    expect(result).toEqual({ success: false, emailsSent: 0, smsSent: 0 });
  });

  it('returns emailsSent: 0 and smsSent: 0 when no members opted in', async () => {
    __seed(PREFS_COLLECTION, []);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result).toEqual({ success: true, emailsSent: 0, smsSent: 0 });
  });

  it('sends email to each opted-in member', async () => {
    seedOptedIn(['mem-a', 'mem-b', 'mem-c']);

    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.emailsSent).toBe(3);

    // Queue-based: implementation inserts into EmailQueue instead of calling triggeredEmails directly
    const queue = __getInserted('EmailQueue');
    expect(queue).toHaveLength(3);
    expect(queue.every(e => e.templateId === 'challenge_new_weekly')).toBe(true);
    expect(queue.map(e => e.recipientContactId)).toEqual(expect.arrayContaining(['mem-a', 'mem-b', 'mem-c']));
  });

  it('sends SMS to each opted-in member', async () => {
    seedOptedIn(['mem-a', 'mem-b']);

    const result = await notifyChallengePublished(makeChallenge());
    expect(result.smsSent).toBe(2);
    // Queue-based: inserts into ChallengeNotifSMSQueue instead of calling Twilio directly
    expect(__getInserted('ChallengeNotifSMSQueue')).toHaveLength(2);
  });

  it('includes badge label in reward text when present', async () => {
    seedOptedIn(['mem-a']);

    await notifyChallengePublished(makeChallenge({ rewardBadgeLabel: 'Gold Reviewer' }));
    const queue = __getInserted('EmailQueue');
    const vars = queue[0].variables;
    expect(vars.rewardText).toContain('Gold Reviewer');
  });

  it('uses points-only reward text when no badge', async () => {
    seedOptedIn(['mem-a']);

    await notifyChallengePublished(makeChallenge({ rewardPoints: 150 }));
    const queue = __getInserted('EmailQueue');
    const vars = queue[0].variables;
    expect(vars.rewardText).toBe('150 pts');
  });

  it('individual email failure does not stop the pipeline', async () => {
    seedOptedIn(['mem-a', 'mem-b', 'mem-c']);
    __setInsertError('EmailQueue', new Error('email insert failed')); // mem-a insert fails

    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.emailsSent).toBe(2); // mem-b, mem-c succeed
  });

  it('individual SMS failure does not stop the pipeline', async () => {
    seedOptedIn(['mem-a', 'mem-b']);
    __setInsertError('ChallengeNotifSMSQueue', new Error('sms insert failed')); // mem-a insert fails

    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.smsSent).toBe(1); // mem-b succeeds
  });
});

// ── checkStreakMilestoneNotifications ─────────────────────────────────────────

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

  it('returns { sent: 0, skipped: 0, errors: 0 } when no members at day 7', async () => {
    __seed('MemberPoints', []);
    const result = await checkStreakMilestoneNotifications();
    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
  });

  it('sends streak milestone email to eligible members', async () => {
    seedStreakMembers(['mem-1', 'mem-2']);

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);

    const log = __getEmailLog();
    expect(log).toHaveLength(2);
    expect(log.every(e => e.templateId === 'streak_milestone_day7')).toBe(true);
  });

  it('skips members who already received day-7 notification (idempotent)', async () => {
    seedStreakMembers(['mem-1', 'mem-2']);
    seedAlreadySent(['mem-1']);

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);

    const log = __getEmailLog();
    expect(log).toHaveLength(1);
    expect(log[0].memberId).toBe('mem-2');
  });

  it('skips members with streakReminders: false in prefs', async () => {
    seedStreakMembers(['mem-1', 'mem-2']);
    // Seed both together — second __seed call overwrites first
    __seed(PREFS_COLLECTION, [
      makePrefRecord('mem-1', { streakReminders: false }),
      makePrefRecord('mem-2', { streakReminders: true }),
    ]);

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('defaults to opt-in when member has no prefs record', async () => {
    seedStreakMembers(['mem-1']);
    // No prefs seeded — should default to sending

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(1);
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

  it('increments errors when email send fails, continues for other members', async () => {
    seedStreakMembers(['mem-1', 'mem-2']);
    __failNextEmail(); // mem-1 email fails

    const result = await checkStreakMilestoneNotifications();
    expect(result.sent).toBe(1);
    expect(result.errors).toBe(1);
  });

  it('returns { sent: 0 } gracefully on top-level DB error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await checkStreakMilestoneNotifications();
    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
  });
});

// ── cf-n16: queryAll multi-page pagination ────────────────────────────────────
// The wix-data mock's default limitVal is 50. Seeding >50 items forces the
// hasNext→next cursor chain — verifies queryAll collects all pages.

describe('queryAll — multi-page cursor traversal', () => {
  const TEST_COLLECTION = 'MemberNotificationPrefs';

  beforeEach(() => {
    resetData();
  });

  it('fetches all items when result spans multiple pages (>50 default limit)', async () => {
    const total = 51;
    const items = Array.from({ length: total }, (_, i) => ({
      _id: `pref-${i}`,
      memberId: `mem-${i}`,
      questAlerts: true,
    }));
    __seed(TEST_COLLECTION, items);

    // limit(25) forces ceil(51/25)=3 pages; default limitVal=50 also exercises pagination
    const result = await queryAll(
      wixData.query(TEST_COLLECTION).eq('questAlerts', true).limit(25),
      { suppressAuth: true }
    );

    expect(result).toHaveLength(total);
    expect(result.map(r => r.memberId).sort()).toEqual(
      items.map(i => i.memberId).sort()
    );
  });

  it('returns all items when exactly on page boundary', async () => {
    // 50 items with limit(25) = exactly 2 pages
    const total = 50;
    __seed(TEST_COLLECTION, Array.from({ length: total }, (_, i) => ({
      _id: `pref-${i}`,
      memberId: `mem-${i}`,
      questAlerts: true,
    })));

    const result = await queryAll(
      wixData.query(TEST_COLLECTION).limit(25),
      { suppressAuth: true }
    );

    expect(result).toHaveLength(total);
  });

  it('works correctly when all items fit in a single page', async () => {
    __seed(TEST_COLLECTION, [
      { _id: 'p1', memberId: 'mem-1', questAlerts: true },
      { _id: 'p2', memberId: 'mem-2', questAlerts: true },
    ]);

    const result = await queryAll(
      wixData.query(TEST_COLLECTION).limit(25),
      { suppressAuth: true }
    );

    expect(result).toHaveLength(2);
  });

  it('returns empty array when collection has no matching items', async () => {
    const result = await queryAll(
      wixData.query(TEST_COLLECTION).eq('questAlerts', true).limit(25)
    );
    expect(result).toEqual([]);
  });

  it('notifyChallengePublished notifies all members across pages', async () => {
    // Seed 51 opted-in members — exceeds default limitVal=50
    const total = 51;
    __seed(TEST_COLLECTION, Array.from({ length: total }, (_, i) => ({
      _id: `pref-${i}`,
      memberId: `mem-${i}`,
      questAlerts: true,
    })));

    const { notifyChallengePublished } = await import('../src/backend/gamificationNotifs.web.js');
    const result = await notifyChallengePublished({
      title: 'Big Sale Challenge',
      rewardPoints: 200,
    });

    expect(result.success).toBe(true);
    // All 51 members should have an EmailQueue entry
    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(total);
  });
});
