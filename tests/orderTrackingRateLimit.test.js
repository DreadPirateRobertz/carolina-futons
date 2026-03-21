/**
 * @file orderTrackingRateLimit.test.js
 * @description CF-xqzs: Rate limiting for orderTracking.subscribeToNotifications.
 *
 * Covers:
 *  - checkRateLimit opts.max override (5/hr vs default 3/hr)
 *  - subscribeToNotifications: first call allowed, count increments, blocked at 5,
 *    window reset allows re-subscription, fail-open on DB error, per-email isolation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __onInsert,
  __setQueryError,
} from './__mocks__/wix-data.js';
import {
  checkRateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from '../src/backend/utils/rateLimit.js';
import { subscribeToNotifications } from '../src/backend/orderTracking.web.js';

const NOW = 1_700_000_000_000;
const ONE_HOUR = 60 * 60 * 1000;
const TRACKING_RATE_COLLECTION = 'TrackingRateLimit';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeRateLimitRecord(email, count, windowStart = NOW) {
  return {
    _id: 'rl-tracking-1',
    key: email.toLowerCase(),
    count,
    windowStart: new Date(windowStart),
  };
}

function makeOrder(orderNumber = 'ORD-001', email = 'buyer@example.com') {
  return {
    _id: 'order-id-1',
    number: orderNumber,
    buyerInfo: { email },
  };
}

function makeFulfillment(orderId = 'order-id-1', trackingNumber = '1Z999') {
  return { _id: 'ff-1', orderId, trackingNumber };
}

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── checkRateLimit opts.max override ────────────────────────────────────────

describe('checkRateLimit — opts.max override', () => {
  it('uses opts.max when provided instead of default RATE_LIMIT_MAX', async () => {
    // Seed a record at count = RATE_LIMIT_MAX (3) — would block with default
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('user@example.com', RATE_LIMIT_MAX, NOW)]);
    // With max=5, count=3 is still under limit
    const result = await checkRateLimit(TRACKING_RATE_COLLECTION, 'user@example.com', { now: NOW + 1, max: 5 });
    expect(result).toEqual({ allowed: true });
  });

  it('blocks when count reaches opts.max', async () => {
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('user@example.com', 5, NOW)]);
    const result = await checkRateLimit(TRACKING_RATE_COLLECTION, 'user@example.com', { now: NOW + 1, max: 5 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('allows exactly opts.max - 1 calls (count 4 < max 5)', async () => {
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('user@example.com', 4, NOW)]);
    const result = await checkRateLimit(TRACKING_RATE_COLLECTION, 'user@example.com', { now: NOW + 1, max: 5 });
    expect(result).toEqual({ allowed: true });
  });

  it('falls back to RATE_LIMIT_MAX when opts.max is not provided', async () => {
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('user@example.com', RATE_LIMIT_MAX, NOW)]);
    const result = await checkRateLimit(TRACKING_RATE_COLLECTION, 'user@example.com', { now: NOW + 1 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });
});

// ── subscribeToNotifications rate limiting ───────────────────────────────────

describe('subscribeToNotifications — rate limiting', () => {
  function seedOrderAndFulfillment() {
    __seed('Stores/Orders', [makeOrder()]);
    __seed('Fulfillments', [makeFulfillment()]);
    __seed('TrackingNotifications', []);
  }

  it('allows first subscription (no rate limit record)', async () => {
    seedOrderAndFulfillment();
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com', { now: NOW });
    expect(result.success).toBe(true);
  });

  it('allows up to 5 subscriptions per hour per email', async () => {
    seedOrderAndFulfillment();
    // count=4 — should still allow (4 < 5)
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 4, NOW)]);
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com', { now: NOW + 1 });
    expect(result.success).toBe(true);
  });

  it('blocks the 6th subscription attempt within the hour', async () => {
    seedOrderAndFulfillment();
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 5, NOW)]);
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com', { now: NOW + 1 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });

  it('resets after the 1-hour window expires and allows again', async () => {
    seedOrderAndFulfillment();
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 5, NOW - ONE_HOUR - 1)]);
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com', { now: NOW });
    expect(result.success).toBe(true);
  });

  it('fails open (allows) when the rate limit DB check throws', async () => {
    seedOrderAndFulfillment();
    __setQueryError(TRACKING_RATE_COLLECTION, new Error('DB down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com', { now: NOW });
    expect(result.success).toBe(true);
    warnSpy.mockRestore();
  });

  it('isolates rate limits per email — different emails not blocked by same count', async () => {
    __seed('Stores/Orders', [
      makeOrder('ORD-001', 'buyer1@example.com'),
      makeOrder('ORD-002', 'buyer2@example.com'),
    ]);
    __seed('Fulfillments', [makeFulfillment()]);
    __seed('TrackingNotifications', []);
    // buyer1 is blocked
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer1@example.com', 5, NOW)]);
    // buyer2 should not be blocked
    const result = await subscribeToNotifications('ORD-002', 'buyer2@example.com', { now: NOW + 1 });
    expect(result.success).toBe(true);
  });

  it('rate limit check uses lowercase-normalized email key', async () => {
    seedOrderAndFulfillment();
    // Seed rate limit record with lowercase key
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 5, NOW)]);
    // Call with mixed-case email — should hit the same rate limit bucket
    const result = await subscribeToNotifications('ORD-001', 'BUYER@EXAMPLE.COM', { now: NOW + 1 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });

  it('rate limit applies before order lookup (rejected before DB writes)', async () => {
    // No order seeded — if rate limit runs first, should return rate_limited, not order-not-found
    __seed('Stores/Orders', []);
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 5, NOW)]);
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com', { now: NOW + 1 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });
});
