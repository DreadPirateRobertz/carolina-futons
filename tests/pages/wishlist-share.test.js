/**
 * Wishlist Share — pure helper unit tests (CF-y24r S1)
 * Tests: token parsing, invalid message builder
 */
import { describe, it, expect } from 'vitest';
import {
  parseShareToken,
  buildInvalidMessage,
} from '../../src/public/wishlistShareHelpers.js';

// ── parseShareToken ────────────────────────────────────────────────────────────

describe('parseShareToken', () => {
  it('returns token string from query.share', () => {
    expect(parseShareToken({ share: 'abc123' })).toBe('abc123');
  });

  it('returns null when share param is absent', () => {
    expect(parseShareToken({})).toBeNull();
  });

  it('returns null when query is null', () => {
    expect(parseShareToken(null)).toBeNull();
  });

  it('returns null when query is undefined', () => {
    expect(parseShareToken(undefined)).toBeNull();
  });

  it('trims leading and trailing whitespace', () => {
    expect(parseShareToken({ share: '  tok1  ' })).toBe('tok1');
  });

  it('returns null for whitespace-only share value', () => {
    expect(parseShareToken({ share: '   ' })).toBeNull();
  });

  it('returns null for empty string share value', () => {
    expect(parseShareToken({ share: '' })).toBeNull();
  });

  it('preserves internal token characters (hyphens, underscores)', () => {
    expect(parseShareToken({ share: 'tok-001_abc' })).toBe('tok-001_abc');
  });
});

// ── buildInvalidMessage ────────────────────────────────────────────────────────

describe('buildInvalidMessage', () => {
  it('missing_token: returns a message about no share link', () => {
    const msg = buildInvalidMessage('missing_token');
    expect(msg).toContain('No wishlist link');
  });

  it('not_found: returns a message about the link not being found', () => {
    const msg = buildInvalidMessage('not_found');
    expect(msg.toLowerCase()).toContain('not found');
  });

  it('expired: returns a message mentioning expiration', () => {
    const msg = buildInvalidMessage('expired');
    expect(msg.toLowerCase()).toContain('expired');
  });

  it('unknown reason: returns a non-empty fallback string', () => {
    const msg = buildInvalidMessage('something_weird');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('all messages are non-empty strings', () => {
    for (const reason of ['missing_token', 'not_found', 'expired', 'error']) {
      const msg = buildInvalidMessage(reason);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});
