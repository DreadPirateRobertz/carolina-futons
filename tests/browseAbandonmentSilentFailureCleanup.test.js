/**
 * cf-44qt sibling — browseAbandonment.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateEmail: () => true,
  validateId: (s) => s,
}));
vi.mock('backend/utils/safeParse', () => ({
  safeParse: (s) => { try { return JSON.parse(s); } catch { return null; } },
}));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('backend/utils/auditLog', () => ({ logAuditEvent: vi.fn() }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — browseAbandonment.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('trackBrowseSession wires logError on BrowseSessions query throw', async () => {
    __setQueryError('BrowseSessions', new Error('wixData failure'));
    const mod = await import('../src/backend/browseAbandonment.web.js');
    await mod.trackBrowseSession({ sessionId: 'sess-1', productsViewed: [], totalDuration: 1000 });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/browseAbandonment/);
    expect(allTags).toMatch(/trackBrowseSession/);
  });

  it('getBrowseAbandonmentStats wires logError on BrowseSessions query throw', async () => {
    __setQueryError('BrowseSessions', new Error('wixData failure'));
    const mod = await import('../src/backend/browseAbandonment.web.js');
    await mod.getBrowseAbandonmentStats();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/browseAbandonment/);
    expect(allTags).toMatch(/getBrowseAbandonmentStats/);
  });

  it('exportAbandonmentInsights wires logError on BrowseSessions query throw', async () => {
    __setQueryError('BrowseSessions', new Error('wixData failure'));
    const mod = await import('../src/backend/browseAbandonment.web.js');
    await mod.exportAbandonmentInsights();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/browseAbandonment/);
    expect(allTags).toMatch(/exportAbandonmentInsights/);
  });
});
