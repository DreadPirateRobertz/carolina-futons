/**
 * @module cartRecovery
 * @description Backend event handlers for abandoned cart recovery.
 * Listens to wix-ecom-backend checkout events and triggers email
 * recovery sequences. Tracks recovery rates in ProductAnalytics CMS.
 *
 * @requires wix-ecom-backend
 * @requires wix-data
 * @requires backend/emailService.web
 *
 * @setup
 * 1. This file must be in backend/ — event handlers auto-register
 * 2. Ensure 'AbandonedCarts' CMS collection exists (see fields below)
 * 3. Configure triggered emails in Wix Dashboard
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

/**
 * Event handler: Abandoned checkout created.
 * Fires when a customer leaves checkout without completing purchase.
 * Records the abandonment and can trigger recovery email sequence.
 *
 * @param {Object} event - Wix ecom abandoned checkout event
 */
export function wixEcom_onAbandonedCheckoutCreated(event) {
  const checkout = event.entity || event;

  recordAbandonedCart({
    checkoutId: checkout._id || '',
    buyerEmail: checkout.buyerInfo?.email || '',
    buyerName: checkout.buyerInfo?.firstName || '',
    cartTotal: checkout.payNow?.total?.amount || 0,
    lineItems: (checkout.lineItems || []).map(item => ({
      name: item.productName?.original || item.catalogReference?.catalogItemId || '',
      quantity: item.quantity || 1,
      price: item.price?.amount || 0,
    })),
    abandonedAt: new Date().toISOString(),
    status: 'abandoned',
    recoveryEmailSent: false,
  }).catch(err => console.error('Error recording abandoned cart:', err));
}

/**
 * Event handler: Abandoned checkout recovered.
 * Fires when a customer returns and completes their purchase.
 *
 * @param {Object} event - Wix ecom recovered checkout event
 */
export function wixEcom_onAbandonedCheckoutRecovered(event) {
  const checkout = event.entity || event;

  markCartRecovered(checkout._id || '')
    .catch(err => console.error('Error marking cart recovered:', err));
}

/**
 * Get abandoned cart statistics for admin dashboard.
 *
 * @function getAbandonedCartStats
 * @returns {Promise<Object>} { totalAbandoned, totalRecovered, recoveryRate, recentCarts }
 * @permission Admin
 */
export const getAbandonedCartStats = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const allCarts = await wixData.query('AbandonedCarts')
        .ge('abandonedAt', thirtyDaysAgo.toISOString())
        .find();

      const total = allCarts.items.length;
      const recovered = allCarts.items.filter(c => c.status === 'recovered').length;
      const recoveryRate = total > 0 ? Math.round((recovered / total) * 100) : 0;

      const recentCarts = allCarts.items
        .sort((a, b) => new Date(b.abandonedAt) - new Date(a.abandonedAt))
        .slice(0, 10)
        .map(c => ({
          checkoutId: c.checkoutId,
          buyerEmail: c.buyerEmail,
          cartTotal: c.cartTotal,
          status: c.status,
          abandonedAt: c.abandonedAt,
        }));

      return { totalAbandoned: total, totalRecovered: recovered, recoveryRate, recentCarts };
    } catch (err) {
      console.error('Error getting cart stats:', err);
      return { totalAbandoned: 0, totalRecovered: 0, recoveryRate: 0, recentCarts: [] };
    }
  }
);

/**
 * Get carts eligible for recovery email (abandoned > 1 hour, no email sent).
 *
 * @function getRecoverableCarts
 * @returns {Promise<Array>} Carts ready for recovery email
 * @permission Admin
 */
export const getRecoverableCarts = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const result = await wixData.query('AbandonedCarts')
        .eq('status', 'abandoned')
        .eq('recoveryEmailSent', false)
        .le('abandonedAt', oneHourAgo.toISOString())
        .find();

      return (result.items || []).map(c => ({
        _id: c._id,
        checkoutId: c.checkoutId,
        buyerEmail: c.buyerEmail,
        buyerName: c.buyerName,
        cartTotal: c.cartTotal,
        lineItems: c.lineItems,
        abandonedAt: c.abandonedAt,
      }));
    } catch (err) {
      console.error('Error getting recoverable carts:', err);
      return [];
    }
  }
);

/**
 * Mark a recovery email as sent for an abandoned cart.
 *
 * @function markRecoveryEmailSent
 * @param {string} cartId - The _id of the AbandonedCarts record
 * @returns {Promise<Object>} { success }
 * @permission Admin
 */
export const markRecoveryEmailSent = webMethod(
  Permissions.Admin,
  async (cartId) => {
    try {
      if (!cartId) return { success: false };
      const cleanId = sanitize(cartId, 50);

      await wixData.update('AbandonedCarts', {
        _id: cleanId,
        recoveryEmailSent: true,
        recoveryEmailSentAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err) {
      console.error('Error marking recovery email sent:', err);
      return { success: false };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

async function recordAbandonedCart(data) {
  await wixData.insert('AbandonedCarts', {
    checkoutId: sanitize(data.checkoutId, 50),
    buyerEmail: sanitize(data.buyerEmail, 254),
    buyerName: sanitize(data.buyerName, 200),
    cartTotal: Number(data.cartTotal) || 0,
    lineItems: data.lineItems || [],
    abandonedAt: data.abandonedAt,
    status: 'abandoned',
    recoveryEmailSent: false,
  });
}

async function markCartRecovered(checkoutId) {
  if (!checkoutId) return;
  const clean = sanitize(checkoutId, 50);

  const result = await wixData.query('AbandonedCarts')
    .eq('checkoutId', clean)
    .eq('status', 'abandoned')
    .find();

  if (result.items.length > 0) {
    const cart = result.items[0];
    await wixData.update('AbandonedCarts', {
      ...cart,
      status: 'recovered',
      recoveredAt: new Date().toISOString(),
    });
  }
}
