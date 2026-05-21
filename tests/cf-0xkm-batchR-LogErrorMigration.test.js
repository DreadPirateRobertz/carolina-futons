/**
 * cf-0xkm (cf-44qt batch-R): cleanup sweep of the long tail.
 *
 * 20 console.* sites across 15 small files (1-2 sites each) that
 * survived earlier batches because they're small enough to fall through
 * cluster groupings.
 *
 * Excluded: utils/safeParse + errorMonitoring — both would risk a
 * circular dependency on backend/utils/errorHandler.
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
  'wwex-freight.web.js': {
    requiresImport: true,
    tags: [
      'wwex-freight:getLTLRates-apiError',
      'wwex-freight:getLTLRates',
    ],
  },
  'utils/crossRigSyncUtils.js': {
    requiresImport: true,
    tags: [
      'crossRigSyncUtils:syncMobilePoints',
      'crossRigSyncUtils:syncBadgeEarnedToPush',
    ],
  },
  'returnsService.web.js': {
    requiresImport: true,
    tags: [
      'returnsService:lookupReturn-rateLimitExceeded',
      'returnsService:submitGuestReturn-rateLimitExceeded',
    ],
  },
  'bundleDeals.web.js': {
    requiresImport: true,
    tags: [
      'bundleDeals:getCurrentCart-failed',
      'bundleDeals:couponApply-failed',
    ],
  },
  'birthdayMigration.web.js': {
    requiresImport: true,
    tags: [
      'birthdayMigration:unparseableBirthday',
      'birthdayMigration:complete',
    ],
  },
  'abTestDashboard.web.js': {
    requiresImport: true,
    tags: [
      'abTestDashboard:autoStop-skipped',
      'abTestDashboard:autoStop-completed',
    ],
  },
  'warrantyService.web.js': {
    requiresImport: true,
    tags: ['warrantyService:queueEmail-invalidRecipient'],
  },
  'utils/memberPointsLedger.js': {
    requiresImport: true,
    tags: ['memberPointsLedger:getPointsHistory'],
  },
  'ugcService.web.js': {
    requiresImport: true,
    tags: ['ugcService:vote-duplicateInsert'],
  },
  'surveyService.web.js': {
    requiresImport: true,
    tags: ['surveyService:queueEmail-insertFailed'],
  },
  'socialProofBadge.web.js': {
    requiresImport: true,
    tags: ['socialProofBadge:getNeighborCount'],
  },
  'sitemapEnhancer.web.js': {
    requiresImport: true,
    tags: ['sitemapEnhancer:getProductSitemapEntries'],
  },
  'referralService.web.js': {
    requiresImport: true,
    tags: ['referralService:processReferralOnOrderCreated-earnPointsFailed'],
  },
  'pushNotificationService.web.js': {
    requiresImport: true,
    tags: ['pushNotificationService:sendPush-fcmError'],
  },
  'gamificationChatbot.web.js': {
    requiresImport: true,
    tags: ['gamificationChatbot:getChatGreeting-flagFetchFailed'],
  },
};

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-0xkm (cf-44qt batch-R): 15-file cleanup sweep', () => {
  for (const [filePath, spec] of Object.entries(FILES)) {
    describe(filePath, () => {
      const src = readSrc(filePath);

      it('contains zero console.error|warn|log|debug|info CALLS (matches strict call-pattern, not comment text)', () => {
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

  it('summary: at least 20 console.* call sites migrated across 15 files', () => {
    const totalTags = Object.values(FILES).reduce(
      (sum, spec) => sum + spec.tags.length,
      0,
    );
    expect(totalTags).toBeGreaterThanOrEqual(20);
  });
});
