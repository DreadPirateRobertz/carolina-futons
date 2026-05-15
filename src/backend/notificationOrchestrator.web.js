/**
 * @module notificationOrchestrator
 * @description Orchestrates transactional SMS notifications triggered by
 * Wix eCommerce order lifecycle events.
 *
 * Wiring:
 *  - wixEcom_onOrderFulfilled → handleOrderFulfilled → sendOrderShippedSMS
 *    (live: dispatched from src/backend/events.js via dynamic import)
 *
 * Opt-in gate: SMS only fires if the member has SMS enabled and phone on record.
 * The gate is enforced inside smsService.checkPreferences — callers here do not
 * need to re-check it.
 *
 * NOTE: Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
 * are pending Stilgar. The integration will go live once secrets are added to
 * Wix Secrets Manager.
 *
 * @requires backend/smsService.web
 */
import { sanitize } from 'backend/utils/sanitize';

const UPS_TRACKING_BASE = 'https://www.ups.com/track?tracknum=';

/**
 * Build a UPS tracking URL from a tracking number.
 * @param {string} trackingNumber
 * @returns {string}
 */
export function buildTrackingUrl(trackingNumber) {
  const clean = sanitize(String(trackingNumber || ''), 50).replace(/[^A-Z0-9]/gi, '');
  if (!clean) return '';
  return `${UPS_TRACKING_BASE}${clean}`;
}

/**
 * Handle the wixEcom_onOrderFulfilled event.
 * Looks up the member by contactId, constructs the tracking URL, and
 * sends an "order shipped" SMS if the member opted in.
 *
 * Called from src/backend/events.js → wixEcom_onOrderFulfilled.
 *
 * @param {Object} params
 * @param {string} params.memberId - Wix member ID from buyer info.
 * @param {string} params.orderNumber - Order number.
 * @param {string} [params.trackingNumber] - UPS tracking number from fulfillment.
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
export async function handleOrderFulfilled({ memberId, orderNumber, trackingNumber } = {}) {
  if (!memberId || !orderNumber) {
    return { sent: false, reason: 'missing_params' };
  }

  try {
    const { sendOrderShippedSMS } = await import('backend/smsService.web');
    const trackingUrl = buildTrackingUrl(trackingNumber || '');

    const result = await sendOrderShippedSMS({ memberId, orderNumber, trackingUrl });
    return { sent: result.success, reason: result.reason };
  } catch (err) {
    console.error('[notificationOrchestrator] handleOrderFulfilled error:', err);
    return { sent: false, reason: 'error' };
  }
}

