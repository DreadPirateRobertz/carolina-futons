/**
 * cf-44qt sibling — loyaltyService.web.js observability cleanup.
 * Partial-migration finisher: file already imported logError; this PR migrates
 * the remaining 7 raw console.error sites.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
}));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('backend/memberGamePreferences.web', () => ({
  getGamePrefsForMember: vi.fn(async () => ({ optedIn: true })),
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
    getAccount: vi.fn(async () => { throw new Error('loyalty api failure'); }),
    queryLoyaltyAccounts: vi.fn(() => ({
      eq: () => ({ find: async () => { throw new Error('loyalty api failure'); } }),
    })),
  },
  rewards: {
    listRewards: vi.fn(async () => { throw new Error('loyalty api failure'); }),
    redeemPoints: vi.fn(async () => { throw new Error('loyalty api failure'); }),
  },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — loyaltyService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getMyLoyaltyAccount wires logError on loyalty API throw', async () => {
    const mod = await import('../src/backend/loyaltyService.web.js');
    await mod.getMyLoyaltyAccount();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/loyaltyService/);
    expect(allTags).toMatch(/getMyLoyaltyAccount/);
  });

  it('getAvailableRewards wires logError on rewards.listRewards throw', async () => {
    const mod = await import('../src/backend/loyaltyService.web.js');
    await mod.getAvailableRewards();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/loyaltyService/);
    expect(allTags).toMatch(/getAvailableRewards/);
  });

  it('getLeaderboard wires logError on LoyaltyAccounts query throw', async () => {
    __setQueryError('LoyaltyAccounts', new Error('wixData failure'));
    const mod = await import('../src/backend/loyaltyService.web.js');
    await mod.getLeaderboard();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/loyaltyService/);
  });

  it('getMyAchievements wires logError on Achievements query throw', async () => {
    __setQueryError('StreakAchievements', new Error('wixData failure'));
    const mod = await import('../src/backend/loyaltyService.web.js');
    await mod.getMyAchievements();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/loyaltyService/);
    expect(allTags).toMatch(/getMyAchievements/);
  });
});
