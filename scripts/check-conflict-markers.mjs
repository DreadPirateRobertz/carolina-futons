#!/usr/bin/env node
/**
 * check-conflict-markers.mjs
 *
 * Scans JS/TS source files for unresolved git merge conflict markers.
 * Fails with exit code 1 if any are found, printing the file + line.
 *
 * Usage:
 *   node scripts/check-conflict-markers.mjs              # scan src/ + tests/
 *   node scripts/check-conflict-markers.mjs file1 file2  # scan specific files
 *
 * Used by:
 *   - .husky/pre-commit (staged files only)
 *   - CI workflow (full repo scan on push/PR)
 *
 * cf-i6xe
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const CONFLICT_RE = /^(<{7} |>{7}$|={7}$)/m;
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

  const lines = content.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (CONFLICT_RE.test(lines[i])) {
      hits.push({ line: i + 1, text: lines[i].slice(0, 80) });
    }
  }

  if (hits.length > 0) {
    found++;
    console.error(`\n✗ Conflict markers in: ${file}`);
    for (const { line, text } of hits) {
      console.error(`  line ${line}: ${text}`);
    }
  }
}

if (found > 0) {
  console.error(`\n✗ ${found} file(s) contain unresolved merge conflict markers. Resolve before committing.\n`);
  process.exit(1);
}

console.log(`✓ No conflict markers found in ${files.length} file(s).`);
