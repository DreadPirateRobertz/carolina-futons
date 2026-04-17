#!/usr/bin/env node
/**
 * cf-3qt.7 prep — Google Search Console URL pull.
 *
 * Pulls every indexed URL for carolinafutons.com over the last 16 months
 * (GSC's maximum history) so we can build a 301 redirect map that covers
 * 100% of what Google currently knows about the Wix Studio site.
 *
 * Output: scripts/gsc-indexed-urls.json — { fetchedAt, siteUrl, urls: [{ url, clicks, impressions }] }
 *
 * Activation (once millicent provisions a GSC service account):
 *   npm i -D googleapis
 *   export GSC_SERVICE_ACCOUNT_KEY=/path/to/service-account.json
 *   export GSC_SITE_URL=sc-domain:carolinafutons.com    # or https://www.carolinafutons.com/
 *   node scripts/gsc-url-pull.js
 *
 * Until activated: this script exits with code 2 and prints the activation
 * checklist so CI can wire it up but not fail silently.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH  = path.join(__dirname, 'gsc-indexed-urls.json');

const KEY  = process.env.GSC_SERVICE_ACCOUNT_KEY;
const SITE = process.env.GSC_SITE_URL;
const ROW_LIMIT = 25_000;                                       // GSC max per request
const MONTHS_BACK = 16;                                         // GSC max history

function daysBack(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!KEY || !SITE) {
    console.error('[gsc] Missing GSC_SERVICE_ACCOUNT_KEY or GSC_SITE_URL.');
    console.error('[gsc] Activation checklist:');
    console.error('       1. Create GCP service account, grant Search Console access');
    console.error('       2. Add the service account email as a GSC property user (Full role)');
    console.error('       3. Export: GSC_SERVICE_ACCOUNT_KEY=<path>  GSC_SITE_URL=<sc-domain:…>');
    console.error('       4. npm i -D googleapis');
    process.exit(2);
  }

  const { google } = await import('googleapis').catch(() => ({}));
  if (!google) {
    console.error('[gsc] Missing googleapis. Run: npm i -D googleapis');
    process.exit(2);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const webmasters = google.webmasters({ version: 'v3', auth });

  const startDate = daysBack(MONTHS_BACK * 30);
  const endDate   = daysBack(3);                                // GSC lags ~2-3 days

  const urls = new Map();
  let startRow = 0;
  let batch = 0;
  while (true) {
    batch++;
    const { data } = await webmasters.searchanalytics.query({
      siteUrl: SITE,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: ROW_LIMIT,
        startRow,
      },
    });
    const rows = data.rows || [];
    for (const r of rows) {
      const u = r.keys[0];
      urls.set(u, {
        url: u,
        clicks: (urls.get(u)?.clicks || 0) + (r.clicks || 0),
        impressions: (urls.get(u)?.impressions || 0) + (r.impressions || 0),
      });
    }
    console.log(`[gsc] batch ${batch}: +${rows.length} rows (total ${urls.size})`);
    if (rows.length < ROW_LIMIT) break;
    startRow += ROW_LIMIT;
  }

  const out = {
    fetchedAt: new Date().toISOString(),
    siteUrl:   SITE,
    range:     { startDate, endDate },
    urls:      [...urls.values()].sort((a, b) => b.impressions - a.impressions),
  };
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`[gsc] wrote ${OUT_PATH} — ${out.urls.length} unique URLs`);
}

main().catch(e => { console.error('[gsc] fatal:', e); process.exit(2); });
