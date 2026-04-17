/**
 * cf-fqq — verify recordChallengeProgress inserts a fully-initialized MemberPoints
 * record for members who have none yet. The sparse insert that only set
 * { memberId, totalPoints } left streak/tier/lastActivityDate fields undefined,
 * breaking pointsExpiryService, loyaltyService streak reads, and the streak-danger
 * cron (gamificationNotifs) which queries `.eq('lastActivityDate', yesterdayET)`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let _collections = {};

function buildQueryChain(collection) {
  const filters = [];
  const chain = {
    eq: (f, v) => { filters.push({ f, v }); return chain; },
    find: async () => {
      const items = (_collections[collection] || []).filter(item =>
        filters.every(({ f, v }) => item[f] === v));
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

const _inserts = [];

vi.mock('wix-data', () => ({
  default: {
    query: (col) => buildQueryChain(col),
    insert: async (col, item) => {
      const record = { ...item, _id: `ins-${col}-${_inserts.length}` };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(record);
      _inserts.push({ col, record });
      return record;
    },
    update: async (_col, item) => item,
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(() => Promise.resolve('test-secret')),
}));

vi.mock('backend/loyaltyService.web', () => ({
  recordChallengeCompleteEvent: vi.fn(async () => ({ success: true })),
}));

vi.mock('backend/utils/analyticsEvents', () => ({
  insertAnalyticsEvent: vi.fn(async () => ({ success: true })),
}));

vi.mock('backend/utils/eventBusDispatcher', () => ({
  dispatchBusEvent: vi.fn(async () => ({ ok: true })),
}));

vi.mock('backend/utils/memberPointsLedger', () => ({
  insertLedgerEntry: vi.fn(async () => ({ success: true })),
}));

vi.mock('backend/utils/dateUtils', () => ({
  getTodayET: () => '2026-04-13',
  getYesterdayOf: () => '2026-04-12',
  tsToETDate: () => '2026-04-13',
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

// Import after mocks.
const { recordChallengeProgress, _resetRecordChallengeProgressRateLimit } =
  await import('../src/backend/gamificationCore.web.js');

beforeEach(() => {
  _collections = {};
  _inserts.length = 0;
  _resetRecordChallengeProgressRateLimit();
});

describe('recordChallengeProgress — new-member MemberPoints insert (cf-fqq)', () => {
  it('inserts a FULLY-initialized MemberPoints record when member has no existing record', async () => {
    // Seed: a challenge with targetCount=1 so a single call completes it
    _collections['Challenges'] = [{
      _id: 'ch-1',
      challengeId: 'first-step',
      targetCount: 1,
      rewardPoints: 50,
      expiresAt: null,
    }];
    // No MemberPoints record for mem-new — forces the insert path

    const result = await recordChallengeProgress({ memberId: 'mem-new', challengeId: 'first-step' });

    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.pointsAwarded).toBe(50);

    const mpInserts = _inserts.filter(i => i.col === 'MemberPoints');
    expect(mpInserts).toHaveLength(1);

    const inserted = mpInserts[0].record;
    // All fields the bead flagged as missing must be present (not undefined)
    expect(inserted).toMatchObject({
      memberId: 'mem-new',
      totalPoints: 50,
      currentStreakDays: 0,
      streakStartDate: null,
      streakMultiplier: 1,
      milestoneBonus: 0,
      graceTokenUsedDate: null,
      graceApplied: false,
      bonusSpinsAvailable: 0,
    });
    // tier must be a non-empty string (derived from getTierForPoints)
    expect(typeof inserted.tier).toBe('string');
    expect(inserted.tier.length).toBeGreaterThan(0);
    // lastActivityDate must be set so streak/cron queries find this member
    expect(inserted.lastActivityDate).toBe('2026-04-13');
  });

  it('updates (not inserts) when member already has a MemberPoints record', async () => {
    _collections['Challenges'] = [{
      _id: 'ch-1',
      challengeId: 'first-step',
      targetCount: 1,
      rewardPoints: 50,
      expiresAt: null,
    }];
    _collections['MemberPoints'] = [{
      _id: 'mp-existing',
      memberId: 'mem-existing',
      totalPoints: 200,
      currentStreakDays: 3,
      streakStartDate: '2026-04-10',
      lastActivityDate: '2026-04-12',
      streakMultiplier: 1,
      tier: 'Trail Blazer',
      bonusSpinsAvailable: 0,
      graceTokenUsedDate: null,
      graceApplied: false,
    }];

    const result = await recordChallengeProgress({ memberId: 'mem-existing', challengeId: 'first-step' });
    expect(result.success).toBe(true);

    // No new MemberPoints insert should have happened
    const mpInserts = _inserts.filter(i => i.col === 'MemberPoints');
    expect(mpInserts).toHaveLength(0);
  });
});
