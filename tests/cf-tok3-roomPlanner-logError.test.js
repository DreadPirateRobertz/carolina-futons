/**
 * @file cf-tok3-roomPlanner-logError.test.js
 * Source-scan regression pin for roomPlanner migration.
 * cf-tok3 wave. Mayor PACE ALERT 08:59.
 */
import { describe, it, expect } from 'vitest';

async function readSrc() {
  const { readFile } = await import('node:fs/promises');
  return readFile(
    new URL('../src/backend/roomPlanner.web.js', import.meta.url),
    'utf8',
  );
}

describe('cf-tok3 roomPlanner — console.error → logError migration', () => {
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

  it('all 6 webMethods route through roomPlanner.* context tags', async () => {
    const src = await readSrc();
    expect(src).toMatch(/logError\(\s*['"]roomPlanner\.createRoomLayout['"]/);
    expect(src).toMatch(/logError\(\s*['"]roomPlanner\.addProductToLayout['"]/);
    expect(src).toMatch(/logError\(\s*['"]roomPlanner\.getLayoutPreview['"]/);
    expect(src).toMatch(/logError\(\s*['"]roomPlanner\.shareLayout['"]/);
    expect(src).toMatch(/logError\(\s*['"]roomPlanner\.saveLayout['"]/);
    expect(src).toMatch(/logError\(\s*['"]roomPlanner\.getProductDimensions['"]/);
  });
});
