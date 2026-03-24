/**
 * challengeReminderService.web.js — Challenge reminder cadence enforcement.
 *
 * Provides a daily/weekly gate that prevents members from being spammed with
 * challenge reminder notifications. The gate is enforced via the notifiedAt
 * field on MemberChallengeProgress records.
 *
 * cf-e5h (CF-p5v2)
 */

import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

const CHALLENGE_PROGRESS_COLLECTION = 'MemberChallengeProgress';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CADENCE_MS = {
  daily: MS_PER_DAY,
  weekly: 7 * MS_PER_DAY,
};

/**
 * Returns true if a challenge reminder should be sent based on cadence gate.
 *
 * @param {string|null|undefined} notifiedAt  ISO string of last notification, or null/undefined
 * @param {'daily'|'weekly'} cadence
 * @param {number} [nowMs]  Current time in ms (defaults to Date.now())
 * @returns {boolean}
 */
export function shouldSendChallengeReminder(notifiedAt, cadence, nowMs) {
  const windowMs = CADENCE_MS[cadence];
  if (!windowMs) return false; // unknown cadence — safe default

  if (!notifiedAt) return true; // never notified

  const lastMs = new Date(notifiedAt).getTime();
  if (isNaN(lastMs)) return false; // malformed date — safe default

  const now = nowMs !== undefined ? nowMs : Date.now();
  return (now - lastMs) >= windowMs;
}

/**
 * Returns MemberChallengeProgress records that are eligible for a reminder:
 * - progressValue > 0 (some progress made)
 * - completedAt is null (not yet completed)
 * - cadence gate has elapsed since last notification
 *
 * @param {'daily'|'weekly'} cadence
 * @param {number} [nowMs]  Current time in ms (defaults to Date.now())
 * @returns {Promise<Array>}
 */
export async function getChallengesNeedingReminder(cadence, nowMs) {
  const now = nowMs !== undefined ? nowMs : Date.now();
  try {
    const result = await wixData
      .query(CHALLENGE_PROGRESS_COLLECTION)
      .gt('progressValue', 0)
      .eq('completedAt', null)
      .find({ suppressAuth: true });

    return result.items.filter(record =>
      shouldSendChallengeReminder(record.notifiedAt, cadence, now)
    );
  } catch (err) {
    logError('getChallengesNeedingReminder — failed', err);
    return [];
  }
}

/**
 * Updates the notifiedAt timestamp on a MemberChallengeProgress record,
 * marking that a reminder was sent at the given time.
 *
 * @param {string} recordId  _id of the MemberChallengeProgress record
 * @param {number} [nowMs]  Current time in ms (defaults to Date.now())
 * @returns {Promise<Object|null>}  Updated record, or null if not found
 */
export async function markReminderSent(recordId, nowMs) {
  const now = nowMs !== undefined ? nowMs : Date.now();
  try {
    const record = await wixData.get(CHALLENGE_PROGRESS_COLLECTION, recordId);
    if (!record) return null;

    const updated = { ...record, notifiedAt: new Date(now).toISOString() };
    await wixData.update(CHALLENGE_PROGRESS_COLLECTION, updated);
    return updated;
  } catch (err) {
    logError(`markReminderSent — failed for record ${recordId}`, err);
    return null;
  }
}
