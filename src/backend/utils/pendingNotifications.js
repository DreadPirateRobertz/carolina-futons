/**
 * @file pendingNotifications.js
 * @description Queue utility for PendingNotifications collection.
 * Provides enqueue, markSent, markFailed, getPendingRetries, and getStalePending
 * operations used by notificationService and the processNotificationQueueCron.
 *
 * Retry backoff schedule (exponential):
 *   retries=0 (first failure)  → nextRetryAt = now + 30s
 *   retries=1                  → nextRetryAt = now + 60s
 *   retries=2                  → nextRetryAt = now + 120s
 *   retries≥3                  → no further retries
 *
 * CF-hbz
 */
import wixData from 'wix-data';

export const PENDING_NOTIFICATIONS_COLLECTION = 'PendingNotifications';
export const MAX_RETRIES = 3;

const BACKOFF_MS = [30_000, 60_000, 120_000]; // indexed by retries count

/**
 * Insert a new notification job with status='pending'.
 * @param {{ userId: string, type: string, payload: Object }} params
 * @returns {Promise<{ _id: string }>}
 */
export async function enqueueNotification({ userId, type, payload }) {
  const now = new Date();
  return wixData.insert(
    PENDING_NOTIFICATIONS_COLLECTION,
    { userId, type, payload, status: 'pending', retries: 0, updatedAt: now },
    { suppressAuth: true }
  );
}

/**
 * Mark a pending notification as successfully sent.
 * @param {string} id - the PendingNotifications _id
 * @returns {Promise<void>}
 */
export async function markSent(id) {
  await wixData.update(
    PENDING_NOTIFICATIONS_COLLECTION,
    { _id: id, status: 'sent', updatedAt: new Date() },
    { suppressAuth: true }
  );
}

/**
 * Mark a notification attempt as failed and schedule the next retry.
 * Increments retries count and sets nextRetryAt based on backoff schedule.
 * @param {string} id - the PendingNotifications _id
 * @param {number} currentRetries - the retries count BEFORE this failure
 * @returns {Promise<void>}
 */
export async function markFailed(id, currentRetries) {
  const newRetries = currentRetries + 1;
  const backoffMs = BACKOFF_MS[currentRetries] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  const nextRetryAt = new Date(Date.now() + backoffMs);
  await wixData.update(
    PENDING_NOTIFICATIONS_COLLECTION,
    { _id: id, status: 'failed', retries: newRetries, nextRetryAt, updatedAt: new Date() },
    { suppressAuth: true }
  );
}

/**
 * Query failed notification jobs that are due for retry.
 * Returns rows where status='failed', retries < MAX_RETRIES, and nextRetryAt <= now.
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function getPendingRetries(limit = 50) {
  const now = new Date();
  const result = await wixData
    .query(PENDING_NOTIFICATIONS_COLLECTION)
    .eq('status', 'failed')
    .lt('retries', MAX_RETRIES)
    .le('nextRetryAt', now)
    .ascending('nextRetryAt')
    .limit(limit)
    .find({ suppressAuth: true });
  return result.items;
}

/** Stale threshold: pending rows older than this were stranded by a process death. */
export const STALE_PENDING_MS = 2 * 60_000; // 2 minutes

/**
 * Query stale status='pending' rows — enqueued but never marked sent or failed.
 * Caused by process death between enqueueNotification and markSent/markFailed.
 * Returns rows where status='pending' and updatedAt <= now - STALE_PENDING_MS.
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function getStalePending(limit = 50) {
  const staleThreshold = new Date(Date.now() - STALE_PENDING_MS);
  const result = await wixData
    .query(PENDING_NOTIFICATIONS_COLLECTION)
    .eq('status', 'pending')
    .le('updatedAt', staleThreshold)
    .ascending('updatedAt')
    .limit(limit)
    .find({ suppressAuth: true });
  return result.items;
}
