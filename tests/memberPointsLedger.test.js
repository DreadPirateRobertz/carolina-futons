import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertLedgerEntry, getPointsHistory, MEMBER_POINTS_LEDGER_COLLECTION } from '../src/backend/utils/memberPointsLedger.js';

// Chainable query mock — each call to query() returns a fresh builder whose
// find() resolves to _queryResult. Reset _queryResult per test.
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
    insert: vi.fn().mockResolvedValue({ _id: 'ledger-1' }),
    query:  vi.fn(() => queryBuilder),
  },
}));

import wixData from 'wix-data';

describe('insertLedgerEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts into MemberPointsLedger with all required fields', async () => {
    await insertLedgerEntry({
      memberId: 'mem1',
      traceId: 'trace-abc',
      operationType: 'earn',
      delta: 10,
      reason: 'gamification_purchase',
      previousBalance: 100,
      newBalance: 110,
      sourceData: { eventName: 'gamification_purchase', multiplier: 1 },
    });

    expect(wixData.insert).toHaveBeenCalledOnce();
    const [col, doc, opts] = wixData.insert.mock.calls[0];
    expect(col).toBe('MemberPointsLedger');
    expect(doc.memberId).toBe('mem1');
    expect(doc.traceId).toBe('trace-abc');
    expect(doc.operationType).toBe('earn');
    expect(doc.delta).toBe(10);
    expect(doc.reason).toBe('gamification_purchase');
    expect(doc.previousBalance).toBe(100);
    expect(doc.newBalance).toBe(110);
    expect(doc.sourceData).toBe('{"eventName":"gamification_purchase","multiplier":1}');
    expect(doc.timestamp).toBeInstanceOf(Date);
    expect(opts).toEqual({ suppressAuth: true });
  });

  it('auto-generates traceId when not provided', async () => {
    await insertLedgerEntry({
      memberId: 'mem2',
      operationType: 'burn',
      delta: -50,
      reason: 'streak_recovery',
      previousBalance: 200,
      newBalance: 150,
    });

    const [, doc] = wixData.insert.mock.calls[0];
    expect(doc.traceId).toBeTruthy();
    expect(typeof doc.traceId).toBe('string');
    expect(doc.traceId).toContain('mem2');
  });

  it('stores null sourceData when not provided', async () => {
    await insertLedgerEntry({
      memberId: 'mem3',
      traceId: 'trace-xyz',
      operationType: 'admin_adjust',
      delta: 0,
      reason: 'manual_correction',
      previousBalance: 50,
      newBalance: 50,
    });

    const [, doc] = wixData.insert.mock.calls[0];
    expect(doc.sourceData).toBeNull();
  });

  it('stores null sourceData when sourceData is null', async () => {
    await insertLedgerEntry({
      memberId: 'mem4',
      traceId: 'trace-null',
      operationType: 'bonus',
      delta: 25,
      reason: 'milestone_100',
      previousBalance: 75,
      newBalance: 100,
      sourceData: null,
    });

    const [, doc] = wixData.insert.mock.calls[0];
    expect(doc.sourceData).toBeNull();
  });

  it('propagates wixData insert errors to caller', async () => {
    wixData.insert.mockRejectedValueOnce(new Error('DB write failed'));

    await expect(insertLedgerEntry({
      memberId: 'mem5',
      traceId: 'trace-err',
      operationType: 'earn',
      delta: 5,
      reason: 'test',
      previousBalance: 0,
      newBalance: 5,
    })).rejects.toThrow('DB write failed');
  });

  it('exports MEMBER_POINTS_LEDGER_COLLECTION constant as MemberPointsLedger', () => {
    expect(MEMBER_POINTS_LEDGER_COLLECTION).toBe('MemberPointsLedger');
  });
});

// ── getPointsHistory ──────────────────────────────────────────────────────────

describe('getPointsHistory', () => {
  const MEMBER_ID = 'member-hist-1';

  beforeEach(() => {
    vi.clearAllMocks();
    queryBuilder.eq.mockReturnThis();
    queryBuilder.descending.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.limit.mockReturnThis();
    queryBuilder.find.mockResolvedValue({ items: [], totalCount: 0 });
  });

  it('returns success: true with entries for member', async () => {
    const items = [
      { _id: 'l1', memberId: MEMBER_ID, delta: 50, operationType: 'earn', _createdDate: new Date() },
      { _id: 'l2', memberId: MEMBER_ID, delta: 100, operationType: 'earn', _createdDate: new Date() },
    ];
    queryBuilder.find.mockResolvedValue({ items, totalCount: 2 });

    const result = await getPointsHistory(MEMBER_ID, 10, 0);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('queries the MemberPointsLedger collection filtered by memberId', async () => {
    queryBuilder.find.mockResolvedValue({ items: [], totalCount: 0 });

    await getPointsHistory(MEMBER_ID, 10, 0);

    expect(wixData.query).toHaveBeenCalledWith(MEMBER_POINTS_LEDGER_COLLECTION);
    expect(queryBuilder.eq).toHaveBeenCalledWith('memberId', MEMBER_ID);
  });

  it('applies descending _createdDate sort', async () => {
    queryBuilder.find.mockResolvedValue({ items: [], totalCount: 0 });

    await getPointsHistory(MEMBER_ID, 10, 0);

    expect(queryBuilder.descending).toHaveBeenCalledWith('_createdDate');
  });

  it('applies limit and skip for pagination', async () => {
    queryBuilder.find.mockResolvedValue({ items: [], totalCount: 0 });

    await getPointsHistory(MEMBER_ID, 5, 10);

    expect(queryBuilder.limit).toHaveBeenCalledWith(5);
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
  });

  it('returns empty entries when member has no history', async () => {
    queryBuilder.find.mockResolvedValue({ items: [], totalCount: 0 });

    const result = await getPointsHistory(MEMBER_ID, 10, 0);
    expect(result.success).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('defaults limit to 20 and offset to 0 when not provided', async () => {
    queryBuilder.find.mockResolvedValue({ items: [], totalCount: 0 });

    await getPointsHistory(MEMBER_ID);

    expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
  });

  it('returns success: false and empty entries on DB error', async () => {
    queryBuilder.find.mockRejectedValue(new Error('DB timeout'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getPointsHistory(MEMBER_ID, 10, 0);

    expect(result.success).toBe(false);
    expect(result.entries).toEqual([]);
    expect(result.error).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
