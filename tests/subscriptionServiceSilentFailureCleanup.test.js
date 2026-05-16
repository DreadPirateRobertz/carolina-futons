/**
 * cf-44qt sibling — subscriptionService.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in
 * subscriptionService.web.js calls `logError('[subscriptionService] <fn>
 * failed', err)` instead of raw `console.error`.
 *
 * Pattern source: cf-44qt PR #1366 + cf-uydr PR #1373 +
 * abTesting #1382 + notificationService #1383 + giftCards #1384.
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
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'sub@example.com' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — subscriptionService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getMySubscriptions wires logError on Subscriptions query throw', async () => {
    __setQueryError('Subscriptions', new Error('wixData failure'));
    const mod = await import('../src/backend/subscriptionService.web.js');
    const result = await mod.getMySubscriptions();
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/subscriptionService/);
    expect(tag).toMatch(/getSubscriptions/);
  });

  it('pauseSubscription wires logError on Subscriptions query throw', async () => {
    __setQueryError('Subscriptions', new Error('wixData failure'));
    const mod = await import('../src/backend/subscriptionService.web.js');
    const result = await mod.pauseSubscription('sub-1');
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/subscriptionService/);
    expect(tag).toMatch(/pauseSubscription/);
  });

  it('cancelSubscription wires logError on Subscriptions query throw', async () => {
    __setQueryError('Subscriptions', new Error('wixData failure'));
    const mod = await import('../src/backend/subscriptionService.web.js');
    const result = await mod.cancelSubscription('sub-1');
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/subscriptionService/);
    expect(tag).toMatch(/cancelSubscription/);
  });

  it('getSubscriberDiscount wires logError on Subscriptions query throw', async () => {
    __setQueryError('Subscriptions', new Error('wixData failure'));
    const mod = await import('../src/backend/subscriptionService.web.js');
    const result = await mod.getSubscriberDiscount();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/subscriptionService/);
    expect(tag).toMatch(/getSubscriberDiscount/);
  });

  it('isProductSubscribable wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData failure'));
    const mod = await import('../src/backend/subscriptionService.web.js');
    const result = await mod.isProductSubscribable('prod-1');
    expect(result.subscribable).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/subscriptionService/);
    expect(tag).toMatch(/checkSubscriptionEligibility/);
  });
});
