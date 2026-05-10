/**
 * @module emailFlow.web
 * @description Frontend-facing email-trigger entry points.
 *
 * cf-uwfw (cf-7ozz.1): cfw's `/api/email/trigger` route does
 * `callVelo({method: 'queueWelcomeEmail' | 'queueCartRecovery', args: [payload]})`.
 * Wix Velo doesn't auto-route /_functions/<name> to a webMethod — http-functions.js
 * carries explicit `post_<name>` wrappers that delegate to these
 * webMethods.
 *
 * Both methods are `Permissions.Anyone` because cfw calls them server-side from
 * the /api/email/trigger Vercel route, which has no Wix session. Validation
 * runs inline; rate limiting + de-duplication happen in the underlying
 * implementations (`triggerWelcomeSequence` for welcome; the cron-driven
 * `triggerAbandonedCartRecovery` for cart recovery).
 *
 * @requires wix-web-module
 * @requires wix-crm-backend
 */

import { Permissions, webMethod } from 'wix-web-module';
import { contacts } from 'wix-crm-backend';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { triggerWelcomeSequence } from 'backend/emailAutomation.web';

/**
 * Queue a welcome-email sequence for a freshly-registered cfw user.
 *
 * cfw fires this from `/signup` after `/api/auth/register` returns
 * `{ok: true}`. The payload is `{type: 'welcome', email}`.
 * No firstName is sent — cfw doesn't have one at signup. The underlying
 * triggerWelcomeSequence handles missing firstName by emitting an empty
 * string into the template.
 *
 * @function queueWelcomeEmail
 * @param {{type: 'welcome', email: string}} payload
 * @returns {Promise<{success: boolean, error?: string, queued?: number}>}
 *   - `{success: true, queued: N}` when N steps were queued (welcome sequence
 *     is currently 3 steps).
 *   - `{success: false, error: 'invalid_payload' | 'invalid_email' | 'unsubscribed' | 'already_queued' | 'contact_resolution_failed'}`
 *     for the documented soft-fail cases (cf-yvs4 maps these to 4xx).
 *   - `{success: false, error: <free-text>}` for other backend failures —
 *     dispatcher catches and emits 500 + errorId.
 * @permission Anyone — public surface; called from cfw without a session.
 */
export const queueWelcomeEmail = webMethod(
  Permissions.Anyone,
  async (payload) => {
    // Error strings are phrased to land in the cf-yvs4/cf-mgnh
    // soft-fail classifier buckets used by the dispatcher:
    //   "Invalid …"          → 400 (validation)
    //   "Failed to …"        → 503 (infra)
    //   business-logic       → null → 200 (e.g. unsubscribed)
    if (!payload || typeof payload !== 'object' || payload.type !== 'welcome') {
      return { success: false, error: 'Invalid payload' };
    }
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!validateEmail(email)) {
      return { success: false, error: 'Invalid email' };
    }

    let contactId = '';
    try {
      const result = await contacts.appendOrCreateContact({
        emails: [{ email }],
      });
      contactId = result?.contactId || result?._id || '';
    } catch (err) {
      console.error('[emailFlow] queueWelcomeEmail contact resolution failed:', err?.message ?? err);
      return { success: false, error: 'Failed to resolve contact' };
    }
    if (!contactId) {
      return { success: false, error: 'Failed to resolve contact' };
    }

    // Delegate to the documented welcome-sequence trigger. firstName is
    // intentionally empty — cfw doesn't pass one.
    return triggerWelcomeSequence(contactId, email, '');
  }
);

/**
 * Acknowledge a cart-recovery hint from cfw.
 *
 * cfw fires this from CartAbandonmentTracker on visibilitychange/pagehide
 * with `{type: 'cart-recovery', items: [{productId, quantity}]}`. The payload
 * does NOT include an email or session identifier — at hint time the user
 * may be anonymous.
 *
 * The actual abandoned-cart email sequence is driven by the
 * `triggerAbandonedCartRecovery` cron job, which scans the
 * `Wix Stores → AbandonedCarts` collection that Wix Stores populates
 * automatically once a user begins checkout (where email IS captured).
 * This webMethod is therefore an explicit ACK contract — it lets cfw's
 * /api/email/trigger return 200 without a Velo error, and serves as a
 * future hook point for a session-aware extension.
 *
 * Validates payload shape so a malformed cfw call is caught at the boundary,
 * not silently dropped.
 *
 * @function queueCartRecovery
 * @param {{type: 'cart-recovery', items: Array<{productId: string, quantity: number}>}} payload
 * @returns {Promise<{success: boolean, acknowledged?: number, note?: string, error?: string}>}
 * @permission Anyone — public surface; called from cfw without a session.
 */
export const queueCartRecovery = webMethod(
  Permissions.Anyone,
  async (payload) => {
    if (!payload || typeof payload !== 'object' || payload.type !== 'cart-recovery') {
      return { success: false, error: 'Invalid payload' };
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return { success: false, error: 'items is required' };
    }
    // Defensive shape check — cfw schema guarantees this but fail loudly if
    // a future schema drift sends garbage.
    const validItems = payload.items.every(
      (it) =>
        it
        && typeof it === 'object'
        && typeof it.productId === 'string'
        && it.productId.length > 0
        && typeof it.quantity === 'number'
        && Number.isFinite(it.quantity)
        && it.quantity > 0
    );
    if (!validItems) {
      return { success: false, error: 'Invalid items' };
    }

    return {
      success: true,
      acknowledged: payload.items.length,
      note: 'cart-recovery emails are queued by the triggerAbandonedCartRecovery cron from the Wix Stores AbandonedCarts collection once email is captured at checkout',
    };
  }
);
