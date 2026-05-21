/**
 * cf-44qt sibling — wwex-freight.web.js observability cleanup.
 *
 * Pins post-migration contract: both error paths in getLTLRates
 * (HTTP-error branch + catch block) call logError instead of raw
 * console.error. Same canonical pattern.
 *
 * 2 tests = HTTP-error path + catch-block path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => 'test-secret'),
}));

// fetch is module-level; swap per-test via fetchImpl ref.
let fetchImpl = vi.fn(async () => ({ ok: true, text: async () => '<xml/>' }));
vi.mock('wix-fetch', () => ({
  fetch: (...args) => fetchImpl(...args),
}));

describe('cf-44qt sibling — wwex-freight.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
  });

  it('getLTLRates wires logError on WWEX API HTTP-error response', async () => {
    fetchImpl = vi.fn(async () => ({ ok: false, status: 503, text: async () => '' }));
    const mod = await import('../src/backend/wwex-freight.web.js');
    const result = await mod.getLTLRates('28792', '90210', [
      { weight: 100, length: 48, width: 30, height: 12 },
    ]);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/wwex-freight/);
    expect(allTags).toMatch(/getLTLRates/);
    expect(allTags).toMatch(/503/);
    expect(result.success).toBe(false);
    expect(result.fallback).toBeDefined();
  });

  it('getLTLRates wires logError on fetch throw (network failure)', async () => {
    fetchImpl = vi.fn(async () => { throw new Error('network down'); });
    const mod = await import('../src/backend/wwex-freight.web.js');
    const result = await mod.getLTLRates('28792', '90210', [
      { weight: 100, length: 48, width: 30, height: 12 },
    ]);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/wwex-freight/);
    expect(allTags).toMatch(/getLTLRates/);
    expect(result.success).toBe(false);
    expect(result.fallback).toBeDefined();
  });
});
