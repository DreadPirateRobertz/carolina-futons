/**
 * cf-seocontenthub-logerror — pins console.error → logError migration
 * in src/backend/seoContentHub.web.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/seoContentHub.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'seoContentHub:getContentHub',
  'seoContentHub:getPillarGuide',
  'seoContentHub:getPillarGuideSlugs',
  'seoContentHub:getHubSchema',
  'seoContentHub:getGuideSchema',
  'seoContentHub:getSitemapEntries',
];

describe('cf-seocontenthub-logerror — seoContentHub.web.js console.error → logError', () => {
  it('contains zero console.error calls (all 6 sites converted)', () => {
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

  it('drift guard — every logError call uses the seoContentHub: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(6);
    const nonPrefixed = tags.filter((t) => !t.startsWith('seoContentHub:'));
    expect(
      nonPrefixed,
      `found logError tags without seoContentHub: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
