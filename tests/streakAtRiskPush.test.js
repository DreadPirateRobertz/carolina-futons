/**
 * streakAtRiskPush.test.js
 * cf-2yd — Daily streak-at-risk push notifications via cron.
 *
 * runStreakAtRiskPushNotifications() fires daily at 9 AM EST.
 * It finds members whose streak is active (currentStreakDays > 0) but who
 * haven't been active today (lastActivityDate = yesterdayET), then sends
 * a push reminder via sendPushToMember (STREAK_MILESTONE event).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import { runStreakAtRiskPushNotifications } from '../src/backend/gamificationNotifs.web.js';

// ── Fixed dates used across tests ─────────────────────────────────────────────

const TODAY_ET    = '2026-04-13';
const YESTERDAY_ET = '2026-04-12';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockSendPushToMember = vi.fn(async () => ({ sent: 1, failed: 0 }));

vi.mock('backend/utils/dateUtils', () => ({
  getYesterdayET: () => YESTERDAY_ET,
  getTodayET: () => TODAY_ET,
}));

const mockSkipIfOptedOut = vi.fn(async () => false);

vi.mock('backend/pushNotificationService.web', () => ({
  sendPushToMember: (...args) => mockSendPushToMember(...args),
  skipIfOptedOut: (...args) => mockSkipIfOptedOut(...args),
  PUSH_EVENTS: {
    STREAK_MILESTONE: 'streak_milestone',
  },
}));

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  // Default: sends 1 push per call
  mockSendPushToMember.mockResolvedValue({ sent: 1, failed: 0 });
  mockSkipIfOptedOut.mockResolvedValue(false);
});

// ── Core send path ────────────────────────────────────────────────────────────

describe('runStreakAtRiskPushNotifications — core send path', () => {
  it('sends push to a member whose streak is at risk (active yesterday, not today)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 5, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockSendPushToMember).toHaveBeenCalledOnce();
    expect(mockSendPushToMember).toHaveBeenCalledWith('mem-1', 'streak_milestone', { days: '5' });
  });

  it('sends push to multiple at-risk members', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 3, lastActivityDate: YESTERDAY_ET },
      { _id: 'mp-2', memberId: 'mem-2', currentStreakDays: 10, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(2);
    expect(mockSendPushToMember).toHaveBeenCalledTimes(2);
  });

  it('passes currentStreakDays as string in push payload', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 12, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);

    await runStreakAtRiskPushNotifications();

    expect(mockSendPushToMember).toHaveBeenCalledWith('mem-1', 'streak_milestone', { days: '12' });
  });

  it('returns { sent: 0, skipped: 0, errors: 0 } when no at-risk members', async () => {
    __seed('MemberPoints', []);

    const result = await runStreakAtRiskPushNotifications();

    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
    expect(mockSendPushToMember).not.toHaveBeenCalled();
  });
});

// ── Eligibility filters ───────────────────────────────────────────────────────

describe('runStreakAtRiskPushNotifications — eligibility filters', () => {
  it('skips members who already acted today (lastActivityDate = today)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 5, lastActivityDate: TODAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(0);
    expect(mockSendPushToMember).not.toHaveBeenCalled();
  });

  it('skips members with no active streak (currentStreakDays = 0)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 0, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(0);
    expect(mockSendPushToMember).not.toHaveBeenCalled();
  });

  it('sends to members with lastActivityDate = yesterday AND currentStreakDays > 0', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-eligible',   memberId: 'mem-1', currentStreakDays: 4, lastActivityDate: YESTERDAY_ET },
      { _id: 'mp-acted-today', memberId: 'mem-2', currentStreakDays: 4, lastActivityDate: TODAY_ET },
      { _id: 'mp-no-streak',   memberId: 'mem-3', currentStreakDays: 0, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(1);
    expect(mockSendPushToMember).toHaveBeenCalledWith('mem-1', 'streak_milestone', { days: '4' });
  });
});

// ── Notification preference opt-out ──────────────────────────────────────────

describe('runStreakAtRiskPushNotifications — notification prefs', () => {
  it('skips members with streakReminders: false', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 5, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', [
      { memberId: 'mem-1', streakReminders: false },
    ]);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockSendPushToMember).not.toHaveBeenCalled();
  });

  it('sends to members with streakReminders: true', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 5, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', [
      { memberId: 'mem-1', streakReminders: true },
    ]);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(1);
    expect(mockSendPushToMember).toHaveBeenCalledOnce();
  });

  it('sends by default when no prefs record exists (opt-out model)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 5, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []); // no prefs record

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(1);
    expect(mockSendPushToMember).toHaveBeenCalledOnce();
  });

  it('mixed: sends to opted-in, skips opted-out', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-opted-in',  currentStreakDays: 3, lastActivityDate: YESTERDAY_ET },
      { _id: 'mp-2', memberId: 'mem-opted-out', currentStreakDays: 7, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', [
      { memberId: 'mem-opted-in',  streakReminders: true },
      { memberId: 'mem-opted-out', streakReminders: false },
    ]);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockSendPushToMember).toHaveBeenCalledOnce();
    expect(mockSendPushToMember).toHaveBeenCalledWith('mem-opted-in', 'streak_milestone', { days: '3' });
  });
});

// ── Token availability and error handling ─────────────────────────────────────

describe('runStreakAtRiskPushNotifications — token availability + errors', () => {
  it('counts as skipped when member has no active device tokens (sent = 0)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 5, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);
    mockSendPushToMember.mockResolvedValue({ sent: 0, failed: 0 }); // no tokens

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toBe(0);
  });

  it('counts as error when sendPushToMember throws', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 5, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);
    mockSendPushToMember.mockRejectedValue(new Error('FCM error'));

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('continues processing remaining members after a single push failure', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 3, lastActivityDate: YESTERDAY_ET },
      { _id: 'mp-2', memberId: 'mem-2', currentStreakDays: 5, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);
    mockSendPushToMember
      .mockRejectedValueOnce(new Error('FCM error'))
      .mockResolvedValueOnce({ sent: 1, failed: 0 });

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(1);
    expect(result.errors).toBe(1);
    expect(mockSendPushToMember).toHaveBeenCalledTimes(2);
  });

  it('returns { sent: 0, skipped: 0, errors: 0 } on pipeline failure', async () => {
    // Simulate a DB error at the MemberPoints query level
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setQueryError('MemberPoints', new Error('DB down'));

    const result = await runStreakAtRiskPushNotifications();

    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
  });
});

// ── cf-5je: category-level opt-out ────────────────────────────────────────────

describe('runStreakAtRiskPushNotifications — cf-5je category opt-out', () => {
  it('skips push when skipIfOptedOut returns true for the streak category', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', currentStreakDays: 5, lastActivityDate: YESTERDAY_ET },
    ]);
    __seed('MemberNotificationPrefs', []);
    mockSkipIfOptedOut.mockResolvedValue(true);

    const result = await runStreakAtRiskPushNotifications();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockSendPushToMember).not.toHaveBeenCalled();
    expect(mockSkipIfOptedOut).toHaveBeenCalledWith('mem-1', 'streak_milestone');
  });
});
