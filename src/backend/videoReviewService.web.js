/**
 * @module videoReviewService
 * @description Dedicated video review upload and moderation service for the
 * VideoReviews CMS collection. Designed for cross-platform consumption by both
 * the web storefront and the Dallas mobile app.
 *
 * mediaUrl field format (API contract for Dallas mobile SDK):
 *   Accepted schemes:
 *     wix:video://v1/<id>/<filename>#origFileName=<name>  — Wix media manager video
 *     wix:image://v1/<id>/<filename>                      — Wix media manager image
 *     https://static.wixstatic.com/media/<path>           — Wix CDN static media
 *     https://<subdomain>.wixmp.com/<path>                — Wix user uploads CDN
 *
 *   All other URIs (arbitrary https://, http://, data:, javascript:, relative
 *   paths) are rejected with error: 'Must be a Wix media URL'.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 * @requires backend/gamificationEventReceiver.web
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
 * CF-q5hq — Dallas mobile unblock: mediaUrl field replaces legacy videoFileId
 * CF-ou66.3 — PDP grid and count queries for approved customer video reviews
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, isWixMediaUrl } from 'backend/utils/sanitize';
import { receiveGamificationEvent } from 'backend/gamificationEventReceiver.web';

/** @public — consumed by Dallas mobile SDK */
export const VIDEO_REVIEWS_COLLECTION = 'VideoReviews';

/**
 * URI scheme prefixes accepted as valid mediaUrl values.
 * Exported for Dallas mobile SDK validation mirror.
 * @public
 */
export const VALID_VIDEO_URI_SCHEMES = [
  'wix:video://',
  'wix:image://',
  'https://static.wixstatic.com/',
  'https://*.wixmp.com/',
];

const MAX_CAPTION = 200;
const VALID_ACTIONS = ['approved', 'rejected'];

// ── submitVideoReview ─────────────────────────────────────────────────────────

/**
 * Submit a video (or photo) review for a product.
 * Caller must be an authenticated site member.
 *
 * @param {string}      productId  - Wix product ID
 * @param {string}      mediaUrl   - Wix media URL (wix:video://, wix:image://, or CDN)
 * @param {string|null} caption    - Optional review caption; truncated to 200 chars
 * @returns {Promise<{success: boolean, reviewId?: string, error?: string}>}
 * @permission SiteMember
 */
export const submitVideoReview = webMethod(
  Permissions.SiteMember,
  async (productId, mediaUrl, caption) => {
    try {
      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: false, error: 'Product ID is required.' };

      const rawUrl = (typeof mediaUrl === 'string' ? mediaUrl : '').trim();
      if (!rawUrl) return { success: false, error: 'Must be a Wix media URL.' };
      if (!isWixMediaUrl(rawUrl)) return { success: false, error: 'Must be a Wix media URL.' };
      const cleanUrl = sanitize(rawUrl, 500);

      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Authentication required.' };

      const cleanCaption = typeof caption === 'string'
        ? sanitize(caption, MAX_CAPTION)
        : '';

      const record = await wixData.insert(VIDEO_REVIEWS_COLLECTION, {
        productId:   cleanProductId,
        memberId:    member._id,
        mediaUrl:    cleanUrl,
        caption:     cleanCaption,
        status:      'pending',
        submittedAt: new Date(),
      });

      return { success: true, reviewId: record._id };
    } catch (err) {
      console.error('[videoReviewService] submitVideoReview error:', err);
      return { success: false, error: 'internal_error' };
    }
  }
);

// ── getVideoReviews ───────────────────────────────────────────────────────────

/**
 * Retrieve approved video reviews for a product.
 *
 * @param {string}       productId
 * @param {Object|null}  [opts]
 * @param {number}       [opts.limit=12] - Page size; clamped to [1, 50]
 * @returns {Promise<{success: boolean, reviews?: Object[], totalCount?: number, error?: string}>}
 * @permission Anyone
 */
export const getVideoReviews = webMethod(
  Permissions.Anyone,
  async (productId, opts) => {
    try {
      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: false, reviews: [], error: 'Product ID is required.' };

      const rawLimit = (opts && typeof opts.limit === 'number' && !isNaN(opts.limit))
        ? opts.limit
        : 12;
      const limit = Math.min(50, Math.max(1, rawLimit));

      const result = await wixData.query(VIDEO_REVIEWS_COLLECTION)
        .eq('productId', cleanProductId)
        .eq('status', 'approved')
        .descending('submittedAt')
        .limit(limit)
        .find();

      const reviews = result.items.map(r => ({
        _id:         r._id,
        productId:   r.productId,
        memberId:    r.memberId,
        mediaUrl:    r.mediaUrl,
        caption:     r.caption ?? '',
        submittedAt: r.submittedAt,
        status:      r.status,
      }));

      return { success: true, reviews, totalCount: result.totalCount ?? reviews.length };
    } catch (err) {
      console.error('[videoReviewService] getVideoReviews error:', err);
      return { success: false, reviews: [], error: 'internal_error' };
    }
  }
);

// ── moderateVideoReview ───────────────────────────────────────────────────────

/**
 * Approve or reject a video review.
 * Fires 'video_review_approved' gamification event on approval.
 *
 * @param {string} reviewId
 * @param {'approved'|'rejected'} action
 * @returns {Promise<{success: boolean, error?: string}>}
 * @permission Admin
 */
export const moderateVideoReview = webMethod(
  Permissions.Admin,
  async (reviewId, action) => {
    try {
      const cleanId = sanitize(reviewId, 100);
      if (!cleanId) return { success: false, error: 'Review ID is required.' };

      if (!VALID_ACTIONS.includes(action)) {
        return { success: false, error: 'Action must be approved or rejected.' };
      }

      const result = await wixData.query(VIDEO_REVIEWS_COLLECTION)
        .eq('_id', cleanId)
        .find();

      if (!result.items.length) {
        return { success: false, error: 'Review not found.' };
      }

      const review = result.items[0];
      await wixData.update(VIDEO_REVIEWS_COLLECTION, { ...review, status: action });

      if (action === 'approved' && review.memberId) {
        try {
          await receiveGamificationEvent('video_review_approved', { memberId: review.memberId });
        } catch (_) {
          // gamification failure must not block moderation
        }
      }

      return { success: true };
    } catch (err) {
      console.error('[videoReviewService] moderateVideoReview error:', err);
      return { success: false, error: 'internal_error' };
    }
  }
);

// ── getProductVideoReviews (CF-ou66.3) ────────────────────────────────────────

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
      const cleanId = sanitize(productId, 50);
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

// ── getVideoReviewCount (CF-ou66.3) ───────────────────────────────────────────

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
      const cleanId = sanitize(productId, 50);
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
