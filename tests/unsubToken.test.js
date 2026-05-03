import { describe, it, expect, vi } from 'vitest';
import {
  signUnsubToken,
  verifyUnsubToken,
  buildUnsubscribeUrl,
  UNSUB_TOKEN_TTL_MS,
} from '../src/backend/utils/unsubToken.js';

// ── signUnsubToken ───────────────────────────────────────────────────────────

describe('signUnsubToken — structure', () => {
  it('returns a dot-delimited string with exactly two parts', async () => {
    const token = await signUnsubToken('user@example.com', 'all', 'test-secret');
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
  });

  it('payload part decodes to an object with email, seq, exp', async () => {
    const token = await signUnsubToken('user@example.com', 'welcome', 'test-secret');
    const [payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    expect(payload.email).toBe('user@example.com');
    expect(payload.seq).toBe('welcome');
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('expiry is ~30 days from now', async () => {
    const before = Date.now();
    const token = await signUnsubToken('user@example.com', 'all', 'test-secret');
    const [payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const expectedExpMs = before + UNSUB_TOKEN_TTL_MS;
    // Allow 2s drift
    expect(payload.exp * 1000).toBeGreaterThanOrEqual(expectedExpMs - 2000);
    expect(payload.exp * 1000).toBeLessThanOrEqual(expectedExpMs + 2000);
  });

  it('different emails produce different tokens', async () => {
    const t1 = await signUnsubToken('a@example.com', 'all', 'secret');
    const t2 = await signUnsubToken('b@example.com', 'all', 'secret');
    expect(t1).not.toBe(t2);
  });

  it('same inputs with same secret produce identical tokens (deterministic except time)', async () => {
    // Sign at same epoch second — both tokens should match
    const now = Math.floor(Date.now() / 1000);
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const t1 = await signUnsubToken('x@example.com', 'all', 'secret');
    const t2 = await signUnsubToken('x@example.com', 'all', 'secret');
    vi.restoreAllMocks();
    expect(t1).toBe(t2);
  });
});

// ── verifyUnsubToken ─────────────────────────────────────────────────────────

describe('verifyUnsubToken — valid token', () => {
  it('returns { email, seq } for a freshly signed token', async () => {
    const token = await signUnsubToken('user@example.com', 'all', 'test-secret');
    const result = await verifyUnsubToken(token, 'test-secret');
    expect(result).not.toBeNull();
    expect(result.email).toBe('user@example.com');
    expect(result.seq).toBe('all');
  });

  it('works for any sequence type', async () => {
    for (const seq of ['welcome', 'reengagement', 'winback', 'all']) {
      const token = await signUnsubToken('u@e.com', seq, 's');
      const result = await verifyUnsubToken(token, 's');
      expect(result?.seq).toBe(seq);
    }
  });
});

describe('verifyUnsubToken — invalid / tampered tokens', () => {
  it('returns null for wrong secret', async () => {
    const token = await signUnsubToken('user@example.com', 'all', 'real-secret');
    const result = await verifyUnsubToken(token, 'wrong-secret');
    expect(result).toBeNull();
  });

  it('returns null for tampered payload', async () => {
    const token = await signUnsubToken('user@example.com', 'all', 'test-secret');
    const [, sig] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ email: 'attacker@evil.com', seq: 'all', exp: 9999999999 })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${sig}`;
    const result = await verifyUnsubToken(tamperedToken, 'test-secret');
    expect(result).toBeNull();
  });

  it('returns null for expired token', async () => {
    const expiredExp = Math.floor(Date.now() / 1000) - 1;
    const payload = Buffer.from(JSON.stringify({ email: 'u@e.com', seq: 'all', exp: expiredExp })).toString('base64url');
    // Sign the expired payload with real secret
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', 'test-secret').update(payload).digest('base64url');
    const result = await verifyUnsubToken(`${payload}.${sig}`, 'test-secret');
    expect(result).toBeNull();
  });

  it('returns null for malformed token (no dot)', async () => {
    const result = await verifyUnsubToken('notavalidtoken', 'secret');
    expect(result).toBeNull();
  });

  it('returns null for empty string', async () => {
    const result = await verifyUnsubToken('', 'secret');
    expect(result).toBeNull();
  });

  it('returns null for non-JSON payload', async () => {
    const { createHmac } = await import('node:crypto');
    const payload = Buffer.from('not-json!!').toString('base64url');
    const sig = createHmac('sha256', 'secret').update(payload).digest('base64url');
    const result = await verifyUnsubToken(`${payload}.${sig}`, 'secret');
    expect(result).toBeNull();
  });
});

// ── buildUnsubscribeUrl ──────────────────────────────────────────────────────

describe('buildUnsubscribeUrl', () => {
  it('returns a URL containing the signed token', async () => {
    const url = await buildUnsubscribeUrl('user@example.com', 'all', 'secret');
    expect(url).toMatch(/^https:\/\/www\.carolinafutons\.com\/_functions\/unsubscribe\?token=/);
    const token = new URL(url).searchParams.get('token');
    const result = await verifyUnsubToken(token, 'secret');
    expect(result?.email).toBe('user@example.com');
  });
});
