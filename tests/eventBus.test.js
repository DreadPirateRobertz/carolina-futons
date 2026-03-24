import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateIncomingEvent, logEventTrace, INBOUND_EVENTS, OUTBOUND_EVENTS, BUS_SCHEMA_VERSION } from '../src/backend/utils/eventBus.js';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';

vi.mock('wix-data', async () => (await import('./__mocks__/wix-data.js')));

beforeEach(() => __reset());

// ── validateIncomingEvent ──────────────────────────────────────────────────────

describe('validateIncomingEvent', () => {
  const valid = {
    eventId: 'evt-1', schemaVersion: '1.0', traceId: 'trace_1',
    event: 'streak_extended', userId: 'mem-1', source: 'mobile', ts: 1234567890,
  };

  it('returns null for a valid event', () => {
    expect(validateIncomingEvent(valid)).toBeNull();
  });

  it('returns error when eventId is missing', () => {
    const err = validateIncomingEvent({ ...valid, eventId: undefined });
    expect(err).toMatch(/eventId/i);
  });

  it('returns error when schemaVersion is missing', () => {
    const err = validateIncomingEvent({ ...valid, schemaVersion: undefined });
    expect(err).toMatch(/schemaVersion/i);
  });

  it('returns error when schemaVersion is not 1.0', () => {
    const err = validateIncomingEvent({ ...valid, schemaVersion: '2.0' });
    expect(err).toMatch(/schemaVersion/i);
  });

  it('returns error when event is not a known inbound event', () => {
    const err = validateIncomingEvent({ ...valid, event: 'points_earned' });
    expect(err).toMatch(/event/i);
  });

  it('returns error when userId is missing', () => {
    const err = validateIncomingEvent({ ...valid, userId: undefined });
    expect(err).toMatch(/userId/i);
  });

  it('accepts all three known inbound events', () => {
    for (const event of INBOUND_EVENTS) {
      expect(validateIncomingEvent({ ...valid, event })).toBeNull();
    }
  });
});

// ── constants ──────────────────────────────────────────────────────────────────

describe('BUS_SCHEMA_VERSION', () => {
  it('is 1.0', () => {
    expect(BUS_SCHEMA_VERSION).toBe('1.0');
  });
});

describe('OUTBOUND_EVENTS', () => {
  it('contains points_earned, tier_upgraded, challenge_completed', () => {
    expect(OUTBOUND_EVENTS.has('points_earned')).toBe(true);
    expect(OUTBOUND_EVENTS.has('tier_upgraded')).toBe(true);
    expect(OUTBOUND_EVENTS.has('challenge_completed')).toBe(true);
  });
});

// ── logEventTrace ──────────────────────────────────────────────────────────────

describe('logEventTrace', () => {
  it('inserts a trace record into EventTraceLog', async () => {
    await logEventTrace({ eventId: 'evt-t1', traceId: 'trace_x', event: 'streak_extended', ts: 9999, status: 'received' });
    const logs = __getInserted('EventTraceLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].eventId).toBe('evt-t1');
    expect(logs[0].traceId).toBe('trace_x');
    expect(logs[0].event).toBe('streak_extended');
    expect(logs[0].status).toBe('received');
    expect(logs[0]._id).toBe('evt-t1');
  });

  it('stores userId and source when provided', async () => {
    await logEventTrace({ eventId: 'evt-t2', traceId: 'trace_z', event: 'streak_extended', userId: 'mem-9', source: 'mobile', ts: 1, status: 'received' });
    const logs = __getInserted('EventTraceLog');
    expect(logs[0].userId).toBe('mem-9');
    expect(logs[0].source).toBe('mobile');
  });

  it('skips insert when eventId already exists (idempotent)', async () => {
    __seed('EventTraceLog', [{ _id: 'evt-dup', eventId: 'evt-dup', event: 'streak_extended', status: 'received' }]);
    await logEventTrace({ eventId: 'evt-dup', traceId: 'trace_y', event: 'streak_extended', ts: 1, status: 'received' });
    const logs = __getInserted('EventTraceLog');
    expect(logs).toHaveLength(1); // still just the seeded one
  });
});
