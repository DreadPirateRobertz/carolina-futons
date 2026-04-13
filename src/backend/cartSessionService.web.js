/**
 * @module cartSessionService
 * @description CartSessions backend — persists cart state to the CartSessions
 * CMS collection so the mobile rig (cfutons_mobile) can read cart data by memberId.
 *
 * Dallas (cfutons_mobile) queries:
 *   wixData.query('CartSessions').eq('memberId', memberId).find()
 *
 * CF-86gj (Wave 32 addition — blaidd)
 *
 * @setup
 * Create `CartSessions` CMS collection with fields:
 *   sessionToken (Text, indexed)      — client-generated session identifier (_id)
 *   memberId     (Text, indexed, nullable) — Wix member ID; null for guest sessions
 *   items        (JSON)               — Array<{productId, qty, price}>
 *   source       (Text)               — always 'web' for this service
 *   createdAt    (DateTime)           — set on createSession
 *   updatedAt    (DateTime)           — updated on every write
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

const CART_COLLECTION = 'CartSessions';

// ── createSession ──────────────────────────────────────────────────

/**
 * Create a new cart session record. Uses sessionToken as _id — safe to call
 * on page load; Wix unique-index prevents duplicates.
 *
 * @param {string} sessionToken - Client session identifier
 * @param {Object} [data]
 * @param {string} [data.memberId] - Wix member ID (null for guests)
 * @param {Array}  [data.items]   - Initial cart items [{productId, qty, price}]
 * @returns {Promise<{success: boolean, error?: string}>}
 * @permission Anyone
 */
export const createSession = webMethod(
  Permissions.Anyone,
  async (sessionToken, data = {}) => {
    try {
      const token = sessionToken ? sanitize(String(sessionToken), 254) : '';
      if (!token) return { success: false, error: 'sessionToken is required' };

      const now = new Date();
      const record = {
        _id: token,
        sessionToken: token,
        memberId: data.memberId ? sanitize(String(data.memberId), 254) : null,
        items: Array.isArray(data.items) ? data.items : [],
        source: 'web',
        createdAt: now,
        updatedAt: now,
      };

      await wixData.insert(CART_COLLECTION, record, { suppressAuth: true });
      return { success: true };
    } catch (err) {
      logError('cartSessionService.createSession', err);
      return { success: false, error: 'Failed to create cart session' };
    }
  }
);

// ── getSession ─────────────────────────────────────────────────────

/**
 * Retrieve a cart session by its sessionToken.
 *
 * @param {string} sessionToken
 * @returns {Promise<{success: boolean, session: Object|null, error?: string}>}
 * @permission Anyone
 */
export const getSession = webMethod(
  Permissions.Anyone,
  async (sessionToken) => {
    try {
      const token = sessionToken ? sanitize(String(sessionToken), 254) : '';
      if (!token) return { success: false, error: 'sessionToken is required' };

      const result = await wixData.query(CART_COLLECTION)
        .eq('sessionToken', token)
        .limit(1)
        .find({ suppressAuth: true });

      const session = result.items.length > 0 ? result.items[0] : null;
      return { success: true, session };
    } catch (err) {
      logError('cartSessionService.getSession', err);
      return { success: false, session: null, error: 'Failed to retrieve cart session' };
    }
  }
);

// ── updateCartItems ────────────────────────────────────────────────

/**
 * Replace the items array on an existing cart session.
 * Called on every cart mutation (add, remove, quantity change).
 *
 * @param {string} sessionToken
 * @param {Array}  items - Replacement items [{productId, qty, price}]
 * @returns {Promise<{success: boolean, error?: string}>}
 * @permission Anyone
 */
export const updateCartItems = webMethod(
  Permissions.Anyone,
  async (sessionToken, items) => {
    try {
      const token = sessionToken ? sanitize(String(sessionToken), 254) : '';
      if (!token) return { success: false, error: 'sessionToken is required' };

      const result = await wixData.query(CART_COLLECTION)
        .eq('sessionToken', token)
        .limit(1)
        .find({ suppressAuth: true });

      if (result.items.length === 0) {
        return { success: false, error: 'not_found' };
      }

      const existing = result.items[0];
      await wixData.update(CART_COLLECTION, {
        ...existing,
        items: Array.isArray(items) ? items : [],
        updatedAt: new Date(),
      }, { suppressAuth: true });

      return { success: true };
    } catch (err) {
      logError('cartSessionService.updateCartItems', err);
      return { success: false, error: 'Failed to update cart items' };
    }
  }
);

// ── mergeGuestCart ─────────────────────────────────────────────────

/**
 * Merge a guest session's cart into the authenticated member's session.
 * Called at login time to preserve cart contents across auth boundary.
 *
 * Strategy: quantities are summed for matching productIds; guest-only items
 * are appended. If the member has no existing session a new one is created
 * with the guest items.
 *
 * @param {string} guestSessionToken - Token of the anonymous session
 * @param {string} memberId          - The authenticated member's Wix ID
 * @returns {Promise<{success: boolean, merged: boolean, error?: string}>}
 * @permission Anyone
 */
export const mergeGuestCart = webMethod(
  Permissions.Anyone,
  async (guestSessionToken, memberId) => {
    try {
      const guestToken = guestSessionToken ? sanitize(String(guestSessionToken), 254) : '';
      if (!guestToken) return { success: false, error: 'guestSessionToken is required' };

      const cleanMemberId = memberId ? sanitize(String(memberId), 254) : '';
      if (!cleanMemberId) return { success: false, error: 'memberId is required' };

      // Load guest session
      const guestResult = await wixData.query(CART_COLLECTION)
        .eq('sessionToken', guestToken)
        .limit(1)
        .find({ suppressAuth: true });

      if (guestResult.items.length === 0) {
        return { success: false, error: 'not_found' };
      }

      const guestSession = guestResult.items[0];
      const guestItems = guestSession.items || [];

      if (guestItems.length === 0) {
        return { success: true, merged: false };
      }

      // Look for an existing member session
      const memberResult = await wixData.query(CART_COLLECTION)
        .eq('memberId', cleanMemberId)
        .limit(1)
        .find({ suppressAuth: true });

      if (memberResult.items.length === 0) {
        // No existing member session — create one with guest items
        const now = new Date();
        await wixData.insert(CART_COLLECTION, {
          _id: `member_${cleanMemberId}`,
          sessionToken: `member_${cleanMemberId}`,
          memberId: cleanMemberId,
          items: guestItems,
          source: 'web',
          createdAt: now,
          updatedAt: now,
        }, { suppressAuth: true });
      } else {
        // Merge guest items into existing member session
        const memberSession = memberResult.items[0];
        const merged = mergeItems(memberSession.items || [], guestItems);

        await wixData.update(CART_COLLECTION, {
          ...memberSession,
          items: merged,
          updatedAt: new Date(),
        }, { suppressAuth: true });
      }

      return { success: true, merged: true };
    } catch (err) {
      logError('cartSessionService.mergeGuestCart', err);
      return { success: false, error: 'Failed to merge guest cart' };
    }
  }
);

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Merge two item arrays. Matching productIds have their quantities summed;
 * items present only in the incoming array are appended.
 *
 * @param {Array} base     - Existing items
 * @param {Array} incoming - Guest items to merge in
 * @returns {Array}
 */
function mergeItems(base, incoming) {
  const map = new Map(base.map(item => [item.productId, { ...item }]));

  for (const item of incoming) {
    if (map.has(item.productId)) {
      map.get(item.productId).qty += item.qty;
    } else {
      map.set(item.productId, { ...item });
    }
  }

  return [...map.values()];
}
