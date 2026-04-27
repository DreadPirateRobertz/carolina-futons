/**
 * @file trackCustomEvent.http.test.js
 * @description TDD tests for POST /_functions/trackCustomEvent — HTTP wrapper
 * that lets the cfw Next.js host log analytics events to the AnalyticsEvents
 * collection. The customEvents/trackCustomEvent webMethod is unreachable from
 * external callers; this endpoint is the callable entry point.
 *
 * cf-3qt.5.3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __getInserted } from './__mocks__/wix-data.js';
import { hashRateLimitKey } from '../src/backend/utils/rateLimit.js';
import { post_trackCustomEvent, options_trackCustomEvent } from '../src/backend/http-functions.js';

function makeRequest(body = {}) {
  return {
    body: { json: async () => body },
    headers: { origin: 'https://carolina-futons-web.vercel.app' },
  };
}

// callVelo sends { args: [eventName, params] }
function veloBody(eventName, params = {}) {
  return { args: [eventName, params] };
}

beforeEach(() => {
  resetData();
  __seed('CustomEventRateLimit', []);
  __seed('AnalyticsEvents', []);
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('post_trackCustomEvent — success', () => {
  it('returns 200 with success:true on valid event', async () => {
    const res = await post_trackCustomEvent(
      makeRequest(veloBody('winback_landing_view', { source: 'winback', utm_source: 'email' })),
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });

  it('inserts an AnalyticsEvents row with normalized eventType and source', async () => {
    await post_trackCustomEvent(
      makeRequest(veloBody('winback_landing_view', { source: 'winback', utm_source: 'email' })),
    );
    const inserted = __getInserted('AnalyticsEvents');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      eventType: 'winback_landing_view',
      source: 'winback',
    });
  });

  it('normalizes dots and hyphens in event names to underscores', async () => {
    await post_trackCustomEvent(
      makeRequest(veloBody('winback-landing.view', { source: 'winback' })),
    );
    const [row] = __getInserted('AnalyticsEvents');
    expect(row.eventType).toBe('winback_landing_view');
  });

  it('defaults source to "custom" when params has no source', async () => {
    await post_trackCustomEvent(
      makeRequest(veloBody('quiz_started', {})),
    );
    const [row] = __getInserted('AnalyticsEvents');
    expect(row.source).toBe('custom');
  });

  it('passes memberId from params to insertAnalyticsEvent', async () => {
    await post_trackCustomEvent(
      makeRequest(veloBody('loyalty_enrolled', { source: 'loyalty', memberId: 'mem-abc' })),
    );
    const [row] = __getInserted('AnalyticsEvents');
    expect(row.memberId).toBe('mem-abc');
  });

  it('sets memberId to null when not provided in params', async () => {
    await post_trackCustomEvent(makeRequest(veloBody('winback_landing_view', { source: 'winback' })));
    const [row] = __getInserted('AnalyticsEvents');
    expect(row.memberId).toBeNull();
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('post_trackCustomEvent — validation', () => {
  it('returns 400 when args array is missing', async () => {
    const res = await post_trackCustomEvent(makeRequest({}));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('returns 400 when eventName is empty string', async () => {
    const res = await post_trackCustomEvent(makeRequest(veloBody('', { source: 'winback' })));
    expect(res.status).toBe(400);
  });

  it('returns 400 when eventName is not a string', async () => {
    const res = await post_trackCustomEvent(makeRequest({ args: [42, {}] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body JSON is invalid', async () => {
    const req = {
      body: { json: async () => { throw new SyntaxError('Bad JSON'); } },
      headers: {},
    };
    const res = await post_trackCustomEvent(req);
    expect(res.status).toBe(400);
  });

  it('treats missing params arg as empty object (no crash)', async () => {
    const res = await post_trackCustomEvent(makeRequest({ args: ['winback_landing_view'] }));
    expect(res.status).toBe(200);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('post_trackCustomEvent — rate limiting', () => {
  it('returns 429 when rate limit is exceeded for the source', async () => {
    const key = hashRateLimitKey('winback');
    __seed('CustomEventRateLimit', [{
      _id: 'rl-winback',
      key,
      count: 30,
      windowStart: new Date(Date.now() - 10_000),
    }]);
    const res = await post_trackCustomEvent(
      makeRequest(veloBody('winback_landing_view', { source: 'winback' })),
    );
    expect(res.status).toBe(429);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('allows the request when rate limit count is below max', async () => {
    const key = hashRateLimitKey('winback');
    __seed('CustomEventRateLimit', [{
      _id: 'rl-winback',
      key,
      count: 15,
      windowStart: new Date(Date.now() - 10_000),
    }]);
    const res = await post_trackCustomEvent(
      makeRequest(veloBody('winback_landing_view', { source: 'winback' })),
    );
    expect(res.status).toBe(200);
  });
});

// ── CORS preflight ────────────────────────────────────────────────────────────

describe('options_trackCustomEvent', () => {
  it('returns a response (CORS preflight)', async () => {
    const res = await options_trackCustomEvent({
      headers: { origin: 'https://carolina-futons-web.vercel.app' },
    });
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
