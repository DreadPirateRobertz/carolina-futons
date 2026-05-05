/**
 * @file silentFailureHardening.cfgkgo.test.js
 * @description cf-gkgo — silent-failure cleanup pass. Covers the HTTP-wrapper
 * error-classification work that's hard to exercise through the existing
 * end-to-end test surface because the underlying webMethods only emit one
 * error code in practice. Uses vi.mock to stub the webMethod / data layer so
 * we can verify the HTTP wrapper's full classification matrix.
 *
 * Three endpoints:
 *   - get_activeChallenges  — generalised error → status mapping
 *   - post_notifyMe         — outer-catch errorId for log↔response correlation
 *
 * trackCustomEvent error-mode distinctions are tested in
 * tests/trackCustomEvent.http.test.js (the existing test file already has the
 * fixture surface needed; cf-gkgo extended those tests rather than duplicating).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── activeChallenges: stub the imported webMethod so we can drive arbitrary
// error envelopes through the HTTP wrapper.

vi.mock('../src/backend/gamificationEventReceiver.web.js', () => ({
  receiveGamificationEvent: vi.fn(),
  getActiveChallenges: vi.fn(),
  recordChallengeProgress: vi.fn(),
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }) },
}));

import { get_activeChallenges, post_notifyMe } from '../src/backend/http-functions.js';
import { getActiveChallenges as _getActiveChallengesWebMethod } from '../src/backend/gamificationEventReceiver.web.js';

const makeRequest = (memberId) => ({
  query: { memberId },
  headers: {},
});

describe('cf-gkgo · get_activeChallenges error classification', () => {
  beforeEach(() => {
    vi.mocked(_getActiveChallengesWebMethod).mockReset();
  });

  it('returns 401 when webMethod emits error: "auth_required"', async () => {
    // The webMethod surfaces this when a stale session sneaks past
    // Permissions.SiteMember (cf-1y7). Pre-cf-gkgo the HTTP wrapper passed
    // it through as 200 with an error envelope, hiding auth failures from
    // monitoring + retry logic.
    vi.mocked(_getActiveChallengesWebMethod).mockResolvedValue({
      challenges: [],
      error: 'auth_required',
    });
    const res = await get_activeChallenges(makeRequest('mem-1'));
    expect(res.status).toBe(401);
    expect(JSON.parse(res.body).error).toBe('auth_required');
  });

  it('returns 503 when webMethod emits a known internal_error', async () => {
    // Regression on cf-9lp.1.
    vi.mocked(_getActiveChallengesWebMethod).mockResolvedValue({
      challenges: [],
      error: 'internal_error',
    });
    const res = await get_activeChallenges(makeRequest('mem-1'));
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body).error).toBe('internal_error');
  });

  it('returns 503 fail-loud for an unknown / future server-class error code', async () => {
    // The whole point of cf-gkgo: don't silently 200 just because the
    // webMethod added a new error string we didn't anticipate.
    vi.mocked(_getActiveChallengesWebMethod).mockResolvedValue({
      challenges: [],
      error: 'db_timeout',
    });
    const res = await get_activeChallenges(makeRequest('mem-1'));
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body).error).toBe('db_timeout');
  });

  it('returns 200 OK on the no-error envelope (success path preserved)', async () => {
    vi.mocked(_getActiveChallengesWebMethod).mockResolvedValue({ challenges: [] });
    const res = await get_activeChallenges(makeRequest('mem-1'));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.error).toBeUndefined();
    expect(body.challenges).toEqual([]);
  });
});

// ── notifyMe: outer-catch errorId

vi.mock('wix-data', () => ({
  default: { insert: vi.fn() },
}));

import wixData from 'wix-data';

describe('cf-gkgo · post_notifyMe outer-catch errorId', () => {
  beforeEach(() => {
    vi.mocked(wixData.insert).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeNotifyRequest = (body) => ({
    body: {
      text: async () => JSON.stringify(body),
      json: async () => body,
    },
    headers: { origin: 'https://carolina-futons-web.vercel.app' },
  });

  it('returns 500 with errorId when wixData.insert throws', async () => {
    vi.mocked(wixData.insert).mockRejectedValue(new Error('NotifyMe collection unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await post_notifyMe(makeNotifyRequest({
      email: 'shopper@example.com',
      productId: 'prod-123',
      source: 'pdp',
    }));

    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('server_error');
    // Must be a non-empty correlation ID (UUID or fallback).
    expect(typeof body.errorId).toBe('string');
    expect(body.errorId.length).toBeGreaterThan(0);

    // The same errorId must appear in the server log for correlation.
    const loggedCalls = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(loggedCalls).toContain(body.errorId);

    consoleErr.mockRestore();
  });

  it('does not leak an errorId on the success path', async () => {
    vi.mocked(wixData.insert).mockResolvedValue({ _id: 'nm-1' });
    const res = await post_notifyMe(makeNotifyRequest({
      email: 'shopper@example.com',
      productId: 'prod-123',
    }));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.errorId).toBeUndefined();
  });
});
