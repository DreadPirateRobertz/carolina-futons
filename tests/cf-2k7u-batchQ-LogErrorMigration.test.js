/**
 * cf-2k7u (cf-44qt batch-Q): 11-file logger sweep migration pins.
 *
 * Migrates console.error/warn sites across 11 src/backend/* files to
 * canonical `logError(tag, err)` from `backend/utils/errorHandler` with
 * the `<module>:<fn>(-<reason>)?` tag namespace.
 *
 * Files: virtualConsultation, storeCreditService, seoContentHub, roomPlanner,
 * styleQuizService, gamificationCore, swatchRequest, questProgressService,
 * conversionDashboard, completeTheLookService, styleQuiz (57 sites total).
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
  'virtualConsultation.web.js': {
    requiresImport: true,
    tags: [
      'virtualConsultation:getDesigners',
      'virtualConsultation:getAvailableSlots',
      'virtualConsultation:bookConsultation-emailFailed',
      'virtualConsultation:bookConsultation',
      'virtualConsultation:cancelConsultation',
      'virtualConsultation:getMyConsultations',
      'virtualConsultation:uploadPhoto',
      'virtualConsultation:getConsultationDetails',
      'virtualConsultation:submitIntakeForm',
      'virtualConsultation:getIntakeForm',
    ],
  },
  'storeCreditService.web.js': {
    requiresImport: true,
    tags: [
      'storeCreditService:issueStoreCredit',
      'storeCreditService:getMyStoreCredit',
      'storeCreditService:applyStoreCredit',
      'storeCreditService:getStoreCreditHistory',
      'storeCreditService:giftStoreCredit',
      'storeCreditService:getExpiringCredits',
    ],
  },
  'seoContentHub.web.js': {
    requiresImport: true,
    tags: [
      'seoContentHub:getContentHub',
      'seoContentHub:getPillarGuide',
      'seoContentHub:getAllSlugs',
      'seoContentHub:generateHubSchema',
      'seoContentHub:generateGuideSchema',
      'seoContentHub:generateSitemapEntries',
    ],
  },
  'roomPlanner.web.js': {
    requiresImport: true,
    tags: [
      'roomPlanner:createRoomLayout',
      'roomPlanner:addProductToLayout',
      'roomPlanner:getLayoutPreview',
      'roomPlanner:shareLayout',
      'roomPlanner:saveLayout',
      'roomPlanner:getProductDimensions',
    ],
  },
  'styleQuizService.web.js': {
    requiresImport: true,
    tags: [
      'styleQuizService:saveResult-memberFailed',
      'styleQuizService:saveResult-queryFailed',
      'styleQuizService:saveResult',
      'styleQuizService:getMyResult-memberFailed',
      'styleQuizService:getMyResult',
      'styleQuizService:getSharedResult',
    ],
  },
  'gamificationCore.web.js': {
    requiresImport: true,
    tags: [
      'gamificationCore:getActiveChallenges-unauthenticated',
      'gamificationCore:getStreakData-unauthenticated',
      'gamificationCore:getMemberTier-unauthenticated',
      'gamificationCore:getActivityFeed-unauthenticated',
      'gamificationCore:getActivityFeed-forbidden',
    ],
  },
  'swatchRequest.web.js': {
    requiresImport: true,
    tags: [
      'swatchRequest:buildSwatchList-notFound',
      'swatchRequest:submitSwatchRequest-nurtureEmailFailed',
      'swatchRequest:submitSwatchRequest-noContactId',
      'swatchRequest:submitSwatchRequest-confirmationFailed',
      'swatchRequest:submitSwatchRequest',
    ],
  },
  'questProgressService.web.js': {
    requiresImport: true,
    tags: [
      'questProgressService:saveQuestProgress',
      'questProgressService:getQuestProgress-corrupt',
      'questProgressService:getQuestProgress',
      'questProgressService:getActiveQuests',
    ],
  },
  'conversionDashboard.web.js': {
    requiresImport: true,
    tags: [
      'conversionDashboard:getConversionFunnel',
      'conversionDashboard:getDailyConversionTrend',
      'conversionDashboard:getCategoryConversion',
      'conversionDashboard:getDashboardSummary',
    ],
  },
  'completeTheLookService.web.js': {
    requiresImport: true,
    tags: [
      'completeTheLookService:getCompleteTheLook',
      'completeTheLookService:createLook',
      'completeTheLookService:updateLook',
    ],
  },
  'styleQuiz.web.js': {
    requiresImport: true,
    tags: [
      'styleQuiz:getRecommendations',
      'styleQuiz:captureLeadForm',
    ],
  },
};

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

const importPattern =
  /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler/;

describe('cf-2k7u (cf-44qt batch-Q): 11-file console.* → logError migration', () => {
  for (const [filename, spec] of Object.entries(FILES)) {
    describe(filename, () => {
      const src = readSrc(filename);

      if (spec.requiresImport) {
        it('imports logError from backend/utils/errorHandler', () => {
          expect(src).toMatch(importPattern);
        });
      }

      it.each(spec.tags)('uses canonical logError tag: %s', (tag) => {
        expect(src).toMatch(tagPattern(tag));
      });

      it('has no raw console.error or console.warn calls', () => {
        const calls = src.match(/console\.(error|warn)\s*\(/g) || [];
        expect(calls).toEqual([]);
      });
    });
  }

  it('summary: 57 logError tags across 11 files', () => {
    const total = Object.values(FILES).reduce((n, s) => n + s.tags.length, 0);
    expect(total).toBe(57);
  });
});
