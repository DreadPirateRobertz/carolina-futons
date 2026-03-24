/**
 * @file pendingNotifications.test.js
 * @description Tests for the PendingNotifications queue utility.
 * CF-hbz
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __getInserted, __getUpdated } from './__mocks__/wix-data.js';
import {
  enqueueNotification,
  markSent,
  markFailed,
  getPendingRetries,
  MAX_RETRIES,
  PENDING_NOTIFICATIONS_COLLECTION,
} from '../src/backend/utils/pendingNotifications.js';

beforeEach(() => {
  resetData();
  __seed(PENDING_NOTIFICATIONS_COLLECTION, []);
});

// ── enqueueNotification ───────────────────────────────────────────────────────

describe('enqueueNotification', () => {
  it('inserts a record with status=pending and retries=0', async () => {
    await enqueueNotification({ userId: 'mem-1', type: 'streak_milestone', payload: { message: 'hi' } });
    const rows = __getInserted(PENDING_NOTIFICATIONS_COLLECTION);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe('mem-1');
    expect(rows[0].type).toBe('streak_milestone');
    expect(rows[0].status).toBe('pending');
    expect(rows[0].retries).toBe(0);
  });

  it('stores the payload object', async () => {
    await enqueueNotification({ userId: 'mem-2', type: 'daily_quest', payload: { memberId: 'mem-2', message: 'quest!' } });
    const rows = __getInserted(PENDING_NOTIFICATIONS_COLLECTION);
    expect(rows[0].payload).toEqual({ memberId: 'mem-2', message: 'quest!' });
  });
});

// ── markSent ──────────────────────────────────────────────────────────────────

describe('markSent', () => {
  it('updates the record to status=sent', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-1', userId: 'mem-1', type: 'streak_milestone', payload: {}, status: 'pending', retries: 0 },
    ]);
    await markSent('pn-1');
    const updated = __getUpdated(PENDING_NOTIFICATIONS_COLLECTION);
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('sent');
  });
});

// ── markFailed ────────────────────────────────────────────────────────────────

describe('markFailed', () => {
  it('increments retries and sets status=failed', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-1', userId: 'mem-1', type: 'streak_milestone', payload: {}, status: 'pending', retries: 0 },
    ]);
    await markFailed('pn-1', 0);
    const updated = __getUpdated(PENDING_NOTIFICATIONS_COLLECTION);
    expect(updated[0].status).toBe('failed');
    expect(updated[0].retries).toBe(1);
  });

  it('sets nextRetryAt 30s in future for first failure (retries=0)', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-1', userId: 'mem-1', type: 'streak_milestone', payload: {}, status: 'pending', retries: 0 },
    ]);
    const before = Date.now();
    await markFailed('pn-1', 0);
    const updated = __getUpdated(PENDING_NOTIFICATIONS_COLLECTION);
    const nextRetryMs = updated[0].nextRetryAt.getTime();
    expect(nextRetryMs).toBeGreaterThanOrEqual(before + 30_000 - 100);
    expect(nextRetryMs).toBeLessThanOrEqual(before + 30_000 + 1000);
  });

  it('sets nextRetryAt 60s in future for second failure (retries=1)', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-1', userId: 'mem-1', type: 'streak_milestone', payload: {}, status: 'failed', retries: 1 },
    ]);
    const before = Date.now();
    await markFailed('pn-1', 1);
    const updated = __getUpdated(PENDING_NOTIFICATIONS_COLLECTION);
    const nextRetryMs = updated[0].nextRetryAt.getTime();
    expect(nextRetryMs).toBeGreaterThanOrEqual(before + 60_000 - 100);
    expect(nextRetryMs).toBeLessThanOrEqual(before + 60_000 + 1000);
  });

  it('sets nextRetryAt 120s in future for third failure (retries=2)', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-1', userId: 'mem-1', type: 'streak_milestone', payload: {}, status: 'failed', retries: 2 },
    ]);
    const before = Date.now();
    await markFailed('pn-1', 2);
    const updated = __getUpdated(PENDING_NOTIFICATIONS_COLLECTION);
    const nextRetryMs = updated[0].nextRetryAt.getTime();
    expect(nextRetryMs).toBeGreaterThanOrEqual(before + 120_000 - 100);
    expect(nextRetryMs).toBeLessThanOrEqual(before + 120_000 + 1000);
  });
});

// ── getPendingRetries ─────────────────────────────────────────────────────────

describe('getPendingRetries', () => {
  it('returns failed rows with retries < MAX_RETRIES and nextRetryAt in the past', async () => {
    const pastTime = new Date(Date.now() - 60_000); // 1 min ago
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-due', userId: 'mem-1', status: 'failed', retries: 1, nextRetryAt: pastTime },
    ]);
    const rows = await getPendingRetries();
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe('pn-due');
  });

  it('excludes rows where nextRetryAt is in the future', async () => {
    const futureTime = new Date(Date.now() + 60_000);
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-future', userId: 'mem-1', status: 'failed', retries: 0, nextRetryAt: futureTime },
    ]);
    const rows = await getPendingRetries();
    expect(rows).toHaveLength(0);
  });

  it('excludes rows where retries >= MAX_RETRIES', async () => {
    const pastTime = new Date(Date.now() - 60_000);
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-maxed', userId: 'mem-1', status: 'failed', retries: MAX_RETRIES, nextRetryAt: pastTime },
    ]);
    const rows = await getPendingRetries();
    expect(rows).toHaveLength(0);
  });

  it('excludes pending and sent rows', async () => {
    const pastTime = new Date(Date.now() - 60_000);
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      { _id: 'pn-pending', userId: 'mem-1', status: 'pending', retries: 0, nextRetryAt: pastTime },
      { _id: 'pn-sent', userId: 'mem-2', status: 'sent', retries: 0, nextRetryAt: pastTime },
    ]);
    const rows = await getPendingRetries();
    expect(rows).toHaveLength(0);
  });
});
