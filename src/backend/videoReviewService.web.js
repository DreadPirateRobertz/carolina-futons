/**
 * @module videoReviewService
 * @description Web methods for the VideoReviews CMS collection — PDP grid and
 * count queries for approved customer video reviews.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * VideoReviews CMS collection fields:
 *   productId    (text, indexed)
 *   memberId     (text)
 *   mediaUrl     (text)         — Wix media URL (video or image)
 *   caption      (text)         — max 200 chars
 *   reviewerName (text)         — display name
 *   status       (text)         — 'pending' | 'approved' | 'rejected'
 *   submittedAt  (dateTime)
 *
 * CF-ou66.3
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { validateId } from 'backend/utils/sanitize';

const VIDEO_REVIEWS_COLLECTION = 'VideoReviews';

// ── getProductVideoReviews ────────────────────────────────────────────────────

/**
 * Get approved video reviews for a product page (PDP).
 * Returns up to 10 approved reviews sorted newest-first.
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, reviews: Object[], error?: string}>}
 * @permission Anyone
 */
export const getProductVideoReviews = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) return { success: false, reviews: [], error: 'Product ID is required.' };

      const result = await wixData.query(VIDEO_REVIEWS_COLLECTION)
        .eq('productId', cleanId)
        .eq('status', 'approved')
        .descending('submittedAt')
        .limit(10)
        .find();

      const reviews = result.items.map(r => ({
        _id:          r._id,
        productId:    r.productId,
        mediaUrl:     r.mediaUrl,
        caption:      r.caption ?? '',
        reviewerName: r.reviewerName || 'Customer',
        submittedAt:  r.submittedAt,
      }));

      return { success: true, reviews };
    } catch (err) {
      console.error('[videoReviewService] getProductVideoReviews error:', err);
      return { success: false, reviews: [], error: 'internal_error' };
    }
  }
);

// ── getVideoReviewCount ───────────────────────────────────────────────────────

/**
 * Count approved video reviews for a product.
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 * @permission Anyone
 */
export const getVideoReviewCount = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) return { success: false, count: 0, error: 'Product ID is required.' };

      const count = await wixData.query(VIDEO_REVIEWS_COLLECTION)
        .eq('productId', cleanId)
        .eq('status', 'approved')
        .count();

      return { success: true, count };
    } catch (err) {
      console.error('[videoReviewService] getVideoReviewCount error:', err);
      return { success: false, count: 0, error: 'internal_error' };
    }
  }
);
