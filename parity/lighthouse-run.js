#!/usr/bin/env node
/**
 * cf-3qt.6 parity — Lighthouse runner.
 *
 * For each page in parity/pages.json, run Lighthouse against both
 * LEGACY_BASE and NEXT_BASE, write JSON + HTML reports to
 * parity/reports/<YYYY-MM-DD>/<pageId>/<base>.{json,html}, and emit a
 * summary.json with the delta per category.
 *
 * Exit codes:
 *   0 — every page meets thresholds defined in pages.json
 *   1 — one or more pages regress more than the configured threshold
 *   2 — config or runtime error (missing env, bad URL, etc.)
 *
 * Intentionally standalone — no Vitest, no transpilation. Run via `node`.
 *
 * Requires (install at activation):
 *   npm i -D lighthouse chrome-launcher
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'pages.json');
const LEGACY_BASE = process.env.LEGACY_BASE;
const NEXT_BASE   = process.env.NEXT_BASE;
const REPORT_ROOT = path.join(__dirname, 'reports', new Date().toISOString().slice(0, 10));

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

async function main() {
  if (!LEGACY_BASE || !NEXT_BASE) {
    console.error('[parity] Set LEGACY_BASE and NEXT_BASE env vars.');
    process.exit(2);
  }

  const { default: lighthouse } = await import('lighthouse').catch(() => ({}));
  const chromeLauncher         = await import('chrome-launcher').catch(() => ({}));
  if (!lighthouse || !chromeLauncher.launch) {
    console.error('[parity] Missing deps. Run: npm i -D lighthouse chrome-launcher');
    process.exit(2);
  }

  const cfg = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
  const thresholds = cfg.thresholds.lighthouse;

  await fs.mkdir(REPORT_ROOT, { recursive: true });

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
  const opts = { port: chrome.port, output: ['json', 'html'], logLevel: 'error' };

  const summary = { runAt: new Date().toISOString(), pages: [], regressions: [] };

  try {
    for (const page of cfg.pages) {
      const legacyUrl = LEGACY_BASE + page.legacy;
      const nextUrl   = NEXT_BASE   + page.next;
      const row = { id: page.id, phase: page.phase, legacy: {}, next: {}, delta: {} };

      for (const [label, url] of [['legacy', legacyUrl], ['next', nextUrl]]) {
        const result = await lighthouse(url, opts);
        const pageDir = path.join(REPORT_ROOT, page.id);
        await fs.mkdir(pageDir, { recursive: true });
        await fs.writeFile(path.join(pageDir, `${label}.json`), result.report[0]);
        await fs.writeFile(path.join(pageDir, `${label}.html`), result.report[1]);
        row[label] = Object.fromEntries(CATEGORIES.map(c => [c, result.lhr.categories[c].score]));
      }

      for (const c of CATEGORIES) {
        row.delta[c] = (row.next[c] ?? 0) - (row.legacy[c] ?? 0);
        if (row.delta[c] < -thresholds[c]) {
          summary.regressions.push({ page: page.id, category: c, delta: row.delta[c] });
        }
      }
      summary.pages.push(row);
      console.log(`[parity] ${page.id.padEnd(22)} perf Δ=${row.delta.performance.toFixed(2)}  a11y Δ=${row.delta.accessibility.toFixed(2)}`);
    }
  } finally {
    await chrome.kill();
  }

  await fs.writeFile(path.join(REPORT_ROOT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`[parity] wrote ${REPORT_ROOT}/summary.json — ${summary.regressions.length} regressions`);
  process.exit(summary.regressions.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('[parity] fatal:', e); process.exit(2); });
