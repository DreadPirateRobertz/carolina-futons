#!/usr/bin/env node
/**
 * @file check-http-endpoint-test-coverage.mjs
 * @description CI gate that fails when src/backend/http-functions.js gains a
 * new HTTP-method export (post_X / get_X / put_X / delete_X / patch_X)
 * without a corresponding test reference in tests/.
 *
 * Triggered by radahn's cf-vtx5 cluster retro: the IDOR gaps caught in
 * cf-yvs4 / #1173 + cf-9ieq landed because new endpoints can ship without a
 * test that exercises them. This guard codifies the rennala-pattern check
 * automatically — a new export with no test reference is a CI failure.
 *
 * Allow-list: tests/.http-endpoint-baseline.json holds exports that were
 * already uncovered when this gate was introduced. New gaps fail; existing
 * gaps pass (until someone backfills them, at which point they should be
 * removed from the baseline). This is the same ratchet pattern as
 * scripts/check-mock-coverage.mjs.
 *
 * Exit code: 0 if no new gaps, 1 if any new export lacks a test reference,
 * 2 on internal error (parse failure, missing files, etc).
 *
 * Usage:
 *   node scripts/check-http-endpoint-test-coverage.mjs           # check
 *   node scripts/check-http-endpoint-test-coverage.mjs --list    # print all
 *                                                                # exports +
 *                                                                # coverage
 *
 * cf-2gux follow-up — radahn cluster-retro suggestion.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HTTP_FUNCTIONS = join(ROOT, 'src', 'backend', 'http-functions.js');
const TESTS_DIR = join(ROOT, 'tests');
const BASELINE_FILE = join(TESTS_DIR, '.http-endpoint-baseline.json');

const HTTP_METHOD_PREFIXES = ['post_', 'get_', 'put_', 'delete_', 'patch_'];

function die(msg, code = 2) {
  console.error(`check-http-endpoint-test-coverage: ${msg}`);
  process.exit(code);
}

function parseExports(src) {
  // Match: export (async)? function post_foo(  | export function get_bar(
  // Anchored to start-of-line to avoid catching commented-out code (which is
  // typically prefixed with whitespace + //) and avoid matching strings.
  const re = new RegExp(
    `^export\\s+(?:async\\s+)?function\\s+((?:${HTTP_METHOD_PREFIXES.join('|')})\\w+)\\s*\\(`,
    'gm',
  );
  const found = [];
  for (const m of src.matchAll(re)) {
    found.push(m[1]);
  }
  return found;
}

function walkTestFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '__mocks__') continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      out.push(...walkTestFiles(full));
    } else if (/\.(test|spec)\.(js|mjs|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function buildTestCorpus() {
  if (!existsSync(TESTS_DIR)) die(`tests/ directory not found at ${TESTS_DIR}`);
  const files = walkTestFiles(TESTS_DIR);
  const map = new Map(); // exportName -> [testFile, ...]
  // Pre-read all files into memory once. Repo has < 2k test files; cheap.
  const contents = files.map((f) => ({ file: f, src: readFileSync(f, 'utf8') }));
  return contents;
}

function hasReference(exportName, testCorpus) {
  // A test "references" an export if the literal export name appears in the
  // file. Most tests do `import { post_foo } from '../src/backend/http-functions.js'`
  // — that single literal hit is what we detect. Some tests import via
  // dispatchers (post_wishlistService -> dispatched modules), in which case
  // the test references the dispatcher name, not the inner method names —
  // see tests/cfvtx5Dispatchers.test.js which references post_gamificationCore
  // etc. Either pattern produces a hit.
  const needle = exportName;
  for (const { src } of testCorpus) {
    if (src.includes(needle)) return true;
  }
  return false;
}

function loadBaseline() {
  if (!existsSync(BASELINE_FILE)) {
    return { uncovered: [], description: '' };
  }
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
  } catch (e) {
    die(`failed to parse baseline ${BASELINE_FILE}: ${e.message}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const wantList = args.includes('--list');

  if (!existsSync(HTTP_FUNCTIONS)) die(`http-functions.js not found at ${HTTP_FUNCTIONS}`);
  const src = readFileSync(HTTP_FUNCTIONS, 'utf8');
  const exports = parseExports(src);
  if (exports.length === 0) die('no HTTP-method exports parsed — regex may be broken');

  const corpus = buildTestCorpus();
  const baseline = loadBaseline();
  const baselineSet = new Set(baseline.uncovered || []);

  const covered = [];
  const newGaps = [];
  const baselineGaps = [];
  const baselineNoLongerNeeded = [];

  for (const ex of exports) {
    if (hasReference(ex, corpus)) {
      covered.push(ex);
      if (baselineSet.has(ex)) baselineNoLongerNeeded.push(ex);
    } else {
      if (baselineSet.has(ex)) baselineGaps.push(ex);
      else newGaps.push(ex);
    }
  }

  if (wantList) {
    console.log(`HTTP exports in ${HTTP_FUNCTIONS.replace(ROOT + '/', '')}: ${exports.length}`);
    console.log(`  covered:                         ${covered.length}`);
    console.log(`  uncovered (in baseline):         ${baselineGaps.length}`);
    console.log(`  uncovered (NEW — would fail CI): ${newGaps.length}`);
    if (baselineGaps.length) {
      console.log(`\nBaseline gaps:`);
      for (const ex of baselineGaps) console.log(`  ○ ${ex}`);
    }
    if (newGaps.length) {
      console.log(`\nNew gaps:`);
      for (const ex of newGaps) console.log(`  ✗ ${ex}`);
    }
    if (baselineNoLongerNeeded.length) {
      console.log(`\nBaseline entries that are now covered (recommend removing from ${BASELINE_FILE.replace(ROOT + '/', '')}):`);
      for (const ex of baselineNoLongerNeeded) console.log(`  ↑ ${ex}`);
    }
    return;
  }

  if (newGaps.length === 0) {
    console.log(
      `check-http-endpoint-test-coverage: OK — ${covered.length}/${exports.length} exports referenced by tests/ ` +
      `(${baselineGaps.length} pre-existing gaps in baseline).`,
    );
    if (baselineNoLongerNeeded.length) {
      console.log(
        `\nNote: ${baselineNoLongerNeeded.length} export(s) in tests/.http-endpoint-baseline.json now have ` +
        `test coverage. Consider removing: ${baselineNoLongerNeeded.join(', ')}`,
      );
    }
    return;
  }

  console.error(`\ncheck-http-endpoint-test-coverage: FAIL — ${newGaps.length} new HTTP export(s) without test coverage:\n`);
  for (const ex of newGaps) {
    console.error(`  ✗ ${ex}  (no tests/ file references the symbol)`);
  }
  console.error(`\nFix one of:`);
  console.error(`  1. (preferred) Add a test that imports the symbol from src/backend/http-functions.js.`);
  console.error(`     Pattern reference: tests/notifyMe.http.test.js, tests/communityPhoto.test.js,`);
  console.error(`     or tests/cfvtx5Dispatchers.test.js for module-dispatcher style.`);
  console.error(`  2. (only with reviewer sign-off) Add the export to tests/.http-endpoint-baseline.json`);
  console.error(`     and document the reason in this PR description.`);
  process.exit(1);
}

main();
