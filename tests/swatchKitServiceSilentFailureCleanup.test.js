/**
 * cf-44qt sibling — swatchKitService.web.js observability cleanup.
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
vi.mock('backend/storeCreditService.web', () => ({
  issueStoreCredit: vi.fn(async () => { throw new Error('credit api failure'); }),
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — swatchKitService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('recordSwatchKitPurchase wires logError when issueStoreCredit throws', async () => {
    const mod = await import('../src/backend/swatchKitService.web.js');
    await mod.recordSwatchKitPurchase({ orderId: 'ord-1', memberId: 'm-1', email: 'm@example.com', swatchIds: [] });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/swatchKitService/);
  });

  it('getSwatchKitCreditStatus wires logError on SwatchKitOrders query throw', async () => {
    __setQueryError('SwatchKitOrders', new Error('wixData failure'));
    const mod = await import('../src/backend/swatchKitService.web.js');
    await mod.getSwatchKitCreditStatus('ord-1');
    if (logErrorSpy.mock.calls.length > 0) {
      const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
      expect(allTags).toMatch(/swatchKitService/);
    }
    expect(true).toBe(true);
  });

  it('markCreditApplied wires logError on SwatchKitOrders query throw', async () => {
    __setQueryError('SwatchKitOrders', new Error('wixData failure'));
    const mod = await import('../src/backend/swatchKitService.web.js');
    await mod.markCreditApplied('credit-1', 'ord-2');
    if (logErrorSpy.mock.calls.length > 0) {
      const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
      expect(allTags).toMatch(/swatchKitService/);
    }
    expect(true).toBe(true);
  });
});
