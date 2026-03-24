/**
 * @file busEvent.http.test.js
 * @description TDD tests for POST /_functions/busEvent — cross-rig event bus inbound endpoint.
 * Handles mobile→web events: streak_extended, challenge_started, redemption_initiated.
 * CF-44r / CF-va8 (auth hardening: x-bus-secret → Wix session Bearer token)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __getInserted } from './__mocks__/wix-data.js';
import { __reset as resetMembers, __setMember } from './__mocks__/wix-members-backend.js';
import { post_busEvent } from '../src/backend/http-functions.js';

const VALID_MEMBER = { _id: 'mem-1', loginEmail: 'member@example.com' };

function makeRequest(body = {}) {
  return {
    body: { json: async () => body },
  };
}

function validBody(overrides = {}) {
  return {
    eventId: 'evt-uuid-001',
    schemaVersion: '1.0',
    traceId: 'trace_abc123',
    event: 'streak_extended',
    userId: 'mem-1',
    source: 'mobile',
    ts: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

beforeEach(() => {
  resetData();
  resetMembers();
  __seed('EventTraceLog', []);
});

// ── Authentication ─────────────────────────────────────────────────────────────

describe('post_busEvent — authentication', () => {
  it('returns 401 when no member session is present', async () => {
    // resetMembers() leaves no authenticated member
    const result = await post_busEvent(makeRequest(validBody()));
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).error).toMatch(/unauthorized/i);
  });

  it('returns 401 when getMember() throws (e.g. expired token)', async () => {
    const { currentMember } = await import('wix-members-backend');
    currentMember.getMember.mockRejectedValueOnce(new Error('token expired'));
    const result = await post_busEvent(makeRequest(validBody()));
    expect(result.status).toBe(401);
  });

  it('allows request when member session is valid', async () => {
    __setMember(VALID_MEMBER);
    const result = await post_busEvent(makeRequest(validBody()));
    expect(result.status).toBe(200);
  });
});

// ── Identity resolution ────────────────────────────────────────────────────────

describe('post_busEvent — server-side identity', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('uses session memberId in EventTraceLog, ignoring payload.userId', async () => {
    // payload claims a different userId — server must ignore it
    const result = await post_busEvent(makeRequest(validBody({ userId: 'attacker-id' })));
    expect(result.status).toBe(200);
    const logs = __getInserted('EventTraceLog');
    expect(logs[0].userId).toBe('mem-1'); // resolved from session, not payload
  });
});

// ── Validation ─────────────────────────────────────────────────────────────────

describe('post_busEvent — validation', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns 400 when eventId is missing', async () => {
    const result = await post_busEvent(makeRequest(validBody({ eventId: undefined })));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/eventId/i);
  });

  it('returns 400 when schemaVersion is missing', async () => {
    const result = await post_busEvent(makeRequest(validBody({ schemaVersion: undefined })));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/schemaVersion/i);
  });

  it('returns 400 when schemaVersion is not 1.0', async () => {
    const result = await post_busEvent(makeRequest(validBody({ schemaVersion: '2.0' })));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/schemaVersion/i);
  });

  it('returns 400 when event name is unknown', async () => {
    const result = await post_busEvent(makeRequest(validBody({ event: 'unknown_event' })));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/event/i);
  });

  it('returns 400 when userId is missing', async () => {
    const result = await post_busEvent(makeRequest(validBody({ userId: undefined })));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/userId/i);
  });

  it('returns 400 on invalid JSON body', async () => {
    const result = await post_busEvent({
      body: { json: async () => { throw new Error('parse error'); } },
    });
    expect(result.status).toBe(400);
  });
});

// ── Inbound events ─────────────────────────────────────────────────────────────

describe('post_busEvent — streak_extended', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns 200 and logs to EventTraceLog', async () => {
    const result = await post_busEvent(makeRequest(validBody({ event: 'streak_extended' })));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.received).toBe(true);

    const logs = __getInserted('EventTraceLog');
    expect(logs.length).toBeGreaterThan(0);
    const log = logs[0];
    expect(log.traceId).toBe('trace_abc123');
    expect(log.event).toBe('streak_extended');
    expect(log.status).toBe('received');
    expect(log.userId).toBe('mem-1');
  });
});

describe('post_busEvent — challenge_started', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns 200 and logs to EventTraceLog', async () => {
    const body = validBody({ event: 'challenge_started', challengeId: 'ch-1' });
    const result = await post_busEvent(makeRequest(body));
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).received).toBe(true);

    const logs = __getInserted('EventTraceLog');
    expect(logs[0].event).toBe('challenge_started');
    expect(logs[0].status).toBe('received');
  });
});

describe('post_busEvent — redemption_initiated', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns 200 and logs to EventTraceLog', async () => {
    const body = validBody({ event: 'redemption_initiated', rewardId: 'rwd-1' });
    const result = await post_busEvent(makeRequest(body));
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).received).toBe(true);

    const logs = __getInserted('EventTraceLog');
    expect(logs[0].event).toBe('redemption_initiated');
    expect(logs[0].status).toBe('received');
  });
});

describe('post_busEvent — EventTraceLog deduplication', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('does not insert a duplicate log for the same eventId', async () => {
    const body = validBody({ eventId: 'dupe-evt-1', event: 'streak_extended' });
    __seed('EventTraceLog', [{
      _id: 'dupe-evt-1',
      eventId: 'dupe-evt-1',
      traceId: 'trace_abc123',
      event: 'streak_extended',
      status: 'received',
    }]);

    const result = await post_busEvent(makeRequest(body));
    expect(result.status).toBe(200);
    // No additional insert — still just the seeded 1
    const logs = __getInserted('EventTraceLog');
    expect(logs).toHaveLength(1);
  });
});

// ── EventTraceLog includes userId and source (review fix) ─────────────────────

describe('post_busEvent — EventTraceLog captures userId and source', () => {
  it('stores userId and source from body in the trace log', async () => {
    const body = validBody({ userId: 'mem-trace-1', source: 'mobile' });
    const result = await post_busEvent(makeRequest(body));
    expect(result.status).toBe(200);

    const logs = __getInserted('EventTraceLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe('mem-trace-1');
    expect(logs[0].source).toBe('mobile');
  });
});

// ── Rate limiting (review fix) ────────────────────────────────────────────────

describe('post_busEvent — rate limiting', () => {
  it('returns 429 after exceeding 30 requests per minute from the same userId', async () => {
    // Seed the rate limit collection as if the window is already maxed out
    __seed('BusEventRateLimit', [{
      _id: 'rl-1',
      key: 'mem-rl-1',
      count: 30,
      windowStart: new Date(Date.now() - 1000), // within the window
    }]);

    const result = await post_busEvent(makeRequest(validBody({ userId: 'mem-rl-1' })));
    expect(result.status).toBe(429);
  });

  it('allows requests when under the rate limit', async () => {
    const result = await post_busEvent(makeRequest(validBody({ userId: 'mem-rl-2' })));
    expect(result.status).toBe(200);
  });
});
