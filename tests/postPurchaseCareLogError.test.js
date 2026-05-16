/**
 * cf-44qt wave — pin postPurchaseCare.web.js console.error → logError migration.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/postPurchaseCare.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'postPurchaseCare:getProductGuides',
  'postPurchaseCare:deliverGuidesForOrder',
  'postPurchaseCare:getUpsellRecommendations',
  'postPurchaseCare:trackGuideEngagement',
  'postPurchaseCare:logUpsellConversion',
  'postPurchaseCare:getReviewSolicitationData',
];

describe('cf-44qt — postPurchaseCare.web.js console.error → logError migration', () => {
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
    expect(SRC).toContain(`logError('${tag}'`);
  });

  it('every logError tag uses the postPurchaseCare: prefix', () => {
    const tagRe = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagRe), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(6);
    const nonPrefixed = tags.filter((t) => !t.startsWith('postPurchaseCare:'));
    expect(nonPrefixed).toEqual([]);
  });
});
