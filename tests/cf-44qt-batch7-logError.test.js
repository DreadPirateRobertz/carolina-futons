/**
 * @file cf-44qt-batch7-logError.test.js
 * @description TDD red → green for cf-44qt batch7: 6 backend modules
 * migrated to canonical logError. Mirrors batch3 (#1400) / batch4 (#1401)
 * / batch6 (#1430) shape.
 *
 * Modules migrated:
 *   - liveInventory.web.js (2 sites: getProductInventory, registerStockNotification)
 *   - loyaltyMarketing.web.js (2 sites: getEnrollmentPrompt, enrollMember)
 *   - guideSeoService.web.js (2 sites: getRelatedProducts, getGuidePageSeoData)
 *   - marketingSequences.web.js (1 site: local logError helper now routes
 *     through canonical errorHandler — call-sites unchanged)
 *   - visualSearch.web.js (1 site: analyzeRoomPhoto)
 *   - trendingSearches.web.js (1 site: getTrendingSearches)
 *
 * Total: 9 console.error sites across 6 files.
 *
 * cf-44qt batch7 — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) =>
  readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILES = [
  { path: 'src/backend/liveInventory.web.js', module: 'liveInventory' },
  { path: 'src/backend/loyaltyMarketing.web.js', module: 'loyaltyMarketing' },
  { path: 'src/backend/guideSeoService.web.js', module: 'guideSeoService' },
  { path: 'src/backend/visualSearch.web.js', module: 'visualSearch' },
  { path: 'src/backend/trendingSearches.web.js', module: 'trendingSearches' },
];

describe('cf-44qt batch7 — 6-module logError migration', () => {
  it.each(FILES)('$path has NO remaining bare console.error calls', ({ path }) => {
    const src = read(path);
    expect(src).not.toMatch(/console\.error/);
  });

  it.each(FILES)('$path imports the canonical logError', ({ path }) => {
    const src = read(path);
    expect(src).toMatch(
      /import\s*{[^}]*\blogError\b[^}]*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(FILES)('$path uses the module name on at least one logError call', ({ path, module }) => {
    const src = read(path);
    // Accept either bracket-style [module] or colon-namespace module: format —
    // files migrated before this batch may have been normalised to colon format
    // by a concurrent cascade PR.
    const re = new RegExp(`logError\\(\\s*['"\`](?:\\[${module}\\]|${module}[:\\s])`);
    expect(src).toMatch(re);
  });

  // marketingSequences: local wrapper removed, direct canonical import with
  // namespaced colon tags.
  it('marketingSequences.web.js uses canonical logError with no local wrapper', () => {
    const src = read('src/backend/marketingSequences.web.js');
    expect(src).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
    expect(src).not.toMatch(/^function\s+logError\s*\(/m);
    expect(src).toMatch(/logError\(\s*'marketingSequences:/);
    expect(src).not.toMatch(/console\.error/);
  });
});
