/**
 * @file newsletterRateLimit.test.js
 * @description Tests for server-side rate limiting and honeypot protection
 * added to newsletterService.web.js (CF-r2xj).
 *
 * Covers:
 *  - _checkRateLimit: first call, window reset, counting, enforcement, fail-open
 *  - subscribeToNewsletter: honeypot bypass, rate limit enforcement
 *  - captureExitIntentEmail: honeypot bypass, rate limit enforcement
 */

import { describe, it, expect } from 'vitest';
import { __seed, __onInsert, __setQueryError } from './__mocks__/wix-data.js';
import {
  _checkRateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  subscribeToNewsletter,
  captureExitIntentEmail,
} from '../src/backend/newsletterService.web.js';

// Note: no vi.mock() needed — vitest.config.js resolve.alias auto-redirects
// all wix-* imports to tests/__mocks__/wix-*.js, and setup.js resets state
// before each test via __reset().

const NOW = 1_700_000_000_000; // fixed timestamp

function makeRateLimitRecord(count, windowStart = NOW) {
  return { _id: 'rl-1', key: 'test@example.com', count, windowStart: new Date(windowStart) };
}

function seedSubscriber(email = 'test@example.com') {
  __seed('NewsletterSubscribers', [{ _id: 'sub-1', email }]);
}

function seedEmailQueue(email = 'test@example.com') {
  __seed('EmailQueue', [{
    _id: 'eq-1',
    recipientEmail: email,
    sequenceType: 'welcome',
    sequenceStep: 1,
  }]);
}

// ── _checkRateLimit ───────────────────────────────────────────────────────────

describe('_checkRateLimit', () => {
  it('allows first call for new key', async () => {
    const result = await _checkRateLimit('new@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('allows call within window when count is below max', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX - 1, NOW)]);
    const result = await _checkRateLimit('test@example.com', { now: NOW + 1000 });
    expect(result).toEqual({ allowed: true });
  });

  it('blocks call when count reaches RATE_LIMIT_MAX within window', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW)]);
    const result = await _checkRateLimit('test@example.com', { now: NOW + 1000 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('resets counter when window has expired', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS - 1)]);
    const result = await _checkRateLimit('test@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('counts up to RATE_LIMIT_MAX - 1 correctly', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX - 2, NOW)]);
    const result = await _checkRateLimit('test@example.com', { now: NOW + 1 });
    expect(result.allowed).toBe(true);
  });

  it('normalizes key to lowercase — uppercase key creates separate bucket', async () => {
    // Seeded record has lowercase key; uppercase input lowercases too → finds it
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW)]);
    // 'TEST@EXAMPLE.COM' lowercases to 'test@example.com' → matches seeded record → blocked
    const result = await _checkRateLimit('TEST@EXAMPLE.COM', { now: NOW + 1 });
    expect(result.allowed).toBe(false);
  });

  it('fails open when DB query throws', async () => {
    __setQueryError('NewsletterRateLimit', new Error('DB down'));
    const result = await _checkRateLimit('test@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('window boundary — just expired allows (age > window)', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS - 1)]);
    const result = await _checkRateLimit('test@example.com', { now: NOW });
    expect(result.allowed).toBe(true);
  });

  it('window boundary — not yet expired blocks (age < window)', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS + 1)]);
    const result = await _checkRateLimit('test@example.com', { now: NOW });
    expect(result.allowed).toBe(false);
  });

  it('window boundary — exactly expired blocks (age === window is still within)', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS)]);
    // windowAge = RATE_LIMIT_WINDOW_MS; condition is > not >= so NOT expired → blocks
    const result = await _checkRateLimit('test@example.com', { now: NOW });
    expect(result.allowed).toBe(false);
  });
});

// ── subscribeToNewsletter — honeypot ─────────────────────────────────────────

describe('subscribeToNewsletter — honeypot', () => {
  it('returns silent success when honeypot field is truthy', async () => {
    const result = await subscribeToNewsletter('bot@evil.com', { honeypot: 'filled' });
    expect(result).toEqual({ success: true, discountCode: 'WELCOME10' });
  });

  it('does not insert any record when honeypot fires', async () => {
    let insertCount = 0;
    __onInsert(() => { insertCount++; });
    await subscribeToNewsletter('bot@evil.com', { honeypot: '1' });
    expect(insertCount).toBe(0);
  });

  it('does not consume rate limit quota for honeypot submissions', async () => {
    let rateLimitInserts = 0;
    __onInsert((collection) => {
      if (collection === 'NewsletterRateLimit') rateLimitInserts++;
    });
    await subscribeToNewsletter('bot@evil.com', { honeypot: 'x' });
    expect(rateLimitInserts).toBe(0);
  });

  it('passes through when honeypot value is empty string (falsy)', async () => {
    const result = await subscribeToNewsletter('real@example.com', { honeypot: '' });
    expect(result.success).toBe(true);
  });

  it('passes through when honeypot key is absent', async () => {
    const result = await subscribeToNewsletter('real@example.com', {});
    expect(result.success).toBe(true);
  });
});

// ── subscribeToNewsletter — rate limiting ────────────────────────────────────

describe('subscribeToNewsletter — rate limiting', () => {
  it('allows new email subscription on first attempt', async () => {
    const result = await subscribeToNewsletter('first@example.com', { now: NOW });
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('blocks subscription when rate limit exceeded for that email', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW)]);
    const result = await subscribeToNewsletter('test@example.com', { now: NOW + 1000 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many requests/i);
  });

  it('does not insert subscriber record when rate limited', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW)]);
    let subscriberInserts = 0;
    __onInsert((collection) => {
      if (collection === 'NewsletterSubscribers') subscriberInserts++;
    });
    await subscribeToNewsletter('test@example.com', { now: NOW + 1000 });
    expect(subscriberInserts).toBe(0);
  });

  it('existing subscribers bypass rate limit and return success', async () => {
    seedSubscriber('test@example.com');
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW)]);
    const result = await subscribeToNewsletter('test@example.com', { now: NOW + 1000 });
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('rate limit resets after window expiry and allows subscription', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS - 1)]);
    const result = await subscribeToNewsletter('test@example.com', { now: NOW });
    expect(result.success).toBe(true);
  });

  it('rate limit check does not run for existing subscribers', async () => {
    seedSubscriber('test@example.com');
    let rateLimitHits = 0;
    __onInsert((collection) => {
      if (collection === 'NewsletterRateLimit') rateLimitHits++;
    });
    await subscribeToNewsletter('test@example.com', { now: NOW });
    // No rate limit record should be inserted (dedup exits early)
    expect(rateLimitHits).toBe(0);
  });
});

// ── captureExitIntentEmail — honeypot ────────────────────────────────────────

describe('captureExitIntentEmail — honeypot', () => {
  it('returns silent success with queued=0 when honeypot fires', async () => {
    const result = await captureExitIntentEmail('bot@evil.com', { honeypot: 'filled' });
    expect(result).toEqual({ success: true, discountCode: 'WELCOME10', queued: 0 });
  });

  it('does not insert EmailQueue records when honeypot fires', async () => {
    let insertCount = 0;
    __onInsert(() => { insertCount++; });
    await captureExitIntentEmail('bot@evil.com', { honeypot: '1' });
    expect(insertCount).toBe(0);
  });

  it('passes through when honeypot is empty string (falsy)', async () => {
    const result = await captureExitIntentEmail('real@example.com', { honeypot: '' });
    expect(result.success).toBe(true);
    expect(result.queued).toBeGreaterThan(0);
  });
});

// ── captureExitIntentEmail — rate limiting ───────────────────────────────────

describe('captureExitIntentEmail — rate limiting', () => {
  it('blocks queue insertion when rate limit exceeded', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW)]);
    const result = await captureExitIntentEmail('test@example.com', { now: NOW + 1000 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many requests/i);
  });

  it('does not insert EmailQueue records when rate limited', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW)]);
    let emailQueueInserts = 0;
    __onInsert((collection) => {
      if (collection === 'EmailQueue') emailQueueInserts++;
    });
    await captureExitIntentEmail('test@example.com', { now: NOW + 1000 });
    expect(emailQueueInserts).toBe(0);
  });

  it('already-queued emails bypass rate limit and return success', async () => {
    seedEmailQueue('test@example.com');
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW)]);
    const result = await captureExitIntentEmail('test@example.com', { now: NOW + 1000 });
    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
  });

  it('allows submission after window reset', async () => {
    __seed('NewsletterRateLimit', [makeRateLimitRecord(RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS - 1)]);
    const result = await captureExitIntentEmail('test@example.com', { now: NOW });
    expect(result.success).toBe(true);
    expect(result.queued).toBeGreaterThan(0);
  });

  it('queues 3 welcome series steps for valid new submission', async () => {
    const result = await captureExitIntentEmail('new@example.com', { now: NOW });
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });

  it('already-queued emails do not consume rate limit quota', async () => {
    seedEmailQueue('test@example.com');
    let rateLimitHits = 0;
    __onInsert((collection) => {
      if (collection === 'NewsletterRateLimit') rateLimitHits++;
    });
    await captureExitIntentEmail('test@example.com', { now: NOW });
    expect(rateLimitHits).toBe(0);
  });
});
