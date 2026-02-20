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
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const MAX_SLOTS_PER_WINDOW = 4; // Max deliveries per time window
const DELIVERY_DAYS = [3, 4, 5, 6]; // Wed=3, Thu=4, Fri=5, Sat=6
const BOOKING_WINDOW_DAYS = 21; // How far ahead can book

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

      // Check slot availability
      const booked = await countBookedSlots(date, timeWindow, type);
      if (booked >= MAX_SLOTS_PER_WINDOW) {
        return { success: false, message: 'This time slot is fully booked' };
      }

      // Check for existing schedule for this order
      const existing = await wixData.query('DeliverySchedule')
        .eq('orderId', orderId)
        .ne('status', 'cancelled')
        .find();

      if (existing.items.length > 0) {
        return { success: false, message: 'Delivery already scheduled for this order' };
      }

      const schedule = await wixData.insert('DeliverySchedule', {
        orderId,
        date,
        timeWindow,
        type,
        status: 'scheduled',
        customerEmail: sanitize(data.customerEmail || '', 254),
        customerPhone: sanitize(data.customerPhone || '', 20),
        address: sanitize(data.address || '', 500),
        notes: sanitize(data.notes || '', 1000),
        createdAt: new Date(),
      });

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
      const result = await wixData.query('DeliverySchedule')
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
