/**
 * cf-44qt sibling — productRecommendations.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateSlug: (s) => s,
  validateId: (s) => s,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — productRecommendations.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getRelatedProducts wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData failure'));
    const mod = await import('../src/backend/productRecommendations.web.js');
    await mod.getRelatedProducts('prod-1', 'futon-frames');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/productRecommendations/);
    expect(allTags).toMatch(/getRelatedProducts/);
  });

  it('getFeaturedProducts wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData failure'));
    const mod = await import('../src/backend/productRecommendations.web.js');
    await mod.getFeaturedProducts();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/productRecommendations/);
    expect(allTags).toMatch(/getFeaturedProducts/);
  });

  it('getSaleProducts wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData failure'));
    const mod = await import('../src/backend/productRecommendations.web.js');
    await mod.getSaleProducts();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/productRecommendations/);
    expect(allTags).toMatch(/getSaleProducts/);
  });

  it('getRecentlyViewed wires logError on RecentlyViewed query throw', async () => {
    __setQueryError('RecentlyViewed', new Error('wixData failure'));
    const mod = await import('../src/backend/productRecommendations.web.js');
    await mod.getRecentlyViewed();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/productRecommendations/);
    expect(allTags).toMatch(/getRecentlyViewed/);
  });
});
