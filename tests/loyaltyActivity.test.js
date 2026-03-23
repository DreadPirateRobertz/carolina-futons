/**
 * @file loyaltyActivity.test.js
 * @description CF-a4l: TDD tests for getMyActivity() webMethod.
 *
 * Covers:
 *  - Authentication: 401 when unauthenticated
 *  - Rate limiting: 429 at 30 req/min (via CMS-backed checkRateLimit)
 *  - Shape: { events, hasMore, total }
 *  - Each event shape: { id, type, description, points, earnedAt }
 *  - Pagination: limit/offset applied correctly
 *  - hasMore: true when more items exist beyond current page
 *  - Sorting: earnedAt DESC (most recent first)
 *  - Error handling: graceful degradation on PointsLedger query failure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as __resetData, __seed, __setQueryError, __getLastFindOptions } from './__mocks__/wix-data.js';
import { __reset as __resetMembers, __setMember, currentMember } from './__mocks__/wix-members-backend.js';

// ── Module mocks — must precede the loyaltyService import ────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-loyalty.v2', () => ({
  accounts: { getMyAccount: vi.fn() },
  rewards: { listRewards: vi.fn(), redeemReward: vi.fn() },
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: rateLimitMock.checkRateLimit,
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

import { getMyActivity } from '../src/backend/loyaltyService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_MEMBER = { _id: 'member-act1', loginEmail: 'active@example.com' };

function makeEvent(overrides = {}) {
  const base = {
    _id:         overrides._id         ?? 'evt-1',
    memberId:    overrides.memberId    ?? 'member-act1',
    type:        overrides.type        ?? 'purchase',
    description: overrides.description ?? 'Earned points on order',
    points:      overrides.points      ?? 50,
    earnedAt:    overrides.earnedAt    ?? new Date('2026-03-23T10:00:00Z'),
  };
  return base;
}

beforeEach(() => {
  __resetData();
  __resetMembers();
  vi.clearAllMocks();
  rateLimitMock.checkRateLimit.mockResolvedValue({ allowed: true });
  __seed('PointsLedger', []);
});

// ── Authentication ────────────────────────────────────────────────────────────

describe('getMyActivity — authentication', () => {
  it('returns 401 when no member is authenticated', async () => {
    const res = await getMyActivity();
    expect(res.status).toBe(401);
  });

  it('returns 401 when getMember() throws', async () => {
    currentMember.getMember.mockRejectedValueOnce(new Error('Session service unavailable'));
    const res = await getMyActivity();
    expect(res.status).toBe(401);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('getMyActivity — rate limiting', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns 429 when checkRateLimit returns allowed: false', async () => {
    rateLimitMock.checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await getMyActivity();
    expect(res.status).toBe(429);
  });

  it('calls checkRateLimit with correct key and member id', async () => {
    await getMyActivity();
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      'ActivityRateLimit',
      VALID_MEMBER._id,
      { max: 30, windowMs: 60_000 },
    );
  });
});

// ── Shape ─────────────────────────────────────────────────────────────────────

describe('getMyActivity — shape', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns { events, hasMore, total }', async () => {
    const res = await getMyActivity();
    expect(res).toHaveProperty('events');
    expect(res).toHaveProperty('hasMore');
    expect(res).toHaveProperty('total');
  });

  it('returns empty events array when no ledger entries exist', async () => {
    const res = await getMyActivity();
    expect(res.events).toEqual([]);
    expect(res.total).toBe(0);
    expect(res.hasMore).toBe(false);
  });

  it('each event has id, type, description, points, and earnedAt', async () => {
    __seed('PointsLedger', [makeEvent()]);
    const res = await getMyActivity();
    const [evt] = res.events;
    expect(evt).toHaveProperty('id');
    expect(evt).toHaveProperty('type');
    expect(evt).toHaveProperty('description');
    expect(evt).toHaveProperty('points');
    expect(evt).toHaveProperty('earnedAt');
  });

  it('maps _id → id in returned events', async () => {
    __seed('PointsLedger', [makeEvent({ _id: 'evt-abc' })]);
    const res = await getMyActivity();
    expect(res.events[0].id).toBe('evt-abc');
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe('getMyActivity — pagination', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('defaults to limit 20 when not specified', async () => {
    const events = Array.from({ length: 25 }, (_, i) =>
      makeEvent({ _id: `evt-${i}`, earnedAt: new Date(2026, 2, i + 1) })
    );
    __seed('PointsLedger', events);
    const res = await getMyActivity();
    expect(res.events).toHaveLength(20);
  });

  it('respects custom limit', async () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ _id: `evt-${i}` })
    );
    __seed('PointsLedger', events);
    const res = await getMyActivity({ limit: 5 });
    expect(res.events).toHaveLength(5);
  });

  it('respects offset — skips first N events', async () => {
    __seed('PointsLedger', [
      makeEvent({ _id: 'evt-1', earnedAt: new Date('2026-03-23T12:00:00Z') }),
      makeEvent({ _id: 'evt-2', earnedAt: new Date('2026-03-23T11:00:00Z') }),
      makeEvent({ _id: 'evt-3', earnedAt: new Date('2026-03-23T10:00:00Z') }),
    ]);
    const res = await getMyActivity({ limit: 2, offset: 1 });
    expect(res.events[0].id).toBe('evt-2');
    expect(res.events[1].id).toBe('evt-3');
  });

  it('clamps limit to max 50', async () => {
    const events = Array.from({ length: 60 }, (_, i) =>
      makeEvent({ _id: `evt-${i}` })
    );
    __seed('PointsLedger', events);
    const res = await getMyActivity({ limit: 100 });
    expect(res.events.length).toBeLessThanOrEqual(50);
  });

  it('total reflects all matching records, not just the page', async () => {
    const events = Array.from({ length: 25 }, (_, i) =>
      makeEvent({ _id: `evt-${i}` })
    );
    __seed('PointsLedger', events);
    const res = await getMyActivity({ limit: 10 });
    expect(res.total).toBe(25);
  });
});

// ── hasMore ───────────────────────────────────────────────────────────────────

describe('getMyActivity — hasMore', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('hasMore is true when total > offset + limit', async () => {
    const events = Array.from({ length: 15 }, (_, i) => makeEvent({ _id: `evt-${i}` }));
    __seed('PointsLedger', events);
    const res = await getMyActivity({ limit: 10, offset: 0 });
    expect(res.hasMore).toBe(true);
  });

  it('hasMore is false when on the last page', async () => {
    const events = Array.from({ length: 15 }, (_, i) => makeEvent({ _id: `evt-${i}` }));
    __seed('PointsLedger', events);
    const res = await getMyActivity({ limit: 10, offset: 10 });
    expect(res.hasMore).toBe(false);
  });

  it('hasMore is false when total equals limit exactly', async () => {
    const events = Array.from({ length: 10 }, (_, i) => makeEvent({ _id: `evt-${i}` }));
    __seed('PointsLedger', events);
    const res = await getMyActivity({ limit: 10, offset: 0 });
    expect(res.hasMore).toBe(false);
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

describe('getMyActivity — sorting', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns events sorted by earnedAt descending (most recent first)', async () => {
    __seed('PointsLedger', [
      makeEvent({ _id: 'old', earnedAt: new Date('2026-03-01T00:00:00Z') }),
      makeEvent({ _id: 'new', earnedAt: new Date('2026-03-23T00:00:00Z') }),
      makeEvent({ _id: 'mid', earnedAt: new Date('2026-03-15T00:00:00Z') }),
    ]);
    const res = await getMyActivity();
    expect(res.events[0].id).toBe('new');
    expect(res.events[1].id).toBe('mid');
    expect(res.events[2].id).toBe('old');
  });
});

// ── Member isolation ──────────────────────────────────────────────────────────

describe('getMyActivity — member isolation', () => {
  it('returns only the authenticated member\'s events', async () => {
    __seed('PointsLedger', [
      makeEvent({ _id: 'mine',  memberId: 'member-act1' }),
      makeEvent({ _id: 'other', memberId: 'member-other' }),
    ]);
    __setMember(VALID_MEMBER);
    const res = await getMyActivity();
    expect(res.events).toHaveLength(1);
    expect(res.events[0].id).toBe('mine');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('getMyActivity — edge cases', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('queries PointsLedger with suppressAuth: true', async () => {
    await getMyActivity();
    expect(__getLastFindOptions('PointsLedger')).toMatchObject({ suppressAuth: true });
  });

  it('treats limit: 0 as the default limit (20) due to falsy coercion', async () => {
    const events = Array.from({ length: 25 }, (_, i) => makeEvent({ _id: `evt-${i}` }));
    __seed('PointsLedger', events);
    const res = await getMyActivity({ limit: 0 });
    // Number(0) || 20 resolves to 20 because 0 is falsy
    expect(res.events).toHaveLength(20);
  });

  it('clamps negative offset to 0', async () => {
    __seed('PointsLedger', [makeEvent({ _id: 'evt-1' })]);
    const res = await getMyActivity({ offset: -5 });
    expect(res.events).toHaveLength(1);
    expect(res.events[0].id).toBe('evt-1');
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('getMyActivity — error handling', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns empty result when PointsLedger query throws', async () => {
    __setQueryError('PointsLedger', new Error('CMS unavailable'));
    const res = await getMyActivity();
    expect(res.events).toEqual([]);
    expect(res.total).toBe(0);
    expect(res.hasMore).toBe(false);
  });
});
