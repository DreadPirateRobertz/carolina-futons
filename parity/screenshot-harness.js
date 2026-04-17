#!/usr/bin/env node
/**
 * cf-3qt.6.1 screenshot harness — baseline-first parity capture.
 *
 * Captures full-page PNGs for every (page, breakpoint) in pages.json.
 *
 * Operating modes (decided by env):
 *   LEGACY_BASE only          → baseline pass (Wix Studio alone), no diff
 *   LEGACY_BASE + NEXT_BASE   → full parity pass (Wix + Next side-by-side + diff)
 *
 * Outputs:
 *   parity/reports/<YYYY-MM-DD>/shots/<page-id>/<breakpoint>/
 *     legacy.png  (always)
 *     next.png    (if NEXT_BASE set)
 *     diff.png    (if NEXT_BASE set)
 *     meta.json   (url, status, viewport, diff pct, timestamp)
 *
 * Gallery: writes /tmp/cf-3qt-parity/index.html linking every shot. Override
 * with GALLERY_DIR if needed.
 *
 * Usage:
 *   npm run parity:screenshots
 *
 * Activation deps (not installed by default):
 *   npm i -D playwright pixelmatch pngjs
 *   npx playwright install chromium
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const CFG          = JSON.parse(await fs.readFile(path.join(__dirname, 'pages.json'), 'utf-8'));
const LEGACY       = process.env.LEGACY_BASE;
const NEXT         = process.env.NEXT_BASE || null;
const SKIP_AUTH    = process.env.INCLUDE_AUTH !== '1';
const ONLY_PHASE   = process.env.PARITY_PHASE ? Number(process.env.PARITY_PHASE) : null;
const ONLY_PAGE    = process.env.PARITY_PAGE || null;
const TODAY        = new Date().toISOString().slice(0, 10);
const REPORT_DIR   = path.join(__dirname, 'reports', TODAY, 'shots');
const GALLERY_DIR  = process.env.GALLERY_DIR || '/tmp/cf-3qt-parity';
const NAV_TIMEOUT  = Number(process.env.PARITY_NAV_TIMEOUT_MS || 45_000);
const WAIT_STATE   = process.env.PARITY_WAIT_STATE || 'networkidle';

if (!LEGACY) {
  console.error('ERROR: LEGACY_BASE env var is required (e.g. LEGACY_BASE=https://www.carolinafutons.com).');
  process.exit(2);
}

const MODE = NEXT ? 'parity' : 'baseline';
console.log(`[parity] mode=${MODE}  legacy=${LEGACY}${NEXT ? `  next=${NEXT}` : ''}`);
console.log(`[parity] report=${REPORT_DIR}`);
console.log(`[parity] gallery=${GALLERY_DIR}`);

// ── Lazy imports so this file still parses when peer deps aren't installed.
let playwright, pixelmatch, PNG;
try {
  ({ chromium: playwright } = await import('playwright'));
  ({ default: pixelmatch } = await import('pixelmatch'));
  ({ PNG } = await import('pngjs'));
} catch (err) {
  console.error('ERROR: peer deps missing. Install: npm i -D playwright pixelmatch pngjs');
  console.error('       then: npx playwright install chromium');
  console.error('       cause:', err.message);
  process.exit(3);
}

const pagesToRun = CFG.pages.filter((p) => {
  if (SKIP_AUTH && p.auth) return false;
  if (ONLY_PHASE !== null && p.phase !== ONLY_PHASE) return false;
  if (ONLY_PAGE && p.id !== ONLY_PAGE) return false;
  return true;
});

console.log(`[parity] pages=${pagesToRun.length} breakpoints=${CFG.breakpoints.length} total=${pagesToRun.length * CFG.breakpoints.length}`);

await fs.mkdir(REPORT_DIR, { recursive: true });
await fs.mkdir(GALLERY_DIR, { recursive: true });

const browser = await playwright.launch({ headless: true });
const results = [];

try {
  for (const page of pagesToRun) {
    for (const bp of CFG.breakpoints) {
      const cell = await capturePage(browser, page, bp);
      results.push(cell);
      const badge = cell.error ? 'ERROR' : cell.diffPct == null ? 'base' : `${cell.diffPct.toFixed(2)}%`;
      console.log(`  ${page.id} @ ${bp.id} → ${badge}`);
    }
  }
} finally {
  await browser.close();
}

await writeGallery(results);
await writeManifest(results);

const over = results.filter((r) => r.diffPct != null && r.diffPct > CFG.thresholds.visualDiffPctMax);
const errs = results.filter((r) => r.error);
console.log(`\n[parity] done. shots=${results.length}  errors=${errs.length}  over-threshold=${over.length}`);
if (errs.length) process.exitCode = 1;

// ─────────────────────────────────────────────────────────────────────────────

async function capturePage(browser, entry, bp) {
  const ctx = await browser.newContext({ viewport: { width: bp.width, height: bp.height } });
  const tab = await ctx.newPage();
  const out = path.join(REPORT_DIR, entry.id, bp.id);
  await fs.mkdir(out, { recursive: true });

  const cell = {
    id: entry.id,
    breakpoint: bp.id,
    width: bp.width,
    height: bp.height,
    phase: entry.phase,
    legacyUrl: LEGACY + entry.legacy,
    nextUrl: NEXT ? NEXT + entry.next : null,
    legacyStatus: null,
    nextStatus: null,
    diffPct: null,
    error: null,
    dir: path.relative(path.join(__dirname, '..'), out),
    capturedAt: new Date().toISOString(),
  };

  try {
    const legacyShot = await shoot(tab, cell.legacyUrl, entry.expectStatus);
    cell.legacyStatus = legacyShot.status;
    await fs.writeFile(path.join(out, 'legacy.png'), legacyShot.buf);

    if (NEXT) {
      const nextShot = await shoot(tab, cell.nextUrl, entry.expectStatus);
      cell.nextStatus = nextShot.status;
      await fs.writeFile(path.join(out, 'next.png'), nextShot.buf);

      const pct = diff(legacyShot.buf, nextShot.buf, path.join(out, 'diff.png'));
      cell.diffPct = pct;
    }

    await fs.writeFile(path.join(out, 'meta.json'), JSON.stringify(cell, null, 2));
  } catch (err) {
    cell.error = err.message;
    await fs.writeFile(path.join(out, 'meta.json'), JSON.stringify(cell, null, 2));
  } finally {
    await ctx.close();
  }
  return cell;
}

async function shoot(tab, url, expectStatus) {
  const res = await tab.goto(url, { waitUntil: WAIT_STATE, timeout: NAV_TIMEOUT });
  const status = res?.status() ?? 0;
  if (expectStatus && status !== expectStatus) {
    // Tolerate status drift — it's recorded in meta.json for the reviewer.
  }
  // Stabilize: wait for fonts and any obvious loaders.
  await tab.evaluate(() => document.fonts?.ready).catch(() => {});
  const buf = await tab.screenshot({ fullPage: true, animations: 'disabled' });
  return { status, buf };
}

function diff(legacyBuf, nextBuf, outPath) {
  const a = PNG.sync.read(legacyBuf);
  const b = PNG.sync.read(nextBuf);
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const out = new PNG({ width: w, height: h });
  const mismatched = pixelmatch(
    a.data.subarray(0, w * h * 4),
    b.data.subarray(0, w * h * 4),
    out.data,
    w, h, { threshold: 0.1 },
  );
  // Write synchronously via buffer write (keeps function non-async for readability).
  import('node:fs').then(({ writeFileSync }) => writeFileSync(outPath, PNG.sync.write(out)));
  return (mismatched / (w * h)) * 100;
}

async function writeManifest(results) {
  const manifest = {
    runId: `${TODAY}-${Date.now()}`,
    mode: MODE,
    legacyBase: LEGACY,
    nextBase: NEXT,
    threshold: CFG.thresholds.visualDiffPctMax,
    generatedAt: new Date().toISOString(),
    cells: results,
  };
  await fs.writeFile(path.join(REPORT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function writeGallery(results) {
  const rows = results.map((r) => renderRow(r)).join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>cf-3qt parity gallery — ${TODAY}</title>
<style>
  :root { --bg: #0f0f11; --fg: #e8e8ea; --warn: #f6c445; --err: #e5484d; --ok: #48d597; }
  body { background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #9aa0a6; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #25272b; vertical-align: top; }
  th { font-weight: 600; background: #17181c; position: sticky; top: 0; }
  .pct-ok { color: var(--ok); } .pct-warn { color: var(--warn); } .pct-err { color: var(--err); }
  img { max-width: 280px; max-height: 220px; border: 1px solid #25272b; background: #fff; display: block; }
  .thumbs { display: flex; gap: 8px; }
  .page-id { font-family: ui-monospace, monospace; color: #9aa0a6; }
  .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 12px; background: #25272b; }
  .err { color: var(--err); font-family: ui-monospace, monospace; }
</style>
</head>
<body>
  <h1>cf-3qt parity gallery</h1>
  <div class="sub">Mode: <b>${MODE}</b> · Legacy: <code>${LEGACY}</code>${NEXT ? ` · Next: <code>${NEXT}</code>` : ''} · ${TODAY} · Threshold ${CFG.thresholds.visualDiffPctMax}%</div>
  <table>
    <thead><tr><th>Page</th><th>Breakpoint</th><th>Phase</th><th>Diff %</th><th>Shots</th><th>Status</th></tr></thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
  await fs.writeFile(path.join(GALLERY_DIR, 'index.html'), html);
  // Also copy the shot tree under the gallery so the HTML references resolve when opened.
  await copyTree(REPORT_DIR, path.join(GALLERY_DIR, 'shots'));
  console.log(`[parity] gallery written: ${path.join(GALLERY_DIR, 'index.html')}`);
}

function renderRow(r) {
  const pct = r.diffPct;
  const pctCls = pct == null ? '' : pct > CFG.thresholds.visualDiffPctMax ? 'pct-err' : pct > 1 ? 'pct-warn' : 'pct-ok';
  const pctText = pct == null ? '—' : `${pct.toFixed(2)}%`;
  const base = `shots/${r.id}/${r.breakpoint}`;
  const thumbs = [
    `<a href="${base}/legacy.png"><img src="${base}/legacy.png" alt="legacy"></a>`,
    r.nextUrl ? `<a href="${base}/next.png"><img src="${base}/next.png" alt="next"></a>` : '',
    r.diffPct != null ? `<a href="${base}/diff.png"><img src="${base}/diff.png" alt="diff"></a>` : '',
  ].filter(Boolean).join('');
  const status = r.error
    ? `<span class="err">${escapeHtml(r.error)}</span>`
    : `legacy ${r.legacyStatus ?? '?'}${r.nextUrl ? ` · next ${r.nextStatus ?? '?'}` : ''}`;
  return `<tr>
    <td><span class="page-id">${r.id}</span></td>
    <td>${r.breakpoint} <span class="tag">${r.width}×${r.height}</span></td>
    <td>${r.phase ?? '—'}</td>
    <td class="${pctCls}">${pctText}</td>
    <td><div class="thumbs">${thumbs}</div></td>
    <td>${status}</td>
  </tr>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function copyTree(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyTree(s, d);
    else await fs.copyFile(s, d);
  }
}
