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

/**
 * Notify opted-in members about a new weekly challenge via email + SMS.
 * Called when a new challenge is published (admin action or automation).
 *
 * - Email: uses triggered email template `challenge_new_weekly`
 * - SMS: sends to members with SMS enabled in SMSPreferences
 * - Only notifies members with `questAlerts: true` in MemberNotificationPrefs
 *
 * CF-qhdo
 *
 * @param {Object} challenge
 * @param {string} challenge.title - Challenge title
 * @param {string} [challenge.description] - Challenge description
 * @param {number} challenge.rewardPoints - Points reward for completion
 * @param {string} [challenge.rewardBadgeLabel] - Badge label (if any)
 * @param {string} [challenge.expiresAt] - ISO date string
 * @returns {Promise<{ success: boolean, emailsSent: number, smsSent: number }>}
 */
export const notifyChallengePublished = webMethod(
  Permissions.Admin,
  async (challenge) => {
    if (!challenge?.title) {
      logError('notifyChallengePublished — missing challenge title');
      return { success: false, emailsSent: 0, smsSent: 0 };
    }

    try {
      // 1. Find all members with questAlerts enabled
      const prefsResult = await wixData
        .query(MEMBER_NOTIFICATION_PREFS_COLLECTION)
        .eq('questAlerts', true)
        .limit(1000)
        .find({ suppressAuth: true });

      if (prefsResult.items.length === 0) {
        return { success: true, emailsSent: 0, smsSent: 0 };
      }

      const memberIds = prefsResult.items
        .map(p => p.memberId)
        .filter(Boolean);

      const rewardText = challenge.rewardBadgeLabel
        ? `${challenge.rewardPoints} pts + ${challenge.rewardBadgeLabel} badge`
        : `${challenge.rewardPoints} pts`;

      const challengeUrl = `${SITE_URL}/account/my-account#challenges`;

      // 2. Send emails via triggeredEmails.emailMember (best-effort per member)
      let emailsSent = 0;
      const { triggeredEmails } = await import('wix-crm-backend');

      for (const memberId of memberIds) {
        try {
          await triggeredEmails.emailMember(
            'challenge_new_weekly',
            memberId,
            {
              variables: {
                challengeTitle: challenge.title,
                challengeDescription: challenge.description || '',
                rewardText,
                challengeUrl,
                expiresAt: challenge.expiresAt || '',
              },
            }
          );
          emailsSent++;
        } catch (err) {
          logError(`notifyChallengePublished — email failed for ${memberId}`, err);
        }
      }

      // 3. Send SMS to opted-in members via smsService (best-effort)
      let smsSent = 0;
      const { sendChallengeAlertSMS } = await import('backend/smsService.web');

      const smsBody = `Carolina Futons Challenge: "${challenge.title}" — complete it to earn ${rewardText}! Details: ${challengeUrl}`;

      for (const memberId of memberIds) {
        try {
          const result = await sendChallengeAlertSMS({ memberId, message: smsBody });
          if (result.success) smsSent++;
        } catch (err) {
          logError(`notifyChallengePublished — SMS failed for ${memberId}`, err);
        }
      }

      return { success: true, emailsSent, smsSent };
    } catch (err) {
      logError('notifyChallengePublished — pipeline failed', err);
      return { success: false, emailsSent: 0, smsSent: 0 };
    }
  }
);

// ── CF-tcqq: Day 7 streak milestone notification ─────────────────────────────

// 7 days is the first streak milestone in the Carolina Futons loyalty programme.
// Business rule: members who maintain a 7-day login/engagement streak earn 2× points
// the following day. Day 7 is the only automated notification checkpoint; longer streaks
// are recognised via tier upgrades, not additional cron emails. (CF-tcqq product spec)
const STREAK_MILESTONE_DAY = 7;
const STREAK_NOTIFICATIONS_COLLECTION = 'StreakMilestoneNotifications';

/**
 * Check for members at day-7 streak and send milestone notification.
 * Called by daily cron. Idempotent — dedup record inserted per member per milestone
 * prevents re-sending across runs.
 *
 * Opt-out model: defaults to sending unless the member has explicitly set
 * `streakReminders: false` in MemberNotificationPrefs (missing prefs = opted in).
 *
 * CF-tcqq
 *
 * @returns {Promise<{ sent: number, skipped: number, errors: number }>}
 *   sent    — emails dispatched this run
 *   skipped — members already notified or opted out
 *   errors  — per-member failures (pipeline continues)
 */
export async function checkStreakMilestoneNotifications() {
  const result = { sent: 0, skipped: 0, errors: 0 };

  try {
    // Find members at exactly day 7 streak
    // limit(1000): Wix CMS query cap is 1000 items per call. We expect well under
    // 1000 members to hit day 7 on any given day — this is a safe ceiling.
    const streakResult = await wixData
      .query('MemberPoints')
      .eq('currentStreakDays', STREAK_MILESTONE_DAY)
      .limit(1000)
      .find({ suppressAuth: true });

    if (streakResult.items.length === 0) return result;

    const memberIds = streakResult.items.map(r => r.memberId).filter(Boolean);

    // Check which members already received this notification
    const sentResult = await wixData
      .query(STREAK_NOTIFICATIONS_COLLECTION)
      .hasSome('memberId', memberIds)
      .eq('milestone', STREAK_MILESTONE_DAY)
      .limit(1000)
      .find({ suppressAuth: true });

    const alreadySent = new Set(sentResult.items.map(r => r.memberId));

    // Check notification prefs — only send to members with streakReminders enabled
    const prefsResult = await wixData
      .query(MEMBER_NOTIFICATION_PREFS_COLLECTION)
      .hasSome('memberId', memberIds)
      .limit(1000)
      .find({ suppressAuth: true });

    const prefsMap = Object.fromEntries(
      prefsResult.items.map(p => [p.memberId, p])
    );

    const { triggeredEmails } = await import('wix-crm-backend');

    for (const memberId of memberIds) {
      if (alreadySent.has(memberId)) {
        result.skipped++;
        continue;
      }

      // Default to true if no prefs record (opt-out model)
      const prefs = prefsMap[memberId];
      // Strict === false (not falsy): undefined/null/missing prefs = opted IN by default.
      // Only an explicit boolean false opts the member out. This preserves the
      // "send unless told not to" contract without penalising members who have never
      // set preferences. Using falsy (!prefs.streakReminders) would incorrectly block
      // members with no prefs record.
      if (prefs && prefs.streakReminders === false) {
        result.skipped++;
        continue;
      }

      try {
        await triggeredEmails.emailMember(
          'streak_milestone_day7',
          memberId,
          {
            variables: {
              streakDays: String(STREAK_MILESTONE_DAY),
              message: `You're on a ${STREAK_MILESTONE_DAY}-day streak! Come back tomorrow to keep it going and earn 2x points.`,
            },
          }
        );

        // Record notification to prevent duplicates
        await wixData.insert(STREAK_NOTIFICATIONS_COLLECTION, {
          memberId,
          milestone: STREAK_MILESTONE_DAY,
          sentAt: new Date().toISOString(),
        }, { suppressAuth: true });

        result.sent++;
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
