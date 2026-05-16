/**
 * cf-pricematch-logerror — pins console.error → logError migration in
 * src/backend/priceMatchService.web.js.
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
  'priceMatchService:submitPriceMatchRequest',
  'priceMatchService:getMyPriceMatches',
  'priceMatchService:getPriceMatchById',
  'priceMatchService:reviewPriceMatchRequest',
  'priceMatchService:getPriceMatchStats',
];

describe('cf-pricematch-logerror — priceMatchService.web.js console.error → logError', () => {
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
    expect(SRC).toContain(`'${tag}'`);
  });

  it('drift guard — every logError call uses the priceMatchService: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(5);
    const nonPrefixed = tags.filter((t) => !t.startsWith('priceMatchService:'));
    expect(
      nonPrefixed,
      `found logError tags without priceMatchService: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
