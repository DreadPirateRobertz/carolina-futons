/**
 * @file cf-44qt-sibling-questProgress-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 3
 * console.error sites in src/backend/questProgressService.web.js
 * migrated to canonical logError.
 *
 * Sites migrated (3):
 *   - saveQuestProgress (L90)
 *   - getQuestProgress (L132)
 *   - getActiveQuests (L169)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/questProgressService.web.js'),
  'utf8',
);

describe('cf-44qt sibling — questProgressService.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 3 expected sites with canonical [questProgressService] prefix', () => {
    const labels = [
      'saveQuestProgress failed',
      'getQuestProgress failed',
      'getActiveQuests failed',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[questProgressService\\] ${label}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 3 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(3);
  });
});
