/**
 * cf-44qt sibling — ugcService.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
  isWixMediaUrl: () => true,
}));
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

describe('cf-44qt sibling — ugcService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getApprovedPhotos wires logError on UGCPhotos query throw', async () => {
    __setQueryError('UGCPhotos', new Error('wixData failure'));
    const mod = await import('../src/backend/ugcService.web.js');
    await mod.getApprovedPhotos();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/ugcService/);
    expect(allTags).toMatch(/getApprovedPhotos/);
  });

  it('getBeforeAfterPairs wires logError on UGCPhotos query throw', async () => {
    __setQueryError('UGCPhotos', new Error('wixData failure'));
    const mod = await import('../src/backend/ugcService.web.js');
    await mod.getBeforeAfterPairs();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/ugcService/);
    expect(allTags).toMatch(/getBeforeAfterPairs/);
  });

  it('getProductUGCPhotos wires logError on UGCPhotos query throw', async () => {
    __setQueryError('UGCPhotos', new Error('wixData failure'));
    const mod = await import('../src/backend/ugcService.web.js');
    await mod.getProductUGCPhotos('prod-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/ugcService/);
    expect(allTags).toMatch(/getProductUGCPhotos/);
  });

  it('getUGCStats wires logError on UGCPhotos query throw', async () => {
    __setQueryError('UGCPhotos', new Error('wixData failure'));
    const mod = await import('../src/backend/ugcService.web.js');
    await mod.getUGCStats();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/ugcService/);
    expect(allTags).toMatch(/getUGCStats/);
  });
});
