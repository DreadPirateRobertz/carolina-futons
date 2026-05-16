/**
 * @file cf-tok3-searchService-logError.test.js
 * Source-scan regression pin for searchService migration.
 * cf-tok3 wave. Mayor PACE ALERT 08:59.
 */
import { describe, it, expect } from 'vitest';

async function readSrc() {
  const { readFile } = await import('node:fs/promises');
  return readFile(
    new URL('../src/backend/searchService.web.js', import.meta.url),
    'utf8',
  );
}

describe('cf-tok3 searchService — console.error → logError migration', () => {
  it('source file contains zero raw console.error calls', async () => {
    const src = await readSrc();
    const stripped = src.replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/console\.error/);
  });

  it('source file imports logError from backend/utils/errorHandler', async () => {
    const src = await readSrc();
    expect(src).toMatch(
      /import\s+\{\s*[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('all 6 webMethods route through searchService.* context tags', async () => {
    const src = await readSrc();
    expect(src).toMatch(/logError\(\s*['"]searchService\.searchProducts['"]/);
    expect(src).toMatch(/logError\(\s*['"]searchService\.getFilterValues['"]/);
    expect(src).toMatch(/logError\(\s*['"]searchService\.fullTextSearch['"]/);
    expect(src).toMatch(/logError\(\s*['"]searchService\.getAutocompleteSuggestions['"]/);
    expect(src).toMatch(/logError\(\s*['"]searchService\.getPopularSearches['"]/);
    expect(src).toMatch(/logError\(\s*['"]searchService\.recordSearchQuery['"]/);
  });
});
