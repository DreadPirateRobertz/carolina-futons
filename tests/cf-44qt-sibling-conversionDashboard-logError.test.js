/**
 * @file cf-44qt-sibling-conversionDashboard-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 4
 * console.error sites in src/backend/conversionDashboard.web.js
 * migrated to canonical logError.
 *
 * Sites migrated (4):
 *   - getConversionFunnel (L103)
 *   - getDailyConversionTrend (L159)
 *   - getCategoryConversion (L214)
 *   - getDashboardSummary (L253)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/conversionDashboard.web.js'),
  'utf8',
);

describe('cf-44qt sibling — conversionDashboard.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 4 expected sites with canonical [conversionDashboard] prefix', () => {
    const labels = [
      'getConversionFunnel',
      'getDailyConversionTrend',
      'getCategoryConversion',
      'getDashboardSummary',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[conversionDashboard\\] ${label}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 4 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(4);
  });
});
