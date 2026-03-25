import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';
import { getShareableProgress } from 'backend/gamificationEventReceiver.web';

describe('getShareableProgress (CF-fxby)', () => {
  beforeEach(() => {
    __reset();
    resetMembers();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns auth_required when no authenticated member', async () => {
    const result = await getShareableProgress();
    expect(result).toEqual({ error: 'auth_required' });
  });

  // ── Data (authenticated) ──────────────────────────────────────────────────

  it('returns tier, points, streak, badges, shareText, and shareUrl', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 2000, currentStreakDays: 5 }]);
    __seed('MemberBadges', [{ _id: 'b1', memberId: 'mem-1', badgeName: 'Top Reviewer', earnedDate: '2026-03-20' }]);
    const result = await getShareableProgress();
    expect(result).toHaveProperty('tierName');
    expect(result).toHaveProperty('totalPoints', 2000);
    expect(result).toHaveProperty('streak', 5);
    expect(result).toHaveProperty('topBadges');
    expect(result).toHaveProperty('shareText');
    expect(result).toHaveProperty('shareUrl');
  });

  it('returns correct tier name based on points', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 1500 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress();
    expect(result.tierName).toBe('Mountain Guide');
  });

  it('returns top 3 badges sorted by earnedDate descending', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100 }]);
    __seed('MemberBadges', [
      { _id: 'b1', memberId: 'mem-1', badgeName: 'First', earnedDate: '2026-01-01' },
      { _id: 'b2', memberId: 'mem-1', badgeName: 'Second', earnedDate: '2026-02-01' },
      { _id: 'b3', memberId: 'mem-1', badgeName: 'Third', earnedDate: '2026-03-01' },
      { _id: 'b4', memberId: 'mem-1', badgeName: 'Fourth', earnedDate: '2026-03-15' },
    ]);
    const result = await getShareableProgress();
    expect(result.topBadges).toHaveLength(3);
    expect(result.topBadges[0]).toBe('Fourth');
  });

  it('includes streak in shareText when streak > 0', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, currentStreakDays: 7 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress();
    expect(result.shareText).toContain('7-day streak');
  });

  it('omits streak from shareText when streak is 0', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 500, currentStreakDays: 0 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress();
    expect(result.shareText).not.toContain('streak');
  });

  it('defaults to Bronze with 0 points for unknown member', async () => {
    __setMember({ _id: 'mem-unknown' });
    __seed('MemberBadges', []);
    const result = await getShareableProgress();
    expect(result.tierName).toBe('Trail Blazer');
    expect(result.totalPoints).toBe(0);
    expect(result.streak).toBe(0);
    expect(result.topBadges).toEqual([]);
  });

  it('includes memberId in referral shareUrl', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 0 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress();
    expect(result.shareUrl).toContain('ref=mem-1');
  });

  it('formats points with commas in shareText', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 2500 }]);
    __seed('MemberBadges', []);
    const result = await getShareableProgress();
    expect(result.shareText).toContain('2,500 points');
  });
});
