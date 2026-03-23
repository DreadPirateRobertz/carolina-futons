/**
 * @file backfillPointsLedger.test.js
 * @description Tests for the one-time backfill migration that populates
 * `memberMilestoneKey` on PointsLedger rows that pre-date cf-7mr.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getUpdated,
} from './__mocks__/wix-data.js';
import { backfillPointsLedger } from '../src/backend/cms/backfillPointsLedger.js';

beforeEach(() => {
  __reset();
});

describe('backfillPointsLedger', () => {
  it('sets memberMilestoneKey on rows that are missing it', async () => {
    __seed('PointsLedger', [
      { _id: 'row-1', memberId: 'mem-1', milestone: 30 },
      { _id: 'row-2', memberId: 'mem-2', milestone: 60 },
    ]);

    const result = await backfillPointsLedger();

    expect(result.checked).toBe(2);
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);

    const updates = __getUpdated('PointsLedger');
    expect(updates).toHaveLength(2);
    expect(updates[0].memberMilestoneKey).toBe('mem-1:30');
    expect(updates[1].memberMilestoneKey).toBe('mem-2:60');
  });

  it('skips rows that already have memberMilestoneKey', async () => {
    __seed('PointsLedger', [
      { _id: 'row-1', memberId: 'mem-1', milestone: 30, memberMilestoneKey: 'mem-1:30' },
      { _id: 'row-2', memberId: 'mem-2', milestone: 7 },
    ]);

    const result = await backfillPointsLedger();

    expect(result.checked).toBe(2);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);

    const updates = __getUpdated('PointsLedger');
    expect(updates).toHaveLength(1);
    expect(updates[0].memberMilestoneKey).toBe('mem-2:7');
  });

  it('skips rows missing memberId or milestone', async () => {
    __seed('PointsLedger', [
      { _id: 'row-1', memberId: 'mem-1' },           // no milestone
      { _id: 'row-2', milestone: 30 },                // no memberId
      { _id: 'row-3', memberId: 'mem-3', milestone: 14 }, // valid
    ]);

    const result = await backfillPointsLedger();

    expect(result.checked).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(2);

    const updates = __getUpdated('PointsLedger');
    expect(updates[0].memberMilestoneKey).toBe('mem-3:14');
  });

  it('returns zeros on an empty collection', async () => {
    __seed('PointsLedger', []);

    const result = await backfillPointsLedger();

    expect(result).toEqual({ checked: 0, updated: 0, skipped: 0 });
  });

  it('is idempotent — running twice produces no extra updates', async () => {
    __seed('PointsLedger', [
      { _id: 'row-1', memberId: 'mem-1', milestone: 30 },
    ]);

    await backfillPointsLedger();
    // First run updates the row; second run should see the key and skip.
    // Re-seed with the key already set (simulating the state after first run).
    __reset();
    __seed('PointsLedger', [
      { _id: 'row-1', memberId: 'mem-1', milestone: 30, memberMilestoneKey: 'mem-1:30' },
    ]);

    const result = await backfillPointsLedger();
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('preserves all existing fields when updating', async () => {
    __seed('PointsLedger', [
      {
        _id: 'row-1',
        memberId: 'mem-1',
        milestone: 100,
        type: 'streak_milestone',
        points: 200,
        earnedAt: '2024-01-01',
      },
    ]);

    await backfillPointsLedger();

    const updates = __getUpdated('PointsLedger');
    expect(updates[0]).toMatchObject({
      _id: 'row-1',
      memberId: 'mem-1',
      milestone: 100,
      type: 'streak_milestone',
      points: 200,
      earnedAt: '2024-01-01',
      memberMilestoneKey: 'mem-1:100',
    });
  });
});
