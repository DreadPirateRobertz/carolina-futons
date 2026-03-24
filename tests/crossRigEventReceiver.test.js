/**
 * @file crossRigEventReceiver.test.js
 * @description TDD tests for cf-87tn: crossRigEvent webMethod.
 *
 * Covers:
 *  - schema validation (missing event, unknown event, missing schemaVersion)
 *  - unauthenticated caller returns 401
 *  - streak_extended: logs analytics event with correct memberId + eventType
 *  - challenge_started: logs analytics event with challengeId in payload
 *  - redemption_initiated: logs analytics event with delta + newTotal in payload
 *  - analytics write failure returns { success: false }
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __setInsertError,
} from './__mocks__/wix-data.js';
import {
  __reset as __resetMembers,
  __setMember,
} from './__mocks__/wix-members-backend.js';
import { crossRigEvent } from '../src/backend/crossRigEventReceiver.web.js';
import { ANALYTICS_EVENTS_COLLECTION } from '../src/backend/utils/analyticsEvents.js';

// wix-data __getInserted is re-exported from the mock, but we need to read _store
// directly. Import the helper via the mock.
import { __getInserted } from './__mocks__/wix-data.js';

beforeEach(() => {
  __reset();
  __resetMembers();
  vi.clearAllMocks();
});

// ── Schema validation ─────────────────────────────────────────────────────────

describe('crossRigEvent — schema validation', () => {
  it('returns 400 when event field is missing', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({ schemaVersion: '1.0', delta: 0, newTotal: 0 });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('returns 400 when event is unknown', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({ event: 'mystery_event', schemaVersion: '1.0' });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('returns 400 when schemaVersion is missing', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({ event: 'streak_extended', streak: 3, delta: 1, newTotal: 50 });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('error message mentions the unsupported event name', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({ event: 'bad_event', schemaVersion: '1.0' });
    expect(result.error).toMatch(/bad_event/);
  });
});

// ── Unauthenticated ───────────────────────────────────────────────────────────

describe('crossRigEvent — unauthenticated', () => {
  it('returns 401 when no member session', async () => {
    // __setMember not called — default null member
    const result = await crossRigEvent({
      eventId: 'ev-1',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 2,
      delta: 1,
      newTotal: 50,
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
  });

  it('does not log analytics when unauthenticated', async () => {
    await crossRigEvent({
      eventId: 'ev-2',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 2,
      delta: 1,
      newTotal: 50,
    });
    expect(__getInserted(ANALYTICS_EVENTS_COLLECTION)).toHaveLength(0);
  });
});

// ── streak_extended ───────────────────────────────────────────────────────────

describe('crossRigEvent — streak_extended', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({
      eventId: 'ev-3',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 5,
      delta: 1,
      newTotal: 100,
      source: 'mobile',
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].eventType).toBe('streak_extended');
    expect(inserted[0].memberId).toBe('mem-1');
  });

  it('stores streak count in analytics payload', async () => {
    __setMember({ _id: 'mem-1' });
    await crossRigEvent({
      eventId: 'ev-4',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 7,
      delta: 1,
      newTotal: 200,
    });
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    const payload = JSON.parse(inserted[0].payload);
    expect(payload.streak).toBe(7);
    expect(payload.delta).toBe(1);
    expect(payload.newTotal).toBe(200);
  });
});

// ── challenge_started ─────────────────────────────────────────────────────────

describe('crossRigEvent — challenge_started', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-2' });
    const result = await crossRigEvent({
      eventId: 'ev-5',
      schemaVersion: '1.0',
      event: 'challenge_started',
      challengeId: 'ch-abc',
      delta: 0,
      newTotal: 300,
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe('challenge_started');
    expect(inserted[0].memberId).toBe('mem-2');
  });

  it('stores challengeId in analytics payload', async () => {
    __setMember({ _id: 'mem-2' });
    await crossRigEvent({
      eventId: 'ev-6',
      schemaVersion: '1.0',
      event: 'challenge_started',
      challengeId: 'ch-xyz',
      delta: 0,
      newTotal: 300,
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.challengeId).toBe('ch-xyz');
  });
});

// ── redemption_initiated ──────────────────────────────────────────────────────

describe('crossRigEvent — redemption_initiated', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-3' });
    const result = await crossRigEvent({
      eventId: 'ev-7',
      schemaVersion: '1.0',
      event: 'redemption_initiated',
      delta: -50,
      newTotal: 150,
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe('redemption_initiated');
    expect(inserted[0].memberId).toBe('mem-3');
  });

  it('stores negative delta in analytics payload', async () => {
    __setMember({ _id: 'mem-3' });
    await crossRigEvent({
      eventId: 'ev-8',
      schemaVersion: '1.0',
      event: 'redemption_initiated',
      delta: -75,
      newTotal: 25,
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.delta).toBe(-75);
    expect(payload.newTotal).toBe(25);
  });
});

// ── Analytics write failure ───────────────────────────────────────────────────

describe('crossRigEvent — analytics write failure', () => {
  it('returns { success: false } when analytics insert fails', async () => {
    __setMember({ _id: 'mem-4' });
    __setInsertError(ANALYTICS_EVENTS_COLLECTION, new Error('DB write failed'));
    const result = await crossRigEvent({
      eventId: 'ev-9',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 3,
      delta: 1,
      newTotal: 60,
    });
    expect(result.success).toBe(false);
  });
});
