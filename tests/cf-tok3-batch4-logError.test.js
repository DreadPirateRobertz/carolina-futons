/**
 * @file cf-tok3-batch4-logError.test.js
 * @description cf-tok3 wave fifth small-class batch:
 *   - orderTracking.web.js (4 sites)
 *   - liveShowroom.web.js (4 sites)
 *   - analyticsHelpers.web.js (6 sites)
 *
 * Mayor PACE ALERT 08:59 — cf-tok3 wave. Non-conflicting with cf-44qt
 * batch5/batch6 parallel-agent PRs.
 */
import { describe, it, expect } from 'vitest';

const FILES = ['orderTracking', 'liveShowroom', 'analyticsHelpers'];

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

  it(`source file uses ${name}[.:] context tag prefix in at least one logError call`, async () => {
    const src = await readSrc(name);
    const moduleTagRegex = new RegExp(`logError\\(\\s*['"\`]${name}[.:]`);
    expect(src).toMatch(moduleTagRegex);
  });
});
