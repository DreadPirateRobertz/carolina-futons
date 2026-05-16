/**
 * cf-44qt sibling — searchService.web.js observability cleanup.
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

describe('cf-44qt sibling — searchService.web.js observability cleanup', () => {
  beforeEach(async () => {
    logErrorSpy.mockClear();
    resetData();
    const mod = await import('../src/backend/searchService.web.js');
    if (mod.__clearCache) mod.__clearCache();
  });

  it('searchProducts wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData failure'));
    const mod = await import('../src/backend/searchService.web.js');
    if (mod.__clearCache) mod.__clearCache();
    await mod.searchProducts({ category: 'futons' });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/searchService/);
    expect(allTags).toMatch(/searchProducts/);
  });

  it('getFilterValues wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData failure'));
    const mod = await import('../src/backend/searchService.web.js');
    if (mod.__clearCache) mod.__clearCache();
    await mod.getFilterValues('futons');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/searchService/);
    expect(allTags).toMatch(/getFilterValues/);
  });

  it('happy-path getPopularSearches does not call logError', async () => {
    const mod = await import('../src/backend/searchService.web.js');
    if (mod.__clearCache) mod.__clearCache();
    await mod.getPopularSearches();
    expect(logErrorSpy).not.toHaveBeenCalled();
  });
});
