/**
 * @file cf-tok3-mobileChallenge-logError.test.js
 * @description cf-tok3 mobileChallengeService batch: pin source migration
 * from console.error to canonical logError.
 *
 * Mayor PACE ALERT 08:59 — small-class batch under Stilgar greenlight.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cf-tok3 mobileChallengeService — console.error → logError migration', () => {
  it('source file contains zero raw console.error calls (canonical logError only)', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(
      new URL('../src/backend/mobileChallengeService.web.js', import.meta.url),
      'utf8',
    );
    const stripped = src.replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/console\.error/);
  });

  it('source file imports logError from backend/utils/errorHandler', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(
      new URL('../src/backend/mobileChallengeService.web.js', import.meta.url),
      'utf8',
    );
    expect(src).toMatch(
      /import\s+\{\s*logError\s*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses mobileChallengeService.* context tags for each catch block', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(
      new URL('../src/backend/mobileChallengeService.web.js', import.meta.url),
      'utf8',
    );
    // The three catch blocks should each route through logError with a
    // namespaced context. Match the three expected tags directly.
    expect(src).toMatch(/logError\(\s*['"]mobileChallengeService\.completeMobileChallenge\.syntheticEvent['"]/);
    expect(src).toMatch(/logError\(\s*['"]mobileChallengeService\.completeMobileChallenge['"]/);
    expect(src).toMatch(/logError\(\s*['"]mobileChallengeService\.getMobileChallengeProgress['"]/);
  });
});
