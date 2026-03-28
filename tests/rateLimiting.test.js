/**
 * @file rateLimiting.test.js
 * @description CF-nj5b: Rate limiting tests for:
 *  - promotionsEngine applyPromoCode: 10 attempts/hour per key (_checkPromoRateLimit)
 *  - contactSubmissions submitContactForm: 3 submissions/hour per email (_checkContactRateLimit)
 *
 * Covers:
 *  - First call allowed (new key)
 *  - Count increments correctly up to max
 *  - Blocked at limit within window
 *  - Window expiry resets counter
 *  - Fail-open on DB error
 *  - End-to-end: rate-limited response from webMethod
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __onInsert, __setQueryError } from './__mocks__/wix-data.js';

import {
  _checkPromoRateLimit,
  applyPromoCode,
} from '../src/backend/promotionsEngine.web.js';

import {
  _checkContactRateLimit,
  submitContactForm,
} from '../src/backend/contactSubmissions.web.js';

const NOW = 1_700_000_000_000;
const ONE_HOUR = 60 * 60 * 1000;

function makePromoRecord(count, windowStart = NOW) {
  return { _id: 'pr-1', key: 'test-ip', count, windowStart: new Date(windowStart) };
}

function makeContactRecord(count, windowStart = NOW) {
  return { _id: 'cr-1', key: 'test@example.com', count, windowStart: new Date(windowStart) };
}

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── _checkPromoRateLimit ───────────────────────────────────────────────────────

describe('_checkPromoRateLimit', () => {
  it('allows first call for a new key', async () => {
    const result = await _checkPromoRateLimit('new-ip', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('allows calls below the 10-attempt limit within the window', async () => {
    __seed('PromoRateLimits', [makePromoRecord(9, NOW)]);
    const result = await _checkPromoRateLimit('test-ip', { now: NOW + 1000 });
    expect(result).toEqual({ allowed: true });
  });

  it('blocks the 11th call when count is at RATE_LIMIT_MAX (10) within window', async () => {
    __seed('PromoRateLimits', [makePromoRecord(10, NOW)]);
    const result = await _checkPromoRateLimit('test-ip', { now: NOW + 1000 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('resets counter when window has expired (>1 hour old)', async () => {
    __seed('PromoRateLimits', [makePromoRecord(10, NOW - ONE_HOUR - 1)]);
    const result = await _checkPromoRateLimit('test-ip', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('does not reset counter when window has not yet expired', async () => {
    __seed('PromoRateLimits', [makePromoRecord(10, NOW - ONE_HOUR + 1000)]);
    const result = await _checkPromoRateLimit('test-ip', { now: NOW });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('fails open (allows) when wixData query throws', async () => {
    __setQueryError('PromoRateLimits', new Error('DB unavailable'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await _checkPromoRateLimit('test-ip', { now: NOW });
    expect(result).toEqual({ allowed: true });
    warnSpy.mockRestore();
  });

  it('uses key as-is (for IP tokens, not lowercased like email)', async () => {
    __seed('PromoRateLimits', [{ _id: 'pr-2', key: '192.168.1.1', count: 10, windowStart: new Date(NOW) }]);
    const result = await _checkPromoRateLimit('192.168.1.1', { now: NOW + 1 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });
});

// ── applyPromoCode — rate limit integration ────────────────────────────────────

describe('applyPromoCode — rate limiting', () => {
  const validCart = [{ _id: 'item-1', price: 100, quantity: 1 }];

  it('returns rate-limit error when limit exceeded', async () => {
    __seed('PromoRateLimits', [makePromoRecord(10, NOW)]);
    const result = await applyPromoCode('SAVE10', validCart, {
      rateLimitKey: 'test-ip',
      rateLimitNow: NOW + 1,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('allows request when under rate limit', async () => {
    __seed('PromoCodes', [{
      _id: 'pc-1',
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      isActive: true,
      usesCount: 0,
      maxUses: 0,
      minSubtotal: 0,
      applicableCategories: '',
      applicableProducts: '',
    }]);
    __seed('PromoRateLimits', [makePromoRecord(5, NOW)]);
    const result = await applyPromoCode('SAVE10', validCart, {
      rateLimitKey: 'test-ip',
      rateLimitNow: NOW + 1,
    });
    // Rate check passes (5 < 10); promo lookup happens
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('uses anonymous key when rateLimitKey is not provided', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('PromoCodes', []);

    await applyPromoCode('BADCODE', validCart);

    const rlInserts = inserted.filter(i => i.col === 'PromoRateLimits');
    expect(rlInserts).toHaveLength(1);
    expect(rlInserts[0].item.key).toBe('anonymous');
  });
});

// ── _checkContactRateLimit ─────────────────────────────────────────────────────

describe('_checkContactRateLimit', () => {
  it('allows first submission for a new email', async () => {
    const result = await _checkContactRateLimit('new@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('allows second and third submission within window (below limit of 3)', async () => {
    __seed('ContactRateLimits', [makeContactRecord(2, NOW)]);
    const result = await _checkContactRateLimit('test@example.com', { now: NOW + 1000 });
    expect(result).toEqual({ allowed: true });
  });

  it('blocks the 4th submission when count is at RATE_LIMIT_MAX (3) within window', async () => {
    __seed('ContactRateLimits', [makeContactRecord(3, NOW)]);
    const result = await _checkContactRateLimit('test@example.com', { now: NOW + 1000 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('resets counter when window has expired (>1 hour old)', async () => {
    __seed('ContactRateLimits', [makeContactRecord(3, NOW - ONE_HOUR - 1)]);
    const result = await _checkContactRateLimit('test@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('normalizes key to lowercase', async () => {
    __seed('ContactRateLimits', [makeContactRecord(3, NOW)]);
    // Uppercase input lowercases to match seeded record → blocked
    const result = await _checkContactRateLimit('TEST@EXAMPLE.COM', { now: NOW + 1 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('fails open (allows) when wixData query throws', async () => {
    __setQueryError('ContactRateLimits', new Error('DB unavailable'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await _checkContactRateLimit('test@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
    warnSpy.mockRestore();
  });
});

// ── submitContactForm — rate limit integration ─────────────────────────────────

describe('submitContactForm — rate limiting', () => {
  const validData = { email: 'user@example.com', source: 'contact_page' };

  it('returns silent success (not an error) when rate limited', async () => {
    __seed('ContactRateLimits', [makeContactRecord(3, NOW)]);
    const result = await submitContactForm(
      { ...validData, email: 'test@example.com' },
      { rateLimitNow: NOW + 1 }
    );
    // Silent success — does not reveal rate limiting to caller
    expect(result).toEqual({ success: true });
  });

  it('allows submission and inserts to CMS when under rate limit', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('ContactRateLimits', [makeContactRecord(1, NOW)]);

    const result = await submitContactForm(validData, { rateLimitNow: NOW + 1 });

    expect(result.success).toBe(true);
    const submissions = inserted.filter(i => i.col === 'ContactSubmissions');
    expect(submissions).toHaveLength(1);
    expect(submissions[0].item.email).toBe('user@example.com');
  });

  it('does not insert to CMS when rate limited', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('ContactRateLimits', [makeContactRecord(3, NOW)]);

    await submitContactForm(
      { ...validData, email: 'test@example.com' },
      { rateLimitNow: NOW + 1 }
    );

    const submissions = inserted.filter(i => i.col === 'ContactSubmissions');
    expect(submissions).toHaveLength(0);
  });

  it('still rejects missing email before rate limit check', async () => {
    const result = await submitContactForm({});
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/email/i);
  });
});
