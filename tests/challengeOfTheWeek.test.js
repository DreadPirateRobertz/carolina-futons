/**
 * challengeOfTheWeek.test.js
 * cf-rsr — getActiveChallengeOfWeek: featured individual challenge webMethod
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory collections ────────────────────────────────────────────

let _collections = {};

function seed(collection, items) {
  _collections[collection] = items.map((item, i) => ({ _id: `id-${i}`, ...item }));
}

function buildQueryChain(collection) {
  let filters = [];
  let sortField = null;
  let sortDir = 'asc';
  let limitVal = 50;

  const chain = {
    eq: (f, v) => { filters.push({ f, op: 'eq', v }); return chain; },
    gt: (f, v) => { filters.push({ f, op: 'gt', v }); return chain; }, // date-aware in find()
    descending: (f) => { sortField = f; sortDir = 'desc'; return chain; },
    limit: (n) => { limitVal = n; return chain; },
    find: async () => {
      let items = (_collections[collection] || []).filter(item =>
        filters.every(({ f, op, v }) => {
          if (op === 'eq') return item[f] === v;
          if (op === 'gt') {
            const aMs = item[f] instanceof Date ? item[f].getTime() : new Date(item[f]).getTime();
            const bMs = v instanceof Date ? v.getTime() : new Date(v).getTime();
            return aMs > bMs;
          }
          return true;
        })
      );
      if (sortField) {
        items.sort((a, b) => sortDir === 'desc'
          ? (b[sortField] ?? 0) - (a[sortField] ?? 0)
          : (a[sortField] ?? 0) - (b[sortField] ?? 0));
      }
      items = items.slice(0, limitVal);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: { query: (col) => buildQueryChain(col) },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _mockMemberId = null;
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(_mockMemberId ? { _id: _mockMemberId } : null)),
  },
}));

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));
vi.mock('backend/utils/dateUtils', () => ({
  getTodayET: vi.fn(() => '2026-04-13'),
  getYesterdayOf: vi.fn((d) => d),
  tsToETDate: vi.fn((ts) => new Date(ts).toISOString().slice(0, 10)),
}));
vi.mock('backend/loyaltyService.web', () => ({ recordChallengeCompleteEvent: vi.fn() }));
vi.mock('backend/utils/memberPointsLedger', () => ({ insertLedgerEntry: vi.fn() }));
vi.mock('backend/utils/analyticsEvents', () => ({ insertAnalyticsEvent: vi.fn() }));
vi.mock('backend/utils/eventBusDispatcher', () => ({ dispatchBusEvent: vi.fn() }));

import { getActiveChallengeOfWeek } from '../src/backend/gamificationCore.web.js';

// ── Helpers ───────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 7 * 86_400_000).toISOString(); // 1 week out

function featuredChallenge(overrides = {}) {
  return {
    _id: 'ch-featured',
    challengeId: 'cotw-apr-w3',
    title: 'Write a Review',
    description: 'Share your experience!',
    conditionType: 'write_review',
    active: true,
    isFeatured: true,
    targetCount: 1,
    rewardPoints: 150,
    expiresAt: FUTURE,
    ctaUrl: '/product-reviews',
    _createdDate: new Date('2026-04-07').getTime(),
    ...overrides,
  };
}

beforeEach(() => {
  _collections = {};
  _mockMemberId = null;
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('getActiveChallengeOfWeek (cf-rsr)', () => {
  it('returns null when no featured challenge exists', async () => {
    const result = await getActiveChallengeOfWeek();
    expect(result).toBeNull();
  });

  it('returns null when featured challenge is not active', async () => {
    seed('Challenges', [featuredChallenge({ active: false })]);
    const result = await getActiveChallengeOfWeek();
    expect(result).toBeNull();
  });

  it('returns null when featured challenge is expired', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    seed('Challenges', [featuredChallenge({ expiresAt: past })]);
    const result = await getActiveChallengeOfWeek();
    expect(result).toBeNull();
  });

  it('returns null when no isFeatured flag', async () => {
    seed('Challenges', [featuredChallenge({ isFeatured: false })]);
    const result = await getActiveChallengeOfWeek();
    expect(result).toBeNull();
  });

  it('returns challenge shape with zero progress for unauthenticated visitor', async () => {
    seed('Challenges', [featuredChallenge()]);
    const result = await getActiveChallengeOfWeek();
    expect(result).not.toBeNull();
    expect(result.challengeId).toBe('cotw-apr-w3');
    expect(result.title).toBe('Write a Review');
    expect(result.description).toBe('Share your experience!');
    expect(result.conditionType).toBe('write_review');
    expect(result.targetCount).toBe(1);
    expect(result.rewardPoints).toBe(150);
    expect(result.progressValue).toBe(0);
    expect(result.completedAt).toBeNull();
    expect(result.ctaUrl).toBe('/product-reviews');
  });

  it('includes member progress when authenticated', async () => {
    _mockMemberId = 'mem-abc';
    seed('Challenges', [featuredChallenge()]);
    seed('MemberChallengeProgress', [
      { memberId: 'mem-abc', challengeId: 'cotw-apr-w3', progressValue: 1, completedAt: '2026-04-10T09:00:00Z' },
    ]);
    const result = await getActiveChallengeOfWeek();
    expect(result.progressValue).toBe(1);
    expect(result.completedAt).toBe('2026-04-10T09:00:00Z');
  });

  it('uses challengeId field over _id when present', async () => {
    seed('Challenges', [featuredChallenge({ challengeId: 'explicit-id' })]);
    const result = await getActiveChallengeOfWeek();
    expect(result.challengeId).toBe('explicit-id');
  });

  it('falls back to _id when challengeId field is absent', async () => {
    const { challengeId: _drop, ...withoutChallengeId } = featuredChallenge();
    seed('Challenges', [{ ...withoutChallengeId, _id: 'fallback-id' }]);
    const result = await getActiveChallengeOfWeek();
    expect(result.challengeId).toBe('fallback-id');
  });

  it('returns zero progressValue when member has no progress record', async () => {
    _mockMemberId = 'mem-new';
    seed('Challenges', [featuredChallenge()]);
    // No progress records seeded
    const result = await getActiveChallengeOfWeek();
    expect(result.progressValue).toBe(0);
    expect(result.completedAt).toBeNull();
  });

  it('returns null ctaUrl when challenge has no ctaUrl field', async () => {
    const { ctaUrl: _drop, ...noCtaChallenge } = featuredChallenge();
    seed('Challenges', [noCtaChallenge]);
    const result = await getActiveChallengeOfWeek();
    expect(result.ctaUrl).toBeNull();
  });

  it('returns null description when challenge has none', async () => {
    seed('Challenges', [featuredChallenge({ description: null })]);
    const result = await getActiveChallengeOfWeek();
    expect(result.description).toBeNull();
  });

  it('converts expiresAt Date object to ISO string', async () => {
    const dateObj = new Date(FUTURE);
    seed('Challenges', [featuredChallenge({ expiresAt: dateObj })]);
    const result = await getActiveChallengeOfWeek();
    expect(typeof result.expiresAt).toBe('string');
    expect(result.expiresAt).toBe(dateObj.toISOString());
  });
});
