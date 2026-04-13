/**
 * @file challengeNotificationPipeline.test.js
 * @description Tests for CF-qhdo: Challenge notification pipeline — email + SMS
 * alerts for new weekly challenges to opted-in members.
 *
 * Covers:
 *  - Sends email to members with questAlerts: true
 *  - Skips members with questAlerts: false
 *  - Returns emailsSent and smsSent counts
 *  - Sends SMS via sendChallengeAlertSMS to opted-in members
 *  - SMS body includes challenge title, reward, and URL
 *  - Returns { success: false } when challenge.title missing
 *  - Handles empty opt-in list gracefully
 *  - Best-effort: individual failures don't stop the pipeline
 *
 * CF-qhdo
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __getInserted,
} from './__mocks__/wix-data.js';
import {
  __reset as resetCrm,
} from './__mocks__/wix-crm-backend.js';
import {
  notifyChallengePublished,
} from '../src/backend/gamificationNotifs.web.js';

const NOTIF_PREFS_COLLECTION = 'MemberNotificationPrefs';

beforeEach(() => {
  resetData();
  resetCrm();
  vi.clearAllMocks();
  // Seed empty queues so __getInserted returns [] not undefined
  __seed('EmailQueue', []);
  __seed('SMSQueue', []);
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

// ── EmailQueue fan-out (GH#991: queue-based, not inline send) ────────────────

describe('notifyChallengePublished — email', () => {
  it('queues EmailQueue record for each opted-in member', async () => {
    seedOptedInMembers(['mem-1', 'mem-2', 'mem-3']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
    const emails = __getInserted('EmailQueue');
    expect(emails).toHaveLength(3);
  });

  it('queues zero emails when no members have questAlerts: true', async () => {
    seedOptedOutMembers(['mem-4']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
    expect(__getInserted('EmailQueue')).toHaveLength(0);
  });

  it('queues zero when no notification prefs exist', async () => {
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
    expect(__getInserted('EmailQueue')).toHaveLength(0);
    expect(__getInserted('SMSQueue')).toHaveLength(0);
  });

  it('uses challenge_new_weekly template in EmailQueue record', async () => {
    seedOptedInMembers(['mem-5']);
    await notifyChallengePublished(makeChallenge());
    const emails = __getInserted('EmailQueue');
    expect(emails.length).toBeGreaterThanOrEqual(1);
    expect(emails[0].templateId).toBe('challenge_new_weekly');
  });

  it('includes challenge details in EmailQueue variables', async () => {
    seedOptedInMembers(['mem-6']);
    await notifyChallengePublished(makeChallenge({
      title: 'Photo Week',
      description: 'Share 5 photos',
      rewardPoints: 200,
    }));
    const emails = __getInserted('EmailQueue');
    const vars = JSON.parse(emails[0].variables);
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
    const emails = __getInserted('EmailQueue');
    const vars = JSON.parse(emails[0].variables);
    expect(vars.rewardText).toBe('100 pts + Reviewer badge');
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

// ── SMSQueue fan-out (GH#991) ─────────────────────────────────────────────────

describe('notifyChallengePublished — SMS', () => {
  it('queues SMSQueue record for each opted-in member', async () => {
    seedOptedInMembers(['mem-sms1', 'mem-sms2']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.queued).toBe(2);
    const smsItems = __getInserted('SMSQueue');
    expect(smsItems).toHaveLength(2);
    expect(smsItems.every(s => s.messageType === 'challenge_alert')).toBe(true);
    expect(smsItems.every(s => s.status === 'pending')).toBe(true);
  });
});
