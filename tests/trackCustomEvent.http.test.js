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

  // cf-lsat: aliases via EVENT_NAME_MAP must canonicalize on the HTTP path.
  // Pre-cf-lsat, the wrapper sanitized inline (regex only) and skipped the
  // alias map — so a cfw caller sending "quiz_start" landed it raw instead
  // of "quiz_started". Now the wrapper delegates to the webMethod, which
  // applies EVENT_NAME_MAP.
  it.each([
    ['quiz_start', 'quiz_started'],
    ['quiz_complete', 'quiz_completed'],
    ['email_captured', 'quiz_lead_captured'],
    ['swatch_request', 'swatch_requested'],
    ['spin_wheel', 'spin_played'],
    ['compare_add', 'compare_started'],
  ])('canonicalizes alias %s → %s via EVENT_NAME_MAP', async (alias, canonical) => {
    await post_trackCustomEvent(
      makeRequest(veloBody(alias, { source: 'test' })),
    );
    const [row] = __getInserted('AnalyticsEvents');
    expect(row.eventType).toBe(canonical);
  });

  // cf-lsat: source defaults to the event's category from CUSTOM_EVENTS
  // (e.g. quiz_started → quiz) when params.source is absent. Falls back to
  // 'custom' only when neither a category mapping nor a params.source exists.
  it('auto-categorises source from CUSTOM_EVENTS when params has no source', async () => {
    await post_trackCustomEvent(
      makeRequest(veloBody('quiz_started', {})),
    );
    const [row] = __getInserted('AnalyticsEvents');
    expect(row.source).toBe('quiz');
  });

  it('defaults source to "custom" for events outside CUSTOM_EVENTS taxonomy', async () => {
    await post_trackCustomEvent(
      makeRequest(veloBody('one_off_smoke_test', {})),
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
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    // cf-gkgo: distinguish error modes — missing event name has its own code
    expect(body.error).toBe('missing_event_name');
  });

  it('returns 400 when eventName is empty string', async () => {
    const res = await post_trackCustomEvent(makeRequest(veloBody('', { source: 'winback' })));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('missing_event_name');
  });

  it('returns 400 when eventName is not a string', async () => {
    const res = await post_trackCustomEvent(makeRequest({ args: [42, {}] }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('missing_event_name');
  });

  it('returns 400 with error: invalid_json when body JSON is invalid', async () => {
    const req = {
      body: { json: async () => { throw new SyntaxError('Bad JSON'); } },
      headers: {},
    };
    const res = await post_trackCustomEvent(req);
    expect(res.status).toBe(400);
    // cf-gkgo: parse failure was previously indistinguishable from
    // missing-args; now carries its own code so client can branch on retry
    // (server-class) vs surface-error (client-class).
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('returns 400 with error: invalid_event_name when name sanitises to empty', async () => {
    // Pure punctuation collapses to '' after the [^a-zA-Z0-9_] strip.
    const res = await post_trackCustomEvent(makeRequest(veloBody('!!!---', { source: 'winback' })));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_event_name');
  });

  it('treats missing params arg as empty object (no crash)', async () => {
    const res = await post_trackCustomEvent(makeRequest({ args: ['winback_landing_view'] }));
    expect(res.status).toBe(200);
  });

  it('returns 400 with error: payload_too_large when params payload exceeds 8 KB', async () => {
    const large = { source: 'winback', data: 'x'.repeat(9000) };
    const res = await post_trackCustomEvent(makeRequest(veloBody('winback_landing_view', large)));
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('payload_too_large');
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('post_trackCustomEvent — rate limiting', () => {
  it('returns 429 with error: rate_limited when rate limit is exceeded for the source', async () => {
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
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    // cf-gkgo: rate-limit errors are now self-describing
    expect(body.error).toBe('rate_limited');
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
