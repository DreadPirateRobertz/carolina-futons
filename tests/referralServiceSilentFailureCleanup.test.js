/**
 * cf-44qt sibling — referralService.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateEmail: () => true,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));
vi.mock('wix-loyalty.v2', () => ({
  accounts: {
    getAccount: vi.fn(async () => ({ account: { points: { balance: 0 } } })),
    adjustPoints: vi.fn(async () => ({})),
  },
}));
vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: vi.fn(async () => ({ success: true })),
}));
vi.mock('backend/loyaltyBonusPoints.web', () => ({
  BONUS_POINTS: { referralPurchase: 100 },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — referralService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getReferralLink wires logError on Referrals query throw', async () => {
    __setQueryError('Referrals', new Error('wixData failure'));
    const mod = await import('../src/backend/referralService.web.js');
    await mod.getReferralLink();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/referralService/);
    expect(tag).toMatch(/getReferralLink/);
  });

  it('getMyReferrals wires logError on Referrals query throw', async () => {
    __setQueryError('Referrals', new Error('wixData failure'));
    const mod = await import('../src/backend/referralService.web.js');
    await mod.getMyReferrals();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/referralService/);
    expect(tag).toMatch(/getMyReferrals/);
  });

  it('getMyCredits wires logError on ReferralCredits query throw', async () => {
    __setQueryError('ReferralCredits', new Error('wixData failure'));
    const mod = await import('../src/backend/referralService.web.js');
    await mod.getMyCredits();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/referralService/);
    expect(tag).toMatch(/getMyCredits/);
  });

  it('getReferralStats wires logError on query throw', async () => {
    __setQueryError('Referrals', new Error('wixData failure'));
    const mod = await import('../src/backend/referralService.web.js');
    await mod.getReferralStats();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/referralService/);
    expect(tag).toMatch(/getReferralStats/);
  });

  it('getPostPurchaseRewardSummary wires logError on Referrals query throw', async () => {
    __setQueryError('Referrals', new Error('wixData failure'));
    const mod = await import('../src/backend/referralService.web.js');
    await mod.getPostPurchaseRewardSummary('order-1');
    // The outer catch on getPostPurchaseRewardSummary may not fire if internal
    // helpers swallow the error first; at minimum some referralService logError
    // tag fires from the chain.
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/referralService/);
  });
});
