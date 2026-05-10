#!/usr/bin/env node
/**
 * @file capture-order-baseline.mjs
 * @description cf-3qt.8 acceptance item 5 — capture a 7-day order-rate
 * baseline that the cutover-night dashboard compares against during the
 * 24-hour post-cutover monitor window.
 *
 * Pulls order rows for the last 7 calendar days via the Wix Stores REST
 * API, groups them by:
 *   - day-of-week × hour-of-day  (per-bucket avg)
 *   - calendar day               (sanity check / day-over-day variance)
 *   - total                       (rollback decision: if t+2h orders <
 *                                  90% of baseline-for-this-hour, abort)
 *
 * Writes:
 *   - docs/cf-3qt.8/order-baseline-<YYYYMMDD>.json
 *   - docs/cf-3qt.8/order-baseline-<YYYYMMDD>.md  (human-readable summary)
 *
 * Run before the cutover (recommend at least 24h before so the captured
 * window doesn't overlap any TTL changes that might bias traffic):
 *
 *   WIX_API_KEY=… WIX_SITE_ID=… node scripts/cutover/capture-order-baseline.mjs
 *
 * Optional env:
 *   ORDER_BASELINE_DAYS  — number of days back (default 7)
 *   ORDER_BASELINE_TZ    — IANA TZ for hour bucketing (default America/Denver
 *                          — the cutover window is in MT)
 *
 * Exit codes:
 *   0  baseline captured + written
 *   1  WIX_API_KEY/WIX_SITE_ID missing
 *   2  Wix API rejected the query (auth / scope / outage)
 *   3  No orders returned over the window (suspicious — investigate before
 *      relying on a vacuous baseline)
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const OUTPUT_DIR = resolve(REPO_ROOT, 'docs', 'cf-3qt.8');

const ORDERS_API = 'https://www.wixapis.com/stores/v2/orders/query';
const PAGE_SIZE = 100;

// Exposed for tests so the bucketing logic can be exercised against
// fixtures without the network round-trip.
export const _internals = {
  bucketOrders,
  buildSummaryMarkdown,
  computeWindowBounds,
};

// ── network ────────────────────────────────────────────────────────────────

async function fetchOrdersPage({ apiKey, siteId, fromIso, toIso, paging }) {
  const headers = {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify({
    query: {
      filter: JSON.stringify({
        _dateCreated: { $gte: fromIso, $lt: toIso },
      }),
      sort: [{ fieldName: '_dateCreated', order: 'ASC' }],
      paging: paging || { limit: PAGE_SIZE, offset: 0 },
    },
  });
  const res = await fetch(ORDERS_API, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => '(unreadable)');
    throw new Error(`orders.query → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllOrders({ apiKey, siteId, fromIso, toIso }) {
  const out = [];
  let offset = 0;
  // Cap pagination at 50 pages (5000 orders) — Carolina Futons does not
  // currently push that volume in 7 days, so hitting this cap means the
  // filter/sort isn't doing what it should.
  for (let page = 0; page < 50; page++) {
    const data = await fetchOrdersPage({
      apiKey,
      siteId,
      fromIso,
      toIso,
      paging: { limit: PAGE_SIZE, offset },
    });
    const orders = data.orders || [];
    out.push(...orders);
    if (orders.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

// ── bucketing ──────────────────────────────────────────────────────────────

/**
 * Compute [from, to] ISO bounds for the baseline window, anchored to the
 * start of "today" in the configured TZ so a script run at any hour
 * captures the full last 7 calendar days.
 */
function computeWindowBounds({ now = new Date(), days = 7, tz = 'America/Denver' } = {}) {
  // Truncate `now` to TZ-local midnight so day buckets line up.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayLocal = fmt.format(now); // YYYY-MM-DD
  // Treat local midnight as UTC ISO — the small TZ skew (≤ 7 hours) is
  // intentional: the cutover happens at TZ-local 02:00, and we want the
  // baseline to mirror the same hour-of-TZ-local-day bucketing.
  const toUtc = new Date(`${todayLocal}T00:00:00Z`).getTime();
  const fromUtc = toUtc - days * 24 * 60 * 60 * 1000;
  return {
    fromIso: new Date(fromUtc).toISOString(),
    toIso: new Date(toUtc).toISOString(),
  };
}

function tzParts(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return {
    weekday: parts.weekday,                                // e.g. 'Mon'
    hour: Number(parts.hour),                              // 0-23
    ymd: `${parts.year}-${parts.month}-${parts.day}`,      // YYYY-MM-DD
  };
}

/**
 * Group orders into hour-of-day × day-of-week buckets, plus a calendar-day
 * histogram and an overall total. All bucketing happens in `tz` so cutover
 * comparisons line up.
 */
function bucketOrders(orders, { tz = 'America/Denver' } = {}) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const dayHourCount = {};
  for (const d of DAYS) dayHourCount[d] = Object.fromEntries(HOURS.map((h) => [h, 0]));
  const calendarDay = {};                  // YYYY-MM-DD → count
  let total = 0;

  for (const o of orders) {
    const iso = o._dateCreated || o.createdDate || o.dateCreated;
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const { weekday, hour, ymd } = tzParts(d, tz);
    if (DAYS.includes(weekday) && Number.isInteger(hour) && hour >= 0 && hour < 24) {
      dayHourCount[weekday][hour] += 1;
    }
    calendarDay[ymd] = (calendarDay[ymd] || 0) + 1;
    total += 1;
  }

  // Per-bucket average across the captured days. We approximate by taking
  // the count divided by the number of distinct calendar days observed
  // (not 7) — guards against partial windows.
  const distinctDays = Object.keys(calendarDay).length || 1;
  const dayHourAvg = {};
  for (const d of DAYS) {
    dayHourAvg[d] = Object.fromEntries(
      HOURS.map((h) => [h, +(dayHourCount[d][h] / distinctDays).toFixed(3)]),
    );
  }

  return {
    total,
    distinctDays,
    calendarDay,
    dayHourCount,
    dayHourAvg,
  };
}

// ── markdown summary ───────────────────────────────────────────────────────

function buildSummaryMarkdown(buckets, { fromIso, toIso, tz, days, capturedAtIso }) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out = [];
  out.push(`# cf-3qt.8 — Order-Rate Baseline`);
  out.push('');
  out.push(`**Captured:** ${capturedAtIso}`);
  out.push(`**Window:** ${fromIso} → ${toIso}  (\`${days}\` days, TZ \`${tz}\`)`);
  out.push(`**Distinct calendar days observed:** ${buckets.distinctDays}`);
  out.push(`**Total orders:** ${buckets.total}`);
  out.push('');
  out.push(`## Calendar-day histogram`);
  out.push('');
  out.push(`| Day | Orders |`);
  out.push(`| --- | ---: |`);
  for (const day of Object.keys(buckets.calendarDay).sort()) {
    out.push(`| ${day} | ${buckets.calendarDay[day]} |`);
  }
  out.push('');
  out.push(`## Hour × Day-of-Week — average orders per slot`);
  out.push('');
  out.push(`| Hour (${tz}) | ${DAYS.join(' | ')} |`);
  out.push(`| --- | ${DAYS.map(() => '---:').join(' | ')} |`);
  for (const h of HOURS) {
    const cells = DAYS.map((d) => buckets.dayHourAvg[d][h].toFixed(2));
    out.push(`| ${String(h).padStart(2, '0')}:00 | ${cells.join(' | ')} |`);
  }
  out.push('');
  out.push(`## Cutover-night decision rule`);
  out.push('');
  out.push(`At t+2h post-cutover, sum the actual orders received against the`);
  out.push(`baseline cells covering the elapsed cutover hours (TZ-local). If`);
  out.push(`actual < 0.9 × expected, trigger rollback per`);
  out.push(`\`rollback-runbook.md\`. Baseline cells with \`< 0.5\` orders/slot are`);
  out.push(`naturally noisy — apply the rule against the rolled-up 2-hour total,`);
  out.push(`not against any single low-traffic cell.`);
  out.push('');
  return out.join('\n');
}

// ── main ───────────────────────────────────────────────────────────────────

function die(code, msg) {
  console.error(`capture-order-baseline: ${msg}`);
  process.exit(code);
}

async function main() {
  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) {
    die(1, 'WIX_API_KEY and WIX_SITE_ID env vars are required.');
  }
  const days = Number(process.env.ORDER_BASELINE_DAYS || 7);
  const tz = process.env.ORDER_BASELINE_TZ || 'America/Denver';
  const { fromIso, toIso } = computeWindowBounds({ days, tz });

  console.log(`[capture-order-baseline] window: ${fromIso} → ${toIso} (TZ=${tz}, days=${days})`);

  let orders;
  try {
    orders = await fetchAllOrders({ apiKey, siteId, fromIso, toIso });
  } catch (err) {
    die(2, err.message);
  }

  console.log(`[capture-order-baseline] fetched ${orders.length} orders`);
  if (orders.length === 0) {
    die(3, 'no orders returned in window — refusing to write a vacuous baseline.');
  }

  const buckets = bucketOrders(orders, { tz });
  const capturedAtIso = new Date().toISOString();
  const stamp = capturedAtIso.slice(0, 10).replace(/-/g, '');
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const jsonPath = resolve(OUTPUT_DIR, `order-baseline-${stamp}.json`);
  const mdPath = resolve(OUTPUT_DIR, `order-baseline-${stamp}.md`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      { capturedAtIso, fromIso, toIso, tz, days, ...buckets },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    mdPath,
    buildSummaryMarkdown(buckets, { fromIso, toIso, tz, days, capturedAtIso }) + '\n',
  );

  console.log(`[capture-order-baseline] wrote ${jsonPath}`);
  console.log(`[capture-order-baseline] wrote ${mdPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[capture-order-baseline] unhandled error: ${err.stack || err.message}`);
    process.exit(2);
  });
}
