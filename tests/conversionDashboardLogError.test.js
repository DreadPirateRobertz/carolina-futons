/**
 * cf-44qt wave — pin conversionDashboard.web.js console.error → logError migration.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/conversionDashboard.web.js'),
  'utf-8',
);

describe('cf-44qt — conversionDashboard.web.js console.error → logError migration', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('every logError tag uses the conversionDashboard: prefix', () => {
    const tagRe = /\blogError\s*\(\s*['"`]([^'"`]+)/g;
    const tags = Array.from(SRC.matchAll(tagRe), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(4);
    const nonPrefixed = tags.filter((t) => !t.startsWith('conversionDashboard:'));
    expect(nonPrefixed).toEqual([]);
  });
});
