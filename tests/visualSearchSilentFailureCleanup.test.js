/**
 * cf-44qt sibling — visualSearch.web.js observability cleanup.
 *
 * Pins post-migration contract: analyzeRoomPhoto's single catch
 * calls `logError('[visualSearch] analyzeRoomPhoto failed', err)`
 * instead of raw `console.error`. Mirrors canonical pattern from my
 * 2026-05-16 audit memo + 7-PR sibling cluster.
 *
 * 3 tests:
 *   - Vision API HTTP error (auth) → logError fires + 'vision_auth_error'
 *   - Vision API HTTP error (rate limit) → logError fires + tagged
 *   - Generic Vision call failure → logError fires + 'analysis_failed'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => 'test-vision-key'),
}));

// Module-scope fetch mock used by every test. Each test reassigns
// `fetchImpl` before invoking — vi.mock with a factory closure lets
// us route through one entry point + swap behavior per case.
let fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
vi.mock('wix-fetch', () => ({
  fetch: (...args) => fetchImpl(...args),
}));

describe('cf-44qt sibling — visualSearch.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
  });

  it('analyzeRoomPhoto wires logError on Vision API auth failure', async () => {
    fetchImpl = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }));
    const mod = await import('../src/backend/visualSearch.web.js');
    const result = await mod.analyzeRoomPhoto('https://static.wixstatic.com/example.jpg');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/visualSearch/);
    expect(allTags).toMatch(/analyzeRoomPhoto/);
    expect(allTags).toMatch(/failed/);
    expect(result.error).toBe('vision_auth_error');
  });

  it('analyzeRoomPhoto wires logError on Vision API rate-limit', async () => {
    fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const mod = await import('../src/backend/visualSearch.web.js');
    const result = await mod.analyzeRoomPhoto('https://static.wixstatic.com/example.jpg');
    expect(logErrorSpy).toHaveBeenCalled();
    expect(result.error).toBe('vision_rate_limited');
  });

  it('analyzeRoomPhoto wires logError on generic fetch failure (no vision_ tag)', async () => {
    fetchImpl = vi.fn(async () => { throw new Error('network down'); });
    const mod = await import('../src/backend/visualSearch.web.js');
    const result = await mod.analyzeRoomPhoto('https://static.wixstatic.com/example.jpg');
    expect(logErrorSpy).toHaveBeenCalled();
    // Non-vision_ errors map to generic 'analysis_failed'
    expect(result.error).toBe('analysis_failed');
  });
});
