/**
 * cf-44qt sibling — productReviews.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — productReviews.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getReviewSummary wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData failure'));
    const mod = await import('../src/backend/productReviews.web.js');
    await mod.getReviewSummary('prod-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/productReviews/);
    expect(allTags).toMatch(/getReviewSummary/);
  });

  it('getUnifiedReviews wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData failure'));
    const mod = await import('../src/backend/productReviews.web.js');
    await mod.getUnifiedReviews('prod-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/productReviews/);
    expect(allTags).toMatch(/getUnifiedReviews/);
  });

  it('getModerationQueue wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData failure'));
    const mod = await import('../src/backend/productReviews.web.js');
    await mod.getModerationQueue();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/productReviews/);
    expect(allTags).toMatch(/getModerationQueue/);
  });
});
