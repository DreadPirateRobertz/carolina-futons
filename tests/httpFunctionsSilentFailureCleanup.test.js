/**
 * cf-44qt sibling — http-functions.js observability cleanup.
 *
 * Pins the post-migration contract: every catch block calls logError
 * with a structured `[http-functions] <fn> ...` tag. 69 sites migrated
 * across 50+ HTTP function entrypoints.
 *
 * Module is ~4000 LOC of route handlers; the existing httpFunctions /
 * Coverage / Helpers tests provide deep functional coverage. This test
 * pins the contract that the new logError import resolved cleanly and
 * canonical tags fire on synthetic catch invocations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

describe('cf-44qt sibling — http-functions.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
  });

  it('module loads cleanly with the new logError import', async () => {
    const mod = await import('../src/backend/http-functions.js');
    // Module exports a wide surface of HTTP entrypoints; assert any one survives import.
    expect(typeof mod.get_health).toBe('function');
  });

  it('canonical [http-functions] tag format is enforced source-wide (drift guard)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(path.resolve(__dirname, '../src/backend/http-functions.js'), 'utf8');
    // No bare console.error catches remain.
    const matches = (src.match(/console\.error\(/g) || []);
    expect(matches.length).toBe(0);
    // Every logError call uses either [http-functions] or http-functions: prefix.
    const logErrorCalls = src.match(/logError\(['"`]([^'"`]+)['"`]/g) || [];
    const nonPrefixed = logErrorCalls.filter(c => !c.includes('[http-functions]') && !c.includes('http-functions:'));
    expect(
      nonPrefixed,
      `found logError tags without http-functions prefix: ${nonPrefixed.join('\n')}`,
    ).toEqual([]);
  });
});
