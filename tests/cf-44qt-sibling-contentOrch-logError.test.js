/**
 * @file cf-44qt-sibling-contentOrch-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 7
 * console.error sites in src/backend/contentOrchestrator.web.js
 * migrated to canonical logError.
 *
 * Sites migrated (7):
 *   - triggerManualOrchestration (L184)
 *   - triggerEventOrchestration (L215)
 *   - previewOrchestration (L246)
 *   - getDashboard (L289)
 *   - getHistory (L312)
 *   - getConfig (L330)
 *   - updateConfig (L370)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/contentOrchestrator.web.js'),
  'utf8',
);

describe('cf-44qt sibling — contentOrchestrator.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 7 expected sites with canonical [contentOrchestrator] prefix', () => {
    const labels = [
      'triggerManualOrchestration',
      'triggerEventOrchestration',
      'previewOrchestration',
      'getDashboard',
      'getHistory',
      'getConfig',
      'updateConfig',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[contentOrchestrator\\] ${label}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 7 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(7);
  });
});
