/**
 * @module whiteGloveScheduling
 * @description White-glove delivery appointment scheduling.
 * Customers book a 2-hour delivery window post-purchase.
 * Brenda (admin) can block dates and view the calendar.
 *
 * Windows: morning (10-12), midday (12-2), afternoon (2-4) — Mon-Sat only.
 * Lookahead: 14 days from tomorrow, skipping blocked dates.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires wix-crm-backend
 *
 * @setup
 * Create CMS collection `WhiteGloveAppointments` with fields:
 *   orderId (Text, indexed) - Wix order ID
 *   memberId (Text, indexed) - Customer member ID
 *   appointmentDate (Text) - YYYY-MM-DD
 *   window (Text) - 'morning'|'midday'|'afternoon'
 *   status (Text) - 'confirmed'|'cancelled'|'completed'
 *   customerEmail (Text) - For confirmation email
 *   customerPhone (Text)
 *   address (Text)
 *   notes (Text)
 *   rescheduleCount (Number) - Max 1 reschedule allowed
 *   smsOptIn (Boolean) - TCPA consent for SMS delivery notifications
 *   _createdDate (Date)
 *
 * Create CMS collection `BlockedDeliveryDates` with fields:
 *   blockedDate (Text, indexed, unique) - YYYY-MM-DD
 *   reason (Text) - e.g. 'store holiday', 'inventory day'
 *   blockedBy (Text) - admin email
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId, validatePhone } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';
import { validateSchema } from 'backend/utils/validateSchema';
import {
  sendWhiteGloveConfirmationSMS,
  sendWhiteGloveReminderSMS,
  sendWhiteGloveDayOfSMS,
} from 'backend/smsService.web';

// ── Constants ────────────────────────────────────────────────────────

/** Mon–Sat (JS day numbers 1–6) */
const DELIVERY_DAYS = [1, 2, 3, 4, 5, 6];

/** 2-hour arrival windows */
const DELIVERY_WINDOWS = {
  morning:   { label: '10:00 AM – 12:00 PM', start: 10, end: 12 },
  midday:    { label: '12:00 PM – 2:00 PM',  start: 12, end: 14 },
  afternoon: { label: '2:00 PM – 4:00 PM',   start: 14, end: 16 },
};

const VALID_WINDOWS = Object.keys(DELIVERY_WINDOWS);
const BOOKING_WINDOW_DAYS = 14;
const MAX_PER_WINDOW = 3;       // Max white-glove appointments per slot
const MAX_RESCHEDULES = 1;

// ── Helpers ──────────────────────────────────────────────────────────

async function getMemberId() {
  const member = await currentMember.getMember();
  return member?._id || null;
}

async function getBlockedDatesSet(fromDate, toDate) {
  const result = await wixData.query('BlockedDeliveryDates')
    .ge('blockedDate', fromDate)
    .le('blockedDate', toDate)
    .limit(60)
    .find();
  return new Set(result.items.map(r => r.blockedDate));
}

async function countBookedSlots(dateStr, windowKey) {
  const result = await wixData.query('WhiteGloveAppointments')
    .eq('appointmentDate', dateStr)
    .eq('window', windowKey)
    .ne('status', 'cancelled')
    .count();
  return result;
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// ── getWhiteGloveSlots ────────────────────────────────────────────────

/**
 * Returns available white-glove delivery slots for the next 14 days.
 * Skips Sundays, blocked dates, and full slots.
 *
 * @param {string} [orderId] - Optional — not used for filtering, passed for future dedup
 * @returns {Promise<{success: boolean, slots: Array<{date, dayOfWeek, window, label, available, spotsLeft}>}>}
 */
export const getWhiteGloveSlots = webMethod(Permissions.Anyone, async (_orderId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 1); // start from tomorrow

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + BOOKING_WINDOW_DAYS);

    const fromStr = toDateStr(startDate);
    const toStr   = toDateStr(endDate);

    const blocked = await getBlockedDatesSet(fromStr, toStr);

    const slots = [];

    for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      const day = date.getDay();
      if (!DELIVERY_DAYS.includes(day)) continue;

      const dateStr   = toDateStr(date);
      const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];

      if (blocked.has(dateStr)) continue;

      for (const [windowKey, meta] of Object.entries(DELIVERY_WINDOWS)) {
        const booked    = await countBookedSlots(dateStr, windowKey);
        const spotsLeft = Math.max(0, MAX_PER_WINDOW - booked);

        slots.push({
          date: dateStr,
          dayOfWeek,
          window: windowKey,
          label: meta.label,
          available: spotsLeft > 0,
          spotsLeft,
        });
      }
    }

    return { success: true, slots };
  } catch (err) {
    console.error('[whiteGloveScheduling] getWhiteGloveSlots error:', err);
    return { success: false, slots: [], error: 'Could not load available slots.' };
  }
});

// ── bookWhiteGloveDelivery ────────────────────────────────────────────

/**
 * Books a white-glove delivery appointment post-purchase.
 *
 * @param {Object} data
 * @param {string} data.orderId - Wix order ID
 * @param {string} data.appointmentDate - YYYY-MM-DD
 * @param {string} data.window - 'morning'|'midday'|'afternoon'
 * @param {string} [data.customerEmail]
 * @param {string} [data.customerPhone]
 * @param {string} [data.address]
 * @param {string} [data.notes]
 * @param {boolean} [data.smsOptIn] - TCPA consent: customer agrees to SMS delivery updates.
 */
export const bookWhiteGloveDelivery = webMethod(Permissions.SiteMember, async (data) => {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid booking data' };
    }

    const schemaErrors = validateSchema(data, {
      orderId:         { type: 'string',  required: true,  maxLength: 50,  label: 'Order ID' },
      appointmentDate: { type: 'string',  required: true,  maxLength: 10,  label: 'Date' },
      window:          { type: 'string',  required: true,  maxLength: 20,  label: 'Window' },
      customerEmail:   { type: 'string',  required: false, maxLength: 254, label: 'Email' },
      customerPhone:   { type: 'string',  required: false, maxLength: 20,  label: 'Phone' },
      address:         { type: 'string',  required: false, maxLength: 500, label: 'Address' },
      notes:           { type: 'string',  required: false, maxLength: 500, label: 'Notes' },
      smsOptIn:        { type: 'boolean', required: false,                 label: 'SMS opt-in' },
    });
    if (schemaErrors.length > 0) return { success: false, error: schemaErrors[0] };

    const memberId = await getMemberId();
    if (!memberId) return { success: false, error: 'Not authenticated' };

    const orderId  = sanitize(data.orderId, 50);
    const dateStr  = sanitize(data.appointmentDate, 10);
    const windowKey = sanitize(data.window, 20);

    if (!VALID_WINDOWS.includes(windowKey)) {
      return { success: false, error: 'Invalid delivery window' };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { success: false, error: 'Invalid date format' };
    }

    const dateObj = new Date(dateStr + 'T12:00:00');
    const today   = new Date();
    today.setHours(0, 0, 0, 0);

    if (!DELIVERY_DAYS.includes(dateObj.getDay())) {
      return { success: false, error: 'Deliveries are available Monday through Saturday' };
    }

    if (dateObj <= today) {
      return { success: false, error: 'Appointment date must be in the future' };
    }

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + BOOKING_WINDOW_DAYS);
    if (dateObj > maxDate) {
      return { success: false, error: `Appointments can only be scheduled up to ${BOOKING_WINDOW_DAYS} days in advance` };
    }

    // Check blocked
    const blocked = await getBlockedDatesSet(dateStr, dateStr);
    if (blocked.has(dateStr)) {
      return { success: false, error: 'This date is not available for delivery' };
    }

    // Check duplicate booking for this order
    const existing = await wixData.query('WhiteGloveAppointments')
      .eq('orderId', orderId)
      .ne('status', 'cancelled')
      .find();
    if (existing.items.length > 0) {
      return { success: false, error: 'Appointment already booked for this order' };
    }

    const { allowed } = await checkRateLimit('WhiteGloveBookingRateLimit', memberId);
    if (!allowed) {
      return { success: false, error: 'Too many booking attempts. Please try again later.' };
    }

    const smsOptIn = data.smsOptIn === true;
    const customerPhone = sanitize(data.customerPhone || '', 20);

    // Optimistic insert with 'pending' status, then check capacity
    const appointment = await wixData.insert('WhiteGloveAppointments', {
      orderId,
      memberId,
      appointmentDate: dateStr,
      window: windowKey,
      status: 'pending',
      customerEmail: sanitize(data.customerEmail || '', 254),
      customerPhone,
      address: sanitize(data.address || '', 500),
      notes: sanitize(data.notes || '', 500),
      rescheduleCount: 0,
      smsOptIn,
    });

    const booked = await countBookedSlots(dateStr, windowKey);
    if (booked > MAX_PER_WINDOW) {
      await wixData.remove('WhiteGloveAppointments', appointment._id);
      return { success: false, error: 'This time slot is now full. Please choose another.' };
    }

    await wixData.update('WhiteGloveAppointments', { ...appointment, status: 'confirmed' });

    logAuditEvent('WhiteGloveAppointments', 'book', appointment._id, { orderId, dateStr, windowKey });

    // Send booking confirmation SMS — fire-and-forget (don't fail the booking on SMS error)
    if (smsOptIn && customerPhone) {
      sendWhiteGloveConfirmationSMS({
        phone: customerPhone,
        appointmentDate: dateStr,
        windowLabel: DELIVERY_WINDOWS[windowKey].label,
        address: sanitize(data.address || '', 200),
        appointmentId: appointment._id,
      }).catch(err => console.error('[whiteGloveScheduling] SMS confirmation error:', err));
    }

    return {
      success: true,
      data: {
        _id: appointment._id,
        appointmentDate: dateStr,
        window: windowKey,
        windowLabel: DELIVERY_WINDOWS[windowKey].label,
      },
    };
  } catch (err) {
    console.error('[whiteGloveScheduling] bookWhiteGloveDelivery error:', err);
    return { success: false, error: 'Failed to book appointment' };
  }
});

// ── getMyWhiteGloveAppointment ────────────────────────────────────────

/**
 * Returns the appointment for a given order, or null if none.
 * @param {string} orderId
 */
export const getMyWhiteGloveAppointment = webMethod(Permissions.SiteMember, async (orderId) => {
  try {
    if (!validateId(orderId)) return { success: false, error: 'Invalid order ID' };

    const memberId = await getMemberId();
    if (!memberId) return { success: false, error: 'Not authenticated' };

    const result = await wixData.query('WhiteGloveAppointments')
      .eq('orderId', sanitize(orderId, 50))
      .eq('memberId', memberId)
      .ne('status', 'cancelled')
      .find();

    if (result.items.length === 0) {
      return { success: true, data: null };
    }

    const a = result.items[0];
    return {
      success: true,
      data: {
        _id: a._id,
        orderId: a.orderId,
        appointmentDate: a.appointmentDate,
        window: a.window,
        windowLabel: DELIVERY_WINDOWS[a.window]?.label || a.window,
        status: a.status,
        rescheduleCount: a.rescheduleCount || 0,
        canReschedule: (a.rescheduleCount || 0) < MAX_RESCHEDULES,
      },
    };
  } catch (err) {
    console.error('[whiteGloveScheduling] getMyWhiteGloveAppointment error:', err);
    return { success: false, error: 'Could not load appointment' };
  }
});

// ── rescheduleWhiteGlove ──────────────────────────────────────────────

/**
 * Reschedule a confirmed appointment. Allowed once only.
 * @param {string} appointmentId
 * @param {string} newDate - YYYY-MM-DD
 * @param {string} newWindow - 'morning'|'midday'|'afternoon'
 */
export const rescheduleWhiteGlove = webMethod(Permissions.SiteMember, async (appointmentId, newDate, newWindow) => {
  try {
    if (!validateId(appointmentId)) return { success: false, error: 'Invalid appointment ID' };

    const memberId = await getMemberId();
    if (!memberId) return { success: false, error: 'Not authenticated' };

    const appt = await wixData.get('WhiteGloveAppointments', appointmentId);
    if (!appt || appt.memberId !== memberId || appt.status === 'cancelled') {
      return { success: false, error: 'Appointment not found' };
    }

    if ((appt.rescheduleCount || 0) >= MAX_RESCHEDULES) {
      return { success: false, error: 'Maximum one reschedule allowed per appointment' };
    }

    const dateStr   = sanitize(newDate, 10);
    const windowKey = sanitize(newWindow, 20);

    if (!VALID_WINDOWS.includes(windowKey)) {
      return { success: false, error: 'Invalid delivery window' };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { success: false, error: 'Invalid date format' };
    }

    const dateObj = new Date(dateStr + 'T12:00:00');
    const today   = new Date();
    today.setHours(0, 0, 0, 0);

    if (!DELIVERY_DAYS.includes(dateObj.getDay())) {
      return { success: false, error: 'Deliveries are available Monday through Saturday' };
    }

    if (dateObj <= today) {
      return { success: false, error: 'Appointment date must be in the future' };
    }

    const blocked = await getBlockedDatesSet(dateStr, dateStr);
    if (blocked.has(dateStr)) {
      return { success: false, error: 'This date is not available' };
    }

    const booked = await countBookedSlots(dateStr, windowKey);
    if (booked >= MAX_PER_WINDOW) {
      return { success: false, error: 'This time slot is full. Please choose another.' };
    }

    await wixData.update('WhiteGloveAppointments', {
      ...appt,
      appointmentDate: dateStr,
      window: windowKey,
      rescheduleCount: (appt.rescheduleCount || 0) + 1,
    });

    logAuditEvent('WhiteGloveAppointments', 'reschedule', appointmentId, { dateStr, windowKey });

    return {
      success: true,
      data: {
        appointmentDate: dateStr,
        window: windowKey,
        windowLabel: DELIVERY_WINDOWS[windowKey].label,
      },
    };
  } catch (err) {
    console.error('[whiteGloveScheduling] rescheduleWhiteGlove error:', err);
    return { success: false, error: 'Failed to reschedule appointment' };
  }
});

// ── Admin: blockDeliveryDate ──────────────────────────────────────────

/**
 * Block a delivery date so no appointments can be booked on it.
 * @param {string} date - YYYY-MM-DD
 * @param {string} [reason] - e.g. 'store holiday'
 */
export const blockDeliveryDate = webMethod(Permissions.Admin, async (date, reason) => {
  try {
    const dateStr = sanitize(date || '', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { success: false, error: 'Invalid date format (YYYY-MM-DD)' };
    }

    // Upsert — if already blocked, update reason
    const existing = await wixData.query('BlockedDeliveryDates')
      .eq('blockedDate', dateStr)
      .find();

    if (existing.items.length > 0) {
      await wixData.update('BlockedDeliveryDates', {
        ...existing.items[0],
        reason: sanitize(reason || '', 200),
      });
    } else {
      await wixData.insert('BlockedDeliveryDates', {
        blockedDate: dateStr,
        reason: sanitize(reason || '', 200),
      });
    }

    logAuditEvent('BlockedDeliveryDates', 'block', dateStr, { reason });
    return { success: true, data: { blockedDate: dateStr } };
  } catch (err) {
    console.error('[whiteGloveScheduling] blockDeliveryDate error:', err);
    return { success: false, error: 'Failed to block date' };
  }
});

// ── Admin: unblockDeliveryDate ────────────────────────────────────────

/**
 * Remove a blocked date so appointments can be booked again.
 * @param {string} date - YYYY-MM-DD
 */
export const unblockDeliveryDate = webMethod(Permissions.Admin, async (date) => {
  try {
    const dateStr = sanitize(date || '', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { success: false, error: 'Invalid date format' };
    }

    const existing = await wixData.query('BlockedDeliveryDates')
      .eq('blockedDate', dateStr)
      .find();

    if (existing.items.length === 0) {
      return { success: false, error: 'Date is not blocked' };
    }

    await wixData.remove('BlockedDeliveryDates', existing.items[0]._id);
    logAuditEvent('BlockedDeliveryDates', 'unblock', dateStr, {});
    return { success: true };
  } catch (err) {
    console.error('[whiteGloveScheduling] unblockDeliveryDate error:', err);
    return { success: false, error: 'Failed to unblock date' };
  }
});

// ── Admin: getBlockedDates ────────────────────────────────────────────

/**
 * Returns all upcoming blocked delivery dates.
 * @returns {Promise<{success: boolean, data: Array<{blockedDate, reason}>}>}
 */
export const getBlockedDates = webMethod(Permissions.Admin, async () => {
  try {
    const todayStr = toDateStr(new Date());
    const result = await wixData.query('BlockedDeliveryDates')
      .ge('blockedDate', todayStr)
      .ascending('blockedDate')
      .limit(90)
      .find();

    return {
      success: true,
      data: result.items.map(r => ({
        _id: r._id,
        blockedDate: r.blockedDate,
        reason: r.reason || '',
      })),
    };
  } catch (err) {
    console.error('[whiteGloveScheduling] getBlockedDates error:', err);
    return { success: false, data: [], error: 'Could not load blocked dates' };
  }
});

// ── Admin: getAdminCalendar ───────────────────────────────────────────

/**
 * Returns all white-glove appointments in a date range for Brenda's admin dashboard.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export const getAdminCalendar = webMethod(Permissions.Admin, async (startDate, endDate) => {
  try {
    const from = sanitize(startDate || '', 10);
    const to   = sanitize(endDate   || '', 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return { success: false, data: [], error: 'Invalid date range' };
    }

    const result = await wixData.query('WhiteGloveAppointments')
      .ge('appointmentDate', from)
      .le('appointmentDate', to)
      .ne('status', 'cancelled')
      .ascending('appointmentDate')
      .ascending('window')
      .limit(200)
      .find();

    return {
      success: true,
      data: result.items.map(a => ({
        _id: a._id,
        orderId: a.orderId,
        appointmentDate: a.appointmentDate,
        window: a.window,
        windowLabel: DELIVERY_WINDOWS[a.window]?.label || a.window,
        status: a.status,
        customerEmail: a.customerEmail,
        customerPhone: a.customerPhone,
        address: a.address,
        notes: a.notes,
      })),
    };
  } catch (err) {
    console.error('[whiteGloveScheduling] getAdminCalendar error:', err);
    return { success: false, data: [], error: 'Could not load calendar' };
  }
});

// ── Public: getWindowLabels ───────────────────────────────────────────

/**
 * Returns the window label map for frontend display.
 */
export const getWindowLabels = webMethod(Permissions.Anyone, () => {
  return Object.entries(DELIVERY_WINDOWS).map(([key, meta]) => ({
    key,
    label: meta.label,
  }));
});

// ── CF-rjxq: Cron-triggered SMS reminder dispatchers ─────────────────────────

/**
 * Check whether an SMS of the given type was already sent for this appointment.
 * Uses SMSLog.productId to store the appointmentId for dedup.
 *
 * @param {string} appointmentId
 * @param {string} messageType
 * @returns {Promise<boolean>} true if already sent
 */
async function wasSmsSent(appointmentId, messageType) {
  const result = await wixData.query('SMSLog')
    .eq('messageType', messageType)
    .eq('productId', appointmentId)
    .limit(1)
    .find();
  return result.items.length > 0;
}

/**
 * Send 48-hour reminder SMS to all confirmed appointments 2 days from today.
 * Called by jobs.config cron. Skips appointments without smsOptIn or phone.
 * Deduplicates via SMSLog.
 *
 * CF-rjxq
 *
 * @returns {Promise<{success: boolean, sent: number, skipped: number}>}
 */
export const runWhiteGlove48hReminders = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      const targetDateStr = toDateStr(targetDate);

      const result = await wixData.query('WhiteGloveAppointments')
        .eq('appointmentDate', targetDateStr)
        .eq('status', 'confirmed')
        .limit(50)
        .find();

      let sent = 0;
      let skipped = 0;

      for (const appt of result.items) {
        if (!appt.smsOptIn || !appt.customerPhone) { skipped++; continue; }
        if (await wasSmsSent(appt._id, 'white_glove_48h_reminder')) { skipped++; continue; }

        const smsResult = await sendWhiteGloveReminderSMS({
          phone: appt.customerPhone,
          appointmentDate: appt.appointmentDate,
          windowLabel: DELIVERY_WINDOWS[appt.window]?.label || appt.window,
          appointmentId: appt._id,
        });

        if (smsResult.success) {
          sent++;
        } else {
          skipped++;
          console.error('[whiteGloveScheduling] 48h SMS failed for appt', appt._id, smsResult.reason);
        }
      }

      return { success: true, sent, skipped };
    } catch (err) {
      console.error('[whiteGloveScheduling] runWhiteGlove48hReminders error:', err);
      return { success: false, sent: 0, skipped: 0 };
    }
  }
);

/**
 * Send day-of delivery SMS to all confirmed appointments scheduled for today.
 * Called by jobs.config cron at 8 AM ET. Skips appointments without smsOptIn or phone.
 * Deduplicates via SMSLog.
 *
 * CF-rjxq
 *
 * @returns {Promise<{success: boolean, sent: number, skipped: number}>}
 */
export const runWhiteGloveDayOfReminders = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const todayStr = toDateStr(new Date());

      const result = await wixData.query('WhiteGloveAppointments')
        .eq('appointmentDate', todayStr)
        .eq('status', 'confirmed')
        .limit(50)
        .find();

      let sent = 0;
      let skipped = 0;

      for (const appt of result.items) {
        if (!appt.smsOptIn || !appt.customerPhone) { skipped++; continue; }
        if (await wasSmsSent(appt._id, 'white_glove_day_of')) { skipped++; continue; }

        const smsResult = await sendWhiteGloveDayOfSMS({
          phone: appt.customerPhone,
          windowLabel: DELIVERY_WINDOWS[appt.window]?.label || appt.window,
          appointmentId: appt._id,
        });

        if (smsResult.success) {
          sent++;
        } else {
          skipped++;
          console.error('[whiteGloveScheduling] day-of SMS failed for appt', appt._id, smsResult.reason);
        }
      }

      return { success: true, sent, skipped };
    } catch (err) {
      console.error('[whiteGloveScheduling] runWhiteGloveDayOfReminders error:', err);
      return { success: false, sent: 0, skipped: 0 };
    }
  }
);
