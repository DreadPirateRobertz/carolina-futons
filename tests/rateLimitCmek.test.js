/**
 * CF-sec1: CMEK compliance tests for rateLimit.js
 *
 * Verifies that bucket keys stored in wixData are hashed (opaque) and never
 * contain plaintext PII such as email addresses. The hash must be deterministic
 * so rate limiting continues to work correctly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getInserted, __onInsert } from './__mocks__/wix-data.js';
import {
  hashRateLimitKey,
  checkRateLimit,
} from '../src/backend/utils/rateLimit.js';

const NOW = 1_700_000_000_000;

beforeEach(() => {
  __reset();
});

// ── hashRateLimitKey ──────────────────────────────────────────────────────────

describe('hashRateLimitKey — CMEK key format', () => {
  it('returns an 8-character lowercase hex string', () => {
    const h = hashRateLimitKey('user@example.com');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic — same input always yields same hash', () => {
    const email = 'jane.doe@carolinafutons.com';
    expect(hashRateLimitKey(email)).toBe(hashRateLimitKey(email));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashRateLimitKey('alice@example.com')).not.toBe(
      hashRateLimitKey('bob@example.com')
    );
  });

  it('never contains "@" — email PII is not present in the hash', () => {
    expect(hashRateLimitKey('user@example.com')).not.toContain('@');
  });

  it('never contains a dot-separated domain segment', () => {
    const h = hashRateLimitKey('user@example.com');
    expect(h).not.toContain('example');
    expect(h).not.toContain('.com');
  });

  it('handles empty string without throwing', () => {
    expect(() => hashRateLimitKey('')).not.toThrow();
    expect(typeof hashRateLimitKey('')).toBe('string');
  });
});

// ── checkRateLimit — stored key is hashed (CMEK) ─────────────────────────────

describe('checkRateLimit — stores hashed key, not plaintext PII', () => {
  it('inserts a hashed key (not the raw email) into the collection', async () => {
    const email = 'customer@example.com';
    const inserted = [];
    __onInsert((col, item) => inserted.push(item));

    await checkRateLimit('TestRateLimit', email, { now: NOW });

    expect(inserted).toHaveLength(1);
    const storedKey = inserted[0].key;
    // Stored key must not be the plaintext email
    expect(storedKey).not.toBe(email);
    expect(storedKey).not.toContain('@');
    // Must be the FNV hash of sanitize(email).toLowerCase()
    expect(storedKey).toBe(hashRateLimitKey(email.toLowerCase()));
  });

  it('same email always maps to the same stored key (rate limit is enforced)', async () => {
    const email = 'repeat@example.com';
    const inserted = [];
    __onInsert((_, item) => inserted.push(item));

    await checkRateLimit('TestRateLimit', email, { now: NOW });
    // Reset spy; next call should query and find existing record (no second insert)
    __onInsert(null);

    const secondResult = await checkRateLimit('TestRateLimit', email, { now: NOW });
    // Should be allowed (count 1 < max 3) and no second insert
    expect(secondResult.allowed).toBe(true);
    expect(inserted).toHaveLength(1);
  });
});
