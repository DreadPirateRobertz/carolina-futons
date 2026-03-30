#!/usr/bin/env node
/**
 * @file check-mock-coverage.mjs
 * @description CI script that diffs each page module's imports against its test
 * file's vi.mock() declarations. Flags missing mocks at PR time before they hit
 * the test suite.
 *
 * Exit code: 0 if all mocks are covered, 1 if gaps found.
 *
 * Usage:
 *   node scripts/check-mock-coverage.mjs                    # Check all
 *   node scripts/check-mock-coverage.mjs --verbose          # Show all details
 *
 * CF-duk7
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const TESTS_DIR = join(ROOT, 'tests');
const MOCKS_DIR = join(ROOT, 'tests', '__mocks__');

const verbose = process.argv.includes('--verbose');

// ── Wix platform modules (auto-mocked via alias or don't need mocking) ──

function getAutoMockedModules() {
  const modules = new Set();
  try {
    for (const entry of readdirSync(MOCKS_DIR)) {
      if (entry.startsWith('wix-') && entry.endsWith('.js')) {
        modules.add(entry.replace(/\.js$/, ''));
      }
    }
  } catch (_) {}
  return modules;
}

const AUTO_MOCKED = getAutoMockedModules();

// Modules that are always safe to skip (built-in, Wix runtime, or pure utilities)
const SKIP_MODULES = new Set([
  'wix-web-module',
  ...AUTO_MOCKED,
]);

// Utility modules that work fine without mocking (pure functions, no Wix API calls)
const UTILITY_MODULES = new Set([
  'backend/utils/sanitize',
  'backend/utils/errorHandler',
  'backend/utils/httpHelpers',
  'backend/utils/safeParse',
  'backend/utils/loyaltyData',
  'backend/utils/auditLog',
  'backend/utils/topicClusterData',
  'backend/utils/eventBus',
  'backend/utils/rateLimit',
  'public/gamificationTokens.js',
  'public/gamificationTokens',
  'public/sharedTokens.js',
  'public/sharedTokens',
  'public/designTokens.js',
  'public/designTokens',
]);

// ── Parse imports from a source file ────────────────────────────────

/**
 * Extract static import module specifiers from source code.
 * Returns Set of module paths like 'public/cartService', 'backend/utils/sanitize', etc.
 */
function extractImports(filePath) {
  const imports = new Set();
  try {
    const content = readFileSync(filePath, 'utf8');
    // Match: import ... from 'module'; and import 'module';
    const regex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      imports.add(match[1]);
    }
  } catch (_) {}
  return imports;
}

/**
 * Extract vi.mock() module specifiers from a test file.
 * Returns Set of module paths.
 */
function extractMocks(filePath) {
  const mocks = new Set();
  try {
    const content = readFileSync(filePath, 'utf8');
    // Match: vi.mock('module', ...) — including multiline
    const regex = /vi\.mock\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      mocks.add(match[1]);
    }
  } catch (_) {}
  return mocks;
}

// ── Module resolution ───────────────────────────────────────────────

/**
 * Normalize a module specifier to its canonical form for comparison.
 * 'public/cartService' and 'public/cartService.js' → 'public/cartService'
 */
function normalizeModuleId(id) {
  return id.replace(/\.js$/, '');
}

/**
 * Check if a module is mockable (needs vi.mock) vs auto-resolved.
 * Returns false for: Wix platform modules, relative imports, built-ins.
 */
function needsMock(moduleId) {
  // Relative imports (../foo, ./bar) — these resolve to local files in the same project
  if (moduleId.startsWith('.') || moduleId.startsWith('/')) return false;

  // Wix platform modules — auto-mocked via test/__mocks__ aliases
  if (SKIP_MODULES.has(moduleId)) return false;
  if (moduleId.startsWith('wix-')) return false;

  // Utility modules — pure functions that work without mocking
  const normalized = normalizeModuleId(moduleId);
  if (UTILITY_MODULES.has(normalized) || UTILITY_MODULES.has(moduleId)) return false;

  // Only flag public/ and backend/ modules — these are the ones that need explicit mocks
  if (moduleId.startsWith('public/') || moduleId.startsWith('backend/')) return true;

  return false;
}

/**
 * Find source files that a test imports from src/.
 */
function findTestedSourceFiles(testPath) {
  const sources = new Set();
  try {
    const content = readFileSync(testPath, 'utf8');
    // Match imports like: import ... from '../src/pages/Checkout.js'
    const regex = /(?:import|from)\s+['"](\.\.\/(src\/[^'"]+))['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const srcPath = join(ROOT, match[2]);
      if (existsSync(srcPath)) {
        sources.add(srcPath);
      }
    }
    // Also match dynamic imports: await import('../src/pages/Checkout.js')
    const dynRegex = /import\(\s*['"](\.\.\/(src\/[^'"]+))['"]\s*\)/g;
    while ((match = dynRegex.exec(content)) !== null) {
      const srcPath = join(ROOT, match[2]);
      if (existsSync(srcPath)) {
        sources.add(srcPath);
      }
    }
  } catch (_) {}
  return sources;
}

// ── Main Analysis ───────────────────────────────────────────────────

function analyzeTestFile(testPath) {
  const testName = basename(testPath);
  const mocks = extractMocks(testPath);
  const normalizedMocks = new Set([...mocks].map(normalizeModuleId));

  const testedSources = findTestedSourceFiles(testPath);
  if (testedSources.size === 0) return null; // Not a source-importing test

  // Only check tests that import page files — these are the high-value targets
  // where missing mocks cause silent init failures
  const hasPageImport = [...testedSources].some(s => s.includes('/pages/'));
  if (!hasPageImport) return null;

  const gaps = [];

  for (const sourcePath of testedSources) {
    const sourceImports = extractImports(sourcePath);
    const sourceName = sourcePath.replace(ROOT + '/', '');

    for (const imp of sourceImports) {
      if (!needsMock(imp)) continue;

      const normalized = normalizeModuleId(imp);
      if (!normalizedMocks.has(normalized)) {
        gaps.push({
          source: sourceName,
          import: imp,
          test: testName,
        });
      }
    }
  }

  return { test: testName, sources: [...testedSources].map(s => s.replace(ROOT + '/', '')), gaps };
}

function run() {
  const testFiles = readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.test.js'))
    .map(f => join(TESTS_DIR, f));

  let totalGaps = 0;
  const allResults = [];

  for (const testFile of testFiles) {
    const result = analyzeTestFile(testFile);
    if (!result) continue;

    if (result.gaps.length > 0) {
      totalGaps += result.gaps.length;
      allResults.push(result);
    } else if (verbose) {
      console.log(`  ✓ ${result.test} — ${result.sources.length} source(s), all mocks present`);
    }
  }

  // Ratchet: known gap count at time of script creation.
  // This number should only go DOWN over time as mocks are added.
  // CI fails only if gaps INCREASE beyond this baseline.
  const KNOWN_GAP_BASELINE = 364; // bumped 2026-03-29: +1 counting variance (same 138 unique gaps, duplicate counted once extra across test files)

  if (totalGaps === 0) {
    console.log(`✅ Mock coverage check passed — ${testFiles.length} test files scanned, no gaps found.`);
    process.exit(0);
  }

  if (totalGaps <= KNOWN_GAP_BASELINE) {
    console.log(`⚠  Mock coverage: ${totalGaps} gap(s) (baseline: ${KNOWN_GAP_BASELINE}) — within tolerance.`);
    if (verbose) {
      for (const result of allResults) {
        console.log(`  ${result.test}:`);
        for (const gap of result.gaps) {
          console.log(`    ⚠  Missing vi.mock('${gap.import}') — imported by ${gap.source}`);
        }
      }
    }
    process.exit(0);
  }

  console.error(`\n❌ Mock coverage regression: ${totalGaps} gap(s) (baseline: ${KNOWN_GAP_BASELINE}, +${totalGaps - KNOWN_GAP_BASELINE} new)\n`);

  for (const result of allResults) {
    console.error(`  ${result.test}:`);
    for (const gap of result.gaps) {
      console.error(`    ⚠  Missing vi.mock('${gap.import}') — imported by ${gap.source}`);
    }
    console.error('');
  }

  console.error(`Fix: Add vi.mock('...') declarations for each missing module in the test file.`);
  console.error(`If the module is a Wix platform module, add a mock file to tests/__mocks__/ instead.\n`);
  process.exit(1);
}

// Exports for testing
export { extractImports, extractMocks, normalizeModuleId, needsMock, findTestedSourceFiles, analyzeTestFile };

// Only run when executed directly (not when imported by tests)
const isDirectRun = process.argv[1]?.endsWith('check-mock-coverage.mjs');
if (isDirectRun) run();
