/**
 * @module orderStatusWebhook
 * @description Cross-rig webhook for mobile push notifications on order status changes.
 * Dallas mobile app receives POST webhooks to trigger push notifications
 * to customer devices via expo-notifications.
 *
 * Fires on: order confirmed (created), shipped (fulfilled), delivered, cancelled.
 * Retry: 3 attempts with exponential backoff (1s, 4s, 16s).
 * Graceful degradation: never blocks order flow — logs failures to AuditLog.
 *
 * @requires wix-web-module
 * @requires wix-secrets-backend
 *
 * @setup
 * 1. Add to Wix Secrets Manager:
 *      MOBILE_PUSH_ENDPOINT — URL of dallas mobile push service
 *        (e.g. https://push.carolinafutons.app/api/push/order-status)
 *
 * 2. Create CMS collection `WebhookAttempts` (optional, for debugging):
 *      orderId (Text), status (Text), attempt (Number),
 *      success (Boolean), error (Text), timestamp (DateTime)
 */

import { Permissions, webMethod } from 'wix-web-module';
import { logAuditEvent } from 'backend/utils/auditLog';
import { logError } from 'backend/utils/errorHandler';
import { sanitize } from 'backend/utils/sanitize';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 4s, 16s (exponential)

/**
 * Status labels for the mobile push notification.
 * Maps internal order statuses to user-friendly labels.
 */
const STATUS_LABELS = {
  confirmed: 'Order Confirmed',
  shipped: 'Order Shipped',
  delivered: 'Order Delivered',
  cancelled: 'Order Cancelled',
};

/**
 * Build the webhook payload from order event data.
 *
 * @param {Object} order - Wix order entity
 * @param {string} status - One of: confirmed, shipped, delivered, cancelled
 * @returns {Object} Mobile push payload
 */
export function buildWebhookPayload(order, status) {
  const orderId = sanitize(order._id || order.orderId || '', 50);
  const customerId = sanitize(
    order.buyerInfo?.memberId || order.buyerInfo?.contactId || '', 50
  );
  const carrier = sanitize(
    order.fulfillmentStatus?.trackingInfo?.shippingProvider
    || order.shippingInfo?.title
    || '', 100
  );
  const trackingNumber = sanitize(
    order.fulfillmentStatus?.trackingInfo?.trackingNumber
    || order.trackingInfo?.trackingNumber
    || '', 100
  );
  const estimatedDelivery = order.fulfillmentStatus?.trackingInfo?.estimatedDeliveryDate
    || order.estimatedDeliveryDate
    || null;

  return {
    orderId,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    carrier,
    trackingNumber,
    estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : null,
    customerId,
    orderNumber: sanitize(order.number || '', 20),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send a webhook POST to the mobile push service with retry logic.
 * Fire-and-forget — never throws. Logs all attempts to AuditLog.
 *
 * @param {Object} payload - The webhook payload from buildWebhookPayload
 * @returns {Promise<{success: boolean, attempts: number, lastError?: string}>}
 */
export async function sendWebhook(payload) {
  let pushEndpoint;
  try {
    const { getSecret } = await import('wix-secrets-backend');
    pushEndpoint = await getSecret('MOBILE_PUSH_ENDPOINT');
  } catch (err) {
    logError('orderStatusWebhook.sendWebhook.getSecret', err);
    logAuditEvent('OrderStatusWebhook', 'secret_error', payload.orderId, { error: err.message });
    return { success: false, attempts: 0, lastError: 'Push endpoint not configured' };
  }

  if (!pushEndpoint) {
    logAuditEvent('OrderStatusWebhook', 'no_endpoint', payload.orderId);
    return { success: false, attempts: 0, lastError: 'Push endpoint not configured' };
  }

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(pushEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        logAuditEvent('OrderStatusWebhook', 'sent', payload.orderId, {
          status: payload.status,
          attempt,
          customerId: payload.customerId,
        });
        return { success: true, attempts: attempt };
      }

      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err.message || 'Network error';
    }

    // Exponential backoff: 1s, 4s, 16s
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(4, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // All retries exhausted
  logError('orderStatusWebhook.sendWebhook', new Error(`Failed after ${MAX_RETRIES} attempts: ${lastError}`));
  logAuditEvent('OrderStatusWebhook', 'failed', payload.orderId, {
    status: payload.status,
    attempts: MAX_RETRIES,
    lastError,
    customerId: payload.customerId,
  });
  return { success: false, attempts: MAX_RETRIES, lastError };
}

/**
 * Handle an order status change event. Called from events.js handlers.
 * Fire-and-forget — extracts payload, sends webhook, logs result.
 *
 * @param {Object} order - Wix order entity from event
 * @param {string} status - One of: confirmed, shipped, delivered, cancelled
 * @returns {Promise<void>}
 */
export async function handleOrderStatusChange(order, status) {
  if (!order) return;

  const customerId = order.buyerInfo?.memberId || order.buyerInfo?.contactId || '';
  if (!customerId) {
    // No customer ID — can't route push notification to a device
    return;
  }

  const payload = buildWebhookPayload(order, status);
  await sendWebhook(payload);
}

// ── Manual trigger (admin, for testing/replay) ──────────────────────

/**
 * Manually trigger an order status webhook. Admin-only, for testing
 * or replaying missed events.
 *
 * @param {string} orderId - The Wix order ID
 * @param {string} status - Status to send (confirmed/shipped/delivered/cancelled)
 * @returns {Promise<{success: boolean, error?: string}>}
 * @permission Admin
 */
export const triggerOrderWebhook = webMethod(
  Permissions.Admin,
  async (orderId, status) => {
    try {
      if (!orderId || !status) {
        return { success: false, error: 'orderId and status are required' };
      }

      if (!STATUS_LABELS[status]) {
        return { success: false, error: `Invalid status. Must be one of: ${Object.keys(STATUS_LABELS).join(', ')}` };
      }

      const wixData = (await import('wix-data')).default;
      const order = await wixData.get('Stores/Orders', sanitize(orderId, 50));
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      const payload = buildWebhookPayload(order, status);
      const result = await sendWebhook(payload);
      return { success: result.success, attempts: result.attempts, lastError: result.lastError };
    } catch (err) {
      logError('orderStatusWebhook.triggerOrderWebhook', err);
      return { success: false, error: 'Failed to trigger webhook' };
    }
  }
);
