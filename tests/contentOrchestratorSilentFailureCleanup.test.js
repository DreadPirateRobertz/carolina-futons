/**
 * cf-44qt sibling — contentOrchestrator.web.js observability cleanup.
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
vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => 'test-secret'),
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — contentOrchestrator.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('triggerManualOrchestration wires logError on ContentSchedule query throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/contentOrchestrator.web.js');
    await mod.triggerManualOrchestration('new_arrival', { productId: 'p1', productName: 'Test' });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/contentOrchestrator/);
    expect(allTags).toMatch(/triggerManualOrchestration/);
  });

  it('getOrchestrationDashboard wires logError on ContentSchedule query throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/contentOrchestrator.web.js');
    await mod.getOrchestrationDashboard();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/contentOrchestrator/);
    expect(allTags).toMatch(/getOrchestrationDashboard/);
  });

  it('getOrchestrationHistory wires logError on ContentSchedule query throw', async () => {
    __setQueryError('ContentSchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/contentOrchestrator.web.js');
    await mod.getOrchestrationHistory();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/contentOrchestrator/);
    expect(allTags).toMatch(/getOrchestrationHistory/);
  });

  it('getOrchestrationConfig wires logError on OrchestrationConfig query throw', async () => {
    __setQueryError('OrchestrationConfig', new Error('wixData failure'));
    const mod = await import('../src/backend/contentOrchestrator.web.js');
    await mod.getOrchestrationConfig();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/contentOrchestrator/);
    expect(allTags).toMatch(/getOrchestrationConfig/);
  });
});
