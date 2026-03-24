/**
 * @module memberGamePreferences.web
 * @description Unified gamification preference layer.
 *
 * Exports:
 *   getMemberGamePreferences()       — webMethod (SiteMember): returns current member's prefs or defaults
 *   getGamePrefsForMember(memberId)  — backend helper: returns prefs for any memberId (suppressAuth)
 *   DEFAULT_GAME_PREFS               — canonical defaults object
 *
 * Collection: MemberGamificationPreferences
 *   memberId (Text, indexed), notificationsEnabled (Bool), leaderboardOptIn (Bool),
 *   spinWheelVisible (Bool), challengeReminders (Text: daily|weekly|never),
 *   friendChallengesEnabled (Bool), lastModified (Date)
 *
 * CF-thb
 */

import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import wixData from 'wix-data';

const COLLECTION = 'MemberGamificationPreferences';

/** Canonical defaults — privacy-first where relevant. */
export const DEFAULT_GAME_PREFS = {
  notificationsEnabled: true,
  leaderboardOptIn: false,   // privacy-default: must opt in to appear on leaderboard
  spinWheelVisible: true,
  challengeReminders: 'daily',
  friendChallengesEnabled: true,
};

/**
 * Merge a raw CMS record with defaults, stripping internal wix-data fields.
 * @param {string} memberId
 * @param {object|null} record
 * @returns {object}
 */
function buildPrefs(memberId, record) {
  const base = { ...DEFAULT_GAME_PREFS, memberId };
  if (!record) return base;

  const { notificationsEnabled, leaderboardOptIn, spinWheelVisible, challengeReminders, friendChallengesEnabled } = record;

  return {
    memberId,
    notificationsEnabled: notificationsEnabled !== undefined ? notificationsEnabled : DEFAULT_GAME_PREFS.notificationsEnabled,
    leaderboardOptIn:      leaderboardOptIn      !== undefined ? leaderboardOptIn      : DEFAULT_GAME_PREFS.leaderboardOptIn,
    spinWheelVisible:      spinWheelVisible      !== undefined ? spinWheelVisible      : DEFAULT_GAME_PREFS.spinWheelVisible,
    challengeReminders:    challengeReminders    !== undefined ? challengeReminders    : DEFAULT_GAME_PREFS.challengeReminders,
    friendChallengesEnabled: friendChallengesEnabled !== undefined ? friendChallengesEnabled : DEFAULT_GAME_PREFS.friendChallengesEnabled,
  };
}

/**
 * Return the current member's gamification preferences, or defaults if no record exists.
 *
 * @returns {Promise<object|{status: 401, error: string}>}
 * @permission SiteMember
 */
export const getMemberGamePreferences = webMethod(
  Permissions.SiteMember,
  async () => {
    let member;
    try {
      member = await currentMember.getMember();
    } catch {
      return { status: 401, error: 'Unauthenticated' };
    }
    if (!member?._id) return { status: 401, error: 'Unauthenticated' };

    const memberId = member._id;
    try {
      const res = await wixData
        .query(COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      return buildPrefs(memberId, res.items?.[0] ?? null);
    } catch {
      return buildPrefs(memberId, null);
    }
  },
);

/**
 * Backend helper — returns gamification prefs for any memberId without auth.
 * Returns defaults when no record exists or memberId is null/undefined.
 *
 * @param {string|null|undefined} memberId
 * @returns {Promise<object>}
 */
export async function getGamePrefsForMember(memberId) {
  if (!memberId) return { ...DEFAULT_GAME_PREFS, memberId: null };

  try {
    const res = await wixData
      .query(COLLECTION)
      .eq('memberId', memberId)
      .limit(1)
      .find({ suppressAuth: true });

    return buildPrefs(memberId, res.items?.[0] ?? null);
  } catch {
    return { ...DEFAULT_GAME_PREFS, memberId };
  }
}
