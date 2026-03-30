/**
 * @module smsService
 * @description Backend service for SMS notifications via Twilio.
 * Sends order confirmations, shipping updates, delivery reminders,
 * and back-in-stock alerts via text message.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-secrets-backend - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 * @requires wix-fetch
 * @requires backend/utils/sanitize
 *
 * @setup
 * 1. Create CMS collection `SMSPreferences` with fields:
 *    memberId (Text), phone (Text, E.164), smsEnabled (Boolean),
 *    orderConfirmations (Boolean), shippingUpdates (Boolean),
 *    deliveryReminders (Boolean), backInStockAlerts (Boolean),
 *    updatedAt (Date)
 * 2. Create CMS collection `SMSLog` with fields:
 *    memberId (Text), phone (Text), messageType (Text),
 *    messageBody (Text), twilioSid (Text), productId (Text),
 *    orderNumber (Text), sentAt (Date)
 * 3. Add Twilio secrets in Wix Secrets Manager:
 *    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';
import { sanitize, validatePhone, formatPhoneE164 } from 'backend/utils/sanitize';

const SMS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const SITE_URL = 'https://www.carolinafutons.com';

const STATUS_LABELS = {
  shipped: 'shipped',
  in_transit: 'in transit',
  out_for_delivery: 'out for delivery',
  delivered: 'delivered',
  exception: 'delayed — we\'re looking into it',
};

/**
 * Send an SMS via Twilio REST API.
 * @param {string} to - E.164 phone number.
 * @param {string} body - Message text.
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
      console.error('[smsService] Twilio error:', err);
      return { success: false };
    }

    const data = await response.json();
    return { success: true, sid: data.sid };
  } catch (err) {
    console.error('[smsService] Error sending SMS:', err);
    return { success: false };
  }
}

/**
 * Look up member's SMS preferences and validate they allow the given message type.
 * @param {string} memberId - Wix member ID.
 * @param {string} prefKey - Preference key to check (e.g. 'orderConfirmations').
 * @returns {Promise<{allowed: boolean, reason?: string, phone?: string}>}
 */
async function checkPreferences(memberId, prefKey) {
  const prefs = await wixData.query('SMSPreferences')
    .eq('memberId', memberId)
    .limit(1)
    .find();

  if (prefs.items.length === 0) {
    return { allowed: false, reason: 'no_preferences' };
  }

  const pref = prefs.items[0];

  if (!pref.smsEnabled) {
    return { allowed: false, reason: 'sms_disabled' };
  }

  if (!pref.phone || !validatePhone(pref.phone)) {
    return { allowed: false, reason: 'no_phone' };
  }

  if (pref[prefKey] === false) {
    return { allowed: false, reason: 'opted_out' };
  }

  return { allowed: true, phone: pref.phone };
}

/**
 * Check if an SMS of the same type was sent recently (within cooldown).
 * @param {string} memberId - Wix member ID.
 * @param {string} messageType - SMS message type.
 * @param {string} [productId] - Optional product ID for product-specific cooldown.
 * @returns {Promise<boolean>} True if within cooldown (should skip).
 */
async function isWithinCooldown(memberId, messageType, productId) {
  const cooldownDate = new Date(Date.now() - SMS_COOLDOWN_MS);

  let query = wixData.query('SMSLog')
    .eq('memberId', memberId)
    .eq('messageType', messageType)
    .ge('sentAt', cooldownDate);

  if (productId) {
    query = query.eq('productId', productId);
  }

  const recent = await query.limit(1).find();
  return recent.items.length > 0;
}

/**
 * Log a sent SMS to the SMSLog collection.
 * @param {Object} logData - Log entry fields.
 * @returns {Promise<void>}
 */
async function logSMS(logData) {
  try {
    await wixData.insert('SMSLog', {
      ...logData,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error('[smsService] Error logging SMS:', err);
  }
}

/**
 * Send an order confirmation SMS.
 *
 * @param {Object} params
 * @param {string} params.memberId - Wix member ID.
 * @param {string} params.orderNumber - Order number.
 * @param {number} params.orderTotal - Order total amount.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendOrderConfirmationSMS = webMethod(
  Permissions.Admin,
  async ({ memberId, orderNumber, orderTotal } = {}) => {
    try {
      if (!memberId) return { success: false, reason: 'invalid_input' };

      const check = await checkPreferences(memberId, 'orderConfirmations');
      if (!check.allowed) return { success: false, reason: check.reason };

      const cleanOrder = sanitize(String(orderNumber || ''), 50);
      const total = Number(orderTotal) || 0;

      const body = `Carolina Futons: Your order ${cleanOrder} for $${total.toFixed(2)} has been confirmed! We'll text you when it ships. Questions? Call (828) 252-9449`;

      const result = await sendViaTwilio(check.phone, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId,
        phone: check.phone,
        messageType: 'order_confirmation',
        messageBody: body,
        twilioSid: result.sid || '',
        orderNumber: cleanOrder,
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendOrderConfirmationSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Send a shipping update SMS.
 *
 * @param {Object} params
 * @param {string} params.memberId - Wix member ID.
 * @param {string} params.orderNumber - Order number.
 * @param {string} params.status - Shipping status key.
 * @param {string} [params.trackingNumber] - UPS tracking number.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendShippingUpdateSMS = webMethod(
  Permissions.Admin,
  async ({ memberId, orderNumber, status, trackingNumber } = {}) => {
    try {
      if (!memberId) return { success: false, reason: 'invalid_input' };

      const check = await checkPreferences(memberId, 'shippingUpdates');
      if (!check.allowed) return { success: false, reason: check.reason };

      const cleanOrder = sanitize(String(orderNumber || ''), 50);
      const statusLabel = STATUS_LABELS[status] || sanitize(String(status || ''), 30);
      const cleanTracking = trackingNumber ? sanitize(String(trackingNumber), 30) : '';

      let body = `Carolina Futons: Order ${cleanOrder} is ${statusLabel}.`;
      if (cleanTracking) {
        body += ` Track: ${cleanTracking}`;
      }
      body += ' Questions? (828) 252-9449';

      const result = await sendViaTwilio(check.phone, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId,
        phone: check.phone,
        messageType: 'shipping_update',
        messageBody: body,
        twilioSid: result.sid || '',
        orderNumber: cleanOrder,
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendShippingUpdateSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Send a delivery reminder SMS.
 *
 * @param {Object} params
 * @param {string} params.memberId - Wix member ID.
 * @param {string} params.orderNumber - Order number.
 * @param {string} params.deliveryDate - Delivery date (YYYY-MM-DD).
 * @param {string} params.timeWindow - 'morning' or 'afternoon'.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendDeliveryReminderSMS = webMethod(
  Permissions.Admin,
  async ({ memberId, orderNumber, deliveryDate, timeWindow } = {}) => {
    try {
      if (!memberId) return { success: false, reason: 'invalid_input' };

      const check = await checkPreferences(memberId, 'deliveryReminders');
      if (!check.allowed) return { success: false, reason: check.reason };

      const cleanOrder = sanitize(String(orderNumber || ''), 50);
      const cleanDate = sanitize(String(deliveryDate || ''), 20);
      const cleanWindow = sanitize(String(timeWindow || ''), 20);

      const windowDesc = cleanWindow === 'morning' ? 'morning (9am-12pm)' : 'afternoon (1pm-5pm)';

      const body = `Carolina Futons: Reminder — your order ${cleanOrder} is scheduled for delivery on ${cleanDate}, ${windowDesc}. Please ensure someone is available. Questions? (828) 252-9449`;

      const result = await sendViaTwilio(check.phone, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId,
        phone: check.phone,
        messageType: 'delivery_reminder',
        messageBody: body,
        twilioSid: result.sid || '',
        orderNumber: cleanOrder,
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendDeliveryReminderSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Send a back-in-stock SMS alert.
 *
 * @param {Object} params
 * @param {string} params.memberId - Wix member ID.
 * @param {string} params.productName - Product name.
 * @param {string} params.productSlug - Product URL slug.
 * @param {string} [params.productId] - Product ID (for cooldown check).
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendBackInStockSMS = webMethod(
  Permissions.Admin,
  async ({ memberId, productName, productSlug, productId } = {}) => {
    try {
      if (!memberId) return { success: false, reason: 'invalid_input' };

      const check = await checkPreferences(memberId, 'backInStockAlerts');
      if (!check.allowed) return { success: false, reason: check.reason };

      if (productId && await isWithinCooldown(memberId, 'back_in_stock', productId)) {
        return { success: false, reason: 'cooldown' };
      }

      const cleanName = sanitize(String(productName || ''), 100);
      const cleanSlug = sanitize(String(productSlug || ''), 100);

      const body = `Carolina Futons: ${cleanName} is back in stock! Shop now: ${SITE_URL}/product-page/${cleanSlug} — Questions? (828) 252-9449`;

      const result = await sendViaTwilio(check.phone, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId,
        phone: check.phone,
        messageType: 'back_in_stock',
        messageBody: body,
        twilioSid: result.sid || '',
        productId: productId || '',
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendBackInStockSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Update SMS notification preferences for the current member.
 *
 * @param {Object} params
 * @param {string} params.phone - Phone number (any US format).
 * @param {boolean} params.smsEnabled - Global SMS opt-in.
 * @param {boolean} [params.orderConfirmations] - Order confirmation texts.
 * @param {boolean} [params.shippingUpdates] - Shipping update texts.
 * @param {boolean} [params.deliveryReminders] - Delivery reminder texts.
 * @param {boolean} [params.backInStockAlerts] - Back-in-stock texts.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateSMSPreferences = webMethod(
  Permissions.SiteMember,
  async ({ phone, smsEnabled, orderConfirmations, shippingUpdates, deliveryReminders, backInStockAlerts } = {}) => {
    try {
      const { currentMember } = await import('wix-members-backend');
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Not authenticated' };

      if (!validatePhone(phone)) {
        return { success: false, error: 'Invalid phone number' };
      }

      const formattedPhone = formatPhoneE164(phone);

      const existing = await wixData.query('SMSPreferences')
        .eq('memberId', member._id)
        .limit(1)
        .find();

      const prefData = {
        memberId: member._id,
        phone: formattedPhone,
        smsEnabled: !!smsEnabled,
        orderConfirmations: orderConfirmations !== false,
        shippingUpdates: shippingUpdates !== false,
        deliveryReminders: deliveryReminders !== false,
        backInStockAlerts: !!backInStockAlerts,
        updatedAt: new Date(),
      };

      if (existing.items.length > 0) {
        prefData._id = existing.items[0]._id;
        await wixData.update('SMSPreferences', prefData);
      } else {
        await wixData.insert('SMSPreferences', prefData);
      }

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in updateSMSPreferences:', err);
      return { success: false, error: 'Failed to update preferences' };
    }
  }
);

// ── Order Shipped / Delivery Confirmed (CF-an2c) ─────────────────────────────

/**
 * Send "order shipped" SMS with UPS tracking URL.
 * Triggered by wixEcom_onOrderFulfilled via notificationOrchestrator.
 *
 * @param {Object} params
 * @param {string} params.memberId - Wix member ID.
 * @param {string} params.orderNumber - Order number.
 * @param {string} [params.trackingUrl] - Full UPS tracking URL.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendOrderShippedSMS = webMethod(
  Permissions.Admin,
  async ({ memberId, orderNumber, trackingUrl } = {}) => {
    try {
      if (!memberId) return { success: false, reason: 'invalid_input' };

      const check = await checkPreferences(memberId, 'shippingUpdates');
      if (!check.allowed) return { success: false, reason: check.reason };

      const cleanOrder = sanitize(String(orderNumber || ''), 50);
      const cleanUrl = sanitize(String(trackingUrl || ''), 300);

      let body = `Your Carolina Futons order is on the way!`;
      if (cleanUrl) {
        body += ` Track: ${cleanUrl}`;
      }

      const result = await sendViaTwilio(check.phone, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId,
        phone: check.phone,
        messageType: 'order_shipped',
        messageBody: body,
        twilioSid: result.sid || '',
        orderNumber: cleanOrder,
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendOrderShippedSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Send "delivery confirmed" SMS when UPS marks a package delivered.
 * Triggered by notificationOrchestrator on UPS delivered event/polling.
 *
 * @param {Object} params
 * @param {string} params.memberId - Wix member ID.
 * @param {string} params.orderNumber - Order number.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendDeliveryConfirmedSMS = webMethod(
  Permissions.Admin,
  async ({ memberId, orderNumber } = {}) => {
    try {
      if (!memberId) return { success: false, reason: 'invalid_input' };

      const check = await checkPreferences(memberId, 'shippingUpdates');
      if (!check.allowed) return { success: false, reason: check.reason };

      // Cooldown: don't send delivery confirmed more than once per order
      const cleanOrder = sanitize(String(orderNumber || ''), 50);
      if (await isWithinCooldown(memberId, 'delivery_confirmed', cleanOrder)) {
        return { success: false, reason: 'cooldown' };
      }

      const body = `Your order has been delivered! Questions? Reply to this message or call (828) 252-9449`;

      const result = await sendViaTwilio(check.phone, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId,
        phone: check.phone,
        messageType: 'delivery_confirmed',
        messageBody: body,
        twilioSid: result.sid || '',
        orderNumber: cleanOrder,
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendDeliveryConfirmedSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Get SMS notification preferences for the current member.
 *
 * @returns {Promise<{success: boolean, preferences?: Object}>}
 */
export const getSMSPreferences = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const { currentMember } = await import('wix-members-backend');
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false };

      const result = await wixData.query('SMSPreferences')
        .eq('memberId', member._id)
        .limit(1)
        .find();

      if (result.items.length === 0) {
        return {
          success: true,
          preferences: {
            smsEnabled: false,
            orderConfirmations: true,
            shippingUpdates: true,
            deliveryReminders: true,
            backInStockAlerts: true,
            phone: '',
          },
        };
      }

      const pref = result.items[0];
      return {
        success: true,
        preferences: {
          smsEnabled: !!pref.smsEnabled,
          orderConfirmations: pref.orderConfirmations !== false,
          shippingUpdates: pref.shippingUpdates !== false,
          deliveryReminders: pref.deliveryReminders !== false,
          backInStockAlerts: !!pref.backInStockAlerts,
          phone: pref.phone || '',
        },
      };
    } catch (err) {
      console.error('[smsService] Error in getSMSPreferences:', err);
      return { success: false };
    }
  }
);

// ── CF-rjxq: White-glove delivery SMS ────────────────────────────────────────

const WG_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format YYYY-MM-DD as "April 2, 2026".
 * @param {string} dateStr
 * @returns {string}
 */
function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Send booking confirmation SMS for a white-glove delivery appointment.
 * Phone is taken directly from the booking form (opt-in captured there).
 *
 * @param {Object} params
 * @param {string} params.phone - Customer phone (any US format).
 * @param {string} params.appointmentDate - YYYY-MM-DD
 * @param {string} params.windowLabel - e.g. '10:00 AM – 12:00 PM'
 * @param {string} [params.address] - Delivery address.
 * @param {string} [params.appointmentId] - For dedup logging.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendWhiteGloveConfirmationSMS = webMethod(
  Permissions.Admin,
  async ({ phone, appointmentDate, windowLabel, address, appointmentId } = {}) => {
    try {
      if (!phone || !appointmentDate || !windowLabel) {
        return { success: false, reason: 'invalid_input' };
      }

      if (!validatePhone(phone)) return { success: false, reason: 'invalid_phone' };
      const to = formatPhoneE164(phone);

      const dateLong = formatDateLong(sanitize(String(appointmentDate), 10));
      const cleanWindow = sanitize(String(windowLabel), 40);
      const cleanAddress = address ? sanitize(String(address), 200) : '';

      let body = `Your Carolina Futons white-glove delivery is scheduled for ${dateLong} between ${cleanWindow}.`;
      if (cleanAddress) body += ` Address: ${cleanAddress}.`;
      body += ` Questions? Call (828) 252-9449`;

      const result = await sendViaTwilio(to, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId: '',
        phone: to,
        messageType: 'white_glove_confirmation',
        messageBody: body,
        twilioSid: result.sid || '',
        productId: sanitize(String(appointmentId || ''), 50),
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendWhiteGloveConfirmationSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Send 48-hour reminder SMS for a white-glove delivery appointment.
 *
 * @param {Object} params
 * @param {string} params.phone - Customer phone (E.164 or US format).
 * @param {string} params.appointmentDate - YYYY-MM-DD (used to derive day name).
 * @param {string} params.windowLabel - e.g. '10:00 AM – 12:00 PM'
 * @param {string} [params.appointmentId] - For dedup logging.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendWhiteGloveReminderSMS = webMethod(
  Permissions.Admin,
  async ({ phone, appointmentDate, windowLabel, appointmentId } = {}) => {
    try {
      if (!phone || !appointmentDate || !windowLabel) {
        return { success: false, reason: 'invalid_input' };
      }

      if (!validatePhone(phone)) return { success: false, reason: 'invalid_phone' };
      const to = formatPhoneE164(phone);

      const dayName = WG_DAY_NAMES[new Date(sanitize(String(appointmentDate), 10) + 'T12:00:00').getDay()];
      const cleanWindow = sanitize(String(windowLabel), 40);

      const body = `Reminder: Carolina Futons white-glove delivery THIS ${dayName} between ${cleanWindow}. Please ensure someone 18+ is home. Reply STOP to opt out.`;

      const result = await sendViaTwilio(to, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId: '',
        phone: to,
        messageType: 'white_glove_48h_reminder',
        messageBody: body,
        twilioSid: result.sid || '',
        productId: sanitize(String(appointmentId || ''), 50),
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendWhiteGloveReminderSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Send day-of delivery SMS for a white-glove appointment (8 AM ET).
 *
 * @param {Object} params
 * @param {string} params.phone - Customer phone (E.164 or US format).
 * @param {string} params.windowLabel - e.g. '10:00 AM – 12:00 PM'
 * @param {string} [params.appointmentId] - For dedup logging.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendWhiteGloveDayOfSMS = webMethod(
  Permissions.Admin,
  async ({ phone, windowLabel, appointmentId } = {}) => {
    try {
      if (!phone || !windowLabel) return { success: false, reason: 'invalid_input' };

      if (!validatePhone(phone)) return { success: false, reason: 'invalid_phone' };
      const to = formatPhoneE164(phone);

      const cleanWindow = sanitize(String(windowLabel), 40);

      const body = `Good morning! Your Carolina Futons delivery is TODAY between ${cleanWindow}. Our team will call 30 min before arrival. (828) 252-9449`;

      const result = await sendViaTwilio(to, body);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId: '',
        phone: to,
        messageType: 'white_glove_day_of',
        messageBody: body,
        twilioSid: result.sid || '',
        productId: sanitize(String(appointmentId || ''), 50),
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendWhiteGloveDayOfSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);

// ── CF-qhdo: Challenge alert SMS ──────────────────────────────────────────────

/**
 * Send a challenge alert SMS to a member.
 * Checks SMS preferences (smsEnabled + valid phone). No preference key gate
 * beyond smsEnabled — challenge alerts are a new category.
 *
 * CF-qhdo
 *
 * @param {Object} params
 * @param {string} params.memberId
 * @param {string} params.message - SMS body text
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export const sendChallengeAlertSMS = webMethod(
  Permissions.Admin,
  async ({ memberId, message } = {}) => {
    try {
      if (!memberId || !message) return { success: false, reason: 'invalid_input' };

      const check = await checkPreferences(memberId, 'smsEnabled');
      if (!check.allowed) return { success: false, reason: check.reason };

      if (await isWithinCooldown(memberId, 'challenge_alert')) {
        return { success: false, reason: 'cooldown' };
      }

      const result = await sendViaTwilio(check.phone, message);
      if (!result.success) return { success: false, reason: 'send_failed' };

      await logSMS({
        memberId,
        phone: check.phone,
        messageType: 'challenge_alert',
        messageBody: message,
        twilioSid: result.sid || '',
      });

      return { success: true };
    } catch (err) {
      console.error('[smsService] Error in sendChallengeAlertSMS:', err);
      return { success: false, reason: 'error' };
    }
  }
);
