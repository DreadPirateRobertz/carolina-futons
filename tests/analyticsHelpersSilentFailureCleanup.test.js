/**
 * cf-44qt sibling — analyticsHelpers.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in the 6 mutating
 * webMethods calls `logError('[analyticsHelpers] <fn> failed', err)`
 * instead of raw `console.error`. Mirrors the canonical pattern from
 * the cf-44qt audit memo (PRs #1387/#1389/#1392) and the
 * wishlistService PR #1410 / priceMatchService PR #1425 siblings.
 *
 * 6 tests = 1 per webMethod with a catch block:
 *   trackProductView, trackAddToCart, trackSocialShare,
 *   getMostViewedProducts, getTrendingProducts, trackPurchase.
 *
 * All 6 query `ProductAnalytics` first; __setQueryError on that
 * collection triggers the catch path in each.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
}));
// checkRateLimit callsite destructures `{ allowed }`. Mock must match.
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — analyticsHelpers.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('trackProductView wires logError on ProductAnalytics query throw', async () => {
    __setQueryError('ProductAnalytics', new Error('wixData query failure'));
    const mod = await import('../src/backend/analyticsHelpers.web.js');
    await mod.trackProductView('p-1', 'cat-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/analyticsHelpers/);
    expect(allTags).toMatch(/trackProductView/);
    expect(allTags).toMatch(/failed/);
  });

  it('trackAddToCart wires logError on ProductAnalytics query throw', async () => {
    __setQueryError('ProductAnalytics', new Error('wixData query failure'));
    const mod = await import('../src/backend/analyticsHelpers.web.js');
    await mod.trackAddToCart('p-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/analyticsHelpers/);
    expect(allTags).toMatch(/trackAddToCart/);
  });

  it('trackSocialShare wires logError on ProductAnalytics query throw', async () => {
    __setQueryError('ProductAnalytics', new Error('wixData query failure'));
    const mod = await import('../src/backend/analyticsHelpers.web.js');
    await mod.trackSocialShare('p-1', 'twitter');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/analyticsHelpers/);
    expect(allTags).toMatch(/trackSocialShare/);
  });

  it('getMostViewedProducts wires logError on ProductAnalytics query throw', async () => {
    __setQueryError('ProductAnalytics', new Error('wixData query failure'));
    const mod = await import('../src/backend/analyticsHelpers.web.js');
    await mod.getMostViewedProducts(10);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/analyticsHelpers/);
    expect(allTags).toMatch(/getMostViewedProducts/);
  });

  it('getTrendingProducts wires logError on ProductAnalytics query throw', async () => {
    __setQueryError('ProductAnalytics', new Error('wixData query failure'));
    const mod = await import('../src/backend/analyticsHelpers.web.js');
    await mod.getTrendingProducts(10);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/analyticsHelpers/);
    expect(allTags).toMatch(/getTrendingProducts/);
  });

  it('trackPurchase wires logError on ProductAnalytics query throw', async () => {
    __setQueryError('ProductAnalytics', new Error('wixData query failure'));
    const mod = await import('../src/backend/analyticsHelpers.web.js');
    await mod.trackPurchase('p-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/analyticsHelpers/);
    expect(allTags).toMatch(/trackPurchase/);
  });
});
