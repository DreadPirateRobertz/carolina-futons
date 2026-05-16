/**
 * cf-44qt sibling — returnsService.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
  validateEmail: () => true,
  redactEmail: (s) => s,
}));
vi.mock('backend/utils/auditLog', () => ({ logAuditEvent: vi.fn() }));
vi.mock('backend/utils/safeParse', () => ({ safeParse: (s) => { try { return JSON.parse(s); } catch { return null; } } }));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('backend/ups-shipping.web', () => ({
  createShipment: vi.fn(async () => ({ success: false, error: 'mock' })),
  trackShipment: vi.fn(async () => ({ success: false, error: 'mock' })),
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

describe('cf-44qt sibling — returnsService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getReturnEligibleOrders wires logError on Orders query throw', async () => {
    __setQueryError('Stores/Orders', new Error('wixData failure'));
    const mod = await import('../src/backend/returnsService.web.js');
    await mod.getReturnEligibleOrders();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/returnsService/);
    expect(allTags).toMatch(/getReturnEligibleOrders/);
  });

  it('getMyReturns wires logError on Returns query throw', async () => {
    __setQueryError('Returns', new Error('wixData failure'));
    const mod = await import('../src/backend/returnsService.web.js');
    await mod.getMyReturns();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/returnsService/);
    expect(allTags).toMatch(/getMyReturns/);
  });

  it('getReturnByRma wires logError on Returns query throw', async () => {
    __setQueryError('Returns', new Error('wixData failure'));
    const mod = await import('../src/backend/returnsService.web.js');
    await mod.getReturnByRma('RMA-001');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/returnsService/);
    expect(allTags).toMatch(/getReturnByRma/);
  });

  it('getAdminReturns wires logError on Returns query throw', async () => {
    __setQueryError('Returns', new Error('wixData failure'));
    const mod = await import('../src/backend/returnsService.web.js');
    await mod.getAdminReturns({});
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/returnsService/);
    expect(allTags).toMatch(/getAdminReturns/);
  });
});
