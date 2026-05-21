/**
 * cf-44qt sibling — productReviews.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in the 5 webMethods
 * calls `logError('[productReviews] <fn> failed', err)` instead of
 * raw `console.error`. Mirrors the canonical pattern from my
 * 2026-05-16 audit memo + 6-PR sibling cluster.
 *
 * 5 tests = 1 per webMethod. Each catches on Reviews collection
 * query throw.
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
    __setQueryError('Reviews', new Error('wixData query failure'));
    __setQueryError('PhotoReviews', new Error('wixData query failure'));
    const mod = await import('../src/backend/productReviews.web.js');
    await mod.getReviewSummary('p-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/productReviews/);
    expect(allTags).toMatch(/getReviewSummary/);
  });

  it('getUnifiedReviews wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData query failure'));
    __setQueryError('PhotoReviews', new Error('wixData query failure'));
    const mod = await import('../src/backend/productReviews.web.js');
    await mod.getUnifiedReviews('p-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/productReviews/);
    expect(allTags).toMatch(/getUnifiedReviews/);
  });

  it('getReviewHighlights wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData query failure'));
    const mod = await import('../src/backend/productReviews.web.js');
    await mod.getReviewHighlights('p-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/productReviews/);
    expect(allTags).toMatch(/getReviewHighlights/);
  });

  it('getBatchReviewSummaries wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData query failure'));
    __setQueryError('PhotoReviews', new Error('wixData query failure'));
    const mod = await import('../src/backend/productReviews.web.js');
    await mod.getBatchReviewSummaries(['p-1', 'p-2']);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/productReviews/);
    expect(allTags).toMatch(/getBatchReviewSummaries/);
  });

  it('getModerationQueue wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData query failure'));
    const mod = await import('../src/backend/productReviews.web.js');
    await mod.getModerationQueue();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/productReviews/);
    expect(allTags).toMatch(/getModerationQueue/);
  });
});
