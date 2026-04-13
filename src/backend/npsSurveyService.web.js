/**
 * npsSurveyService.web.js — NPS/CSAT survey response persistence.
 *
 * Saves post-delivery satisfaction scores (1–10 NPS) to the NpsResponses
 * Wix Data collection.  One submission per orderId is enforced server-side
 * to prevent duplicate-click and retry double-counting.
 *
 * CF-c18
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const COLLECTION = 'NpsResponses';

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Assert that score is an integer in [1, 10].
 * @param {*} score
 * @returns {boolean}
 */
function isValidScore(score) {
  return Number.isInteger(score) && score >= 1 && score <= 10;
}

// ── webMethods ────────────────────────────────────────────────────────────────

/**
 * Save an NPS survey response for the given order.
 * Idempotent: returns success without writing if a response for orderId
 * already exists (Why: delivery emails can be retried, and we never want
 * to over-count a member's score — one data point per delivery. CF-c18).
 *
 * @param {Object} params
 * @param {string} params.orderId  Wix eCommerce order ID
 * @param {number} params.score    Integer 1–10
 * @param {string} [params.comment] Optional free-text comment (max 1000 chars)
 * @returns {Promise<{success: boolean, alreadySubmitted?: boolean, error?: string}>}
 */
export const submitNpsResponse = webMethod(
  Permissions.SiteMember,
  async ({ orderId, score, comment } = {}) => {
    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'invalid_order_id' };
    }
    if (!isValidScore(score)) {
      return { success: false, error: 'invalid_score' };
    }

    // Idempotency check — one response per orderId
    let existing;
    try {
      existing = await wixData
        .query(COLLECTION)
        .eq('orderId', orderId)
        .limit(1)
        .find();
    } catch (err) {
      console.error('[npsSurveyService] idempotency query error:', err.message);
      return { success: false, error: 'internal_error' };
    }

    if (existing.items.length > 0) {
      // Why: return success so the widget doesn't surface an error to the
      // member — they already submitted and the original response is intact.
      return { success: true, alreadySubmitted: true };
    }

    const trimmedComment = comment ? String(comment).slice(0, 1000) : '';

    try {
      await wixData.insert(COLLECTION, {
        orderId,
        score,
        comment: trimmedComment,
      });
    } catch (err) {
      console.error('[npsSurveyService] insert error:', err.message);
      return { success: false, error: 'internal_error' };
    }

    return { success: true };
  }
);
