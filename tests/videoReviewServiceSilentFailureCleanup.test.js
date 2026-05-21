/**
 * cf-44qt sibling — videoReviewService.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  isWixMediaUrl: () => true,
}));
vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: vi.fn(async () => ({ success: true })),
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
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — videoReviewService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('submitVideoReview wires logError on VideoReviews insert throw', async () => {
    __setInsertError('VideoReviews', new Error('wixData failure'));
    const mod = await import('../src/backend/videoReviewService.web.js');
    await mod.submitVideoReview('prod-1', 'wix:video://v1/abc/file.mp4', 'caption');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/videoReviewService/);
    expect(allTags).toMatch(/submitVideoReview/);
  });

  it('getVideoReviews wires logError on VideoReviews query throw', async () => {
    __setQueryError('VideoReviews', new Error('wixData failure'));
    const mod = await import('../src/backend/videoReviewService.web.js');
    await mod.getVideoReviews('prod-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/videoReviewService/);
    expect(allTags).toMatch(/getVideoReviews/);
  });

  it('getProductVideoReviews wires logError on VideoReviews query throw', async () => {
    __setQueryError('VideoReviews', new Error('wixData failure'));
    const mod = await import('../src/backend/videoReviewService.web.js');
    await mod.getProductVideoReviews('prod-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/videoReviewService/);
    expect(allTags).toMatch(/getProductVideoReviews/);
  });
});
