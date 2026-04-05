import { describe, it, expect, vi, beforeEach } from 'vitest';
import wixData, { __reset as resetData, __seed } from 'wix-data';
import { __setMember, __reset as resetMembers } from 'wix-members-backend';

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('backend/utils/rateLimit', () => rateLimitMock);
vi.mock('backend/memberGamePreferences.web', () => ({
  getGamePrefsForMember: vi.fn().mockResolvedValue({ cfPlus: false }),
}));

import { getChallengeLeaderboard, _resetChallengeLeaderboardRateLimit } from 'backend/loyaltyService.web';

const MEMBER_ID = 'branch-member-001';

beforeEach(() => {
  resetData();
  resetMembers();
  _resetChallengeLeaderboardRateLimit();
  __setMember({ _id: MEMBER_ID });
});

it('window reset test', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-04T12:00:00.000Z'));
  __seed('ChallengeProgress', []);
  await getChallengeLeaderboard({ challengeId: 'ch-test' });
  vi.advanceTimersByTime(65_000);
  const result = await getChallengeLeaderboard({ challengeId: 'ch-test' });
  expect(result).not.toHaveProperty('status', 429);
  vi.useRealTimers();
});

it('Date completedAt test', async () => {
  const completedDate = new Date('2026-03-15T09:00:00.000Z');
  __seed('ChallengeProgress', [{
    memberId: MEMBER_ID,
    challengeId: 'ch-iso',
    completedAt: completedDate,
  }]);

  const raw = await wixData.query('ChallengeProgress').eq('challengeId', 'ch-iso').find();
  console.log('raw items count:', raw.items.length, 'items:', JSON.stringify(raw.items.map(i => ({challengeId: i.challengeId, completedAt: i.completedAt}))));

  const result = await getChallengeLeaderboard({ challengeId: 'ch-iso' });
  console.log('leaderboard:', JSON.stringify(result));
  expect(result.leaderboard).toHaveLength(1);
});
