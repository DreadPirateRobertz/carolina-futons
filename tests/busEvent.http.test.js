/**
 * @file busEvent.http.test.js
 * @description TDD tests for POST /_functions/busEvent — cross-rig event bus inbound endpoint.
 * Handles mobile→web events: streak_extended, challenge_started, redemption_initiated.
 * CF-44r
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __getInserted } from './__mocks__/wix-data.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { post_busEvent } from '../src/backend/http-functions.js';

const BUS_SECRET = 'test-bus-secret-xyz';

function makeRequest(body = {}, headers = {}) {
  return {
    headers: { 'x-bus-secret': BUS_SECRET, ...headers },
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
  resetSecrets();
  __setSecrets({ BUS_SECRET });
});

// ── Authentication ─────────────────────────────────────────────────────────────

describe('post_busEvent — authentication', () => {
  it('returns 403 when x-bus-secret header is missing', async () => {
    const result = await post_busEvent({
      headers: {},
      body: { json: async () => validBody() },
    });
    expect(result.status).toBe(403);
  });

  it('returns 403 when x-bus-secret is wrong', async () => {
    const result = await post_busEvent({
      headers: { 'x-bus-secret': 'wrong-secret' },
      body: { json: async () => validBody() },
    });
    expect(result.status).toBe(403);
  });
});

// ── Validation ─────────────────────────────────────────────────────────────────

describe('post_busEvent — validation', () => {
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
      headers: { 'x-bus-secret': BUS_SECRET },
      body: { json: async () => { throw new Error('parse error'); } },
    });
    expect(result.status).toBe(400);
  });
});

// ── Inbound events ─────────────────────────────────────────────────────────────

describe('post_busEvent — streak_extended', () => {
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
  });
});

describe('post_busEvent — challenge_started', () => {
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
