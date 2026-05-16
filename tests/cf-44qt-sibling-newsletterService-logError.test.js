/**
 * @file cf-44qt-sibling-newsletterService-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 3
 * console.error sites in src/backend/newsletterService.web.js
 * migrated to canonical logError. Adds the canonical
 * [newsletterService] prefix (pre-fix sites had bare 'ESP X error:'
 * strings — newsletterService prefix added during migration).
 *
 * Sites migrated (3):
 *   - ESP sync (L158) → [newsletterService] ESP sync
 *   - ESP unsubscribe (L259) → [newsletterService] ESP unsubscribe
 *   - subscribe outer catch (L361) → [newsletterService] subscribe
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/newsletterService.web.js'),
  'utf8',
);

describe('cf-44qt sibling — newsletterService.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 3 expected sites with canonical [newsletterService] prefix', () => {
    const labels = ['ESP sync', 'ESP unsubscribe', 'subscribe'];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[newsletterService\\] ${label}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 3 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(3);
  });
});
