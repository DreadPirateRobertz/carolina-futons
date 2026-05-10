#!/usr/bin/env node
/**
 * @file snapshot-wix-data.mjs
 * @description cf-3qt.8 acceptance item 1 — capture a JSON snapshot of every
 * load-bearing Wix CMS collection before the DNS cutover, so that a
 * post-cutover forensic comparison or worst-case restore is possible.
 *
 * cf-3qt keeps Wix as the data backend (the migration retires Wix Studio
 * as the rendering layer; the full Wix exit is the deferred cf-xe2 epic).
 * "DB snapshot both sites" therefore reduces to ONE backend — Wix —
 * captured as a point-in-time JSON export of the collections both
 * STAGING_SITE and the Vercel cfw frontend share.
 *
 * The snapshot is a redundancy on top of Wix's own dashboard backups, not
 * a replacement. Its primary uses:
 *   1. Audit trail: pinpoint what data looked like at the moment of the
 *      cutover for any incident postmortem.
 *   2. Selective restore: if a specific row is corrupted post-cutover, the
 *      snapshot is the source of truth for the prior value.
 *   3. Drift detection: re-run at t+24h and diff to confirm no unexpected
 *      writes happened during the cutover window.
 *
 * Not in scope here: Wix Stores Orders (covered by the order-baseline
 * pull, cf-3qt.8 item 5) and Wix Members PII (separate consent + retention
 * concerns; if Stilgar wants member snapshots, file a sibling bead).
 *
 * Run before the cutover (recommend immediately after the order-baseline
 * pull — same credentials):
 *
 *   WIX_API_KEY=… WIX_SITE_ID=… node scripts/cutover/snapshot-wix-data.mjs
 *
 * Optional env:
 *   SNAPSHOT_OUT_DIR — output directory (default snapshots/<YYYYMMDD-HHMMSS>/
 *                      relative to the repo root)
 *   SNAPSHOT_LIMIT_PER_COLLECTION — soft cap per collection (default 50000)
 *
 * Exit codes:
 *   0 — snapshot complete
 *   1 — WIX_API_KEY/WIX_SITE_ID missing
 *   2 — Wix API rejected the query (auth / scope / outage). Partial
 *       snapshot left in place under the output dir.
 *   3 — output directory exists and is non-empty (refuse to overwrite)
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const QUERY_API = 'https://www.wixapis.com/wix-data/v2/items/query';
const PAGE_SIZE = 100;

// Load-bearing collection inventory — derived from
// scripts/provisionCmsCollections.js + a few Wix-managed collections that
// are not in the manifest because backend code creates them on first use
// (see Step 4 of MASTER-HOOKUP.md). Order matters: largest/highest-write
// collections last so the snapshot finishes the small reference data
// even if the API throttles us out at the tail.
//
// Exposed for tests + for ops to easily preview the manifest with
// `node scripts/cutover/snapshot-wix-data.mjs --manifest`.
export const SNAPSHOT_COLLECTIONS = [
  // ── Brenda-edited content (Path B + Path A both write here) ───────────
  'SiteContent',
  'Promotions',
  'AssemblyGuides',
  'FabricSwatches',
  'ProductBundles',
  'Videos',
  'Landings',
  'PressMentions',
  'PressKitAssets',
  'ComparisonFeatures',
  'SustainabilityStory',
  'SustainabilityCertification',
  'SustainabilityMaterial',

  // ── customer-funnel state ─────────────────────────────────────────────
  'ContactSubmissions',
  'AbandonedCarts',
  'BackInStockSignups',
  'Unsubscribes',
  'NewsletterSubscribers',

  // ── operational ledger ────────────────────────────────────────────────
  'Fulfillments',
  'EmailQueue',
  'FailedEvents',
  'InventoryLevels',
  'InventoryLog',
  'DeliverySchedule',
  'ReviewRequests',

  // ── loyalty / referral / engagement ───────────────────────────────────
  'GiftCards',
  'ReferralCodes',
  'SpinGrants',
  'MobileChallengeCompletions',
  'CrossRigSyncLog',
  'CustomerEngagement',
  'PointsLedger',
  'BonusSpinGrants',
  'RecentlyViewed',
  'MemberPreferences',
  'PushTokens',
  'PremiumMemberships',
  'ProductAnalytics',
];

// Exposed for tests so the manifest validator + summary writer can be
// exercised against fixtures without the network round-trip.
export const _internals = {
  buildManifestSummary,
  formatCollectionLine,
};

// ── helpers ────────────────────────────────────────────────────────────────

function buildHeaders(apiKey, siteId) {
  return {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };
}

async function fetchAllItems({ headers, collectionId, limitPerCollection }) {
  const items = [];
  let offset = 0;
  // Cap pagination by the per-collection ceiling, rounded up to the
  // nearest PAGE_SIZE so the last page completes cleanly.
  const maxPages = Math.ceil(limitPerCollection / PAGE_SIZE);
  for (let page = 0; page < maxPages; page++) {
    const body = JSON.stringify({
      dataCollectionId: collectionId,
      query: {
        paging: { limit: PAGE_SIZE, offset },
      },
    });
    const res = await fetch(QUERY_API, { method: 'POST', headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => '(unreadable)');
      const err = new Error(`${collectionId} query → ${res.status}: ${text.slice(0, 200)}`);
      err.status = res.status;
      err.collection = collectionId;
      throw err;
    }
    const data = await res.json();
    const pageItems = data.dataItems || data.items || [];
    items.push(...pageItems);
    if (pageItems.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return items;
}

function formatCollectionLine({ id, status, count, error }) {
  if (status === 'ok') return `  ✓ ${id.padEnd(28)} ${String(count).padStart(6)} rows`;
  if (status === 'missing') return `  ○ ${id.padEnd(28)} (collection not found — skipped)`;
  if (status === 'error') return `  ✗ ${id.padEnd(28)} ERROR: ${error || ''}`.trim();
  return `  ? ${id} (unknown status)`;
}

function buildManifestSummary({ outDir, capturedAtIso, results, totalRows }) {
  const lines = [];
  lines.push(`# cf-3qt.8 — Wix CMS Snapshot`);
  lines.push('');
  lines.push(`**Captured:** ${capturedAtIso}`);
  lines.push(`**Output:** \`${outDir}\``);
  lines.push(`**Collections requested:** ${results.length}`);
  lines.push(`**Total rows captured:** ${totalRows}`);
  lines.push('');
  lines.push('## Per-collection result');
  lines.push('');
  lines.push('```');
  for (const r of results) lines.push(formatCollectionLine(r));
  lines.push('```');
  lines.push('');
  lines.push('## What is NOT in this snapshot');
  lines.push('');
  lines.push('- **Wix Stores Orders** — captured separately by `capture-order-baseline.mjs` (cf-3qt.8 item 5). Don\'t double-pull; orders churn fast and the baseline file already encodes the load-bearing aggregate.');
  lines.push('- **Wix Members PII** — opted out for consent + retention reasons. If a member-row export is needed for an incident postmortem, file a sibling bead and capture under a separate retention policy.');
  lines.push('- **Wix Media Manager binaries** — only the URLs that show up inside CMS rows are captured. The actual asset bytes live in Wix\'s media CDN; restoring an image needs to come from there.');
  lines.push('');
  lines.push('## How to use during the cutover');
  lines.push('');
  lines.push('1. Confirm the snapshot completed (`✓` for every load-bearing collection — the loyalty/engagement ones are nice-to-have, the funnel/ledger ones are mandatory).');
  lines.push('2. Keep the output directory off-laptop for the cutover window — copy to a dedicated cloud drive or the team password manager attachments.');
  lines.push('3. Re-run at t+24h post-cutover with `SNAPSHOT_OUT_DIR=…` pointing at a fresh directory; diff selected files to confirm no unexpected writes happened during the migration window.');
  lines.push('4. If a specific row needs to be restored, the JSON has every field including `_id` so a `wixData.update(collection, row)` from a Velo backend webMethod is the surgical path.');
  lines.push('');
  return lines.join('\n');
}

// ── main ───────────────────────────────────────────────────────────────────

function die(code, msg) {
  console.error(`snapshot-wix-data: ${msg}`);
  process.exit(code);
}

async function main() {
  if (process.argv.includes('--manifest')) {
    console.log(JSON.stringify(SNAPSHOT_COLLECTIONS, null, 2));
    process.exit(0);
  }

  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) {
    die(1, 'WIX_API_KEY and WIX_SITE_ID env vars are required.');
  }
  const limitPerCollection = Number(process.env.SNAPSHOT_LIMIT_PER_COLLECTION || 50_000);

  const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15);
  const outDir = process.env.SNAPSHOT_OUT_DIR
    ? resolve(process.env.SNAPSHOT_OUT_DIR)
    : resolve(REPO_ROOT, 'snapshots', stamp);

  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    die(3, `output directory ${outDir} already exists and is non-empty — refusing to overwrite.`);
  }
  mkdirSync(outDir, { recursive: true });

  const headers = buildHeaders(apiKey, siteId);
  const capturedAtIso = new Date().toISOString();
  console.log(`[snapshot-wix-data] writing to ${outDir}`);
  console.log(`[snapshot-wix-data] ${SNAPSHOT_COLLECTIONS.length} collections, limit ${limitPerCollection}/each`);

  const results = [];
  let totalRows = 0;

  for (const id of SNAPSHOT_COLLECTIONS) {
    process.stdout.write(`[snapshot-wix-data] ${id}…`);
    try {
      const items = await fetchAllItems({ headers, collectionId: id, limitPerCollection });
      const path = resolve(outDir, `${id}.json`);
      writeFileSync(path, JSON.stringify({ collectionId: id, capturedAtIso, items }, null, 2) + '\n');
      results.push({ id, status: 'ok', count: items.length });
      totalRows += items.length;
      console.log(` ${items.length}`);
    } catch (err) {
      // 404 means the collection doesn't exist on this site — common for
      // new collections that haven't been provisioned. Treat as a soft
      // miss; press on rather than abort the whole snapshot.
      if (err.status === 404) {
        results.push({ id, status: 'missing' });
        console.log(' (missing)');
        continue;
      }
      results.push({ id, status: 'error', error: err.message });
      console.log(` ERROR: ${err.message.slice(0, 80)}`);
      // Hard auth/scope failure — bail out so the operator can fix the
      // key rather than fill the output dir with empty error stubs.
      if (err.status === 401 || err.status === 403) {
        const summary = buildManifestSummary({ outDir, capturedAtIso, results, totalRows });
        writeFileSync(resolve(outDir, 'MANIFEST.md'), summary + '\n');
        die(2, `auth rejection on ${id} (${err.status}). Partial snapshot at ${outDir}.`);
      }
    }
  }

  const summary = buildManifestSummary({ outDir, capturedAtIso, results, totalRows });
  writeFileSync(resolve(outDir, 'MANIFEST.md'), summary + '\n');
  console.log(`[snapshot-wix-data] done. ${totalRows} total rows. summary at ${resolve(outDir, 'MANIFEST.md')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[snapshot-wix-data] unhandled error: ${err.stack || err.message}`);
    process.exit(2);
  });
}
