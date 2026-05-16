/**
 * @file cf-44qt-sibling-fbCatalog-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 4
 * console.error sites in src/backend/facebookCatalog.web.js
 * migrated to canonical logError.
 *
 * Sites migrated (4):
 *   - buildCatalogBatch product error (L496)
 *   - notifyOwner failed (L547)
 *   - refreshFacebookCatalog (L585)
 *   - exportCustomerAudienceData (L655) — pre-fix lacked [module] prefix
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/facebookCatalog.web.js'),
  'utf8',
);

describe('cf-44qt sibling — facebookCatalog.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 4 expected sites with canonical [facebookCatalog] prefix', () => {
    const labels = [
      'buildCatalogBatch product',
      'notifyOwner failed',
      'refreshFacebookCatalog',
      'exportCustomerAudienceData',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[facebookCatalog\\] ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 4 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(4);
  });
});
