/**
 * cf-3qt.6 parity — Playwright visual diff.
 *
 * For each (page, breakpoint) pair in pages.json, capture screenshots on both
 * LEGACY_BASE and NEXT_BASE, diff them with pixelmatch, and emit a PNG diff
 * plus a per-page percentage. Flags pages exceeding thresholds.visualDiffPctMax.
 *
 * Runs once LEGACY_BASE + NEXT_BASE env vars are set. Reports land under
 * parity/reports/<YYYY-MM-DD>/visual/.
 *
 * Requires (install at activation):
 *   npm i -D @playwright/test pixelmatch pngjs
 *   npx playwright install chromium
 */

import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg       = JSON.parse(await fs.readFile(path.join(__dirname, 'pages.json'), 'utf-8'));
const LEGACY    = process.env.LEGACY_BASE;
const NEXT      = process.env.NEXT_BASE;
const REPORT    = path.join(__dirname, 'reports', new Date().toISOString().slice(0, 10), 'visual');

test.beforeAll(async () => {
  if (!LEGACY || !NEXT) throw new Error('Set LEGACY_BASE and NEXT_BASE');
  await fs.mkdir(REPORT, { recursive: true });
});

for (const page of cfg.pages) {
  // Skip auth-gated pages in the default run — handled by a separate auth suite.
  if (page.auth) continue;

  for (const bp of cfg.breakpoints) {
    test(`${page.id} @ ${bp.id}`, async ({ page: browserPage }, testInfo) => {
      testInfo.setTimeout(60_000);
      await browserPage.setViewportSize({ width: bp.width, height: bp.height });

      const shots = {};
      for (const [label, base, urlPath] of [
        ['legacy', LEGACY, page.legacy],
        ['next',   NEXT,   page.next],
      ]) {
        const url = base + urlPath;
        const res = await browserPage.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
        if (page.expectStatus) {
          expect(res?.status()).toBe(page.expectStatus);
        }
        shots[label] = await browserPage.screenshot({ fullPage: true });
      }

      // Lazy-load pixelmatch + pngjs only when the test runs.
      const [{ default: pixelmatch }, { PNG }] = await Promise.all([
        import('pixelmatch'),
        import('pngjs'),
      ]);

      const legacyPng = PNG.sync.read(shots.legacy);
      const nextPng   = PNG.sync.read(shots.next);

      // Resize the smaller image by clamping diff to intersection.
      const w = Math.min(legacyPng.width,  nextPng.width);
      const h = Math.min(legacyPng.height, nextPng.height);
      const diff = new PNG({ width: w, height: h });

      const mismatched = pixelmatch(
        legacyPng.data.subarray(0, w * h * 4),
        nextPng.data.subarray(0, w * h * 4),
        diff.data,
        w, h, { threshold: 0.1 },
      );

      const pct = (mismatched / (w * h)) * 100;

      const dir = path.join(REPORT, page.id, bp.id);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'legacy.png'), shots.legacy);
      await fs.writeFile(path.join(dir, 'next.png'),   shots.next);
      await fs.writeFile(path.join(dir, 'diff.png'),   PNG.sync.write(diff));
      await fs.writeFile(path.join(dir, 'pct.txt'),    pct.toFixed(4));

      expect(pct).toBeLessThanOrEqual(cfg.thresholds.visualDiffPctMax);
    });
  }
}
