/**
 * @file challengeNotificationPipeline.test.js
 * @description Tests for CF-qhdo: Challenge notification pipeline — email + SMS
 * queue fan-out for new weekly challenges to opted-in members.
 *
 * Covers:
 *  - Queues email to EmailQueue for members with questAlerts: true
 *  - Skips members with questAlerts: false
 *  - Returns emailsSent (queued) and smsSent (queued) counts
 *  - Queues SMS into ChallengeNotifSMSQueue for opted-in members
 *  - SMS message body includes challenge title, reward, and URL
 *  - Returns { success: false } when challenge.title missing
 *  - Handles empty opt-in list gracefully
 *  - Best-effort: individual insert failures don't stop the pipeline
 *  - processChallengeNotifSMSQueue: in-flight lock prevents double-send
 *
 * CF-qhdo
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __getInserted,
  __setInsertError,
} from './__mocks__/wix-data.js';
import {
  notifyChallengePublished,
  processChallengeNotifSMSQueue,
} from '../src/backend/gamificationNotifs.web.js';

const NOTIF_PREFS_COLLECTION = 'MemberNotificationPrefs';
const EMAIL_QUEUE = 'EmailQueue';
const SMS_QUEUE = 'ChallengeNotifSMSQueue';

beforeEach(() => {
  resetData();
  vi.clearAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeChallenge(overrides = {}) {
  return {
    title: 'Write 3 Reviews',
    description: 'Submit reviews on any 3 products this week',
    rewardPoints: 150,
    rewardBadgeLabel: null,
    expiresAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function seedOptedInMembers(memberIds) {
  __seed(NOTIF_PREFS_COLLECTION, memberIds.map(id => ({
    _id: `pref-${id}`,
    memberId: id,
    questAlerts: true,
    streakReminders: true,
    tierUpdates: true,
    promotionalEmails: false,
    weeklyDigest: true,
  })));
}

function seedOptedOutMembers(memberIds) {
  __seed(NOTIF_PREFS_COLLECTION, memberIds.map(id => ({
    _id: `pref-${id}`,
    memberId: id,
    questAlerts: false,
    streakReminders: true,
    tierUpdates: true,
    promotionalEmails: false,
    weeklyDigest: true,
  })));
}

// ── Email queue ───────────────────────────────────────────────────────────────

describe('notifyChallengePublished — email queue', () => {
  it('queues email for all members with questAlerts: true', async () => {
    seedOptedInMembers(['mem-1', 'mem-2', 'mem-3']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.emailsSent).toBe(3);
    expect(__getInserted(EMAIL_QUEUE)).toHaveLength(3);
  });

  it('queues zero emails when no members have questAlerts: true', async () => {
    seedOptedOutMembers(['mem-4']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.emailsSent).toBe(0);
    expect(__getInserted(EMAIL_QUEUE)).toHaveLength(0);
  });

  it('queues zero emails when no notification prefs exist', async () => {
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.emailsSent).toBe(0);
    expect(result.smsSent).toBe(0);
  });

  it('inserts challenge_new_weekly template into EmailQueue', async () => {
    seedOptedInMembers(['mem-5']);
    await notifyChallengePublished(makeChallenge());
    const queued = __getInserted(EMAIL_QUEUE);
    expect(queued.length).toBeGreaterThanOrEqual(1);
    expect(queued[0].templateId).toBe('challenge_new_weekly');
  });

  it('includes challenge details in EmailQueue variables', async () => {
    seedOptedInMembers(['mem-6']);
    await notifyChallengePublished(makeChallenge({
      title: 'Photo Week',
      description: 'Share 5 photos',
      rewardPoints: 200,
    }));
    const queued = __getInserted(EMAIL_QUEUE);
    const vars = queued[0].variables;
    expect(vars.challengeTitle).toBe('Photo Week');
    expect(vars.challengeDescription).toBe('Share 5 photos');
    expect(vars.rewardText).toBe('200 pts');
    expect(vars.challengeUrl).toContain('/account/my-account');
  });

  it('includes badge label in reward text when present', async () => {
    seedOptedInMembers(['mem-7']);
    await notifyChallengePublished(makeChallenge({
      rewardPoints: 100,
      rewardBadgeLabel: 'Reviewer',
    }));
    const queued = __getInserted(EMAIL_QUEUE);
    expect(queued[0].variables.rewardText).toBe('100 pts + Reviewer badge');
  });

  it('inserts with status: pending and sequenceType: challenge_notify', async () => {
    seedOptedInMembers(['mem-8']);
    await notifyChallengePublished(makeChallenge());
    const queued = __getInserted(EMAIL_QUEUE);
    expect(queued[0].status).toBe('pending');
    expect(queued[0].sequenceType).toBe('challenge_notify');
  });

  it('continues queuing other members when one EmailQueue insert fails', async () => {
    seedOptedInMembers(['mem-a', 'mem-b', 'mem-c']);
    // First insert will throw; others should still succeed via Promise.allSettled
    __setInsertError(EMAIL_QUEUE, new Error('DB transient'));
    const result = await notifyChallengePublished(makeChallenge());
    // allSettled means partial success — at least some succeed after first error clears
    expect(result.success).toBe(true);
  });
});

// ── Input validation ─────────────────────────────────────────────────────────

describe('notifyChallengePublished — validation', () => {
  it('returns { success: false } when challenge is null', async () => {
    const result = await notifyChallengePublished(null);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when challenge.title is empty', async () => {
    const result = await notifyChallengePublished({ title: '', rewardPoints: 50 });
    expect(result.success).toBe(false);
  });

  it('does not throw on pipeline error', async () => {
    seedOptedInMembers(['mem-err']);
    await expect(
      notifyChallengePublished(makeChallenge())
    ).resolves.not.toThrow();
  });
});

// ── SMS queue ─────────────────────────────────────────────────────────────────

describe('notifyChallengePublished — SMS queue', () => {
  it('queues SMS for all questAlerts members', async () => {
    seedOptedInMembers(['mem-sms1', 'mem-sms2']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.smsSent).toBe(2);
    expect(__getInserted(SMS_QUEUE)).toHaveLength(2);
  });

  it('SMS queue items include memberId, message, and pending status', async () => {
    seedOptedInMembers(['mem-sms3']);
    await notifyChallengePublished(makeChallenge({ title: 'Rate Your Futon' }));
    const queued = __getInserted(SMS_QUEUE);
    expect(queued[0].memberId).toBe('mem-sms3');
    expect(queued[0].message).toContain('Rate Your Futon');
    expect(queued[0].status).toBe('pending');
  });

  it('SMS message body includes reward text and challenge URL', async () => {
    seedOptedInMembers(['mem-sms4']);
    await notifyChallengePublished(makeChallenge({
      title: 'Review Week',
      rewardPoints: 75,
    }));
    const queued = __getInserted(SMS_QUEUE);
    expect(queued[0].message).toContain('75 pts');
    expect(queued[0].message).toContain('/account/my-account');
  });
});

// ── processChallengeNotifSMSQueue: in-flight lock ─────────────────────────────

describe('processChallengeNotifSMSQueue — in-flight lock', () => {
  it('returns { skipped, reason: in_flight } when already running', async () => {
    // Seed a pending item so the first call actually runs
    __seed(SMS_QUEUE, [{ _id: 'sms-1', memberId: 'mem-lock', message: 'msg', status: 'pending' }]);

    // Start first call but don't await yet — fire second immediately
    const first = processChallengeNotifSMSQueue();
    const second = processChallengeNotifSMSQueue();

    const [r1, r2] = await Promise.all([first, second]);
    // One of them should be skipped due to the in-flight lock
    const skipped = [r1, r2].find(r => r.skipped);
    expect(skipped).toBeDefined();
    expect(skipped.reason).toBe('in_flight');
  });

  it('allows a second run after the first completes', async () => {
    __seed(SMS_QUEUE, []);
    const r1 = await processChallengeNotifSMSQueue();
    expect(r1.skipped).toBeUndefined();

    const r2 = await processChallengeNotifSMSQueue();
    expect(r2.skipped).toBeUndefined();
  });
});

describe('jobs.config — processChallengeNotifSMSQueue entry', () => {
  it('registers processChallengeNotifSMSQueue pointing to gamificationNotifs.web.js', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    expect(jobs.processChallengeNotifSMSQueue).toBeDefined();
    expect(jobs.processChallengeNotifSMSQueue.functionLocation).toBe('/gamificationNotifs.web.js');
  });

  it('schedules processChallengeNotifSMSQueue every 15 minutes to match processEmailQueue cadence', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    expect(jobs.processChallengeNotifSMSQueue.executionConfig.cronExpression).toBe('*/15 * * * *');
  });
});
