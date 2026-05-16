/**
 * cf-44qt sibling — promotionsEngine.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — promotionsEngine.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('validatePromoCode wires logError on PromoCodes query throw', async () => {
    __setQueryError('PromoCodes', new Error('wixData failure'));
    const mod = await import('../src/backend/promotionsEngine.web.js');
    await mod.validatePromoCode('CODE-1', 100);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/promotionsEngine/);
    expect(allTags).toMatch(/validatePromoCode/);
  });

  it('getActiveFlashSales wires logError on FlashSales query throw', async () => {
    __setQueryError('FlashSales', new Error('wixData failure'));
    const mod = await import('../src/backend/promotionsEngine.web.js');
    await mod.getActiveFlashSales();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/promotionsEngine/);
    expect(allTags).toMatch(/getActiveFlashSales/);
  });

  it('getActiveBOGODeals wires logError on BOGODeals query throw', async () => {
    __setQueryError('BOGODeals', new Error('wixData failure'));
    const mod = await import('../src/backend/promotionsEngine.web.js');
    await mod.getActiveBOGODeals();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/promotionsEngine/);
    expect(allTags).toMatch(/getActiveBOGODeals/);
  });

  it('applyPromoCode propagates logError on inner PromoCodes query throw', async () => {
    __setQueryError('PromoCodes', new Error('wixData failure'));
    const mod = await import('../src/backend/promotionsEngine.web.js');
    await mod.applyPromoCode(
      'CODE-1',
      [{ _id: 'p1', price: 50, quantity: 1 }],
      { rateLimitKey: 'member-1' },
    );
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/promotionsEngine/);
    expect(allTags).toMatch(/(applyPromoCode|validatePromoCode)/);
  });
});
