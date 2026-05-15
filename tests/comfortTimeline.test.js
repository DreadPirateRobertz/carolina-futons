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
