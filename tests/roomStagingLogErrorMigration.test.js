/**
 * cf-roomstaging-logerror — pins console.error → logError migration
 * in src/backend/roomStaging.web.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/roomStaging.web.js'),
  'utf-8',
);

const EXPECTED_PREFIXES = [
  'roomStaging:generateStagedRoom-aiApi',
  'roomStaging:generateStagedRoom',
];

describe('cf-roomstaging-logerror — roomStaging.web.js console.error → logError', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_PREFIXES)('uses logError tag prefix %s', (prefix) => {
    expect(SRC).toContain(prefix);
  });

  it('drift guard — every logError call uses the roomStaging: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(2);
    const nonPrefixed = tags.filter((t) => !t.startsWith('roomStaging:'));
    expect(
      nonPrefixed,
      `found logError tags without roomStaging: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
