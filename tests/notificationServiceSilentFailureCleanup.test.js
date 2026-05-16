/**
 * cf-44qt sibling — notificationService.web.js observability cleanup.
 *
 * Pins the post-migration contract: every error-path catch in
 * notificationService.web.js calls `logError(context, err)` instead of
 * raw `console.error`. The notifyOwner console.error fallback (L368)
 * is INTENTIONAL (last-resort alert channel, documented in JSDoc)
 * and is NOT in scope.
 *
 * Pattern source: cf-44qt PR #1366 + cf-uydr PR #1373 +
 * cf-44qt-sibling-abTesting PR #1382.
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
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => null) },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — notificationService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('recordPriceSnapshots wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData query failure'));
    const mod = await import('../src/backend/notificationService.web.js');
    const result = await mod.recordPriceSnapshots();
    // recordPriceSnapshots returns { recorded, error } shape (not success:bool).
    expect(result.recorded).toBe(0);
    expect(result.error).toBeTruthy();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/notificationService/);
    expect(tag).toMatch(/recordPriceSnapshots/);
  });

  it('checkWishlistAlerts wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData query failure'));
    const mod = await import('../src/backend/notificationService.web.js');
    const result = await mod.checkWishlistAlerts();
    // checkWishlistAlerts returns { priceDropAlerts, backInStockAlerts, error } shape.
    expect(result.priceDropAlerts).toBe(0);
    expect(result.backInStockAlerts).toBe(0);
    expect(result.error).toBeTruthy();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/notificationService/);
    expect(tag).toMatch(/checkWishlistAlerts/);
  });

  it('toggleProductAlerts wires logError on ProductAlertPreferences query throw', async () => {
    __setQueryError('ProductAlertPreferences', new Error('wixData query failure'));
    const mod = await import('../src/backend/notificationService.web.js');
    const result = await mod.toggleProductAlerts('prod-1', true);
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/notificationService/);
    expect(tag).toMatch(/toggleProductAlerts/);
  });

  it('notifyOwner intentional console.error fallback does NOT call logError (per JSDoc contract)', async () => {
    // notifyOwner is the documented "last-resort console alert channel" — its
    // L368 console.error is intentional and MUST NOT be migrated to logError.
    // This test pins that contract so future cleanup sweeps don't accidentally
    // break the fallback.
    const mod = await import('../src/backend/notificationService.web.js');
    // With no SITE_OWNER_CONTACT_ID secret set, notifyOwner falls through to
    // the console fallback path. Returns success:true,method:'console' by design.
    const result = await mod.notifyOwner('test', 'message');
    expect(result.success).toBe(true);
    expect(result.method).toBe('console');
    // The fallback path uses console.error directly — NOT logError. So the
    // spy must NOT have been called for the fallback emission.
    expect(logErrorSpy).not.toHaveBeenCalled();
  });
});
