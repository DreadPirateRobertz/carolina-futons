import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertLedgerEntry, MEMBER_POINTS_LEDGER_COLLECTION } from '../src/backend/utils/memberPointsLedger.js';

vi.mock('wix-data', () => ({
  default: {
    insert: vi.fn().mockResolvedValue({ _id: 'ledger-1' }),
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
