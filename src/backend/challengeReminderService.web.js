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
 * - cadence gate has elapsed since last notification
 *
 * Paginates through all records to avoid the 50-item default page cap.
 * The first two filters run server-side; the cadence gate runs in-memory
 * (wixData has no time-diff filter).
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
 */
export async function markReminderSent(recordId, nowMs) {
  const now = nowMs !== undefined ? nowMs : Date.now();

  const record = await wixData.get(CHALLENGE_PROGRESS_COLLECTION, recordId);
  if (!record) return null;

  const updated = { ...record, notifiedAt: new Date(now).toISOString() };
  const saved = await wixData.update(CHALLENGE_PROGRESS_COLLECTION, updated);
  return saved;
}
