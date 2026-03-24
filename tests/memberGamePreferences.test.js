/**
 * @file memberGamePreferences.test.js
 * @description TDD tests for CF-thb: MemberGamificationPreferences webMethod and helper.
 *
 * Covers:
 *  - getMemberGamePreferences: 401 (no member), returns stored prefs, returns defaults if no record,
 *    merges defaults for missing fields
 *  - getGamePrefsForMember: helper (no auth), returns stored prefs, returns defaults if no record
 *
 * CF-thb
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import {
  getMemberGamePreferences,
  getGamePrefsForMember,
  DEFAULT_GAME_PREFS,
} from '../src/backend/memberGamePreferences.web.js';

const COLLECTION = 'MemberGamificationPreferences';

beforeEach(() => {
  resetData();
  resetMembers();
});

// ── DEFAULT_GAME_PREFS ────────────────────────────────────────────────────────

describe('DEFAULT_GAME_PREFS', () => {
  it('notificationsEnabled defaults to true', () => {
    expect(DEFAULT_GAME_PREFS.notificationsEnabled).toBe(true);
  });

  it('leaderboardOptIn defaults to false (privacy-first)', () => {
    expect(DEFAULT_GAME_PREFS.leaderboardOptIn).toBe(false);
  });

  it('spinWheelVisible defaults to true', () => {
    expect(DEFAULT_GAME_PREFS.spinWheelVisible).toBe(true);
  });

  it('challengeReminders defaults to daily', () => {
    expect(DEFAULT_GAME_PREFS.challengeReminders).toBe('daily');
  });

  it('friendChallengesEnabled defaults to true', () => {
    expect(DEFAULT_GAME_PREFS.friendChallengesEnabled).toBe(true);
  });
});

// ── getMemberGamePreferences ──────────────────────────────────────────────────

describe('getMemberGamePreferences', () => {
  it('returns 401 when no member is authenticated', async () => {
    // __setMember not called — _currentMember is null
    const result = await getMemberGamePreferences();
    expect(result.status).toBe(401);
  });

  it('returns 401 when member has no _id', async () => {
    __setMember({});
    const result = await getMemberGamePreferences();
    expect(result.status).toBe(401);
  });

  it('returns defaults when member has no preferences record', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await getMemberGamePreferences();
    expect(result.notificationsEnabled).toBe(true);
    expect(result.leaderboardOptIn).toBe(false);
    expect(result.spinWheelVisible).toBe(true);
    expect(result.challengeReminders).toBe('daily');
    expect(result.friendChallengesEnabled).toBe(true);
  });

  it('returns memberId on default result', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await getMemberGamePreferences();
    expect(result.memberId).toBe('mem-1');
  });

  it('returns stored prefs when record exists', async () => {
    __setMember({ _id: 'mem-2' });
    __seed(COLLECTION, [{
      _id: 'pref-1',
      memberId: 'mem-2',
      notificationsEnabled: false,
      leaderboardOptIn: true,
      spinWheelVisible: false,
      challengeReminders: 'weekly',
      friendChallengesEnabled: false,
    }]);
    const result = await getMemberGamePreferences();
    expect(result.notificationsEnabled).toBe(false);
    expect(result.leaderboardOptIn).toBe(true);
    expect(result.spinWheelVisible).toBe(false);
    expect(result.challengeReminders).toBe('weekly');
    expect(result.friendChallengesEnabled).toBe(false);
    expect(result.memberId).toBe('mem-2');
  });

  it('fills missing fields with defaults when stored record is partial', async () => {
    __setMember({ _id: 'mem-3' });
    __seed(COLLECTION, [{
      _id: 'pref-2',
      memberId: 'mem-3',
      spinWheelVisible: false,
      // notificationsEnabled, leaderboardOptIn, challengeReminders, friendChallengesEnabled missing
    }]);
    const result = await getMemberGamePreferences();
    expect(result.spinWheelVisible).toBe(false);
    expect(result.notificationsEnabled).toBe(true);   // default
    expect(result.leaderboardOptIn).toBe(false);      // default
    expect(result.challengeReminders).toBe('daily');  // default
    expect(result.friendChallengesEnabled).toBe(true);// default
  });

  it('does not include wix-data internal fields (_id, _createdDate)', async () => {
    __setMember({ _id: 'mem-1' });
    __seed(COLLECTION, [{
      _id: 'pref-3', memberId: 'mem-1',
      notificationsEnabled: true, leaderboardOptIn: false,
      spinWheelVisible: true, challengeReminders: 'daily', friendChallengesEnabled: true,
    }]);
    const result = await getMemberGamePreferences();
    expect(result._id).toBeUndefined();
    expect(result._createdDate).toBeUndefined();
  });
});

// ── getGamePrefsForMember ─────────────────────────────────────────────────────

describe('getGamePrefsForMember', () => {
  it('returns defaults when no record exists for memberId', async () => {
    const result = await getGamePrefsForMember('mem-unknown');
    expect(result.notificationsEnabled).toBe(true);
    expect(result.leaderboardOptIn).toBe(false);
    expect(result.spinWheelVisible).toBe(true);
    expect(result.challengeReminders).toBe('daily');
    expect(result.friendChallengesEnabled).toBe(true);
  });

  it('returns stored prefs for the specified memberId', async () => {
    __seed(COLLECTION, [{
      _id: 'pref-10',
      memberId: 'mem-5',
      notificationsEnabled: false,
      leaderboardOptIn: true,
      spinWheelVisible: true,
      challengeReminders: 'never',
      friendChallengesEnabled: true,
    }]);
    const result = await getGamePrefsForMember('mem-5');
    expect(result.notificationsEnabled).toBe(false);
    expect(result.leaderboardOptIn).toBe(true);
    expect(result.challengeReminders).toBe('never');
  });

  it('does not return prefs for a different memberId', async () => {
    __seed(COLLECTION, [{
      _id: 'pref-11', memberId: 'mem-5',
      notificationsEnabled: false, leaderboardOptIn: true,
      spinWheelVisible: false, challengeReminders: 'never', friendChallengesEnabled: false,
    }]);
    const result = await getGamePrefsForMember('mem-6');
    // mem-6 has no record → defaults
    expect(result.notificationsEnabled).toBe(true);
    expect(result.leaderboardOptIn).toBe(false);
    expect(result.spinWheelVisible).toBe(true);
  });

  it('uses suppressAuth: true so it works in backend helper context', async () => {
    // No errors thrown when called from non-member context (no currentMember)
    await expect(getGamePrefsForMember('any-member-id')).resolves.toBeDefined();
  });

  it('returns defaults when memberId is null', async () => {
    const result = await getGamePrefsForMember(null);
    expect(result.notificationsEnabled).toBe(true);
    expect(result.leaderboardOptIn).toBe(false);
  });
});
