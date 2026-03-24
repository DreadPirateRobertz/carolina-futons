/**
 * pointsHistoryService.test.js
 * CF-ptth — backend: getRecentPointsHistory
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';

const memberMocks = vi.hoisted(() => ({ getMember: vi.fn() }));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: memberMocks.getMember },
}));

import { getRecentPointsHistory } from '../src/backend/pointsHistoryService.web.js';

const MEMBER_ID = 'mem-hist-1';
const MEMBER = { _id: MEMBER_ID };

const TX1 = { _id: 't1', memberId: MEMBER_ID, points: 100,  reason: 'Purchase',     date: '2026-03-20', type: 'earn'  };
const TX2 = { _id: 't2', memberId: MEMBER_ID, points: -50,  reason: 'Redemption',   date: '2026-03-19', type: 'spend' };
const TX3 = { _id: 't3', memberId: MEMBER_ID, points: 50,   reason: 'Review',       date: '2026-03-18', type: 'earn'  };

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  memberMocks.getMember.mockResolvedValue(MEMBER);
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('getRecentPointsHistory — happy path', () => {
  it('returns transactions for the authenticated member', async () => {
    __seed('PointsTransactions', [TX1, TX2]);
    const result = await getRecentPointsHistory(MEMBER_ID);
    expect(result.transactions).toHaveLength(2);
  });

  it('returns empty array when member has no transactions', async () => {
    const result = await getRecentPointsHistory(MEMBER_ID);
    expect(result.transactions).toEqual([]);
  });

  it('returns transactions with correct fields', async () => {
    __seed('PointsTransactions', [TX1]);
    const result = await getRecentPointsHistory(MEMBER_ID);
    expect(result.transactions[0]).toMatchObject({
      points: 100,
      reason: 'Purchase',
      date:   '2026-03-20',
      type:   'earn',
    });
  });

  it('respects the limit param', async () => {
    __seed('PointsTransactions', [TX1, TX2, TX3]);
    const result = await getRecentPointsHistory(MEMBER_ID, 2);
    expect(result.transactions).toHaveLength(2);
  });

  it('defaults to limit 10', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      _id: `t${i}`, memberId: MEMBER_ID, points: 10, reason: 'r', date: '2026-03-01', type: 'earn',
    }));
    __seed('PointsTransactions', many);
    const result = await getRecentPointsHistory(MEMBER_ID);
    expect(result.transactions).toHaveLength(10);
  });

  it('returns most recent first (descending date order)', async () => {
    __seed('PointsTransactions', [TX3, TX1, TX2]);
    const result = await getRecentPointsHistory(MEMBER_ID);
    const dates = result.transactions.map((t) => t.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

// ── IDOR / auth guard ─────────────────────────────────────────────────────────

describe('getRecentPointsHistory — auth guard', () => {
  it('returns auth_required when not logged in', async () => {
    memberMocks.getMember.mockRejectedValue(new Error('not logged in'));
    const result = await getRecentPointsHistory(MEMBER_ID);
    expect(result.error).toBe('auth_required');
  });

  it('returns forbidden when caller is a different member (IDOR guard)', async () => {
    memberMocks.getMember.mockResolvedValue({ _id: 'mem-other' });
    const result = await getRecentPointsHistory(MEMBER_ID);
    expect(result.error).toBe('forbidden');
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('getRecentPointsHistory — error handling', () => {
  it('returns structured error on DB failure', async () => {
    __setQueryError('PointsTransactions', new Error('DB unavailable'));
    const result = await getRecentPointsHistory(MEMBER_ID);
    expect(result.error).toBeDefined();
  });
});
