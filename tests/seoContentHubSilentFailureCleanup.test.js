/**
 * cf-44qt sibling — seoContentHub.web.js observability cleanup.
 *
 * This module is pure data + JSON-LD generation (no wixData calls), so the
 * 6 catch blocks are defensive (unreachable under normal flow). The migration
 * is mechanical text-replacement; this test pins that the module continues
 * to function + the new logError import is present at module load.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateSlug: (s) => s,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-44qt sibling — seoContentHub.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
  });

  it('module loads cleanly with the new logError import', async () => {
    const mod = await import('../src/backend/seoContentHub.web.js');
    expect(typeof mod.getContentHub).toBe('function');
    expect(typeof mod.getPillarGuide).toBe('function');
  });

  it('happy-path getContentHub does not call logError (no spurious noise)', async () => {
    const mod = await import('../src/backend/seoContentHub.web.js');
    const result = await mod.getContentHub();
    expect(result.success).toBe(true);
    expect(result.hub.guideCount).toBe(8);
    expect(logErrorSpy).not.toHaveBeenCalled();
  });

  it('happy-path getPillarGuide does not call logError', async () => {
    const mod = await import('../src/backend/seoContentHub.web.js');
    const result = await mod.getPillarGuide('futon-frames');
    expect(result.success).toBe(true);
    expect(result.guide).not.toBeNull();
    expect(logErrorSpy).not.toHaveBeenCalled();
  });
});
