/**
 * @file cf-44qt-sibling-productReviews-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 5
 * console.error sites in src/backend/productReviews.web.js
 * migrated to canonical logError.
 *
 * Sites migrated (5):
 *   - getReviewSummary (L107)
 *   - getUnifiedReviews (L226)
 *   - getReviewHighlights (L293)
 *   - getBatchReviewSummaries (L363)
 *   - getModerationQueue (L437)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/productReviews.web.js'),
  'utf8',
);

describe('cf-44qt sibling — productReviews.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 5 expected sites with canonical [productReviews] prefix', () => {
    const labels = [
      'getReviewSummary',
      'getUnifiedReviews',
      'getReviewHighlights',
      'getBatchReviewSummaries',
      'getModerationQueue',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[productReviews\\] ${label}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 5 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(5);
  });
});
