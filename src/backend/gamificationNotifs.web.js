/**
 * @module gamificationNotifs.web
 * @description Member notification preferences webMethods.
 * Split from gamificationEventReceiver.web.js for maintainability (CF-jz4r).
 *
 * Exported webMethods:
 *   getNotificationPrefs() — returns prefs for authenticated caller
 *   updateNotificationPrefs(prefs) — updates prefs for authenticated caller
 *
 * CF-rpsx, CF-jz4r
 */

import { Permissions, webMethod } from 'wix-web-module';
import { logError } from 'backend/utils/errorHandler';
import wixData from 'wix-data';

const MEMBER_NOTIFICATION_PREFS_COLLECTION = 'MemberNotificationPrefs';

const DEFAULT_PREFS = {
  streakReminders: true,
  questAlerts: true,
  tierUpdates: true,
  promotionalEmails: false,
  weeklyDigest: true,
};

const PREF_KEYS = Object.keys(DEFAULT_PREFS);

/**
 * Returns notification preferences for a member.
 * Creates a default record if none exists. Returns { error } on failure.
 *
 * CF-rpsx
 *
 * @returns {Promise<{ streakReminders: boolean, questAlerts: boolean, tierUpdates: boolean,
 *   promotionalEmails: boolean, weeklyDigest: boolean } | { error: string }>}
 */
export const getNotificationPrefs = webMethod(
  Permissions.SiteMember,
  async () => {
    let memberId;
    try {
      const { currentMember } = await import('wix-members-backend');
      const caller = await currentMember.getMember();
      memberId = caller?._id;
    } catch (_) { /* auth unavailable */ }

    if (!memberId) {
      logError('getNotificationPrefs — could not resolve caller identity');
      return { error: 'auth_required' };
    }

    try {
      const result = await wixData
        .query(MEMBER_NOTIFICATION_PREFS_COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      if (result.items.length > 0) {
        const record = result.items[0];
        const prefs = {};
        for (const key of PREF_KEYS) {
          prefs[key] = record[key] ?? DEFAULT_PREFS[key];
        }
        return prefs;
      }

      // No record — insert defaults
      await wixData.insert(MEMBER_NOTIFICATION_PREFS_COLLECTION, {
        memberId,
        ...DEFAULT_PREFS,
      }, { suppressAuth: true });

      return { ...DEFAULT_PREFS };
    } catch (err) {
      logError(`getNotificationPrefs — failed for member ${memberId}`, err);
      return { error: 'service_unavailable' };
    }
  }
);

/**
 * Update notification preferences for a member.
 * Only updates known pref keys, ignoring unknown fields.
 * Returns { success: true } or { error }.
 *
 * CF-rpsx
 *
 * @param {Object} prefs — partial or full prefs object
 * @returns {Promise<{ success: boolean } | { error: string }>}
 */
export const updateNotificationPrefs = webMethod(
  Permissions.SiteMember,
  async (prefs) => {
    let memberId;
    try {
      const { currentMember } = await import('wix-members-backend');
      const caller = await currentMember.getMember();
      memberId = caller?._id;
    } catch (_) { /* auth unavailable */ }

    if (!memberId) {
      logError('updateNotificationPrefs — could not resolve caller identity');
      return { error: 'auth_required' };
    }
    if (!prefs || typeof prefs !== 'object') {
      return { error: 'invalid_prefs' };
    }

    try {
      const updates = {};
      for (const key of PREF_KEYS) {
        if (key in prefs) updates[key] = !!prefs[key];
      }
      if (Object.keys(updates).length === 0) return { success: true };

      const result = await wixData
        .query(MEMBER_NOTIFICATION_PREFS_COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      if (result.items.length > 0) {
        const record = result.items[0];
        await wixData.update(MEMBER_NOTIFICATION_PREFS_COLLECTION, {
          ...record,
          ...updates,
        }, { suppressAuth: true });
      } else {
        await wixData.insert(MEMBER_NOTIFICATION_PREFS_COLLECTION, {
          memberId,
          ...DEFAULT_PREFS,
          ...updates,
        }, { suppressAuth: true });
      }

      return { success: true };
    } catch (err) {
      logError(`updateNotificationPrefs — failed for member ${memberId}`, err);
      return { error: 'service_unavailable' };
    }
  }
);
