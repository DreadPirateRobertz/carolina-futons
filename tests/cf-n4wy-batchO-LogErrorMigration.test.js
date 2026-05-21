/**
 * cf-n4wy (cf-44qt batch-O): 8-file logger sweep migration pins.
 *
 * Convoy continuation after cf-i8b4 batch-M (PR #1459) and cf-06ug
 * batch-N (PR #1474). 44 console.* sites across 8 files migrated to
 * canonical `logError(tag, err)` from `backend/utils/errorHandler`
 * with the `<module>:<fn>-<reason>` tag namespace.
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
  'swatchKitService.web.js': {
    requiresImport: true,
    tags: [
      'swatchKitService:issueSwatchKitCredit-idempotencyCheckFailed',
      'swatchKitService:issueSwatchKitCredit-creditFailed',
      'swatchKitService:issueSwatchKitCredit-creditThrew',
      'swatchKitService:issueSwatchKitCredit-cmsInsertFailedManualReconcile',
      'swatchKitService:getSwatchKitCreditStatus-noMember',
      'swatchKitService:getSwatchKitCreditStatus',
      'swatchKitService:markCreditApplied',
    ],
  },
  'facebookCatalog.web.js': {
    requiresImport: true,
    tags: [
      'facebookCatalog:buildCatalogBatch',
      'facebookCatalog:refreshFacebookCatalog-notifyOwnerFailed',
      'facebookCatalog:refreshFacebookCatalog-failures',
      'facebookCatalog:refreshFacebookCatalog-complete',
      'facebookCatalog:refreshFacebookCatalog',
      'facebookCatalog:exportCustomerAudienceData',
    ],
  },
  'couponsService.web.js': {
    requiresImport: true,
    tags: [
      'couponsService:issueBirthdayCoupon-memberCouponsInsertFailed',
      'couponsService:issueTierUpgradeCoupon-memberCouponsInsertFailed',
      'couponsService:generateRecoveryCoupon-recoveryCouponsInsertFailed',
      'couponsService:generateRecoveryCoupon-memberCouponsInsertFailed',
      'couponsService:issueCartRecoveryCoupon-memberCouponsInsertFailed',
      'couponsService:generateCode-collisionCheckFailed',
    ],
  },
  'videoReviewService.web.js': {
    requiresImport: true,
    tags: [
      'videoReviewService:submitVideoReview',
      'videoReviewService:getVideoReviews',
      'videoReviewService:moderateVideoReview',
      'videoReviewService:getProductVideoReviews',
      'videoReviewService:getVideoReviewCount',
    ],
  },
  'swatchRequest.web.js': {
    requiresImport: true,
    tags: [
      'swatchRequest:resolveSwatchNames-notFound',
      'swatchRequest:submitSwatchRequest-nurtureQueueFailed',
      'swatchRequest:submitSwatchRequest-skippedEmptyContactId',
      'swatchRequest:submitSwatchRequest-confirmationSendFailed',
      'swatchRequest:submitSwatchRequest',
    ],
  },
  'styleConsultant.web.js': {
    requiresImport: true,
    tags: [
      'styleConsultant:callClaudeVision-photoUrlConversionFailed',
      'styleConsultant:getStyleConsultation-sessionLookupFailed',
      'styleConsultant:getStyleConsultation-claudeApiFailed',
      'styleConsultant:getStyleConsultation-productMatchFailed',
      'styleConsultant:getStyleConsultation-sessionUpsertFailed',
    ],
  },
  'gamificationCore.web.js': {
    requiresImport: true,
    tags: [
      'gamificationCore:getActiveChallenges-noMemberId',
      'gamificationCore:getStreakData-noMemberId',
      'gamificationCore:getMemberTier-noMemberId',
      'gamificationCore:getActivityFeed-authRequired',
      'gamificationCore:getActivityFeed-forbidden',
    ],
  },
  'emailService.web.js': {
    requiresImport: true,
    tags: [
      'emailService:checkEmailRateLimit-failedOpen',
      'emailService:resolveSiteOwnerContactId-secretEmpty',
      'emailService:resolveSiteOwnerContactId-secretUnreadable',
      'emailService:sendCustomerContactAutoReply-nonblocking',
      'emailService:sendCustomerContactAutoReply-skippedEmptyContactId',
    ],
  },
};

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-n4wy (cf-44qt batch-O): 8-file logger sweep migration', () => {
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

  it('summary: 44 console.* call sites migrated across 8 files', () => {
    const totalTags = Object.values(FILES).reduce(
      (sum, spec) => sum + spec.tags.length,
      0,
    );
    expect(totalTags).toBe(44);
  });
});
