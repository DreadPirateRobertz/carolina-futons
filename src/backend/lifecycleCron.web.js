/**
 * @module lifecycleCron
 * @description Daily cron job that scans all orders and detects purchase
 * anniversary milestones: Day 7, Month 1 (30 days), and Year 1 (365 days).
 * Each milestone has a ±1 day tolerance window to accommodate scheduling
 * drift. Returns an array of qualifying orders for downstream processing
 * (email, notifications, etc.) — does NOT send any communications itself.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * No additional CMS collections required. Reads from:
 *   Stores/Orders — order data with buyer info and creation date
 *     _id          (Text)     Order ID
 *     _createdDate (DateTime) Order placement date (Wix auto-field)
 *     buyerInfo.email    (Text) Buyer email address
 *     buyerInfo.memberId (Text) Wix member ID (empty for guest checkouts)
 *
 * @cron Add to jobs.config:
 *   scanLifecycleMilestones — daily at 09:00 UTC
 *   cronExpression: '0 9 * * *'
 *
 * @returns {Promise<{
 *   success: boolean,
 *   ordersScanned: number,
 *   milestonesFound: number,
 *   results: Array<{orderId: string, memberId: string|null, email: string, milestone: string, orderDate: Date}>
 * }>}
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const ORDERS_COLLECTION = 'Stores/Orders';
const PAGE_SIZE = 100;

// Maximum lookback needed: Year 1 window maxDays (366) + 1 day buffer = 367 days.
// Orders older than this can never qualify for any milestone, so we filter them
// out at query time to avoid O(N²) offset pagination over the full order history.
const MAX_LOOKBACK_DAYS = 367;

// ── Milestone windows (minDays and maxDays inclusive) ─────────────────────────

/** Day 7 window: orders placed 6–8 days ago. */
const DAY7_WINDOW = { minDays: 6, maxDays: 8 };

/** Month 1 window: orders placed 29–31 days ago (30-day month ±1). */
const MONTH1_WINDOW = { minDays: 29, maxDays: 31 };

/** Year 1 window: orders placed 364–366 days ago (365-day year ±1). */
const YEAR1_WINDOW = { minDays: 364, maxDays: 366 };

const MILESTONES = [
  { label: 'day_7',   ...DAY7_WINDOW   },
  { label: 'month_1', ...MONTH1_WINDOW },
  { label: 'year_1',  ...YEAR1_WINDOW  },
];

// ── Main cron entrypoint ───────────────────────────────────────────────────────

/**
 * Scan all orders for Day 7, Month 1, and Year 1 anniversary milestones.
 * Each qualifying order is returned as a result object — no emails are sent.
 *
 * @function scanLifecycleMilestones
 * @returns {Promise<{success: boolean, ordersScanned: number, milestonesFound: number, results: Array}>}
 * @permission Admin
 */
export const scanLifecycleMilestones = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const orders = await fetchAllOrders();
      const now = Date.now();

      const seen = new Set();   // dedup key: `${orderId}:${milestone}`
      const results = [];

      for (const order of orders) {
        const orderDate = order._createdDate;
        const email = order.buyerInfo?.email || '';

        // Skip orders without a contact email or valid date
        if (!email || !orderDate) continue;

        // Math.floor: avoids floating-point boundary failures where e.g. an order
        // placed exactly 31 days ago measures as 31.000001 days (few ms elapsed
        // between test setup and cron execution), causing a spurious window miss.
        const daysSince = Math.floor((now - new Date(orderDate).getTime()) / (24 * 60 * 60 * 1000));

        for (const milestone of MILESTONES) {
          if (daysSince < milestone.minDays || daysSince > milestone.maxDays) continue;

          const key = `${order._id}:${milestone.label}`;
          if (seen.has(key)) continue;
          seen.add(key);

          results.push({
            orderId:   order._id,
            memberId:  order.buyerInfo?.memberId ?? null,
            email,
            milestone: milestone.label,
            orderDate: new Date(orderDate),
          });
        }
      }

      return {
        success: true,
        ordersScanned:   orders.length,
        milestonesFound: results.length,
        results,
      };
    } catch (err) {
      console.error('[lifecycleCron] scanLifecycleMilestones failed:', err?.message);
      return { success: false, ordersScanned: 0, milestonesFound: 0, results: [] };
    }
  }
);

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Fetch orders from the Wix Stores collection placed within the last MAX_LOOKBACK_DAYS days,
 * paginating until exhausted. Orders older than the maximum milestone window (366 days + 1 buffer)
 * are excluded at query time, avoiding O(N²) offset pagination over the full order history.
 * @returns {Promise<Array>}
 */
async function fetchAllOrders() {
  const cutoff = new Date(Date.now() - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const results = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await wixData
      .query(ORDERS_COLLECTION)
      .ge('_createdDate', cutoff)
      .limit(PAGE_SIZE)
      .skip(offset)
      .find({ suppressAuth: true });

    results.push(...batch.items);

    if (batch.items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return results;
}

// ── Test helpers ───────────────────────────────────────────────────────────────

/** Exposed for unit tests only — not part of the public API. */
export const _DAY7_WINDOW   = DAY7_WINDOW;
export const _MONTH1_WINDOW = MONTH1_WINDOW;
export const _YEAR1_WINDOW  = YEAR1_WINDOW;
export { fetchAllOrders as _fetchAllOrders };
