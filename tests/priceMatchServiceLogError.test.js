/**
 * cf-44qt wave — pin the priceMatchService.web.js console.error → logError
 * migration via source-grep assertions. Same shape as cf-comfort PR #1416
 * + cf-uydr PR #1373.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/priceMatchService.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'priceMatchService:submitRequest',
  'priceMatchService:listPriceMatches',
  'priceMatchService:getPriceMatch',
  'priceMatchService:reviewRequest',
  'priceMatchService:getStats',
];

describe('cf-44qt — priceMatchService.web.js console.error → logError migration', () => {
  it('contains zero console.error calls (all 5 sites converted)', () => {
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

  it('every logError tag uses the priceMatchService: prefix', () => {
    const tagRe = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagRe), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(5);
    const nonPrefixed = tags.filter((t) => !t.startsWith('priceMatchService:'));
    expect(
      nonPrefixed,
      `found logError tags without priceMatchService: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
