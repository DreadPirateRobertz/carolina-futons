/**
 * Tests for CF-rjxq: White-glove delivery SMS notifications.
 *
 * Covers:
 *   - sendWhiteGloveConfirmationSMS (smsService.web.js)
 *   - sendWhiteGloveReminderSMS (smsService.web.js)
 *   - sendWhiteGloveDayOfSMS (smsService.web.js)
 *   - bookWhiteGloveDelivery — smsOptIn storage + confirmation SMS trigger
 *   - runWhiteGlove48hReminders (cron function)
 *   - runWhiteGloveDayOfReminders (cron function)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler, __reset as resetFetch } from './__mocks__/wix-fetch.js';
import {
  sendWhiteGloveConfirmationSMS,
  sendWhiteGloveReminderSMS,
  sendWhiteGloveDayOfSMS,
} from '../src/backend/smsService.web.js';
import {
  bookWhiteGloveDelivery,
  runWhiteGlove48hReminders,
  runWhiteGloveDayOfReminders,
} from '../src/backend/whiteGloveScheduling.web.js';

const MEMBER = { _id: 'mem-1', loginEmail: 'brenda@example.com' };

function twilioOkHandler(sid = 'SM_test_sid') {
  return (_url, _opts) => ({
    ok: true,
    status: 200,
    async json() { return { sid }; },
  });
}

function twilioFailHandler() {
  return (_url, _opts) => ({
    ok: false,
    status: 400,
    async json() { return { code: 21211, message: 'Invalid To number' }; },
  });
}

function futureDate(offsetDays = 2) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function dateInDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

beforeEach(() => {
  resetData();
  resetSecrets();
  resetFetch();
  __setMember(MEMBER);
  __seed('WhiteGloveAppointments', []);
  __seed('BlockedDeliveryDates', []);
  __seed('SMSLog', []);
  __seed('SMSPreferences', []);
  __setSecrets({
    TWILIO_ACCOUNT_SID: 'AC_test_sid',
    TWILIO_AUTH_TOKEN: 'test_auth_token',
    TWILIO_PHONE_NUMBER: '+18005551234',
  });
  __setHandler(twilioOkHandler());
});

// ── sendWhiteGloveConfirmationSMS ─────────────────────────────────────

describe('sendWhiteGloveConfirmationSMS', () => {
  it('sends SMS and returns success', async () => {
    let capturedBody = null;
    __setHandler((url, opts) => {
      capturedBody = decodeURIComponent(opts.body);
      return twilioOkHandler()(url, opts);
    });

    const result = await sendWhiteGloveConfirmationSMS({
      phone: '(828) 555-1234',
      appointmentDate: '2026-04-10',
      windowLabel: '10:00 AM – 12:00 PM',
      address: '123 Main St, Hendersonville NC',
      appointmentId: 'appt-1',
    });

    expect(result.success).toBe(true);
    expect(capturedBody).toContain('white-glove delivery');
    expect(capturedBody).toContain('10:00 AM');
    expect(capturedBody).toContain('123 Main St');
    expect(capturedBody).toContain('252-9449');
  });

  it('omits address line when address is empty', async () => {
    let capturedBody = null;
    __setHandler((url, opts) => {
      capturedBody = opts.body;
      return twilioOkHandler()(url, opts);
    });

    const result = await sendWhiteGloveConfirmationSMS({
      phone: '8285551234',
      appointmentDate: '2026-04-10',
      windowLabel: '2:00 PM – 4:00 PM',
    });

    expect(result.success).toBe(true);
    expect(capturedBody).not.toContain('Address:');
  });

  it('logs SMS to SMSLog with messageType white_glove_confirmation', async () => {
    let logged = null;
    __onInsert((col, item) => { if (col === 'SMSLog') logged = item; });

    await sendWhiteGloveConfirmationSMS({
      phone: '8285551234',
      appointmentDate: '2026-04-10',
      windowLabel: '10:00 AM – 12:00 PM',
      appointmentId: 'appt-42',
    });

    expect(logged?.messageType).toBe('white_glove_confirmation');
    expect(logged?.productId).toBe('appt-42');
  });

  it('returns invalid_input when required fields missing', async () => {
    const result = await sendWhiteGloveConfirmationSMS({ phone: '8285551234' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_input');
  });

  it('returns invalid_phone for bad phone number', async () => {
    const result = await sendWhiteGloveConfirmationSMS({
      phone: 'not-a-phone',
      appointmentDate: '2026-04-10',
      windowLabel: '10:00 AM – 12:00 PM',
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_phone');
  });

  it('returns send_failed when Twilio returns error', async () => {
    __setHandler(twilioFailHandler());
    const result = await sendWhiteGloveConfirmationSMS({
      phone: '8285551234',
      appointmentDate: '2026-04-10',
      windowLabel: '10:00 AM – 12:00 PM',
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('send_failed');
  });
});

// ── sendWhiteGloveReminderSMS ─────────────────────────────────────────

describe('sendWhiteGloveReminderSMS', () => {
  it('sends 48h reminder with day name and opt-out text', async () => {
    let capturedBody = null;
    __setHandler((url, opts) => {
      capturedBody = decodeURIComponent(opts.body);
      return twilioOkHandler()(url, opts);
    });

    const result = await sendWhiteGloveReminderSMS({
      phone: '8285551234',
      appointmentDate: '2026-04-10', // Friday
      windowLabel: '12:00 PM – 2:00 PM',
      appointmentId: 'appt-2',
    });

    expect(result.success).toBe(true);
    expect(capturedBody).toContain('Reminder');
    expect(capturedBody).toContain('white-glove delivery');
    expect(capturedBody).toContain('12:00 PM');
    expect(capturedBody).toContain('18+');
    expect(capturedBody).toContain('STOP');
  });

  it('logs SMS with messageType white_glove_48h_reminder', async () => {
    let logged = null;
    __onInsert((col, item) => { if (col === 'SMSLog') logged = item; });

    await sendWhiteGloveReminderSMS({
      phone: '8285551234',
      appointmentDate: '2026-04-10',
      windowLabel: '10:00 AM – 12:00 PM',
      appointmentId: 'appt-99',
    });

    expect(logged?.messageType).toBe('white_glove_48h_reminder');
    expect(logged?.productId).toBe('appt-99');
  });

  it('returns invalid_input when fields missing', async () => {
    const result = await sendWhiteGloveReminderSMS({ phone: '8285551234' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_input');
  });

  it('returns invalid_phone for bad number', async () => {
    const result = await sendWhiteGloveReminderSMS({
      phone: 'abc',
      appointmentDate: '2026-04-10',
      windowLabel: '10:00 AM – 12:00 PM',
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_phone');
  });
});

// ── sendWhiteGloveDayOfSMS ────────────────────────────────────────────

describe('sendWhiteGloveDayOfSMS', () => {
  it('sends day-of SMS with TODAY and callback language', async () => {
    let capturedBody = null;
    __setHandler((url, opts) => {
      capturedBody = decodeURIComponent(opts.body);
      return twilioOkHandler()(url, opts);
    });

    const result = await sendWhiteGloveDayOfSMS({
      phone: '8285551234',
      windowLabel: '2:00 PM – 4:00 PM',
      appointmentId: 'appt-3',
    });

    expect(result.success).toBe(true);
    expect(capturedBody).toContain('TODAY');
    expect(capturedBody).toContain('2:00 PM');
    expect(capturedBody).toContain('30 min');
    expect(capturedBody).toContain('252-9449');
  });

  it('logs SMS with messageType white_glove_day_of', async () => {
    let logged = null;
    __onInsert((col, item) => { if (col === 'SMSLog') logged = item; });

    await sendWhiteGloveDayOfSMS({
      phone: '8285551234',
      windowLabel: '10:00 AM – 12:00 PM',
      appointmentId: 'appt-77',
    });

    expect(logged?.messageType).toBe('white_glove_day_of');
    expect(logged?.productId).toBe('appt-77');
  });

  it('returns invalid_input when fields missing', async () => {
    const result = await sendWhiteGloveDayOfSMS({ phone: '8285551234' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_input');
  });

  it('returns send_failed when Twilio errors', async () => {
    __setHandler(twilioFailHandler());
    const result = await sendWhiteGloveDayOfSMS({
      phone: '8285551234',
      windowLabel: '10:00 AM – 12:00 PM',
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('send_failed');
  });
});

// ── bookWhiteGloveDelivery — smsOptIn storage ─────────────────────────

describe('bookWhiteGloveDelivery — smsOptIn', () => {
  it('stores smsOptIn=true on the appointment', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'WhiteGloveAppointments') inserted = item; });

    await bookWhiteGloveDelivery({
      orderId: 'order-10',
      appointmentDate: futureDate(3),
      window: 'morning',
      customerPhone: '8285551234',
      smsOptIn: true,
    });

    expect(inserted?.smsOptIn).toBe(true);
  });

  it('stores smsOptIn=false when not provided', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'WhiteGloveAppointments') inserted = item; });

    await bookWhiteGloveDelivery({
      orderId: 'order-11',
      appointmentDate: futureDate(3),
      window: 'morning',
    });

    expect(inserted?.smsOptIn).toBe(false);
  });

  it('does not send SMS when smsOptIn is false', async () => {
    let smsCalled = false;
    __setHandler((url, opts) => {
      if (url.includes('twilio.com')) smsCalled = true;
      return twilioOkHandler()(url, opts);
    });

    await bookWhiteGloveDelivery({
      orderId: 'order-12',
      appointmentDate: futureDate(3),
      window: 'morning',
      customerPhone: '8285551234',
      smsOptIn: false,
    });

    // SMS calls are async fire-and-forget, so wait a tick
    await new Promise(r => setTimeout(r, 10));
    expect(smsCalled).toBe(false);
  });

  it('does not fail booking if SMS errors', async () => {
    __setHandler(twilioFailHandler());

    const result = await bookWhiteGloveDelivery({
      orderId: 'order-13',
      appointmentDate: futureDate(3),
      window: 'morning',
      customerPhone: '8285551234',
      smsOptIn: true,
    });

    // Booking succeeds even though SMS will fail
    expect(result.success).toBe(true);
  });
});

// ── runWhiteGlove48hReminders ─────────────────────────────────────────

describe('runWhiteGlove48hReminders', () => {
  it('sends SMS to opted-in appointments 2 days out', async () => {
    const targetDate = dateInDays(2);
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-a', appointmentDate: targetDate, window: 'morning',
        status: 'confirmed', smsOptIn: true, customerPhone: '8285551234',
      },
    ]);

    let smsSent = 0;
    __setHandler((url, opts) => {
      if (url.includes('twilio.com')) smsSent++;
      return twilioOkHandler()(url, opts);
    });

    const result = await runWhiteGlove48hReminders();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(smsSent).toBe(1);
  });

  it('skips appointments without smsOptIn', async () => {
    const targetDate = dateInDays(2);
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-b', appointmentDate: targetDate, window: 'morning',
        status: 'confirmed', smsOptIn: false, customerPhone: '8285551234',
      },
    ]);

    const result = await runWhiteGlove48hReminders();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips appointments without customerPhone', async () => {
    const targetDate = dateInDays(2);
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-c', appointmentDate: targetDate, window: 'morning',
        status: 'confirmed', smsOptIn: true, customerPhone: '',
      },
    ]);

    const result = await runWhiteGlove48hReminders();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('deduplicates — skips if already logged in SMSLog', async () => {
    const targetDate = dateInDays(2);
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-d', appointmentDate: targetDate, window: 'morning',
        status: 'confirmed', smsOptIn: true, customerPhone: '8285551234',
      },
    ]);
    __seed('SMSLog', [
      { _id: 'log-1', messageType: 'white_glove_48h_reminder', productId: 'appt-d', sentAt: new Date() },
    ]);

    const result = await runWhiteGlove48hReminders();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('does not send to appointments on a different date', async () => {
    const wrongDate = dateInDays(3);
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-e', appointmentDate: wrongDate, window: 'morning',
        status: 'confirmed', smsOptIn: true, customerPhone: '8285551234',
      },
    ]);

    const result = await runWhiteGlove48hReminders();
    expect(result.sent).toBe(0);
  });

  it('skips cancelled appointments', async () => {
    const targetDate = dateInDays(2);
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-f', appointmentDate: targetDate, window: 'morning',
        status: 'cancelled', smsOptIn: true, customerPhone: '8285551234',
      },
    ]);

    const result = await runWhiteGlove48hReminders();
    expect(result.sent).toBe(0);
  });

  it('handles multiple appointments — sends to all eligible', async () => {
    const targetDate = dateInDays(2);
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-g1', appointmentDate: targetDate, window: 'morning',
        status: 'confirmed', smsOptIn: true, customerPhone: '8285551001',
      },
      {
        _id: 'appt-g2', appointmentDate: targetDate, window: 'afternoon',
        status: 'confirmed', smsOptIn: true, customerPhone: '8285551002',
      },
      {
        _id: 'appt-g3', appointmentDate: targetDate, window: 'midday',
        status: 'confirmed', smsOptIn: false, customerPhone: '8285551003',
      },
    ]);

    const result = await runWhiteGlove48hReminders();
    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(1);
  });
});

// ── runWhiteGloveDayOfReminders ───────────────────────────────────────

describe('runWhiteGloveDayOfReminders', () => {
  it('sends day-of SMS to opted-in appointments today', async () => {
    const today = todayStr();
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-h', appointmentDate: today, window: 'afternoon',
        status: 'confirmed', smsOptIn: true, customerPhone: '8285551234',
      },
    ]);

    let smsSent = 0;
    __setHandler((url, opts) => {
      if (url.includes('twilio.com')) smsSent++;
      return twilioOkHandler()(url, opts);
    });

    const result = await runWhiteGloveDayOfReminders();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(smsSent).toBe(1);
  });

  it('skips appointments not today', async () => {
    const tomorrow = dateInDays(1);
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-i', appointmentDate: tomorrow, window: 'morning',
        status: 'confirmed', smsOptIn: true, customerPhone: '8285551234',
      },
    ]);

    const result = await runWhiteGloveDayOfReminders();
    expect(result.sent).toBe(0);
  });

  it('deduplicates — skips if white_glove_day_of already logged', async () => {
    const today = todayStr();
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-j', appointmentDate: today, window: 'morning',
        status: 'confirmed', smsOptIn: true, customerPhone: '8285551234',
      },
    ]);
    __seed('SMSLog', [
      { _id: 'log-2', messageType: 'white_glove_day_of', productId: 'appt-j', sentAt: new Date() },
    ]);

    const result = await runWhiteGloveDayOfReminders();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips opted-out and missing-phone appointments', async () => {
    const today = todayStr();
    __seed('WhiteGloveAppointments', [
      {
        _id: 'appt-k1', appointmentDate: today, window: 'morning',
        status: 'confirmed', smsOptIn: false, customerPhone: '8285551111',
      },
      {
        _id: 'appt-k2', appointmentDate: today, window: 'midday',
        status: 'confirmed', smsOptIn: true, customerPhone: '',
      },
    ]);

    const result = await runWhiteGloveDayOfReminders();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it('returns success with zero when no appointments today', async () => {
    const result = await runWhiteGloveDayOfReminders();
    expect(result.success).toBe(true);
    expect(result.sent).toBe(0);
  });
});
