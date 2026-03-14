#!/usr/bin/env node
/**
 * Element ID Validation — CF-03jx
 *
 * Cross-checks element-id-audit.json against actual $w('#...') usage in src/.
 * Reports IDs used in code but missing from audit, and audit IDs not found in code.
 *
 * Usage:
 *   node scripts/validate-element-ids.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = join(import.meta.dirname, '..', 'carolina-futons-stage3-velo', 'src');
const AUDIT_PATH = join(import.meta.dirname, 'element-id-audit.json');

if (!existsSync(SRC_DIR)) {
  console.error(`ERROR: Source directory not found: ${SRC_DIR}`);
  console.error(`Run this script from the repository root.`);
  process.exit(1);
}

if (!existsSync(AUDIT_PATH)) {
  console.error(`ERROR: Audit file not found: ${AUDIT_PATH}`);
  process.exit(1);
}

function collectFiles(dir, exts = ['.js']) {
  return readdirSync(dir, { recursive: true })
    .filter(f => exts.includes(extname(f)))
    .map(f => join(dir, f));
}

function extractSelectors(content) {
  const ids = new Set();
  for (const m of content.matchAll(/\$(?:w|item)\(['"`]#([a-zA-Z0-9_-]+)['"`]\)/g)) {
    ids.add(m[1]);
  }
  return ids;
}

function extractAuditIds(audit) {
  const ids = new Set();
  function walk(obj) {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && item.id) ids.add(item.id);
      }
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('_')) continue;
        walk(value);
      }
    }
  }
  walk(audit);
  return ids;
}

const files = collectFiles(SRC_DIR);
const codeIds = new Set();

for (const file of files) {
  try {
    const content = readFileSync(file, 'utf8');
    for (const id of extractSelectors(content)) {
      codeIds.add(id);
    }
  } catch (err) {
    console.warn(`  [WARN] Cannot read ${file}: ${err.message}`);
  }
}

const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8'));
const auditIds = extractAuditIds(audit);

const inCodeNotAudit = [...codeIds].filter(id => !auditIds.has(id)).sort();
const inAuditNotCode = [...auditIds].filter(id => !codeIds.has(id)).sort();

console.log(`\nElement ID Validation Report`);
console.log(`${'─'.repeat(50)}`);
console.log(`Code IDs found:  ${codeIds.size}`);
console.log(`Audit IDs found: ${auditIds.size}`);
console.log(`${'─'.repeat(50)}`);

if (inCodeNotAudit.length > 0) {
  console.log(`\nIn CODE but NOT in audit (${inCodeNotAudit.length}):`);
  for (const id of inCodeNotAudit) {
    console.log(`   - ${id}`);
  }
} else {
  console.log(`\nAll code IDs are documented in audit`);
}

if (inAuditNotCode.length > 0) {
  console.log(`\nIn AUDIT but NOT in code (${inAuditNotCode.length}):`);
  for (const id of inAuditNotCode) {
    console.log(`   - ${id}`);
  }
} else {
  console.log(`\nAll audit IDs are referenced in code`);
}

console.log(`\n${'─'.repeat(50)}`);
const overlapping = auditIds.size - inAuditNotCode.length;
const pct = codeIds.size > 0 ? ((overlapping / codeIds.size) * 100).toFixed(1) : '0.0';
console.log(`Coverage: ${overlapping}/${codeIds.size} code IDs documented (${pct}%)`);

if (inCodeNotAudit.length > 0) {
  process.exit(1);
}
