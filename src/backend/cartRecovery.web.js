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
import { triggeredEmails } from 'wix-crm-backend';
import { sanitize } from 'backend/utils/sanitize';
import { generateRecoveryCoupon } from 'backend/couponsService.web';
import { findMemberRecord, computeTierInfo } from 'backend/gamificationCore.web';
import { resolveTemplateId } from 'backend/emailTemplates.web';

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
      productId: item.catalogReference?.catalogItemId || '',
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
        lineItems: parseLineItems(c.lineItems),
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

      const existing = await wixData.get('AbandonedCarts', cleanId);
      if (!existing) return { success: false };
      await wixData.update('AbandonedCarts', {
        ...existing,
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

/**
 * Send the first recovery email for an abandoned cart.
 * Generates an idempotent recovery coupon (via generateRecoveryCoupon) and
 * sends the cart_recovery_1 triggered email. Degrades gracefully if coupon
 * generation fails — email still sends without a discount code.
 *
 * Note: This function is NOT itself idempotent. Callers must check
 * `recoveryEmailSent` on the cart record before invoking to prevent
 * duplicate sends. Only coupon generation is idempotent.
 *
 * The coupon idempotency key used internally is `cart.checkoutId`,
 * not the AbandonedCarts `_id`.
 *
 * @function sendRecoveryEmail
 * @param {string} cartId - The _id of the AbandonedCarts record
 * @returns {Promise<Object>}
 *   On success: `{ success: true, discountCode: string }`.
 *   On failure: `{ success: false, message: string }`.
 * @permission Admin
 */
export const sendRecoveryEmail = webMethod(
  Permissions.Admin,
  async (cartId) => {
    try {
      if (!cartId) return { success: false, message: 'Cart ID required' };
      const cleanId = sanitize(cartId, 50);

      const cart = await wixData.get('AbandonedCarts', cleanId);
      if (!cart) return { success: false, message: 'Cart not found' };

      const cartEmail = (cart.buyerEmail || '').toLowerCase().trim();
      if (!cartEmail) return { success: false, message: 'Cart has no email' };

      const couponResult = await generateRecoveryCoupon({ cartId: cart.checkoutId, email: cartEmail });
      const discountCode = couponResult.success ? couponResult.code : '';
      if (!couponResult.success) {
        console.warn('[cartRecovery] Coupon generation failed for cartId:', cartId, '— sending email without discount:', couponResult.message);
      }

      // cf-xdji item-2: route through the shared resolveContactId helper so
      // every queue site has a single CRM-upsert source of truth. Helper
      // returns null on validation/upstream failure (logged with the email);
      // we surface that as the same caller-facing error string as before
      // to preserve cron-runner / dashboard observability.
      const { _resolveContactIdInternal } = await import('backend/contacts/contactResolver.web');
      const contactId = await _resolveContactIdInternal(cartEmail);
      if (!contactId) {
        console.error('[cartRecovery] resolveContactId returned null for cartId:', cartId);
        return { success: false, message: 'Failed to resolve CRM contact for recovery email' };
      }

      // CF-hamh: Enrich with loyalty context (points balance, tier progress)
      const loyalty = await getLoyaltyContext(contactId, cart.cartTotal);

      await triggeredEmails.emailContact(resolveTemplateId('cart_recovery_1'), contactId, {
        variables: {
          buyerName: cart.buyerName || '',
          cartTotal: String(cart.cartTotal || 0),
          discountCode,
          discountAvailable: String(couponResult.success),
          checkoutId: cart.checkoutId,
          email: cartEmail,
          ...loyalty,
        },
      });

      try {
        await wixData.update('AbandonedCarts', {
          ...cart,
          recoveryEmailSent: true,
          recoveryEmailSentAt: new Date().toISOString(),
        });
      } catch (updateErr) {
        console.error('[cartRecovery] Failed to mark recoveryEmailSent for cartId:', cartId, '— error:', updateErr.message);
        return { success: false, message: 'Failed to update cart status after email send' };
      }

      return { success: true, discountCode };
    } catch (err) {
      console.error('[cartRecovery] sendRecoveryEmail failed for cartId:', cartId, '— error:', err.message);
      return { success: false, message: 'Failed to send recovery email' };
    }
  }
);

// ── Loyalty context (CF-hamh) ─────────────────────────────────────────

/**
 * Look up loyalty program context for a buyer by their CRM contactId.
 * Returns points balance, tier info, and projected earnings for the cart.
 * Returns empty context if the buyer is not a loyalty member.
 *
 * @param {string} contactId - Wix CRM contact ID
 * @param {number} cartTotal - Cart total for projected earnings
 * @returns {Promise<{ pointsBalance: string, pointsDiscount: string,
 *   pointsToEarn: string, nextTierName: string, pointsToNextTier: string,
 *   hasLoyalty: string }>}
 */
async function getLoyaltyContext(contactId, cartTotal) {
  const empty = {
    pointsBalance: '0',
    pointsDiscount: '$0',
    pointsToEarn: '0',
    nextTierName: '',
    pointsToNextTier: '0',
    hasLoyalty: 'false',
  };

  try {
    // Look up memberId from Members collection via contactId
    const memberResult = await wixData
      .query('Members/PrivateMembersData')
      .eq('_id', contactId)
      .limit(1)
      .find({ suppressAuth: true });

    if (memberResult.items.length === 0) return empty;

    const memberId = memberResult.items[0]._id;
    const record = await findMemberRecord(memberId);
    if (!record) return empty;

    const totalPoints = record.totalPoints ?? 0;
    const tierInfo = computeTierInfo(totalPoints);

    // $1 off per 100 points (loyalty discount rate)
    const discountDollars = Math.floor(totalPoints / 100);
    // Projected points from this order: 1 pt per $1
    const pointsToEarn = Math.floor(Number(cartTotal) || 0);

    return {
      pointsBalance: String(totalPoints),
      pointsDiscount: `$${discountDollars}`,
      pointsToEarn: String(pointsToEarn),
      nextTierName: tierInfo.nextTierName ?? '',
      pointsToNextTier: String(tierInfo.pointsToNextTier),
      hasLoyalty: 'true',
    };
  } catch (err) {
    console.warn('[cartRecovery] getLoyaltyContext failed — sending without loyalty data:', err.message);
    return empty;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────

async function recordAbandonedCart(data) {
  const cleanCheckoutId = sanitize(data.checkoutId, 50);

  // Dedup: skip if this checkoutId already has an abandoned record
  const existing = await wixData.query('AbandonedCarts')
    .eq('checkoutId', cleanCheckoutId)
    .eq('status', 'abandoned')
    .find();

  if (existing.items.length > 0) return;

  // Validate line items: keep only items with a name and quantity > 0
  const validLineItems = (data.lineItems || []).filter(
    item => item.name && item.quantity > 0
  );

  await wixData.insert('AbandonedCarts', {
    checkoutId: cleanCheckoutId,
    buyerEmail: sanitize(data.buyerEmail, 254),
    buyerName: sanitize(data.buyerName, 200),
    cartTotal: Number(data.cartTotal) || 0,
    lineItems: JSON.stringify(validLineItems),
    abandonedAt: data.abandonedAt,
    status: 'abandoned',
    recoveryEmailSent: false,
  });
}

/**
 * Parse lineItems from CMS — handles both JSON strings and raw arrays.
 * Validates each item has required fields (productId, name, quantity, price).
 * @param {string|Array} raw
 * @returns {Array<{productId: string, name: string, quantity: number, price: number}>}
 */
function parseLineItems(raw) {
  if (!raw) return [];
  let items = raw;
  if (typeof raw === 'string') {
    try {
      items = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(items)) return [];
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      productId: String(item.productId || ''),
      name: String(item.name || ''),
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
    }));
}

/**
 * Expose cart abandon payload for mobile push deduplication.
 * Mobile's cm-cart-abandonment-recovery calls this to get cart items
 * and check if the member has push enabled (to suppress web email).
 *
 * @param {Object} params
 * @param {string} [params.cartId] - AbandonedCarts record _id
 * @param {string} [params.memberId] - Member ID (alternative lookup)
 * @returns {Promise<{success: boolean, cart_items: Array, total_price: number, cart_id: string, member_push_enabled: boolean}>}
 * @permission Admin
 * CF-b0lk
 */
export const exposeCartAbandonPayload = webMethod(
  Permissions.Admin,
  async (params = {}) => {
    try {
      const cartId = params.cartId ? sanitize(params.cartId, 50) : null;
      const memberId = params.memberId ? sanitize(params.memberId, 50) : null;

      if (!cartId && !memberId) {
        return { success: false, cart_items: [], total_price: 0, cart_id: '', member_push_enabled: false };
      }

      // Find the abandoned cart
      let cart = null;
      if (cartId) {
        cart = await wixData.get('AbandonedCarts', cartId);
      } else if (memberId) {
        const result = await wixData.query('AbandonedCarts')
          .eq('memberId', memberId)
          .eq('status', 'abandoned')
          .descending('abandonedAt')
          .limit(1)
          .find();
        cart = result.items.length > 0 ? result.items[0] : null;
      }

      if (!cart) {
        return { success: false, cart_items: [], total_price: 0, cart_id: '', member_push_enabled: false };
      }

      // Parse line items (max 3 for push notification)
      // Use raw items to preserve image URLs (parseLineItems strips them)
      let rawItems = [];
      try {
        rawItems = typeof cart.lineItems === 'string'
          ? JSON.parse(cart.lineItems)
          : (cart.lineItems || []);
      } catch (e) { rawItems = []; }

      const cartItems = (Array.isArray(rawItems) ? rawItems : []).slice(0, 3).map(item => ({
        name: String(item.name || ''),
        image_url: String(item.imageUrl || item.image || item.image_url || ''),
        price: Number(item.price) || 0,
      }));

      // Check mobile push subscription
      let memberPushEnabled = false;
      const contactId = cart.memberId || memberId;
      if (contactId) {
        const pushSubs = await wixData.query('MobilePushSubscriptions')
          .eq('memberId', contactId)
          .eq('enabled', true)
          .limit(1)
          .find();
        memberPushEnabled = pushSubs.items.length > 0;
      }

      return {
        success: true,
        cart_items: cartItems,
        total_price: cart.cartTotal || 0,
        cart_id: cart._id,
        member_push_enabled: memberPushEnabled,
      };
    } catch (err) {
      console.error('[cartRecovery] exposeCartAbandonPayload error:', err);
      return { success: false, cart_items: [], total_price: 0, cart_id: '', member_push_enabled: false };
    }
  }
);

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
