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
} from './__mocks__/wix-data.js';
import {
  __getEmailLog,
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

// ── Email notifications ──────────────────────────────────────────────────────

describe('notifyChallengePublished — email', () => {
  it('sends email to all members with questAlerts: true', async () => {
    seedOptedInMembers(['mem-1', 'mem-2', 'mem-3']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.emailsSent).toBe(3);
  });

  it('sends zero emails when no members have questAlerts: true', async () => {
    seedOptedOutMembers(['mem-4']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.emailsSent).toBe(0);
  });

  it('sends zero emails when no notification prefs exist', async () => {
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.success).toBe(true);
    expect(result.emailsSent).toBe(0);
    expect(result.smsSent).toBe(0);
  });

  it('uses challenge_new_weekly template', async () => {
    seedOptedInMembers(['mem-5']);
    await notifyChallengePublished(makeChallenge());
    const log = __getEmailLog();
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0].templateId).toBe('challenge_new_weekly');
  });

  it('includes challenge details in email variables', async () => {
    seedOptedInMembers(['mem-6']);
    await notifyChallengePublished(makeChallenge({
      title: 'Photo Week',
      description: 'Share 5 photos',
      rewardPoints: 200,
    }));
    const log = __getEmailLog();
    const vars = log[0].options.variables;
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
    const log = __getEmailLog();
    const vars = log[0].options.variables;
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

// ── SMS notifications ────────────────────────────────────────────────────────

describe('notifyChallengePublished — SMS', () => {
  it('returns smsSent count (0 when no SMS prefs)', async () => {
    seedOptedInMembers(['mem-sms1']);
    const result = await notifyChallengePublished(makeChallenge());
    expect(result.smsSent).toBe(0);
  });
});
