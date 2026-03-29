/**
 * @module swatchKitService
 * @description Swatch Kit micro-product backend — $5 for 5 fabric swatches,
 * refundable as $5 store credit on any purchase $200+.
 *
 * Flow:
 *  1. Customer purchases SKU: SWATCH-KIT-001 via standard Wix checkout.
 *  2. wixEcom_onOrderCreated fires → recordSwatchKitPurchase() issues $5 credit
 *     (expires 90 days) via storeCreditService.
 *  3. At qualifying checkout ($200+), markCreditApplied() is called after
 *     storeCreditService.applyStoreCredit succeeds to mark the credit as used.
 *     TODO: wire markCreditApplied() at checkout — pending storeCreditService hook.
 *
 * @setup
 * Wix Stores product:
 *   Name: 'Swatch Kit', Price: $5.00, SKU: SWATCH-KIT-001
 *   Description: 'Get 5 fabric swatches delivered. Refundable as store credit on any $200+ purchase.'
 *   Product page slug: /swatch-kit
 *
 * CMS:
 *   SwatchKitOrders (orderId Text indexed, memberId Text, email Text,
 *                    swatchIds Text (JSON), creditId Text,
 *                    creditApplied Boolean, appliedOrderId Text,
 *                    createdAt Date, creditExpiresAt Date)
 *
 * @note Credit auto-apply (step 3) is a future hook — current implementation
 * issues the credit so storeCreditService.applyStoreCredit can apply it at checkout.
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId, validateEmail } from 'backend/utils/sanitize';

export const SWATCH_KIT_SKU = 'SWATCH-KIT-001';
export const SWATCH_KIT_PRICE = 5;
export const SWATCH_KIT_CREDIT_AMOUNT = 5;
export const QUALIFYING_ORDER_MIN = 200;
export const CREDIT_EXPIRY_DAYS = 90;

const SWATCH_KIT_ORDERS = 'SwatchKitOrders';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** True if the order contains the swatch kit SKU. */
export function orderContainsSwatchKit(lineItems) {
  if (!Array.isArray(lineItems)) return false;
  return lineItems.some(item => {
    const sku = (item.catalogReference?.catalogItemId || item.sku || '').toUpperCase();
    return sku === SWATCH_KIT_SKU;
  });
}

/** True if the order total qualifies for the credit ($200+). */
export function isQualifyingOrder(orderTotal) {
  const total = typeof orderTotal === 'number' ? orderTotal : parseFloat(orderTotal) || 0;
  return total >= QUALIFYING_ORDER_MIN;
}

// ---------------------------------------------------------------------------
// Public webMethods
// ---------------------------------------------------------------------------

/**
 * Record a swatch kit purchase and issue the $5 refundable store credit.
 * Called from events.js on wixEcom_onOrderCreated when SKU matches.
 *
 * Idempotent: if a SwatchKitOrders record already exists for orderId, returns
 * the existing creditId without issuing a duplicate credit.
 *
 * @param {string} orderId
 * @param {string} memberId — may be empty for guest orders; email is used as proxy
 *   memberId in that case. Note: getSwatchKitCreditStatus queries by memberId only,
 *   so guests cannot retrieve their credit status until they are associated with a member.
 * @param {string} email
 * @param {string[]} [swatchIds] — selected swatch IDs from the order metadata
 * @returns {{ success: boolean, creditId?: string, error?: string }}
 */
export const recordSwatchKitPurchase = webMethod(
  Permissions.Admin,
  async (orderId, memberId, email, swatchIds = []) => {
    const cleanOrderId = sanitize(orderId || '', 64);
    const cleanMemberId = sanitize(memberId || '', 64);
    const cleanEmail = sanitize(email || '', 254).toLowerCase();

    if (!cleanOrderId) return { success: false, error: 'invalid_order_id' };
    if (!validateEmail(cleanEmail)) return { success: false, error: 'invalid_email' };

    // Idempotency check — don't double-issue on event replays
    try {
      const existing = await wixData.query(SWATCH_KIT_ORDERS)
        .eq('orderId', cleanOrderId)
        .limit(1)
        .find();
      if (existing.items.length) {
        return { success: true, creditId: existing.items[0].creditId, alreadyIssued: true };
      }
    } catch (err) {
      console.warn('[swatchKitService] idempotency check failed, proceeding:', err?.message);
    }

    // Issue $5 store credit via storeCreditService
    let creditId = '';
    try {
      const { issueStoreCredit } = await import('backend/storeCreditService.web');
      const creditResult = await issueStoreCredit({
        memberId: cleanMemberId || cleanEmail,
        amount: SWATCH_KIT_CREDIT_AMOUNT,
        reason: 'promotion',
        orderReference: cleanOrderId,
      });
      if (!creditResult?.success) {
        console.error('[swatchKitService] issueStoreCredit returned failure:', creditResult);
        return { success: false, error: 'credit_issuance_failed' };
      }
      creditId = creditResult.creditId || '';
    } catch (err) {
      console.error('[swatchKitService] issueStoreCredit threw:', err?.message);
      return { success: false, error: 'credit_issuance_failed' };
    }

    const now = new Date();
    const creditExpiresAt = new Date(now.getTime() + CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Persist record for idempotency + order lookup
    try {
      await wixData.insert(SWATCH_KIT_ORDERS, {
        orderId: cleanOrderId,
        memberId: cleanMemberId,
        email: cleanEmail,
        swatchIds: JSON.stringify(Array.isArray(swatchIds) ? swatchIds.slice(0, 5) : []),
        creditId,
        creditApplied: false,
        appliedOrderId: '',
        createdAt: now,
        creditExpiresAt,
      });
    } catch (err) {
      // Non-fatal — credit is real even if CMS write fails
      console.error('[swatchKitService] CMS insert failed after credit issued — MANUAL RECONCILIATION:', { orderId: cleanOrderId, creditId, err: err?.message });
    }

    return { success: true, creditId };
  }
);

/**
 * Get the active swatch kit credit for a member (for checkout display).
 *
 * @param {string} memberId
 * @returns {{ hasPendingCredit: boolean, creditId?: string, expiresAt?: Date }}
 */
export const getSwatchKitCreditStatus = webMethod(
  Permissions.Member,
  async (memberId) => {
    const cleanId = sanitize(memberId || '', 64);
    if (!cleanId) return { hasPendingCredit: false };

    try {
      const res = await wixData.query(SWATCH_KIT_ORDERS)
        .eq('memberId', cleanId)
        .eq('creditApplied', false)
        .ascending('createdAt')
        .limit(1)
        .find();

      if (!res.items.length) return { hasPendingCredit: false };

      const record = res.items[0];
      const now = new Date();
      if (record.creditExpiresAt && new Date(record.creditExpiresAt) < now) {
        return { hasPendingCredit: false, expired: true };
      }

      return {
        hasPendingCredit: true,
        creditId: record.creditId,
        expiresAt: record.creditExpiresAt,
        amount: SWATCH_KIT_CREDIT_AMOUNT,
      };
    } catch (err) {
      console.error('[swatchKitService] getSwatchKitCreditStatus failed:', err?.message);
      return { hasPendingCredit: false, error: 'lookup_failed' };
    }
  }
);

/**
 * Mark a swatch kit credit as applied (called after storeCreditService.applyStoreCredit succeeds).
 *
 * @param {string} creditId
 * @param {string} appliedOrderId — the qualifying order the credit was applied to
 * @returns {{ success: boolean, error?: string }}
 */
export const markCreditApplied = webMethod(
  Permissions.Admin,
  async (creditId, appliedOrderId) => {
    const cleanCreditId = sanitize(creditId || '', 64);
    const cleanOrderId = sanitize(appliedOrderId || '', 64);

    if (!cleanCreditId || !cleanOrderId) {
      return { success: false, error: 'invalid_params' };
    }

    try {
      const res = await wixData.query(SWATCH_KIT_ORDERS)
        .eq('creditId', cleanCreditId)
        .limit(1)
        .find();

      if (!res.items.length) return { success: false, error: 'not_found' };

      const record = res.items[0];
      await wixData.update(SWATCH_KIT_ORDERS, {
        ...record,
        creditApplied: true,
        appliedOrderId: cleanOrderId,
      });
      return { success: true };
    } catch (err) {
      console.error('[swatchKitService] markCreditApplied failed:', err?.message);
      return { success: false, error: 'update_failed' };
    }
  }
);
