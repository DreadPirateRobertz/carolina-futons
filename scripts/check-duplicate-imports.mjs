#!/usr/bin/env node
/**
 * check-duplicate-imports.mjs
 *
 * Scans JS source files for duplicate import declarations (same module imported
 * twice in one file). Duplicate imports are a symptom of bad merges and can
 * cause silent shadowing or runtime errors depending on the bundler.
 *
 * Usage:
 *   node scripts/check-duplicate-imports.mjs              # scan src/ + tests/
 *   node scripts/check-duplicate-imports.mjs file1 file2  # scan specific files
 *
 * Used by:
 *   - .husky/pre-commit (staged files only)
 *   - CI workflow (full repo scan on push/PR)
 *
 * CF-id8p — incident: CF-2fs8 (duplicate buildFooterMountainSVG import blocked CI)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const IMPORT_RE = /^\s*import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm;
const SRC_EXT = /\.(js|mjs|ts|jsx|tsx)$/;

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (SRC_EXT.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

function findDuplicateImports(src) {
  const counts = {};
  let m;
  const re = new RegExp(IMPORT_RE.source, IMPORT_RE.flags);
  while ((m = re.exec(src)) !== null) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  return Object.entries(counts).filter(([, n]) => n > 1).map(([mod]) => mod);
}

const targets = process.argv.slice(2);
const files = targets.length > 0
  ? targets.filter(f => SRC_EXT.test(f) && existsSync(f))
  : [...walk('src'), ...walk('tests')];

let found = 0;

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const dups = findDuplicateImports(content);
  if (dups.length > 0) {
    found++;
    console.error(`\n✗ Duplicate imports in: ${file}`);
    for (const mod of dups) {
      console.error(`  duplicate: '${mod}'`);
    }
  }
}

if (found > 0) {
  console.error(`\n✗ ${found} file(s) contain duplicate import declarations. Remove duplicates before committing.\n`);
  process.exit(1);
}

console.log(`✓ No duplicate imports found in ${files.length} file(s).`);
