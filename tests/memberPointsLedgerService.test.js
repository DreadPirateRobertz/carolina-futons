/**
 * @file memberPointsLedgerService.test.js
 * @description Tests for the webMethod that exposes MemberPointsLedger history
 * to the authenticated member. CF-qyi.
 *
 * Guarantees:
 * - memberId is derived from the session (currentMember), never accepted from
 *   the caller, so the endpoint is not vulnerable to IDOR.
 * - Unauthenticated callers get error: 'auth_required'.
 * - Pagination is honored: limit / offset / defaults.
 * - Limit is capped to MAX_HISTORY_LIMIT.
 * - DB errors return a safe { success:false } shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let _queryResult = { items: [], totalCount: 0 };
const queryBuilder = {
  eq:         vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  skip:       vi.fn().mockReturnThis(),
  limit:      vi.fn().mockReturnThis(),
  find:       vi.fn(() => Promise.resolve(_queryResult)),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => queryBuilder),
  },
}));

import wixData from 'wix-data';
import { currentMember, __setMember, __resetMember } from 'wix-members-backend';
import {
  getMyPointsHistory,
  MAX_HISTORY_LIMIT,
} from '../src/backend/memberPointsLedgerService.web.js';

const MEMBER_ID = 'mem-session-1';

beforeEach(() => {
  vi.clearAllMocks();
  queryBuilder.eq.mockReturnThis();
  queryBuilder.descending.mockReturnThis();
  queryBuilder.skip.mockReturnThis();
  queryBuilder.limit.mockReturnThis();
  queryBuilder.find.mockResolvedValue({ items: [], totalCount: 0 });
  __resetMember();
});

describe('getMyPointsHistory — authentication', () => {
  it('returns auth_required when no member in session', async () => {
    const result = await getMyPointsHistory(10, 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
    expect(wixData.query).not.toHaveBeenCalled();
  });

  it('returns auth_required when currentMember.getMember throws', async () => {
    currentMember.getMember.mockRejectedValueOnce(new Error('not logged in'));
    const result = await getMyPointsHistory(10, 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });

  it('returns auth_required when currentMember resolves to a member without _id', async () => {
    currentMember.getMember.mockResolvedValueOnce({});
    const result = await getMyPointsHistory(10, 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });
});

describe('getMyPointsHistory — memberId derivation', () => {
  it('queries with memberId from session, never from a caller-supplied arg', async () => {
    __setMember({ _id: MEMBER_ID });
    // Even if caller somehow passes a memberId positional (old signature), it must be ignored.
    await getMyPointsHistory(10, 0, 'attacker-supplied');

    expect(queryBuilder.eq).toHaveBeenCalledWith('memberId', MEMBER_ID);
    expect(queryBuilder.eq).not.toHaveBeenCalledWith('memberId', 'attacker-supplied');
  });
});

describe('getMyPointsHistory — pagination', () => {
  beforeEach(() => {
    __setMember({ _id: MEMBER_ID });
  });

  it('applies supplied limit and offset', async () => {
    await getMyPointsHistory(5, 10);
    expect(queryBuilder.limit).toHaveBeenCalledWith(5);
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
  });

  it('defaults to limit=20 and offset=0 when not provided', async () => {
    await getMyPointsHistory();
    expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
  });

  it('caps limit at MAX_HISTORY_LIMIT', async () => {
    await getMyPointsHistory(MAX_HISTORY_LIMIT + 500, 0);
    expect(queryBuilder.limit).toHaveBeenCalledWith(MAX_HISTORY_LIMIT);
  });

  it('coerces negative offset to 0', async () => {
    await getMyPointsHistory(10, -5);
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
  });

  it('coerces non-numeric limit to the default', async () => {
    await getMyPointsHistory('abc', 0);
    expect(queryBuilder.limit).toHaveBeenCalledWith(20);
  });

  it('sorts descending by _createdDate (newest first)', async () => {
    await getMyPointsHistory(10, 0);
    expect(queryBuilder.descending).toHaveBeenCalledWith('_createdDate');
  });
});

describe('getMyPointsHistory — result shape', () => {
  beforeEach(() => {
    __setMember({ _id: MEMBER_ID });
  });

  it('returns entries + total + hasMore=false when all returned', async () => {
    queryBuilder.find.mockResolvedValueOnce({
      items: [{ _id: 'l1' }, { _id: 'l2' }],
      totalCount: 2,
    });
    const result = await getMyPointsHistory(10, 0);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('hasMore=true when more pages remain', async () => {
    queryBuilder.find.mockResolvedValueOnce({
      items: [{ _id: 'l1' }, { _id: 'l2' }],
      totalCount: 50,
    });
    const result = await getMyPointsHistory(2, 0);
    expect(result.hasMore).toBe(true);
  });

  it('returns empty entries for a member with no history', async () => {
    const result = await getMyPointsHistory(10, 0);
    expect(result.success).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('returns { success:false } and logs on wix-data error', async () => {
    queryBuilder.find.mockRejectedValueOnce(new Error('DB outage'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await getMyPointsHistory(10, 0);
    expect(result.success).toBe(false);
    expect(result.entries).toEqual([]);
    expect(result.error).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
