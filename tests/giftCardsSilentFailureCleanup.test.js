/**
 * cf-44qt sibling — giftCards.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in giftCards.web.js
 * calls `logError(context, err)` with a structured `[giftCards] <fn>`
 * tag instead of raw `console.error`.
 *
 * Pattern source: cf-44qt PR #1366 + cf-uydr PR #1373 +
 * cf-44qt-sibling-abTesting PR #1382 + notificationService PR #1383.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateEmail: (s) => s,
}));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('backend/contacts/contactResolver.web', () => ({
  _resolveContactIdInternal: vi.fn(async () => 'contact-1'),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailContact: vi.fn(async () => undefined) },
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ loginEmail: 'buyer@example.com' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — giftCards.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('checkBalance wires logError on GiftCards query throw', async () => {
    __setQueryError('GiftCards', new Error('wixData failure'));
    const mod = await import('../src/backend/giftCards.web.js');
    // checkBalance returns { found: false } shape on throw, not { success: false }.
    const result = await mod.checkBalance('CODE-1');
    expect(result.found).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/giftCards/);
    expect(tag).toMatch(/checkBalance/);
  });

  it('redeemGiftCard wires logError on GiftCards query throw', async () => {
    __setQueryError('GiftCards', new Error('wixData failure'));
    const mod = await import('../src/backend/giftCards.web.js');
    const result = await mod.redeemGiftCard('CODE-1', 50);
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/giftCards/);
    expect(tag).toMatch(/redeemGiftCard/);
  });

  it('getMyPurchasedCards wires logError on GiftCards query throw', async () => {
    __setQueryError('GiftCards', new Error('wixData failure'));
    const mod = await import('../src/backend/giftCards.web.js');
    const result = await mod.getMyPurchasedCards();
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/giftCards/);
    expect(tag).toMatch(/getMyPurchasedCards/);
  });

  it('getMyReceivedCards wires logError on GiftCards query throw', async () => {
    __setQueryError('GiftCards', new Error('wixData failure'));
    const mod = await import('../src/backend/giftCards.web.js');
    const result = await mod.getMyReceivedCards();
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/giftCards/);
    expect(tag).toMatch(/getMyReceivedCards/);
  });

  it('early-return guards do NOT call logError', async () => {
    const mod = await import('../src/backend/giftCards.web.js');
    // checkBalance with empty code returns { found: false } via early-return,
    // never entering the wixData branch. logError must not fire.
    const result = await mod.checkBalance('');
    expect(result.found).toBe(false);
    expect(logErrorSpy).not.toHaveBeenCalled();
  });
});
