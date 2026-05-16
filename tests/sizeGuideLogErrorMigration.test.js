/**
 * cf-sizeguide-logerror — pins the console.error → logError migration
 * in src/backend/sizeGuide.web.js. Same shape as cf-44qt /
 * cf-uydr / cf-g79m / batch-3 PR #1400 — all errors now flow to Sentry
 * via `logError('sizeGuide:<fn>', err)` instead of Velo-console-only
 * `console.error(...)`.
 *
 * Strategy: static-string assertion on the source file. Behavioral
 * coverage for the catch paths lives in the existing sizeGuide test
 * files; this test pins the tag-shape contract + drift guard.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/sizeGuide.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'sizeGuide:getProductDimensions',
  'sizeGuide:checkRoomFit',
  'sizeGuide:getDimensionsByCategory',
  'sizeGuide:getComparisonTable',
];

describe('cf-sizeguide-logerror — sizeGuide.web.js console.error → logError', () => {
  it('contains zero console.error calls (all 4 sites converted)', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_TAGS)('uses logError tag %s', (tag) => {
    expect(SRC).toContain(`'${tag}'`);
  });

  it('drift guard — every logError call uses the sizeGuide: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(4);
    const nonPrefixed = tags.filter((t) => !t.startsWith('sizeGuide:'));
    expect(
      nonPrefixed,
      `found logError tags without sizeGuide: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
