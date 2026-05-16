/**
 * cf-44qt sibling — couponsService.web.js observability cleanup.
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
vi.mock('wix-marketing-backend', () => ({
  coupons: {
    createCoupon: vi.fn(async () => { throw new Error('coupons API failure'); }),
  },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — couponsService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('createWelcomeCoupon wires logError on coupons.createCoupon throw', async () => {
    const mod = await import('../src/backend/couponsService.web.js');
    await mod.createWelcomeCoupon('welcome@example.com');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/couponsService/);
    expect(allTags).toMatch(/createWelcomeCoupon/);
  });

  it('getActiveCoupons wires logError on MemberCoupons query throw', async () => {
    __setQueryError('MemberCoupons', new Error('wixData failure'));
    const mod = await import('../src/backend/couponsService.web.js');
    await mod.getActiveCoupons();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/couponsService/);
    expect(allTags).toMatch(/getActiveCoupons/);
  });

  it('createBirthdayCoupon wires logError on coupons.createCoupon throw', async () => {
    const mod = await import('../src/backend/couponsService.web.js');
    await mod.createBirthdayCoupon('bday@example.com');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/couponsService/);
    expect(allTags).toMatch(/createBirthdayCoupon/);
  });

  it('createTierUpgradeCoupon wires logError on coupons.createCoupon throw', async () => {
    const mod = await import('../src/backend/couponsService.web.js');
    await mod.createTierUpgradeCoupon('tier@example.com', 'Gold');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/couponsService/);
    expect(allTags).toMatch(/createTierUpgradeCoupon/);
  });
});
