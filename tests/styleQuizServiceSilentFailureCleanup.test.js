/**
 * cf-44qt sibling — styleQuizService.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — styleQuizService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getMyResult wires logError on StyleQuizResults query throw', async () => {
    __setQueryError('Members/StyleQuizResults', new Error('wixData failure'));
    const mod = await import('../src/backend/styleQuizService.web.js');
    await mod.getMyResult();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/styleQuizService/);
    expect(allTags).toMatch(/getMyResult/);
  });

  it('getSharedResult wires logError on StyleQuizResults query throw', async () => {
    __setQueryError('Members/StyleQuizResults', new Error('wixData failure'));
    const mod = await import('../src/backend/styleQuizService.web.js');
    await mod.getSharedResult('share-abc');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/styleQuizService/);
    expect(allTags).toMatch(/getSharedResult/);
  });

  it('saveQuizResult wires logError on StyleQuizResults insert throw', async () => {
    __setQueryError('Members/StyleQuizResults', new Error('wixData query failure'));
    const mod = await import('../src/backend/styleQuizService.web.js');
    await mod.saveQuizResult({ q1: 'a' }, 'tag');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/styleQuizService/);
    expect(allTags).toMatch(/saveQuizResult/);
  });
});
