/**
 * @file jobsConfigIntegrity.test.js
 * @description cf-4x7e.fu1 regression guard. Wix Jobs Scheduler resolves
 * each cron-entry key (e.g. `processEmailQueue`) as the name of the
 * function exported by the file at `functionLocation`. If the file is
 * deleted (cf-4x7e SUPERSEDE) or the export is renamed, the cron entry
 * silently fails at runtime — the cf-hpwy v2 detector can't catch it
 * because jobs.config isn't a JS source file.
 *
 * This test parses jobs.config statically and verifies, for every cron
 * entry:
 *   1. The file at `functionLocation` exists in src/backend/.
 *   2. The file exports a top-level function named after the cron-entry
 *      key (via `export const NAME = ...`, `export function NAME`, or
 *      `export async function NAME`).
 *
 * Failures are loud and name the offending cron + file so a future
 * cf-4x7e chunk can't ship a deletion that breaks production cron.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const JOBS_CONFIG_PATH = resolve(REPO_ROOT, 'src/backend/jobs.config');
const BACKEND_DIR = resolve(REPO_ROOT, 'src/backend');

function parseJobsConfig() {
  const text = readFileSync(JOBS_CONFIG_PATH, 'utf8');
  const re = /^\s*(\w+):\s*\{\s*\n\s*functionLocation:\s*['"](\/[^'"]+)['"]/gm;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ name: m[1], location: m[2] });
  }
  return out;
}

function fileHasExport(filePath, exportName) {
  if (!existsSync(filePath)) return false;
  const src = readFileSync(filePath, 'utf8');
  const escaped = exportName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`^export\\s+(?:async\\s+)?(?:const|function)\\s+${escaped}\\b`, 'm');
  return re.test(src);
}

describe('jobs.config — every cron entry resolves to a real export', () => {
  const entries = parseJobsConfig();

  it('found at least one cron entry (sanity)', () => {
    expect(entries.length).toBeGreaterThan(5);
  });

  for (const { name, location } of entries) {
    it(`${name} — file ${location} exists and exports ${name}`, () => {
      const filePath = resolve(BACKEND_DIR, location.replace(/^\//, ''));
      expect(existsSync(filePath), `file missing for cron ${name}: ${location}`).toBe(true);
      expect(
        fileHasExport(filePath, name),
        `cron ${name} declared in jobs.config but no matching export in ${location}`,
      ).toBe(true);
    });
  }
});
