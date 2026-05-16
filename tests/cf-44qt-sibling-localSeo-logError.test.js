/**
 * @file cf-44qt-sibling-localSeo-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 4
 * console.error sites in src/backend/localSeoService.web.js
 * migrated to canonical logError. Three sites use template-literal
 * slug interpolation (loadLocalPage / loadFeaturedProducts /
 * loadRelatedCityLinks); fourth (getLocalSlugs) is fixed.
 *
 * Sites migrated (4):
 *   - loadLocalPage with `${slug}` (L170)
 *   - loadFeaturedProducts with `${slug}` (L285)
 *   - loadRelatedCityLinks with `${slug}` (L334)
 *   - getLocalSlugs (L362)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/localSeoService.web.js'),
  'utf8',
);

describe('cf-44qt sibling — localSeoService.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError with canonical [localSeoService] prefix on template-literal slug-interp sites', () => {
    const templateLabels = [
      'loadLocalPage',
      'loadFeaturedProducts',
      'loadRelatedCityLinks',
    ];
    for (const label of templateLabels) {
      const re = new RegExp(
        `logError\\(\\s*\`\\[localSeoService\\] ${label} \\$\\{slug\\}\``,
      );
      expect(SRC).toMatch(re);
    }
    // Fixed-label site
    expect(SRC).toMatch(
      /logError\(\s*['"]\[localSeoService\] getLocalSlugs['"]/,
    );
  });

  it('logError invocation count matches the 4 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(4);
  });
});
