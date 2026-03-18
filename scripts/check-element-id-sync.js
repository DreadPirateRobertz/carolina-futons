#!/usr/bin/env node
/**
 * check-element-id-sync.js -- CF-p3ri
 *
 * Reads element IDs from packages/hookup-assistant/src/data/pages.ts and
 * validates that each ID appears in its corresponding src/pages/*.js file
 * as a $w('#elementId') selector.
 *
 * Exits 0 always (warning-only, non-blocking CI step).
 * Set --fail flag to exit 1 on mismatches (strict mode).
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/**
 * Parse element IDs from pages.ts source text.
 * Returns array of { pageFile, elementId } objects.
 *
 * @param {string} source - Raw TypeScript source of pages.ts
 * @returns {{ pageFile: string, elementId: string }[]}
 */
export function parseElementIds(source) {
  const results = [];
  // Split into per-page chunks at each `file:` declaration
  const chunks = source.split(/(?=\bfile:\s*['"])/);

  for (const chunk of chunks) {
    const fileMatch = /file:\s*['"]([^'"]+)['"]/.exec(chunk);
    if (!fileMatch) continue;
    const rawFile = fileMatch[1];

    // Skip multi-file entries like 'fileA.js + fileB.js'
    if (rawFile.includes('+')) continue;

    const idRe = /\{\s*id:\s*['"]([^'"]+)['"]/g;
    let idMatch;
    while ((idMatch = idRe.exec(chunk)) !== null) {
      results.push({ pageFile: rawFile, elementId: idMatch[1] });
    }
  }

  return results;
}

/**
 * Resolve pages.ts page file name to actual src/pages/*.js path.
 * pages.ts may use 'Home.c1dmp.js' but the real file is 'Home.js'.
 * Strategy: try exact match, then strip hash segment.
 *
 * @param {string} pageFile - File name from pages.ts (e.g. 'Home.c1dmp.js')
 * @param {string} pagesDir - Absolute path to src/pages/
 * @returns {string|null} - Absolute path if found, null otherwise
 */
export function resolvePageFile(pageFile, pagesDir) {
  const exact = join(pagesDir, pageFile);
  if (existsSync(exact)) return exact;

  // Strip hash segment: 'Home.c1dmp.js' -> 'Home.js'
  const stripped = pageFile.replace(/\.[a-z0-9]{4,8}\.js$/, '.js');
  const strippedPath = join(pagesDir, stripped);
  if (existsSync(strippedPath)) return strippedPath;

  return null;
}

/**
 * Check whether an element ID appears in page source as a $w selector.
 * Looks for: $w('#elementId') or $w("#elementId")
 *
 * @param {string} source - Page file source text
 * @param {string} elementId - Element ID to search for
 * @returns {boolean}
 */
export function elementIdUsedInSource(source, elementId) {
  const escaped = elementId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\$w\\([\'"]#' + escaped + '[\'"]\\)');
  return re.test(source);
}

/**
 * Run the full sync check.
 *
 * @param {object} options
 * @param {string} [options.root] - Repo root (default: auto-detected)
 * @param {boolean} [options.fail] - If true, exit 1 on mismatches
 * @param {boolean} [options.quiet] - Suppress stdout output
 * @returns {{ mismatches: Array, skipped: string[], checked: number }}
 */
export function runSyncCheck({ root = ROOT, fail = false, quiet = false } = {}) {
  const pagesTs = join(root, 'packages/hookup-assistant/src/data/pages.ts');
  const pagesDir = join(root, 'src/pages');

  if (!existsSync(pagesTs)) {
    throw new Error(`pages.ts not found at ${pagesTs}`);
  }

  const source = readFileSync(pagesTs, 'utf8');
  const entries = parseElementIds(source);

  const byFile = new Map();
  for (const { pageFile, elementId } of entries) {
    if (!byFile.has(pageFile)) byFile.set(pageFile, new Set());
    byFile.get(pageFile).add(elementId);
  }

  const mismatches = [];
  const skipped = [];
  let checked = 0;

  for (const [pageFile, elementIds] of byFile) {
    const resolvedPath = resolvePageFile(pageFile, pagesDir);

    if (!resolvedPath) {
      skipped.push(pageFile);
      if (!quiet) {
        console.warn(`[SKIP] ${pageFile} -- no matching src/pages file found`);
      }
      continue;
    }

    const pageSource = readFileSync(resolvedPath, 'utf8');
    const resolvedFile = resolvedPath.replace(root + '/', '');

    for (const elementId of elementIds) {
      checked++;
      if (!elementIdUsedInSource(pageSource, elementId)) {
        mismatches.push({ pageFile, resolvedFile, elementId });
      }
    }
  }

  if (!quiet) {
    console.log('\n=== Element ID Sync Check (CF-p3ri) ===');
    console.log(`Checked: ${checked} element IDs across ${byFile.size - skipped.length} page files`);
    console.log(`Skipped: ${skipped.length} page files (no matching src/pages file)`);
    console.log(`Mismatches: ${mismatches.length}\n`);

    if (mismatches.length > 0) {
      console.warn('::warning:: The following element IDs from pages.ts are not used in their page source:');
      for (const { pageFile, resolvedFile, elementId } of mismatches) {
        console.warn(`  [MISMATCH] ${pageFile} / ${resolvedFile} -- #${elementId} not found as $w('#${elementId}')`);
      }
      console.warn('\nThese IDs may need to be assigned in the editor or removed from pages.ts.');
    } else {
      console.log('All element IDs are referenced in their page source files.');
    }
  }

  if (fail && mismatches.length > 0) {
    process.exit(1);
  }

  return { mismatches, skipped, checked };
}

// CLI entry point
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const fail = process.argv.includes('--fail');
  runSyncCheck({ fail });
}
