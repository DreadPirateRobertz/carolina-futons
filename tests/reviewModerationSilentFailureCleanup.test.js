/**
 * cf-44qt sibling — reviewModeration.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('backend/utils/auditLog', () => ({ logAuditEvent: vi.fn() }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — reviewModeration.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getModerationQueue wires logError on Reviews query throw', async () => {
    __setQueryError('ProductReviews', new Error('wixData failure'));
    const mod = await import('../src/backend/reviewModeration.web.js');
    await mod.getModerationQueue();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/reviewModeration/);
    expect(allTags).toMatch(/getModerationQueue/);
  });

  it('getModerationStats wires logError on Reviews query throw', async () => {
    __setQueryError('ProductReviews', new Error('wixData failure'));
    const mod = await import('../src/backend/reviewModeration.web.js');
    await mod.getModerationStats();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/reviewModeration/);
    expect(allTags).toMatch(/getModerationStats/);
  });

  it('autoRejectSpam wires logError on Reviews query throw', async () => {
    __setQueryError('ProductReviews', new Error('wixData failure'));
    const mod = await import('../src/backend/reviewModeration.web.js');
    await mod.autoRejectSpam();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/reviewModeration/);
    expect(allTags).toMatch(/autoRejectSpam/);
  });

  it('autoApproveEligible wires logError on Reviews query throw', async () => {
    __setQueryError('ProductReviews', new Error('wixData failure'));
    const mod = await import('../src/backend/reviewModeration.web.js');
    await mod.autoApproveEligible();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/reviewModeration/);
    expect(allTags).toMatch(/autoApproveEligible/);
  });
});
