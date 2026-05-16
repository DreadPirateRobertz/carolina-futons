/**
 * cf-44qt sibling — contentScheduler.web.js observability cleanup.
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
  currentMember: {
    getMember: vi.fn(async () => ({ _id: 'admin-1' })),
    getRoles: vi.fn(async () => [{ _id: 'admin', title: 'Admin' }]),
  },
}));
vi.mock('wix-secrets-backend', () => ({ getSecret: vi.fn(async () => 'cron-secret') }));

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
    __setQueryError('ContentSchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/contentScheduler.web.js');
    await mod.processContentSchedule('cron-secret');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/contentScheduler/);
    expect(allTags).toMatch(/processContentSchedule/);
  });

  it('getScheduleQueue wires logError on ContentSchedule query throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/contentScheduler.web.js');
    await mod.getScheduleQueue();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/contentScheduler/);
    expect(allTags).toMatch(/getScheduleQueue/);
  });

  it('getScheduleStats wires logError on ContentSchedule query throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/contentScheduler.web.js');
    await mod.getScheduleStats();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/contentScheduler/);
    expect(allTags).toMatch(/getScheduleStats/);
  });
});
