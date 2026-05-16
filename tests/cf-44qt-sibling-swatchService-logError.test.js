/**
 * @file cf-44qt-sibling-swatchService-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 4
 * console.error sites in src/backend/swatchService.web.js migrated
 * to canonical logError. Pre-fix sites lacked the [module] prefix;
 * migration adds canonical [swatchService] prefix.
 *
 * Sites migrated (4):
 *   - getProductSwatches (L38)
 *   - getSwatchFamilies (L54)
 *   - countSwatches (L74)
 *   - getSwatchPreviewColors (L99)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/swatchService.web.js'),
  'utf8',
);

describe('cf-44qt sibling — swatchService.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 4 expected sites with canonical [swatchService] prefix (added)', () => {
    const labels = [
      'getProductSwatches',
      'getSwatchFamilies',
      'countSwatches',
      'getSwatchPreviewColors',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[swatchService\\] ${label}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 4 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(4);
  });
});
