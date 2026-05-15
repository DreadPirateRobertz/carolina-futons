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
 * Observability (cf-4x7e.4):
 *  - All caught errors route through `logError(context, err)` so Wix runtime
 *    logs carry a stable context string for grep/alerting. The context names
 *    both the surface and the failure stage (e.g. `:module-load` vs `:send`).
 *  - The returned `{sent:false, reason}` envelope distinguishes failure
 *    classes the upstream event handler can branch on:
 *      `missing_params`         — caller didn't pass memberId or orderNumber
 *      `smsService_unavailable` — dynamic import failed (Wix runtime, code split)
 *      `send_error`             — Twilio/network/other thrown failure
 *      whatever smsService returned (e.g. `sms_disabled` opt-out)
 *
 * NOTE: Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
 * are pending Stilgar. The integration will go live once secrets are added to
 * Wix Secrets Manager.
 *
 * @requires backend/smsService.web
 * @requires backend/utils/errorHandler
 */
import { sanitize } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

const UPS_TRACKING_BASE = 'https://www.ups.com/track?tracknum=';

/**
 * Build a UPS tracking URL from a tracking number.
 *
 * Strips non-alphanumeric chars (UPS tracking numbers are A-Z + 0-9 only)
 * after sanitizing to the first 50 chars so a pathologically long input
 * can't grow an unbounded URL.
 *
 * @param {string} trackingNumber - Raw tracking number (any case, hyphens OK).
 * @returns {string} The full UPS tracking URL, or `""` if the cleaned
 *   tracking number is empty.
 */
export function buildTrackingUrl(trackingNumber) {
  const clean = sanitize(String(trackingNumber || ''), 50).replace(/[^A-Z0-9]/gi, '');
  if (!clean) return '';
  return `${UPS_TRACKING_BASE}${clean}`;
}

/**
 * Handle the `wixEcom_onOrderFulfilled` event.
 *
 * Constructs the tracking URL and dispatches an "order shipped" SMS via
 * smsService. The downstream service enforces the member's SMS opt-in
 * preference; callers here treat its `{success:false, reason}` envelope
 * as a normal negative response (no log) vs a thrown error (logged).
 *
 * Failure handling (cf-4x7e.4) splits two error classes so operators can
 * branch on which surface broke without scraping log lines:
 *   - Dynamic import of `backend/smsService.web` failed → `smsService_unavailable`
 *   - `sendOrderShippedSMS` threw at send time → `send_error`
 *
 * Both paths route through `logError(context, err)` with a context string
 * that names the failure stage, so Wix runtime logs are greppable.
 *
 * Called from src/backend/events.js → wixEcom_onOrderFulfilled.
 *
 * @param {Object} [params]
 * @param {string} params.memberId - Wix member ID from buyer info.
 * @param {string} params.orderNumber - Order number.
 * @param {string} [params.trackingNumber] - UPS tracking number from fulfillment.
 * @returns {Promise<{sent: boolean, reason?: string}>} Envelope where
 *   `sent` is the success flag and `reason` is the failure class (see
 *   the module-level "Observability" block for the value set).
 */
export async function handleOrderFulfilled({ memberId, orderNumber, trackingNumber } = {}) {
  if (!memberId || !orderNumber) {
    return { sent: false, reason: 'missing_params' };
  }

  // Split the dynamic import from the send so a runtime/code-split failure
  // reports differently from a Twilio/network failure — they need different
  // operator responses (deploy regression vs upstream-provider outage).
  let sendOrderShippedSMS;
  try {
    ({ sendOrderShippedSMS } = await import('backend/smsService.web'));
  } catch (err) {
    logError('notificationOrchestrator.handleOrderFulfilled:module-load', err);
    return { sent: false, reason: 'smsService_unavailable' };
  }

  try {
    const trackingUrl = buildTrackingUrl(trackingNumber || '');
    const result = await sendOrderShippedSMS({ memberId, orderNumber, trackingUrl });
    return { sent: result.success, reason: result.reason };
  } catch (err) {
    logError('notificationOrchestrator.handleOrderFulfilled:send', err);
    return { sent: false, reason: 'send_error' };
  }
}
