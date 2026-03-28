/**
 * @module guestCheckout
 * @description Handles guest checkout sessions — saves anonymous order details
 * so they can be linked to a member account if the guest later registers.
 *
 * Guest flow:
 *   1. Anonymous user proceeds to checkout (no login required).
 *   2. Email + shipping collected at checkout → saveGuestSession() called.
 *   3. Post-purchase: soft prompt to create account shown on Thank You page.
 *   4. If guest registers with same email → linkGuestOrdersToMember() merges.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup CMS collection `GuestOrders` with fields:
 *   sessionId (Text, indexed)
 *   email (Text, indexed)
 *   firstName (Text)
 *   orderId (Text, indexed)
 *   orderTotal (Number)
 *   status (Text) — 'pending'|'linked'|'expired'
 *   linkedMemberId (Text) — populated when guest registers
 *   createdAt (Date)
 *
 * CF-2zr3
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

const COLLECTION = 'GuestOrders';

/** Sessions older than 90 days are considered expired for merge purposes. */
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// ── saveGuestSession ──────────────────────────────────────────────────

/**
 * Save a guest checkout session.
 * Called when an anonymous user submits their email at checkout.
 *
 * @param {Object} params
 * @param {string} params.sessionId - Browser-generated session ID
 * @param {string} params.email - Guest email address
 * @param {string} [params.firstName] - Guest first name (from address form)
 * @param {string} [params.orderId] - Wix order ID (set after order created)
 * @param {number} [params.orderTotal] - Order total in dollars
 * @returns {Promise<{success: boolean, _id?: string, error?: string}>}
 * @permission Anyone — anonymous users must be able to call this
 */
export const saveGuestSession = webMethod(
  Permissions.Anyone,
  async ({ sessionId, email, firstName, orderId, orderTotal } = {}) => {
    try {
      const cleanSessionId = sanitize(sessionId || '', 64);
      const cleanEmail = sanitize(email || '', 254).toLowerCase().trim();
      const cleanFirst = sanitize(firstName || '', 100);
      const cleanOrderId = sanitize(orderId || '', 64);

      if (!cleanSessionId || !cleanEmail) {
        return { success: false, error: 'sessionId and email are required' };
      }

      if (!cleanEmail.includes('@')) {
        return { success: false, error: 'Invalid email address' };
      }

      // Upsert: one record per sessionId
      const existing = await wixData
        .query(COLLECTION)
        .eq('sessionId', cleanSessionId)
        .limit(1)
        .find({ suppressAuth: true });

      const record = {
        sessionId: cleanSessionId,
        email: cleanEmail,
        firstName: cleanFirst,
        orderId: cleanOrderId,
        orderTotal: typeof orderTotal === 'number' && isFinite(orderTotal) ? orderTotal : 0,
        status: 'pending',
        linkedMemberId: '',
        createdAt: new Date(),
      };

      let saved;
      if (existing.items.length > 0) {
        saved = await wixData.update(COLLECTION, { ...existing.items[0], ...record }, { suppressAuth: true });
      } else {
        saved = await wixData.insert(COLLECTION, record, { suppressAuth: true });
      }

      return { success: true, _id: saved._id };
    } catch (err) {
      console.error('[guestCheckout] saveGuestSession failed:', err?.message);
      return { success: false, error: 'Unable to save guest session' };
    }
  }
);

// ── linkGuestOrdersToMember ───────────────────────────────────────────

/**
 * Link all guest orders for an email to the currently-authenticated member.
 * Called from member registration flow when a new account is created.
 * Gets memberId from session to prevent IDOR (no caller-supplied memberId).
 *
 * @param {string} email - The email used during guest checkout
 * @returns {Promise<{success: boolean, linkedCount: number}>}
 * @permission SiteMember — only callable by authenticated members
 */
export const linkGuestOrdersToMember = webMethod(
  Permissions.SiteMember,
  async (email) => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, linkedCount: 0 };
      }
      const cleanMemberId = member._id;
      const cleanEmail = sanitize(email || '', 254).toLowerCase().trim();

      if (!cleanEmail) {
        return { success: false, linkedCount: 0 };
      }

      const cutoff = new Date(Date.now() - SESSION_TTL_MS);

      const result = await wixData
        .query(COLLECTION)
        .eq('email', cleanEmail)
        .eq('status', 'pending')
        .ge('createdAt', cutoff)
        .find({ suppressAuth: true });

      if (result.items.length === 0) {
        return { success: true, linkedCount: 0 };
      }

      let linkedCount = 0;
      for (const item of result.items) {
        try {
          await wixData.update(
            COLLECTION,
            { ...item, status: 'linked', linkedMemberId: cleanMemberId },
            { suppressAuth: true }
          );
          linkedCount++;
        } catch (err) {
          console.error('[guestCheckout] Failed to link guest order:', item._id, err?.message);
        }
      }

      return { success: true, linkedCount };
    } catch (err) {
      console.error('[guestCheckout] linkGuestOrdersToMember failed:', err?.message);
      return { success: false, linkedCount: 0 };
    }
  }
);

// ── getGuestOrdersByEmail ─────────────────────────────────────────────

/**
 * Retrieve guest orders for a given email (for order history merge preview).
 *
 * @param {string} email
 * @returns {Promise<{success: boolean, orders: Array}>}
 * @permission SiteMember
 */
export const getGuestOrdersByEmail = webMethod(
  Permissions.SiteMember,
  async (email) => {
    try {
      const cleanEmail = sanitize(email || '', 254).toLowerCase().trim();
      if (!cleanEmail) return { success: false, orders: [] };

      const result = await wixData
        .query(COLLECTION)
        .eq('email', cleanEmail)
        .descending('createdAt')
        .limit(50)
        .find({ suppressAuth: true });

      const orders = result.items.map(item => ({
        _id: item._id,
        orderId: item.orderId,
        orderTotal: item.orderTotal,
        status: item.status,
        createdAt: item.createdAt,
      }));

      return { success: true, orders };
    } catch (err) {
      console.error('[guestCheckout] getGuestOrdersByEmail failed:', err?.message);
      return { success: false, orders: [] };
    }
  }
);

// ── getSoftPromptConfig ───────────────────────────────────────────────

/**
 * Returns the display config for the post-purchase guest account prompt.
 * Pure function — no database access.
 *
 * @returns {{title: string, description: string, ctaLabel: string, skipLabel: string}}
 * @permission Anyone
 */
export const getSoftPromptConfig = webMethod(
  Permissions.Anyone,
  () => ({
    title: 'Save your order history',
    description: 'Create a free account to track your order, earn rewards, and get faster checkout next time.',
    ctaLabel: 'Create Account',
    skipLabel: 'No thanks',
  })
);

// ── Test helpers ──────────────────────────────────────────────────────

export { SESSION_TTL_MS as _SESSION_TTL_MS };
