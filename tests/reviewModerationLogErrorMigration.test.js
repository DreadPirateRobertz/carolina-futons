/**
 * cf-hjvs (cf-44qt wave): pins the console.error → logError migration in
 * src/backend/reviewModeration.web.js. 7 catch sites converted to the
 * canonical `logError(tag, err)` shape so Sentry sees every moderation
 * surface failure.
 *
 * Thematic pair with cf-m7yg (reviewsService, PR #1417). Same TDD shape
 * as cf-mrcm PR #1404 — regex accepts ', ", and backtick.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/reviewModeration.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'reviewModeration:getModerationQueue',
  'reviewModeration:bulkModerate-itemError',
  'reviewModeration:bulkModerate',
  'reviewModeration:autoRejectSpam',
  'reviewModeration:getModerationStats',
  'reviewModeration:ingestStampedReview',
  'reviewModeration:autoApproveEligible',
];

describe('cf-hjvs: reviewModeration.web.js logError migration', () => {
  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{\s*logError\s*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('contains zero remaining console.error|warn|log|debug|info calls', () => {
    const consoleCalls = SRC.match(/console\.(error|warn|log|debug|info)\s*\(/g) || [];
    expect(consoleCalls).toEqual([]);
  });

  describe('each expected logError tag is present', () => {
    for (const tag of EXPECTED_TAGS) {
      it(`tag "${tag}" appears in the source`, () => {
        const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
        );
        expect(SRC).toMatch(pattern);
      });
    }
  });

  it(`total logError call count is at least ${EXPECTED_TAGS.length}`, () => {
    const calls = SRC.match(/logError\s*\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(EXPECTED_TAGS.length);
  });
});
