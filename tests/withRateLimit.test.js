/**
 * @file withRateLimit.test.js
 * @description Tests for the rate limit test harness helper (CF-d6ee).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import { withRateLimit, withRateLimits } from './helpers/withRateLimit.js';
import { checkRateLimit } from '../src/backend/utils/rateLimit.js';

beforeEach(() => {
  __reset();
});

describe('withRateLimit', () => {
  it('seeds a rate limit collection so checkRateLimit passes', async () => {
    withRateLimit('TestRateLimit', { key: 'user@test.com' });
    const result = await checkRateLimit('TestRateLimit', 'user@test.com');
    expect(result.allowed).toBe(true);
  });

  it('does not trigger insert when record is pre-seeded', async () => {
    let insertCount = 0;
    const { __onInsert } = await import('./__mocks__/wix-data.js');
    __onInsert((col) => { if (col === 'TestRateLimit') insertCount++; });

    withRateLimit('TestRateLimit', { key: 'user@test.com' });
    await checkRateLimit('TestRateLimit', 'user@test.com');
    expect(insertCount).toBe(0);
  });

  it('blocks when seeded with blocked: true', async () => {
    withRateLimit('TestRateLimit', { key: 'user@test.com', blocked: true, max: 3 });
    const result = await checkRateLimit('TestRateLimit', 'user@test.com', { max: 3 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('rate_limited');
  });

  it('works with default key', async () => {
    withRateLimit('TestRateLimit');
    const result = await checkRateLimit('TestRateLimit', 'test-key');
    expect(result.allowed).toBe(true);
  });
});

describe('withRateLimits', () => {
  it('seeds multiple collections', async () => {
    withRateLimits(['CollA', 'CollB', 'CollC']);

    const a = await checkRateLimit('CollA', 'test-key');
    const b = await checkRateLimit('CollB', 'test-key');
    const c = await checkRateLimit('CollC', 'test-key');

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(true);
  });
});

describe('integration — withRateLimit prevents mock drift', () => {
  it('business query mock is not consumed by rate limit query', async () => {
    withRateLimit('EmailRateLimit', { key: 'test@example.com' });

    // Seed business data AFTER rate limit
    __seed('ProductQuestions', [
      { _id: 'q1', productId: 'prod-1', question: 'Test?', status: 'pending' },
    ]);

    // The rate limit query will hit the seeded rate limit record.
    // The business query will hit the seeded ProductQuestions record.
    // Without withRateLimit, the rate limit query would insert into the
    // rate limit collection, triggering __onInsert callbacks erroneously.
    const result = await checkRateLimit('EmailRateLimit', 'test@example.com');
    expect(result.allowed).toBe(true);
  });
});
