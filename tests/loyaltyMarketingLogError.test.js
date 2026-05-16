/**
 * cf-44qt wave — pin loyaltyMarketing.web.js console.error → logError migration.
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

describe('cf-44qt — loyaltyMarketing.web.js console.error → logError migration', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('this-PR migration sites use the loyaltyMarketing: prefix', () => {
    // The file has pre-existing logError calls with non-conforming prefixes
    // (sendMonthlyLoyaltyStatements:..., [loyaltyMarketing] saveBirthday ...)
    // that pre-date this migration. cf-g79m normalization can sweep them later;
    // this test pins ONLY the two sites this PR converted.
    expect(SRC).toContain("logError('loyaltyMarketing:getEnrollmentPrompt'");
    expect(SRC).toContain("logError('loyaltyMarketing:enrollMember'");
  });
});
