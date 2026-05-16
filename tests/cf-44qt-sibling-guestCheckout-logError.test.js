/**
 * @file cf-44qt-sibling-guestCheckout-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 4
 * console.error sites in src/backend/guestCheckout.web.js migrated
 * to canonical logError. One site uses template-literal interpolation
 * (linkGuestOrder per-item failure logs the item._id).
 *
 * Sites migrated (4):
 *   - saveGuestSession (L96)
 *   - linkGuestOrder per-item with `${item._id}` (L156)
 *   - linkGuestOrdersToMember (L162)
 *   - getGuestOrdersByEmail (L209)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/guestCheckout.web.js'),
  'utf8',
);

describe('cf-44qt sibling — guestCheckout.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for the 3 fixed-label sites + 1 template-literal site', () => {
    const fixedLabels = ['saveGuestSession', 'linkGuestOrdersToMember', 'getGuestOrdersByEmail'];
    for (const label of fixedLabels) {
      const re = new RegExp(`logError\\(\\s*['"]\\[guestCheckout\\] ${label}['"]`);
      expect(SRC).toMatch(re);
    }
    // Template-literal site: per-item linkGuestOrder logs item._id
    expect(SRC).toMatch(
      /logError\(\s*`\[guestCheckout\] linkGuestOrder \$\{item\._id\}`/,
    );
  });

  it('logError invocation count matches the 4 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(4);
  });
});
