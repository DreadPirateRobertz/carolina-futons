/**
 * @module deliveryScheduling
 * @description Backend web module for delivery slot scheduling.
 * Provides slot-based scheduling for white-glove and standard deliveries.
 * Delivery windows: morning (9am-12pm) and afternoon (1pm-5pm), Wed-Sat only.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create 'DeliverySchedule' CMS collection with fields:
 *   orderId (Text), date (Date), timeWindow (Text: 'morning'|'afternoon'),
 *   type (Text: 'standard'|'white_glove'), status (Text), customerEmail (Text),
 *   customerPhone (Text), address (Text), notes (Text), createdAt (Date)
 *
 * Create 'ShowroomAppointments' CMS collection with fields:
 *   date (Text: YYYY-MM-DD), timeSlot (Text: HH:MM), visitType (Text),
 *   duration (Number: minutes), customerName (Text), customerEmail (Text),
 *   customerPhone (Text), productInterests (Text), notes (Text),
 *   status (Text: 'confirmed'|'cancelled'|'completed'), cancelToken (Text),
 *   createdAt (Date)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

/** Constant-time string comparison to prevent timing attacks on cancel tokens. */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const MAX_SLOTS_PER_WINDOW = 4; // Max deliveries per time window
const DELIVERY_DAYS = [3, 4, 5, 6]; // Wed=3, Thu=4, Fri=5, Sat=6
const BOOKING_WINDOW_DAYS = 21; // How far ahead can book

// ── Appointment constants ────────────────────────────────────────────
const MAX_CONCURRENT_VISITS = 3;
const APPOINTMENT_DAYS = [3, 4, 5, 6]; // Wed-Sat, same as delivery
const APPOINTMENT_WINDOW_DAYS = 21;
const VISIT_TYPES = {
  browse: { label: 'Browse Showroom', duration: 30 },
  consultation: { label: 'Design Consultation', duration: 60 },
  swatch: { label: 'Fabric Swatch Viewing', duration: 30 },
  pickup: { label: 'Order Pickup', duration: 30 },
};
// 30-min slots from 10:00 to 16:30 (last slot must end by 17:00)
const APPOINTMENT_SLOTS = [
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30',
];

/**
 * Get available delivery slots for the next 3 weeks.
 *
 * @function getAvailableDeliverySlots
 * @param {string} deliveryType - 'standard' or 'white_glove'
 * @returns {Promise<Array>} Available slots with date, timeWindow, spotsLeft
 * @permission SiteMember
 */
export const getAvailableDeliverySlots = webMethod(
  Permissions.SiteMember,
  async (deliveryType) => {
    try {
      const type = sanitize(deliveryType || 'standard', 20);
      const slots = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Start from tomorrow
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + 1);

      for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        if (!DELIVERY_DAYS.includes(date.getDay())) continue;

        for (const window of ['morning', 'afternoon']) {
          const dateStr = date.toISOString().split('T')[0];
          const booked = await countBookedSlots(dateStr, window, type);
          const spotsLeft = MAX_SLOTS_PER_WINDOW - booked;

          if (spotsLeft > 0) {
            slots.push({
              date: dateStr,
              dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
              timeWindow: window,
              timeLabel: window === 'morning' ? '9:00 AM - 12:00 PM' : '1:00 PM - 5:00 PM',
              spotsLeft,
              type,
            });
          }
        }
      }

      return slots;
    } catch (err) {
      console.error('Error getting delivery slots:', err);
      return [];
    }
  }
);

/**
 * Schedule a delivery for an order.
 *
 * @function scheduleDelivery
 * @param {Object} data - Scheduling data
 * @param {string} data.orderId - The order ID
 * @param {string} data.date - Delivery date (YYYY-MM-DD)
 * @param {string} data.timeWindow - 'morning' or 'afternoon'
 * @param {string} data.type - 'standard' or 'white_glove'
 * @param {string} [data.customerEmail] - Customer email for confirmation
 * @param {string} [data.customerPhone] - Customer phone
 * @param {string} [data.address] - Delivery address
 * @param {string} [data.notes] - Special instructions
 * @returns {Promise<Object>} { success, scheduleId?, message? }
 * @permission SiteMember
 */
export const scheduleDelivery = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      if (!data || !data.orderId || !data.date || !data.timeWindow) {
        return { success: false, message: 'Order ID, date, and time window are required' };
      }

      const orderId = sanitize(data.orderId, 50);
      const date = sanitize(data.date, 10);
      const timeWindow = sanitize(data.timeWindow, 20);
      const type = sanitize(data.type || 'standard', 20);

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, message: 'Invalid date format' };
      }

      // Validate date is a delivery day (Wed-Sat)
      const dateObj = new Date(date + 'T12:00:00');
      if (!DELIVERY_DAYS.includes(dateObj.getDay())) {
        return { success: false, message: 'Deliveries are only available Wednesday through Saturday' };
      }

      // Validate date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateObj <= today) {
        return { success: false, message: 'Delivery date must be in the future' };
      }

      // Validate date is within booking window
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + BOOKING_WINDOW_DAYS);
      if (dateObj > maxDate) {
        return { success: false, message: `Deliveries can only be scheduled up to ${BOOKING_WINDOW_DAYS} days in advance` };
      }

      // Check for existing schedule for this order
      const existing = await wixData.query('DeliverySchedule')
        .eq('orderId', orderId)
        .ne('status', 'cancelled')
        .find();

      if (existing.items.length > 0) {
        return { success: false, message: 'Delivery already scheduled for this order' };
      }

      // RACE FIX: Insert first with 'pending' status, then validate slot count.
      // This prevents two concurrent requests from both passing the count check.
      const schedule = await wixData.insert('DeliverySchedule', {
        orderId,
        date,
        timeWindow,
        type,
        status: 'pending',
        customerEmail: sanitize(data.customerEmail || '', 254),
        customerPhone: sanitize(data.customerPhone || '', 20),
        address: sanitize(data.address || '', 500),
        notes: sanitize(data.notes || '', 1000),
        createdAt: new Date(),
      });

      // Now count all booked + pending slots (including the one we just inserted)
      const booked = await countBookedSlots(date, timeWindow, type);
      if (booked > MAX_SLOTS_PER_WINDOW) {
        // Over capacity — rollback by removing our insertion
        await wixData.remove('DeliverySchedule', schedule._id);
        return { success: false, message: 'This time slot is fully booked' };
      }

      // Confirm the booking
      schedule.status = 'scheduled';
      await wixData.update('DeliverySchedule', schedule);

      return { success: true, scheduleId: schedule._id };
    } catch (err) {
      console.error('Error scheduling delivery:', err);
      return { success: false, message: 'Failed to schedule delivery' };
    }
  }
);

/**
 * Get the current member's delivery schedule.
 *
 * @function getMyDeliverySchedule
 * @returns {Promise<Array>} Member's scheduled deliveries
 * @permission SiteMember
 */
export const getMyDeliverySchedule = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      // Scope to current member's email to prevent data leaks
      const { currentMember } = await import('wix-members-backend');
      const member = await currentMember.getMember();
      if (!member?.loginEmail) return [];

      const result = await wixData.query('DeliverySchedule')
        .eq('customerEmail', member.loginEmail)
        .ne('status', 'cancelled')
        .descending('date')
        .find();

      return (result.items || []).map(s => ({
        _id: s._id,
        orderId: s.orderId,
        date: s.date,
        timeWindow: s.timeWindow,
        timeLabel: s.timeWindow === 'morning' ? '9:00 AM - 12:00 PM' : '1:00 PM - 5:00 PM',
        type: s.type,
        status: s.status,
      }));
    } catch (err) {
      console.error('Error getting delivery schedule:', err);
      return [];
    }
  }
);

// ── Showroom Appointment Booking ─────────────────────────────────────

/**
 * Get available showroom appointment slots for the next 3 weeks.
 *
 * @function getAvailableAppointmentSlots
 * @param {string} visitType - 'browse', 'consultation', 'swatch', or 'pickup'
 * @returns {Promise<Array>} Available slots with date, timeSlot, spotsLeft
 * @permission Anyone
 */
export const getAvailableAppointmentSlots = webMethod(
  Permissions.Anyone,
  async (visitType) => {
    try {
      const type = sanitize(visitType || 'browse', 20);
      if (!VISIT_TYPES[type]) {
        return [];
      }

      const duration = VISIT_TYPES[type].duration;
      const slotsNeeded = duration / 30; // How many 30-min blocks this visit takes
      const slots = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Start from tomorrow (min 1 day notice)
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + 1);

      for (let i = 0; i < APPOINTMENT_WINDOW_DAYS; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        if (!APPOINTMENT_DAYS.includes(date.getDay())) continue;

        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

        // Get all appointments for this date
        const dayAppointments = await getAppointmentsForDate(dateStr);

        for (const slotTime of APPOINTMENT_SLOTS) {
          // For 60-min visits, check that the next slot is also free
          if (slotsNeeded > 1) {
            const slotIdx = APPOINTMENT_SLOTS.indexOf(slotTime);
            if (slotIdx + slotsNeeded - 1 >= APPOINTMENT_SLOTS.length) continue;
          }

          // Count overlapping appointments at this time
          const concurrent = countConcurrentAtTime(dayAppointments, slotTime, slotsNeeded);
          const spotsLeft = MAX_CONCURRENT_VISITS - concurrent;

          if (spotsLeft > 0) {
            slots.push({
              date: dateStr,
              dayOfWeek,
              timeSlot: slotTime,
              timeLabel: formatTimeSlot(slotTime, duration),
              spotsLeft,
              visitType: type,
              visitLabel: VISIT_TYPES[type].label,
              duration,
            });
          }
        }
      }

      return slots;
    } catch (err) {
      console.error('Error getting appointment slots:', err);
      return [];
    }
  }
);

/**
 * Book a showroom appointment.
 *
 * @function bookAppointment
 * @param {Object} data - Appointment data
 * @param {string} data.date - Appointment date (YYYY-MM-DD)
 * @param {string} data.timeSlot - Time slot (HH:MM)
 * @param {string} data.visitType - 'browse', 'consultation', 'swatch', or 'pickup'
 * @param {string} data.customerName - Customer name
 * @param {string} data.customerEmail - Customer email
 * @param {string} [data.customerPhone] - Customer phone
 * @param {string} [data.productInterests] - Products customer wants to see
 * @param {string} [data.notes] - Additional notes
 * @returns {Promise<Object>} { success, appointmentId?, cancelToken?, message? }
 * @permission Anyone
 */
export const bookAppointment = webMethod(
  Permissions.Anyone,
  async (data) => {
    try {
      if (!data || !data.date || !data.timeSlot || !data.visitType ||
          !data.customerName || !data.customerEmail) {
        return { success: false, message: 'Date, time, visit type, name, and email are required' };
      }

      const date = sanitize(data.date, 10);
      const timeSlot = sanitize(data.timeSlot, 5);
      const visitType = sanitize(data.visitType, 20);
      const customerName = sanitize(data.customerName, 100);
      const customerEmail = sanitize(data.customerEmail, 254);

      if (!validateEmail(customerEmail)) {
        return { success: false, message: 'A valid email address is required' };
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, message: 'Invalid date format' };
      }

      if (!/^\d{2}:\d{2}$/.test(timeSlot) || !APPOINTMENT_SLOTS.includes(timeSlot)) {
        return { success: false, message: 'Invalid time slot' };
      }

      if (!VISIT_TYPES[visitType]) {
        return { success: false, message: 'Invalid visit type' };
      }

      // Validate date is a Wed-Sat
      const dateObj = new Date(date + 'T12:00:00');
      if (!APPOINTMENT_DAYS.includes(dateObj.getDay())) {
        return { success: false, message: 'Appointments are only available Wednesday through Saturday' };
      }

      // Validate date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateObj <= today) {
        return { success: false, message: 'Appointment date must be in the future' };
      }

      const duration = VISIT_TYPES[visitType].duration;
      const slotsNeeded = duration / 30;

      // Generate cancel token
      const cancelToken = generateToken();

      // RACE FIX: Insert with 'pending' first, then validate concurrency, rollback if over.
      const appointment = await wixData.insert('ShowroomAppointments', {
        date,
        timeSlot,
        visitType,
        duration,
        customerName,
        customerEmail,
        customerPhone: sanitize(data.customerPhone || '', 20),
        productInterests: sanitize(data.productInterests || '', 500),
        notes: sanitize(data.notes || '', 1000),
        status: 'pending',
        cancelToken,
        createdAt: new Date(),
      });

      // Re-check concurrency including our pending record
      const dayAppointments = await getAppointmentsForDate(date);
      // Also count pending appointments
      const pendingResult = await wixData.query('ShowroomAppointments')
        .eq('date', date)
        .eq('status', 'pending')
        .find();
      const allAppointments = [...dayAppointments, ...pendingResult.items];
      const concurrent = countConcurrentAtTime(allAppointments, timeSlot, slotsNeeded);

      if (concurrent > MAX_CONCURRENT_VISITS) {
        await wixData.remove('ShowroomAppointments', appointment._id);
        return { success: false, message: 'This time slot is fully booked' };
      }

      // Confirm the appointment
      appointment.status = 'confirmed';
      await wixData.update('ShowroomAppointments', appointment);

      return {
        success: true,
        appointmentId: appointment._id,
        cancelToken,
        confirmation: {
          date,
          dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()],
          timeLabel: formatTimeSlot(timeSlot, duration),
          visitLabel: VISIT_TYPES[visitType].label,
          address: '824 Locust St, Ste 200, Hendersonville, NC 28792',
          phone: '(828) 252-9449',
          mapUrl: 'https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792',
        },
      };
    } catch (err) {
      console.error('Error booking appointment:', err);
      return { success: false, message: 'Failed to book appointment' };
    }
  }
);

/**
 * Cancel a showroom appointment using the cancel token.
 *
 * @function cancelAppointment
 * @param {string} appointmentId - The appointment ID
 * @param {string} cancelToken - The cancel token from confirmation
 * @returns {Promise<Object>} { success, message? }
 * @permission Anyone
 */
export const cancelAppointment = webMethod(
  Permissions.Anyone,
  async (appointmentId, cancelToken) => {
    try {
      if (!appointmentId || !cancelToken) {
        return { success: false, message: 'Appointment ID and cancel token are required' };
      }

      const id = sanitize(appointmentId, 50);
      const token = sanitize(cancelToken, 50);

      const appointment = await wixData.get('ShowroomAppointments', id);
      if (!appointment) {
        return { success: false, message: 'Appointment not found' };
      }

      if (!timingSafeEqual(appointment.cancelToken, token)) {
        return { success: false, message: 'Invalid cancel token' };
      }

      if (appointment.status === 'cancelled') {
        return { success: false, message: 'Appointment is already cancelled' };
      }

      await wixData.update('ShowroomAppointments', {
        ...appointment,
        status: 'cancelled',
      });

      return { success: true };
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      return { success: false, message: 'Failed to cancel appointment' };
    }
  }
);

/**
 * Get upcoming appointments (admin view).
 *
 * @function getUpcomingAppointments
 * @returns {Promise<Array>} Upcoming confirmed appointments
 * @permission Admin
 */
export const getUpcomingAppointments = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const result = await wixData.query('ShowroomAppointments')
        .ge('date', todayStr)
        .eq('status', 'confirmed')
        .ascending('date')
        .ascending('timeSlot')
        .find();

      return (result.items || []).map(a => ({
        _id: a._id,
        date: a.date,
        timeSlot: a.timeSlot,
        timeLabel: formatTimeSlot(a.timeSlot, a.duration),
        visitType: a.visitType,
        visitLabel: VISIT_TYPES[a.visitType]?.label || a.visitType,
        duration: a.duration,
        customerName: a.customerName,
        customerEmail: a.customerEmail,
        customerPhone: a.customerPhone,
        productInterests: a.productInterests,
        notes: a.notes,
      }));
    } catch (err) {
      console.error('Error getting upcoming appointments:', err);
      return [];
    }
  }
);

/**
 * Get visit type options for display.
 *
 * @function getVisitTypes
 * @returns {Array} Visit type options with labels and durations
 * @permission Anyone
 */
export const getVisitTypes = webMethod(
  Permissions.Anyone,
  () => {
    return Object.entries(VISIT_TYPES).map(([key, val]) => ({
      value: key,
      label: val.label,
      duration: val.duration,
    }));
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

async function countBookedSlots(dateStr, timeWindow, type) {
  const result = await wixData.query('DeliverySchedule')
    .eq('date', dateStr)
    .eq('timeWindow', timeWindow)
    .eq('type', type)
    .ne('status', 'cancelled')
    .find();
  return result.items.length;
}

async function getAppointmentsForDate(dateStr) {
  const result = await wixData.query('ShowroomAppointments')
    .eq('date', dateStr)
    .eq('status', 'confirmed')
    .find();
  return result.items || [];
}

function countConcurrentAtTime(appointments, slotTime, slotsNeeded) {
  let maxConcurrent = 0;
  // Check each 30-min block this visit would occupy
  const slotIdx = APPOINTMENT_SLOTS.indexOf(slotTime);
  for (let s = 0; s < slotsNeeded; s++) {
    const checkSlot = APPOINTMENT_SLOTS[slotIdx + s];
    if (!checkSlot) continue;
    let count = 0;
    for (const appt of appointments) {
      const apptIdx = APPOINTMENT_SLOTS.indexOf(appt.timeSlot);
      const apptSlots = (appt.duration || 30) / 30;
      // Does this appointment overlap with checkSlot?
      const apptEnd = apptIdx + apptSlots;
      const checkIdx = APPOINTMENT_SLOTS.indexOf(checkSlot);
      if (checkIdx >= apptIdx && checkIdx < apptEnd) {
        count++;
      }
    }
    if (count > maxConcurrent) maxConcurrent = count;
  }
  return maxConcurrent;
}

function formatTimeSlot(timeSlot, duration) {
  const [h, m] = timeSlot.split(':').map(Number);
  const startDate = new Date(2000, 0, 1, h, m);
  const endDate = new Date(startDate.getTime() + duration * 60000);

  const fmt = (d) => {
    let hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${mins} ${ampm}`;
  };

  return `${fmt(startDate)} - ${fmt(endDate)}`;
}

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
