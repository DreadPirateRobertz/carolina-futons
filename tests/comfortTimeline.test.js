/**
 * @file comfortTimeline.test.js
 * @description CF-256r: Tests for Comfort Timeline — mattress break-in tracker.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted, __getUpdated } from './__mocks__/wix-data.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── createTimeline ──────────────────────────────────────────────────

describe('createTimeline', () => {
  let createTimeline;

  beforeEach(async () => {
    ({ createTimeline } = await import('../src/backend/comfortTimeline.web.js'));
  });

  it('creates a new timeline for a delivered mattress', async () => {
    const result = await createTimeline({
      orderId: 'order-1',
      memberId: 'member-1',
      productId: 'mattress-1',
      productName: 'Royal Sleep Futon Mattress',
    });

    expect(result.success).toBe(true);
    expect(result.timelineId).toBeTruthy();

    const inserted = __getInserted('ComfortTimelines');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      orderId: 'order-1',
      memberId: 'member-1',
      productId: 'mattress-1',
      status: 'active',
      currentDay: 0,
      crossSellTriggered: false,
      supportEscalated: false,
    });
  });

  it('is idempotent — returns existing timeline ID on duplicate', async () => {
    __seed('ComfortTimelines', [{
      _id: 'existing-1',
      orderId: 'order-1',
      memberId: 'member-1',
      productId: 'mattress-1',
    }]);

    const result = await createTimeline({
      orderId: 'order-1',
      memberId: 'member-1',
      productId: 'mattress-1',
    });

    expect(result.success).toBe(true);
    expect(result.timelineId).toBe('existing-1');
    // Seeded item is in the store, no additional ComfortTimelines insert
    // (AuditLog may have inserts from other calls, so just check the timeline count)
    expect(__getInserted('ComfortTimelines')).toHaveLength(1); // Only the seeded one
  });

  it('rejects missing required fields', async () => {
    const result = await createTimeline({ orderId: 'o1' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/i);
  });
});

// ── logComfortRating ────────────────────────────────────────────────

describe('logComfortRating', () => {
  let logComfortRating;

  beforeEach(async () => {
    ({ logComfortRating } = await import('../src/backend/comfortTimeline.web.js'));
  });

  const activeTimeline = {
    _id: 'tl-1',
    orderId: 'order-1',
    memberId: 'member-1',
    productId: 'mattress-1',
    deliveredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    status: 'active',
    currentDay: 0,
    comfortLogs: '[]',
    milestonesCompleted: '[]',
    supportEscalated: false,
  };

  it('logs a comfort rating and updates timeline', async () => {
    __seed('ComfortTimelines', [activeTimeline]);

    const result = await logComfortRating('tl-1', 4, 'Feels great');
    expect(result.success).toBe(true);
    expect(result.supportEscalated).toBe(false);

    const updated = __getUpdated('ComfortTimelines');
    expect(updated).toHaveLength(1);
    const logs = JSON.parse(updated[0].comfortLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0].rating).toBe(4);
    expect(logs[0].notes).toBe('Feels great');
  });

  it('rejects invalid rating', async () => {
    const result = await logComfortRating('tl-1', 6);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/between 1 and 5/i);
  });

  it('rejects rating of 0', async () => {
    const result = await logComfortRating('tl-1', 0);
    expect(result.success).toBe(false);
  });

  it('triggers support escalation for low comfort at Day 14+', async () => {
    const day14Timeline = {
      ...activeTimeline,
      deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    };
    __seed('ComfortTimelines', [day14Timeline]);

    const result = await logComfortRating('tl-1', 2, 'Too firm');
    expect(result.success).toBe(true);
    expect(result.supportEscalated).toBe(true);
  });

  it('does not escalate for low comfort before Day 14', async () => {
    __seed('ComfortTimelines', [activeTimeline]); // 10 days

    const result = await logComfortRating('tl-1', 2, 'Still adjusting');
    expect(result.success).toBe(true);
    expect(result.supportEscalated).toBe(false);
  });

  it('marks timeline complete at Day 30+', async () => {
    const day30Timeline = {
      ...activeTimeline,
      deliveredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days
    };
    __seed('ComfortTimelines', [day30Timeline]);

    await logComfortRating('tl-1', 5, 'Perfectly broken in');

    const updated = __getUpdated('ComfortTimelines');
    expect(updated[0].status).toBe('complete');
  });

  it('rate-limits per timeline', async () => {
    __seed('ComfortTimelineRateLimit', [{
      _id: 'rl-1',
      key: 'tl-1',
      count: 10,
      windowStart: new Date(),
    }]);

    const result = await logComfortRating('tl-1', 4);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });
});

// ── getTimeline ─────────────────────────────────────────────────────

describe('getTimeline', () => {
  let getTimeline;

  beforeEach(async () => {
    ({ getTimeline } = await import('../src/backend/comfortTimeline.web.js'));
  });

  it('returns timeline with progress and next milestone', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-1',
      orderId: 'order-1',
      memberId: 'member-1',
      productName: 'Royal Sleep',
      deliveredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days
      status: 'active',
      currentDay: 7,
      lastCheckIn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      comfortLogs: JSON.stringify([{ day: 7, rating: 4 }]),
      milestonesCompleted: JSON.stringify([1, 7]),
      crossSellTriggered: false,
      supportEscalated: false,
    }]);

    const result = await getTimeline('order-1');
    expect(result.success).toBe(true);
    expect(result.timeline.currentDay).toBe(10);
    expect(result.timeline.breakInProgress).toBe(33); // 10/30 = 33%
    expect(result.timeline.nextMilestone).toBe(14);
    expect(result.timeline.comfortLogs).toHaveLength(1);
  });

  it('returns error for nonexistent order', async () => {
    const result = await getTimeline('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no comfort timeline/i);
  });

  it('flags cross-sell eligibility at Day 60+', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-2',
      orderId: 'order-2',
      deliveredAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000), // 65 days
      status: 'complete',
      comfortLogs: '[]',
      milestonesCompleted: '[]',
      crossSellTriggered: false,
      supportEscalated: false,
    }]);

    const result = await getTimeline('order-2');
    expect(result.success).toBe(true);
    expect(result.timeline.crossSellEligible).toBe(true);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('constants', () => {
  let _MILESTONES, _COMFORT_CONCERN_THRESHOLD;

  beforeEach(async () => {
    ({ _MILESTONES, _COMFORT_CONCERN_THRESHOLD } = await import('../src/backend/comfortTimeline.web.js'));
  });

  it('defines milestones at days 1, 7, 14, 30, 60', () => {
    expect(_MILESTONES).toEqual([1, 7, 14, 30, 60]);
  });

  it('sets comfort concern threshold at 3', () => {
    expect(_COMFORT_CONCERN_THRESHOLD).toBe(3);
  });
});
