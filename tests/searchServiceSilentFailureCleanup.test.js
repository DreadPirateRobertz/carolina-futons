/**
 * cf-44qt sibling — searchService.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in the 6 webMethods
 * calls `logError('[searchService] <fn> failed', err)` instead of
 * raw `console.error`. Mirrors the canonical pattern from my cf-44qt
 * audit memo (PRs #1387/#1389/#1392) and the sibling cluster
 * #1410 wishlistService / #1425 priceMatchService / #1436 analyticsHelpers.
 *
 * 4 tests cover the 4 webMethods that read wix-data (and thus can
 * be made to throw via __setQueryError). The 2 remaining webMethods
 * — getPopularSearches and recordSearchQuery — use in-memory
 * top-queries state via module-internal `getTopQueries` /
 * `recordQuery` helpers; their catches are paranoid (the
 * synchronous code path doesn't realistically throw). Migration is
 * mechanically verified (1:1 + same tag shape) but no runtime-throw
 * test pins them. Same gap-shape documented in PR #1425 for
 * priceMatchService.getPriceMatchById (wixData.get path).
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
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('searchProducts wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData query failure'));
    const mod = await import('../src/backend/searchService.web.js');
    await mod.searchProducts({ q: 'futon' });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/searchService/);
    expect(allTags).toMatch(/searchProducts/);
    expect(allTags).toMatch(/failed/);
  });

  it('getFilterValues wires logError on Stores/Products query throw (via buildFacets)', async () => {
    __setQueryError('Stores/Products', new Error('wixData query failure'));
    const mod = await import('../src/backend/searchService.web.js');
    await mod.getFilterValues('futon-frames');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/searchService/);
    expect(allTags).toMatch(/getFilterValues/);
  });

  it('fullTextSearch wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData query failure'));
    const mod = await import('../src/backend/searchService.web.js');
    await mod.fullTextSearch({ query: 'futon' });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/searchService/);
    expect(allTags).toMatch(/fullTextSearch/);
  });

  it('getAutocompleteSuggestions wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData query failure'));
    const mod = await import('../src/backend/searchService.web.js');
    await mod.getAutocompleteSuggestions('fut');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/searchService/);
    expect(allTags).toMatch(/getAutocompleteSuggestions/);
  });
});
