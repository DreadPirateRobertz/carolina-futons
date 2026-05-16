/**
 * cf-06ug (cf-44qt batch-N): 6-file logger sweep migration pins.
 *
 * Picks up the convoy after batch-M (cf-i8b4 PR #1459) — many of the
 * originally-scoped files were claimed by other crew while batch-M was
 * in flight (searchService #1462, customizationService #1466,
 * roomPlanner #1438, roomStaging #1461, contentScheduler #1454 — all
 * in open PRs). Batch-N is what's left after de-conflicting against
 * the open-PR queue: 14 console.* sites across 6 files.
 *
 * Tag namespace: `<module>:<fn>(-<reason>)?`, same as cf-uydr / cf-mrcm /
 * cf-m7yg / cf-hjvs / cf-i8b4.
 *
 * Regex shape accepts ', ", AND backtick — folded from cf-mrcm.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_BACKEND = path.resolve(TEST_DIR, '../src/backend');

function readSrc(rel) {
  return fs.readFileSync(path.resolve(SRC_BACKEND, rel), 'utf-8');
}

const FILES = {
  'productReviews.web.js': {
    requiresImport: true,
    tags: [
      'productReviews:getReviewSummary-invalidRatings',
      'productReviews:getReviewSummary',
      'productReviews:getUnifiedReviews',
      'productReviews:getReviewHighlights',
      'productReviews:getBatchReviewSummaries',
      'productReviews:getModerationQueue',
    ],
  },
  'dataService.web.js': {
    requiresImport: true,
    tags: [
      'dataService:scheduleReviewRequest',
      'dataService:fetchPendingReviewRequests',
      'dataService:submitReview',
    ],
  },
  'guideSeoService.web.js': {
    requiresImport: true,
    tags: [
      'guideSeoService:getRelatedProducts',
      'guideSeoService:getGuidePageSeoData',
    ],
  },
  'productQA.web.js': {
    requiresImport: true,
    tags: ['productQA:notifyOwnerOfQuestion-emailFailed'],
  },
  'priceMatchService.web.js': {
    requiresImport: true,
    tags: ['priceMatchService:submitPriceMatchRequest-mirrorFailed'],
  },
  'localSeo.web.js': {
    requiresImport: true,
    tags: ['localSeo:generateLocalBusinessSchema-missingCityGeo'],
  },
};

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-06ug (cf-44qt batch-N): 6-file logger sweep migration', () => {
  for (const [filePath, spec] of Object.entries(FILES)) {
    describe(filePath, () => {
      const src = readSrc(filePath);

      it('contains zero console.error|warn|log|debug|info CALLS (matches the strict call-pattern, not comment text)', () => {
        const calls = src.match(/console\.(error|warn|log|debug|info)\s*\(/g) || [];
        const allowed = spec.allowsConsoleCalls || 0;
        expect(calls.length).toBe(allowed);
      });

      if (spec.requiresImport) {
        it('imports logError from backend/utils/errorHandler', () => {
          const importPattern =
            /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler/;
          expect(src).toMatch(importPattern);
        });
      }

      for (const tag of spec.tags) {
        it(`tag "${tag}" appears as a logError() call`, () => {
          expect(src).toMatch(tagPattern(tag));
        });
      }
    });
  }

  it('summary: 14 console.* call sites migrated across 6 files', () => {
    const totalTags = Object.values(FILES).reduce(
      (sum, spec) => sum + spec.tags.length,
      0,
    );
    expect(totalTags).toBe(14);
  });
});
