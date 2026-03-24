/**
 * @file notificationQueueCron.test.js
 * @description HTTP-handler tests for get_processNotificationQueueCron and
 * writeNotification error paths in notificationService.web.js.
 * CF-hbz
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __getInserted,
  __getUpdated,
  __setInsertError,
} from './__mocks__/wix-data.js';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { get_processNotificationQueueCron } from '../src/backend/http-functions.js';
import {
  sendStreakMilestoneNotification,
  sendQuestCompleteNotification,
} from '../src/backend/notificationService.web.js';
import { PENDING_NOTIFICATIONS_COLLECTION } from '../src/backend/utils/pendingNotifications.js';

const NOTIFICATIONS = 'Notifications';
const CRON_KEY = 'test-cron-key-xyz';

const cronReq = (key = CRON_KEY) => ({ headers: { 'x-cron-secret': key } });

const pendingRow = (overrides = {}) => ({
  _id: 'pn-1',
  userId: 'mem-1',
  type: 'streak_milestone',
  payload: { memberId: 'mem-1', type: 'streak_milestone', message: '7-day streak!', extra: { milestone: 7 } },
  status: 'failed',
  retries: 0,
  nextRetryAt: new Date(Date.now() - 60_000), // 1 min ago — due
  updatedAt: new Date(Date.now() - 60_000),
  ...overrides,
});

beforeEach(() => {
  resetData();
  resetSecrets();
  __setSecrets({ ALERT_CRON_KEY: CRON_KEY });
  __seed(PENDING_NOTIFICATIONS_COLLECTION, []);
  __seed(NOTIFICATIONS, []);
});

// ── Auth ───────────────────────────────────────────────────────────────────────

describe('get_processNotificationQueueCron — auth', () => {
  it('returns 403 with wrong cron key', async () => {
    const result = await get_processNotificationQueueCron(cronReq('bad-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 with missing cron key', async () => {
    const result = await get_processNotificationQueueCron({ headers: {} });
    expect(result.status).toBe(403);
  });

  it('returns 200 with correct key and empty queue', async () => {
    const result = await get_processNotificationQueueCron(cronReq());
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.processed).toBe(0);
  });
});

// ── Happy path ─────────────────────────────────────────────────────────────────

describe('get_processNotificationQueueCron — happy path', () => {
  it('delivers a due failed row and returns correct counts', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [pendingRow()]);

    const result = await get_processNotificationQueueCron(cronReq());
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.processed).toBe(1);
    expect(body.delivered).toBe(1);
    expect(body.failed).toBe(0);

    const inserted = __getInserted(NOTIFICATIONS);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe('mem-1');
    expect(inserted[0].type).toBe('streak_milestone');
  });

  it('marks row as sent after successful delivery', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [pendingRow()]);

    await get_processNotificationQueueCron(cronReq());
    const updated = __getUpdated(PENDING_NOTIFICATIONS_COLLECTION);
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('sent');
  });

  it('returns processed=0 when queue is empty', async () => {
    const result = await get_processNotificationQueueCron(cronReq());
    const body = JSON.parse(result.body);
    expect(body.processed).toBe(0);
    expect(body.delivered).toBe(0);
    expect(body.failed).toBe(0);
  });

  it('processes multiple rows and sums counts correctly', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      pendingRow({ _id: 'pn-1' }),
      pendingRow({ _id: 'pn-2', payload: { memberId: 'mem-2', type: 'daily_quest', message: 'Quest!', extra: {} } }),
    ]);

    const result = await get_processNotificationQueueCron(cronReq());
    const body = JSON.parse(result.body);
    expect(body.processed).toBe(2);
    expect(body.delivered).toBe(2);
    expect(body.failed).toBe(0);
  });
});

// ── Per-row failure path ───────────────────────────────────────────────────────

describe('get_processNotificationQueueCron — per-row failure', () => {
  it('increments failed count and marks row failed when Notifications insert throws', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [pendingRow()]);
    __setInsertError(NOTIFICATIONS, new Error('DB write failed'));

    const result = await get_processNotificationQueueCron(cronReq());
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.processed).toBe(1);
    expect(body.delivered).toBe(0);
    expect(body.failed).toBe(1);

    const updated = __getUpdated(PENDING_NOTIFICATIONS_COLLECTION);
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('failed');
    expect(updated[0].retries).toBe(1);
  });

  it('continues processing remaining rows after one row fails', async () => {
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [
      pendingRow({ _id: 'pn-1' }),
      pendingRow({ _id: 'pn-2', payload: { memberId: 'mem-2', type: 'daily_quest', message: 'Quest!', extra: {} } }),
    ]);
    // Only fail first insert — second should succeed
    __setInsertError(NOTIFICATIONS, new Error('transient'));

    const result = await get_processNotificationQueueCron(cronReq());
    const body = JSON.parse(result.body);
    expect(body.processed).toBe(2);
    // First row fails, second row succeeds (insert error is consumed on first use)
    expect(body.delivered).toBe(1);
    expect(body.failed).toBe(1);
  });
});

// ── Stale pending rows ────────────────────────────────────────────────────────

describe('get_processNotificationQueueCron — stale pending rows', () => {
  it('picks up stale status=pending rows (updatedAt > 2 min ago)', async () => {
    const staleRow = pendingRow({
      status: 'pending',
      retries: 0,
      nextRetryAt: undefined,
      updatedAt: new Date(Date.now() - 3 * 60_000), // 3 min ago — stale
    });
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [staleRow]);

    const result = await get_processNotificationQueueCron(cronReq());
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.processed).toBe(1);
    expect(body.delivered).toBe(1);
  });

  it('does not pick up fresh status=pending rows (updatedAt < 2 min ago)', async () => {
    const freshRow = pendingRow({
      status: 'pending',
      retries: 0,
      nextRetryAt: undefined,
      updatedAt: new Date(Date.now() - 30_000), // 30s ago — not stale
    });
    __seed(PENDING_NOTIFICATIONS_COLLECTION, [freshRow]);

    const result = await get_processNotificationQueueCron(cronReq());
    const body = JSON.parse(result.body);
    expect(body.processed).toBe(0);
  });
});

// ── writeNotification error paths ─────────────────────────────────────────────

describe('writeNotification — enqueue throws → fallthrough', () => {
  it('still inserts Notification directly when enqueueNotification fails', async () => {
    // Make PendingNotifications insert throw
    __setInsertError(PENDING_NOTIFICATIONS_COLLECTION, new Error('queue unavailable'));

    await sendStreakMilestoneNotification('mem-1', 7, 'Week Warrior');

    // Should still insert to Notifications (fallthrough path)
    const inserted = __getInserted(NOTIFICATIONS);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe('mem-1');
    expect(inserted[0].type).toBe('streak_milestone');
  });
});

describe('writeNotification — insert throws → markFailed', () => {
  it('marks queue row failed when Notifications insert throws', async () => {
    __setInsertError(NOTIFICATIONS, new Error('notifications DB down'));

    await sendQuestCompleteNotification('mem-1', 'Daily Quest', 50);

    // Row was enqueued
    const enqueued = __getInserted(PENDING_NOTIFICATIONS_COLLECTION);
    expect(enqueued).toHaveLength(1);

    // Row was marked failed (status updated)
    const updated = __getUpdated(PENDING_NOTIFICATIONS_COLLECTION);
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('failed');
    expect(updated[0].retries).toBe(1);
  });
});
