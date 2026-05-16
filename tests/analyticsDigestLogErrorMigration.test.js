/**
 * cf-analyticsdigest-logerror — pins console.error → logError migration
 * in src/backend/analyticsDigest.web.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/analyticsDigest.web.js'),
  'utf-8',
);

const EXPECTED_TAG_PREFIXES = [
  'analyticsDigest:generateWeeklyDigest',
  'analyticsDigest:sendWeeklyDigestEmail',
  'analyticsDigest:fetchOrderMetrics',
];

describe('cf-analyticsdigest-logerror — analyticsDigest.web.js console.error → logError', () => {
  it('contains zero console.error calls (all 4 sites converted)', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_TAG_PREFIXES)('uses logError tag prefix %s', (prefix) => {
    expect(SRC).toContain(prefix);
  });

  it('drift guard — every logError call uses the analyticsDigest: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(4);
    const nonPrefixed = tags.filter((t) => !t.startsWith('analyticsDigest:'));
    expect(
      nonPrefixed,
      `found logError tags without analyticsDigest: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
