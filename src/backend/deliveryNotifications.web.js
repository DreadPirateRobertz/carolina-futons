/**
 * @module deliveryNotifications
 * @description SMS notifications for white-glove delivery appointments.
 *
 * Three touchpoints:
 *   1. Booking confirmation — sent immediately when scheduleDelivery() succeeds.
 *   2. 48-hour reminder   — cron job runs daily at 10 AM EST, targets +2 day deliveries.
 *   3. Day-of reminder    — cron job runs daily at 8 AM EST, targets today's deliveries.
 *
 * TCPA compliance: all messages include "Reply STOP to opt out."
 * SMS is only sent when DeliverySchedule.smsOptIn === true and a valid phone is stored.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-secrets-backend - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 * @requires wix-fetch
 * @requires backend/utils/sanitize
 *
 * @setup DeliverySchedule CMS collection must include:
 *   customerPhone (Text)    — stored at booking time
 *   smsOptIn (Boolean)      — TCPA opt-in captured at booking time
 *   smsSentConfirmation (Boolean) — dedup: booking confirmation sent
 *   smsSent48h (Boolean)    — dedup: 48-hour reminder sent
 *   smsSentDayOf (Boolean)  — dedup: day-of reminder sent
 *
 * CF-rjxq
 */
import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';
import { sanitize, validatePhone, formatPhoneE164 } from 'backend/utils/sanitize';

const COLLECTION = 'DeliverySchedule';
const PHONE = '(828) 252-9449';

// ── Twilio helpers ─────────────────────────────────────────────────────────────

/**
 * Send an SMS via Twilio REST API.
 * @param {string} to - E.164 phone number.
 * @param {string} body - Message text (≤160 chars recommended).
 * @returns {Promise<{success: boolean, sid?: string}>}
 */
async function sendViaTwilio(to, body) {
  try {
    const accountSid = await getSecret('TWILIO_ACCOUNT_SID');
    const authToken = await getSecret('TWILIO_AUTH_TOKEN');
    const fromNumber = await getSecret('TWILIO_PHONE_NUMBER');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `To=${encodeURIComponent(to)}&From=${encodeURIComponent(fromNumber)}&Body=${encodeURIComponent(body)}`,
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('[deliveryNotifications] Twilio error:', err);
      return { success: false };
    }

    const data = await response.json();
    return { success: true, sid: data.sid };
  } catch (err) {
    console.error('[deliveryNotifications] sendViaTwilio failed:', err?.message);
    return { success: false };
  }
}

/**
 * Log a sent SMS to the SMSLog collection.
 * @param {Object} logData
 * @returns {Promise<void>}
 */
async function logSms(logData) {
  try {
    await wixData.insert('SMSLog', { ...logData, sentAt: new Date() }, { suppressAuth: true });
  } catch (err) {
    console.error('[deliveryNotifications] logSms failed:', err?.message);
  }
}

// ── Booking confirmation ───────────────────────────────────────────────────────

/**
 * Send booking confirmation SMS immediately after white-glove delivery is scheduled.
 * Called by scheduleDelivery() in deliveryScheduling.web.js — not a webMethod.
 *
 * @param {Object} params
 * @param {string} params.scheduleId   - DeliverySchedule record _id (for dedup flag)
 * @param {string} params.customerPhone - Customer phone (any US format)
 * @param {string} params.orderId       - Order ID (for SMS log)
 * @param {string} params.date          - Delivery date (YYYY-MM-DD)
 * @param {string} params.timeWindow    - 'morning' | 'afternoon'
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export async function sendDeliveryBookingConfirmationSms({ scheduleId, customerPhone, orderId, date, timeWindow }) {
  try {
    if (!customerPhone || !validatePhone(customerPhone)) {
      return { success: false, reason: 'invalid_phone' };
    }

    const phone = formatPhoneE164(customerPhone);
    const windowDesc = timeWindow === 'morning' ? '9 AM–12 PM' : '1–5 PM';
    const body =
      `Carolina Futons: Your white-glove delivery is confirmed for ${date}, ${windowDesc}. ` +
      `We'll send a reminder the day before. Questions? ${PHONE}. Reply STOP to opt out.`;

    const result = await sendViaTwilio(phone, body);
    if (!result.success) return { success: false, reason: 'send_failed' };

    await logSms({
      memberId: '',
      phone,
      messageType: 'delivery_booking_confirmation',
      messageBody: body,
      twilioSid: result.sid || '',
      orderNumber: sanitize(String(orderId || ''), 50),
    });

    // Mark confirmation sent — non-fatal if dedup flag fails to persist
    try {
      const record = await wixData.get(COLLECTION, scheduleId, { suppressAuth: true });
      if (record) {
        await wixData.update(COLLECTION, { ...record, smsSentConfirmation: true }, { suppressAuth: true });
      }
    } catch (_) { /* non-fatal */ }

    return { success: true };
  } catch (err) {
    console.error('[deliveryNotifications] sendDeliveryBookingConfirmationSms failed:', err?.message);
    return { success: false, reason: 'error' };
  }
}

// ── 48-hour reminder (cron) ────────────────────────────────────────────────────

/**
 * Process 48-hour delivery reminder SMS batch.
 * Targets all white-glove deliveries scheduled exactly 2 days from today
 * that have smsOptIn=true and haven't received a 48h reminder yet.
 *
 * Scheduled daily at 10 AM EST (15:00 UTC) via jobs.config.
 *
 * @returns {Promise<{sent: number, failed: number}>}
 * @permission Admin
 */
export const processDelivery48hReminders = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const target = new Date();
      target.setDate(target.getDate() + 2);
      const targetDate = target.toISOString().split('T')[0];

      const result = await wixData
        .query(COLLECTION)
        .eq('date', targetDate)
        .eq('type', 'white_glove')
        .eq('status', 'scheduled')
        .eq('smsOptIn', true)
        .ne('smsSent48h', true)
        .find({ suppressAuth: true });

      let sent = 0;
      let failed = 0;

      for (const record of result.items) {
        if (!record.customerPhone || !validatePhone(record.customerPhone)) {
          failed++;
          continue;
        }

        const phone = formatPhoneE164(record.customerPhone);
        const windowDesc = record.timeWindow === 'morning' ? '9 AM–12 PM' : '1–5 PM';
        const body =
          `Carolina Futons: Reminder — your white-glove delivery is TOMORROW, ` +
          `${record.date}, ${windowDesc}. Please clear the delivery path. ` +
          `Questions? ${PHONE}. Reply STOP to opt out.`;

        const smsResult = await sendViaTwilio(phone, body);
        if (smsResult.success) {
          await logSms({
            memberId: '',
            phone,
            messageType: 'delivery_reminder_48h',
            messageBody: body,
            twilioSid: smsResult.sid || '',
            orderNumber: sanitize(String(record.orderId || ''), 50),
          });
          await wixData.update(COLLECTION, { ...record, smsSent48h: true }, { suppressAuth: true });
          sent++;
        } else {
          failed++;
        }
      }

      return { sent, failed };
    } catch (err) {
      console.error('[deliveryNotifications] processDelivery48hReminders failed:', err?.message);
      return { sent: 0, failed: 0 };
    }
  }
);

// ── Day-of reminder (cron) ────────────────────────────────────────────────────

/**
 * Process day-of delivery reminder SMS batch.
 * Targets all white-glove deliveries scheduled for today that have
 * smsOptIn=true and haven't received a day-of reminder yet.
 *
 * Scheduled daily at 8 AM EST (13:00 UTC) via jobs.config.
 *
 * @returns {Promise<{sent: number, failed: number}>}
 * @permission Admin
 */
export const processDeliveryDayOfReminders = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const result = await wixData
        .query(COLLECTION)
        .eq('date', today)
        .eq('type', 'white_glove')
        .eq('status', 'scheduled')
        .eq('smsOptIn', true)
        .ne('smsSentDayOf', true)
        .find({ suppressAuth: true });

      let sent = 0;
      let failed = 0;

      for (const record of result.items) {
        if (!record.customerPhone || !validatePhone(record.customerPhone)) {
          failed++;
          continue;
        }

        const phone = formatPhoneE164(record.customerPhone);
        const windowDesc = record.timeWindow === 'morning' ? '9 AM–12 PM' : '1–5 PM';
        const body =
          `Carolina Futons: Your white-glove delivery is TODAY, ${windowDesc}. ` +
          `Our team is on the way! Questions? ${PHONE}. Reply STOP to opt out.`;

        const smsResult = await sendViaTwilio(phone, body);
        if (smsResult.success) {
          await logSms({
            memberId: '',
            phone,
            messageType: 'delivery_reminder_dayof',
            messageBody: body,
            twilioSid: smsResult.sid || '',
            orderNumber: sanitize(String(record.orderId || ''), 50),
          });
          await wixData.update(COLLECTION, { ...record, smsSentDayOf: true }, { suppressAuth: true });
          sent++;
        } else {
          failed++;
        }
      }

      return { sent, failed };
    } catch (err) {
      console.error('[deliveryNotifications] processDeliveryDayOfReminders failed:', err?.message);
      return { sent: 0, failed: 0 };
    }
  }
);
