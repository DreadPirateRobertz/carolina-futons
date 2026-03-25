/**
 * weeklyChallenge.test.js
 * CF-8lj8 — getWeeklyChallenge backend: community collective challenge
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(),
    insert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: {
    Anyone: { allowedRoles: [] },
    SiteMember: { allowedRoles: [] },
    Admin: { allowedRoles: [] },
    Member: { allowedRoles: [] },
  },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
  },
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

vi.mock('backend/utils/dateUtils', () => ({
  getTodayET: vi.fn(() => '2026-03-24'),
  getYesterdayOf: vi.fn((d) => d),
  tsToETDate: vi.fn((ts) => ts),
}));

vi.mock('backend/utils/memberPointsLedger', () => ({
  insertLedgerEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('backend/utils/analyticsEvents', () => ({
  insertAnalyticsEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('backend/utils/eventBusDispatcher', () => ({
  dispatchBusEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('backend/loyaltyService.web', () => ({
  recordChallengeCompleteEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('public/gamificationTokens.js', () => ({
  POINT_VALUES: { ADD_TO_CART: 5, SUBMIT_REVIEW: 100, REFERRAL_SHARED: 100, REFERRAL_ACCEPTED: 500, AR_USED: 10, WISHLIST_ADD: 25 },
  STREAK_RECOVERY_COST: 500,
  TIER_NAMES: ['Bronze', 'Silver', 'Gold', 'Platinum'],
  getTierForPoints: vi.fn(() => ({ tierName: 'Bronze', tierIndex: 0, tierThreshold: 0, nextTierThreshold: 1000 })),
  getStreakMultiplier: vi.fn(() => 1),
}));

const { default: wixData } = await import('wix-data');
const { logError } = await import('backend/utils/errorHandler');
const { getWeeklyChallenge } = await import('../src/backend/gamificationEventReceiver.web.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 3 * 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

function mockQueries(challengeItems, progressItems) {
  let queryCount = 0;
  wixData.query.mockImplementation(() => ({
    eq: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    ascending: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    find: vi.fn().mockImplementation(async () => {
      queryCount++;
      if (queryCount === 1) return { items: challengeItems };
      return { items: progressItems };
    }),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getWeeklyChallenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no active weekly challenges', async () => {
    mockQueries([], []);
    const result = await getWeeklyChallenge();
    expect(result).toBeNull();
  });

  it('returns null when only expired weekly challenges exist', async () => {
    mockQueries([
      { _id: 'ch1', challengeId: 'ch1', title: 'Old', scope: 'weekly', active: true, targetCount: 100, expiresAt: PAST, _createdDate: PAST },
    ], []);
    const result = await getWeeklyChallenge();
    expect(result).toBeNull();
  });

  it('returns challenge with aggregated progress', async () => {
    mockQueries(
      [{
        _id: 'ch1', challengeId: 'weekly-500', title: '500 Orders', description: 'Get to 500!',
        scope: 'weekly', active: true, targetCount: 500, rewardPoints: 200,
        expiresAt: FUTURE, _createdDate: new Date().toISOString(),
      }],
      [
        { memberId: 'mem-1', challengeId: 'weekly-500', progressValue: 3 },
        { memberId: 'mem-2', challengeId: 'weekly-500', progressValue: 5 },
        { memberId: 'mem-3', challengeId: 'weekly-500', progressValue: 0 },
      ]
    );

    const result = await getWeeklyChallenge();
    expect(result).not.toBeNull();
    expect(result.challengeId).toBe('weekly-500');
    expect(result.title).toBe('500 Orders');
    expect(result.currentTotal).toBe(8);
    expect(result.contributorCount).toBe(2); // mem-3 has 0
    expect(result.targetCount).toBe(500);
    expect(result.rewardPoints).toBe(200);
    expect(result.isComplete).toBe(false);
  });

  it('marks challenge as complete when target is met', async () => {
    mockQueries(
      [{
        _id: 'ch1', challengeId: 'weekly-100', title: '100 Reviews',
        scope: 'weekly', active: true, targetCount: 100, rewardPoints: 500,
        expiresAt: FUTURE, _createdDate: new Date().toISOString(),
      }],
      [
        { memberId: 'mem-1', challengeId: 'weekly-100', progressValue: 60 },
        { memberId: 'mem-2', challengeId: 'weekly-100', progressValue: 45 },
      ]
    );

    const result = await getWeeklyChallenge();
    expect(result.isComplete).toBe(true);
    expect(result.currentTotal).toBe(105);
  });

  it('returns null description when challenge has none', async () => {
    mockQueries(
      [{
        _id: 'ch1', challengeId: 'weekly-x', title: 'No Desc',
        scope: 'weekly', active: true, targetCount: 10,
        expiresAt: FUTURE, _createdDate: new Date().toISOString(),
      }],
      []
    );

    const result = await getWeeklyChallenge();
    expect(result.description).toBeNull();
    expect(result.currentTotal).toBe(0);
    expect(result.contributorCount).toBe(0);
  });

  it('returns null and logs on DB error', async () => {
    wixData.query.mockImplementation(() => { throw new Error('DB down'); });
    const result = await getWeeklyChallenge();
    expect(result).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('getWeeklyChallenge'),
      expect.any(Error),
    );
  });

  it('picks the most recently created challenge when multiple active', async () => {
    const older = new Date(Date.now() - 86_400_000).toISOString();
    const newer = new Date().toISOString();
    mockQueries(
      [
        { _id: 'old', challengeId: 'old', title: 'Old Challenge', scope: 'weekly', active: true, targetCount: 100, expiresAt: FUTURE, _createdDate: older },
        { _id: 'new', challengeId: 'new', title: 'New Challenge', scope: 'weekly', active: true, targetCount: 200, expiresAt: FUTURE, _createdDate: newer },
      ],
      []
    );

    const result = await getWeeklyChallenge();
    expect(result.challengeId).toBe('new');
    expect(result.title).toBe('New Challenge');
  });
});
