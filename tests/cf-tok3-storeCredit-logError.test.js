/**
 * @file cf-tok3-storeCredit-logError.test.js
 * Source-scan regression pin for storeCreditService migration.
 * cf-tok3 wave. Mayor PACE ALERT 08:59.
 */
import { describe, it, expect } from 'vitest';

async function readSrc() {
  const { readFile } = await import('node:fs/promises');
  return readFile(
    new URL('../src/backend/storeCreditService.web.js', import.meta.url),
    'utf8',
  );
}

describe('cf-tok3 storeCreditService — console.error → logError migration', () => {
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

  it('all 6 webMethods route through storeCreditService.* context tags', async () => {
    const src = await readSrc();
    expect(src).toMatch(/logError\(\s*['"]storeCreditService\.issueStoreCredit['"]/);
    expect(src).toMatch(/logError\(\s*['"]storeCreditService\.getMyStoreCredit['"]/);
    expect(src).toMatch(/logError\(\s*['"]storeCreditService\.applyStoreCredit['"]/);
    expect(src).toMatch(/logError\(\s*['"]storeCreditService\.getStoreCreditHistory['"]/);
    expect(src).toMatch(/logError\(\s*['"]storeCreditService\.giftStoreCredit['"]/);
    expect(src).toMatch(/logError\(\s*['"]storeCreditService\.getExpiringCredits['"]/);
  });
});
