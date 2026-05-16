/**
 * cf-44qt sibling — warrantyService.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
  validateEmail: () => true,
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

describe('cf-44qt sibling — warrantyService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getMyWarranties wires logError on Warranties query throw', async () => {
    __setQueryError('WarrantyRegistrations', new Error('wixData failure'));
    const mod = await import('../src/backend/warrantyService.web.js');
    await mod.getMyWarranties();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/warrantyService/);
    expect(allTags).toMatch(/getMyWarranties/);
  });

  it('getWarrantyDetails wires logError on Warranties query throw', async () => {
    __setQueryError('WarrantyRegistrations', new Error('wixData failure'));
    const mod = await import('../src/backend/warrantyService.web.js');
    await mod.getWarrantyDetails('warranty-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/warrantyService/);
    expect(allTags).toMatch(/getWarrantyDetails/);
  });

  it('getMyClaims wires logError on WarrantyClaims query throw', async () => {
    __setQueryError('WarrantyClaims', new Error('wixData failure'));
    const mod = await import('../src/backend/warrantyService.web.js');
    await mod.getMyClaims();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/warrantyService/);
    expect(allTags).toMatch(/getMyClaims/);
  });

  it('getClaimStatus wires logError on WarrantyClaims query throw', async () => {
    __setQueryError('WarrantyClaims', new Error('wixData failure'));
    const mod = await import('../src/backend/warrantyService.web.js');
    await mod.getClaimStatus('claim-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/warrantyService/);
    expect(allTags).toMatch(/getClaimStatus/);
  });
});
