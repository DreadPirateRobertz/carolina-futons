/**
 * cf-44qt sibling — promotions.web.js observability cleanup.
 *
 * Pins post-migration contract: 2 webMethods' catches call
 * `logError('[promotions] <fn> failed', err)`. Same canonical
 * pattern.
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

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — promotions.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getActivePromotion wires logError on Promotions query throw', async () => {
    __setQueryError('Promotions', new Error('wixData query failure'));
    const mod = await import('../src/backend/promotions.web.js');
    await mod.getActivePromotion('homepage');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/promotions/);
    expect(allTags).toMatch(/getActivePromotion/);
  });

  it('getFlashSales wires logError on Promotions query throw', async () => {
    __setQueryError('Promotions', new Error('wixData query failure'));
    const mod = await import('../src/backend/promotions.web.js');
    await mod.getFlashSales();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/promotions/);
    expect(allTags).toMatch(/getFlashSales/);
  });
});
