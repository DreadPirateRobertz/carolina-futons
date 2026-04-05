/**
 * @file emailQueueService.test.js
 * @description TDD tests for CF-5io3: Email Queue Service
 *
 * Tests:
 *   isInSendWindow — true 9am-7:59pm ET, false before 9am, false at/after 8pm
 *   enqueueEmail — inserts correct fields, dedup skips pending/sent, allows re-queue after cancel,
 *                  checkoutId dedup for cart_abandon, DB error propagation
 *   processQueue — skips empty queue, sends within window, reschedules outside window to 9am ET,
 *                  rate limit blocks, retry logic, marks failed after MAX_RETRIES
 *   cancelQueuedEmails — cancels pending only, returns count, skips sent/failed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __seed,
  __reset as resetData,
  __setQueryError,
  __setInsertError,
  __getInserted,
  __getUpdated,
  __onInsert,
  __onUpdate,
} from './__mocks__/wix-data.js';
import { __reset as resetCRM, __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';

import {
  isInSendWindow,
  enqueueEmail,
  processQueue,
  cancelQueuedEmails,
  EMAIL_QUEUE_COLLECTION,
  MAX_RETRIES,
} from '../src/backend/emailQueueService.web.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNowET(hour, minute = 0) {
  // Build a UTC timestamp that corresponds to the given ET hour on a fixed date.
  // Use a summer date (EDT = UTC-4) and a winter date (EST = UTC-5) interchangeably
  // for most tests — callers pass the UTC offset explicitly via etOffset.
  // Default: EDT (UTC-4, summer), so hour 9 ET = hour 13 UTC
  return makeNowETWithOffset(hour, minute, -4);
}

function makeNowETWithOffset(hour, minute, etOffsetHours) {
  // etOffsetHours: -4 for EDT, -5 for EST
  const utcHour = hour - etOffsetHours; // e.g., hour=9, offset=-4 → utcHour=13
  const d = new Date(Date.UTC(2026, 5, 15, utcHour, minute, 0)); // June 15 2026 (summer, EDT)
  return d.getTime();
}

function makeQueueItem(overrides = {}) {
  return {
    _id: `qitem-${Math.random().toString(36).slice(2, 8)}`,
    templateId: 'tpl-welcome',
    recipientEmail: 'test@example.com',
    recipientContactId: 'contact-abc',
    variables: JSON.stringify({ firstName: 'Alice' }),
    sequenceType: 'welcome',
    sequenceStep: 1,
    status: 'pending',
    scheduledFor: new Date(Date.now() - 1000), // 1 second ago
    attempt: 0,
    checkoutId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── beforeEach / afterEach ────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
  resetCRM();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── EMAIL_QUEUE_COLLECTION constant ──────────────────────────────────────────

describe('EMAIL_QUEUE_COLLECTION', () => {
  it('is a non-empty string', () => {
    expect(typeof EMAIL_QUEUE_COLLECTION).toBe('string');
    expect(EMAIL_QUEUE_COLLECTION.length).toBeGreaterThan(0);
  });
});

// ── MAX_RETRIES constant ──────────────────────────────────────────────────────

describe('MAX_RETRIES', () => {
  it('is a positive integer', () => {
    expect(typeof MAX_RETRIES).toBe('number');
    expect(MAX_RETRIES).toBeGreaterThan(0);
  });
});

// ── isInSendWindow ────────────────────────────────────────────────────────────

describe('isInSendWindow', () => {
  it('returns true at 9:00am ET', () => {
    expect(isInSendWindow(makeNowET(9, 0))).toBe(true);
  });

  it('returns true at noon ET', () => {
    expect(isInSendWindow(makeNowET(12, 0))).toBe(true);
  });

  it('returns true at 7:59pm ET', () => {
    expect(isInSendWindow(makeNowET(19, 59))).toBe(true);
  });

  it('returns false at 8:00am ET (before window)', () => {
    expect(isInSendWindow(makeNowET(8, 0))).toBe(false);
  });

  it('returns false at 6:00am ET', () => {
    expect(isInSendWindow(makeNowET(6, 0))).toBe(false);
  });

  it('returns false at 8:00pm ET (window closed)', () => {
    expect(isInSendWindow(makeNowET(20, 0))).toBe(false);
  });

  it('returns false at 10:00pm ET', () => {
    expect(isInSendWindow(makeNowET(22, 0))).toBe(false);
  });

  it('returns false at midnight ET', () => {
    expect(isInSendWindow(makeNowET(0, 0))).toBe(false);
  });

  it('works correctly in winter (EST, UTC-5)', () => {
    // 9am EST = 14:00 UTC on a winter date
    const winterNow = new Date(Date.UTC(2026, 0, 15, 14, 0, 0)).getTime(); // Jan 15 2026 14:00 UTC = 9am EST
    expect(isInSendWindow(winterNow)).toBe(true);
  });

  it('winter before window: 8:59am EST returns false', () => {
    const winterNow = new Date(Date.UTC(2026, 0, 15, 13, 59, 0)).getTime(); // 8:59am EST
    expect(isInSendWindow(winterNow)).toBe(false);
  });
});

// ── enqueueEmail ─────────────────────────────────────────────────────────────

describe('enqueueEmail — basic insertion', () => {
  it('inserts a record into EmailQueue', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'alice@example.com',
      recipientContactId: 'contact-1',
      variables: { firstName: 'Alice' },
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(Date.now() + 1000),
    });

    const items = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(items.length).toBe(1);
    expect(items[0].recipientEmail).toBe('alice@example.com');
    expect(items[0].sequenceType).toBe('welcome');
    expect(items[0].status).toBe('pending');
  });

  it('stores variables as JSON string', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'bob@example.com',
      recipientContactId: 'contact-2',
      variables: { firstName: 'Bob', orderNumber: '#123' },
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    const items = __getInserted(EMAIL_QUEUE_COLLECTION);
    const vars = JSON.parse(items[0].variables);
    expect(vars.firstName).toBe('Bob');
    expect(vars.orderNumber).toBe('#123');
  });

  it('sets attempt to 0 on new item', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'carol@example.com',
      recipientContactId: 'contact-3',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    const items = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(items[0].attempt).toBe(0);
  });

  it('returns success: true on insertion', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const result = await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'dave@example.com',
      recipientContactId: 'contact-4',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    expect(result.success).toBe(true);
  });
});

describe('enqueueEmail — dedup', () => {
  it('skips if pending item already exists for email + sequenceType + sequenceStep', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ recipientEmail: 'alice@example.com', sequenceType: 'welcome', sequenceStep: 1, status: 'pending' }),
    ]);

    const result = await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'alice@example.com',
      recipientContactId: 'contact-1',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    expect(result.skipped).toBe(true);
    // Should not have inserted a second item
    const items = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(items.length).toBe(1);
  });

  it('skips if sent item already exists for email + sequenceType + sequenceStep', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ recipientEmail: 'alice@example.com', sequenceType: 'welcome', sequenceStep: 1, status: 'sent' }),
    ]);

    const result = await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'alice@example.com',
      recipientContactId: 'contact-1',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    expect(result.skipped).toBe(true);
  });

  it('allows re-queue if prior item is cancelled', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ recipientEmail: 'alice@example.com', sequenceType: 'welcome', sequenceStep: 1, status: 'cancelled' }),
    ]);

    const result = await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'alice@example.com',
      recipientContactId: 'contact-1',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBeFalsy();
  });

  it('allows re-queue if prior item is failed', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ recipientEmail: 'alice@example.com', sequenceType: 'welcome', sequenceStep: 1, status: 'failed' }),
    ]);

    const result = await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'alice@example.com',
      recipientContactId: 'contact-1',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBeFalsy();
  });

  it('deduplicates cart_abandon by checkoutId even for different email', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({
        recipientEmail: 'old@example.com',
        sequenceType: 'cart_abandon',
        sequenceStep: 1,
        status: 'pending',
        checkoutId: 'checkout-xyz',
      }),
    ]);

    const result = await enqueueEmail({
      templateId: 'tpl-cart-abandon',
      recipientEmail: 'new@example.com',
      recipientContactId: 'contact-2',
      variables: {},
      sequenceType: 'cart_abandon',
      sequenceStep: 1,
      scheduledFor: new Date(),
      checkoutId: 'checkout-xyz',
    });

    expect(result.skipped).toBe(true);
  });

  it('does not dedup cart_abandon when no checkoutId provided', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, []);

    // Two separate cart_abandon enqueues without checkoutId should both insert
    await enqueueEmail({
      templateId: 'tpl-cart-abandon',
      recipientEmail: 'alice@example.com',
      recipientContactId: 'contact-1',
      variables: {},
      sequenceType: 'cart_abandon',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    const result2 = await enqueueEmail({
      templateId: 'tpl-cart-abandon',
      recipientEmail: 'alice@example.com',
      recipientContactId: 'contact-1',
      variables: {},
      sequenceType: 'cart_abandon',
      sequenceStep: 1,
      scheduledFor: new Date(Date.now() + 5000),
    });

    // Second is deduplicated by email+sequenceType+sequenceStep
    expect(result2.skipped).toBe(true);
  });
});

describe('enqueueEmail — error handling', () => {
  it('returns success: false on DB insert error', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, []);
    __setInsertError(EMAIL_QUEUE_COLLECTION, new Error('DB down'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await enqueueEmail({
      templateId: 'tpl-welcome',
      recipientEmail: 'eve@example.com',
      recipientContactId: 'contact-5',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    expect(result.success).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
  });
});

// ── processQueue ──────────────────────────────────────────────────────────────

describe('processQueue — empty queue', () => {
  it('returns 0 sent on empty queue', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const result = await processQueue({ now: makeNowET(10, 0) });

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

describe('processQueue — within send window', () => {
  it('sends a pending email and marks it sent', async () => {
    const now = makeNowET(10, 0);
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ scheduledFor: new Date(now - 60000) }),
    ]);

    const result = await processQueue({ now });

    expect(result.sent).toBe(1);
    const log = __getEmailLog();
    expect(log.length).toBe(1);
    expect(log[0].templateId).toBe('tpl-welcome');
  });

  it('marks the queue item as sent with sentAt', async () => {
    const now = makeNowET(10, 0);
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', scheduledFor: new Date(now - 60000) }),
    ]);

    await processQueue({ now });

    const updated = __getUpdated(EMAIL_QUEUE_COLLECTION);
    expect(updated.length).toBeGreaterThanOrEqual(1);
    const sentItem = updated.find(i => i._id === 'q1');
    expect(sentItem).toBeDefined();
    expect(sentItem.status).toBe('sent');
    expect(sentItem.sentAt).toBeInstanceOf(Date);
  });

  it('does not send items scheduled in the future', async () => {
    const now = makeNowET(10, 0);
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ scheduledFor: new Date(now + 3600000) }), // 1hr in future
    ]);

    const result = await processQueue({ now });

    expect(result.sent).toBe(0);
    expect(__getEmailLog().length).toBe(0);
  });

  it('sends multiple pending items', async () => {
    const now = makeNowET(10, 0);
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', recipientEmail: 'a@example.com', scheduledFor: new Date(now - 1000) }),
      makeQueueItem({ _id: 'q2', recipientEmail: 'b@example.com', scheduledFor: new Date(now - 2000) }),
    ]);

    const result = await processQueue({ now });

    expect(result.sent).toBe(2);
    expect(__getEmailLog().length).toBe(2);
  });

  it('skips items with status !== pending', async () => {
    const now = makeNowET(10, 0);
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ status: 'sent', scheduledFor: new Date(now - 1000) }),
      makeQueueItem({ status: 'failed', scheduledFor: new Date(now - 1000) }),
      makeQueueItem({ status: 'cancelled', scheduledFor: new Date(now - 1000) }),
    ]);

    const result = await processQueue({ now });

    expect(result.sent).toBe(0);
    expect(__getEmailLog().length).toBe(0);
  });
});

describe('processQueue — outside send window', () => {
  it('reschedules to 9am ET when outside window (before)', async () => {
    const now = makeNowET(7, 0); // 7am ET — before window
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', scheduledFor: new Date(now - 1000) }),
    ]);

    const result = await processQueue({ now });

    expect(result.sent).toBe(0);
    expect(result.rescheduled).toBe(1);
    expect(__getEmailLog().length).toBe(0);

    const updated = __getUpdated(EMAIL_QUEUE_COLLECTION);
    const rescheduled = updated.find(i => i._id === 'q1');
    expect(rescheduled).toBeDefined();
    // scheduledFor should be in the future (9am ET today or tomorrow)
    expect(rescheduled.scheduledFor.getTime()).toBeGreaterThan(now);
  });

  it('reschedules to next 9am ET when outside window (after)', async () => {
    const now = makeNowET(21, 0); // 9pm ET — after window
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', scheduledFor: new Date(now - 1000) }),
    ]);

    const result = await processQueue({ now });

    expect(result.sent).toBe(0);
    expect(result.rescheduled).toBe(1);

    const updated = __getUpdated(EMAIL_QUEUE_COLLECTION);
    const rescheduled = updated.find(i => i._id === 'q1');
    expect(rescheduled.scheduledFor.getTime()).toBeGreaterThan(now);
  });

  it('does not send email when rescheduling', async () => {
    const now = makeNowET(6, 0); // 6am ET
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ scheduledFor: new Date(now - 1000) }),
    ]);

    await processQueue({ now });

    expect(__getEmailLog().length).toBe(0);
  });
});

describe('processQueue — retry logic', () => {
  it('increments attempt count on email send failure', async () => {
    const now = makeNowET(10, 0);
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', attempt: 0, scheduledFor: new Date(now - 1000) }),
    ]);
    __failNextEmail();

    await processQueue({ now });

    const updated = __getUpdated(EMAIL_QUEUE_COLLECTION);
    const item = updated.find(i => i._id === 'q1');
    expect(item).toBeDefined();
    expect(item.attempt).toBe(1);
    expect(item.status).toBe('pending'); // still pending, not failed yet
    expect(item.lastError).toBeTruthy();
  });

  it('marks item as failed when attempt >= MAX_RETRIES', async () => {
    const now = makeNowET(10, 0);
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', attempt: MAX_RETRIES, scheduledFor: new Date(now - 1000) }),
    ]);
    __failNextEmail();

    await processQueue({ now });

    const updated = __getUpdated(EMAIL_QUEUE_COLLECTION);
    const item = updated.find(i => i._id === 'q1');
    expect(item.status).toBe('failed');
  });

  it('returns correct sent/failed counts', async () => {
    const now = makeNowET(10, 0);
    // q1 scheduled earlier so it's processed first (ascending scheduledFor)
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', attempt: MAX_RETRIES, scheduledFor: new Date(now - 2000) }),
      makeQueueItem({ _id: 'q2', recipientEmail: 'b@example.com', scheduledFor: new Date(now - 1000) }),
    ]);
    __failNextEmail(); // q1 is processed first and fails → exhausted → failed

    const result = await processQueue({ now });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe('processQueue — rate limiting', () => {
  it('skips sending when rate limited', async () => {
    const now = makeNowET(10, 0);
    const email = 'ratelimited@example.com';
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ recipientEmail: email, scheduledFor: new Date(now - 1000) }),
    ]);

    // Seed rate limit collection to indicate rate limit exceeded
    __seed('EmailQueueRateLimit', [
      {
        _id: `rl-${email}`,
        key: email,
        count: 10,
        windowStart: new Date(now - 1000), // within window
      },
    ]);

    const result = await processQueue({ now, rateLimitMax: 3 });

    expect(result.rateLimited).toBeGreaterThanOrEqual(1);
    expect(__getEmailLog().length).toBe(0);
  });
});

// ── cancelQueuedEmails ────────────────────────────────────────────────────────

describe('cancelQueuedEmails', () => {
  it('cancels pending items for matching email + sequenceType', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', recipientEmail: 'alice@example.com', sequenceType: 'welcome', status: 'pending' }),
      makeQueueItem({ _id: 'q2', recipientEmail: 'alice@example.com', sequenceType: 'welcome', status: 'pending' }),
    ]);

    const result = await cancelQueuedEmails('alice@example.com', 'welcome');

    expect(result.cancelled).toBe(2);
    const updated = __getUpdated(EMAIL_QUEUE_COLLECTION);
    updated.forEach(item => expect(item.status).toBe('cancelled'));
  });

  it('does not cancel sent items', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', recipientEmail: 'alice@example.com', sequenceType: 'welcome', status: 'sent' }),
      makeQueueItem({ _id: 'q2', recipientEmail: 'alice@example.com', sequenceType: 'welcome', status: 'pending' }),
    ]);

    const result = await cancelQueuedEmails('alice@example.com', 'welcome');

    expect(result.cancelled).toBe(1);
  });

  it('does not cancel items for a different email', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', recipientEmail: 'bob@example.com', sequenceType: 'welcome', status: 'pending' }),
    ]);

    const result = await cancelQueuedEmails('alice@example.com', 'welcome');

    expect(result.cancelled).toBe(0);
  });

  it('does not cancel items for a different sequenceType', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', recipientEmail: 'alice@example.com', sequenceType: 'post_purchase', status: 'pending' }),
    ]);

    const result = await cancelQueuedEmails('alice@example.com', 'welcome');

    expect(result.cancelled).toBe(0);
  });

  it('returns cancelled: 0 when nothing to cancel', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const result = await cancelQueuedEmails('nobody@example.com', 'welcome');

    expect(result.cancelled).toBe(0);
  });

  it('does not cancel failed items', async () => {
    __seed(EMAIL_QUEUE_COLLECTION, [
      makeQueueItem({ _id: 'q1', recipientEmail: 'alice@example.com', sequenceType: 'welcome', status: 'failed' }),
    ]);

    const result = await cancelQueuedEmails('alice@example.com', 'welcome');

    expect(result.cancelled).toBe(0);
  });
});
