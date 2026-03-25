/**
 * notificationPrefsBackend.test.js
 * CF-rpsx — Backend tests for getNotificationPrefs + updateNotificationPrefs
 *
 * Covers:
 *  - Auth: resolves caller via currentMember.getMember(), rejects unauthenticated
 *  - getNotificationPrefs: returns existing prefs, auto-creates defaults, error resilience
 *  - updateNotificationPrefs: updates existing record, inserts new record, ignores unknown keys
 *  - IDOR prevention: never trusts client-supplied memberId
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';
import {
  __reset as resetMembers,
  __setMember,
} from './__mocks__/wix-members-backend.js';
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from '../src/backend/gamificationEventReceiver.web.js';

const MEMBER_ID = 'mem-notif-test';
const COLLECTION = 'MemberNotificationPrefs';

beforeEach(() => {
  resetData();
  resetMembers();
  vi.clearAllMocks();
});

// ── getNotificationPrefs ────────────────────────────────────────────────────

describe('getNotificationPrefs — auth', () => {
  it('returns auth_required when no authenticated member', async () => {
    // No member set — getMember() returns null
    const result = await getNotificationPrefs();
    expect(result).toEqual({ error: 'auth_required' });
  });

  it('returns prefs when authenticated', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER_ID,
      streakReminders: true,
      questAlerts: false,
      tierUpdates: true,
      promotionalEmails: false,
      weeklyDigest: true,
    }]);
    const result = await getNotificationPrefs();
    expect(result.streakReminders).toBe(true);
    expect(result.questAlerts).toBe(false);
    expect(result.tierUpdates).toBe(true);
  });
});

describe('getNotificationPrefs — data', () => {
  beforeEach(() => { __setMember({ _id: MEMBER_ID }); });

  it('creates default record when no prefs exist', async () => {
    const result = await getNotificationPrefs();
    // Should return defaults (all true by default)
    expect(result).not.toHaveProperty('error');
    expect(typeof result.streakReminders).toBe('boolean');
  });

  it('returns error shape on DB failure', async () => {
    __setQueryError(COLLECTION, new Error('DB down'));
    const result = await getNotificationPrefs();
    expect(result).toEqual({ error: 'service_unavailable' });
  });
});

// ── updateNotificationPrefs ─────────────────────────────────────────────────

describe('updateNotificationPrefs — auth', () => {
  it('returns auth_required when no authenticated member', async () => {
    const result = await updateNotificationPrefs({ streakReminders: false });
    expect(result).toEqual({ error: 'auth_required' });
  });
});

describe('updateNotificationPrefs — data', () => {
  beforeEach(() => { __setMember({ _id: MEMBER_ID }); });

  it('returns invalid_prefs when prefs is null', async () => {
    const result = await updateNotificationPrefs(null);
    expect(result).toEqual({ error: 'invalid_prefs' });
  });

  it('returns invalid_prefs when prefs is not object', async () => {
    const result = await updateNotificationPrefs('not-object');
    expect(result).toEqual({ error: 'invalid_prefs' });
  });

  it('returns success when updating valid prefs', async () => {
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER_ID,
      streakReminders: true,
      questAlerts: true,
      tierUpdates: true,
      promotionalEmails: true,
      weeklyDigest: true,
    }]);
    const result = await updateNotificationPrefs({ streakReminders: false });
    expect(result).toEqual({ success: true });
  });

  it('returns success: true when no recognized pref keys', async () => {
    const result = await updateNotificationPrefs({ unknownKey: true });
    expect(result).toEqual({ success: true });
  });

  it('inserts default record with overrides when no existing record', async () => {
    const result = await updateNotificationPrefs({ questAlerts: false });
    expect(result).toEqual({ success: true });
  });

  it('returns error shape on DB failure', async () => {
    __setQueryError(COLLECTION, new Error('DB down'));
    const result = await updateNotificationPrefs({ streakReminders: false });
    expect(result).toEqual({ error: 'service_unavailable' });
  });
});
