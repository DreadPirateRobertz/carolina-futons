/**
 * cf-44qt wave — pin the comfortService.web.js console.error → logError
 * migration via source-grep assertions. Same shape as
 * tests/emailAutomationLogErrorMigration.test.js (cf-uydr) and
 * tests/emailAutomationTagNormalization.test.js (cf-g79m).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/comfortService.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'comfortService:getComfortLevels',
  'comfortService:getProductComfort',
  'comfortService:getComfortProducts',
];

describe('cf-44qt — comfortService.web.js console.error → logError migration', () => {
  it('contains zero console.error calls (all 3 sites converted)', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_TAGS)('uses logError tag %s', (tag) => {
    expect(SRC).toContain(`logError('${tag}'`);
  });

  it('every logError tag uses the comfortService: prefix', () => {
    const tagRe = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagRe), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    const nonPrefixed = tags.filter((t) => !t.startsWith('comfortService:'));
    expect(
      nonPrefixed,
      `found logError tags without comfortService: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
