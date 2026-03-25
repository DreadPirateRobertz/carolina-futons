import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from 'wix-data';
import { getShareableProgress } from 'backend/gamificationEventReceiver.web';

describe('getShareableProgress (CF-fxby)', () => {
  beforeEach(() => {
    __reset();
  });

  it('returns tier, points, streak, badges, shareText, and shareUrl', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 2000, currentStreakDays: 5 }]);
    __seed('MemberBadges', [{ _id: 'b1', memberId: 'mem-1', badgeName: 'Top Reviewer', earnedDate: '2026-03-20' }]);
    const result = await getShareableProgress('mem-1');
    expect(result).toHaveProperty('tierName');
    expect(result).toHaveProperty('totalPoints', 2000);
    expect(result).toHaveProperty('streak', 5);
    expect(result).toHaveProperty('topBadges');
    expect(result).toHaveProperty('shareText');
    expect(result).toHaveProperty('shareUrl');
  });

  it('returns correct tier name based on points', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 1500 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress('mem-1');
    expect(result.tierName).toBe('Gold');
  });

  it('returns top 3 badges sorted by earnedDate descending', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100 }]);
    __seed('MemberBadges', [
      { _id: 'b1', memberId: 'mem-1', badgeName: 'First', earnedDate: '2026-01-01' },
      { _id: 'b2', memberId: 'mem-1', badgeName: 'Second', earnedDate: '2026-02-01' },
      { _id: 'b3', memberId: 'mem-1', badgeName: 'Third', earnedDate: '2026-03-01' },
      { _id: 'b4', memberId: 'mem-1', badgeName: 'Fourth', earnedDate: '2026-03-15' },
    ]);
    const result = await getShareableProgress('mem-1');
    expect(result.topBadges).toHaveLength(3);
    expect(result.topBadges[0]).toBe('Fourth');
  });

  it('includes streak in shareText when streak > 0', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, currentStreakDays: 7 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress('mem-1');
    expect(result.shareText).toContain('7-day streak');
  });

  it('omits streak from shareText when streak is 0', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, currentStreakDays: 0 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress('mem-1');
    expect(result.shareText).not.toContain('streak');
  });

  it('defaults to Bronze with 0 points for unknown member', async () => {
    __seed('MemberBadges', []);
    const result = await getShareableProgress('mem-unknown');
    expect(result.tierName).toBe('Bronze');
    expect(result.totalPoints).toBe(0);
    expect(result.streak).toBe(0);
    expect(result.topBadges).toEqual([]);
  });

  it('returns referral URL as shareUrl', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 0 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress('mem-1');
    expect(result.shareUrl).toBe('https://www.carolinafutons.com/referral');
  });

  it('throws when memberId is missing', async () => {
    await expect(getShareableProgress(null)).rejects.toThrow('memberId is required');
    await expect(getShareableProgress('')).rejects.toThrow('memberId is required');
  });
});
