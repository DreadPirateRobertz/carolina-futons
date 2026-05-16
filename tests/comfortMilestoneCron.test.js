/**
 * @file comfortMilestoneCron.test.js
 * @description Tests for the comfort-timeline milestone scanner cron
 * (cf-ui9w workstream 3 — restore the milestone scheduler retired in
 * cf-4x7e.B5 / PR #1333).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __seed, __setQueryError } from './__mocks__/wix-data.js';

import { processComfortMilestones } from '../src/backend/comfortMilestoneCron.web.js';

const NOW_MS = new Date('2026-05-15T15:00:00.000Z').getTime();

function daysAgo(days) {
  return new Date(NOW_MS - days * 24 * 60 * 60 * 1000);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
});

afterEach(() => {
  vi.useRealTimers();
});

function seedTimeline(overrides = {}) {
  __seed('ComfortTimelines', [
    {
      _id: 't1',
      orderId: 'O-1',
      memberId: 'mem-1',
      productId: 'prod-mattress',
      productName: 'Bryan Charcoal Mattress',
      deliveredAt: daysAgo(0),
      status: 'active',
      milestonesCompleted: '[]',
      ...overrides,
    },
  ]);
}

describe('processComfortMilestones — single timeline', () => {
  it('returns Day 1 milestone for a timeline delivered exactly 1 day ago', async () => {
    seedTimeline({ deliveredAt: daysAgo(1) });
    const result = await processComfortMilestones();
    expect(result.success).toBe(true);
    expect(result.milestonesFound).toBe(1);
    expect(result.results[0]).toMatchObject({
      timelineId: 't1',
      memberId: 'mem-1',
      milestone: 'day_1',
    });
  });

  it('returns Day 7 milestone for a timeline delivered 7 days ago', async () => {
    seedTimeline({ deliveredAt: daysAgo(7) });
    const result = await processComfortMilestones();
    expect(result.results[0].milestone).toBe('day_7');
  });

  it('returns Day 14 milestone for a timeline delivered 14 days ago', async () => {
    seedTimeline({ deliveredAt: daysAgo(14) });
    expect((await processComfortMilestones()).results[0].milestone).toBe('day_14');
  });

  it('returns Day 30 milestone for a timeline delivered 30 days ago', async () => {
    seedTimeline({ deliveredAt: daysAgo(30) });
    expect((await processComfortMilestones()).results[0].milestone).toBe('day_30');
  });

  it('returns Day 60 milestone for a timeline delivered 60 days ago', async () => {
    seedTimeline({ deliveredAt: daysAgo(60) });
    expect((await processComfortMilestones()).results[0].milestone).toBe('day_60');
  });

  it('returns no milestones for a timeline outside any window (Day 4)', async () => {
    seedTimeline({ deliveredAt: daysAgo(4) });
    const result = await processComfortMilestones();
    expect(result.milestonesFound).toBe(0);
    expect(result.results).toEqual([]);
  });
});

describe('processComfortMilestones — dedup via milestonesCompleted', () => {
  it('skips a milestone already recorded in milestonesCompleted JSON', async () => {
    seedTimeline({
      deliveredAt: daysAgo(7),
      milestonesCompleted: JSON.stringify([1, 7]),
    });
    const result = await processComfortMilestones();
    expect(result.milestonesFound).toBe(0);
  });

  it('still fires later milestones when earlier ones are completed', async () => {
    seedTimeline({
      deliveredAt: daysAgo(14),
      milestonesCompleted: JSON.stringify([1, 7]),
    });
    const result = await processComfortMilestones();
    expect(result.results.map((r) => r.milestone)).toEqual(['day_14']);
  });

  it('handles malformed milestonesCompleted JSON by treating as empty', async () => {
    seedTimeline({
      deliveredAt: daysAgo(7),
      milestonesCompleted: '{{invalid}}',
    });
    const result = await processComfortMilestones();
    expect(result.milestonesFound).toBe(1);
    expect(result.results[0].milestone).toBe('day_7');
  });
});

describe('processComfortMilestones — status filter', () => {
  it('skips timelines with status=complete', async () => {
    seedTimeline({ deliveredAt: daysAgo(7), status: 'complete' });
    const result = await processComfortMilestones();
    expect(result.milestonesFound).toBe(0);
  });

  it('skips timelines with status=cancelled', async () => {
    seedTimeline({ deliveredAt: daysAgo(7), status: 'cancelled' });
    const result = await processComfortMilestones();
    expect(result.milestonesFound).toBe(0);
  });
});

describe('processComfortMilestones — multiple timelines', () => {
  it('emits one result row per (timeline, milestone) tuple', async () => {
    __seed('ComfortTimelines', [
      {
        _id: 't1',
        orderId: 'O-1',
        memberId: 'mem-1',
        productId: 'prod-a',
        deliveredAt: daysAgo(1),
        status: 'active',
        milestonesCompleted: '[]',
      },
      {
        _id: 't2',
        orderId: 'O-2',
        memberId: 'mem-2',
        productId: 'prod-b',
        deliveredAt: daysAgo(30),
        status: 'active',
        milestonesCompleted: '[]',
      },
    ]);

    const result = await processComfortMilestones();
    expect(result.success).toBe(true);
    expect(result.timelinesScanned).toBe(2);
    expect(result.milestonesFound).toBe(2);
    expect(result.results.map((r) => r.milestone).sort()).toEqual(['day_1', 'day_30']);
  });
});

describe('processComfortMilestones — empty collection happy path', () => {
  it('returns success:true with zero results when no timelines are seeded', async () => {
    __seed('ComfortTimelines', []);
    const result = await processComfortMilestones();
    expect(result.success).toBe(true);
    expect(result.timelinesScanned).toBe(0);
    expect(result.milestonesFound).toBe(0);
    expect(result.results).toEqual([]);
  });
});

// pr-test-analyzer finding from 5-lens review: the prior describe was
// mis-labeled "error handling" while seeding `[]` — that's actually the
// empty-collection happy path. The wix-data mock exposes
// `__setQueryError(collection, error)` to force the real try/catch
// path; this describe exercises it.
describe('processComfortMilestones — error handling', () => {
  afterEach(() => {
    __setQueryError('ComfortTimelines', null);
  });

  it('returns success:false on a Wix query failure (does not throw)', async () => {
    __setQueryError('ComfortTimelines', new Error('Wix data unavailable'));
    const result = await processComfortMilestones();
    expect(result.success).toBe(false);
    expect(result.timelinesScanned).toBe(0);
    expect(result.milestonesFound).toBe(0);
    expect(result.results).toEqual([]);
  });
});

// pr-test-analyzer finding: clock-skew negative-daysSince edge case.
// A deliveredAt timestamp newer than `now` (clock skew between
// the Wix database server and the cron runner, or an admin manually
// editing a row) shouldn't crash and shouldn't fire the Day 1 window
// — daysSince would be -1 / -0 / 0, all outside Day 1's [0, 2] window
// except the boundary day-0 case which IS Day 1's minDays (legitimate
// same-day delivery).
describe('processComfortMilestones — clock-skew edge cases', () => {
  it('fires Day 1 for an exactly-now deliveredAt (daysSince=0 is inside the Day 1 window)', async () => {
    seedTimeline({ deliveredAt: new Date(NOW_MS) });
    const result = await processComfortMilestones();
    expect(result.results[0]?.milestone).toBe('day_1');
  });

  it('does NOT fire any milestone for a deliveredAt in the future (negative daysSince)', async () => {
    seedTimeline({ deliveredAt: new Date(NOW_MS + 5 * 24 * 60 * 60 * 1000) });
    const result = await processComfortMilestones();
    expect(result.milestonesFound).toBe(0);
  });
});
