/**
 * @module gamificationNotifs.web
 * @description Member notification preferences + challenge notification pipeline.
 * Split from gamificationEventReceiver.web.js for maintainability (CF-jz4r).
 *
 * Exported webMethods:
 *   getNotificationPrefs() — returns prefs for authenticated caller
 *   updateNotificationPrefs(prefs) — updates prefs for authenticated caller
 *   notifyChallengePublished(challenge) — send email + SMS to opted-in members (CF-qhdo)
 *
 *   checkStreakMilestoneNotifications() — cron: day-7 streak milestone email (CF-tcqq)
 *
 * CF-rpsx, CF-jz4r, CF-qhdo, CF-tcqq
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

// ── CF-qhdo: Challenge notification pipeline ──────────────────────────────────

const SITE_URL = 'https://www.carolinafutons.com';

const SMS_QUEUE_COLLECTION = 'SMSQueue';

/**
 * Collect all items from a paginated wix-data query.
 * Follows cursors until exhausted so callers are not silently capped at 1 000.
 *
 * @param {import('wix-data').WixDataQuery} query - pre-built query (do NOT call .find())
 * @returns {Promise<Array>}
 */
async function queryAll(query) {
  const items = [];
  let result = await query.limit(1000).find({ suppressAuth: true });
  items.push(...result.items);
  while (result.hasNext()) {
    result = await result.next();
    items.push(...result.items);
  }
  return items;
}

/**
 * Notify opted-in members about a new weekly challenge via email + SMS.
 * Fans out to EmailQueue and SMSQueue for processing by cron — does NOT send
 * inline (avoids Wix 14s serverless timeout on large member lists).  GH#991
 *
 * CF-qhdo, GH#991
 *
 * @param {Object} challenge
 * @param {string} challenge.title - Challenge title
 * @param {string} [challenge.description] - Challenge description
 * @param {number} challenge.rewardPoints - Points reward for completion
 * @param {string} [challenge.rewardBadgeLabel] - Badge label (if any)
 * @param {string} [challenge.expiresAt] - ISO date string
 * @returns {Promise<{ success: boolean, queued: number }>}
 */
export const notifyChallengePublished = webMethod(
  Permissions.Admin,
  async (challenge) => {
    if (!challenge?.title) {
      logError('notifyChallengePublished — missing challenge title');
      return { success: false, queued: 0 };
    }

    try {
      // 1. Find all members with questAlerts enabled (paginated)
      const prefsItems = await queryAll(
        wixData.query(MEMBER_NOTIFICATION_PREFS_COLLECTION).eq('questAlerts', true)
      );

      if (prefsItems.length === 0) {
        return { success: true, queued: 0 };
      }

      const memberIds = prefsItems.map(p => p.memberId).filter(Boolean);

      const rewardText = challenge.rewardBadgeLabel
        ? `${challenge.rewardPoints} pts + ${challenge.rewardBadgeLabel} badge`
        : `${challenge.rewardPoints} pts`;

      const challengeUrl = `${SITE_URL}/account/my-account#challenges`;
      const smsBody = `Carolina Futons Challenge: "${challenge.title}" — complete it to earn ${rewardText}! Details: ${challengeUrl}`;
      const variables = JSON.stringify({
        challengeTitle: challenge.title,
        challengeDescription: challenge.description || '',
        rewardText,
        challengeUrl,
        expiresAt: challenge.expiresAt || '',
      });
      const now = new Date();

      // 2. Fan out: insert EmailQueue + SMSQueue records (fast DB writes, not API calls)
      await Promise.all([
        ...memberIds.map(memberId =>
          wixData.insert('EmailQueue', {
            templateId: 'challenge_new_weekly',
            recipientContactId: memberId,
            variables,
            sequenceType: 'challenge_notif',
            sequenceStep: 1,
            status: 'pending',
            scheduledFor: now,
            attempt: 0,
            createdAt: now,
          }, { suppressAuth: true })
        ),
        ...memberIds.map(memberId =>
          wixData.insert(SMS_QUEUE_COLLECTION, {
            memberId,
            message: smsBody,
            messageType: 'challenge_alert',
            status: 'pending',
            scheduledFor: now,
            attempt: 0,
            createdAt: now,
          }, { suppressAuth: true })
        ),
      ]);

      return { success: true, queued: memberIds.length };
    } catch (err) {
      logError('notifyChallengePublished — pipeline failed', err);
      return { success: false, queued: 0 };
    }
  }
);

/**
 * Process pending challenge-alert SMS queue items in batches.
 * Picks up SMSQueue records with messageType 'challenge_alert' and dispatches
 * via smsService.  Called by processChallengeNotifSMSQueue cron (every 15 min).
 *
 * GH#991
 *
 * @returns {Promise<{ processed: number, failed: number }>}
 */
export const processChallengeNotifSMSQueue = webMethod(
  Permissions.Admin,
  async () => {
    const result = { processed: 0, failed: 0 };

    try {
      const { items } = await wixData
        .query(SMS_QUEUE_COLLECTION)
        .eq('status', 'pending')
        .eq('messageType', 'challenge_alert')
        .limit(50)
        .find({ suppressAuth: true });

      if (items.length === 0) return result;

      const { sendChallengeAlertSMS } = await import('backend/smsService.web');

      for (const item of items) {
        try {
          const res = await sendChallengeAlertSMS({ memberId: item.memberId, message: item.message });
          await wixData.update(SMS_QUEUE_COLLECTION, {
            ...item,
            status: res.success ? 'sent' : 'failed',
            attempt: (item.attempt || 0) + 1,
          }, { suppressAuth: true });
          if (res.success) result.processed++;
          else result.failed++;
        } catch (err) {
          logError(`processChallengeNotifSMSQueue — failed for ${item.memberId}`, err);
          result.failed++;
        }
      }
    } catch (err) {
      logError('processChallengeNotifSMSQueue — query failed', err);
    }

    return result;
  }
);

// ── CF-tcqq: Day 7 streak milestone notification ─────────────────────────────

const STREAK_MILESTONE_DAY = 7;
const STREAK_NOTIFICATIONS_COLLECTION = 'StreakMilestoneNotifications';

/**
 * Check for members at day-7 streak and queue milestone notification.
 * Called by daily cron. Idempotent — tracks sent notifications to prevent duplicates.
 * Inserts to EmailQueue instead of sending inline (avoids 14s timeout).  GH#991
 * All three queries use cursor pagination via queryAll().               GH#991
 *
 * Only notifies members with `streakReminders: true` in MemberNotificationPrefs.
 *
 * CF-tcqq, GH#991
 *
 * @returns {Promise<{ queued: number, skipped: number, errors: number }>}
 */
export async function checkStreakMilestoneNotifications() {
  const result = { queued: 0, skipped: 0, errors: 0 };

  try {
    // Find members at exactly day 7 streak (paginated)
    const streakItems = await queryAll(
      wixData.query('MemberPoints').eq('currentStreakDays', STREAK_MILESTONE_DAY)
    );

    if (streakItems.length === 0) return result;

    const memberIds = streakItems.map(r => r.memberId).filter(Boolean);

    // Check which members already received this notification (paginated)
    const sentItems = await queryAll(
      wixData.query(STREAK_NOTIFICATIONS_COLLECTION)
        .hasSome('memberId', memberIds)
        .eq('milestone', STREAK_MILESTONE_DAY)
    );
    const alreadySent = new Set(sentItems.map(r => r.memberId));

    // Check notification prefs (paginated)
    const prefsItems = await queryAll(
      wixData.query(MEMBER_NOTIFICATION_PREFS_COLLECTION)
        .hasSome('memberId', memberIds)
    );
    const prefsMap = Object.fromEntries(
      prefsItems.map(p => [p.memberId, p])
    );

    for (const memberId of memberIds) {
      if (alreadySent.has(memberId)) {
        result.skipped++;
        continue;
      }

      // Default to true if no prefs record (opt-out model)
      const prefs = prefsMap[memberId];
      if (prefs && prefs.streakReminders === false) {
        result.skipped++;
        continue;
      }

      try {
        // Queue email for processing by processEmailQueue cron
        await wixData.insert('EmailQueue', {
          templateId: 'streak_milestone_day7',
          recipientContactId: memberId,
          variables: JSON.stringify({
            streakDays: String(STREAK_MILESTONE_DAY),
            message: `You're on a ${STREAK_MILESTONE_DAY}-day streak! Come back tomorrow to keep it going and earn 2x points.`,
          }),
          sequenceType: 'streak_milestone',
          sequenceStep: 1,
          status: 'pending',
          scheduledFor: new Date(),
          attempt: 0,
          createdAt: new Date(),
        }, { suppressAuth: true });

        // Record notification to prevent duplicates
        await wixData.insert(STREAK_NOTIFICATIONS_COLLECTION, {
          memberId,
          milestone: STREAK_MILESTONE_DAY,
          sentAt: new Date().toISOString(),
        }, { suppressAuth: true });

        result.queued++;
      } catch (err) {
        logError(`checkStreakMilestoneNotifications — failed for ${memberId}`, err);
        result.errors++;
      }
    }

    return result;
  } catch (err) {
    logError('checkStreakMilestoneNotifications — pipeline failed', err);
    return result;
  }
}
