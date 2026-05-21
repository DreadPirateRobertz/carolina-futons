/**
 * @file cf-tok3-batch5-logError.test.js
 * @description cf-tok3 batch5 — re-ship of customizationService + photoReviews
 * after PR #1428 was closed due to challengeService conflict with cf-44qt batch5.
 * These 2 files are NOT in any cf-44qt batch — exclusively cf-tok3.
 *
 * Mayor PACE ALERT 08:59 — cf-tok3 wave.
 */
import { describe, it, expect } from 'vitest';

const FILES = ['customizationService', 'photoReviews'];

async function readSrc(name) {
  const { readFile } = await import('node:fs/promises');
  return readFile(
    new URL(`../src/backend/${name}.web.js`, import.meta.url),
    'utf8',
  );
}

describe.each(FILES)('cf-tok3 %s — console.error → logError migration', (name) => {
  it('source file contains zero raw console.error calls', async () => {
    const src = await readSrc(name);
    const stripped = src.replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/console\.error/);
  });

  it('source file imports logError from backend/utils/errorHandler', async () => {
    const src = await readSrc(name);
    expect(src).toMatch(
      /import\s+\{\s*[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it(`source file uses ${name}.* context tag prefix in at least one logError call`, async () => {
    const src = await readSrc(name);
    const moduleTagRegex = new RegExp(`logError[\\s\\S]*?['"]${name}[.:]`);
    expect(src).toMatch(moduleTagRegex);
  });
});
