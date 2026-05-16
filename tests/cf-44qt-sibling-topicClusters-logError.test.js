/**
 * @file cf-44qt-sibling-topicClusters-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 6
 * console.error sites in src/backend/topicClusters.web.js migrated
 * to canonical logError from backend/utils/errorHandler.
 *
 * Source-grep style (mirrors deliveryNotifications sibling PR #1426
 * pattern) — three contracts pinned: zero bare console.error, all 6
 * expected sites have logError with canonical [topicClusters] prefix,
 * exact invocation count locks against accidental drift.
 *
 * Sites migrated (6):
 *   - getTopicCluster — L61
 *   - getClusterPage — L148 (uses template-literal slug interp)
 *   - resolveClusterForPost — L204
 *   - getSchemaMarkup — L335
 *   - calculateSeoScore — L466
 *   - getSitemapData — L535
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/topicClusters.web.js'),
  'utf8',
);

describe('cf-44qt sibling — topicClusters.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    // Positive pin: logError import present.
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 6 expected sites with canonical [topicClusters] prefix', () => {
    // Five fixed-label sites + one template-literal site (the
    // "loading cluster page <slug>" site interpolates pillarSlug).
    const fixedLabels = [
      'Error getting topic cluster',
      'Error resolving cluster for post',
      'Error generating schema markup',
      'Error calculating SEO score',
      'Error generating sitemap data',
    ];
    for (const label of fixedLabels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[topicClusters\\] ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`,
      );
      expect(SRC).toMatch(re);
    }
    // Template-literal site keeps the slug interpolation but uses logError.
    expect(SRC).toMatch(
      /logError\(\s*`\[topicClusters\] Error loading cluster page \$\{pillarSlug\}`/,
    );
  });

  it('logError invocation count matches the 6 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(6);
  });
});
