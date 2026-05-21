/**
 * cf-44qt sibling — styleQuiz.web.js observability cleanup.
 *
 * Pins post-migration contract: the 2 webMethods with catch blocks
 * call `logError('[styleQuiz] <fn> failed', err)`. Same canonical
 * pattern.
 *
 * getQuizOptions + getPersonalizedCopy have no catch blocks
 * (synchronous answer-aggregation only) — out of scope.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateEmail: () => true,
}));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(async () => {}),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  __reset as resetData,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — styleQuiz.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getQuizRecommendations wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData query failure'));
    const mod = await import('../src/backend/styleQuiz.web.js');
    await mod.getQuizRecommendations({ use: 'guest', size: 'queen', style: 'modern', budget: 'mid' });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/styleQuiz/);
    expect(allTags).toMatch(/getQuizRecommendations/);
    expect(allTags).toMatch(/failed/);
  });

  it('captureQuizLead wires logError on NewsletterSubscribers insert throw', async () => {
    __setInsertError('NewsletterSubscribers', new Error('wixData insert failure'));
    __setQueryError('NewsletterSubscribers', new Error('wixData query failure'));
    const mod = await import('../src/backend/styleQuiz.web.js');
    await mod.captureQuizLead('user@example.com', { use: 'guest' });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/styleQuiz/);
    expect(allTags).toMatch(/captureQuizLead/);
  });
});
