/**
 * @file cf-44qt-batch8-logError.test.js
 * @description TDD red → green for cf-44qt batch8: 4 backend modules
 * migrated to canonical logError. Mirrors batch3 / batch4 / batch6 /
 * batch7 shape.
 *
 * Modules migrated (4 files, 12 sites):
 *   - dataService.web.js (3 sites: scheduleReviewRequest,
 *     fetchPendingReviewRequests, submitReview) — pre-fix lacked the
 *     [module] prefix on console.error; migration adds it.
 *   - completeTheLookService.web.js (3 sites: getCompleteTheLook,
 *     createLook, updateLook)
 *   - sommelierService.web.js (3 sites: getRecommendations,
 *     savePreferences, getMyPreferences)
 *   - spinRedemptionService.web.js (3 sites: grantSpin, getPendingSpins,
 *     redeemSpin)
 *
 * Deliberately dropped from this batch: notificationPreferences.web.js
 * (has a pre-existing `logError` import from backend/errorMonitoring.web.js
 * with a different object-shape signature; needs a dedicated migration
 * that reconciles the two telemetry mechanisms).
 *
 * cf-44qt batch8 — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILES = [
  {
    path: 'src/backend/dataService.web.js',
    module: 'dataService',
    labels: ['scheduleReviewRequest', 'fetchPendingReviewRequests', 'submitReview'],
  },
  {
    path: 'src/backend/completeTheLookService.web.js',
    module: 'completeTheLookService',
    labels: ['getCompleteTheLook', 'createLook', 'updateLook'],
  },
  {
    path: 'src/backend/sommelierService.web.js',
    module: 'sommelierService',
    labels: ['getRecommendations', 'savePreferences', 'getMyPreferences'],
  },
  {
    path: 'src/backend/spinRedemptionService.web.js',
    module: 'spinRedemptionService',
    labels: ['grantSpin', 'getPendingSpins', 'redeemSpin'],
  },
];

describe('cf-44qt batch8 — 4-module logError migration', () => {
  it.each(FILES)('$path has NO remaining bare console.error calls', ({ path }) => {
    const src = read(path);
    expect(src).not.toMatch(/console\.error/);
  });

  it.each(FILES)('$path imports canonical logError from backend/utils/errorHandler', ({ path }) => {
    const src = read(path);
    expect(src).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(FILES)('$path uses canonical [$module] prefix on all 3 labels', ({ path, module, labels }) => {
    const src = read(path);
    for (const label of labels) {
      const re = new RegExp(`logError\\(\\s*['"]\\[${module}\\] ${label}['"]`);
      expect(src).toMatch(re);
    }
  });

  it.each(FILES)('$path logError invocation count = 3 (no over-migration drift)', ({ path }) => {
    const src = read(path);
    const matches = src.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(3);
  });
});
