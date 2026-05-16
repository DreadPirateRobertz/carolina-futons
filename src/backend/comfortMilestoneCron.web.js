/**
 * @module comfortMilestoneCron
 * @description Daily cron scanner that detects comfort-timeline milestones
 * (Day 1 / 7 / 14 / 30 / 60 from order delivery) and returns the qualifying
 * rows for downstream email/notification dispatch.
 *
 * This module is the cf-ui9w workstream 3 restoration of the milestone
 * scheduler retired in cf-4x7e.B5 (PR #1333). Like sibling lifecycleCron,
 * it returns qualifying rows but does NOT send any communications itself —
 * the email queue wire-up lands as a separate follow-up so this PR's
 * surface stays narrow.
 *
 * Flow:
 *   - Read all active ComfortTimelines rows.
 *   - For each row, compute days elapsed since deliveredAt (floor).
 *   - For each milestone window (Day 1/7/14/30/60 ±1 day), emit a result
 *     unless the milestone is already recorded in milestonesCompleted.
 *   - Status filter: skip rows where status ∈ {complete, cancelled}.
 *
 * Dedup contract: callers consuming the returned `results` SHOULD update
 * the matching ComfortTimelines row's `milestonesCompleted` JSON to
 * include the fired milestone's day number — that's what prevents a
 * second send next cron tick. This scanner doesn't write because the
 * fire-side cannot atomically transact with the email send; the
 * downstream consumer owns the write.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * No additional CMS collections. Reads from `ComfortTimelines`
 * (already seeded by comfortTimeline.createTimeline since
 * cf-4x7e.B5 left those columns intact).
 *
 * @cron Add to jobs.config:
 *   processComfortMilestones — daily at 13:30 UTC (≈ 8:30 AM EST)
 *   cronExpression: '30 13 * * *'
 *
 * The 13:30 slot dodges the existing 13:00 cluster (priceDrops,
 * wishlistPriceDrops, wishlistBackInStock) per the cf-ox0h spread
 * convention used by deliveryNotifications + analyticsDigest.
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

const COLLECTION = 'ComfortTimelines';
const PAGE_SIZE = 100;

/**
 * Comfort-timeline milestones with ±1 day tolerance windows.
 *
 * The ±1 tolerance accommodates scheduling drift — a cron that fires
 * at 13:30 UTC will measure "exactly N days" against a `deliveredAt`
 * stamped at 14:00 UTC as N-1 days, so the window minDays/maxDays
 * gives one full day of slack on either side of the target.
 *
 * Labels mirror the lifecycleCron `day_7` / `month_1` / `year_1`
 * naming convention so downstream email TEMPLATE_ID_MAP keys can use
 * the same shape (`comfort_day_7`, etc.).
 */
const MILESTONES = [
  { day: 1,  label: 'day_1',  minDays: 0,  maxDays: 2  },
  { day: 7,  label: 'day_7',  minDays: 6,  maxDays: 8  },
  { day: 14, label: 'day_14', minDays: 13, maxDays: 15 },
  { day: 30, label: 'day_30', minDays: 29, maxDays: 31 },
  { day: 60, label: 'day_60', minDays: 59, maxDays: 61 },
];

/**
 * Statuses that should be skipped — the timeline is no longer "active"
 * and milestone emails would be inappropriate (already cross-sold, or
 * the customer cancelled).
 */
const SKIP_STATUSES = new Set(['complete', 'cancelled']);

/**
 * Maximum lookback. A Day 60 milestone with +1 day tolerance fires at
 * day 61; one day buffer makes the cutoff 62. Timelines older than this
 * have completed every milestone window and can't qualify.
 */
const MAX_LOOKBACK_DAYS = 62;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse the `milestonesCompleted` JSON column safely. Returns the
 * recorded day numbers as a Set for O(1) dedup checks. Malformed JSON
 * or non-array shapes degrade to an empty Set so a corrupted row
 * doesn't block legitimate scheduler progress (the next email send
 * will overwrite the column with a clean array).
 *
 * @param {unknown} raw - The stored JSON string (or array, defensively).
 * @returns {Set<number>}
 */
function parseCompletedDays(raw) {
  if (Array.isArray(raw)) {
    return new Set(raw.filter((n) => typeof n === 'number'));
  }
  if (typeof raw !== 'string' || raw.length === 0) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((n) => typeof n === 'number'))
      : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Scan ComfortTimelines for active rows whose elapsed-days-since-
 * delivery falls within any milestone window, returning qualifying
 * rows for downstream email dispatch. Does NOT send emails or mutate
 * rows — caller owns those writes.
 *
 * @function processComfortMilestones
 * @returns {Promise<{
 *   success: boolean,
 *   timelinesScanned: number,
 *   milestonesFound: number,
 *   results: Array<{
 *     timelineId: string,
 *     orderId: string,
 *     memberId: string,
 *     productId: string,
 *     productName: string|null,
 *     milestone: string,
 *     day: number,
 *     deliveredAt: Date,
 *   }>
 * }>}
 * @permission Admin
 */
export const processComfortMilestones = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const timelines = await fetchActiveTimelines();
      const now = Date.now();
      const results = [];

      for (const t of timelines) {
        if (SKIP_STATUSES.has(t.status)) continue;

        const delivered = t.deliveredAt ? new Date(t.deliveredAt).getTime() : NaN;
        if (!Number.isFinite(delivered)) continue;

        // Math.floor: avoids floating-point boundary failures (see
        // lifecycleCron for the same pattern + rationale).
        const daysSince = Math.floor((now - delivered) / DAY_MS);

        const completed = parseCompletedDays(t.milestonesCompleted);

        for (const m of MILESTONES) {
          if (daysSince < m.minDays || daysSince > m.maxDays) continue;
          if (completed.has(m.day)) continue;

          results.push({
            timelineId: t._id,
            orderId: t.orderId,
            memberId: t.memberId,
            productId: t.productId,
            productName: t.productName ?? null,
            milestone: m.label,
            day: m.day,
            deliveredAt: new Date(delivered),
          });
        }
      }

      return {
        success: true,
        timelinesScanned: timelines.length,
        milestonesFound: results.length,
        results,
      };
    } catch (err) {
      logError('comfortMilestoneCron.processComfortMilestones', err);
      return {
        success: false,
        timelinesScanned: 0,
        milestonesFound: 0,
        results: [],
      };
    }
  },
);

/**
 * Page through active ComfortTimelines rows delivered within the
 * milestone lookback window. Older rows can't qualify and are
 * filtered at query time to avoid O(N²) offset pagination on the
 * full timeline history.
 *
 * @returns {Promise<Array>}
 */
async function fetchActiveTimelines() {
  const cutoff = new Date(Date.now() - MAX_LOOKBACK_DAYS * DAY_MS);
  const all = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await wixData
      .query(COLLECTION)
      .ge('deliveredAt', cutoff)
      .limit(PAGE_SIZE)
      .skip(offset)
      .find({ suppressAuth: true });

    const items = batch.items ?? [];
    all.push(...items);

    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}
