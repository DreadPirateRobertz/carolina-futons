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
import { validateId } from 'backend/utils/sanitize';

const CHALLENGE_PROGRESS_COLLECTION = 'MemberChallengeProgress';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;

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
 * Returns all MemberChallengeProgress records eligible for a reminder:
 * - progressValue > 0 (some progress made)
 * - completedAt is null (not yet completed)
 * - deadlineAt is null or in the future (challenge still open)
 * - reminderOptOut is not true (member has not opted out of reminders)
 * - cadence gate has elapsed since last notification
 *
 * Paginates through all records to avoid the 50-item default page cap.
 * The first two filters run server-side; the remaining checks run in-memory
 * (wixData has no time-diff filter, and reminderOptOut/deadlineAt are sparse).
 *
 * @param {'daily'|'weekly'} cadence
 * @param {number} [nowMs]  Current time in ms (defaults to Date.now())
 * @returns {Promise<Array>}
 */
export async function getChallengesNeedingReminder(cadence, nowMs) {
  const now = nowMs !== undefined ? nowMs : Date.now();
  try {
    const eligible = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await wixData
        .query(CHALLENGE_PROGRESS_COLLECTION)
        .gt('progressValue', 0)
        .eq('completedAt', null)
        .skip(skip)
        .limit(BATCH_SIZE)
        .find({ suppressAuth: true });

      for (const record of result.items) {
        if (record.reminderOptOut === true) continue;
        if (record.deadlineAt && new Date(record.deadlineAt).getTime() < now) continue;
        if (shouldSendChallengeReminder(record.notifiedAt, cadence, now)) {
          eligible.push(record);
        }
      }

      skip += result.items.length;
      hasMore = result.items.length === BATCH_SIZE;
    }

    return eligible;
  } catch (err) {
    logError('getChallengesNeedingReminder — failed', err);
    return [];
  }
}

/**
 * Sends reminders for all eligible challenges and marks each as notified.
 *
 * Iterates all records returned by getChallengesNeedingReminder, calling
 * sendFn for each. Individual send failures are logged and counted but do
 * not abort the batch — successful sends are always counted.
 *
 * @param {'daily'|'weekly'} cadence
 * @param {Function} sendFn  Async function called with each eligible record. Should throw on failure.
 * @param {number} [nowMs]  Current time in ms (defaults to Date.now())
 * @returns {Promise<{sent: number, failed: number}>}
 */
export async function sendBatchReminders(cadence, sendFn, nowMs) {
  const records = await getChallengesNeedingReminder(cadence, nowMs);
  let sent = 0;
  let failed = 0;

  for (const record of records) {
    try {
      await sendFn(record);
      await markReminderSent(record._id, nowMs);
      sent++;
    } catch (err) {
      logError(`sendBatchReminders — failed for record ${record._id}`, err);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Returns eligible reminder records scoped to a single challenge.
 * Applies the same eligibility rules as getChallengesNeedingReminder.
 * Returns [] if challengeId fails validation.
 *
 * @param {string} challengeId  ID of the challenge to query
 * @param {'daily'|'weekly'} cadence
 * @param {number} [nowMs]  Current time in ms (defaults to Date.now())
 * @returns {Promise<Array>}
 */
export async function getChallengesNeedingReminderById(challengeId, cadence, nowMs) {
  const cleanId = validateId(challengeId);
  if (!cleanId) return [];

  const now = nowMs !== undefined ? nowMs : Date.now();
  try {
    const eligible = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await wixData
        .query(CHALLENGE_PROGRESS_COLLECTION)
        .gt('progressValue', 0)
        .eq('completedAt', null)
        .eq('challengeId', cleanId)
        .skip(skip)
        .limit(BATCH_SIZE)
        .find({ suppressAuth: true });

      for (const record of result.items) {
        if (record.reminderOptOut === true) continue;
        if (record.deadlineAt && new Date(record.deadlineAt).getTime() < now) continue;
        if (shouldSendChallengeReminder(record.notifiedAt, cadence, now)) {
          eligible.push(record);
        }
      }

      skip += result.items.length;
      hasMore = result.items.length === BATCH_SIZE;
    }

    return eligible;
  } catch (err) {
    logError('getChallengesNeedingReminderById — failed', err);
    return [];
  }
}

/**
 * Updates the notifiedAt timestamp on a MemberChallengeProgress record,
 * marking that a reminder was sent at the given time.
 *
 * Returns null if the record does not exist.
 * Throws if the DB write fails — callers should handle errors separately
 * from the not-found case.
 *
 * NOTE: get-then-update is non-atomic; concurrent calls for the same record
 * may both write. In practice, reminder dispatch is a scheduled batch job
 * and not called concurrently per record.
 *
 * @param {string} recordId  _id of the MemberChallengeProgress record
 * @param {number} [nowMs]  Current time in ms (defaults to Date.now())
 * @returns {Promise<Object|null>}  DB-confirmed updated record, or null if not found
 *
 * suppressAuth: true is required on both wixData calls — this function runs in a
 * scheduled job context with no member session, so Wix would otherwise reject the reads.
 */
export async function markReminderSent(recordId, nowMs) {
  const now = nowMs !== undefined ? nowMs : Date.now();

  const record = await wixData.get(CHALLENGE_PROGRESS_COLLECTION, recordId, { suppressAuth: true });
  if (!record) return null;

  const updated = { ...record, notifiedAt: new Date(now).toISOString() };
  const saved = await wixData.update(CHALLENGE_PROGRESS_COLLECTION, updated, { suppressAuth: true });
  return saved;
}
