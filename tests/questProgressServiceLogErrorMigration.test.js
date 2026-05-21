/**
 * cf-questprogress-logerror — pins console.error → logError migration
 * in src/backend/questProgressService.web.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/questProgressService.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'questProgressService:saveQuestProgress',
  'questProgressService:getQuestProgress',
  'questProgressService:getActiveQuests',
];

describe('cf-questprogress-logerror — questProgressService.web.js console.error → logError', () => {
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
    expect(SRC).toContain(`'${tag}'`);
  });

  it('drift guard — every logError call uses the questProgressService: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    const nonPrefixed = tags.filter((t) => !t.startsWith('questProgressService:'));
    expect(
      nonPrefixed,
      `found logError tags without questProgressService: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
