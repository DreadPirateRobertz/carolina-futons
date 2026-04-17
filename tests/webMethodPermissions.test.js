/**
 * Tests that every webMethod() call in src/backend/*.web.js uses only the
 * canonical Permissions enum values: Anyone, Admin, SiteMember.
 *
 * Background: the @wix/web-methods runtime exports Permissions as a plain
 * object with exactly those three keys (per
 * https://dev.wix.com/docs/sdk/core-modules/web-methods/web-method).
 * A typo like Permissions.Member resolves to undefined at runtime, which the
 * Velo server may coerce to Permissions.Anyone — silently exposing member-only
 * endpoints as public. Tests previously masked this by defining an extra
 * `Member` key in the wix-web-module mock. See cf-zkj.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CANONICAL = new Set(['Anyone', 'Admin', 'SiteMember']);
const BACKEND_DIR = join(__dirname, '..', 'src', 'backend');
const PERMISSION_RE = /Permissions\.(\w+)/g;

function findWebMethodFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findWebMethodFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.web.js')) found.push(full);
  }
  return found;
}

const webMethodFiles = findWebMethodFiles(BACKEND_DIR);

describe('webMethod permissions — canonical enum enforcement', () => {
  it.each(webMethodFiles)('%s uses only canonical Permissions keys', (file) => {
    const src = readFileSync(file, 'utf8');
    const nonCanonical = [];
    for (const m of src.matchAll(PERMISSION_RE)) {
      if (!CANONICAL.has(m[1])) nonCanonical.push(m[1]);
    }
    expect(nonCanonical, `non-canonical Permissions keys found in ${file}`).toEqual([]);
  });
});
