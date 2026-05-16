/**
 * cf-44qt sibling — priceDropCron.web.js observability cleanup.
 *
 * Pins post-migration contract: catches in both webMethods + inner
 * per-member catches all call `logError('[priceDropCron] <fn> failed', err)`.
 *
 * 2 tests cover the 2 webMethods' outer catches via __setQueryError
 * on Stores/Products. The 2 inner per-member catches use dynamic
 * `${memberId}` context (mirrors warrantyService PR #1392 + scheduler
 * PR #1454 pattern) and are mechanically verified via the migration
 * diff; runtime-pinning the per-member catch would require richer
 * mock orchestration than scope warrants.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailContact: vi.fn(async () => ({})) },
}));
vi.mock('backend/priceAlertService.web', () => ({
  getSubscribers: vi.fn(async () => []),
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — priceDropCron.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('detectPriceDrops wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData query failure'));
    const mod = await import('../src/backend/priceDropCron.web.js');
    await mod.detectPriceDrops();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/priceDropCron/);
    expect(allTags).toMatch(/detectPriceDrops/);
    expect(allTags).toMatch(/failed/);
  });

  it('queuePriceDropNotifications wires logError on Wishlist query throw via notifyWishlistedMembers', async () => {
    // notifyWishlistedMembers queries Wishlist for wishlisters; injecting
    // a query error there fires the outer catch.
    __setQueryError('Wishlist', new Error('wixData query failure'));
    const mod = await import('../src/backend/priceDropCron.web.js');
    await mod.queuePriceDropNotifications('p-1', 1000, 800);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/priceDropCron/);
    expect(allTags).toMatch(/queuePriceDropNotifications/);
  });
});
