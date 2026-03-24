/**
 * @file challengeLeaderboard.test.js
 * @description Tests for getChallengeLeaderboard (per-challenge first-N completions)
 * and CF+ exclusive challenge gating in getChallengeCatalog and getActiveChallenges.
 * cf-lx5 (CF-p5v2)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';
import {
  __setMember,
  __reset as resetMembers,
} from './__mocks__/wix-members-backend.js';
import {
  getChallengeLeaderboard,
  _resetChallengeLeaderboardRateLimit,
  getChallengeCatalog,
  _resetChallengeCatalogRateLimit,
  _resetChallengeCatalogCache,
} from '../src/backend/loyaltyService.web.js';
import {
  getActiveChallenges,
  _resetActiveChallengesRateLimit,
} from '../src/backend/gamificationEventReceiver.web.js';

const CHALLENGE_PROGRESS = 'ChallengeProgress';
const CHALLENGE_DEFS = 'ChallengeDefinitions';
const CHALLENGES = 'Challenges';
const PREMIUM = 'PremiumMemberships';
const CHALLENGE_PROG_GER = 'MemberChallengeProgress';

const MEMBER = { _id: 'mem-1' };
const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000); // 7 days from now

beforeEach(() => {
  resetData();
  resetMembers();
  __setMember(MEMBER);
  __seed(PREMIUM, []);
  __seed(CHALLENGE_DEFS, []);
  __seed(CHALLENGE_PROGRESS, []);
  __seed(CHALLENGES, []);
  __seed(CHALLENGE_PROG_GER, []);
  _resetChallengeLeaderboardRateLimit();
  _resetActiveChallengesRateLimit();
  _resetChallengeCatalogRateLimit();
  _resetChallengeCatalogCache();
});

// ── getChallengeLeaderboard ───────────────────────────────────────────────────

describe('getChallengeLeaderboard — happy path', () => {
  it('returns empty leaderboard when no completions exist', async () => {
    __seed(CHALLENGE_PROGRESS, []);
    const result = await getChallengeLeaderboard('ch-1');
    expect(result.leaderboard).toEqual([]);
  });

  it('returns ranked completions sorted by completedAt ASC', async () => {
    const t1 = new Date('2026-03-01T10:00:00Z');
    const t2 = new Date('2026-03-02T10:00:00Z');
    const t3 = new Date('2026-03-03T10:00:00Z');
    __seed(CHALLENGE_PROGRESS, [
      { _id: 'cp-3', challengeId: 'ch-1', memberId: 'mem-3', displayName: 'Carol', completedAt: t3 },
      { _id: 'cp-1', challengeId: 'ch-1', memberId: 'mem-1', displayName: 'Alice', completedAt: t1 },
      { _id: 'cp-2', challengeId: 'ch-1', memberId: 'mem-2', displayName: 'Bob',   completedAt: t2 },
    ]);
    const result = await getChallengeLeaderboard('ch-1');
    expect(result.leaderboard).toHaveLength(3);
    expect(result.leaderboard[0]).toMatchObject({ rank: 1, memberId: 'mem-1' });
    expect(result.leaderboard[1]).toMatchObject({ rank: 2, memberId: 'mem-2' });
    expect(result.leaderboard[2]).toMatchObject({ rank: 3, memberId: 'mem-3' });
  });

  it('respects the limit parameter', async () => {
    __seed(CHALLENGE_PROGRESS, [
      { _id: 'cp-1', challengeId: 'ch-1', memberId: 'mem-1', completedAt: new Date('2026-03-01') },
      { _id: 'cp-2', challengeId: 'ch-1', memberId: 'mem-2', completedAt: new Date('2026-03-02') },
      { _id: 'cp-3', challengeId: 'ch-1', memberId: 'mem-3', completedAt: new Date('2026-03-03') },
    ]);
    const result = await getChallengeLeaderboard('ch-1', 2);
    expect(result.leaderboard).toHaveLength(2);
  });

  it('excludes rows without completedAt (in-progress)', async () => {
    __seed(CHALLENGE_PROGRESS, [
      { _id: 'cp-1', challengeId: 'ch-1', memberId: 'mem-1', completedAt: new Date('2026-03-01') },
      { _id: 'cp-2', challengeId: 'ch-1', memberId: 'mem-2', completedAt: null },
    ]);
    const result = await getChallengeLeaderboard('ch-1');
    expect(result.leaderboard).toHaveLength(1);
    expect(result.leaderboard[0].memberId).toBe('mem-1');
  });

  it('includes displayName in each entry', async () => {
    __seed(CHALLENGE_PROGRESS, [
      { _id: 'cp-1', challengeId: 'ch-1', memberId: 'mem-1', displayName: 'Alice', completedAt: new Date() },
    ]);
    const result = await getChallengeLeaderboard('ch-1');
    expect(result.leaderboard[0].displayName).toBe('Alice');
  });

  it('returns completedAt as ISO string', async () => {
    const t = new Date('2026-03-15T12:00:00Z');
    __seed(CHALLENGE_PROGRESS, [
      { _id: 'cp-1', challengeId: 'ch-1', memberId: 'mem-1', completedAt: t },
    ]);
    const result = await getChallengeLeaderboard('ch-1');
    expect(result.leaderboard[0].completedAt).toBe('2026-03-15T12:00:00.000Z');
  });
});

describe('getChallengeLeaderboard — auth and validation', () => {
  it('returns empty leaderboard when member not authenticated', async () => {
    __setMember(null);
    const result = await getChallengeLeaderboard('ch-1');
    expect(result.leaderboard).toEqual([]);
  });

  it('returns empty leaderboard for invalid challengeId', async () => {
    const result = await getChallengeLeaderboard('');
    expect(result.leaderboard).toEqual([]);
  });

  it('returns 429 when rate limit exceeded', async () => {
    // Make 20 calls first
    for (let i = 0; i < 20; i++) {
      await getChallengeLeaderboard('ch-1');
    }
    const result = await getChallengeLeaderboard('ch-1');
    expect(result.status).toBe(429);
  });

  it('returns empty leaderboard on DB error', async () => {
    __setQueryError(CHALLENGE_PROGRESS, new Error('DB failure'));
    const result = await getChallengeLeaderboard('ch-1');
    expect(result.leaderboard).toEqual([]);
  });

  it('limit=0 falls back to default of 10', async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      _id: `cp-${i}`,
      challengeId: 'ch-1',
      memberId: `mem-${i}`,
      completedAt: new Date(2026, 2, i + 1), // March 1-12 2026
    }));
    __seed(CHALLENGE_PROGRESS, entries);
    const result = await getChallengeLeaderboard('ch-1', 0);
    expect(result.leaderboard).toHaveLength(10);
  });

  it('limit above cap (>20) is capped at 20', async () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({
      _id: `cp-${i}`,
      challengeId: 'ch-1',
      memberId: `mem-${i}`,
      completedAt: new Date(2026, 2, i + 1),
    }));
    __seed(CHALLENGE_PROGRESS, entries);
    const result = await getChallengeLeaderboard('ch-1', 25);
    expect(result.leaderboard).toHaveLength(20);
  });
});

// ── CF+ exclusive gate — getChallengeCatalog ──────────────────────────────────

describe('getChallengeCatalog — CF+ exclusive gate', () => {
  it('shows non-CF+ challenges to all members', async () => {
    __seed(CHALLENGE_DEFS, [
      { _id: 'def-1', title: 'Open Challenge', active: true, goal: 1, unit: 'order', pointReward: 50, expiresAt: null, cfPlusOnly: false },
    ]);
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].id).toBe('def-1');
  });

  it('hides cfPlusOnly challenges from non-CF+ members', async () => {
    __seed(CHALLENGE_DEFS, [
      { _id: 'def-1', title: 'Open Challenge', active: true, goal: 1, unit: 'order', pointReward: 50, expiresAt: null },
      { _id: 'def-2', title: 'CF+ Challenge', active: true, goal: 1, unit: 'order', pointReward: 200, expiresAt: null, cfPlusOnly: true },
    ]);
    // Non-CF+ member — PremiumMemberships is empty
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].id).toBe('def-1');
  });

  it('shows cfPlusOnly challenges to CF+ members', async () => {
    __seed(PREMIUM, [
      { _id: 'pm-1', memberId: 'mem-1', status: 'active', planType: 'annual' },
    ]);
    __seed(CHALLENGE_DEFS, [
      { _id: 'def-1', title: 'Open Challenge', active: true, goal: 1, unit: 'order', pointReward: 50, expiresAt: null },
      { _id: 'def-2', title: 'CF+ Challenge', active: true, goal: 1, unit: 'order', pointReward: 200, expiresAt: null, cfPlusOnly: true },
    ]);
    _resetChallengeCatalogRateLimit();
    _resetChallengeCatalogCache();
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(2);
  });

  it('does not show expired CF+ challenges even to CF+ members', async () => {
    __seed(PREMIUM, [
      { _id: 'pm-1', memberId: 'mem-1', status: 'active' },
    ]);
    __seed(CHALLENGE_DEFS, [
      { _id: 'def-1', title: 'Expired CF+', active: true, goal: 1, unit: 'order', pointReward: 200, expiresAt: new Date(Date.now() - 1000), cfPlusOnly: true },
    ]);
    _resetChallengeCatalogRateLimit();
    _resetChallengeCatalogCache();
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(0);
  });

  it('does not treat cancelled PremiumMembership as CF+', async () => {
    __seed(PREMIUM, [
      { _id: 'pm-1', memberId: 'mem-1', status: 'cancelled' },
    ]);
    __seed(CHALLENGE_DEFS, [
      { _id: 'def-1', title: 'Open', active: true, goal: 1, unit: 'order', pointReward: 50, expiresAt: null },
      { _id: 'def-2', title: 'CF+ Only', active: true, goal: 1, unit: 'order', pointReward: 200, expiresAt: null, cfPlusOnly: true },
    ]);
    _resetChallengeCatalogRateLimit();
    _resetChallengeCatalogCache();
    const result = await getChallengeCatalog();
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].id).toBe('def-1');
  });

  it('does not grant CF+ access when PremiumMemberships query throws', async () => {
    __seed(CHALLENGE_DEFS, [
      { _id: 'def-1', title: 'Open', active: true, goal: 1, unit: 'order', pointReward: 50, expiresAt: null },
      { _id: 'def-2', title: 'CF+ Only', active: true, goal: 1, unit: 'order', pointReward: 200, expiresAt: null, cfPlusOnly: true },
    ]);
    __setQueryError(PREMIUM, new Error('DB failure'));
    _resetChallengeCatalogRateLimit();
    _resetChallengeCatalogCache();
    const result = await getChallengeCatalog();
    // Query error → isCFPlus=false → only open challenge visible
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].id).toBe('def-1');
  });
});

// ── CF+ exclusive gate — getActiveChallenges ─────────────────────────────────

describe('getActiveChallenges — CF+ exclusive gate', () => {
  it('hides cfPlusOnly challenges from non-CF+ members', async () => {
    __seed(CHALLENGES, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Open', active: true, expiresAt: FUTURE },
      { _id: 'ch-2', challengeId: 'ch-2', title: 'CF+ Only', active: true, expiresAt: FUTURE, cfPlusOnly: true },
    ]);
    const result = await getActiveChallenges('mem-1');
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].title).toBe('Open');
  });

  it('shows cfPlusOnly challenges to CF+ members', async () => {
    __seed(PREMIUM, [
      { _id: 'pm-1', memberId: 'mem-1', status: 'active' },
    ]);
    __seed(CHALLENGES, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Open', active: true, expiresAt: FUTURE },
      { _id: 'ch-2', challengeId: 'ch-2', title: 'CF+ Only', active: true, expiresAt: FUTURE, cfPlusOnly: true },
    ]);
    const result = await getActiveChallenges('mem-1');
    expect(result.challenges).toHaveLength(2);
  });

  it('treats missing cfPlusOnly field as non-exclusive', async () => {
    __seed(CHALLENGES, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'No flag', active: true, expiresAt: FUTURE },
    ]);
    const result = await getActiveChallenges('mem-1');
    expect(result.challenges).toHaveLength(1);
  });

  it('does not show inactive PremiumMembership as CF+', async () => {
    __seed(PREMIUM, [
      { _id: 'pm-1', memberId: 'mem-1', status: 'cancelled' },
    ]);
    __seed(CHALLENGES, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'CF+ Only', active: true, expiresAt: FUTURE, cfPlusOnly: true },
    ]);
    const result = await getActiveChallenges('mem-1');
    expect(result.challenges).toHaveLength(0);
  });

  it('does not grant CF+ access when PremiumMemberships query throws', async () => {
    __seed(CHALLENGES, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Open', active: true, expiresAt: FUTURE },
      { _id: 'ch-2', challengeId: 'ch-2', title: 'CF+ Only', active: true, expiresAt: FUTURE, cfPlusOnly: true },
    ]);
    __setQueryError(PREMIUM, new Error('DB failure'));
    const result = await getActiveChallenges('mem-1');
    // Query error → isCFPlus=false → only open challenge visible
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].title).toBe('Open');
  });
});
