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

const NOW = 1_700_000_000_000; // fixed clock for checkRateLimit direct tests
const TRACKING_RATE_COLLECTION = 'TrackingRateLimit';

// ── Fixtures ────────────────────────────────────────────────────────────────

// Use Date.now() for "within current window" — checkRateLimit reads Date.now() internally.
// Use epoch (0) for "window already expired" — guaranteed >1 hour in the past.
function makeRateLimitRecord(email, count, windowStart = Date.now()) {
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

  it('opts.max = 0 blocks immediately (count 0 >= max 0)', async () => {
    // count=0 existing record — max=0 means no calls allowed
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('user@example.com', 0, NOW)]);
    const result = await checkRateLimit(TRACKING_RATE_COLLECTION, 'user@example.com', { now: NOW + 1, max: 0 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });
});

// ── subscribeToNotifications rate limiting ───────────────────────────────────
//
// subscribeToNotifications accepts no opts — clock is not injectable from the
// caller to prevent anonymous rate-limit bypass via now manipulation.
// Tests control window state by seeding records with real timestamps:
//   - Date.now()  → within the current window
//   - new Date(0) → epoch (always > 1 hour ago → window expired)

describe('subscribeToNotifications — rate limiting', () => {
  function seedOrderAndFulfillment() {
    __seed('Stores/Orders', [makeOrder()]);
    __seed('Fulfillments', [makeFulfillment()]);
    __seed('TrackingNotifications', []);
  }

  it('allows first subscription (no rate limit record)', async () => {
    seedOrderAndFulfillment();
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com');
    expect(result.success).toBe(true);
  });

  it('allows up to 5 subscriptions per hour per email (count=4 < max)', async () => {
    seedOrderAndFulfillment();
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 4)]);
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com');
    expect(result.success).toBe(true);
  });

  it('blocks when count has reached 5 within the current window', async () => {
    seedOrderAndFulfillment();
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 5)]);
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });

  it('resets after the 1-hour window expires and allows again', async () => {
    seedOrderAndFulfillment();
    // new Date(0) is epoch — guaranteed > 1 hour ago, forcing a window reset
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 5, 0)]);
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com');
    expect(result.success).toBe(true);
  });

  it('fails open (allows) when the rate limit DB check throws, and still persists the subscription', async () => {
    seedOrderAndFulfillment();
    __setQueryError(TRACKING_RATE_COLLECTION, new Error('DB down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let insertedCollection, insertedItem;
    __onInsert((col, item) => { insertedCollection = col; insertedItem = item; });
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com');
    expect(result.success).toBe(true);
    expect(insertedCollection).toBe('TrackingNotifications');
    expect(insertedItem.email).toBe('buyer@example.com');
    warnSpy.mockRestore();
  });

  it('isolates rate limits per email — different emails not blocked by same count', async () => {
    __seed('Stores/Orders', [
      makeOrder('ORD-001', 'buyer1@example.com'),
      makeOrder('ORD-002', 'buyer2@example.com'),
    ]);
    __seed('Fulfillments', [makeFulfillment()]);
    __seed('TrackingNotifications', []);
    // buyer1 is blocked (current window)
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer1@example.com', 5)]);
    // buyer2 should not be blocked
    const result = await subscribeToNotifications('ORD-002', 'buyer2@example.com');
    expect(result.success).toBe(true);
  });

  it('rate limit check uses lowercase-normalized email key', async () => {
    seedOrderAndFulfillment();
    // Seed rate limit record with lowercase key (current window)
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 5)]);
    // Call with mixed-case email — should hit the same rate limit bucket
    const result = await subscribeToNotifications('ORD-001', 'BUYER@EXAMPLE.COM');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });

  it('rate limit applies before order lookup (rejected before unnecessary DB reads)', async () => {
    // No order seeded — if rate limit runs first, returns rate-limit error, not order-not-found
    __seed('Stores/Orders', []);
    __seed(TRACKING_RATE_COLLECTION, [makeRateLimitRecord('buyer@example.com', 5)]);
    const result = await subscribeToNotifications('ORD-001', 'buyer@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });
});
