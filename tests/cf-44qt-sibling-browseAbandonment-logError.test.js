/**
 * @file cf-44qt-sibling-browseAbandonment-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 6
 * console.error sites in src/backend/browseAbandonment.web.js
 * migrated to canonical logError.
 *
 * Sites migrated (6):
 *   - trackSession (L117)
 *   - captureRemindMe (L201)
 *   - triggerRecovery (L289)
 *   - getStats (L360)
 *   - exportInsights (L425)
 *   - markConverted (L473)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/browseAbandonment.web.js'),
  'utf8',
);

describe('cf-44qt sibling — browseAbandonment.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 6 expected sites with canonical [browseAbandonment] prefix', () => {
    const labels = [
      'Error tracking session',
      'Error capturing remind-me',
      'Error triggering recovery',
      'Error fetching stats',
      'Error exporting insights',
      'Error marking converted',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[browseAbandonment\\] ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 6 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(6);
  });
});
