/**
 * cf-44qt sibling — contentScheduler.web.js observability cleanup.
 *
 * Pins post-migration contract: every catch calls
 * `logError('[contentScheduler] <fn> failed', err)` or
 * `logError('[contentScheduler] processContentSchedule item-action
 * failed for <id>', actionErr)` for the inner per-item action catch.
 *
 * 4 tests = 1 per webMethod. All 4 query/mutate `ContentSchedule`.
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
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'm-1' })) },
}));
// processContentSchedule first verifies a CONTENT_CRON_KEY secret;
// align the mock so the auth check passes and the catch reaches the
// wixData query path.
vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => 'test-cron-secret'),
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — contentScheduler.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('processContentSchedule wires logError on ContentSchedule query throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData query failure'));
    const mod = await import('../src/backend/contentScheduler.web.js');
    await mod.processContentSchedule('test-cron-secret');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/contentScheduler/);
    expect(allTags).toMatch(/processContentSchedule/);
  });

  it('getScheduleQueue wires logError on ContentSchedule query throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData query failure'));
    const mod = await import('../src/backend/contentScheduler.web.js');
    await mod.getScheduleQueue();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/contentScheduler/);
    expect(allTags).toMatch(/getScheduleQueue/);
  });

  it('cancelScheduledItem wires logError on ContentSchedule query/get throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData query failure'));
    const mod = await import('../src/backend/contentScheduler.web.js');
    await mod.cancelScheduledItem('item-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/contentScheduler/);
    expect(allTags).toMatch(/cancelScheduledItem/);
  });

  it('getScheduleStats wires logError on ContentSchedule query throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData query failure'));
    const mod = await import('../src/backend/contentScheduler.web.js');
    await mod.getScheduleStats();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/contentScheduler/);
    expect(allTags).toMatch(/getScheduleStats/);
  });
});
