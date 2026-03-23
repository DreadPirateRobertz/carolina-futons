/**
 * @file recordStreakMilestoneEvent.test.js
 * @description TDD tests for cf-78e: recordStreakMilestoneEvent() — writes PointsLedger on streak achievement.
 *
 * Spec:
 *  - recordStreakMilestoneEvent(memberId, milestone, points)
 *  - Inserts PointsLedger: { memberId, milestone, type: 'streak_milestone', description, points, earnedAt }
 *  - description: '<milestone>-day streak — <badgeLabel>'
 *  - Validates memberId (validateId), milestone and points (positive finite numbers)
 *  - Idempotent: skips insert if PointsLedger already has memberId + milestone record
 *  - Throws (re-throws) on DB error
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert, __setQueryError, __setInsertError } from './__mocks__/wix-data.js';
import { recordStreakMilestoneEvent } from '../src/backend/loyaltyService.web.js';

beforeEach(() => {
  __reset();
});

describe('recordStreakMilestoneEvent', () => {
  it('inserts a PointsLedger record with correct shape', async () => {
    __seed('PointsLedger', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordStreakMilestoneEvent('mem-1', 30, 60);

    expect(inserts).toHaveLength(1);
    expect(inserts[0].memberId).toBe('mem-1');
    expect(inserts[0].milestone).toBe(30);
    expect(inserts[0].type).toBe('streak_milestone');
    expect(inserts[0].points).toBe(60);
    expect(inserts[0].description).toBe('30-day streak — Monthly Master');
    expect(inserts[0].earnedAt).toBeInstanceOf(Date);
  });

  it('inserts correct description for each milestone', async () => {
    const cases = [
      [7,   14,  'Week Warrior'],
      [14,  28,  'Fortnight Fighter'],
      [30,  60,  'Monthly Master'],
      [60,  120, 'Two Month Titan'],
      [100, 200, 'Century Club'],
      [365, 730, 'Year-Round Legend'],
    ];

    for (const [milestone, points, expectedLabel] of cases) {
      __reset();
      __seed('PointsLedger', []);
      const inserts = [];
      __onInsert((_col, item) => inserts.push(item));

      await recordStreakMilestoneEvent('mem-1', milestone, points);

      expect(inserts[0].description).toBe(`${milestone}-day streak — ${expectedLabel}`);
      expect(inserts[0].points).toBe(points);
    }
  });

  it('uses fallback label for unknown milestone', async () => {
    __seed('PointsLedger', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordStreakMilestoneEvent('mem-1', 45, 90);

    expect(inserts[0].description).toBe('45-day streak');
  });

  it('is idempotent — skips insert if record already exists', async () => {
    __seed('PointsLedger', [
      { memberId: 'mem-1', milestone: 30 },
    ]);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordStreakMilestoneEvent('mem-1', 30, 60);

    expect(inserts).toHaveLength(0);
  });

  it('does not treat a different member\'s record as duplicate', async () => {
    __seed('PointsLedger', [
      { memberId: 'mem-2', milestone: 30 },
    ]);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordStreakMilestoneEvent('mem-1', 30, 60);

    expect(inserts).toHaveLength(1);
    expect(inserts[0].memberId).toBe('mem-1');
  });

  it('does not treat a different milestone as duplicate', async () => {
    __seed('PointsLedger', [
      { memberId: 'mem-1', milestone: 7 },
    ]);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordStreakMilestoneEvent('mem-1', 30, 60);

    expect(inserts).toHaveLength(1);
    expect(inserts[0].milestone).toBe(30);
  });

  it('throws TypeError for invalid memberId', async () => {
    await expect(recordStreakMilestoneEvent('', 30, 60)).rejects.toThrow(TypeError);
    await expect(recordStreakMilestoneEvent('bad id!', 30, 60)).rejects.toThrow(TypeError);
    await expect(recordStreakMilestoneEvent(null, 30, 60)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for invalid milestone', async () => {
    await expect(recordStreakMilestoneEvent('mem-1', 0, 60)).rejects.toThrow(TypeError);
    await expect(recordStreakMilestoneEvent('mem-1', -7, 60)).rejects.toThrow(TypeError);
    await expect(recordStreakMilestoneEvent('mem-1', NaN, 60)).rejects.toThrow(TypeError);
    await expect(recordStreakMilestoneEvent('mem-1', 'thirty', 60)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for invalid points', async () => {
    await expect(recordStreakMilestoneEvent('mem-1', 30, 0)).rejects.toThrow(TypeError);
    await expect(recordStreakMilestoneEvent('mem-1', 30, -1)).rejects.toThrow(TypeError);
    await expect(recordStreakMilestoneEvent('mem-1', 30, Infinity)).rejects.toThrow(TypeError);
  });

  it('re-throws on DB query error', async () => {
    __setQueryError('PointsLedger', new Error('DB unavailable'));

    await expect(recordStreakMilestoneEvent('mem-1', 30, 60)).rejects.toThrow('DB unavailable');
  });

  it('re-throws on DB insert error', async () => {
    __seed('PointsLedger', []);
    __setInsertError('PointsLedger', new Error('Insert failed'));

    await expect(recordStreakMilestoneEvent('mem-1', 30, 60)).rejects.toThrow('Insert failed');
  });
});
