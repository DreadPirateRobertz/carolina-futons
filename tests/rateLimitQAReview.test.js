/**
 * @file rateLimitQAReview.test.js
 * @description Tests for rate limiting on productQA.insertGuestQuestion and
 * dataService.submitReview (CF-3t9f).
 *
 * Covers:
 *  - checkRateLimit util: first call, counting, window reset, enforcement, fail-open
 *  - insertGuestQuestion: email required, invalid email rejected, rate limit enforced,
 *    valid submission passes, case-insensitive email key
 *  - submitReview: rate limit enforced per customerEmail, valid submission passes,
 *    window reset allows re-submission
 */

import { describe, it, expect } from 'vitest';
import { __seed, __setQueryError } from './__mocks__/wix-data.js';
import {
  checkRateLimit,
  hashRateLimitKey,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from '../src/backend/utils/rateLimit.js';
import { insertGuestQuestion } from '../src/backend/productQA.web.js';
import { submitReview } from '../src/backend/dataService.web.js';
import { reviewRequests } from './fixtures/engagement.js';

const NOW = 1_700_000_000_000;
const COLLECTION_QA = 'QARateLimit';
const COLLECTION_REVIEW = 'ReviewRateLimit';

function makeRateLimitRecord(collection, email, count, windowStart = NOW) {
  return { _id: `rl-${collection}-1`, key: hashRateLimitKey(email.toLowerCase()), count, windowStart: new Date(windowStart) };
}

// ── checkRateLimit utility ────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows first call for a new key', async () => {
    const result = await checkRateLimit(COLLECTION_QA, 'new@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('allows call when count is below RATE_LIMIT_MAX within window', async () => {
    __seed(COLLECTION_QA, [makeRateLimitRecord(COLLECTION_QA, 'test@example.com', RATE_LIMIT_MAX - 1, NOW)]);
    const result = await checkRateLimit(COLLECTION_QA, 'test@example.com', { now: NOW + 1000 });
    expect(result).toEqual({ allowed: true });
  });

  it('blocks when count reaches RATE_LIMIT_MAX within window', async () => {
    __seed(COLLECTION_QA, [makeRateLimitRecord(COLLECTION_QA, 'test@example.com', RATE_LIMIT_MAX, NOW)]);
    const result = await checkRateLimit(COLLECTION_QA, 'test@example.com', { now: NOW + 1000 });
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('resets counter when window has expired', async () => {
    __seed(COLLECTION_QA, [makeRateLimitRecord(COLLECTION_QA, 'test@example.com', RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS - 1)]);
    const result = await checkRateLimit(COLLECTION_QA, 'test@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('normalizes key to lowercase — uppercase email matches lowercase record', async () => {
    __seed(COLLECTION_QA, [makeRateLimitRecord(COLLECTION_QA, 'test@example.com', RATE_LIMIT_MAX, NOW)]);
    const result = await checkRateLimit(COLLECTION_QA, 'TEST@EXAMPLE.COM', { now: NOW + 1 });
    expect(result.allowed).toBe(false);
  });

  it('fails open when DB query throws', async () => {
    __setQueryError(COLLECTION_QA, new Error('DB down'));
    const result = await checkRateLimit(COLLECTION_QA, 'test@example.com', { now: NOW });
    expect(result).toEqual({ allowed: true });
  });

  it('window boundary — just expired (age > window) allows', async () => {
    __seed(COLLECTION_QA, [makeRateLimitRecord(COLLECTION_QA, 'test@example.com', RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS - 1)]);
    const result = await checkRateLimit(COLLECTION_QA, 'test@example.com', { now: NOW });
    expect(result.allowed).toBe(true);
  });

  it('window boundary — not yet expired (age < window) blocks', async () => {
    __seed(COLLECTION_QA, [makeRateLimitRecord(COLLECTION_QA, 'test@example.com', RATE_LIMIT_MAX, NOW - RATE_LIMIT_WINDOW_MS + 1)]);
    const result = await checkRateLimit(COLLECTION_QA, 'test@example.com', { now: NOW });
    expect(result.allowed).toBe(false);
  });

  it('isolates buckets by collection — QARateLimit and ReviewRateLimit are independent', async () => {
    __seed(COLLECTION_REVIEW, [makeRateLimitRecord(COLLECTION_REVIEW, 'test@example.com', RATE_LIMIT_MAX, NOW)]);
    // QARateLimit has no record for this email — should allow
    const result = await checkRateLimit(COLLECTION_QA, 'test@example.com', { now: NOW + 1 });
    expect(result.allowed).toBe(true);
  });
});

// ── insertGuestQuestion rate limiting ─────────────────────────────────────────
// Note: _opts is intentionally absent from the webMethod to prevent clock
// injection by anonymous callers. Tests drive state via __seed() instead.

describe('insertGuestQuestion — rate limiting', () => {
  const validParams = {
    productId: 'prod-frame-001',
    question: 'What is the weight limit for this futon frame?',
    memberName: 'Guest User',
    email: 'guest@example.com',
  };

  // Seed a rate-limit record with windowStart in the recent past (within window)
  function seedMaxed(collection, email) {
    __seed(collection, [{
      _id: 'rl-1', key: hashRateLimitKey(email.toLowerCase()), count: RATE_LIMIT_MAX,
      windowStart: new Date(Date.now() - 1000), // 1s ago — well within 1-hour window
    }]);
  }

  // Seed an expired rate-limit record (window has passed)
  function seedExpired(collection, email) {
    __seed(collection, [{
      _id: 'rl-1', key: hashRateLimitKey(email.toLowerCase()), count: RATE_LIMIT_MAX,
      windowStart: new Date(Date.now() - RATE_LIMIT_WINDOW_MS - 5000), // expired
    }]);
  }

  it('requires a valid email', async () => {
    const result = await insertGuestQuestion({ ...validParams, email: '' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects invalid email format', async () => {
    const result = await insertGuestQuestion({ ...validParams, email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('allows submission when under rate limit', async () => {
    const result = await insertGuestQuestion(validParams);
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('_id');
  });

  it('blocks submission when rate limit is exceeded', async () => {
    seedMaxed(COLLECTION_QA, validParams.email);
    const result = await insertGuestQuestion(validParams);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('treats email case-insensitively for rate limit key', async () => {
    seedMaxed(COLLECTION_QA, 'guest@example.com');
    const result = await insertGuestQuestion({ ...validParams, email: 'GUEST@EXAMPLE.COM' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('allows submission again after rate limit window resets', async () => {
    seedExpired(COLLECTION_QA, validParams.email);
    const result = await insertGuestQuestion(validParams);
    expect(result.success).toBe(true);
  });

  it('still validates productId even with valid email', async () => {
    const result = await insertGuestQuestion({ ...validParams, productId: '' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/product/i);
  });

  it('still validates question length even with valid email', async () => {
    const result = await insertGuestQuestion({ ...validParams, question: 'Short?' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/10 characters/i);
  });
});

// ── submitReview rate limiting ────────────────────────────────────────────────
// Note: _opts removed from webMethod. Tests seed ReviewRateLimit state directly.

describe('submitReview — rate limiting', () => {
  beforeEach(() => {
    __seed('ReviewRequests', reviewRequests);
  });

  function seedMaxed(email) {
    __seed(COLLECTION_REVIEW, [{
      _id: 'rl-rev-1', key: hashRateLimitKey(email.toLowerCase()), count: RATE_LIMIT_MAX,
      windowStart: new Date(Date.now() - 1000),
    }]);
  }

  function seedExpired(email) {
    __seed(COLLECTION_REVIEW, [{
      _id: 'rl-rev-1', key: hashRateLimitKey(email.toLowerCase()), count: RATE_LIMIT_MAX,
      windowStart: new Date(Date.now() - RATE_LIMIT_WINDOW_MS - 5000),
    }]);
  }

  it('allows submission when under rate limit', async () => {
    const result = await submitReview('rev-001', 4, 'Great futon!');
    expect(result.success).toBe(true);
  });

  it('blocks submission when rate limit exceeded for customer email', async () => {
    // rev-001 has customerEmail 'jane@example.com'
    seedMaxed('jane@example.com');
    const result = await submitReview('rev-001', 4, 'Great futon!');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('allows submission after rate limit window resets', async () => {
    seedExpired('jane@example.com');
    const result = await submitReview('rev-001', 4, 'Great futon!');
    expect(result.success).toBe(true);
  });

  it('independent customers have independent rate limit buckets', async () => {
    // Block jane but allow bob (rev-002 has customerEmail 'bob@example.com')
    seedMaxed('jane@example.com');
    const result = await submitReview('rev-002', 5, 'Very comfy!');
    expect(result.success).toBe(true);
  });
});
