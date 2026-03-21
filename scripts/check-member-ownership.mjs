#!/usr/bin/env node
/**
 * IDOR guard: scan all SiteMember webMethods for ownership check pattern.
 *
 * Flags any SiteMember webMethod that:
 *   1. Accepts a memberId-like parameter (memberId, userId, contactId, etc.), AND
 *   2. Uses it in a wixData query (.eq(field, param)), AND
 *   3. Does NOT call currentMember.getMember() or getMember() in scope
 *
 * Exits with code 1 if violations found (for use in CI / pre-commit hook).
 * Run: node scripts/check-member-ownership.mjs
 *
 * CF-2za7: CI lint rule for SiteMember IDOR prevention
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const BACKEND_DIR = resolve(__dir, '../src/backend');

// Parameter names that indicate a memberId-like value
const MEMBER_ID_PARAMS = /\b(memberId|userId|contactId|memberParam|ownerId)\b/;

// Query patterns that use the param in a data query
const QUERY_PATTERN = /\.eq\s*\(/;

// Ownership check: calling getMember or currentMember
const OWNERSHIP_CHECK = /getMember\s*\(\)|currentMember\s*\./;

/**
 * Extract all SiteMember webMethod function bodies from a file's source text.
 * Returns array of {name, params, body, lineNumber} for each SiteMember webMethod.
 */
export function extractSiteMemberMethods(source) {
  const methods = [];
  // Match: export const NAME = webMethod(\n  Permissions.SiteMember,
  const methodRe = /export\s+const\s+(\w+)\s*=\s*webMethod\s*\(\s*Permissions\.SiteMember\s*,\s*(async\s+)?\(([^)]*)\)\s*=>\s*\{/g;
  let match;
  while ((match = methodRe.exec(source)) !== null) {
    const name = match[1];
    const params = match[3];
    const startIdx = match.index + match[0].length - 1; // position of opening '{'
    // Extract body by counting braces
    let depth = 1;
    let i = startIdx + 1;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    const body = source.slice(startIdx, i);
    const lineNumber = source.slice(0, match.index).split('\n').length;
    methods.push({ name, params, body, lineNumber });
  }
  return methods;
}

/**
 * Check a single SiteMember method for IDOR risk.
 * Returns { violation: boolean, reason?: string }
 */
export function checkMethodForIDOR(method) {
  const { name, params, body } = method;
  // Only flag if parameter looks like a memberId
  if (!MEMBER_ID_PARAMS.test(params)) return { violation: false };
  // Only flag if the body queries with that param
  if (!QUERY_PATTERN.test(body)) return { violation: false };
  // Check if ownership is verified
  if (OWNERSHIP_CHECK.test(body)) return { violation: false };
  return {
    violation: true,
    reason: `SiteMember webMethod '${name}' accepts memberId-like param and queries data without getMember() ownership check`,
  };
}

/**
 * Scan all backend .web.js files and collect IDOR violations.
 * @param {string} [backendDir]
 * @returns {{ file: string, name: string, line: number, reason: string }[]}
 */
export function scanBackendFiles(backendDir = BACKEND_DIR) {
  const violations = [];
  const files = readdirSync(backendDir).filter(f => f.endsWith('.web.js'));

  for (const file of files) {
    const filePath = join(backendDir, file);
    const source = readFileSync(filePath, 'utf8');
    const methods = extractSiteMemberMethods(source);

    for (const method of methods) {
      const result = checkMethodForIDOR(method);
      if (result.violation) {
        violations.push({ file, name: method.name, line: method.lineNumber, reason: result.reason });
      }
    }
  }

  return violations;
}

// CLI entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = scanBackendFiles();
  if (violations.length === 0) {
    console.log('✓ No IDOR violations found in SiteMember webMethods');
    process.exit(0);
  }

  console.error(`\n⚠ IDOR Check Failed: ${violations.length} violation(s) found\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.name}`);
    console.error(`    ${v.reason}\n`);
  }
  console.error('Fix: call currentMember.getMember() and verify ownership before querying by memberId.\n');
  process.exit(1);
}
