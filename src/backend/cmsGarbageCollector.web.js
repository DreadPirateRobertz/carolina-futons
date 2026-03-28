/**
 * @module cmsGarbageCollector.web
 * @description CMS garbage collection — purges stale ephemeral records to prevent
 * unbounded table growth. Designed to run as a daily cron via /_functions/cmsGarbageCollect.
 *
 * Collections purged:
 *   - Rate limit records (42 collections): windowStart > 24h
 *   - BrowseSessions: updatedAt > 30d
 *   - EmailQueue: status in (sent, cancelled) AND createdAt > 7d
 *   - ViewerCount: updatedAt > 48h (orphan viewer sessions)
 *   - AuditLog: timestamp > 90d (default), or > retentionDays if flagged
 *
 * Batch deletes: 100 records per query, up to 5 passes per collection.
 * Total ceiling: ~500 deletes per collection per run (prevents Wix timeout).
 *
 * CF-au1w
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

// ── Rate Limit Collections ──────────────────────────────────────────

const RATE_LIMIT_COLLECTIONS = [
  'AbTestEventRateLimit',
  'AchievementsRateLimit',
  'ActivityRateLimit',
  'AffiliateClickRateLimit',
  'AnalyticsEventRateLimit',
  'AppointmentBookingRateLimit',
  'AppointmentCancelRateLimit',
  'BackInStockRateLimit',
  'BadgesPublicRateLimit',
  'BrowseSessionRateLimit',
  'BundleAddRateLimit',
  'BundleImpressionRateLimit',
  'BundleQuoteRateLimit',
  'BurnRateLimit',
  'BusEventRateLimit',
  'ChatMessageRateLimit',
  'CheckoutTrackingRateLimit',
  'ComparisonRateLimit',
  'DeliveryReservationRateLimit',
  'DemandSignalRateLimit',
  'EmailEventRateLimit',
  'EmailRateLimit',
  'ErrorLogRateLimit',
  'FabricSampleRateLimit',
  'GamificationActionRateLimit',
  'GiftCardBalanceRateLimit',
  'LeaderboardPublicRateLimit',
  'MetricsReportRateLimit',
  'NewsletterRateLimit',
  'ProtectionPlanRateLimit',
  'QARateLimit',
  'QuizLeadRateLimit',
  'RegistryPurchaseRateLimit',
  'RemindMeRateLimit',
  'ReviewRateLimit',
  'ShippingEstimateRateLimit',
  'SpinWheelRateLimit',
  'SupportTicketRateLimit',
  'TrackingRateLimit',
  'TradeApplicationRateLimit',
  'UnsubscribeRateLimit',
  'ViewerCountRateLimit',
];

// ── TTL Configuration ───────────────────────────────────────────────

const BATCH_SIZE = 100;
const MAX_PASSES = 5;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const TTL = {
  rateLimitHours: 24,
  browseSessionDays: 30,
  emailQueueDays: 7,
  viewerCountHours: 48,
  auditLogDays: 90,
  auditLogRetentionDays: 365,
};

// ── Core Batch Delete ───────────────────────────────────────────────

/**
 * Delete stale records from a collection in batches.
 * @param {string} collection - CMS collection name
 * @param {string} dateField - Field name to compare against cutoff
 * @param {Date} cutoff - Records older than this are deleted
 * @param {Object} [extraFilter] - Additional .eq() filter { field, value }
 * @returns {Promise<number>} Total records deleted
 */
async function batchPurge(collection, dateField, cutoff, extraFilter) {
  let totalRemoved = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    try {
      let query = wixData.query(collection)
        .lt(dateField, cutoff)
        .limit(BATCH_SIZE);

      if (extraFilter) {
        query = query.eq(extraFilter.field, extraFilter.value);
      }

      const result = await query.find({ suppressAuth: true });
      if (result.items.length === 0) break;

      for (const item of result.items) {
        try {
          await wixData.remove(collection, item._id, { suppressAuth: true });
          totalRemoved++;
        } catch (err) {
          logError(`cmsGC.batchPurge[${collection}/${item._id}]`, err, { silent: true });
        }
      }

      if (result.items.length < BATCH_SIZE) break;
    } catch (err) {
      logError(`cmsGC.batchPurge[${collection}] pass ${pass}`, err);
      break;
    }
  }

  return totalRemoved;
}

// ── GC Tasks ────────────────────────────────────────────────────────

/**
 * Purge all rate limit collections — records with windowStart > 24h.
 */
async function purgeRateLimits() {
  const cutoff = new Date(Date.now() - TTL.rateLimitHours * MS_PER_HOUR);
  const results = {};
  let total = 0;

  for (const collection of RATE_LIMIT_COLLECTIONS) {
    try {
      const removed = await batchPurge(collection, 'windowStart', cutoff);
      if (removed > 0) {
        results[collection] = removed;
        total += removed;
      }
    } catch (err) {
      logError(`cmsGC.purgeRateLimits[${collection}]`, err, { silent: true });
    }
  }

  return { total, collections: results };
}

/**
 * Purge BrowseSessions older than 30 days.
 */
async function purgeBrowseSessions() {
  const cutoff = new Date(Date.now() - TTL.browseSessionDays * MS_PER_DAY);
  return batchPurge('BrowseSessions', 'updatedAt', cutoff);
}

/**
 * Purge EmailQueue records with status sent or cancelled, older than 7 days.
 */
async function purgeEmailQueue() {
  const cutoff = new Date(Date.now() - TTL.emailQueueDays * MS_PER_DAY);
  let total = 0;

  for (const status of ['sent', 'cancelled']) {
    const removed = await batchPurge('EmailQueue', 'createdAt', cutoff, {
      field: 'status',
      value: status,
    });
    total += removed;
  }

  return total;
}

/**
 * Purge orphan ViewerCount records older than 48h.
 */
async function purgeViewerSessions() {
  const cutoff = new Date(Date.now() - TTL.viewerCountHours * MS_PER_HOUR);
  return batchPurge('ViewerCount', 'updatedAt', cutoff);
}

/**
 * Purge AuditLog records. Default: 90d. Records with retentionDays field: use that value.
 */
async function purgeAuditLog() {
  const defaultCutoff = new Date(Date.now() - TTL.auditLogDays * MS_PER_DAY);
  let totalRemoved = 0;

  // Pass 1: purge records WITHOUT retentionDays (standard 90d TTL)
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    try {
      const result = await wixData.query('AuditLog')
        .lt('timestamp', defaultCutoff)
        .isEmpty('retentionDays')
        .limit(BATCH_SIZE)
        .find({ suppressAuth: true });

      if (result.items.length === 0) break;

      for (const item of result.items) {
        try {
          await wixData.remove('AuditLog', item._id, { suppressAuth: true });
          totalRemoved++;
        } catch (err) {
          logError(`cmsGC.purgeAuditLog[${item._id}]`, err, { silent: true });
        }
      }

      if (result.items.length < BATCH_SIZE) break;
    } catch (err) {
      logError('cmsGC.purgeAuditLog pass ' + pass, err);
      break;
    }
  }

  // Pass 2: purge records WITH retentionDays where timestamp > retentionDays
  const longRetentionCutoff = new Date(Date.now() - TTL.auditLogRetentionDays * MS_PER_DAY);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    try {
      const result = await wixData.query('AuditLog')
        .lt('timestamp', longRetentionCutoff)
        .isNotEmpty('retentionDays')
        .limit(BATCH_SIZE)
        .find({ suppressAuth: true });

      if (result.items.length === 0) break;

      for (const item of result.items) {
        try {
          await wixData.remove('AuditLog', item._id, { suppressAuth: true });
          totalRemoved++;
        } catch (err) {
          logError(`cmsGC.purgeAuditLog.retention[${item._id}]`, err, { silent: true });
        }
      }

      if (result.items.length < BATCH_SIZE) break;
    } catch (err) {
      logError('cmsGC.purgeAuditLog.retention pass ' + pass, err);
      break;
    }
  }

  return totalRemoved;
}

// ── Main GC Entry Point ─────────────────────────────────────────────

/**
 * Run full CMS garbage collection.
 * @returns {Promise<Object>} Summary of records purged per category
 */
export const runGarbageCollection = webMethod(
  Permissions.Admin,
  async () => {
    const startTime = Date.now();
    const summary = {
      rateLimits: { total: 0, collections: {} },
      browseSessions: 0,
      emailQueue: 0,
      viewerSessions: 0,
      auditLog: 0,
    };

    try {
      summary.rateLimits = await purgeRateLimits();
    } catch (err) {
      logError('cmsGC.rateLimits', err);
    }

    try {
      summary.browseSessions = await purgeBrowseSessions();
    } catch (err) {
      logError('cmsGC.browseSessions', err);
    }

    try {
      summary.emailQueue = await purgeEmailQueue();
    } catch (err) {
      logError('cmsGC.emailQueue', err);
    }

    try {
      summary.viewerSessions = await purgeViewerSessions();
    } catch (err) {
      logError('cmsGC.viewerSessions', err);
    }

    try {
      summary.auditLog = await purgeAuditLog();
    } catch (err) {
      logError('cmsGC.auditLog', err);
    }

    const totalPurged = summary.rateLimits.total + summary.browseSessions +
      summary.emailQueue + summary.viewerSessions + summary.auditLog;

    return {
      success: true,
      totalPurged,
      durationMs: Date.now() - startTime,
      ...summary,
    };
  }
);

// ── Exports for Testing ─────────────────────────────────────────────

export const _RATE_LIMIT_COLLECTIONS = RATE_LIMIT_COLLECTIONS;
export const _TTL = TTL;
export const _BATCH_SIZE = BATCH_SIZE;
export const _MAX_PASSES = MAX_PASSES;
export { batchPurge as _batchPurge };
