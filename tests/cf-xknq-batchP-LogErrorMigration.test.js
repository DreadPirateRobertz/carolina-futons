/**
 * cf-xknq (cf-44qt batch-P): 7-file logger sweep migration pins.
 *
 * Convoy continuation after cf-i8b4 batch-M (PR #1459),
 * cf-06ug batch-N (PR #1474), cf-n4wy batch-O (PR #1495).
 *
 * 25 console.* sites across 7 files migrated to canonical
 * `logError(tag, err)` with the `<module>:<fn>(-<reason>)?` tag
 * namespace.
 *
 * Notes:
 *   - errorMonitoring.web.js intentionally NOT in this batch — it
 *     would be a circular dependency on backend/utils/errorHandler.
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
  'swatchService.web.js': {
    requiresImport: true,
    tags: [
      'swatchService:getProductSwatches',
      'swatchService:getAllSwatchFamilies',
      'swatchService:getSwatchCount',
      'swatchService:getSwatchPreviewColors',
    ],
  },
  'priceDropCron.web.js': {
    requiresImport: true,
    tags: [
      'priceDropCron:detectPriceDrops',
      'priceDropCron:queuePriceDropNotifications',
      'priceDropCron:queuePriceDropNotifications-notifyMemberFailed',
      'priceDropCron:queuePriceDropNotifications-sendEmailFailed',
    ],
  },
  'deliveryExperience.web.js': {
    requiresImport: true,
    tags: [
      'deliveryExperience:getDeliveryStatus',
      'deliveryExperience:updateMilestone',
      'deliveryExperience:submitSurvey',
      'deliveryExperience:getSurveyStats',
    ],
  },
  'chatbotService.web.js': {
    requiresImport: true,
    tags: [
      'chatbotService:fetchProductCatalog-failed',
      'chatbotService:fetchSecrets-failed',
      'chatbotService:dailyStatsQueryFailed',
      'chatbotService:dailyStatsWriteFailed',
    ],
  },
  'spinRedemptionService.web.js': {
    requiresImport: true,
    tags: [
      'spinRedemptionService:grantSpin',
      'spinRedemptionService:getPendingSpins',
      'spinRedemptionService:redeemSpin',
    ],
  },
  'sommelierService.web.js': {
    requiresImport: true,
    tags: [
      'sommelierService:getRecommendations',
      'sommelierService:savePreferences',
      'sommelierService:getMyPreferences',
    ],
  },
  'showroomService.web.js': {
    requiresImport: true,
    tags: [
      'showroomService:getShowroomBookingUrl',
      'showroomService:getShowroomEligibleIds',
      'showroomService:getShowroomSectionData',
    ],
  },
};

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-xknq (cf-44qt batch-P): 7-file logger sweep migration', () => {
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

  it('summary: 25 console.* call sites migrated across 7 files', () => {
    const totalTags = Object.values(FILES).reduce(
      (sum, spec) => sum + spec.tags.length,
      0,
    );
    expect(totalTags).toBe(25);
  });
});
