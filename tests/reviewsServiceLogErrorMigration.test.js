/**
 * cf-m7yg (cf-44qt wave): pins the remaining console.warn → logError
 * migration in src/backend/reviewsService.web.js. 6 sites converted to
 * the `logError(tag, err)` shape so Sentry sees every reviews-service
 * non-fatal path (previously `console.warn` only hit Velo console).
 *
 * Pre-existing logError calls (4 in submitReview/markHelpful/flagReview/
 * getPendingReviews) keep their original "[reviewsService] X failed"
 * bracket-style message — out of scope for this batch; a separate
 * cf-44qt.tagstyle.fu1 follow-up could normalize them all to
 * "reviewsService:fn-reason" if melania signals that's desired.
 *
 * Same shape as cf-mrcm PR #1404 + cf-uydr PR #1373. Tag regex accepts
 * single/double/backtick quoting (cf-mrcm's learning folded forward).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/reviewsService.web.js'),
  'utf-8',
);

// Order matches file's top-to-bottom layout.
const EXPECTED_TAGS = [
  'reviewsService:getAggregateRating-skipInvalidRating',
  'reviewsService:submitReview-gamificationEvent',
  'reviewsService:submitReview-emailConversionNotRecorded',
  'reviewsService:submitReview-emailConversionRecord',
  'reviewsService:moderateReview-blockedTransition',
  'reviewsService:getCategoryReviewSummaries-skipInvalidRating',
];

describe('cf-m7yg: reviewsService.web.js logError migration', () => {
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

  it(`total logError call count is at least ${EXPECTED_TAGS.length + 4} (6 migrated + 4 pre-existing)`, () => {
    // Floor: the 4 pre-existing logError calls (submitReview / markHelpful /
    // flagReview / getPendingReviews error catches) are out-of-scope for this
    // batch but still must persist. 6 new + 4 pre-existing = 10 minimum.
    const calls = SRC.match(/logError\s*\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(EXPECTED_TAGS.length + 4);
  });
});
