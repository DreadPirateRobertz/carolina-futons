/**
 * cf-xv1g (cf-44qt.tagstyle.fu1): pin normalized colon-namespace logError
 * tags in src/backend/reviewsService.web.js.
 *
 * PR #1417 (cf-m7yg) noted 4 pre-existing bracket-style calls; full file
 * had 12. All normalized to 'reviewsService:functionName-reason' format.
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

const NORMALIZED_TAGS = [
  'reviewsService:submitReview-failed',
  'reviewsService:markHelpful-failed',
  'reviewsService:flagReview-failed',
  'reviewsService:getPendingReviews-failed',
  'reviewsService:moderateReview-failed',
  'reviewsService:getCategoryReviewSummaries-failed',
  'reviewsService:verifiedPurchaseCheck-failed',
  'reviewsService:submitVideoReview-failed',
  'reviewsService:getVideoReviews-failed',
  'reviewsService:moderateVideoReview-gamificationTriggerFailed',
  'reviewsService:moderateVideoReview-failed',
  'reviewsService:getFeaturedReviews-failed',
];

describe('cf-xv1g: reviewsService.web.js bracket-style tag normalization', () => {
  it('has no remaining bracket-style [reviewsService] logError tags', () => {
    const bracketCalls = SRC.match(/logError\s*\(\s*['"`]\[reviewsService\]/g) || [];
    expect(bracketCalls).toEqual([]);
  });

  describe('each normalized colon-namespace tag is present', () => {
    for (const tag of NORMALIZED_TAGS) {
      it(`tag "${tag}" appears in the source`, () => {
        const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        expect(SRC).toMatch(
          new RegExp(`logError\\s*\\(\\s*['"\`]${escaped}['"\`]`),
        );
      });
    }
  });
});
