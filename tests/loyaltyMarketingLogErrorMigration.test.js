/**
 * cf-loyaltymarketing-logerror — pins console.error → logError migration
 * in src/backend/loyaltyMarketing.web.js. NOTE: file already imported
 * logError; this PR completes the 2 remaining console.error sites.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/loyaltyMarketing.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'loyaltyMarketing:getEnrollmentPrompt',
  'loyaltyMarketing:enrollMember',
];

describe('cf-loyaltymarketing-logerror — loyaltyMarketing.web.js console.error → logError', () => {
  it('contains zero console.error calls', () => {
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

  it('logError call count is at least 2 (the migrated sites)', () => {
    // Pre-existing logError calls in this file use older tag conventions
    // (sendMonthlyLoyaltyStatements:${memberId}, [loyaltyMarketing] saveBirthday — member: ${mid}).
    // Those are out of cf-loyaltymarketing-logerror scope; a future
    // normalization pass (like cf-g79m) can unify the schema. This test
    // only pins the 2 new migrated sites; full drift guard deferred.
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(2);
  });
});
