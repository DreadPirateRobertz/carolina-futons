/**
 * @file challengeReminderService.test.js
 * Tests for challenge reminder cadence enforcement (cf-e5h).
 *
 * Cadence gate: prevents spamming members with reminder notifications.
 * - 'daily'  cadence: max 1 reminder per 24 hours per challenge
 * - 'weekly' cadence: max 1 reminder per 7 days per challenge
 * - null notifiedAt: always eligible (never been notified)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getUpdated, __setQueryError, __setUpdateError } from './__mocks__/wix-data.js';
import {
  shouldSendChallengeReminder,
  getChallengesNeedingReminder,
  markReminderSent,
} from '../src/backend/challengeReminderService.web.js';

const NOW = new Date('2026-03-24T12:00:00Z').getTime();
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

beforeEach(() => {
  __reset();
});

// ── shouldSendChallengeReminder ───────────────────────────────────────────────

describe('shouldSendChallengeReminder — daily cadence', () => {
  it('returns true when notifiedAt is null (never notified)', () => {
    expect(shouldSendChallengeReminder(null, 'daily', NOW)).toBe(true);
  });

  it('returns true when notifiedAt is undefined', () => {
    expect(shouldSendChallengeReminder(undefined, 'daily', NOW)).toBe(true);
  });

  it('returns false when notified less than 24h ago', () => {
    const notifiedAt = new Date(NOW - 20 * MS_PER_HOUR).toISOString(); // 20h ago
    expect(shouldSendChallengeReminder(notifiedAt, 'daily', NOW)).toBe(false);
  });

  it('returns true when notified exactly 24h ago', () => {
    const notifiedAt = new Date(NOW - 24 * MS_PER_HOUR).toISOString(); // exactly 24h
    expect(shouldSendChallengeReminder(notifiedAt, 'daily', NOW)).toBe(true);
  });

  it('returns true when notified more than 24h ago', () => {
    const notifiedAt = new Date(NOW - 25 * MS_PER_HOUR).toISOString(); // 25h ago
    expect(shouldSendChallengeReminder(notifiedAt, 'daily', NOW)).toBe(true);
  });

  it('returns false when notified 1 minute ago', () => {
    const notifiedAt = new Date(NOW - 60 * 1000).toISOString();
    expect(shouldSendChallengeReminder(notifiedAt, 'daily', NOW)).toBe(false);
  });
});

describe('shouldSendChallengeReminder — weekly cadence', () => {
  it('returns true when notifiedAt is null (never notified)', () => {
    expect(shouldSendChallengeReminder(null, 'weekly', NOW)).toBe(true);
  });

  it('returns false when notified less than 7 days ago', () => {
    const notifiedAt = new Date(NOW - 6 * MS_PER_DAY).toISOString(); // 6 days ago
    expect(shouldSendChallengeReminder(notifiedAt, 'weekly', NOW)).toBe(false);
  });

  it('returns true when notified exactly 7 days ago', () => {
    const notifiedAt = new Date(NOW - 7 * MS_PER_DAY).toISOString(); // exactly 7 days
    expect(shouldSendChallengeReminder(notifiedAt, 'weekly', NOW)).toBe(true);
  });

  it('returns true when notified more than 7 days ago', () => {
    const notifiedAt = new Date(NOW - 8 * MS_PER_DAY).toISOString(); // 8 days ago
    expect(shouldSendChallengeReminder(notifiedAt, 'weekly', NOW)).toBe(true);
  });

  it('returns false when notified 2 days ago under weekly cadence', () => {
    const notifiedAt = new Date(NOW - 2 * MS_PER_DAY).toISOString();
    expect(shouldSendChallengeReminder(notifiedAt, 'weekly', NOW)).toBe(false);
  });
});

describe('shouldSendChallengeReminder — invalid inputs', () => {
  it('returns false for unknown cadence (safe default)', () => {
    expect(shouldSendChallengeReminder(null, 'hourly', NOW)).toBe(false);
    expect(shouldSendChallengeReminder(null, '', NOW)).toBe(false);
    expect(shouldSendChallengeReminder(null, null, NOW)).toBe(false);
  });

  it('returns false for malformed notifiedAt string (NaN guard)', () => {
    expect(shouldSendChallengeReminder('not-a-date', 'daily', NOW)).toBe(false);
  });

  it('uses Date.now() when nowMs not provided (smoke test)', () => {
    // null notifiedAt → always true regardless of nowMs
    expect(shouldSendChallengeReminder(null, 'daily')).toBe(true);
  });
});

// ── getChallengesNeedingReminder ──────────────────────────────────────────────

describe('getChallengesNeedingReminder', () => {
  it('returns records where progress > 0 and not yet completed', async () => {
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, targetCount: 3, completedAt: null, notifiedAt: null },
      { _id: 'mcp-2', memberId: 'mem-2', challengeId: 'ch-1', progressValue: 3, targetCount: 3, completedAt: '2026-03-20T00:00:00Z', notifiedAt: null }, // completed
      { _id: 'mcp-3', memberId: 'mem-3', challengeId: 'ch-1', progressValue: 0, targetCount: 3, completedAt: null, notifiedAt: null }, // no progress
    ]);
    const result = await getChallengesNeedingReminder('daily', NOW);
    expect(result.map(r => r._id)).toContain('mcp-1');
    expect(result.map(r => r._id)).not.toContain('mcp-2'); // completed
    expect(result.map(r => r._id)).not.toContain('mcp-3'); // no progress
  });

  it('excludes records notified within daily cadence window', async () => {
    const recentNotify = new Date(NOW - 2 * MS_PER_HOUR).toISOString(); // 2h ago
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, targetCount: 3, completedAt: null, notifiedAt: recentNotify },
      { _id: 'mcp-2', memberId: 'mem-2', challengeId: 'ch-1', progressValue: 1, targetCount: 3, completedAt: null, notifiedAt: null },
    ]);
    const result = await getChallengesNeedingReminder('daily', NOW);
    expect(result.map(r => r._id)).not.toContain('mcp-1');
    expect(result.map(r => r._id)).toContain('mcp-2');
  });

  it('includes records whose daily cadence window has elapsed', async () => {
    const oldNotify = new Date(NOW - 25 * MS_PER_HOUR).toISOString(); // 25h ago
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, targetCount: 3, completedAt: null, notifiedAt: oldNotify },
    ]);
    const result = await getChallengesNeedingReminder('daily', NOW);
    expect(result.map(r => r._id)).toContain('mcp-1');
  });

  it('returns empty array when no eligible records exist', async () => {
    // All completed
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 3, targetCount: 3, completedAt: '2026-03-20T00:00:00Z', notifiedAt: null },
    ]);
    const result = await getChallengesNeedingReminder('daily', NOW);
    expect(result).toHaveLength(0);
  });

  it('applies weekly cadence gate correctly', async () => {
    const notified5DaysAgo = new Date(NOW - 5 * MS_PER_DAY).toISOString();
    const notified8DaysAgo = new Date(NOW - 8 * MS_PER_DAY).toISOString();
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, targetCount: 5, completedAt: null, notifiedAt: notified5DaysAgo },
      { _id: 'mcp-2', memberId: 'mem-2', challengeId: 'ch-1', progressValue: 2, targetCount: 5, completedAt: null, notifiedAt: notified8DaysAgo },
    ]);
    const result = await getChallengesNeedingReminder('weekly', NOW);
    expect(result.map(r => r._id)).not.toContain('mcp-1'); // 5 days < 7 day gate
    expect(result.map(r => r._id)).toContain('mcp-2');    // 8 days ≥ 7 day gate
  });
});

// ── markReminderSent ──────────────────────────────────────────────────────────

describe('markReminderSent', () => {
  it('updates notifiedAt on the MemberChallengeProgress record', async () => {
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, targetCount: 3, completedAt: null, notifiedAt: null },
    ]);
    await markReminderSent('mcp-1', NOW);
    const updated = __getUpdated('MemberChallengeProgress');
    expect(updated).toHaveLength(1);
    expect(updated[0].notifiedAt).toBe(new Date(NOW).toISOString());
    expect(updated[0]._id).toBe('mcp-1');
  });

  it('preserves all other fields when updating notifiedAt', async () => {
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-2', progressValue: 4, targetCount: 5, completedAt: null, notifiedAt: null },
    ]);
    await markReminderSent('mcp-1', NOW);
    const updated = __getUpdated('MemberChallengeProgress')[0];
    expect(updated.memberId).toBe('mem-1');
    expect(updated.challengeId).toBe('ch-2');
    expect(updated.progressValue).toBe(4);
  });

  it('returns the updated record', async () => {
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 1, targetCount: 3, completedAt: null, notifiedAt: null },
    ]);
    const result = await markReminderSent('mcp-1', NOW);
    expect(result.notifiedAt).toBe(new Date(NOW).toISOString());
  });

  it('returns null when record does not exist', async () => {
    // No seed — record not found
    const result = await markReminderSent('nonexistent-id', NOW);
    expect(result).toBeNull();
  });

  it('throws when wixData.update fails (distinguishable from not-found null)', async () => {
    __seed('MemberChallengeProgress', [
      { _id: 'mcp-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, targetCount: 3, completedAt: null, notifiedAt: null },
    ]);
    __setUpdateError('MemberChallengeProgress', new Error('DB write failed'));
    await expect(markReminderSent('mcp-1', NOW)).rejects.toThrow('DB write failed');
  });
});

// ── getChallengesNeedingReminder — error handling ─────────────────────────────

describe('getChallengesNeedingReminder — error handling', () => {
  it('returns empty array on DB query error', async () => {
    __setQueryError('MemberChallengeProgress', new Error('DB down'));
    const result = await getChallengesNeedingReminder('daily', NOW);
    expect(result).toEqual([]);
  });

  it('returns empty array when collection is empty', async () => {
    // __reset() clears all seeds — empty collection
    const result = await getChallengesNeedingReminder('daily', NOW);
    expect(result).toEqual([]);
  });
});
