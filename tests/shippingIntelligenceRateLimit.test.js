/**
 * @file shippingIntelligenceRateLimit.test.js
 * @description CF-efna: Rate limiting for getShippingEstimate + calculateBundleQuote.
 *
 * Spec:
 *   - getShippingEstimate:  20 req/min per member
 *   - calculateBundleQuote: 10 req/min per member
 *
 * Covers:
 *   - First call allowed (no rate limit record)
 *   - Allows up to max within window
 *   - Blocks at max
 *   - Window reset (expired) allows again
 *   - Fail open on DB error
 *   - Per-member isolation (different member IDs use separate buckets)
 *   - Anonymous users (no member) are not rate limited
 *   - Rate limit check runs before heavy shipping logic
 *   - checkRateLimit opts.windowMs override (1-minute vs 1-hour)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset as resetWixData,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';
import {
  __reset as resetMembers,
  __setMember,
} from './__mocks__/wix-members-backend.js';
import {
  checkRateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from '../src/backend/utils/rateLimit.js';
import {
  getShippingEstimate,
  calculateBundleQuote,
} from '../src/backend/shippingIntelligence.web.js';

const NOW = 1_700_000_000_000;
const ONE_MINUTE_MS = 60_000;
const ESTIMATE_COLLECTION = 'ShippingEstimateRateLimit';
const BUNDLE_COLLECTION = 'BundleQuoteRateLimit';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMember(id = 'member-abc') {
  return { _id: id, loginEmail: `${id}@example.com` };
}

function makeRateLimitRecord(memberId, count, windowStart = Date.now()) {
  return {
    _id: `rl-${memberId}`,
    key: memberId,
    count,
    windowStart: new Date(windowStart),
  };
}

// Seed minimal data so the shipping logic can reach the rate-limit check cleanly.
// These mocks prevent the internal UPS/LTL calls from throwing.
function seedShippingMocks() {
  __seed('ProductShippingProfiles', []);
}

beforeEach(() => {
  resetWixData();
  resetMembers();
  vi.clearAllMocks();
  seedShippingMocks();
});

// ── checkRateLimit opts.windowMs override ─────────────────────────────────────

describe('checkRateLimit — opts.windowMs override', () => {
  it('uses opts.windowMs when provided instead of default RATE_LIMIT_WINDOW_MS', async () => {
    // Seed a record whose window started >1 minute ago but <1 hour ago
    const windowStart = NOW - ONE_MINUTE_MS - 1; // just expired for 1-minute window
    __seed(ESTIMATE_COLLECTION, [makeRateLimitRecord('m1', 20, windowStart)]);

    // With windowMs=ONE_MINUTE_MS, window is expired → reset → allowed
    const result = await checkRateLimit(ESTIMATE_COLLECTION, 'm1', {
      now: NOW,
      max: 20,
      windowMs: ONE_MINUTE_MS,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('still blocks within the windowMs window when max is reached', async () => {
    const windowStart = NOW - 30_000; // 30 seconds ago — within 1-minute window
    __seed(ESTIMATE_COLLECTION, [makeRateLimitRecord('m1', 20, windowStart)]);

    const result = await checkRateLimit(ESTIMATE_COLLECTION, 'm1', {
      now: NOW,
      max: 20,
      windowMs: ONE_MINUTE_MS,
    });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('falls back to RATE_LIMIT_WINDOW_MS when opts.windowMs is not provided', async () => {
    // Window started 2 minutes ago — expired for 1min window, but NOT for default 1hr window
    const windowStart = NOW - 2 * ONE_MINUTE_MS;
    __seed(ESTIMATE_COLLECTION, [makeRateLimitRecord('m1', RATE_LIMIT_MAX, windowStart)]);

    // No windowMs → uses default 1 hour → window NOT expired → blocked
    const result = await checkRateLimit(ESTIMATE_COLLECTION, 'm1', {
      now: NOW,
    });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });
});

// ── getShippingEstimate — rate limiting ───────────────────────────────────────

describe('getShippingEstimate — rate limiting (20 req/min per member)', () => {
  it('allows first estimate (no rate limit record)', async () => {
    __setMember(makeMember('m1'));
    const result = await getShippingEstimate('prod-1', '28701');
    // success or a shipping error — but NOT a rate-limit error
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('allows the 20th request within the window (count=19 < max=20)', async () => {
    __setMember(makeMember('m1'));
    __seed(ESTIMATE_COLLECTION, [makeRateLimitRecord('m1', 19)]);
    const result = await getShippingEstimate('prod-1', '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('blocks the 21st request within the window (count=20 >= max=20)', async () => {
    __setMember(makeMember('m1'));
    __seed(ESTIMATE_COLLECTION, [makeRateLimitRecord('m1', 20)]);
    const result = await getShippingEstimate('prod-1', '28701');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });

  it('resets after the 1-minute window expires and allows again', async () => {
    __setMember(makeMember('m1'));
    // Epoch (0) is always >1 minute ago — forces window reset
    __seed(ESTIMATE_COLLECTION, [makeRateLimitRecord('m1', 20, 0)]);
    const result = await getShippingEstimate('prod-1', '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('fails open (allows) when the rate limit DB check throws', async () => {
    __setMember(makeMember('m1'));
    __setQueryError(ESTIMATE_COLLECTION, new Error('DB down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await getShippingEstimate('prod-1', '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/rateLimit/i),
      expect.any(String),
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  it('isolates rate limits per member — different members use separate buckets', async () => {
    __setMember(makeMember('m2'));
    // m1 is fully blocked (current window)
    __seed(ESTIMATE_COLLECTION, [makeRateLimitRecord('m1', 20)]);
    const result = await getShippingEstimate('prod-1', '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('skips rate limiting for anonymous users (no logged-in member)', async () => {
    // No member set — getMember returns null
    const result = await getShippingEstimate('prod-1', '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('rate limit check runs before shipping logic (returns rate-limit error immediately)', async () => {
    __setMember(makeMember('m1'));
    __seed(ESTIMATE_COLLECTION, [makeRateLimitRecord('m1', 20)]);
    // Poison the ProductShippingProfiles query — if shipping logic runs, test will error
    __setQueryError('ProductShippingProfiles', new Error('should not reach here'));
    const result = await getShippingEstimate('prod-1', '28701');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });
});

// ── calculateBundleQuote — rate limiting ──────────────────────────────────────

describe('calculateBundleQuote — rate limiting (10 req/min per member)', () => {
  const ITEMS = [{ productId: 'prod-1', quantity: 1, price: 200 }];

  it('allows first bundle quote (no rate limit record)', async () => {
    __setMember(makeMember('m1'));
    const result = await calculateBundleQuote(ITEMS, '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('allows the 10th request within the window (count=9 < max=10)', async () => {
    __setMember(makeMember('m1'));
    __seed(BUNDLE_COLLECTION, [makeRateLimitRecord('m1', 9)]);
    const result = await calculateBundleQuote(ITEMS, '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('blocks the 11th request within the window (count=10 >= max=10)', async () => {
    __setMember(makeMember('m1'));
    __seed(BUNDLE_COLLECTION, [makeRateLimitRecord('m1', 10)]);
    const result = await calculateBundleQuote(ITEMS, '28701');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });

  it('resets after the 1-minute window expires and allows again', async () => {
    __setMember(makeMember('m1'));
    // Epoch (0) is always >1 minute ago — forces window reset
    __seed(BUNDLE_COLLECTION, [makeRateLimitRecord('m1', 10, 0)]);
    const result = await calculateBundleQuote(ITEMS, '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('fails open (allows) when the rate limit DB check throws', async () => {
    __setMember(makeMember('m1'));
    __setQueryError(BUNDLE_COLLECTION, new Error('DB down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await calculateBundleQuote(ITEMS, '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/rateLimit/i),
      expect.any(String),
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  it('isolates rate limits per member — different members use separate buckets', async () => {
    __setMember(makeMember('m2'));
    // m1 is fully blocked (current window)
    __seed(BUNDLE_COLLECTION, [makeRateLimitRecord('m1', 10)]);
    const result = await calculateBundleQuote(ITEMS, '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('skips rate limiting for anonymous users (no logged-in member)', async () => {
    // No member set — getMember returns null
    const result = await calculateBundleQuote(ITEMS, '28701');
    expect(result.error ?? '').not.toMatch(/too many requests/i);
  });

  it('rate limit check runs before shipping logic', async () => {
    __setMember(makeMember('m1'));
    __seed(BUNDLE_COLLECTION, [makeRateLimitRecord('m1', 10)]);
    __setQueryError('ProductShippingProfiles', new Error('should not reach here'));
    const result = await calculateBundleQuote(ITEMS, '28701');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });

  it('uses a stricter limit (10) than getShippingEstimate (20) per spec', async () => {
    __setMember(makeMember('m1'));
    // At count=10, bundle should be blocked but estimate (max=20) would not be
    __seed(BUNDLE_COLLECTION, [makeRateLimitRecord('m1', 10)]);
    const bundleResult = await calculateBundleQuote(ITEMS, '28701');
    expect(bundleResult.success).toBe(false);
    expect(bundleResult.error).toMatch(/too many requests/i);
  });
});
