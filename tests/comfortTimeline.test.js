/**
 * @file comfortTimeline.test.js
 * @description CF-256r: Tests for Comfort Timeline — mattress break-in tracker.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted, __getUpdated, __setUpdateError, __setQueryError, __setInsertError } from './__mocks__/wix-data.js';
import { hashRateLimitKey } from '../src/backend/utils/rateLimit.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setMember, __reset as __resetMember } from './__mocks__/wix-members-backend.js';

beforeEach(() => {
  __reset();
  __resetSecrets();
  __resetMember();
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

  it('returns error response when wix-data insert throws', async () => {
    __setInsertError('ComfortTimelines', new Error('DB unavailable'));
    const result = await createTimeline({
      orderId: 'ord-x',
      memberId: 'mem-x',
      productId: 'prod-x',
      productName: 'Test',
      deliveredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to create/i);
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
      key: hashRateLimitKey('tl-1'),
      count: 10,
      windowStart: new Date(),
    }]);

    const result = await logComfortRating('tl-1', 4);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('returns error response when wix-data throws during rating log', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-err',
      memberId: 'm1',
      status: 'active',
      comfortLogs: '[]',
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    }]);
    __setUpdateError('ComfortTimelines', new Error('DB unavailable'));
    const result = await logComfortRating('tl-err', 3);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to log/i);
  });

  it('rejects invalid timelineId format', async () => {
    const result = await logComfortRating('tl invalid!', 3);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/valid timeline id required/i);
  });

  it('returns error when timeline not found', async () => {
    // Nothing seeded — get() returns null
    const result = await logComfortRating('tl-missing', 3);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timeline not found/i);
  });

  it('rejects inactive (completed) timeline', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-done',
      memberId: 'm1',
      status: 'complete',
      comfortLogs: '[]',
      deliveredAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    }]);
    const result = await logComfortRating('tl-done', 4);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no longer active/i);
  });

  it('does not re-escalate when already escalated', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-esc',
      memberId: 'm1',
      status: 'active',
      comfortLogs: '[]',
      supportEscalated: true, // already escalated
      deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days
    }]);
    const result = await logComfortRating('tl-esc', 2, 'Still hurting');
    expect(result.success).toBe(true);
    expect(result.supportEscalated).toBe(true);
    // supportEscalated flag stays true but the update should NOT re-set it
    const updated = __getUpdated('ComfortTimelines');
    expect(updated[0].supportEscalated).toBe(true);
  });

  it('handles comfortLogs with invalid JSON gracefully', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-badjson',
      memberId: 'm1',
      status: 'active',
      comfortLogs: 'not valid json',
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    }]);
    const result = await logComfortRating('tl-badjson', 4);
    expect(result.success).toBe(true);
  });

  it('rejects non-numeric rating type', async () => {
    // Covers typeof rating !== 'number' branch (line 131)
    const result = await logComfortRating('tl-1', 'great');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/between 1 and 5/i);
  });

  it('returns milestone 0 when rated on delivery day (day 0)', async () => {
    // Covers the `?? 0` fallback on line 183 when no milestone <= daysSinceDelivery
    __seed('ComfortTimelines', [{
      _id: 'tl-day0',
      memberId: 'm1',
      status: 'active',
      comfortLogs: '[]',
      supportEscalated: false,
      deliveredAt: new Date(), // today — 0 days elapsed
    }]);
    const result = await logComfortRating('tl-day0', 4);
    expect(result.success).toBe(true);
    expect(result.milestone).toBe(0);
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

  it('returns error response when wix-data throws during getTimeline', async () => {
    __setQueryError('ComfortTimelines', new Error('DB unavailable'));
    const result = await getTimeline('order-x');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to load comfort timeline/i);
  });

  it('reports crossSellEligible as false when already triggered', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-cs',
      orderId: 'order-cs',
      deliveredAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
      status: 'complete',
      comfortLogs: '[]',
      milestonesCompleted: '[]',
      crossSellTriggered: true,
      supportEscalated: false,
    }]);
    const result = await getTimeline('order-cs');
    expect(result.success).toBe(true);
    expect(result.timeline.crossSellEligible).toBe(false);
  });

  it('returns nextMilestone as null when delivery is beyond Day 60', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-late',
      orderId: 'order-late',
      deliveredAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000), // 70 days
      status: 'complete',
      comfortLogs: '[]',
      milestonesCompleted: '[]',
      crossSellTriggered: false,
      supportEscalated: false,
    }]);
    const result = await getTimeline('order-late');
    expect(result.success).toBe(true);
    expect(result.timeline.nextMilestone).toBeNull();
  });

  it('reports needsCheckIn as false when recently checked in', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-ci',
      orderId: 'order-ci',
      deliveredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days
      status: 'active',
      currentDay: 9, // almost same as days since delivery
      lastCheckIn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      comfortLogs: '[]',
      milestonesCompleted: '[]',
      crossSellTriggered: false,
      supportEscalated: false,
    }]);
    const result = await getTimeline('order-ci');
    expect(result.success).toBe(true);
    expect(result.timeline.needsCheckIn).toBe(false);
  });

  it('returns error when orderId is not provided', async () => {
    // Covers the !orderId early-return branch (line 206)
    const result = await getTimeline('');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/order id required/i);
  });

  it('uses 0 as currentDay default when field is absent (needsCheckIn ?? branch)', async () => {
    // Covers (timeline.currentDay ?? 0) when currentDay is not stored on the record
    __seed('ComfortTimelines', [{
      _id: 'tl-noday',
      orderId: 'order-noday',
      deliveredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days
      status: 'active',
      // currentDay intentionally omitted → ?? 0 fires → daysSinceDelivery(10) > 0+6=6 → needsCheckIn=true
      lastCheckIn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      comfortLogs: '[]',
      milestonesCompleted: '[]',
      crossSellTriggered: false,
      supportEscalated: false,
    }]);
    const result = await getTimeline('order-noday');
    expect(result.success).toBe(true);
    // daysSinceDelivery(~10) > (undefined ?? 0) + 6 = 6 → needsCheckIn is true
    expect(result.timeline.needsCheckIn).toBe(true);
  });
});

// ── processMilestones ───────────────────────────────────────────────

describe('processMilestones', () => {
  let processMilestones;
  const CRON = 'test-cron-secret';

  beforeEach(async () => {
    ({ processMilestones } = await import('../src/backend/comfortTimeline.web.js'));
    __setSecrets({ CRON_SECRET: CRON });
  });

  it('rejects wrong cron secret', async () => {
    const result = await processMilestones('bad-secret');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authentication failed/i);
  });

  it('rejects missing cron secret', async () => {
    const result = await processMilestones(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authentication failed/i);
  });

  it('returns success with zero counts when no active timelines exist', async () => {
    const result = await processMilestones(CRON);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.notifications).toBe(0);
  });

  it('discovers and marks new milestones for a timeline', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-1',
      memberId: 'mem-1',
      productId: 'prod-1',
      deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      status: 'active',
      milestonesCompleted: JSON.stringify([1]), // day-1 already done
    }]);

    const result = await processMilestones(CRON);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.notifications).toBe(1); // day-7 milestone fires

    const updated = __getUpdated('ComfortTimelines');
    expect(updated).toHaveLength(1);
    const milestones = JSON.parse(updated[0].milestonesCompleted);
    expect(milestones).toContain(7);
  });

  it('skips update when all milestones are already completed', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-1',
      deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      status: 'active',
      milestonesCompleted: JSON.stringify([1, 7]),
    }]);

    const result = await processMilestones(CRON);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.notifications).toBe(0);
    expect(__getUpdated('ComfortTimelines')).toHaveLength(0);
  });

  it('auto-completes timeline at Day 30+', async () => {
    __seed('ComfortTimelines', [{
      _id: 'tl-1',
      deliveredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
      status: 'active',
      milestonesCompleted: '[]',
    }]);

    await processMilestones(CRON);

    const updated = __getUpdated('ComfortTimelines');
    expect(updated[0].status).toBe('complete');
  });

  it('skips timeline with invalid deliveredAt without throwing', async () => {
    __seed('ComfortTimelines', [
      { _id: 'tl-bad', deliveredAt: 'not-a-date', status: 'active', milestonesCompleted: '[]' },
      { _id: 'tl-ok', deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), status: 'active', milestonesCompleted: '[]' },
    ]);

    const result = await processMilestones(CRON);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1); // only tl-ok processed; tl-bad was skipped
  });

  it('continues processing remaining timelines after per-item error', async () => {
    __seed('ComfortTimelines', [
      { _id: 'tl-err', deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), status: 'active', milestonesCompleted: '[]' },
      { _id: 'tl-ok', deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), status: 'active', milestonesCompleted: '[]' },
    ]);
    __setUpdateError('ComfortTimelines', new Error('DB write failed'));

    // Should not throw even though the update fails
    const result = await processMilestones(CRON);
    expect(result.success).toBe(true);
  });

  it('returns failure when secret store is unreachable', async () => {
    __resetSecrets(); // clears CRON_SECRET → getSecret throws
    const result = await processMilestones(CRON);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/milestone processing failed/i);
  });
});

// ── getMyTimelines ──────────────────────────────────────────────────

describe('getMyTimelines', () => {
  let getMyTimelines;

  beforeEach(async () => {
    ({ getMyTimelines } = await import('../src/backend/comfortTimeline.web.js'));
  });

  it('returns not-logged-in error when no member session exists', async () => {
    // __resetMember leaves _currentMember = null → getMember resolves null
    const result = await getMyTimelines();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not logged in');
  });

  it('returns empty timelines for logged-in member with no records', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await getMyTimelines();
    expect(result.success).toBe(true);
    expect(result.timelines).toEqual([]);
  });

  it('maps timeline fields correctly including daysSinceDelivery and breakInProgress', async () => {
    const deliveredAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
    __setMember({ _id: 'mem-2' });
    __seed('ComfortTimelines', [
      {
        _id: 'tl-1',
        memberId: 'mem-2',
        orderId: 'ord-99',
        productName: 'Eureka Mattress',
        status: 'active',
        deliveredAt,
        lastCheckIn: null,
        currentDay: 7,
        comfortLogs: JSON.stringify([{ rating: 4 }]),
      },
    ]);

    const result = await getMyTimelines();
    expect(result.success).toBe(true);
    expect(result.timelines).toHaveLength(1);
    const tl = result.timelines[0];
    expect(tl.id).toBe('tl-1');
    expect(tl.orderId).toBe('ord-99');
    expect(tl.productName).toBe('Eureka Mattress');
    expect(tl.status).toBe('active');
    expect(tl.currentDay).toBeGreaterThanOrEqual(6);
    expect(tl.breakInProgress).toBeGreaterThan(0);
    expect(tl.breakInProgress).toBeLessThanOrEqual(100);
    expect(tl.lastRating).toBe(4);
    expect(tl.needsCheckIn).toBe(true); // no lastCheckIn
  });

  it('sets lastRating to null when comfortLogs is empty', async () => {
    const deliveredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    __setMember({ _id: 'mem-3' });
    __seed('ComfortTimelines', [
      { _id: 'tl-2', memberId: 'mem-3', orderId: 'ord-2', productName: 'P', status: 'active', deliveredAt, comfortLogs: null },
    ]);

    const result = await getMyTimelines();
    expect(result.timelines[0].lastRating).toBeNull();
  });

  it('caps breakInProgress at 100 for timelines beyond Day 30', async () => {
    const deliveredAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
    __setMember({ _id: 'mem-4' });
    __seed('ComfortTimelines', [
      { _id: 'tl-3', memberId: 'mem-4', orderId: 'ord-3', productName: 'P', status: 'active', deliveredAt, comfortLogs: [] },
    ]);

    const result = await getMyTimelines();
    expect(result.timelines[0].breakInProgress).toBe(100);
  });

  it('returns error response when wix-data throws', async () => {
    __setMember({ _id: 'mem-5' });
    __setQueryError('ComfortTimelines', new Error('DB down'));

    const result = await getMyTimelines();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to load timelines');
  });

  it('needsCheckIn is false when member has a recent check-in within 6 days', async () => {
    const deliveredAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    __setMember({ _id: 'mem-6' });
    __seed('ComfortTimelines', [{
      _id: 'tl-ci',
      memberId: 'mem-6',
      orderId: 'ord-ci',
      productName: 'Comfort Mattress',
      status: 'active',
      deliveredAt,
      lastCheckIn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      currentDay: 9, // delivery was 10 days ago; 10 > 9+6=15 is false → needsCheckIn=false
      comfortLogs: JSON.stringify([{ rating: 4 }]),
    }]);

    const result = await getMyTimelines();
    expect(result.success).toBe(true);
    expect(result.timelines[0].needsCheckIn).toBe(false);
  });

  it('lastRating is null when last log entry has no rating field', async () => {
    const deliveredAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    __setMember({ _id: 'mem-7' });
    __seed('ComfortTimelines', [{
      _id: 'tl-norating',
      memberId: 'mem-7',
      orderId: 'ord-nr',
      productName: 'Test',
      status: 'active',
      deliveredAt,
      comfortLogs: JSON.stringify([{ day: 3, notes: 'no rating field' }]),
    }]);

    const result = await getMyTimelines();
    expect(result.success).toBe(true);
    expect(result.timelines[0].lastRating).toBeNull();
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
