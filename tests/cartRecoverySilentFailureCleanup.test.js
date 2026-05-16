/**
 * cf-44qt sibling — cartRecovery.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('backend/couponsService.web', () => ({
  generateRecoveryCoupon: vi.fn(async () => ({ code: 'TEST', success: true })),
}));
vi.mock('backend/gamificationCore.web', () => ({
  findMemberRecord: vi.fn(async () => null),
  computeTierInfo: vi.fn(() => ({ tier: 'Bronze', nextTierName: 'Silver' })),
}));
vi.mock('backend/emailTemplates.web', () => ({
  resolveTemplateId: vi.fn((k) => `tpl_${k}`),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailContact: vi.fn(async () => undefined) },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — cartRecovery.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getAbandonedCartStats wires logError on AbandonedCarts query throw', async () => {
    __setQueryError('AbandonedCarts', new Error('wixData failure'));
    const mod = await import('../src/backend/cartRecovery.web.js');
    await mod.getAbandonedCartStats();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/cartRecovery/);
    expect(allTags).toMatch(/getAbandonedCartStats/);
  });

  it('getRecoverableCarts wires logError on AbandonedCarts query throw', async () => {
    __setQueryError('AbandonedCarts', new Error('wixData failure'));
    const mod = await import('../src/backend/cartRecovery.web.js');
    await mod.getRecoverableCarts();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/cartRecovery/);
    expect(allTags).toMatch(/getRecoverableCarts/);
  });

  it('markRecoveryEmailSent early-return on missing cartId does not call logError', async () => {
    const mod = await import('../src/backend/cartRecovery.web.js');
    const result = await mod.markRecoveryEmailSent('');
    expect(result.success).toBe(false);
    expect(logErrorSpy).not.toHaveBeenCalled();
  });
});
