/**
 * cf-44qt sibling — reviewsService.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
  isWixMediaUrl: () => true,
}));
vi.mock('backend/utils/auditLog', () => ({ logAuditEvent: vi.fn() }));
vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: vi.fn(async () => ({ success: true })),
}));
vi.mock('backend/emailAutomation.web', () => ({
  recordEmailEvent: vi.fn(async () => ({})),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));
vi.mock('wix-media-backend', () => ({
  mediaManager: { getFileInfo: vi.fn(async () => ({})) },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — reviewsService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getPendingReviews wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData failure'));
    const mod = await import('../src/backend/reviewsService.web.js');
    await mod.getPendingReviews();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/reviewsService/);
    expect(allTags).toMatch(/getPendingReviews/);
  });

  it('getCategoryReviewSummaries wires logError on query throw', async () => {
    __setQueryError('Reviews', new Error('wixData failure'));
    const mod = await import('../src/backend/reviewsService.web.js');
    await mod.getCategoryReviewSummaries(['prod-1', 'prod-2']);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/reviewsService/);
    expect(allTags).toMatch(/getCategoryReviewSummaries/);
  });

  it('getVideoReviews wires logError on VideoReviews query throw', async () => {
    __setQueryError('VideoReviews', new Error('wixData failure'));
    const mod = await import('../src/backend/reviewsService.web.js');
    await mod.getVideoReviews('prod-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/reviewsService/);
    expect(allTags).toMatch(/getVideoReviews/);
  });

  it('getFeaturedReviews wires logError on Reviews query throw', async () => {
    __setQueryError('Reviews', new Error('wixData failure'));
    const mod = await import('../src/backend/reviewsService.web.js');
    await mod.getFeaturedReviews();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/reviewsService/);
    expect(allTags).toMatch(/getFeaturedReviews/);
  });
});
