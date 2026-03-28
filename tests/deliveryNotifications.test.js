/**
 * Tests for CF-rjxq: deliveryNotifications.web.js
 *
 * Covers:
 * - sendDeliveryBookingConfirmationSms: success, invalid phone, send failure
 * - processDelivery48hReminders: finds target records, sends, dedup, skips non-opted-in
 * - processDeliveryDayOfReminders: finds today's records, sends, dedup, skips non-opted-in
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __getInserted, __getUpdated, __reset as resetData } from './__mocks__/wix-data.js';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler, __reset as resetFetch } from './__mocks__/wix-fetch.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  sendDeliveryBookingConfirmationSms,
  processDelivery48hReminders,
  processDeliveryDayOfReminders,
} from '../src/backend/deliveryNotifications.web.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** ISO date string N days from today. */
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/** Return a mock Twilio success handler. */
function twilioSuccess(sid = 'SM-mock-sid') {
  return (_url, _opts) => ({
    ok: true,
    async json() { return { sid }; },
  });
}

/** Return a mock Twilio failure handler. */
function twilioFailure() {
  return (_url, _opts) => ({
    ok: false,
    async json() { return { code: 21211, message: 'Invalid To phone number' }; },
  });
}

beforeEach(() => {
  resetData();
  resetSecrets();
  resetFetch();
  __setSecrets({
    TWILIO_ACCOUNT_SID: 'ACtest',
    TWILIO_AUTH_TOKEN: 'authtest',
    TWILIO_PHONE_NUMBER: '+18282529449',
  });
  __setHandler(twilioSuccess());
});

// ── sendDeliveryBookingConfirmationSms ───────────────────────────────────────

describe('sendDeliveryBookingConfirmationSms', () => {
  it('sends confirmation SMS and returns success', async () => {
    __seed('DeliverySchedule', [
      { _id: 'sched-1', orderId: 'order-A', date: '2026-05-15', timeWindow: 'morning', status: 'scheduled' },
    ]);

    const result = await sendDeliveryBookingConfirmationSms({
      scheduleId: 'sched-1',
      customerPhone: '(828) 555-1234',
      orderId: 'order-A',
      date: '2026-05-15',
      timeWindow: 'morning',
    });

    expect(result.success).toBe(true);
  });

  it('logs SMS to SMSLog collection', async () => {
    __seed('DeliverySchedule', [
      { _id: 'sched-2', orderId: 'order-B', date: '2026-05-16', timeWindow: 'afternoon', status: 'scheduled' },
    ]);

    await sendDeliveryBookingConfirmationSms({
      scheduleId: 'sched-2',
      customerPhone: '8285551234',
      orderId: 'order-B',
      date: '2026-05-16',
      timeWindow: 'afternoon',
    });

    const logs = __getInserted('SMSLog');
    const log = logs.find(l => l.messageType === 'delivery_booking_confirmation');
    expect(log).toBeTruthy();
    expect(log.orderNumber).toBe('order-B');
  });

  it('includes TCPA opt-out language in message body', async () => {
    let capturedBody = '';
    __setHandler((url, opts) => {
      capturedBody = opts.body || '';
      return twilioSuccess()();
    });

    __seed('DeliverySchedule', [
      { _id: 'sched-3', orderId: 'order-C', date: '2026-05-17', timeWindow: 'morning', status: 'scheduled' },
    ]);

    await sendDeliveryBookingConfirmationSms({
      scheduleId: 'sched-3',
      customerPhone: '8285551234',
      orderId: 'order-C',
      date: '2026-05-17',
      timeWindow: 'morning',
    });

    expect(capturedBody).toContain('STOP');
    expect(capturedBody).toContain('opt%20out');
  });

  it('marks smsSentConfirmation on the DeliverySchedule record', async () => {
    __seed('DeliverySchedule', [
      { _id: 'sched-4', orderId: 'order-D', date: '2026-05-18', timeWindow: 'morning', status: 'scheduled' },
    ]);

    await sendDeliveryBookingConfirmationSms({
      scheduleId: 'sched-4',
      customerPhone: '8285551234',
      orderId: 'order-D',
      date: '2026-05-18',
      timeWindow: 'morning',
    });

    const updated = __getUpdated('DeliverySchedule').find(r => r._id === 'sched-4');
    expect(updated?.smsSentConfirmation).toBe(true);
  });

  it('returns error for missing phone', async () => {
    const result = await sendDeliveryBookingConfirmationSms({
      scheduleId: 'sched-5',
      customerPhone: '',
      orderId: 'order-E',
      date: '2026-05-19',
      timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_phone');
  });

  it('returns error for invalid phone', async () => {
    const result = await sendDeliveryBookingConfirmationSms({
      scheduleId: 'sched-6',
      customerPhone: 'notaphone',
      orderId: 'order-F',
      date: '2026-05-20',
      timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_phone');
  });

  it('returns error when Twilio call fails', async () => {
    __setHandler(twilioFailure());

    __seed('DeliverySchedule', [
      { _id: 'sched-7', orderId: 'order-G', date: '2026-05-21', timeWindow: 'afternoon', status: 'scheduled' },
    ]);

    const result = await sendDeliveryBookingConfirmationSms({
      scheduleId: 'sched-7',
      customerPhone: '8285551234',
      orderId: 'order-G',
      date: '2026-05-21',
      timeWindow: 'afternoon',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('send_failed');
  });

  it('describes afternoon window correctly', async () => {
    let capturedBody = '';
    __setHandler((url, opts) => {
      capturedBody = opts.body || '';
      return twilioSuccess()();
    });

    __seed('DeliverySchedule', [
      { _id: 'sched-8', orderId: 'order-H', date: '2026-05-22', timeWindow: 'afternoon', status: 'scheduled' },
    ]);

    await sendDeliveryBookingConfirmationSms({
      scheduleId: 'sched-8',
      customerPhone: '8285551234',
      orderId: 'order-H',
      date: '2026-05-22',
      timeWindow: 'afternoon',
    });

    expect(capturedBody).toContain('1%E2%80%935%20PM');
  });
});

// ── processDelivery48hReminders ──────────────────────────────────────────────

describe('processDelivery48hReminders', () => {
  it('sends reminder to eligible records and returns sent count', async () => {
    const target = daysFromNow(2);
    __seed('DeliverySchedule', [
      { _id: 'r48-1', orderId: 'o1', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285551001', smsSent48h: false },
      { _id: 'r48-2', orderId: 'o2', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285551002', smsSent48h: false },
    ]);

    const result = await processDelivery48hReminders();
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('marks smsSent48h on sent records', async () => {
    const target = daysFromNow(2);
    __seed('DeliverySchedule', [
      { _id: 'r48-mark', orderId: 'o3', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285551003', smsSent48h: false },
    ]);

    await processDelivery48hReminders();

    const updated = __getUpdated('DeliverySchedule').find(r => r._id === 'r48-mark');
    expect(updated?.smsSent48h).toBe(true);
  });

  it('skips records already sent (smsSent48h: true)', async () => {
    const target = daysFromNow(2);
    __seed('DeliverySchedule', [
      { _id: 'r48-skip', orderId: 'o4', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285551004', smsSent48h: true },
    ]);

    const result = await processDelivery48hReminders();
    expect(result.sent).toBe(0);
  });

  it('skips records without smsOptIn', async () => {
    const target = daysFromNow(2);
    __seed('DeliverySchedule', [
      { _id: 'r48-noopt', orderId: 'o5', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: false, customerPhone: '8285551005', smsSent48h: false },
    ]);

    const result = await processDelivery48hReminders();
    expect(result.sent).toBe(0);
  });

  it('counts failed for records with no valid phone', async () => {
    const target = daysFromNow(2);
    __seed('DeliverySchedule', [
      { _id: 'r48-nophone', orderId: 'o6', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '', smsSent48h: false },
    ]);

    const result = await processDelivery48hReminders();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('counts failed when Twilio returns error', async () => {
    __setHandler(twilioFailure());
    const target = daysFromNow(2);
    __seed('DeliverySchedule', [
      { _id: 'r48-fail', orderId: 'o7', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285551006', smsSent48h: false },
    ]);

    const result = await processDelivery48hReminders();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('does not send to records on a different date', async () => {
    const wrongDate = daysFromNow(3);
    __seed('DeliverySchedule', [
      { _id: 'r48-wrong', orderId: 'o8', date: wrongDate, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285551007', smsSent48h: false },
    ]);

    const result = await processDelivery48hReminders();
    expect(result.sent).toBe(0);
  });

  it('logs SMS to SMSLog collection', async () => {
    const target = daysFromNow(2);
    __seed('DeliverySchedule', [
      { _id: 'r48-log', orderId: 'o9', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285551008', smsSent48h: false },
    ]);

    await processDelivery48hReminders();

    const logs = __getInserted('SMSLog');
    const log = logs.find(l => l.messageType === 'delivery_reminder_48h');
    expect(log).toBeTruthy();
    expect(log.orderNumber).toBe('o9');
  });

  it('reminder body includes STOP opt-out language', async () => {
    let capturedBody = '';
    __setHandler((url, opts) => {
      capturedBody = opts.body || '';
      return twilioSuccess()();
    });

    const target = daysFromNow(2);
    __seed('DeliverySchedule', [
      { _id: 'r48-stop', orderId: 'o10', date: target, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285551009', smsSent48h: false },
    ]);

    await processDelivery48hReminders();
    expect(capturedBody).toContain('STOP');
  });

  it('returns { sent: 0, failed: 0 } when no matching records', async () => {
    const result = await processDelivery48hReminders();
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });
});

// ── processDeliveryDayOfReminders ─────────────────────────────────────────────

describe('processDeliveryDayOfReminders', () => {
  it('sends reminder to eligible records and returns sent count', async () => {
    const today = daysFromNow(0);
    __seed('DeliverySchedule', [
      { _id: 'rdo-1', orderId: 'p1', date: today, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285552001', smsSentDayOf: false },
    ]);

    const result = await processDeliveryDayOfReminders();
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('marks smsSentDayOf on sent records', async () => {
    const today = daysFromNow(0);
    __seed('DeliverySchedule', [
      { _id: 'rdo-mark', orderId: 'p2', date: today, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285552002', smsSentDayOf: false },
    ]);

    await processDeliveryDayOfReminders();

    const updated = __getUpdated('DeliverySchedule').find(r => r._id === 'rdo-mark');
    expect(updated?.smsSentDayOf).toBe(true);
  });

  it('skips records already sent (smsSentDayOf: true)', async () => {
    const today = daysFromNow(0);
    __seed('DeliverySchedule', [
      { _id: 'rdo-skip', orderId: 'p3', date: today, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285552003', smsSentDayOf: true },
    ]);

    const result = await processDeliveryDayOfReminders();
    expect(result.sent).toBe(0);
  });

  it('skips records without smsOptIn', async () => {
    const today = daysFromNow(0);
    __seed('DeliverySchedule', [
      { _id: 'rdo-noopt', orderId: 'p4', date: today, type: 'white_glove', status: 'scheduled', smsOptIn: false, customerPhone: '8285552004', smsSentDayOf: false },
    ]);

    const result = await processDeliveryDayOfReminders();
    expect(result.sent).toBe(0);
  });

  it('counts failed for records with no valid phone', async () => {
    const today = daysFromNow(0);
    __seed('DeliverySchedule', [
      { _id: 'rdo-nophone', orderId: 'p5', date: today, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '', smsSentDayOf: false },
    ]);

    const result = await processDeliveryDayOfReminders();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('counts failed when Twilio returns error', async () => {
    __setHandler(twilioFailure());
    const today = daysFromNow(0);
    __seed('DeliverySchedule', [
      { _id: 'rdo-fail', orderId: 'p6', date: today, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285552005', smsSentDayOf: false },
    ]);

    const result = await processDeliveryDayOfReminders();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('does not send to records from yesterday', async () => {
    const yesterday = daysFromNow(-1);
    __seed('DeliverySchedule', [
      { _id: 'rdo-yest', orderId: 'p7', date: yesterday, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285552006', smsSentDayOf: false },
    ]);

    const result = await processDeliveryDayOfReminders();
    expect(result.sent).toBe(0);
  });

  it('logs SMS to SMSLog collection', async () => {
    const today = daysFromNow(0);
    __seed('DeliverySchedule', [
      { _id: 'rdo-log', orderId: 'p8', date: today, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285552007', smsSentDayOf: false },
    ]);

    await processDeliveryDayOfReminders();

    const logs = __getInserted('SMSLog');
    const log = logs.find(l => l.messageType === 'delivery_reminder_dayof');
    expect(log).toBeTruthy();
    expect(log.orderNumber).toBe('p8');
  });

  it('day-of body includes STOP opt-out language', async () => {
    let capturedBody = '';
    __setHandler((url, opts) => {
      capturedBody = opts.body || '';
      return twilioSuccess()();
    });

    const today = daysFromNow(0);
    __seed('DeliverySchedule', [
      { _id: 'rdo-stop', orderId: 'p9', date: today, type: 'white_glove', status: 'scheduled', smsOptIn: true, customerPhone: '8285552008', smsSentDayOf: false },
    ]);

    await processDeliveryDayOfReminders();
    expect(capturedBody).toContain('STOP');
  });

  it('returns { sent: 0, failed: 0 } when no matching records', async () => {
    const result = await processDeliveryDayOfReminders();
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });
});
