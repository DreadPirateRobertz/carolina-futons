/**
 * @file cf-44qt-sibling-seoContentHub-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 6
 * console.error sites in src/backend/seoContentHub.web.js migrated
 * to canonical logError. Source-grep style — same pattern as
 * PRs #1426 / #1433.
 *
 * Sites migrated (6):
 *   - getContentHub (L166)
 *   - getPillarGuide (L220)
 *   - getSlugs (L240)
 *   - generateHubSchema (L307)
 *   - generateGuideSchema (L362)
 *   - generateSitemapEntries (L398)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/seoContentHub.web.js'),
  'utf8',
);

describe('cf-44qt sibling — seoContentHub.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 6 expected sites with canonical [seoContentHub] prefix', () => {
    const labels = [
      'Error getting content hub',
      'Error getting pillar guide',
      'Error getting slugs',
      'Error generating hub schema',
      'Error generating guide schema',
      'Error generating sitemap entries',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[seoContentHub\\] ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 6 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(6);
  });
});
