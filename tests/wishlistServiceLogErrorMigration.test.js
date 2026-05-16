/**
 * cf-wishlist-logerror — pins console.error → logError migration in
 * src/backend/wishlistService.web.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/wishlistService.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'wishlistService:addToWishlist',
  'wishlistService:removeFromWishlist',
  'wishlistService:getWishlist',
  'wishlistService:getWishlistByMemberId',
  'wishlistService:isOnWishlist',
];

describe('cf-wishlist-logerror — wishlistService.web.js console.error → logError', () => {
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

  it('drift guard — every logError call uses the wishlistService: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(5);
    const nonPrefixed = tags.filter((t) => !t.startsWith('wishlistService:'));
    expect(
      nonPrefixed,
      `found logError tags without wishlistService: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
