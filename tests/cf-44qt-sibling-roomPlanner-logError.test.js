/**
 * @file cf-44qt-sibling-roomPlanner-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 6
 * console.error sites in src/backend/roomPlanner.web.js migrated
 * to canonical logError.
 *
 * Sites migrated (6):
 *   - createRoomLayout (L109)
 *   - addProductToLayout (L196)
 *   - getLayoutPreview (L258)
 *   - shareLayout (L297)
 *   - saveLayout (L338)
 *   - getProductDimensions (L364)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/roomPlanner.web.js'),
  'utf8',
);

describe('cf-44qt sibling — roomPlanner.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 6 expected sites with canonical [roomPlanner] prefix', () => {
    const labels = [
      'createRoomLayout',
      'addProductToLayout',
      'getLayoutPreview',
      'shareLayout',
      'saveLayout',
      'getProductDimensions',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[roomPlanner\\] ${label}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 6 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(6);
  });
});
