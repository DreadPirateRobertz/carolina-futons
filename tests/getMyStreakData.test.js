/**
 * @file getMyStreakData.test.js
 * @description Unit tests for the getMyStreakData backend webMethod in loyaltyService.web.js.
 *
 * Kept in a separate file from memberPageStreak.test.js because vi.importActual
 * loads the real module into the shared module cache at the resolved path, which
 * would bypass vi.mock for the dynamic imports in Member Page.js if both test
 * suites were in the same file.
 *
 * Covers:
 *  - Returns streak fields from MemberPoints record
 *  - Returns defaults when no record exists
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';

const membersMock = vi.hoisted(() => ({ getMember: vi.fn() }));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: membersMock.getMember },
}));

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  membersMock.getMember.mockResolvedValue({
    _id: 'mem-1',
    contactDetails: { firstName: 'Jane', emails: ['jane@test.com'], addresses: [] },
    profile: { nickname: 'Jane', photo: { url: '' } },
    loginEmail: 'jane@test.com',
  });
});

describe('getMyStreakData (backend webMethod)', () => {
  it('returns streak fields from MemberPoints record', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer',
      currentStreakDays: 5, streakMultiplier: 1.5,
      streakStartDate: '2026-03-18', lastActivityDate: '2026-03-22',
    }]);
    const { getMyStreakData } = await vi.importActual('../src/backend/loyaltyService.web.js');
    const result = await getMyStreakData();
    expect(result.currentStreakDays).toBe(5);
    expect(result.streakMultiplier).toBe(1.5);
  });

  it('returns totalPoints and lastStreakRecoveryDate from MemberPoints record', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-2', memberId: 'mem-1', totalPoints: 250, tier: 'Trail Blazer',
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: '2026-03-20',
      lastStreakRecoveryDate: '2026-03-10',
    }]);
    const { getMyStreakData } = await vi.importActual('../src/backend/loyaltyService.web.js');
    const result = await getMyStreakData();
    expect(result.totalPoints).toBe(250);
    expect(result.lastStreakRecoveryDate).toBe('2026-03-10');
  });

  it('returns zeros/defaults when no MemberPoints record exists', async () => {
    const { getMyStreakData } = await vi.importActual('../src/backend/loyaltyService.web.js');
    const result = await getMyStreakData();
    expect(result.currentStreakDays).toBe(0);
    expect(result.streakMultiplier).toBe(1);
    expect(result.totalPoints).toBe(0);
    expect(result.lastStreakRecoveryDate).toBeNull();
  });
});
